/**
 * ACT Teaching Projection contracts (#1267).
 *
 * Authoring is the decision source; runtime is generated, read-only output.
 * Independent of Engineering Authority semantic content.
 */

import type { TeachingProjectionState } from '@/lib/aggregate-governance/authority-boundary-states';

export const TEACHING_PROJECTION_AUTHORING_CONTRACT =
  'act-teaching-projection-authoring/v1' as const;
export const TEACHING_PROJECTION_RUNTIME_CONTRACT =
  'act-teaching-projection-runtime/v1' as const;
export const TEACHING_PROJECTION_MANIFEST_CONTRACT =
  'act-teaching-projection-manifest/v1' as const;
export const TEACHING_PROJECTION_ACTIVATION_CONTRACT =
  'act-teaching-projection-activation/v1' as const;
export const TEACHING_PROJECTION_BUILDER_VERSION =
  'act-teaching-projection-builder/v1' as const;

export const DEFAULT_TEACHING_PROJECTION_AUTHORING_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection' as const;
export const DEFAULT_TEACHING_PROJECTION_RUNTIME_RELATIVE =
  'course-content/runtime/knowledge/projection' as const;

/** Binding roles owned by ACT teaching projection. */
export const TEACHING_PROJECTION_ROLES = [
  'COVERS',
  'EXPLAINS',
  'PRACTICES',
  'ASSESSES',
] as const;

export type TeachingProjectionRole = (typeof TEACHING_PROJECTION_ROLES)[number];

/** Local gate modes for in-scope resources. */
export const TEACHING_PROJECTION_MODES = [
  'REQUIRED',
  'OPTIONAL',
  'NONE',
] as const;

export type TeachingProjectionMode = (typeof TEACHING_PROJECTION_MODES)[number];

export const TEACHING_RESOURCE_TYPES = [
  'lesson',
  'handout',
  'step',
  'textbook',
  'textbook-chapter',
  'textbook-section',
  'card',
  'infographic',
  'video',
  'audio',
  'podcast',
  'slides',
  'exercise',
  'simulation',
  'project',
] as const;

export type TeachingResourceType = (typeof TEACHING_RESOURCE_TYPES)[number];

export const PREREQUISITE_STRENGTHS = ['REQUIRED', 'RECOMMENDED'] as const;
export type PrerequisiteStrength = (typeof PREREQUISITE_STRENGTHS)[number];

export const AUTHORITY_NODE_LIFECYCLES = [
  'active',
  'retired',
  'draft',
] as const;

export type AuthorityNodeLifecycle = (typeof AUTHORITY_NODE_LIFECYCLES)[number];

// ---------------------------------------------------------------------------
// Authoring inputs (decision source)
// ---------------------------------------------------------------------------

/** Authoring knowledgeRefs entry on course/handout/lesson/step records (#1268). */
export interface TeachingKnowledgeRefAuthoring {
  canonicalId: string;
  role: TeachingProjectionRole;
  primary?: boolean;
  rationale?: string;
  sourcePath?: string;
}

export interface TeachingResourceAuthoring {
  /** Precomputed stable resource ID, or keys used to derive it. */
  resourceId?: string;
  resourceType: TeachingResourceType;
  lessonKey?: string;
  stepId?: string;
  sourceDocumentId?: string;
  chapterKey?: string;
  sectionId?: string;
  cardId?: string;
  projectionMode: TeachingProjectionMode;
  scopeId: string;
  /** Optional human label for diagnostics. */
  title?: string;
  /** Authoring source path for audit. */
  sourcePath?: string;
  /** Legacy crosswalk reference (preserved, not inferred). */
  legacyCrosswalkRef?: string | null;
  /**
   * Explicit Canonical bindings decided in authoring (#1268).
   * Migration expands these into runtime bindings; do not hand-edit runtime.
   */
  knowledgeRefs?: TeachingKnowledgeRefAuthoring[];
}

export interface TeachingBindingAuthoring {
  resourceId: string;
  canonicalId: string;
  role: TeachingProjectionRole;
  scopeId: string;
  sourcePath?: string;
  primary?: boolean;
  rationale?: string;
}

export interface TeachingPrerequisiteAuthoring {
  prerequisiteId?: string;
  sourceCanonicalId: string;
  targetCanonicalId: string;
  strength: PrerequisiteStrength;
  evidenceRef?: string | null;
  rationale?: string | null;
  scopeId?: string;
}

export interface TeachingCoreNodeAuthoring {
  canonicalId: string;
  pathEligible: boolean;
  cardPolicy: 'required' | 'optional' | 'none';
  moduleId?: string | null;
  scopeId: string;
  rationale?: string | null;
}

export interface TeachingCardAuthoring {
  cardId: string;
  canonicalId: string;
  active: boolean;
  required: boolean;
  sourcePath?: string;
  title?: string;
}

/**
 * Authority node index supplied by the pinned Engineering Authority release.
 * Used only for endpoint validity; unreferenced nodes stay NOT_PROJECTED.
 */
export interface AuthorityNodeIndexEntry {
  canonicalId: string;
  lifecycleStatus: AuthorityNodeLifecycle | string;
  /** Successor when lifecycle is retired. */
  successorCanonicalId?: string | null;
}

export interface TeachingProjectionAuthoringInput {
  contract?: typeof TEACHING_PROJECTION_AUTHORING_CONTRACT;
  /** Stable scope for this projection build (e.g. course package id). */
  scopeId: string;
  /** Authoring git revision (40-char hex preferred). */
  authoringRevision: string;
  /** Pinned Engineering Authority release identity. */
  authorityReleaseId: string;
  authorityReleaseSetId?: string | null;
  authoritySnapshotId?: string | null;
  authoritySnapshotHash?: string | null;
  resources?: readonly TeachingResourceAuthoring[];
  bindings?: readonly TeachingBindingAuthoring[];
  prerequisites?: readonly TeachingPrerequisiteAuthoring[];
  coreNodes?: readonly TeachingCoreNodeAuthoring[];
  cards?: readonly TeachingCardAuthoring[];
  /**
   * Canonical IDs known in the pinned Authority release.
   * Nodes not listed are invalid endpoints.
   */
  authorityNodes?: readonly AuthorityNodeIndexEntry[];
}

// ---------------------------------------------------------------------------
// Runtime records (generated)
// ---------------------------------------------------------------------------

/**
 * Runtime resource status projected from authoring (#1268).
 * BOUND = has binding; EXPLICIT_NONE = NONE mode or optional unbound;
 * REVIEW_REQUIRED is package-gate level (REQUIRED unbound).
 */
export type TeachingResourceProjectionStatus =
  | 'BOUND'
  | 'EXPLICIT_NONE'
  | 'UNBOUND';

export interface TeachingResourceRuntime {
  resourceId: string;
  resourceType: TeachingResourceType;
  projectionMode: TeachingProjectionMode;
  scopeId: string;
  title: string | null;
  sourcePath: string | null;
  legacyCrosswalkRef: string | null;
  bindingCount: number;
  bindingStatus: 'BOUND' | 'UNBOUND' | 'NONE';
  /** Deterministic status field for consumers (#1268). */
  projectionStatus: TeachingResourceProjectionStatus;
  /** Digest of bound Canonical IDs + roles for this resource (empty when unbound). */
  bindingDigest: string | null;
}

export interface TeachingBindingRuntime {
  bindingId: string;
  resourceId: string;
  canonicalId: string;
  role: TeachingProjectionRole;
  scopeId: string;
  sourcePath: string | null;
  primary: boolean;
  rationale: string | null;
}

export interface TeachingPrerequisiteRuntime {
  prerequisiteId: string;
  sourceCanonicalId: string;
  targetCanonicalId: string;
  strength: PrerequisiteStrength;
  evidenceRef: string | null;
  rationale: string | null;
  scopeId: string | null;
}

export interface TeachingCoreNodeRuntime {
  canonicalId: string;
  pathEligible: boolean;
  cardPolicy: 'required' | 'optional' | 'none';
  moduleId: string | null;
  scopeId: string;
  rationale: string | null;
  projectionStatus: 'PROJECTED' | 'NOT_PROJECTED';
}

export interface TeachingCardIndexEntry {
  cardId: string;
  resourceId: string;
  canonicalId: string;
  active: boolean;
  required: boolean;
  sourcePath: string | null;
  title: string | null;
}

export interface TeachingProjectionGateFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  resourceId?: string;
  canonicalId?: string;
  bindingId?: string;
  prerequisiteId?: string;
  cardId?: string;
}

export interface TeachingProjectionGateResult {
  status: TeachingProjectionState;
  passed: boolean;
  findings: TeachingProjectionGateFinding[];
  /** Resources that failed REQUIRED binding gate. */
  unboundRequiredResourceIds: string[];
  /** Canonical IDs in Authority that no ACT record references. */
  notProjectedCanonicalIds: string[];
  /** OPTIONAL resources without bindings (diagnostics only). */
  unboundOptionalResourceIds: string[];
}

export interface TeachingProjectionSourceHashes {
  resources: string;
  bindings: string;
  prerequisites: string;
  coreNodes: string;
  cards: string;
  authorityNodes: string;
  authoringBody: string;
  /** Full digest of gate.json so gate tampering cannot keep projectionHash. */
  gate: string;
}

export interface TeachingProjectionManifestBody {
  contract: typeof TEACHING_PROJECTION_MANIFEST_CONTRACT;
  builderVersion: typeof TEACHING_PROJECTION_BUILDER_VERSION;
  scopeId: string;
  authoringRevision: string;
  authorityReleaseId: string;
  authorityReleaseSetId: string | null;
  authoritySnapshotId: string | null;
  authoritySnapshotHash: string | null;
  sourceHashes: TeachingProjectionSourceHashes;
  resourceCount: number;
  bindingCount: number;
  prerequisiteCount: number;
  coreNodeCount: number;
  cardCount: number;
  gateStatus: TeachingProjectionState;
  gatePassed: boolean;
}

export interface TeachingProjectionManifest extends TeachingProjectionManifestBody {
  projectionId: string;
  projectionHash: string;
}

export interface TeachingProjectionImpactRecord {
  kind:
    | 'resource'
    | 'binding'
    | 'prerequisite'
    | 'core-node'
    | 'card'
    | 'authority-node';
  id: string;
  effect:
    | 'included'
    | 'unbound-required'
    | 'unbound-optional'
    | 'not-projected'
    | 'gate-error'
    | 'diagnostic';
  detail: string;
}

export interface TeachingProjectionImpactReport {
  contract: 'act-teaching-projection-impact/v1';
  projectionId: string;
  projectionHash: string;
  /** Local affected records only — never the full upstream Authority node set. */
  records: TeachingProjectionImpactRecord[];
  summary: {
    includedResourceCount: number;
    includedBindingCount: number;
    notProjectedAuthorityNodeCount: number;
    gateErrorCount: number;
  };
}

export interface TeachingProjectionArtifacts {
  resources: TeachingResourceRuntime[];
  bindings: TeachingBindingRuntime[];
  prerequisites: TeachingPrerequisiteRuntime[];
  coreNodes: TeachingCoreNodeRuntime[];
  cardsIndex: {
    contract: 'act-teaching-projection-cards-index/v1';
    cards: TeachingCardIndexEntry[];
  };
  manifest: TeachingProjectionManifest;
  impactReport: TeachingProjectionImpactReport;
  gate: TeachingProjectionGateResult;
}

// ---------------------------------------------------------------------------
// Consumer activation combinations
// ---------------------------------------------------------------------------

export type TeachingProjectionConsumerKind =
  | 'engineering-graph'
  | 'engineering-rag'
  | 'teaching-resource-rag'
  | 'course-package'
  | 'learning-path'
  | 'konling'
  | 'cards';

export interface TeachingProjectionConsumerActivation {
  consumerId: string;
  consumerKind: TeachingProjectionConsumerKind;
  authorityReleaseId: string;
  /** Omitted for engineering-only consumers. */
  projectionId: string | null;
  projectionHash: string | null;
  requiresProjection: boolean;
  readiness: 'READY' | 'PINNED_PREVIOUS' | 'BLOCKED_LOCAL_DEPENDENCY' | 'NOT_PROJECTED';
  reasons: string[];
}

export interface TeachingProjectionActivationManifest {
  contract: typeof TEACHING_PROJECTION_ACTIVATION_CONTRACT;
  activationId: string;
  activationHash: string;
  consumers: TeachingProjectionConsumerActivation[];
}
