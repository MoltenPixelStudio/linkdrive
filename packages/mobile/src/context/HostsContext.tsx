import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Host } from '@linkdrive/shared/types';

const HOSTS_KEY = 'linkdrive.hosts';

type Ctx = {
  hosts: Host[];
  add: (h: Host) => void;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<Host>) => void;
};

const HostsCtx = createContext<Ctx>({
  hosts: [],
  add: () => {},
  remove: () => {},
  update: () => {},
});

export function HostsProvider({ children }: { children: ReactNode }) {
  const [hosts, setHosts] = useState<Host[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(HOSTS_KEY).then((raw) => {
      if (!raw) return;
      try {
        setHosts(JSON.parse(raw));
      } catch {}
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(HOSTS_KEY, JSON.stringify(hosts)).catch(() => {});
  }, [hosts]);

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
