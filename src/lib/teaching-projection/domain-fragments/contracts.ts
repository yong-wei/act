/**
 * Incremental domain Teaching Projection fragments (#1370).
 *
 * Append-only domain shards of reviewed core-node memberships and direct
 * ACT_TEACHING relations. Independent of Engineering Authority activation.
 */

import type { AuthorityNodeIndexEntry, PrerequisiteStrength } from '../contracts';
import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';
import { REGISTERED_PEER_DOMAIN_IDS } from '@/lib/authority-domain-catalog/contracts';

// Re-export peer domain ids for domain-fragment consumers without pulling
// PrerequisiteStrength (already exported from teaching-projection/contracts).
export { REGISTERED_PEER_DOMAIN_IDS };
export type { RegisteredPeerDomainId };

export const DOMAIN_TEACHING_FRAGMENT_CONTRACT =
  'act-domain-teaching-fragment/v1' as const;
export const DOMAIN_TEACHING_COMPOSED_MANIFEST_CONTRACT =
  'act-domain-teaching-composed-manifest/v1' as const;
export const DOMAIN_TEACHING_FRAGMENT_BUILDER_VERSION =
  'act-domain-teaching-fragment-builder/v1' as const;
export const DOMAIN_TEACHING_COMPOSITION_BUILDER_VERSION =
  'act-domain-teaching-composition-builder/v1' as const;
export const DOMAIN_TEACHING_RELATION_PRESENTATION_CONTRACT =
  'act-teaching-relation-presentation/v1' as const;
export const DOMAIN_TEACHING_ACTIVATION_CONTRACT =
  'act-domain-teaching-projection-activation/v1' as const;
export const DOMAIN_TEACHING_CURRENT_CONTRACT =
  'act-domain-teaching-projection-current/v1' as const;
export const DOMAIN_TEACHING_AUTHORITY_ENVELOPE_CONTRACT =
  'act-domain-teaching-authority-envelope/v1' as const;

export const DEFAULT_DOMAIN_FRAGMENT_AUTHORING_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/domain-fragments' as const;

export const ACT_TEACHING_LAYER = 'ACT_TEACHING' as const;

/** Coverage of optional teaching layer — never blocks Engineering Authority. */
export const TEACHING_COVERAGE_STATES = [
  'available',
  'partial',
  'empty',
  'unavailable',
] as const;

export type TeachingCoverageState = (typeof TEACHING_COVERAGE_STATES)[number];

export const DOMAIN_FRAGMENT_CORE_CARD_POLICIES = ['REQUIRED', 'OPTIONAL'] as const;
export type DomainFragmentCardPolicy =
  (typeof DOMAIN_FRAGMENT_CORE_CARD_POLICIES)[number];

export const DOMAIN_FRAGMENT_CORE_SOURCE_KINDS = [
  'OBJECTIVE',
  'PRIMARY_COVERS',
  'PREREQUISITE_ENDPOINT',
  'TEACHER_CURATION',
] as const;

export type DomainFragmentCoreSourceKind =
  (typeof DOMAIN_FRAGMENT_CORE_SOURCE_KINDS)[number];

/** Registered teaching relation kinds and presentation families (data-driven). */
export const REGISTERED_TEACHING_RELATION_TYPES = [
  'PREREQUISITE',
] as const;

export type RegisteredTeachingRelationType =
  (typeof REGISTERED_TEACHING_RELATION_TYPES)[number];

export const TEACHING_RELATION_PRESENTATION_FAMILIES = [
  'teaching-prerequisite',
] as const;

export type TeachingRelationPresentationFamily =
  (typeof TEACHING_RELATION_PRESENTATION_FAMILIES)[number];

export interface TeachingRelationPresentationContract {
  contract: typeof DOMAIN_TEACHING_RELATION_PRESENTATION_CONTRACT;
  relationType: RegisteredTeachingRelationType;
  presentationFamily: TeachingRelationPresentationFamily;
  /** Human-readable Chinese label for product surfaces. */
  labelZh: string;
  direction: 'source-to-target';
  kind: 'directed';
  supported: boolean;
}

/**
 * Runtime presentation registry. Consumers resolve by published relationType;
 * there is no per-release frontend allowlist of edge IDs.
 */
export const TEACHING_RELATION_PRESENTATION_REGISTRY: Readonly<
  Record<RegisteredTeachingRelationType, TeachingRelationPresentationContract>
> = {
  PREREQUISITE: {
    contract: DOMAIN_TEACHING_RELATION_PRESENTATION_CONTRACT,
    relationType: 'PREREQUISITE',
    presentationFamily: 'teaching-prerequisite',
    labelZh: '先修',
    direction: 'source-to-target',
    kind: 'directed',
    supported: true,
  },
};

/**
 * Authoring may accept incomplete input that the builder rejects.
 * Published fragments always carry a complete coherent binding.
 */
export interface DomainFragmentAuthorityBinding {
  releaseId: string;
  releaseSetId?: string | null;
  snapshotId?: string | null;
  snapshotHash?: string | null;
}

/** Complete Authority binding required on every published fragment/manifest. */
export interface DomainFragmentAuthorityBindingComplete {
  releaseId: string;
  releaseSetId: string;
  snapshotId: string;
  snapshotHash: string;
}

/**
 * Sealed Authority identity carried on published artifacts.
 * Does not include the node list; endpoints resolve only from the build envelope.
 */
export interface DomainFragmentAuthoritySelection {
  authorityBinding: DomainFragmentAuthorityBindingComplete;
  sourceDatasetHash: string;
  captureRevision: string;
  nodeIndexDigest: string;
}

/**
 * Live Engineering Authority selection currently activated in-repo.
 * First published domain fragment must bind exactly these facts.
 */
export const LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING = {
  releaseId: 'ctr:release:control-theory-engineering-v0.9',
  releaseSetId:
    'actkg-authoritative-candidate-25eccfea581c79a83fa95ec9dd08fa98a9eeae1cc27da1d8549b57d1bf52c6b6',
  snapshotId: 'snap-7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
  snapshotHash: '7f4cdd1084af419a3e83787661e3017662dc253a9ffc864a9bb97a96085cc4c7',
} as const satisfies DomainFragmentAuthorityBindingComplete;

export const LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION =
  '1a56317aa44e46322be0b0d1ac73948c03c5c2c0' as const;

export const LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION =
  LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION;

/** Pinned live Authority source dataset hash — not loaded from a live store. */
export const LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH =
  '0e95d1e683c31ba503293c6a67f7446efcb36f101ffcc9b64c088f28d70ebd0a' as const;

/**
 * Canonical Authority envelope used as the only build-time endpoint source.
 * nodeIndexDigest and authorityDigest are always recomputed from members.
 */
export interface DomainTeachingAuthorityEnvelope {
  contract: typeof DOMAIN_TEACHING_AUTHORITY_ENVELOPE_CONTRACT;
  binding: DomainFragmentAuthorityBindingComplete;
  sourceDatasetHash: string;
  captureRevision: string;
  authoringRevision: string;
  nodeIndexDigest: string;
  authorityDigest: string;
  nodes: readonly AuthorityNodeIndexEntry[];
}

/**
 * Independently supplied expected Authority identity for activation.
 * Callers must not use the artifact's self-asserted binding/digest as expected.
 */
export interface DomainTeachingExpectedAuthority {
  binding: DomainFragmentAuthorityBindingComplete;
  sourceDatasetHash: string;
  captureRevision: string;
  authoringRevision: string;
  nodeIndexDigest: string;
  authorityDigest?: string;
}

/** Independently supplied immutable identity checked before pointer emission. */
export interface DomainTeachingActivationExpectedIdentity {
  authority: DomainTeachingExpectedAuthority;
  projectionId: string;
  projectionHash: string;
  sourceInventoryDigest: string;
}

export interface DomainFragmentCoreNodeAuthoring {
  canonicalId: string;
  domainKeys: readonly RegisteredPeerDomainId[];
  pathEligible: boolean;
  cardPolicy: DomainFragmentCardPolicy;
  moduleId?: string | null;
  rationale: string;
  sourceKind: DomainFragmentCoreSourceKind;
  sourceEvidence: readonly string[];
}

export interface DomainFragmentRelationAuthoring {
  edgeId?: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: RegisteredTeachingRelationType | string;
  strength: PrerequisiteStrength;
  /** Domains that should surface this direct edge. */
  domainKeys: readonly RegisteredPeerDomainId[];
  evidenceRefs?: readonly string[];
  curatorId?: string | null;
  curatorRationale?: string | null;
  authorDecisionId?: string | null;
}

export interface DomainTeachingFragmentAuthoring {
  contract?: typeof DOMAIN_TEACHING_FRAGMENT_CONTRACT;
  fragmentKey: string;
  fragmentVersion: string;
  domainKeys: readonly RegisteredPeerDomainId[];
  authorityBinding: DomainFragmentAuthorityBinding;
  authoringRevision: string;
  /**
   * Optional claims. Build recomputes these from the envelope / source members
   * and rejects stale or caller-trusted mismatches.
   */
  authoritySelection?: DomainFragmentAuthoritySelection;
  captureRevision?: string;
  sourceDatasetHash?: string;
  nodeIndexDigest?: string;
  sourceInventoryDigest?: string;
  evidenceRefs?: readonly string[];
  coreNodes: readonly DomainFragmentCoreNodeAuthoring[];
  relations: readonly DomainFragmentRelationAuthoring[];
}

export interface DomainFragmentCoreNodePublished {
  canonicalId: string;
  domainKeys: RegisteredPeerDomainId[];
  pathEligible: boolean;
  cardPolicy: DomainFragmentCardPolicy;
  moduleId: string | null;
  rationale: string;
  sourceKind: DomainFragmentCoreSourceKind;
  sourceEvidence: string[];
  nodeDigest: string;
}

export interface DomainFragmentRelationPublished {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  layer: typeof ACT_TEACHING_LAYER;
  relationType: RegisteredTeachingRelationType;
  strength: PrerequisiteStrength;
  domainKeys: RegisteredPeerDomainId[];
  evidenceRefs: string[];
  curatorId: string | null;
  curatorRationale: string | null;
  authorDecisionId: string | null;
  edgeDigest: string;
  presentationFamily: TeachingRelationPresentationFamily;
}

export interface DomainTeachingFragment {
  contract: typeof DOMAIN_TEACHING_FRAGMENT_CONTRACT;
  builderVersion: typeof DOMAIN_TEACHING_FRAGMENT_BUILDER_VERSION;
  fragmentId: string;
  fragmentKey: string;
  fragmentVersion: string;
  fragmentDigest: string;
  domainKeys: RegisteredPeerDomainId[];
  authorityBinding: DomainFragmentAuthorityBindingComplete;
  authoritySelection: DomainFragmentAuthoritySelection;
  authoringRevision: string;
  sourceInventoryDigest: string;
  authorityDigest: string;
  evidenceRefs: string[];
  coreNodes: DomainFragmentCoreNodePublished[];
  relations: DomainFragmentRelationPublished[];
  coreNodeCount: number;
  relationCount: number;
}

export interface DomainFragmentRef {
  order: number;
  fragmentId: string;
  fragmentKey: string;
  fragmentVersion: string;
  fragmentDigest: string;
  sourceInventoryDigest: string;
  domainKeys: RegisteredPeerDomainId[];
}

export interface DomainCoverageReportEntry {
  domainId: RegisteredPeerDomainId;
  coverage: TeachingCoverageState;
  coreNodeCount: number;
  relationCount: number;
  uncoveredCoreNodeCount: number;
  /** Human-readable coverage note for product/diagnostics. */
  note: string;
}

export interface DomainTeachingCompositionGateFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  edgeId?: string;
  canonicalId?: string;
  fragmentId?: string;
  domainId?: string;
}

export interface DomainTeachingCompositionGate {
  status: 'PUBLISHED' | 'REVIEW_REQUIRED' | 'NOT_PROJECTED';
  passed: boolean;
  findings: DomainTeachingCompositionGateFinding[];
}

export interface DomainTeachingComposedManifest {
  contract: typeof DOMAIN_TEACHING_COMPOSED_MANIFEST_CONTRACT;
  builderVersion: typeof DOMAIN_TEACHING_COMPOSITION_BUILDER_VERSION;
  projectionId: string;
  projectionHash: string;
  authorityBinding: DomainFragmentAuthorityBindingComplete;
  authoritySelection: DomainFragmentAuthoritySelection;
  authoringRevision: string;
  sourceInventoryDigest: string;
  authorityDigest: string;
  fragments: DomainFragmentRef[];
  domainCoverage: DomainCoverageReportEntry[];
  coreNodeCount: number;
  relationCount: number;
  gateStatus: DomainTeachingCompositionGate['status'];
  gatePassed: boolean;
  sourceHashes: {
    fragments: string;
    body: string;
    sourceInventory: string;
  };
}

export interface DomainTeachingComposedArtifacts {
  fragments: DomainTeachingFragment[];
  relations: DomainFragmentRelationPublished[];
  coreNodes: DomainFragmentCoreNodePublished[];
  coverage: DomainCoverageReportEntry[];
  gate: DomainTeachingCompositionGate;
  manifest: DomainTeachingComposedManifest;
}

export interface DomainTeachingProjectionActivation {
  contract: typeof DOMAIN_TEACHING_ACTIVATION_CONTRACT;
  activationId: string;
  activationHash: string;
  projectionId: string;
  projectionHash: string;
  authorityReleaseId: string;
  authorityDigest: string;
  /** Teaching cache family identity — independent of Engineering Authority. */
  teachingCacheFamily: string;
  activatedAt: string;
  /** Engineering Authority selection is never mutated by teaching activation. */
  authoritySelectionUnchanged: true;
}

export interface DomainTeachingCurrentPointer {
  contract: typeof DOMAIN_TEACHING_CURRENT_CONTRACT;
  projectionId: string;
  projectionHash: string;
  authorityReleaseId: string;
  authorityDigest: string;
  teachingCacheFamily: string;
  activatedAt: string;
}

export function isRegisteredTeachingRelationType(
  value: string,
): value is RegisteredTeachingRelationType {
  return (REGISTERED_TEACHING_RELATION_TYPES as readonly string[]).includes(value);
}

export function isTeachingCoverageState(
  value: string,
): value is TeachingCoverageState {
  return (TEACHING_COVERAGE_STATES as readonly string[]).includes(value);
}
