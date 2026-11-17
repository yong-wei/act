import type { VesselRunEvidence } from './run-evidence';
import type { VesselEvidenceProgress } from './run-evidence';
import type { PreparedVesselOssSave } from './evidence-worker-format';
import { vesselEvidenceOpeningInput } from './evidence-opening';

let worker: Worker | undefined;
let requestId = 0;
const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();

function request<T>(input: Record<string, unknown>): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./evidence.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string; status?: number }>) => {
      const request = pending.get(event.data.id);
      if (!request) return;
      pending.delete(event.data.id);
      if (event.data.error) request.reject(Object.assign(new Error(event.data.error), { status: event.data.status }));
      else request.resolve(event.data.result);
    };
    worker.onerror = () => {
      for (const request of pending.values()) request.reject(new Error('实验记录处理已中断，本机记录已保留，请重试。'));
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  const id = ++requestId;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: value => resolve(value as T), reject });
    worker!.postMessage({ ...input, id });
  });
}

export function prepareVesselSaveInWorker(reportClientRef: string, run: VesselRunEvidence, progress: VesselEvidenceProgress) {
  return request<PreparedVesselOssSave>({ operation: 'prepare', progress,
    opening: progress.openingReference?.startsWith('simulation-cas:oss:') ? undefined : vesselEvidenceOpeningInput(reportClientRef, run),
    run: { ...run, trace: run.trace.slice(progress.controlCount),
      nativeSensorSamples: run.nativeSensorSamples.slice(progress.nativeCount),
      ...(run.fineStepSamples ? { fineStepSamples: run.fineStepSamples.slice(progress.fineCount ?? 0) } : {}) } });
}

export function downloadVesselObjectInWorker<T>(input: { reference: string; url: string; storedBytes?: number | null }) {
  return request<T>({ operation: 'download', ...input });
}
