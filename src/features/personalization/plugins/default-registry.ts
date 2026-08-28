import type {
  AdaptiveGoalSliceDefinition,
  AdaptiveLearnerStateGoalId,
} from '@/features/personalization/learner-state/internal';
import { createControlCorrectionPersonalizationPlugin } from './control-correction/plugin';
import { createPersonalizationPluginRegistry } from './registry';
import { readString } from './json';
import type { PersonalizationGoalHint, PersonalizationGoalResolution } from './types';

export const personalizationPluginRegistry = createPersonalizationPluginRegistry();
personalizationPluginRegistry.register(createControlCorrectionPersonalizationPlugin());

export const ADAPTIVE_GOAL_SLICE_REGISTRY = Object.fromEntries(
  personalizationPluginRegistry.list().map((plugin) => [plugin.goalId, plugin.sliceDefinition]),
) as Record<AdaptiveLearnerStateGoalId, AdaptiveGoalSliceDefinition>;

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

export function resolveAdaptiveGoalSliceDefinition(goal: string | null | undefined) {
  const normalized = readString(goal);
  if (!normalized) return null;
  return getRegisteredPersonalizationGoalPlugin(normalized)?.sliceDefinition ?? null;
}

export function resolvePersonalizationGoalId(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const hint of [
      { courseId: candidate },
      { lessonId: candidate },
      { taskId: candidate },
    ]) {
      const resolved = resolvePersonalizationGoalContext(hint);
      if (resolved.status === 'resolved') {
        return resolved.context.goalId;
      }
    }
  }
  return null;
}
