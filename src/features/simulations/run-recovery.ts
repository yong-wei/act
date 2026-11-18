import type { VesselRunEvidence } from './run-evidence';
import { requestVesselEvidence } from './evidence-upload';
import type { VesselEvidenceProgress } from './run-evidence';
import { downloadVesselObjectInWorker } from './evidence-worker-client';
import { canonicalJson } from '@/lib/student-model-artifact-contract';
import { VESSEL_TRACE_COLUMNS } from './evidence-reference';

export type { CourseRecoveredRun, CourseRunRecoveryHeader, CourseRunRecovery } from './run-evidence';
import type { CourseRecoveredRun, CourseRunRecovery } from './run-evidence';

type DownloadAuthorization = { reference: string; url: string; storedBytes?: number | null };
async function downloadAuthorizations(runId: string, references: string[]) {
  const result = await requestVesselEvidence<{ objects: DownloadAuthorization[] }>(
    `/api/ilab/experiment-runs/${encodeURIComponent(runId)}/objects/downloads`, { references });
  return new Map(result.objects.map(object => [object.reference, object]));
}

async function downloadObject<T>(runId: string, authorization: DownloadAuthorization): Promise<T> {
  try { return await downloadVesselObjectInWorker<T>(authorization); }
  catch (error) {
    if (!(error instanceof Error) || (error as { status?: number }).status !== 403) throw error;
    const renewed = (await downloadAuthorizations(runId, [authorization.reference])).get(authorization.reference);
    if (!renewed) throw error;
    return downloadVesselObjectInWorker<T>(renewed);
  }
}

/** 向应用请求本人对象授权，正文在浏览器独立校验后再与本机进度对账。 */
export async function readRecoveredRunState(header: CourseRunRecovery): Promise<CourseRecoveredRun> {
  if (!('stateObjects' in header)) return header;
  const { stateObjects, ...metadata } = header;
  const references = [stateObjects.openingReference, stateObjects.checkpointReference];
  const grants = await downloadAuthorizations(header.id, references);
  const openingGrant = grants.get(stateObjects.openingReference);
  const checkpointGrant = grants.get(stateObjects.checkpointReference);
  if (!openingGrant || !checkpointGrant) throw new Error('实验恢复授权不完整，请重新读取进度。');
  const [opening, close] = await Promise.all([
    downloadObject<{ schema: string; runRef: string; parameterHash: string; initialCheckpoint: string;
      configuration: VesselRunEvidence['configuration']; input: VesselRunEvidence['initialInput'] }>(header.id, openingGrant),
    downloadObject<{ schema: string; checkpoint: string; endTimeS: number; controlCount: number; nativeCount: number;
      fineCount?: number; checkpointPreview?: VesselRunEvidence['checkpointPreview'] }>(header.id, checkpointGrant),
  ]);
  if (opening.schema !== 'act.vessel-run-opening.v1' || opening.runRef !== header.id
    || opening.parameterHash !== header.parameterHash || !opening.initialCheckpoint || !close.checkpoint
    || canonicalJson(opening.configuration) !== canonicalJson(header.configuration)
    || canonicalJson(opening.input) !== canonicalJson(header.initialInput)
    || close.schema !== 'act.vessel-run-close.v1' || close.endTimeS !== header.lastTimeS
    || close.controlCount !== header.traceManifest?.controlCount || close.nativeCount !== header.traceManifest.nativeCount
    || (close.fineCount ?? 0) !== (header.traceManifest.fineCount ?? 0)) {
    throw new Error('下载的恢复点与当前实验进度不一致，请重新读取记录。');
  }
  return { ...metadata, initialCheckpoint: opening.initialCheckpoint, checkpoint: close.checkpoint,
    checkpointPreview: close.checkpointPreview };
}

export async function fetchRecoveredRunHeader(runId: string): Promise<CourseRecoveredRun> {
  const params = new URLSearchParams({ recovery: '1', format: 'references', traceEncoding: VESSEL_TRACE_COLUMNS });
  const response = await fetch(`/api/ilab/experiment-runs/${encodeURIComponent(runId)}?${params}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('这次运行暂时无法读取，请稍后重试。');
  const run = await response.json() as CourseRunRecovery;
  if (run.id !== runId) throw new Error('云端记录与所选实验不一致，请重新读取进度。');
  return readRecoveredRunState(run);
}

export async function readRecoveredRunChunks(recovered: CourseRecoveredRun): Promise<CourseRecoveredRun> {
  const { traceManifest, ...metadata } = recovered;
  if (!traceManifest) return metadata;
  const run = { ...metadata, trace: [] as VesselRunEvidence['trace'], nativeSensorSamples: [] as VesselRunEvidence['nativeSensorSamples'],
    fineStepSamples: [] as NonNullable<VesselRunEvidence['fineStepSamples']>, changes: [] as VesselRunEvidence['changes'] };
  if (traceManifest.references && traceManifest.references.length !== traceManifest.chunkCount) {
    throw new Error('实验采样索引不完整，请重新读取记录。');
  }
  let grants = new Map<string, DownloadAuthorization>();
  for (let first = 0; first < traceManifest.chunkCount; first += 4) {
    if (first % 32 === 0) {
      const references = traceManifest.references?.slice(first, first + 32).filter(reference => reference.startsWith('simulation-cas:oss:')) ?? [];
      grants = references.length ? await downloadAuthorizations(run.id, references) : new Map();
    }
    const chunks = await Promise.all(Array.from({ length: Math.min(4, traceManifest.chunkCount - first) }, async (_, offset) => {
      const reference = traceManifest.references?.[first + offset];
      if (reference?.startsWith('simulation-cas:oss:')) {
        const grant = grants.get(reference);
        if (!grant) throw new Error('实验采样下载授权不完整，请重试。');
        return downloadObject<{
          runRef: string; parameterHash: string; chunkIndex: number; controlStart: number; nativeStart: number; fineStart?: number;
          points: VesselRunEvidence['trace']; nativeSamples: VesselRunEvidence['nativeSensorSamples'];
          fineSamples?: VesselRunEvidence['fineStepSamples']; changes: VesselRunEvidence['changes'];
        }>(run.id, grant);
      }
      const response = await fetch(`/api/ilab/experiment-runs/${encodeURIComponent(run.id)}?chunkIndex=${first + offset}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('实验采样暂时无法恢复，本机记录已保留，请稍后重试。');
      return response.json() as Promise<Pick<VesselEvidenceProgress, 'runRef' | 'parameterHash'> & {
        chunkIndex: number; controlStart: number; nativeStart: number; fineStart?: number;
        points: VesselRunEvidence['trace']; nativeSamples: VesselRunEvidence['nativeSensorSamples'];
        fineSamples?: VesselRunEvidence['fineStepSamples']; changes: VesselRunEvidence['changes'];
      }>;
    }));
    for (const [offset, chunk] of chunks.entries()) {
      if (chunk.runRef !== run.id || chunk.chunkIndex !== first + offset || chunk.parameterHash !== run.parameterHash
        || chunk.controlStart !== run.trace.length || chunk.nativeStart !== run.nativeSensorSamples.length
        || (chunk.fineStart ?? 0) !== (run.fineStepSamples?.length ?? 0)) throw new Error('云端采样与这次运行不一致，请重新读取记录。');
      run.trace.push(...chunk.points);
      run.nativeSensorSamples.push(...chunk.nativeSamples);
      run.fineStepSamples ??= [];
      run.fineStepSamples.push(...(chunk.fineSamples ?? []));
      run.changes.push(...chunk.changes);
    }
  }
  if (run.trace.length !== traceManifest.controlCount || run.nativeSensorSamples.length !== traceManifest.nativeCount
    || (run.fineStepSamples?.length ?? 0) !== (traceManifest.fineCount ?? 0)) throw new Error('云端采样与这次运行不一致，请重新读取记录。');
  return run;
}
