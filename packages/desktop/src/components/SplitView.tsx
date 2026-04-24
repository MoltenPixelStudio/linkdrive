import { Explorer } from './Explorer';
import { localSource, sftpSource } from '../utils/source';
import { useHosts } from '../context/HostsContext';
import { useActiveHost } from '../context/ActiveHostContext';
import { Server, Plus } from 'lucide-react';
import { useMemo } from 'react';
import type { ViewId } from '../App';

export function SplitView({ onNavigateView }: { onNavigateView: (v: ViewId) => void }) {
  const { hosts } = useHosts();
  const { activeHostId } = useActiveHost();
  const activeHost = hosts.find((h) => h.id === activeHostId) ?? null;

  const remote = useMemo(
    () => (activeHost ? sftpSource(activeHost.id, activeHost.name) : null),
    [activeHost?.id, activeHost?.name],
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 border-r border-ld-border flex flex-col">
        <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-wide text-ld-text-dim bg-ld-bg border-b border-ld-border-subtle">
          Local
        </div>
        <div className="flex-1 min-h-0">
          <Explorer source={localSource} />
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-3 py-1.5 text-[10.5px] uppercase tracking-wide text-ld-text-dim bg-ld-bg border-b border-ld-border-subtle">
          Remote {activeHost ? `— ${activeHost.name}` : ''}
        </div>
        <div className="flex-1 min-h-0">
          {remote ? (
            <Explorer source={remote} />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center animate-fade-up max-w-sm">
                <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-brand-red/15 flex items-center justify-center text-brand-red">
                  <Server size={22} />
                </div>
                <h3 className="text-sm font-semibold text-ld-text">
                  No host connected
                </h3>
                <p className="mt-1 text-xs text-ld-text-muted">
                  Connect to a VPS or LAN peer to browse and transfer between
                  this device and the remote side-by-side.
                </p>
                <button
                  onClick={() => onNavigateView('hosts')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-red px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-muted-red"
                >
                  <Plus size={12} /> Add or connect a host
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
