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
    expect(routeSource).toContain('buildArenaStudentPortfolio(arenaPortfolioSubmissions, userId)');
    expect(routeSource).toContain('arenaPortfolio:');
    expect(pageSource).toContain('arenaPortfolio');
    expect(pageSource).toContain('竞技场画像');
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
    });
  });
});
