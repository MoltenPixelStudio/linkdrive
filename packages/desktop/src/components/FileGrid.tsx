import type { Entry } from '@linkdrive/shared/types';
import { formatBytes } from '@linkdrive/shared/paths';
import type { ViewMode } from '../types/explorer';
import { FileIcon } from './FileIcon';
import { typeLabel, formatDate } from '../utils/fileMeta';

type Variant = Exclude<ViewMode, 'details'>;

const VARIANTS: Record<Variant, { iconSize: number; cellW: number; cellH: number; twoLine: boolean }> = {
  'large-icons': { iconSize: 96, cellW: 140, cellH: 160, twoLine: false },
  'medium-icons': { iconSize: 64, cellW: 104, cellH: 124, twoLine: false },
  'small-icons': { iconSize: 36, cellW: 80, cellH: 80, twoLine: false },
  list: { iconSize: 16, cellW: 220, cellH: 24, twoLine: false },
  tiles: { iconSize: 48, cellW: 260, cellH: 68, twoLine: true },
};

export function FileGrid({
  entries,
  mode,
  selected,
  onSelect,
  onOpen,
  onContextMenu,
}: {
  entries: Entry[];
  mode: Variant;
  selected: string | null;
  onSelect: (path: string) => void;
  onOpen: (e: Entry) => void;
  onContextMenu: (e: React.MouseEvent, entry: Entry | null) => void;
}) {
  const v = VARIANTS[mode];

  if (mode === 'list') {
    return (
      <div
        className="flex-1 overflow-auto p-2"
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <div
          className="grid gap-x-4"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${v.cellW}px, 1fr))` }}
        >
          {entries.map((e) => {
            const isSel = selected === e.path;
            return (
              <button
                key={e.path}
                onClick={() => onSelect(e.path)}
                onDoubleClick={() => onOpen(e)}
                onContextMenu={(ev) => onContextMenu(ev, e)}
                className={[
                  'flex items-center gap-2 h-6 px-2 rounded text-left text-xs text-ld-text truncate',
                  isSel ? 'bg-brand-red/15' : 'hover:bg-ld-elevated',
                ].join(' ')}
                title={e.name}
              >
                <FileIcon entry={e} size={v.iconSize} />
                <span className="truncate">{e.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === 'tiles') {
    return (
      <div
        className="flex-1 overflow-auto p-3"
        onContextMenu={(e) => onContextMenu(e, null)}
      >
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${v.cellW}px, 1fr))` }}
        >
          {entries.map((e) => {
            const isSel = selected === e.path;
            return (
              <button
                key={e.path}
                onClick={() => onSelect(e.path)}
                onDoubleClick={() => onOpen(e)}
                onContextMenu={(ev) => onContextMenu(ev, e)}
                className={[
                  'flex items-center gap-3 p-2 rounded-lg border text-left animate-fade-in',
                  isSel
                    ? 'border-brand-red/50 bg-brand-red/10'
                    : 'border-transparent hover:border-ld-border-subtle hover:bg-ld-elevated',
                ].join(' ')}
                title={e.name}
              >
                <FileIcon entry={e} size={v.iconSize} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-ld-text truncate">{e.name}</div>
                  <div className="text-[10px] text-ld-text-muted truncate">
                    {typeLabel(e)} · {e.isDir ? '—' : formatBytes(e.size)} ·{' '}
                    {formatDate(e.mtime)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Icon grids (large/medium/small)
  return (
    <div
      className="flex-1 overflow-auto p-3"
      onContextMenu={(e) => onContextMenu(e, null)}
    >
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${v.cellW}px, 1fr))` }}
      >
        {entries.map((e) => {
          const isSel = selected === e.path;
          return (
            <button
              key={e.path}
              onClick={() => onSelect(e.path)}
              onDoubleClick={() => onOpen(e)}
              onContextMenu={(ev) => onContextMenu(ev, e)}
              className={[
                'flex flex-col items-center gap-1 p-2 rounded-lg border text-left animate-scale-in',
                isSel
                  ? 'border-brand-red/50 bg-brand-red/10'
                  : 'border-transparent hover:border-ld-border-subtle hover:bg-ld-elevated',
              ].join(' ')}
              title={e.name}
              style={{ minHeight: v.cellH }}
            >
              <FileIcon entry={e} size={v.iconSize} />
              <span className="text-[11px] text-center text-ld-text truncate w-full mt-1">
                {e.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
