import { prepareVesselOssSave, downloadVesselOssObject } from './evidence-worker-format';
import type { VesselRunEvidence } from './run-evidence';
import type { VesselEvidenceProgress } from './run-evidence';
import type { vesselEvidenceOpeningInput } from './evidence-opening';

type Request = { id: number } & ({ operation: 'prepare'; run: VesselRunEvidence; progress: VesselEvidenceProgress;
  opening?: ReturnType<typeof vesselEvidenceOpeningInput>; separateProcessData?: boolean }
  | { operation: 'download'; reference: string; url: string; storedBytes?: number | null });

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
    const result = request.operation === 'prepare'
      ? await prepareVesselOssSave(request.run, request.progress, request.opening, request.separateProcessData)
      : await downloadVesselOssObject(request);
    self.postMessage({ id: request.id, result });
  } catch (error) {
    self.postMessage({ id: request.id, error: error instanceof Error ? error.message : '实验记录处理失败，请保留本机记录后重试。',
      status: error instanceof Error ? (error as { status?: number }).status : undefined });
  }
};
