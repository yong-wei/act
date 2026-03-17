'use client';

import type { ClassroomInteractionEventInput } from '@/lib/classroom-analytics/types';
import type { CourseEventType } from '@/lib/classroom-analytics/event-taxonomy';

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
  data?: Record<string, unknown>;
}

export function buildCourseEvent(input: BuildCourseEventInput): ClassroomInteractionEventInput {
  const clientEventAt = input.clientEventAt ?? Date.now();
  return {
    resourceId: input.resourceId ?? null,
    resourceKey: input.resourceKey,
    sessionId: input.sessionId ?? null,
    lessonKey: input.lessonKey ?? null,
    stepId: input.stepId ?? null,
    actorRole: input.actorRole ?? null,
    attemptKey: input.attemptKey ?? null,
    type: input.eventType,
    timestamp: Date.now(),
    clientEventAt,
    data: input.data ?? {},
  };
}
