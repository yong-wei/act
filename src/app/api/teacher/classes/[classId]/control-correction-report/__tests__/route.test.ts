import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    class: { findUnique: vi.fn() },
    learningPath: { findMany: vi.fn() },
    studentCompetencySnapshot: { findMany: vi.fn() },
    studentEvidenceFeatureCache: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { GET } from '../route';

const params = { params: Promise.resolve({ classId: 'class-1' }) };

function get(url: string) {
  return new Request(url);
}

function classFixture(teacherId = 'teacher-1') {
  return {
    id: 'class-1',
    name: '控制校正实验班',
    teacherId,
    students: [
      { userId: 'student-1', studentNumber: 'S001', user: { id: 'student-1', name: '学生甲', email: 'a@example.com' } },
      { userId: 'student-2', studentNumber: 'S002', user: { id: 'student-2', name: '学生乙', email: 'b@example.com' } },
    ],
  };
}

function pathFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'path-1',
    userId: 'student-1',
    goalId: 'control-correction',
    pathStatus: 'completed',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-04T00:00:00.000Z'),
    terminalValidation: {
      state: 'completed',
      fallbackRequired: false,
      lowConfidenceMarkers: [],
      failureReasons: [],
      evidence: {
        simulation: { id: 'sim-run-1', replayConfidence: 0.86 },
        arena: { id: 'arena-submission-1', taskId: 'task-second-order-lead-pid', valid: true, score: 88, replayConfidence: 0.91 },
      },
    },
    executions: [
      {
        id: 'exec-sim',
        nodeId: 'simulation:control-correction-step-response-lab',
        resourceType: 'simulation',
        status: 'completed',
        completedAt: new Date('2026-06-03T10:00:00.000Z'),
        evidenceRefs: [{ kind: 'SimulationRun', id: 'sim-run-1', rawTrace: 'hidden' }],
        simulationRef: { id: 'sim-run-1', status: 'completed', replayConfidence: 0.86, rawTrace: [{ t: 0 }] },
        arenaRef: null,
      },
      {
        id: 'exec-arena',
        nodeId: 'arena-task:task-second-order-lead-pid',
        resourceType: 'arena_task',
        status: 'completed',
        completedAt: new Date('2026-06-04T10:00:00.000Z'),
        evidenceRefs: [{ kind: 'ArenaSubmission', id: 'arena-submission-1', hiddenEvaluation: true }],
        simulationRef: null,
        arenaRef: { id: 'arena-submission-1', valid: true, score: 88, replayConfidence: 0.91, hiddenScenarioWorst: 999 },
      },
    ],
    deviations: [],
    interventions: [
      {
        id: 'int-1',
        interventionKind: 'hint',
        studentOutcome: 'accepted',
        privacySafeSummary: '建议复查超调量约束。',
        suggestedAction: 'raw teacher-only plan',
        citedEvidence: [
          { kind: 'LearningPathExecution', id: 'exec-arena', privateMemory: true },
          { kind: 'ai-intervention', ref: 'intv-1' },
          { kind: 'learning-path-node', ref: 'arena-task:task-second-order-lead-pid' },
          { sourceType: 'memory', id: 'memory:mem-1' },
        ],
        createdAt: new Date('2026-06-04T10:05:00.000Z'),
      },
    ],
    ...overrides,
  };
}

function snapshotsFixture() {
  return [
    {
      id: 'snap-latest',
      userId: 'student-1',
      snapshotAt: new Date('2026-06-04T00:00:00.000Z'),
      competencyVector: { controlModeling: { score: 0.8 } },
      factCount: 8,
    },
    {
      id: 'snap-prev',
      userId: 'student-1',
      snapshotAt: new Date('2026-06-01T00:00:00.000Z'),
      competencyVector: { controlModeling: { score: 0.5 } },
      factCount: 4,
    },
  ];
}

function cacheFixture(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'student-1',
    payloadVersion: 'student-evidence-features.v4',
    refreshedAt: new Date('2026-06-04T00:00:00.000Z'),
    statusMarkers: [],
    features: {
      pathExecution: {
        allTime: {
          terminalValidation: {
            latestState: 'completed',
            completedCount: 1,
            failedCount: 0,
            lowConfidenceCount: 0,
            fallbackRequiredCount: 0,
            lowConfidenceMarkers: [],
            failureReasons: [],
          },
        },
      },
    },
    ...overrides,
  };
}

describe('GET /api/teacher/classes/[classId]/control-correction-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findUnique.mockResolvedValue(classFixture());
    mocks.prisma.learningPath.findMany.mockResolvedValue([pathFixture()]);
    mocks.prisma.studentCompetencySnapshot.findMany.mockResolvedValue(snapshotsFixture());
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([cacheFixture()]);
  });

  it('requires an authenticated teacher or admin', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);
    expect((await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params)).status).toBe(401);

    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    expect((await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params)).status).toBe(403);
  });

  it('rejects teachers outside the class scope', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-2', role: 'TEACHER' } });

    const response = await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params);

    expect(response.status).toBe(403);
  });

  it('allows admins to read the class report', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.prisma.class.findUnique.mockResolvedValue(classFixture('teacher-2'));

    const response = await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params);

    expect(response.status).toBe(200);
  });

  it('returns control-correction metrics, drilldown, and redacted evidence summaries', async () => {
    const response = await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.report.goalId).toBe('control-correction');
    expect(payload.report.metrics.pathAdoption).toMatchObject({
      value: 0.5,
      denominator: 2,
      includedPopulation: 1,
      excludedPopulation: 1,
      confidence: 'low',
    });
    expect(payload.report.metrics.pathCompletion).toMatchObject({
      value: 1,
      denominator: 1,
      includedPopulation: 1,
      confidence: 'low',
    });
    expect(payload.report.metrics.competencyLift.value).toBe(0.3);
    expect(payload.report.metrics.arenaValidSubmissionRate.value).toBe(1);
    expect(payload.report.metrics.konlingInterventionAcceptance.value).toBe(1);
    expect(payload.report.metrics.interventionAfterSuccess.value).toBe(1);
    expect(payload.report.metrics.citationCoverage.value).toBe(1);
    expect(payload.report.metrics.resourceContribution.value).toBeLessThanOrEqual(1);
    expect(payload.report.studentDrilldowns).toHaveLength(2);
    expect(payload.report.studentDrilldowns[0]).toMatchObject({
      userId: 'student-1',
      path: {
        pathStatus: 'completed',
        terminalValidationState: 'completed',
      },
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('rawTrace');
    expect(serialized).not.toContain('hiddenScenarioWorst');
    expect(serialized).not.toContain('hiddenEvaluation');
    expect(serialized).not.toContain('privateMemory');
    expect(serialized).not.toContain('memory:mem-1');
    expect(serialized).not.toContain('raw teacher-only plan');
  });

  it('returns export tables, chart data, and methodology notes with the same class scope', async () => {
    const response = await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report?export=true'), params);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.export.tables.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metricId: 'pathAdoption',
        denominator: 2,
        sourceCoverage: expect.any(Object),
        calculationWindow: expect.any(Object),
        exclusionReasons: expect.any(Array),
        methodology: expect.stringContaining('denominator'),
      }),
    ]));
    expect(payload.export.tables.students).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: 'student-1', terminalValidationState: 'completed' }),
    ]));
    expect(payload.export.chartData.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ metricId: 'arenaValidSubmissionRate', value: 1 }),
    ]));
    expect(payload.export.redactionPolicyNotes.join(' ')).toContain('raw traces');
  });

  it('marks missing, stale, partial, and low-confidence evidence in metric confidence metadata', async () => {
    mocks.prisma.learningPath.findMany.mockResolvedValue([
      pathFixture({
        pathStatus: 'fallback',
        terminalValidation: {
          state: 'low-confidence',
          fallbackRequired: true,
          lowConfidenceMarkers: ['arena-preview-only'],
          failureReasons: [],
        },
        executions: [],
        deviations: [{ id: 'dev-1', deviationType: 'resource-failure', createdAt: new Date('2026-06-04T10:00:00.000Z') }],
        interventions: [
          {
            id: 'int-a',
            studentOutcome: 'accepted',
            citedEvidence: [{ sourceType: 'memory', id: 'memory:private' }],
            createdAt: new Date('2026-06-04T10:10:00.000Z'),
          },
          {
            id: 'int-b',
            studentOutcome: 'accepted',
            citedEvidence: [{ kind: 'LearningPathExecution', id: 'exec-safe' }],
            createdAt: new Date('2026-06-04T10:11:00.000Z'),
          },
        ],
      }),
    ]);
    mocks.prisma.studentEvidenceFeatureCache.findMany.mockResolvedValue([
      cacheFixture({ statusMarkers: ['stale', 'low-confidence'] }),
    ]);

    const response = await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.report.metrics.pathCompletion).toMatchObject({
      confidence: 'low',
      sourceCoverage: expect.objectContaining({
        staleStudents: 1,
        lowConfidenceStudents: 1,
        missingStudents: 1,
      }),
    });
    expect(payload.report.metrics.arenaValidSubmissionRate.value).toBe(0);
    expect(payload.report.metrics.interventionAfterSuccess.value).toBeNull();
    expect(payload.report.metrics.citationCoverage.value).toBe(0.5);
    expect(payload.report.studentDrilldowns[0].path.terminalValidationState).toBe('low-confidence');
    expect(JSON.stringify(payload)).not.toContain('memory:private');
  });

  it('caps resource contribution by resource category coverage instead of distinct node rows', async () => {
    mocks.prisma.learningPath.findMany.mockResolvedValue([
      pathFixture({
        executions: [
          { id: 'exec-k1', nodeId: 'knowledge-card:a', resourceType: 'knowledge_card', status: 'completed', completedAt: new Date('2026-06-04T09:00:00.000Z') },
          { id: 'exec-k2', nodeId: 'knowledge-card:b', resourceType: 'knowledge_card', status: 'completed', completedAt: new Date('2026-06-04T09:05:00.000Z') },
          { id: 'exec-s1', nodeId: 'simulation:a', resourceType: 'simulation', status: 'completed', completedAt: new Date('2026-06-04T09:10:00.000Z') },
          { id: 'exec-s2', nodeId: 'simulation:b', resourceType: 'simulation', status: 'completed', completedAt: new Date('2026-06-04T09:15:00.000Z') },
          { id: 'exec-a', nodeId: 'arena-task:a', resourceType: 'arena_task', status: 'completed', completedAt: new Date('2026-06-04T09:20:00.000Z') },
          { id: 'exec-r', nodeId: 'reflection:a', resourceType: 'reflection', status: 'completed', completedAt: new Date('2026-06-04T09:25:00.000Z') },
        ],
      }),
    ]);

    const response = await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.report.resourceContribution).toHaveLength(6);
    expect(payload.report.metrics.resourceContribution).toMatchObject({
      value: 0.8,
      denominator: 5,
      includedPopulation: 4,
    });
  });

  it('ignores unexpected legacy resource types in category coverage denominator', async () => {
    mocks.prisma.learningPath.findMany.mockResolvedValue([
      pathFixture({
        executions: [
          { id: 'exec-k', nodeId: 'knowledge-card:a', resourceType: 'knowledge_card', status: 'completed', completedAt: new Date('2026-06-04T09:00:00.000Z') },
          { id: 'exec-q', nodeId: 'quiz:a', resourceType: 'quiz', status: 'completed', completedAt: new Date('2026-06-04T09:05:00.000Z') },
          { id: 'exec-ai', nodeId: 'ai:a', resourceType: 'ai_intervention', status: 'completed', completedAt: new Date('2026-06-04T09:10:00.000Z') },
        ],
      }),
    ]);

    const response = await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.report.resourceContribution).toEqual(expect.arrayContaining([
      expect.objectContaining({ resourceType: 'quiz' }),
      expect.objectContaining({ resourceType: 'ai_intervention' }),
    ]));
    expect(payload.report.metrics.resourceContribution).toMatchObject({
      value: 0.2,
      denominator: 5,
      includedPopulation: 1,
    });
  });

  it('preserves preview Arena evidence kind when drilldown refs are inferred from arenaRef', async () => {
    mocks.prisma.learningPath.findMany.mockResolvedValue([
      pathFixture({
        executions: [
          {
            id: 'exec-preview-arena',
            nodeId: 'arena-task:preview',
            resourceType: 'arena_task',
            status: 'completed',
            completedAt: new Date('2026-06-04T09:20:00.000Z'),
            evidenceRefs: [],
            arenaRef: { kind: 'ArenaVirtualSimulationRun', id: 'preview-run-1', valid: false },
          },
        ],
      }),
    ]);

    const response = await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.report.studentDrilldowns[0].path.evidenceRefs).toEqual(expect.arrayContaining([
      { kind: 'ArenaVirtualSimulationRun', id: 'preview-run-1' },
    ]));
    expect(payload.report.studentDrilldowns[0].path.evidenceRefs).not.toEqual(expect.arrayContaining([
      { kind: 'ArenaSubmission', id: 'preview-run-1' },
    ]));
  });

  it('calculates path outcome rates from each student latest path when duplicate path rows exist', async () => {
    mocks.prisma.learningPath.findMany.mockResolvedValue([
      pathFixture({
        id: 'path-old',
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        terminalValidation: {
          state: 'completed',
          fallbackRequired: false,
          lowConfidenceMarkers: [],
          failureReasons: [],
          evidence: {
            simulation: { id: 'old-sim-run', replayConfidence: 0.91 },
            arena: { id: 'old-arena-submission', valid: true, score: 90 },
          },
        },
        executions: [
          { id: 'exec-old-arena', nodeId: 'arena-task:old', resourceType: 'arena_task', status: 'completed', completedAt: new Date('2026-06-01T10:00:00.000Z') },
        ],
      }),
      pathFixture({
        id: 'path-new',
        updatedAt: new Date('2026-06-04T00:00:00.000Z'),
        terminalValidation: {
          state: 'completed',
          fallbackRequired: false,
          lowConfidenceMarkers: [],
          failureReasons: [],
          evidence: {
            simulation: { id: 'new-sim-run', replayConfidence: 0.91 },
            arena: { id: 'new-arena-submission', valid: false, score: 40 },
          },
        },
        executions: [
          { id: 'exec-new-sim', nodeId: 'simulation:new', resourceType: 'simulation', status: 'completed', completedAt: new Date('2026-06-04T10:00:00.000Z') },
        ],
      }),
    ]);

    const response = await GET(get('http://localhost/api/teacher/classes/class-1/control-correction-report'), params);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.report.studentDrilldowns[0].path.pathId).toBe('path-new');
    expect(payload.report.metrics.arenaValidSubmissionRate).toMatchObject({
      value: 0,
      denominator: 1,
      includedPopulation: 0,
    });
    expect(payload.report.resourceContribution).toEqual([
      expect.objectContaining({ resourceType: 'simulation', nodeId: 'simulation:new' }),
    ]);
  });
});
