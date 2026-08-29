import { personalizationPluginRegistry } from './default-registry';
import type { PersonalizationPluginRationaleCitation } from './types';

export type {
  GoalPluginEvidencePort,
  PersonalizationArenaOfficialTarget,
  PersonalizationGoalContext,
  PersonalizationGoalHint,
  PersonalizationGoalPlugin,
  PersonalizationGoalResolution,
  PersonalizationPluginPathPlanningPolicy,
  PersonalizationPluginRationaleCitation,
  PersonalizationPluginStatus,
  PersonalizationPluginWritePort,
  PluginPersistenceRequest,
  PluginPersistenceResult,
} from './types';
export type {
  CourseAdapterMapInput,
  CourseAdapterMapResult,
  CourseAdapterRejectReason,
  CourseLearningRecordAdapter,
  NormalizedCourseEvidenceMapping,
  PersonalizationAdapterProjection,
} from './learning-record-adapter-types';

export {
  PersonalizationPluginRegistry,
  createPersonalizationPluginRegistry,
} from './registry';

export {
  ADAPTIVE_GOAL_SLICE_REGISTRY,
  getRegisteredPersonalizationGoalPlugin,
  listRegisteredPersonalizationGoalIds,
  listRegisteredPersonalizationGoalPlugins,
  personalizationPluginRegistry,
  resolveAdaptiveGoalSliceDefinition,
  resolvePersonalizationGoalContext,
  resolvePersonalizationGoalId,
} from './default-registry';

export {
  CONTROL_CORRECTION_ARENA_OFFICIAL_TARGET,
  CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_LESSON_ID_VALUES,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
} from './control-correction/mappings';
export { CONTROL_CORRECTION_CAPABILITY_TARGETS } from './control-correction/capability-targets';

export { createControlCorrectionPersonalizationPlugin } from './control-correction/plugin';
export {
  CONTROL_CORRECTION_ADAPTER_RELEASE_REVISION,
  CONTROL_CORRECTION_ADAPTER_SCHEMA_VERSION,
  CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_ID,
  CONTROL_CORRECTION_LEARNING_RECORD_ADAPTER_VERSION,
  createControlCorrectionLearningRecordAdapter,
  mapControlCorrectionLearningRecord,
  projectControlCorrectionPersonalization,
} from './control-correction/learning-record-adapter';
export { createIdempotentPluginWritePort } from './adapters/write-port';
export {
  isControlCorrectionFact,
  isControlCorrectionArenaFact,
} from './control-correction/evidence-match';

export function citePersonalizationPlugin(
  goalId: string,
  sourceCategory: PersonalizationPluginRationaleCitation['sourceCategory'] = 'learning-record',
): PersonalizationPluginRationaleCitation | null {
  const plugin = personalizationPluginRegistry.get(goalId);
  if (!plugin || plugin.status !== 'active') return null;
  return {
    pluginId: plugin.pluginId,
    pluginVersion: plugin.version,
    goalId: plugin.goalId,
    sourceCategory,
    privacySafe: true,
  };
}
