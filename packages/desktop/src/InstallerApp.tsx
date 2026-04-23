import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  Check,
  X,
  Minus,
  FolderOpen,
  RotateCw,
  ArrowUpCircle,
  ChevronLeft,
} from 'lucide-react';
import { LICENSE_TEXT } from './license';

type Phase = 'ready' | 'installing' | 'done' | 'error';
type Step = 'options' | 'tos';
type Existing = { path: string; version: string } | null;
type Action = 'install' | 'update' | 'repair' | 'downgrade';
type ProgressEvent = { step: string; progress: number };

function compareVersions(a: string, b: string): number {
  if (a === b) return 0;
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function BrandMark() {
  return (
    <div className="w-[72px] h-[72px] rounded-[18px] bg-brand-red flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(216,57,61,0.55)]">
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
        <circle cx="14" cy="21" r="9" stroke="white" strokeWidth="3.5" />
        <circle cx="28" cy="21" r="9" stroke="white" strokeWidth="3.5" />
      </svg>
    </div>
  );
}

export default function InstallerApp() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [step, setStep] = useState<Step>('options');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Ready to install');
  const [error, setError] = useState<string | null>(null);

  const [installDir, setInstallDir] = useState('');
  const [startMenuShortcut, setStartMenuShortcut] = useState(true);
  const [desktopShortcut, setDesktopShortcut] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [tosScrolledToBottom, setTosScrolledToBottom] = useState(false);

  const [existing, setExisting] = useState<Existing>(null);
  const [version, setVersion] = useState<string>('0.1.0');
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await invoke<string>('current_version');
        setVersion(v);
        const ex = await invoke<Existing>('get_existing_install');
        setExisting(ex);
        if (ex) {
          setInstallDir(ex.path);
        } else {
          const def = await invoke<string>('get_default_install_dir');
          setInstallDir(def);
        }
      } catch {}
      setDetected(true);
    })();
    let unlisten: undefined | (() => void);
    (async () => {
      unlisten = await listen<ProgressEvent>('install:progress', (e) => {
        setProgress(e.payload.progress);
        setStatus(e.payload.step);
      });
    })();
    return () => unlisten?.();
  }, []);

  const action: Action = (() => {
    if (!existing) return 'install';
    const cmp = compareVersions(version, existing.version);
    if (cmp > 0) return 'update';
    if (cmp < 0) return 'downgrade';
    return 'repair';
  })();

  async function browse() {
    try {
      const picked = await openDialog({
        directory: true,
        multiple: false,
        title: 'Choose install folder',
        defaultPath: installDir || undefined,
      });
      if (typeof picked === 'string' && picked) setInstallDir(picked);
    } catch {}
  }

  async function startInstall() {
    setPhase('installing');
    setError(null);
    try {
      await invoke('run_install', {
        options: { installDir, startMenuShortcut, desktopShortcut },
      });
      setProgress(1);
      setStatus(
        action === 'repair' ? 'Repaired' : action === 'update' ? 'Updated' : 'Installed',
      );
      setPhase('done');
      setTimeout(async () => {
        try {
          await invoke('launch_and_exit');
        } catch {
          await getCurrentWindow().close();
        }
      }, 700);
    } catch (e: unknown) {
      const msg =
        typeof e === 'string' ? e : (e as Error)?.message ?? 'Install failed';
      setError(msg);
      setPhase('error');
    }
  }

  const close = async () => getCurrentWindow().close();
  const minimize = async () => getCurrentWindow().minimize();

  if (!detected) return <div className="h-screen bg-ld-body" />;

  const ctaLabel =
    action === 'install'
      ? 'Continue to Terms'
      : action === 'update'
        ? `Update to ${version}`
        : action === 'downgrade'
          ? `Downgrade to ${version}`
          : 'Repair';

  const CtaIcon = action === 'update' ? ArrowUpCircle : action === 'repair' ? RotateCw : null;

  return (
    <div className="flex flex-col h-screen bg-ld-body text-ld-text select-none">
      {/* Title bar */}
      <div data-tauri-drag-region className="relative h-9 flex items-center shrink-0">
        <div className="absolute right-0 top-0 flex h-9 items-center">
          <button
            onClick={minimize}
            className="flex h-9 w-10 items-center justify-center text-ld-text-muted hover:bg-ld-card transition-colors"
            aria-label="Minimize"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={close}
            className="flex h-9 w-10 items-center justify-center text-ld-text-muted hover:bg-brand-red hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {phase === 'ready' && step === 'options' && (
        <div className="flex flex-col flex-1 px-8 pb-6 animate-fade-up overflow-hidden">
          <div className="flex flex-col items-center text-center">
            <BrandMark />
            <h1 className="mt-5 text-[22px] font-extrabold tracking-tight">
              {action === 'install' && 'Install LinkDrive'}
              {action === 'update' && 'Update LinkDrive'}
              {action === 'repair' && 'Repair LinkDrive'}
              {action === 'downgrade' && 'Downgrade LinkDrive'}
            </h1>
            <p className="mt-1 text-[12px] text-ld-text-muted">
              {existing
                ? action === 'repair'
                  ? `v${version} is already installed. This will reinstall it.`
                  : action === 'update'
                    ? `v${existing.version} is installed. Update to v${version}.`
                    : `v${existing.version} is installed. Downgrade to v${version}.`
                : `Version ${version} — by MoltenPixelStudio`}
            </p>
          </div>

          <div className="mt-6 space-y-3.5">
            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-ld-text-muted/80">
                Install location
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  value={installDir}
                  onChange={(e) => setInstallDir(e.target.value)}
                  spellCheck={false}
                  disabled={!!existing}
                  className={`flex-1 h-9 px-3 rounded-lg bg-ld-card border border-ld-border text-[12.5px] outline-none focus:border-brand-red/60 ${
                    existing ? 'text-ld-text-muted cursor-not-allowed' : 'text-ld-text'
                  }`}
                />
                <button
                  onClick={browse}
                  disabled={!!existing}
                  className="h-9 px-3 rounded-lg bg-ld-card border border-ld-border text-ld-text-muted hover:text-ld-text hover:border-ld-text-muted/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-[12px] font-semibold"
                >
                  <FolderOpen size={13} />
                  Browse
                </button>
              </div>
              {existing && (
                <p className="mt-1.5 text-[10.5px] text-ld-text-muted/70">
                  Keeping the existing location. Uninstall first to move it.
                </p>
              )}
            </div>

            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-ld-text-muted/80">
                Shortcuts
              </label>
              <div className="mt-1.5 space-y-1">
                <Toggle
                  label="Start Menu"
                  value={startMenuShortcut}
                  onChange={setStartMenuShortcut}
                />
                <Toggle
                  label="Desktop"
                  value={desktopShortcut}
                  onChange={setDesktopShortcut}
                />
              </div>
            </div>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setStep('tos')}
            className="h-11 rounded-xl bg-brand-red text-white font-bold text-sm shadow-[0_4px_14px_-4px_rgba(216,57,61,0.55)] hover:brightness-110 active:scale-[0.98] transition-[transform,filter] duration-150 flex items-center justify-center gap-2"
          >
            {CtaIcon ? <CtaIcon size={16} /> : null}
            {ctaLabel}
          </button>
        </div>
      )}

      {phase === 'ready' && step === 'tos' && (
        <div className="flex flex-col flex-1 px-8 pb-6 animate-fade-up overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setStep('options')}
              className="flex items-center gap-1 text-[11px] text-ld-text-muted hover:text-ld-text"
            >
              <ChevronLeft size={13} /> Back
            </button>
          </div>
          <h2 className="text-[17px] font-bold tracking-tight">Terms of Service</h2>
          <p className="mt-1 text-[11.5px] text-ld-text-muted">
            Please read the terms below. You must accept to install LinkDrive.
          </p>

          <div
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
                setTosScrolledToBottom(true);
              }
            }}
            className="mt-4 flex-1 overflow-y-auto rounded-lg border border-ld-border bg-ld-card p-4 text-[11px] leading-relaxed font-mono text-ld-text whitespace-pre-wrap"
          >
            {LICENSE_TEXT}
          </div>

          <label className="mt-3 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={!tosScrolledToBottom}
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-0.5 accent-brand-red disabled:opacity-40"
            />
            <span
              className={`text-[11.5px] leading-snug ${tosScrolledToBottom ? 'text-ld-text' : 'text-ld-text-muted'}`}
            >
              I have read and agree to the LinkDrive Terms of Service.
              {!tosScrolledToBottom && (
                <span className="ml-1 text-ld-text-dim">(scroll to the bottom to enable)</span>
              )}
            </span>
          </label>

          <button
            onClick={startInstall}
            disabled={!tosAccepted}
            className="mt-3 h-11 rounded-xl bg-brand-red text-white font-bold text-sm shadow-[0_4px_14px_-4px_rgba(216,57,61,0.55)] hover:brightness-110 active:scale-[0.98] transition-[transform,filter] duration-150 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
          >
            {action === 'install' ? 'Install' : action === 'update' ? `Update to ${version}` : 'Repair'}
          </button>
        </div>
      )}

      {phase !== 'ready' && (
        <div className="flex flex-col items-center justify-center flex-1 px-8 pb-8 text-center">
          <div
            className={`w-[88px] h-[88px] rounded-[22px] bg-brand-red flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(216,57,61,0.55)] ${
              phase === 'installing' ? 'animate-pulse-red' : ''
            } ${phase === 'done' ? 'animate-pop-in' : ''}`}
          >
            {phase === 'done' ? (
              <Check size={44} className="text-white" strokeWidth={3} />
            ) : (
              <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                <circle cx="17" cy="25" r="11" stroke="white" strokeWidth="4" />
                <circle cx="33" cy="25" r="11" stroke="white" strokeWidth="4" />
              </svg>
            )}
          </div>

          <h1 key={phase} className="mt-7 text-[26px] font-extrabold tracking-tight animate-fade-up">
            {phase === 'installing' &&
              (action === 'update'
                ? 'Updating LinkDrive'
                : action === 'repair'
                  ? 'Repairing LinkDrive'
                  : 'Installing LinkDrive')}
            {phase === 'done' && 'Ready to go'}
            {phase === 'error' &&
              (action === 'update'
                ? 'Update failed'
                : action === 'repair'
                  ? 'Repair failed'
                  : 'Install failed')}
          </h1>

          <p className="mt-2 text-[13px] text-ld-text-muted min-h-[16px] px-4">
            {phase === 'installing' && status}
            {phase === 'done' && 'Launching LinkDrive…'}
            {phase === 'error' && (error ?? 'Something went wrong.')}
          </p>

          <div className="mt-7 w-full max-w-[280px] h-1.5 rounded-full bg-ld-card overflow-hidden relative">
            <div
              className="h-full bg-brand-red transition-[width] duration-300 ease-out rounded-full"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
            {phase === 'installing' && (
              <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
            )}
          </div>

          {phase === 'error' && (
            <button
              onClick={startInstall}
              className="mt-8 px-8 h-11 rounded-xl bg-brand-red text-white font-bold text-sm hover:brightness-110 active:scale-[0.97] transition-all"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-full flex items-center justify-between gap-3 px-3 h-9 rounded-lg border transition-colors ${
        value
          ? 'bg-brand-red/10 border-brand-red/40 text-ld-text'
          : 'bg-ld-card border-ld-border text-ld-text-muted hover:border-ld-text-muted/50'
      }`}
    >
      <span className="text-[12.5px] font-semibold">{label}</span>
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          value ? 'bg-brand-red border-brand-red' : 'border-ld-border'
        }`}
      >
        {value && <Check size={11} className="text-white" strokeWidth={3.5} />}
      </span>
    </button>
  );
}
