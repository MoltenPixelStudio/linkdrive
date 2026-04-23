import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

const isTauri =
  typeof window !== 'undefined' &&
  !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;

export default function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: undefined | (() => void);
    (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const w = getCurrentWindow();
      setMaximized(await w.isMaximized());
      unlisten = await w.onResized(async () => setMaximized(await w.isMaximized()));
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  if (!isTauri) return null;

  const call = async (action: 'minimize' | 'toggleMaximize' | 'close') => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const w = getCurrentWindow();
    if (action === 'minimize') await w.minimize();
    else if (action === 'toggleMaximize') await w.toggleMaximize();
    else await w.close();
  };

  return (
    <div className="flex h-full items-center ml-auto">
      <button
        onClick={() => call('minimize')}
        className="flex h-full w-11 items-center justify-center text-ld-text-muted hover:bg-ld-elevated transition-colors"
        aria-label="Minimize"
      >
        <Minus size={14} />
      </button>
      <button
        onClick={() => call('toggleMaximize')}
        className="flex h-full w-11 items-center justify-center text-ld-text-muted hover:bg-ld-elevated transition-colors"
        aria-label={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <Copy size={12} /> : <Square size={11} />}
      </button>
      <button
        onClick={() => call('close')}
        className="flex h-full w-11 items-center justify-center text-ld-text-muted hover:bg-brand-red hover:text-white transition-colors"
        aria-label="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
}
