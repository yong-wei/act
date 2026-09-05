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
  type CumulativeClassPortraitReadModel,
  type CumulativePortraitReadModel,
} from '@/lib/data-governance/cumulative-portrait-read-model';
import type { PortraitV2Consumer } from '@/lib/data-governance/portrait-v2-model';

import { inspectConsumerBoundary } from './boundary';
import { guardProjectionRead } from './errors';
import { isNewerGovernedFact, mapPortraitStatus } from './status';
import type {
  SafeConsumerRead,
  StudentEvidencePortResult,
  TeacherClassEvidencePortResult,
  TeacherStudentEvidencePortResult,
} from './types';

// 每个事实的最终治理状态由其最大 sequence 的 transition 决定：
// - REVOKE → 事实失效，不参与「较新有效事实」判定；
// - CORRECT → 事实时间以修正载荷 transitionPayload.fact.startedAt 为准
//   （与 reduceLearnerFactTransitions 的有效事实语义一致）；
// - UPSERT → 沿用事实自身 startedAt。
// 查询范围是全部未被最终 REVOKE 的事实：ingestion 先写 LearningFact、transition
// 由画像 worker 异步补建，因此尚无 transition 的新事实仍视为有效。
async function readLatestValidGovernedFactAt(
  db: unknown,
  userId: string,
): Promise<{ available: boolean; at: string | null }> {
  const transitions = (db as {
    learnerFactTransition?: {
      findMany?: (args: unknown) => Promise<Array<{
        factId?: string | null;
        operation?: string | null;
        transitionPayload?: unknown;
      }>>;
    };
  }).learnerFactTransition;
  if (typeof transitions?.findMany !== 'function') return { available: false, at: null };
  const rows = await transitions.findMany({
    where: { userId },
    orderBy: [{ factId: 'asc' }, { sequence: 'desc' }],
    distinct: ['factId'],
    select: { factId: true, operation: true, transitionPayload: true },
  });
  const correctedStartedAtByFactId = new Map<string, string>();
  const revokedFactIds: string[] = [];
  for (const row of rows) {
    if (typeof row.factId !== 'string' || row.factId.length === 0) continue;
    if (row.operation !== 'REVOKE') continue;
    revokedFactIds.push(row.factId);
  }
  for (const row of rows) {
    if (row.operation !== 'CORRECT') continue;
    if (typeof row.factId !== 'string' || row.factId.length === 0) continue;
    const payload = row.transitionPayload;
    const fact = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).fact
      : null;
    const correctedStartedAt = fact && typeof fact === 'object' && !Array.isArray(fact)
      ? (fact as Record<string, unknown>).startedAt
      : null;
    if (typeof correctedStartedAt === 'string' && correctedStartedAt.length > 0) {
      correctedStartedAtByFactId.set(row.factId, correctedStartedAt);
    }
  }
  const learningFact = (db as {
    learningFact?: {
      findMany?: (args: unknown) => Promise<Array<{ id?: string | null; startedAt?: Date | string | null }>>;
    };
  }).learningFact;
  if (typeof learningFact?.findMany !== 'function') return { available: false, at: null };
  const factRows = await learningFact.findMany({
    where: {
      userId,
      ...(revokedFactIds.length > 0 ? { id: { notIn: revokedFactIds } } : {}),
    },
    select: { id: true, startedAt: true },
  });
  const toIso = (value: Date | string | null | undefined): string | null => {
    if (value instanceof Date) return value.toISOString();
    return typeof value === 'string' ? value : null;
  };
  let latest: string | null = null;
  for (const row of factRows) {
    if (typeof row.id !== 'string') continue;
    const effectiveAt = correctedStartedAtByFactId.get(row.id) ?? toIso(row.startedAt);
    if (effectiveAt && (latest === null || effectiveAt > latest)) latest = effectiveAt;
  }
  return { available: true, at: latest };
}

async function readLatestGovernedFactAt(db: unknown, userId: string): Promise<string | null> {
  const viaTransitions = await readLatestValidGovernedFactAt(db, userId);
  if (viaTransitions.available) return viaTransitions.at;
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

function isProcessingAheadOfState(publication: CumulativePortraitReadModel['publication']): boolean {
  if (!publication) return false;
  try {
    return BigInt(publication.processingWatermark) > BigInt(publication.stateWatermark);
  } catch {
    return false;
  }
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
  const publication = portrait.publication;
  if (!publication) return null;
  const revision = publication.captureRevision;
  const receivedAt = portrait.generatedAt ?? revision;
  const freshness = portrait.evidenceAsOf ?? receivedAt;
  return buildProjectionEnvelope({
    subjectUserId: userId,
    processingWatermark: publication.processingWatermark,
    stateWatermark: publication.stateWatermark,
    calculationVersion: publication.calculationVersion,
    captureRevision: revision,
    generation: publication.generation,
    queueGeneration: publication.queueGeneration,
    cutoverFence: publication.cutoverFence,
    coverage: coverageOf(portrait),
    freshness,
    confidence: portrait.confidence ?? 0,
    qualification,
    anchors: emptyAnchors(revision),
    times: {
      trustedOccurredAt: portrait.evidenceAsOf ?? freshness,
      receivedAt,
      materializedAt: receivedAt,
    },
    trustedFactIds: [],
  });
}

function suppressClassPortraitForConsumer(
  classPortrait: CumulativeClassPortraitReadModel,
  suppressed: boolean,
): CumulativeClassPortraitReadModel {
  if (!suppressed || classPortrait.stateKind !== 'SNAPSHOT') return classPortrait;
  return {
    ...classPortrait,
    aggregate: null,
    trendDistribution: null,
    riskDistribution: null,
    diagnosis: {
      strengths: [],
      improvementClusters: [],
      limitations: [
        ...(classPortrait.diagnosis?.limitations ?? []),
        'independent-learner-small-sample',
      ],
    },
  };
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

function assertConsumerExport(value: unknown): void {
  if (inspectConsumerBoundary(value).length > 0) {
    throw new Error('consumer-forbidden-field');
  }
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
    && (
      isNewerGovernedFact(portrait.evidenceAsOf, latestFactAt)
      || isProcessingAheadOfState(portrait.publication)
    )
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
  assertConsumerExport(exportFields);
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
    const student = await readAuthorizedCumulativePortrait({
      db: input.db,
      viewer: input.viewer,
      targetUserId: userId,
      classId: input.classId,
      consumer,
    });
    return [userId, student.portrait, student.read] as const;
  }));
  const learnerPortraits = new Map(learnerEntries.map(([userId, portrait]) => [userId, portrait]));
  const studentReads = new Map(learnerEntries.map(([userId, , read]) => [userId, read]));
  const independentLearnerIds = Array.from(
    { length: classPortrait.activeStudentCount },
    (_, index) => `independent-learner:${index}`,
  );
  const memberStale = Array.from(studentReads.values()).some(
    (read) => read.status === PROJECTION_STATUS.stale,
  );
  const classStatus = classPortrait.availabilityReason === 'current-state-version-mismatch'
    ? PROJECTION_STATUS.conflict
    : classPortrait.stateKind === 'SNAPSHOT'
      ? (memberStale ? PROJECTION_STATUS.stale : PROJECTION_STATUS.qualified)
      : classPortrait.availabilityReason === 'reconciliation-pending'
        || classPortrait.availabilityReason === 'migration-in-progress'
        ? PROJECTION_STATUS.stale
        : PROJECTION_STATUS.unavailable;
  const projected = projectTeacherClassRead({
    independentLearnerIds,
    averageScore: classPortrait.aggregate?.overall.mean ?? null,
    trend: null,
    coverage: classPortrait.totalStudentCount === 0
      ? 0
      : classPortrait.activeStudentCount / classPortrait.totalStudentCount,
    status: classStatus,
  });
  const classRead = memberStale
    ? {
      ...projected,
      status: PROJECTION_STATUS.stale,
      reason: projected.reason ?? 'newer-learning-fact',
    }
    : projected;
  const exportFields = {
    status: classRead.status,
    independentLearnerCount: classRead.independentLearnerCount,
    suppressed: classRead.suppressed,
    coverage: classRead.coverage,
    reason: classRead.reason,
    aggregates: classRead.aggregates,
  };
  assertConsumerExport(exportFields);
  return {
    classPortrait: suppressClassPortraitForConsumer(classPortrait, classRead.suppressed),
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
  const classPort = await readTeacherClassEvidencePort({
    db: input.db,
    viewer: input.viewer,
    classId: input.classId,
    memberUserIds: [input.studentId],
    consumer: 'reviewer',
  });
  const portrait = classPort.learnerPortraits.get(input.studentId);
  const read = classPort.studentReads.get(input.studentId);
  if (!portrait || !read) {
    throw new Error('consumer-projection-missing');
  }
  return {
    student: {
      status: read.status,
      reason: read.reason,
      knownZero: mapPortraitStatus(portrait).knownZero,
      subjectRef: opaqueProjectionSubject(input.studentId),
      read,
      portrait,
    },
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
  assertConsumerExport({
    status: feature.status,
    subjectRef: feature.subjectRef,
    coverage: feature.coverage,
    confidence: feature.confidence,
    freshness: feature.freshness,
    provenanceRevision: feature.provenanceRevision,
    masteryTarget: feature.masteryTarget,
  });
  return {
    feature,
    portrait: student.portrait,
    knownZero: student.knownZero,
  };
}
