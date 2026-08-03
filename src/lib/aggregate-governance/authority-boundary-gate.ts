/**
 * Pure Authority / Teaching Projection / consumer decision table (#1265).
 *
 * Engineering Authority activation is independent of CourseCoverage closure and
 * Teaching Projection readiness. Integrity failures fail closed for Authority
 * and dependent consumers. Historical DEFER never blocks Authority.
 */

import {
  type ConsumerReadinessState,
  type EngineeringAuthorityState,
  type TeachingProjectionState,
  parseConsumerReadinessState,
  parseEngineeringAuthorityState,
  parseTeachingProjectionState,
} from './authority-boundary-states';

export type BundleIntegrityStatus = 'VALID' | 'INVALID';

export type TeachingScopeStatus =
  | 'EMPTY'
  | 'PUBLISHED'
  | 'REVIEW_REQUIRED'
  | 'UNRESOLVED';

export type HistoricalDeferEffect = 'NONE';

export interface AuthorityActivationInput {
  /** Integrity of the ActKG Bundle / frozen snapshot identities. */
  bundleIntegrity: BundleIntegrityStatus;
  /**
   * Explicit activation transaction requested by an operator / staged pointer.
   * Snapshot creation alone must leave this false.
   */
  explicitActivationRequested: boolean;
  /** ACT teaching scope for the active projection (may be empty). */
  teachingScope: TeachingScopeStatus;
  /**
   * When true, a historical legacy-audit DEFER was observed for some upstream
   * object. Must never become an Authority or global consumer block.
   */
  historicalDeferPresent?: boolean;
}

export interface AuthorityActivationDecision {
  authority: EngineeringAuthorityState;
  /** True when Authority is eligible to become ACTIVE after explicit activation. */
  authorityActiveEligible: boolean;
  teachingProjection: TeachingProjectionState;
  historicalDeferEffect: HistoricalDeferEffect;
  /** Snapshot materialization never mutates selectors. */
  selectorsChangedBySnapshotCreation: 0;
  reasons: string[];
}

export interface ConsumerPackageGateInput {
  packageId: string;
  authority: EngineeringAuthorityState;
  teachingProjection: TeachingProjectionState;
  /** Local binding / resource dependency for this package only. */
  localDependencyResolved: boolean;
  /** Explicit pin to a prior valid combination. */
  pinnedPrevious?: boolean;
  /**
   * Engineering-only consumers (e.g. Engineering RAG) have no ACT resource
   * dependency and may become READY when Authority is ACTIVE.
   */
  engineeringOnly?: boolean;
}

export interface ConsumerPackageGateDecision {
  packageId: string;
  consumer: ConsumerReadinessState;
  blocksAuthority: false;
  blocksUnrelatedConsumers: false;
  reasons: string[];
}

export interface IntegrityDriftDecision {
  authority: 'REJECTED_INTEGRITY';
  consumersBlocked: true;
  selectorsAdvanced: 0;
  reasons: string[];
}

/**
 * Decision table:
 * - VALID + empty teaching + explicit activation → Authority ACTIVE-eligible / ACTIVE
 * - VALID + empty teaching without activation → VALIDATED (snapshot-neutral)
 * - INVALID → REJECTED_INTEGRITY
 * - historical DEFER → no Authority block
 * - empty/unresolved teaching → teaching NOT_PROJECTED or REVIEW_REQUIRED only
 */
export function evaluateEngineeringAuthorityActivation(
  input: AuthorityActivationInput,
): AuthorityActivationDecision {
  const reasons: string[] = [];
  const historicalDeferEffect: HistoricalDeferEffect = 'NONE';

  if (input.historicalDeferPresent) {
    reasons.push('historical-defer-audit-only');
  }

  if (input.bundleIntegrity === 'INVALID') {
    reasons.push('bundle-integrity-invalid');
    return {
      authority: parseEngineeringAuthorityState('REJECTED_INTEGRITY'),
      authorityActiveEligible: false,
      teachingProjection: teachingProjectionForScope(input.teachingScope),
      historicalDeferEffect,
      selectorsChangedBySnapshotCreation: 0,
      reasons,
    };
  }

  if (input.bundleIntegrity !== 'VALID') {
    // Fail closed on unknown integrity tokens without widening the public union.
    reasons.push('bundle-integrity-unknown');
    return {
      authority: parseEngineeringAuthorityState('REJECTED_INTEGRITY'),
      authorityActiveEligible: false,
      teachingProjection: teachingProjectionForScope(input.teachingScope),
      historicalDeferEffect,
      selectorsChangedBySnapshotCreation: 0,
      reasons,
    };
  }

  const teachingProjection = teachingProjectionForScope(input.teachingScope);
  reasons.push('bundle-integrity-valid');
  if (input.teachingScope === 'EMPTY') {
    reasons.push('teaching-scope-empty-does-not-block-authority');
  } else if (input.teachingScope === 'UNRESOLVED' || input.teachingScope === 'REVIEW_REQUIRED') {
    reasons.push('teaching-unresolved-local-only');
  } else {
    reasons.push('teaching-published');
  }

  if (input.explicitActivationRequested) {
    reasons.push('explicit-authority-activation');
    return {
      authority: parseEngineeringAuthorityState('ACTIVE'),
      authorityActiveEligible: true,
      teachingProjection,
      historicalDeferEffect,
      selectorsChangedBySnapshotCreation: 0,
      reasons,
    };
  }

  reasons.push('snapshot-selector-neutral');
  return {
    authority: parseEngineeringAuthorityState('VALIDATED'),
    authorityActiveEligible: true,
    teachingProjection,
    historicalDeferEffect,
    selectorsChangedBySnapshotCreation: 0,
    reasons,
  };
}

function teachingProjectionForScope(scope: TeachingScopeStatus): TeachingProjectionState {
  if (scope === 'PUBLISHED') return parseTeachingProjectionState('PUBLISHED');
  if (scope === 'REVIEW_REQUIRED' || scope === 'UNRESOLVED') {
    return parseTeachingProjectionState('REVIEW_REQUIRED');
  }
  return parseTeachingProjectionState('NOT_PROJECTED');
}

/** Integrity drift always fail-closes Authority and freezes dependent consumers. */
export function evaluateIntegrityDrift(input: {
  driftedFields: readonly string[];
}): IntegrityDriftDecision {
  const fields = [...new Set(input.driftedFields.filter((field) => field.trim().length > 0))].sort();
  return {
    authority: 'REJECTED_INTEGRITY',
    consumersBlocked: true,
    selectorsAdvanced: 0,
    reasons: fields.length > 0
      ? fields.map((field) => `integrity-drift:${field}`)
      : ['integrity-drift'],
  };
}

/**
 * Consumer package gate: unresolved local deps block only this package.
 * Engineering Authority is never blocked by local teaching dependencies.
 */
export function evaluateConsumerPackageGate(
  input: ConsumerPackageGateInput,
): ConsumerPackageGateDecision {
  const reasons: string[] = [];
  const authority = parseEngineeringAuthorityState(input.authority);
  const teaching = parseTeachingProjectionState(input.teachingProjection);

  if (authority === 'REJECTED_INTEGRITY') {
    reasons.push('authority-rejected-integrity');
    return {
      packageId: input.packageId,
      consumer: parseConsumerReadinessState('BLOCKED_LOCAL_DEPENDENCY'),
      blocksAuthority: false,
      blocksUnrelatedConsumers: false,
      reasons,
    };
  }

  if (input.engineeringOnly) {
    if (authority === 'ACTIVE') {
      reasons.push('engineering-only-consumer-ready');
      return {
        packageId: input.packageId,
        consumer: parseConsumerReadinessState('READY'),
        blocksAuthority: false,
        blocksUnrelatedConsumers: false,
        reasons,
      };
    }
    reasons.push('engineering-authority-not-active');
    return {
      packageId: input.packageId,
      consumer: parseConsumerReadinessState(
        input.pinnedPrevious ? 'PINNED_PREVIOUS' : 'BLOCKED_LOCAL_DEPENDENCY',
      ),
      blocksAuthority: false,
      blocksUnrelatedConsumers: false,
      reasons,
    };
  }

  if (teaching === 'NOT_PROJECTED' || teaching === 'REVIEW_REQUIRED') {
    reasons.push(
      teaching === 'NOT_PROJECTED'
        ? 'teaching-not-projected'
        : 'teaching-review-required',
    );
    return {
      packageId: input.packageId,
      consumer: parseConsumerReadinessState(
        input.pinnedPrevious ? 'PINNED_PREVIOUS' : 'BLOCKED_LOCAL_DEPENDENCY',
      ),
      blocksAuthority: false,
      blocksUnrelatedConsumers: false,
      reasons,
    };
  }

  if (!input.localDependencyResolved) {
    reasons.push('local-binding-unresolved');
    return {
      packageId: input.packageId,
      consumer: parseConsumerReadinessState(
        input.pinnedPrevious ? 'PINNED_PREVIOUS' : 'BLOCKED_LOCAL_DEPENDENCY',
      ),
      blocksAuthority: false,
      blocksUnrelatedConsumers: false,
      reasons,
    };
  }

  if (authority !== 'ACTIVE') {
    reasons.push('engineering-authority-not-active');
    return {
      packageId: input.packageId,
      consumer: parseConsumerReadinessState(
        input.pinnedPrevious ? 'PINNED_PREVIOUS' : 'BLOCKED_LOCAL_DEPENDENCY',
      ),
      blocksAuthority: false,
      blocksUnrelatedConsumers: false,
      reasons,
    };
  }

  reasons.push('local-dependencies-ready');
  return {
    packageId: input.packageId,
    consumer: parseConsumerReadinessState('READY'),
    blocksAuthority: false,
    blocksUnrelatedConsumers: false,
    reasons,
  };
}

/**
 * ACT teaching denominator resolution: only explicitly selected ACT-bound
 * resources/core nodes. Unprojected upstream objects remain outside.
 */
export function resolveActTeachingDenominator(input: {
  actBoundCanonicalIds: readonly string[];
  upstreamCanonicalIds: readonly string[];
}): {
  denominator: string[];
  unprojectedUpstream: string[];
  empty: boolean;
} {
  const act = uniqueSorted(input.actBoundCanonicalIds);
  const upstream = new Set(
    input.upstreamCanonicalIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );
  // When upstream list is provided, only keep IDs that exist upstream; otherwise
  // treat the ACT-bound set as the selected teaching scope as-is.
  const resolved = input.upstreamCanonicalIds.length === 0
    ? act
    : act.filter((id) => upstream.has(id));
  const inScope = new Set(resolved);
  const unprojectedUpstream = uniqueSorted(
    input.upstreamCanonicalIds.filter((id) => {
      const trimmed = id.trim();
      return trimmed.length > 0 && !inScope.has(trimmed);
    }),
  );
  return {
    denominator: resolved,
    unprojectedUpstream,
    empty: resolved.length === 0,
  };
}

/**
 * Historical legacy DEFER rows never create Authority or selector blocks.
 */
export function evaluateHistoricalDeferImpact(input: {
  deferCount: number;
  includeCount: number;
}): {
  authorityBlock: false;
  selectorBlock: false;
  worklistRowsCreated: 0;
  auditOnly: true;
  deferCount: number;
  includeCount: number;
} {
  return {
    authorityBlock: false,
    selectorBlock: false,
    worklistRowsCreated: 0,
    auditOnly: true,
    deferCount: input.deferCount,
    includeCount: input.includeCount,
  };
}

/**
 * Declared snapshot diagnostics: independent Authority vs teaching dependencies.
 * Snapshot creation remains selector-neutral.
 */
export function buildDeclaredSnapshotAuthorityDiagnostics(input: {
  bundleIntegrity: BundleIntegrityStatus;
  explicitActivationRequested: boolean;
  teachingScope: TeachingScopeStatus;
  historicalDeferPresent?: boolean;
}): {
  snapshotSelectorNeutral: true;
  authority: AuthorityActivationDecision;
  engineeringAuthorityIndependentOfCourseCoverage: true;
  teachingDoesNotGateAuthority: true;
} {
  return {
    snapshotSelectorNeutral: true,
    authority: evaluateEngineeringAuthorityActivation(input),
    engineeringAuthorityIndependentOfCourseCoverage: true,
    teachingDoesNotGateAuthority: true,
  };
}

function uniqueSorted(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))]
    .sort((a, b) => a.localeCompare(b));
}
