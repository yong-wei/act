import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { worktreeIsClean } from '../boundary/git-source';

import { classifyArtifact, listArtifactBlobs, loadProductionArtifactRetainPaths } from './classify';
import { privacyFailures } from './privacy';
import { buildDeletionReceipt, digestJson } from './receipt';
import type { ClassifiedArtifact, DeletionReceipt } from './types';
import { QA_EVIDENCE_SCHEMA_VERSION } from './types';

export interface EvidenceCheckResult {
  readonly ok: boolean;
  readonly failures: string[];
  readonly classified: readonly ClassifiedArtifact[];
  readonly deletionReceipt: DeletionReceipt;
  readonly sourceRevision: string;
  readonly sourceTree: string;
}

const PRODUCT_IMPORT_ROOTS = ['src/app/', 'src/components/', 'src/features/', 'src/hooks/', 'src/lib/', 'src/resources/', 'src/types/'];

function isTestPath(path: string): boolean {
  return path.includes('/__tests__/') || /\.(?:test|spec)\./.test(path);
}

export function findProductArtifactImports(cwd: string): string[] {
  const output = execFileSync('git', ['ls-files', '-z', '--', 'src'], { cwd, encoding: 'utf8' });
  const hits: string[] = [];
  for (const path of output.split('\0').filter(Boolean)) {
    if (!PRODUCT_IMPORT_ROOTS.some((root) => path.startsWith(root)) || isTestPath(path)) continue;
    if (!/\.(?:[cm]?[jt]sx?)$/.test(path)) continue;
    const text = readFileSync(join(cwd, path), 'utf8');
    if (/from ['"][^'"]*artifacts\//.test(text) || /import\(['"][^'"]*artifacts\//.test(text)) {
      hits.push(path);
    }
  }
  return hits;
}

export function checkEvidenceLifecycle(cwd: string): EvidenceCheckResult {
  const failures: string[] = [];
  if (!worktreeIsClean(cwd)) {
    failures.push('dirty-worktree');
  }
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd, encoding: 'utf8' }).trim();
  const retain = loadProductionArtifactRetainPaths(cwd);
  const classified = listArtifactBlobs(cwd).map((item) => classifyArtifact(item.path, item.blobHash, retain));
  if (classified.length === 0) failures.push('empty-artifact-denominator');
  for (const item of classified) {
    if (!item.evidenceClass || !item.owner || !item.blobHash) failures.push(`unclassified:${item.path}`);
  }
  const productImports = findProductArtifactImports(cwd);
  for (const path of productImports) failures.push(`product-artifact-import:${path}`);
  const deletionReceipt = buildDeletionReceipt(sourceRevision, sourceTree, classified);
  failures.push(...privacyFailures(JSON.stringify({
    schemaVersion: deletionReceipt.schemaVersion,
    sourceRevision: deletionReceipt.sourceRevision,
    sourceTree: deletionReceipt.sourceTree,
    digest: deletionReceipt.digest,
  })).map((item) => `receipt-${item}`));
  if (deletionReceipt.schemaVersion !== QA_EVIDENCE_SCHEMA_VERSION) failures.push('schema-mismatch');
  failures.push(...verifyCommittedDeletionReceipt(cwd));
  return { ok: failures.length === 0, failures, classified, deletionReceipt, sourceRevision, sourceTree };
}

function verifyCommittedDeletionReceipt(cwd: string): string[] {
  const failures: string[] = [];
  const entriesPath = join(cwd, 'docs/architecture/qa-evidence-lifecycle/deletion-entries.jsonl');
  const receiptPath = join(cwd, 'docs/architecture/qa-evidence-lifecycle/deletion-receipt.json');
  if (!existsSync(entriesPath) || !existsSync(receiptPath)) {
    return ['missing-committed-deletion-receipt'];
  }
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as { deletedCount?: number; digest?: string };
  const entries = readFileSync(entriesPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as {
    path: string;
    blobHash: string;
    outputReference?: string;
  });
  if (entries.length === 0) failures.push('empty-committed-deletion-entries');
  if (receipt.deletedCount !== entries.length) failures.push('deletion-count-mismatch');
  const expectedDigest = digestJson(entries.map((item) => `${item.path}:${item.blobHash}`));
  if (receipt.digest !== expectedDigest) failures.push('deletion-digest-mismatch');
  const hashes = entries.map((item) => item.blobHash).filter(Boolean);
  if (hashes.length !== entries.length) failures.push('missing-blob-hash');
  if (hashes.length > 0) {
    const checked = execFileSync('git', ['cat-file', '--batch-check=%(objecttype)', '--buffer'], {
      cwd,
      encoding: 'utf8',
      input: `${hashes.join('\n')}\n`,
      maxBuffer: 64 * 1024 * 1024,
    });
    const missing = checked.split('\n').filter((line) => line && line !== 'blob');
    if (missing.length > 0) failures.push(`missing-git-blob:${missing.length}`);
  }
  return failures;
}
