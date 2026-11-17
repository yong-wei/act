import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadDirectVesselRunEvidence } from '../evidence-direct-upload';
import { prepareVesselSaveInWorker } from '../evidence-worker-client';
import type { VesselRunEvidence } from '../run-evidence';
import type { VesselEvidenceProgress } from '../evidence-upload';

vi.mock('../evidence-worker-client', () => ({ prepareVesselSaveInWorker: vi.fn() }));
let run: VesselRunEvidence;
let progress: VesselEvidenceProgress;
const reference = 'simulation-cas:oss:00000000-0000-4000-8000-000000000001:checkpoint:0:sha256:' + 'a'.repeat(64);

beforeEach(() => {
  vi.resetAllMocks();
  run = { id: randomUUID(), checkpoint: 'snapshot', stopReason: 'student', stoppedAtMs: 1,
    parameterHash: 'parameter', lastTimeS: 0, durationS: 60, failure: null,
    trace: [], nativeSensorSamples: [], fineStepSamples: [], changes: [] } as unknown as VesselRunEvidence;
  progress = { runRef: run.id, status: 'running', chunkCount: 0, controlCount: 0, nativeCount: 0,
    fineCount: 0, lastTimeS: 0, parameterHash: 'parameter', reportId: 'report', experimentKey: 'destroyer' };
  vi.mocked(prepareVesselSaveInWorker).mockResolvedValue({ objects: [], close: {} as never, checkpointReference: reference });
});
afterEach(() => vi.unstubAllGlobals());

describe('直传保存重试', () => {
  it('结束核验失败后复用已编码恢复点继续核验，不将已保存误报为核验成功', async () => {
    const failed = { ...progress, checkpointReference: reference, evidenceStatus: 'failed' as const };
    const request = vi.fn().mockRejectedValueOnce(Object.assign(new Error('verification failed'), { savedProgress: failed }))
      .mockResolvedValueOnce({ ...failed, status: 'completed', evidenceStatus: 'verified' });
    await expect(uploadDirectVesselRunEvidence('report-ref', run, progress, request as never)).rejects.toThrow('verification failed');
    await expect(uploadDirectVesselRunEvidence('report-ref', run, failed, request as never)).resolves.toMatchObject({
      status: 'completed', evidenceStatus: 'verified',
    });
    expect(prepareVesselSaveInWorker).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('普通保存回执丢失后，已确认的同一恢复点无需再次编码或上传', async () => {
    run.stoppedAtMs = null;
    run.stopReason = null;
    const saved = { ...progress, checkpointReference: reference, evidenceStatus: 'pending' as const };
    const request = vi.fn().mockResolvedValue(saved);
    await uploadDirectVesselRunEvidence('report-ref', run, progress, request as never);
    expect(await uploadDirectVesselRunEvidence('report-ref', run, saved, request as never)).toEqual(saved);
    expect(prepareVesselSaveInWorker).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledOnce();
  });

  it('同一状态的停止目标或保存描述变化时重新编码', async () => {
    const request = vi.fn().mockResolvedValue(progress);
    await uploadDirectVesselRunEvidence('report-ref', run, progress, request as never);
    run.durationS = 120;
    await uploadDirectVesselRunEvidence('report-ref', run, progress, request as never);
    expect(prepareVesselSaveInWorker).toHaveBeenCalledTimes(2);
  });

  it('上传授权过期后重新签发，复用同一份已压缩Blob', async () => {
    const body = new Blob(['compressed-test']);
    vi.mocked(prepareVesselSaveInWorker).mockResolvedValue({ objects: [{ body,
      descriptor: { reference, purpose: 'checkpoint' } as never }], close: {} as never, checkpointReference: reference });
    const grant = { objects: [{ reference, confirmed: false, url: 'https://private.example',
      fields: { key: 'exact-object' }, expiresAt: '2026-11-18T00:00:00Z' }] };
    const request = vi.fn().mockResolvedValueOnce(grant).mockResolvedValueOnce(grant)
      .mockResolvedValueOnce({ ...progress, status: 'completed', evidenceStatus: 'verified' });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 403 })).mockResolvedValueOnce(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await uploadDirectVesselRunEvidence('report-ref', run, progress, request as never);
    expect(prepareVesselSaveInWorker).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledTimes(3);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.credentials).toBe('omit');
      expect(await options.body.get('file').text()).toBe('compressed-test');
    }
  });
});
