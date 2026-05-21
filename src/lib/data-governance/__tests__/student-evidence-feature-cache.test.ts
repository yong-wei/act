import { describe, expect, it, vi } from 'vitest';
import type { LearningFact } from '@prisma/client';
import {
  buildStudentEvidenceFeaturePayload,
  getStudentEvidenceFeatureCacheAdminSummary,
  readStudentEvidenceFeatures,
  rebuildStudentEvidenceFeatureCache,
  refreshStudentEvidenceFeatureCache,
  STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
} from '../student-evidence-feature-cache';

function fact(overrides: Partial<LearningFact> = {}): LearningFact {
  return {
    id: 'fact-1',
    userId: 'student-1',
    factType: 'question',
    moduleId: 'module-1',
    sessionId: 'session-1',
    startedAt: new Date('2026-05-01T10:00:00.000Z'),
    finishedAt: new Date('2026-05-01T10:05:00.000Z'),
    outcome: 'success',
    score: 80,
    timeSpent: 300,
    competencyContribution: { controlModeling: 0.8 },
    sourceEventId: 'event-1',
    sourceLogId: 'log-1',
    courseId: 'course-1',
    lessonId: 'lesson-1',
    contextJson: {},
    createdAt: new Date('2026-05-01T10:05:00.000Z'),
    ...overrides,
  };
}

describe('buildStudentEvidenceFeaturePayload', () => {
  it('produces a stable payload for unchanged governed facts regardless of input order', () => {
    const facts = [
      fact({
        id: 'fact-b',
        factType: 'simulation',
        startedAt: new Date('2026-05-02T10:00:00.000Z'),
        finishedAt: new Date('2026-05-02T10:08:00.000Z'),
        score: 60,
        outcome: 'partial',
        competencyContribution: { parameterDesign: 0.4 },
        sourceEventId: 'event-b',
        sourceLogId: 'log-b',
      }),
      fact({
        id: 'fact-a',
        startedAt: new Date('2026-05-01T10:00:00.000Z'),
        finishedAt: new Date('2026-05-01T10:05:00.000Z'),
        sourceEventId: 'event-a',
        sourceLogId: 'log-a',
      }),
    ];

    const first = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts,
    });
    const second = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts: [...facts].reverse(),
    });

    expect(first).toEqual(second);
    expect(first.payloadVersion).toBe(STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION);
    expect(first.evidenceWindow).toEqual({
      firstStartedAt: '2026-05-01T10:00:00.000Z',
      lastStartedAt: '2026-05-02T10:00:00.000Z',
      daysCovered: 1,
    });
    expect(first.sourceCounts).toMatchObject({
      LearningFact: 2,
      StudentCompetencySnapshot: 0,
      StudentProfileSummary: 0,
      byFactType: {
        question: 1,
        simulation: 1,
      },
    });
  });

  it('separates thirty-day learner windows from all-time audit windows', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-19T00:00:00.000Z'),
      facts: [
        fact({
          id: 'older-rich-fact',
          startedAt: new Date('2026-03-01T10:00:00.000Z'),
          finishedAt: new Date('2026-03-01T10:04:00.000Z'),
          score: 50,
          competencyContribution: { controlModeling: 0.4 },
        }),
        fact({
          id: 'recent-rich-fact',
          startedAt: new Date('2026-05-18T10:00:00.000Z'),
          finishedAt: new Date('2026-05-18T10:06:00.000Z'),
          score: 90,
          competencyContribution: { parameterDesign: 0.9 },
        }),
      ],
    });

    expect(payload.features.activity30d).toMatchObject({
      totalFacts: 1,
      averageScore: 90,
    });
    expect(payload.features.activityAll).toMatchObject({
      totalFacts: 2,
      averageScore: 70,
    });
    expect(payload.features.activity).toEqual(payload.features.activityAll);
    expect(payload.features.competencyContributions30d.parameterDesign).toMatchObject({
      evidenceCount: 1,
      averageContribution: 0.9,
    });
    expect(payload.features.competencyContributionsAll.controlModeling).toMatchObject({
      evidenceCount: 1,
      averageContribution: 0.4,
    });
    expect(payload.sourceWindows.activity30d).toEqual({
      firstStartedAt: '2026-05-18T10:00:00.000Z',
      lastStartedAt: '2026-05-18T10:00:00.000Z',
      daysCovered: 0,
    });
    expect(payload.sourceWindows.activityAll).toEqual({
      firstStartedAt: '2026-03-01T10:00:00.000Z',
      lastStartedAt: '2026-05-18T10:00:00.000Z',
      daysCovered: 78,
    });
  });

  it('marks missing, partial, low-confidence, and stale evidence explicitly', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      facts: [
        fact({
          id: 'old-partial',
          outcome: 'partial',
          score: 40,
          startedAt: new Date('2025-12-01T00:00:00.000Z'),
          finishedAt: null,
          sourceEventId: null,
          sourceLogId: null,
        }),
      ],
      now: new Date('2026-05-19T00:00:00.000Z'),
    });

    expect(payload.statusMarkers).toEqual(
      expect.arrayContaining(['stale', 'partial', 'low-confidence', 'missing-source'])
    );
    expect(payload.confidence).toMatchObject({
      level: 'low',
      evidenceCount: 1,
    });
    expect(payload.sourceCoverage.LearningFact).toBe('partial');
  });
});

describe('student evidence feature cache service', () => {
  it('refreshes only the requested student cache entry', async () => {
    const db = {
      learningFact: {
        findMany: vi.fn().mockResolvedValue([
          fact({ userId: 'student-1', sourceEventId: 'event-a' }),
        ]),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const entry = await refreshStudentEvidenceFeatureCache(db, 'student-1', {
      now: new Date('2026-05-19T00:00:00.000Z'),
    });

    expect(entry.userId).toBe('student-1');
    expect(db.learningFact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'student-1' },
      })
    );
    expect(db.studentCompetencySnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { snapshotAt: 'desc' },
          { id: 'desc' },
        ],
      })
    );
    expect(db.studentEvidenceFeatureCache.upsert).toHaveBeenCalledTimes(1);
    expect(db.studentEvidenceFeatureCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'student-1' },
        create: expect.objectContaining({
          freshness: expect.objectContaining({
            sourceWindows: expect.objectContaining({
              activity30d: expect.any(Object),
              activityAll: expect.any(Object),
              competencyContributions30d: expect.any(Object),
              competencyContributionsAll: expect.any(Object),
            }),
          }),
        }),
      })
    );
  });

  it('full rebuild derives users from governed facts and keeps payloads stable', async () => {
    const db = {
      learningFact: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { userId: 'student-2' },
            { userId: 'student-1' },
            { userId: 'student-1' },
          ])
          .mockResolvedValueOnce([fact({ userId: 'student-1', sourceEventId: 'event-a' })])
          .mockResolvedValueOnce([fact({ userId: 'student-2', sourceEventId: 'event-b' })]),
      },
      studentCompetencySnapshot: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const result = await rebuildStudentEvidenceFeatureCache(db, {
      now: new Date('2026-05-19T00:00:00.000Z'),
    });

    expect(result).toMatchObject({
      processedStudents: 2,
      payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    });
    expect(db.studentEvidenceFeatureCache.upsert).toHaveBeenCalledTimes(2);
    expect(db.studentEvidenceFeatureCache.upsert.mock.calls.map(([args]) => args.where.userId)).toEqual([
      'student-1',
      'student-2',
    ]);
  });

  it('full rebuild also includes users that only have approved aggregates', async () => {
    const db = {
      learningFact: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ userId: 'student-fact' }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([fact({ userId: 'student-fact', sourceEventId: 'event-a' })])
          .mockResolvedValueOnce([]),
      },
      studentCompetencySnapshot: {
        findMany: vi.fn().mockResolvedValue([{ userId: 'student-aggregate' }]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      studentProfileSummary: {
        findMany: vi.fn().mockResolvedValue([{ userId: 'student-profile' }]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      studentEvidenceFeatureCache: {
        upsert: vi.fn().mockImplementation(async ({ create }) => create),
      },
    };

    const result = await rebuildStudentEvidenceFeatureCache(db, {
      now: new Date('2026-05-19T00:00:00.000Z'),
    });

    expect(result.processedStudents).toBe(3);
    expect(db.studentEvidenceFeatureCache.upsert.mock.calls.map(([args]) => args.where.userId)).toEqual([
      'student-aggregate',
      'student-fact',
      'student-profile',
    ]);
  });

  it('returns explicit missing and stale states through the read boundary', async () => {
    const missingDb = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(readStudentEvidenceFeatures(missingDb, 'student-1')).resolves.toMatchObject({
      state: 'missing',
      cache: null,
    });

    const staleDb = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          refreshedAt: new Date('2026-04-01T00:00:00.000Z'),
          statusMarkers: [],
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(staleDb, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
        staleAfterDays: 30,
      })
    ).resolves.toMatchObject({
      state: 'stale',
      cache: {
        userId: 'student-1',
      },
    });
  });

  it('summarizes cache freshness and coverage for admin governance review', async () => {
    const db = {
      studentEvidenceFeatureCache: {
        count: vi.fn().mockResolvedValue(3),
        findMany: vi.fn().mockResolvedValue([
          {
            refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
            statusMarkers: [],
            sourceCoverage: {
              LearningFact: 'available',
              StudentCompetencySnapshot: 'missing',
              StudentProfileSummary: 'missing',
            },
            sourceFactCount: 3,
            rebuildCount: 2,
          },
          {
            refreshedAt: new Date('2026-05-10T00:00:00.000Z'),
            statusMarkers: [],
            sourceCoverage: {
              LearningFact: 'partial',
              StudentCompetencySnapshot: 'available',
              StudentProfileSummary: 'missing',
            },
            sourceFactCount: 1,
            rebuildCount: 1,
          },
          {
            refreshedAt: new Date('2026-05-19T00:00:00.000Z'),
            statusMarkers: ['stale'],
            sourceCoverage: {
              LearningFact: 'missing',
              StudentCompetencySnapshot: 'available',
              StudentProfileSummary: 'available',
            },
            sourceFactCount: 0,
            rebuildCount: 1,
          },
        ]),
      },
    };

    const summary = await getStudentEvidenceFeatureCacheAdminSummary(db, {
      now: new Date('2026-05-19T00:00:00.000Z'),
      staleAfterDays: 7,
    });

    expect(summary).toMatchObject({
      totalEntries: 3,
      staleEntries: 2,
      totalSourceFacts: 4,
      totalRebuilds: 4,
      latestRefreshAt: '2026-05-19T00:00:00.000Z',
      coverage: {
        LearningFact: {
          available: 1,
          missing: 1,
          partial: 1,
        },
        StudentCompetencySnapshot: {
          available: 2,
          missing: 1,
        },
      },
    });
  });
});
