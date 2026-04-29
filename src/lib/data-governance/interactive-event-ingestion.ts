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

export function attachSourceLogIds(
  events: ValidInteractionEvent[],
  persistedLogs: PersistedInteractionLogReference[],
): ValidInteractionEvent[] {
  const sourceLogIdByClientEventId = new Map(
    persistedLogs
      .filter((log) => typeof log.clientEventId === 'string' && log.clientEventId.trim().length > 0)
      .map((log) => [log.clientEventId as string, log.id]),
  );

  return events.map(({ event, resourceId }) => {
    const sourceLogId = typeof event.id === 'string'
      ? sourceLogIdByClientEventId.get(event.id)
      : undefined;

    if (!sourceLogId) {
      return { event, resourceId };
    }

    return {
      resourceId,
      event: {
        ...event,
        data: {
          ...(event.data ?? {}),
          sourceLogId,
        },
      },
    };
  });
}
