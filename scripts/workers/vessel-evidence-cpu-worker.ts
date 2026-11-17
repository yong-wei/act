import { parentPort } from 'node:worker_threads';
import { vesselTraceChunkSchema, type VesselEvidenceOpening } from '../../src/features/ilab/course-evidence-contract';
import { encodeSimulationTrace, decodeSimulationTrace } from '../../src/lib/data-governance/simulation-trace-codec';
import { prepareVesselEvidenceOpening, prepareVesselEvidenceClose,
  type PrepareVesselCloseInput } from '../../src/features/ilab/course-evidence-compute';
import type { EvidenceCpuRequest, EvidenceCpuResponse } from '../../src/lib/control-engine/evidence-cpu-pool';

async function execute(request: EvidenceCpuRequest): Promise<unknown> {
  switch (request.operation) {
    case 'encode':
      return encodeSimulationTrace(request.payload);
    case 'decode': {
      const input = request.payload as { compressed: Uint8Array; checksum: string };
      return decodeSimulationTrace(input.compressed, input.checksum);
    }
    case 'trace-stage': {
      let value: unknown;
      try { value = JSON.parse(Buffer.from(request.payload as Uint8Array).toString('utf8')); }
      catch { throw Object.assign(new Error('实验数据内容无法解析。'), { status: 400 }); }
      const parsed = vesselTraceChunkSchema.safeParse(value);
      if (!parsed.success) throw Object.assign(new Error('原始采样分块内容不完整。'), { status: 400 });
      return { runRef: parsed.data.runRef, chunkIndex: parsed.data.chunkIndex,
        encoded: await encodeSimulationTrace(parsed.data) };
    }
    case 'open-prepare':
      return prepareVesselEvidenceOpening(request.payload as VesselEvidenceOpening);
    case 'close-prepare':
      return prepareVesselEvidenceClose(request.payload as PrepareVesselCloseInput);
    default:
      throw new Error('Unsupported evidence CPU operation');
  }
}

parentPort?.on('message', async (request: EvidenceCpuRequest) => {
  let response: EvidenceCpuResponse;
  try {
    response = { id: request.id, value: await execute(request) };
  } catch (error) {
    const failure = error as { message?: string; status?: number };
    response = { id: request.id, error: { message: failure?.message ?? String(error), status: failure?.status } };
  }
  parentPort?.postMessage(response);
});
