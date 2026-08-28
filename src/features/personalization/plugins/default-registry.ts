import { ADAPTIVE_GOAL_SLICE_REGISTRY } from '@/features/personalization/learner-state/internal';
import { createControlCorrectionPersonalizationPlugin } from './control-correction/plugin';
import { createPersonalizationPluginRegistry } from './registry';
import type { PersonalizationGoalHint, PersonalizationGoalResolution } from './types';
import { CONTROL_CORRECTION_GOAL_ID } from './control-correction/mappings';

export const personalizationPluginRegistry = createPersonalizationPluginRegistry();
personalizationPluginRegistry.register(
  createControlCorrectionPersonalizationPlugin(
    ADAPTIVE_GOAL_SLICE_REGISTRY[CONTROL_CORRECTION_GOAL_ID],
  ),
);

export function getRegisteredPersonalizationGoalPlugin(goalId: string | null | undefined) {
  if (!goalId) return null;
  return personalizationPluginRegistry.get(goalId);
}

export function listRegisteredPersonalizationGoalPlugins() {
  return personalizationPluginRegistry.list();
}

export function listRegisteredPersonalizationGoalIds() {
  return personalizationPluginRegistry.listGoalIds();
}

export function resolvePersonalizationGoalContext(
  hint: PersonalizationGoalHint,
): PersonalizationGoalResolution {
  return personalizationPluginRegistry.resolve(hint);
}

export function resolvePersonalizationGoalId(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = resolvePersonalizationGoalContext({
      courseId: candidate,
      lessonId: candidate,
      taskId: candidate,
    });
    if (resolved.status === 'resolved') {
      return resolved.context.goalId;
    }
  }
  return null;
}
