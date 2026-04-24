import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type TransferState = 'running' | 'completed' | 'failed';

export type TransferDirection = 'download' | 'upload';

export type Transfer = {
  id: string;
  hostId: string;
  direction: TransferDirection;
  src: string;
  dst: string;
  bytes: number;
  total: number;
  state: TransferState;
  error?: string;
  startedAt: number;
  finishedAt?: number;
  lastTick?: { at: number; bytes: number };
  speedBps?: number;
};

type Ctx = {
  transfers: Transfer[];
  startDownload: (hostId: string, remotePath: string, localPath: string) => string;
  startUpload: (hostId: string, localPath: string, remotePath: string) => string;
  startDownloadDir: (hostId: string, remotePath: string, localPath: string) => string;
  startUploadDir: (hostId: string, localPath: string, remotePath: string) => string;
  waitForTransfer: (id: string) => Promise<Transfer>;
  cancel: (id: string) => void;
  clearCompleted: () => void;
};

const TransfersCtx = createContext<Ctx>({
  transfers: [],
  startDownload: () => '',
  startUpload: () => '',
  startDownloadDir: () => '',
  startUploadDir: () => '',
  waitForTransfer: async () => ({}) as Transfer,
  cancel: () => {},
  clearCompleted: () => {},
});

type ProgressEvent = {
  id: string;
  bytes: number;
  total: number;
  state: TransferState;
  error: string | null;
};

export function TransfersProvider({ children }: { children: ReactNode }) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const byId = useRef(new Map<string, Transfer>());
  const waiters = useRef(
    new Map<string, { resolve: (t: Transfer) => void; reject: (e: Error) => void }>(),
  );

  useEffect(() => {
    let unlisten: undefined | (() => void);
    (async () => {
      unlisten = await listen<ProgressEvent>('transfer:progress', (ev) => {
        const { id, bytes, total, state, error } = ev.payload;
        const existing = byId.current.get(id);
        if (!existing) return;
        const now = Date.now();
        const last = existing.lastTick ?? { at: existing.startedAt, bytes: 0 };
        const dt = Math.max(now - last.at, 1) / 1000;
        const db = Math.max(bytes - last.bytes, 0);
        const speed = dt > 0.15 ? db / dt : existing.speedBps;
        const updated: Transfer = {
          ...existing,
          bytes,
          total,
          state,
          error: error ?? undefined,
          finishedAt: state === 'completed' || state === 'failed' ? now : undefined,
          lastTick: dt > 0.15 ? { at: now, bytes } : existing.lastTick,
          speedBps: speed,
        };
        byId.current.set(id, updated);
        setTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));

        if (state === 'completed' || state === 'failed') {
          const w = waiters.current.get(id);
          if (w) {
            waiters.current.delete(id);
            if (state === 'completed') w.resolve(updated);
            else w.reject(new Error(updated.error ?? 'failed'));
          }
        }
      });
    })();
    return () => unlisten?.();
  }, []);

  const waitForTransfer = (id: string): Promise<Transfer> =>
    new Promise((resolve, reject) => {
      const cur = byId.current.get(id);
      if (!cur) return reject(new Error('unknown transfer'));
      if (cur.state === 'completed') return resolve(cur);
      if (cur.state === 'failed') return reject(new Error(cur.error ?? 'failed'));
      waiters.current.set(id, { resolve, reject });
    });

  const startDownload = (hostId: string, remotePath: string, localPath: string): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t: Transfer = {
      id,
      hostId,
      direction: 'download',
      src: remotePath,
      dst: localPath,
      bytes: 0,
      total: 0,
      state: 'running',
      startedAt: Date.now(),
    };
    byId.current.set(id, t);
    setTransfers((prev) => [t, ...prev]);
    invoke('ssh_download_file', {
      transferId: id,
      hostId,
      remotePath,
      localPath,
    }).catch((e) => {
      const existing = byId.current.get(id);
      if (!existing) return;
      const updated: Transfer = {
        ...existing,
        state: 'failed',
        error: typeof e === 'string' ? e : (e as Error)?.message ?? 'failed',
        finishedAt: Date.now(),
      };
      byId.current.set(id, updated);
      setTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));
    });
    return id;
  };

  const startUpload = (hostId: string, localPath: string, remotePath: string): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t: Transfer = {
      id,
      hostId,
      direction: 'upload',
      src: localPath,
      dst: remotePath,
      bytes: 0,
      total: 0,
      state: 'running',
      startedAt: Date.now(),
    };
    byId.current.set(id, t);
    setTransfers((prev) => [t, ...prev]);
    invoke('ssh_upload_file', {
      transferId: id,
      hostId,
      localPath,
      remotePath,
    }).catch((e) => {
      const existing = byId.current.get(id);
      if (!existing) return;
      const updated: Transfer = {
        ...existing,
        state: 'failed',
        error: typeof e === 'string' ? e : (e as Error)?.message ?? 'failed',
        finishedAt: Date.now(),
      };
      byId.current.set(id, updated);
      setTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));
    });
    return id;
  };

  const startDownloadDir = (
    hostId: string,
    remotePath: string,
    localPath: string,
  ): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t: Transfer = {
      id,
      hostId,
      direction: 'download',
      src: remotePath,
      dst: localPath,
      bytes: 0,
      total: 0,
      state: 'running',
      startedAt: Date.now(),
    };
    byId.current.set(id, t);
    setTransfers((prev) => [t, ...prev]);
    invoke('ssh_download_dir', {
      transferId: id,
      hostId,
      remotePath,
      localPath,
    }).catch((e) => {
      const existing = byId.current.get(id);
      if (!existing) return;
      const updated: Transfer = {
        ...existing,
        state: 'failed',
        error: typeof e === 'string' ? e : (e as Error)?.message ?? 'failed',
        finishedAt: Date.now(),
      };
      byId.current.set(id, updated);
      setTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));
    });
    return id;
  };

  const startUploadDir = (
    hostId: string,
    localPath: string,
    remotePath: string,
  ): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const t: Transfer = {
      id,
      hostId,
      direction: 'upload',
      src: localPath,
      dst: remotePath,
      bytes: 0,
      total: 0,
      state: 'running',
      startedAt: Date.now(),
    };
    byId.current.set(id, t);
    setTransfers((prev) => [t, ...prev]);
    invoke('ssh_upload_dir', {
      transferId: id,
      hostId,
      localPath,
      remotePath,
    }).catch((e) => {
      const existing = byId.current.get(id);
      if (!existing) return;
      const updated: Transfer = {
        ...existing,
        state: 'failed',
        error: typeof e === 'string' ? e : (e as Error)?.message ?? 'failed',
        finishedAt: Date.now(),
      };
      byId.current.set(id, updated);
      setTransfers((prev) => prev.map((t) => (t.id === id ? updated : t)));
    });
    return id;
  };

  const cancel = (id: string) => {
    invoke('ssh_cancel_transfer', { transferId: id }).catch(() => {});
  };

  const clearCompleted = () => {
    for (const [id, t] of byId.current) {
      if (t.state !== 'running') byId.current.delete(id);
    }
    setTransfers((prev) => prev.filter((t) => t.state === 'running'));
  };

  return (
    <TransfersCtx.Provider
      value={{
        transfers,
        startDownload,
        startUpload,
        startDownloadDir,
        startUploadDir,
        waitForTransfer,
        cancel,
        clearCompleted,
      }}
    >
      {children}
    </TransfersCtx.Provider>
  );
}

export function useTransfers() {
  return useContext(TransfersCtx);
}
