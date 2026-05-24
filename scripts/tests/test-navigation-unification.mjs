import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const unifiedTopBarPath = path.join(root, 'src/components/shared/unified-top-bar.tsx');
assert.equal(
  fs.existsSync(unifiedTopBarPath),
  true,
  '应新增统一顶部导航组件以执行 nevplan',
);

const targets = [
  'src/app/knowledge/page.tsx',
  'src/app/review/page.tsx',
  'src/app/interactive-learning/page.tsx',
  'src/app/interactive-learning/courses/page.tsx',
  'src/app/interactive-learning/cross-domain-exploration/page.tsx',
  'src/app/interactive-learning/chapter-components/page.tsx',
];

for (const relativePath of targets) {
  const content = read(relativePath);
  assert.equal(
    content.includes('UnifiedTopBar'),
    true,
    `${relativePath} 应接入统一顶部导航`,
  );
}

const aiThemeStyles = read('src/lib/ai-theme-styles.ts');
assert.equal(
  aiThemeStyles.includes('bottom-16') || aiThemeStyles.includes('bottom-20'),
  true,
  '控灵浮动按钮位置应下调，避免与主题切换按钮重叠',
);

for (const relativePath of [
  'src/app/simulations/destroyer/page.tsx',
  'src/app/simulations/cruise/page.tsx',
  'src/app/simulations/container/page.tsx',
  'src/app/simulations/lng/page.tsx',
  'src/app/simulations/icebreaker/page.tsx',
  'src/app/simulations/drilling/page.tsx',
  'src/app/simulations/dredger/page.tsx',
]) {
  const content = read(relativePath);
  assert.equal(
    content.includes('返回仿真入口'),
    true,
    `${relativePath} 的悬浮返回文案应为“返回仿真入口”`,
  );
}

console.log('navigation unification test passed');
