import { sensorKey, vesselTraceMetadata } from '@/features/simulations/public-api';
import { createHash } from 'node:crypto';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import type { VesselTraceChunk, VesselEvidenceRunMetadata, VesselTraceChunkMetadata } from './course-evidence-contract';
import type { VesselRunStorageSummary } from './course-evidence-contract';
import { IlabServiceError } from './service-error';

export type StoredChunk = {uri:string;checksum:string;uncompressedBytes?:number;storedBytes?:number};

export type StoredVesselTrace = ReturnType<typeof storedTraceData>;

export function storedTraceData(run: VesselEvidenceRunMetadata, latest: VesselRunStorageSummary,
  chunk: VesselTraceChunk, stored: StoredChunk) {
  return {
    runId: run.id, chunkIndex: chunk.chunkIndex, protocolVersion: 'act.vessel-trace-chunk.v1',
    runtimeVersion: run.runtimeVersion, modelVersion: run.modelVersion, seed: run.seed,
    checksum: stored.checksum, sampleStorageUri: stored.uri, sampleCadence: .05,
    sampleCount: chunk.points.length,
    summaryMetrics: { startTimeS: latest.lastTimeS, endTimeS: chunk.endTimeS,
      controlStart: chunk.controlStart, nativeStart: chunk.nativeStart, nativeCount: chunk.nativeSamples.length,
      fineStart:chunk.fineStart ?? 0,fineCount:chunk.fineSamples?.length ?? 0,
      ...(stored.uncompressedBytes !== undefined ? {uncompressedBytes:stored.uncompressedBytes} : {}),
      ...(stored.storedBytes !== undefined ? {storedBytes:stored.storedBytes} : {}) },
  };
}

export function advanceStoredSummary(latest: VesselRunStorageSummary, chunk: VesselTraceChunk,
  watermarks: Record<string, number>): VesselRunStorageSummary {
  const next: VesselRunStorageSummary = { ...latest, chunkCount: latest.chunkCount + 1,
    controlCount: latest.controlCount + chunk.points.length, nativeCount: latest.nativeCount + chunk.nativeSamples.length,
    lastTimeS: chunk.endTimeS, nativeWatermarks: watermarks };
  if (chunk.fineSamples) {
    next.fineCount = (latest.fineCount ?? 0)+chunk.fineSamples.length;
    next.fineLastTimeS = chunk.fineSamples.at(-1)?.timeS ?? latest.fineLastTimeS;
  }
  return next;
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

/** 正文在首次接收时检查，后续提交只使用持久化的边界与计数。 */
export function describeVesselTraceChunk(chunk: VesselTraceChunk): VesselTraceChunkMetadata {
  validateChunkPrefix({ parameterHash: chunk.parameterHash,
    chunkCount: chunk.chunkIndex, controlCount: chunk.controlStart, nativeCount: chunk.nativeStart,
    fineCount: chunk.fineStart ?? 0, lastTimeS: 0, nativeWatermarks: {},
  } as VesselRunStorageSummary, chunk);
  return vesselTraceMetadata(chunk, chunk.points.length
    ? createHash('sha256').update(canonicalJson(chunk.points[0])).digest('hex') : undefined);
}

export function validateVesselTraceMetadata(summary: VesselRunStorageSummary, chunk: VesselTraceChunkMetadata) {
  if (chunk.parameterHash !== summary.parameterHash || chunk.chunkIndex !== summary.chunkCount
    || chunk.controlStart !== summary.controlCount || chunk.nativeStart !== summary.nativeCount
    || chunk.fineStart !== (summary.fineCount ?? 0) || chunk.endTimeS < summary.lastTimeS) {
    throw new IlabServiceError('采样顺序或运行参数不一致，请读取已保存进度后重试。', 409);
  }
  if (chunk.fineFirstTimeS !== undefined && chunk.fineFirstTimeS <= (summary.fineLastTimeS ?? -1)) {
    throw new IlabServiceError('物理细步事件窗口的时间或顺序不一致。', 400);
  }
  if (Object.entries(chunk.nativeFirstWatermarks).some(([key, time]) =>
    time < (summary.nativeWatermarks[key] ?? -1) - 1e-7)) {
    throw new IlabServiceError('原生仪器记录顺序或缺测状态不一致。', 400);
  }
  if (chunk.earliestChangeTimeS !== undefined && chunk.earliestChangeTimeS < summary.lastTimeS - 1e-7) {
    throw new IlabServiceError('控制器修改时间超出当前采样分块。', 400);
  }
}

export function advanceVesselTraceMetadata(summary: VesselRunStorageSummary, chunk: VesselTraceChunkMetadata) {
  const next = { ...summary, chunkCount: summary.chunkCount + 1,
    controlCount: summary.controlCount + chunk.controlCount, nativeCount: summary.nativeCount + chunk.nativeCount,
    lastTimeS: chunk.endTimeS, nativeWatermarks: { ...summary.nativeWatermarks, ...chunk.nativeLastWatermarks } };
  if (chunk.hasFineSamples) {
    next.fineCount = (summary.fineCount ?? 0) + chunk.fineCount;
    next.fineLastTimeS = chunk.fineLastTimeS ?? summary.fineLastTimeS;
  }
  return next;
}

export function confirmedVesselTraceData(run: VesselEvidenceRunMetadata, summary: VesselRunStorageSummary,
  chunk: VesselTraceChunkMetadata, stored: StoredChunk): StoredVesselTrace {
  const nativeArchive = stored.uri.startsWith('simulation-cas:oss:') && summary.courseKey === 'destroyer'
    && summary.stepSequence === 1 && chunk.nativeCount > 0 && chunk.controlCount === 0 && chunk.fineCount === 0
    && chunk.earliestChangeTimeS === undefined ? chunk : undefined;
  return { runId: run.id, chunkIndex: chunk.chunkIndex, protocolVersion: 'act.vessel-trace-chunk.v1',
    runtimeVersion: run.runtimeVersion, modelVersion: run.modelVersion, seed: run.seed,
    checksum: stored.checksum, sampleStorageUri: stored.uri, sampleCadence: .05, sampleCount: chunk.controlCount,
    summaryMetrics: { startTimeS: summary.lastTimeS, endTimeS: chunk.endTimeS,
      controlStart: chunk.controlStart, nativeStart: chunk.nativeStart, nativeCount: chunk.nativeCount,
      fineStart: chunk.fineStart, fineCount: chunk.fineCount,
      ...(nativeArchive ? { nativeArchive } : {}),
      ...(stored.uncompressedBytes !== undefined ? { uncompressedBytes: stored.uncompressedBytes } : {}),
      ...(stored.storedBytes !== undefined ? { storedBytes: stored.storedBytes } : {}) },
  };
}
