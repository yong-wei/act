/**
 * Knowledge card → Canonical migration contracts (#1271).
 *
 * Cards are ACT teaching resources keyed by Canonical ID. They are not
 * engineering graph entities. At most one ACTIVE card per Canonical ID.
 */

import type {
  TeachingCardAuthoring,
  TeachingCardIndexEntry,
  TeachingCoreNodeRuntime,
} from '../contracts';

export const CARD_INVENTORY_CONTRACT =
  'act-knowledge-card-inventory/v1' as const;
export const CARD_CROSSWALK_CONTRACT =
  'act-knowledge-card-crosswalk/v1' as const;
export const CARD_MIGRATION_REPORT_CONTRACT =
  'act-knowledge-card-migration-report/v1' as const;
export const CARD_ACTIVE_INDEX_CONTRACT =
  'act-knowledge-card-active-index/v1' as const;
export const CARD_FALLBACK_TELEMETRY_CONTRACT =
  'act-knowledge-card-fallback-telemetry/v1' as const;
export const CARD_AUTHOR_DECISION_CONTRACT =
  'act-knowledge-card-author-decision/v1' as const;
export const CARD_MIGRATION_BUILDER_VERSION =
  'act-knowledge-card-migration-builder/v1' as const;

export const DEFAULT_CARD_MIGRATION_AUTHORING_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/cards' as const;
export const DEFAULT_CARD_AUTHORING_NODES_RELATIVE =
  'course-content/authoring/knowledge/cards/nodes' as const;
export const DEFAULT_CARD_RUNTIME_NODES_RELATIVE =
  'course-content/runtime/knowledge/cards/nodes' as const;

/** Migration classification for a card / legacy node. */
export const CARD_MIGRATION_CLASSES = [
  'ONE_TO_ONE',
  'DUPLICATE',
  'SPLIT',
  'UNMAPPED',
  'COURSE_SPECIFIC',
] as const;

export type CardMigrationClass = (typeof CARD_MIGRATION_CLASSES)[number];

export const CARD_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'DRAFT',
  'LEGACY_FALLBACK',
] as const;

export type CardStatus = (typeof CARD_STATUSES)[number];

export const CARD_REVIEW_STATUSES = [
  'reviewed',
  'pending',
  'excluded',
  'unknown',
] as const;

export type CardReviewStatus = (typeof CARD_REVIEW_STATUSES)[number];

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/** One inventoried card file (authoring and/or runtime). */
export interface KnowledgeCardInventoryEntry {
  cardId: string;
  /** Legacy local graph node id from frontmatter `node_id` / filename. */
  legacyNodeId: string;
  title: string | null;
  authoringPath: string | null;
  runtimePath: string | null;
  sourceHash: string;
  reviewStatus: CardReviewStatus;
  cardVersion: number | null;
  lessonUnits: string[];
  tags: string[];
  /** Explicit Canonical ID already present on the card (if any). */
  declaredCanonicalId: string | null;
  /** Usage references: lesson sequences, step overlays, path readiness, etc. */
  usageRefs: string[];
  /** True when only runtime exists or content is legacy-only. */
  legacyOnly: boolean;
}

export interface KnowledgeCardInventory {
  contract: typeof CARD_INVENTORY_CONTRACT;
  authoringRevision: string;
  capturedAt: string | null;
  entryCount: number;
  entries: KnowledgeCardInventoryEntry[];
  inventoryDigest: string;
}

// ---------------------------------------------------------------------------
// Crosswalk
// ---------------------------------------------------------------------------

export interface CardCrosswalkEntry {
  legacyNodeId: string;
  canonicalId: string;
  /** Optional cardId when the crosswalk pins a specific card. */
  cardId?: string | null;
  sourceEvidence?: string | null;
  /** Retained for history; not used for auto-bind. */
  stale?: boolean;
  /** Course-specific: keep under lesson/step resources, not global card index. */
  courseSpecific?: boolean;
  scopeId?: string | null;
}

export interface CardCrosswalkDocument {
  contract: typeof CARD_CROSSWALK_CONTRACT;
  entries: CardCrosswalkEntry[];
}

// ---------------------------------------------------------------------------
// Author decisions (duplicate / split / unmapped)
// ---------------------------------------------------------------------------

export type CardAuthorDecisionKind =
  | 'SELECT_PRIMARY'
  | 'SPLIT_CONTENT'
  | 'KEEP_LEGACY'
  | 'COURSE_RESOURCE'
  | 'EXPLICIT_NONE';

export interface CardAuthorDecision {
  contract?: typeof CARD_AUTHOR_DECISION_CONTRACT;
  decisionId: string;
  /** Stable key for the decision subject (card or legacy node). */
  subjectId: string;
  scopeId: string;
  kind: CardAuthorDecisionKind;
  inputDigest: string;
  /** Selected primary card when kind is SELECT_PRIMARY. */
  primaryCardId?: string | null;
  /** Canonical targets when kind is SPLIT_CONTENT. */
  canonicalIds?: string[];
  rationale: string;
  decidedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Migration records & report
// ---------------------------------------------------------------------------

export interface CardMigrationRecord {
  cardId: string;
  legacyNodeId: string;
  classification: CardMigrationClass;
  canonicalId: string | null;
  status: CardStatus;
  autoMigrated: boolean;
  requiresAuthorDecision: boolean;
  authorDecisionId: string | null;
  sourceHash: string;
  sourcePath: string | null;
  title: string | null;
  rationale: string;
  legacyAliases: string[];
}

export interface CardMigrationReport {
  contract: typeof CARD_MIGRATION_REPORT_CONTRACT;
  builderVersion: typeof CARD_MIGRATION_BUILDER_VERSION;
  authoringRevision: string;
  inventoryDigest: string;
  records: CardMigrationRecord[];
  summary: {
    oneToOneCount: number;
    duplicateCount: number;
    splitCount: number;
    unmappedCount: number;
    courseSpecificCount: number;
    autoMigratedCount: number;
    authorDecisionRequiredCount: number;
  };
  reportDigest: string;
}

// ---------------------------------------------------------------------------
// Active index (canonicalId → active card)
// ---------------------------------------------------------------------------

export interface CanonicalCardIndexEntry {
  cardId: string;
  resourceId: string;
  canonicalId: string;
  status: CardStatus;
  active: boolean;
  required: boolean;
  sourceHash: string;
  sourcePath: string | null;
  title: string | null;
  cardVersion: number | null;
  projectionScope: string | null;
  legacyAliases: string[];
  /** When true, only usable via legacy fallback telemetry path. */
  legacyFallback: boolean;
}

export interface CanonicalCardActiveIndex {
  contract: typeof CARD_ACTIVE_INDEX_CONTRACT;
  builderVersion: typeof CARD_MIGRATION_BUILDER_VERSION;
  projectionScope: string | null;
  /** Map as ordered list; at most one ACTIVE per canonicalId. */
  entries: CanonicalCardIndexEntry[];
  /** canonicalId → active cardId for O(1) lookup reconstruction. */
  activeByCanonical: Array<{ canonicalId: string; cardId: string }>;
  indexDigest: string;
}

// ---------------------------------------------------------------------------
// Step resolution & fallback telemetry
// ---------------------------------------------------------------------------

export type CardResolutionOutcome =
  | 'active-card'
  | 'inactive-card'
  | 'optional-card-absent'
  | 'required-card-missing'
  | 'legacy-fallback'
  | 'unmapped-legacy'
  | 'node-summary-only';

export interface CardStepResolution {
  stepId: string | null;
  /** Step knowledge ref is always a Canonical ID after migration. */
  canonicalId: string;
  outcome: CardResolutionOutcome;
  card: CanonicalCardIndexEntry | null;
  /** Explicit optional-card-missing state for consumers. */
  optionalCardMissing: boolean;
  /** True only when cardPolicy REQUIRED and no active card. */
  requiredCardMissing: boolean;
  /** Does not block node/path when optional. */
  blocksConsumer: boolean;
  legacyFallback: boolean;
  studentMessage: string;
}

export interface LegacyCardFallbackHit {
  contract: typeof CARD_FALLBACK_TELEMETRY_CONTRACT;
  hitId: string;
  cardId: string | null;
  legacyId: string | null;
  canonicalId: string | null;
  crosswalkOutcome:
    | 'mapped'
    | 'unmapped'
    | 'stale'
    | 'split'
    | 'duplicate'
    | 'course-specific';
  consumer: string;
  projectionId: string | null;
  projectionHash: string | null;
  scopeId: string | null;
  recordedAt: string;
}

export interface LegacyCardFallbackTelemetry {
  contract: typeof CARD_FALLBACK_TELEMETRY_CONTRACT;
  hits: LegacyCardFallbackHit[];
  hitCount: number;
  telemetryDigest: string;
}

// ---------------------------------------------------------------------------
// ResourceNode / RAG projection views
// ---------------------------------------------------------------------------

export type CardProjectionCardState =
  | 'active'
  | 'inactive'
  | 'optional-missing'
  | 'required-missing'
  | 'legacy-fallback'
  | 'duplicate-blocked';

export interface CanonicalCardResourceProjection {
  resourceId: string;
  cardId: string | null;
  canonicalId: string;
  cardState: CardProjectionCardState;
  projectionId: string | null;
  sourceHash: string | null;
  reviewState: CardReviewStatus | null;
  legacyFallback: boolean;
  /** Never exposes raw hidden card body. */
  launchPolicy: 'registry-or-route' | 'disabled';
  evidencePolicy: 'citation-safe' | 'summary-only' | 'legacy-compat';
}

export interface CanonicalCardRagRetrievalRecord {
  canonicalId: string;
  cardId: string | null;
  resourceId: string | null;
  projectionId: string | null;
  sourceHash: string | null;
  reviewState: CardReviewStatus | null;
  citationTarget: string | null;
  optionalCardStatus: 'present' | 'absent' | 'not-applicable';
  legacyFallback: boolean;
  /** Provenance for migration/fallback; never a new authority selector. */
  migrationProvenance: {
    crosswalkOutcome: LegacyCardFallbackHit['crosswalkOutcome'] | 'canonical-direct';
    consumer: string;
  };
  /** True when absence must not be reported as missing Canonical node. */
  nodePresentWithoutCard: boolean;
}

// ---------------------------------------------------------------------------
// Gate helpers input
// ---------------------------------------------------------------------------

export interface CardPolicyGateInput {
  coreNodes: readonly TeachingCoreNodeRuntime[];
  cards: readonly TeachingCardIndexEntry[] | readonly CanonicalCardIndexEntry[];
}

export interface CardPolicyGateFinding {
  code:
    | 'duplicate-active-cards'
    | 'required-core-card-missing'
    | 'required-card-inactive'
    | 'legacy-id-write-rejected'
    | 'optional-card-absent';
  severity: 'error' | 'info';
  message: string;
  canonicalId?: string;
  cardId?: string;
}

// ---------------------------------------------------------------------------
// Build input / result
// ---------------------------------------------------------------------------

export interface CardMigrationBuildInput {
  authoringRevision: string;
  scopeId: string;
  inventory: KnowledgeCardInventory;
  crosswalk: readonly CardCrosswalkEntry[];
  /** Authority Canonical IDs usable as endpoints. */
  authorityCanonicalIds: ReadonlySet<string> | readonly string[];
  authorDecisions?: readonly CardAuthorDecision[];
  /** Core nodes with cardPolicy for required gating. */
  coreNodes?: readonly TeachingCoreNodeRuntime[];
  capturedAt?: string | null;
  projectionId?: string | null;
  projectionHash?: string | null;
}

export interface CardMigrationArtifacts {
  inventory: KnowledgeCardInventory;
  migration: CardMigrationReport;
  activeIndex: CanonicalCardActiveIndex;
  /** Teaching Projection authoring rows (1:1 auto + decided primaries). */
  teachingCards: TeachingCardAuthoring[];
  findings: CardPolicyGateFinding[];
  /** True when no error-severity findings. */
  passed: boolean;
}
