import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  findPublications: vi.fn(),
  listSubmissions: vi.fn(),
  resolveAccessibleArenaPublicationForStudent: vi.fn(),
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

import { GET } from '../route';

const taskId = 'task-second-order-lead-pid';

function getSubmissions(url: string) {
  return GET(new Request(url));
}

describe('GET /api/arena/submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.resolveAccessibleArenaPublicationForStudent.mockResolvedValue({
      id: 'publication-1',
      taskId,
      visibility: 'class',
      classId: 'class-a',
      isLate: false,
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
    });
    mocks.findPublications.mockResolvedValue([
      {
        id: 'publication-1',
        deadline: new Date('2099-01-01T00:00:00.000Z'),
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
    ]);
    mocks.listSubmissions.mockResolvedValue([
      { id: 'own-submission', userId: 'student-1', taskId, publicationId: 'publication-1', classId: 'class-a' },
      { id: 'peer-submission', userId: 'student-2', taskId, publicationId: 'publication-1', classId: 'class-a' },
    ]);
  });

  it('loads unscoped task submissions without publication access checks', async () => {
    mocks.listSubmissions.mockResolvedValueOnce([
      { id: 'open-submission', userId: 'student-1', taskId },
    ]);
    const response = await getSubmissions(`http://localhost/api/arena/submissions?taskId=${taskId}`);

    expect(response.status).toBe(200);
    expect(mocks.resolveAccessibleArenaPublicationForStudent).not.toHaveBeenCalled();
    expect(mocks.listSubmissions).toHaveBeenCalledWith({ taskId, publicationId: undefined });
  });

  it('filters hidden publication submissions from unscoped task reads', async () => {
    mocks.listSubmissions.mockResolvedValueOnce([
      { id: 'hidden-submission', userId: 'student-2', taskId, publicationId: 'publication-hidden' },
      { id: 'open-submission', userId: 'student-3', taskId, publicationId: 'publication-open' },
      { id: 'bare-submission', userId: 'student-4', taskId },
    ]);
    mocks.findPublications.mockResolvedValueOnce([
      {
        id: 'publication-hidden',
        deadline: new Date('2099-01-01T00:00:00.000Z'),
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
      },
      {
        id: 'publication-open',
        deadline: new Date('2099-01-01T00:00:00.000Z'),
        gradingPolicy: { hideFullLeaderboardBeforeDeadline: false },
      },
    ]);

    const response = await getSubmissions(`http://localhost/api/arena/submissions?taskId=${taskId}`);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.findPublications).toHaveBeenCalledWith({
      where: { id: { in: ['publication-hidden', 'publication-open'] } },
      select: { id: true, deadline: true, gradingPolicy: true },
    });
    expect(payload.submissions.map((submission: { id: string }) => submission.id)).toEqual([
      'open-submission',
      'bare-submission',
    ]);
  });

  it('validates publication context and hides peer submissions before deadline', async () => {
    const response = await getSubmissions(`http://localhost/api/arena/submissions?taskId=${taskId}&publicationId=publication-1`);
    const payload = await response.json();

    expect(response.status).toBe(200);
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
    expect(payload.submissions.map((submission: { id: string }) => submission.id)).toEqual(['own-submission']);
  });

  it('does not class-scope course-wide publication submission reads', async () => {
    mocks.resolveAccessibleArenaPublicationForStudent.mockResolvedValueOnce({
      id: 'publication-course',
      taskId,
      visibility: 'course',
      classId: 'class-b',
      isLate: false,
      gradingPolicy: { hideFullLeaderboardBeforeDeadline: false },
    });

    const response = await getSubmissions(`http://localhost/api/arena/submissions?taskId=${taskId}&publicationId=publication-course`);

    expect(response.status).toBe(200);
    expect(mocks.listSubmissions).toHaveBeenCalledWith({
      taskId,
      publicationId: 'publication-course',
    });
  });
});
