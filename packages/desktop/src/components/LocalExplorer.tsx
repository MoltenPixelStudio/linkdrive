import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Omnibox } from './Omnibox';
import { ViewModeMenu } from './ViewModeMenu';
import { FileDetails } from './FileDetails';
import { FileGrid } from './FileGrid';
import { PreviewPane } from './PreviewPane';
import { ContextMenu, useCtx, type MenuItem } from './ContextMenu';
import { ls, homeDir, mkdir as mkdirCmd, deletePath, rename as renameCmd } from '../utils/fs';
import type { GroupBy } from './FileDetails';
import type { DateFormat } from '../utils/fileMeta';
import { useFolderSizes } from '../utils/useFolderSizes';
import { basename, dirname, extname } from '@linkdrive/shared/paths';
import type { Entry } from '@linkdrive/shared/types';
import {
  DEFAULT_COLUMNS,
  type Column,
  type ColumnId,
  type ViewMode,
} from '../types/explorer';

const SETTINGS_KEY = 'linkdrive.explorer.settings';

type Settings = {
  view: ViewMode;
  columns: Column[];
  showHidden: boolean;
  recursive: boolean;
  sort: { key: ColumnId; dir: 'asc' | 'desc' };
  groupBy: GroupBy;
  dateFormat: DateFormat;
  foldersFirst: boolean;
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        view: parsed.view ?? 'details',
        columns: mergeColumns(parsed.columns),
        showHidden: !!parsed.showHidden,
        recursive: !!parsed.recursive,
        sort: parsed.sort ?? { key: 'name', dir: 'asc' },
        groupBy: parsed.groupBy ?? 'none',
        dateFormat: parsed.dateFormat ?? 'long',
        foldersFirst: parsed.foldersFirst ?? true,
      };
    }
  } catch {}
  return {
    view: 'details',
    columns: DEFAULT_COLUMNS,
    showHidden: false,
    recursive: false,
    sort: { key: 'name', dir: 'asc' },
    groupBy: 'none',
    dateFormat: 'long',
    foldersFirst: true,
  };
}

function mergeColumns(saved?: Column[]): Column[] {
  if (!Array.isArray(saved)) return DEFAULT_COLUMNS;
  const byId = new Map(saved.map((c) => [c.id, c] as const));
  return DEFAULT_COLUMNS.map((d) => ({ ...d, ...byId.get(d.id) }));
}

function sortEntries(
  list: Entry[],
  key: ColumnId,
  dir: 'asc' | 'desc',
  foldersFirst: boolean,
  folderSizes: Map<string, number>,
): Entry[] {
  const mul = dir === 'asc' ? 1 : -1;
  const sizeOf = (e: Entry): number => {
    if (!e.isDir) return e.size;
    const fs = folderSizes.get(e.path);
    if (fs === undefined || fs < 0) return -1; // pending/denied → sort to bottom asc
    return fs;
  };
  return [...list].sort((a, b) => {
    if (foldersFirst && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    switch (key) {
      case 'size':
        return (sizeOf(a) - sizeOf(b)) * mul;
      case 'modified':
        return (a.mtime - b.mtime) * mul;
      case 'type':
        return (extname(a.path).localeCompare(extname(b.path)) || a.name.localeCompare(b.name)) * mul;
      case 'permissions':
      case 'owner':
      case 'name':
      default:
        return a.name.localeCompare(b.name) * mul;
    }
  });
}

export function LocalExplorer() {
  const [path, setPath] = useState<string>('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const { view, columns, showHidden, recursive, sort, groupBy, dateFormat, foldersFirst } =
    settings;

  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);

  const folderSizes = useFolderSizes(entries);

  const ctx = useCtx<Entry | null>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    homeDir().then((h) => setPath(h)).catch(() => setPath('/'));
  }, []);

  // Sync window title to current folder. Guarded for non-tauri dev.
  useEffect(() => {
    if (!path) return;
    const isTauri =
      typeof window !== 'undefined' &&
      !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    if (!isTauri) return;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const label = basename(path) || path;
        await getCurrentWindow().setTitle(`${label} — LinkDrive`);
      } catch {}
    })();
  }, [path]);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setErr(null);
    try {
      const list = await ls(p);
      setEntries(list);
      setSelected(null);
    } catch (e) {
      setErr(String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (path) load(path);
  }, [path, load]);

  const navigate = useCallback(
    (next: string) => {
      if (next === path) return;
      setHistory((h) => [...h, path]);
      setFuture([]);
      setPath(next);
    },
    [path],
  );

  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [path, ...f]);
      setPath(prev);
      return h.slice(0, -1);
    });
  };
  const goForward = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, path]);
      setPath(next);
      return f.slice(1);
    });
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries.filter((e) => {
      if (!showHidden && e.name.startsWith('.')) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortEntries(filtered, sort.key, sort.dir, foldersFirst, folderSizes);
  }, [entries, query, showHidden, sort, foldersFirst, folderSizes]);

  const selectedEntry = useMemo(
    () => visible.find((e) => e.path === selected) ?? null,
    [visible, selected],
  );

  const onOpen = (e: Entry) => {
    if (e.isDir) navigate(e.path);
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  // Keyboard shortcuts: Ctrl+1..6 view modes, F5 refresh, Del, F2, Backspace=up
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key >= '1' && e.key <= '6') {
        const modes: ViewMode[] = [
          'details',
          'list',
          'tiles',
          'small-icons',
          'medium-icons',
          'large-icons',
        ];
        updateSetting('view', modes[parseInt(e.key) - 1]);
        e.preventDefault();
      }
      if (e.key === 'F5') {
        load(path);
        e.preventDefault();
      }
      if (e.key === 'Backspace' && history.length > 0) {
        goBack();
        e.preventDefault();
      }
      if (e.key === 'Delete' && selectedEntry) {
        onDelete(selectedEntry);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, history, selectedEntry]);

  // Actions
  const onDelete = async (e: Entry) => {
    if (!confirm(`Delete ${e.isDir ? 'folder' : 'file'} "${e.name}"? This cannot be undone.`))
      return;
    try {
      await deletePath(e.path, true);
      load(path);
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  const onRename = async (e: Entry) => {
    const next = prompt('Rename to:', e.name);
    if (!next || next === e.name) return;
    try {
      await renameCmd(e.path, `${dirname(e.path)}/${next}`);
      load(path);
    } catch (err) {
      alert(`Rename failed: ${err}`);
    }
  };

  const onNewFolder = async () => {
    const name = prompt('New folder name:');
    if (!name) return;
    try {
      await mkdirCmd(`${path}/${name}`);
      load(path);
    } catch (err) {
      alert(`Could not create folder: ${err}`);
    }
  };

  const onCopyPath = (e: Entry) => {
    navigator.clipboard?.writeText(e.path).catch(() => {});
  };

  const menuItemsForEntry = (e: Entry): MenuItem[] => [
    { id: 'open', label: e.isDir ? 'Open' : 'Preview', onSelect: () => onOpen(e) },
    { id: 'sep1', type: 'separator' },
    { id: 'rename', label: 'Rename', shortcut: 'F2', onSelect: () => onRename(e) },
    { id: 'copy-path', label: 'Copy as path', onSelect: () => onCopyPath(e) },
    {
      id: 'reveal',
      label: 'Open file location',
      disabled: e.path === path,
      onSelect: () => navigate(dirname(e.path)),
    },
    { id: 'sep2', type: 'separator' },
    { id: 'delete', label: 'Delete', shortcut: 'Del', danger: true, onSelect: () => onDelete(e) },
    { id: 'sep3', type: 'separator' },
    {
      id: 'props',
      label: 'Properties',
      onSelect: () =>
        alert(
          `${e.name}\n\nPath: ${e.path}\nType: ${e.isDir ? 'Folder' : 'File'}\nSize: ${e.size} bytes\nModified: ${new Date(e.mtime).toLocaleString()}`,
        ),
    },
  ];

  const menuItemsForEmpty = (): MenuItem[] => [
    { id: 'new-folder', label: 'New folder', onSelect: onNewFolder },
    { id: 'sep1', type: 'separator' },
    { id: 'refresh', label: 'Refresh', shortcut: 'F5', onSelect: () => load(path) },
    { id: 'paste', label: 'Paste', disabled: true, onSelect: () => {} },
    { id: 'sep2', type: 'separator' },
    {
      id: 'select-all',
      label: 'Select all',
      shortcut: 'Ctrl+A',
      disabled: true,
      onSelect: () => {},
    },
    { id: 'sep3', type: 'separator' },
    {
      id: 'props-folder',
      label: 'Folder properties',
      onSelect: () => alert(`Folder: ${path}\n${entries.length} entries`),
    },
  ];

  const onContextMenu = (e: React.MouseEvent, target: Entry | null) => {
    e.preventDefault();
    e.stopPropagation();
    ctx.open(e, target);
  };

  return (
    <div className="flex h-full flex-col bg-ld-body">
      {/* Top bar: nav buttons + omnibox + view menu */}
      <header className="flex items-center gap-2 border-b border-ld-border px-3 h-12">
        <button
          onClick={goBack}
          disabled={history.length === 0}
          className="p-1.5 rounded-md text-ld-text-muted hover:bg-ld-elevated disabled:opacity-30 disabled:hover:bg-transparent"
          title="Back (Backspace)"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={goForward}
          disabled={future.length === 0}
          className="p-1.5 rounded-md text-ld-text-muted hover:bg-ld-elevated disabled:opacity-30 disabled:hover:bg-transparent"
          title="Forward"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => load(path)}
          className="p-1.5 rounded-md text-ld-text-muted hover:bg-ld-elevated"
          title="Refresh (F5)"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>

        <div className="flex-1 min-w-0">
          <Omnibox
            currentPath={path}
            query={query}
            onQueryChange={setQuery}
            onNavigate={navigate}
            recursive={recursive}
            onToggleRecursive={() => updateSetting('recursive', !recursive)}
          />
        </div>

        <span className="text-[11px] text-ld-text-muted shrink-0 mr-1">
          {visible.length} item{visible.length === 1 ? '' : 's'}
        </span>

        <ViewModeMenu mode={view} onChange={(m) => updateSetting('view', m)} />
      </header>

      {/* Body: file area + preview */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {err ? (
            <div className="p-6 text-xs text-ld-text-muted">
              <span className="text-brand-red">Error:</span> {err}
            </div>
          ) : view === 'details' ? (
            <FileDetails
              entries={visible}
              columns={columns}
              onColumnsChange={(next) => updateSetting('columns', next)}
              selected={selected}
              onSelect={setSelected}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
              sort={sort}
              onSortChange={(s) => updateSetting('sort', s)}
              groupBy={groupBy}
              onGroupChange={(g) => updateSetting('groupBy', g)}
              showHidden={showHidden}
              onToggleHidden={() => updateSetting('showHidden', !showHidden)}
              foldersFirst={foldersFirst}
              onToggleFoldersFirst={() => updateSetting('foldersFirst', !foldersFirst)}
              dateFormat={dateFormat}
              onDateFormatChange={(f) => updateSetting('dateFormat', f)}
              folderSizes={folderSizes}
            />
          ) : (
            <FileGrid
              entries={visible}
              mode={view}
              selected={selected}
              onSelect={setSelected}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
            />
          )}
        </div>

        <aside className="w-[320px] border-l border-ld-border bg-ld-card shrink-0">
          <PreviewPane entry={selectedEntry} />
        </aside>
      </div>

      {/* Hidden file input for future import UX */}
      <input ref={fileInputRef} type="file" className="hidden" />

      {ctx.state && (
        <ContextMenu
          x={ctx.state.x}
          y={ctx.state.y}
          items={ctx.state.target ? menuItemsForEntry(ctx.state.target) : menuItemsForEmpty()}
          onClose={ctx.close}
        />
      )}
    </div>
  );
}
