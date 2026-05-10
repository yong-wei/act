import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ARENA_CHALLENGE_TEMPLATES,
  createArenaChallengePublication,
  deriveArenaHomeworkAssessment,
  getArenaChallengeTemplate,
  resolvePublishedArenaTasksForStudent,
} from '../teacher/configuration';

describe('arena teacher configuration', () => {
  it('publishes an existing challenge to a class scope with visibility and deadline', () => {
    const publication = createArenaChallengePublication({
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-2026-control',
      visibility: 'class',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
    });

    expect(publication.taskId).toBe('task-integrator-low-frequency-balance');
    expect(publication.classId).toBe('class-2026-control');
    expect(publication.studentVisibility).toBe('class');
    expect(publication.homeworkBinding).toBe(true);
  });

  it('resolves student-visible publications without exposing other class tasks', () => {
    const ownClass = createArenaChallengePublication({
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-a',
      visibility: 'class',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
    });
    const otherClass = createArenaChallengePublication({
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-b',
      visibility: 'class',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: false,
    });

    expect(resolvePublishedArenaTasksForStudent([ownClass, otherClass], 'class-a').map((item) => item.taskId)).toEqual([
      'task-integrator-low-frequency-balance',
    ]);
  });

  it('separates homework assessment from leaderboard rank', () => {
    const assessment = deriveArenaHomeworkAssessment({
      validSubmission: true,
      score: 86.4,
      rank: 1,
      diagnosticWeakMetrics: ['controlEnergy'],
    });

    expect(assessment.gradeComponents.rankContribution).toBe(0);
    expect(assessment.gradeComponents.masteryScore).toBeGreaterThan(0);
    expect(assessment.summary).not.toContain('第 1 名即为成绩');
  });

  it('rejects incompatible leaderboard policies, visibility, and homework bindings', () => {
    expect(() => createArenaChallengePublication({
      taskId: 'task-second-order-lead-pid',
      classId: 'class-2026-control',
      visibility: 'class',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
    })).toThrow(/not configured/);

    expect(() => createArenaChallengePublication({
      taskId: 'task-ship-roll-comfort',
      classId: 'class-2026-control',
      visibility: 'course',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-whitebox-default',
      homeworkBinding: true,
    })).toThrow(/not eligible/);

    expect(() => createArenaChallengePublication({
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-2026-control',
      visibility: 'course',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
    })).toThrow(/does not match/);
  });

  it('defines the required teacher challenge templates with full configuration payloads', () => {
    expect(ARENA_CHALLENGE_TEMPLATES.map((template) => template.id)).toEqual([
      'template-serial-compensation-basic',
      'template-pid-tuning',
      'template-composite-compensation',
      'template-blackbox-identification-control',
      'template-virtual-simulation-closed-loop',
      'template-mpc-constrained-control',
    ]);

    for (const template of ARENA_CHALLENGE_TEMPLATES) {
      expect(template.targetSignal).toBeTruthy();
      expect(template.disturbance).toBeTruthy();
      expect(template.initialCondition).toBeTruthy();
      expect(template.allowedMethods.length).toBeGreaterThan(0);
      expect(template.hardConstraints.length).toBeGreaterThan(0);
      expect(Object.keys(template.scoringMetricWeights).length).toBeGreaterThan(0);
      expect(['L0', 'L1', 'L2', 'L3']).toContain(template.telemetryLevel);
      expect(typeof template.paretoEnabled).toBe('boolean');
      expect(typeof template.hiddenTestEnabled).toBe('boolean');
      expect(typeof template.gradeBinding).toBe('boolean');
      expect(typeof template.publicLeaderboard).toBe('boolean');
    }
  });

  it('applies template configuration to publication previews and rejects task mismatches', () => {
    const pidTemplate = getArenaChallengeTemplate('template-pid-tuning');
    expect(pidTemplate?.defaultTaskId).toBe('task-integrator-low-frequency-balance');

    const publication = createArenaChallengePublication({
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-2026-control',
      visibility: 'class',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
      templateId: 'template-pid-tuning',
    });

    expect(publication).toMatchObject({
      templateId: 'template-pid-tuning',
      targetSignal: pidTemplate?.targetSignal,
      disturbance: pidTemplate?.disturbance,
      initialCondition: pidTemplate?.initialCondition,
      telemetryLevel: pidTemplate?.telemetryLevel,
      paretoEnabled: pidTemplate?.paretoEnabled,
      hiddenTestEnabled: pidTemplate?.hiddenTestEnabled,
    });
    expect(publication.allowedMethods).toEqual(['pid']);
    expect(publication.scoringMetricWeights.steadyStateError).toBeGreaterThan(0);

    const notGraded = createArenaChallengePublication({
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-2026-control',
      visibility: 'class',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: false,
      templateId: 'template-pid-tuning',
    });
    expect(notGraded.homeworkBinding).toBe(false);
    expect(notGraded.gradeBinding).toBe(false);

    expect(() => createArenaChallengePublication({
      taskId: 'task-second-order-lead-pid',
      classId: 'class-2026-control',
      visibility: 'course',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-whitebox-default',
      homeworkBinding: false,
      templateId: 'template-pid-tuning',
    })).toThrow(/does not match template/);

    expect(() => createArenaChallengePublication({
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-2026-control',
      visibility: 'class',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
      templateId: 'template-pid-tuning',
      paretoEnabled: true,
    })).toThrow(/Pareto/);

    expect(() => createArenaChallengePublication({
      taskId: 'task-integrator-low-frequency-balance',
      classId: 'class-2026-control',
      visibility: 'class',
      deadline: '2026-06-01T15:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
      templateId: 'template-pid-tuning',
      publicLeaderboard: true,
    })).toThrow(/public leaderboard/);
  });

  it('wires teacher templates into the preview API and teacher configuration UI', () => {
    const routeSource = readFileSync(
      join(process.cwd(), 'src/app/api/teacher/arena/preview/route.ts'),
      'utf8',
    );
    const uiSource = readFileSync(
      join(process.cwd(), 'src/features/arena/teacher/teacher-arena-config.tsx'),
      'utf8',
    );

    expect(routeSource).toContain('templateId:');
    expect(routeSource).toContain('targetSignal:');
    expect(routeSource).toContain('parseScoringMetricWeights');
    expect(uiSource).toContain('ARENA_CHALLENGE_TEMPLATES');
    expect(uiSource).toContain('setTemplateId');
    expect(uiSource).toContain('setTargetSignal');
    expect(uiSource).toContain('setScoringMetricWeightsText');
    expect(uiSource).toContain('目标信号');
    expect(uiSource).toContain('埋点级别');
  });
});
