import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, Eye, EyeOff, ChevronDown, Columns3 } from 'lucide-react';
import type { Entry } from '@linkdrive/shared/types';
import { formatBytes } from '@linkdrive/shared/paths';
import type { Column, ColumnId } from '../types/explorer';
import { FileIcon } from './FileIcon';
import { typeLabel, formatDate, kindOf, type DateFormat, type FileKind } from '../utils/fileMeta';
import type { GroupBy } from './DetailsFilterBar';

type SortState = { key: ColumnId; dir: 'asc' | 'desc' };

type Group = { id: string; label: string; count: number; entries: Entry[] };

const KIND_ORDER: FileKind[] = [
  'folder',
  'image',
  'video',
  'audio',
  'document',
  'code',
  'text',
  'archive',
  'other',
];
const KIND_LABELS: Record<FileKind, string> = {
  folder: 'Folders',
  image: 'Images',
  video: 'Videos',
  audio: 'Audio',
  document: 'Documents',
  code: 'Code',
  text: 'Text',
  archive: 'Archives',
  other: 'Other',
};

function bucketByDate(mtime: number, now: number): { id: string; label: string; order: number } {
  if (!mtime) return { id: 'z-unknown', label: 'Unknown', order: 99 };
  const day = 86400000;
  const delta = now - mtime;
  if (delta < 0) return { id: 'a-future', label: 'Later', order: 0 };
  if (delta < day) return { id: 'b-today', label: 'Today', order: 1 };
  if (delta < 2 * day) return { id: 'c-yesterday', label: 'Yesterday', order: 2 };
  if (delta < 7 * day) return { id: 'd-week', label: 'This week', order: 3 };
  if (delta < 30 * day) return { id: 'e-month', label: 'This month', order: 4 };
  if (delta < 365 * day) return { id: 'f-year', label: 'This year', order: 5 };
  return { id: 'g-older', label: 'Older', order: 6 };
}

function bucketBySize(bytes: number, isDir: boolean): { id: string; label: string; order: number } {
  if (isDir) return { id: 'a-folder', label: 'Folders', order: 0 };
  const KB = 1024,
    MB = KB * 1024,
    GB = MB * 1024;
  if (bytes === 0) return { id: 'z-empty', label: 'Empty', order: 7 };
  if (bytes < 16 * KB) return { id: 'b-tiny', label: 'Tiny (< 16 KB)', order: 1 };
  if (bytes < MB) return { id: 'c-small', label: 'Small (< 1 MB)', order: 2 };
  if (bytes < 16 * MB) return { id: 'd-medium', label: 'Medium (< 16 MB)', order: 3 };
  if (bytes < 128 * MB) return { id: 'e-large', label: 'Large (< 128 MB)', order: 4 };
  if (bytes < GB) return { id: 'f-huge', label: 'Huge (< 1 GB)', order: 5 };
  return { id: 'g-giant', label: 'Giant (≥ 1 GB)', order: 6 };
}

function groupEntries(entries: Entry[], groupBy: GroupBy): Group[] {
  if (groupBy === 'none') {
    return [{ id: 'all', label: '', count: entries.length, entries }];
  }
  const now = Date.now();
  const buckets = new Map<string, { label: string; order: number; entries: Entry[] }>();
  for (const e of entries) {
    let key: { id: string; label: string; order: number };
    if (groupBy === 'type') {
      const k = kindOf(e);
      key = { id: k, label: KIND_LABELS[k], order: KIND_ORDER.indexOf(k) };
    } else if (groupBy === 'date') {
      key = bucketByDate(e.mtime, now);
    } else {
      key = bucketBySize(e.size, e.isDir);
    }
    const slot = buckets.get(key.id) ?? { label: key.label, order: key.order, entries: [] };
    slot.entries.push(e);
    buckets.set(key.id, slot);
  }
  return Array.from(buckets.entries())
    .map(([id, v]) => ({ id, label: v.label, count: v.entries.length, entries: v.entries }))
    .sort((a, b) => {
      const oa = buckets.get(a.id)?.order ?? 99;
      const ob = buckets.get(b.id)?.order ?? 99;
      return oa - ob;
    });
}

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
  groupBy,
  dateFormat,
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
  groupBy: GroupBy;
  dateFormat: DateFormat;
}) {
  const visibleCols = columns.filter((c) => c.visible);
  // First visible column (Name) absorbs slack via minmax(w, 1fr) so extra
  // width never shows up as empty gaps between the narrow right columns.
  const gridTemplate = visibleCols
    .map((c, i) => (i === 0 ? `minmax(${c.width}px, 1fr)` : `${c.width}px`))
    .join(' ');

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null);
  const [colsMenu, setColsMenu] = useState<{ x: number; y: number } | null>(null);
  const colsBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!colsMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (colsBtnRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.('[data-cols-menu]')) return;
      setColsMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [colsMenu]);

  const groups = useMemo(() => groupEntries(entries, groupBy), [entries, groupBy]);

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
    onSortChange({
      key: id,
      dir: sort.key === id ? (sort.dir === 'asc' ? 'desc' : 'asc') : 'asc',
    });
  };

  const toggleCol = (id: ColumnId) => {
    onColumnsChange(columns.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  };

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-auto" onContextMenu={(e) => onContextMenu(e, null)}>
      {/* Column header — with left-side "Columns" button */}
      <div
        className="sticky top-0 z-10 bg-ld-body border-b border-ld-border-subtle flex items-stretch text-[11px] font-medium text-ld-text-dim select-none"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setHeaderMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <button
          ref={colsBtnRef}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setColsMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
          className="flex items-center justify-center w-8 border-r border-ld-border-subtle text-ld-text-dim hover:text-ld-text hover:bg-ld-elevated shrink-0"
          title="Add or remove columns"
        >
          <Columns3 size={13} />
        </button>
        <div
          className="grid flex-1 min-w-0"
          style={{ gridTemplateColumns: gridTemplate }}
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
      </div>

      {/* Groups / rows */}
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.id);
        return (
          <div key={g.id} className="animate-fade-in">
            {groupBy !== 'none' && (
              <button
                onClick={() => toggleGroup(g.id)}
                className="w-full flex items-center gap-1.5 px-3 h-7 text-[11px] font-semibold text-ld-text-muted hover:text-ld-text hover:bg-ld-elevated border-b border-ld-border-subtle/40 sticky"
                style={{ top: 32 }}
              >
                <ChevronDown
                  size={11}
                  className={[
                    'transition-transform duration-200',
                    isCollapsed ? '-rotate-90' : '',
                  ].join(' ')}
                />
                <span className="uppercase tracking-wide">{g.label}</span>
                <span className="text-ld-text-dim font-normal">({g.count})</span>
              </button>
            )}
            <div
              className={[
                'grid transition-[grid-template-rows] duration-300 ease-out',
                isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
              ].join(' ')}
            >
              <div className="overflow-hidden">
                {g.entries.map((e, i) => {
                  const isSel = selected === e.path;
                  return (
                    <div
                      key={e.path}
                      onClick={() => onSelect(e.path)}
                      onDoubleClick={() => onOpen(e)}
                      onContextMenu={(ev) => onContextMenu(ev, e)}
                      className={[
                        'flex items-stretch text-xs border-b border-ld-border-subtle/40 cursor-default transition-colors animate-fade-in',
                        isSel ? 'bg-brand-red/10' : 'hover:bg-ld-elevated',
                      ].join(' ')}
                      style={{ animationDelay: `${Math.min(i, 20) * 12}ms` }}
                    >
                      <div className="w-8 shrink-0" />
                      <div
                        className="grid flex-1 min-w-0 items-center"
                        style={{ gridTemplateColumns: gridTemplate }}
                      >
                        {visibleCols.map((c) => (
                          <Cell key={c.id} col={c} entry={e} dateFormat={dateFormat} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Columns menu — portal to escape any transformed ancestor so it
          appears exactly at the trigger/cursor location. */}
      {(headerMenu || colsMenu) &&
        createPortal(
          <div
            data-cols-menu
            className="fixed z-50 min-w-[200px] rounded-lg border border-ld-border bg-ld-card shadow-2xl py-1 animate-scale-in"
            style={{
              left: (headerMenu ?? colsMenu)!.x,
              top: (headerMenu ?? colsMenu)!.y,
            }}
            onMouseLeave={() => {
              if (headerMenu) setHeaderMenu(null);
            }}
          >
            <div className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wide text-ld-text-dim font-semibold">
              Columns
            </div>
            {columns.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleCol(c.id)}
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
          </div>,
          document.body,
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
        {active && (sort.dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
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

function Cell({
  col,
  entry,
  dateFormat,
}: {
  col: Column;
  entry: Entry;
  dateFormat: DateFormat;
}) {
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
        {formatDate(entry.mtime, dateFormat)}
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
