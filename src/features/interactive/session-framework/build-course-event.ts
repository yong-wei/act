'use client';

import type { ClassroomInteractionEventInput } from '@/lib/classroom-analytics/types';
import type { CourseEventType } from '@/lib/classroom-analytics/event-taxonomy';
import { buildClassroomLifecycleEvidenceFields } from '@/lib/classroom-lifecycle-contract';

interface BuildCourseEventInput {
  eventType: CourseEventType;
  resourceKey: string;
  resourceId?: string | null;
  sessionId?: string | null;
  lessonKey?: string | null;
  stepId?: string | null;
  actorRole?: string | null;
  attemptKey?: string | null;
  clientEventAt?: number | string | null;
  clientEventId?: string | null;
  sourceLogId?: string | null;
  cardId?: string | null;
  dedupeIdentity?: string | null;
  data?: Record<string, unknown>;
}

function resolveResourceId(resourceId?: string | null): string | null {
  if (!resourceId) return null;
  return /^c[\w]{24}$/.test(resourceId) ? resourceId : null;
}

export function buildCourseEvent(input: BuildCourseEventInput): ClassroomInteractionEventInput {
  const clientEventAt = input.clientEventAt ?? Date.now();
  const targetId = input.cardId ?? input.stepId ?? 'session';
  const clientEventId = input.clientEventId?.trim()
    || [input.sessionId, input.eventType, targetId, clientEventAt].join(':');
  const lifecycleEvidence = input.sessionId
    ? buildClassroomLifecycleEvidenceFields({
        eventType: input.eventType,
        actorRole: input.actorRole ?? 'unknown',
        sessionId: input.sessionId,
        stepId: input.stepId ?? null,
        cardId: input.cardId ?? null,
        clientEventId,
        sourceLogId: input.sourceLogId ?? null,
        clientEventAt,
      })
    : null;
  return {
    resourceId: resolveResourceId(input.resourceId),
    resourceKey: input.resourceKey,
    sessionId: input.sessionId ?? null,
    lessonKey: input.lessonKey ?? null,
    stepId: input.stepId ?? null,
    actorRole: input.actorRole ?? null,
    attemptKey: input.attemptKey ?? null,
    type: input.eventType,
    timestamp: Date.now(),
    clientEventAt,
    data: lifecycleEvidence
      ? { ...(input.data ?? {}), ...lifecycleEvidence }
      : (input.data ?? {}),
  };
}
