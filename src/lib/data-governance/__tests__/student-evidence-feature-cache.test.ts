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
  it('derives compact simulation and Arena features from governed summaries and trace references', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [
        fact({
          id: 'course-sim',
          factType: 'simulation',
          startedAt: new Date('2026-05-18T10:00:00.000Z'),
          finishedAt: new Date('2026-05-18T10:08:00.000Z'),
          outcome: 'partial',
          score: 62,
          sessionId: 'class-session-1',
          lessonId: 'unit-5-2-nonlinear-analysis-entry',
          contextJson: {
            simulation: {
              sourceId: 'simulation/cruise',
              sceneId: 'sim/cruise',
              launchMode: 'course-resource',
              traceReference: 'SimulationTrace:course-run-1',
              replayConfidence: 0.86,
              protocolVersion: '1.0',
              checksum: 'checksum-course-run-1',
              summary: {
                metrics: {
                  settlingTime: 9.2,
                  rollRms: 0.42,
                },
                passed: false,
                durationSeconds: 138,
              },
              weakMetrics: [{ metricId: 'rollRms', value: 0.42 }],
            },
          },
        }),
        fact({
          id: 'official-arena',
          factType: 'design',
          startedAt: new Date('2026-05-19T10:00:00.000Z'),
          finishedAt: new Date('2026-05-19T10:05:00.000Z'),
          outcome: 'failure',
          score: 48,
          sourceEventId: 'arena_evaluation_complete:event-1',
          sourceLogId: 'arena-log-1',
          contextJson: {
            arena: {
              taskId: 'task-cruise-roll',
              classId: 'class-1',
              publicationId: 'publication-1',
              score: 48,
              valid: false,
              official: true,
              replayConfidence: 0.92,
              traceReference: 'ArenaEvaluationRun:official-run-1',
              protocolVersion: 'arena-eval-v1',
              satisfaction: {
                trackingError: 0.45,
                controlEnergy: 0.3,
              },
            },
            evidenceGovernance: {
              policyReason: 'official_arena_evaluation',
            },
          },
        }),
        fact({
          id: 'preview-arena',
          factType: 'simulation',
          startedAt: new Date('2026-04-01T10:00:00.000Z'),
          finishedAt: new Date('2026-04-01T10:05:00.000Z'),
          outcome: 'success',
          score: 74,
          sessionId: null,
          lessonId: null,
          courseId: null,
          sourceEventId: 'arena_simulation_run:event-preview',
          sourceLogId: 'arena-preview-log',
          contextJson: {
            arena: {
              taskId: 'task-preview',
              preview: true,
              launchMode: 'standalone',
              valid: true,
              replayConfidence: 0.34,
              traceReference: 'ArenaVirtualSimulationRun:preview-run-1',
              satisfaction: {
                smoothness: 0.55,
              },
            },
          },
        }),
      ],
    });

    const simulationArena = (payload.features as any).simulationArena;

    expect(simulationArena.recent30d).toMatchObject({
      evidenceCount: 2,
      completedCount: 0,
      officialCount: 1,
      previewCount: 0,
      courseLaunchedCount: 2,
      standaloneCount: 0,
      traceReferenceCount: 2,
      sourceCoverage: {
        simulation: 'available',
        arena: 'available',
        traceReferences: 'available',
        replayConfidence: 'available',
      },
      replayConfidence: {
        average: 0.89,
        lowConfidenceCount: 0,
        missingCount: 0,
      },
    });
    expect(simulationArena.allTime).toMatchObject({
      evidenceCount: 3,
      officialCount: 1,
      previewCount: 1,
      courseLaunchedCount: 2,
      standaloneCount: 1,
      traceReferenceCount: 3,
      replayConfidence: {
        average: 0.71,
        lowConfidenceCount: 1,
      },
    });
    expect(simulationArena.allTime.weakMetrics.map((metric: { metricId: string }) => metric.metricId)).toEqual([
      'controlEnergy',
      'rollRms',
      'smoothness',
      'trackingError',
    ]);
    expect(simulationArena.allTime.traceReferences).toEqual([
      expect.objectContaining({
        factId: 'preview-arena',
        source: 'arena',
        traceReference: 'ArenaVirtualSimulationRun:preview-run-1',
      }),
      expect.objectContaining({
        factId: 'course-sim',
        source: 'simulation',
        traceReference: 'SimulationTrace:course-run-1',
      }),
      expect.objectContaining({
        factId: 'official-arena',
        source: 'arena',
        traceReference: 'ArenaEvaluationRun:official-run-1',
      }),
    ]);
    expect(JSON.stringify(simulationArena)).not.toContain('samples');
  });

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

  it('adds adaptive learner-state feature groups with coverage and confidence metadata', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-19T00:00:00.000Z'),
      facts: [
        fact({
          id: 'assessment-fact',
          factType: 'question',
          moduleId: 'adaptive-assessment',
          contextJson: {
            adaptiveAssessment: {
              knowledgeTags: ['root-locus'],
              masteryPosterior: 0.74,
              masteryConfidence: 0.81,
            },
          },
        }),
        fact({
          id: 'media-fact',
          factType: 'media',
          score: 58,
          timeSpent: 420,
          contextJson: {
            media: {
              mediaType: 'video',
              progress: 0.58,
            },
          },
        }),
      ],
      latestSnapshot: {
        snapshotAt: new Date('2026-05-18T00:00:00.000Z'),
        factCount: 12,
        calculationVersion: 'competency-v2',
        competencyVector: { controlModeling: { score: 76 } },
      },
      profileSummary: {
        updatedAt: new Date('2026-05-18T01:00:00.000Z'),
        overallScore: 69,
        riskLevel: 'medium',
        trendDirection: 'up',
      },
    });

    expect(payload.payloadVersion).toBe('student-evidence-features.v3');
    expect(payload.features.adaptiveLearnerState).toMatchObject({
      payloadVersion: 'adaptive-learner-state.v1',
      sourceCoverage: {
        primaryCompetencies: 'available',
        knowledgeMastery: 'available',
        resourcePreference: 'available',
        mediaAbsorption: 'available',
        pathContext: 'missing',
        simulationArena: 'missing',
      },
      sourceCounts: {
        LearningFact: 2,
        AdaptiveMasteryEvidence: 1,
      },
      confidence: {
        level: 'medium',
        markers: [],
      },
    });
    expect(JSON.stringify(payload.features.adaptiveLearnerState)).not.toContain('rawTracePayload');
  });

  it('does not treat ordinary adaptive question tags as mastery posterior evidence', () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-19T00:00:00.000Z'),
      facts: [
        fact({
          id: 'tag-only-question',
          factType: 'question',
          moduleId: 'adaptive-assessment',
          contextJson: {
            adaptiveAssessment: {
              knowledgeTags: ['root-locus'],
            },
          },
        }),
      ],
    });

    expect(payload.features.adaptiveLearnerState).toMatchObject({
      sourceCoverage: {
        knowledgeMastery: 'missing',
      },
      sourceCounts: {
        AdaptiveMasteryEvidence: 0,
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

  it('omits absent optional trace metadata instead of producing stale v2 payloads', async () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [
        fact({
          id: 'trace-without-optional-metadata',
          factType: 'simulation',
          contextJson: {
            simulation: {
              traceReference: 'SimulationTrace:without-optional-metadata',
              replayConfidence: 0.86,
            },
          },
        }),
      ],
    });

    expect(payload.features.simulationArena.allTime.traceReferences[0]).not.toHaveProperty('protocolVersion');
    expect(payload.features.simulationArena.allTime.traceReferences[0]).not.toHaveProperty('checksum');

    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-21T00:00:00.000Z'),
          statusMarkers: [],
          features: payload.features,
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-21T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'ready',
    });
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

  it('marks old payload versions without adaptive learner-state features as stale', async () => {
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: 'student-evidence-features.v1',
          refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
          statusMarkers: [],
          features: {
            approvedAggregates: {},
          },
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'stale',
      cache: {
        userId: 'student-1',
        payloadVersion: 'student-evidence-features.v1',
      },
    });
  });

  it('marks v2 payloads without adaptive learner-state feature groups as stale', async () => {
    const payload = buildStudentEvidenceFeaturePayload({
      userId: 'student-1',
      now: new Date('2026-05-21T00:00:00.000Z'),
      facts: [fact()],
    });
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: 'student-evidence-features.v2',
          refreshedAt: new Date('2026-05-21T00:00:00.000Z'),
          statusMarkers: [],
          features: {
            ...payload.features,
            adaptiveLearnerState: undefined,
          },
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-21T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'stale',
    });
  });

  it('marks malformed v2 simulation Arena payloads as stale', async () => {
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
          statusMarkers: [],
          features: {
            simulationArena: {
              recent30d: {},
              allTime: {},
            },
          },
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'stale',
    });
  });

  it('marks v2 simulation Arena payloads with malformed nested fields as stale', async () => {
    const malformedWindow = {
      window: {},
      evidenceCount: 1,
      completedCount: 0,
      officialCount: 1,
      previewCount: 0,
      courseLaunchedCount: 1,
      standaloneCount: 0,
      traceReferenceCount: 1,
      sourceCoverage: {
        simulation: 'missing',
        arena: 'available',
        traceReferences: 'available',
        replayConfidence: 'available',
      },
      replayConfidence: {
        average: 0.86,
        highConfidenceCount: 1,
        lowConfidenceCount: 0,
        missingCount: 0,
      },
      weakMetrics: [
        { metricId: 'trackingError', affectedFactCount: 1, lowestValue: 0.42 },
      ],
      qualityMarkers: [],
      traceReferences: [
        {
          source: 'arena',
          traceReference: 'ArenaEvaluationRun:raw-leak',
          factId: 'fact-arena-1',
          sourceEventId: null,
          sourceLogId: null,
          startedAt: '2026-05-18T00:00:00.000Z',
          rawTracePayload: [{ t: 0, y: 1 }],
        },
      ],
    };
    const db = {
      studentEvidenceFeatureCache: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'student-1',
          payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
          refreshedAt: new Date('2026-05-18T00:00:00.000Z'),
          statusMarkers: [],
          features: {
            simulationArena: {
              recent30d: malformedWindow,
              allTime: malformedWindow,
            },
          },
        }),
      },
    };

    await expect(
      readStudentEvidenceFeatures(db, 'student-1', {
        now: new Date('2026-05-19T00:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      state: 'stale',
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
