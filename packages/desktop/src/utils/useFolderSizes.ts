import { useEffect, useState } from 'react';
import type { Entry } from '@linkdrive/shared/types';
import { dirSize } from './fs';

// Module-level cache — survives re-renders and navigation. Key: absolute path.
// Value: size in bytes, -1 for error.
const CACHE = new Map<string, number>();
const PENDING = new Map<string, Promise<number>>();

const CONCURRENCY = 4;

// Exposed so callers can bust cache on Refresh.
export function clearFolderSizeCache(): void {
  CACHE.clear();
  PENDING.clear();
}

export function useFolderSizes(entries: Entry[], enabled: boolean): Map<string, number> {
  // Start with snapshot of cache so unchanged entries don't re-trigger work.
  const [sizes, setSizes] = useState<Map<string, number>>(() => new Map(CACHE));

  useEffect(() => {
    if (!enabled) return;
    const folders = entries.filter((e) => e.isDir && !CACHE.has(e.path));
    if (folders.length === 0) {
      // New snapshot in case cache changed via other triggers.
      setSizes(new Map(CACHE));
      return;
    }
    let cancelled = false;
    const queue = [...folders];

    const worker = async () => {
      while (queue.length > 0 && !cancelled) {
        const e = queue.shift()!;
        let p = PENDING.get(e.path);
        if (!p) {
          p = dirSize(e.path).catch(() => -1);
          PENDING.set(e.path, p);
        }
        const size = await p;
        PENDING.delete(e.path);
        if (cancelled) return;
        CACHE.set(e.path, size);
        setSizes(new Map(CACHE));
      }
    };

    Promise.all(Array.from({ length: CONCURRENCY }, worker));

    return () => {
      cancelled = true;
    };
  }, [entries, enabled]);

  return sizes;
}
