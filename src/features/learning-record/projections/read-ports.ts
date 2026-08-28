import { opaqueSubjectRef } from '@/features/learning-record/event-contract/allowlist';
import {
  PROJECTION_INDEPENDENT_LEARNER_MINIMUM,
  PROJECTION_STATUS,
  type ProjectionEnvelope,
  type ProjectionViewer,
  type SafeFeatureRead,
  type StudentProjectionRead,
  type TeacherClassProjectionRead,
} from './types';

export function authorizeProjectionRead(
  viewer: ProjectionViewer,
  targetUserId: string,
): void {
  if (viewer.role === 'student' && viewer.subjectUserId !== targetUserId) {
    throw new Error('projection-unauthorized');
  }
}

export function studentFieldsFromEnvelope(
  envelope: ProjectionEnvelope | null,
  status: StudentProjectionRead['status'],
  reason: string | null = null,
): StudentProjectionRead {
  if (!envelope || status === PROJECTION_STATUS.unavailable) {
    return {
      status: PROJECTION_STATUS.unavailable,
      envelope: null,
      fields: {
        coverage: 0,
        freshness: null,
        confidence: null,
        overallScore: null,
        provenanceRevision: null,
      },
      reason: reason ?? 'unavailable',
    };
  }
  return {
    status,
    envelope,
    fields: {
      coverage: envelope.coverage,
      freshness: envelope.freshness,
      confidence: envelope.confidence,
      overallScore: null,
      provenanceRevision: envelope.captureRevision,
    },
    reason,
  };
}

export function markStale(read: StudentProjectionRead, reason: string): StudentProjectionRead {
  if (!read.envelope) {
    return { ...read, status: PROJECTION_STATUS.unavailable, reason };
  }
  return {
    ...read,
    status: PROJECTION_STATUS.stale,
    reason,
  };
}

export function projectTeacherClassRead(input: {
  independentLearnerIds: string[];
  averageScore: number | null;
  trend: string | null;
  coverage: number;
  status?: TeacherClassProjectionRead['status'];
}): TeacherClassProjectionRead {
  const independentLearnerCount = new Set(input.independentLearnerIds).size;
  const suppressed = independentLearnerCount < PROJECTION_INDEPENDENT_LEARNER_MINIMUM;
  return {
    status: input.status ?? PROJECTION_STATUS.qualified,
    independentLearnerCount,
    suppressed,
    coverage: input.coverage,
    aggregates: suppressed
      ? null
      : {
          averageScore: input.averageScore,
          trend: input.trend,
        },
    reason: suppressed ? 'independent-learner-small-sample' : null,
  };
}

export function projectSafeFeatureRead(input: {
  envelope: ProjectionEnvelope | null;
  status?: SafeFeatureRead['status'];
  masteryTarget?: string | null;
}): SafeFeatureRead {
  if (!input.envelope) {
    return {
      status: PROJECTION_STATUS.unavailable,
      subjectRef: '',
      coverage: 0,
      confidence: null,
      freshness: null,
      provenanceRevision: null,
      masteryTarget: null,
    };
  }
  return {
    status: input.status ?? input.envelope.qualification,
    subjectRef: input.envelope.subjectRef,
    coverage: input.envelope.coverage,
    confidence: input.envelope.confidence,
    freshness: input.envelope.freshness,
    provenanceRevision: input.envelope.captureRevision,
    masteryTarget: input.masteryTarget ?? null,
  };
}

export function opaqueProjectionSubject(userId: string): string {
  return opaqueSubjectRef(userId);
}
