import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkTeachingProjectionPublishing } from './check';
import { PUBLISHING_COMMAND_IDS } from './types';

const cwd = process.cwd();
const command = process.argv[2] ?? 'check';
const result = checkTeachingProjectionPublishing(cwd);

function fail(): void {
  for (const failure of result.failures.slice(0, 50)) process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
}

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
} else if (command === 'qualify' || command === 'rebase' || command === 'publish' || command === 'verify') {
  if (!result.ok) {
    fail();
  } else {
    process.stdout.write(`${JSON.stringify({
      commandId: `teaching-projection:${command}`,
      status: 'not-executed',
      executed: false,
      productionActivation: false,
      hint: 'invoke the migrated knowledge-cutover caller; this CLI never activates selectors',
    })}\n`);
  }
} else if (!result.ok) {
  fail();
} else {
  process.stdout.write(`teaching-projection-publishing:ok files=${result.files.length} callers=${result.callers.length}\n`);
}
