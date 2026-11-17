import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { uploadVesselRunEvidence } from '../evidence-upload';
import { uploadDirectVesselRunEvidence } from '../evidence-direct-upload';
import type { VesselRunEvidence } from '../run-evidence';

vi.mock('../evidence-direct-upload', () => ({ uploadDirectVesselRunEvidence: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('直传关闭后的继续保存', () => {
  it('根据服务器当前传输方式继续原运行，保留OSS读取与完整检查点', async () => {
    const id = randomUUID();
    const checkpointReference = `simulation-cas:file:sha256:${'0'.repeat(64)}`;
    const receipt = { runRef: id, reportId: 'report', experimentKey: 'destroyer', status: 'running',
      chunkCount: 0, controlCount: 0, nativeCount: 0, fineCount: 0, lastTimeS: 0, parameterHash: 'parameter',
      checkpointReference, transport: 'oss' as const, reportClientRef: 'report-ref' };
    const run = { id, trace: [], nativeSensorSamples: [], fineStepSamples: [], changes: [],
      lastTimeS: 0, parameterHash: 'parameter', stoppedAtMs: null, stopReason: null, failure: null, checkpoint: 'snapshot',
      checkpointPreview: { recoverable: true },
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

  it('历史恢复记录缺少浏览器摘要时，继续使用兼容保存并更新回执', async () => {
    const id = randomUUID();
    const receipt = { runRef: id, reportId: 'report', experimentKey: 'destroyer', status: 'running',
      chunkCount: 0, controlCount: 0, nativeCount: 0, fineCount: 0, lastTimeS: 0, parameterHash: 'parameter',
      checkpointReference: `simulation-cas:oss:${id}:checkpoint:0:sha256:${'0'.repeat(64)}`,
      transport: 'oss' as const, reportClientRef: 'report-ref' };
    const run = { id, trace: [], nativeSensorSamples: [], fineStepSamples: [], changes: [], prediction: '历史预测',
      lastTimeS: 0, parameterHash: 'parameter', stoppedAtMs: null, stopReason: null, failure: null,
      checkpoint: 'snapshot', uploadReceipt: receipt } as unknown as VesselRunEvidence & { uploadReceipt: typeof receipt };
    const latest = { ...receipt, checkpointReference: `simulation-cas:file:sha256:${'1'.repeat(64)}` };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(latest));
    vi.stubGlobal('fetch', fetchMock);
    await expect(uploadVesselRunEvidence('report-ref', run)).resolves.toEqual(latest);
    expect(uploadDirectVesselRunEvidence).not.toHaveBeenCalled();
    const compressed = fetchMock.mock.calls[0][1].body;
    const sent = JSON.parse(await new Response(new Blob([compressed]).stream()
      .pipeThrough(new DecompressionStream('gzip'))).text());
    expect(sent).toMatchObject({ checkpoint: 'snapshot', baseCheckpointReference: receipt.checkpointReference });
    fetchMock.mockReset().mockResolvedValue(Response.json(latest));
    await uploadVesselRunEvidence('report-ref', run);
    const next = JSON.parse(await new Response(new Blob([fetchMock.mock.calls[0][1].body]).stream()
      .pipeThrough(new DecompressionStream('gzip'))).text());
    expect(next.baseCheckpointReference).toBe(latest.checkpointReference);
  });
});
