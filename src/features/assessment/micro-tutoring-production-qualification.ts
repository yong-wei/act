import { createHash } from 'node:crypto';

import {
  MICRO_TUTORING_ASSESSMENT_BASELINE_V2_ITEM_COUNT,
  MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT,
  MICRO_TUTORING_V2_ERROR_OPTION_COUNT,
  microTutoringCoverageAuditContentDigest,
  microTutoringCoverageAuditIsGitContentComplete,
  microTutoringCoverageAuditIsStrictlyComplete,
  type MicroTutoringCoverageAuditReport,
  type MicroTutoringCoverageProfile,
} from './micro-tutoring-coverage-audit';

export const MICRO_TUTORING_PRODUCTION_QUALIFICATION_VERSION = 'micro-tutoring-production-qualification.v1';
export const MICRO_TUTORING_PRODUCTION_QUALIFICATION_V2_VERSION = 'micro-tutoring-production-qualification.v2';
export const MICRO_TUTORING_PRODUCTION_FEATURE_FLAG = 'micro-tutoring-production-canary';
export const MICRO_TUTORING_PRODUCTION_QUALIFICATION_KIND = 'candidate';
export const MICRO_TUTORING_REQUIRED_QUALIFICATION_TESTS = [
  'verify:micro-tutoring-coverage',
  'test:micro-tutoring-qualification-postgres',
  'test:micro-tutoring-qualification',
] as const;
export const MICRO_TUTORING_REQUIRED_V2_QUALIFICATION_TESTS = [
  'verify:micro-tutoring-coverage:v2',
  'test:micro-tutoring-qualification-postgres',
  'test:micro-tutoring-qualification:v2',
] as const;

const GIT_REVISION = /^[a-f0-9]{40}$/u;
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/u;

export type MicroTutoringQualificationIssue =
  | 'DIRTY_WORKTREE'
  | 'GIT_CONTENT_INCOMPLETE'
  | 'STRICT_COVERAGE_INCOMPLETE'
  | 'MIXED_REVISION'
  | 'DIGEST_MISMATCH'
  | 'TESTS_FAILED'
  | 'REQUIRED_TESTS_INCOMPLETE'
  | 'MISSING_DB_CAPTURE'
  | 'MISSING_BROWSER_EVIDENCE'
  | 'MISSING_OCI_DIGEST'
  | 'ACTIVATION_UNAUTHORIZED';

export interface MicroTutoringRevisionBoundDigest {
  sourceRevision: string;
  digest: string;
}

export interface MicroTutoringQualificationTestProof {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  scope: string;
  sourceRevision: string;
}

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
  version:
    | typeof MICRO_TUTORING_PRODUCTION_QUALIFICATION_VERSION
    | typeof MICRO_TUTORING_PRODUCTION_QUALIFICATION_V2_VERSION;
  kind: typeof MICRO_TUTORING_PRODUCTION_QUALIFICATION_KIND;
  generatedAt: string;
  sourceRevision: string;
  sourceInputsClean: boolean;
  governedProjectionRevision: string;
  coverageDigest: string;
  gitContentComplete: boolean;
  strictlyComplete: boolean;
  qualifiedPracticeItemCount: number;
  qualifiedItemCount?: number;
  errorOptionCount: number;
  completeOptionCount: number;
  artifactDigests: MicroTutoringArtifactDigest[];
  tests: MicroTutoringQualificationTestProof[];
  browserEvidence: MicroTutoringRevisionBoundDigest;
  ociImage: MicroTutoringRevisionBoundDigest;
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

function isGitRevision(value: string | null | undefined): value is string {
  return typeof value === 'string' && GIT_REVISION.test(value);
}

function isSha256Digest(value: string | null | undefined): value is string {
  return typeof value === 'string' && SHA256_DIGEST.test(value);
}

function isRevisionBoundDigest(
  value: MicroTutoringRevisionBoundDigest | null | undefined,
  expectedRevision: string,
): value is MicroTutoringRevisionBoundDigest {
  return Boolean(
    value &&
      isGitRevision(value.sourceRevision) &&
      isSha256Digest(value.digest) &&
      value.sourceRevision === expectedRevision,
  );
}

function qualificationTestsAreBound(
  tests: MicroTutoringQualificationTestProof[],
  expectedRevision: string,
  requiredTests: readonly string[] = MICRO_TUTORING_REQUIRED_QUALIFICATION_TESTS,
): boolean {
  return requiredTests.every((name) =>
    tests.some((test) =>
      test.name === name &&
      test.status === 'passed' &&
      test.sourceRevision === expectedRevision,
    )) &&
    tests.length > 0 &&
    tests.every((test) =>
      test.status === 'passed' &&
      isGitRevision(test.sourceRevision) &&
      test.sourceRevision === expectedRevision);
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
    !isGitRevision(input.receipt.governedProjectionRevision) ||
    input.receipt.governedProjectionRevision !== input.receipt.sourceRevision ||
    !qualificationTestsAreBound(
      input.receipt.tests,
      input.receipt.sourceRevision,
      input.receipt.version === MICRO_TUTORING_PRODUCTION_QUALIFICATION_V2_VERSION
        ? MICRO_TUTORING_REQUIRED_V2_QUALIFICATION_TESTS
        : MICRO_TUTORING_REQUIRED_QUALIFICATION_TESTS,
    ) ||
    !isRevisionBoundDigest(input.receipt.browserEvidence, input.receipt.sourceRevision) ||
    !isRevisionBoundDigest(input.receipt.ociImage, input.receipt.sourceRevision)
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
  tests: MicroTutoringQualificationTestProof[];
  browserEvidence?: MicroTutoringRevisionBoundDigest | null;
  ociImage?: MicroTutoringRevisionBoundDigest | null;
  coverageProfile?: MicroTutoringCoverageProfile;
}): { receipt: MicroTutoringProductionQualificationReceipt | null; issues: MicroTutoringQualificationIssue[] } {
  const issues: MicroTutoringQualificationIssue[] = [];
  const coverageProfile = input.coverageProfile ?? input.report.coverageProfile ?? 'v1';
  const requiredTests = coverageProfile === 'v2'
    ? MICRO_TUTORING_REQUIRED_V2_QUALIFICATION_TESTS
    : MICRO_TUTORING_REQUIRED_QUALIFICATION_TESTS;
  const capture = input.report.inputCapture;
  const sourceRevision = capture?.sourceRevision ?? '';
  const governedProjectionRevision = capture?.governedProjectionRevision ?? null;
  const browserEvidence = input.browserEvidence ?? null;
  const ociImage = input.ociImage ?? null;
  if (!capture || !isGitRevision(sourceRevision)) {
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
  if (
    coverageProfile === 'v2' &&
    (
      input.report.coverageProfile !== 'v2' ||
      input.report.qualifiedItemCount !== MICRO_TUTORING_ASSESSMENT_BASELINE_V2_ITEM_COUNT ||
      input.report.errorOptionCount !== MICRO_TUTORING_V2_ERROR_OPTION_COUNT
    )
  ) {
    issues.push('STRICT_COVERAGE_INCOMPLETE');
  }
  if (
    coverageProfile === 'v1' &&
    input.report.qualifiedPracticeItemCount !== MICRO_TUTORING_PRACTICE_BASELINE_V1_ITEM_COUNT
  ) {
    issues.push('STRICT_COVERAGE_INCOMPLETE');
  }
  const requiredTestsPresent = requiredTests.every((name) =>
    input.tests.some((test) => test.name === name));
  if (!requiredTestsPresent) {
    issues.push('REQUIRED_TESTS_INCOMPLETE');
  }
  if (input.tests.length === 0 || input.tests.some((test) => test.status !== 'passed')) {
    issues.push('TESTS_FAILED');
  }
  if (input.tests.some((test) => !isGitRevision(test.sourceRevision) || test.sourceRevision !== sourceRevision)) {
    issues.push('MIXED_REVISION');
  }
  if (!isGitRevision(governedProjectionRevision)) {
    issues.push('MISSING_DB_CAPTURE');
  } else if (isGitRevision(sourceRevision) && governedProjectionRevision !== sourceRevision) {
    issues.push('MIXED_REVISION');
  }
  if (!browserEvidence || !isGitRevision(browserEvidence.sourceRevision) || !isSha256Digest(browserEvidence.digest)) {
    issues.push('MISSING_BROWSER_EVIDENCE');
  } else if (isGitRevision(sourceRevision) && browserEvidence.sourceRevision !== sourceRevision) {
    issues.push('MIXED_REVISION');
  }
  if (!ociImage || !isGitRevision(ociImage.sourceRevision) || !isSha256Digest(ociImage.digest)) {
    issues.push('MISSING_OCI_DIGEST');
  } else if (isGitRevision(sourceRevision) && ociImage.sourceRevision !== sourceRevision) {
    issues.push('MIXED_REVISION');
  }
  if (issues.length > 0) {
    return { receipt: null, issues: [...new Set(issues)] };
  }
  const envelope: Omit<MicroTutoringProductionQualificationReceipt, 'receiptDigest'> = {
    version: coverageProfile === 'v2'
      ? MICRO_TUTORING_PRODUCTION_QUALIFICATION_V2_VERSION
      : MICRO_TUTORING_PRODUCTION_QUALIFICATION_VERSION,
    kind: MICRO_TUTORING_PRODUCTION_QUALIFICATION_KIND,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceRevision,
    sourceInputsClean: capture!.sourceInputsClean,
    governedProjectionRevision: governedProjectionRevision!,
    coverageDigest: input.report.contentDigest,
    gitContentComplete: true,
    strictlyComplete: true,
    qualifiedPracticeItemCount: input.report.qualifiedPracticeItemCount,
    ...(coverageProfile === 'v2' ? { qualifiedItemCount: input.report.qualifiedItemCount } : {}),
    errorOptionCount: input.report.errorOptionCount,
    completeOptionCount: input.report.completeOptionCount,
    artifactDigests: [...input.artifactDigests].sort((left, right) => left.path.localeCompare(right.path)),
    tests: input.tests,
    browserEvidence: browserEvidence!,
    ociImage: ociImage!,
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
