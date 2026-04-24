import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, X, Check, Minus, StopCircle } from 'lucide-react';
import { formatBytes } from '@linkdrive/shared/paths';
import { useTransfers, type Transfer } from '../context/TransfersContext';

export function TransfersDrawer() {
  const { transfers, clearCompleted } = useTransfers();
  const [open, setOpen] = useState(true);
  const running = transfers.filter((t) => t.state === 'running');

  if (transfers.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-4 z-40 w-[340px] rounded-xl border border-ld-border bg-ld-card shadow-2xl animate-fade-up">
      <header className="flex items-center justify-between px-3 h-9 border-b border-ld-border-subtle">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold">Transfers</span>
          {running.length > 0 && (
            <span className="text-ld-text-dim">{running.length} running</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearCompleted}
            className="text-[10px] text-ld-text-dim hover:text-ld-text px-2 py-0.5 rounded hover:bg-ld-elevated"
            title="Clear finished"
          >
            Clear
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1 rounded hover:bg-ld-elevated text-ld-text-muted"
            title={open ? 'Collapse' : 'Expand'}
          >
            <Minus size={12} />
          </button>
        </div>
      </header>
      {open && (
        <ul className="max-h-[260px] overflow-y-auto p-2 space-y-1.5">
          {transfers.slice(0, 20).map((t) => (
            <TransferRow key={t.id} t={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TransferRow({ t }: { t: Transfer }) {
  const { cancel } = useTransfers();
  const pct = t.total > 0 ? Math.min(1, t.bytes / t.total) : 0;
  const Icon = t.direction === 'download' ? ArrowDownToLine : ArrowUpFromLine;
  const fileName = (t.direction === 'download' ? t.src : t.src).split('/').pop() || t.src;
  const speed = t.speedBps ? `${formatBytes(Math.round(t.speedBps))}/s` : null;

  return (
    <li className="rounded-lg bg-ld-body border border-ld-border-subtle px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <Icon size={12} className="text-ld-text-muted shrink-0" />
        <span className="text-[11.5px] text-ld-text truncate flex-1" title={fileName}>
          {fileName}
        </span>
        {t.state === 'running' && (
          <button
            onClick={() => cancel(t.id)}
            className="p-0.5 rounded hover:bg-ld-elevated text-ld-text-muted hover:text-brand-red"
            title="Cancel"
          >
            <StopCircle size={11} />
          </button>
        )}
        {t.state === 'completed' && <Check size={11} className="text-brand-red" />}
        {t.state === 'failed' && <X size={11} className="text-brand-red" />}
      </div>
      {t.state === 'running' && (
        <div className="mt-1 h-1 rounded-full bg-ld-elevated overflow-hidden">
          <div
            className="h-full bg-brand-red transition-[width] duration-200"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      )}
      <div className="mt-0.5 flex items-center justify-between text-[10px] text-ld-text-dim font-mono">
        <span>
          {formatBytes(t.bytes)}
          {t.total > 0 && ` / ${formatBytes(t.total)}`}
        </span>
        {t.state === 'running' && speed && <span>{speed}</span>}
        {t.state === 'completed' && <span>done</span>}
        {t.state === 'failed' && (
          <span className="text-brand-red truncate max-w-[180px]" title={t.error}>
            {t.error ?? 'failed'}
          </span>
        )}
      </div>
    </li>
  );
}
