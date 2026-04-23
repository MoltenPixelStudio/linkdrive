import { Folder, Server, ArrowDownUp, Settings } from 'lucide-react';
import type { ViewId } from '../App';
import { BrandGlyph } from './BrandGlyph';

const ITEMS: { id: ViewId; label: string; Icon: typeof Folder }[] = [
  { id: 'local', label: 'This device', Icon: Folder },
  { id: 'hosts', label: 'Hosts', Icon: Server },
  { id: 'transfers', label: 'Transfers', Icon: ArrowDownUp },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function Sidebar({
  current,
  onSelect,
}: {
  current: ViewId;
  onSelect: (id: ViewId) => void;
}) {
  return (
    <aside className="flex h-full w-[220px] flex-col border-r border-ld-border bg-ld-card">
      <div className="flex h-12 items-center gap-2 px-4 border-b border-ld-border">
        <BrandGlyph size={24} rounded={6} />
        <span className="font-semibold tracking-tight">LinkDrive</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={[
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-ld-elevated text-ld-text'
                  : 'text-ld-text-muted hover:bg-ld-elevated hover:text-ld-text',
              ].join(' ')}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-3 text-[11px] text-ld-text-dim border-t border-ld-border">v0.1.0 · scaffold</div>
    </aside>
  );
}
