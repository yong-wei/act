import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  createPersistedArenaSubmission: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/features/arena/submissions/persistence', () => ({
  createPersistedArenaSubmission: mocks.createPersistedArenaSubmission,
  ArenaSubmissionInputError: class ArenaSubmissionInputError extends Error {},
}));

vi.mock('@/features/arena/submissions/prisma-store', () => ({
  prismaArenaSubmissionStore: { marker: 'store' },
}));

import { POST } from '../route';
import type { ControllerArtifact } from '@/features/arena/types';

const artifact: ControllerArtifact = {
  id: 'artifact-route-a',
  taskId: 'task-second-order-lead-pid',
  method: 'pid',
  params: { kp: 2.4, ki: 0.8, kd: 0.35 },
  createdAt: '2026-05-10T10:00:00.000Z',
};

function postJson(body: unknown) {
  return POST(new Request('http://localhost/api/arena/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/arena/evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPersistedArenaSubmission.mockImplementation(async (input) => ({
      id: `submission-${input.artifact.id}`,
      taskId: input.taskId,
      userId: input.userId,
      studentLabel: input.studentLabel,
      artifactHash: 'artifact-route-hash',
      artifact: input.artifact,
      evaluation: {
        taskId: input.taskId,
        artifact: input.artifact,
        valid: true,
        score: 88,
        metrics: {},
        satisfaction: {},
        hardConstraintResults: [],
        penalties: [],
        explanation: ['评测完成'],
      },
      submittedAt: input.submittedAt,
      reusedEvaluation: input.artifact.id === 'artifact-route-b',
    }));
  });

  it('requires an authenticated user', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await postJson({ taskId: artifact.taskId, artifact });

    expect(response.status).toBe(401);
  });

  it('maps invalid task requests to 400 instead of 500', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    const { ArenaSubmissionInputError } = await import('@/features/arena/submissions/persistence');
    mocks.createPersistedArenaSubmission.mockRejectedValueOnce(new ArenaSubmissionInputError('Unknown arena task: missing-task'));

    const response = await postJson({ taskId: 'missing-task', artifact });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Unknown arena task');
  });

  it('rejects non-student submissions before persistence', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', name: '教师甲', role: 'TEACHER' } });

    const response = await postJson({ taskId: artifact.taskId, artifact });

    expect(response.status).toBe(403);
    expect(mocks.createPersistedArenaSubmission).not.toHaveBeenCalled();
  });

  it('does not expose persistence errors to the client', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });
    mocks.createPersistedArenaSubmission.mockRejectedValueOnce(new Error('Prisma database connection detail'));

    const response = await postJson({ taskId: artifact.taskId, artifact });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe('Arena evaluation failed');
  });

  it('persists duplicate evaluation reuse through the Arena submission store', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });

    const first = await postJson({ taskId: artifact.taskId, artifact });
    const second = await postJson({ taskId: artifact.taskId, artifact: { ...artifact, id: 'artifact-route-b' } });
    const payload = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(payload.submission.reusedEvaluation).toBe(true);
    expect(mocks.createPersistedArenaSubmission).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'student-1',
      studentLabel: '学生甲',
      store: { marker: 'store' },
    }));
  });

  it('does not trust class or season scope from the request body', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });

    await postJson({
      taskId: artifact.taskId,
      artifact,
      classId: 'forged-class',
      seasonId: 'forged-season',
    });

    expect(mocks.createPersistedArenaSubmission).toHaveBeenCalledWith(expect.not.objectContaining({
      classId: 'forged-class',
      seasonId: 'forged-season',
    }));
  });
});
