import { createHash } from 'node:crypto';

import type { Prisma } from '@prisma/client';

import {
  assertPreviewOrPracticeNotOfficial,
  projectPracticeOutcomeIdentity,
  projectSimulationRunIdentity,
  type ArtifactRunIdentity,
} from '@/lib/practice-lab-run-contract';
import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import type { OptimizationResult } from '@/resources/simulations/lib/monte-carlo-optimizer';
import type { CruiseTelemetryBridgeSummary } from '@/resources/simulations/simulations/cruise/telemetry-bridge';

type JsonRecord = Record<string, unknown>;

interface SimulationRunPersistenceDb {
  simulationTaskSpec: {
    upsert(args: unknown): Promise<{ id: string }>;
  };
  simulationRun: {
    upsert(args: unknown): Promise<{ id: string }>;
  };
  simulationTrace: {
    upsert(args: unknown): Promise<{ id: string }>;
  };
}

export interface SimulationRunLaunchContext {
  capabilityId?: string;
  classId?: string;
  courseId?: string;
  lessonPlanId?: string;
  lessonId?: string;
  manifestHash?: string;
  moduleId?: string;
  publicationId?: string;
  registryId?: string;
  resourceId?: string;
  sessionId?: string;
  stepId?: string;
  pathId?: string;
  pathNodeId?: string;
}

export interface PersistControlWorkbenchRunInput {
  clientRunId: string;
  request: ControlAnalysisRequest;
  capabilityId: string;
  launchContext: SimulationRunLaunchContext;
}

export interface PersistSceneTraceRunInput {
  traceSummary: CruiseTelemetryBridgeSummary;
  launchContext: SimulationRunLaunchContext;
}

export type CruiseServerEvaluation = Pick<OptimizationResult, 'score' | 'metrics'>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function hashValue(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

/**
 * 场景轨迹运行的标准身份键（Issue #1912）：与持久化写入时同源同法，
 * 供跨来源投影（如 AI 工坊实验档案）按 runId 确定性重算桥接身份，
 * 不得各自实现第二套哈希口径。
 */
export function sceneTraceSourceRefId(ownerUserId: string, runId: string) {
  return `scene-trace:${hashValue({ ownerUserId, runId })}`;
}

function sha256Ref(value: unknown) {
  return `sha256:${hashValue(value)}`;
}

function compactContext(input: SimulationRunLaunchContext) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
  );
}

function resourceIdFromContext(input: SimulationRunLaunchContext) {
  return input.registryId ?? input.resourceId ?? input.moduleId ?? null;
}

async function upsertTaskSpec(
  db: SimulationRunPersistenceDb,
  payloadWithoutHash: JsonRecord,
) {
  const specHash = sha256Ref(payloadWithoutHash);
  const payload: JsonRecord = { ...payloadWithoutHash, specHash };
  const taskSpec = await db.simulationTaskSpec.upsert({
    where: { specHash },
    create: {
      schemaVersion: String(payload.schemaVersion),
      sceneId: String(payload.sceneId),
      scenarioId: String(payload.scenarioId),
      specHash,
      payload: payload as Prisma.InputJsonValue,
      launchContext: payload.launchContext as Prisma.InputJsonValue,
    },
    update: {},
    select: { id: true },
  });
  return { id: taskSpec.id, payload, specHash };
}

function practiceRunContractProjection(identity: ArtifactRunIdentity) {
  assertPreviewOrPracticeNotOfficial(identity);
  return {
    schemaVersion: identity.schemaVersion,
    sourceKind: identity.sourceKind,
    evaluationVisibility: identity.evaluationVisibility,
    officialEligible: identity.officialEligible,
    canonicalIdentityHash: identity.canonicalIdentityHash,
    executor: identity.executor,
    authoritySource: identity.authoritySource,
  };
}

function controlSummary(result: ControlAnalysisResult) {
  const poles = result.rootLocus.currentPoles;
  const stable = poles.length > 0 && poles.every((pole) => pole.re < 0);
  return {
    metrics: {
      overshoot: result.metrics.overshootPct,
      riseTime: result.metrics.riseTimeSec,
      settlingTime: result.metrics.settlingTimeSec,
      steadyStateError: Math.abs(1 - result.metrics.finalValue),
      stable,
      valid: !result.isFallback,
    },
    evaluation: {
      passed: !result.isFallback,
      meetsQualityTarget: !result.isFallback,
    },
    qualityTargetMet: !result.isFallback,
  };
}

export async function persistControlWorkbenchSimulationRun(
  db: SimulationRunPersistenceDb,
  ownerUserId: string,
  input: PersistControlWorkbenchRunInput,
  compute: (request: ControlAnalysisRequest) => ControlAnalysisResult,
) {
  const result = compute(input.request);
  if (result.isFallback) {
    throw new Error('control-analysis-fallback-result');
  }
  const launchContext = compactContext(input.launchContext);
  const sceneId = 'control-workbench';
  const scenarioId = input.capabilityId;
  const taskSpec = await upsertTaskSpec(db, {
    schemaVersion: 'simulation-task-spec-v1',
    sceneId,
    scenarioId,
    plantRef: input.request.caseId ?? sha256Ref(input.request.plant),
    objectives: [input.capabilityId],
    constraints: [],
    disturbancePolicy: {},
    evaluationSpecRef: {
      id: 'control-workbench-server-analysis-v1',
      visibility: 'both',
    },
    allowedControllers: input.request.structures
      .filter((structure) => structure.enabled)
      .map((structure) => structure.kind),
    controlRequest: input.request,
    launchContext,
  });
  const sourceRefId = `control-workbench:${hashValue({
    ownerUserId,
    clientRunId: input.clientRunId,
  })}`;
  const now = new Date();
  const controllerSnapshotRef = sha256Ref(input.request.structures);
  const checksum = sha256Ref(result);
  const runContractIdentity = projectSimulationRunIdentity({
    sourceId: sourceRefId,
    ownerUserId,
    taskId: input.capabilityId,
    specHash: taskSpec.specHash,
    artifactHash: controllerSnapshotRef,
    controllerSnapshotRef,
    protocolVersion: '1.0',
    runtimeVersion: 'control-engine-wasm-server-v1',
    modelVersion: input.request.caseId ?? 'control-analysis-v1',
    executor: 'server',
    authoritySource: 'control-engine-server-facade',
    seed: null,
    checksum,
  });
  const summary = {
    ...controlSummary(result),
    runContract: practiceRunContractProjection(runContractIdentity),
  };
  const run = await db.simulationRun.upsert({
    where: {
      sourceDomain_sourceRefId: {
        sourceDomain: 'simulation_scene',
        sourceRefId,
      },
    },
    create: {
      ownerUserId,
      classId: input.launchContext.classId ?? null,
      courseId: input.launchContext.courseId ?? null,
      sessionId: input.launchContext.sessionId ?? null,
      resourceId: resourceIdFromContext(input.launchContext),
      publicationId: input.launchContext.publicationId ?? null,
      runKind: 'scene_simulation',
      sourceDomain: 'simulation_scene',
      sourceRefId,
      taskSpecId: taskSpec.id,
      taskSpecSnapshot: taskSpec.payload as Prisma.InputJsonValue,
      controllerSnapshotRef,
      status: 'completed',
      summary: summary as Prisma.InputJsonValue,
      protocolVersion: '1.0',
      runtimeVersion: 'control-engine-wasm-server-v1',
      modelVersion: input.request.caseId ?? 'control-analysis-v1',
      sceneSpecVersion: 'control-workbench-v1',
      startedAt: now,
      completedAt: now,
    },
    update: {},
    select: { id: true },
  });
  const traceId = `simulation-trace:v1:${hashValue(run.id)}`;
  await db.simulationTrace.upsert({
    where: { id: traceId },
    create: {
      id: traceId,
      runId: run.id,
      protocolVersion: '1.0',
      runtimeVersion: 'control-engine-wasm-server-v1',
      modelVersion: input.request.caseId ?? 'control-analysis-v1',
      checksum,
      summaryMetrics: summary.metrics as Prisma.InputJsonValue,
      sampleCount: result.stepResponse.points.length,
      sampleCadence: input.request.timeRange.samples > 1
        ? (input.request.timeRange.end - input.request.timeRange.start) / (input.request.timeRange.samples - 1)
        : 0,
    },
    update: {},
    select: { id: true },
  });
  return { simulationRunId: run.id };
}

function sceneTraceSummary(evaluation: CruiseServerEvaluation) {
  return {
    metrics: {
      duration: 120,
      overshoot: evaluation.metrics.overshoot,
      settlingTime: evaluation.metrics.settlingTime,
      score: evaluation.score,
      stable: evaluation.metrics.settlingTime < 120,
      valid: true,
    },
    evaluation: {
      passed: evaluation.score >= 80,
      meetsQualityTarget: evaluation.score >= 80,
    },
    qualityTargetMet: evaluation.score >= 80,
  };
}

export async function persistSceneTraceSimulationRun(
  db: SimulationRunPersistenceDb,
  ownerUserId: string,
  input: PersistSceneTraceRunInput,
  evaluate: (controller: { kp: number; ki: number; kd: number }) => CruiseServerEvaluation,
) {
  const { trace } = input.traceSummary;
  const controller = {
    kp: trace.summary.metrics.controller_kp,
    ki: trace.summary.metrics.controller_ki,
    kd: trace.summary.metrics.controller_kd,
  };
  const evaluation = evaluate(controller);
  const launchContext = compactContext(input.launchContext);
  const taskSpec = await upsertTaskSpec(db, {
    schemaVersion: 'simulation-task-spec-v1',
    sceneId: trace.envelope.sceneId,
    scenarioId: trace.envelope.scenarioId,
    objectives: [`complete:${trace.envelope.sceneId}`],
    constraints: [],
    disturbancePolicy: {
      scenario: 'turn90',
      durationSeconds: 120,
      sampleCadence: 0.5,
    },
    evaluationSpecRef: {
      id: 'scene-runtime-target-v1',
      visibility: 'both',
    },
    allowedControllers: ['pid'],
    controller,
    launchContext,
  });
  const sourceRefId = sceneTraceSourceRefId(ownerUserId, trace.envelope.runId);
  const controllerSnapshotRef = sha256Ref(controller);
  const checksum = sha256Ref(evaluation);
  const runContractIdentity = projectPracticeOutcomeIdentity({
    sourceId: sourceRefId,
    ownerUserId,
    taskId: trace.envelope.sceneId,
    specHash: taskSpec.specHash,
    artifactHash: controllerSnapshotRef,
    controllerSnapshotRef,
    protocolVersion: '1.0',
    runtimeVersion: 'control-engine-wasm-server-v1',
    modelVersion: 'nomoto-quick-sim-v1',
    executor: 'server',
    authoritySource: 'control-engine-server-facade',
    seed: null,
    checksum,
  });
  const summary = {
    ...sceneTraceSummary(evaluation),
    runContract: practiceRunContractProjection(runContractIdentity),
  };
  const now = new Date();
  const run = await db.simulationRun.upsert({
    where: {
      sourceDomain_sourceRefId: {
        sourceDomain: 'simulation_scene',
        sourceRefId,
      },
    },
    create: {
      ownerUserId,
      classId: input.launchContext.classId ?? null,
      courseId: input.launchContext.courseId ?? null,
      sessionId: input.launchContext.sessionId ?? null,
      resourceId: resourceIdFromContext(input.launchContext),
      publicationId: input.launchContext.publicationId ?? null,
      runKind: 'scene_simulation',
      sourceDomain: 'simulation_scene',
      sourceRefId,
      taskSpecId: taskSpec.id,
      taskSpecSnapshot: taskSpec.payload as Prisma.InputJsonValue,
      controllerSnapshotRef,
      status: 'completed',
      summary: summary as Prisma.InputJsonValue,
      replayToken: `scene-server-run:${trace.envelope.runId}`,
      protocolVersion: '1.0',
      runtimeVersion: 'control-engine-wasm-server-v1',
      modelVersion: 'nomoto-quick-sim-v1',
      sceneSpecVersion: trace.envelope.sceneId,
      startedAt: now,
      completedAt: now,
    },
    update: {},
    select: { id: true },
  });
  const traceId = `simulation-trace:v1:${hashValue(run.id)}`;
  await db.simulationTrace.upsert({
    where: { id: traceId },
    create: {
      id: traceId,
      runId: run.id,
      protocolVersion: '1.0',
      runtimeVersion: 'control-engine-wasm-server-v1',
      modelVersion: 'nomoto-quick-sim-v1',
      checksum,
      summaryMetrics: summary.metrics as Prisma.InputJsonValue,
      sampleCount: 241,
      sampleCadence: 0.5,
      sampleStorageUri: null,
    },
    update: {},
    select: { id: true },
  });
  return { simulationRunId: run.id };
}
