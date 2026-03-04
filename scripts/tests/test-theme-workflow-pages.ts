import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const targets = [
  'src/app/(main)/profile/page.tsx',
  'src/app/teacher/classes/[classId]/page.tsx',
  'src/app/classroom/teacher/[sessionId]/review/page.tsx',
  'src/app/evaluation/prompt-assessment/page.tsx',
  'src/app/interactive-learning/multi-representation-linkage/page.tsx',
];

for (const file of targets) {
  const fullPath = path.join(root, file);
  const content = fs.readFileSync(fullPath, 'utf8');

  const hasThemeBase =
    content.includes('surface-page') || content.includes('bg-background') || content.includes('text-foreground');

  assert.equal(hasThemeBase, true, `${file} should use theme semantic base classes`);
}

console.log('theme workflow pages test passed');
