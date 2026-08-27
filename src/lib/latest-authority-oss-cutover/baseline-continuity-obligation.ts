/**
 * Baseline continuity obligations for a coordinated cutover.
 *
 * The active Runtime is an inventory, not a claim that every registered
 * projection is independently teachable. This ledger therefore preserves all
 * logical resources while requiring formal atomic binding only for resources
 * that can enter a current learner path. Every other row has an explicit,
 * hash-bound non-teaching, supporting, or catalog-only disposition.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  BASELINE_CONTINUITY_OBLIGATION_CONTRACT,
  LatestAuthorityCutoverError,
  type ActiveBaseline,
  type ResourceContinuityObligationKind,
  type ResourceSuccessorDisposition,
} from './contracts';

export type BaselineObligationSourceKind =
  | 'CURRENT_COURSE_PATH'
  | 'RUNTIME_RESOURCE_NODE'
  | 'RUNTIME_SUPPORT'
  | 'CATALOG_ENTRY';

export interface ReopenedFormalProjectionEvidence {
  readonly resourceId: string;
  readonly sourceContentSha256: string | null;
  readonly projectionStatus: 'BOUND' | 'EXPLICIT_NONE';
  readonly canonicalBindingCount: number;
  readonly atomicDispositionsComplete: boolean;
  readonly launchContractQualified: boolean;
  readonly evidenceHash: string;
}

export interface BaselineObligationSource {
  readonly resourceId: string;
  readonly sourceKind: BaselineObligationSourceKind;
  readonly sourceIdentity: string;
  readonly sourceContentSha256: string | null;
  /** Active course membership independently establishes a teaching obligation. */
  readonly teachingRequired: boolean;
  readonly currentPathEligible: boolean;
  readonly formalProjection: ReopenedFormalProjectionEvidence | null;
}

export interface BaselineContinuityObligation {
  readonly resourceId: string;
  readonly obligation: ResourceContinuityObligationKind;
  readonly sourceIdentity: string;
  readonly sourceContentSha256: string | null;
  readonly currentPathEligible: boolean;
  readonly formalProjectionEvidenceHash: string | null;
  readonly evidenceHash: string;
  readonly disposition: ResourceSuccessorDisposition;
}

export interface BaselineContinuityObligationLedger {
  readonly contract: typeof BASELINE_CONTINUITY_OBLIGATION_CONTRACT;
  readonly baselineHash: string;
  readonly entries: readonly BaselineContinuityObligation[];
  readonly summary: Readonly<Record<ResourceContinuityObligationKind, number>>;
  readonly obligationHash: string;
}

function fail(code: string, message: string): never {
  throw new LatestAuthorityCutoverError(code, message);
}

function isSha256(value: string | null): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function matchesFormalSource(
  source: BaselineObligationSource,
  formal: ReopenedFormalProjectionEvidence,
): boolean {
  return source.sourceContentSha256 !== null
    && formal.sourceContentSha256 !== null
    && source.sourceContentSha256 === formal.sourceContentSha256;
}

function obligationFor(source: BaselineObligationSource): ResourceContinuityObligationKind {
  if (source.currentPathEligible || source.teachingRequired) {
    return 'FORMAL_TEACHING';
  }
  if (source.formalProjection?.projectionStatus === 'EXPLICIT_NONE'
    && matchesFormalSource(source, source.formalProjection)) {
    return 'FORMAL_EXPLICIT_NONE';
  }
  return source.sourceKind === 'CATALOG_ENTRY' ? 'CATALOG_ONLY' : 'RUNTIME_SUPPORT';
}

function dispositionFor(input: {
  source: BaselineObligationSource;
  obligation: ResourceContinuityObligationKind;
  evidenceHash: string;
}): ResourceSuccessorDisposition {
  const { source, obligation, evidenceHash } = input;
  const formal = source.formalProjection;
  if (obligation === 'FORMAL_TEACHING') {
    const reusable = formal !== null
      && formal.projectionStatus === 'BOUND'
      && formal.canonicalBindingCount > 0
      && matchesFormalSource(source, formal);
    return {
      resourceId: source.resourceId,
      obligation,
      obligationEvidenceHash: reusable ? formal.evidenceHash : evidenceHash,
      currentPathEligible: source.currentPathEligible,
      atomicDispositionsComplete: reusable && formal.atomicDispositionsComplete,
      canonicalBindingCount: reusable ? formal.canonicalBindingCount : 0,
      launchContractQualified: reusable && formal.launchContractQualified,
      failureKinds: [],
    };
  }

  if (obligation === 'FORMAL_EXPLICIT_NONE') {
    const reusable = formal !== null
      && formal.projectionStatus === 'EXPLICIT_NONE'
      && formal.canonicalBindingCount === 0
      && matchesFormalSource(source, formal);
    return {
      resourceId: source.resourceId,
      obligation,
      obligationEvidenceHash: reusable ? formal.evidenceHash : evidenceHash,
      currentPathEligible: false,
      atomicDispositionsComplete: reusable,
      canonicalBindingCount: 0,
      launchContractQualified: reusable && formal.launchContractQualified,
      failureKinds: reusable ? [] : ['incomplete-atomic-dispositions'],
    };
  }

  return {
    resourceId: source.resourceId,
    obligation,
    obligationEvidenceHash: evidenceHash,
    currentPathEligible: false,
    atomicDispositionsComplete: true,
    canonicalBindingCount: 0,
    launchContractQualified: true,
    failureKinds: [],
  };
}

/**
 * Derive exactly one obligation for each baseline resource. A path promotion
 * is deliberately not cache-compatible with an old support disposition.
 */
export function buildBaselineContinuityObligationLedger(input: {
  readonly baseline: ActiveBaseline;
  readonly sources: readonly BaselineObligationSource[];
}): BaselineContinuityObligationLedger {
  const resourceIds = input.baseline.entries
    .filter((entry) => entry.classification === 'resource' && entry.resourceId !== null)
    .map((entry) => entry.resourceId as string)
    .sort((left, right) => left.localeCompare(right));
  const sourceByResourceId = new Map(input.sources.map((source) => [source.resourceId, source]));
  if (sourceByResourceId.size !== input.sources.length) {
    fail('baseline-obligation-duplicate', 'Baseline obligation sources must not repeat a resource id.');
  }
  const unexpected = input.sources
    .map((source) => source.resourceId)
    .filter((resourceId) => !resourceIds.includes(resourceId));
  if (unexpected.length > 0) {
    fail('baseline-obligation-unexpected', `Obligation sources are outside the frozen baseline: ${unexpected.join(', ')}`);
  }

  const entries = resourceIds.map((resourceId) => {
    const source = sourceByResourceId.get(resourceId);
    if (!source) {
      fail('baseline-obligation-missing', `Baseline resource ${resourceId} has no continuity obligation source.`);
    }
    if (!source.sourceIdentity) {
      fail('baseline-obligation-source-missing', `Baseline resource ${resourceId} has no source identity.`);
    }
    if (source.formalProjection && !isSha256(source.formalProjection.evidenceHash)) {
      fail('baseline-obligation-evidence-invalid', `Formal projection evidence for ${resourceId} is not hash-bound.`);
    }
    const obligation = obligationFor(source);
    const evidenceHash = projectionDigest({
      contract: BASELINE_CONTINUITY_OBLIGATION_CONTRACT,
      resourceId,
      obligation,
      sourceKind: source.sourceKind,
      sourceIdentity: source.sourceIdentity,
      sourceContentSha256: source.sourceContentSha256,
      teachingRequired: source.teachingRequired,
      currentPathEligible: source.currentPathEligible,
      formalProjection: source.formalProjection,
    });
    return {
      resourceId,
      obligation,
      sourceIdentity: source.sourceIdentity,
      sourceContentSha256: source.sourceContentSha256,
      currentPathEligible: source.currentPathEligible,
      formalProjectionEvidenceHash: source.formalProjection?.evidenceHash ?? null,
      evidenceHash,
      disposition: dispositionFor({ source, obligation, evidenceHash }),
    } satisfies BaselineContinuityObligation;
  });
  const summary = {
    FORMAL_TEACHING: entries.filter((entry) => entry.obligation === 'FORMAL_TEACHING').length,
    FORMAL_EXPLICIT_NONE: entries.filter((entry) => entry.obligation === 'FORMAL_EXPLICIT_NONE').length,
    RUNTIME_SUPPORT: entries.filter((entry) => entry.obligation === 'RUNTIME_SUPPORT').length,
    CATALOG_ONLY: entries.filter((entry) => entry.obligation === 'CATALOG_ONLY').length,
  } as const;
  const obligationHash = projectionDigest({
    contract: BASELINE_CONTINUITY_OBLIGATION_CONTRACT,
    baselineHash: input.baseline.baselineHash,
    entries,
    summary,
  });
  return {
    contract: BASELINE_CONTINUITY_OBLIGATION_CONTRACT,
    baselineHash: input.baseline.baselineHash,
    entries,
    summary,
    obligationHash,
  };
}
