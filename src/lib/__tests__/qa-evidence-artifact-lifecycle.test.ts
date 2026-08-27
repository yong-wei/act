import { describe, expect, it } from 'vitest';

import { worktreeIsClean } from '../../../tools/boundary/git-source';
import { checkEvidenceLifecycle, findProductArtifactImports } from '../../../tools/evidence-lifecycle/check';
import { classifyArtifact } from '../../../tools/evidence-lifecycle/classify';
import { privacyFailures } from '../../../tools/evidence-lifecycle/privacy';
import { QA_EVIDENCE_SCHEMA_VERSION } from '../../../tools/evidence-lifecycle/types';

describe('qa evidence artifact lifecycle', () => {
  it('classifies screenshots as run outputs unless they are retained fixtures', () => {
    const run = classifyArtifact('artifacts/commercial-ui/run/screenshot.png', 'abc', new Set());
    expect(run.evidenceClass).toBe('run-specific-output');
    expect(run.retentionDecision).toBe('externalize-then-delete');
    const kept = classifyArtifact('artifacts/commercial-ui/brand-kit-light-1440.png', 'def', new Set([
      'artifacts/commercial-ui/brand-kit-light-1440.png',
    ]));
    expect(kept.evidenceClass).toBe('representative-fixture');
  });

  it('rejects absolute paths and secrets from evidence receipts', () => {
    expect(privacyFailures('/Users/YW/secret/NEXTAUTH_SECRET').length).toBeGreaterThan(0);
    expect(privacyFailures('{"outputReference":"sha256:abc"}')).toEqual([]);
  });

  it('removes production module imports of artifacts/', () => {
    expect(findProductArtifactImports(process.cwd())).toEqual([]);
  });

  it('qualifies the live artifact denominator with a hashed deletion receipt', () => {
    const result = checkEvidenceLifecycle(process.cwd());
    if (result.failures.includes('dirty-worktree')) {
      expect(worktreeIsClean(process.cwd())).toBe(false);
      return;
    }
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.classified.length).toBeGreaterThan(400);
    expect(result.deletionReceipt.schemaVersion).toBe(QA_EVIDENCE_SCHEMA_VERSION);
    expect(result.classified.some((item) => item.retentionDecision === 'retain-in-repo' || item.retentionDecision === 'keep-as-audit-ledger')).toBe(true);
    expect(result.deletionReceipt.sourceRevision).not.toMatch(/\/Users\//);
  });
});
