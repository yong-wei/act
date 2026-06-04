import type { LearningFact, Prisma } from '@prisma/client';

import type { EvidenceQuestionSummary } from './competency-engine';
import {
  COMPETENCY_DIMENSIONS,
  type CompetencyDimension,
} from './competency-model';
import {
  summarizeSubmissionEvidencePayload,
  type SubmissionEvidenceQuality,
} from './submission-evidence-quality';

export interface EvidenceTimelineFilters {
  cursor?: string;
  limit?: number;
  dimension?: CompetencyDimension;
  lessonId?: string;
  factType?: string;
  outcome?: string;
  sessionId?: string;
}

export interface EvidenceTimelineCursor {
  startedAt: string;
  createdAt: string;
  id: string;
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
  questionSummaries?: EvidenceQuestionSummary[];
  quality?: SubmissionEvidenceQuality;
  qualityReason?: string;
  sourceState?: string;
  schemaVersion?: string | null;
  displayPriority?: 'normal' | 'deemphasized';
  groupKey?: string;
  groupLabel?: string;
  groupedCount?: number;
  groupedEvidenceIds?: string[];
}

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
  });
}

export async function listEvidenceTimeline({
  db,
  userId,
  filters = {},
}: {
  db: EvidenceTimelineDb;
  userId: string;
  filters?: EvidenceTimelineFilters;
}): Promise<EvidenceTimelinePage> {
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
    groupableFacts.map((fact) => formatEvidenceTimelineItem(fact, responseBySourceLogId.get(fact.sourceLogId ?? '')))
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

  const cursor = decodeCursor(filters.cursor);
  if (cursor) {
    where.AND = [
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
    ];
  }

  return where;
}

function formatEvidenceTimelineItem(
  fact: LearningFactTimelineRecord,
  response?: StudentStepResponseTimelineRecord
): EvidenceTimelineItem {
  const responseData = readRecord(response?.responseData);
  const contextJson = readRecord(fact.contextJson);
  const quality = resolveQuality(responseData, contextJson);
  const questionSummaries = readQuestionSummaries(responseData.questionSummaries ?? contextJson.questionSummaries ?? contextJson.cards);

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
  });
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
  dimension?: CompetencyDimension
): boolean {
  if (!dimension) return true;
  const contribution = readNumericRecord(fact.competencyContribution);
  return Number.isFinite(contribution[dimension]) && contribution[dimension] !== 0;
}

function parseDimension(value: string | null): CompetencyDimension | undefined {
  const dimension = readSearchString(value);
  return COMPETENCY_DIMENSIONS.includes(dimension as CompetencyDimension)
    ? dimension as CompetencyDimension
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

function readQuestionSummaries(value: unknown): EvidenceQuestionSummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const entry = readRecord(item);
      return compactObject({
        questionId: readString(entry.questionId) ?? readString(entry.id),
        prompt: readString(entry.prompt) ?? readString(entry.title),
        studentAnswer: readAnswer(entry.studentAnswer ?? entry.selectedValue ?? entry.answer ?? entry.value),
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
