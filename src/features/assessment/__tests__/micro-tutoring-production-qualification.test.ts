import { describe, expect, it } from 'vitest';

import type { MicroTutoringCoverageAuditReport } from '../micro-tutoring-coverage-audit';
import {
  MICRO_TUTORING_PRODUCTION_FEATURE_FLAG,
  buildMicroTutoringProductionQualificationReceipt,
  evaluateMicroTutoringProductionActivation,
} from '../micro-tutoring-production-qualification';
import { microTutoringCoverageAuditContentDigest } from '../micro-tutoring-coverage-audit';

const SOURCE_REVISION = 'a'.repeat(40);
const BROWSER_EVIDENCE_DIGEST = `sha256:${'b'.repeat(64)}`;
const OCI_DIGEST = `sha256:${'c'.repeat(64)}`;

function completeReport(overrides: Partial<MicroTutoringCoverageAuditReport> = {}): MicroTutoringCoverageAuditReport {
  const rows = Array.from({ length: 108 }, (_, index) => ({
    catalogItemId: `item-${String(index).padStart(3, '0')}`,
    contentHash: 'a'.repeat(64),
    errorOptionRef: `hmac-sha256:${String(index).padStart(2, '0')}${'b'.repeat(62)}`,
    learningGoalId: 'control-correction',
    misconceptionTag: 'misconception:control-correction:sample',
    knowledgeNodeId: 'kn:autocontrol:controller-correction',
    attributionVersion: 'micro-tutoring-option-attribution.v2',
    resources: [{ id: 'resource-1', version: 'v1', estimatedMinutes: 6, actionPath: '/r' }],
    validationItems: [{
      id: 'validation-1',
      questionId: 'q-1',
      contentHash: 'c'.repeat(64),
      version: 'adaptive-assessment-item-ref.v1',
      estimatedMinutes: 2,
      actionPath: '/assessment/adaptive-practice',
    }],
    status: 'COMPLETE' as const,
    reasons: [],
  }));
  const report = {
    artifactVersion: 'micro-tutoring-coverage-audit.v1' as const,
    baselineItemCount: 54,
    qualifiedPracticeItemCount: 54,
    errorOptionCount: 108,
    completeOptionCount: 108,
    gapOptionCount: 0,
    attributionIssueCount: 0,
    inputCapture: {
      sourceRevision: SOURCE_REVISION,
      sourceInputsClean: true,
      governedProjectionRevision: SOURCE_REVISION,
    },
    baselineIssues: [],
    attributionIssues: [],
    gapReasonCounts: {
      ATTRIBUTION_UNCERTAIN: 0,
      CANONICAL_NODE_UNAVAILABLE: 0,
      RESOURCE_UNAVAILABLE: 0,
      VALIDATION_QUESTION_UNAVAILABLE: 0,
      ACCESS_REVOKED: 0,
      REFERENCE_DRIFT: 0,
    },
    rows,
    ...overrides,
  };
  return {
    ...report,
    contentDigest: microTutoringCoverageAuditContentDigest(report),
  };
}

function boundReceiptInput(
  report: MicroTutoringCoverageAuditReport = completeReport(),
  overrides: Partial<Parameters<typeof buildMicroTutoringProductionQualificationReceipt>[0]> = {},
) {
  return {
    report,
    generatedAt: '2026-08-21T00:00:00.000Z',
    artifactDigests: [{ path: 'a.json', sha256: `sha256:${'d'.repeat(64)}` }],
    tests: [{ name: 'coverage', status: 'passed' as const, scope: 'offline-git-content' }],
    browserEvidenceDigest: BROWSER_EVIDENCE_DIGEST,
    ociDigest: OCI_DIGEST,
    ...overrides,
  };
}

describe('micro tutoring production qualification', () => {
  it('builds an immutable candidate receipt without activating production', () => {
    const built = buildMicroTutoringProductionQualificationReceipt(boundReceiptInput());
    expect(built.issues).toEqual([]);
    expect(built.receipt?.kind).toBe('candidate');
    expect(built.receipt?.gitContentComplete).toBe(true);
    expect(built.receipt?.strictlyComplete).toBe(true);
    expect(built.receipt?.governedProjectionRevision).toBe(SOURCE_REVISION);
    expect(built.receipt?.browserEvidenceDigest).toBe(BROWSER_EVIDENCE_DIGEST);
    expect(built.receipt?.ociDigest).toBe(OCI_DIGEST);
    expect(built.receipt?.featureFlag).toEqual({
      key: MICRO_TUTORING_PRODUCTION_FEATURE_FLAG,
      enabled: false,
      canaryPercent: 0,
    });
    expect(built.receipt?.activation).toEqual({ authorized: false, productionUnchanged: true });
    expect(JSON.stringify(built.receipt)).not.toContain('answerKey');
    expect(JSON.stringify(built.receipt)).not.toContain('isCorrect');

    const decision = evaluateMicroTutoringProductionActivation({
      receipt: built.receipt!,
      authorized: false,
    });
    expect(decision).toEqual({
      status: 'candidate-only',
      productionUnchanged: true,
      reason: 'activation-unauthorized',
    });
  });

  it('fail-closes missing strict coverage, tests, db capture, browser evidence, or OCI digest', () => {
    expect(buildMicroTutoringProductionQualificationReceipt(boundReceiptInput(completeReport({
      gapOptionCount: 1,
    }))).issues).toContain('STRICT_COVERAGE_INCOMPLETE');

    expect(buildMicroTutoringProductionQualificationReceipt(boundReceiptInput(completeReport(), {
      tests: [{ name: 'coverage', status: 'failed', scope: 'offline-git-content' }],
    })).issues).toContain('TESTS_FAILED');

    expect(buildMicroTutoringProductionQualificationReceipt(boundReceiptInput(completeReport({
      inputCapture: {
        sourceRevision: SOURCE_REVISION,
        sourceInputsClean: true,
        governedProjectionRevision: null,
      },
    }))).issues).toEqual(['MISSING_DB_CAPTURE']);

    expect(buildMicroTutoringProductionQualificationReceipt(boundReceiptInput(completeReport(), {
      browserEvidenceDigest: null,
    })).issues).toEqual(['MISSING_BROWSER_EVIDENCE']);

    expect(buildMicroTutoringProductionQualificationReceipt(boundReceiptInput(completeReport(), {
      ociDigest: null,
    })).issues).toEqual(['MISSING_OCI_DIGEST']);
  });

  it('fail-closes a dirty worktree or mixed digest and rolls back an over-threshold canary', () => {
    const dirty = completeReport({
      inputCapture: {
        sourceRevision: SOURCE_REVISION,
        sourceInputsClean: false,
        governedProjectionRevision: SOURCE_REVISION,
      },
    });
    expect(buildMicroTutoringProductionQualificationReceipt(boundReceiptInput(dirty)).issues)
      .toContain('DIRTY_WORKTREE');

    const mismatched = completeReport();
    mismatched.contentDigest = `sha256:${'e'.repeat(64)}`;
    expect(buildMicroTutoringProductionQualificationReceipt(boundReceiptInput(mismatched)).issues)
      .toContain('DIGEST_MISMATCH');

    const mixed = completeReport({
      inputCapture: {
        sourceRevision: SOURCE_REVISION,
        sourceInputsClean: true,
        governedProjectionRevision: 'f'.repeat(40),
      },
    });
    expect(buildMicroTutoringProductionQualificationReceipt(boundReceiptInput(mixed)).issues)
      .toContain('MIXED_REVISION');

    const complete = buildMicroTutoringProductionQualificationReceipt(boundReceiptInput()).receipt!;
    expect(evaluateMicroTutoringProductionActivation({
      receipt: complete,
      authorized: true,
      metrics: { unavailableRate: 0.2, errorRate: 0, funnelDropRate: 0 },
    })).toMatchObject({ status: 'rollback-required', productionUnchanged: true });
  });
});
