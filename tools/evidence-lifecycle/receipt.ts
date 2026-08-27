import { createHash } from 'node:crypto';

import type { ClassifiedArtifact, DeletionReceipt } from './types';
import { QA_EVIDENCE_SCHEMA_VERSION } from './types';
import { privacyFailures } from './privacy';

export function digestJson(value: unknown): string {
  return createHash('sha256').update(`${JSON.stringify(value)}\n`).digest('hex');
}

export function buildDeletionReceipt(
  sourceRevision: string,
  sourceTree: string,
  classified: readonly ClassifiedArtifact[],
): DeletionReceipt {
  const deleted = classified
    .filter((item) => item.retentionDecision === 'externalize-then-delete')
    .map((item) => ({
      path: item.path,
      blobHash: item.blobHash,
      reason: 'run-specific-output-externalized',
      recovery: 'git-history-blob' as const,
    }));
  const receipt: DeletionReceipt = {
    schemaVersion: QA_EVIDENCE_SCHEMA_VERSION,
    sourceRevision,
    sourceTree,
    deletedCount: deleted.length,
    retainedCount: classified.length - deleted.length,
    digest: digestJson(deleted.map((item) => `${item.path}:${item.blobHash}`)),
    entries: deleted,
  };
  const forbidden = privacyFailures(JSON.stringify({
    schemaVersion: receipt.schemaVersion,
    sourceRevision: receipt.sourceRevision,
    sourceTree: receipt.sourceTree,
    digest: receipt.digest,
    reasons: deleted.map((item) => item.reason),
  }));
  if (forbidden.length > 0) {
    throw new Error(`privacy-unsafe-deletion-receipt:${forbidden.join(',')}`);
  }
  return receipt;
}
