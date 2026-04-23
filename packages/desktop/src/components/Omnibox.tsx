import { Search, ChevronRight, Home, CornerDownLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

// Smart input: if value starts with / or ~, treated as a path. Otherwise,
// treated as a search against the current folder. Enter = navigate or commit.

export function Omnibox({
  currentPath,
  query,
  onQueryChange,
  onNavigate,
  recursive,
  onToggleRecursive,
}: {
  currentPath: string;
  query: string;
  onQueryChange: (q: string) => void;
  onNavigate: (path: string) => void;
  recursive: boolean;
  onToggleRecursive: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(currentPath);

  useEffect(() => {
    if (!focused) setDraft(currentPath);
  }, [currentPath, focused]);

  const isPathInput = useMemo(() => {
    const v = draft.trim();
    return v.startsWith('/') || v.startsWith('~') || v.includes('/');
  }, [draft]);

  const segments = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const out: { label: string; path: string }[] = [];
    let acc = '';
    for (const p of parts) {
      acc += `/${p}`;
      out.push({ label: p, path: acc });
    }
    return out;
  }, [currentPath]);

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (isPathInput) {
      const resolved = v.startsWith('~') ? v.replace(/^~/, '') : v;
      onNavigate(resolved || '/');
      onQueryChange('');
    }
  };

  // When user types non-path text, treat as search query on the current folder.
  const onChange = (v: string) => {
    setDraft(v);
    if (v.startsWith('/') || v.startsWith('~') || v.includes('/')) {
      onQueryChange('');
    } else {
      onQueryChange(v);
    }
  };

  return (
    <div
      className={[
        'flex items-center gap-1 h-9 px-2 rounded-md border transition-colors',
        focused
          ? 'border-brand-red/60 bg-ld-card'
          : 'border-ld-border bg-ld-card hover:border-ld-border-subtle',
      ].join(' ')}
    >
      {isPathInput || focused ? (
        <Search size={13} className="text-ld-text-dim shrink-0" />
      ) : (
        <Search size={13} className="text-ld-text-dim shrink-0" />
      )}

      {!focused ? (
        // Breadcrumb display when not focused — click to edit, or click a segment to jump
        <button
          onClick={() => {
            setFocused(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="flex-1 flex items-center gap-0.5 text-xs min-w-0 overflow-hidden"
        >
          <Home size={12} className="text-ld-text-dim shrink-0 mr-1" />
          {segments.map((s, i) => (
            <span key={s.path} className="inline-flex items-center gap-0.5 shrink-0">
              <ChevronRight size={11} className="text-ld-text-dim" />
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(s.path);
                }}
                className={[
                  'px-1 py-0.5 rounded hover:bg-ld-elevated transition-colors',
                  i === segments.length - 1 ? 'text-ld-text font-medium' : 'text-ld-text-muted',
                ].join(' ')}
              >
                {s.label}
              </span>
            </span>
          ))}
          {query && (
            <span className="ml-auto px-2 py-0.5 text-[10px] rounded-full bg-brand-red/15 text-brand-red font-medium shrink-0">
              search: {query}
            </span>
          )}
        </button>
      ) : (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              inputRef.current?.blur();
            }
            if (e.key === 'Escape') {
              setDraft(currentPath);
              onQueryChange('');
              inputRef.current?.blur();
            }
          }}
          placeholder="Type a path (/home/…) or search this folder"
          className="flex-1 bg-transparent outline-none text-xs text-ld-text placeholder:text-ld-text-dim min-w-0"
        />
      )}

      {focused && isPathInput && (
        <span className="inline-flex items-center gap-1 text-[10px] text-ld-text-dim mr-1">
          <CornerDownLeft size={11} /> go
        </span>
      )}

      <button
        onClick={onToggleRecursive}
        className={[
          'text-[10px] px-2 py-0.5 rounded-md transition-colors',
          recursive
            ? 'bg-brand-red/15 text-brand-red'
            : 'text-ld-text-muted hover:bg-ld-elevated',
        ].join(' ')}
        title="Search recursively in subfolders"
      >
        recursive
      </button>
    </div>
  );
}
