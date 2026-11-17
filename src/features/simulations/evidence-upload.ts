import type { VesselRunEvidence } from './run-evidence';
import { uploadDirectVesselRunEvidence } from './evidence-direct-upload';
import { vesselEvidenceOpeningInput } from './evidence-opening';

import type { VesselEvidenceProgress } from './run-evidence';
export type { VesselEvidenceProgress } from './run-evidence';

export async function requestVesselEvidence<T = VesselEvidenceProgress>(url: string, value: unknown, method = 'POST'): Promise<T> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let body: BodyInit = bytes;
  const headers: Record<string,string> = { 'content-type': 'application/json' };
  if (typeof CompressionStream !== 'undefined') {
    body = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    headers['content-encoding'] = 'gzip';
  }
  const response = await fetch(url, { method, headers, body });
  const result = await response.json() as T & { error?: string; savedProgress?: VesselEvidenceProgress };
  if (!response.ok) {
    const message = result.error ?? '实验记录上传失败，本机记录已保留。';
    throw Object.assign(new Error(result.savedProgress ? `实验进度已保存，证据核验未完成。${message}` : message),
      { status: response.status, savedProgress: result.savedProgress });
  }
  return result;
}

/** 五秒分块先存入私有 CAS，采样前缀与对应恢复点在同一事务中生效。 */
const uploadProgress = new Map<string, VesselEvidenceProgress>();

export async function uploadVesselRunEvidence(reportClientRef: string,
  run: VesselRunEvidence & { uploadReceipt?: VesselEvidenceProgress & { reportClientRef: string } }) {
  const key = `${reportClientRef}:${run.id}`;
  const receipt = uploadProgress.get(key) ?? (run.uploadReceipt?.reportClientRef === reportClientRef ? run.uploadReceipt : undefined);
  let progress = receipt?.transport === 'oss' ? receipt : await requestVesselEvidence('/api/ilab/experiment-runs', vesselEvidenceOpeningInput(reportClientRef, run));
  if (progress.runRef !== run.id || progress.parameterHash !== run.parameterHash) {
    throw new Error('云端记录与本次运行不一致，请重新读取实验进度。');
  }
  if (progress.controlCount > run.trace.length || progress.nativeCount > run.nativeSensorSamples.length
    || (progress.fineCount ?? 0) > (run.fineStepSamples?.length ?? 0) || progress.lastTimeS > run.lastTimeS + 1e-7) {
    throw new Error('云端已有更新的实验记录，请读取保存状态后继续。');
  }
  if (progress.status !== 'running') {
    if (progress.controlCount !== run.trace.length || progress.nativeCount !== run.nativeSensorSamples.length
      || (progress.fineCount ?? 0) !== (run.fineStepSamples?.length ?? 0) || Math.abs(progress.lastTimeS-run.lastTimeS) > 1e-7) {
      throw new Error('服务端已结束这次运行，本机存在不同的后续记录，请读取保存状态。');
    }
    return progress;
  }
  if (progress.transport === 'oss') {
    try {
      progress = await uploadDirectVesselRunEvidence(reportClientRef, run, progress, requestVesselEvidence);
      uploadProgress.set(key, progress);
      return progress;
    }
    catch (error) {
      if (!(error instanceof Error) || ![409, 503].includes((error as { status?: number }).status ?? 0)) throw error;
      const response = await fetch(`/api/ilab/experiment-runs/${run.id}`, { cache: 'no-store' });
      if (!response.ok) throw error;
      progress = await response.json() as VesselEvidenceProgress;
      uploadProgress.set(key, progress);
      if (progress.controlCount > run.trace.length || progress.nativeCount > run.nativeSensorSamples.length
        || (progress.fineCount ?? 0) > (run.fineStepSamples?.length ?? 0) || progress.lastTimeS > run.lastTimeS + 1e-7) throw error;
      if (progress.transport === 'oss') {
        progress = await uploadDirectVesselRunEvidence(reportClientRef, run, progress, requestVesselEvidence);
        uploadProgress.set(key, progress);
        return progress;
      }
    }
  }
  const completed = run.stoppedAtMs !== null;
  const fineSamples = run.fineStepSamples ?? [];
  const pendingChunks: string[] = [];
  while (progress.controlCount < run.trace.length || progress.nativeCount < run.nativeSensorSamples.length
    || (progress.fineCount ?? 0) < fineSamples.length) {
    const boundary = (Math.floor((progress.lastTimeS+1e-7)/5)+1)*5;
    const endTimeS = Math.min(boundary, run.lastTimeS);
    const finalChunk = endTimeS >= run.lastTimeS - 1e-7;
    let controlEnd = progress.controlCount;
    while (controlEnd < run.trace.length && (run.trace[controlEnd].timeS < endTimeS - 1e-7 || finalChunk)) controlEnd++;
    let nativeEnd = progress.nativeCount;
    while (nativeEnd < run.nativeSensorSamples.length && run.nativeSensorSamples[nativeEnd].measurement.t_arrive_s <= endTimeS + 1e-7) nativeEnd++;
    let fineEnd = progress.fineCount ?? 0;
    while (fineEnd < fineSamples.length && fineSamples[fineEnd].timeS <= endTimeS + 1e-7) fineEnd++;
    if (controlEnd === progress.controlCount && nativeEnd === progress.nativeCount && fineEnd === (progress.fineCount ?? 0)) break;
    const staged = await requestVesselEvidence<{reference:string}>(`/api/ilab/experiment-runs/${run.id}/chunks?stage=1`, {
      schema: 'act.vessel-trace-chunk.v1', runRef: run.id, chunkIndex: progress.chunkCount,
      controlStart: progress.controlCount, nativeStart: progress.nativeCount, parameterHash: run.parameterHash,
      endTimeS, points: run.trace.slice(progress.controlCount, controlEnd).map((point) => ({ ...point,
        measurements: Object.fromEntries(Object.entries(point.measurements).map(([key, reading]) =>
          [key, reading.quality === 'Undefined' ? { ...reading, value: null } : reading])),
      })),
      nativeSamples: run.nativeSensorSamples.slice(progress.nativeCount, nativeEnd).map((sample) =>
        sample.measurement.quality === 'Undefined' ? { ...sample, measurement: { ...sample.measurement, value: null } } : sample),
      ...(run.fineStepSamples ? {fineStart:progress.fineCount ?? 0,fineSamples:fineSamples.slice(progress.fineCount ?? 0,fineEnd)} : {}),
      changes: run.changes.filter((change) => change.timeS >= progress.lastTimeS - 1e-7
        && (change.timeS < endTimeS - 1e-7 || finalChunk)),
    });
    pendingChunks.push(staged.reference);
    progress = {...progress, chunkCount:progress.chunkCount + 1, controlCount:controlEnd,
      nativeCount:nativeEnd, fineCount:fineEnd, lastTimeS:endTimeS};
  }
  progress = await requestVesselEvidence(`/api/ilab/experiment-runs/${run.id}`, {
    checkpoint: run.checkpoint, endTimeS: run.lastTimeS, controlCount: run.trace.length,
    nativeCount: run.nativeSensorSamples.length, reason: completed ? run.stopReason : 'checkpoint', failure: run.failure,
    durationS:run.durationS, pendingChunks,
    baseCheckpointReference: progress.checkpointReference,
    checkpointPreview: run.checkpointPreview,
    ...(run.fineStepSamples ? {fineCount:fineSamples.length} : {}),
  }, 'PUT');
  return progress;
}
