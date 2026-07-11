import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  bridgeOdysseyRunToArenaSubmission: vi.fn(),
  getArenaTaskForOdysseyLevel: vi.fn(),
  resolveAccessibleArenaPublicationForStudent: vi.fn(),
  computeOfficialOdysseyTelemetry: vi.fn(),
  listSubmissions: vi.fn(),
  prisma: {
    mission: {
      findUnique: vi.fn(),
    },
    simulationLog: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    studentProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/features/arena/odyssey/bridge', () => ({
  bridgeOdysseyRunToArenaSubmission: mocks.bridgeOdysseyRunToArenaSubmission,
  getArenaTaskForOdysseyLevel: mocks.getArenaTaskForOdysseyLevel,
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

vi.mock('@/resources/interactive-learning/control-odyssey/engine/official-simulation', () => ({
  computeOfficialOdysseyTelemetry: mocks.computeOfficialOdysseyTelemetry,
}));

import { getControlProfile, getLevelLeaderboard, submitGameScore } from '../actions/control-odyssey';

const officialSnapshot = (runId: string, overrides: Record<string, unknown> = {}) => ({
  replaySnapshotVersion: 1,
  levelId: 'level-1',
  runId,
  tier: 'gold',
  controllerId: 'PID',
  controlMode: 'AUTO',
  pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
  extraParams: { speedFeedbackTau: 0.05, feedforwardGain: 0.05, smithDelay: 0.1 },
  enableSpeedFeedback: false,
  enableFeedforward: false,
  enableSmithPredictor: false,
  difficultyScale: 1,
  controllerLevels: { P: 1, PI: 1, PD: 1, PID: 1, VFB: 0, FF: 0, SMITH: 0 },
  arenaTaskId: 'task-odyssey-level-one-growth',
  publicationId: 'publication-1',
  ...overrides,
});

describe('submitGameScore Arena publication bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'student-1', name: '学生甲' } });
    mocks.prisma.mission.findUnique.mockResolvedValue({ id: 'level-1' });
    mocks.prisma.simulationLog.findFirst.mockResolvedValue(null);
    mocks.prisma.simulationLog.findUnique.mockResolvedValue(null);
    mocks.prisma.simulationLog.findMany.mockResolvedValue([]);
    mocks.listSubmissions.mockResolvedValue([]);
    mocks.prisma.simulationLog.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      id: 'log-1',
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
    }));
    mocks.prisma.studentProfile.findUnique.mockResolvedValue({
      controlCredits: 10,
      controlUnlocks: ['P'],
      controlOdysseyProgress: {},
      controlControllerLevels: {},
    });
    mocks.prisma.studentProfile.create.mockResolvedValue({});
    mocks.prisma.studentProfile.update.mockResolvedValue({});
    mocks.prisma.studentProfile.upsert.mockResolvedValue({});
    mocks.getArenaTaskForOdysseyLevel.mockReturnValue('task-odyssey-level-one-growth');
    mocks.computeOfficialOdysseyTelemetry.mockReturnValue({
      settlingTime: 4.2,
      maxOvershoot: 5,
      steadyError: 1.5,
      controlEnergy: 3.4,
      controlSmoothness: 0.8,
      officialTelemetrySource: 'server-rust-simulation',
    });
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

  it('rejects unauthenticated score submissions before reading or mutating gameplay state', async () => {
    mocks.getServerSession.mockResolvedValueOnce(null);

    const result = await submitGameScore('level-1', 820, { settlingTime: 2.8 });

    expect(result).toBeNull();
    expect(mocks.prisma.mission.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.simulationLog.create).not.toHaveBeenCalled();
  });

  it('returns the deterministic existing Arena submission id when an Odyssey run is replayed', async () => {
    mocks.prisma.simulationLog.findFirst.mockResolvedValueOnce({
      id: 'existing-log',
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
      inputParams: officialSnapshot('run-replay'),
    });
    mocks.listSubmissions.mockResolvedValueOnce([{
      id: 'existing-submission',
      artifact: { params: { odysseyRunId: 'run-replay' } },
    }]);

    const result = await submitGameScore('level-1', 820, {}, {
      runId: 'run-replay',
      arenaTaskId: 'task-odyssey-level-one-growth',
      publicationId: 'publication-1',
    });

    expect(result).toMatchObject({ id: 'existing-log', arenaSubmissionId: 'existing-submission' });
    expect(mocks.listSubmissions).toHaveBeenCalledWith({
      taskId: 'task-odyssey-level-one-growth',
      userId: 'student-1',
      publicationId: 'publication-1',
    });
    expect(mocks.prisma.simulationLog.create).not.toHaveBeenCalled();
  });

  it('recovers a missing Arena submission from an existing Odyssey log without duplicating gameplay credit', async () => {
    mocks.prisma.simulationLog.findFirst.mockResolvedValueOnce({
      id: 'existing-log',
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
      inputParams: officialSnapshot('run-recover'),
      metrics: { settlingTime: 2.8 },
    });
    mocks.listSubmissions.mockResolvedValueOnce([]);

    const result = await submitGameScore('level-1', 820, { settlingTime: 2.8 }, {
      runId: 'run-recover',
      arenaTaskId: 'task-odyssey-level-one-growth',
      publicationId: 'publication-1',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
    });

    expect(result).toMatchObject({ id: 'existing-log', arenaSubmissionId: 'submission-1' });
    expect(mocks.bridgeOdysseyRunToArenaSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.simulationLog.create).not.toHaveBeenCalled();
    expect(mocks.prisma.studentProfile.upsert).not.toHaveBeenCalled();
  });

  it('retries the same existing Odyssey log after the first Arena bridge failure', async () => {
    const existingLog = {
      id: 'existing-log',
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
      inputParams: officialSnapshot('run-retry'),
      metrics: { settlingTime: 2.8 },
    };
    mocks.prisma.simulationLog.findFirst.mockResolvedValue(existingLog);
    mocks.listSubmissions.mockResolvedValue([]);
    mocks.bridgeOdysseyRunToArenaSubmission
      .mockResolvedValueOnce({ ok: false, reason: 'temporary failure', gameScorePreserved: true })
      .mockResolvedValueOnce({
        ok: true,
        duplicate: false,
        gameScorePreserved: true,
        submission: { id: 'submission-after-retry' },
      });
    const context = {
      runId: 'run-retry',
      arenaTaskId: 'task-odyssey-level-one-growth',
      publicationId: 'publication-1',
      tier: 'gold',
      controllerId: 'PID' as const,
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
    };

    const first = await submitGameScore('level-1', 820, { settlingTime: 2.8 }, context);
    const second = await submitGameScore('level-1', 820, { settlingTime: 2.8 }, context);

    expect(first).toMatchObject({ id: 'existing-log' });
    expect(first).toMatchObject({ arenaSubmissionId: undefined });
    expect(second).toMatchObject({ id: 'existing-log', arenaSubmissionId: 'submission-after-retry' });
    expect(mocks.bridgeOdysseyRunToArenaSubmission).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.simulationLog.create).not.toHaveBeenCalled();
  });

  it('replays an existing Odyssey bridge from persisted run inputs instead of altered retry payloads', async () => {
    mocks.prisma.simulationLog.findFirst.mockResolvedValueOnce({
      id: 'existing-log',
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
      inputParams: {
        replaySnapshotVersion: 1,
        levelId: 'level-1',
        runId: 'run-stable',
        tier: 'silver',
        controllerId: 'PID',
        controlMode: 'AUTO',
        pidParams: { kp: 1.8, ki: 0.3, kd: 0.08 },
        arenaTaskId: 'task-odyssey-level-one-growth',
        publicationId: 'publication-1',
        controllerLevels: { P: 1, PI: 2, PD: 2, PID: 3, VFB: 0, FF: 0, SMITH: 0 },
        extraParams: { speedFeedbackTau: 0.05, feedforwardGain: 0.05, smithDelay: 0.1 },
        enableSpeedFeedback: false,
        enableFeedforward: false,
        enableSmithPredictor: false,
        difficultyScale: 1,
      },
      metrics: { settlingTime: 3.1 },
    });
    mocks.listSubmissions.mockResolvedValueOnce([]);

    await submitGameScore('level-1', 1, { settlingTime: 99 }, {
      runId: 'run-stable',
      arenaTaskId: 'task-odyssey-level-one-growth',
      publicationId: 'publication-forged-retry',
      tier: 'gold',
      controllerId: 'P',
      pidParams: { kp: 99, ki: 99, kd: 99 },
    });

    expect(mocks.resolveAccessibleArenaPublicationForStudent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      publicationId: 'publication-1',
    }));
    expect(mocks.computeOfficialOdysseyTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      tier: 'silver',
      controllerId: 'PID',
      pidParams: { kp: 1.8, ki: 0.3, kd: 0.08 },
    }));
    expect(mocks.bridgeOdysseyRunToArenaSubmission).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-stable',
      tier: 'silver',
      publicationId: 'publication-1',
    }));
  });

  it('fails closed when a legacy Odyssey Arena log lacks the official replay snapshot', async () => {
    mocks.prisma.simulationLog.findFirst.mockResolvedValueOnce({
      id: 'legacy-log',
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
      inputParams: {
        replaySnapshotVersion: 1,
        runId: 'run-legacy',
        arenaTaskId: 'task-odyssey-level-one-growth',
        publicationId: 'publication-1',
      },
      metrics: {},
    });

    const result = await submitGameScore('level-1', 820, {}, {
      runId: 'run-legacy',
      arenaTaskId: 'task-odyssey-level-one-growth',
      publicationId: 'publication-forged',
      controllerId: 'PID',
      pidParams: { kp: 99, ki: 99, kd: 99 },
    });

    expect(result).toMatchObject({
      id: 'legacy-log',
      actionError: expect.objectContaining({ code: 'ODYSSEY_REPLAY_SNAPSHOT_INCOMPLETE' }),
    });
    expect(mocks.computeOfficialOdysseyTelemetry).not.toHaveBeenCalled();
    expect(mocks.bridgeOdysseyRunToArenaSubmission).not.toHaveBeenCalled();
  });

  it('uses the persisted controller-level snapshot when the profile changes before retry', async () => {
    mocks.prisma.simulationLog.findFirst.mockResolvedValueOnce({
      id: 'existing-log',
      createdAt: new Date('2026-05-15T10:00:00.000Z'),
      inputParams: {
        replaySnapshotVersion: 1,
        runId: 'run-profile-stable',
        levelId: 'level-1',
        tier: 'gold',
        controllerId: 'PID',
        controlMode: 'AUTO',
        pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
        extraParams: { speedFeedbackTau: 0.05, feedforwardGain: 0.05, smithDelay: 0.1 },
        enableSpeedFeedback: false,
        enableFeedforward: false,
        enableSmithPredictor: false,
        difficultyScale: 1,
        arenaTaskId: 'task-odyssey-level-one-growth',
        publicationId: 'publication-1',
        controllerLevels: { P: 2, PI: 2, PD: 2, PID: 2, VFB: 0, FF: 0, SMITH: 0 },
      },
      metrics: {},
    });
    mocks.prisma.studentProfile.findUnique.mockResolvedValueOnce({
      controlCredits: 10,
      controlUnlocks: ['P', 'PID'],
      controlOdysseyProgress: {},
      controlControllerLevels: { P: 9, PID: 9 },
    });

    await submitGameScore('level-1', 820, {}, {
      runId: 'run-profile-stable',
      arenaTaskId: 'task-odyssey-level-one-growth',
      controllerId: 'P',
      pidParams: { kp: 99, ki: 99, kd: 99 },
    });

    expect(mocks.computeOfficialOdysseyTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      controllerLevels: { P: 2, PI: 2, PD: 2, PID: 2, VFB: 0, FF: 0, SMITH: 0 },
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
    }));
  });

  it('claims a run atomically under Promise.all and executes official side effects once', async () => {
    let storedLog: Record<string, any> | null = null;
    mocks.prisma.simulationLog.findUnique.mockImplementation(async () => storedLog);
    mocks.prisma.simulationLog.findFirst.mockResolvedValue(null);
    mocks.prisma.simulationLog.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      if (storedLog) {
        throw Object.assign(new Error('unique constraint'), { code: 'P2002' });
      }
      storedLog = {
        ...data,
        id: 'concurrent-log',
        createdAt: new Date('2026-05-15T10:00:00.000Z'),
        odysseyCompletedAt: null,
      };
      await Promise.resolve();
      return storedLog;
    });
    mocks.prisma.simulationLog.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      storedLog = { ...storedLog, ...data };
      return storedLog;
    });

    const context = {
      runId: 'run-concurrent',
      arenaTaskId: 'task-odyssey-level-one-growth',
      publicationId: 'publication-1',
      tier: 'gold',
      controllerId: 'PID' as const,
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
    };
    const [first, second] = await Promise.all([
      submitGameScore('level-1', 820, { settlingTime: 2.8 }, context),
      submitGameScore('level-1', 820, { settlingTime: 2.8 }, context),
    ]);

    expect(first).toMatchObject({ id: 'concurrent-log' });
    expect(second).toMatchObject({ id: 'concurrent-log' });
    expect(mocks.prisma.simulationLog.create).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.studentProfile.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.computeOfficialOdysseyTelemetry).toHaveBeenCalledTimes(1);
    expect(mocks.resolveAccessibleArenaPublicationForStudent).toHaveBeenCalledTimes(1);
    expect(mocks.bridgeOdysseyRunToArenaSubmission).toHaveBeenCalledTimes(1);
  });

  it('creates fresh default controller state for a missing authenticated profile', async () => {
    mocks.prisma.studentProfile.findUnique.mockResolvedValueOnce(null);

    const profile = await getControlProfile();

    expect(profile).toMatchObject({
      credits: 0,
      unlocks: ['P'],
      controllerLevels: expect.objectContaining({ P: 1, PID: 0 }),
    });
    expect(mocks.prisma.studentProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'student-1',
        controlUnlocks: ['P'],
        controlControllerLevels: expect.objectContaining({ P: 1, PID: 0 }),
      }),
    });
  });

  it('keeps the public leaderboard readable for unauthenticated visitors', async () => {
    mocks.getServerSession.mockResolvedValueOnce(null);
    mocks.prisma.simulationLog.findMany.mockResolvedValueOnce([
      {
        userId: 'student-1',
        score: 910,
        metrics: { maxOvershoot: 5 },
        inputParams: { tier: 'gold' },
        createdAt: new Date('2026-06-12T00:00:00.000Z'),
        user: {
          name: '学生甲',
          image: null,
          email: 'student@example.com',
        },
      },
    ]);

    const leaderboard = await getLevelLeaderboard('level-1');

    expect(leaderboard).toEqual([
      expect.objectContaining({
        rank: 1,
        userName: '学生甲',
        score: 910,
        tier: 'gold',
      }),
    ]);
    expect(mocks.prisma.simulationLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.any(Array),
      }),
    }));
  });

  it('resolves publication context before creating an Odyssey Arena bridge submission', async () => {
    await submitGameScore('level-1', 820, { settlingTime: 2.8 }, {
      runId: 'run-001',
      arenaTaskId: 'task-odyssey-level-one-growth',
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
      metrics: expect.objectContaining({
        settlingTime: 4.2,
        officialTelemetrySource: 'server-rust-simulation',
      }),
    }));
  });

  it('keeps normal Odyssey gameplay out of official Arena submissions without matching arenaTask', async () => {
    await submitGameScore('level-1', 820, {
      settlingTime: 2.8,
      maxOvershoot: 7,
      steadyError: 3,
      controlEnergy: 5,
    }, {
      runId: 'run-regular-game',
      tier: 'gold',
      controllerId: 'PID',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
    });

    expect(mocks.resolveAccessibleArenaPublicationForStudent).not.toHaveBeenCalled();
    expect(mocks.bridgeOdysseyRunToArenaSubmission).not.toHaveBeenCalled();
    expect(mocks.prisma.studentProfile.upsert).toHaveBeenCalled();
  });

  it('does not trust season scope from the Odyssey score submission context', async () => {
    await submitGameScore('level-1', 820, {
      settlingTime: 2.8,
      maxOvershoot: 7,
      steadyError: 3,
      controlEnergy: 5,
    }, {
      runId: 'run-open-task',
      arenaTaskId: 'task-odyssey-level-one-growth',
      tier: 'gold',
      controllerId: 'PID',
      controlMode: 'AUTO',
      pidParams: { kp: 2.1, ki: 0.4, kd: 0.12 },
      seasonId: 'forged-season',
    } as any);

    expect(mocks.resolveAccessibleArenaPublicationForStudent).not.toHaveBeenCalled();
    expect(mocks.bridgeOdysseyRunToArenaSubmission).toHaveBeenCalledWith(expect.not.objectContaining({
      seasonId: 'forged-season',
    }));
  });

  it('does not create an Arena bridge submission when publication access is denied', async () => {
    const { ArenaPublicationAccessError } = await import('@/features/arena/teacher/publication-store');
    mocks.resolveAccessibleArenaPublicationForStudent.mockRejectedValueOnce(
      new ArenaPublicationAccessError('Student is not allowed to access this Arena publication.'),
    );

    await submitGameScore('level-1', 820, { settlingTime: 2.8 }, {
      runId: 'run-001',
      arenaTaskId: 'task-odyssey-level-one-growth',
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

  it('does not create an Arena bridge submission when server-side telemetry cannot be verified', async () => {
    mocks.computeOfficialOdysseyTelemetry.mockImplementationOnce(() => {
      throw new Error('Server-side Odyssey telemetry simulation failed.');
    });

    await submitGameScore('level-1', 820, { settlingTime: 2.8 }, {
      runId: 'run-001',
      arenaTaskId: 'task-odyssey-level-one-growth',
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
            reason: 'Server-side Odyssey telemetry simulation failed.',
            gameScorePreserved: true,
          }),
        }),
      }),
    }));
  });

  it('does not create an Arena bridge submission for manual runs without input trace replay', async () => {
    mocks.computeOfficialOdysseyTelemetry.mockImplementationOnce(() => {
      throw new Error('Manual Odyssey runs require input trace replay before official Arena submission.');
    });

    await submitGameScore('level-1', 820, { settlingTime: 2.8 }, {
      runId: 'run-manual',
      arenaTaskId: 'task-odyssey-level-one-growth',
      tier: 'gold',
      controllerId: 'P',
      controlMode: 'MANUAL',
      pidParams: { kp: 2.1, ki: 0, kd: 0 },
      publicationId: 'publication-1',
    });

    expect(mocks.bridgeOdysseyRunToArenaSubmission).not.toHaveBeenCalled();
    expect(mocks.prisma.simulationLog.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'log-1' },
      data: expect.objectContaining({
        metrics: expect.objectContaining({
          arenaBridge: expect.objectContaining({
            ok: false,
            reason: 'Manual Odyssey runs require input trace replay before official Arena submission.',
            gameScorePreserved: true,
          }),
        }),
      }),
    }));
  });
});
