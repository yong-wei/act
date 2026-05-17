import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildArenaSubmissionFeedback } from '../student/arena-feedback-rules';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { ControllerArtifact, ControllerMethod } from '../types';

function artifact(input: {
  id: string;
  method?: ControllerMethod;
  params?: Record<string, number | string | boolean>;
}): ControllerArtifact {
  return {
    id: input.id,
    taskId: 'task-feedback',
    method: input.method ?? 'pid',
    params: input.params ?? { kp: 2.4, ki: 0.8, kd: 0.35 },
    createdAt: '2026-05-16T08:00:00.000Z',
  };
}

function submission(input: {
  id: string;
  score: number;
  valid: boolean;
  submittedAt: string;
  method?: ControllerMethod;
  satisfaction?: Record<string, number>;
  metrics?: Record<string, number>;
  hardConstraintResults?: Array<{ id: string; label: string; passed: boolean; reason?: string }>;
  params?: Record<string, number | string | boolean>;
  metadata?: Record<string, unknown>;
}): ArenaSubmissionRecord {
  const currentArtifact = artifact({ id: `artifact-${input.id}`, method: input.method, params: input.params });

  return {
    id: input.id,
    taskId: 'task-feedback',
    userId: 'student-a',
    studentLabel: '学生甲',
    artifactHash: `hash-${input.id}`,
    artifact: currentArtifact,
    evaluation: {
      taskId: 'task-feedback',
      artifact: currentArtifact,
      valid: input.valid,
      score: input.score,
      metrics: input.metrics ?? {
        settlingTime: 2.8,
        overshoot: 6,
        steadyStateError: 0.02,
        controlEnergy: 5,
      },
      satisfaction: input.satisfaction ?? {
        settlingTime: 0.86,
        overshoot: 0.78,
        steadyStateError: 0.92,
        controlEnergy: 0.63,
      },
      hardConstraintResults: input.hardConstraintResults ?? [
        { id: 'closed_loop_stable', label: '闭环稳定', passed: input.valid },
      ],
      penalties: [],
      explanation: ['官方评测完成'],
      metadata: input.metadata,
    },
    submittedAt: input.submittedAt,
    reusedEvaluation: false,
  };
}

describe('arena student diagnostic feedback rules', () => {
  it('explains a valid ranked official submission with strongest and weakest metrics', () => {
    const feedback = buildArenaSubmissionFeedback({
      latest: submission({ id: 'latest', score: 86, valid: true, submittedAt: '2026-05-16T08:20:00.000Z' }),
      mode: 'white-box',
    });

    expect(feedback.rankingStatus).toBe('ranked');
    expect(feedback.title).toContain('进入正式排名');
    expect(feedback.summary).toContain('86');
    expect(feedback.strongestMetric).toMatchObject({ metricId: 'steadyStateError', satisfaction: 0.92 });
    expect(feedback.weakestMetric).toMatchObject({ metricId: 'controlEnergy', satisfaction: 0.63 });
    expect(feedback.nextStepSuggestion).toContain('controlEnergy');
  });

  it('explains hard-constraint failures as not ranked with Chinese repair suggestions', () => {
    const feedback = buildArenaSubmissionFeedback({
      latest: submission({
        id: 'invalid',
        score: 35,
        valid: false,
        submittedAt: '2026-05-16T08:20:00.000Z',
        hardConstraintResults: [
          { id: 'closed_loop_stable', label: '闭环稳定', passed: false, reason: '闭环极点位于右半平面' },
          { id: 'finite_response', label: '响应有界', passed: false },
        ],
      }),
      mode: 'white-box',
    });

    expect(feedback.rankingStatus).toBe('not_ranked');
    expect(feedback.title).toContain('未进入正式排名');
    expect(feedback.hardConstraintFailures).toEqual(['闭环稳定：闭环极点位于右半平面', '响应有界']);
    expect(feedback.nextStepSuggestion).toContain('先修复硬约束');
  });

  it('compares the latest submission with the previous personal best', () => {
    const previousBest = submission({
      id: 'previous-best',
      score: 70,
      valid: true,
      submittedAt: '2026-05-16T08:00:00.000Z',
      satisfaction: { settlingTime: 0.7, overshoot: 0.7, steadyStateError: 0.8, controlEnergy: 0.75 },
    });
    const improved = buildArenaSubmissionFeedback({
      latest: submission({ id: 'improved', score: 83.5, valid: true, submittedAt: '2026-05-16T08:20:00.000Z' }),
      previousSubmissions: [previousBest],
      mode: 'white-box',
    });
    const regressed = buildArenaSubmissionFeedback({
      latest: submission({
        id: 'regressed',
        score: 61,
        valid: true,
        submittedAt: '2026-05-16T08:30:00.000Z',
        satisfaction: { settlingTime: 0.6, overshoot: 0.55, steadyStateError: 0.78, controlEnergy: 0.7 },
      }),
      previousSubmissions: [previousBest],
      mode: 'white-box',
    });

    expect(improved.personalBestComparison).toEqual({ state: 'improved', delta: 13.5, previousBestScore: 70 });
    expect(improved.summary).toContain('提升 13.5 分');
    expect(regressed.personalBestComparison).toEqual({ state: 'regressed', delta: -9, previousBestScore: 70 });
    expect(regressed.nextStepSuggestion).toContain('overshoot');
  });

  it('keeps personal-best regression metric scoped to the same student', () => {
    const sameStudentBest = submission({
      id: 'same-student-best',
      score: 70,
      valid: true,
      submittedAt: '2026-05-16T08:00:00.000Z',
      satisfaction: { settlingTime: 0.7, overshoot: 0.7, steadyStateError: 0.8, controlEnergy: 0.75 },
    });
    const otherStudentBest = {
      ...submission({
        id: 'other-student-best',
        score: 95,
        valid: true,
        submittedAt: '2026-05-16T08:05:00.000Z',
        satisfaction: { settlingTime: 0.9, overshoot: 0.99, steadyStateError: 0.9, controlEnergy: 0.9 },
      }),
      userId: 'student-b',
      studentLabel: '学生乙',
    };

    const feedback = buildArenaSubmissionFeedback({
      latest: submission({
        id: 'regressed',
        score: 61,
        valid: true,
        submittedAt: '2026-05-16T08:30:00.000Z',
        satisfaction: { settlingTime: 0.6, overshoot: 0.55, steadyStateError: 0.78, controlEnergy: 0.7 },
      }),
      previousSubmissions: [sameStudentBest, otherStudentBest],
      mode: 'white-box',
    });

    expect(feedback.personalBestComparison).toEqual({ state: 'regressed', delta: -9, previousBestScore: 70 });
    expect(feedback.nextStepSuggestion).toContain('overshoot');
    expect(feedback.nextStepSuggestion).not.toContain('controlEnergy');
  });

  it('flags energy-heavy submissions without exposing hidden black-box scenario details', () => {
    const feedback = buildArenaSubmissionFeedback({
      latest: submission({
        id: 'blackbox',
        score: 78,
        valid: true,
        method: 'black-box-control',
        submittedAt: '2026-05-16T08:20:00.000Z',
        satisfaction: { trackingError: 0.82, controlEnergy: 0.32, smoothness: 0.55, safetyMargin: 0.88 },
        metadata: {
          hiddenScenarioOrder: ['head-sea-2', 'beam-sea-4'],
          hiddenTrace: [{ t: 0, y: 1.2 }],
          scenarioParameter: 'do-not-leak',
        },
      }),
      mode: 'black-box',
    });

    expect(feedback.issueTags).toContain('energy-heavy');
    expect(feedback.nextStepSuggestion).toContain('能耗');
    expect(feedback.privacyNote).toContain('隐藏场景');
    expect(JSON.stringify(feedback)).not.toContain('head-sea-2');
    expect(JSON.stringify(feedback)).not.toContain('do-not-leak');
    expect(JSON.stringify(feedback)).not.toContain('hiddenTrace');
  });
});

describe('arena personal feedback component', () => {
  it('renders shared feedback rules through a reusable student component', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/arena/student/arena-personal-feedback.tsx'),
      'utf8',
    );

    expect(source).toContain('export function ArenaPersonalFeedback');
    expect(source).toContain('buildArenaSubmissionFeedback');
    expect(source).toContain('feedback.title');
    expect(source).toContain('feedback.nextStepSuggestion');
    expect(source).toContain('feedback.hardConstraintFailures');
    expect(source).toContain('feedback.privacyNote');
  });

  it('uses the shared feedback component in the white-box submission panel', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/arena/submissions/arena-submission-panel.tsx'),
      'utf8',
    );

    expect(source).toContain("import { ArenaPersonalFeedback } from '../student/arena-personal-feedback'");
    expect(source).toContain('viewerUserId');
    expect(source).toContain('submissions.filter((submission) => submission.userId === viewerUserId)');
    expect(source).toContain('previousSubmissions={personalSubmissions.slice(0, -1)}');
    expect(source).toContain('mode="white-box"');
  });

  it('uses the shared feedback component in the black-box submission panel', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/control-workbench/presets/blackbox-identification-preset.tsx'),
      'utf8',
    );

    expect(source).toContain("import { ArenaPersonalFeedback } from '@/features/arena/student/arena-personal-feedback'");
    expect(source).toContain('viewerUserId');
    expect(source).toContain('submissions.filter((submission) => submission.userId === viewerUserId)');
    expect(source).toContain('previousSubmissions={personalSubmissions.slice(0, -1)}');
    expect(source).toContain('mode="black-box"');
  });

  it('passes viewer identity from Arena submission entry points to personal feedback panels', () => {
    const apiSource = readFileSync(
      join(process.cwd(), 'src/app/api/arena/submissions/route.ts'),
      'utf8',
    );
    const mountSource = readFileSync(
      join(process.cwd(), 'src/features/arena/workbench/arena-workbench-submission-mount.tsx'),
      'utf8',
    );
    const cruiseSource = readFileSync(
      join(process.cwd(), 'src/app/simulations/cruise/page.tsx'),
      'utf8',
    );

    expect(apiSource).toContain('const session = await getServerAuthSession()');
    expect(apiSource).toContain('viewerUserId: session?.user?.id');
    expect(mountSource).toContain('viewerUserId?: string');
    expect(mountSource).toContain('setViewerUserId');
    expect(mountSource).toContain('viewerUserId={viewerUserId}');
    expect(cruiseSource).toContain('viewerUserId={session?.user?.id}');
  });
});
