import type { VesselRunEvidence } from './run-evidence';
import type { VesselEvidenceProgress } from './run-evidence';
import type { PreparedVesselOssSave } from './evidence-worker-format';
import { prepareVesselSaveInWorker } from './evidence-worker-client';
import { canonicalJson } from '@/lib/student-model-artifact-contract';

type Authorization = { reference: string; confirmed: true } | {
  reference: string; confirmed: false; url: string; fields: Record<string, string>; expiresAt: string;
};
type Request = <T>(url: string, value: unknown, method?: string) => Promise<T>;
let cached: { runRef: string; checkpoint: string; metadataKey: string;
  base: string; prepared: Promise<PreparedVesselOssSave> } | undefined;

async function uploadObject(object: PreparedVesselOssSave['objects'][number], authorization: Authorization) {
  if (authorization.confirmed) return;
  const form = new FormData();
  for (const [key, value] of Object.entries(authorization.fields)) form.append(key, value);
  form.append('file', new Blob([object.body], { type: 'application/gzip' }), 'evidence.json.gz');
  const response = await fetch(authorization.url, { method: 'POST', body: form, credentials: 'omit' });
  if (response.ok) return;
  if (response.status === 409 && (await response.text()).includes('<Code>FileAlreadyExists</Code>')) return;
  throw Object.assign(new Error('实验记录直传暂未完成，本机记录已保留，请重试。'), { status: response.status });
}

export async function uploadDirectVesselRunEvidence(reportClientRef: string,
  run: VesselRunEvidence, progress: VesselEvidenceProgress, request: Request) {
  const base = `${progress.chunkCount}:${progress.controlCount}:${progress.nativeCount}:${progress.fineCount ?? 0}:${progress.lastTimeS}`;
  const metadataKey = canonicalJson({ reportClientRef, parameterHash: run.parameterHash,
    endTimeS: run.lastTimeS, durationS: run.durationS, stopped: run.stoppedAtMs !== null,
    reason: run.stopReason, failure: run.failure, checkpointPreview: run.checkpointPreview,
    controlCount: run.trace.length, nativeCount: run.nativeSensorSamples.length,
    fineCount: run.fineStepSamples?.length ?? 0, changeCount: run.changes.length });
  if (!cached || cached.runRef !== run.id || cached.checkpoint !== run.checkpoint || cached.metadataKey !== metadataKey) cached = undefined;
  if (cached) {
    const prepared = await cached.prepared;
    if (progress.checkpointReference === prepared.checkpointReference
      && (run.stoppedAtMs === null || progress.status !== 'running')) return progress;
    if (cached.base !== base) cached = undefined;
  }
  if (!cached) {
    const prepared = prepareVesselSaveInWorker(reportClientRef, run, progress);
    cached = { runRef: run.id, checkpoint: run.checkpoint, metadataKey, base, prepared };
    void prepared.catch(() => { if (cached?.prepared === prepared) cached = undefined; });
  }
  const prepared = await cached.prepared;
  for (let first = 0; first < prepared.objects.length; first += 16) {
    const batch = prepared.objects.slice(first, first + 16);
    const grants = await request<{ objects: Authorization[] }>(`/api/ilab/experiment-runs/${run.id}/objects`,
      { objects: batch.map(object => object.descriptor) });
    const indexed = new Map(grants.objects.map(authorization => [authorization.reference, authorization]));
    for (let start = 0; start < batch.length; start += 4) {
      await Promise.all(batch.slice(start, start + 4).map(async object => {
        const authorization = indexed.get(object.descriptor.reference);
        if (!authorization) throw new Error('实验上传授权不完整，请保留本机记录后重试。');
        try { await uploadObject(object, authorization); }
        catch (error) {
          if (!(error instanceof Error) || (error as { status?: number }).status !== 403) throw error;
          const renewed = await request<{ objects: Authorization[] }>(`/api/ilab/experiment-runs/${run.id}/objects`,
            { objects: [object.descriptor] });
          if (!renewed.objects[0]) throw error;
          await uploadObject(object, renewed.objects[0]);
        }
      }));
    }
  }
  return request<VesselEvidenceProgress>(`/api/ilab/experiment-runs/${run.id}`,
    { ...prepared.close, checkpointReference: prepared.checkpointReference }, 'PUT');
}
