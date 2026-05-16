import { describe, expect, it } from 'vitest';

import { selectArenaHallPublicationForTask } from '../arena-publication-selection';
import type { ArenaPublicationRecord } from '../teacher/publication-store';

function publication(overrides: Partial<ArenaPublicationRecord>): ArenaPublicationRecord {
  return {
    id: 'publication-course',
    taskId: 'task-second-order-lead-pid',
    classId: 'class-a',
    teacherId: 'teacher-a',
    visibility: 'course',
    studentVisibility: 'course',
    status: 'active',
    deadline: '2026-06-01T15:00:00.000Z',
    leaderboardPolicyId: 'leaderboard-whitebox-default',
    homeworkBinding: false,
    gradingPolicy: {},
    createdAt: '2026-05-15T10:00:00.000Z',
    updatedAt: '2026-05-15T10:00:00.000Z',
    targetSignal: '单位阶跃参考输入',
    disturbance: '无外加扰动',
    initialCondition: '零初始状态',
    allowedMethods: ['pid'],
    hardConstraints: [],
    scoringMetricWeights: {},
    paretoEnabled: false,
    hiddenTestEnabled: false,
    gradeBinding: false,
    publicLeaderboard: false,
    telemetryLevel: 'L0',
    ...overrides,
  };
}

describe('arena hall publication selection', () => {
  it('prefers class publications over course-wide publications for the same task', () => {
    const course = publication({ id: 'publication-course', visibility: 'course', studentVisibility: 'course' });
    const assigned = publication({
      id: 'publication-class-homework',
      visibility: 'class',
      studentVisibility: 'class',
      classId: 'class-b',
      homeworkBinding: true,
    });

    expect(selectArenaHallPublicationForTask([course, assigned], 'task-second-order-lead-pid')?.id)
      .toBe('publication-class-homework');
  });
});
