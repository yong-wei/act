import type { LearningFact, Prisma } from '@prisma/client';

import {
  projectLearningFactServingIdentity,
  type LearningFactServingIdentity,
} from '@/lib/canonical-learning-fact-identity';
import type { EvidenceQuestionSummary } from './competency-engine';
import {
  mapLegacyCompetencyDimensionToPortraitV2,
  PORTRAIT_V2_DIMENSION_IDS,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy dimension filters remain accepted for historical evidence queries.
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from './competency-model';
import {
  summarizeSubmissionEvidencePayload,
  type SubmissionEvidenceQuality,
} from './submission-evidence-quality';
export interface EvidenceTimelineFilters {
  cursor?: string;
  limit?: number;
  dimension?: PortraitV2DimensionId | CompetencyDimension;
  lessonId?: string;
  factType?: string;
  outcome?: string;
  sessionId?: string;
  assignment?: string;
  criterion?: string;
  assignmentSource?: string;
}

export interface EvidenceTimelineCursor {
  startedAt: string;
  createdAt: string;
  id: string;
}

export interface EvidenceTimelineKnowledgeIdentity {
  identityNamespace: LearningFactServingIdentity['identityNamespace'];
  knowledgeRevisionRef: string;
  canonicalObjectId: string | null;
  aggregateReleaseSetId: string | null;
  aggregateReleaseId: string | null;
  knowledgeProjectionId: string | null;
  legacyKnowledgeNodeIds: readonly string[];
  historicalRevisionBound: true;
}

export interface EvidenceTimelineItem {
  id: string;
  factType: string;
  outcome: string;
  score?: number;
  moduleId?: string | null;
  lessonId?: string | null;
  sessionId?: string | null;
  sourceLogId?: string | null;
  sourceEventId?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  createdAt: string;
  timeSpent?: number | null;
  competencyContribution: Record<string, number>;
  evidenceTitle?: string;
  stepId?: string;
  questionSummaries?: EvidenceTimelineQuestionSummary[];
  quality?: SubmissionEvidenceQuality;
  qualityReason?: string;
  sourceState?: string;
  schemaVersion?: string | null;
  displayPriority?: 'normal' | 'deemphasized';
  groupKey?: string;
  groupLabel?: string;
  groupedCount?: number;
  groupedEvidenceIds?: string[];
  learnerRecord?: EvidenceTimelineLearnerRecord;
  /** Multi-era knowledge identity; never reinterprets historical facts with current graph. */
  knowledgeIdentity?: EvidenceTimelineKnowledgeIdentity;
}

export interface EvidenceTimelineQuestionSummary extends Omit<EvidenceQuestionSummary, 'studentAnswer'> {
  studentAnswer?: string | null;
  studentAnswerRedacted?: boolean;
}

export type EvidenceTimelineLearnerRecordSourceScope =
  | 'interactive-lesson-submission'
  | 'arena-official-result'
  | 'arena-preview-result'
  | 'simulation-workbench-completion'
  | 'adaptive-practice-submission';

export interface StudentSafeEvidenceSourceProjection {
  sourceScope: EvidenceTimelineLearnerRecordSourceScope;
  summary: string;
  nextAction: {
    href: string;
    label: string;
  };
}

export interface StudentSafeEvidenceEventReference extends StudentSafeEvidenceSourceProjection {
  occurredAt: string;
}

export interface EvidenceTimelineSourceRecord {
  factType?: string | null;
  moduleId?: string | null;
  lessonId?: string | null;
  sourceEventId?: string | null;
  contextJson?: unknown;
  hasInteractiveResponse?: boolean;
}

export function projectStudentSafeEvidenceSource(input: {
  sourceScope: EvidenceTimelineLearnerRecordSourceScope;
  lessonId?: string | null;
}): StudentSafeEvidenceSourceProjection {
  const { sourceScope } = input;
  if (sourceScope === 'interactive-lesson-submission') {
    const lessonSuffix = input.lessonId ? `?lessonId=${encodeURIComponent(input.lessonId)}` : '';
    return {
      sourceScope,
      summary: '课堂作答记录参与了该项能力判断。',
      nextAction: { href: `/profile/evidence${lessonSuffix}`, label: '复盘课堂作答' },
    };
  }
  if (sourceScope === 'arena-preview-result') {
    return {
      sourceScope,
      summary: 'Arena 预览结果参与了该项能力判断。',
      nextAction: { href: '/arena', label: '提交官方评测' },
    };
  }
  if (sourceScope === 'arena-official-result') {
    return {
      sourceScope,
      summary: 'Arena 官方评测结果参与了该项能力判断。',
      nextAction: { href: '/arena', label: '查看 Arena 结果' },
    };
  }
  if (sourceScope === 'simulation-workbench-completion') {
    return {
      sourceScope,
      summary: '控制工作台仿真记录参与了该项能力判断。',
      nextAction: { href: '/interactive-learning/control-workbench', label: '继续工作台验证' },
    };
  }
  return {
    sourceScope,
    summary: '自适应练习记录参与了该项能力判断。',
    nextAction: { href: '/assessment/adaptive-practice?intent=practice', label: '继续自适应练习' },
  };
}

export function inferStudentSafeEvidenceSource(
  record: EvidenceTimelineSourceRecord,
): StudentSafeEvidenceSourceProjection | undefined {
  const sourceScope = inferLearnerRecordSourceScope(record);
  return sourceScope
    ? projectStudentSafeEvidenceSource({ sourceScope, lessonId: record.lessonId })
    : undefined;
}

export interface EvidenceTimelineLearnerRecord {
  sourceScope: EvidenceTimelineLearnerRecordSourceScope;
  freshness: 'fresh' | 'recent' | 'stale' | 'unknown';
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  missingSourceState: string;
  privacyScope: 'student-visible' | 'teacher-scoped' | 'governance-scoped' | 'restricted';
  nextAction: {
    href: string;
    label: string;
  };
}

export type EvidenceTimelineViewerRole = 'student' | 'teacher' | 'admin';

export interface EvidenceTimelinePage {
  items: EvidenceTimelineItem[];
  nextCursor: string | null;
  appliedFilters: EvidenceTimelineFilters;
}

type LearningFactTimelineRecord = Pick<
  LearningFact,
  | 'id'
  | 'factType'
  | 'outcome'
  | 'score'
  | 'moduleId'
  | 'lessonId'
  | 'sessionId'
  | 'sourceLogId'
  | 'sourceEventId'
  | 'startedAt'
  | 'finishedAt'
  | 'createdAt'
  | 'timeSpent'
  | 'competencyContribution'
  | 'contextJson'
  | 'knowledgeIdentityNamespace'
  | 'canonicalObjectId'
  | 'aggregateReleaseSetId'
  | 'aggregateReleaseId'
  | 'knowledgeProjectionId'
  | 'knowledgeRevisionRef'
>;

interface StudentStepResponseTimelineRecord {
  sourceLogId: string | null;
  lessonKey: string | null;
  stepId: string | null;
  responseData: unknown;
  submittedAt: Date;
  createdAt: Date;
}

export interface EvidenceTimelineDb {
  learningFact: {
    findMany(args: Prisma.LearningFactFindManyArgs): Promise<LearningFactTimelineRecord[]>;
  };
  studentStepResponse: {
    findMany(args: Prisma.StudentStepResponseFindManyArgs): Promise<StudentStepResponseTimelineRecord[]>;
  };
}

export interface ListEvidenceTimelineInput {
  db: EvidenceTimelineDb;
  userId: string;
  filters?: EvidenceTimelineFilters;
  viewerRole?: EvidenceTimelineViewerRole;
  restrictedFallbackAction?: EvidenceTimelineLearnerRecord['nextAction'];
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const GROUP_LOOKAHEAD = 2;
const ORDER_BY: Prisma.LearningFactOrderByWithRelationInput[] = [
  { startedAt: 'desc' },
  { createdAt: 'desc' },
  { id: 'desc' },
];

export function createEvidenceTimelineCursor(cursor: EvidenceTimelineCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');
}

export function parseEvidenceTimelineFilters(searchParams: URLSearchParams): EvidenceTimelineFilters {
  const dimension = parseDimension(searchParams.get('dimension'));
  return compactFilters({
    cursor: readSearchString(searchParams.get('cursor')),
    limit: parseLimit(searchParams.get('limit')),
    dimension,
    lessonId: readSearchString(searchParams.get('lessonId')),
    factType: readSearchString(searchParams.get('factType')),
    outcome: readSearchString(searchParams.get('outcome')),
    sessionId: readSearchString(searchParams.get('sessionId')),
    assignment: readSearchString(searchParams.get('assignment')),
    criterion: readSearchString(searchParams.get('criterion')),
    assignmentSource: readSearchString(searchParams.get('feedbackSource') ?? searchParams.get('source')),
  });
}

export async function listEvidenceTimeline({
  db,
  userId,
  filters = {},
  viewerRole = 'student',
  restrictedFallbackAction = { href: '/profile/evidence', label: '查看可见证据' },
}: ListEvidenceTimelineInput): Promise<EvidenceTimelinePage> {
  const normalizedFilters = normalizeFilters(filters);
  const limit = normalizedFilters.limit ?? DEFAULT_LIMIT;
  const groupLookaheadLimit = Math.min(limit + GROUP_LOOKAHEAD, MAX_LIMIT);
  const queryLimit = Math.min(groupLookaheadLimit + 1, MAX_LIMIT + 1);
  const facts = normalizedFilters.dimension
    ? await collectDimensionFilteredFacts(db, userId, normalizedFilters, queryLimit - 1)
    : await db.learningFact.findMany({
        where: buildLearningFactWhere(userId, normalizedFilters),
        orderBy: ORDER_BY,
        take: queryLimit,
      });
  const matchedFacts = normalizedFilters.dimension
    ? facts
    : facts.filter((fact) => matchesDimension(fact, normalizedFilters.dimension));
  const groupableFacts = matchedFacts.slice(0, groupLookaheadLimit);
  const sourceLogIds = groupableFacts
    .map((fact) => fact.sourceLogId)
    .filter((sourceLogId): sourceLogId is string => typeof sourceLogId === 'string' && sourceLogId.length > 0);
  const responses = sourceLogIds.length
    ? await db.studentStepResponse.findMany({
        where: {
          userId,
          sourceLogId: { in: sourceLogIds },
        },
        select: {
          sourceLogId: true,
          lessonKey: true,
          stepId: true,
          responseData: true,
          submittedAt: true,
          createdAt: true,
        },
      })
    : [];
  const responseBySourceLogId = new Map(
    responses
      .filter((response) => response.sourceLogId)
      .map((response) => [response.sourceLogId!, response])
  );

  const groupedItems = groupEvidenceTimelineItems(
    groupableFacts.map((fact) => formatEvidenceTimelineItem(
      fact,
      responseBySourceLogId.get(fact.sourceLogId ?? ''),
      viewerRole,
      restrictedFallbackAction,
    ))
  );
  const visibleItems = groupedItems.slice(0, limit);
  const cursorFact = resolveCursorFact(visibleItems, groupableFacts);

  return {
    items: visibleItems,
    nextCursor: cursorFact && matchedFacts.some((fact) => compareTimelineFactOrder(fact, cursorFact) > 0)
      ? createEvidenceTimelineCursor(cursorFromFact(cursorFact))
      : null,
    appliedFilters: normalizedFilters,
  };
}

async function collectDimensionFilteredFacts(
  db: EvidenceTimelineDb,
  userId: string,
  filters: EvidenceTimelineFilters,
  limit: number
): Promise<LearningFactTimelineRecord[]> {
  const selected: LearningFactTimelineRecord[] = [];
  let cursor = decodeCursor(filters.cursor);
  const batchSize = Math.min(Math.max(limit * 3, 10), MAX_LIMIT);

  while (selected.length <= limit) {
    const pageFilters = {
      ...filters,
      cursor: cursor ? createEvidenceTimelineCursor(cursor) : undefined,
    };
    const rows = await db.learningFact.findMany({
      where: buildLearningFactWhere(userId, pageFilters),
      orderBy: ORDER_BY,
      take: batchSize,
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      if (matchesDimension(row, filters.dimension)) {
        selected.push(row);
        if (selected.length > limit) break;
      }
    }

    if (selected.length > limit || rows.length < batchSize) break;
    cursor = cursorFromFact(rows[rows.length - 1]);
  }

  return selected;
}

function buildLearningFactWhere(
  userId: string,
  filters: EvidenceTimelineFilters
): Prisma.LearningFactWhereInput {
  const where: Prisma.LearningFactWhereInput = { userId };
  if (filters.lessonId) where.lessonId = filters.lessonId;
  if (filters.factType) where.factType = filters.factType;
  if (filters.outcome) where.outcome = filters.outcome;
  if (filters.sessionId) where.sessionId = filters.sessionId;

  const scopedConditions: Prisma.LearningFactWhereInput[] = [];
  if (filters.assignment) {
    scopedConditions.push({ contextJson: { path: ['assignmentId'], equals: filters.assignment } });
  }
  if (filters.criterion) {
    scopedConditions.push({ contextJson: { path: ['criterionId'], equals: filters.criterion } });
  }
  if (filters.assignmentSource) {
    const sourceConditions: Prisma.LearningFactWhereInput[] = [
      { contextJson: { path: ['source'], equals: filters.assignmentSource } },
      { contextJson: { path: ['feedbackSource'], equals: filters.assignmentSource } },
      { contextJson: { path: ['gradingRunId'], equals: filters.assignmentSource } },
    ];
    if (filters.assignmentSource === 'document-feedback' && filters.assignment && filters.criterion) {
      sourceConditions.push({ factType: 'document_rubric_grading' });
    }
    scopedConditions.push({
      OR: sourceConditions,
    });
  }

  const cursor = decodeCursor(filters.cursor);
  if (cursor) {
    scopedConditions.push(
      {
        OR: [
          { startedAt: { lt: new Date(cursor.startedAt) } },
          {
            startedAt: new Date(cursor.startedAt),
            createdAt: { lt: new Date(cursor.createdAt) },
          },
          {
            startedAt: new Date(cursor.startedAt),
            createdAt: new Date(cursor.createdAt),
            id: { lt: cursor.id },
          },
        ],
      },
    );
  }

  if (scopedConditions.length > 0) {
    where.AND = scopedConditions;
  }

  return where;
}

function formatEvidenceTimelineItem(
  fact: LearningFactTimelineRecord,
  response?: StudentStepResponseTimelineRecord,
  viewerRole: EvidenceTimelineViewerRole = 'student',
  restrictedFallbackAction: EvidenceTimelineLearnerRecord['nextAction'] = { href: '/profile/evidence', label: '查看可见证据' },
): EvidenceTimelineItem {
  const responseData = readRecord(response?.responseData);
  const contextJson = readRecord(fact.contextJson);
  const quality = resolveQuality(responseData, contextJson);
  const questionSummaries = readQuestionSummaries(
    responseData.questionSummaries ?? contextJson.questionSummaries ?? contextJson.cards,
    viewerRole !== 'student',
  );
  const explicitLearnerRecord = readLearnerRecordMetadata(
    contextJson.learnerRecord,
    viewerRole,
    restrictedFallbackAction,
  );
  const derivedLearnerRecord = explicitLearnerRecord
    ?? deriveLearnerRecordMetadata(fact, response, quality?.quality, viewerRole, restrictedFallbackAction);

  const servingIdentity = projectLearningFactServingIdentity({
    id: fact.id,
    knowledgeIdentityNamespace: fact.knowledgeIdentityNamespace,
    canonicalObjectId: fact.canonicalObjectId,
    aggregateReleaseSetId: fact.aggregateReleaseSetId,
    aggregateReleaseId: fact.aggregateReleaseId,
    knowledgeProjectionId: fact.knowledgeProjectionId,
    knowledgeRevisionRef: fact.knowledgeRevisionRef,
    contextJson: fact.contextJson,
  });
  const knowledgeIdentity: EvidenceTimelineKnowledgeIdentity = {
    identityNamespace: servingIdentity.identityNamespace,
    knowledgeRevisionRef: servingIdentity.knowledgeRevisionRef,
    canonicalObjectId: servingIdentity.canonicalObjectId,
    aggregateReleaseSetId: servingIdentity.aggregateReleaseSetId,
    aggregateReleaseId: servingIdentity.aggregateReleaseId,
    knowledgeProjectionId: servingIdentity.knowledgeProjectionId,
    legacyKnowledgeNodeIds: servingIdentity.legacyKnowledgeNodeIds,
    historicalRevisionBound: true,
  };

  return compactObject({
    id: fact.id,
    factType: fact.factType,
    outcome: fact.outcome,
    score: typeof fact.score === 'number' ? fact.score : undefined,
    moduleId: fact.moduleId,
    lessonId: fact.lessonId ?? response?.lessonKey ?? null,
    sessionId: fact.sessionId,
    sourceLogId: fact.sourceLogId,
    sourceEventId: fact.sourceEventId,
    startedAt: fact.startedAt.toISOString(),
    finishedAt: fact.finishedAt?.toISOString() ?? null,
    createdAt: fact.createdAt.toISOString(),
    timeSpent: fact.timeSpent,
    competencyContribution: readNumericRecord(fact.competencyContribution),
    evidenceTitle: readString(responseData.evidenceTitle)
      ?? readString(responseData.title)
      ?? readString(responseData.activityTitle)
      ?? readString(contextJson.evidenceTitle),
    stepId: response?.stepId
      ?? readString(contextJson.stepId)
      ?? (fact.moduleId?.startsWith('step-') ? fact.moduleId : undefined),
    questionSummaries: questionSummaries.length > 0 ? questionSummaries : undefined,
    quality: quality?.quality,
    qualityReason: quality?.reason,
    sourceState: quality?.sourceState,
    schemaVersion: quality?.schemaVersion,
    learnerRecord: derivedLearnerRecord,
    knowledgeIdentity,
  });
}

function deriveLearnerRecordMetadata(
  fact: LearningFactTimelineRecord,
  response: StudentStepResponseTimelineRecord | undefined,
  quality: SubmissionEvidenceQuality | undefined,
  viewerRole: EvidenceTimelineViewerRole,
  restrictedFallbackAction: EvidenceTimelineLearnerRecord['nextAction'],
): EvidenceTimelineLearnerRecord | undefined {
  const sourceProjection = inferStudentSafeEvidenceSource({
    ...fact,
    hasInteractiveResponse: Boolean(response),
  });
  if (!sourceProjection) {
    return undefined;
  }
  const { sourceScope } = sourceProjection;

  return readLearnerRecordMetadata({
    sourceScope,
    freshness: inferLearnerRecordFreshness(fact),
    confidence: inferLearnerRecordConfidence(fact, quality, sourceScope),
    missingSourceState: inferLearnerRecordMissingSourceState(fact, quality, sourceScope),
    privacyScope: 'student-visible',
    nextAction: viewerRole === 'student'
      ? sourceProjection.nextAction
      : restrictedFallbackAction,
  }, viewerRole, restrictedFallbackAction);
}

function readLearnerRecordMetadata(
  value: unknown,
  viewerRole: EvidenceTimelineViewerRole,
  restrictedFallbackAction: EvidenceTimelineLearnerRecord['nextAction'],
): EvidenceTimelineLearnerRecord | undefined {
  const record = readRecord(value);
  const sourceScope = readLearnerRecordSourceScope(record.sourceScope);
  if (!sourceScope) {
    return undefined;
  }
  const privacyScope = readLearnerRecordPrivacyScope(record.privacyScope);

  const nextAction = readRecord(record.nextAction);
  const href = readString(nextAction.href);
  const label = readString(nextAction.label);
  const canSeeScopedDetails = viewerCanSeeLearnerRecordScope(viewerRole, privacyScope);
  const shouldUseReviewerFallback = viewerRole !== 'student' && privacyScope === 'student-visible';

  return {
    sourceScope,
    freshness: readLearnerRecordFreshness(record.freshness),
    confidence: readLearnerRecordConfidence(record.confidence),
    missingSourceState: canSeeScopedDetails
      ? readString(record.missingSourceState) ?? 'unknown'
      : 'restricted',
    privacyScope: canSeeScopedDetails ? privacyScope : 'restricted',
    nextAction: canSeeScopedDetails && !shouldUseReviewerFallback
      ? {
          href: href ?? '/profile/evidence',
          label: label ?? '查看证据',
        }
      : {
          href: restrictedFallbackAction.href,
          label: restrictedFallbackAction.label,
        },
  };
}

function readLearnerRecordSourceScope(value: unknown): EvidenceTimelineLearnerRecordSourceScope | undefined {
  return value === 'interactive-lesson-submission'
    || value === 'arena-official-result'
    || value === 'arena-preview-result'
    || value === 'simulation-workbench-completion'
    || value === 'adaptive-practice-submission'
    ? value
    : undefined;
}

function readLearnerRecordFreshness(value: unknown): EvidenceTimelineLearnerRecord['freshness'] {
  return value === 'fresh' || value === 'recent' || value === 'stale' ? value : 'unknown';
}

function readLearnerRecordConfidence(value: unknown): EvidenceTimelineLearnerRecord['confidence'] {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'unknown';
}

function inferLearnerRecordSourceScope(
  fact: EvidenceTimelineSourceRecord,
): EvidenceTimelineLearnerRecordSourceScope | undefined {
  const arenaSourceScope = inferArenaLearnerRecordSourceScope(fact);
  if (arenaSourceScope) {
    return arenaSourceScope;
  }
  if (fact.factType === 'adaptive_practice' || fact.moduleId === 'adaptive-practice' || fact.moduleId === 'adaptive-assessment') {
    return 'adaptive-practice-submission';
  }
  if (fact.factType === 'question' && (fact.hasInteractiveResponse || fact.lessonId || fact.moduleId?.startsWith('step-'))) {
    return 'interactive-lesson-submission';
  }
  if (fact.factType === 'simulation' || fact.moduleId?.includes('workbench')) {
    return 'simulation-workbench-completion';
  }
  return undefined;
}

function inferArenaLearnerRecordSourceScope(
  fact: EvidenceTimelineSourceRecord,
): EvidenceTimelineLearnerRecordSourceScope | undefined {
  const context = readRecord(fact.contextJson);
  const arena = readRecord(context.arena);
  const arenaEvidenceWriteback = readRecord(arena.evidenceWriteback);
  const sourceEventId = fact.sourceEventId ?? '';

  if (
    fact.factType === 'arena_official'
    || fact.factType === 'arena_submission'
    || arena.official === true
    || arena.evaluationMode === 'official'
    || arena.evaluationVisibility === 'official'
    || sourceEventId.startsWith('arena-official:')
    || (
      arenaEvidenceWriteback.status === 'accepted'
      && arenaEvidenceWriteback.terminalValidationAccepted === true
    )
  ) {
    return 'arena-official-result';
  }

  if (
    fact.factType === 'arena_preview'
    || fact.moduleId?.startsWith('arena-preview')
    || sourceEventId.includes('arena_simulation_run')
    || sourceEventId.includes('arena_virtual_simulation_import')
    || Object.keys(arena).length > 0
  ) {
    return 'arena-preview-result';
  }

  return undefined;
}

function inferLearnerRecordFreshness(fact: LearningFactTimelineRecord): EvidenceTimelineLearnerRecord['freshness'] {
  const ageMs = Date.now() - fact.startedAt.getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'unknown';
  const ageDays = ageMs / 86400000;
  if (ageDays <= 14) return 'fresh';
  if (ageDays <= 90) return 'recent';
  return 'stale';
}

function inferLearnerRecordConfidence(
  fact: LearningFactTimelineRecord,
  quality: SubmissionEvidenceQuality | undefined,
  sourceScope: EvidenceTimelineLearnerRecordSourceScope,
): EvidenceTimelineLearnerRecord['confidence'] {
  if (quality === 'rich') return 'high';
  if (sourceScope === 'arena-official-result') return 'high';
  if (quality === 'partial' || quality === 'legacy') return 'medium';
  if (sourceScope === 'arena-preview-result') return 'medium';
  if (typeof fact.score === 'number' && fact.score >= 80) return 'medium';
  return 'low';
}

function inferLearnerRecordMissingSourceState(
  fact: LearningFactTimelineRecord,
  quality: SubmissionEvidenceQuality | undefined,
  sourceScope: EvidenceTimelineLearnerRecordSourceScope,
): string {
  if (sourceScope === 'arena-preview-result') return 'official-arena-missing';
  if (quality === 'missing' || fact.outcome === 'abandoned') return 'low-confidence';
  if (quality === 'partial' || quality === 'legacy') return 'partial';
  return 'complete';
}

function readLearnerRecordPrivacyScope(value: unknown): EvidenceTimelineLearnerRecord['privacyScope'] {
  if (value === undefined || value === null || value === '') {
    return 'student-visible';
  }
  return value === 'teacher-scoped' || value === 'governance-scoped' || value === 'student-visible'
    ? value
    : 'restricted';
}

function viewerCanSeeLearnerRecordScope(
  viewerRole: EvidenceTimelineViewerRole,
  privacyScope: EvidenceTimelineLearnerRecord['privacyScope'],
) {
  if (privacyScope === 'student-visible') return true;
  if (privacyScope === 'teacher-scoped') return viewerRole === 'teacher' || viewerRole === 'admin';
  if (privacyScope === 'governance-scoped') return viewerRole === 'admin';
  return false;
}

function groupEvidenceTimelineItems(items: EvidenceTimelineItem[]): EvidenceTimelineItem[] {
  const groupedItems: EvidenceTimelineItem[] = [];
  let index = 0;

  while (index < items.length) {
    const item = items[index];
    const key = lowSignalGroupKey(item);
    if (!key) {
      groupedItems.push({ ...item, displayPriority: 'normal' });
      index += 1;
      continue;
    }

    const group = [item];
    let nextIndex = index + 1;
    while (nextIndex < items.length && lowSignalGroupKey(items[nextIndex]) === key) {
      group.push(items[nextIndex]);
      nextIndex += 1;
    }

    if (group.length <= 1) {
      groupedItems.push({ ...item, displayPriority: 'normal' });
      index = nextIndex;
      continue;
    }

    groupedItems.push(compactObject({
      ...item,
      displayPriority: 'deemphasized' as const,
      groupKey: key,
      groupLabel: `重复低信号证据 ${group.length} 条`,
      groupedCount: group.length,
      groupedEvidenceIds: group.map((entry) => entry.id),
    }));
    index = nextIndex;
  }

  return groupedItems;
}

function lowSignalGroupKey(item: EvidenceTimelineItem): string | null {
  const sparseQuestion = item.factType === 'question' && !item.questionSummaries?.length;
  if (!sparseQuestion) return null;

  return [
    item.factType,
    item.outcome,
    item.lessonId ?? 'unknown-lesson',
    item.stepId ?? item.moduleId ?? 'unknown-step',
    item.quality ?? 'sparse',
  ].join('|');
}

function resolveCursorFact(
  visibleItems: EvidenceTimelineItem[],
  facts: LearningFactTimelineRecord[]
): LearningFactTimelineRecord | undefined {
  const coveredIds = new Set(
    visibleItems.flatMap((item) => item.groupedEvidenceIds ?? [item.id])
  );
  let cursorFact: LearningFactTimelineRecord | undefined;

  for (const fact of facts) {
    if (coveredIds.has(fact.id)) {
      cursorFact = fact;
    }
  }

  return cursorFact;
}

function compareTimelineFactOrder(left: LearningFactTimelineRecord, right: LearningFactTimelineRecord): number {
  if (left.startedAt.getTime() !== right.startedAt.getTime()) {
    return right.startedAt.getTime() - left.startedAt.getTime();
  }
  if (left.createdAt.getTime() !== right.createdAt.getTime()) {
    return right.createdAt.getTime() - left.createdAt.getTime();
  }
  return right.id.localeCompare(left.id);
}

function resolveQuality(
  responseData: Record<string, unknown>,
  contextJson: Record<string, unknown>
) {
  if (Object.keys(responseData).length > 0) {
    return summarizeSubmissionEvidencePayload(responseData);
  }

  const scoring = readRecord(contextJson.scoring);
  const evidenceQuality = readString(scoring.evidenceQuality) ?? readString(contextJson.evidenceQuality);
  if (!evidenceQuality) return undefined;

  return {
    quality: evidenceQuality === 'legacy-envelope' ? 'legacy' : evidenceQuality as SubmissionEvidenceQuality,
    reason: readString(scoring.reason) ?? undefined,
    sourceState: undefined,
    schemaVersion: readString(contextJson.schemaVersion),
  };
}

function matchesDimension(
  fact: LearningFactTimelineRecord,
  dimension?: PortraitV2DimensionId | CompetencyDimension
): boolean {
  if (!dimension) return true;
  const contribution = readNumericRecord(fact.competencyContribution);
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: accept historical six-dimensional filters while mapping to v2.
  if (COMPETENCY_DIMENSIONS.includes(dimension as CompetencyDimension)) {
    return Number.isFinite(contribution[dimension as CompetencyDimension]) &&
      contribution[dimension as CompetencyDimension] !== 0;
  }
  const portraitDimension = dimension as PortraitV2DimensionId;
  if (Number.isFinite(contribution[portraitDimension]) && contribution[portraitDimension] !== 0) {
    return true;
  }
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: map legacy evidence contributions into portrait dimensions.
  return COMPETENCY_DIMENSIONS.some((legacyDimension) =>
    mapLegacyCompetencyDimensionToPortraitV2(legacyDimension).targetDimensions.includes(portraitDimension) &&
    Number.isFinite(contribution[legacyDimension]) && contribution[legacyDimension] !== 0
  );
}

function parseDimension(value: string | null): PortraitV2DimensionId | CompetencyDimension | undefined {
  const dimension = readSearchString(value);
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: parse historical dimension ids for compatibility queries.
  if (COMPETENCY_DIMENSIONS.includes(dimension as CompetencyDimension)) {
    return dimension as CompetencyDimension;
  }
  return PORTRAIT_V2_DIMENSION_IDS.includes(dimension as PortraitV2DimensionId)
    ? dimension as PortraitV2DimensionId
    : undefined;
}

function parseLimit(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function normalizeFilters(filters: EvidenceTimelineFilters): EvidenceTimelineFilters {
  return compactFilters({
    cursor: readSearchString(filters.cursor),
    limit: typeof filters.limit === 'number'
      ? Math.min(Math.max(Math.floor(filters.limit), 1), MAX_LIMIT)
      : DEFAULT_LIMIT,
    dimension: filters.dimension,
    lessonId: readSearchString(filters.lessonId),
    factType: readSearchString(filters.factType),
    outcome: readSearchString(filters.outcome),
    sessionId: readSearchString(filters.sessionId),
    assignment: readSearchString(filters.assignment),
    criterion: readSearchString(filters.criterion),
    assignmentSource: readSearchString(filters.assignmentSource),
  });
}

function compactFilters(filters: EvidenceTimelineFilters): EvidenceTimelineFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== '')
  ) as EvidenceTimelineFilters;
}

function createCursorFromFact(fact: LearningFactTimelineRecord | undefined): string | null {
  return fact ? createEvidenceTimelineCursor(cursorFromFact(fact)) : null;
}

function cursorFromFact(fact: LearningFactTimelineRecord): EvidenceTimelineCursor {
  return {
    startedAt: fact.startedAt.toISOString(),
    createdAt: fact.createdAt.toISOString(),
    id: fact.id,
  };
}

function decodeCursor(cursor?: string): EvidenceTimelineCursor | null {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as Partial<EvidenceTimelineCursor>;
    if (
      typeof parsed.id === 'string'
      && typeof parsed.startedAt === 'string'
      && typeof parsed.createdAt === 'string'
      && Number.isFinite(new Date(parsed.startedAt).getTime())
      && Number.isFinite(new Date(parsed.createdAt).getTime())
    ) {
      return {
        id: parsed.id,
        startedAt: parsed.startedAt,
        createdAt: parsed.createdAt,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function readQuestionSummaries(value: unknown, redactAnswers = false): EvidenceTimelineQuestionSummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const entry = readRecord(item);
      const studentAnswer = readAnswer(entry.studentAnswer ?? entry.selectedValue ?? entry.answer ?? entry.value);
      return compactObject({
        questionId: readString(entry.questionId) ?? readString(entry.id),
        prompt: readString(entry.prompt) ?? readString(entry.title),
        studentAnswer: redactAnswers ? undefined : studentAnswer,
        studentAnswerRedacted: redactAnswers && studentAnswer !== undefined && studentAnswer !== null,
        referenceAnswer: readString(entry.referenceAnswer)
          ?? readString(entry.referenceValue)
          ?? readString(entry.correctAnswer),
        isCorrect: typeof entry.isCorrect === 'boolean' ? entry.isCorrect : undefined,
      });
    })
    .filter((item) => Object.keys(item).length > 0)
    .slice(0, 5);
}

function readNumericRecord(value: unknown): Record<string, number> {
  const record = readRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter(([, entry]) => typeof entry === 'number' && Number.isFinite(entry))
  ) as Record<string, number>;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readSearchString(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readAnswer(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}
