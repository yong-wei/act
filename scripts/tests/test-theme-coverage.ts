import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = [
  'src/app/page.tsx',
  'src/app/virtual-lab/page.tsx',
  'src/app/simulations/page.tsx',
  'src/app/interactive-learning/page.tsx',
  'src/app/review/page.tsx',
  'src/app/review/extracurricular-showcase/page.tsx',
];

const hardcodedDarkTokens = [
  'bg-slate-950',
  'bg-[#0b1024]',
  'bg-[#0b132b]',
];

for (const file of targets) {
  const fullPath = path.join(root, file);
  const content = fs.readFileSync(fullPath, 'utf8');

  const hasThemeBase =
    content.includes('surface-page') || content.includes('bg-background') || content.includes('text-foreground');
  assert.equal(hasThemeBase, true, `${file} should use theme semantic base classes`);

  for (const token of hardcodedDarkTokens) {
    assert.equal(content.includes(token), false, `${file} should not contain hardcoded token: ${token}`);
  }
}

console.log('theme coverage test passed');
