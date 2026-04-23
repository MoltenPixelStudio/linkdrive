import { createPortal } from 'react-dom';
import { Check, ChevronRight, Eye, EyeOff, Layers, FolderTree, Zap } from 'lucide-react';
import { useState } from 'react';
import type { Column, ColumnId } from '../types/explorer';
import type { DateFormat } from '../utils/fileMeta';
import type { GroupBy } from './FileDetails';

const DATE_FMTS: { id: DateFormat; label: string; hint: string }[] = [
  { id: 'long', label: 'Date and time', hint: 'Mar 7, 2026, 15:27' },
  { id: 'short', label: 'Date only', hint: 'Mar 7, 2026' },
  { id: 'iso', label: 'ISO', hint: '2026-03-07 15:27' },
  { id: 'relative', label: 'Relative', hint: '2 h ago' },
];

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'none', label: 'No grouping' },
  { id: 'type', label: 'Type' },
  { id: 'date', label: 'Date modified' },
  { id: 'size', label: 'Size' },
];

type Expand = 'date' | 'group' | null;

export function ColumnsMenu({
  anchor,
  onClose,
  columns,
  onToggle,
  dateFormat,
  onDateFormatChange,
  groupBy,
  onGroupChange,
  showHidden,
  onToggleHidden,
  foldersFirst,
  onToggleFoldersFirst,
  rowAnimations,
  onToggleRowAnimations,
}: {
  anchor: { x: number; y: number };
  onClose: () => void;
  columns: Column[];
  onToggle: (id: ColumnId) => void;
  dateFormat: DateFormat;
  onDateFormatChange: (f: DateFormat) => void;
  groupBy: GroupBy;
  onGroupChange: (g: GroupBy) => void;
  showHidden: boolean;
  onToggleHidden: () => void;
  foldersFirst: boolean;
  onToggleFoldersFirst: () => void;
  rowAnimations: boolean;
  onToggleRowAnimations: () => void;
}) {
  const [expanded, setExpanded] = useState<Expand | ColumnId>(null as Expand);

  const toggleExpand = (id: Expand | ColumnId) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return createPortal(
    <div
      data-cols-menu
      className="fixed z-50 min-w-[260px] rounded-lg border border-ld-border bg-ld-card shadow-2xl py-1 animate-scale-in"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <MenuHeader label="View" />

      {/* Group by (expandable) */}
      <ExpandableRow
        icon={<Layers size={12} className="text-ld-text-muted" />}
        label="Group by"
        value={(GROUPS.find((g) => g.id === groupBy) ?? GROUPS[0]).label}
        open={expanded === 'group'}
        onToggle={() => toggleExpand('group')}
      >
        {GROUPS.map((g) => (
          <SubOption
            key={g.id}
            label={g.label}
            checked={g.id === groupBy}
            onClick={() => onGroupChange(g.id)}
          />
        ))}
      </ExpandableRow>

      <ToggleRow
        icon={<FolderTree size={12} />}
        label="Folders first"
        active={foldersFirst}
        onClick={onToggleFoldersFirst}
      />
      <ToggleRow
        icon={showHidden ? <Eye size={12} /> : <EyeOff size={12} />}
        label="Show hidden files"
        active={showHidden}
        onClick={onToggleHidden}
      />
      <ToggleRow
        icon={<Zap size={12} />}
        label="Row animations"
        active={rowAnimations}
        onClick={onToggleRowAnimations}
      />

      <MenuHeader label="Columns" />
      {columns.map((c) => {
        const isExpanded = expanded === c.id;
        const hasOptions = c.id === 'modified';
        return (
          <div key={c.id} className="border-b border-ld-border-subtle/20 last:border-b-0">
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
                  onClick={() => toggleExpand(c.id)}
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

      <div className="px-3 pt-1 pb-1.5 flex justify-end">
        <button
          onClick={onClose}
          className="text-[10px] text-ld-text-dim hover:text-ld-text"
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}

function MenuHeader({ label }: { label: string }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-ld-text-dim font-semibold">
      {label}
    </div>
  );
}

function ExpandableRow({
  icon,
  label,
  value,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-ld-border-subtle/20">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ld-text hover:bg-ld-elevated"
      >
        <span className="text-ld-text-muted shrink-0">{icon}</span>
        <span>{label}</span>
        <span className="ml-auto text-ld-text-dim mr-1">{value}</span>
        <ChevronRight
          size={12}
          className={[
            'text-ld-text-dim transition-transform duration-200',
            open ? 'rotate-90' : '',
          ].join(' ')}
        />
      </button>
      {open && <div className="bg-ld-body/60 py-1 animate-fade-in">{children}</div>}
    </div>
  );
}

function SubOption({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 pl-5 pr-3 py-1.5 text-xs text-ld-text hover:bg-ld-elevated"
    >
      <span>{label}</span>
      {checked && <Check size={12} className="text-brand-red" />}
    </button>
  );
}

function ToggleRow({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-ld-text hover:bg-ld-elevated border-b border-ld-border-subtle/20 last:border-b-0"
    >
      <span className={active ? 'text-brand-red' : 'text-ld-text-muted'}>{icon}</span>
      <span>{label}</span>
      <span
        className={[
          'ml-auto w-3.5 h-3.5 rounded border flex items-center justify-center',
          active ? 'bg-brand-red border-brand-red' : 'border-ld-border',
        ].join(' ')}
      >
        {active && <Check size={9} className="text-white" strokeWidth={4} />}
      </span>
    </button>
  );
}
