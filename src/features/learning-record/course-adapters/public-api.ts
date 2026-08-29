export {
  applyNormalizedCourseMappingToEvent,
  mapCourseLearningRecordEvidence,
} from './map-evidence';
export { toPersistedAdapterEnvelope } from './persisted-envelope';
export type {
  CourseAdapterMapInput,
  CourseAdapterMapResult,
  CourseAdapterRejectReason,
  NormalizedCourseEvidenceMapping,
  PersonalizationAdapterProjection,
} from '@/features/personalization/plugins/learning-record-adapter-types';
