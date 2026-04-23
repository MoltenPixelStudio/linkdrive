import { createPortal } from 'react-dom';
import { Check, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { Column, ColumnId } from '../types/explorer';
import type { DateFormat } from '../utils/fileMeta';

const DATE_FMTS: { id: DateFormat; label: string; hint: string }[] = [
  { id: 'long', label: 'Date and time', hint: 'Mar 7, 2026, 15:27' },
  { id: 'short', label: 'Date only', hint: 'Mar 7, 2026' },
  { id: 'iso', label: 'ISO', hint: '2026-03-07 15:27' },
  { id: 'relative', label: 'Relative', hint: '2 h ago' },
];

export function ColumnsMenu({
  anchor,
  onClose,
  columns,
  onToggle,
  dateFormat,
  onDateFormatChange,
}: {
  anchor: { x: number; y: number };
  onClose: () => void;
  columns: Column[];
  onToggle: (id: ColumnId) => void;
  dateFormat: DateFormat;
  onDateFormatChange: (f: DateFormat) => void;
}) {
  const [expanded, setExpanded] = useState<ColumnId | null>(null);

  return createPortal(
    <div
      data-cols-menu
      className="fixed z-50 min-w-[240px] rounded-lg border border-ld-border bg-ld-card shadow-2xl py-1 animate-scale-in"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <div className="px-3 pt-1.5 pb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-ld-text-dim font-semibold">
          Columns
        </span>
        <button
          onClick={onClose}
          className="text-[10px] text-ld-text-dim hover:text-ld-text"
        >
          Close
        </button>
      </div>

      {columns.map((c) => {
        const isExpanded = expanded === c.id;
        const hasOptions = c.id === 'modified';
        return (
          <div key={c.id} className="border-b border-ld-border-subtle/30 last:border-b-0">
            <div className="w-full flex items-stretch text-xs text-ld-text hover:bg-ld-elevated">
              <button
                onClick={() => onToggle(c.id)}
                className="flex items-center gap-2 flex-1 px-3 py-1.5 text-left"
              >
                {c.visible ? (
                  <Eye size={12} className="text-brand-red shrink-0" />
                ) : (
                  <EyeOff size={12} className="text-ld-text-dim shrink-0" />
                )}
                <span className={c.visible ? '' : 'text-ld-text-muted'}>{c.label}</span>
              </button>
              {hasOptions && (
                <button
                  onClick={() => setExpanded(isExpanded ? null : c.id)}
                  className="px-2 text-ld-text-dim hover:text-ld-text"
                  title="Options"
                >
                  <ChevronRight
                    size={12}
                    className={[
                      'transition-transform duration-200',
                      isExpanded ? 'rotate-90' : '',
                    ].join(' ')}
                  />
                </button>
              )}
            </div>
            {isExpanded && c.id === 'modified' && (
              <div className="bg-ld-body/60 py-1 animate-fade-in">
                <div className="px-5 pt-1 pb-0.5 text-[10px] uppercase tracking-wide text-ld-text-dim font-semibold">
                  Date format
                </div>
                {DATE_FMTS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => onDateFormatChange(d.id)}
                    className="w-full flex items-center justify-between gap-2 pl-5 pr-3 py-1.5 text-xs text-ld-text hover:bg-ld-elevated"
                  >
                    <span className="flex flex-col items-start">
                      <span>{d.label}</span>
                      <span className="text-[10px] text-ld-text-dim font-mono">{d.hint}</span>
                    </span>
                    {d.id === dateFormat && <Check size={12} className="text-brand-red" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
