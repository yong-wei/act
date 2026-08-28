import { createIdempotentPluginWritePort } from '../adapters/write-port';
import type { PersonalizationGoalPlugin } from '../types';
import type { AdaptiveGoalSliceDefinition } from '@/features/personalization/learner-state/internal';
import { createControlCorrectionEvidencePort } from './db-evidence';
import {
  CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_LESSON_ID_VALUES,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
} from './mappings';
import { CONTROL_CORRECTION_PATH_PLANNING_POLICY } from './path-planning-policy';
import { controlCorrectionGoalSliceDefinition } from './slice-contract';

export function createControlCorrectionPersonalizationPlugin(
  status: PersonalizationGoalPlugin['status'] = 'active',
  sliceDefinition: AdaptiveGoalSliceDefinition = controlCorrectionGoalSliceDefinition,
): PersonalizationGoalPlugin {
  return {
    pluginId: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
    goalId: CONTROL_CORRECTION_GOAL_ID,
    version: CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
    status,
    courseIds: CONTROL_CORRECTION_COURSE_ID_VALUES,
    lessonIds: CONTROL_CORRECTION_LESSON_ID_VALUES,
    arenaTaskIds: CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
    sliceDefinition,
    pathPlanningPolicy: structuredClone(CONTROL_CORRECTION_PATH_PLANNING_POLICY),
    createEvidencePort: createControlCorrectionEvidencePort,
    createWritePort: createIdempotentPluginWritePort,
  };
}
