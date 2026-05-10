import { describe, expect, it } from 'vitest';

import { buildArenaTeachingAnalytics } from '../analytics';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';

type SubmissionOverrides = Omit<Partial<ArenaSubmissionRecord>, 'artifact' | 'evaluation'> & {
  artifact?: Partial<ArenaSubmissionRecord['artifact']>;
  evaluation?: Partial<ArenaSubmissionRecord['evaluation']>;
};

function submission(overrides: SubmissionOverrides): ArenaSubmissionRecord {
  const base: ArenaSubmissionRecord = {
    id: 'submission-base',
    taskId: 'task-second-order-lead-pid',
    userId: 'student-base',
    studentLabel: '学生',
    artifactHash: 'artifact-hash',
    artifact: {
      id: 'artifact-base',
      taskId: 'task-second-order-lead-pid',
      method: 'pid',
      params: { kp: 1, ki: 0.1, kd: 0.02 },
      createdAt: '2026-05-10T10:00:00.000Z',
    },
    evaluation: {
      taskId: 'task-second-order-lead-pid',
      artifact: {
        id: 'artifact-base',
        taskId: 'task-second-order-lead-pid',
        method: 'pid',
        params: { kp: 1, ki: 0.1, kd: 0.02 },
        createdAt: '2026-05-10T10:00:00.000Z',
      },
      valid: true,
      score: 72,
      metrics: {
        settlingTime: 3.2,
        controlEnergy: 8,
        steadyStateError: 0.04,
        identificationFit: 0.9,
      },
      satisfaction: {
        settlingTime: 0.74,
        controlEnergy: 0.68,
        steadyStateError: 0.7,
      },
      hardConstraintResults: [
        { id: 'closed_loop_stable', label: '闭环稳定', passed: true },
      ],
      penalties: [],
      explanation: [],
    },
    submittedAt: '2026-05-10T10:00:00.000Z',
    reusedEvaluation: false,
  };

  return {
    ...base,
    ...overrides,
    artifact: { ...base.artifact, ...overrides.artifact },
    evaluation: { ...base.evaluation, ...overrides.evaluation },
  };
}

describe('arena telemetry analytics', () => {
  it('derives compact teaching-analysis signals from real submission records', () => {
    const failed = submission({
      id: 'submission-failed',
      userId: 'student-a',
      studentLabel: '学生甲',
      evaluation: {
        valid: false,
        score: 18,
        hardConstraintResults: [
          { id: 'closed_loop_stable', label: '闭环稳定', passed: false },
        ],
      },
      submittedAt: '2026-05-10T10:00:00.000Z',
    });
    const improved = submission({
      id: 'submission-improved',
      userId: 'student-a',
      studentLabel: '学生甲',
      evaluation: {
        valid: true,
        score: 88,
        satisfaction: {
          settlingTime: 0.92,
          controlEnergy: 0.34,
          steadyStateError: 0.86,
        },
      },
      submittedAt: '2026-05-10T10:12:00.000Z',
    });
    const weakBlackBox = submission({
      id: 'submission-blackbox',
      taskId: 'task-cruise-roll-blackbox',
      userId: 'student-b',
      studentLabel: '学生乙',
      artifact: {
        taskId: 'task-cruise-roll-blackbox',
        method: 'black-box-control',
        params: {
          identificationQuality: 0.42,
        },
      },
      evaluation: {
        valid: true,
        score: 61,
        metrics: {
          identificationFit: 0.42,
          settlingTime: 4.8,
          controlEnergy: 11,
        },
        satisfaction: {
          settlingTime: 0.45,
          controlEnergy: 0.53,
        },
      },
    });
    const blindTuningA = submission({
      id: 'submission-blind-a',
      userId: 'student-c',
      studentLabel: '学生丙',
      artifact: { params: { tuningRunCount: 24 } },
      evaluation: { score: 63 },
      submittedAt: '2026-05-10T10:00:00.000Z',
    });
    const blindTuningB = submission({
      id: 'submission-blind-b',
      userId: 'student-c',
      studentLabel: '学生丙',
      artifact: { params: { tuningRunCount: 27 } },
      evaluation: { score: 64 },
      submittedAt: '2026-05-10T10:08:00.000Z',
    });

    const analytics = buildArenaTeachingAnalytics([
      failed,
      improved,
      weakBlackBox,
      blindTuningA,
      blindTuningB,
    ]);

    expect(analytics.submissionCount).toBe(5);
    expect(analytics.stability.unstableSubmissionIds).toEqual(['submission-failed']);
    expect(analytics.weakMetrics.map((metric) => metric.metricId)).toContain('settlingTime');
    expect(analytics.tradeoffBias.speedOverEnergyStudentLabels).toEqual(['学生甲']);
    expect(analytics.identification.weakBlackBoxStudentLabels).toEqual(['学生乙']);
    expect(analytics.iterationImprovement.improvedToValidStudentLabels).toEqual(['学生甲']);
    expect(analytics.blindTuning.suspectedStudentLabels).toEqual(['学生丙']);
  });

  it('does not classify a stable submission as unstable when another hard constraint fails', () => {
    const saturated = submission({
      id: 'submission-saturated',
      evaluation: {
        valid: false,
        hardConstraintResults: [
          { id: 'closed_loop_stable', label: '闭环稳定', passed: true },
          { id: 'control_not_saturated', label: '控制量未严重饱和', passed: false },
        ],
      },
    });

    const analytics = buildArenaTeachingAnalytics([saturated]);

    expect(analytics.stability.unstableSubmissionIds).toEqual([]);
  });
});
