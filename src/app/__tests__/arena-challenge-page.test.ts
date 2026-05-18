import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
  findPublications: vi.fn(),
  listSubmissions: vi.fn(),
  resolveAccessibleArenaPublicationForStudent: vi.fn(),
  challengeDetail: vi.fn((_props: unknown) => null),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    arenaChallengePublication: {
      findMany: mocks.findPublications,
    },
  },
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
    mocks.findPublications.mockResolvedValue([]);
    mocks.resolveAccessibleArenaPublicationForStudent.mockResolvedValue({
      id: 'publication-1',
      taskId,
      visibility: 'class',
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

  it('does not class-scope course-wide publication submission reads', async () => {
    mocks.resolveAccessibleArenaPublicationForStudent.mockResolvedValueOnce({
      id: 'publication-course',
      taskId,
      visibility: 'course',
      classId: 'class-b',
      seasonId: 'season-2026',
      isLate: false,
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: false },
    });

    await ArenaChallengePage({
      params: { taskId },
      searchParams: { publicationId: 'publication-course' },
    });

    expect(mocks.listSubmissions).toHaveBeenCalledWith({
      taskId,
      publicationId: 'publication-course',
    });
  });

  it('filters hidden publication submissions on bare challenge pages', async () => {
    mocks.listSubmissions.mockResolvedValue([
      { id: 'hidden-submission', userId: 'student-2', taskId, publicationId: 'publication-hidden' },
      { id: 'open-submission', userId: 'student-3', taskId, publicationId: 'publication-open' },
      { id: 'bare-submission', userId: 'student-4', taskId },
    ]);
    mocks.findPublications.mockResolvedValue([
      {
        id: 'publication-hidden',
        deadline: new Date(Date.now() + 60_000),
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
      {
        id: 'publication-open',
        deadline: new Date(Date.now() + 60_000),
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: false },
      },
    ]);

    const element = await ArenaChallengePage({
      params: { taskId },
      searchParams: {},
    });

    expect(mocks.listSubmissions).toHaveBeenCalledWith({ taskId });
    expect(mocks.findPublications).toHaveBeenCalledWith({
      where: { id: { in: ['publication-hidden', 'publication-open'] } },
      select: { id: true, deadline: true, gradingPolicy: true },
    });
    expect(element.props.submissions.map((submission: { id: string }) => submission.id)).toEqual([
      'open-submission',
      'bare-submission',
    ]);
  });
});
