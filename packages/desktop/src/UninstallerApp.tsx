import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Check, X, Minus, Trash2 } from 'lucide-react';

type Phase = 'ready' | 'uninstalling' | 'done' | 'error';
type ProgressEvent = { step: string; progress: number };

export default function UninstallerApp() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Ready to uninstall');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: undefined | (() => void);
    (async () => {
      unlisten = await listen<ProgressEvent>('uninstall:progress', (e) => {
        setProgress(e.payload.progress);
        setStatus(e.payload.step);
      });
    })();
    return () => unlisten?.();
  }, []);

  async function startUninstall() {
    setPhase('uninstalling');
    setError(null);
    try {
      await invoke('run_uninstall');
      setProgress(1);
      setStatus('Removed');
      setPhase('done');
      setTimeout(async () => {
        try {
          await invoke('finalize_uninstall');
        } catch {
          await getCurrentWindow().close();
        }
      }, 700);
    } catch (e: unknown) {
      const msg =
        typeof e === 'string' ? e : (e as Error)?.message ?? 'Uninstall failed';
      setError(msg);
      setPhase('error');
    }
  }

  const close = async () => getCurrentWindow().close();
  const minimize = async () => getCurrentWindow().minimize();

  return (
    <div className="flex flex-col h-screen bg-ld-body text-ld-text select-none">
      <div data-tauri-drag-region className="relative h-9 flex items-center shrink-0">
        <div className="absolute right-0 top-0 flex h-9 items-center">
          <button
            onClick={minimize}
            className="flex h-9 w-10 items-center justify-center text-ld-text-muted hover:bg-ld-card"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={close}
            className="flex h-9 w-10 items-center justify-center text-ld-text-muted hover:bg-brand-red hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 px-8 pb-8 text-center animate-fade-up">
        <div
          className={`w-[88px] h-[88px] rounded-[22px] bg-brand-red flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(216,57,61,0.55)] ${
            phase === 'uninstalling' ? 'animate-pulse-red' : ''
          } ${phase === 'done' ? 'animate-pop-in' : ''}`}
        >
          {phase === 'done' ? (
            <Check size={44} className="text-white" strokeWidth={3} />
          ) : (
            <Trash2 size={40} className="text-white" strokeWidth={2} />
          )}
        </div>

        <h1 className="mt-7 text-[22px] font-extrabold tracking-tight">
          {phase === 'ready' && 'Uninstall LinkDrive?'}
          {phase === 'uninstalling' && 'Removing LinkDrive'}
          {phase === 'done' && 'All done'}
          {phase === 'error' && 'Uninstall failed'}
        </h1>

        <p className="mt-2 text-[12.5px] text-ld-text-muted min-h-[16px] max-w-[320px]">
          {phase === 'ready' &&
            'Saved hosts and settings will be kept in their usual location. Only the app files and shortcuts will be removed.'}
          {phase === 'uninstalling' && status}
          {phase === 'done' && 'LinkDrive has been removed.'}
          {phase === 'error' && (error ?? 'Something went wrong.')}
        </p>

        {phase === 'ready' && (
          <div className="mt-8 flex gap-2 w-full max-w-[300px]">
            <button
              onClick={close}
              className="flex-1 h-11 rounded-xl bg-ld-card border border-ld-border text-ld-text font-semibold text-sm hover:border-ld-text-muted/60"
            >
              Cancel
            </button>
            <button
              onClick={startUninstall}
              className="flex-1 h-11 rounded-xl bg-brand-red text-white font-bold text-sm hover:brightness-110 active:scale-[0.98]"
            >
              Uninstall
            </button>
          </div>
        )}

        {phase !== 'ready' && (
          <div className="mt-7 w-full max-w-[280px] h-1.5 rounded-full bg-ld-card overflow-hidden relative">
            <div
              className="h-full bg-brand-red transition-[width] duration-300 ease-out rounded-full"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
            {phase === 'uninstalling' && (
              <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
            )}
          </div>
        )}

        {phase === 'error' && (
          <button
            onClick={startUninstall}
            className="mt-6 px-6 h-10 rounded-xl bg-brand-red text-white font-bold text-sm hover:brightness-110"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
