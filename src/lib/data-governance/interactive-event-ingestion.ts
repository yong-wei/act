import type { ClassroomInteractionEventInput } from '@/lib/classroom-analytics/types';

export interface SessionEndMetadata {
  status: string | null;
  endTime: Date | null;
}

export interface ValidInteractionEvent {
  event: ClassroomInteractionEventInput;
  resourceId: string | null;
}

export interface PersistedInteractionLogReference {
  id: string;
  clientEventId: string | null;
}

export type LearningContext =
  | 'classroom_live'
  | 'classroom_review'
  | 'pre_class_resource'
  | 'post_class_resource'
  | 'standalone_resource';

export type InvalidContextReason =
  | 'invalid_session_id_format'
  | 'unknown_session';

export interface NormalizedInteractionEvent extends ValidInteractionEvent {
  clientEventId: string | null;
  sessionId: string | null;
  learningContext: LearningContext;
  invalidContextReason: InvalidContextReason | null;
}

function toDateTime(value: number | string | null | undefined): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

function readPayloadString(payload: Record<string, unknown> | undefined, key: string): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function resolveClientEventId(event: ClassroomInteractionEventInput): string | null {
  if (typeof event.id === 'string' && event.id.trim().length > 0) {
    return event.id.trim();
  }
  return readPayloadString(event.data, 'clientEventId');
}

function isValidSessionId(value: string): boolean {
  return /^c[a-z0-9]{24}$/i.test(value);
}

function hasPayloadFlag(payload: Record<string, unknown> | undefined, keys: string[]): boolean {
  if (!payload) return false;
  return keys.some((key) => payload[key] === true || payload[key] === 'true');
}

function resolveStandaloneLearningContext(payload: Record<string, unknown> | undefined): LearningContext {
  const explicitContext = readPayloadString(payload, 'learningContext');
  if (
    explicitContext === 'pre_class_resource'
    || explicitContext === 'post_class_resource'
    || explicitContext === 'standalone_resource'
  ) {
    return explicitContext;
  }

  const phase = readPayloadString(payload, 'learningPhase') ?? readPayloadString(payload, 'phase');
  if (phase === 'pre_class' || phase === 'preview' || phase === 'before_class') {
    return 'pre_class_resource';
  }
  if (phase === 'post_class' || phase === 'review' || phase === 'after_class') {
    return 'post_class_resource';
  }
  if (hasPayloadFlag(payload, ['preClass', 'beforeClass'])) {
    return 'pre_class_resource';
  }
  if (hasPayloadFlag(payload, ['postClass', 'afterClass', 'afterSessionEnd'])) {
    return 'post_class_resource';
  }

  return 'standalone_resource';
}

export function normalizeInteractionContexts(
  events: ValidInteractionEvent[],
  sessionEndById: Map<string, SessionEndMetadata>,
): NormalizedInteractionEvent[] {
  return events.map(({ event, resourceId }) => {
    const rawSessionId = typeof event.sessionId === 'string' && event.sessionId.trim().length > 0
      ? event.sessionId.trim()
      : null;
    const clientEventId = resolveClientEventId(event);
    const eventTime = toDateTime(event.clientEventAt ?? event.timestamp);
    const sessionEnd = rawSessionId ? sessionEndById.get(rawSessionId) : null;
    let sessionId = rawSessionId;
    let invalidContextReason: InvalidContextReason | null = null;

    if (rawSessionId && !isValidSessionId(rawSessionId)) {
      sessionId = null;
      invalidContextReason = 'invalid_session_id_format';
    } else if (rawSessionId && !sessionEnd) {
      sessionId = null;
      invalidContextReason = 'unknown_session';
    }

    const isAfterSessionEnd =
      Boolean(sessionId) &&
      sessionEnd?.status === 'FINISHED' &&
      sessionEnd.endTime instanceof Date &&
      eventTime instanceof Date &&
      eventTime.getTime() > sessionEnd.endTime.getTime();

    const learningContext: LearningContext = sessionId
      ? isAfterSessionEnd
        ? 'classroom_review'
        : 'classroom_live'
      : resolveStandaloneLearningContext(event.data);

    return {
      resourceId,
      clientEventId,
      sessionId,
      learningContext,
      invalidContextReason,
      event: {
        ...event,
        sessionId,
        data: {
          ...(event.data ?? {}),
          ...(clientEventId ? { clientEventId } : {}),
          ...(isAfterSessionEnd ? { afterSessionEnd: true } : {}),
          learningContext,
          ...(invalidContextReason ? { invalidContextReason } : {}),
        },
      },
    };
  });
}

export function attachAfterSessionEndFlags(
  events: ValidInteractionEvent[],
  sessionEndById: Map<string, SessionEndMetadata>,
): ValidInteractionEvent[] {
  return events.map(({ event, resourceId }) => {
    const sessionId = typeof event.sessionId === 'string' ? event.sessionId : null;
    const sessionEnd = sessionId ? sessionEndById.get(sessionId) : null;
    const eventTime = toDateTime(event.clientEventAt ?? event.timestamp);
    const isAfterSessionEnd =
      sessionEnd?.status === 'FINISHED' &&
      sessionEnd.endTime instanceof Date &&
      eventTime instanceof Date &&
      eventTime.getTime() > sessionEnd.endTime.getTime();

    if (!isAfterSessionEnd) {
      return { event, resourceId };
    }

    return {
      resourceId,
      event: {
        ...event,
        data: {
          ...(event.data ?? {}),
          afterSessionEnd: true,
        },
      },
    };
  });
}

export function attachSourceLogIds<T extends ValidInteractionEvent>(
  events: T[],
  persistedLogs: PersistedInteractionLogReference[],
): T[] {
  const sourceLogIdByClientEventId = new Map(
    persistedLogs
      .filter((log) => typeof log.clientEventId === 'string' && log.clientEventId.trim().length > 0)
      .map((log) => [log.clientEventId as string, log.id]),
  );

  return events.map((item) => {
    const { event, resourceId } = item;
    const clientEventId = resolveClientEventId(event);
    const sourceLogId = clientEventId
      ? sourceLogIdByClientEventId.get(clientEventId)
      : undefined;
    const { sourceLogId: _untrustedSourceLogId, ...trustedPayload } = event.data ?? {};

    if (!sourceLogId) {
      return {
        ...item,
        resourceId,
        event: {
          ...event,
          data: trustedPayload,
        },
      } as T;
    }

    return {
      ...item,
      resourceId,
      event: {
        ...event,
        data: {
          ...trustedPayload,
          sourceLogId,
        },
      },
    } as T;
  });
}
