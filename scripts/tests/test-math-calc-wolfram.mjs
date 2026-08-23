import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const tsx = join(root, 'node_modules/.bin/tsx');
const child = spawnSync(tsx, [join(root, 'scripts/tests/test-math-calc-wolfram.ts')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

if (child.error) {
  console.error(child.error);
  process.exit(1);
}

process.exit(child.status === 0 ? 0 : child.status ?? 1);
