import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ExplorerPane } from './components/ExplorerPane';
import { TitleBar } from './components/TitleBar';
import { ThemeProvider } from './context/ThemeContext';
import { HostsProvider } from './context/HostsContext';
import { ActiveHostProvider } from './context/ActiveHostContext';
import { TransfersProvider } from './context/TransfersContext';
import { TransfersDrawer } from './components/TransfersDrawer';
import { UpdateBanner } from './components/UpdateBanner';

export type ViewId = 'local' | 'hosts' | 'remote' | 'split' | 'transfers' | 'settings';

export function App() {
  const [view, setView] = useState<ViewId>('local');

  return (
    <ThemeProvider>
      <HostsProvider>
        <ActiveHostProvider>
          <TransfersProvider>
            <div className="flex flex-col h-screen w-screen overflow-hidden bg-ld-body text-ld-text">
              <TitleBar />
              <UpdateBanner />
              <div className="flex flex-1 overflow-hidden">
                <Sidebar current={view} onSelect={setView} />
                <main className="flex-1 overflow-hidden animate-page-in">
                  <ExplorerPane view={view} onNavigateView={setView} />
                </main>
              </div>
              <TransfersDrawer />
            </div>
          </TransfersProvider>
        </ActiveHostProvider>
      </HostsProvider>
    </ThemeProvider>
  );
}
