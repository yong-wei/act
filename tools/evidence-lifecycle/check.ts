import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { classifyArtifact, listArtifactBlobs, loadProductionArtifactRetainPaths } from './classify';
import { privacyFailures } from './privacy';
import { buildDeletionReceipt } from './receipt';
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
  return { ok: failures.length === 0, failures, classified, deletionReceipt, sourceRevision, sourceTree };
}
