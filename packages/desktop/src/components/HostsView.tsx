import { useEffect, useRef, useState } from 'react';
import { Plus, LogIn, MoreVertical, FileInput } from 'lucide-react';
import { useHosts } from '../context/HostsContext';
import { useActiveHost } from '../context/ActiveHostContext';
import { AddHostModal } from './AddHostModal';
import { ConnectModal } from './ConnectModal';
import { SshConfigImportModal } from './SshConfigImportModal';
import type { Host } from '@linkdrive/shared/types';
import type { ViewId } from '../App';
import { sshDisconnect } from '../utils/source';

export function HostsView({ onNavigateView }: { onNavigateView?: (v: ViewId) => void }) {
  const { hosts, add, update, remove } = useHosts();
  const { setActiveHostId, activeHostId } = useActiveHost();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Host | null>(null);
  const [connectingHost, setConnectingHost] = useState<Host | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuFor(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  const onDelete = async (h: Host) => {
    if (!confirm(`Forget host "${h.name}"? Saved fingerprints are removed too.`)) return;
    if (activeHostId === h.id) {
      await sshDisconnect(h.id).catch(() => {});
      setActiveHostId(null);
    }
    remove(h.id);
    setMenuFor(null);
  };

  const onClearFingerprint = (h: Host) => {
    update(h.id, { knownHostKey: undefined });
    setMenuFor(null);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-ld-border px-6 h-12">
        <h2 className="text-sm font-semibold">Hosts</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-ld-text-muted hover:bg-ld-elevated hover:text-ld-text transition-colors"
            title="Import from ~/.ssh/config"
          >
            <FileInput size={13} /> Import
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-red px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-muted-red transition-colors"
          >
            <Plus size={14} /> Add host
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {hosts.length === 0 ? (
          <div className="mx-auto max-w-md text-center animate-fade-up">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-dashed border-ld-border-subtle flex items-center justify-center text-ld-text-dim">
              <Plus size={22} />
            </div>
            <h3 className="text-base font-semibold">No hosts yet</h3>
            <p className="mt-1 text-sm text-ld-text-muted">
              Add your VPS or import from your SSH config.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {hosts.map((h) => {
              const menuOpen = menuFor === h.id;
              return (
                <li
                  key={h.id}
                  className="relative rounded-xl border border-ld-border bg-ld-card p-4 flex flex-col gap-2 animate-scale-in"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: h.color || '#D8393D' }}
                    />
                    <span className="font-medium truncate flex-1">{h.name}</span>
                    <button
                      onClick={() => setMenuFor(menuOpen ? null : h.id)}
                      className="p-1 rounded hover:bg-ld-elevated text-ld-text-muted"
                      title="More"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                  <div className="text-xs text-ld-text-muted font-mono truncate">
                    {h.user}@{h.host}:{h.port}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-ld-text-dim">
                    {h.protocol} · {h.auth.type} · {h.transport.mode}
                    {h.knownHostKey ? ' · pinned' : ''}
                  </div>
                  <button
                    onClick={() => setConnectingHost(h)}
                    className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-red/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-red transition-colors"
                  >
                    <LogIn size={12} /> Connect
                  </button>

                  {menuOpen && (
                    <div
                      ref={menuRef}
                      className="absolute right-3 top-10 z-20 w-[180px] rounded-lg border border-ld-border bg-ld-card shadow-xl py-1 animate-scale-in"
                    >
                      <button
                        onClick={() => {
                          setEditing(h);
                          setMenuFor(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-ld-text hover:bg-ld-elevated"
                      >
                        Edit
                      </button>
                      {h.knownHostKey && (
                        <button
                          onClick={() => onClearFingerprint(h)}
                          className="w-full text-left px-3 py-1.5 text-xs text-ld-text hover:bg-ld-elevated"
                        >
                          Clear pinned fingerprint
                        </button>
                      )}
                      <div className="my-1 h-px bg-ld-border-subtle" />
                      <button
                        onClick={() => onDelete(h)}
                        className="w-full text-left px-3 py-1.5 text-xs text-brand-red hover:bg-brand-red/10"
                      >
                        Forget host
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {addOpen && (
        <AddHostModal
          onClose={() => setAddOpen(false)}
          onSave={(h) => {
            add(h);
            setAddOpen(false);
          }}
        />
      )}

      {editing && (
        <AddHostModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(h) => {
            update(h.id, h);
            setEditing(null);
          }}
        />
      )}

      {connectingHost && (
        <ConnectModal
          host={connectingHost}
          onClose={() => setConnectingHost(null)}
          onUpdateHost={(patch) => update(connectingHost.id, patch)}
          onConnected={() => {
            setActiveHostId(connectingHost.id);
            setConnectingHost(null);
            onNavigateView?.('remote');
          }}
        />
      )}

      {importOpen && (
        <SshConfigImportModal
          onClose={() => setImportOpen(false)}
          onImport={(hs) => {
            for (const h of hs) add(h);
            setImportOpen(false);
          }}
        />
      )}
    </div>
  );
}
