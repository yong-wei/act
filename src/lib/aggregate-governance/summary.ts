import type {
  ActStructuralUnitCrosswalkRecord,
  AggregateGovernanceSummary,
  CourseCoverageDisposition,
  DownstreamReadinessDiagnostics,
  GovernanceMode,
  RevalidationReceipt,
} from './contracts';

function assertNoLocalPaths(value: unknown, path = '$'): void {
  if (typeof value === 'string') {
    if (
      value.startsWith('/Users/')
      || value.startsWith('/home/')
      || value.startsWith('/var/')
      || /^[A-Za-z]:\\/u.test(value)
    ) {
      throw new Error(`Governance summary rejected local path at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoLocalPaths(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      assertNoLocalPaths(child, `${path}.${key}`);
    }
  }
}

/**
 * Auditable summary without protected body text, answers, user ids, or local paths.
 */
export function buildAggregateGovernanceSummary(input: {
  mode: GovernanceMode;
  captureRevision: string;
  releaseSetId: string;
  releaseId: string;
  deltaReceiptId: string;
  coverageEntries: readonly CourseCoverageDisposition[];
  crosswalks: readonly ActStructuralUnitCrosswalkRecord[];
  bindings: {
    revalidated: number;
    invalidated: number;
    reviewed: number;
    shadowPublished: number;
  };
  revalidationReceipts: readonly RevalidationReceipt[];
  packagingNoop: boolean;
  readiness: DownstreamReadinessDiagnostics;
}): AggregateGovernanceSummary {
  const coverage = {
    dispositionCount: input.coverageEntries.length,
    formalObjectiveCount: input.coverageEntries.filter((r) => r.role === 'formal_objective').length,
    necessaryPrerequisiteCount: input.coverageEntries.filter((r) => r.role === 'necessary_prerequisite').length,
    explicitExtensionCount: input.coverageEntries.filter((r) => r.role === 'explicit_extension').length,
    excludedCount: input.coverageEntries.filter((r) => r.role === 'excluded_with_rationale').length,
  };
  const summary: AggregateGovernanceSummary = {
    schemaVersion: 'act-aggregate-course-resource-governance/v1',
    mode: input.mode,
    captureRevision: input.captureRevision,
    releaseSetId: input.releaseSetId,
    releaseId: input.releaseId,
    deltaReceiptId: input.deltaReceiptId,
    coverage,
    exclusions: coverage.excludedCount,
    unresolvedCrosswalks: input.crosswalks.filter((row) => (
      row.lifecycleState === 'CURRENT' && row.validationState === 'UNRESOLVED'
    )).length,
    validatedCrosswalks: input.crosswalks.filter((row) => (
      row.lifecycleState === 'CURRENT' && row.validationState === 'VALIDATED'
    )).length,
    bindings: input.bindings,
    invalidations: input.crosswalks.filter((row) => row.lifecycleState === 'STALE').length
      + input.bindings.invalidated,
    packagingNoop: input.packagingNoop,
    readiness: input.readiness,
    protectedContentIncluded: false,
    localPathsIncluded: false,
  };
  assertNoLocalPaths(summary);
  // Rationale text is allowed only as non-protected disposition metadata already
  // reviewed for authoring; summary itself keeps counts only.
  return summary;
}
