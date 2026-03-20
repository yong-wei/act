import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const globalsPath = path.join(root, 'src/app/globals.css');
const globals = fs.readFileSync(globalsPath, 'utf8');

function getLightThemeBlock() {
  const match = globals.match(/\.light \.premium-lesson-shell \{([\s\S]*?)\n  \}/);
  assert.notEqual(match, null, 'globals.css 应定义 .light .premium-lesson-shell 主题块');
  return match[1];
}

function tokenValue(block, tokenName) {
  const match = block.match(new RegExp(`${tokenName}:\\s*([^;]+);`));
  assert.notEqual(match, null, `浅色主题应定义 ${tokenName}`);
  return match[1].trim();
}

const block = getLightThemeBlock();

for (const tokenName of [
  '--premium-lesson-surface',
  '--premium-lesson-surface-soft',
  '--premium-lesson-surface-elevated',
  '--premium-lesson-surface-muted',
  '--premium-lesson-chip-bg',
  '--premium-lesson-input-bg',
]) {
  assert.notEqual(
    tokenValue(block, tokenName),
    '0 0% 100%',
    `浅色模式下 ${tokenName} 不应继续使用纯白填充`,
  );
}

assert.equal(
  globals.includes('.light .premium-lesson-panel {') &&
    globals.includes('.light .premium-lesson-panel-soft {'),
  true,
  'globals.css 应继续通过全局类统一管理精品课浅色模块样式',
);

console.log('premium lesson light theme test passed');
