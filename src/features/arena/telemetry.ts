export const ARENA_CORE_EVENT_TYPES = [
  'arena_challenge_open',
  'arena_workspace_start',
  'arena_simulation_run',
  'arena_controller_save',
  'arena_identification_model_save',
  'arena_virtual_simulation_import',
  'arena_submit',
  'arena_evaluation_complete',
  'arena_result_view',
  'arena_leaderboard_view',
  'arena_feedback_view',
] as const;

export type ArenaCoreEventType = typeof ARENA_CORE_EVENT_TYPES[number];

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

  return fetch('/api/interactive/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: [event] }),
    keepalive: true,
  }).catch(() => undefined);
}
