import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  verifyArenaVirtualSimulationReplay: vi.fn(),
  prisma: {
    class: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/features/arena/blackbox/replay-service', () => ({
  verifyArenaVirtualSimulationReplay: mocks.verifyArenaVirtualSimulationReplay,
  prismaArenaReplayRunStore: { marker: 'replay-store' },
  ArenaReplayNotFoundError: class ArenaReplayNotFoundError extends Error {},
  ArenaReplayAccessError: class ArenaReplayAccessError extends Error {},
}));

import { POST } from '../route';
import {
  ArenaReplayAccessError,
  ArenaReplayNotFoundError,
} from '@/features/arena/blackbox/replay-service';

function postJson(body: unknown) {
  return POST(new Request('http://localhost/api/arena/replay/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/arena/replay/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.class.findMany.mockResolvedValue([]);
    mocks.verifyArenaVirtualSimulationReplay.mockResolvedValue({
      runId: 'preview-row-1',
      status: 'match',
      persistedChecksum: 'sha256:abc',
      recomputedChecksum: 'sha256:abc',
      metadata: {
        taskId: 'task-cruise-roll-blackbox-identification',
        scenarioId: 'cruise-roll-controller-preview',
        seed: 1,
        runtimeVersion: 'runtime',
        modelVersion: 'model',
      },
    });
  });

  it('requires authentication', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await postJson({ runId: 'preview-row-1' });

    expect(response.status).toBe(401);
  });

  it('verifies a replay run for the authenticated requester', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.class.findMany.mockResolvedValue([
      { id: 'class-1' },
      { id: 'class-2' },
    ]);

    const response = await postJson({ runId: 'preview-row-1' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('match');
    expect(mocks.prisma.class.findMany).toHaveBeenCalledWith({
      where: { teacherId: 'teacher-1' },
      select: { id: true },
    });
    expect(mocks.verifyArenaVirtualSimulationReplay).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'preview-row-1',
      requester: { userId: 'teacher-1', role: 'TEACHER', classIds: ['class-1', 'class-2'] },
      store: { marker: 'replay-store' },
    }));
  });

  it('maps missing runs, checksum mismatch, missing trace, and unauthorized requests', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });

    mocks.verifyArenaVirtualSimulationReplay.mockRejectedValueOnce(new ArenaReplayNotFoundError('Replay run not found.'));
    expect((await postJson({ runId: 'missing' })).status).toBe(404);

    mocks.verifyArenaVirtualSimulationReplay.mockResolvedValueOnce({
      runId: 'preview-row-1',
      status: 'mismatch',
      persistedChecksum: 'sha256:old',
      recomputedChecksum: 'sha256:new',
      metadata: {},
    });
    expect((await postJson({ runId: 'preview-row-1' })).status).toBe(409);

    mocks.verifyArenaVirtualSimulationReplay.mockResolvedValueOnce({
      runId: 'preview-row-1',
      status: 'missing_trace',
      persistedChecksum: null,
      recomputedChecksum: null,
      metadata: {},
    });
    expect((await postJson({ runId: 'preview-row-1' })).status).toBe(422);

    mocks.verifyArenaVirtualSimulationReplay.mockRejectedValueOnce(new ArenaReplayAccessError('Forbidden.'));
    expect((await postJson({ runId: 'preview-row-1' })).status).toBe(403);
  });
});
