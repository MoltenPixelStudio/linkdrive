import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import InstallerApp from './InstallerApp';
import UninstallerApp from './UninstallerApp';
import './styles.css';

type Mode = 'app' | 'install' | 'uninstall';

const isTauri =
  typeof window !== 'undefined' && !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

function Root() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    if (!isTauri) {
      // Dev fallback: ?mode=install|uninstall|app lets us preview each UI in a browser.
      const q = new URLSearchParams(window.location.search).get('mode') as Mode | null;
      setMode(q === 'install' || q === 'uninstall' ? q : 'app');
      return;
    }
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const m = await invoke<Mode>('get_mode');
        setMode(m);
      } catch {
        setMode('app');
      }
    })();
  }, []);

  if (mode === null) return null;
  if (mode === 'install') return <InstallerApp />;
  if (mode === 'uninstall') return <UninstallerApp />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
