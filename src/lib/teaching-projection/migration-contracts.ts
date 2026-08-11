/**
 * Active-course → Canonical migration contracts (#1268).
 *
 * Inventory, deterministic mapping, statuses, author decisions, package gates.
 * Builds on Teaching Projection (#1267); does not mutate Engineering Authority.
 */

import type {
  TeachingKnowledgeRefAuthoring,
  TeachingProjectionMode,
  TeachingProjectionRole,
  TeachingResourceType,
} from './contracts';

export type { TeachingKnowledgeRefAuthoring };

export const ACTIVE_COURSE_INVENTORY_CONTRACT =
  'act-active-course-inventory/v1' as const;
export const ACTIVE_COURSE_MIGRATION_STATUS_CONTRACT =
  'act-active-course-migration-status/v1' as const;
export const ACTIVE_COURSE_PACKAGE_REPORT_CONTRACT =
  'act-active-course-package-report/v1' as const;
export const LEGACY_ID_CROSSWALK_CONTRACT =
  'act-legacy-id-crosswalk/v1' as const;
export const AUTHOR_SEMANTIC_DECISION_CONTRACT =
  'act-author-semantic-decision/v1' as const;
export const KNOWLEDGE_REFS_CONTRACT =
  'act-teaching-knowledge-refs/v1' as const;

/** Deterministic mapping methods, applied in this order. */
export const MAPPING_METHODS = [
  'CROSSWALK',
  'CARD',
  'MANIFEST',
  'EXACT_LABEL',
  'AUTHOR_DECISION',
  'EXPLICIT_NONE',
  'NONE',
] as const;

export type MappingMethod = (typeof MAPPING_METHODS)[number];

/** Per-resource migration status for active course packages. */
export const MIGRATION_STATUSES = [
  'BOUND',
  'EXPLICIT_NONE',
  'REVIEW_REQUIRED',
] as const;

export type MigrationStatus = (typeof MIGRATION_STATUSES)[number];

/** One-to-one legacy → Canonical crosswalk row. */
export interface LegacyIdCrosswalkEntry {
  legacyId: string;
  canonicalId: string;
  /** Optional default role when resource type implies none. */
  role?: TeachingProjectionRole | null;
  sourceEvidence?: string | null;
  /** When true, entry is retained for history but not used for auto-bind. */
  stale?: boolean;
}

export interface LegacyIdCrosswalkDocument {
  contract: typeof LEGACY_ID_CROSSWALK_CONTRACT;
  entries: LegacyIdCrosswalkEntry[];
}

/** Active card reference usable for deterministic mapping. */
export interface ActiveCardMappingEntry {
  cardId: string;
  canonicalId: string;
  active: boolean;
  /** Legacy local graph node id this card is selected for, when known. */
  legacyNodeId?: string | null;
  title?: string | null;
  sourcePath?: string | null;
}

/** Authority label/alias index for exact normalized matching. */
export interface AuthorityLabelIndexEntry {
  canonicalId: string;
  labels: string[];
  lifecycleStatus?: string;
}

/** Explicit authoring knowledge field (manifest / handout / step). */
export interface ManifestKnowledgeField {
  resourceId?: string;
  legacyIds?: string[];
  canonicalIds?: string[];
  roles?: TeachingProjectionRole[];
  labels?: string[];
  sourcePath?: string;
}

/** Author semantic decision for ambiguous / split / merge items. */
export type AuthorDecisionKind =
  | 'BIND'
  | 'EXPLICIT_NONE'
  | 'SPLIT'
  | 'MERGE';

export interface AuthorSemanticDecision {
  contract?: typeof AUTHOR_SEMANTIC_DECISION_CONTRACT;
  decisionId: string;
  resourceId: string;
  scopeId: string;
  kind: AuthorDecisionKind;
  /** Digest of the mapping input this decision resolves; reuse only on match. */
  inputDigest: string;
  bindings?: TeachingKnowledgeRefAuthoring[];
  rationale: string;
  decidedAt?: string | null;
}

/** Inventory row for one reachable active-course resource. */
export interface ActiveCourseInventoryResource {
  resourceId: string;
  resourceType: TeachingResourceType;
  lessonKey: string;
  stepId?: string;
  scopeId: string;
  packageId: string;
  projectionMode: TeachingProjectionMode;
  title: string | null;
  sourcePath: string;
  sourceDigest: string;
  /**
   * ACT-owned teaching blueprint that governs an author decision for this
   * resource.  It is optional for legacy inventories, but current inventory
   * builds populate it so a BOPPPS change invalidates prior decisions.
   */
  blueprintPath?: string | null;
  blueprintDigest?: string | null;
  /** Local legacy graph node ids associated with this resource. */
  legacyIds: string[];
  /** Human labels/names for exact alias matching. */
  labels: string[];
  /** Card ids referenced from overlay / cards. */
  cardIds: string[];
  /** Explicit knowledgeRefs already present in authoring (if any). */
  knowledgeRefs: TeachingKnowledgeRefAuthoring[];
  /** Manifest-level knowledge fields (legacy ids / labels). */
  manifestKnowledge: ManifestKnowledgeField | null;
}

export interface ActiveCoursePackageInventory {
  packageId: string;
  scopeId: string;
  routeSegment: string | null;
  runtimeLessonDir: string;
  lessonKey: string;
  title: string | null;
  sourcePaths: string[];
  resources: ActiveCourseInventoryResource[];
}

export interface ActiveCourseInventory {
  contract: typeof ACTIVE_COURSE_INVENTORY_CONTRACT;
  authoringRevision: string;
  capturedAt: string | null;
  packageCount: number;
  resourceCount: number;
  packages: ActiveCoursePackageInventory[];
  /** Inventory content digest for audit. */
  inventoryDigest: string;
}

export interface MappingCandidate {
  canonicalId: string;
  role: TeachingProjectionRole | null;
  method: MappingMethod;
  evidence: string;
  legacyId?: string | null;
  label?: string | null;
}

export interface MigrationStatusRecord {
  resourceId: string;
  scopeId: string;
  packageId: string;
  resourceType: TeachingResourceType;
  projectionMode: TeachingProjectionMode;
  status: MigrationStatus;
  mappingMethod: MappingMethod | null;
  bindings: TeachingKnowledgeRefAuthoring[];
  candidates: MappingCandidate[];
  sourcePath: string;
  sourceDigest: string;
  evidence: string[];
  rationale: string;
  authorDecisionId: string | null;
}

export interface ActiveCourseMigrationReport {
  contract: typeof ACTIVE_COURSE_MIGRATION_STATUS_CONTRACT;
  authoringRevision: string;
  inventoryDigest: string;
  records: MigrationStatusRecord[];
  summary: {
    boundCount: number;
    explicitNoneCount: number;
    reviewRequiredCount: number;
    packageCount: number;
  };
  reportDigest: string;
}

export interface PackageReadinessFinding {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  resourceId?: string;
}

export interface ActiveCoursePackageReport {
  contract: typeof ACTIVE_COURSE_PACKAGE_REPORT_CONTRACT;
  packageId: string;
  scopeId: string;
  ready: boolean;
  gateStatus: 'PUBLISHED' | 'REVIEW_REQUIRED' | 'NOT_PROJECTED';
  unresolvedResourceIds: string[];
  findings: PackageReadinessFinding[];
  migrationSummary: {
    boundCount: number;
    explicitNoneCount: number;
    reviewRequiredCount: number;
    resourceCount: number;
  };
  /** Teaching projection gate findings for this package only. */
  projectionGatePassed: boolean;
  reportDigest: string;
}

export interface ActiveCourseMigrationRunResult {
  inventory: ActiveCourseInventory;
  migration: ActiveCourseMigrationReport;
  packageReports: ActiveCoursePackageReport[];
  /** True when every package is ready. */
  allPackagesReady: boolean;
}

/** Inputs for deterministic mapping (injected for tests / builders). */
export interface MappingContext {
  crosswalk: readonly LegacyIdCrosswalkEntry[];
  cards: readonly ActiveCardMappingEntry[];
  authorityLabels: readonly AuthorityLabelIndexEntry[];
  /** Canonical IDs known and usable in the pinned Authority release. */
  authorityCanonicalIds: ReadonlySet<string>;
  authorDecisions: readonly AuthorSemanticDecision[];
  /**
   * Digest of the authored decision policy.  Include it in decision inputs so
   * editing a package-level blueprint binding cannot silently reuse a prior
   * decision.
   */
  authorDecisionContextDigest?: string | null;
  /** Default role when a method resolves an ID without role. */
  defaultRole?: TeachingProjectionRole;
}
