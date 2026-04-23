import { useEffect, useState } from 'react';
import { X, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Host } from '@linkdrive/shared/types';
import { sshConnect } from '../utils/source';
import { readText } from '../utils/fs';

type Phase = 'prompt' | 'connecting' | 'tofu' | 'done' | 'error';

export function ConnectModal({
  host,
  onClose,
  onConnected,
  onUpdateHost,
}: {
  host: Host;
  onClose: () => void;
  onConnected: () => void;
  onUpdateHost: (patch: Partial<Host>) => void;
}) {
  const [phase, setPhase] = useState<Phase>('prompt');
  const [password, setPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seenFingerprint, setSeenFingerprint] = useState<string | null>(null);

  const authKind = host.auth.type;
  const keyPath = 'keyPath' in host.auth ? host.auth.keyPath : undefined;

  useEffect(() => {
    // Focus handled by browser defaults; nothing to do here.
  }, []);

  const connect = async (pinned?: string) => {
    setPhase('connecting');
    setError(null);
    try {
      let privateKeyPem: string | undefined;
      if (authKind === 'key') {
        if (!keyPath) throw new Error('No private key path configured');
        privateKeyPem = await readText(keyPath);
      }
      const result = await sshConnect({
        hostId: host.id,
        host: host.host,
        port: host.port,
        user: host.user,
        password: authKind === 'password' ? password : undefined,
        privateKeyPem,
        privateKeyPassphrase: authKind === 'key' ? passphrase || undefined : undefined,
        pinnedFingerprint: pinned ?? host.knownHostKey ?? undefined,
      });

      if (!host.knownHostKey) {
        setSeenFingerprint(result.fingerprint);
        setPhase('tofu');
        return;
      }

      setPhase('done');
      onUpdateHost({ lastUsedAt: Date.now() });
      setTimeout(onConnected, 300);
    } catch (e) {
      setError(typeof e === 'string' ? e : (e as Error)?.message ?? 'Connection failed');
      setPhase('error');
    }
  };

  const trust = () => {
    if (!seenFingerprint) return;
    onUpdateHost({ knownHostKey: seenFingerprint, lastUsedAt: Date.now() });
    setPhase('done');
    setTimeout(onConnected, 300);
  };

  const stop = () => {
    setPhase('prompt');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-ld-overlay flex items-center justify-center animate-fade-in">
      <div className="w-[440px] rounded-2xl border border-ld-border bg-ld-card shadow-2xl animate-scale-in">
        <header className="flex items-center justify-between border-b border-ld-border px-5 h-12">
          <h3 className="text-sm font-semibold">
            Connect to {host.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-ld-elevated text-ld-text-muted"
          >
            <X size={14} />
          </button>
        </header>

        <div className="p-5 space-y-3.5">
          <div className="rounded-lg bg-ld-body border border-ld-border px-3 py-2 font-mono text-[11.5px] text-ld-text-muted">
            {host.user}@{host.host}:{host.port}
          </div>

          {phase === 'prompt' && (
            <>
              {authKind === 'password' && (
                <Field
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  password
                  autoFocus
                />
              )}
              {authKind === 'key' && (
                <>
                  <div className="text-[11.5px] text-ld-text-muted">
                    Key:{' '}
                    <span className="font-mono text-ld-text">{keyPath ?? '—'}</span>
                  </div>
                  <Field
                    label="Passphrase (optional)"
                    value={passphrase}
                    onChange={setPassphrase}
                    password
                    autoFocus
                  />
                </>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-10 rounded-lg border border-ld-border text-ld-text font-semibold text-sm hover:bg-ld-elevated"
                >
                  Cancel
                </button>
                <button
                  onClick={() => connect()}
                  className="flex-1 h-10 rounded-lg bg-brand-red text-white font-bold text-sm hover:brightness-110 active:scale-[0.98] transition"
                >
                  Connect
                </button>
              </div>
            </>
          )}

          {phase === 'connecting' && (
            <div className="flex items-center justify-center gap-2 py-6 text-ld-text-muted">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs">Connecting…</span>
            </div>
          )}

          {phase === 'tofu' && seenFingerprint && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-[12px] text-ld-text-muted">
                <ShieldCheck size={16} className="text-brand-red shrink-0 mt-0.5" />
                <div>
                  First time connecting to this host. Verify the host key fingerprint
                  matches what your server admin expects, then trust it to pin.
                </div>
              </div>
              <div className="rounded-lg bg-ld-body border border-ld-border px-3 py-2 font-mono text-[11px] text-ld-text break-all">
                {seenFingerprint}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-10 rounded-lg border border-ld-border text-ld-text font-semibold text-sm hover:bg-ld-elevated"
                >
                  Abort
                </button>
                <button
                  onClick={trust}
                  className="flex-1 h-10 rounded-lg bg-brand-red text-white font-bold text-sm hover:brightness-110"
                >
                  Trust and continue
                </button>
              </div>
            </div>
          )}

          {phase === 'done' && (
            <div className="flex items-center justify-center gap-2 py-6 text-brand-red">
              <KeyRound size={16} />
              <span className="text-xs font-semibold">Connected</span>
            </div>
          )}

          {phase === 'error' && (
            <>
              <div className="rounded-lg bg-brand-red/10 border border-brand-red/30 px-3 py-2 text-[11.5px] text-ld-text">
                {error ?? 'Unknown error'}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 h-10 rounded-lg border border-ld-border text-ld-text font-semibold text-sm hover:bg-ld-elevated"
                >
                  Close
                </button>
                <button
                  onClick={stop}
                  className="flex-1 h-10 rounded-lg bg-brand-red text-white font-bold text-sm hover:brightness-110"
                >
                  Try again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label,
  value,
  onChange,
  password,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  password?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="text-[10.5px] font-bold uppercase tracking-wider text-ld-text-muted/80">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={password ? 'password' : 'text'}
        autoFocus={autoFocus}
        className="mt-1.5 w-full h-9 px-3 rounded-lg bg-ld-body border border-ld-border text-[12.5px] outline-none focus:border-brand-red/60 text-ld-text"
      />
    </div>
  );
}
