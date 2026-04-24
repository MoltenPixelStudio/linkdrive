fn main() {
    // Explicitly embed PE VersionInfo so that File → Properties and UAC /
    // SmartScreen show "MoltenPixelStudio" as the publisher even when the
    // binary is unsigned. Tauri's own resource generation is conditional on
    // bundle.active, which we've turned off (we ship a self-installing
    // single exe), so set the resources here instead.
    let target = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target == "windows" {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("icons/icon.ico");
        res.set("CompanyName", "MoltenPixelStudio");
        res.set("ProductName", "LinkDrive");
        res.set("FileDescription", "LinkDrive — cross-device file explorer");
        res.set("LegalCopyright", "Copyright 2026 MoltenPixelStudio");
        res.set("FileVersion", "0.1.0.0");
        res.set("ProductVersion", "0.1.0.0");
        res.set("OriginalFilename", "LinkDrive.exe");
        res.set("InternalName", "LinkDrive");
        // Silent-fail on Linux cross builds that can't find a resource
        // compiler — the binary still runs, just without richer metadata.
        if let Err(e) = res.compile() {
            eprintln!("cargo:warning=winresource compile failed: {e}");
        }
    }
    tauri_build::build()
}
