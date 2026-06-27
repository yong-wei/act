/**
 * Corpus Adapters
 *
 * Convert governed runtime records into Source Pack candidates.
 *
 * Adapters accept existing governed types and produce SourcePackItem
 * plus limitations.  They do NOT own raw content, do NOT decide final
 * path eligibility, and do NOT perform citation verification — those
 * remain with Source Pack / LearningEvidence / CitationChip layers.
 *
 * ### Supported inputs
 *
 * - `LearningEvidenceCorpusChunk` — teaching knowledge & learner evidence
 * - `TextbookRuntimeSearchDocument` — textbook / reference runtime search docs
 * - `RuntimeResourceProjectionArtifactRow` — resource projection sidecars
 *
 * ### Safety
 *
 * - Unsafe hrefs are rejected with a blocking limitation.
 * - Privacy-inaccessible evidence chunks are excluded with explicit limitation.
 * - RetrievalChunk / CitationTarget readiness is carried separately from
 *   path eligibility.
 *
 * @module corpus-adapters
 */

import type {
  LearningEvidenceCitationUseCase,
  LearningEvidenceCorpusChunk,
  LearningEvidenceCorpusSourceType,
  LearningEvidenceCorpusPrivacyClass,
  LearningEvidenceRetrievalScope,
} from '../data-governance/learning-evidence-rag-corpus';
import { validateLearningEvidenceCorpusChunk } from '../data-governance/learning-evidence-rag-corpus';

import type {
  TextbookRuntimeSearchDocument,
} from '../textbook-runtime-resources';

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

import {
  hydrateCitationFromAddress,
  isSafeHref,
  buildUnsafeHrefLimitation,
  type HydratorCitationAddressInput,
} from './citation-hydrator';

import {
  adaptResourceProjectionRow,
} from './resource-projection-adapter';

// Re-export for convenience
export type {
  SourcePackItem,
  SourcePackLimitation,
};

const GOVERNED_ID_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_.-]*:[^\s]+$/u;
const USE_CASE_SOURCE_TYPES: Record<LearningEvidenceCitationUseCase, Set<LearningEvidenceCorpusSourceType>> = {
  diagnosis: new Set(['course-content', 'knowledge-card', 'runtime-handout', 'path-summary', 'diagnosis', 'simulation-summary', 'arena-summary']),
  grading: new Set(['course-content', 'knowledge-card', 'runtime-handout', 'grading-artifact', 'path-summary', 'simulation-summary', 'arena-summary']),
  konling: new Set(['course-content', 'knowledge-card', 'runtime-handout', 'path-summary', 'simulation-summary', 'arena-summary', 'diagnosis']),
  recommendation: new Set(['course-content', 'knowledge-card', 'runtime-handout', 'path-summary', 'simulation-summary', 'arena-summary', 'teacher-report']),
  'teacher-report': new Set(['path-summary', 'diagnosis', 'grading-artifact', 'simulation-summary', 'arena-summary', 'teacher-report']),
  'prep-pack': new Set(['course-content', 'knowledge-card', 'runtime-handout', 'diagnosis', 'grading-artifact', 'teacher-report']),
};

// ─── Visibility Helpers ──────────────────────────────────────────────────────

/**
 * Map LearningEvidenceCorpusPrivacyClass to SourcePackAccessVisibility.
 */
function mapPrivacyClass(privacy: LearningEvidenceCorpusPrivacyClass): SourcePackAccessVisibility {
  switch (privacy) {
    case 'public':
      return 'public';
    case 'student-visible':
      return 'student';
    case 'teacher-visible':
      return 'teacher';
    case 'admin-only':
      return 'admin';
    case 'service-only':
      return 'restricted';
    default:
      return 'restricted';
  }
}

function mapSourceTypeToKind(sourceType: string): SourcePackSourceKind {
  switch (sourceType) {
    case 'course-content':
      return 'textbook';
    case 'knowledge-card':
      return 'knowledge-card';
    case 'runtime-handout':
      return 'runtime-lesson';
    case 'path-summary':
    case 'diagnosis':
      return 'learner-evidence';
    case 'grading-artifact':
      return 'exercise';
    case 'simulation-summary':
    case 'arena-summary':
      return 'simulation';
    case 'teacher-report':
      return 'other';
    default:
      return 'other';
  }
}

function mapEvidenceConfidenceToScore(confidence: string): number {
  switch (confidence) {
    case 'high':
      return 0.9;
    case 'medium':
      return 0.6;
    case 'low':
      return 0.3;
    default:
      return 0.1;
  }
}

// ─── LearningEvidence → SourcePackItem ──────────────────────────────────────

export type AdaptLearningEvidenceChunkOptions = LearningEvidenceRetrievalScope;

/**
 * Adapt a LearningEvidenceCorpusChunk into a SourcePackItem.
 *
 * Privacy filtering is applied based on the retrieval role:
 * - If the chunk's privacy class is above the role's clearance,
 *   the chunk is excluded and a limitation is returned.
 * - If the chunk is restricted and the role cannot see it,
 *   return `null` item + explicit limitation.
 */
export function adaptLearningEvidenceChunk(
  chunk: LearningEvidenceCorpusChunk,
  opts: AdaptLearningEvidenceChunkOptions,
): { item: SourcePackItem | null; limitations: SourcePackLimitation[] } {
  const limitations: SourcePackLimitation[] = [];

  if (!isLearningEvidenceChunkInScope(chunk, opts)) {
    limitations.push({
      code: 'scope-excluded',
      severity: 'info',
      message: `Chunk ${chunk.id} is outside the retrieval scope for role "${opts.role}". Item excluded.`,
      source: 'corpus-adapters',
      recoverable: false,
    });
    return { item: null, limitations };
  }

  // ── Href safety ───────────────────────────────────────────────────────
  const rawHref = chunk.display?.href ?? chunk.citationAddress?.href ?? null;
  if (rawHref && !isSafeHref(rawHref)) {
    limitations.push(buildUnsafeHrefLimitation('corpus-adapters'));
  }

  // ── Staleness ─────────────────────────────────────────────────────────
  if (chunk.freshness?.stale) {
    limitations.push({
      code: 'evidence-stale',
      severity: 'warning',
      message: `Chunk ${chunk.id} is stale (indexed ${chunk.freshness.indexedAt}).`,
      source: 'corpus-adapters',
      recoverable: true,
    });
  }

  if (chunk.resourceProjection?.pathEligibility) {
    limitations.push({
      code: 'retrieval-only-not-path-eligible',
      severity: 'info',
      message: `Chunk ${chunk.id} is available for retrieval or citation only. Path eligibility requires a ResourceNode/PlanningUnit audit outside LearningEvidence corpus metadata.`,
      source: 'corpus-adapters',
      recoverable: true,
    });
  }

  const retrievalChunkId = toGovernedId('learning-evidence', chunk.id);
  const citationTargetId = firstGovernedId([
    chunk.resourceProjection?.citationTargetRef,
    chunk.citationAddress?.sourceRefId,
  ]) ?? toGovernedId('learning-evidence-citation', chunk.resourceProjection?.citationTargetRef ?? chunk.id);

  // ── Citation hydration ────────────────────────────────────────────────
  let citation = undefined;
  if (chunk.citationAddress) {
    const addr: HydratorCitationAddressInput = {
      kind: chunk.citationAddress.kind,
      sourceRefId: chunk.citationAddress.sourceRefId,
      href: chunk.citationAddress.href,
      locator: chunk.citationAddress.locator,
      contentHash: chunk.citationAddress.contentHash,
      mediaStartSeconds: chunk.citationAddress.mediaStartSeconds,
      mediaEndSeconds: chunk.citationAddress.mediaEndSeconds,
      imageRegion: chunk.citationAddress.imageRegion,
      interactiveStepId: chunk.citationAddress.interactiveStepId,
      simulationRunId: chunk.citationAddress.simulationRunId,
      arenaTaskId: chunk.citationAddress.arenaTaskId,
      externalUrl: chunk.citationAddress.externalUrl,
    };
    const result = hydrateCitationFromAddress(
      citationTargetId,
      retrievalChunkId,
      addr,
      chunk.display?.title ?? chunk.id,
    );
    citation = result.citation;
    limitations.push(...result.limitations);
  }

  // ── Scores ────────────────────────────────────────────────────────────
  const authorityScore = chunk.authority?.level === 'canonical' ? 0.95
    : chunk.authority?.level === 'verified' ? 0.8
    : chunk.authority?.level === 'contextual' ? 0.5
    : 0.3;

  const scores: SourcePackScoreFields = {
    relevance: mapEvidenceConfidenceToScore(chunk.confidence),
    graphAlignment: 0.6,
    authority: authorityScore,
    eligibility: 0.4,
    freshness: chunk.freshness?.stale ? 0.2 : 0.85,
    final: 0,
  };
  scores.final = computeCorpusFinalScore(scores);

  // ── Access ────────────────────────────────────────────────────────────
  const access: SourcePackAccessMetadata = {
    visibility: mapPrivacyClass(chunk.privacyClass),
    aiUseAllowed: chunk.authority?.level !== 'service-internal',
  };

  // ── Assemble item ─────────────────────────────────────────────────────
  const item: SourcePackItem = {
    id: chunk.id,
    title: chunk.display?.title ?? chunk.id,
    sourceKind: mapSourceTypeToKind(chunk.sourceType),
    modality: chunk.citationAddress?.kind === 'image' ? 'image'
      : chunk.citationAddress?.kind === 'video' ? 'video'
      : chunk.citationAddress?.kind === 'audio' ? 'audio'
      : chunk.citationAddress?.kind === 'interactive' || chunk.citationAddress?.kind === 'simulation' || chunk.citationAddress?.kind === 'arena' ? 'interactive'
      : 'text',
    excerpt: chunk.display?.capsule ?? chunk.content?.redactedSummary ?? chunk.display?.title ?? '',
    inclusionRationale: `Governed ${chunk.sourceType} evidence chunk (family: ${chunk.family}).`,
    resourceNodeId: undefined,
    planningUnitId: undefined, // LearningEvidence chunks don't carry PlanningUnit by default
    retrievalChunkId,
    citationTargetId,
    scores,
    access,
    citation,
    metadata: {
      family: chunk.family,
      sourceType: chunk.sourceType,
      privacyClass: chunk.privacyClass,
      confidence: chunk.confidence,
      authorityLevel: chunk.authority?.level ?? 'contextual',
      freshnessBucket: chunk.authority?.freshnessBucket ?? 'recent',
      contentHash: chunk.content?.hash ?? '',
    },
  };

  return { item, limitations };
}

// ─── TextbookRuntimeSearchDocument → SourcePackItem ──────────────────────────

/**
 * Adapt a TextbookRuntimeSearchDocument into a SourcePackItem.
 *
 * Textbook and reference runtime search documents carry resource projection
 * metadata, citation addresses, content hashes, and book/section/chapter
 * metadata.
 */
export function adaptTextbookSearchDocument(
  doc: TextbookRuntimeSearchDocument,
): { item: SourcePackItem; limitations: SourcePackLimitation[] } {
  const limitations: SourcePackLimitation[] = [];

  // ── Href safety ───────────────────────────────────────────────────────
  const rawHref = doc.href ?? doc.citationAddress?.href ?? null;
  if (rawHref && !isSafeHref(rawHref)) {
    limitations.push(buildUnsafeHrefLimitation('corpus-adapters'));
  }
  if (!rawHref) {
    limitations.push({
      code: 'textbook-missing-href',
      severity: 'warning',
      message: `Textbook doc ${doc.id} has no href.`,
      source: 'corpus-adapters',
      recoverable: true,
    });
  }

  // ── Citation preservation ─────────────────────────────────────────────
  let citation = undefined;
  const retrievalChunkId = toGovernedId('textbook-search', doc.resourceProjection?.segmentRef ?? doc.id);
  const citationTargetId = firstGovernedId([
    doc.resourceProjection?.citationTargetRef,
    doc.citationAddress?.sourceRefId,
  ]) ?? toGovernedId('textbook-citation', doc.resourceProjection?.citationTargetRef ?? doc.id);
  if (doc.citationAddress) {
    const addr: HydratorCitationAddressInput = {
      kind: doc.citationAddress.kind,
      sourceRefId: doc.citationAddress.sourceRefId,
      href: doc.citationAddress.href,
      locator: doc.citationAddress.locator,
      contentHash: doc.citationAddress.contentHash,
    };
    const result = hydrateCitationFromAddress(
      citationTargetId,
      retrievalChunkId,
      addr,
      doc.title,
    );
    citation = result.citation;
    limitations.push(...result.limitations);
  }

  // ── Access ────────────────────────────────────────────────────────────
  const access: SourcePackAccessMetadata = {
    visibility: 'public', // Textbook content is course-public
    aiUseAllowed: true,
  };

  // ── Scores ────────────────────────────────────────────────────────────
  const scores: SourcePackScoreFields = {
    relevance: 0.9,
    graphAlignment: 0.8,
    authority: 0.95,
    eligibility: 0.9,
    freshness: 0.85,
    final: 0,
  };
  scores.final = computeCorpusFinalScore(scores);

  // ── Assemble item ─────────────────────────────────────────────────────
  const item: SourcePackItem = {
    id: doc.id,
    title: doc.title,
    sourceKind: 'textbook',
    modality: doc.citationAddress?.kind === 'image' ? 'image'
      : doc.citationAddress?.kind === 'video' ? 'video'
      : 'text',
    excerpt: doc.text ?? doc.title,
    inclusionRationale: `Textbook search document (book: ${doc.metadata.bookId}, section: ${doc.metadata.sectionId}).`,
    resourceNodeId: undefined,
    planningUnitId: undefined,
    retrievalChunkId,
    citationTargetId,
    scores,
    access,
    citation,
    metadata: {
      bookId: doc.metadata.bookId,
      sectionId: doc.metadata.sectionId,
      chapterId: doc.metadata.chapterId ?? '',
      resourceId: doc.resourceProjection?.resourceId ?? '',
      contentHash: doc.contentHash ?? doc.resourceProjection?.contentHash ?? '',
      kind: doc.kind,
    },
  };

  return { item, limitations };
}

// ─── Resource Projection Row → SourcePackItem (delegated) ──────────────────

/**
 * Adapt a RuntimeResourceProjectionArtifactRow into a SourcePackItem.
 *
 * Delegates to `adaptResourceProjectionRow` from the resource-projection-adapter
 * module, which enforces path-eligibility separation.
 */
export function adaptResourceProjection(
  row: RuntimeResourceProjectionArtifactRow,
): { item: SourcePackItem; limitations: SourcePackLimitation[] } {
  return adaptResourceProjectionRow(row);
}

// ─── Batch Adaptation ────────────────────────────────────────────────────────

export interface AdaptCorpusResult {
  items: SourcePackItem[];
  limitations: SourcePackLimitation[];
  summary: {
    totalInputChunks: number;
    privacyExcluded: number;
    sourceTypeExcluded: number;
    adapted: number;
    limitationCount: number;
  };
}

/**
 * Adapt multiple LearningEvidenceCorpusChunks in batch.
 */
export function adaptLearningEvidenceBatch(
  chunks: LearningEvidenceCorpusChunk[],
  opts: AdaptLearningEvidenceChunkOptions,
): AdaptCorpusResult {
  const items: SourcePackItem[] = [];
  const limitations: SourcePackLimitation[] = [];
  let privacyExcluded = 0;
  let sourceTypeExcluded = 0;

  for (const chunk of chunks) {
    const result = adaptLearningEvidenceChunk(chunk, opts);
    if (result.item) {
      items.push(result.item);
    } else {
      // Count exclusion categories
      if (result.limitations.some((l) => l.code === 'scope-excluded')) {
        privacyExcluded += 1;
      }
      if (opts.allowedSourceTypes?.length && !opts.allowedSourceTypes.includes(chunk.sourceType)) {
        sourceTypeExcluded += 1;
      }
    }
    limitations.push(...result.limitations);
  }

  return {
    items,
    limitations,
    summary: {
      totalInputChunks: chunks.length,
      privacyExcluded,
      sourceTypeExcluded,
      adapted: items.length,
      limitationCount: limitations.length,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeCorpusFinalScore(scores: SourcePackScoreFields): number {
  return Math.round(
    (scores.relevance * 0.35
      + (scores.graphAlignment ?? 0) * 0.15
      + (scores.authority ?? 0.5) * 0.2
      + (scores.eligibility ?? 0.5) * 0.15
      + (scores.freshness ?? 0.5) * 0.15) * 100,
  ) / 100;
}

function isLearningEvidenceChunkInScope(
  chunk: LearningEvidenceCorpusChunk,
  scope: LearningEvidenceRetrievalScope,
): boolean {
  if (validateLearningEvidenceCorpusChunk(chunk).length > 0) return false;
  return matchesGoalScope(chunk, scope) &&
    matchesClassScope(chunk, scope) &&
    matchesOwnerScope(chunk, scope) &&
    matchesAuthorityScopeRule(chunk, scope) &&
    (!scope.allowedSourceTypes || scope.allowedSourceTypes.includes(chunk.sourceType)) &&
    (!scope.useCase || chunk.retrieval.useCases.includes(scope.useCase)) &&
    (!scope.useCase || USE_CASE_SOURCE_TYPES[scope.useCase]?.has(chunk.sourceType) === true) &&
    matchesResourceProjectionSceneAvailability(chunk, scope.useCase) &&
    isChunkVisible(chunk, scope);
}

function matchesGoalScope(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope): boolean {
  return !scope.goalId || chunk.retrieval.goals.includes(scope.goalId) || chunk.sourceRef.goalId === scope.goalId;
}

function matchesClassScope(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope): boolean {
  if (!scope.classIds || scope.classIds.length === 0) return true;
  return !chunk.sourceRef.classId || scope.classIds.includes(chunk.sourceRef.classId);
}

function matchesOwnerScope(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope): boolean {
  const ownerUserId = chunk.sourceRef.ownerUserId;
  if (!ownerUserId) return chunk.privacyClass !== 'student-visible';
  if (scope.role === 'student') return Boolean(scope.userId && ownerUserId === scope.userId);
  if (!scope.targetUserId) return true;
  return ownerUserId === scope.targetUserId;
}

function matchesAuthorityScopeRule(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope): boolean {
  const rule = chunk.authority.scopeRule;
  if (!rule.allowedRoles.includes(scope.role)) return false;
  if (rule.visibility !== chunk.privacyClass) return false;
  if (rule.ownerRequired && !chunk.sourceRef.ownerUserId) return false;
  if (rule.classRequired && (!chunk.sourceRef.classId || !scope.classIds?.includes(chunk.sourceRef.classId))) {
    return false;
  }
  return true;
}

function isChunkVisible(chunk: LearningEvidenceCorpusChunk, scope: LearningEvidenceRetrievalScope): boolean {
  if (chunk.privacyClass === 'service-only') return scope.role === 'service';
  if (chunk.privacyClass === 'admin-only') return scope.role === 'admin' || scope.role === 'service';
  if (chunk.privacyClass === 'teacher-visible') {
    if (scope.role === 'admin' || scope.role === 'service') return true;
    return scope.role === 'teacher' && Boolean(chunk.sourceRef.classId && scope.classIds?.includes(chunk.sourceRef.classId));
  }
  if (chunk.privacyClass === 'student-visible') {
    if (scope.role === 'admin' || scope.role === 'service') return true;
    if (scope.role === 'teacher') return Boolean(chunk.sourceRef.classId && scope.classIds?.includes(chunk.sourceRef.classId));
    return scope.role === 'student' && (!scope.targetUserId || scope.targetUserId === scope.userId);
  }
  return chunk.privacyClass === 'public';
}

function matchesResourceProjectionSceneAvailability(
  chunk: LearningEvidenceCorpusChunk,
  useCase: LearningEvidenceCitationUseCase | undefined,
): boolean {
  if (!useCase) return true;
  const scene = resourceProjectionSceneForUseCase(useCase);
  if (!scene) return true;
  const availability = chunk.resourceProjection?.sceneAvailability?.[scene];
  return availability?.allowed !== false;
}

function resourceProjectionSceneForUseCase(
  useCase: LearningEvidenceCitationUseCase,
): 'path' | 'konling' | 'diagnosis' | 'grading' | 'prep-pack' | 'report' | null {
  if (useCase === 'diagnosis') return 'diagnosis';
  if (useCase === 'grading') return 'grading';
  if (useCase === 'konling') return 'konling';
  if (useCase === 'recommendation') return 'path';
  if (useCase === 'prep-pack') return 'prep-pack';
  if (useCase === 'teacher-report') return 'report';
  return null;
}

function firstGovernedId(values: Array<string | null | undefined>): string | undefined {
  return values.find((value): value is string => Boolean(value && GOVERNED_ID_PATTERN.test(value)));
}

function toGovernedId(prefix: string, value: string): string {
  if (GOVERNED_ID_PATTERN.test(value)) return value;
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return `${prefix}:${normalized || 'unknown'}`;
}
