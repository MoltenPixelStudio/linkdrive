import { Plus } from 'lucide-react';
import { useHosts } from '../context/HostsContext';

export function HostsView() {
  const { hosts } = useHosts();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-ld-border px-6 h-12">
        <h2 className="text-sm font-semibold">Hosts</h2>
        <button
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-red px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-muted-red transition-colors"
          onClick={() => {
            /* TODO: open add-host dialog */
          }}
        >
          <Plus size={14} /> Add host
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        {hosts.length === 0 ? (
          <div className="mx-auto max-w-md text-center animate-fade-up">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-dashed border-ld-border-subtle flex items-center justify-center text-ld-text-dim">
              <Plus size={22} />
            </div>
            <h3 className="text-base font-semibold">No hosts yet</h3>
            <p className="mt-1 text-sm text-ld-text-muted">
              Add your VPS, a LAN peer, or import from ~/.ssh/config to get started.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {hosts.map((h) => (
              <li
                key={h.id}
                className="rounded-xl border border-ld-border bg-ld-card p-4 animate-scale-in"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: h.color || '#D8393D' }}
                  />
                  <span className="font-medium">{h.name}</span>
                </div>
                <div className="mt-1 text-xs text-ld-text-muted font-mono">
                  {h.user}@{h.host}:{h.port}
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-wide text-ld-text-dim">
                  {h.protocol} · {h.transport.mode}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
