import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    arenaSubmission: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { prismaArenaSubmissionStore } from '../submissions/prisma-store';
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
    studentLabel: `学生 ${id}`,
    artifactHash: `artifact-hash-${id}`,
    method: rowArtifact.method,
    score: 80,
    valid: true,
    submittedAt: new Date('2026-05-15T10:00:00.000Z'),
    controllerArtifact: {
      payload: rowArtifact,
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
  });

  it('returns an empty submission list when Arena tables have not been migrated yet', async () => {
    mocks.prisma.arenaSubmission.findMany.mockRejectedValueOnce(Object.assign(new Error('missing table'), {
      code: 'P2021',
    }));

    await expect(prismaArenaSubmissionStore.listSubmissions()).resolves.toEqual([]);
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
});
