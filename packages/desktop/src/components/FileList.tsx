import { File, Folder, FileText, FileImage, FileVideo, FileCode } from 'lucide-react';
import { formatBytes, extname } from '@linkdrive/shared/paths';
import type { Entry } from '@linkdrive/shared/types';
import type { ViewMode } from './Toolbar';

const IMG = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const VID = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi']);
const CODE = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.rs', '.py', '.go', '.java', '.c', '.cpp', '.h',
  '.json', '.yml', '.yaml', '.toml', '.sh', '.html', '.css',
]);
const TEXT = new Set(['.md', '.txt', '.log', '.csv']);

function iconFor(e: Entry) {
  if (e.isDir) return Folder;
  const ext = extname(e.path);
  if (IMG.has(ext)) return FileImage;
  if (VID.has(ext)) return FileVideo;
  if (CODE.has(ext)) return FileCode;
  if (TEXT.has(ext)) return FileText;
  return File;
}

function formatDate(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
}

export function FileList({
  entries,
  view,
  selected,
  onSelect,
  onOpen,
}: {
  entries: Entry[];
  view: ViewMode;
  selected: string | null;
  onSelect: (path: string) => void;
  onOpen: (entry: Entry) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-ld-text-dim text-sm">
        Empty folder
      </div>
    );
  }

  if (view === 'grid') {
    return (
      <div className="flex-1 overflow-y-auto p-3">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))' }}
        >
          {entries.map((e) => {
            const Icon = iconFor(e);
            const isSel = selected === e.path;
            return (
              <button
                key={e.path}
                onClick={() => onSelect(e.path)}
                onDoubleClick={() => onOpen(e)}
                className={[
                  'flex flex-col items-center gap-1 p-3 rounded-lg border text-left animate-scale-in',
                  isSel
                    ? 'border-brand-red/60 bg-brand-red/10'
                    : 'border-transparent hover:border-ld-border-subtle hover:bg-ld-elevated',
                ].join(' ')}
                title={e.name}
              >
                <Icon
                  size={34}
                  className={e.isDir ? 'text-brand-red' : 'text-ld-text-muted'}
                  strokeWidth={1.5}
                />
                <span className="text-[11px] text-center text-ld-text truncate w-full">
                  {e.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-ld-body text-ld-text-dim">
          <tr className="border-b border-ld-border-subtle">
            <th className="text-left font-medium px-4 py-2">Name</th>
            <th className="text-right font-medium px-4 py-2 w-28">Size</th>
            <th className="text-right font-medium px-4 py-2 w-32">Modified</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const Icon = iconFor(e);
            const isSel = selected === e.path;
            return (
              <tr
                key={e.path}
                onClick={() => onSelect(e.path)}
                onDoubleClick={() => onOpen(e)}
                className={[
                  'cursor-default border-b border-ld-border-subtle/50 transition-colors',
                  isSel ? 'bg-brand-red/10' : 'hover:bg-ld-elevated',
                ].join(' ')}
              >
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      size={14}
                      className={e.isDir ? 'text-brand-red shrink-0' : 'text-ld-text-muted shrink-0'}
                      strokeWidth={1.7}
                    />
                    <span className="text-ld-text truncate">{e.name}</span>
                    {e.isSymlink && (
                      <span className="text-[10px] text-ld-text-dim">link</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-1.5 text-right text-ld-text-muted font-mono">
                  {e.isDir ? '—' : formatBytes(e.size)}
                </td>
                <td className="px-4 py-1.5 text-right text-ld-text-muted">
                  {formatDate(e.mtime)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
