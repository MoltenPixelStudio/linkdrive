import { useEffect, useRef, type ReactNode } from 'react';

export type MenuItem =
  | { id: string; label: string; shortcut?: string; onSelect: () => void; disabled?: boolean; danger?: boolean }
  | { id: string; type: 'separator' };

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Clamp to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = 220;
  const h = Math.min(items.length * 30 + 12, vh - 16);
  const left = Math.min(x, vw - w - 8);
  const top = Math.min(y, vh - h - 8);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] max-w-[260px] rounded-lg border border-ld-border bg-ld-card shadow-2xl py-1 animate-scale-in"
      style={{ left, top }}
    >
      {items.map((it) =>
        'type' in it ? (
          <div key={it.id} className="my-1 h-px bg-ld-border-subtle" />
        ) : (
          <button
            key={it.id}
            disabled={it.disabled}
            onClick={() => {
              if (it.disabled) return;
              it.onSelect();
              onClose();
            }}
            className={[
              'w-full flex items-center justify-between gap-4 px-3 py-1.5 text-xs text-left transition-colors',
              it.disabled
                ? 'text-ld-text-dim cursor-not-allowed'
                : it.danger
                  ? 'text-brand-red hover:bg-brand-red/10'
                  : 'text-ld-text hover:bg-ld-elevated',
            ].join(' ')}
          >
            <span>{it.label}</span>
            {it.shortcut && (
              <span className="text-ld-text-dim font-mono text-[10px]">{it.shortcut}</span>
            )}
          </button>
        ),
      )}
    </div>
  );
}

export function useContextMenu<T>() {
  // Helper hook to drive <ContextMenu> — returns open state + open fn + close fn.
  return null as unknown as {
    state: { x: number; y: number; target: T } | null;
    open: (e: React.MouseEvent, target: T) => void;
    close: () => void;
  };
}

// Simple hook implementation:
import { useState, useCallback } from 'react';
export function useCtx<T>() {
  const [state, setState] = useState<{ x: number; y: number; target: T } | null>(null);
  const open = useCallback((e: React.MouseEvent, target: T) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, target });
  }, []);
  const close = useCallback(() => setState(null), []);
  return { state, open, close } as const;
}

export function __unused_typeImport(_: ReactNode) {}
