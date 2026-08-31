import { spawnSync } from 'node:child_process';

const maxOldSpaceSize = process.env.NODE_MAX_OLD_SPACE_SIZE ?? '8192';

if (!/^\d+$/.test(maxOldSpaceSize)) {
  throw new Error('NODE_MAX_OLD_SPACE_SIZE must be an integer number of MiB');
}

const result = spawnSync(process.execPath, [
  `--max-old-space-size=${maxOldSpaceSize}`,
  './node_modules/typescript/bin/tsc',
  '--noEmit',
  '--pretty',
  'false',
], { stdio: 'inherit' });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
