import type { ArenaCoreEventType } from './arena-events';

export { ARENA_CORE_EVENT_TYPES } from './arena-events';
export type { ArenaCoreEventType } from './arena-events';

export interface ArenaCoreEvent {
  type: ArenaCoreEventType;
  resourceKey: string;
  priority: 'core';
  payload: Record<string, string | number | boolean | null>;
  timestamp: number;
}

export function buildArenaCoreEvent(
  type: ArenaCoreEventType,
  payload: { taskId: string } & Record<string, string | number | boolean | null>,
  timestamp = Date.now(),
): ArenaCoreEvent {
  return {
    type,
    resourceKey: `arena:${payload.taskId}`,
    priority: 'core',
    payload,
    timestamp,
  };
}

export function buildArenaInteractionEvent(
  type: ArenaCoreEventType,
  payload: { taskId: string } & Record<string, string | number | boolean | null>,
  timestamp = Date.now(),
) {
  const coreEvent = buildArenaCoreEvent(type, payload, timestamp);

  return {
    id: `${type}:${payload.taskId}:${timestamp}`,
    type,
    resourceKey: coreEvent.resourceKey,
    timestamp,
    data: {
      ...coreEvent.payload,
      eventType: type,
      originPath: payload.originPath ?? null,
      pageType: payload.pageType ?? 'workspace',
    },
  };
}

export function sendArenaCoreEvent(
  type: ArenaCoreEventType,
  payload: { taskId: string } & Record<string, string | number | boolean | null>,
) {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  const event = buildArenaInteractionEvent(type, {
    ...payload,
    originPath: payload.originPath ?? window.location.pathname,
  });

  if (type === 'arena_evaluation_complete') {
    window.dispatchEvent(new CustomEvent('arena:evaluation-complete', { detail: payload }));
  }

  return fetch('/api/interactive/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [event] }),
    keepalive: true,
  }).catch(() => undefined);
}
