import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const repoRoot = resolve(new URL('../..', import.meta.url).pathname);
const sourceRoots = ['src/app', 'src/features', 'src/components', 'src/resources'];
const sourceFiles = execFileSync('rg', ['--files', ...sourceRoots], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

const forbiddenDevAppUrl = /https?:\/\/(?:localhost|127\.0\.0\.1):3001\b/;
const forbiddenCopy = '返回教室工作台';

const violations = [];

for (const file of sourceFiles) {
  const content = readFileSync(resolve(repoRoot, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (forbiddenDevAppUrl.test(line)) {
      violations.push(`${file}:${index + 1} contains hardcoded development app URL`);
    }
    if (line.includes(forbiddenCopy)) {
      violations.push(`${file}:${index + 1} contains incorrect teacher workbench copy`);
    }
  });
}

assert.equal(
  violations.length,
  0,
  `Production navigation must not leak development URLs or incorrect copy:\n${violations.join('\n')}`,
);

console.log('no hardcoded localhost navigation test passed');
