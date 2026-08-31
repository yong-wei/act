import { createIdempotentPluginWritePort } from '../adapters/write-port';
import { createControlCorrectionLearningRecordAdapter } from './learning-record-adapter';
import type { GoalPluginEvidencePort, PersonalizationGoalPlugin } from '../types';
import {
  CONTROL_CORRECTION_ARENA_OFFICIAL_TARGET,
  CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_LESSON_ID_VALUES,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
} from './mappings';
import { CONTROL_CORRECTION_PATH_PLANNING_POLICY } from './path-planning-policy';
import { controlCorrectionGoalSliceDefinition } from './slice-contract';

type EvidencePortFactory = (db: never) => GoalPluginEvidencePort;

let evidencePortFactory: EvidencePortFactory | null = null;

export function bindControlCorrectionEvidencePortFactory(factory: EvidencePortFactory) {
  evidencePortFactory = factory;
}

export function createControlCorrectionPersonalizationPlugin(
  status: PersonalizationGoalPlugin['status'] = 'active',
  sliceDefinition: PersonalizationGoalPlugin['sliceDefinition'] = controlCorrectionGoalSliceDefinition,
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
    arenaOfficialTarget: { ...CONTROL_CORRECTION_ARENA_OFFICIAL_TARGET },
    pathPlanningPolicy: structuredClone(CONTROL_CORRECTION_PATH_PLANNING_POLICY),
    createEvidencePort: (db) => {
      if (!evidencePortFactory) {
        throw new Error('Control-correction evidence port is server-only and is not bound in this runtime.');
      }
      return evidencePortFactory(db as never);
    },
    createWritePort: createIdempotentPluginWritePort,
    createLearningRecordAdapter: createControlCorrectionLearningRecordAdapter,
  };
}
