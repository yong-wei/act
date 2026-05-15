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

export interface ArenaCoreEventData {
  taskId?: string | null;
  objectId?: string | null;
  method?: string | null;
  workspaceMode?: string | null;
  score?: number | null;
  valid?: boolean | null;
  artifactHash?: string | null;
  metricProfileId?: string | null;
  leaderboardPolicyId?: string | null;
}
