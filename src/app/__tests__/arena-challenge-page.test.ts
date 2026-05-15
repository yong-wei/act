import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
  listSubmissions: vi.fn(),
  resolveAccessibleArenaPublicationForStudent: vi.fn(),
  challengeDetail: vi.fn(() => null),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/arena/submissions/prisma-store', () => ({
  prismaArenaSubmissionStore: {
    listSubmissions: mocks.listSubmissions,
  },
}));

vi.mock('@/features/arena/teacher/publication-store', () => ({
  resolveAccessibleArenaPublicationForStudent: mocks.resolveAccessibleArenaPublicationForStudent,
  ArenaPublicationAccessError: class ArenaPublicationAccessError extends Error {},
}));

vi.mock('@/features/arena/challenge-detail', () => ({
  ChallengeDetail: (props: unknown) => mocks.challengeDetail(props),
}));

import ArenaChallengePage from '../arena/challenges/[taskId]/page';

const taskId = 'task-integrator-low-frequency-balance';

describe('ArenaChallengePage publication context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.resolveAccessibleArenaPublicationForStudent.mockResolvedValue({
      id: 'publication-1',
      taskId,
      classId: 'class-a',
      seasonId: 'season-2026',
      isLate: false,
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
    });
    mocks.listSubmissions.mockResolvedValue([
      { id: 'own-submission', userId: 'student-1', taskId, publicationId: 'publication-1', classId: 'class-a' },
      { id: 'peer-submission', userId: 'student-2', taskId, publicationId: 'publication-1', classId: 'class-a' },
    ]);
  });

  it('validates publication access before loading publication submissions', async () => {
    await ArenaChallengePage({
      params: { taskId },
      searchParams: { publicationId: 'publication-1' },
    });

    expect(mocks.resolveAccessibleArenaPublicationForStudent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      publicationId: 'publication-1',
      studentId: 'student-1',
      taskId,
      allowAfterDeadline: true,
    }));
    expect(mocks.listSubmissions).toHaveBeenCalledWith({
      taskId,
      publicationId: 'publication-1',
      classId: 'class-a',
    });
  });

  it('hides peer submissions before deadline when publication policy requires it', async () => {
    const element = await ArenaChallengePage({
      params: { taskId },
      searchParams: { publicationId: 'publication-1' },
    });

    expect(element.props).toMatchObject({
      submissions: [expect.objectContaining({ id: 'own-submission' })],
      publicationId: 'publication-1',
    });
  });

  it('does not load publication submissions for anonymous publication URLs', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    await expect(ArenaChallengePage({
      params: { taskId },
      searchParams: { publicationId: 'publication-1' },
    })).rejects.toThrow('notFound');

    expect(mocks.resolveAccessibleArenaPublicationForStudent).not.toHaveBeenCalled();
    expect(mocks.listSubmissions).not.toHaveBeenCalled();
  });
});
