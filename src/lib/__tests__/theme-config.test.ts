import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  buildThemeInitScript,
  isTheme,
  resolveInitialTheme,
  type ThemeMode,
} from '@/lib/theme-config';

function runThemeInitScript(options: {
  storedTheme: string | null;
  prefersDark?: boolean;
  matchMedia?: boolean;
  defaultTheme?: ThemeMode;
  initialClass?: string;
}) {
  const classList = new Set(
    (options.initialClass ?? 'dark').split(/\s+/u).filter(Boolean),
  );
  const root = {
    classList: {
      remove: (...names: string[]) => {
        for (const name of names) classList.delete(name);
      },
      add: (name: string) => {
        classList.add(name);
      },
    },
    style: { colorScheme: '' },
  };

  const windowHost: { matchMedia?: () => { matches: boolean } } = {};
  if (options.matchMedia !== false) {
    windowHost.matchMedia = () => ({ matches: Boolean(options.prefersDark) });
  }

  vm.runInNewContext(buildThemeInitScript(options.defaultTheme), {
    document: { documentElement: root },
    localStorage: {
      getItem: (key: string) => (key === THEME_STORAGE_KEY ? options.storedTheme : null),
    },
    window: windowHost,
  });

  return {
    classes: [...classList],
    colorScheme: root.style.colorScheme,
  };
}

describe('theme-config', () => {
  it('keeps the persisted storage key stable', () => {
    expect(THEME_STORAGE_KEY).toBe('ai-obe-theme');
    expect(DEFAULT_THEME).toBe('dark');
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(false);
  });

  it('prefers stored theme over system preference', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
    expect(resolveInitialTheme('dark', false)).toBe('dark');
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
    expect(resolveInitialTheme(null, undefined)).toBe('dark');
  });

  it('applies stored light over a dark SSR root before hydration', () => {
    const result = runThemeInitScript({
      storedTheme: 'light',
      prefersDark: true,
      initialClass: 'dark',
    });

    expect(result.classes).toEqual(['light']);
    expect(result.colorScheme).toBe('light');
  });

  it('keeps stored dark and falls back to system preference when unset', () => {
    expect(runThemeInitScript({
      storedTheme: 'dark',
      prefersDark: false,
      initialClass: 'dark',
    })).toEqual({ classes: ['dark'], colorScheme: 'dark' });

    expect(runThemeInitScript({
      storedTheme: null,
      prefersDark: false,
      initialClass: 'dark',
    })).toEqual({ classes: ['light'], colorScheme: 'light' });
  });

  it('falls back to default dark when matchMedia is missing and storage is empty', () => {
    expect(runThemeInitScript({
      storedTheme: null,
      matchMedia: false,
      initialClass: '',
    })).toEqual({ classes: ['dark'], colorScheme: 'dark' });

    expect(runThemeInitScript({
      storedTheme: 'light',
      matchMedia: false,
      initialClass: 'dark',
    })).toEqual({ classes: ['light'], colorScheme: 'light' });
  });

  it('does not emit a script closer that could break the layout payload', () => {
    expect(buildThemeInitScript('dark')).not.toMatch(/<\/script/i);
    expect(buildThemeInitScript('light')).not.toMatch(/<\/script/i);
  });

  it('keeps sign-out as a full document load of the login route', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/shared/sign-out-button.tsx'),
      'utf8',
    );
    expect(source).toContain("signOut({ callbackUrl: '/login' })");
  });
});
