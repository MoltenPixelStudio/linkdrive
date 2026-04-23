import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK, LIGHT, type ColorPalette, type ThemeName } from '@linkdrive/shared/theme';

type Ctx = {
  theme: ThemeName;
  colors: ColorPalette;
  toggleTheme: () => void;
  transitioning: boolean;
};

const ThemeCtx = createContext<Ctx>({
  theme: 'dark',
  colors: DARK,
  toggleTheme: () => {},
  transitioning: false,
});

type RGBA = { r: number; g: number; b: number; a: number };

function parseColor(color: string): RGBA {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    return {
      r: parseInt(m[1]),
      g: parseInt(m[2]),
      b: parseInt(m[3]),
      a: m[4] !== undefined ? parseFloat(m[4]) : 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function lerpColor(from: string, to: string, t: number): string {
  const f = parseColor(from);
  const c = parseColor(to);
  const r = Math.round(f.r + (c.r - f.r) * t);
  const g = Math.round(f.g + (c.g - f.g) * t);
  const b = Math.round(f.b + (c.b - f.b) * t);
  const a = f.a + (c.a - f.a) * t;
  if (a < 1) return `rgba(${r},${g},${b},${a.toFixed(2)})`;
  return `rgb(${r},${g},${b})`;
}

const SETTINGS_KEY = 'linkdrive.settings';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>('dark');
  const [transitioning, setTransitioning] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const [interp, setInterp] = useState<ColorPalette>(DARK);

  const colors = theme === 'dark' ? DARK : LIGHT;

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (s.theme === 'light' || s.theme === 'dark') {
          setTheme(s.theme);
          setInterp(s.theme === 'dark' ? DARK : LIGHT);
        }
      } catch {}
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeName = prev === 'dark' ? 'light' : 'dark';
      const from = prev === 'dark' ? DARK : LIGHT;
      const to = next === 'dark' ? DARK : LIGHT;

      progress.setValue(0);
      setTransitioning(true);
      const id = progress.addListener(({ value }) => {
        const out = {} as Record<string, string>;
        for (const k of Object.keys(from) as (keyof ColorPalette)[]) {
          out[k] = lerpColor(from[k], to[k], value);
        }
        setInterp(out as unknown as ColorPalette);
      });
      Animated.timing(progress, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        progress.removeListener(id);
        setInterp(to);
        setTransitioning(false);
      });

      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: next })).catch(() => {});
      return next;
    });
  }, [progress]);

  return (
    <ThemeCtx.Provider
      value={{
        theme,
        colors: transitioning ? interp : colors,
        toggleTheme,
        transitioning,
      }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
