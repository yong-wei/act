import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONSUMER_RETENTION,
  ConsumerUnauthorizedError,
  acceptConsumerDelivery,
  assertTerminalBeforeDelete,
  authorizeRawArtifact,
  authorizeReplay,
  inspectConsumerBoundary,
  mapPortraitStatus,
  readSafeFeaturePort,
  readStudentEvidencePort,
  readTeacherClassEvidencePort,
  readTeacherStudentEvidencePort,
  redactedProjectionFailure,
  sanitizeLegacyConsumerPayload,
  successfulPayloadExpired,
  verifyDeletionUnreadability,
  viewerForPortraitConsumer,
  viewerFromSession,
} from '../public-api';
import { PROJECTION_INDEPENDENT_LEARNER_MINIMUM, PROJECTION_STATUS } from '@/features/learning-record/projections/public-api';
import { PORTRAIT_V2_CALCULATION_VERSION } from '@/lib/data-governance/portrait-v2-model';

const mocks = vi.hoisted(() => ({
  readCurrentCumulativePortrait: vi.fn(),
  readCurrentCumulativeClassPortrait: vi.fn(),
}));

vi.mock('@/lib/data-governance/cumulative-portrait-read-model', () => ({
  readCurrentCumulativePortrait: mocks.readCurrentCumulativePortrait,
  readCurrentCumulativeClassPortrait: mocks.readCurrentCumulativeClassPortrait,
}));

function snapshotPortrait(overrides: Record<string, unknown> = {}) {
  return {
    stateKind: 'SNAPSHOT',
    payload: { userId: 'student-1', dimensions: [] },
    overallScore: 72,
    dimensionCoverage: {
      evidencedDimensionIds: ['controlModelingRepresentation'],
      missingDimensionIds: ['simulationValidationEvidence'],
    },
    evidenceAsOf: '2026-08-01T00:00:00.000Z',
    confidence: 0.8,
    lastTrend: 'stable',
    lastRisk: [],
    availabilityReason: 'available',
    generatedAt: '2026-08-20T00:00:00.000Z',
    publication: {
      calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
      generation: '4',
      queueGeneration: '9',
      cutoverFence: '7',
      stateWatermark: '12',
      processingWatermark: '9',
      captureRevision: '2026-08-20T00:00:00.000Z',
      inputDigest: 'task-input-1',
    },
    ...overrides,
  };
}

function classSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    stateKind: 'SNAPSHOT',
    availabilityReason: 'available',
    materializationVersion: 'class-competency.cumulative.v2',
    aggregate: {
      overall: { mean: 82, meanConfidence: 0.8, includedCount: 5, missingCount: 0 },
      dimensions: {},
    },
    dimensionCoverage: null,
    trendDistribution: { up: 1, stable: 4, down: 0, 'not-comparable': 0 },
    riskDistribution: { membersWithRisk: 0, membersWithoutRisk: 5, byType: {}, bySeverity: {} },
    diagnosis: { strengths: [], improvementClusters: [], limitations: [] },
    evidenceAsOf: '2026-08-01T00:00:00.000Z',
    generatedAt: '2026-08-20T00:00:00.000Z',
    activeStudentCount: 5,
    totalStudentCount: 5,
    ...overrides,
  };
}

describe('learning-record consumers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readCurrentCumulativePortrait.mockResolvedValue(snapshotPortrait());
    mocks.readCurrentCumulativeClassPortrait.mockResolvedValue(classSnapshot());
  });

  it('rejects cross-user and cross-class reads before returning a projection', async () => {
    await expect(readStudentEvidencePort({
      db: {},
      viewer: { role: 'student', subjectUserId: 'student-a' },
      targetUserId: 'student-b',
    })).rejects.toBeInstanceOf(ConsumerUnauthorizedError);
    expect(mocks.readCurrentCumulativePortrait).not.toHaveBeenCalled();

    await expect(readTeacherClassEvidencePort({
      db: {},
      viewer: { role: 'teacher', subjectUserId: 'teacher-1', classIds: ['class-a'] },
      classId: 'class-b',
      memberUserIds: ['student-1'],
    })).rejects.toBeInstanceOf(ConsumerUnauthorizedError);
    expect(mocks.readCurrentCumulativeClassPortrait).not.toHaveBeenCalled();
  });

  it('projects role-minimum fields and opaque subject refs', async () => {
    const student = await readStudentEvidencePort({
      db: {},
      viewer: { role: 'student', subjectUserId: 'student-1' },
      targetUserId: 'student-1',
    });
    expect(student.status).toBe(PROJECTION_STATUS.qualified);
    expect(student.subjectRef).not.toBe('student-1');
    expect(student.read.fields.coverage).toBe(0.5);
    expect(student.read.fields.provenanceRevision).toBe('2026-08-20T00:00:00.000Z');
    expect(JSON.stringify(student.read.fields)).not.toMatch(/answer|prompt|stack|email/i);

    const safe = await readSafeFeaturePort({
      db: {},
      viewer: { role: 'ai', subjectUserId: 'student-1' },
      targetUserId: 'student-1',
    });
    expect(safe.feature.subjectRef).toBe(student.subjectRef);
    expect(safe.feature).not.toHaveProperty('averageScore');
    expect(JSON.stringify(safe.feature)).not.toMatch(/teacher|admin|answer/i);
  });

  it('keeps known-zero distinct from missing, conflict and unavailable', async () => {
    mocks.readCurrentCumulativePortrait.mockResolvedValueOnce(snapshotPortrait({
      stateKind: 'NO_EVIDENCE',
      payload: null,
      overallScore: null,
      availabilityReason: 'no-eligible-evidence',
    }));
    const knownZero = await readStudentEvidencePort({
      db: {},
      viewer: { role: 'student', subjectUserId: 'student-1' },
      targetUserId: 'student-1',
    });
    expect(knownZero.knownZero).toBe(true);
    expect(knownZero.status).toBe(PROJECTION_STATUS.partial);
    expect(knownZero.read.fields.overallScore).toBeNull();

    mocks.readCurrentCumulativePortrait.mockResolvedValueOnce(snapshotPortrait({
      stateKind: 'UNAVAILABLE',
      payload: null,
      overallScore: null,
      generatedAt: null,
      evidenceAsOf: null,
      availabilityReason: 'current-state-unavailable',
      publication: null,
    }));
    const missing = await readStudentEvidencePort({
      db: {},
      viewer: { role: 'student', subjectUserId: 'student-1' },
      targetUserId: 'student-1',
    });
    expect(missing.knownZero).toBe(false);
    expect(missing.status).toBe(PROJECTION_STATUS.unavailable);

    mocks.readCurrentCumulativePortrait.mockResolvedValueOnce(snapshotPortrait({
      stateKind: 'UNAVAILABLE',
      payload: null,
      generatedAt: null,
      availabilityReason: 'current-state-version-mismatch',
      publication: null,
    }));
    const conflict = await readStudentEvidencePort({
      db: {},
      viewer: { role: 'student', subjectUserId: 'student-1' },
      targetUserId: 'student-1',
    });
    expect(conflict.status).toBe(PROJECTION_STATUS.conflict);

    expect(mapPortraitStatus(snapshotPortrait({
      stateKind: 'UNAVAILABLE',
      availabilityReason: 'reconciliation-pending',
    })).status).toBe(PROJECTION_STATUS.stale);
  });

  it('marks a qualified portrait stale when a newer LearningFact exists', async () => {
    const db = {
      learningFact: {
        findFirst: vi.fn().mockResolvedValue({ startedAt: '2026-08-21T00:00:00.000Z' }),
        findMany: vi.fn(),
      },
      interactionLog: { findMany: vi.fn() },
    };
    const stale = await readStudentEvidencePort({
      db,
      viewer: { role: 'student', subjectUserId: 'student-1' },
      targetUserId: 'student-1',
    });
    expect(stale.status).toBe(PROJECTION_STATUS.stale);
    expect(stale.reason).toBe('newer-learning-fact');
    expect(db.interactionLog.findMany).not.toHaveBeenCalled();
    expect(db.learningFact.findMany).not.toHaveBeenCalled();
  });

  it('passes current pointer publication through the consumer envelope', async () => {
    mocks.readCurrentCumulativePortrait.mockResolvedValueOnce(snapshotPortrait({
      publication: {
        calculationVersion: PORTRAIT_V2_CALCULATION_VERSION,
        generation: '7',
        queueGeneration: '11',
        cutoverFence: '4',
        stateWatermark: '3',
        processingWatermark: '2',
        captureRevision: 'state-rev-1',
        inputDigest: 'digest-a',
      },
    }));
    const student = await readStudentEvidencePort({
      db: {},
      viewer: { role: 'student', subjectUserId: 'student-1' },
      targetUserId: 'student-1',
    });
    expect(student.read.envelope?.generation).toBe('7');
    expect(student.read.envelope?.queueGeneration).toBe('11');
    expect(student.read.envelope?.cutoverFence).toBe('4');
    expect(student.read.envelope?.processingWatermark).toBe('2');
    expect(student.read.envelope?.stateWatermark).toBe('3');
    expect(student.read.fields.provenanceRevision).toBe('state-rev-1');
  });

  it('does not advertise a stale SNAPSHOT as current personalization evidence', async () => {
    const { resolveFencedAdaptivePortrait } = await import(
      '@/features/personalization/learner-state/internal'
    );
    mocks.readCurrentCumulativePortrait.mockResolvedValue(snapshotPortrait());
    const resolved = await resolveFencedAdaptivePortrait({
      learningFact: {
        findFirst: vi.fn().mockResolvedValue({ startedAt: '2026-08-21T00:00:00.000Z' }),
      },
    } as never, {
      userId: 'student-1',
      consumer: 'planner',
      now: new Date('2026-08-22T00:00:00.000Z'),
      legacySnapshot: null,
    });
    expect(resolved.primaryPortrait).toBeNull();
    expect(resolved.primaryPortraitState).toBe('UNAVAILABLE');
    expect(resolved.primaryPortraitAvailability).toBe('newer-learning-fact');
    expect(resolved.limitations).toContain('projection-newer-learning-fact');
  });

  it('marks class member reads stale and degrades the class projection status', async () => {
    mocks.readCurrentCumulativeClassPortrait.mockResolvedValueOnce(classSnapshot());
    const stale = await readTeacherClassEvidencePort({
      db: {
        learningFact: {
          findFirst: vi.fn().mockResolvedValue({ startedAt: '2026-08-21T00:00:00.000Z' }),
        },
      },
      viewer: { role: 'admin', subjectUserId: 'admin-1' },
      classId: 'class-1',
      memberUserIds: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(stale.studentReads.get('a')?.status).toBe(PROJECTION_STATUS.stale);
    expect(stale.classRead.status).toBe(PROJECTION_STATUS.stale);
    expect(stale.classRead.reason).toBe('newer-learning-fact');
    expect(stale.classRead.suppressed).toBe(false);
  });

  it('suppresses teacher aggregates below the independent-learner threshold', async () => {
    mocks.readCurrentCumulativeClassPortrait.mockResolvedValueOnce(classSnapshot({
      activeStudentCount: 1,
      totalStudentCount: 1,
    }));
    const small = await readTeacherClassEvidencePort({
      db: {},
      viewer: { role: 'teacher', subjectUserId: 'teacher-1', classIds: ['class-1'] },
      classId: 'class-1',
      memberUserIds: ['student-1'],
    });
    expect(small.classRead.independentLearnerCount).toBeLessThan(PROJECTION_INDEPENDENT_LEARNER_MINIMUM);
    expect(small.classRead.suppressed).toBe(true);
    expect(small.classRead.aggregates).toBeNull();
    expect(small.classRead.coverage).toBe(1);
    expect(small.classPortrait.aggregate).toBeNull();
    expect(small.classPortrait.trendDistribution).toBeNull();
    expect(small.classPortrait.riskDistribution).toBeNull();
    expect(small.classPortrait.diagnosis?.strengths).toEqual([]);
    expect(small.classPortrait.diagnosis?.limitations).toContain('independent-learner-small-sample');

    mocks.readCurrentCumulativePortrait.mockResolvedValue(snapshotPortrait());
    const largeIds = ['a', 'b', 'c', 'd', 'e'];
    const large = await readTeacherClassEvidencePort({
      db: {},
      viewer: { role: 'admin', subjectUserId: 'admin-1' },
      classId: 'class-1',
      memberUserIds: largeIds,
    });
    expect(large.classRead.suppressed).toBe(false);
    expect(large.classRead.aggregates?.averageScore).toBe(82);
    expect(large.classPortrait.trendDistribution).toEqual({
      up: 1,
      stable: 4,
      down: 0,
      'not-comparable': 0,
    });
  });

  it('reuses the class-port student read for a teacher-student request', async () => {
    const result = await readTeacherStudentEvidencePort({
      db: {},
      viewer: { role: 'admin', subjectUserId: 'admin-1' },
      classId: 'class-1',
      studentId: 'student-1',
    });
    expect(mocks.readCurrentCumulativePortrait).toHaveBeenCalledTimes(1);
    expect(mocks.readCurrentCumulativeClassPortrait).toHaveBeenCalledTimes(1);
    expect(result.student.status).toBe(PROJECTION_STATUS.qualified);
    expect(result.student.portrait.overallScore).toBe(72);
    expect(result.student.knownZero).toBe(false);
    expect(result.classRead.status).toBe(PROJECTION_STATUS.qualified);
    expect(result.student.read.fields.provenanceRevision).toBe('2026-08-20T00:00:00.000Z');
  });

  it('does not fall back to raw events when the projection is unavailable', async () => {
    mocks.readCurrentCumulativePortrait.mockResolvedValue(snapshotPortrait({
      stateKind: 'UNAVAILABLE',
      payload: null,
      generatedAt: null,
      availabilityReason: 'current-state-unavailable',
      publication: null,
    }));
    const db = { interactionLog: { findMany: vi.fn() } };
    const result = await readStudentEvidencePort({
      db,
      viewer: { role: 'student', subjectUserId: 'student-1' },
      targetUserId: 'student-1',
    });
    expect(result.status).toBe(PROJECTION_STATUS.unavailable);
    expect(db.interactionLog.findMany).not.toHaveBeenCalled();
  });

  it('rejects forbidden fields, encoding echoes and unknown schema', () => {
    expect(inspectConsumerBoundary({ answer: 'B', stack: 'Error: boom at /Users/YW/app.ts' }).length)
      .toBeGreaterThan(0);
    expect(inspectConsumerBoundary({ studentReflection: 'I failed question 2' }).length)
      .toBeGreaterThan(0);
    expect(inspectConsumerBoundary({ userId: 'student-1', prompt: 'x' }).length).toBeGreaterThan(0);
    expect(() => sanitizeLegacyConsumerPayload({ coverage: 1, unknownField: 1 }, '1'))
      .toThrow('consumer-unknown-field');
    expect(() => sanitizeLegacyConsumerPayload({ coverage: 1 }, '2'))
      .toThrow('consumer-unknown-schema');
    expect(redactedProjectionFailure('forbidden-field').code).toBe('forbidden-field');
    expect(() => authorizeRawArtifact({ approved: false, role: 'queue' })).toThrow();
    expect(() => authorizeReplay({
      scope: 'fact',
      purpose: 'debug',
      ticket: 'T-1',
      elevatedUntil: new Date(Date.now() + 60_000),
      dualControl: false,
      role: 'queue',
    })).toThrow();
  });

  it('enforces retention, unreadability and idempotent consumer delivery', () => {
    expect(CONSUMER_RETENTION.successfulPayloadHours).toBe(24);
    expect(CONSUMER_RETENTION.failureReceiptDefaultDays).toBe(30);
    expect(CONSUMER_RETENTION.approvedRawMaxDays).toBe(7);
    expect(successfulPayloadExpired(25 * 60 * 60 * 1000)).toBe(true);
    expect(() => assertTerminalBeforeDelete({
      terminalReceipt: false,
      terminalizationInProgress: true,
    })).toThrow();
    expect(verifyDeletionUnreadability({
      object: false,
      index: false,
      cache: false,
      replica: false,
    })).toBe(true);
    expect(acceptConsumerDelivery({
      digest: 'a',
      lastDigest: 'a',
      order: 2,
      lastOrder: 2,
    })).toEqual({ duplicate: true });
    expect(() => acceptConsumerDelivery({
      digest: 'b',
      lastDigest: 'a',
      order: 1,
      lastOrder: 2,
    })).toThrow('consumer-out-of-order');
  });

  it('derives server viewers and keeps copilot/personalization on the same subject', () => {
    expect(viewerFromSession({ user: { id: 's1', role: 'STUDENT' } })).toEqual({
      role: 'student',
      subjectUserId: 's1',
      classIds: [],
    });
    expect(viewerFromSession({ user: { id: 't1', role: 'TEACHER' } }, ['class-1']).role).toBe('teacher');
    expect(viewerForPortraitConsumer('planner', 'student-1')).toEqual({
      role: 'personalization',
      subjectUserId: 'student-1',
    });
  });

  it('keeps production portrait readers on consumer ports rather than raw aggregators', () => {
    const callers = [
      'src/app/api/student/competency-snapshot/route.ts',
      'src/app/api/teacher/classes/[classId]/insights/route.ts',
      'src/app/api/teacher/classes/[classId]/heatmap/route.ts',
      'src/app/api/teacher/classes/[classId]/students/[studentId]/insights/route.ts',
      'src/app/api/user/profile/route.ts',
      'src/features/personalization/learner-state/internal.ts',
      'src/app/teacher/smart-prep/page.tsx',
      'src/lib/smart-lesson-plan/service.ts',
    ];
    for (const file of callers) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).toContain('@/features/learning-record/consumers/public-api');
      expect(source, file).not.toContain("readCurrentCumulativePortrait(");
      expect(source, file).not.toContain("readCurrentCumulativeClassPortrait(");
    }
    const copilot = readFileSync('src/lib/evidence-copilot-context.ts', 'utf8');
    expect(copilot).toContain("from '@/features/personalization/learner-state/public-api'");
    expect(copilot).not.toContain('readCurrentCumulativePortrait');
    expect(copilot).not.toContain('interactionLog');
    const governedCopilot = readFileSync('src/lib/governed-copilot-profile-context.ts', 'utf8');
    expect(governedCopilot).toContain("from '@/features/personalization/learner-state/public-api'");
    expect(governedCopilot).not.toContain('readCurrentCumulativePortrait');
    expect(governedCopilot).not.toContain('prisma.learningFact');
    expect(governedCopilot).not.toContain('interactionLog');
  });

  it('keeps online projection modules off historical backfill tools', () => {
    for (const file of [
      'src/features/learning-record/consumers/ports.ts',
      'src/features/learning-record/projections/read-ports.ts',
      'src/features/learning-record/projections/pointer.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toContain('course-evidence-backfill');
      expect(source, file).not.toContain('historical-evidence-materialization');
      expect(source, file).not.toContain('backfill-lane');
      expect(source, file).not.toContain('createFileReceiptStore');
    }
    const batches = readFileSync('scripts/db/backfill-learning-facts-from-event-batches.ts', 'utf8');
    expect(batches).toContain('--operation-id');
    expect(batches).toContain('createFileReceiptStore');
  });
});
