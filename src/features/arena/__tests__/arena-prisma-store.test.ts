import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    arenaSubmission: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    evidenceOutbox: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { prismaArenaSubmissionStore } from '../submissions/prisma-store';
import { isArenaSubmissionEffectiveForRanking } from '../submissions/ranking-policy';
import type { ControllerArtifact } from '../types';

const artifact: ControllerArtifact = {
  id: 'artifact-prisma-store',
  taskId: 'task-second-order-lead-pid',
  method: 'pid',
  params: { kp: 2.4, ki: 0.8, kd: 0.35 },
  createdAt: '2026-05-15T10:00:00.000Z',
};

function submissionRow(id: string, protocolVersion: string, overrides: Partial<ControllerArtifact> = {}) {
  const rowArtifact = {
    ...artifact,
    ...overrides,
    params: overrides.params ?? artifact.params,
  };
  return {
    id,
    taskId: rowArtifact.taskId,
    userId: `user-${id}`,
    classId: null,
    seasonId: null,
    publicationId: null as string | null,
    studentLabel: `学生 ${id}`,
    artifactHash: `artifact-hash-${id}`,
    method: rowArtifact.method,
    score: 80,
    valid: true,
    submittedAt: new Date('2026-05-15T10:00:00.000Z'),
    controllerArtifact: {
      payload: rowArtifact,
    },
    user: {
      profile: {
        studentNumber: `S-${id}`,
      },
    },
    evaluationRun: {
      id: `eval-${id}`,
      taskId: rowArtifact.taskId,
      artifactHash: `artifact-hash-${id}`,
      protocolVersion,
      artifactPayload: rowArtifact,
      valid: true,
      score: 80,
      metrics: {},
      satisfaction: {},
      hardConstraintResults: [],
      penalties: [],
      explanation: [],
      completedAt: new Date('2026-05-15T10:00:00.000Z'),
    },
  };
}

describe('prismaArenaSubmissionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.prisma.evidenceOutbox.findMany.mockResolvedValue([]);
    mocks.prisma.arenaSubmission.findFirst.mockResolvedValue(null);
    mocks.prisma.arenaSubmission.findUnique.mockResolvedValue(null);
    mocks.prisma.arenaSubmission.create.mockReset();
  });

  it('returns an empty submission list when Arena tables have not been migrated yet', async () => {
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(Object.assign(new Error('missing table'), {
      code: 'P2021',
    }));

    await expect(prismaArenaSubmissionStore.listSubmissions()).resolves.toEqual([]);
  });

  it('returns an empty submission list when Arena submission columns have not been migrated yet', async () => {
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(Object.assign(new Error('missing publicationId column'), {
      code: 'P2022',
      meta: {
        modelName: 'ArenaSubmission',
        column: 'ArenaSubmission.publicationId',
      },
    }));

    await expect(prismaArenaSubmissionStore.listSubmissions()).resolves.toEqual([]);
  });

  it('rethrows missing Arena submission columns in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = Object.assign(new Error('missing publicationId column'), {
      code: 'P2022',
      meta: {
        modelName: 'ArenaSubmission',
        column: 'ArenaSubmission.publicationId',
      },
    });
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(error);

    await expect(prismaArenaSubmissionStore.listSubmissions()).rejects.toBe(error);
  });

  it('returns an empty submission list in local development when DATABASE_URL is missing', async () => {
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(
      new Error('Environment variable not found: DATABASE_URL'),
    );

    await expect(prismaArenaSubmissionStore.listSubmissions()).resolves.toEqual([]);
  });

  it('returns an empty submission list in tests when the Arena Prisma delegate is absent', async () => {
    const originalDelegate = mocks.prisma.arenaSubmission;
    (mocks.prisma as { arenaSubmission?: unknown }).arenaSubmission = undefined;

    try {
      await expect(prismaArenaSubmissionStore.listSubmissions()).resolves.toEqual([]);
    } finally {
      mocks.prisma.arenaSubmission = originalDelegate;
    }
  });

  it('rethrows non-migration errors while listing submissions', async () => {
    const error = Object.assign(new Error('connection failed'), { code: 'P1001' });
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(error);

    await expect(prismaArenaSubmissionStore.listSubmissions()).rejects.toBe(error);
  });

  it('excludes legacy whitebox-v1 submissions by default', async () => {
    mocks.prisma.arenaSubmission.findMany.mockResolvedValueOnce([
      submissionRow('legacy', 'whitebox-v1'),
      submissionRow('current', 'analysis-whitebox-v1'),
      submissionRow('blackbox-current', 'blackbox-official-v1', {
        taskId: 'task-cruise-roll-blackbox-identification',
        method: 'black-box-control',
        params: {
          representation: 'identified-model-controller',
          experimentDatasetHash: 'arena-blackbox-dataset-test1234567890',
          identificationModelId: 'arena-identification-test12345678',
          identificationQuality: 0.82,
          experimentCount: 6,
          controllerGain: 1.6,
          dampingCompensation: 0.72,
          energyBudget: 12,
        },
      }),
      submissionRow('mpc-current', 'template-whitebox-v1', {
        taskId: 'task-ship-roll-mpc-hidden-scenarios',
        method: 'mpc',
        params: {
          template: 'bounded-linear-mpc',
          predictionHorizon: 18,
          controlHorizon: 5,
          outputWeight: 1.4,
          controlWeight: 0.32,
          terminalWeight: 2,
          inputLimit: 4.5,
          sampleTime: 0.1,
        },
      }),
    ]);

    const submissions = await prismaArenaSubmissionStore.listSubmissions();

    expect(submissions.map((submission) => submission.id)).toEqual([
      'current',
      'blackbox-current',
      'mpc-current',
    ]);
    expect(submissions.map((submission) => submission.evaluationProtocolVersion)).toEqual([
      'analysis-whitebox-v1',
      'blackbox-official-v1',
      'template-whitebox-v1',
    ]);
  });

  it('includes legacy whitebox-v1 submissions only when explicitly requested', async () => {
    mocks.prisma.arenaSubmission.findMany.mockResolvedValueOnce([
      submissionRow('legacy', 'whitebox-v1'),
      submissionRow('current', 'analysis-whitebox-v1'),
    ]);

    const submissions = await prismaArenaSubmissionStore.listSubmissions({ includeLegacyProtocols: true });

    expect(submissions.map((submission) => submission.id)).toEqual(['legacy', 'current']);
    expect(submissions.map((submission) => submission.evaluationProtocolVersion)).toEqual([
      'whitebox-v1',
      'analysis-whitebox-v1',
    ]);
  });

  it('assembles student numbers from student profiles for leaderboard display', async () => {
    mocks.prisma.arenaSubmission.findMany.mockResolvedValueOnce([
      submissionRow('current', 'analysis-whitebox-v1'),
    ]);

    const submissions = await prismaArenaSubmissionStore.listSubmissions();

    expect(mocks.prisma.arenaSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        user: {
          select: {
            profile: {
              select: {
                studentNumber: true,
              },
            },
          },
        },
      }),
    }));
    expect(submissions[0]?.studentNumber).toBe('S-current');
  });

  it('attaches persisted evidence writeback outcomes from the shared outbox ledger', async () => {
    mocks.prisma.arenaSubmission.findMany.mockResolvedValueOnce([
      submissionRow('current', 'analysis-whitebox-v1'),
    ]);
    mocks.prisma.evidenceOutbox.findMany.mockResolvedValueOnce([
      {
        causationId: 'current',
        status: 'processed',
        payload: {
          evidenceWriteback: {
            status: 'accepted',
            sourceRef: { kind: 'ArenaSubmission', id: 'current' },
            attemptStatus: 'effective',
            visibilityState: 'materialized',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
            recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
            limitationCodes: [],
            overlayCount: 1,
            terminalValidationAccepted: true,
          },
        },
      },
    ]);

    const submissions = await prismaArenaSubmissionStore.listSubmissions();

    expect(mocks.prisma.evidenceOutbox.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        eventType: 'arena.kaq_evidence_writeback',
        causationId: { in: ['current'] },
      }),
    }));
    expect(submissions[0]?.evidenceWriteback).toMatchObject({
      status: 'accepted',
      sourceRef: { kind: 'ArenaSubmission', id: 'current' },
      visibilityState: 'materialized',
      terminalValidationAccepted: true,
    });
  });

  it('finds duplicate submissions only after a prior same-context accepted writeback was processed', async () => {
    const first = submissionRow('first', 'analysis-whitebox-v1');
    first.publicationId = 'publication-a';
    mocks.prisma.arenaSubmission.findMany.mockResolvedValueOnce([first]);
    mocks.prisma.evidenceOutbox.findMany.mockResolvedValueOnce([
      {
        causationId: 'first',
        status: 'processed',
        payload: {
          evidenceWriteback: {
            status: 'accepted',
            sourceRef: { kind: 'ArenaSubmission', id: 'first' },
            attemptStatus: 'effective',
            visibilityState: 'materialized',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
            recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
            limitationCodes: [],
            overlayCount: 1,
            terminalValidationAccepted: true,
          },
        },
      },
    ]);

    const duplicate = await prismaArenaSubmissionStore.findDuplicateSubmissionByArtifact?.({
      taskId: first.taskId,
      userId: first.userId,
      publicationId: first.publicationId,
      artifactHash: first.artifactHash,
      protocolVersion: 'analysis-whitebox-v1',
    });

    expect(mocks.prisma.arenaSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        taskId: first.taskId,
        userId: first.userId,
        publicationId: first.publicationId,
        artifactHash: first.artifactHash,
      }),
    }));
    expect(duplicate?.id).toBe('first');
  });

  it('does not treat an orphan prior submission without accepted writeback as duplicate on retry', async () => {
    const orphan = submissionRow('orphan', 'analysis-whitebox-v1');
    orphan.publicationId = 'publication-a';
    mocks.prisma.arenaSubmission.findMany.mockResolvedValueOnce([orphan]);
    mocks.prisma.evidenceOutbox.findMany.mockResolvedValueOnce([]);

    const duplicate = await prismaArenaSubmissionStore.findDuplicateSubmissionByArtifact?.({
      taskId: orphan.taskId,
      userId: orphan.userId,
      publicationId: orphan.publicationId,
      artifactHash: orphan.artifactHash,
      protocolVersion: 'analysis-whitebox-v1',
    });

    expect(duplicate).toBeNull();
  });

  it('returns the atomically claimed submission as effective when the attempt key collides', async () => {
    const existing = {
      ...submissionRow('first', 'analysis-whitebox-v1'),
      submissionAttemptKey: 'user-first:publication-a:task-second-order-lead-pid:artifact-hash-first:analysis-whitebox-v1',
    };
    existing.publicationId = 'publication-a';
    const conflict = Object.assign(new Error('Unique constraint failed on the fields: (`submissionAttemptKey`)'), {
      code: 'P2002',
      meta: {
        target: ['submissionAttemptKey'],
      },
    });
    mocks.prisma.arenaSubmission.create.mockRejectedValueOnce(conflict);
    mocks.prisma.arenaSubmission.findUnique.mockResolvedValueOnce(existing);

    const created = await prismaArenaSubmissionStore.createSubmission({
      taskId: existing.taskId,
      userId: existing.userId,
      publicationId: existing.publicationId,
      studentLabel: existing.studentLabel,
      artifactHash: existing.artifactHash,
      artifact,
      evaluation: {
        taskId: existing.taskId,
        artifact,
        valid: true,
        score: 80,
        metrics: {},
        satisfaction: {},
        hardConstraintResults: [],
        penalties: [],
        explanation: [],
      },
      evaluationProtocolVersion: 'analysis-whitebox-v1',
      submissionAttemptKey: existing.submissionAttemptKey,
      submittedAt: '2026-05-15T10:00:00.000Z',
      artifactId: 'artifact-row',
      evaluationId: 'eval-first',
    });

    expect(mocks.prisma.arenaSubmission.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        submissionAttemptKey: existing.submissionAttemptKey,
      }),
    }));
    expect(mocks.prisma.arenaSubmission.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        submissionAttemptKey: existing.submissionAttemptKey,
      },
    }));
    expect(created.id).toBe('first');
    expect(created.reusedEvaluation).toBe(false);
  });

  it('rebuilds same-student duplicate-only submissions from persisted duplicate evaluation keys and excludes blocked writebacks from ranking', async () => {
    const first = submissionRow('first', 'analysis-whitebox-v1');
    const duplicate = submissionRow('duplicate', 'analysis-whitebox-v1');
    first.publicationId = 'publication-a';
    duplicate.userId = first.userId;
    duplicate.publicationId = first.publicationId;
    duplicate.artifactHash = first.artifactHash;
    duplicate.evaluationRun.artifactHash = first.evaluationRun.artifactHash;
    mocks.prisma.arenaSubmission.findMany.mockResolvedValueOnce([first, duplicate]);
    mocks.prisma.evidenceOutbox.findMany.mockResolvedValueOnce([
      {
        causationId: 'first',
        status: 'processed',
        payload: {
          evidenceWriteback: {
            status: 'accepted',
            sourceRef: { kind: 'ArenaSubmission', id: 'first' },
            attemptStatus: 'effective',
            visibilityState: 'materialized',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
            recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
            limitationCodes: [],
            overlayCount: 1,
            terminalValidationAccepted: true,
          },
        },
      },
      {
        causationId: 'duplicate',
        payload: {
          evidenceWriteback: {
            status: 'blocked',
            sourceRef: { kind: 'ArenaSubmission', id: 'duplicate' },
            attemptStatus: 'duplicate-only',
            visibilityState: 'diagnostic-only',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '重复官方提交复用既有评测，只保留诊断记录，不新增终端掌握判定。',
            recoveryAction: '重新提交一次截止前、有效且非零分的官方 Arena 结果；若仍无法写回，请由教师在报告中复核证据绑定。',
            limitationCodes: ['attempt-not-effective:duplicate-only'],
            overlayCount: 0,
            terminalValidationAccepted: false,
          },
        },
      },
    ]);

    const submissions = await prismaArenaSubmissionStore.listSubmissions({ evidenceWritebackConsumer: 'teacher' });

    expect(submissions.map((submission) => ({
      id: submission.id,
      reusedEvaluation: submission.reusedEvaluation,
      status: submission.evidenceWriteback?.status,
      attemptStatus: submission.evidenceWriteback?.attemptStatus,
      effective: isArenaSubmissionEffectiveForRanking(submission),
    }))).toEqual([
      {
        id: 'first',
        reusedEvaluation: false,
        status: 'accepted',
        attemptStatus: 'effective',
        effective: true,
      },
      {
        id: 'duplicate',
        reusedEvaluation: true,
        status: 'blocked',
        attemptStatus: 'duplicate-only',
        effective: false,
      },
    ]);
  });

  it('does not mark different students as duplicate-only when they submit the same evaluated artifact', async () => {
    const first = submissionRow('first', 'analysis-whitebox-v1');
    const peer = submissionRow('peer', 'analysis-whitebox-v1');
    first.publicationId = 'publication-a';
    peer.publicationId = first.publicationId;
    peer.artifactHash = first.artifactHash;
    peer.evaluationRun.artifactHash = first.evaluationRun.artifactHash;
    mocks.prisma.arenaSubmission.findMany.mockResolvedValueOnce([first, peer]);
    mocks.prisma.evidenceOutbox.findMany.mockResolvedValueOnce([
      {
        causationId: 'first',
        status: 'processed',
        payload: {
          evidenceWriteback: {
            status: 'accepted',
            sourceRef: { kind: 'ArenaSubmission', id: 'first' },
            attemptStatus: 'effective',
            visibilityState: 'materialized',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
            recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
            limitationCodes: [],
            overlayCount: 1,
            terminalValidationAccepted: true,
          },
        },
      },
      {
        causationId: 'peer',
        status: 'processed',
        payload: {
          evidenceWriteback: {
            status: 'accepted',
            sourceRef: { kind: 'ArenaSubmission', id: 'peer' },
            attemptStatus: 'effective',
            visibilityState: 'materialized',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
            recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
            limitationCodes: [],
            overlayCount: 1,
            terminalValidationAccepted: true,
          },
        },
      },
    ]);

    const submissions = await prismaArenaSubmissionStore.listSubmissions({ evidenceWritebackConsumer: 'teacher' });

    expect(submissions.map((submission) => ({
      id: submission.id,
      reusedEvaluation: submission.reusedEvaluation,
      effective: isArenaSubmissionEffectiveForRanking(submission),
    }))).toEqual([
      {
        id: 'first',
        reusedEvaluation: false,
        effective: true,
      },
      {
        id: 'peer',
        reusedEvaluation: false,
        effective: true,
      },
    ]);
  });

  it('lets a retry become effective when the earlier same-student submission has no accepted persisted writeback', async () => {
    const orphan = submissionRow('orphan', 'analysis-whitebox-v1');
    const retry = submissionRow('retry', 'analysis-whitebox-v1');
    orphan.publicationId = 'publication-a';
    retry.userId = orphan.userId;
    retry.publicationId = orphan.publicationId;
    retry.artifactHash = orphan.artifactHash;
    retry.evaluationRun.artifactHash = orphan.evaluationRun.artifactHash;
    mocks.prisma.arenaSubmission.findMany.mockResolvedValueOnce([orphan, retry]);
    mocks.prisma.evidenceOutbox.findMany.mockResolvedValueOnce([
      {
        causationId: 'retry',
        status: 'processed',
        payload: {
          evidenceWriteback: {
            status: 'accepted',
            sourceRef: { kind: 'ArenaSubmission', id: 'retry' },
            attemptStatus: 'effective',
            visibilityState: 'materialized',
            targetLabel: '控制校正 Arena 官方迁移验证',
            summary: '官方 Arena 结果已写入学生证据时间线，并可作为终端验证证据。',
            recoveryAction: '无需处理；教师报告可直接引用该官方证据。',
            limitationCodes: [],
            overlayCount: 1,
            terminalValidationAccepted: true,
          },
        },
      },
    ]);

    const submissions = await prismaArenaSubmissionStore.listSubmissions({ evidenceWritebackConsumer: 'teacher' });

    expect(submissions.map((submission) => ({
      id: submission.id,
      reusedEvaluation: submission.reusedEvaluation,
      status: submission.evidenceWriteback?.status ?? 'missing',
      effective: isArenaSubmissionEffectiveForRanking(submission),
    }))).toEqual([
      {
        id: 'orphan',
        reusedEvaluation: false,
        status: 'missing',
        effective: false,
      },
      {
        id: 'retry',
        reusedEvaluation: false,
        status: 'accepted',
        effective: true,
      },
    ]);
  });
});
