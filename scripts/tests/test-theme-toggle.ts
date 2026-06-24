import assert from 'node:assert/strict';
import {
  THEME_STORAGE_KEY,
  buildThemeInitScript,
  isTheme,
  resolveInitialTheme,
} from '../../src/lib/theme-config';

assert.equal(THEME_STORAGE_KEY, 'ai-obe-theme', 'storage key should stay stable');

assert.equal(isTheme('light'), true);
assert.equal(isTheme('dark'), true);
assert.equal(isTheme('system'), false);

assert.equal(resolveInitialTheme('light', true), 'light');
assert.equal(resolveInitialTheme('dark', false), 'dark');
assert.equal(resolveInitialTheme(null, true), 'dark');
assert.equal(resolveInitialTheme(null, false), 'light');

const script = buildThemeInitScript('dark');
assert.ok(script.includes(THEME_STORAGE_KEY), 'script should contain storage key');
assert.ok(script.includes("root.classList.add(theme)"), 'script should apply theme class');

console.log('theme toggle test passed');
