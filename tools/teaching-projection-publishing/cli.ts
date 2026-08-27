import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkTeachingProjectionPublishing } from './check';
import { PUBLISHING_COMMAND_IDS } from './types';

const cwd = process.cwd();
const command = process.argv[2] ?? 'check';
const positional = process.argv.slice(3);
const result = checkTeachingProjectionPublishing(cwd);

function fail(): void {
  for (const failure of result.failures.slice(0, 50)) process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
}

function usage(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
  process.exit(2);
}

function runCutoverScript(script: string, args: readonly string[]): void {
  const tsxCli = join(cwd, 'node_modules/tsx/dist/cli.mjs');
  const spawned = spawnSync(process.execPath, [tsxCli, script, ...args], {
    cwd,
    stdio: 'inherit',
  });
  process.exitCode = spawned.status === null ? 1 : spawned.status;
}

const VERSIONED: Record<string, Record<string, string>> = {
  qualify: {
    v018: 'scripts/knowledge-cutover/qualify-actkg-v018-cutover-candidate.ts',
    v022: 'scripts/knowledge-cutover/qualify-actkg-v022-cutover-candidate.ts',
  },
  rebase: {
    v018: 'scripts/knowledge-cutover/prepare-actkg-v018-teaching-projection.ts',
    v022: 'scripts/knowledge-cutover/prepare-actkg-v022-teaching-projection.ts',
  },
  publish: {
    v018: 'scripts/knowledge-cutover/publish-actkg-v018-cutover-runtime.ts',
    v022: 'scripts/knowledge-cutover/publish-actkg-v022-cutover-runtime.ts',
  },
};

if (command === 'write') {
  if (!result.ok && !result.failures.every((item) => item === 'dirty-worktree')) {
    fail();
  } else {
    const outDir = join(cwd, 'docs/architecture/teaching-projection-publishing');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'inventory.json'), `${JSON.stringify({
      sourceRevision: result.receipt.sourceRevision,
      sourceTree: result.receipt.sourceTree,
      fileCount: result.files.length,
      files: result.files,
      callers: result.callers,
      commandIds: PUBLISHING_COMMAND_IDS,
    }, null, 2)}\n`);
    writeFileSync(join(outDir, 'sample-receipt.json'), `${JSON.stringify(result.receipt, null, 2)}\n`);
  }
} else if (command === 'qualify' || command === 'rebase' || command === 'publish') {
  if (!result.ok) {
    fail();
  } else {
    const version = positional[0];
    const script = version ? VERSIONED[command]?.[version] : undefined;
    if (!script) usage(`usage: teaching-projection:${command} <v018|v022> [...args]`);
    runCutoverScript(script, positional.slice(1));
  }
} else if (command === 'verify') {
  if (!result.ok) {
    fail();
  } else {
    runCutoverScript('scripts/knowledge-cutover/verify-actkg-v018-host-shadow.ts', positional);
  }
} else if (!result.ok) {
  fail();
} else {
  process.stdout.write(`teaching-projection-publishing:ok files=${result.files.length} callers=${result.callers.length}\n`);
}
