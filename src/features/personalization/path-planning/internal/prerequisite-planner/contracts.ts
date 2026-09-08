/**
 * ACT Teaching Projection prerequisite path planner contracts (#1275).
 *
 * Formal paths traverse only ACT_TEACHING REQUIRED edges, filter mastered
 * nodes, and emit Projection-bound ResourceNode-backed path nodes.
 */

import type {
  PrerequisiteStrength,
  TeachingBindingRuntime,
  TeachingCardIndexEntry,
  TeachingCoreNodeRuntime,
  TeachingPrerequisiteRuntime,
  TeachingProjectionRole,
  TeachingResourceRuntime,
  TeachingResourceType,
} from '@/lib/teaching-projection/contracts';
import type {
  PrerequisiteEdgePublished,
  CoreNodePublished,
  PrerequisiteOrderSource,
} from '@/lib/teaching-projection/prerequisites/contracts';

export type { PrerequisiteOrderSource };

export const ACT_PREREQUISITE_PATH_PLANNER_VERSION =
  'act-prerequisite-path-planner/v1' as const;

export const ACT_PATH_RESOURCE_PRIORITY = [
  'lesson',
  'handout',
  'step',
  'card',
  'textbook-section',
  'textbook-chapter',
  'textbook',
] as const satisfies readonly TeachingResourceType[];

export type ActPathResourcePriorityType =
  (typeof ACT_PATH_RESOURCE_PRIORITY)[number];

/** Explicit readiness / eligibility blocker codes (never empty executable nodes). */
export type ActPathBlockerCode =
  | 'missing-projection-identity'
  | 'missing-authority-identity'
  | 'missing-scope'
  | 'goal-not-found'
  | 'goal-not-path-eligible'
  | 'goal-not-projected'
  | 'required-cycle'
  | 'dangling-prerequisite'
  | 'engineering-only-relation'
  | 'no-accessible-resource'
  | 'required-binding-unresolved'
  | 'node-not-path-eligible'
  | 'compatibility-fallback';

export interface ActPathBlocker {
  code: ActPathBlockerCode;
  message: string;
  canonicalId?: string;
  edgeId?: string;
  resourceId?: string;
}

export interface ActPathProjectionIdentity {
  authorityReleaseId: string;
  projectionId: string;
  projectionHash?: string | null;
  scopeId: string;
  /** Optional prerequisite publication capture id. */
  prerequisitePublicationId?: string | null;
  prerequisiteGraphIdentity?: string | null;
}

/**
 * Engineering-only relation that must never become a hard path edge.
 * Accepted only for optional explanation/context.
 */
export interface ActPathEngineeringRelation {
  id?: string;
  predicate: string;
  sourceId: string;
  targetId: string;
}

export interface ActPathProjectedResourceCandidate {
  resourceId: string;
  resourceType: TeachingResourceType | string;
  /**
   * Optional direct Canonical attachment when bindings are not supplied.
   * Prefer `bindings` / `cards` for multi-node inventories.
   */
  canonicalId?: string | null;
  /** ResourceNode registry id when known; required on emitted path nodes. */
  resourceNodeId?: string | null;
  registryId?: string | null;
  launchTarget?: string | null;
  role?: TeachingProjectionRole | string | null;
  scopeId?: string | null;
  sourcePath?: string | null;
  primary?: boolean;
  /** Bound / accessible under current projection. */
  accessible: boolean;
  projectionStatus?: TeachingResourceRuntime['projectionStatus'] | string | null;
  bindingStatus?: TeachingResourceRuntime['bindingStatus'] | string | null;
  /** Active card marker (cards only). */
  cardActive?: boolean;
  cardRequired?: boolean;
  provenance?: {
    bindingId?: string | null;
    evidenceRef?: string | null;
    rationale?: string | null;
  };
}

export interface ActPathPlannerInput {
  /** Target Canonical ID for the path goal. */
  goalCanonicalId: string;
  projection: ActPathProjectionIdentity | null;
  /**
   * ACT_TEACHING prerequisites. Prefer published edges; runtime edges accepted
   * when they already carry REQUIRED/RECOMMENDED strength.
   */
  prerequisites: readonly (
    | TeachingPrerequisiteRuntime
    | PrerequisiteEdgePublished
    | {
        prerequisiteId?: string;
        edgeId?: string;
        sourceCanonicalId?: string;
        targetCanonicalId?: string;
        sourceNodeId?: string;
        targetNodeId?: string;
        strength: PrerequisiteStrength | string;
        layer?: string;
        relationType?: string;
        evidenceRef?: string | null;
        evidenceRefs?: readonly string[] | null;
        rationale?: string | null;
        scopeId?: string | null;
        candidateOrigin?: string | null;
      }
  )[];
  /** Core teaching nodes with pathEligible / projection status. */
  coreNodes: readonly (
    | TeachingCoreNodeRuntime
    | CoreNodePublished
    | {
        canonicalId: string;
        pathEligible: boolean;
        cardPolicy?: string | null;
        moduleId?: string | null;
        scopeId?: string | null;
        projectionStatus?: string | null;
        rationale?: string | null;
      }
  )[];
  /** Projected resource candidates keyed later by binding/canonical. */
  resources: readonly ActPathProjectedResourceCandidate[];
  /** Canonical → resource bindings used to attach candidates to nodes. */
  bindings?: readonly TeachingBindingRuntime[] | readonly {
    bindingId?: string;
    resourceId: string;
    canonicalId: string;
    role?: string | null;
    scopeId?: string | null;
    primary?: boolean;
    sourcePath?: string | null;
    rationale?: string | null;
  }[];
  cards?: readonly TeachingCardIndexEntry[] | readonly {
    cardId: string;
    resourceId: string;
    canonicalId: string;
    active: boolean;
    required?: boolean;
    sourcePath?: string | null;
    title?: string | null;
  }[];
  /** Mastered Canonical IDs under governed learner state. */
  masteredCanonicalIds?: readonly string[];
  /**
   * Optional engineering relations for explicit non-hard-edge tests.
   * Never contribute hard path edges.
   */
  engineeringRelations?: readonly ActPathEngineeringRelation[] | null;
  /**
   * When projection identity is missing, allow an explicit compatibility
   * fallback status instead of a formal path.
   */
  allowCompatibilityFallback?: boolean;
}

export interface ActPathRecommendedAnnotation {
  edgeId: string;
  sourceCanonicalId: string;
  targetCanonicalId: string;
  strength: 'RECOMMENDED';
  evidenceRef: string | null;
  rationale: string | null;
  orderSource: PrerequisiteOrderSource;
}

export interface ActPathSelectedResource {
  resourceId: string;
  resourceNodeId: string;
  resourceType: string;
  role: string | null;
  launchTarget: string | null;
  registryId: string | null;
  scopeId: string | null;
  sourcePath: string | null;
  primary: boolean;
  selectionRank: number;
  selectionReason: string;
  provenance: {
    authorityReleaseId: string;
    projectionId: string;
    bindingId: string | null;
    evidenceRef: string | null;
    rationale: string | null;
  };
}

export interface ActPathPlanNode {
  canonicalId: string;
  order: number;
  pathEligible: true;
  isGoal: boolean;
  requiredPrerequisiteCanonicalIds: string[];
  selectedResource: ActPathSelectedResource;
  /** Additional accessible resources not chosen as primary. */
  alternateResources: ActPathSelectedResource[];
  annotations: {
    missingOptionalCard: boolean;
    recommendedPrerequisites: ActPathRecommendedAnnotation[];
    engineeringContextIds: string[];
  };
  rationale: {
    canonicalId: string;
    prerequisiteEvidence: string[];
    selectionReason: string;
    orderSourceByPrerequisite: Record<string, PrerequisiteOrderSource>;
  };
}

export type ActPathPlanStatus =
  | 'ready'
  | 'blocked'
  | 'compatibility-fallback';

export interface ActPathPlanResult {
  schemaVersion: typeof ACT_PREREQUISITE_PATH_PLANNER_VERSION;
  status: ActPathPlanStatus;
  plannerVersion: typeof ACT_PREREQUISITE_PATH_PLANNER_VERSION;
  goalCanonicalId: string;
  projection: ActPathProjectionIdentity | null;
  /** Deterministic topological path; empty when blocked/fallback. */
  nodes: ActPathPlanNode[];
  blocked: ActPathBlocker[];
  /** Advisory RECOMMENDED edges touching the planned subgraph. */
  recommendedAnnotations: ActPathRecommendedAnnotation[];
  /** Engineering relations preserved only as context (never hard edges). */
  engineeringContext: ActPathEngineeringRelation[];
  diagnostics: {
    reverseTraversalCount: number;
    masteredExcludedCount: number;
    requiredEdgeCount: number;
    recommendedEdgeCount: number;
    engineeringRelationCount: number;
    teachingOrderConstraintCount: number;
    engineeringLearningOrderConstraintCount: number;
  };
}
