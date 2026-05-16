import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  bridgeOdysseyRunToArenaSubmission: vi.fn(),
  getArenaTaskForOdysseyLevel: vi.fn(),
  resolveAccessibleArenaPublicationForStudent: vi.fn(),
  prisma: {
    mission: {
      findUnique: vi.fn(),
    },
    simulationLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    studentProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/features/arena/odyssey/bridge', () => ({
  bridgeOdysseyRunToArenaSubmission: mocks.bridgeOdysseyRunToArenaSubmission,
  getArenaTaskForOdysseyLevel: mocks.getArenaTaskForOdysseyLevel,
}));

vi.mock('@/features/arena/submissions/prisma-store', () => ({
  prismaArenaSubmissionStore: {
    listSubmissions: vi.fn(),
  },
}));

vi.mock('@/features/arena/teacher/publication-store', () => ({
  resolveAccessibleArenaPublicationForStudent: mocks.resolveAccessibleArenaPublicationForStudent,
  ArenaPublicationAccessError: class ArenaPublicationAccessError extends Error {},
}));

import { submitGameScore } from '../actions/control-odyssey';

describe('submitGameScore Arena publication bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲' } });
    mocks.prisma.mission.findUnique.mockResolvedValue({ id: 'level-1' });
    mocks.prisma.simulationLog.findFirst.mockResolvedValue(null);
    mocks.prisma.simulationLog.create.mockResolvedValue({
      id: 'log-1',
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
    });
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      controlCredits: 10,
      controlUnlocks: ['P'],
      controlOdysseyProgress: {},
      controlControllerLevels: {},
    });
    mocks.prisma.studentProfile.upsert.mockResolvedValue({});
    mocks.getArenaTaskForOdysseyLevel.mockReturnValue('task-odyssey-level-one-growth');
    mocks.resolveAccessibleArenaPublicationForStudent.mockResolvedValue({
      id: 'publication-1',
      taskId: 'task-odyssey-level-one-growth',
      classId: 'class-a',
      seasonId: 'season-2026',
      isLate: true,
    });
    mocks.bridgeOdysseyRunToArenaSubmission.mockResolvedValue({
      ok: true,
      duplicate: false,
      gameScorePreserved: true,
      submission: { id: 'submission-1' },
    });
  });

  it('resolves publication context before creating an Odyssey Arena bridge submission', async () => {
    await submitGameScore('level-1', 820, { settlingTime: 2.8 }, {
      runId: 'run-001',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      publicationId: 'publication-1',
    });

    expect(mocks.resolveAccessibleArenaPublicationForStudent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      publicationId: 'publication-1',
      studentId: 'student-1',
      taskId: 'task-odyssey-level-one-growth',
    }));
    expect(mocks.bridgeOdysseyRunToArenaSubmission).toHaveBeenCalledWith(expect.objectContaining({
      publicationId: 'publication-1',
      classId: 'class-a',
      seasonId: 'season-2026',
      isLate: true,
    }));
  });

  it('does not create an Arena bridge submission when publication access is denied', async () => {
    const { ArenaPublicationAccessError } = await import('@/features/arena/teacher/publication-store');
    mocks.resolveAccessibleArenaPublicationForStudent.mockRejectedValueOnce(
      new ArenaPublicationAccessError('Student is not allowed to access this Arena publication.'),
    );

    await submitGameScore('level-1', 820, { settlingTime: 2.8 }, {
      runId: 'run-001',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      publicationId: 'publication-1',
    });

    expect(mocks.bridgeOdysseyRunToArenaSubmission).not.toHaveBeenCalled();
    expect(mocks.prisma.simulationLog.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'log-1' },
      data: expect.objectContaining({
        metrics: expect.objectContaining({
          arenaBridge: expect.objectContaining({
            ok: false,
            gameScorePreserved: true,
          }),
        }),
      }),
    }));
  });
});
