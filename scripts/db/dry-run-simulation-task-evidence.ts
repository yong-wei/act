import { createHash } from 'node:crypto';

import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  runHistoricalTaskEvidenceDryRun,
  type HistoricalRecord,
} from '../../src/lib/data-governance/simulation-task-historical-dryrun';
import {
  hashSemanticFingerprintValue,
  hashSimulationTaskSpecKeyInputs,
} from '../../src/lib/data-governance/simulation-task-evidence';

const prisma = createPrismaClient();

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readRole(value: string): string {
  return value.toLowerCase();
}

function hashIdentifier(kind: string, value: string): string {
  const digest = createHash('sha256').update(`${kind}\u001f${value}`).digest('hex');
  return `${kind}:v1:${digest}`;
}

async function collectHistoricalRecords(): Promise<HistoricalRecord[]> {
  const [simulationRuns, controlResponses, arenaSubmissions, odysseyLogs] = await Promise.all([
    prisma.simulationRun.findMany({
      where: {
        runKind: 'scene_simulation',
        sourceDomain: 'simulation_scene',
        status: 'completed',
        ownerUserId: { not: null },
        completedAt: { not: null },
      },
      select: {
        id: true,
        ownerUserId: true,
        owner: { select: { role: true } },
        resourceId: true,
        taskSpecSnapshot: true,
        controllerSnapshotRef: true,
        summary: true,
        modelVersion: true,
        completedAt: true,
      },
    }),
    prisma.studentStepResponse.findMany({
      where: {
        sourceLogId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        user: { select: { role: true } },
        sourceLogId: true,
        submittedAt: true,
        responseData: true,
      },
    }),
    prisma.arenaSubmission.findMany({
      select: {
        id: true,
        userId: true,
        user: { select: { role: true } },
        taskId: true,
        artifactHash: true,
        valid: true,
        score: true,
        isLate: true,
        submittedAt: true,
      },
    }),
    prisma.simulationLog.findMany({
      where: {
        odysseyCompletedAt: { not: null },
      },
      select: {
        id: true,
        userId: true,
        user: { select: { role: true } },
        inputParams: true,
        metrics: true,
        score: true,
        odysseyCompletedAt: true,
      },
    }),
  ]);

  const records: HistoricalRecord[] = simulationRuns.map((run) => {
    const taskSpec = readRecord(run.taskSpecSnapshot);
    return {
      id: `SimulationRun:${run.id}`,
      userId: run.ownerUserId,
      actorRole: readRole(run.owner.role),
      occurredAt: run.completedAt?.toISOString() ?? null,
      source: 'virtual-simulation',
      eventType: 'simulation_finish',
      namedTaskId: run.resourceId
        ?? readString(taskSpec, 'resourceId')
        ?? readString(taskSpec, 'sceneId'),
      sourceArtifactId: run.id,
      tier: 'run',
      fingerprint: {
        plantRef: readString(taskSpec, 'plantRef') ?? readString(taskSpec, 'sceneId') ?? undefined,
        modelRef: run.modelVersion,
        controllerConfigHash: run.controllerSnapshotRef
          ? hashSemanticFingerprintValue(run.controllerSnapshotRef)
          : undefined,
        keyInputHash: hashSimulationTaskSpecKeyInputs(taskSpec),
      },
    };
  });
  const simulationRunById = new Map(simulationRuns.map((run) => [run.id, run]));

  for (const response of controlResponses) {
    const responseData = readRecord(response.responseData);
    const evidence = readRecord(responseData.controlWorkbenchEvidence);
    if (Object.keys(evidence).length === 0) continue;
    const payload = readRecord(evidence.payload);
    const selectedDesignState = readRecord(payload.selectedDesignState);
    const simulationRunRefs = Array.isArray(payload.derivedResultRefs)
      ? payload.derivedResultRefs.filter((value) => {
          const ref = readRecord(value);
          return readString(ref, 'kind') === 'SimulationRun' && readString(ref, 'id') !== null;
        })
      : [];
    const verifiedRuns = simulationRunRefs
      .map((value) => readString(readRecord(value), 'id'))
      .filter((value): value is string => value !== null)
      .map((runId) => simulationRunById.get(runId))
      .filter((run) => run?.ownerUserId === response.userId && run.completedAt !== null)
      .filter((run) => run !== undefined);
    const runsForRecord = verifiedRuns.length > 0 ? verifiedRuns : [undefined];
    for (const verifiedRun of runsForRecord) {
      const taskSpec = readRecord(verifiedRun?.taskSpecSnapshot);
      records.push({
        id: verifiedRun
          ? `StudentStepResponse:${response.id}:SimulationRun:${verifiedRun.id}`
          : `StudentStepResponse:${response.id}`,
        userId: response.userId,
        actorRole: readRole(response.user.role),
        occurredAt: verifiedRun?.completedAt?.toISOString() ?? response.submittedAt.toISOString(),
        source: 'control-workbench',
        eventType: 'workspace_submission',
        sourceArtifactId: verifiedRun?.id ?? response.sourceLogId,
        tier: 'submission',
        hasPersistedDesign: Object.keys(selectedDesignState).length > 0
          && verifiedRun !== undefined,
        fingerprint: {
          plantRef: readString(taskSpec, 'plantRef')
            ?? readString(taskSpec, 'sceneId')
            ?? verifiedRun?.resourceId
            ?? undefined,
          modelRef: verifiedRun?.modelVersion,
          controllerConfigHash: verifiedRun?.controllerSnapshotRef
            ? hashSemanticFingerprintValue(verifiedRun.controllerSnapshotRef)
            : undefined,
          keyInputHash: hashSimulationTaskSpecKeyInputs(taskSpec),
        },
      });
    }
  }

  records.push(...arenaSubmissions.map((submission): HistoricalRecord => ({
    id: `ArenaSubmission:${submission.id}`,
    userId: submission.userId,
    actorRole: readRole(submission.user.role),
    occurredAt: submission.submittedAt.toISOString(),
    source: 'arena',
    eventType: 'arena_submit',
    arenaTaskId: submission.taskId,
    sourceArtifactId: submission.id,
    tier: 'submission',
    accepted: submission.valid && !submission.isLate && submission.score > 0,
    evaluationValid: submission.valid,
    fingerprint: {
      modelRef: submission.taskId,
      controllerConfigHash: submission.artifactHash,
    },
  })));

  records.push(...odysseyLogs.map((log): HistoricalRecord => {
    const replay = readRecord(log.inputParams);
    const isArenaAssigned = replay.arenaAssigned === true;
    return {
      id: `SimulationLog:${log.id}`,
      userId: log.userId,
      actorRole: readRole(log.user.role),
      occurredAt: log.odysseyCompletedAt?.toISOString() ?? null,
      source: 'odyssey',
      eventType: 'odyssey_persistent_clear',
      odysseyLevelId: readString(replay, 'levelId'),
      isArenaAssigned,
      arenaTaskId: readString(replay, 'arenaTaskId'),
      sourceArtifactId: log.id,
      tier: 'clear',
      persistentClear: true,
      fingerprint: {
        modelRef: readString(replay, 'levelId') ?? undefined,
        controllerConfigHash: hashSemanticFingerprintValue(replay),
        keyInputHash: hashSemanticFingerprintValue(log.metrics),
      },
    };
  }));

  return records;
}

function sanitizeReport(report: ReturnType<typeof runHistoricalTaskEvidenceDryRun>) {
  return {
    ...report,
    candidates: report.candidates.map((candidate) => ({
      ...candidate,
      recordId: hashIdentifier('record', candidate.recordId),
      userId: hashIdentifier('student', candidate.userId),
    })),
    skips: report.skips.map((skip) => ({
      ...skip,
      recordId: hashIdentifier('record', skip.recordId),
    })),
  };
}

async function main() {
  const records = await collectHistoricalRecords();
  const report = sanitizeReport(runHistoricalTaskEvidenceDryRun(records));
  console.log(JSON.stringify(report, null, process.argv.includes('--compact') ? 0 : 2));
}

main()
  .catch((error) => {
    console.error('[SimulationTaskEvidenceDryRun] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
