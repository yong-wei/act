import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkEvidenceLifecycle } from './check';
import { digestJson } from './receipt';

const cwd = process.cwd();
const command = process.argv[2] ?? 'check';
const result = checkEvidenceLifecycle(cwd);
const outDir = join(cwd, 'docs/architecture/qa-evidence-lifecycle');

function loadExistingEntries(path: string): { path: string; blobHash: string; reason: string; outputReference?: string }[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as {
    path: string;
    blobHash: string;
    reason: string;
    outputReference?: string;
  });
}

if (command === 'write' && result.ok) {
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
  const entriesPath = join(outDir, 'deletion-entries.jsonl');
  const merged = new Map<string, { path: string; blobHash: string; reason: string; outputReference: string }>();
  for (const item of loadExistingEntries(entriesPath)) {
    merged.set(item.path, {
      path: item.path,
      blobHash: item.blobHash,
      reason: item.reason,
      outputReference: item.outputReference ?? `git-blob:${item.blobHash}`,
    });
  }
  for (const item of result.deletionReceipt.entries) {
    merged.set(item.path, {
      path: item.path,
      blobHash: item.blobHash,
      reason: item.reason,
      outputReference: item.outputReference,
    });
  }
  const entries = [...merged.values()].sort((left, right) => left.path.localeCompare(right.path));
  writeFileSync(join(outDir, 'deletion-receipt.json'), `${JSON.stringify({
    schemaVersion: result.deletionReceipt.schemaVersion,
    sourceRevision: result.deletionReceipt.sourceRevision,
    sourceTree: result.deletionReceipt.sourceTree,
    deletedCount: entries.length,
    retainedCount: result.deletionReceipt.retainedCount,
    digest: digestJson(entries.map((item) => `${item.path}:${item.blobHash}`)),
    recovery: 'git-blob',
    fetch: 'git cat-file -p <blobHash>',
    entriesFile: 'deletion-entries.jsonl',
  }, null, 2)}\n`);
  writeFileSync(entriesPath, `${entries.map((item) => JSON.stringify(item)).join('\n')}\n`);
}

if (!result.ok) {
  for (const failure of result.failures.slice(0, 50)) process.stderr.write(`${failure}\n`);
  if (result.failures.length > 50) process.stderr.write(`... ${result.failures.length - 50} more\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`qa-evidence-lifecycle:ok classified=${result.classified.length} delete=${result.deletionReceipt.deletedCount}\n`);
}
