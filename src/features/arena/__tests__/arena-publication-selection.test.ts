import { describe, expect, it } from 'vitest';

import { selectArenaHallCurrentPublication, selectArenaHallPublicationForTask } from '../arena-publication-selection';
import type { ArenaPublicationRecord } from '../teacher/publication-store';

const beforeDeadlines = new Date('2026-05-15T10:00:00.000Z');
const afterFirstDeadline = new Date('2026-06-02T10:00:00.000Z');

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

    expect(selectArenaHallPublicationForTask([course, assigned], 'task-second-order-lead-pid', beforeDeadlines)?.id)
      .toBe('publication-class-homework');
  });

  it('selects the current hall publication by assignment priority before deadline order', () => {
    const earlierCourse = publication({
      id: 'publication-earlier-course',
      visibility: 'course',
      studentVisibility: 'course',
      taskId: 'task-second-order-lead-pid',
      deadline: '2026-06-01T15:00:00.000Z',
    });
    const laterClassHomework = publication({
      id: 'publication-later-class-homework',
      visibility: 'class',
      studentVisibility: 'class',
      taskId: 'task-cruise-roll-comfort',
      homeworkBinding: true,
      deadline: '2026-06-05T15:00:00.000Z',
    });

    expect(selectArenaHallCurrentPublication([earlierCourse, laterClassHomework], beforeDeadlines)?.id)
      .toBe('publication-later-class-homework');
  });

  it('keeps report-ready expired publications from replacing an active challenge entry', () => {
    const expiredClassHomework = publication({
      id: 'publication-expired-class-homework',
      visibility: 'class',
      studentVisibility: 'class',
      homeworkBinding: true,
      deadline: '2026-06-01T15:00:00.000Z',
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
    });
    const activeCourse = publication({
      id: 'publication-active-course',
      visibility: 'course',
      studentVisibility: 'course',
      deadline: '2026-06-05T15:00:00.000Z',
    });

    expect(selectArenaHallCurrentPublication([expiredClassHomework, activeCourse], afterFirstDeadline)?.id)
      .toBe('publication-active-course');
    expect(selectArenaHallPublicationForTask(
      [expiredClassHomework, activeCourse],
      'task-second-order-lead-pid',
      afterFirstDeadline,
    )?.id).toBe('publication-active-course');
  });

  it('keeps late-submission publications ahead of report-only expired publications', () => {
    const expiredReportOnly = publication({
      id: 'publication-expired-report-only',
      visibility: 'class',
      studentVisibility: 'class',
      homeworkBinding: true,
      deadline: '2026-06-01T15:00:00.000Z',
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
    });
    const lateOnly = publication({
      id: 'publication-late-only',
      visibility: 'course',
      studentVisibility: 'course',
      deadline: '2026-06-01T15:00:00.000Z',
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: true, allowLateSubmissions: true },
    });

    expect(selectArenaHallCurrentPublication([expiredReportOnly, lateOnly], afterFirstDeadline)?.id)
      .toBe('publication-late-only');
  });
});
