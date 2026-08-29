import { readString } from '@/features/personalization/plugins/json';
import {
  getRegisteredPersonalizationGoalPlugin,
  personalizationPluginRegistry,
  resolvePersonalizationGoalContext,
} from '@/features/personalization/plugins/public-api';
import type {
  CourseAdapterMapInput,
  CourseAdapterMapResult,
  CourseAdapterRejectReason,
} from '@/features/personalization/plugins/learning-record-adapter-types';

function rejected(reason: CourseAdapterRejectReason): CourseAdapterMapResult {
  return {
    status: 'rejected',
    reason,
    diagnostic: { code: reason, fingerprint: reason, stage: 'adapter' },
  };
}

function reasonFromResolution(
  reason: 'unknown-mapping' | 'conflicting-mapping' | 'plugin-unavailable' | 'plugin-retired' | 'version-unavailable',
): CourseAdapterRejectReason {
  if (reason === 'version-unavailable') return 'version-mismatch';
  if (reason === 'plugin-retired' || reason === 'plugin-unavailable') return 'plugin-unavailable';
  if (reason === 'conflicting-mapping') return 'ambiguous-identity';
  return 'unknown-mapping';
}

export function mapCourseLearningRecordEvidence(
  input: CourseAdapterMapInput,
): CourseAdapterMapResult {
  const goalId = readString(input.goalId);
  const pluginId = readString(input.pluginId);
  if (!goalId && !pluginId) {
    return { status: 'not-applicable' };
  }

  if (goalId) {
    const resolution = resolvePersonalizationGoalContext({
      goalId,
      pluginVersion: input.pluginVersion,
    });
    if (resolution.status !== 'resolved') {
      return rejected(reasonFromResolution(resolution.reason));
    }
  }

  const plugin = goalId
    ? getRegisteredPersonalizationGoalPlugin(goalId)
    : personalizationPluginRegistry.getByPluginId(pluginId ?? '');
  if (!plugin) return rejected('unknown-mapping');
  if (plugin.status !== 'active') return rejected('plugin-unavailable');

  const adapter = plugin.createLearningRecordAdapter?.();
  if (!adapter) return rejected('adapter-unavailable');

  return adapter.map({
    ...input,
    goalId: plugin.goalId,
    pluginId: plugin.pluginId,
  });
}
