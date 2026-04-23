import { ArrowDownToLine, ArrowUpFromLine, Check, X, Loader2 } from 'lucide-react';
import { formatBytes } from '@linkdrive/shared/paths';
import { useTransfers, type Transfer } from '../context/TransfersContext';

export function TransfersView() {
  const { transfers, clearCompleted } = useTransfers();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-ld-border px-6 h-12">
        <h2 className="text-sm font-semibold">Transfers</h2>
        <button
          onClick={clearCompleted}
          disabled={transfers.filter((t) => t.state !== 'running').length === 0}
          className="text-xs text-ld-text-muted hover:text-ld-text disabled:opacity-40 px-3 py-1.5 rounded-md hover:bg-ld-elevated"
        >
          Clear finished
        </button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {transfers.length === 0 ? (
          <div className="mx-auto max-w-md text-center animate-fade-up">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-dashed border-ld-border-subtle flex items-center justify-center text-ld-text-dim">
              <ArrowDownToLine size={22} />
            </div>
            <h3 className="text-base font-semibold">No transfers yet</h3>
            <p className="mt-1 text-sm text-ld-text-muted">
              Right-click a remote file to download, or use Upload file on a remote
              folder.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {transfers.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ t }: { t: Transfer }) {
  const pct = t.total > 0 ? Math.min(1, t.bytes / t.total) : 0;
  const Icon = t.direction === 'download' ? ArrowDownToLine : ArrowUpFromLine;
  const speed = t.speedBps ? `${formatBytes(Math.round(t.speedBps))}/s` : '';
  const label = t.direction === 'download' ? 'Download' : 'Upload';

  return (
    <li className="rounded-xl border border-ld-border bg-ld-card p-3">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-ld-text-muted shrink-0" />
        <span className="text-[11.5px] font-semibold text-ld-text">{label}</span>
        <span className="text-[11px] text-ld-text-dim">{t.hostId}</span>
        <div className="flex-1" />
        {t.state === 'running' && <Loader2 size={12} className="animate-spin text-ld-text-muted" />}
        {t.state === 'completed' && <Check size={12} className="text-brand-red" />}
        {t.state === 'failed' && <X size={12} className="text-brand-red" />}
      </div>
      <div className="mt-1 text-[11px] text-ld-text-muted font-mono truncate">
        {t.src} → {t.dst}
      </div>
      <div className="mt-2 h-1 rounded-full bg-ld-elevated overflow-hidden">
        <div
          className="h-full bg-brand-red transition-[width] duration-200"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10.5px] text-ld-text-dim font-mono">
        <span>
          {formatBytes(t.bytes)}
          {t.total > 0 && ` / ${formatBytes(t.total)}`}
        </span>
        <span>{t.state === 'running' ? speed : t.state}</span>
      </div>
      {t.error && (
        <div className="mt-1 text-[11px] text-brand-red truncate" title={t.error}>
          {t.error}
        </div>
      )}
    </li>
  );
}
