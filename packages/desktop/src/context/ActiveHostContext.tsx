import { createContext, useContext, useState, type ReactNode } from 'react';

type Ctx = {
  activeHostId: string | null;
  setActiveHostId: (id: string | null) => void;
};

const ActiveHostCtx = createContext<Ctx>({
  activeHostId: null,
  setActiveHostId: () => {},
});

export function ActiveHostProvider({ children }: { children: ReactNode }) {
  const [activeHostId, setActiveHostId] = useState<string | null>(null);
  return (
    <ActiveHostCtx.Provider value={{ activeHostId, setActiveHostId }}>
      {children}
    </ActiveHostCtx.Provider>
  );
}

export function useActiveHost() {
  return useContext(ActiveHostCtx);
}
