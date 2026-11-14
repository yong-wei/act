import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createServerVesselSession } from '@/lib/control-engine/wasm-server';
import { CONTROL_ENGINE_BUILD_HASH } from '@/lib/control-engine/identity.generated';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { readSimulationTraceChunk, writeSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { sensorKey, type VesselTracePoint } from '@/features/simulations/run-evidence';
import type { VesselEvidenceClose, VesselEvidenceOpening, VesselTraceChunk } from './course-evidence-contract';
import { findOwnedVesselRun, vesselRunProgress, vesselRunStorageSummary, type VesselRunStorageSummary } from './course-evidence-service';
import { calculateVesselRunMetrics } from './course-run-metrics';
import { IlabServiceError } from './run-lock';

const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

/** 只追加已接收前缀，同一分块的重试以服务端内容哈希核对。 */
export async function appendVesselEvidenceChunk(userId: string, chunk: VesselTraceChunk) {
  const run = await findOwnedVesselRun(userId, chunk.runRef);
  const summary = vesselRunStorageSummary(run);
  const checksum = hash(chunk);
  const existing = await prisma.simulationTrace.findUnique({ where: { runId_chunkIndex: { runId: run.id, chunkIndex: chunk.chunkIndex } } });
  if (existing) {
    if (existing.checksum !== checksum) throw new IlabServiceError('已经接收的采样分块与本次内容不同。',409);
    return vesselRunProgress(run);
  }
  validateChunkPrefix(summary, chunk);
  const stored = await writeSimulationTraceChunk(chunk);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VirtualSimulationReport" WHERE "id" = ${summary.reportId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "SimulationRun" WHERE "id" = ${run.id} FOR UPDATE`;
    const current = await tx.simulationRun.findUniqueOrThrow({ where: { id: run.id } });
    const latest = vesselRunStorageSummary(current);
    const duplicate = await tx.simulationTrace.findUnique({ where: { runId_chunkIndex: { runId: run.id, chunkIndex: chunk.chunkIndex } } });
    if (duplicate) {
      if (duplicate.checksum !== checksum) throw new IlabServiceError('已经接收的采样分块与本次内容不同。',409);
      return vesselRunProgress(current);
    }
    const report = await tx.virtualSimulationReport.findUniqueOrThrow({ where: { id: latest.reportId } });
    if (current.status !== 'running' || !['draft','revision-requested'].includes(report.status)) {
      throw new IlabServiceError('这次运行已经结束或报告已提交，无法追加采样。',409);
    }
    const watermarks = validateChunkPrefix(latest, chunk);
    await tx.simulationTrace.create({ data: {
      runId: run.id, chunkIndex: chunk.chunkIndex, protocolVersion: 'act.vessel-trace-chunk.v1',
      runtimeVersion: current.runtimeVersion, modelVersion: current.modelVersion, seed: current.seed,
      checksum: stored.checksum, sampleStorageUri: stored.uri, sampleCadence: .05,
      sampleCount: chunk.points.length,
      summaryMetrics: { startTimeS: latest.lastTimeS, endTimeS: chunk.endTimeS,
        controlStart: chunk.controlStart, nativeStart: chunk.nativeStart, nativeCount: chunk.nativeSamples.length,
        fineStart:chunk.fineStart ?? 0,fineCount:chunk.fineSamples?.length ?? 0,
        uncompressedBytes: stored.uncompressedBytes, storedBytes: stored.storedBytes },
    } });
    const next: VesselRunStorageSummary = { ...latest, chunkCount: latest.chunkCount + 1,
      controlCount: latest.controlCount + chunk.points.length, nativeCount: latest.nativeCount + chunk.nativeSamples.length,
      lastTimeS: chunk.endTimeS, nativeWatermarks: watermarks };
    if (chunk.fineSamples) {
      next.fineCount = (latest.fineCount ?? 0)+chunk.fineSamples.length;
      next.fineLastTimeS = chunk.fineSamples.at(-1)?.timeS ?? latest.fineLastTimeS;
    }
    const saved = await tx.simulationRun.update({ where: { id: run.id }, data: { summary: next as unknown as Prisma.InputJsonValue } });
    if (latest.controlCount === 0 && chunk.points.length) {
      await tx.appliedRunEnvelope.update({ where: { runRef: chunk.runRef }, data: {
        firstSampleReceipt: hash(chunk.points[0]), quality: { status: 'recording', source: 'native-session' },
      } });
    }
    return vesselRunProgress(saved);
  });
}

export function validateChunkPrefix(summary: VesselRunStorageSummary, chunk: VesselTraceChunk) {
  if (chunk.parameterHash !== summary.parameterHash || chunk.chunkIndex !== summary.chunkCount
    || chunk.controlStart !== summary.controlCount || chunk.nativeStart !== summary.nativeCount
    || (chunk.fineStart ?? 0) !== (summary.fineCount ?? 0)
    || chunk.endTimeS < summary.lastTimeS || (!chunk.points.length && !chunk.nativeSamples.length && !chunk.fineSamples?.length)) {
    throw new IlabServiceError('采样顺序或运行参数不一致，请读取已保存进度后重试。',409);
  }
  let fineTime = summary.fineLastTimeS ?? -1;
  for (const point of chunk.fineSamples ?? []) {
    if (point.timeS <= fineTime || point.timeS > chunk.endTimeS+1e-7
      || Math.abs(point.timeS*120-Math.round(point.timeS*120)) > 1e-6) {
      throw new IlabServiceError('物理细步事件窗口的时间或顺序不一致。',400);
    }
    fineTime = point.timeS;
  }
  for (let index = 0; index < chunk.points.length; index++) {
    const point = chunk.points[index];
    if (Math.abs(point.timeS - (chunk.controlStart + index) * .05) > 1e-6 || point.timeS > chunk.endTimeS + 1e-7) {
      throw new IlabServiceError('控制采样时间不连续。',400);
    }
    for (const reading of Object.values(point.measurements)) {
      if (reading.sampledAtS > reading.arrivedAtS + 1e-7 || reading.arrivedAtS > point.timeS + 1e-7
        || (reading.quality === 'Good') !== (reading.value !== null)) {
        throw new IlabServiceError('仪器采样时间或缺测状态不一致。',400);
      }
    }
  }
  const watermarks = { ...summary.nativeWatermarks };
  for (const sample of chunk.nativeSamples) {
    const key = sensorKey(sample.signal);
    const reading = sample.measurement;
    const arrivalKey = `${key}:arrival`;
    if (reading.t_sample_s < (watermarks[key] ?? -1) - 1e-7
      || reading.t_arrive_s < (watermarks[arrivalKey] ?? -1) - 1e-7
      || reading.t_sample_s > reading.t_arrive_s + 1e-7 || reading.t_arrive_s > chunk.endTimeS + 1e-7
      || (reading.quality === 'Good') !== (reading.value !== null)) {
      throw new IlabServiceError('原生仪器记录顺序或缺测状态不一致。',400);
    }
    watermarks[key] = reading.t_sample_s;
    watermarks[arrivalKey] = reading.t_arrive_s;
  }
  if (chunk.changes.some((change) => change.timeS < summary.lastTimeS - 1e-7 || change.timeS > chunk.endTimeS + 1e-7)) {
    throw new IlabServiceError('控制器修改时间超出当前采样分块。',400);
  }
  return watermarks;
}

/** 完整原始采样收到后，验证同一原生状态并生成可复核的评价。 */
export async function closeVesselEvidenceRun(userId: string, runRef: string, input: VesselEvidenceClose) {
  const run = await findOwnedVesselRun(userId, runRef);
  const summary = vesselRunStorageSummary(run);
  const closeHash = hash(input);
  const previousClose = (run.summary as { closeHash?: string }).closeHash;
  if (previousClose) {
    if (previousClose !== closeHash) throw new IlabServiceError('这次运行已经以其他结束状态保存。',409);
    return vesselRunProgress(run);
  }
  if (input.controlCount !== summary.controlCount || input.nativeCount !== summary.nativeCount
    || (input.fineCount ?? 0) !== (summary.fineCount ?? 0)
    || input.endTimeS < summary.lastTimeS - 1e-7) throw new IlabServiceError('原始采样尚未完整接收，请继续上传。',409);
  const opening = await readSimulationTraceChunk<VesselEvidenceOpening>(summary.openingReference);
  const native = createServerVesselSession(opening.configuration);
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
  } catch (error) {
    if (error instanceof IlabServiceError) throw error;
    throw new IlabServiceError('结束状态无法恢复，请检查本机保存的运行。',400);
  } finally { native.free(); }
  const traces = await prisma.simulationTrace.findMany({ where: { runId: run.id }, orderBy: { chunkIndex: 'asc' } });
  const points: VesselTracePoint[] = [];
  for (const trace of traces) {
    if (!trace.sampleStorageUri) throw new IlabServiceError('原始采样引用缺失。',409);
    const chunk = await readSimulationTraceChunk<VesselTraceChunk>(trace.sampleStorageUri);
    points.push(...chunk.points);
  }
  if (points.length !== input.controlCount) throw new IlabServiceError('原始控制采样数量不一致。',409);
  const metrics = calculateVesselRunMetrics(points, input.endTimeS, opening.configuration.initialHeadingDeg ?? 0);
  metrics.positiveMotorWorkJ = frame.truth.actuator_states.positive_motor_work_j.reduce((sum,value)=>sum+value,0);
  const checkpoint = await writeSimulationTraceChunk({ schema: 'act.vessel-run-close.v1', ...input,appliedFinalInput:frame.input });
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "VirtualSimulationReport" WHERE "id" = ${summary.reportId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "SimulationRun" WHERE "id" = ${run.id} FOR UPDATE`;
    const current = await tx.simulationRun.findUniqueOrThrow({ where: { id: run.id } });
    const latest = vesselRunStorageSummary(current);
    const currentClose = (current.summary as { closeHash?: string }).closeHash;
    if (currentClose) {
      if (currentClose !== closeHash) throw new IlabServiceError('这次运行已经结束。',409);
      return vesselRunProgress(current);
    }
    const report = await tx.virtualSimulationReport.findUniqueOrThrow({ where: { id: summary.reportId } });
    if (!['draft','revision-requested'].includes(report.status) || latest.controlCount !== input.controlCount
      || latest.nativeCount !== input.nativeCount || latest.chunkCount !== summary.chunkCount) {
      throw new IlabServiceError('实验进度已经变化，请读取保存状态后重试。',409);
    }
    const saved = await tx.simulationRun.update({ where: { id: run.id }, data: {
      status: input.reason === 'failure' ? 'failed' : 'completed', completedAt: new Date(),
      summary: { ...latest, lastTimeS: input.endTimeS, lastCheckpointReference: checkpoint.uri,
        closeHash, metrics, fineStepMetrics:frame.fineStepMetrics ?? null,
        metricsRuntimeVersion:CONTROL_ENGINE_BUILD_HASH,stopReason: input.reason } as unknown as Prisma.InputJsonValue,
    } });
    await tx.appliedRunEnvelope.update({ where: { runRef }, data: {
      simulationEndMs: BigInt(opening.startedAtMs + Math.round(input.endTimeS * 1000)),
      terminationReason: input.reason, quality: { status: input.reason === 'failure' ? 'failed' : 'complete',
        controlSamples: input.controlCount, nativeSamples: input.nativeCount, metrics: { ...metrics },
        fineStepSamples:input.fineCount ?? 0,fineStepMetrics:frame.fineStepMetrics
          ? {...frame.fineStepMetrics,values:{...frame.fineStepMetrics.values}} : null,
        failureReference: input.failure ? checkpoint.uri : null },
    } });
    return vesselRunProgress(saved);
  });
}
