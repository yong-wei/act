import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  readAdaptiveLearnerState: vi.fn(),
  isAdaptiveLearnerStateServiceEnabled: vi.fn(),
  prisma: {
    class: {
      findUnique: vi.fn(),
    },
    studentProfile: {
      findFirst: vi.fn(),
    },
    studentProfileSummary: {
      findUnique: vi.fn(),
    },
    studentCompetencySnapshot: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/lib/data-governance/adaptive-learner-state-service', () => ({
  isAdaptiveLearnerStateServiceEnabled: mocks.isAdaptiveLearnerStateServiceEnabled,
  readAdaptiveLearnerState: mocks.readAdaptiveLearnerState,
}));

import { GET } from '@/app/api/ai/konling-context/route';

function request(url = 'http://localhost/api/ai/konling-context') {
  return GET(new Request(url) as Parameters<typeof GET>[0]);
}

describe('Konling context route learner-state integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAdaptiveLearnerStateServiceEnabled.mockReturnValue(true);
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.readAdaptiveLearnerState.mockResolvedValue({
      userId: 'student-1',
      authority: 'server-owned',
      primaryCompetencies: {
        source: 'latest-snapshot',
      },
    });
    mocks.prisma.studentProfileSummary.findUnique.mockResolvedValue({
      overallLevel: '良好',
      overallScore: 72,
      strengthsJson: ['控制建模'],
      weaknessesJson: ['跨域迁移'],
      recentTrend: '稳定提升',
      trendDirection: 'up',
      riskFlagsJson: [],
      riskLevel: 'none',
      recommendedScaffolding: '继续完成路径任务',
    });
    mocks.prisma.studentCompetencySnapshot.findFirst.mockResolvedValue({
      competencyVector: { controlModeling: { score: 72 } },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-1',
      teacherId: 'teacher-1',
    });
    mocks.prisma.studentProfile.findFirst.mockResolvedValue({
      userId: 'student-1',
      classId: 'class-1',
    });
  });

  it('returns server-owned learner state context for Konling when enabled', async () => {
    const response = await request();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'student-1',
        role: 'student',
      }),
    );
    expect(body.learner_state_context).toMatchObject({
      authority: 'server-owned',
      primaryCompetencies: {
        source: 'latest-snapshot',
      },
    });
  });

  it('requires class scope before a teacher reads another student context', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });

    const response = await request('http://localhost/api/ai/konling-context?userId=student-1');
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('classId');
    expect(mocks.readAdaptiveLearnerState).not.toHaveBeenCalled();
  });

  it('allows teacher reads only for students in the teacher class', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });

    const response = await request('http://localhost/api/ai/konling-context?userId=student-1&classId=class-1');

    expect(response.status).toBe(200);
    expect(mocks.prisma.class.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'class-1' },
      }),
    );
    expect(mocks.prisma.studentProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'student-1',
          classId: 'class-1',
        },
      }),
    );
    expect(mocks.readAdaptiveLearnerState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'student-1',
        role: 'teacher',
        classId: 'class-1',
      }),
    );
  });

  it('rejects teacher reads for classes owned by another teacher', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.class.findUnique.mockResolvedValue({
      id: 'class-2',
      teacherId: 'teacher-2',
    });

    const response = await request('http://localhost/api/ai/konling-context?userId=student-1&classId=class-2');

    expect(response.status).toBe(403);
    expect(mocks.readAdaptiveLearnerState).not.toHaveBeenCalled();
  });
});
