import { CONTROL_CORRECTION_GOAL_ID } from '@/features/personalization/plugins/control-correction/mappings';
import { personalizationPluginRegistry } from '@/features/personalization/plugins/default-registry';

export const REGISTERED_ADAPTIVE_LEARNING_PATH_GOAL_IDS = [
  CONTROL_CORRECTION_GOAL_ID,
  'frequency-response-foundations',
  'feedback-loop-concept-foundations',
  'transfer-function-modeling-foundations',
  'time-domain-response-analysis',
  'root-locus-analysis-foundations',
  'stability-margin-frequency-analysis',
  'simulation-validation-practice',
  'ship-ocean-transfer-application',
] as const;

export function isRegisteredAdaptiveLearningPathGoal(goalId: string): boolean {
  if (!(REGISTERED_ADAPTIVE_LEARNING_PATH_GOAL_IDS as readonly string[]).includes(goalId)) {
    return false;
  }
  if (goalId !== CONTROL_CORRECTION_GOAL_ID) return true;
  const plugin = personalizationPluginRegistry.get(goalId);
  return Boolean(plugin && plugin.status === 'active');
}
