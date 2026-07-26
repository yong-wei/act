import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildArenaStudentPortfolio } from '../profile';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { ControllerArtifact, ControllerMethod } from '../types';

const targetUserId = 'student-target';

function artifact(input: {
  id: string;
  taskId: string;
  method?: ControllerMethod;
  params?: Record<string, number | string | boolean>;
  createdAt?: string;
}): ControllerArtifact {
  return {
    id: input.id,
    taskId: input.taskId,
    method: input.method ?? 'pid',
    params: input.params ?? { kp: 2.4, ki: 0.8, kd: 0.35 },
    createdAt: input.createdAt ?? '2026-05-11T08:00:00.000Z',
  };
}

function submission(input: {
  id: string;
  taskId: string;
  userId: string;
  studentLabel: string;
  artifact: ControllerArtifact;
  score: number;
  valid: boolean;
  submittedAt: string;
  satisfaction?: Record<string, number>;
  metrics?: Record<string, number>;
}): ArenaSubmissionRecord {
  return {
    id: input.id,
    taskId: input.taskId,
    userId: input.userId,
    studentLabel: input.studentLabel,
    artifactHash: `hash-${input.id}`,
    artifact: input.artifact,
    evaluation: {
      taskId: input.taskId,
      artifact: input.artifact,
      valid: input.valid,
      score: input.score,
      metrics: input.metrics ?? {
        settlingTime: 3.2,
        overshoot: 8,
        steadyStateError: 0.02,
        controlEnergy: 5,
      },
      satisfaction: input.satisfaction ?? {
        settlingTime: 0.7,
        overshoot: 0.8,
        steadyStateError: 0.9,
        controlEnergy: 0.65,
      },
      hardConstraintResults: [
        { id: 'closed_loop_stable', label: '闭环稳定', passed: input.valid },
      ],
      penalties: [],
      explanation: [],
    },
    submittedAt: input.submittedAt,
    reusedEvaluation: false,
  };
}

function virtualTraining(overrides: Record<string, unknown> = {}) {
  return {
    id: 'training-1',
    userId: targetUserId,
    taskId: 'task-cruise-roll-blackbox-identification',
    scenarioId: 'cruise-roll-controller-preview',
    simulationRunId: 'canonical-run-1',
    payload: {
      summary: {
        trackingError: 0.2,
        maxDeviation: 0.3,
        controlEnergy: 0.4,
        safetyViolations: 0,
        smoothness: 0.8,
      },
      metadata: {
        evaluationVisibility: 'preview',
        officialEligible: false,
      },
    },
    createdAt: '2026-05-11T08:45:00.000Z',
    ...overrides,
  };
}

describe('arena student portfolio', () => {
  it('summarizes controllers, identification models, ranks, failures, and metric improvement from real submissions', () => {
    const earlyPid = submission({
      id: 'target-pid-early',
      taskId: 'task-second-order-lead-pid',
      userId: targetUserId,
      studentLabel: '目标学生',
      artifact: artifact({ id: 'target-pid-early', taskId: 'task-second-order-lead-pid' }),
      score: 42,
      valid: false,
      submittedAt: '2026-05-11T08:00:00.000Z',
      satisfaction: {
        settlingTime: 0.2,
        overshoot: 0.5,
        steadyStateError: 0.3,
        controlEnergy: 0.25,
      },
    });
    const improvedPid = submission({
      id: 'target-pid-improved',
      taskId: 'task-second-order-lead-pid',
      userId: targetUserId,
      studentLabel: '目标学生',
      artifact: artifact({ id: 'target-pid-improved', taskId: 'task-second-order-lead-pid' }),
      score: 82,
      valid: true,
      submittedAt: '2026-05-11T08:20:00.000Z',
      satisfaction: {
        settlingTime: 0.78,
        overshoot: 0.7,
        steadyStateError: 0.82,
        controlEnergy: 0.62,
      },
    });
    const strongerPeer = submission({
      id: 'peer-pid',
      taskId: 'task-second-order-lead-pid',
      userId: 'student-peer',
      studentLabel: '同伴学生',
      artifact: artifact({
        id: 'peer-pid',
        taskId: 'task-second-order-lead-pid',
        params: { kp: 3.1, ki: 0.9, kd: 0.42 },
      }),
      score: 91,
      valid: true,
      submittedAt: '2026-05-11T08:10:00.000Z',
    });
    const blackBox = submission({
      id: 'target-blackbox',
      taskId: 'task-cruise-roll-blackbox-identification',
      userId: targetUserId,
      studentLabel: '目标学生',
      artifact: artifact({
        id: 'target-blackbox-artifact',
        taskId: 'task-cruise-roll-blackbox-identification',
        method: 'black-box-control',
        params: {
          experimentDatasetHash: 'arena-blackbox-dataset-target001122',
          identificationModelId: 'arena-identification-target001122',
          identificationQuality: 0.42,
        },
      }),
      score: 38,
      valid: false,
      submittedAt: '2026-05-11T08:30:00.000Z',
      satisfaction: {
        trackingError: 0.25,
        worstCaseDeviation: 0.2,
        controlEnergy: 0.4,
        constraintViolations: 0.1,
      },
    });

    const portfolio = buildArenaStudentPortfolio(
      [earlyPid, improvedPid, strongerPeer, blackBox],
      targetUserId,
    );

    expect(portfolio.controllerCount).toBe(3);
    expect(portfolio.submissionSummary).toMatchObject({
      total: 3,
      valid: 1,
      invalid: 2,
      latestSubmittedAt: '2026-05-11T08:30:00.000Z',
    });
    expect(portfolio.methodDistribution).toEqual([
      { method: 'black-box-control', count: 1 },
      { method: 'pid', count: 2 },
    ]);
    expect(portfolio.identificationModels).toEqual([
      {
        taskId: 'task-cruise-roll-blackbox-identification',
        taskTitle: '邮轮黑箱辨识与闭环控制挑战',
        datasetHash: 'arena-blackbox-dataset-target001122',
        identificationModelId: 'arena-identification-target001122',
        submittedAt: '2026-05-11T08:30:00.000Z',
      },
    ]);
    expect(portfolio.personalBestByTask).toEqual([
      expect.objectContaining({
        taskId: 'task-second-order-lead-pid',
        taskTitle: '二阶对象快速稳定挑战',
        bestScore: 82,
        rank: 2,
        submissionId: 'target-pid-improved',
      }),
    ]);
    expect(portfolio.frequentFailureObjects).toEqual([
      expect.objectContaining({
        objectId: 'plant-cruise-roll-blackbox',
        objectName: '邮轮横摇黑箱对象',
        failureCount: 1,
      }),
      expect.objectContaining({
        objectId: 'plant-second-order-underdamped',
        objectName: '二阶欠阻尼对象',
        failureCount: 1,
      }),
    ]);
    expect(portfolio.improvingMetrics).toEqual([
      expect.objectContaining({ metricId: 'settlingTime', firstSatisfaction: 0.2, latestSatisfaction: 0.78, delta: 0.58 }),
      expect.objectContaining({ metricId: 'steadyStateError', firstSatisfaction: 0.3, latestSatisfaction: 0.82, delta: 0.52 }),
      expect.objectContaining({ metricId: 'controlEnergy', firstSatisfaction: 0.25, latestSatisfaction: 0.62, delta: 0.37 }),
    ]);
    expect(portfolio.growth.evidenceAvailable).toBe(true);
    expect(portfolio.growth.weakCapabilities).toEqual(expect.arrayContaining([
      '黑箱辨识',
    ]));
    expect(portfolio.growth.improvingCapabilities).toEqual(expect.arrayContaining([
      '时域整形',
      '稳态精度',
    ]));
    expect(portfolio.growth.nextChallenges.length).toBeGreaterThan(0);
    expect(portfolio.growth.nextChallenges[0].reason).toMatch(/薄弱|指标|阶段|补齐/);
  });

  it('keeps improved but still weak capability evidence in the weak bucket', () => {
    const weakEarly = submission({
      id: 'target-weak-early',
      taskId: 'task-second-order-lead-pid',
      userId: targetUserId,
      studentLabel: '目标学生',
      artifact: artifact({ id: 'target-weak-early', taskId: 'task-second-order-lead-pid' }),
      score: 25,
      valid: false,
      submittedAt: '2026-05-11T08:00:00.000Z',
      satisfaction: {
        settlingTime: 0.2,
        overshoot: 0.25,
        steadyStateError: 0.3,
        controlEnergy: 0.28,
      },
    });
    const weakImproved = submission({
      id: 'target-weak-improved',
      taskId: 'task-second-order-lead-pid',
      userId: targetUserId,
      studentLabel: '目标学生',
      artifact: artifact({ id: 'target-weak-improved', taskId: 'task-second-order-lead-pid' }),
      score: 58,
      valid: true,
      submittedAt: '2026-05-11T08:20:00.000Z',
      satisfaction: {
        settlingTime: 0.55,
        overshoot: 0.52,
        steadyStateError: 0.58,
        controlEnergy: 0.5,
      },
    });

    const portfolio = buildArenaStudentPortfolio([weakEarly, weakImproved], targetUserId);
    const shapingSignal = portfolio.growth.capabilitySignals.find((signal) => signal.label === '时域整形');

    expect(shapingSignal?.status).toBe('needs-work');
    expect(portfolio.growth.weakCapabilities).toEqual(expect.arrayContaining([
      '时域整形',
      '稳态精度',
    ]));
    expect(portfolio.growth.improvingCapabilities).not.toEqual(expect.arrayContaining([
      '时域整形',
    ]));
  });

  it('does not count weak capability exposure as ready prerequisite evidence', () => {
    const weakButValid = submission({
      id: 'target-weak-valid',
      taskId: 'task-second-order-lead-pid',
      userId: targetUserId,
      studentLabel: '目标学生',
      artifact: artifact({ id: 'target-weak-valid', taskId: 'task-second-order-lead-pid' }),
      score: 58,
      valid: true,
      submittedAt: '2026-05-11T08:00:00.000Z',
      satisfaction: {
        settlingTime: 0.82,
        overshoot: 0.8,
        steadyStateError: 0.85,
        controlEnergy: 0.81,
      },
    });

    const portfolio = buildArenaStudentPortfolio([weakButValid], targetUserId);
    const shapingSignal = portfolio.growth.capabilitySignals.find((signal) => signal.label === '时域整形');
    const lowFrequencyChallenge = portfolio.growth.nextChallenges.find(
      (challenge) => challenge.taskId === 'task-integrator-low-frequency-balance',
    );

    expect(shapingSignal?.status).toBe('needs-work');
    expect(lowFrequencyChallenge).toEqual(expect.objectContaining({
      evidenceLevel: 'capability-gap',
    }));
    expect(lowFrequencyChallenge?.reason).toContain('先补齐时域整形');
  });

  it('marks strong Arena capability evidence and recommends next-stage challenges', () => {
    const strong = submission({
      id: 'target-strong',
      taskId: 'task-second-order-lead-pid',
      userId: targetUserId,
      studentLabel: '目标学生',
      artifact: artifact({ id: 'target-strong', taskId: 'task-second-order-lead-pid' }),
      score: 91,
      valid: true,
      submittedAt: '2026-05-11T08:00:00.000Z',
      satisfaction: {
        settlingTime: 0.88,
        overshoot: 0.9,
        steadyStateError: 0.92,
        controlEnergy: 0.86,
      },
    });

    const portfolio = buildArenaStudentPortfolio([strong], targetUserId);

    expect(portfolio.growth.strongCapabilities).toEqual(expect.arrayContaining([
      '时域整形',
      '稳态精度',
    ]));
    expect(portfolio.growth.nextChallenges[0]).toEqual(expect.objectContaining({
      taskId: 'task-integrator-low-frequency-balance',
      evidenceLevel: 'next-stage',
    }));
    expect(portfolio.growth.nextChallenges[0].reason).toContain('分析整合');
  });

  it('connects the portfolio summary to the student profile API and page', () => {
    const routeSource = readFileSync(
      join(process.cwd(), 'src/app/api/user/profile/route.ts'),
      'utf8',
    );
    const pageSource = readFileSync(
      join(process.cwd(), 'src/app/(main)/profile/page.tsx'),
      'utf8',
    );

    expect(routeSource).toContain('prismaArenaSubmissionStore.listSubmissions({ userId })');
    expect(routeSource).toContain('prismaArenaSubmissionStore.listSubmissions({ taskIds: arenaTaskIds })');
    expect(routeSource).toContain('prisma.arenaVirtualSimulationRun.count');
    expect(routeSource).toContain('prisma.arenaVirtualSimulationRun.findMany');
    expect(routeSource).toContain('take: 5');
    expect(routeSource).toContain('{ total: userArenaVirtualSimulationRunCount }');
    expect(routeSource).toContain('arenaPortfolio:');
    expect(pageSource).toContain('arenaPortfolio');
    expect(pageSource).toContain('trainingSummary');
    expect(pageSource).toContain('最近');
    expect(pageSource).toContain('recentAverageQualityScore');
    expect(pageSource).toContain('recentRuns');
    expect(pageSource).toContain('竞技场画像');
    expect(pageSource).toContain('能力成长');
    expect(pageSource).toContain('下一项挑战');
    expect(pageSource).toContain('growth.nextChallenges');
  });

  it('summarizes virtual training separately without inventing official Arena evidence', () => {
    const portfolio = buildArenaStudentPortfolio(
      [],
      targetUserId,
      [virtualTraining()],
    );

    expect(portfolio.submissionSummary).toEqual({
      total: 0,
      valid: 0,
      invalid: 0,
      latestSubmittedAt: undefined,
    });
    expect(portfolio.growth).toMatchObject({
      evidenceAvailable: false,
      capabilityCoverage: { covered: 0 },
    });
    expect(portfolio.trainingSummary).toEqual({
      total: 1,
      recentWindowSize: 5,
      actualSampleCount: 1,
      recentPreviewCount: 1,
      latestTrainedAt: '2026-05-11T08:45:00.000Z',
      recentAverageQualityScore: 82.4,
      recentRuns: [
        {
          id: 'training-1',
          taskId: 'task-cruise-roll-blackbox-identification',
          taskTitle: '邮轮黑箱辨识与闭环控制挑战',
          scenarioId: 'cruise-roll-controller-preview',
          simulationRunId: 'canonical-run-1',
          qualityScore: 82.4,
          preview: true,
          officialEligible: false,
          trainedAt: '2026-05-11T08:45:00.000Z',
        },
      ],
    });
  });

  it('returns an empty portfolio without inventing controller or leaderboard data', () => {
    const portfolio = buildArenaStudentPortfolio([], targetUserId);

    expect(portfolio).toMatchObject({
      userId: targetUserId,
      controllerCount: 0,
      methodDistribution: [],
      identificationModels: [],
      submissionSummary: {
        total: 0,
        valid: 0,
        invalid: 0,
      },
      recentSubmissions: [],
      personalBestByTask: [],
      frequentFailureObjects: [],
      improvingMetrics: [],
      trainingSummary: {
        total: 0,
        recentWindowSize: 5,
        actualSampleCount: 0,
        recentPreviewCount: 0,
        recentAverageQualityScore: null,
        recentRuns: [],
      },
    });
    expect(portfolio.growth).toMatchObject({
      evidenceAvailable: false,
      capabilityCoverage: {
        covered: 0,
      },
      weakCapabilities: [],
      improvingCapabilities: [],
      strongCapabilities: [],
    });
    expect(portfolio.growth.nextChallenges.length).toBeGreaterThan(0);
    expect(portfolio.growth.nextChallenges.every((item) => item.evidenceLevel === 'beginner-safe')).toBe(true);
    expect(portfolio.growth.nextChallenges[0].reason).toContain('暂无官方 Arena 提交证据');
  });
});
