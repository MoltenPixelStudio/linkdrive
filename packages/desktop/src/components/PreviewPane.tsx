import { useEffect, useState } from 'react';
import { FileText, FileImage, File, FileVideo } from 'lucide-react';
import type { Entry } from '@linkdrive/shared/types';
import { extname, formatBytes } from '@linkdrive/shared/paths';
import { readText, fileUrl } from '../utils/fs';

const IMG = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp']);
const VID = new Set(['.mp4', '.mov', '.mkv', '.webm']);
const TEXT = new Set([
  '.md', '.txt', '.log', '.csv', '.json', '.yml', '.yaml', '.toml',
  '.ts', '.tsx', '.js', '.jsx', '.rs', '.py', '.go', '.sh', '.html', '.css',
]);

type Kind = 'image' | 'video' | 'text' | 'other' | 'dir' | 'none';

function kindOf(e: Entry | null): Kind {
  if (!e) return 'none';
  if (e.isDir) return 'dir';
  const ext = extname(e.path);
  if (IMG.has(ext)) return 'image';
  if (VID.has(ext)) return 'video';
  if (TEXT.has(ext)) return 'text';
  return 'other';
}

export function PreviewPane({ entry }: { entry: Entry | null }) {
  const kind = kindOf(entry);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setText(null);
    setErr(null);
    if (!entry || kind !== 'text') return;
    let cancelled = false;
    readText(entry.path)
      .then((t) => !cancelled && setText(t))
      .catch((e: unknown) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [entry?.path, kind]);

  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-ld-text-dim">
        Select a file to preview
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="h-10 border-b border-ld-border-subtle px-4 flex items-center gap-2">
        <span className="text-xs font-medium text-ld-text truncate">{entry.name}</span>
      </header>

      <div className="flex-1 overflow-auto p-4 animate-fade-in">
        {kind === 'image' && (
          <img
            src={fileUrl(entry.path)}
            alt={entry.name}
            className="max-w-full max-h-full object-contain mx-auto rounded-md border border-ld-border-subtle"
          />
        )}
        {kind === 'video' && (
          <video
            src={fileUrl(entry.path)}
            controls
            className="max-w-full max-h-full mx-auto rounded-md border border-ld-border-subtle"
          />
        )}
        {kind === 'text' && (
          <>
            {err && <div className="text-xs text-ld-text-dim">{err}</div>}
            {text !== null && (
              <pre className="text-[11px] font-mono whitespace-pre-wrap text-ld-text leading-relaxed">
                {text}
              </pre>
            )}
            {!text && !err && (
              <div className="text-xs text-ld-text-dim">Loading…</div>
            )}
          </>
        )}
        {(kind === 'other' || kind === 'dir') && <InfoCard entry={entry} kind={kind} />}
      </div>

      <footer className="border-t border-ld-border-subtle px-4 py-2 text-[11px] text-ld-text-dim font-mono">
        {entry.path}
      </footer>
    </div>
  );
}

function InfoCard({ entry, kind }: { entry: Entry; kind: Kind }) {
  const Icon =
    kind === 'dir' ? FileText : kind === 'other' ? File : kind === 'image' ? FileImage : FileVideo;
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-8">
      <div className="h-20 w-20 rounded-2xl bg-ld-elevated flex items-center justify-center">
        <Icon size={36} className="text-ld-text-muted" strokeWidth={1.4} />
      </div>
      <div className="text-sm font-medium text-ld-text">{entry.name}</div>
      <div className="text-xs text-ld-text-muted">
        {entry.isDir ? 'Folder' : formatBytes(entry.size)}
      </div>
    </div>
  );
}
