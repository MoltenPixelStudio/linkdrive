import type { Entry } from '@linkdrive/shared/types';
import { extname } from '@linkdrive/shared/paths';

const IMG = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif']);
const VID = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v']);
const CODE = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.rs', '.py', '.go', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.json', '.yml', '.yaml', '.toml', '.xml',
  '.sh', '.bash', '.zsh', '.fish',
  '.html', '.css', '.scss', '.less',
  '.sql', '.lua', '.rb', '.php',
]);
const TEXT = new Set(['.md', '.txt', '.log', '.csv', '.tsv', '.rst']);
const ARCHIVE = new Set(['.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar']);
const AUDIO = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a']);
const DOC = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']);

export type FileKind =
  | 'folder'
  | 'image'
  | 'video'
  | 'audio'
  | 'code'
  | 'text'
  | 'archive'
  | 'document'
  | 'other';

export function kindOf(e: Entry): FileKind {
  if (e.isDir) return 'folder';
  const ext = extname(e.path);
  if (IMG.has(ext)) return 'image';
  if (VID.has(ext)) return 'video';
  if (AUDIO.has(ext)) return 'audio';
  if (CODE.has(ext)) return 'code';
  if (TEXT.has(ext)) return 'text';
  if (ARCHIVE.has(ext)) return 'archive';
  if (DOC.has(ext)) return 'document';
  return 'other';
}

export function typeLabel(e: Entry): string {
  if (e.isDir) return 'Folder';
  const ext = extname(e.path);
  if (!ext) return 'File';
  return `${ext.slice(1).toUpperCase()} file`;
}

export function isImage(e: Entry): boolean {
  return !e.isDir && IMG.has(extname(e.path));
}

export function isVideo(e: Entry): boolean {
  return !e.isDir && VID.has(extname(e.path));
}

export function isText(e: Entry): boolean {
  return !e.isDir && (TEXT.has(extname(e.path)) || CODE.has(extname(e.path)));
}

export function formatDate(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  const opts: Intl.DateTimeFormatOptions = sameYear
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString([], opts);
}
