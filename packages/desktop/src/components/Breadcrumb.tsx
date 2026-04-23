import { ChevronRight, Home } from 'lucide-react';
import { useMemo } from 'react';

export function Breadcrumb({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (next: string) => void;
}) {
  const segments = useMemo(() => {
    const parts = path.split('/').filter(Boolean);
    const out: { label: string; path: string }[] = [];
    let acc = '';
    for (const p of parts) {
      acc = `${acc}/${p}`;
      out.push({ label: p, path: acc });
    }
    return out;
  }, [path]);

  return (
    <nav className="flex items-center gap-1 text-xs text-ld-text-muted overflow-x-auto no-scrollbar">
      <button
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-ld-elevated hover:text-ld-text transition-colors"
      >
        <Home size={12} />
      </button>
      {segments.map((s, i) => (
        <span key={s.path} className="inline-flex items-center gap-1">
          <ChevronRight size={12} className="text-ld-text-dim" />
          <button
            onClick={() => onNavigate(s.path)}
            className={[
              'px-2 py-1 rounded hover:bg-ld-elevated hover:text-ld-text transition-colors',
              i === segments.length - 1 ? 'text-ld-text font-medium' : '',
            ].join(' ')}
          >
            {s.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
