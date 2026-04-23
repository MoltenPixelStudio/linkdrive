import { useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import type { Entry } from '@linkdrive/shared/types';
import { formatBytes } from '@linkdrive/shared/paths';
import type { Column, ColumnId } from '../types/explorer';
import { FileIcon } from './FileIcon';
import { typeLabel, formatDate } from '../utils/fileMeta';

type SortState = { key: ColumnId; dir: 'asc' | 'desc' };

export function FileDetails({
  entries,
  columns,
  onColumnsChange,
  selected,
  onSelect,
  onOpen,
  onContextMenu,
  sort,
  onSortChange,
}: {
  entries: Entry[];
  columns: Column[];
  onColumnsChange: (next: Column[]) => void;
  selected: string | null;
  onSelect: (path: string) => void;
  onOpen: (e: Entry) => void;
  onContextMenu: (e: React.MouseEvent, entry: Entry | null) => void;
  sort: SortState;
  onSortChange: (next: SortState) => void;
}) {
  const visibleCols = columns.filter((c) => c.visible);
  const gridTemplate = visibleCols.map((c) => `${c.width}px`).join(' ');

  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null);

  const startResize = (colId: ColumnId, startX: number, startWidth: number) => {
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const col = columns.find((c) => c.id === colId)!;
      const newWidth = Math.max(col.minWidth, startWidth + delta);
      onColumnsChange(columns.map((c) => (c.id === colId ? { ...c, width: newWidth } : c)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const clickHeader = (id: ColumnId) => {
    if (sort.key === id) {
      onSortChange({ key: id, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ key: id, dir: 'asc' });
    }
  };

  const toggleCol = (id: ColumnId) => {
    onColumnsChange(columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  };

  return (
    <div className="flex-1 overflow-auto" onContextMenu={(e) => onContextMenu(e, null)}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-ld-body border-b border-ld-border-subtle grid text-[11px] font-medium text-ld-text-dim select-none"
        style={{ gridTemplateColumns: gridTemplate }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setHeaderMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {visibleCols.map((c) => (
          <HeaderCell
            key={c.id}
            col={c}
            sort={sort}
            onClick={() => clickHeader(c.id)}
            onStartResize={(e) => startResize(c.id, e.clientX, c.width)}
          />
        ))}
      </div>

      {/* Rows */}
      {entries.map((e) => {
        const isSel = selected === e.path;
        return (
          <div
            key={e.path}
            onClick={() => onSelect(e.path)}
            onDoubleClick={() => onOpen(e)}
            onContextMenu={(ev) => onContextMenu(ev, e)}
            className={[
              'grid items-center text-xs border-b border-ld-border-subtle/40 cursor-default transition-colors',
              isSel ? 'bg-brand-red/10' : 'hover:bg-ld-elevated',
            ].join(' ')}
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {visibleCols.map((c) => (
              <Cell key={c.id} col={c} entry={e} />
            ))}
          </div>
        );
      })}

      {/* Header right-click menu: toggle column visibility */}
      {headerMenu && (
        <div
          className="fixed z-50 min-w-[180px] rounded-lg border border-ld-border bg-ld-card shadow-2xl py-1 animate-scale-in"
          style={{ left: headerMenu.x, top: headerMenu.y }}
          onMouseLeave={() => setHeaderMenu(null)}
        >
          {columns.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                toggleCol(c.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-ld-elevated text-ld-text"
            >
              {c.visible ? (
                <Eye size={12} className="text-brand-red" />
              ) : (
                <EyeOff size={12} className="text-ld-text-dim" />
              )}
              <span>{c.label}</span>
            </button>
          ))}
          <div className="px-3 py-1 text-[10px] text-ld-text-dim border-t border-ld-border-subtle mt-1">
            Right-click a header to toggle
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderCell({
  col,
  sort,
  onClick,
  onStartResize,
}: {
  col: Column;
  sort: SortState;
  onClick: () => void;
  onStartResize: (e: React.MouseEvent) => void;
}) {
  const active = sort.key === col.id;
  return (
    <div className="relative flex items-center gap-1 px-3 py-2 group">
      <button
        onClick={onClick}
        className={[
          'flex items-center gap-1 flex-1 text-left hover:text-ld-text transition-colors',
          col.align === 'right' ? 'justify-end' : '',
          active ? 'text-ld-text' : '',
        ].join(' ')}
      >
        <span>{col.label}</span>
        {active &&
          (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </button>
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onStartResize(e);
        }}
        className="absolute right-0 top-1 bottom-1 w-1.5 cursor-col-resize group-hover:bg-ld-border-subtle"
      />
    </div>
  );
}

function Cell({ col, entry }: { col: Column; entry: Entry }) {
  if (col.id === 'name') {
    return (
      <div className="flex items-center gap-2 px-3 py-1 min-w-0">
        <FileIcon entry={entry} size={18} />
        <span className="text-ld-text truncate">{entry.name}</span>
        {entry.isSymlink && <span className="text-[10px] text-ld-text-dim">link</span>}
      </div>
    );
  }
  if (col.id === 'size') {
    return (
      <div className="px-3 py-1 text-right font-mono text-ld-text-muted">
        {entry.isDir ? '—' : formatBytes(entry.size)}
      </div>
    );
  }
  if (col.id === 'type') {
    return <div className="px-3 py-1 text-ld-text-muted truncate">{typeLabel(entry)}</div>;
  }
  if (col.id === 'modified') {
    return (
      <div className="px-3 py-1 text-right text-ld-text-muted">
        {formatDate(entry.mtime)}
      </div>
    );
  }
  if (col.id === 'permissions') {
    return (
      <div className="px-3 py-1 text-ld-text-dim font-mono">
        {entry.mode ? (entry.mode & 0o777).toString(8) : '—'}
      </div>
    );
  }
  if (col.id === 'owner') {
    return <div className="px-3 py-1 text-ld-text-dim truncate">{entry.owner ?? '—'}</div>;
  }
  return null;
}
