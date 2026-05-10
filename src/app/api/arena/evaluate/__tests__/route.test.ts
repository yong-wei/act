import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
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
  });

  it('requires an authenticated user', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await postJson({ taskId: artifact.taskId, artifact });

    expect(response.status).toBe(401);
  });

  it('maps invalid task requests to 400 instead of 500', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    const response = await postJson({ taskId: 'missing-task', artifact });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Unknown arena task');
  });

  it('reuses duplicate evaluation results through the route-level cache', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲', role: 'STUDENT' } });

    const first = await postJson({ taskId: artifact.taskId, artifact });
    const second = await postJson({ taskId: artifact.taskId, artifact: { ...artifact, id: 'artifact-route-b' } });
    const payload = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(payload.submission.reusedEvaluation).toBe(true);
  });
});
