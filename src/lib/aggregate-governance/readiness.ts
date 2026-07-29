import type {
  ActStructuralUnitCrosswalkRecord,
  CaptureIdentity,
  CourseCoverageDisposition,
  DownstreamReadinessDiagnostics,
} from './contracts';
import { admittedCanonicalIds } from './course-coverage';

/**
 * Downstream readiness diagnostics only. Teaching Projection / path / facts /
 * cutover remain blocked. Production selectors stay Legacy.
 */
export function buildDownstreamReadinessDiagnostics(input: {
  capture: CaptureIdentity;
  coverageEntries: readonly CourseCoverageDisposition[];
  crosswalks: readonly ActStructuralUnitCrosswalkRecord[];
  unresolvedUpstreamCount: number;
  shadowPublishedBindingCount: number;
}): DownstreamReadinessDiagnostics {
  const covered = admittedCanonicalIds(input.coverageEntries);
  const excluded = input.coverageEntries.filter(
    (row) => row.role === 'excluded_with_rationale',
  ).length;
  const validCrosswalks = input.crosswalks.filter((row) => (
    row.lifecycleState === 'CURRENT' && row.validationState === 'VALIDATED'
  )).length;
  const ragReady = validCrosswalks > 0;
  const kaqReady = covered.length > 0;
  const sarReady = kaqReady && input.shadowPublishedBindingCount > 0;

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
      ready: false,
      blocked: true,
      reason: 'formal-teaching-projection-not-available',
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
  };
}
