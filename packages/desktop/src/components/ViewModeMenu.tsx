import { useEffect, useRef, useState } from 'react';
import {
  LayoutList,
  Grid3x3,
  Grid2x2,
  List,
  Rows3,
  GalleryVerticalEnd,
  Check,
  ChevronDown,
} from 'lucide-react';
import type { ViewMode } from '../types/explorer';

const MODES: { id: ViewMode; label: string; Icon: typeof List; shortcut: string }[] = [
  { id: 'details', label: 'Details', Icon: LayoutList, shortcut: 'Ctrl+1' },
  { id: 'list', label: 'List', Icon: List, shortcut: 'Ctrl+2' },
  { id: 'tiles', label: 'Tiles', Icon: Rows3, shortcut: 'Ctrl+3' },
  { id: 'small-icons', label: 'Small icons', Icon: Grid3x3, shortcut: 'Ctrl+4' },
  { id: 'medium-icons', label: 'Medium icons', Icon: Grid2x2, shortcut: 'Ctrl+5' },
  { id: 'large-icons', label: 'Large icons', Icon: GalleryVerticalEnd, shortcut: 'Ctrl+6' },
];

export function ViewModeMenu({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  const { Icon } = current;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-ld-text-muted hover:bg-ld-elevated"
        title="View mode"
      >
        <Icon size={14} />
        <span>{current.label}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-40 w-[180px] rounded-lg border border-ld-border bg-ld-card shadow-xl py-1 animate-scale-in">
          {MODES.map((m) => {
            const active = m.id === mode;
            const I = m.Icon;
            return (
              <button
                key={m.id}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-ld-text hover:bg-ld-elevated"
              >
                <span className="flex items-center gap-2">
                  <I size={13} className="text-ld-text-muted" />
                  {m.label}
                </span>
                {active ? (
                  <Check size={12} className="text-brand-red" />
                ) : (
                  <span className="text-[10px] text-ld-text-dim font-mono">{m.shortcut}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
