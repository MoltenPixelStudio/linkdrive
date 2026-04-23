// POSIX-style path utils that work for both local and remote paths.
// Remote hosts are always POSIX regardless of client OS.

export function joinPath(...parts: string[]): string {
  const cleaned = parts
    .filter((p) => p && p.length > 0)
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')));
  const joined = cleaned.join('/');
  return joined || '/';
}

export function dirname(path: string): string {
  if (path === '/' || path === '') return '/';
  const trimmed = path.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  if (idx <= 0) return '/';
  return trimmed.slice(0, idx);
}

export function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx < 0 ? trimmed : trimmed.slice(idx + 1);
}

export function extname(path: string): string {
  const base = basename(path);
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx).toLowerCase();
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
