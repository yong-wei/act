import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    class: {
      findUnique: vi.fn(),
    },
    arenaChallengePublication: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { GET, POST } from '../route';
import { PATCH } from '../[publicationId]/status/route';

const validBody = {
  taskId: 'task-integrator-low-frequency-balance',
  classId: 'class-2026-control',
  visibility: 'class',
  deadline: '2026-06-01T15:00:00.000Z',
  leaderboardPolicyId: 'leaderboard-class-homework',
  homeworkBinding: true,
  gradingPolicy: { hideFullLeaderboardBeforeDeadline: true },
  templateId: 'template-pid-tuning',
  targetSignal: '教师自定义阶跃目标',
  disturbance: '教师自定义低频扰动',
  initialCondition: '教师自定义初始条件',
  allowedMethods: ['pid'],
  hardConstraints: ['closed_loop_stable', 'finite_response'],
  scoringMetricWeights: { steadyStateError: 0.5, settlingTime: 0.3, overshoot: 0.2 },
  paretoEnabled: false,
  hiddenTestEnabled: true,
  publicLeaderboard: false,
  telemetryLevel: 'L1',
};

function storedPublication(overrides: Record<string, unknown> = {}) {
  return {
    id: 'publication-1',
    taskId: validBody.taskId,
    classId: validBody.classId,
    teacherId: 'teacher-1',
    visibility: 'class',
    deadline: new Date(validBody.deadline),
    leaderboardPolicyId: validBody.leaderboardPolicyId,
    homeworkBinding: true,
    gradingPolicy: validBody.gradingPolicy,
    status: 'active',
    config: {
      templateId: validBody.templateId,
      targetSignal: validBody.targetSignal,
      disturbance: validBody.disturbance,
      initialCondition: validBody.initialCondition,
      allowedMethods: validBody.allowedMethods,
      hardConstraints: validBody.hardConstraints,
      scoringMetricWeights: validBody.scoringMetricWeights,
      paretoEnabled: validBody.paretoEnabled,
      hiddenTestEnabled: validBody.hiddenTestEnabled,
      publicLeaderboard: validBody.publicLeaderboard,
      telemetryLevel: validBody.telemetryLevel,
    },
    createdAt: new Date('2026-05-15T10:00:00.000Z'),
    updatedAt: new Date('2026-05-15T10:00:00.000Z'),
    ...overrides,
  };
}

function postJson(body: unknown) {
  return POST(new Request('http://localhost/api/teacher/arena/publications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function patchJson(publicationId: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost/api/teacher/arena/publications/${publicationId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { publicationId } },
  );
}

describe('/api/teacher/arena/publications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.class.findUnique.mockResolvedValue({ id: validBody.classId, teacherId: 'teacher-1' });
    mocks.prisma.arenaChallengePublication.create.mockImplementation(async ({ data }: any) => storedPublication(data));
    mocks.prisma.arenaChallengePublication.findMany.mockResolvedValue([storedPublication()]);
    mocks.prisma.arenaChallengePublication.findUnique.mockResolvedValue(storedPublication());
    mocks.prisma.arenaChallengePublication.update.mockImplementation(async ({ data }: any) => storedPublication(data));
  });

  it('requires a teacher or admin actor', async () => {
    mocks.getServerAuthSession.mockResolvedValueOnce(null);
    expect((await postJson(validBody)).status).toBe(401);

    mocks.getServerAuthSession.mockResolvedValueOnce({ user: { id: 'student-1', role: 'STUDENT' } });
    expect((await GET(new Request('http://localhost/api/teacher/arena/publications'))).status).toBe(403);
  });

  it('creates persisted publications for teacher-owned classes', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await postJson(validBody);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.prisma.arenaChallengePublication.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        taskId: validBody.taskId,
        classId: validBody.classId,
        teacherId: 'teacher-1',
        status: 'active',
        gradingPolicy: validBody.gradingPolicy,
      }),
    }));
    expect(payload.publication).toMatchObject({
      id: 'publication-1',
      taskId: validBody.taskId,
      classId: validBody.classId,
      homeworkBinding: true,
      status: 'active',
    });
  });

  it('lists teacher publications with class and status filters', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await GET(new Request(
      'http://localhost/api/teacher/arena/publications?classId=class-2026-control&status=active',
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.arenaChallengePublication.findMany).toHaveBeenCalledWith({
      where: {
        teacherId: 'teacher-1',
        classId: 'class-2026-control',
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(payload.publications).toHaveLength(1);
  });

  it('updates publication lifecycle status through the status route', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await patchJson('publication-1', { status: 'paused' });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.arenaChallengePublication.update).toHaveBeenCalledWith({
      where: { id: 'publication-1' },
      data: { status: 'paused' },
    });
    expect(payload.publication).toMatchObject({ id: 'publication-1', status: 'paused' });
  });

  it('rejects invalid publication status updates', async () => {
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });

    const response = await patchJson('publication-1', { status: 'published' });

    expect(response.status).toBe(400);
    expect(mocks.prisma.arenaChallengePublication.update).not.toHaveBeenCalled();
  });
});
