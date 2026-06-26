import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildArenaPublicationReport } from '../teacher/publication-report';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { loadArenaPublicationReportForActor } from '../teacher/publication-store';
import type { ControllerArtifact, ControllerMethod } from '../types';

function artifact(input: {
  id: string;
  taskId?: string;
  method?: ControllerMethod;
  params?: Record<string, number | string | boolean>;
}): ControllerArtifact {
  return {
    id: input.id,
    taskId: input.taskId ?? 'task-report',
    method: input.method ?? 'pid',
    params: input.params ?? { kp: 2.4, ki: 0.8, kd: 0.35 },
    createdAt: '2026-05-16T08:00:00.000Z',
  };
}

function submission(input: {
  id: string;
  userId: string;
  studentLabel: string;
  score: number;
  valid: boolean;
  submittedAt: string;
  method?: ControllerMethod;
  publicationId?: string;
  classId?: string | null;
  isLate?: boolean;
  satisfaction?: Record<string, number>;
  metrics?: Record<string, number>;
  hardConstraintResults?: Array<{ id: string; label: string; passed: boolean; value?: number; threshold?: number }>;
}): ArenaSubmissionRecord {
  const currentArtifact = artifact({ id: `artifact-${input.id}`, method: input.method });

  return {
    id: input.id,
    taskId: 'task-report',
    userId: input.userId,
    classId: input.classId === null ? undefined : input.classId ?? 'class-a',
    publicationId: input.publicationId ?? 'publication-a',
    isLate: input.isLate,
    studentLabel: input.studentLabel,
    artifactHash: `hash-${input.id}`,
    artifact: currentArtifact,
    evaluation: {
      taskId: 'task-report',
      artifact: currentArtifact,
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

describe('arena publication report analytics', () => {
  it('aggregates official publication submissions without leaking outside publication or class rows', () => {
    const report = buildArenaPublicationReport({
      publication: {
        id: 'publication-a',
        taskId: 'task-report',
        classId: 'class-a',
        deadline: '2026-06-01T08:00:00.000Z',
        visibility: 'class',
        leaderboardPolicyId: 'leaderboard-class-homework',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
      roster: [
        { userId: 'student-a', studentLabel: '学生甲' },
        { userId: 'student-b', studentLabel: '学生乙' },
        { userId: 'student-c', studentLabel: '学生丙' },
      ],
      submissions: [
        submission({
          id: 'a-early',
          userId: 'student-a',
          studentLabel: '学生甲',
          score: 54,
          valid: false,
          submittedAt: '2026-05-16T08:00:00.000Z',
          satisfaction: { settlingTime: 0.3, overshoot: 0.7, steadyStateError: 0.35, controlEnergy: 0.4 },
          hardConstraintResults: [
            { id: 'closed_loop_stable', label: '闭环稳定', passed: false },
            { id: 'overshoot_limit', label: '超调量约束', passed: true },
          ],
        }),
        submission({
          id: 'a-best',
          userId: 'student-a',
          studentLabel: '学生甲',
          score: 84,
          valid: true,
          submittedAt: '2026-05-16T08:20:00.000Z',
          satisfaction: { settlingTime: 0.82, overshoot: 0.76, steadyStateError: 0.9, controlEnergy: 0.68 },
        }),
        submission({
          id: 'b-blackbox',
          userId: 'student-b',
          studentLabel: '学生乙',
          score: 92,
          valid: true,
          method: 'black-box-control',
          submittedAt: '2026-05-16T08:15:00.000Z',
          satisfaction: { trackingError: 0.86, controlEnergy: 0.42, smoothness: 0.58, safetyMargin: 0.91 },
        }),
        submission({
          id: 'outside-publication',
          userId: 'student-d',
          studentLabel: '外部学生',
          score: 99,
          valid: true,
          publicationId: 'publication-b',
          submittedAt: '2026-05-16T08:10:00.000Z',
        }),
        submission({
          id: 'outside-class',
          userId: 'student-e',
          studentLabel: '外班学生',
          score: 12,
          valid: false,
          classId: 'class-b',
          submittedAt: '2026-05-16T08:25:00.000Z',
        }),
      ],
      excellentSolutionLimit: 2,
    });

    expect(report.participation).toEqual({
      expectedStudentCount: 3,
      participantCount: 2,
      nonSubmitterCount: 1,
      nonSubmitters: [{ userId: 'student-c', studentLabel: '学生丙' }],
    });
    expect(report.submissions).toMatchObject({
      submissionCount: 3,
      validSubmissionCount: 2,
      invalidSubmissionCount: 1,
      validSubmissionRate: 2 / 3,
    });
    expect(report.scores).toMatchObject({
      average: 88,
      median: 88,
      highest: 92,
    });
    expect(report.hardConstraintFailures).toEqual([
      { id: 'closed_loop_stable', label: '闭环稳定', count: 1 },
    ]);
    expect(report.weakMetrics).toEqual([
      { metricId: 'controlEnergy', affectedSubmissionCount: 2, lowestSatisfaction: 0.4 },
      { metricId: 'settlingTime', affectedSubmissionCount: 1, lowestSatisfaction: 0.3 },
      { metricId: 'steadyStateError', affectedSubmissionCount: 1, lowestSatisfaction: 0.35 },
      { metricId: 'smoothness', affectedSubmissionCount: 1, lowestSatisfaction: 0.58 },
    ]);
    expect(report.methodDistribution).toEqual([
      { method: 'black-box-control', count: 1 },
      { method: 'pid', count: 2 },
    ]);
    expect(report.personalBests).toEqual([
      expect.objectContaining({ userId: 'student-b', studentLabel: '学生乙', submissionId: 'b-blackbox', score: 92 }),
      expect.objectContaining({ userId: 'student-a', studentLabel: '学生甲', submissionId: 'a-best', score: 84 }),
    ]);
    expect(report.excellentSolutions).toEqual([
      expect.objectContaining({ studentLabel: '学生乙', submissionId: 'b-blackbox', score: 92 }),
      expect.objectContaining({ studentLabel: '学生甲', submissionId: 'a-best', score: 84 }),
    ]);
  });

  it('keeps publication context and roster-based non-submitters for an empty publication', () => {
    const report = buildArenaPublicationReport({
      publication: {
        id: 'publication-empty',
        taskId: 'task-report',
        classId: 'class-a',
        deadline: '2026-06-01T08:00:00.000Z',
        visibility: 'class',
        leaderboardPolicyId: 'leaderboard-class-homework',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
      roster: [
        { userId: 'student-a', studentLabel: '学生甲' },
        { userId: 'student-b', studentLabel: '学生乙' },
      ],
      submissions: [],
    });

    expect(report.publication).toMatchObject({
      id: 'publication-empty',
      taskId: 'task-report',
      classId: 'class-a',
      deadline: '2026-06-01T08:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
    });
    expect(report.participation).toEqual({
      expectedStudentCount: 2,
      participantCount: 0,
      nonSubmitterCount: 2,
      nonSubmitters: [
        { userId: 'student-a', studentLabel: '学生甲' },
        { userId: 'student-b', studentLabel: '学生乙' },
      ],
    });
    expect(report.submissions).toEqual({
      submissionCount: 0,
      validSubmissionCount: 0,
      invalidSubmissionCount: 0,
      validSubmissionRate: 0,
    });
    expect(report.scores).toEqual({ average: null, median: null, highest: null });
    expect(report.hardConstraintFailures).toEqual([]);
    expect(report.weakMetrics).toEqual([]);
    expect(report.methodDistribution).toEqual([]);
    expect(report.personalBests).toEqual([]);
    expect(report.excellentSolutions).toEqual([]);
  });

  it('keeps course-wide publication reports scoped to publication without class filtering', () => {
    const report = buildArenaPublicationReport({
      publication: {
        id: 'publication-course',
        taskId: 'task-report',
        classId: 'class-a',
        deadline: '2026-06-01T08:00:00.000Z',
        visibility: 'course',
        leaderboardPolicyId: 'leaderboard-course',
        gradingPolicy: {},
      },
      roster: [
        { userId: 'student-a', studentLabel: '学生甲' },
        { userId: 'student-owner-missing', studentLabel: '发布班级未提交学生' },
      ],
      submissions: [
        submission({
          id: 'owner-class',
          userId: 'student-a',
          studentLabel: '学生甲',
          score: 80,
          valid: true,
          publicationId: 'publication-course',
          submittedAt: '2026-05-16T08:00:00.000Z',
        }),
        submission({
          id: 'other-class',
          userId: 'student-b',
          studentLabel: '学生乙',
          score: 90,
          valid: true,
          publicationId: 'publication-course',
          classId: 'class-b',
          submittedAt: '2026-05-16T08:10:00.000Z',
        }),
        submission({
          id: 'no-class',
          userId: 'student-c',
          studentLabel: '学生丙',
          score: 70,
          valid: false,
          publicationId: 'publication-course',
          classId: null,
          submittedAt: '2026-05-16T08:20:00.000Z',
        }),
        submission({
          id: 'other-publication',
          userId: 'student-d',
          studentLabel: '学生丁',
          score: 100,
          valid: true,
          publicationId: 'publication-other',
          classId: 'class-b',
          submittedAt: '2026-05-16T08:30:00.000Z',
        }),
      ],
    });

    expect(report.participation.participantCount).toBe(3);
    expect(report.participation).toMatchObject({
      expectedStudentCount: 0,
      nonSubmitterCount: 0,
      nonSubmitters: [],
    });
    expect(report.submissions).toMatchObject({
      submissionCount: 3,
      validSubmissionCount: 2,
      invalidSubmissionCount: 1,
    });
    expect(report.scores).toEqual({ average: 85, median: 85, highest: 90 });
    expect(report.personalBests.map((best) => best.userId)).toEqual(['student-b', 'student-a', 'student-c']);
    expect(report.publicationContext.classTitle).toBe('课程范围');
  });

  it('keeps public publication reports scoped to publication and detached from class roster', () => {
    const report = buildArenaPublicationReport({
      publication: {
        id: 'publication-public',
        taskId: 'task-report',
        classId: 'class-a',
        deadline: '2026-06-01T08:00:00.000Z',
        visibility: 'public',
        leaderboardPolicyId: 'leaderboard-public',
        gradingPolicy: {},
      },
      roster: [
        { userId: 'student-a', studentLabel: '学生甲' },
      ],
      submissions: [
        submission({
          id: 'public-a',
          userId: 'student-a',
          studentLabel: '学生甲',
          score: 78,
          valid: true,
          publicationId: 'publication-public',
          classId: 'class-a',
          submittedAt: '2026-05-16T08:00:00.000Z',
        }),
        submission({
          id: 'public-b',
          userId: 'student-b',
          studentLabel: '学生乙',
          score: 88,
          valid: true,
          publicationId: 'publication-public',
          classId: 'class-b',
          submittedAt: '2026-05-16T08:10:00.000Z',
        }),
      ],
    });

    expect(report.participation).toMatchObject({
      expectedStudentCount: 0,
      participantCount: 2,
      nonSubmitterCount: 0,
      nonSubmitters: [],
    });
    expect(report.submissions.submissionCount).toBe(2);
    expect(report.scores).toEqual({ average: 83, median: 83, highest: 88 });
  });

  it('builds anonymized classroom review evidence without raw controller payloads', () => {
    const report = buildArenaPublicationReport({
      publication: {
        id: 'publication-a',
        taskId: 'task-report',
        classId: 'class-a',
        deadline: '2026-06-01T08:00:00.000Z',
        visibility: 'class',
        leaderboardPolicyId: 'leaderboard-class-homework',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
      roster: [
        { userId: 'student-a', studentLabel: '学生甲' },
        { userId: 'student-b', studentLabel: '学生乙' },
      ],
      submissions: [
        submission({
          id: 'a-failed',
          userId: 'student-a',
          studentLabel: '学生甲',
          score: 42,
          valid: false,
          submittedAt: '2026-05-16T08:00:00.000Z',
          satisfaction: { settlingTime: 0.2, overshoot: 0.5, controlEnergy: 0.3 },
          hardConstraintResults: [
            { id: 'closed_loop_stable', label: '闭环稳定', passed: false },
          ],
        }),
        submission({
          id: 'b-excellent',
          userId: 'student-b',
          studentLabel: '学生乙',
          score: 94,
          valid: true,
          method: 'serial-compensator',
          submittedAt: '2026-05-16T08:10:00.000Z',
        }),
      ],
      excellentSolutionLimit: 1,
    });

    expect(report.classroomReview.anonymizedByDefault).toBe(true);
    expect(report.classroomReview.typicalFailures.map((item) => item.label)).toEqual(expect.arrayContaining([
      '闭环稳定',
      'controlEnergy',
    ]));
    expect(report.classroomReview.methodPatterns).toEqual([
      { method: 'pid', count: 1, validCount: 0, averageScore: null },
      { method: 'serial-compensator', count: 1, validCount: 1, averageScore: 94 },
    ]);
    expect(report.classroomReview.showcaseCandidates).toEqual([
      expect.objectContaining({
        anonymousLabel: '匿名方案 1',
        submissionId: 'b-excellent',
        score: 94,
        method: 'serial-compensator',
      }),
    ]);
    const reviewText = JSON.stringify(report.classroomReview);
    expect(reviewText).not.toContain('学生乙');
    expect(reviewText).not.toContain('"kp"');
    expect(reviewText).not.toContain('"ki"');
    expect(reviewText).toContain('不展示原始控制器参数');
    expect(reviewText).toContain('排行榜名次只作为比较反馈');
  });

  it('explains effective attempts and excludes late or zero-score submissions from excellent solutions', () => {
    const report = buildArenaPublicationReport({
      publication: {
        id: 'publication-a',
        taskId: 'task-report',
        classId: 'class-a',
        deadline: '2026-06-01T08:00:00.000Z',
        visibility: 'class',
        leaderboardPolicyId: 'leaderboard-class-homework',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
      submissions: [
        submission({
          id: 'a-zero',
          userId: 'student-a',
          studentLabel: '学生甲',
          score: 0,
          valid: true,
          submittedAt: '2026-05-16T08:00:00.000Z',
        }),
        submission({
          id: 'a-effective',
          userId: 'student-a',
          studentLabel: '学生甲',
          score: 72,
          valid: true,
          submittedAt: '2026-05-16T08:10:00.000Z',
        }),
        submission({
          id: 'b-late-high',
          userId: 'student-b',
          studentLabel: '学生乙',
          score: 98,
          valid: true,
          isLate: true,
          submittedAt: '2026-06-02T08:00:00.000Z',
        }),
        submission({
          id: 'c-invalid-high',
          userId: 'student-c',
          studentLabel: '学生丙',
          score: 95,
          valid: false,
          submittedAt: '2026-05-16T08:20:00.000Z',
        }),
      ],
      excellentSolutionLimit: 5,
    });

    expect(report.attemptPolicy).toMatchObject({
      rankingSource: 'best-effective-attempt',
      effectiveSubmissionCount: 1,
      lateSubmissionCount: 1,
      zeroScoreSubmissionCount: 1,
      invalidSubmissionCount: 1,
      multipleSubmitterCount: 1,
    });
    expect(report.scores).toMatchObject({
      average: 72,
      median: 72,
      highest: 72,
    });
    expect(report.classroomReview.methodPatterns).toEqual([
      expect.objectContaining({ count: 4, validCount: 1, averageScore: 72 }),
    ]);
    expect(report.excellentSolutions).toEqual([
      expect.objectContaining({ submissionId: 'a-effective', score: 72 }),
    ]);
    expect(report.personalBests.find((best) => best.userId === 'student-a')).toMatchObject({
      submissionId: 'a-effective',
      attemptStatus: 'effective',
      effectiveForRanking: true,
    });
    expect(report.personalBests.find((best) => best.userId === 'student-b')).toMatchObject({
      submissionId: 'b-late-high',
      attemptStatus: 'late',
      effectiveForRanking: false,
    });
    expect(report.classroomReview.leaderboardVisibilityMessage).toContain('有效尝试');
  });

  it('exposes publication product context, lifecycle state, delivery actions, and leaderboard boundaries', () => {
    const report = buildArenaPublicationReport({
      publication: {
        id: 'publication-context',
        taskId: 'task-third-order-block-diagram',
        classId: 'class-control-2026',
        deadline: '2026-05-01T08:00:00.000Z',
        visibility: 'class',
        leaderboardPolicyId: 'leaderboard-class-homework',
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true, allowLateSubmissions: true },
        status: 'active',
        context: {
          assignmentTitle: '第三章课堂挑战',
          classTitle: '自动控制 2026 级 1 班',
          teacherName: '张老师',
          sourceLabel: '课堂发布',
        },
      },
      submissions: [
        submission({
          id: 'late-valid',
          userId: 'student-a',
          studentLabel: '学生甲',
          score: 82,
          valid: true,
          isLate: true,
          publicationId: 'publication-context',
          classId: 'class-control-2026',
          submittedAt: '2026-05-02T08:00:00.000Z',
        }),
      ],
    });

    expect(report.publicationContext).toMatchObject({
      taskTitle: '三阶对象结构化补偿挑战',
      assignmentTitle: '第三章课堂挑战',
      classTitle: '自动控制 2026 级 1 班',
      teacherLabel: '张老师',
      sourceLabel: '课堂发布',
      reportTitle: '三阶对象结构化补偿挑战 · 第三章课堂挑战',
    });
    expect(report.lifecycle).toMatchObject({
      state: 'late-only',
      tone: 'warning',
      primaryLabel: '已截止，可接收迟交',
      actionLabel: '查看迟交与报告',
    });
    expect(report.leaderboardBoundary).toMatchObject({
      scope: 'class',
      sourceLabel: '班级发布榜单',
      rankingSource: 'ArenaSubmission',
      attemptPolicy: 'best-effective-attempt',
    });
    expect(report.deliveryActions.map((action) => action.id)).toEqual([
      'export-report',
      'send-report',
      'lock-board',
      'copy-commentary',
    ]);
    expect(report.deliveryActions.every((action) => typeof action.statusLabel === 'string' && action.statusLabel.length > 0)).toBe(true);
  });
});

function publicationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'publication-a',
    taskId: 'task-report',
    classId: 'class-a',
    teacherId: 'teacher-a',
    visibility: 'class',
    deadline: new Date('2026-06-01T08:00:00.000Z'),
    leaderboardPolicyId: 'leaderboard-class-homework',
    homeworkBinding: true,
    gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
    status: 'active',
    config: {
      taskId: 'task-report',
      classId: 'class-a',
      studentVisibility: 'class',
      deadline: '2026-06-01T08:00:00.000Z',
      leaderboardPolicyId: 'leaderboard-class-homework',
      homeworkBinding: true,
    },
    createdAt: new Date('2026-05-16T08:00:00.000Z'),
    updatedAt: new Date('2026-05-16T08:00:00.000Z'),
    ...overrides,
  };
}

function reportDb() {
  const publication = publicationRow();

  return {
    class: {
      findUnique: vi.fn(async ({ where }: any) => (
        where.id === 'class-a'
          ? { id: 'class-a', teacherId: 'teacher-a' }
          : null
      )),
    },
    arenaChallengePublication: {
      create: vi.fn(),
      findUnique: vi.fn(async ({ where }: any) => (
        where.id === 'publication-a' ? publication : null
      )),
      update: vi.fn(),
    },
    studentProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(async ({ where }: any) => (
        where.classId === 'class-a'
          ? [
              { userId: 'student-a', user: { name: '学生甲', email: 'a@example.edu' } },
              { userId: 'student-b', user: { name: '学生乙', email: 'b@example.edu' } },
            ]
          : []
      )),
    },
  };
}

describe('arena publication report access', () => {
  it('loads one authorized publication report through publicationId, classId, and actor scope', async () => {
    const db = reportDb();
    const listSubmissions = vi.fn(async () => [
      submission({
        id: 'a-best',
        userId: 'student-a',
        studentLabel: '学生甲',
        score: 84,
        valid: true,
        submittedAt: '2026-05-16T08:20:00.000Z',
      }),
    ]);

    const report = await loadArenaPublicationReportForActor(db as any, {
      actor: { id: 'teacher-a', role: 'TEACHER' },
      publicationId: 'publication-a',
      listSubmissions,
    });

    expect(db.arenaChallengePublication.findUnique).toHaveBeenCalledWith({
      where: { id: 'publication-a' },
    });
    expect(db.class.findUnique).toHaveBeenCalledWith({
      where: { id: 'class-a' },
      select: { id: true, teacherId: true },
    });
    expect(listSubmissions).toHaveBeenCalledWith({
      taskId: 'task-report',
      publicationId: 'publication-a',
      classId: 'class-a',
    });
    expect(report.participation).toMatchObject({
      expectedStudentCount: 2,
      participantCount: 1,
      nonSubmitterCount: 1,
    });
  });

  it('does not apply the owner class filter when loading course-wide publication reports', async () => {
    const db = reportDb();
    db.arenaChallengePublication.findUnique.mockImplementationOnce(async () => publicationRow({
      id: 'publication-a',
      visibility: 'course',
      config: {
        taskId: 'task-report',
        classId: 'class-a',
        studentVisibility: 'course',
        deadline: '2026-06-01T08:00:00.000Z',
        leaderboardPolicyId: 'leaderboard-course',
        homeworkBinding: false,
      },
    }));
    const listSubmissions = vi.fn(async () => [
      submission({
        id: 'other-class',
        userId: 'student-b',
        studentLabel: '学生乙',
        score: 90,
        valid: true,
        publicationId: 'publication-a',
        classId: 'class-b',
        submittedAt: '2026-05-16T08:10:00.000Z',
      }),
    ]);

    const report = await loadArenaPublicationReportForActor(db as any, {
      actor: { id: 'teacher-a', role: 'TEACHER' },
      publicationId: 'publication-a',
      listSubmissions,
    });

    expect(listSubmissions).toHaveBeenCalledWith({
      taskId: 'task-report',
      publicationId: 'publication-a',
    });
    expect(report.participation.participantCount).toBe(1);
    expect(report.participation).toMatchObject({
      expectedStudentCount: 0,
      nonSubmitterCount: 0,
      nonSubmitters: [],
    });
    expect(db.studentProfile.findMany).not.toHaveBeenCalled();
    expect(report.personalBests).toEqual([
      expect.objectContaining({ userId: 'student-b', submissionId: 'other-class', score: 90 }),
    ]);
  });

  it('allows admins and denies teachers outside the publication class without reading submissions', async () => {
    const db = reportDb();
    const listSubmissions = vi.fn(async () => []);

    await expect(loadArenaPublicationReportForActor(db as any, {
      actor: { id: 'admin-1', role: 'ADMIN' },
      publicationId: 'publication-a',
      listSubmissions,
    })).resolves.toMatchObject({
      publication: expect.objectContaining({ id: 'publication-a', classId: 'class-a' }),
    });

    listSubmissions.mockClear();

    await expect(loadArenaPublicationReportForActor(db as any, {
      actor: { id: 'teacher-b', role: 'TEACHER' },
      publicationId: 'publication-a',
      listSubmissions,
    })).rejects.toThrow(/not allowed/i);
    expect(listSubmissions).not.toHaveBeenCalled();
  });
});

describe('arena publication report route', () => {
  it('wires the teacher report page to authorized report loading and report sections', () => {
    const pageSource = readFileSync(
      join(process.cwd(), 'src/app/teacher/arena/publications/[publicationId]/page.tsx'),
      'utf8',
    );

    expect(pageSource).toContain('params: Promise<{ publicationId: string }>');
    expect(pageSource).toContain('prismaArenaPublicationStore.loadReport');
    expect(pageSource).toContain('ArenaPublicationPermissionError');
    expect(pageSource).toContain('notFound()');
    expect(pageSource).toContain('参与情况');
    expect(pageSource).toContain('提交口径');
    expect(pageSource).toContain('有效尝试');
    expect(pageSource).toContain('data-arena-attempt-policy="visible"');
    expect(pageSource).toContain('硬约束失败');
    expect(pageSource).toContain('薄弱指标');
    expect(pageSource).toContain('个人最佳');
    expect(pageSource).toContain('优秀方案');
    expect(pageSource).toContain('课堂复盘');
    expect(pageSource).toContain('匿名方案候选');
    expect(pageSource).toContain('privacyNote');
    expect(pageSource).toContain('publicationContext.reportTitle');
    expect(pageSource).toContain('data-arena-publication-context');
    expect(pageSource).toContain('leaderboardBoundary.explanation');
    expect(pageSource).toContain('报告交付');
    expect(pageSource).toContain('data-arena-publication-mobile-actions="safe-area"');
    expect(pageSource).toContain('data-task-workspace-zone="floating-dock-safe-area"');
    expect(pageSource).toContain('pb-[calc(env(safe-area-inset-bottom,0px)+8rem)]');
    expect(pageSource).toContain('export-report');
    expect(pageSource).toContain('send-report');
    expect(pageSource).toContain('lock-board');
    expect(pageSource).toContain('copy-commentary');
  });

  it('links persisted teacher arena publication rows to the report page', () => {
    const uiSource = readFileSync(
      join(process.cwd(), 'src/features/arena/teacher/teacher-arena-config.tsx'),
      'utf8',
    );

    expect(uiSource).toContain('href={`/teacher/arena/publications/${item.id}`}');
    expect(uiSource).toContain('查看报告');
    expect(uiSource).toContain("updatePublicationStatus(item.id, 'paused')");
    expect(uiSource).toContain("updatePublicationStatus(item.id, 'archived')");
  });
});
