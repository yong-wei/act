/**
 * Resource Projection Adapter
 *
 * Converts governed `RuntimeResourceProjectionArtifactRow` sidecars into
 * Source Pack candidates while preserving the separation between
 * retrieval/citation readiness and path eligibility.
 *
 * ## Eligibility boundary
 *
 * - `retrievalChunkId` is always populated when the row has a retrieval
 *   chunk id — a chunk can be cited without being a path node.
 * - `resourceNodeId` and `planningUnitId` are ONLY populated when
 *   `pathEligibility.current === true` AND the projection level or
 *   metadata indicates a `ResourceNode` or `PlanningUnit` exists.
 * - `CitationTarget` rows do NOT become path-plannable nodes without
 *   ResourceNode/PlanningUnit audit.
 *
 * ## Limitations
 *
 * - Stale rows produce a `projection-stale` limitation.
 * - Provisional rows produce a `projection-provisional` limitation.
 * - Rows with `pathEligibility.current: false` produce a
 *   `retrieval-only-not-path-eligible` limitation.
 *
 * @module resource-projection-adapter
 */

import type {
  RuntimeResourceProjectionArtifactRow,
} from '../runtime-resource-projections';

import type {
  SourcePackItem,
  SourcePackLimitation,
  SourcePackScoreFields,
  SourcePackAccessMetadata,
  SourcePackAccessVisibility,
  SourcePackSourceKind,
  SourcePackModality,
} from './types';

export type {
  SourcePackItem,
  SourcePackLimitation,
};

// ─── Visibility Mapping ──────────────────────────────────────────────────────

/**
 * Map ResourceNodePrivacyLevel to SourcePackAccessVisibility.
 */
function mapPrivacyToVisibility(
  privacyLevel?: string | null,
): SourcePackAccessVisibility {
  switch (privacyLevel) {
    case 'student-visible':
      return 'student';
    case 'teacher-scoped':
      return 'teacher';
    case 'admin-scoped':
      return 'admin';
    default:
      return 'restricted';
  }
}

/**
 * Map RuntimeResourceProjectionLevel to SourcePackSourceKind.
 */
function mapProjectionLevelToSourceKind(
  level?: string,
): SourcePackSourceKind {
  switch (level) {
    case 'ResourceNode':
    case 'PlanningUnit':
      return 'knowledge-card';
    case 'RetrievalChunk':
      return 'learner-evidence';
    case 'CitationTarget':
      return 'reference';
    case 'ResourceSegment':
      return 'runtime-lesson';
    default:
      return 'other';
  }
}

// ─── Review Status → Score Adjustment ────────────────────────────────────────

const PROVISIONAL_STATUSES: ReadonlySet<string> = new Set([
  'generated-provisional',
  'model-assisted-provisional',
  'external-tool-provisional',
]);
const GOVERNED_ID_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_.-]*:[^\s]+$/u;

/**
 * Check if a review status is provisional (not yet human confirmed).
 */
export function isProvisionalReview(
  status?: string | null,
): boolean {
  if (!status) return true;
  return PROVISIONAL_STATUSES.has(status) || status === 'not-reviewed';
}

// ─── Main Adapter ────────────────────────────────────────────────────────────

/**
 * Adapt a single RuntimeResourceProjectionArtifactRow into a
 * SourcePackItem plus any associated limitations.
 */
export function adaptResourceProjectionRow(
  row: RuntimeResourceProjectionArtifactRow,
): { item: SourcePackItem; limitations: SourcePackLimitation[] } {
  const limitations: SourcePackLimitation[] = [];

  // ── staleness ──────────────────────────────────────────────────────────
  const stale = row.versionRefs ? detectProjectionStaleness(row) : false;
  if (stale) {
    limitations.push({
      code: 'projection-stale',
      severity: 'warning',
      message: `Resource projection ${row.id} is stale relative to current registry versions.`,
      source: 'resource-projection-adapter',
      recoverable: true,
    });
  }

  // ── provisional ────────────────────────────────────────────────────────
  const reviewStatus = row.reviewAudit?.status;
  if (isProvisionalReview(reviewStatus)) {
    limitations.push({
      code: 'projection-provisional',
      severity: 'info',
      message: `Resource projection ${row.id} has provisional review status "${reviewStatus ?? 'unknown'}".`,
      source: 'resource-projection-adapter',
      recoverable: true,
    });
  }

  // ── path eligibility gate ──────────────────────────────────────────────
  const pathEligible = row.pathEligibility?.current === true;
  const projectionLevel = row.projectionLevel ?? detectProjectionLevel(row);

  // Only assign resourceNodeId / planningUnitId when path-eligible AND
  // the projection level indicates ResourceNode/PlanningUnit.
  const canAssignResourceNode =
    pathEligible
    && (projectionLevel === 'ResourceNode' || projectionLevel === 'PlanningUnit');
  const planningUnitId = pathEligible && projectionLevel === 'PlanningUnit' && row.resourceNodeId
    ? `planning-unit:${row.resourceNodeId}`
    : undefined;
  if (!pathEligible && row.retrievalChunk?.id) {
    limitations.push({
      code: 'retrieval-only-not-path-eligible',
      severity: 'info',
      message: `Row ${row.id} has retrieval chunk ${row.retrievalChunk.id} but is not path-eligible. RetrievalChunk/CitationTarget does not become a path-plannable node without ResourceNode/PlanningUnit audit.`,
      source: 'resource-projection-adapter',
      recoverable: true,
    });
  }

  const citationTargetId = row.citationTargets.find(isGovernedId);
  const retrievalChunkId = row.retrievalChunk?.id
    ? toGovernedId('resource-projection-chunk', row.retrievalChunk.id)
    : undefined;
  if (row.citationTargets.length > 0 && !citationTargetId) {
    limitations.push({
      code: 'citation-target-not-governed-id',
      severity: 'warning',
      message: `Row ${row.id} has citation target paths but no governed citation target id.`,
      source: 'resource-projection-adapter',
      recoverable: true,
    });
  }

  // ── scores ─────────────────────────────────────────────────────────────
  const scores: SourcePackScoreFields = {
    relevance: pathEligible ? 0.85 : 0.5,
    graphAlignment: 0.7,
    authority: reviewStatus === 'human-confirmed' ? 0.95 : 0.5,
    eligibility: pathEligible ? 0.9 : 0.3,
    freshness: stale ? 0.3 : 0.8,
    final: 0,
  };
  scores.final = computeFinalScore(scores);

  // ── access ─────────────────────────────────────────────────────────────
  const access: SourcePackAccessMetadata = {
    visibility: mapPrivacyToVisibility(row.privacyScope),
    aiUseAllowed: true,
  };

  // ── source kind & modality ─────────────────────────────────────────────
  const sourceKind: SourcePackSourceKind = mapProjectionLevelToSourceKind(projectionLevel);
  const modality: SourcePackModality = projectionLevel === 'RetrievalChunk' ? 'text' : 'mixed';

  // ── excerpt ────────────────────────────────────────────────────────────
  const excerpt = buildExcerpt(row);

  // ── item ───────────────────────────────────────────────────────────────
  const item: SourcePackItem = {
    id: row.id,
    title: row.title ?? row.id,
    sourceKind,
    modality,
    excerpt,
    inclusionRationale: pathEligible
      ? 'Path-eligible governed resource projection with audit trail.'
      : 'Retrieval/citation candidate (not path-plannable without ResourceNode/PlanningUnit audit).',
    retrievalChunkId,
    resourceNodeId: canAssignResourceNode
      ? row.resourceNodeId ?? undefined
      : undefined,
    planningUnitId,
    citationTargetId,
    scores,
    access,
    metadata: {
      projectionLevel: projectionLevel ?? 'unknown',
      pathEligible: String(pathEligible),
      reviewStatus: reviewStatus ?? 'unknown',
      citationTargetRefs: row.citationTargets,
    },
  };

  return { item, limitations };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectProjectionLevel(row: RuntimeResourceProjectionArtifactRow): string {
  if (row.retrievalChunk?.id) return 'RetrievalChunk';
  if (row.citationTargets?.length) return 'CitationTarget';
  if (row.segmentRefs?.length) return 'ResourceSegment';
  return 'ResourceSegment';
}

function detectProjectionStaleness(_row: RuntimeResourceProjectionArtifactRow): boolean {
  // Stub: in a full implementation this would compare row.versionRefs
  // against current registry versions. For now, treat all rows as fresh.
  return false;
}

function isGovernedId(value: string): boolean {
  return GOVERNED_ID_PATTERN.test(value) && !/(https?:\/\/|:\/\/|course-content\/authoring|#L\d+\b)/i.test(value);
}

function toGovernedId(prefix: string, value: string): string {
  if (isGovernedId(value)) return value;
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return `${prefix}:${normalized || 'unknown'}`;
}

function computeFinalScore(scores: SourcePackScoreFields): number {
  return Math.round(
    (scores.relevance * 0.35
      + (scores.graphAlignment ?? 0) * 0.15
      + (scores.authority ?? 0.5) * 0.2
      + (scores.eligibility ?? 0.5) * 0.15
      + (scores.freshness ?? 0.5) * 0.15) * 100,
  ) / 100;
}

function buildExcerpt(row: RuntimeResourceProjectionArtifactRow): string {
  const parts: string[] = [];
  if (row.family) parts.push(`Family: ${row.family}`);
  if (row.retrievalChunk?.id) parts.push(`Chunk: ${row.retrievalChunk.id}`);
  if (row.citationTargets?.length) parts.push(`Citation targets: ${row.citationTargets.join(', ')}`);
  if (row.reviewAudit?.status) parts.push(`Review: ${row.reviewAudit.status}`);
  return parts.join(' | ') || 'No excerpt available.';
}
