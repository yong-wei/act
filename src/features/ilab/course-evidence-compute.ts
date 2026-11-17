import { createHash } from 'node:crypto';
import { createServerVesselSessionWithAssets } from '@/lib/control-engine/wasm-server';
import { CONTROL_ENGINE_BUILD_HASH } from '@/lib/control-engine/identity.generated';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { readSimulationTraceChunk, writeSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { activeVesselFactors } from '@/resources/simulations/experiments/comparison-factors';
import { vesselDredgerMetricPoint, vesselDredgerFineMetrics, vesselDredgerModeEvents,
  type VesselTracePoint } from '@/features/simulations/public-api';
import { vesselTraceChunkSchema, type VesselEvidenceOpening, type VesselEvidenceClose,
  type VesselTraceChunk, type VesselEvidenceRunMetadata } from './course-evidence-contract';
import type { VesselRunStorageSummary } from './course-evidence-contract';
import { storedTraceData, advanceStoredSummary, validateChunkPrefix, type StoredVesselTrace,
  type StoredChunk } from './course-evidence-prefix';
import { calculateVesselRunMetrics } from './course-run-metrics';
import { IlabServiceError } from './service-error';

const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

export interface PreparedVesselOpening {
  frame: Pick<VesselSessionFrame, 'parameterHash' | 'parameters' | 'modelVersion' | 'input'>;
  configurationHash: string;
  appliedFactors: string[];
  appliedEnvironment: string;
}

export async function prepareVesselEvidenceOpening(input: VesselEvidenceOpening): Promise<PreparedVesselOpening> {
  let native: Awaited<ReturnType<typeof createServerVesselSessionWithAssets>>;
  try { native = await createServerVesselSessionWithAssets(input.configuration); }
  catch { throw new IlabServiceError('船型初态或环境配置无法建立有效运行。',400); }
  try {
    const frame = JSON.parse(native.advance(0, JSON.stringify(input.input))) as VesselSessionFrame;
    const checkpoint = native.snapshot();
    native.restore(input.initialCheckpoint);
    const restoredCheckpoint = native.snapshot();
    const withoutUndefinedDirection = (value: string) => JSON.stringify(JSON.parse(value), (_key, entry) =>
      entry?.quality === 'Undefined' ? { ...entry, value: null } : entry);
    if (frame.parameterHash !== input.parameterHash || (restoredCheckpoint !== checkpoint
      && withoutUndefinedDirection(restoredCheckpoint) !== withoutUndefinedDirection(checkpoint))) {
      throw new IlabServiceError('实际初态、控制参数或参数包与本次运行不一致。',409);
    }
    const actual = JSON.parse(checkpoint);
    const environment = actual.plant.environment;
    if (!environment?.switches) throw new IlabServiceError('实际环境回执尚未就绪。',503);
    return {
      frame: { parameterHash: frame.parameterHash, parameters: frame.parameters,
        modelVersion: frame.modelVersion, input: frame.input },
      configurationHash: hash(actual.configuration),
      appliedFactors: activeVesselFactors(input.configuration, environment.switches),
      appliedEnvironment: canonicalJson({ switches: environment.switches, wave: environment.wave.condition,
        wind: environment.wind.true_wind, currentNed: environment.current_ned }),
    };
  } catch (error) {
    if (error instanceof IlabServiceError) throw error;
    throw new IlabServiceError('这次运行的控制配置无效。',400);
  } finally { native.free(); }
}

type ProgressPatch = Pick<VesselRunStorageSummary, 'chunkCount' | 'controlCount' | 'nativeCount'
  | 'lastTimeS' | 'nativeWatermarks'> & Partial<Pick<VesselRunStorageSummary, 'fineCount' | 'fineLastTimeS'>>;

export interface PrepareVesselCloseInput {
  run: VesselEvidenceRunMetadata;
  runRef: string;
  summary: VesselRunStorageSummary;
  input: VesselEvidenceClose;
  closeHash: string;
  traces: Array<{ sampleStorageUri: string | null }>;
  verifyCheckpoint?: boolean;
}

export interface PreparedVesselClose {
  traces: StoredVesselTrace[];
  progress: ProgressPatch;
  firstSampleReceipt?: string;
  simulationEndMs: number;
  summaryUpdates: Record<string, unknown>;
  quality: Record<string, unknown> | null;
  checkpoint?: StoredChunk;
}

/** 在数据库事务前完成不可变数据读取、校验、统计与恢复点编码。 */
export async function prepareVesselEvidenceClose(task: PrepareVesselCloseInput): Promise<PreparedVesselClose> {
  const { run, runRef, summary, input, closeHash } = task;
  const isCheckpoint = input.reason === 'checkpoint';
  const verifyEvidence = !isCheckpoint || task.verifyCheckpoint === true;
  const pending: StoredVesselTrace[] = [];
  const newPoints: VesselTracePoint[] = [];
  let projected = summary;
  let hasFineSamples = false;
  let firstSampleReceipt: string | undefined;
  if (verifyEvidence) {
    let verifiedPrefix: VesselRunStorageSummary = { ...summary, chunkCount: 0, controlCount: 0,
      nativeCount: 0, fineCount: 0, fineLastTimeS: undefined, lastTimeS: 0, nativeWatermarks: {} };
    for (const trace of task.traces) {
      if (!trace.sampleStorageUri) throw new IlabServiceError('原始采样引用缺失。', 409);
      const parsed = vesselTraceChunkSchema.safeParse(await readSimulationTraceChunk(trace.sampleStorageUri));
      if (!parsed.success || parsed.data.runRef !== runRef) throw new IlabServiceError('原始采样与当前运行不一致。', 409);
      const chunk = parsed.data as unknown as VesselTraceChunk;
      const watermarks = validateChunkPrefix(verifiedPrefix, chunk);
      verifiedPrefix = advanceStoredSummary(verifiedPrefix, chunk, watermarks);
      newPoints.push(...chunk.points);
    }
    if (verifiedPrefix.chunkCount !== summary.chunkCount || verifiedPrefix.controlCount !== summary.controlCount
      || verifiedPrefix.nativeCount !== summary.nativeCount || (verifiedPrefix.fineCount ?? 0) !== (summary.fineCount ?? 0)
      || (verifiedPrefix.fineLastTimeS ?? null) !== (summary.fineLastTimeS ?? null)
      || verifiedPrefix.lastTimeS > summary.lastTimeS + 1e-7
      || canonicalJson(verifiedPrefix.nativeWatermarks) !== canonicalJson(summary.nativeWatermarks)) {
      throw new IlabServiceError('已保存采样与运行水位不一致。', 409);
    }
  }
  for (const reference of input.pendingChunks ?? []) {
    const parsed = vesselTraceChunkSchema.safeParse(await readSimulationTraceChunk(reference));
    if (!parsed.success || parsed.data.runRef !== runRef) throw new IlabServiceError('暂存采样与当前运行不一致。',409);
    const chunk = parsed.data as unknown as VesselTraceChunk;
    const watermarks = validateChunkPrefix(projected, chunk);
    pending.push(storedTraceData(run, projected, chunk,
      { uri: reference, checksum: reference.slice(reference.lastIndexOf(':') + 1) }));
    projected = advanceStoredSummary(projected, chunk, watermarks);
    hasFineSamples ||= chunk.fineSamples !== undefined;
    if (summary.controlCount === 0 && !firstSampleReceipt && chunk.points.length) {
      firstSampleReceipt = hash(chunk.points[0]);
    }
    if (verifyEvidence) newPoints.push(...chunk.points);
  }
  if (input.controlCount !== projected.controlCount || input.nativeCount !== projected.nativeCount
    || (input.fineCount ?? 0) !== (projected.fineCount ?? 0)
    || input.endTimeS < projected.lastTimeS - 1e-7) throw new IlabServiceError('原始采样尚未完整接收，请继续上传。',409);
  const opening = await readSimulationTraceChunk<VesselEvidenceOpening>(summary.openingReference);
  const native = await createServerVesselSessionWithAssets(opening.configuration);
  let frame: VesselSessionFrame;
  try {
    native.restore(input.checkpoint);
    frame = JSON.parse(native.read()) as VesselSessionFrame;
    const savedConfiguration = JSON.parse(native.snapshot()).configuration;
    if (hash(savedConfiguration) !== summary.configurationHash || frame.parameterHash !== summary.parameterHash
      || frame.controllerTicks !== input.controlCount || Math.abs(frame.timeS - input.endTimeS) > 1e-7
      || (frame.fineStepWindowSampleCount ?? 0) !== (input.fineCount ?? 0)) {
      throw new IlabServiceError('结束状态与已经接收的原始采样不一致。',409);
    }
    if (summary.courseKey === 'icebreaker' && input.reason === 'arrival' && frame.truth.position_ned[0] < 800) {
      throw new IlabServiceError('冰区任务尚未抵达北向800m，请保留实际停止原因。',409);
    }
  } catch (error) {
    if (error instanceof IlabServiceError) throw error;
    throw new IlabServiceError('结束状态无法恢复，请检查本机保存的运行。',400);
  } finally { native.free(); }
  let metrics: ReturnType<typeof calculateVesselRunMetrics> | null = null;
  if (verifyEvidence) {
    const points = newPoints;
    if (points.length !== input.controlCount) throw new IlabServiceError('原始控制采样数量不一致。',409);
    metrics = calculateVesselRunMetrics(points, input.endTimeS, opening.configuration.initialHeadingDeg ?? 0,
      frame.iceContact ? { timeS: input.endTimeS, northM: frame.truth.position_ned[0], eastM: frame.truth.position_ned[1],
        positiveMotorWorkJ: frame.truth.actuator_states.positive_motor_work_j.reduce((sum, value) => sum + value, 0),
        forwardRequested: frame.input.actuators.shafts.some(shaft => shaft.speed_reference_rad_s > 0) } : undefined,
      frame.dredger ? vesselDredgerMetricPoint(frame.timeS, frame.dredger,
        frame.truth.actuator_states.positive_motor_work_j.reduce((sum, value) => sum + value, 0)) : undefined);
    metrics.positiveMotorWorkJ = frame.truth.actuator_states.positive_motor_work_j.reduce((sum, value) => sum + value, 0);
    if (frame.dredgerFineMetrics) Object.assign(metrics, vesselDredgerFineMetrics(frame.dredgerFineMetrics));
  }
  const checkpoint = await writeSimulationTraceChunk({ schema: 'act.vessel-run-close.v1', ...input, appliedFinalInput: frame.input });
  const progress: ProgressPatch = { chunkCount: projected.chunkCount, controlCount: projected.controlCount,
    nativeCount: projected.nativeCount, lastTimeS: projected.lastTimeS, nativeWatermarks: projected.nativeWatermarks };
  if (hasFineSamples) {
    progress.fineCount = projected.fineCount;
    progress.fineLastTimeS = projected.fineLastTimeS;
  }
  return {
    traces: pending, progress, firstSampleReceipt, checkpoint,
    simulationEndMs: opening.startedAtMs + Math.round(input.endTimeS * 1000),
    summaryUpdates: { lastTimeS: input.endTimeS, lastCheckpointReference: checkpoint.uri,
      ...(isCheckpoint ? { checkpointHash: closeHash, ...(verifyEvidence ? { metrics } : {}) } : { closeHash, metrics }), fineStepMetrics: frame.fineStepMetrics ?? null,
      parameters: frame.parameters, voyage: frame.containerVoyage?.progress ?? null,
      fuelKg: frame.teachingFuel?.state.fuel_kg ?? null, cruiseComfort: frame.cruiseComfort ?? null,
      ...(frame.dredger ? { dredgerModeEvents: vesselDredgerModeEvents(frame) } : {}),
      metricsRuntimeVersion: CONTROL_ENGINE_BUILD_HASH, stopReason: isCheckpoint ? null : input.reason,
      ...(verifyEvidence ? { evidenceVerification: { status: 'verified', checkpointHash: closeHash,
        runtimeVersion: run.runtimeVersion, verifiedAt: new Date().toISOString(),
        evidenceHash: hash({ runId: run.id, reportId: summary.reportId, openingHash: summary.openingHash,
          closeHash, courseVersion: summary.courseVersion, modelVersion: run.modelVersion,
          runtimeVersion: run.runtimeVersion, validationRuntimeVersion: CONTROL_ENGINE_BUILD_HASH,
          references: [...task.traces.map(trace => trace.sampleStorageUri), ...(input.pendingChunks ?? [])] }) } } : {}) },
    quality: isCheckpoint ? null : {
      status: input.reason === 'failure' ? 'failed' : 'complete', controlSamples: input.controlCount,
      nativeSamples: input.nativeCount, metrics: { ...metrics }, fineStepSamples: input.fineCount ?? 0,
      fineStepMetrics: frame.fineStepMetrics ? { ...frame.fineStepMetrics, values: { ...frame.fineStepMetrics.values } } : null,
      failureReference: input.failure ? checkpoint.uri : null,
    },
  };
}
