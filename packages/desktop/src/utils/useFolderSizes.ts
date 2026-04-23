import { useEffect, useState } from 'react';
import type { Entry } from '@linkdrive/shared/types';

// Module-level cache keyed by `${sourceId}:${path}`. Value: size in bytes,
// -1 for error. Survives re-renders and navigation across sources.
const CACHE = new Map<string, number>();
const PENDING = new Map<string, Promise<number>>();

const CONCURRENCY = 4;

export function clearFolderSizeCache(sourceId?: string): void {
  if (!sourceId) {
    CACHE.clear();
    PENDING.clear();
    return;
  }
  const prefix = `${sourceId}:`;
  for (const k of Array.from(CACHE.keys())) if (k.startsWith(prefix)) CACHE.delete(k);
  for (const k of Array.from(PENDING.keys())) if (k.startsWith(prefix)) PENDING.delete(k);
}

function snapshotFor(sourceId: string): Map<string, number> {
  const out = new Map<string, number>();
  const prefix = `${sourceId}:`;
  for (const [k, v] of CACHE) {
    if (k.startsWith(prefix)) out.set(k.slice(prefix.length), v);
  }
  return out;
}

export function useFolderSizes(
  entries: Entry[],
  enabled: boolean,
  sourceId: string,
  dirSize?: (path: string) => Promise<number>,
): Map<string, number> {
  const [sizes, setSizes] = useState<Map<string, number>>(() => snapshotFor(sourceId));

  useEffect(() => {
    if (!enabled || !dirSize) {
      setSizes(snapshotFor(sourceId));
      return;
    }
    const folders = entries.filter(
      (e) => e.isDir && !CACHE.has(`${sourceId}:${e.path}`),
    );
    if (folders.length === 0) {
      setSizes(snapshotFor(sourceId));
      return;
    }
    let cancelled = false;
    const queue = [...folders];

    const worker = async () => {
      while (queue.length > 0 && !cancelled) {
        const e = queue.shift()!;
        const key = `${sourceId}:${e.path}`;
        let p = PENDING.get(key);
        if (!p) {
          p = dirSize(e.path).catch(() => -1);
          PENDING.set(key, p);
        }
        const size = await p;
        PENDING.delete(key);
        if (cancelled) return;
        CACHE.set(key, size);
        setSizes(snapshotFor(sourceId));
      }
    };

    Promise.all(Array.from({ length: CONCURRENCY }, worker));

    return () => {
      cancelled = true;
    };
  }, [entries, enabled, sourceId, dirSize]);

  return sizes;
}
