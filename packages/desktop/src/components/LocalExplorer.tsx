import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Breadcrumb } from './Breadcrumb';
import { Toolbar, type SortKey, type ViewMode } from './Toolbar';
import { FileList } from './FileList';
import { PreviewPane } from './PreviewPane';
import { ls, homeDir } from '../utils/fs';
import { extname } from '@linkdrive/shared/paths';
import type { Entry } from '@linkdrive/shared/types';

function sortEntries(list: Entry[], key: SortKey, dir: 'asc' | 'desc'): Entry[] {
  const mul = dir === 'asc' ? 1 : -1;
  const dirsFirst = [...list].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    switch (key) {
      case 'size':
        return (a.size - b.size) * mul;
      case 'mtime':
        return (a.mtime - b.mtime) * mul;
      case 'type':
        return extname(a.path).localeCompare(extname(b.path)) * mul || a.name.localeCompare(b.name);
      case 'name':
      default:
        return a.name.localeCompare(b.name) * mul;
    }
  });
  return dirsFirst;
}

export function LocalExplorer() {
  const [path, setPath] = useState<string>('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [view, setView] = useState<ViewMode>('list');
  const [query, setQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);

  useEffect(() => {
    homeDir().then((h) => setPath(h)).catch(() => setPath('/'));
  }, []);

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
    return sortEntries(filtered, sortKey, sortDir);
  }, [entries, query, showHidden, sortKey, sortDir]);

  const selectedEntry = useMemo(
    () => visible.find((e) => e.path === selected) ?? null,
    [visible, selected],
  );

  const onOpen = (e: Entry) => {
    if (e.isDir) navigate(e.path);
  };

  return (
    <div className="flex h-full flex-col bg-ld-body">
      <header className="flex items-center gap-2 border-b border-ld-border px-3 h-12">
        <button
          onClick={goBack}
          disabled={history.length === 0}
          className="p-1.5 rounded-md text-ld-text-muted hover:bg-ld-elevated disabled:opacity-30 disabled:hover:bg-transparent"
          title="Back"
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
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
        <div className="flex-1 min-w-0 ml-2">
          <Breadcrumb path={path} onNavigate={navigate} />
        </div>
      </header>

      <Toolbar
        sortKey={sortKey}
        sortDir={sortDir}
        onSortKey={setSortKey}
        onSortDir={setSortDir}
        view={view}
        onView={setView}
        query={query}
        onQuery={setQuery}
        showHidden={showHidden}
        onToggleHidden={() => setShowHidden((v) => !v)}
      />

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {err ? (
            <div className="p-6 text-xs text-ld-text-muted">
              <span className="text-brand-red">Error:</span> {err}
            </div>
          ) : (
            <FileList
              entries={visible}
              view={view}
              selected={selected}
              onSelect={setSelected}
              onOpen={onOpen}
            />
          )}
        </div>
        <aside className="w-[320px] border-l border-ld-border bg-ld-card">
          <PreviewPane entry={selectedEntry} />
        </aside>
      </div>
    </div>
  );
}
