import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { uploadVesselRunEvidence } from '../evidence-upload';
import { uploadDirectVesselRunEvidence } from '../evidence-direct-upload';
import type { VesselRunEvidence } from '../run-evidence';

vi.mock('../evidence-direct-upload', () => ({ uploadDirectVesselRunEvidence: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

describe('直传关闭后的继续保存', () => {
  it('根据服务器当前传输方式继续原运行，保留OSS读取与完整检查点', async () => {
    const id = randomUUID();
    const checkpointReference = `simulation-cas:file:sha256:${'0'.repeat(64)}`;
    const receipt = { runRef: id, reportId: 'report', experimentKey: 'destroyer', status: 'running',
      chunkCount: 0, controlCount: 0, nativeCount: 0, fineCount: 0, lastTimeS: 0, parameterHash: 'parameter',
      checkpointReference, transport: 'oss' as const, reportClientRef: 'report-ref' };
    const run = { id, trace: [], nativeSensorSamples: [], fineStepSamples: [], changes: [],
      lastTimeS: 0, parameterHash: 'parameter', stoppedAtMs: null, stopReason: null, failure: null, checkpoint: 'snapshot',
      uploadReceipt: receipt } as unknown as VesselRunEvidence & { uploadReceipt: typeof receipt };
    vi.mocked(uploadDirectVesselRunEvidence).mockRejectedValueOnce(Object.assign(new Error('disabled'), { status: 503 }));
    const current = { ...receipt, transport: 'legacy' };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(current)).mockResolvedValueOnce(Response.json(current));
    vi.stubGlobal('fetch', fetchMock);
    await expect(uploadVesselRunEvidence('report-ref', run)).resolves.toMatchObject({ runRef: id, transport: 'legacy' });
    expect(uploadDirectVesselRunEvidence).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.map(([url, options]) => [url, options.method ?? 'GET'])).toEqual([
      [`/api/ilab/experiment-runs/${id}`, 'GET'], [`/api/ilab/experiment-runs/${id}`, 'PUT'],
    ]);
  });
});
