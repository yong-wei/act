#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  A_ISSUE,
  PAYLOAD_CLASSIFICATION_OUTPUT_DIR,
  classifyPackage,
  loadCommittedAHandoff,
  loadSourceTreeEntries,
  readIssueGateFromGh,
  toolCheckpointFromGit,
  type ClassifyResult,
} from '../src/lib/architecture-census/payload-classification';
import { sha256Text } from '../src/lib/architecture-census/serialize';
import { checkEvidenceLifecycle } from '../tools/evidence-lifecycle/check';
import { checkContentKnowledgeRuntimeRelease } from '../tools/content-knowledge-runtime-release/check';

function compatibilityFrom(name: string, run: () => { ok: boolean; failures: string[] }): { name: string; status: 'ok' | 'unresolved'; detail: string } {
  try {
    const result = run();
    if (result.ok) return { name, status: 'ok', detail: 'ok' };
    return { name, status: 'unresolved', detail: (result.failures[0] ?? 'failed').slice(0, 180) };
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] ?? 'failed' : 'failed';
    return { name, status: 'unresolved', detail: detail.slice(0, 180) };
  }
}

function writeQualified(repoRoot: string, result: ClassifyResult): void {
  if (!result.files || !result.handoff) {
    throw new Error(result.reason ?? 'classification-blocked');
  }
  const outDir = join(repoRoot, PAYLOAD_CLASSIFICATION_OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'summary.md'), result.files['summary.md']);
  writeFileSync(join(outDir, 'index.json'), result.files['index.json']);
  writeFileSync(join(outDir, 'policy-matrix.md'), result.files['policy-matrix.md']);
  writeFileSync(join(outDir, 'unresolved.md'), result.files['unresolved.md']);
  writeFileSync(join(outDir, 'future-eligibility.md'), result.files['future-eligibility.md']);
  const inventoryPath = join(repoRoot, `artifacts/architecture-census/${result.handoff.successorCaptureId}/payload-classification-inventory.ndjson`);
  mkdirSync(dirname(inventoryPath), { recursive: true });
  writeFileSync(inventoryPath, result.files.inventoryNdjson);
}

const repoRoot = process.cwd();
const baselinePath = join(repoRoot, 'docs/architecture/modular-monolith/post-convergence/baseline.json');
const subjectBefore = sha256Text(readFileSync(baselinePath, 'utf8'));
const issueGate = readIssueGateFromGh(A_ISSUE);
const handoff = loadCommittedAHandoff(repoRoot);
const tool = toolCheckpointFromGit(repoRoot);
const entries = loadSourceTreeEntries(repoRoot, handoff.sourceTree);
if (entries.length !== handoff.trackedFileCount) {
  throw new Error(`a-entry-count-mismatch:${entries.length}!=${handoff.trackedFileCount}`);
}
const compatibilityChecks = [
  compatibilityFrom('qa-evidence-lifecycle', () => checkEvidenceLifecycle(repoRoot)),
  compatibilityFrom('content-knowledge-runtime', () => checkContentKnowledgeRuntimeRelease(repoRoot)),
];
const result = classifyPackage({
  issueGate,
  handoff,
  tool,
  entries,
  compatibilityChecks,
  subjectSourceBytes: subjectBefore,
});
if (sha256Text(readFileSync(baselinePath, 'utf8')) !== subjectBefore) {
  throw new Error('subject-mutated');
}
if (!result.files || result.status === 'blocked') {
  process.stderr.write(`repository-payload-classification:${result.status}:${result.reason ?? 'unknown'}\n`);
  process.exit(1);
}
writeQualified(repoRoot, result);
process.stdout.write(
  `repository-payload-classification:ok members=${result.members.length} digest=${result.packageDigest} inventory=artifacts/architecture-census/${handoff.successorCaptureId}/payload-classification-inventory.ndjson\n`,
);
