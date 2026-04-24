import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2 } from 'lucide-react';
import { readText, homeDir } from '../utils/fs';
import type { Host } from '@linkdrive/shared/types';

type Parsed = {
  alias: string;
  host: string;
  user: string;
  port: number;
  identityFile?: string;
};

function parseSshConfig(text: string): Parsed[] {
  const lines = text.split(/\r?\n/);
  const out: Parsed[] = [];
  let cur: Parsed | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\S+)\s+(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'host') {
      if (cur && cur.host) out.push(cur);
      // Skip wildcards and patterns with globs.
      const first = val.split(/\s+/)[0];
      if (first === '*' || first.includes('*') || first.includes('?')) {
        cur = null;
        continue;
      }
      cur = { alias: first, host: '', user: '', port: 22 };
      continue;
    }
    if (!cur) continue;
    switch (key) {
      case 'hostname':
        cur.host = val;
        break;
      case 'user':
        cur.user = val;
        break;
      case 'port':
        cur.port = parseInt(val, 10) || 22;
        break;
      case 'identityfile':
        cur.identityFile = val.replace(/^~\//, '');
        break;
    }
  }
  if (cur && cur.host) out.push(cur);
  // Fill missing hostname with alias, default user to current user.
  return out.map((p) => ({
    ...p,
    host: p.host || p.alias,
    user: p.user || 'root',
  }));
}

export function SshConfigImportModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (hosts: Host[]) => void;
}) {
  const [parsed, setParsed] = useState<Parsed[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const home = await homeDir();
        const sep = home.includes('\\') ? '\\' : '/';
        const path = `${home}${sep}.ssh${sep}config`;
        const text = await readText(path);
        const list = parseSshConfig(text);
        setParsed(list);
        setSelected(new Set(list.map((p) => p.alias)));
      } catch (e) {
        setErr(typeof e === 'string' ? e : (e as Error)?.message ?? 'Could not read ~/.ssh/config');
      }
    })();
  }, []);

  const toggle = (alias: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(alias)) n.delete(alias);
      else n.add(alias);
      return n;
    });
  };

  const doImport = () => {
    if (!parsed) return;
    const now = Date.now();
    const hosts: Host[] = parsed
      .filter((p) => selected.has(p.alias))
      .map((p, i) => {
        const hasIdentity = !!p.identityFile;
        return {
          id: `${now}-${i}`,
          name: p.alias,
          host: p.host,
          port: p.port,
          user: p.user,
          protocol: 'sftp',
          auth: hasIdentity
            ? { type: 'key', keyPath: p.identityFile, useAgent: false }
            : { type: 'password' },
          transport: { mode: 'direct' },
          createdAt: now,
        };
      });
    onImport(hosts);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-ld-overlay flex items-center justify-center animate-fade-in">
      <div className="w-[560px] max-h-[80vh] rounded-2xl border border-ld-border bg-ld-card shadow-2xl animate-scale-in flex flex-col">
        <header className="flex items-center justify-between border-b border-ld-border px-5 h-12 shrink-0">
          <h3 className="text-sm font-semibold">Import from ~/.ssh/config</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-ld-elevated text-ld-text-muted"
          >
            <X size={14} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {!parsed && !err && (
            <div className="flex items-center justify-center gap-2 py-8 text-ld-text-muted text-xs">
              <Loader2 size={14} className="animate-spin" /> Reading config…
            </div>
          )}
          {err && <div className="text-xs text-brand-red">{err}</div>}
          {parsed && parsed.length === 0 && (
            <div className="text-xs text-ld-text-muted text-center py-8">
              No host entries found.
            </div>
          )}
          {parsed && parsed.length > 0 && (
            <ul className="space-y-1">
              {parsed.map((p) => {
                const isSel = selected.has(p.alias);
                return (
                  <li key={p.alias}>
                    <button
                      onClick={() => toggle(p.alias)}
                      className={[
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors',
                        isSel
                          ? 'bg-brand-red/10 border-brand-red/40'
                          : 'bg-ld-body border-ld-border hover:border-ld-text-muted/60',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'w-4 h-4 rounded border flex items-center justify-center',
                          isSel ? 'bg-brand-red border-brand-red' : 'border-ld-border',
                        ].join(' ')}
                      >
                        {isSel && <Check size={10} className="text-white" strokeWidth={4} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold text-ld-text truncate">
                          {p.alias}
                        </div>
                        <div className="text-[11px] font-mono text-ld-text-muted truncate">
                          {p.user}@{p.host}:{p.port}
                          {p.identityFile ? ` · ${p.identityFile}` : ''}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-ld-border px-5 h-12 shrink-0">
          <span className="text-[11px] text-ld-text-muted">
            {parsed ? `${selected.size} / ${parsed.length} selected` : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-ld-border text-ld-text font-semibold text-sm hover:bg-ld-elevated"
            >
              Cancel
            </button>
            <button
              onClick={doImport}
              disabled={!parsed || selected.size === 0}
              className="h-9 px-4 rounded-lg bg-brand-red text-white font-bold text-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Import {selected.size || ''}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
