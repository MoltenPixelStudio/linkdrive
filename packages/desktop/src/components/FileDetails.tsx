import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronDown, Columns3 } from 'lucide-react';
import type { Entry } from '@linkdrive/shared/types';
import { formatBytes } from '@linkdrive/shared/paths';
import type { Column, ColumnId } from '../types/explorer';
import { FileIcon } from './FileIcon';
import { typeLabel, formatDate, kindOf, type DateFormat, type FileKind } from '../utils/fileMeta';
import { ColumnsMenu } from './ColumnsMenu';

export type GroupBy = 'none' | 'type' | 'date' | 'size';

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

function bucketBySize(
  bytes: number,
  isDir: boolean,
  folderSize: number | undefined,
): { id: string; label: string; order: number } {
  const size = isDir ? (folderSize ?? 0) : bytes;
  const KB = 1024,
    MB = KB * 1024,
    GB = MB * 1024;
  if (isDir && folderSize === undefined) return { id: 'z-pending', label: 'Computing…', order: 8 };
  if (size === 0) return { id: 'z-empty', label: 'Empty', order: 7 };
  if (size < 16 * KB) return { id: 'b-tiny', label: 'Tiny (< 16 KB)', order: 1 };
  if (size < MB) return { id: 'c-small', label: 'Small (< 1 MB)', order: 2 };
  if (size < 16 * MB) return { id: 'd-medium', label: 'Medium (< 16 MB)', order: 3 };
  if (size < 128 * MB) return { id: 'e-large', label: 'Large (< 128 MB)', order: 4 };
  if (size < GB) return { id: 'f-huge', label: 'Huge (< 1 GB)', order: 5 };
  return { id: 'g-giant', label: 'Giant (≥ 1 GB)', order: 6 };
}

function groupEntries(
  entries: Entry[],
  groupBy: GroupBy,
  folderSizes: Map<string, number>,
): Group[] {
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
      const fs = e.isDir ? folderSizes.get(e.path) : e.size;
      const resolved = fs === -1 ? 0 : fs;
      key = bucketBySize(e.size, e.isDir, resolved);
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
  onGroupChange,
  showHidden,
  onToggleHidden,
  foldersFirst,
  onToggleFoldersFirst,
  dateFormat,
  onDateFormatChange,
  folderSizes,
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
  onGroupChange: (g: GroupBy) => void;
  showHidden: boolean;
  onToggleHidden: () => void;
  foldersFirst: boolean;
  onToggleFoldersFirst: () => void;
  dateFormat: DateFormat;
  onDateFormatChange: (f: DateFormat) => void;
  folderSizes: Map<string, number>;
}) {
  const visibleCols = columns.filter((c) => c.visible);
  const gridTemplate = visibleCols
    .map((c, i) => (i === 0 ? `minmax(${c.width}px, 1fr)` : `${c.width}px`))
    .join(' ');

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [colsAnchor, setColsAnchor] = useState<{ x: number; y: number } | null>(null);
  const colsBtnRef = useRef<HTMLButtonElement>(null);

  // Virtualization — active only when flat (no groups) and list is big.
  const ROW_HEIGHT = 28;
  const OVERSCAN = 12;
  const VIRT_THRESHOLD = 200;
  const outerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scroll: 0, height: 600 });

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onScroll = () => {
      setViewport((v) => ({ ...v, scroll: el.scrollTop }));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver((entries) => {
      setViewport((v) => ({ ...v, height: entries[0].contentRect.height }));
    });
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!colsAnchor) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (colsBtnRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.('[data-cols-menu]')) return;
      setColsAnchor(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [colsAnchor]);

  const groups = useMemo(
    () => groupEntries(entries, groupBy, folderSizes),
    [entries, groupBy, folderSizes],
  );

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

  const canVirtualize = groupBy === 'none' && entries.length > VIRT_THRESHOLD;
  const flat = groups[0]?.entries ?? [];
  const totalHeight = flat.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(viewport.scroll / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    flat.length,
    Math.ceil((viewport.scroll + viewport.height) / ROW_HEIGHT) + OVERSCAN,
  );

  return (
    <div
      ref={outerRef}
      className="flex-1 overflow-auto"
      onContextMenu={(e) => onContextMenu(e, null)}
    >
      {/* Column header */}
      <div className="sticky top-0 z-10 bg-ld-body border-b border-ld-border-subtle flex items-stretch text-[11px] font-medium text-ld-text-dim select-none">
        <button
          ref={colsBtnRef}
          onClick={(e) => {
            if (colsAnchor) {
              setColsAnchor(null);
              return;
            }
            const r = e.currentTarget.getBoundingClientRect();
            setColsAnchor({ x: r.left, y: r.bottom + 4 });
          }}
          className={[
            'flex items-center justify-center w-8 border-r border-ld-border-subtle shrink-0 transition-colors',
            colsAnchor
              ? 'bg-ld-elevated text-ld-text'
              : 'text-ld-text-dim hover:text-ld-text hover:bg-ld-elevated',
          ].join(' ')}
          title="View options and columns"
        >
          <Columns3 size={13} />
        </button>
        <div
          className="grid flex-1 min-w-0"
          style={{ gridTemplateColumns: gridTemplate }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setColsAnchor({ x: e.clientX, y: e.clientY + 4 });
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
      </div>

      {/* Virtualized flat list — no groups, >200 entries */}
      {canVirtualize && (
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${startIdx * ROW_HEIGHT}px)`,
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
            }}
          >
            {flat.slice(startIdx, endIdx).map((e) => {
              const isSel = selected === e.path;
              return (
                <div
                  key={e.path}
                  onClick={() => onSelect(e.path)}
                  onDoubleClick={() => onOpen(e)}
                  onContextMenu={(ev) => onContextMenu(ev, e)}
                  className={[
                    'flex items-stretch text-xs border-b border-ld-border-subtle/40 cursor-default transition-colors',
                    isSel ? 'bg-brand-red/10' : 'hover:bg-ld-elevated',
                  ].join(' ')}
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="w-8 shrink-0" />
                  <div
                    className="grid flex-1 min-w-0 items-center"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {visibleCols.map((c) => (
                      <Cell
                        key={c.id}
                        col={c}
                        entry={e}
                        dateFormat={dateFormat}
                        folderSize={folderSizes.get(e.path)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grouped or small list — render all rows with stagger animation */}
      {!canVirtualize &&
        groups.map((g) => {
        const isCollapsed = collapsed.has(g.id);
        return (
          <div key={g.id} className="animate-fade-in">
            {groupBy !== 'none' && (
              <button
                onClick={() => toggleGroup(g.id)}
                className="w-full flex items-center gap-1.5 px-3 h-7 text-[11px] font-semibold text-ld-text-muted hover:text-ld-text hover:bg-ld-elevated border-b border-ld-border-subtle/40"
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
                        'flex items-stretch text-xs border-b border-ld-border-subtle/40 cursor-default transition-colors',
                        isSel ? 'bg-brand-red/10' : 'hover:bg-ld-elevated',
                      ].join(' ')}
                    >
                      <div className="w-8 shrink-0" />
                      <div
                        className="grid flex-1 min-w-0 items-center"
                        style={{ gridTemplateColumns: gridTemplate }}
                      >
                        {visibleCols.map((c) => (
                          <Cell
                            key={c.id}
                            col={c}
                            entry={e}
                            dateFormat={dateFormat}
                            folderSize={folderSizes.get(e.path)}
                          />
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

      {colsAnchor && (
        <ColumnsMenu
          anchor={colsAnchor}
          onClose={() => setColsAnchor(null)}
          columns={columns}
          onToggle={toggleCol}
          dateFormat={dateFormat}
          onDateFormatChange={onDateFormatChange}
          groupBy={groupBy}
          onGroupChange={onGroupChange}
          showHidden={showHidden}
          onToggleHidden={onToggleHidden}
          foldersFirst={foldersFirst}
          onToggleFoldersFirst={onToggleFoldersFirst}
        />
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
  folderSize,
}: {
  col: Column;
  entry: Entry;
  dateFormat: DateFormat;
  folderSize?: number;
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
    let label: React.ReactNode;
    if (entry.isDir) {
      if (folderSize === undefined) label = <span className="text-ld-text-dim">…</span>;
      else if (folderSize < 0) label = <span className="text-ld-text-dim">—</span>;
      else label = formatBytes(folderSize);
    } else {
      label = formatBytes(entry.size);
    }
    return <div className="px-3 py-1 text-right font-mono text-ld-text-muted">{label}</div>;
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
