import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/features/interactive/l2b-root-locus/entry-page.tsx',
  'src/features/interactive/l2b-root-locus/entry-runtime-sections.tsx',
  'src/features/interactive/l2b-root-locus/step-panels.tsx',
  'src/features/interactive/l2b-root-locus/workspace.tsx',
  'src/features/interactive/l2b-root-locus/student-page.tsx',
  'src/features/interactive/l2b-root-locus/teacher-page.tsx',
  'src/features/interactive/l2b-root-locus/course-header.tsx',
];

const bannedPatterns = [
  { regex: /dark:/g, message: '不应继续在课程模块里散写 dark: 分支' },
  { regex: /#[0-9A-Fa-f]{3,8}/g, message: '不应继续在课程模块里散写十六进制颜色' },
  {
    regex: /\b(?:bg|text|border|fill|stroke)-(?:slate|cyan|sky|emerald|amber|rose|violet|orange)-\d{2,3}(?:\/\d+)?\b/g,
    message: '不应继续在课程模块里散写色阶类，应改走统一主题语义类',
  },
  { regex: /\bbg-white(?:\/\d+)?\b/g, message: '不应继续在课程模块里散写白底类，应改走统一主题语义类' },
];

for (const relativePath of files) {
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const { regex, message } of bannedPatterns) {
    const matches = content.match(regex) ?? [];
    assert.equal(
      matches.length,
      0,
      `${relativePath}: ${message}。命中：${matches.slice(0, 6).join(', ')}`,
    );
  }
}

console.log('l2b theme no hardcoded styles test passed');
