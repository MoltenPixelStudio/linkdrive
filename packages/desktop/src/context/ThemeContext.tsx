import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemeName } from '@linkdrive/shared/theme';

type Ctx = { theme: ThemeName; toggle: () => void };
const ThemeCtx = createContext<Ctx>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>('dark');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <ThemeCtx.Provider
      value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
