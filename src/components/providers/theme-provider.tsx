'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { DEFAULT_THEME, isTheme, resolveInitialTheme, THEME_STORAGE_KEY, type ThemeMode } from '@/lib/theme-config';

type ThemeContextValue = {
  mounted: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
}: {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return resolveInitialTheme(storedTheme, systemPrefersDark, defaultTheme);
    }
    if (typeof document !== 'undefined') {
      if (document.documentElement.classList.contains('light')) {
        return 'light';
      }
      if (document.documentElement.classList.contains('dark')) {
        return 'dark';
      }
    }
    return defaultTheme;
  });
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [mounted, theme]);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    if (!isTheme(nextTheme)) {
      return;
    }
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({
      mounted,
      theme,
      setTheme,
      toggleTheme,
    }),
    [mounted, setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export function useOptionalTheme() {
  return useContext(ThemeContext);
}
