import type { ViewId } from '../App';
import { HostsView } from './HostsView';
import { LocalExplorer } from './LocalExplorer';

export function ExplorerPane({ view }: { view: ViewId }) {
  if (view === 'hosts') return <HostsView />;
  if (view === 'local') return <LocalExplorer />;
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center animate-fade-up">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-brand-red/15 flex items-center justify-center">
          <div className="h-5 w-5 rounded bg-brand-red" />
        </div>
        <h1 className="text-xl font-semibold">{view === 'transfers' ? 'Transfers' : 'Settings'}</h1>
        <p className="mt-1 text-sm text-ld-text-muted max-w-sm">
          Coming in later phases. View: <span className="font-mono">{view}</span>.
        </p>
      </div>
    </div>
  );
}
