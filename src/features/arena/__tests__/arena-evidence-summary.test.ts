import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildArenaClassEvidenceSummary,
  buildArenaStudentEvidenceSummary,
} from '../evidence-summary';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { ControllerArtifact, ControllerMethod } from '../types';

function artifact(input: {
  id: string;
  taskId?: string;
  method?: ControllerMethod;
}): ControllerArtifact {
  return {
    id: input.id,
    taskId: input.taskId ?? 'task-evidence',
    method: input.method ?? 'pid',
    params: { kp: 2.4, ki: 0.8, kd: 0.35 },
    createdAt: '2026-05-16T08:00:00.000Z',
  };
}

function submission(input: {
  id: string;
  taskId?: string;
  userId: string;
  classId?: string;
  publicationId?: string;
  method?: ControllerMethod;
  score: number;
  valid: boolean;
  submittedAt: string;
  satisfaction?: Record<string, number>;
  hardConstraintResults?: Array<{ id: string; label: string; passed: boolean }>;
}): ArenaSubmissionRecord {
  const currentArtifact = artifact({ id: `artifact-${input.id}`, taskId: input.taskId, method: input.method });

  return {
    id: input.id,
    taskId: input.taskId ?? 'task-evidence',
    userId: input.userId,
    classId: input.classId ?? 'class-a',
    publicationId: input.publicationId ?? 'publication-a',
    studentLabel: input.userId,
    artifactHash: `hash-${input.id}`,
    artifact: currentArtifact,
    evaluation: {
      taskId: input.taskId ?? 'task-evidence',
      artifact: currentArtifact,
      valid: input.valid,
      score: input.score,
      metrics: { settlingTime: 3.2, overshoot: 8, steadyStateError: 0.02, controlEnergy: 5 },
      satisfaction: input.satisfaction ?? {
        settlingTime: 0.7,
        overshoot: 0.8,
        steadyStateError: 0.9,
        controlEnergy: 0.65,
      },
      hardConstraintResults: input.hardConstraintResults ?? [
        { id: 'closed_loop_stable', label: '闭环稳定', passed: input.valid },
      ],
      penalties: [],
      explanation: [],
    },
    submittedAt: input.submittedAt,
    reusedEvaluation: false,
  };
}

describe('arena evidence summaries', () => {
  it('builds student Arena summary from official submissions and LearningFact Arena context', () => {
    const summary = buildArenaStudentEvidenceSummary({
      userId: 'student-a',
      submissions: [
        submission({
          id: 'early',
          userId: 'student-a',
          score: 52,
          valid: false,
          submittedAt: '2026-05-16T08:00:00.000Z',
          satisfaction: { settlingTime: 0.35, overshoot: 0.6, steadyStateError: 0.4, controlEnergy: 0.45 },
        }),
        submission({
          id: 'best',
          userId: 'student-a',
          score: 86,
          valid: true,
          submittedAt: '2026-05-16T08:20:00.000Z',
          satisfaction: { settlingTime: 0.82, overshoot: 0.78, steadyStateError: 0.91, controlEnergy: 0.68 },
        }),
        submission({
          id: 'blackbox',
          taskId: 'task-blackbox',
          userId: 'student-a',
          method: 'black-box-control',
          score: 73,
          valid: true,
          submittedAt: '2026-05-16T08:40:00.000Z',
          satisfaction: { trackingError: 0.8, controlEnergy: 0.42, smoothness: 0.58, safetyMargin: 0.88 },
        }),
        submission({
          id: 'other-student',
          userId: 'student-b',
          score: 99,
          valid: true,
          submittedAt: '2026-05-16T09:00:00.000Z',
        }),
      ],
      learningFacts: [
        {
          factType: 'design',
          moduleId: 'task-evidence',
          outcome: 'success',
          score: 0.86,
          contextJson: { arena: { taskId: 'task-evidence', valid: true } },
        },
      ],
    });

    expect(summary).toMatchObject({
      submissionCount: 3,
      bestScore: 86,
      validSubmissionRate: 2 / 3,
      methodPreference: 'pid',
      improvementCount: 1,
      learningFactContextCount: 1,
    });
    expect(summary.recentChallenges.map((item) => item.taskId)).toEqual(['task-blackbox', 'task-evidence']);
    expect(summary.weakMetrics.map((item) => item.metricId)).toEqual(['controlEnergy', 'smoothness']);
  });

  it('builds class Arena summary without leaking submissions from another class', () => {
    const summary = buildArenaClassEvidenceSummary({
      classId: 'class-a',
      expectedStudentCount: 3,
      submissions: [
        submission({
          id: 'valid-a',
          userId: 'student-a',
          score: 88,
          valid: true,
          submittedAt: '2026-05-16T08:00:00.000Z',
        }),
        submission({
          id: 'invalid-b',
          userId: 'student-b',
          score: 35,
          valid: false,
          submittedAt: '2026-05-16T08:10:00.000Z',
          satisfaction: { settlingTime: 0.25, steadyStateError: 0.2 },
          hardConstraintResults: [{ id: 'closed_loop_stable', label: '闭环稳定', passed: false }],
        }),
        submission({
          id: 'other-class',
          userId: 'student-x',
          classId: 'class-b',
          score: 100,
          valid: true,
          submittedAt: '2026-05-16T08:20:00.000Z',
        }),
      ],
      learningFacts: [
        {
          factType: 'design',
          moduleId: 'task-evidence',
          outcome: 'partial',
          score: 0.35,
          contextJson: { arena: { classId: 'class-a', publicationId: 'publication-a' } },
        },
      ],
    });

    expect(summary).toMatchObject({
      submissionCount: 2,
      participantCount: 2,
      taskAchievementRate: 1 / 3,
      averageScore: 61.5,
      nonSubmissionCount: 1,
      learningFactContextCount: 1,
    });
    expect(summary.methodDistribution).toEqual({ pid: 2 });
    expect(summary.hardConstraintFailureDistribution).toEqual([
      { id: 'closed_loop_stable', label: '闭环稳定', count: 1 },
    ]);
    expect(summary.weakMetricDistribution.map((item) => item.metricId)).toEqual(['steadyStateError', 'settlingTime']);
  });
});

describe('arena evidence route integration', () => {
  it('wires teacher class insights to a nested Arena summary', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/api/teacher/classes/[classId]/insights/route.ts'),
      'utf8',
    );

    expect(source).toContain('buildArenaClassEvidenceSummary');
    expect(source).toContain('prismaArenaSubmissionStore.listSubmissions({ classId })');
    expect(source).toContain('contextJson: true');
    expect(source).toContain('arena: buildArenaClassEvidenceSummary');
  });
});
