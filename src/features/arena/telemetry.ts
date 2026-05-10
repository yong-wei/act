export const ARENA_CORE_EVENT_TYPES = [
  'arena_challenge_open',
  'arena_workspace_start',
  'arena_simulation_run',
  'arena_submit',
  'arena_leaderboard_view',
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
