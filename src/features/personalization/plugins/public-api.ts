import { personalizationPluginRegistry } from './default-registry';
import type { PersonalizationPluginRationaleCitation } from './types';

export type {
  GoalPluginEvidencePort,
  PersonalizationGoalContext,
  PersonalizationGoalHint,
  PersonalizationGoalPlugin,
  PersonalizationGoalResolution,
  PersonalizationPluginRationaleCitation,
  PersonalizationPluginStatus,
  PersonalizationPluginWritePort,
  PluginPersistenceRequest,
  PluginPersistenceResult,
} from './types';

export {
  PersonalizationPluginRegistry,
  createPersonalizationPluginRegistry,
} from './registry';

export {
  getRegisteredPersonalizationGoalPlugin,
  listRegisteredPersonalizationGoalIds,
  listRegisteredPersonalizationGoalPlugins,
  personalizationPluginRegistry,
  resolvePersonalizationGoalContext,
  resolvePersonalizationGoalId,
} from './default-registry';

export {
  CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
  CONTROL_CORRECTION_COURSE_ID_VALUES,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_LESSON_ID_VALUES,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_ID,
  CONTROL_CORRECTION_PERSONALIZATION_PLUGIN_VERSION,
} from './control-correction/mappings';

export { createControlCorrectionPersonalizationPlugin } from './control-correction/plugin';
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
