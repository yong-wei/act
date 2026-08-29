import {
  emptyAnchors,
  markStale,
  opaqueProjectionSubject,
  projectSafeFeatureRead,
  projectTeacherClassRead,
  studentFieldsFromEnvelope,
  buildProjectionEnvelope,
  PROJECTION_STATUS,
  type ProjectionEnvelope,
  type ProjectionViewer,
  type StudentProjectionRead,
} from '@/features/learning-record/projections/public-api';
import {
  readCurrentCumulativeClassPortrait,
  readCurrentCumulativePortrait,
  type CumulativePortraitReadModel,
} from '@/lib/data-governance/cumulative-portrait-read-model';
import { PORTRAIT_V2_CALCULATION_VERSION, type PortraitV2Consumer } from '@/lib/data-governance/portrait-v2-model';

import { inspectConsumerBoundary } from './boundary';
import { guardProjectionRead } from './errors';
import { isNewerGovernedFact, mapPortraitStatus } from './status';
import type {
  SafeConsumerRead,
  StudentEvidencePortResult,
  TeacherClassEvidencePortResult,
  TeacherStudentEvidencePortResult,
} from './types';

async function readLatestGovernedFactAt(db: unknown, userId: string): Promise<string | null> {
  const learningFact = (db as {
    learningFact?: {
      findFirst?: (args: unknown) => Promise<{ startedAt?: Date | string | null } | null>;
    };
  }).learningFact;
  if (typeof learningFact?.findFirst !== 'function') return null;
  const latest = await learningFact.findFirst({
    where: { userId },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    select: { startedAt: true },
  });
  const startedAt = latest?.startedAt;
  if (!startedAt) return null;
  return startedAt instanceof Date ? startedAt.toISOString() : String(startedAt);
}

function coverageOf(portrait: CumulativePortraitReadModel): number {
  const evidenced = portrait.dimensionCoverage.evidencedDimensionIds.length;
  const missing = portrait.dimensionCoverage.missingDimensionIds.length;
  const total = evidenced + missing;
  return total === 0 ? 0 : evidenced / total;
}

function envelopeFromPortrait(
  userId: string,
  portrait: CumulativePortraitReadModel,
  qualification: StudentProjectionRead['status'],
): ProjectionEnvelope | null {
  const revision = portrait.generatedAt;
  if (!revision) return null;
  const freshness = portrait.evidenceAsOf ?? revision;
  return buildProjectionEnvelope({
    subjectUserId: userId,
    processingWatermark: '0',
    stateWatermark: portrait.evidenceAsOf ?? '0',
    calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
    captureRevision: revision,
    generation: '0',
    queueGeneration: '0',
    cutoverFence: '0',
    coverage: coverageOf(portrait),
    freshness,
    confidence: portrait.confidence ?? 0,
    qualification,
    anchors: emptyAnchors(revision),
    times: {
      trustedOccurredAt: portrait.evidenceAsOf ?? revision,
      receivedAt: revision,
      materializedAt: revision,
    },
    trustedFactIds: [],
  });
}

function fieldsWithoutEnvelope(
  status: StudentProjectionRead['status'],
  reason: string | null,
): StudentProjectionRead {
  return {
    status,
    envelope: null,
    fields: {
      coverage: 0,
      freshness: null,
      confidence: null,
      overallScore: null,
      provenanceRevision: null,
    },
    reason,
  };
}

export async function readAuthorizedCumulativePortrait(input: {
  db: unknown;
  viewer: ProjectionViewer;
  targetUserId: string;
  classId?: string;
  consumer?: PortraitV2Consumer;
}): Promise<StudentEvidencePortResult> {
  guardProjectionRead(input.viewer, input.targetUserId, { classId: input.classId });
  const portrait = await readCurrentCumulativePortrait(
    input.db,
    input.targetUserId,
    input.consumer ?? 'student',
  );
  const mapped = mapPortraitStatus(portrait);
  const envelope = envelopeFromPortrait(input.targetUserId, portrait, mapped.status);
  let read: StudentProjectionRead = envelope
    ? studentFieldsFromEnvelope(envelope, mapped.status, mapped.reason)
    : fieldsWithoutEnvelope(
      mapped.status === PROJECTION_STATUS.qualified
        ? PROJECTION_STATUS.unavailable
        : mapped.status,
      mapped.reason,
    );
  read = {
    ...read,
    fields: {
      ...read.fields,
      overallScore: mapped.knownZero ? null : portrait.overallScore,
    },
  };
  const latestFactAt = await readLatestGovernedFactAt(input.db, input.targetUserId);
  if (
    mapped.status === PROJECTION_STATUS.qualified
    && isNewerGovernedFact(portrait.evidenceAsOf, latestFactAt)
  ) {
    read = markStale(read, 'newer-learning-fact');
  }
  const exportFields = {
    status: read.status,
    reason: read.reason,
    knownZero: mapped.knownZero,
    subjectRef: opaqueProjectionSubject(input.targetUserId),
    coverage: read.fields.coverage,
    freshness: read.fields.freshness,
    confidence: read.fields.confidence,
    overallScore: read.fields.overallScore,
    provenanceRevision: read.fields.provenanceRevision,
  };
  const violations = inspectConsumerBoundary(exportFields);
  if (violations.length > 0) {
    throw new Error('consumer-forbidden-field');
  }
  return {
    status: read.status,
    reason: read.reason,
    knownZero: mapped.knownZero,
    subjectRef: exportFields.subjectRef,
    read,
    portrait,
  };
}

export async function readStudentEvidencePort(input: {
  db: unknown;
  viewer: ProjectionViewer;
  targetUserId: string;
  classId?: string;
  consumer?: PortraitV2Consumer;
}): Promise<StudentEvidencePortResult> {
  return readAuthorizedCumulativePortrait({
    ...input,
    consumer: input.consumer ?? 'student',
  });
}

export async function readTeacherClassEvidencePort(input: {
  db: unknown;
  viewer: ProjectionViewer;
  classId: string;
  memberUserIds: string[];
  consumer?: PortraitV2Consumer;
}): Promise<TeacherClassEvidencePortResult> {
  guardProjectionRead(input.viewer, input.viewer.subjectUserId ?? '', { classId: input.classId });
  const consumer = input.consumer ?? 'reviewer';
  const classPortrait = await readCurrentCumulativeClassPortrait(input.db, input.classId);
  const learnerEntries = await Promise.all(input.memberUserIds.map(async (userId) => {
    const portrait = await readCurrentCumulativePortrait(input.db, userId, consumer);
    const mapped = mapPortraitStatus(portrait);
    const envelope = envelopeFromPortrait(userId, portrait, mapped.status);
    const read = envelope
      ? studentFieldsFromEnvelope(envelope, mapped.status, mapped.reason)
      : fieldsWithoutEnvelope(
        mapped.status === PROJECTION_STATUS.qualified
          ? PROJECTION_STATUS.unavailable
          : mapped.status,
        mapped.reason,
      );
    return [userId, portrait, read] as const;
  }));
  const learnerPortraits = new Map(learnerEntries.map(([userId, portrait]) => [userId, portrait]));
  const studentReads = new Map(learnerEntries.map(([userId, , read]) => [userId, read]));
  const independentLearnerIds = Array.from(
    { length: classPortrait.activeStudentCount },
    (_, index) => `independent-learner:${index}`,
  );
  const classRead = projectTeacherClassRead({
    independentLearnerIds,
    averageScore: classPortrait.aggregate?.overall.mean ?? null,
    trend: null,
    coverage: classPortrait.totalStudentCount === 0
      ? 0
      : classPortrait.activeStudentCount / classPortrait.totalStudentCount,
    status: classPortrait.availabilityReason === 'current-state-version-mismatch'
      ? PROJECTION_STATUS.conflict
      : classPortrait.stateKind === 'SNAPSHOT'
        ? PROJECTION_STATUS.qualified
        : classPortrait.availabilityReason === 'reconciliation-pending'
          || classPortrait.availabilityReason === 'migration-in-progress'
          ? PROJECTION_STATUS.stale
          : PROJECTION_STATUS.unavailable,
  });
  const exportFields = {
    status: classRead.status,
    independentLearnerCount: classRead.independentLearnerCount,
    suppressed: classRead.suppressed,
    coverage: classRead.coverage,
    reason: classRead.reason,
    aggregates: classRead.aggregates,
  };
  const violations = inspectConsumerBoundary(exportFields);
  if (violations.length > 0) {
    throw new Error('consumer-forbidden-field');
  }
  return {
    classPortrait,
    learnerPortraits,
    classRead,
    studentReads,
  };
}

export async function readTeacherStudentEvidencePort(input: {
  db: unknown;
  viewer: ProjectionViewer;
  classId: string;
  studentId: string;
}): Promise<TeacherStudentEvidencePortResult> {
  const [student, classPort] = await Promise.all([
    readStudentEvidencePort({
      db: input.db,
      viewer: input.viewer,
      targetUserId: input.studentId,
      classId: input.classId,
      consumer: 'reviewer',
    }),
    readTeacherClassEvidencePort({
      db: input.db,
      viewer: input.viewer,
      classId: input.classId,
      memberUserIds: [input.studentId],
    }),
  ]);
  return {
    student,
    classPortrait: classPort.classPortrait,
    classRead: classPort.classRead,
  };
}

export async function readSafeFeaturePort(input: {
  db: unknown;
  viewer: ProjectionViewer;
  targetUserId: string;
  classId?: string;
  consumer?: PortraitV2Consumer;
  masteryTarget?: string | null;
}): Promise<SafeConsumerRead> {
  const student = await readAuthorizedCumulativePortrait({
    db: input.db,
    viewer: input.viewer,
    targetUserId: input.targetUserId,
    classId: input.classId,
    consumer: input.consumer ?? 'konling',
  });
  const feature = projectSafeFeatureRead({
    envelope: student.read.envelope,
    status: student.read.status,
    masteryTarget: input.masteryTarget ?? null,
  });
  const violations = inspectConsumerBoundary({
    status: feature.status,
    subjectRef: feature.subjectRef,
    coverage: feature.coverage,
    confidence: feature.confidence,
    freshness: feature.freshness,
    provenanceRevision: feature.provenanceRevision,
    masteryTarget: feature.masteryTarget,
  });
  if (violations.length > 0) {
    throw new Error('consumer-forbidden-field');
  }
  return {
    feature,
    portrait: student.portrait,
    knownZero: student.knownZero,
  };
}
