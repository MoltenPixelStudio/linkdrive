import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ExplorerPane } from './components/ExplorerPane';
import { TitleBar } from './components/TitleBar';
import { ThemeProvider } from './context/ThemeContext';
import { HostsProvider } from './context/HostsContext';
import { ActiveHostProvider } from './context/ActiveHostContext';

export type ViewId = 'local' | 'hosts' | 'remote' | 'transfers' | 'settings';

export function App() {
  const [view, setView] = useState<ViewId>('local');

  return (
    <ThemeProvider>
      <HostsProvider>
        <ActiveHostProvider>
          <div className="flex flex-col h-screen w-screen overflow-hidden bg-ld-body text-ld-text">
            <TitleBar />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar current={view} onSelect={setView} />
              <main className="flex-1 overflow-hidden animate-page-in">
                <ExplorerPane view={view} onNavigateView={setView} />
              </main>
            </div>
          </div>
        </ActiveHostProvider>
      </HostsProvider>
    </ThemeProvider>
  );
}
