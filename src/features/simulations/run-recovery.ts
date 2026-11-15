import type { VesselRunEvidence } from './run-evidence';
import type { VesselEvidenceProgress } from './evidence-upload';

export interface CourseRecoveredRun extends VesselRunEvidence {
  uploadReceipt?: VesselEvidenceProgress & { reportClientRef: string };
  resumable?: boolean;
  traceManifest?: Pick<VesselEvidenceProgress, 'chunkCount' | 'controlCount' | 'nativeCount' | 'fineCount'>;
}

export async function fetchRecoveredRunHeader(runId: string): Promise<CourseRecoveredRun> {
  const response = await fetch(`/api/ilab/experiment-runs/${encodeURIComponent(runId)}?recovery=1`, { cache: 'no-store' });
  if (!response.ok) throw new Error('这次运行暂时无法读取，请稍后重试。');
  const run = await response.json() as CourseRecoveredRun;
  if (run.id !== runId) throw new Error('云端记录与所选实验不一致，请重新读取进度。');
  return run;
}

export async function readRecoveredRunChunks(recovered: CourseRecoveredRun): Promise<CourseRecoveredRun> {
  const { traceManifest, ...metadata } = recovered;
  if (!traceManifest) return metadata;
  const run = { ...metadata, trace: [] as VesselRunEvidence['trace'], nativeSensorSamples: [] as VesselRunEvidence['nativeSensorSamples'],
    fineStepSamples: [] as NonNullable<VesselRunEvidence['fineStepSamples']>, changes: [] as VesselRunEvidence['changes'] };
  for (let first = 0; first < traceManifest.chunkCount; first += 4) {
    const chunks = await Promise.all(Array.from({ length: Math.min(4, traceManifest.chunkCount - first) }, async (_, offset) => {
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
