import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
  ArenaPublicationAccessError: class ArenaPublicationAccessError extends Error {},
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
  ArenaPublicationAccessError: mocks.ArenaPublicationAccessError,
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
      deadline: '2026-07-01T00:00:00.000Z',
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
    });
    mocks.listSubmissions.mockResolvedValue([
      { id: 'own-submission', userId: 'student-1', taskId, publicationId: 'publication-1', classId: 'class-a' },
      { id: 'peer-submission', userId: 'student-2', taskId, publicationId: 'publication-1', classId: 'class-a' },
    ]);
  });

  it('validates publication access before loading publication submissions', async () => {
    await ArenaChallengePage({
      params: Promise.resolve({ taskId }),
      searchParams: Promise.resolve({ publicationId: 'publication-1' }),
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
      params: Promise.resolve({ taskId }),
      searchParams: Promise.resolve({ publicationId: 'publication-1' }),
    });

    expect(element.props).toMatchObject({
      submissions: [expect.objectContaining({ id: 'own-submission' })],
      publicationId: 'publication-1',
    });
  });

  it('renders product recovery instead of raw 404 for anonymous publication URLs', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const element = await ArenaChallengePage({
      params: Promise.resolve({ taskId }),
      searchParams: Promise.resolve({ publicationId: 'publication-1' }),
    });

    expect(mocks.resolveAccessibleArenaPublicationForStudent).not.toHaveBeenCalled();
    expect(mocks.listSubmissions).not.toHaveBeenCalled();
    expect(element.props).toMatchObject({
      kind: 'permission-boundary',
      sourceRoute: '/arena/challenges/[taskId]?publicationId',
      targetLabel: 'Arena 发布挑战',
      displayReference: 'publication-1',
      primaryHref: `/login?callbackUrl=${encodeURIComponent(`/arena/challenges/${taskId}?publicationId=publication-1`)}`,
      surface: 'student-publication-permission',
    });
  });

  it('renders product recovery for invalid Arena task ids before loading submissions', async () => {
    const element = await ArenaChallengePage({
      params: Promise.resolve({ taskId: 'not-a-real-task' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.listSubmissions).not.toHaveBeenCalled();
    expect(element.props).toMatchObject({
      kind: 'invalid-object-route',
      sourceRoute: '/arena/challenges/[taskId]',
      targetLabel: 'Arena 挑战',
      displayReference: 'not-a-real-task',
      surface: 'challenge-task',
    });
  });

  it('maps inaccessible publication ids to product recovery states', async () => {
    mocks.resolveAccessibleArenaPublicationForStudent.mockRejectedValueOnce(
      new mocks.ArenaPublicationAccessError('Arena publication was not found.'),
    );

    const element = await ArenaChallengePage({
      params: Promise.resolve({ taskId }),
      searchParams: Promise.resolve({ publicationId: 'missing-publication' }),
    });

    expect(mocks.listSubmissions).not.toHaveBeenCalled();
    expect(element.props).toMatchObject({
      kind: 'missing-object',
      sourceRoute: '/arena/challenges/[taskId]?publicationId',
      targetLabel: 'Arena 发布挑战',
      surface: 'student-publication-access',
    });
    expect(element.props).not.toHaveProperty('displayReference');
  });

  it('does not reveal whether inaccessible publication ids exist or mismatch the task', async () => {
    for (const message of [
      'Arena publication does not match this task.',
      'Arena publication is not active.',
      'Student is not allowed to access this Arena publication.',
    ]) {
      mocks.resolveAccessibleArenaPublicationForStudent.mockRejectedValueOnce(
        new mocks.ArenaPublicationAccessError(message),
      );

      const element = await ArenaChallengePage({
        params: Promise.resolve({ taskId }),
        searchParams: Promise.resolve({ publicationId: 'possibly-real-publication' }),
      });

      expect(element.props).toMatchObject({
        kind: 'missing-object',
        message: 'Arena 发布挑战不存在或当前账号不可见。',
        surface: 'student-publication-access',
      });
      expect(element.props).not.toHaveProperty('displayReference');
      expect(mocks.listSubmissions).not.toHaveBeenCalled();
    }
  });

  it('does not class-scope course-wide publication submission reads', async () => {
    mocks.resolveAccessibleArenaPublicationForStudent.mockResolvedValueOnce({
      id: 'publication-course',
      taskId,
      visibility: 'course',
      classId: 'class-b',
      seasonId: 'season-2026',
      isLate: false,
      deadline: '2026-07-01T00:00:00.000Z',
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: false },
    });

    await ArenaChallengePage({
      params: Promise.resolve({ taskId }),
      searchParams: Promise.resolve({ publicationId: 'publication-course' }),
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
      params: Promise.resolve({ taskId }),
      searchParams: Promise.resolve({}),
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
