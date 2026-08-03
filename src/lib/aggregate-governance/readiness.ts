import type {
  ActStructuralUnitCrosswalkRecord,
  CaptureIdentity,
  CourseCoverageDisposition,
  DownstreamReadinessDiagnostics,
} from './contracts';
import { admittedCanonicalIds } from './course-coverage';
import {
  evaluateEngineeringAuthorityActivation,
  type BundleIntegrityStatus,
  type TeachingScopeStatus,
} from './authority-boundary-gate';

/**
 * Downstream readiness diagnostics only. Teaching Projection / path / facts /
 * cutover remain blocked at the teaching consumer boundary. Engineering
 * Authority is independent of CourseCoverage closure (#1265).
 * Production selectors stay Legacy until an explicit consumer cutover.
 */
export function buildDownstreamReadinessDiagnostics(input: {
  capture: CaptureIdentity;
  coverageEntries: readonly CourseCoverageDisposition[];
  crosswalks: readonly ActStructuralUnitCrosswalkRecord[];
  unresolvedUpstreamCount: number;
  shadowPublishedBindingCount: number;
  /** Optional integrity of the engineering Bundle; defaults to VALID for diagnostics. */
  bundleIntegrity?: BundleIntegrityStatus;
  /** Optional ACT teaching scope status for independent Authority diagnostics. */
  teachingScope?: TeachingScopeStatus;
  /** Explicit Engineering Authority activation request (default false). */
  explicitAuthorityActivation?: boolean;
}): DownstreamReadinessDiagnostics {
  const covered = admittedCanonicalIds(input.coverageEntries);
  const excluded = input.coverageEntries.filter(
    (row) => row.role === 'excluded_with_rationale',
  ).length;
  const validCrosswalks = input.crosswalks.filter((row) => (
    row.lifecycleState === 'CURRENT' && row.validationState === 'VALIDATED'
  )).length;
  const ragReady = validCrosswalks > 0;
  // KAQ diagnostic readiness still needs covered ACT objects; CourseCoverage
  // never equals a formal Teaching Projection publication (#1265).
  const kaqReady = covered.length > 0;
  const sarReady = kaqReady && input.shadowPublishedBindingCount > 0;
  // Default remains EMPTY / NOT_PROJECTED until an explicit teaching scope is
  // supplied. CourseCoverage dispositions alone do not publish teaching.
  const teachingScope: TeachingScopeStatus = input.teachingScope ?? 'EMPTY';
  const authorityDecision = evaluateEngineeringAuthorityActivation({
    bundleIntegrity: input.bundleIntegrity ?? 'VALID',
    explicitActivationRequested: input.explicitAuthorityActivation ?? false,
    teachingScope,
    historicalDeferPresent: false,
  });

  return {
    schemaVersion: 'aggregate-downstream-readiness/v1',
    captureRevision: input.capture.captureRevision,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    deltaReceiptId: input.capture.deltaReceiptId,
    rag: {
      ready: ragReady,
      requires: 'valid-act-structural-unit-crosswalk',
      validCrosswalkCount: validCrosswalks,
      unresolvedUpstreamCount: input.unresolvedUpstreamCount,
    },
    kaq: {
      ready: kaqReady,
      requires: 'course-coverage',
      coveredObjectCount: covered.length,
      excludedObjectCount: excluded,
    },
    sar: {
      ready: sarReady,
      requires: 'reviewed-bindings-and-kaq',
      shadowPublishedBindingCount: input.shadowPublishedBindingCount,
    },
    teachingProjection: {
      ready: authorityDecision.teachingProjection === 'PUBLISHED',
      blocked: authorityDecision.teachingProjection !== 'PUBLISHED',
      reason: authorityDecision.teachingProjection === 'PUBLISHED'
        ? 'teaching-projection-published'
        : authorityDecision.teachingProjection === 'REVIEW_REQUIRED'
          ? 'teaching-projection-review-required'
          : 'formal-teaching-projection-not-available',
    },
    path: {
      ready: false,
      blocked: true,
      reason: 'awaits-formal-teaching-projection',
    },
    facts: {
      ready: false,
      blocked: true,
      reason: 'awaits-formal-teaching-projection',
    },
    cutover: {
      ready: false,
      blocked: true,
      reason: 'production-selectors-remain-legacy',
    },
    productionSelectors: {
      candidateUnchanged: true,
      activeUnchanged: true,
      legacyUnchanged: true,
    },
    engineeringAuthority: {
      state: authorityDecision.authority,
      activeEligible: authorityDecision.authorityActiveEligible,
      teachingProjection: authorityDecision.teachingProjection,
      independentOfCourseCoverage: true,
      reasons: authorityDecision.reasons,
    },
  };
}
