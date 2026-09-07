/**
 * Canonical RAG shadow retrieval contracts (#1112).
 *
 * Graph signals only emit candidate identities and governed structural seeds.
 * Final/numbered shadow citations require Source Pack adjudication.
 * Every executable member carries a complete CandidateContextFingerprint.
 */

import { CTKG_0_2_PROJECTED_ENTITY_TYPES } from '@/lib/authoritative-knowledge/contracts';
import type {
  ActStructuralUnitCrosswalkRecord,
  CrosswalkValidationState,
  GovernanceLifecycleState,
} from '@/lib/aggregate-governance/contracts';

import type { CandidateContextFingerprint } from './context-fingerprint';
import {
  RAG_SUPPORTED_PREDICATES,
  type RagSupportedPredicate,
} from './predicate-adapters';

export const CANONICAL_RAG_SCHEMA_VERSION = 'act-canonical-rag-shadow/v1' as const;
export const CANONICAL_RAG_CONSUMER_ID = 'canonical-rag-shadow' as const;
export const RAG_CUTOVER_AUTHORITY_SCHEMA_VERSION = 'act-rag-cutover-authority/v1' as const;

export type RagAuthorityMode = 'LEGACY' | 'CANONICAL_SHADOW' | 'CANONICAL';

export type RagAuthorityConsumer =
  | 'PRODUCTION_ANSWER'
  | 'SHADOW_COMPARISON'
  | 'OFFLINE_EVAL'
  | 'CUTOVER_ACTIVATION';

export type RagAuthoritySelector =
  | {
      consumer: 'PRODUCTION_ANSWER';
      authority: 'LEGACY';
      productionAuthoritative: true;
      canonicalExpansionVisible: false;
      allowsLegacyFallback: true;
    }
  | {
      /** #2047 授权切换后的生产 composed 权威（可拨回 LEGACY，无数据迁移）。 */
      consumer: 'PRODUCTION_ANSWER';
      authority: 'CANONICAL';
      productionAuthoritative: true;
      canonicalExpansionVisible: true;
      allowsLegacyFallback: true;
      productionChannel: 'canonical-composed';
    }
  | {
      consumer: 'SHADOW_COMPARISON' | 'OFFLINE_EVAL';
      authority: 'CANONICAL_SHADOW';
      productionAuthoritative: false;
      canonicalExpansionVisible: true;
      allowsLegacyFallback: false;
    }
  | {
      consumer: 'CUTOVER_ACTIVATION';
      authority: 'CANONICAL';
      productionAuthoritative: true;
      canonicalExpansionVisible: true;
      allowsLegacyFallback: false;
      cutoverReceiptId: string;
    };

export interface RagCutoverAuthorityReceipt {
  schemaVersion: typeof RAG_CUTOVER_AUTHORITY_SCHEMA_VERSION;
  receiptId: string;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  captureRevision: string;
  authorityDigest: string;
  activatedAt: string;
}

export type RagSupportedObjectType = (typeof CTKG_0_2_PROJECTED_ENTITY_TYPES)[number];

export const RAG_SUPPORTED_OBJECT_TYPES = Object.freeze([
  ...CTKG_0_2_PROJECTED_ENTITY_TYPES,
] as const);

export { RAG_SUPPORTED_PREDICATES };
export type { RagSupportedPredicate };
export type { CandidateContextFingerprint };

export const RAG_CONSUMER_SEMANTIC_SUPPORT = Object.freeze({
  consumerId: CANONICAL_RAG_CONSUMER_ID,
  supportedObjectTypes: RAG_SUPPORTED_OBJECT_TYPES,
  supportedPredicates: RAG_SUPPORTED_PREDICATES,
});

export const RAG_EXPANSION_DEFAULTS = Object.freeze({
  maxHops: 1 as const,
  maxSeeds: 8 as const,
  maxExpandedObjects: 16 as const,
  maxUpstreamSeedsPerObject: 8 as const,
  maxFinalCitationSeeds: 12 as const,
  latencyBudgetMs: 250 as const,
  harnessLatencyBudgetMs: 2_000 as const,
});

/**
 * Complete candidate context for executable shadow.
 * Alias of CandidateContextFingerprint (all fields required).
 */
export type CanonicalRagReleaseContext = CandidateContextFingerprint;

/**
 * Every executable member carries the complete fingerprint.
 * Partial membership is not representable.
 */
export type VersionBoundMembership = CandidateContextFingerprint;

/**
 * Raw Prisma Crosswalk is never executable alone.
 * Only a version-bound wrapper joined to an authoritative snapshot is consumed.
 */
export interface VersionBoundCrosswalk extends CandidateContextFingerprint {
  /** Opaque raw governance row (endpoint fields only; context is on the wrapper). */
  row: ActStructuralUnitCrosswalkRecord;
}

/** @deprecated Use VersionBoundCrosswalk. Kept as alias for resolution code. */
export type ActCrosswalkTarget = VersionBoundCrosswalk;

export type { CrosswalkValidationState, GovernanceLifecycleState };

export interface ActStructuralCitationTarget extends CandidateContextFingerprint {
  structuralUnitId: string;
  structuralUnitVersion: string;
  structuralUnitHash: string;
  retrievalChunkId: string;
  citationTargetId: string;
  sourceEditionId: string;
  sourceVersion: string;
  evidenceContentHash: string;
  atomicResourceId: string;
  resourceId: string;
  segmentId: string;
  resourceSegmentHash: string;
  /** Same as coverageCaptureRevision on the fingerprint; kept for endpoint compare. */
  captureRevision: string;
  locator: string | null;
  href: string | null;
  displayTitle: string;
  readable: boolean;
  observationSource:
    | 'act-textbook-index'
    | 'act-inventory'
    | 'act-retrieval-chunk'
    | 'derived-from-independent-observations';
}

export interface CanonicalRagObject extends CandidateContextFingerprint {
  canonicalId: string;
  canonicalType: string;
  label: string;
  aliases: readonly string[];
  summary?: string | null;
}

export interface CanonicalRagRelation extends CandidateContextFingerprint {
  relationId: string;
  predicate: string;
  sourceId: string;
  targetId: string;
}

export interface CanonicalRagCoverageEntry extends CandidateContextFingerprint {
  canonicalId: string;
  role: 'formal_objective' | 'necessary_prerequisite' | 'explicit_extension' | 'excluded_with_rationale';
}

export interface UpstreamRagReferenceSeed {
  publishedEntityId: string;
  retrievalChunkId: string;
  citationTargetId: string;
  canonicalId?: string | null;
  /** Mandatory complete context fingerprint. */
  context: CandidateContextFingerprint;
}

export type EntityAlignmentMatchKind =
  | 'canonical-id'
  | 'exact-name'
  | 'exact-alias'
  | 'in-query-name'
  | 'in-query-alias'
  | 'normalized-name'
  | 'normalized-alias';

export interface EntityAlignmentHit {
  canonicalId: string;
  canonicalType: string;
  label: string;
  matchKind: EntityAlignmentMatchKind;
  matchedTerm: string;
  coverageRole: CanonicalRagCoverageEntry['role'];
  releaseSetId: string;
  releaseId: string;
  contextDigest: string;
}

export type ExpansionSkipReason =
  | 'unsupported-predicate'
  | 'wrong-direction'
  | 'hop-limit'
  | 'outside-coverage'
  | 'unsupported-object-type'
  | 'budget-exhausted'
  | 'self-loop';

export interface RelationExpansionStep {
  fromCanonicalId: string;
  toCanonicalId: string | null;
  relationId: string;
  predicate: string;
  hop: number;
  supported: boolean;
  skipReason: ExpansionSkipReason | null;
}

export interface RelationExpansionResult {
  seedCanonicalIds: string[];
  expandedCanonicalIds: string[];
  steps: RelationExpansionStep[];
  skippedUnsupportedPredicates: string[];
  skippedWrongDirection: number;
  truncated: boolean;
}

export type CrosswalkResolutionStatus =
  | 'resolved'
  | 'missing-crosswalk'
  | 'drifted-crosswalk'
  | 'endpoint-mismatch'
  | 'unreadable-structural-unit'
  | 'version-mismatch'
  | 'upstream-not-object';

export interface CrosswalkResolutionDiagnostic {
  code:
    | 'missing-crosswalk'
    | 'drifted-crosswalk'
    | 'endpoint-mismatch'
    | 'unreadable-structural-unit'
    | 'version-mismatch'
    | 'upstream-not-object'
    | 'legacy-fallback-forbidden'
    | 'graph-summary-rejected'
    | 'relation-rejected'
    | 'unresolved-upstream-rejected'
    | 'incomplete-version-context'
    | 'mixed-version-context'
    | 'missing-upstream-context'
    | 'cutover-not-implemented'
    | 'cutover-local-activation-forbidden';
  field?: string | null;
  publishedEntityId?: string | null;
  retrievalChunkId?: string | null;
  citationTargetId?: string | null;
  canonicalId?: string | null;
  message: string;
}

export interface CrosswalkResolutionOutcome {
  status: CrosswalkResolutionStatus;
  upstream: UpstreamRagReferenceSeed;
  crosswalk: VersionBoundCrosswalk | null;
  structuralTarget: ActStructuralCitationTarget | null;
  diagnostics: CrosswalkResolutionDiagnostic[];
}

export type FinalEvidenceKind =
  | 'act-structural-unit'
  | 'graph-summary'
  | 'graph-relation'
  | 'unresolved-upstream'
  | 'legacy-fallback'
  | 'ungated-crosswalk-seed';

export interface FinalEvidenceCandidate {
  kind: FinalEvidenceKind;
  id: string;
  citable: boolean;
  structuralTarget?: ActStructuralCitationTarget | null;
  canonicalId?: string | null;
  summary?: string | null;
  upstream?: UpstreamRagReferenceSeed | null;
}

export interface NumberedCitation {
  number: number;
  structuralUnitId: string;
  retrievalChunkId: string;
  citationTargetId: string;
  displayTitle: string;
  locator: string | null;
  href: string | null;
  sourceEditionId: string;
}

export interface CanonicalRagShadowDiagnostics {
  schemaVersion: typeof CANONICAL_RAG_SCHEMA_VERSION;
  authority: RagAuthoritySelector;
  release: CanonicalRagReleaseContext;
  entityAlignmentHits: EntityAlignmentHit[];
  expansion: RelationExpansionResult;
  crosswalkOutcomes: CrosswalkResolutionOutcome[];
  rejectedEvidence: FinalEvidenceCandidate[];
  numberedCitations: NumberedCitation[];
  latencyMs: number;
  withinLatencyBudget: boolean;
  latencyBudgetMs: number;
  productionUsesCanonical: boolean;
  shadowSeparated: boolean;
  comparison?: {
    legacyCandidateIds: string[];
    canonicalCandidateIds: string[];
    onlyInLegacy: string[];
    onlyInCanonical: string[];
    shared: string[];
  };
}

export interface CanonicalRagShadowInput {
  query: string;
  release: CanonicalRagReleaseContext;
  objects: readonly CanonicalRagObject[];
  relations: readonly CanonicalRagRelation[];
  coverage: readonly CanonicalRagCoverageEntry[];
  upstreamByCanonicalId: ReadonlyMap<string, readonly UpstreamRagReferenceSeed[]>;
  crosswalks: readonly VersionBoundCrosswalk[];
  structuralUnits: readonly ActStructuralCitationTarget[];
  legacyCandidateIds?: readonly string[];
  authorityConsumer?: RagAuthorityConsumer;
  cutoverReceipt?: RagCutoverAuthorityReceipt | null;
  maxHops?: 0 | 1 | 2;
  maxSeeds?: number;
  maxExpandedObjects?: number;
  latencyBudgetMs?: number;
  now?: () => number;
}

export type CanonicalRagShadowStatus =
  | 'shadow-seeds-recorded'
  | 'legacy-only'
  | 'cutover-fail-closed'
  | 'version-context-rejected';

export interface CanonicalRagShadowResult {
  status: CanonicalRagShadowStatus;
  authority: RagAuthoritySelector;
  candidateCanonicalIds: string[];
  governedStructuralSeeds: ActStructuralCitationTarget[];
  numberedCitations: [];
  diagnostics: CanonicalRagShadowDiagnostics;
}
