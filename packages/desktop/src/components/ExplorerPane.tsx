import { useMemo } from 'react';
import type { ViewId } from '../App';
import { HostsView } from './HostsView';
import { Explorer } from './Explorer';
import { localSource, sftpSource } from '../utils/source';
import { useHosts } from '../context/HostsContext';
import { useActiveHost } from '../context/ActiveHostContext';

export function ExplorerPane({
  view,
  onNavigateView,
}: {
  view: ViewId;
  onNavigateView: (v: ViewId) => void;
}) {
  const { hosts } = useHosts();
  const { activeHostId } = useActiveHost();
  const activeHost = hosts.find((h) => h.id === activeHostId) ?? null;

  const remoteSource = useMemo(
    () => (activeHost ? sftpSource(activeHost.id, activeHost.name) : null),
    [activeHost?.id, activeHost?.name],
  );

  if (view === 'hosts') return <HostsView onNavigateView={onNavigateView} />;
  if (view === 'local') return <Explorer source={localSource} />;
  if (view === 'remote' && remoteSource) return <Explorer source={remoteSource} />;
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center animate-fade-up">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-brand-red/15 flex items-center justify-center">
          <div className="h-5 w-5 rounded bg-brand-red" />
        </div>
        <h1 className="text-xl font-semibold">
          {view === 'transfers' ? 'Transfers' : 'Settings'}
        </h1>
        <p className="mt-1 text-sm text-ld-text-muted max-w-sm">
          Coming in later phases. View: <span className="font-mono">{view}</span>.
        </p>
      </div>
    </div>
  );
}
