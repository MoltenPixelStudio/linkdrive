import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Entry } from '@linkdrive/shared/types';
import { formatBytes, extname } from '@linkdrive/shared/paths';
import type { Source } from '../utils/source';
import { FileIcon } from './FileIcon';
import { typeLabel } from '../utils/fileMeta';

export function PropertiesModal({
  entry,
  source,
  folderSizes,
  onClose,
}: {
  entry: Entry;
  source: Source;
  folderSizes: Map<string, number>;
  onClose: () => void;
}) {
  const [computedSize, setComputedSize] = useState<number | null>(null);
  const [liveStat, setLiveStat] = useState<Entry | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await source.stat(entry.path);
        if (!cancelled) setLiveStat(s);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.path, source]);

  useEffect(() => {
    if (!entry.isDir) return;
    const cached = folderSizes.get(entry.path);
    if (cached !== undefined && cached >= 0) {
      setComputedSize(cached);
      return;
    }
    if (!source.dirSize) return;
    let cancelled = false;
    source
      .dirSize(entry.path)
      .then((s) => !cancelled && setComputedSize(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entry.path, entry.isDir, folderSizes, source]);

  const show = liveStat ?? entry;
  const size = entry.isDir ? computedSize : show.size;

  const rows: [string, React.ReactNode][] = [
    ['Name', show.name || entry.name],
    ['Path', show.path],
    ['Type', show.isDir ? 'Folder' : typeLabel(show)],
    ['Extension', extname(show.path) || '—'],
    [
      'Size',
      size === null || size === undefined ? (
        <span className="text-ld-text-dim">Computing…</span>
      ) : size < 0 ? (
        <span className="text-ld-text-dim">—</span>
      ) : (
        `${formatBytes(size)} (${size.toLocaleString()} bytes)`
      ),
    ],
    ['Modified', show.mtime ? new Date(show.mtime).toLocaleString() : '—'],
    ['Source', `${source.kind === 'local' ? 'Local' : 'SFTP'} — ${source.label}`],
    ['Symlink', show.isSymlink ? 'yes' : 'no'],
    [
      'Permissions',
      show.mode != null
        ? `${(show.mode & 0o777).toString(8)} (mode: 0o${show.mode.toString(8)})`
        : '—',
    ],
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 bg-ld-overlay flex items-center justify-center animate-fade-in">
      <div className="w-[460px] rounded-2xl border border-ld-border bg-ld-card shadow-2xl animate-scale-in">
        <header className="flex items-center justify-between border-b border-ld-border px-5 h-12">
          <h3 className="text-sm font-semibold">Properties</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-ld-elevated text-ld-text-muted"
          >
            <X size={14} />
          </button>
        </header>

        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <FileIcon entry={show} size={48} withThumbnail />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ld-text truncate">
                {show.name || entry.name}
              </div>
              <div className="text-[11px] text-ld-text-muted font-mono truncate">
                {show.path}
              </div>
            </div>
          </div>

          <dl className="text-[12px] divide-y divide-ld-border-subtle/40">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-1.5">
                <dt className="text-ld-text-muted">{k}</dt>
                <dd className="text-ld-text break-all">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg bg-brand-red text-white font-semibold text-sm hover:brightness-110"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
