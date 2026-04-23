import { Eye, EyeOff, Layers, Check, Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DateFormat } from '../utils/fileMeta';

export type GroupBy = 'none' | 'type' | 'date' | 'size';

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'none', label: 'No grouping' },
  { id: 'type', label: 'Type' },
  { id: 'date', label: 'Date modified' },
  { id: 'size', label: 'Size' },
];

const DATE_FMTS: { id: DateFormat; label: string; hint: string }[] = [
  { id: 'long', label: 'Date and time', hint: 'Mar 7, 2026, 15:27' },
  { id: 'short', label: 'Date only', hint: 'Mar 7, 2026' },
  { id: 'iso', label: 'ISO', hint: '2026-03-07 15:27' },
  { id: 'relative', label: 'Relative', hint: '2 h ago' },
];

export function DetailsFilterBar({
  showHidden,
  onToggleHidden,
  groupBy,
  onGroupChange,
  dateFormat,
  onDateFormatChange,
  count,
  selectedCount,
}: {
  showHidden: boolean;
  onToggleHidden: () => void;
  groupBy: GroupBy;
  onGroupChange: (g: GroupBy) => void;
  dateFormat: DateFormat;
  onDateFormatChange: (f: DateFormat) => void;
  count: number;
  selectedCount: number;
}) {
  const [groupAnchor, setGroupAnchor] = useState<{ x: number; y: number } | null>(null);
  const [dateAnchor, setDateAnchor] = useState<{ x: number; y: number } | null>(null);
  const groupBtnRef = useRef<HTMLButtonElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!groupAnchor && !dateAnchor) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (groupBtnRef.current?.contains(t) || dateBtnRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.('[data-pop]')) return;
      setGroupAnchor(null);
      setDateAnchor(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [groupAnchor, dateAnchor]);

  const current = GROUPS.find((g) => g.id === groupBy) ?? GROUPS[0];
  const currentFmt = DATE_FMTS.find((d) => d.id === dateFormat) ?? DATE_FMTS[0];

  return (
    <div className="flex items-center gap-2 border-b border-ld-border-subtle bg-ld-body px-3 h-8 shrink-0 text-[11px] text-ld-text-muted">
      <span>
        {count} item{count === 1 ? '' : 's'}
        {selectedCount > 0 && (
          <span className="ml-2 text-brand-red font-medium">{selectedCount} selected</span>
        )}
      </span>

      <div className="flex-1" />

      <button
        ref={dateBtnRef}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setDateAnchor(dateAnchor ? null : { x: r.right - 200, y: r.bottom + 4 });
          setGroupAnchor(null);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-ld-elevated text-ld-text-muted hover:text-ld-text transition-colors"
        title="Date format"
      >
        <Clock size={12} />
        <span>Date: {currentFmt.label}</span>
      </button>

      <button
        ref={groupBtnRef}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setGroupAnchor(groupAnchor ? null : { x: r.right - 200, y: r.bottom + 4 });
          setDateAnchor(null);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-ld-elevated text-ld-text-muted hover:text-ld-text transition-colors"
        title="Group by"
      >
        <Layers size={12} />
        <span>Group: {current.label}</span>
      </button>

      <button
        onClick={onToggleHidden}
        className={[
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors',
          showHidden
            ? 'bg-brand-red/15 text-brand-red'
            : 'text-ld-text-muted hover:bg-ld-elevated hover:text-ld-text',
        ].join(' ')}
        title={showHidden ? 'Hide dotfiles' : 'Show dotfiles'}
      >
        {showHidden ? <Eye size={12} /> : <EyeOff size={12} />}
        <span>Hidden</span>
      </button>

      {groupAnchor &&
        createPortal(
          <div
            data-pop
            className="fixed z-50 w-[200px] rounded-lg border border-ld-border bg-ld-card shadow-xl py-1 animate-scale-in"
            style={{ left: groupAnchor.x, top: groupAnchor.y }}
          >
            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  onGroupChange(g.id);
                  setGroupAnchor(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-ld-text hover:bg-ld-elevated"
              >
                <span>{g.label}</span>
                {g.id === groupBy && <Check size={12} className="text-brand-red" />}
              </button>
            ))}
          </div>,
          document.body,
        )}

      {dateAnchor &&
        createPortal(
          <div
            data-pop
            className="fixed z-50 w-[220px] rounded-lg border border-ld-border bg-ld-card shadow-xl py-1 animate-scale-in"
            style={{ left: dateAnchor.x, top: dateAnchor.y }}
          >
            {DATE_FMTS.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  onDateFormatChange(d.id);
                  setDateAnchor(null);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-ld-text hover:bg-ld-elevated"
              >
                <span className="flex flex-col items-start">
                  <span>{d.label}</span>
                  <span className="text-[10px] text-ld-text-dim font-mono">{d.hint}</span>
                </span>
                {d.id === dateFormat && <Check size={12} className="text-brand-red" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
