import { ArrowUp, ArrowDown, LayoutGrid, List, Search, Eye, EyeOff } from 'lucide-react';

export type SortKey = 'name' | 'size' | 'mtime' | 'type';
export type ViewMode = 'list' | 'grid';

export function Toolbar({
  sortKey,
  sortDir,
  onSortKey,
  onSortDir,
  view,
  onView,
  query,
  onQuery,
  showHidden,
  onToggleHidden,
}: {
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSortKey: (k: SortKey) => void;
  onSortDir: (d: 'asc' | 'desc') => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  query: string;
  onQuery: (q: string) => void;
  showHidden: boolean;
  onToggleHidden: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-ld-border-subtle bg-ld-body px-4 h-10">
      <div className="flex items-center rounded-md bg-ld-elevated px-2 py-1 gap-1.5 flex-1 max-w-xs">
        <Search size={12} className="text-ld-text-dim" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search current folder"
          className="bg-transparent outline-none text-xs flex-1 placeholder:text-ld-text-dim text-ld-text"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <select
          value={sortKey}
          onChange={(e) => onSortKey(e.target.value as SortKey)}
          className="bg-ld-elevated text-xs px-2 py-1 rounded-md border border-transparent hover:border-ld-border cursor-pointer text-ld-text outline-none"
        >
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="mtime">Modified</option>
          <option value="type">Type</option>
        </select>
        <button
          onClick={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="p-1.5 rounded-md hover:bg-ld-elevated text-ld-text-muted"
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </button>

        <div className="mx-1 h-5 w-px bg-ld-border-subtle" />

        <button
          onClick={onToggleHidden}
          className={[
            'p-1.5 rounded-md',
            showHidden ? 'bg-ld-elevated text-ld-text' : 'text-ld-text-muted hover:bg-ld-elevated',
          ].join(' ')}
          title={showHidden ? 'Hide dotfiles' : 'Show dotfiles'}
        >
          {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        <div className="mx-1 h-5 w-px bg-ld-border-subtle" />

        <button
          onClick={() => onView('list')}
          className={[
            'p-1.5 rounded-md',
            view === 'list' ? 'bg-ld-elevated text-ld-text' : 'text-ld-text-muted hover:bg-ld-elevated',
          ].join(' ')}
          title="List view"
        >
          <List size={14} />
        </button>
        <button
          onClick={() => onView('grid')}
          className={[
            'p-1.5 rounded-md',
            view === 'grid' ? 'bg-ld-elevated text-ld-text' : 'text-ld-text-muted hover:bg-ld-elevated',
          ].join(' ')}
          title="Grid view"
        >
          <LayoutGrid size={14} />
        </button>
      </div>
    </div>
  );
}
