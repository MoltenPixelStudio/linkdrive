import { invoke } from '@tauri-apps/api/core';

export function shellOpen(path: string): Promise<void> {
  return invoke<void>('shell_open', { path });
}

export function shellOpenWith(path: string): Promise<void> {
  return invoke<void>('shell_open_with', { path });
}

export function tempPathFor(name: string): Promise<string> {
  return invoke<string>('temp_path_for', { name });
}

// Accepts either an extension like ".mp3" (faster, uses system attributes)
// or a full path. `large` picks the 32x32 icon; otherwise 16x16.
const ICON_CACHE = new Map<string, string>();
const PENDING = new Map<string, Promise<string | null>>();

export function shellIcon(extOrPath: string, large = true): Promise<string | null> {
  const key = `${extOrPath}|${large}`;
  const cached = ICON_CACHE.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const pending = PENDING.get(key);
  if (pending) return pending;
  const p = (async () => {
    try {
      const bytes = await invoke<number[]>('shell_icon', {
        extOrPath,
        large,
      });
      const arr = Uint8Array.from(bytes);
      const blob = new Blob([arr.buffer as ArrayBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      ICON_CACHE.set(key, url);
      return url;
    } catch {
      ICON_CACHE.set(key, '');
      return null;
    } finally {
      PENDING.delete(key);
    }
  })();
  PENDING.set(key, p);
  return p;
}
