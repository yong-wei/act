import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkEvidenceLifecycle } from './check';
import { digestJson } from './receipt';

const cwd = process.cwd();
const command = process.argv[2] ?? 'check';
const result = checkEvidenceLifecycle(cwd);
const outDir = join(cwd, 'docs/architecture/qa-evidence-lifecycle');

if (command === 'write') {
  mkdirSync(outDir, { recursive: true });
  const counts = result.classified.reduce<Record<string, number>>((acc, item) => {
    acc[item.evidenceClass] = (acc[item.evidenceClass] ?? 0) + 1;
    return acc;
  }, {});
  writeFileSync(join(outDir, 'characterization.json'), `${JSON.stringify({
    sourceRevision: result.sourceRevision,
    sourceTree: result.sourceTree,
    total: result.classified.length,
    counts,
    digest: digestJson(result.classified.map((item) => `${item.path}:${item.evidenceClass}:${item.blobHash}`)),
  }, null, 2)}\n`);
  writeFileSync(join(outDir, 'deletion-receipt.json'), `${JSON.stringify({
    schemaVersion: result.deletionReceipt.schemaVersion,
    sourceRevision: result.deletionReceipt.sourceRevision,
    sourceTree: result.deletionReceipt.sourceTree,
    deletedCount: result.deletionReceipt.deletedCount,
    retainedCount: result.deletionReceipt.retainedCount,
    digest: result.deletionReceipt.digest,
    recovery: 'git-history-blob',
    entriesFile: 'deletion-entries.jsonl',
  }, null, 2)}\n`);
  writeFileSync(
    join(outDir, 'deletion-entries.jsonl'),
    `${result.deletionReceipt.entries.map((item) => JSON.stringify({ path: item.path, blobHash: item.blobHash, reason: item.reason })).join('\n')}\n`,
  );
}

if (!result.ok) {
  for (const failure of result.failures.slice(0, 50)) process.stderr.write(`${failure}\n`);
  if (result.failures.length > 50) process.stderr.write(`... ${result.failures.length - 50} more\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`qa-evidence-lifecycle:ok classified=${result.classified.length} delete=${result.deletionReceipt.deletedCount}\n`);
}
