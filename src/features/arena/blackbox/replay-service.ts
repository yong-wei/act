import { prisma } from '@/lib/prisma';
import {
  authorizeSimulationRunAccess,
  buildSimulationTaskSpec,
  type SimulationRunEnvelopeV1,
  type SimulationTaskSpecV1,
  type SimulationTraceRecordV1,
} from '@/resources/simulations/core/run-contract';

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
  classIds?: string[];
}

export interface ArenaReplayRunRecord extends StoredArenaVirtualSimulationRun {
  ownerClassId?: string | null;
  ownerClassTeacherId?: string | null;
  simulationRun?: SimulationRunEnvelopeV1 | null;
  simulationTrace?: SimulationTraceRecordV1 | null;
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
    runKind?: string;
    sourceDomain?: string;
    sourceRefId?: string;
    sceneSpecVersion?: string;
    controllerSnapshotRef?: string;
    taskSpecHash?: string;
    traceChecksum?: string;
    sampleCount?: number;
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
  if (run.simulationRun) {
    const decision = authorizeSimulationRunAccess({
      requester: {
        userId: requester.userId,
        role: requester.role,
        classIds: requester.classIds ?? [],
      },
      run: run.simulationRun,
    });
    return decision.allowed;
  }

  if (requester.role === 'ADMIN') return true;
  if (requester.role === 'STUDENT') return run.userId === requester.userId;
  if (requester.role === 'TEACHER') return run.ownerClassTeacherId === requester.userId;
  return false;
}

function metadataFor(run: ArenaReplayRunRecord, preview: ArenaVirtualSimulationPreviewRun) {
  const canonicalRun = run.simulationRun;
  const canonicalTrace = run.simulationTrace;

  return {
    taskId: preview.taskId,
    scenarioId: canonicalRun?.taskSpec.scenarioId ?? preview.replay?.scenarioId ?? preview.scenarioId,
    seed: canonicalTrace?.seed ?? canonicalRun?.seed ?? preview.replay?.seed,
    protocolVersion: canonicalTrace?.protocolVersion ?? canonicalRun?.protocolVersion ?? preview.replay?.protocolVersion,
    runtimeVersion: canonicalTrace?.runtimeVersion ?? canonicalRun?.runtimeVersion ?? preview.replay?.runtimeVersion,
    modelVersion: canonicalTrace?.modelVersion ?? canonicalRun?.modelVersion ?? preview.replay?.modelVersion,
    runKind: canonicalRun?.runKind,
    sourceDomain: canonicalRun?.sourceDomain,
    sourceRefId: canonicalRun?.sourceRefId,
    sceneSpecVersion: canonicalRun?.sceneSpecVersion ?? undefined,
    controllerSnapshotRef: canonicalRun?.controllerSnapshotRef ?? undefined,
    taskSpecHash: canonicalRun?.taskSpec.specHash,
    traceChecksum: canonicalTrace?.checksum ?? preview.replay?.checksum,
    sampleCount: canonicalTrace?.sampleCount ?? preview.trace?.length,
  };
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function taskSpecFromRow(row: Record<string, unknown>): SimulationTaskSpecV1 | null {
  const payload = readObject(row.payload);
  const sceneId = stringValue(payload.sceneId) ?? stringValue(row.sceneId);
  const scenarioId = stringValue(payload.scenarioId) ?? stringValue(row.scenarioId);
  const specHash = stringValue(payload.specHash) ?? stringValue(row.specHash);

  if (!sceneId || !scenarioId) return null;

  if (specHash && stringValue(payload.schemaVersion)) {
    return {
      schemaVersion: 'simulation-task-spec-v1',
      sceneId,
      scenarioId,
      objectives: Array.isArray(payload.objectives) ? payload.objectives.filter((item): item is string => typeof item === 'string') : [],
      constraints: Array.isArray(payload.constraints) ? payload.constraints.filter((item): item is string => typeof item === 'string') : [],
      disturbancePolicy: readObject(payload.disturbancePolicy),
      evaluationSpecRef: {
        id: stringValue(readObject(payload.evaluationSpecRef).id) ?? 'unknown',
        visibility: readObject(payload.evaluationSpecRef).visibility as SimulationTaskSpecV1['evaluationSpecRef']['visibility'],
      },
      allowedControllers: Array.isArray(payload.allowedControllers) ? payload.allowedControllers.filter((item): item is string => typeof item === 'string') : [],
      launchContext: readObject(row.launchContext),
      specHash,
    };
  }

  return buildSimulationTaskSpec({
    sceneId,
    scenarioId,
    objectives: Array.isArray(payload.objectives) ? payload.objectives.filter((item): item is string => typeof item === 'string') : [],
    constraints: Array.isArray(payload.constraints) ? payload.constraints.filter((item): item is string => typeof item === 'string') : [],
    disturbancePolicy: readObject(payload.disturbancePolicy),
    evaluationSpecRef: {
      id: stringValue(readObject(payload.evaluationSpecRef).id) ?? 'unknown',
      visibility: readObject(payload.evaluationSpecRef).visibility as SimulationTaskSpecV1['evaluationSpecRef']['visibility'],
    },
    allowedControllers: Array.isArray(payload.allowedControllers) ? payload.allowedControllers.filter((item): item is string => typeof item === 'string') : [],
    launchContext: readObject(row.launchContext),
  });
}

function simulationRunFromRow(row: Record<string, unknown>): SimulationRunEnvelopeV1 | null {
  const taskSpec = row.taskSpec
    ? taskSpecFromRow(readObject(row.taskSpec))
    : taskSpecFromRow({
      ...readObject(row.taskSpecSnapshot),
      payload: readObject(row.taskSpecSnapshot),
      sceneId: stringValue(readObject(row.taskSpecSnapshot).sceneId),
      scenarioId: stringValue(readObject(row.taskSpecSnapshot).scenarioId),
      specHash: stringValue(readObject(row.taskSpecSnapshot).specHash),
    });
  const id = stringValue(row.id);
  const runKind = stringValue(row.runKind);
  const sourceDomain = stringValue(row.sourceDomain);
  const sourceRefId = stringValue(row.sourceRefId);
  const status = stringValue(row.status);

  if (!id || !runKind || !sourceDomain || !sourceRefId || !status || !taskSpec) return null;

  return {
    id,
    ownerUserId: stringValue(row.ownerUserId) ?? null,
    classId: stringValue(row.classId) ?? null,
    courseId: stringValue(row.courseId) ?? null,
    sessionId: stringValue(row.sessionId) ?? null,
    resourceId: stringValue(row.resourceId) ?? null,
    publicationId: stringValue(row.publicationId) ?? null,
    runKind: runKind as SimulationRunEnvelopeV1['runKind'],
    sourceDomain: sourceDomain as SimulationRunEnvelopeV1['sourceDomain'],
    sourceRefId,
    taskSpec,
    controllerSnapshotRef: stringValue(row.controllerSnapshotRef) ?? null,
    status: status as SimulationRunEnvelopeV1['status'],
    summary: readObject(row.summary),
    replayToken: stringValue(row.replayToken) ?? null,
    seed: numberValue(row.seed) ?? null,
    protocolVersion: stringValue(row.protocolVersion) ?? '1.0',
    runtimeVersion: stringValue(row.runtimeVersion) ?? 'unknown',
    modelVersion: stringValue(row.modelVersion) ?? 'unknown',
    sceneSpecVersion: stringValue(row.sceneSpecVersion) ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : stringValue(row.createdAt) ?? '',
    startedAt: row.startedAt instanceof Date ? row.startedAt.toISOString() : stringValue(row.startedAt) ?? null,
    completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : stringValue(row.completedAt) ?? null,
  };
}

function simulationTraceFromRow(row: Record<string, unknown> | undefined): SimulationTraceRecordV1 | null {
  if (!row) return null;
  const id = stringValue(row.id);
  const runId = stringValue(row.runId);
  const checksum = stringValue(row.checksum);
  if (!id || !runId || !checksum) return null;

  return {
    id,
    runId,
    protocolVersion: stringValue(row.protocolVersion) ?? '1.0',
    runtimeVersion: stringValue(row.runtimeVersion) ?? 'unknown',
    modelVersion: stringValue(row.modelVersion) ?? 'unknown',
    seed: numberValue(row.seed) ?? null,
    checksum,
    summaryMetrics: readObject(row.summaryMetrics),
    sampleCount: numberValue(row.sampleCount) ?? 0,
    sampleCadence: numberValue(row.sampleCadence) ?? 0,
    sampleStorageUri: stringValue(row.sampleStorageUri) ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : stringValue(row.createdAt) ?? '',
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
      metadata: metadataFor(run, preview),
    };
  }

  const replayedPreview = buildArenaVirtualSimulationPreview({
    taskId: preview.replaySource.experiment.taskId,
    artifact: preview.replaySource.artifact,
    experiment: preview.replaySource.experiment,
    now: preview.createdAt,
  });
  const recomputedChecksum = computeArenaVirtualSimulationPreviewChecksum(replayedPreview);
  const persistedChecksum = run.simulationTrace?.checksum ?? preview.replay.checksum;

  return {
    runId: run.simulationRun?.id ?? run.id,
    status: recomputedChecksum === persistedChecksum ? 'match' : 'mismatch',
    persistedChecksum,
    recomputedChecksum,
    metadata: metadataFor(run, preview),
  };
}

export const prismaArenaReplayRunStore: ArenaReplayRunStore = {
  async findVirtualSimulationRunById(runId) {
    const db = prisma as any;
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

    const canonical = await db.simulationRun?.findFirst({
      where: {
        sourceDomain: 'arena_virtual_preview',
        sourceRefId: row.id,
      },
      include: {
        taskSpec: true,
        traces: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    const canonicalRecord = canonical ? readObject(canonical) : null;
    const canonicalTraces = Array.isArray(canonicalRecord?.traces) ? canonicalRecord.traces : [];
    const simulationRun = canonicalRecord ? simulationRunFromRow(canonicalRecord) : null;
    const simulationTrace = simulationTraceFromRow(readObject(canonicalTraces[0]));

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
      simulationRun,
      simulationTrace,
    };
  },
};
