import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInNewContext } from 'node:vm';
import path from 'node:path';

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  buildThemeInitScript,
  isTheme,
  resolveInitialTheme,
} from '../../src/lib/theme-config';

assert.equal(THEME_STORAGE_KEY, 'ai-obe-theme', 'storage key should stay stable');
assert.equal(DEFAULT_THEME, 'dark');

assert.equal(isTheme('light'), true);
assert.equal(isTheme('dark'), true);
assert.equal(isTheme('system'), false);

assert.equal(resolveInitialTheme('light', true), 'light');
assert.equal(resolveInitialTheme('dark', false), 'dark');
assert.equal(resolveInitialTheme(null, true), 'dark');
assert.equal(resolveInitialTheme(null, false), 'light');
assert.equal(resolveInitialTheme('system', false), 'light');
assert.equal(resolveInitialTheme(undefined, true), 'dark');

const layoutSource = readFileSync(path.resolve('src/app/layout.tsx'), 'utf8');
assert.ok(
  layoutSource.includes('<script id="theme-init">{buildThemeInitScript()}</script>'),
  'root layout must keep the audited theme-init script',
);
assert.equal(layoutSource.includes("from 'next/script'"), false);
assert.equal(layoutSource.includes('dangerouslySetInnerHTML'), false);
assert.equal(layoutSource.includes('className="dark"'), false);
assert.equal(/hidden|loading mask|opacity-0/.test(layoutSource), false);

const script = buildThemeInitScript('dark');
assert.ok(script.includes(THEME_STORAGE_KEY), 'script should contain storage key');
assert.ok(script.includes('root.classList.add(theme)'), 'script should apply theme class');
assert.ok(script.includes('root.style.colorScheme=theme'), 'script should apply color-scheme');
assert.equal(/<\/script/i.test(script), false, 'script must not break out of the script element');
assert.equal(script.includes('eval('), false);

function runThemeInit({
  storedTheme,
  systemPrefersDark,
}: {
  storedTheme: string | null;
  systemPrefersDark: boolean;
}) {
  const classList = new Set<string>();
  const root = {
    classList: {
      remove: (...tokens: string[]) => {
        for (const token of tokens) classList.delete(token);
      },
      add: (...tokens: string[]) => {
        for (const token of tokens) classList.add(token);
      },
    },
    style: { colorScheme: '' },
  };
  const sandbox = {
    document: {
      documentElement: root,
    },
    window: {
      matchMedia: (query: string) => ({
        matches: query.includes('prefers-color-scheme: dark') ? systemPrefersDark : !systemPrefersDark,
      }),
    },
    localStorage: {
      getItem: () => storedTheme,
    },
  };
  runInNewContext(script, createContext(sandbox));
  return {
    classes: [...classList],
    colorScheme: root.style.colorScheme,
  };
}

assert.deepEqual(runThemeInit({ storedTheme: 'light', systemPrefersDark: true }), {
  classes: ['light'],
  colorScheme: 'light',
});
assert.deepEqual(runThemeInit({ storedTheme: 'dark', systemPrefersDark: false }), {
  classes: ['dark'],
  colorScheme: 'dark',
});
assert.deepEqual(runThemeInit({ storedTheme: null, systemPrefersDark: false }), {
  classes: ['light'],
  colorScheme: 'light',
});
assert.deepEqual(runThemeInit({ storedTheme: 'system', systemPrefersDark: true }), {
  classes: ['dark'],
  colorScheme: 'dark',
});

console.log('theme toggle test passed');
