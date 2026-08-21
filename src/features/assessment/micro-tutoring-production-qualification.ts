import { createHash } from 'node:crypto';

import {
  MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT,
  microTutoringCoverageAuditContentDigest,
  microTutoringCoverageAuditIsGitContentComplete,
  microTutoringCoverageAuditIsStrictlyComplete,
  type MicroTutoringCoverageAuditReport,
} from './micro-tutoring-coverage-audit';

export const MICRO_TUTORING_PRODUCTION_QUALIFICATION_VERSION = 'micro-tutoring-production-qualification.v1';
export const MICRO_TUTORING_PRODUCTION_FEATURE_FLAG = 'micro-tutoring-production-canary';
export const MICRO_TUTORING_PRODUCTION_QUALIFICATION_KIND = 'candidate';

const GIT_REVISION = /^[a-f0-9]{40}$/u;
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/u;

export type MicroTutoringQualificationIssue =
  | 'DIRTY_WORKTREE'
  | 'GIT_CONTENT_INCOMPLETE'
  | 'STRICT_COVERAGE_INCOMPLETE'
  | 'MIXED_REVISION'
  | 'DIGEST_MISMATCH'
  | 'TESTS_FAILED'
  | 'MISSING_DB_CAPTURE'
  | 'MISSING_BROWSER_EVIDENCE'
  | 'MISSING_OCI_DIGEST'
  | 'ACTIVATION_UNAUTHORIZED';

export interface MicroTutoringArtifactDigest {
  path: string;
  sha256: string;
}

export interface MicroTutoringCanaryThresholds {
  unavailableRate: number;
  errorRate: number;
  funnelDropRate: number;
}

export interface MicroTutoringCanaryMetrics {
  unavailableRate: number;
  errorRate: number;
  funnelDropRate: number;
}

export interface MicroTutoringProductionQualificationReceipt {
  version: typeof MICRO_TUTORING_PRODUCTION_QUALIFICATION_VERSION;
  kind: typeof MICRO_TUTORING_PRODUCTION_QUALIFICATION_KIND;
  generatedAt: string;
  sourceRevision: string;
  sourceInputsClean: boolean;
  governedProjectionRevision: string;
  coverageDigest: string;
  gitContentComplete: boolean;
  strictlyComplete: boolean;
  qualifiedPracticeItemCount: number;
  errorOptionCount: number;
  completeOptionCount: number;
  artifactDigests: MicroTutoringArtifactDigest[];
  tests: Array<{ name: string; status: 'passed' | 'failed' | 'skipped'; scope: string }>;
  browserEvidenceDigest: string;
  ociDigest: string;
  featureFlag: {
    key: typeof MICRO_TUTORING_PRODUCTION_FEATURE_FLAG;
    enabled: false;
    canaryPercent: 0;
  };
  activation: {
    authorized: false;
    productionUnchanged: true;
  };
  receiptDigest: string;
}

export interface MicroTutoringActivationDecision {
  status: 'candidate-only' | 'canary-authorized' | 'rollback-required' | 'blocked';
  productionUnchanged: boolean;
  reason: string;
}

const DEFAULT_CANARY_THRESHOLDS: MicroTutoringCanaryThresholds = {
  unavailableRate: 0.08,
  errorRate: 0.05,
  funnelDropRate: 0.25,
};

function sha256Hex(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function microTutoringQualificationReceiptDigest(
  receipt: Omit<MicroTutoringProductionQualificationReceipt, 'receiptDigest'>,
): string {
  return sha256Hex(JSON.stringify(receipt));
}

export function evaluateMicroTutoringProductionActivation(input: {
  receipt: MicroTutoringProductionQualificationReceipt;
  authorized: boolean;
  metrics?: MicroTutoringCanaryMetrics;
  thresholds?: MicroTutoringCanaryThresholds;
}): MicroTutoringActivationDecision {
  const thresholds = input.thresholds ?? DEFAULT_CANARY_THRESHOLDS;
  if (input.receipt.kind !== 'candidate' || input.receipt.activation.authorized !== false) {
    return { status: 'blocked', productionUnchanged: true, reason: 'receipt-not-candidate' };
  }
  if (!input.authorized) {
    return {
      status: 'candidate-only',
      productionUnchanged: true,
      reason: 'activation-unauthorized',
    };
  }
  if (
    !input.receipt.strictlyComplete ||
    !input.receipt.gitContentComplete ||
    input.receipt.tests.length === 0 ||
    input.receipt.tests.some((test) => test.status !== 'passed') ||
    !GIT_REVISION.test(input.receipt.governedProjectionRevision) ||
    input.receipt.governedProjectionRevision !== input.receipt.sourceRevision ||
    !SHA256_DIGEST.test(input.receipt.browserEvidenceDigest) ||
    !SHA256_DIGEST.test(input.receipt.ociDigest)
  ) {
    return { status: 'blocked', productionUnchanged: true, reason: 'coverage-incomplete' };
  }
  const metrics = input.metrics;
  if (
    metrics &&
    (metrics.unavailableRate > thresholds.unavailableRate ||
      metrics.errorRate > thresholds.errorRate ||
      metrics.funnelDropRate > thresholds.funnelDropRate)
  ) {
    return { status: 'rollback-required', productionUnchanged: true, reason: 'canary-threshold-exceeded' };
  }
  return {
    status: 'canary-authorized',
    productionUnchanged: false,
    reason: 'explicit-canary-authorization',
  };
}

export function buildMicroTutoringProductionQualificationReceipt(input: {
  report: MicroTutoringCoverageAuditReport;
  generatedAt?: string;
  artifactDigests: MicroTutoringArtifactDigest[];
  tests: MicroTutoringProductionQualificationReceipt['tests'];
  browserEvidenceDigest?: string | null;
  ociDigest?: string | null;
}): { receipt: MicroTutoringProductionQualificationReceipt | null; issues: MicroTutoringQualificationIssue[] } {
  const issues: MicroTutoringQualificationIssue[] = [];
  const capture = input.report.inputCapture;
  const sourceRevision = capture?.sourceRevision ?? '';
  const governedProjectionRevision = capture?.governedProjectionRevision ?? null;
  const browserEvidenceDigest = input.browserEvidenceDigest?.trim() || null;
  const ociDigest = input.ociDigest?.trim() || null;
  if (!capture || !GIT_REVISION.test(sourceRevision)) {
    issues.push('MIXED_REVISION');
  }
  if (capture && !capture.sourceInputsClean) {
    issues.push('DIRTY_WORKTREE');
  }
  if (!microTutoringCoverageAuditIsGitContentComplete(input.report)) {
    issues.push('GIT_CONTENT_INCOMPLETE');
  }
  const expectedDigest = microTutoringCoverageAuditContentDigest(input.report);
  if (input.report.contentDigest !== expectedDigest) {
    issues.push('DIGEST_MISMATCH');
  }
  if (!microTutoringCoverageAuditIsStrictlyComplete(input.report)) {
    issues.push('STRICT_COVERAGE_INCOMPLETE');
  }
  if (input.tests.length === 0 || input.tests.some((test) => test.status !== 'passed')) {
    issues.push('TESTS_FAILED');
  }
  if (!governedProjectionRevision || !GIT_REVISION.test(governedProjectionRevision)) {
    issues.push('MISSING_DB_CAPTURE');
  } else if (GIT_REVISION.test(sourceRevision) && governedProjectionRevision !== sourceRevision) {
    issues.push('MIXED_REVISION');
  }
  if (!browserEvidenceDigest || !SHA256_DIGEST.test(browserEvidenceDigest)) {
    issues.push('MISSING_BROWSER_EVIDENCE');
  }
  if (!ociDigest || !SHA256_DIGEST.test(ociDigest)) {
    issues.push('MISSING_OCI_DIGEST');
  }
  if (issues.length > 0) {
    return { receipt: null, issues: [...new Set(issues)] };
  }
  const envelope: Omit<MicroTutoringProductionQualificationReceipt, 'receiptDigest'> = {
    version: MICRO_TUTORING_PRODUCTION_QUALIFICATION_VERSION,
    kind: MICRO_TUTORING_PRODUCTION_QUALIFICATION_KIND,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceRevision,
    sourceInputsClean: capture!.sourceInputsClean,
    governedProjectionRevision: governedProjectionRevision!,
    coverageDigest: input.report.contentDigest,
    gitContentComplete: true,
    strictlyComplete: true,
    qualifiedPracticeItemCount: input.report.qualifiedPracticeItemCount,
    errorOptionCount: input.report.errorOptionCount,
    completeOptionCount: input.report.completeOptionCount,
    artifactDigests: [...input.artifactDigests].sort((left, right) => left.path.localeCompare(right.path)),
    tests: input.tests,
    browserEvidenceDigest: browserEvidenceDigest!,
    ociDigest: ociDigest!,
    featureFlag: {
      key: MICRO_TUTORING_PRODUCTION_FEATURE_FLAG,
      enabled: false,
      canaryPercent: 0,
    },
    activation: {
      authorized: false,
      productionUnchanged: true,
    },
  };
  return {
    receipt: {
      ...envelope,
      receiptDigest: microTutoringQualificationReceiptDigest(envelope),
    },
    issues: [],
  };
}

export function microTutoringQualificationRequiresActivationHold(
  receipt: MicroTutoringProductionQualificationReceipt,
): boolean {
  return receipt.activation.authorized === false && receipt.activation.productionUnchanged === true;
}

export function defaultMicroTutoringCanaryThresholds(): MicroTutoringCanaryThresholds {
  return { ...DEFAULT_CANARY_THRESHOLDS };
}

export { MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT };
