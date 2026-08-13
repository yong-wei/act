export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ai-obe-theme';
export const DEFAULT_THEME: ThemeMode = 'dark';

export function isTheme(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function resolveInitialTheme(
  storedTheme: string | null | undefined,
  systemPrefersDark: boolean,
  defaultTheme: ThemeMode = DEFAULT_THEME,
): ThemeMode {
  if (isTheme(storedTheme)) {
    return storedTheme;
  }

  if (typeof systemPrefersDark === 'boolean') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return defaultTheme;
}
