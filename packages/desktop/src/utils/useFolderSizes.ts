import { useEffect, useState } from 'react';
import type { Entry } from '@linkdrive/shared/types';
import { dirSize } from './fs';

// Lazy recursive size fetch for folder entries. Caches across re-renders by
// path. Caps concurrency so walking a home dir doesn't spawn hundreds of
// Tauri calls at once.

const CONCURRENCY = 4;

export function useFolderSizes(entries: Entry[]): Map<string, number> {
  const [sizes, setSizes] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const folders = entries.filter((e) => e.isDir && !sizes.has(e.path));
    if (folders.length === 0) return;
    const queue = [...folders];

    const worker = async () => {
      while (queue.length > 0 && !cancelled) {
        const e = queue.shift()!;
        try {
          const size = await dirSize(e.path);
          if (cancelled) return;
          setSizes((prev) => {
            if (prev.has(e.path)) return prev;
            const next = new Map(prev);
            next.set(e.path, size);
            return next;
          });
        } catch {
          // Permission errors etc — mark as 0 so we stop retrying.
          if (!cancelled) {
            setSizes((prev) => {
              if (prev.has(e.path)) return prev;
              const next = new Map(prev);
              next.set(e.path, -1);
              return next;
            });
          }
        }
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, worker);
    Promise.all(workers);

    return () => {
      cancelled = true;
    };
    // Intentionally ignore `sizes` — we only want a new pass when entries change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return sizes;
}
