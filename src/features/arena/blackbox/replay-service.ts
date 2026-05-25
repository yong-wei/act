import { prisma } from '@/lib/prisma';

import {
  buildArenaVirtualSimulationPreview,
  computeArenaVirtualSimulationPreviewChecksum,
  type ArenaVirtualSimulationPreviewRun,
  type StoredArenaVirtualSimulationRun,
} from './controller-preview';

export type ArenaReplayRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface ArenaReplayRequester {
  userId: string;
  role: ArenaReplayRole;
}

export interface ArenaReplayRunRecord extends StoredArenaVirtualSimulationRun {
  ownerClassId?: string | null;
  ownerClassTeacherId?: string | null;
}

export interface ArenaReplayRunStore {
  findVirtualSimulationRunById(runId: string): Promise<ArenaReplayRunRecord | null>;
}

export type ArenaReplayVerificationStatus = 'match' | 'mismatch' | 'missing_trace';

export interface ArenaReplayVerificationResult {
  runId: string;
  status: ArenaReplayVerificationStatus;
  persistedChecksum: string | null;
  recomputedChecksum: string | null;
  metadata: {
    taskId?: string;
    scenarioId?: string;
    seed?: number;
    protocolVersion?: string;
    runtimeVersion?: string;
    modelVersion?: string;
  };
}

export class ArenaReplayNotFoundError extends Error {
  constructor(message = 'Replay run not found.') {
    super(message);
    this.name = 'ArenaReplayNotFoundError';
  }
}

export class ArenaReplayAccessError extends Error {
  constructor(message = 'Replay access is not allowed.') {
    super(message);
    this.name = 'ArenaReplayAccessError';
  }
}

function canAccessRun(
  requester: ArenaReplayRequester,
  run: ArenaReplayRunRecord,
): boolean {
  if (requester.role === 'ADMIN') return true;
  if (requester.role === 'STUDENT') return run.userId === requester.userId;
  if (requester.role === 'TEACHER') return run.ownerClassTeacherId === requester.userId;
  return false;
}

function metadataFor(preview: ArenaVirtualSimulationPreviewRun) {
  return {
    taskId: preview.taskId,
    scenarioId: preview.replay?.scenarioId ?? preview.scenarioId,
    seed: preview.replay?.seed,
    protocolVersion: preview.replay?.protocolVersion,
    runtimeVersion: preview.replay?.runtimeVersion,
    modelVersion: preview.replay?.modelVersion,
  };
}

export async function verifyArenaVirtualSimulationReplay(input: {
  runId: string;
  requester: ArenaReplayRequester;
  store: ArenaReplayRunStore;
}): Promise<ArenaReplayVerificationResult> {
  const run = await input.store.findVirtualSimulationRunById(input.runId);
  if (!run) {
    throw new ArenaReplayNotFoundError();
  }

  if (!canAccessRun(input.requester, run)) {
    throw new ArenaReplayAccessError();
  }

  const preview = run.preview;
  if (
    !preview.replay ||
    !preview.replaySource ||
    !Array.isArray(preview.trace) ||
    preview.trace.length === 0
  ) {
    return {
      runId: run.id,
      status: 'missing_trace',
      persistedChecksum: preview.replay?.checksum ?? null,
      recomputedChecksum: null,
      metadata: metadataFor(preview),
    };
  }

  const replayedPreview = buildArenaVirtualSimulationPreview({
    taskId: preview.replaySource.experiment.taskId,
    artifact: preview.replaySource.artifact,
    experiment: preview.replaySource.experiment,
    now: preview.createdAt,
  });
  const recomputedChecksum = computeArenaVirtualSimulationPreviewChecksum(replayedPreview);
  const persistedChecksum = preview.replay.checksum;

  return {
    runId: run.id,
    status: recomputedChecksum === persistedChecksum ? 'match' : 'mismatch',
    persistedChecksum,
    recomputedChecksum,
    metadata: metadataFor(preview),
  };
}

export const prismaArenaReplayRunStore: ArenaReplayRunStore = {
  async findVirtualSimulationRunById(runId) {
    const row = await prisma.arenaVirtualSimulationRun.findUnique({
      where: { id: runId },
      include: {
        user: {
          select: {
            profile: {
              select: {
                classId: true,
                class: {
                  select: { teacherId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      taskId: row.taskId,
      datasetHash: row.datasetHash,
      controllerHash: row.controllerHash,
      scenarioId: row.scenarioId,
      preview: row.payload as unknown as ArenaVirtualSimulationPreviewRun,
      createdAt: row.createdAt.toISOString(),
      ownerClassId: row.user.profile?.classId ?? null,
      ownerClassTeacherId: row.user.profile?.class?.teacherId ?? null,
    };
  },
};
