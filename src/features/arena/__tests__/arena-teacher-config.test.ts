import { describe, expect, it } from 'vitest';

import {
  createArenaChallengePublication,
  deriveArenaHomeworkAssessment,
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
});
