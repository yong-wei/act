export const CONTROL_CORRECTION_GOAL_ID = 'control-correction' as const;

export const CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID =
  'control-correction-personalization-plugin';

export const CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION =
  'control-correction-personalization-plugin.v1';

export const CONTROL_CORRECTION_COURSE_ID_VALUES = [
  CONTROL_CORRECTION_GOAL_ID,
  '3-6',
  'unit-3-6-zero-design-workshop',
  'unit-3-6-zero-design-workshop-v1',
] as const;

export const CONTROL_CORRECTION_LESSON_ID_VALUES = CONTROL_CORRECTION_COURSE_ID_VALUES;

export const CONTROL_CORRECTION_ARENA_TASK_ID_VALUES = [
  'task-second-order-lead-pid',
] as const;

export const CONTROL_CORRECTION_COURSE_IDS = new Set<string>(CONTROL_CORRECTION_COURSE_ID_VALUES);
export const CONTROL_CORRECTION_LESSON_IDS = new Set<string>(CONTROL_CORRECTION_LESSON_ID_VALUES);
export const CONTROL_CORRECTION_ARENA_TASK_IDS = new Set<string>(
  CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
);
