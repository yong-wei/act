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

export function buildThemeInitScript(defaultTheme: ThemeMode = DEFAULT_THEME): string {
  const fallbackTheme = isTheme(defaultTheme) ? defaultTheme : DEFAULT_THEME;
  return `(function(){try{var key='${THEME_STORAGE_KEY}';var root=document.documentElement;var stored=localStorage.getItem(key);var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var fallback=prefersDark?'dark':'light';var theme=stored==='light'||stored==='dark'?stored:(fallback||'${fallbackTheme}');root.classList.remove('light','dark');root.classList.add(theme);root.style.colorScheme=theme;}catch(_e){document.documentElement.classList.remove('light','dark');document.documentElement.classList.add('${fallbackTheme}');document.documentElement.style.colorScheme='${fallbackTheme}';}})();`;
}
