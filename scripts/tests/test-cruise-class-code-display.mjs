import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const targetFile = path.resolve('src/features/interactive/cruise-classroom/teacher-page.tsx');
const content = fs.readFileSync(targetFile, 'utf8');

assert(
  content.includes("if (step.id === 'class-code')"),
  'teacher page must include class-code step rendering branch',
);

assert(
  /sessionInfo\?\.joinCode/.test(content),
  'class-code step must render session join code so students can join',
);

console.log('test-cruise-class-code-display passed');
