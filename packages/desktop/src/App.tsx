import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ExplorerPane } from './components/ExplorerPane';
import { ThemeProvider } from './context/ThemeContext';
import { HostsProvider } from './context/HostsContext';

export type ViewId = 'local' | 'hosts' | 'transfers' | 'settings';

export function App() {
  const [view, setView] = useState<ViewId>('local');

  return (
    <ThemeProvider>
      <HostsProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-ld-body text-ld-text">
          <Sidebar current={view} onSelect={setView} />
          <main className="flex-1 overflow-hidden animate-page-in">
            <ExplorerPane view={view} />
          </main>
        </div>
      </HostsProvider>
    </ThemeProvider>
  );
}
