import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getServerAuthSession = vi.fn();
  const classSessionFindUnique = vi.fn();
  const classFindUnique = vi.fn();

  return {
    getServerAuthSession,
    prisma: {
      classSession: {
        findUnique: classSessionFindUnique,
      },
      class: {
        findUnique: classFindUnique,
      },
    },
  };
});

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock('@/lib/extracurricular-analytics', () => ({
  getClassExtracurricularAnalytics: vi.fn(),
}));

import TeacherSessionReviewPage from '../page';

describe('TeacherSessionReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders unified governance statistics and Shanghai session time', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-with-report',
      classId: 'class-1',
      teacherId: 'teacher-1',
      startTime: new Date('2026-05-12T00:22:20.391Z'),
      endTime: new Date('2026-05-12T02:05:09.624Z'),
      status: 'FINISHED',
      plan: { title: '通用课堂统计样例' },
      class: {
        id: 'class-1',
        name: '2024自动化',
        code: 'AUTO2024',
      },
      studentStates: [],
      classSessionReports: [{
        reportData: {
          sessionGovernanceSummary: {
            sessionParticipants: 77,
            loggedParticipants: 73,
            factParticipants: 50,
            submittedParticipants: 49,
            snapshotUpdatedParticipants: 50,
            syncErrorUsers: 11,
          },
        },
      }],
    });

    const element = await TeacherSessionReviewPage({ params: { sessionId: 'session-with-report' } });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('课堂记录：77 人');
    expect(html).toContain('有互动日志：73 人');
    expect(html).toContain('有提交：49 人');
    expect(html).toContain('形成学习事实：50 人');
    expect(html).toContain('同步错误：11 人');
    expect(html).toContain('2026/05/12 08:22:20');
  });

  it('renders generic CourseEvidenceSpec pre/post tracking from durable submissions', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-unit-5-3',
      classId: 'class-1',
      teacherId: 'teacher-1',
      startTime: new Date('2026-05-12T00:22:20.391Z'),
      endTime: new Date('2026-05-12T02:05:09.624Z'),
      status: 'FINISHED',
      plan: { title: '5-3：从单回路控制到复杂自主系统链路' },
      class: {
        id: 'class-1',
        name: '2024自动化',
        code: 'AUTO2024',
      },
      studentStates: [{
        lessonKey: 'unit-5-3-mass-coordination-chain-v1',
        user: {
          id: 'student-1',
          name: '张同学',
          profile: {
            classId: 'class-1',
            studentNumber: '20260001',
          },
        },
        data: {
          kind: 'unit53_student_state',
          version: 1,
          responses: {},
        },
      }],
      studentStepResponses: [
        {
          lessonKey: 'unit-5-3-mass-coordination-chain-v1',
          stepId: 'step-03',
          submittedAt: new Date('2026-05-12T00:30:00.000Z'),
          createdAt: new Date('2026-05-12T00:30:00.000Z'),
          user: {
            id: 'student-1',
            name: '张同学',
            profile: {
              classId: 'class-1',
              studentNumber: '20260001',
            },
          },
          responseData: {
            schemaVersion: 'manifest-submission-v2',
            stepId: 'step-03',
            answers: { q1: 'A' },
            questionSummaries: [{ questionId: 'q1', studentAnswer: 'A', referenceValue: 'A', isCorrect: true }],
            score: 40,
          },
        },
        {
          lessonKey: 'unit-5-3-mass-coordination-chain-v1',
          stepId: 'step-14',
          submittedAt: new Date('2026-05-12T01:40:00.000Z'),
          createdAt: new Date('2026-05-12T01:40:00.000Z'),
          user: {
            id: 'student-1',
            name: '张同学',
            profile: {
              classId: 'class-1',
              studentNumber: '20260001',
            },
          },
          responseData: {
            schemaVersion: 'manifest-submission-v2',
            stepId: 'step-14',
            answers: { q1: 'A' },
            questionSummaries: [{ questionId: 'q1', studentAnswer: 'A', referenceValue: 'A', isCorrect: true }],
            score: 85,
          },
        },
      ],
      classSessionReports: [],
    });

    const element = await TeacherSessionReviewPage({ params: { sessionId: 'session-unit-5-3' } });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('课前 40 → 课后 85');
    expect(html).toContain('+45');
    expect(html).toContain('张同学（20260001）');
  });

  it('keeps legacy course_review compatibility tracking visible', async () => {
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-course-review',
      classId: 'class-1',
      teacherId: 'teacher-1',
      startTime: new Date('2026-05-12T00:22:20.391Z'),
      endTime: new Date('2026-05-12T02:05:09.624Z'),
      status: 'FINISHED',
      plan: { title: '旧复盘兼容样例' },
      class: {
        id: 'class-1',
        name: '2024自动化',
        code: 'AUTO2024',
      },
      studentStates: [{
        lessonKey: null,
        user: {
          id: 'student-1',
          name: '张同学',
          profile: {
            classId: 'class-1',
            studentNumber: '20260001',
          },
        },
        data: {
          kind: 'course_review',
          tracking: {
            pre: { computational: 20, crossDomain: 30 },
            post: { computational: 70, crossDomain: 80 },
            focusDimensions: ['computational'],
          },
        },
      }],
      studentStepResponses: [],
      classSessionReports: [],
    });

    const element = await TeacherSessionReviewPage({ params: { sessionId: 'session-course-review' } });
    const html = renderToStaticMarkup(element);

    expect(html).toContain('课前 20 → 课后 70');
    expect(html).toContain('+50');
    expect(html).toContain('课程聚焦：计算能力');
  });
});
