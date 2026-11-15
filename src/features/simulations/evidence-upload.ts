import type { VesselRunEvidence } from './run-evidence';

export interface VesselEvidenceProgress {
  runRef: string;
  reportId: string;
  experimentKey: string;
  status: string;
  chunkCount: number;
  controlCount: number;
  nativeCount: number;
  fineCount?: number;
  lastTimeS: number;
  parameterHash: string;
}

export async function requestVesselEvidence<T = VesselEvidenceProgress>(url: string, value: unknown, method = 'POST'): Promise<T> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let body: BodyInit = bytes;
  const headers: Record<string,string> = { 'content-type': 'application/json' };
  if (typeof CompressionStream !== 'undefined') {
    body = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    headers['content-encoding'] = 'gzip';
  }
  const response = await fetch(url, { method, headers, body });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? '实验记录上传失败，本机记录已保留。');
  return result;
}

/** 五秒分块先存入私有 CAS，采样前缀与对应恢复点在同一事务中生效。 */
export async function uploadVesselRunEvidence(reportClientRef: string, run: VesselRunEvidence) {
  let progress = await requestVesselEvidence('/api/ilab/experiment-runs', {
    reportClientRef, runRef: run.id, courseKey: run.courseKey, courseVersion: run.courseVersion,
    stepSequence: run.stepSequence, configuration: run.configuration, input: run.initialInput,
    parameterHash: run.parameterHash, initialCheckpoint: run.initialCheckpoint,
    runtimeVersion:run.runtimeVersion,
    prediction: run.prediction, startedAtMs: run.createdAtMs,
    designStudentModelId: run.designStudentModelId || undefined,
    courseSettings: run.courseSettings,
    controllerSourceRunId: run.controllerSourceRunId || undefined,
  });
  if (progress.status !== 'running') {
    if (progress.controlCount !== run.trace.length || progress.nativeCount !== run.nativeSensorSamples.length
      || (progress.fineCount ?? 0) !== (run.fineStepSamples?.length ?? 0) || Math.abs(progress.lastTimeS-run.lastTimeS) > 1e-7) {
      throw new Error('服务端已结束这次运行，本机存在不同的后续记录，请读取保存状态。');
    }
    return progress;
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
      endTimeS, points: run.trace.slice(progress.controlCount, controlEnd),
      nativeSamples: run.nativeSensorSamples.slice(progress.nativeCount, nativeEnd),
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
    ...(run.fineStepSamples ? {fineCount:fineSamples.length} : {}),
  }, 'PUT');
  return progress;
}
