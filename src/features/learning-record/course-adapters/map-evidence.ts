import type { LearningEvent } from '@/lib/data-governance/event-protocol';
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
  CourseLearningRecordAdapter,
  NormalizedCourseEvidenceMapping,
} from '@/features/personalization/plugins/learning-record-adapter-types';
import type { PersonalizationGoalPlugin } from '@/features/personalization/plugins/types';
import { toPersistedAdapterEnvelope } from './persisted-envelope';

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

function bindTrustedAdapterIdentity(
  input: CourseAdapterMapInput,
  plugin: PersonalizationGoalPlugin,
  adapter: CourseLearningRecordAdapter,
): CourseAdapterMapInput {
  return {
    ...input,
    goalId: plugin.goalId,
    pluginId: plugin.pluginId,
    pluginVersion: readString(input.pluginVersion) ?? plugin.version,
    adapterVersion: readString(input.adapterVersion) ?? adapter.adapterVersion,
    schemaVersion: readString(input.schemaVersion) ?? adapter.schemaVersion,
    releaseRevision: readString(input.releaseRevision) ?? adapter.releaseRevision,
  };
}

export function applyNormalizedCourseMappingToEvent(
  event: LearningEvent,
  mapping: NormalizedCourseEvidenceMapping,
):
  | { status: 'applied'; event: LearningEvent }
  | { status: 'rejected'; reason: 'ambiguous-identity' } {
  const mappedLesson = mapping.canonicalLessonId ?? mapping.canonicalActivityId;
  if (readString(event.courseId) && event.courseId !== mapping.goalId) {
    return { status: 'rejected', reason: 'ambiguous-identity' };
  }
  if (readString(event.lessonId) && mappedLesson && event.lessonId !== mappedLesson) {
    return { status: 'rejected', reason: 'ambiguous-identity' };
  }
  const payload = event.payload && typeof event.payload === 'object'
    ? { ...event.payload }
    : {};
  return {
    status: 'applied',
    event: {
      ...event,
      courseId: mapping.goalId,
      lessonId: mappedLesson,
      payload: {
        ...payload,
        goalId: mapping.goalId,
        pluginId: mapping.pluginId,
        courseId: mapping.goalId,
        lessonId: mappedLesson,
        canonicalLessonId: mapping.canonicalLessonId,
        canonicalActivityId: mapping.canonicalActivityId,
        adapter: toPersistedAdapterEnvelope(mapping),
      },
    },
  };
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
  if (pluginId && plugin.pluginId !== pluginId) return rejected('ambiguous-identity');
  if (plugin.status !== 'active') return rejected('plugin-unavailable');

  const adapter = plugin.createLearningRecordAdapter?.();
  if (!adapter) return rejected('adapter-unavailable');

  return adapter.map(bindTrustedAdapterIdentity(input, plugin, adapter));
}
