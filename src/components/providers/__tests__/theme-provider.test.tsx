// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from '@/components/providers/theme-provider';
import { THEME_STORAGE_KEY } from '@/lib/theme-config';

function Probe({ onTheme }: { onTheme: (theme: string, mounted: boolean) => void }) {
  const { theme, mounted } = useTheme();
  useEffect(() => {
    onTheme(theme, mounted);
  }, [mounted, onTheme, theme]);
  return null;
}

describe('ThemeProvider storage alignment', () => {
  let container: HTMLDivElement;
  let root: Root;
  let stored = new Map<string, string>();

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => stored.clear(),
      getItem: (key: string) => stored.get(key) ?? null,
      key: (index: number) => [...stored.keys()][index] ?? null,
      get length() {
        return stored.size;
      },
      removeItem: (key: string) => stored.delete(key),
      setItem: (key: string, value: string) => {
        stored.set(key, String(value));
      },
    });
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    })) as typeof window.matchMedia;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    document.documentElement.className = 'dark';
    document.documentElement.style.colorScheme = 'dark';
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('does not persist the SSR default dark over a stored light theme', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const writes: Array<string | null> = [];
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = (key: string, value: string) => {
      if (key === THEME_STORAGE_KEY) {
        writes.push(value);
      }
      originalSetItem(key, value);
    };

    act(() => {
      root.render(createElement(ThemeProvider, null, createElement(Probe, {
        onTheme() {},
      })));
    });

    expect([...document.documentElement.classList].filter((name) => name === 'light' || name === 'dark')).toEqual(['light']);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(writes).toEqual(['light']);
  });
});
