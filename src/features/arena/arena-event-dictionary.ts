import { ARENA_CORE_EVENT_TYPES } from './arena-events';
import type { ArenaCoreEventData, ArenaCoreEventType } from './arena-events';

export { ARENA_CORE_EVENT_TYPES };
export type { ArenaCoreEventData, ArenaCoreEventType };

export const HIGH_VALUE_FACT_EVENTS = new Set<ArenaCoreEventType>([
  'arena_evaluation_complete',
  'arena_identification_model_save',
  'arena_submit',
]);

export const ARENA_COMPETENCY_DIMENSIONS: Record<string, string> = {
  arena_evaluation_complete: '参数设计与调优',
  arena_identification_model_save: '跨域迁移与联动',
  arena_submit: '工程决策与约束',
  arena_challenge_open: '自主学习进展',
  arena_leaderboard_view: '探究反思与提示词',
};
