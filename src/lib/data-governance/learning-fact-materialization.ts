import type { Prisma } from '@prisma/client';

import type { LearningEvent } from './event-protocol';
import { isCoreEvent } from './event-types';
import {
  deriveFactOutcome,
  deriveFactScore,
  deriveFactTimeSpent,
  mapActionTypeToFactType,
  resolveCanonicalEventType,
  resolveCompetencyContribution,
} from './event-normalization';

type LearningFactCreateManyDelegate = {
  createMany(args: {
    data: Prisma.LearningFactCreateManyInput[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
};

export interface LearningFactPersistenceResult {
  created: number;
  skipped: boolean;
  actionType: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readJsonObject(value: unknown): Prisma.InputJsonValue | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Prisma.InputJsonValue;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Prisma.InputJsonValue
      : undefined;
  } catch {
    return undefined;
  }
}

function buildArenaLearningContext(actionType: string, payload: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!actionType.startsWith('arena_')) return undefined;
  const taskId = readString(payload.taskId);
  if (!taskId) return undefined;
  const metrics = readJsonObject(payload.metrics) ?? readJsonObject(payload.metricsJson);
  return {
    arena: {
      taskId,
      objectId: readString(payload.objectId),
      method: readString(payload.method),
      score: typeof payload.score === 'number' && Number.isFinite(payload.score) ? payload.score : undefined,
      valid: typeof payload.valid === 'boolean' ? payload.valid : undefined,
      artifactHash: readString(payload.artifactHash),
      metricProfileId: readString(payload.metricProfileId),
      leaderboardPolicyId: readString(payload.leaderboardPolicyId),
      publicationId: readString(payload.publicationId),
      classId: readString(payload.classId),
      seasonId: readString(payload.seasonId),
      metrics,
    },
  };
}

export function resolveLearningFactActionType(event: LearningEvent): string {
  const payload =
    event.payload && typeof event.payload === 'object'
      ? event.payload
      : {};

  return resolveCanonicalEventType(event.actionType, payload);
}

function shouldMaterializeLearningFact(actionType: string, payload: Record<string, unknown>): boolean {
  if (payload.skipLearningFact === true) {
    return false;
  }

  if (
    actionType === 'arena_challenge_open' ||
    actionType === 'arena_workspace_start' ||
    actionType === 'arena_result_view' ||
    actionType === 'arena_leaderboard_view' ||
    actionType === 'arena_feedback_view'
  ) {
    return false;
  }

  if (isCoreEvent(actionType)) {
    return true;
  }

  return actionType === 'workspace_param_change' && payload.sampled === true;
}

export function eventToLearningFactInput(event: LearningEvent): Prisma.LearningFactCreateManyInput | null {
  const actionType = resolveLearningFactActionType(event);
  const payload =
    event.payload && typeof event.payload === 'object'
      ? event.payload
      : {};

  if (!shouldMaterializeLearningFact(actionType, payload)) {
    return null;
  }

  if (payload.afterSessionEnd === true && payload.countAfterSessionEnd !== true) {
    return null;
  }

  const fact: Prisma.LearningFactCreateManyInput & { contextJson?: Prisma.InputJsonValue } = {
    userId: event.userId,
    factType: mapActionTypeToFactType(actionType),
    moduleId: event.moduleId ?? readString(payload.moduleId) ?? readString(payload.taskId) ?? readString(payload.stepId),
    sessionId: event.sessionId ?? readString(payload.sessionId),
    startedAt: new Date(event.occurredAt),
    finishedAt: new Date(event.occurredAt),
    outcome: deriveFactOutcome(actionType, payload),
    score: deriveFactScore(payload),
    timeSpent: deriveFactTimeSpent(payload),
    competencyContribution: resolveCompetencyContribution(
      actionType,
      payload,
      event.derivedMetrics,
    ) as Prisma.InputJsonValue,
    sourceEventId: event.eventId,
    sourceLogId: readString(payload.sourceLogId),
    courseId: event.courseId ?? readString(payload.courseId),
    lessonId: event.lessonId ?? readString(payload.lessonId) ?? readString(payload.lessonKey),
  };
  const arenaContext = buildArenaLearningContext(actionType, payload);
  if (arenaContext) {
    fact.contextJson = arenaContext;
  }
  return fact;
}

export async function persistCoreLearningFact(
  db: { learningFact: LearningFactCreateManyDelegate },
  event: LearningEvent,
): Promise<LearningFactPersistenceResult> {
  const actionType = resolveLearningFactActionType(event);
  const fact = eventToLearningFactInput(event);
  if (!fact) {
    return { created: 0, skipped: true, actionType };
  }

  const result = await db.learningFact.createMany({
    data: [fact],
    skipDuplicates: true,
  });

  return {
    created: result.count,
    skipped: result.count === 0,
    actionType,
  };
}
