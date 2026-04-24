import { Folder, Server, ArrowDownUp, Settings, Columns2 } from 'lucide-react';
import type { ViewId } from '../App';

const ITEMS: { id: ViewId; label: string; Icon: typeof Folder }[] = [
  { id: 'local', label: 'This device', Icon: Folder },
  { id: 'hosts', label: 'Hosts', Icon: Server },
  { id: 'split', label: 'Split view', Icon: Columns2 },
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
      <nav className="flex-1 overflow-y-auto p-2 pt-3">
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
    </aside>
  );
}
