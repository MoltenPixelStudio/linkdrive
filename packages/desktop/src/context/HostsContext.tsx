import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Host } from '@linkdrive/shared/types';

type Ctx = {
  hosts: Host[];
  add: (h: Host) => void;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<Host>) => void;
};

const HostsCtx = createContext<Ctx>({ hosts: [], add: () => {}, remove: () => {}, update: () => {} });

export function HostsProvider({ children }: { children: ReactNode }) {
  const [hosts, setHosts] = useState<Host[]>([]);
  // TODO Phase 3: load/save via Tauri store plugin + OS keychain for creds.

  return (
    <HostsCtx.Provider
      value={{
        hosts,
        add: (h) => setHosts((prev) => [...prev, h]),
        remove: (id) => setHosts((prev) => prev.filter((h) => h.id !== id)),
        update: (id, patch) =>
          setHosts((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h))),
      }}
    >
      {children}
    </HostsCtx.Provider>
  );
}

export function useHosts() {
  return useContext(HostsCtx);
}
