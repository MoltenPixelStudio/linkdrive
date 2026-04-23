// Typed wrapper around Tauri local-FS commands.
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Entry } from '@linkdrive/shared/types';

type RustEntry = {
  name: string;
  path: string;
  size: number;
  mtime: number;
  is_dir: boolean;
  is_symlink: boolean;
};

function fromRust(e: RustEntry): Entry {
  return {
    name: e.name,
    path: e.path,
    size: e.size,
    mtime: e.mtime,
    isDir: e.is_dir,
    isSymlink: e.is_symlink,
  };
}

export async function ls(path: string): Promise<Entry[]> {
  const rows = await invoke<RustEntry[]>('ls', { path });
  return rows.map(fromRust);
}

export async function stat(path: string): Promise<Entry> {
  return fromRust(await invoke<RustEntry>('stat', { path }));
}

export async function readText(path: string): Promise<string> {
  return invoke<string>('read_text', { path });
}

export async function mkdir(path: string): Promise<void> {
  await invoke('mkdir', { path });
}

export async function rename(from: string, to: string): Promise<void> {
  await invoke('rename', { from, to });
}

export async function deletePath(path: string, recursive = false): Promise<void> {
  await invoke('delete_path', { path, recursive });
}

export async function homeDir(): Promise<string> {
  return invoke<string>('home_dir');
}

export function fileUrl(path: string): string {
  return convertFileSrc(path);
}
