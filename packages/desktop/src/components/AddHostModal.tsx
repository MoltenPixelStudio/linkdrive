import { useState } from 'react';
import { X, FolderOpen } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { createPortal } from 'react-dom';
import type { Host } from '@linkdrive/shared/types';

export function AddHostModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (h: Host) => void;
}) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [user, setUser] = useState('');
  const [authKind, setAuthKind] = useState<'password' | 'key'>('password');
  const [keyPath, setKeyPath] = useState('');

  const canSave = name.trim() && host.trim() && user.trim() && port.trim();

  const pickKey = async () => {
    try {
      const picked = await openDialog({
        multiple: false,
        directory: false,
        title: 'Choose private key file',
      });
      if (typeof picked === 'string') setKeyPath(picked);
    } catch {}
  };

  const save = () => {
    if (!canSave) return;
    const h: Host = {
      id: `${Date.now()}`,
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port, 10) || 22,
      user: user.trim(),
      protocol: 'sftp',
      auth:
        authKind === 'password'
          ? { type: 'password' }
          : { type: 'key', keyPath: keyPath || undefined, useAgent: false },
      transport: { mode: 'direct' },
      createdAt: Date.now(),
    };
    onSave(h);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-ld-overlay flex items-center justify-center animate-fade-in">
      <div className="w-[460px] rounded-2xl border border-ld-border bg-ld-card shadow-2xl animate-scale-in">
        <header className="flex items-center justify-between border-b border-ld-border px-5 h-12">
          <h3 className="text-sm font-semibold">Add host</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-ld-elevated text-ld-text-muted"
          >
            <X size={14} />
          </button>
        </header>
        <div className="p-5 space-y-3.5">
          <Field label="Name" value={name} onChange={setName} placeholder="My VPS" />
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <Field
              label="Host"
              value={host}
              onChange={setHost}
              placeholder="203.0.113.5"
              autoCap="none"
            />
            <Field label="Port" value={port} onChange={setPort} inputMode="numeric" />
          </div>
          <Field label="User" value={user} onChange={setUser} placeholder="root" autoCap="none" />

          <div>
            <label className="text-[10.5px] font-bold uppercase tracking-wider text-ld-text-muted/80">
              Authentication
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              {(['password', 'key'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setAuthKind(k)}
                  className={[
                    'flex-1 h-9 rounded-lg border text-[12px] font-semibold transition-colors',
                    authKind === k
                      ? 'bg-brand-red/10 border-brand-red/40 text-ld-text'
                      : 'bg-ld-card border-ld-border text-ld-text-muted hover:border-ld-text-muted/50',
                  ].join(' ')}
                >
                  {k === 'password' ? 'Password' : 'SSH key'}
                </button>
              ))}
            </div>
          </div>

          {authKind === 'key' && (
            <div>
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-ld-text-muted/80">
                Private key file
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  placeholder="~/.ssh/id_ed25519"
                  className="flex-1 h-9 px-3 rounded-lg bg-ld-body border border-ld-border text-[12.5px] outline-none focus:border-brand-red/60 text-ld-text"
                />
                <button
                  onClick={pickKey}
                  className="h-9 px-3 rounded-lg bg-ld-body border border-ld-border text-ld-text-muted hover:text-ld-text flex items-center gap-1.5 text-[12px]"
                >
                  <FolderOpen size={13} /> Browse
                </button>
              </div>
              <p className="mt-1 text-[10.5px] text-ld-text-dim">
                Key contents are read at connect time. Not copied.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-ld-border text-ld-text font-semibold text-sm hover:bg-ld-elevated"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="flex-1 h-10 rounded-lg bg-brand-red text-white font-bold text-sm hover:brightness-110 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save host
            </button>
          </div>
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
  placeholder,
  inputMode,
  autoCap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoCap?: 'none' | 'sentences';
}) {
  return (
    <div>
      <label className="text-[10.5px] font-bold uppercase tracking-wider text-ld-text-muted/80">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize={autoCap}
        inputMode={inputMode}
        className="mt-1.5 w-full h-9 px-3 rounded-lg bg-ld-body border border-ld-border text-[12.5px] outline-none focus:border-brand-red/60 text-ld-text placeholder:text-ld-text-dim"
      />
    </div>
  );
}
