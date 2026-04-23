import { useState } from 'react';
import { Plus, LogIn } from 'lucide-react';
import { useHosts } from '../context/HostsContext';
import { useActiveHost } from '../context/ActiveHostContext';
import { AddHostModal } from './AddHostModal';
import { ConnectModal } from './ConnectModal';
import type { Host } from '@linkdrive/shared/types';
import type { ViewId } from '../App';

export function HostsView({ onNavigateView }: { onNavigateView?: (v: ViewId) => void }) {
  const { hosts, add, update } = useHosts();
  const { setActiveHostId } = useActiveHost();
  const [addOpen, setAddOpen] = useState(false);
  const [connectingHost, setConnectingHost] = useState<Host | null>(null);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-ld-border px-6 h-12">
        <h2 className="text-sm font-semibold">Hosts</h2>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-red px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-muted-red transition-colors"
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
              Add your VPS or a LAN peer to start exploring.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {hosts.map((h) => (
              <li
                key={h.id}
                className="rounded-xl border border-ld-border bg-ld-card p-4 flex flex-col gap-2 animate-scale-in"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: h.color || '#D8393D' }}
                  />
                  <span className="font-medium truncate">{h.name}</span>
                </div>
                <div className="text-xs text-ld-text-muted font-mono truncate">
                  {h.user}@{h.host}:{h.port}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-ld-text-dim">
                  {h.protocol} · {h.auth.type} · {h.transport.mode}
                  {h.knownHostKey ? ' · pinned' : ''}
                </div>
                <button
                  onClick={() => setConnectingHost(h)}
                  className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-red/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-red transition-colors"
                >
                  <LogIn size={12} /> Connect
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {addOpen && (
        <AddHostModal
          onClose={() => setAddOpen(false)}
          onSave={(h) => {
            add(h);
            setAddOpen(false);
          }}
        />
      )}

      {connectingHost && (
        <ConnectModal
          host={connectingHost}
          onClose={() => setConnectingHost(null)}
          onUpdateHost={(patch) => update(connectingHost.id, patch)}
          onConnected={() => {
            setActiveHostId(connectingHost.id);
            setConnectingHost(null);
            onNavigateView?.('remote');
          }}
        />
      )}
    </div>
  );
}
