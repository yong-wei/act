/**
 * ACT teaching prerequisite publication contracts (#1270).
 *
 * Core-node denominator + ACT_TEACHING PREREQUISITE edges.
 * Engineering relations, textbook order, and lesson order stay candidates only.
 */

import type {
  AuthorityNodeIndexEntry,
  PrerequisiteStrength,
  TeachingBindingAuthoring,
  TeachingCoreNodeAuthoring,
  TeachingPrerequisiteAuthoring,
} from '../contracts';

export type { PrerequisiteStrength };

export const ACT_TEACHING_CORE_NODES_CONTRACT =
  'act-teaching-core-nodes/v1' as const;
export const ACT_TEACHING_PREREQUISITE_EDGES_CONTRACT =
  'act-teaching-prerequisite-edges/v1' as const;
export const ACT_TEACHING_PREREQUISITE_PUBLICATION_CONTRACT =
  'act-teaching-prerequisite-publication/v1' as const;
export const ACT_TEACHING_PREREQUISITE_BUILDER_VERSION =
  'act-teaching-prerequisite-builder/v1' as const;

export const DEFAULT_PREREQUISITE_AUTHORING_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/prerequisites' as const;

/** How a node entered the core denominator. */
export const CORE_NODE_SOURCE_KINDS = [
  'OBJECTIVE',
  'PRIMARY_COVERS',
  'PREREQUISITE_ENDPOINT',
  'TEACHER_CURATION',
] as const;

export type CoreNodeSourceKind = (typeof CORE_NODE_SOURCE_KINDS)[number];

/** Design cardPolicy vocabulary (maps to projection lowercase at export). */
export const CORE_NODE_CARD_POLICIES = ['REQUIRED', 'OPTIONAL'] as const;
export type CoreNodeCardPolicy = (typeof CORE_NODE_CARD_POLICIES)[number];

export const PREREQUISITE_EDGE_STATUSES = [
  'CANDIDATE',
  'PUBLISHED',
  'STALE',
  'REVIEW_REQUIRED',
] as const;

export type PrerequisiteEdgeStatus = (typeof PREREQUISITE_EDGE_STATUSES)[number];

/** Sources that may propose candidates but never auto-publish. */
export const PREREQUISITE_CANDIDATE_ORIGINS = [
  'ENGINEERING_RELATION',
  'TEXTBOOK_ORDER',
  'LESSON_ORDER',
  'LEGACY_GRAPH',
  'HANDOUT_LANGUAGE',
  'INTERACTIVE_METADATA',
  'TEACHER_PROPOSAL',
  'MODEL_SIMILARITY',
] as const;

export type PrerequisiteCandidateOrigin =
  (typeof PREREQUISITE_CANDIDATE_ORIGINS)[number];

export const PREREQUISITE_PUBLICATION_LAYER = 'ACT_TEACHING' as const;
export const PREREQUISITE_RELATION_TYPE = 'PREREQUISITE' as const;

// ---------------------------------------------------------------------------
// Authoring
// ---------------------------------------------------------------------------

export interface CoreNodeAuthoringRow {
  canonicalId: string;
  scopeId: string;
  pathEligible: boolean;
  cardPolicy: CoreNodeCardPolicy;
  moduleId?: string | null;
  rationale: string;
  sourceKind: CoreNodeSourceKind;
  /** Paths or IDs proving why the node is in the denominator. */
  sourceEvidence: string[];
}

export interface CoreNodesAuthoringDocument {
  contract: typeof ACT_TEACHING_CORE_NODES_CONTRACT;
  scopeId: string;
  nodes: CoreNodeAuthoringRow[];
}

export interface PrerequisiteEdgeAuthoring {
  edgeId?: string;
  sourceNodeId: string;
  targetNodeId: string;
  strength: PrerequisiteStrength;
  scopeId: string;
  /** ACT evidence paths/IDs; empty only when teacher-curation rationale is used. */
  evidenceRefs?: string[];
  curatorId?: string | null;
  curatorRationale?: string | null;
  status?: PrerequisiteEdgeStatus;
  /** Author decision identity required for PUBLISHED edges. */
  authorDecisionId?: string | null;
  /** Origin of the candidate proposal (never sufficient alone to publish). */
  candidateOrigin?: PrerequisiteCandidateOrigin | null;
}

export interface PrerequisiteEdgesAuthoringDocument {
  contract: typeof ACT_TEACHING_PREREQUISITE_EDGES_CONTRACT;
  scopeId: string;
  edges: PrerequisiteEdgeAuthoring[];
}

export interface PrerequisiteAuthorDecision {
  decisionId: string;
  edgeKey: string;
  scopeId: string;
  /** Digest of edge identity + evidence at decision time. */
  inputDigest: string;
  rationale: string;
  curatorId: string;
  decidedAt?: string | null;
  /** Bound Authority/Projection capture at decision time. */
  authorityReleaseId: string;
  projectionCaptureId?: string | null;
  authoringRevision: string;
}

// ---------------------------------------------------------------------------
// Denominator selection inputs
// ---------------------------------------------------------------------------

export interface FormalObjectiveRef {
  canonicalId: string;
  scopeId: string;
  sourcePath: string;
  moduleId?: string | null;
  rationale?: string | null;
}

export interface CoreNodeDenominatorInput {
  scopeId: string;
  /** Formal course objectives (Canonical IDs). */
  objectives?: readonly FormalObjectiveRef[];
  /** Teaching projection bindings (primary COVERS selected). */
  bindings?: readonly TeachingBindingAuthoring[];
  /** Endpoints that appear on authored prerequisite edges. */
  prerequisiteEndpoints?: readonly string[];
  /** Explicit teacher-curated backbone nodes. */
  teacherCuration?: readonly CoreNodeAuthoringRow[];
  /** Optional authored inventory rows that already carry full fields. */
  inventoryRows?: readonly CoreNodeAuthoringRow[];
  /** Active Authority index; only usable endpoints may enter the denominator. */
  authorityNodes: readonly AuthorityNodeIndexEntry[];
}

// ---------------------------------------------------------------------------
// Runtime / published
// ---------------------------------------------------------------------------

export interface CoreNodePublished {
  canonicalId: string;
  scopeId: string;
  pathEligible: boolean;
  cardPolicy: CoreNodeCardPolicy;
  moduleId: string | null;
  rationale: string;
  sourceKind: CoreNodeSourceKind;
  sourceEvidence: string[];
  /** Digest of the published core-node record (identity + policy + evidence). */
  nodeDigest: string;
}

export interface PrerequisiteEdgePublished {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  layer: typeof PREREQUISITE_PUBLICATION_LAYER;
  relationType: typeof PREREQUISITE_RELATION_TYPE;
  strength: PrerequisiteStrength;
  scopeId: string;
  evidenceRefs: string[];
  curatorId: string | null;
  curatorRationale: string | null;
  status: PrerequisiteEdgeStatus;
  authorDecisionId: string | null;
  candidateOrigin: PrerequisiteCandidateOrigin | null;
  /** Deterministic digest of published edge identity + evidence + decision. */
  edgeDigest: string;
  authorityReleaseId: string;
  projectionCaptureId: string | null;
  authoringRevision: string;
}

export interface PrerequisiteCandidateRecord {
  candidateId: string;
  sourceNodeId: string;
  targetNodeId: string;
  origin: PrerequisiteCandidateOrigin;
  scopeId: string;
  strengthHint?: PrerequisiteStrength | null;
  note?: string | null;
  /** Always false: candidates never auto-publish. */
  publishable: false;
}

export interface PrerequisiteGateFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  edgeId?: string;
  canonicalId?: string;
  candidateId?: string;
}

export interface PrerequisitePublicationGate {
  status: 'PUBLISHED' | 'REVIEW_REQUIRED' | 'NOT_PROJECTED';
  passed: boolean;
  findings: PrerequisiteGateFinding[];
  publishedEdgeCount: number;
  candidateOnlyCount: number;
  staleEdgeCount: number;
}

export interface PrerequisiteDerivedViews {
  /** Transitive closure of REQUIRED edges only: source -> reachable targets. */
  requiredClosure: Record<string, string[]>;
  /** Deterministic topological order of nodes touching REQUIRED edges. */
  requiredTopologicalOrder: string[];
  /** Advisory order including RECOMMENDED (does not block paths). */
  advisoryTopologicalOrder: string[];
}

export interface PrerequisitePublicationManifest {
  contract: typeof ACT_TEACHING_PREREQUISITE_PUBLICATION_CONTRACT;
  builderVersion: typeof ACT_TEACHING_PREREQUISITE_BUILDER_VERSION;
  scopeId: string;
  authoringRevision: string;
  authorityReleaseId: string;
  projectionCaptureId: string | null;
  coreNodeCount: number;
  publishedEdgeCount: number;
  candidateCount: number;
  sourceHashes: {
    coreNodes: string;
    edges: string;
    decisions: string;
    candidates: string;
    body: string;
  };
  publicationId: string;
  publicationHash: string;
  gateStatus: PrerequisitePublicationGate['status'];
  gatePassed: boolean;
}

export interface PrerequisitePublicationArtifacts {
  coreNodes: CoreNodePublished[];
  edges: PrerequisiteEdgePublished[];
  candidates: PrerequisiteCandidateRecord[];
  derived: PrerequisiteDerivedViews;
  gate: PrerequisitePublicationGate;
  manifest: PrerequisitePublicationManifest;
  /** Projection-compatible authoring slices for reuse by teaching-projection builder. */
  projectionCoreNodes: TeachingCoreNodeAuthoring[];
  projectionPrerequisites: TeachingPrerequisiteAuthoring[];
}

export interface PrerequisitePublicationBuildInput {
  scopeId: string;
  authoringRevision: string;
  authorityReleaseId: string;
  projectionCaptureId?: string | null;
  authorityNodes: readonly AuthorityNodeIndexEntry[];
  coreNodes: readonly CoreNodeAuthoringRow[];
  edges: readonly PrerequisiteEdgeAuthoring[];
  decisions?: readonly PrerequisiteAuthorDecision[];
  candidates?: readonly PrerequisiteCandidateRecord[];
  /**
   * Prior published artifact. On fail-closed rejection the prior is preserved
   * and returned without mutation.
   */
  priorArtifacts?: PrerequisitePublicationArtifacts | null;
}
