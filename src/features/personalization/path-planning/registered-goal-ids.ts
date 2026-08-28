import { CONTROL_CORRECTION_GOAL_ID } from '@/features/personalization/plugins/control-correction/mappings';

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
  return (REGISTERED_ADAPTIVE_LEARNING_PATH_GOAL_IDS as readonly string[]).includes(goalId);
}
