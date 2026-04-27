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

export function resolveLearningFactActionType(event: LearningEvent): string {
  const payload =
    event.payload && typeof event.payload === 'object'
      ? event.payload
      : {};

  return resolveCanonicalEventType(event.actionType, payload);
}

export function eventToLearningFactInput(event: LearningEvent): Prisma.LearningFactCreateManyInput | null {
  const actionType = resolveLearningFactActionType(event);
  if (!isCoreEvent(actionType)) {
    return null;
  }

  const payload =
    event.payload && typeof event.payload === 'object'
      ? event.payload
      : {};

  return {
    userId: event.userId,
    factType: mapActionTypeToFactType(actionType),
    moduleId: event.moduleId ?? readString(payload.moduleId),
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
