// Windows shell integration: open files with default app / pick-app dialog,
// and extract the system icon for a given file path or extension so the
// renderer can show real shell icons instead of generic lucide glyphs.

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
pub struct IconCache(pub Mutex<HashMap<String, Vec<u8>>>);

#[cfg(windows)]
fn wide_null(s: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

#[tauri::command]
pub fn shell_open(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::ptr::null_mut;
        use winapi::shared::windef::HWND;
        use winapi::um::shellapi::ShellExecuteW;
        use winapi::um::winuser::SW_SHOWNORMAL;
        let file = wide_null(&path);
        let verb = wide_null("open");
        let code = unsafe {
            ShellExecuteW(
                null_mut() as HWND,
                verb.as_ptr(),
                file.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            ) as isize
        };
        if code <= 32 {
            return Err(format!("shell open failed (code {code})"));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("shell_open: not implemented on this platform".into())
    }
}

#[tauri::command]
pub fn shell_open_with(path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use winapi::um::shellapi::{ShellExecuteExW, SHELLEXECUTEINFOW, SEE_MASK_INVOKEIDLIST};
        use winapi::um::winuser::SW_SHOWDEFAULT;
        let file = wide_null(&path);
        let verb = wide_null("openas");
        unsafe {
            let mut info: SHELLEXECUTEINFOW = std::mem::zeroed();
            info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
            info.fMask = SEE_MASK_INVOKEIDLIST;
            info.lpVerb = verb.as_ptr();
            info.lpFile = file.as_ptr();
            info.nShow = SW_SHOWDEFAULT;
            if ShellExecuteExW(&mut info) == 0 {
                let err = winapi::um::errhandlingapi::GetLastError();
                return Err(format!("openas failed (err {err})"));
            }
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        Err("shell_open_with: not implemented on this platform".into())
    }
}

#[tauri::command]
pub fn shell_icon(
    cache: State<IconCache>,
    ext_or_path: String,
    large: bool,
) -> Result<Vec<u8>, String> {
    let key = format!("{ext_or_path}|{large}");
    if let Ok(map) = cache.0.lock() {
        if let Some(bytes) = map.get(&key) {
            return Ok(bytes.clone());
        }
    }

    #[cfg(windows)]
    {
        use std::ptr::null_mut;
        use winapi::shared::windef::HICON;
        use winapi::um::shellapi::{
            SHFILEINFOW, SHGetFileInfoW, SHGFI_ICON, SHGFI_LARGEICON, SHGFI_SMALLICON,
            SHGFI_USEFILEATTRIBUTES,
        };
        use winapi::um::wingdi::{
            DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
            DIB_RGB_COLORS,
        };
        use winapi::um::winuser::{
            DestroyIcon, GetDC, GetIconInfo, ReleaseDC, ICONINFO,
        };

        let is_extension = ext_or_path.starts_with('.')
            && !ext_or_path.contains('/')
            && !ext_or_path.contains('\\');
        let fname = if is_extension {
            format!("dummy{ext_or_path}")
        } else {
            ext_or_path.clone()
        };
        let wide = wide_null(&fname);

        let mut info: SHFILEINFOW = unsafe { std::mem::zeroed() };
        let flags = SHGFI_ICON
            | if large { SHGFI_LARGEICON } else { SHGFI_SMALLICON }
            | if is_extension { SHGFI_USEFILEATTRIBUTES } else { 0 };
        let attrs: u32 = if is_extension { 0x80 /* FILE_ATTRIBUTE_NORMAL */ } else { 0 };
        let res = unsafe {
            SHGetFileInfoW(
                wide.as_ptr(),
                attrs,
                &mut info,
                std::mem::size_of::<SHFILEINFOW>() as u32,
                flags,
            )
        };
        if res == 0 || info.hIcon.is_null() {
            return Err("no icon".into());
        }

        let png = unsafe { hicon_to_png(info.hIcon) };
        unsafe {
            DestroyIcon(info.hIcon);
        }
        let png = png?;
        if let Ok(mut map) = cache.0.lock() {
            map.insert(key, png.clone());
        }
        return Ok(png);

        #[inline]
        unsafe fn hicon_to_png(hicon: HICON) -> Result<Vec<u8>, String> {
            let mut info: ICONINFO = std::mem::zeroed();
            if GetIconInfo(hicon, &mut info) == 0 {
                return Err("GetIconInfo failed".into());
            }
            let hbm = info.hbmColor;
            if hbm.is_null() {
                return Err("icon has no color bitmap".into());
            }

            let mut bm: BITMAP = std::mem::zeroed();
            if GetObjectW(
                hbm as *mut _,
                std::mem::size_of::<BITMAP>() as i32,
                &mut bm as *mut _ as *mut _,
            ) == 0
            {
                return Err("GetObjectW failed".into());
            }

            let w = bm.bmWidth;
            let h = bm.bmHeight;
            let mut bi: BITMAPINFO = std::mem::zeroed();
            bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bi.bmiHeader.biWidth = w;
            bi.bmiHeader.biHeight = -h;
            bi.bmiHeader.biPlanes = 1;
            bi.bmiHeader.biBitCount = 32;
            bi.bmiHeader.biCompression = BI_RGB;

            let hdc = GetDC(null_mut());
            let mut pixels = vec![0u8; (w * h * 4) as usize];
            let ok = GetDIBits(
                hdc,
                hbm,
                0,
                h as u32,
                pixels.as_mut_ptr() as *mut _,
                &mut bi,
                DIB_RGB_COLORS,
            );
            ReleaseDC(null_mut(), hdc);
            if ok == 0 {
                return Err("GetDIBits failed".into());
            }

            for chunk in pixels.chunks_exact_mut(4) {
                chunk.swap(0, 2);
            }

            DeleteObject(info.hbmColor as *mut _);
            if !info.hbmMask.is_null() {
                DeleteObject(info.hbmMask as *mut _);
            }

            let mut out = Vec::with_capacity(4096);
            {
                let mut encoder = png::Encoder::new(&mut out, w as u32, h as u32);
                encoder.set_color(png::ColorType::Rgba);
                encoder.set_depth(png::BitDepth::Eight);
                let mut writer = encoder
                    .write_header()
                    .map_err(|e| format!("png header: {e}"))?;
                writer
                    .write_image_data(&pixels)
                    .map_err(|e| format!("png write: {e}"))?;
            }
            Ok(out)
        }
    }
    #[cfg(not(windows))]
    {
        let _ = large;
        Err("shell_icon: not implemented on this platform".into())
    }
}
