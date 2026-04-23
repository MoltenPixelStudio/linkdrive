import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Omnibox } from './Omnibox';
import { ViewModeMenu } from './ViewModeMenu';
import { FileDetails } from './FileDetails';
import { FileGrid } from './FileGrid';
import { PreviewPane } from './PreviewPane';
import { ContextMenu, useCtx, type MenuItem } from './ContextMenu';
import { ExplorerSourceContext } from './ExplorerContext';
import { PropertiesModal } from './PropertiesModal';
import type { GroupBy } from './FileDetails';
import type { DateFormat } from '../utils/fileMeta';
import { useFolderSizes, clearFolderSizeCache } from '../utils/useFolderSizes';
import { StatusBar } from './StatusBar';
import { basename, dirname, extname } from '@linkdrive/shared/paths';
import type { Entry } from '@linkdrive/shared/types';
import type { Source } from '../utils/source';
import { useTransfers } from '../context/TransfersContext';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { shellOpen, shellOpenWith } from '../utils/shell';
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
  previewVisible: boolean;
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
        previewVisible: parsed.previewVisible ?? true,
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
    previewVisible: true,
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
    if (fs === undefined || fs < 0) return -1;
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
        return (
          (extname(a.path).localeCompare(extname(b.path)) ||
            a.name.localeCompare(b.name)) * mul
        );
      case 'permissions':
      case 'owner':
      case 'name':
      default:
        return a.name.localeCompare(b.name) * mul;
    }
  });
}

export function Explorer({ source }: { source: Source }) {
  const [path, setPath] = useState<string>('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [propertiesFor, setPropertiesFor] = useState<Entry | null>(null);
  const [query, setQuery] = useState('');

  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const {
    view,
    columns,
    showHidden,
    recursive,
    sort,
    groupBy,
    dateFormat,
    foldersFirst,
    previewVisible,
  } = settings;

  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);

  const sizeColumnVisible = columns.find((c) => c.id === 'size')?.visible ?? false;
  const needsFolderSizes =
    sizeColumnVisible || sort.key === 'size' || groupBy === 'size';
  const folderSizes = useFolderSizes(entries, needsFolderSizes, source.id, source.dirSize);

  const { startDownload, startUpload } = useTransfers();

  const ctx = useCtx<Entry | null>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Reset explorer state when source changes.
  useEffect(() => {
    setPath('');
    setEntries([]);
    setSelected(new Set());
    setLastSelected(null);
    setRenamingPath(null);
    setHistory([]);
    setFuture([]);
    source
      .home()
      .then((h) => setPath(h))
      .catch(() => setPath('/'));
  }, [source.id]);

  useEffect(() => {
    if (!path) return;
    const isTauri =
      typeof window !== 'undefined' &&
      !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    if (!isTauri) return;
    (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const folder = basename(path) || path;
        const title =
          source.kind === 'local'
            ? `${folder} — LinkDrive`
            : `${folder} · ${source.label} — LinkDrive`;
        await getCurrentWindow().setTitle(title);
      } catch {}
    })();
  }, [path, source.kind, source.label]);

  const load = useCallback(
    async (p: string, bustCache = false) => {
      setLoading(true);
      setErr(null);
      try {
        if (bustCache) clearFolderSizeCache(source.id);
        const list = await source.ls(p);
        setEntries(list);
        setSelected(new Set());
        setLastSelected(null);
        setRenamingPath(null);
      } catch (e) {
        setErr(String(e));
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [source],
  );

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entries,
    query,
    showHidden,
    sort,
    foldersFirst,
    sort.key === 'size' ? folderSizes : null,
  ]);

  const selectedEntry = useMemo(
    () =>
      lastSelected
        ? visible.find((e) => e.path === lastSelected) ?? null
        : null,
    [visible, lastSelected],
  );

  const onSelect = (path: string, event?: React.MouseEvent) => {
    const ctrl = event?.ctrlKey || event?.metaKey;
    const shift = event?.shiftKey;
    if (shift && lastSelected) {
      const a = visible.findIndex((x) => x.path === lastSelected);
      const b = visible.findIndex((x) => x.path === path);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = new Set<string>();
        for (let i = lo; i <= hi; i++) range.add(visible[i].path);
        setSelected(range);
        setLastSelected(path);
        return;
      }
    }
    if (ctrl) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
      setLastSelected(path);
      return;
    }
    setSelected(new Set([path]));
    setLastSelected(path);
  };

  const onOpen = (e: Entry) => {
    if (e.isDir) {
      navigate(e.path);
      return;
    }
    if (source.kind === 'local') {
      shellOpen(e.path).catch((err) => alert(`Open failed: ${err}`));
    }
    // Remote non-dirs: future (download to temp then open).
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

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
        load(path, true);
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

  const onDelete = async (e: Entry) => {
    if (!source.deletePath) {
      alert('Delete not supported on this source yet.');
      return;
    }
    if (!confirm(`Delete ${e.isDir ? 'folder' : 'file'} "${e.name}"? This cannot be undone.`))
      return;
    try {
      await source.deletePath(e.path, true);
      load(path);
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  const onDeleteSelection = async () => {
    if (!source.deletePath || selected.size === 0) return;
    const names = Array.from(selected)
      .map((p) => p.split('/').pop())
      .slice(0, 5)
      .join(', ');
    const extra = selected.size > 5 ? ` and ${selected.size - 5} more` : '';
    if (!confirm(`Delete ${selected.size} item(s)?\n\n${names}${extra}\n\nThis cannot be undone.`))
      return;
    for (const p of selected) {
      try {
        await source.deletePath(p, true);
      } catch (err) {
        alert(`Delete failed for ${p}: ${err}`);
        break;
      }
    }
    load(path);
  };

  const onStartRename = (e: Entry) => {
    if (!source.rename) {
      alert('Rename not supported on this source yet.');
      return;
    }
    setRenamingPath(e.path);
  };

  const onCommitRename = async (e: Entry, next: string) => {
    setRenamingPath(null);
    if (!source.rename) return;
    if (!next || next === e.name) return;
    try {
      await source.rename(e.path, `${dirname(e.path)}/${next}`);
      load(path);
    } catch (err) {
      alert(`Rename failed: ${err}`);
    }
  };

  const onCancelRename = () => setRenamingPath(null);

  const onNewFolder = async () => {
    if (!source.mkdir) {
      alert('New folder not supported on this source yet.');
      return;
    }
    const name = prompt('New folder name:');
    if (!name) return;
    try {
      await source.mkdir(`${path}/${name}`);
      load(path);
    } catch (err) {
      alert(`Could not create folder: ${err}`);
    }
  };

  const onCopyPath = (e: Entry) => {
    navigator.clipboard?.writeText(e.path).catch(() => {});
  };

  const onDownload = async (e: Entry) => {
    if (source.kind !== 'sftp' || e.isDir) return;
    const picked = await saveDialog({
      defaultPath: e.name,
      title: `Download ${e.name}`,
    }).catch(() => null);
    if (typeof picked !== 'string' || !picked) return;
    startDownload(source.id, e.path, picked);
  };

  const onUpload = async () => {
    if (source.kind !== 'sftp') return;
    const picked = await openDialog({
      multiple: false,
      directory: false,
      title: 'Upload file',
    }).catch(() => null);
    if (typeof picked !== 'string' || !picked) return;
    const name = picked.split(/[\\/]/).pop() ?? 'upload';
    const remotePath = path.endsWith('/') ? `${path}${name}` : `${path}/${name}`;
    startUpload(source.id, picked, remotePath);
  };

  const menuItemsForEntry = (e: Entry): MenuItem[] => [
    { id: 'open', label: 'Open', onSelect: () => onOpen(e) },
    ...(source.kind === 'local' && !e.isDir
      ? [
          {
            id: 'open-with',
            label: 'Open with…',
            onSelect: () =>
              shellOpenWith(e.path).catch((err) =>
                alert(`Open with failed: ${err}`),
              ),
          } as MenuItem,
        ]
      : []),
    { id: 'sep1', type: 'separator' },
    {
      id: 'rename',
      label: 'Rename',
      shortcut: 'F2',
      disabled: !source.rename,
      onSelect: () => onStartRename(e),
    },
    { id: 'copy-path', label: 'Copy as path', onSelect: () => onCopyPath(e) },
    {
      id: 'reveal',
      label: 'Open file location',
      disabled: e.path === path,
      onSelect: () => navigate(dirname(e.path)),
    },
    ...(source.kind === 'sftp' && !e.isDir
      ? [
          {
            id: 'download',
            label: 'Download…',
            onSelect: () => onDownload(e),
          } as MenuItem,
        ]
      : []),
    { id: 'sep2', type: 'separator' },
    {
      id: 'delete',
      label: selected.size > 1 && selected.has(e.path)
        ? `Delete ${selected.size} items`
        : 'Delete',
      shortcut: 'Del',
      danger: true,
      disabled: !source.deletePath,
      onSelect: () =>
        selected.size > 1 && selected.has(e.path)
          ? onDeleteSelection()
          : onDelete(e),
    },
    { id: 'sep3', type: 'separator' },
    {
      id: 'props',
      label: 'Properties',
      onSelect: () => setPropertiesFor(e),
    },
  ];

  const menuItemsForEmpty = (): MenuItem[] => [
    {
      id: 'new-folder',
      label: 'New folder',
      disabled: !source.mkdir,
      onSelect: onNewFolder,
    },
    { id: 'sep1', type: 'separator' },
    { id: 'refresh', label: 'Refresh', shortcut: 'F5', onSelect: () => load(path, true) },
    ...(source.kind === 'sftp'
      ? [
          {
            id: 'upload',
            label: 'Upload file…',
            onSelect: onUpload,
          } as MenuItem,
        ]
      : []),
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
      onSelect: () =>
        setPropertiesFor({
          name: basename(path) || path,
          path,
          size: 0,
          mtime: 0,
          isDir: true,
        }),
    },
  ];

  const onContextMenu = (e: React.MouseEvent, target: Entry | null) => {
    e.preventDefault();
    e.stopPropagation();
    // If right-clicking on an unselected item, select just that one.
    if (target && !selected.has(target.path)) {
      setSelected(new Set([target.path]));
      setLastSelected(target.path);
    }
    ctx.open(e, target);
  };

  return (
    <ExplorerSourceContext.Provider value={source}>
    <div className="flex h-full flex-col bg-ld-body">
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
          onClick={() => load(path, true)}
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

        <ViewModeMenu mode={view} onChange={(m) => updateSetting('view', m)} />
        <button
          onClick={() => updateSetting('previewVisible', !previewVisible)}
          className={[
            'p-1.5 rounded-md transition-colors',
            previewVisible
              ? 'bg-ld-elevated text-ld-text'
              : 'text-ld-text-muted hover:bg-ld-elevated',
          ].join(' ')}
          title={previewVisible ? 'Hide preview pane' : 'Show preview pane'}
        >
          {previewVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </button>
      </header>

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
              onSelect={onSelect}
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
              renamingPath={renamingPath}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
            />
          ) : (
            <FileGrid
              entries={visible}
              mode={view}
              selected={selected}
              onSelect={onSelect}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
            />
          )}
        </div>

        {previewVisible && (
          <aside className="w-[320px] border-l border-ld-border bg-ld-card shrink-0">
            <PreviewPane entry={selectedEntry} source={source} />
          </aside>
        )}
      </div>

      <StatusBar
        count={visible.length}
        selectedCount={selected.size}
        totalSize={selectedEntry && !selectedEntry.isDir ? selectedEntry.size : undefined}
      />

      <input ref={fileInputRef} type="file" className="hidden" />

      {ctx.state && (
        <ContextMenu
          x={ctx.state.x}
          y={ctx.state.y}
          items={ctx.state.target ? menuItemsForEntry(ctx.state.target) : menuItemsForEmpty()}
          onClose={ctx.close}
        />
      )}

      {propertiesFor && (
        <PropertiesModal
          entry={propertiesFor}
          source={source}
          folderSizes={folderSizes}
          onClose={() => setPropertiesFor(null)}
        />
      )}
    </div>
    </ExplorerSourceContext.Provider>
  );
}
