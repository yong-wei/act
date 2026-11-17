import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { prepareVesselOssSave, decodeVesselOssObject } from '../evidence-worker-format';
import { decodeSimulationTrace } from '@/lib/data-governance/simulation-trace-codec';
import { describeVesselTraceChunk } from '@/features/ilab/course-evidence-prefix';
import { vesselEvidenceOssObjectSchema } from '@/features/ilab/course-evidence-contract';
import type { VesselRunEvidence } from '../run-evidence';
import type { VesselEvidenceProgress } from '../evidence-upload';

const runRef = '00000000-0000-4000-8000-000000000001';
const progress: VesselEvidenceProgress = { runRef, reportId: 'report', experimentKey: 'destroyer', status: 'running',
  chunkCount: 0, controlCount: 0, nativeCount: 0, fineCount: 0, lastTimeS: 0, parameterHash: 'parameter',
  checkpointReference: `simulation-cas:file:sha256:${'0'.repeat(64)}` };
const run = { id: runRef, parameterHash: 'parameter', lastTimeS: 6, durationS: 60, stoppedAtMs: null, stopReason: null,
  failure: null, checkpoint: '{"input":{}}', trace: [], changes: [],
  nativeSensorSamples: [0.5, 5.5].map(time => ({ signal: 'Heading', measurement: {
    value: Number.NaN, quality: 'Undefined', t_sample_s: time, t_arrive_s: time } })),
  checkpointPreview: { schema: 'act.vessel-checkpoint-preview.v1', recoverable: true, parameterHash: 'parameter',
    timeS: 6, controllerTicks: 0, fineCount: 0, appliedFinalInput: {}, metrics: {} },
} as unknown as VesselRunEvidence;

describe('浏览器分块编码与恢复格式', () => {
  it('保留五秒分块、规范序正文、哈希和gzip，与服务端元数据逐项相同', async () => {
    const result = await prepareVesselOssSave(run, progress);
    expect(result.objects).toHaveLength(3);
    expect(result.close).toMatchObject({ nativeCount: 2, controlCount: 0, endTimeS: 6, reason: 'checkpoint' });
    for (const object of result.objects) {
      expect(vesselEvidenceOssObjectSchema.safeParse(object.descriptor).success).toBe(true);
      const checksum = object.descriptor.reference.slice(-64);
      const decoded = await decodeSimulationTrace(new Uint8Array(await object.body.arrayBuffer()), checksum);
      expect(await decodeVesselOssObject(object.descriptor.reference, object.body)).toEqual(decoded);
      expect(object.body.size).toBe(object.descriptor.storedBytes);
      if (object.descriptor.purpose === 'chunk') {
        expect(object.descriptor.chunk).toEqual(describeVesselTraceChunk(decoded as never));
      }
    }
    expect(result.objects.slice(0, 2).map(object => object.descriptor.purpose === 'chunk'
      && [object.descriptor.chunk.chunkIndex, object.descriptor.chunk.nativeStart, object.descriptor.chunk.endTimeS]))
      .toEqual([[0, 0, 5], [1, 1, 6]]);
    expect(result.close.pendingChunks).toEqual(result.objects.slice(0, 2).map(object => object.descriptor.reference));
  });

  it('恢复后的新分块保留绝对采样序号，重试可复用原Blob', async () => {
    const first = await prepareVesselOssSave(run, progress);
    const resumed = await prepareVesselOssSave({ ...run, nativeSensorSamples: run.nativeSensorSamples.slice(1) },
      { ...progress, chunkCount: 1, nativeCount: 1, lastTimeS: 5 });
    expect(resumed.objects[0].descriptor.reference).toBe(first.objects[1].descriptor.reference);
    const body = first.objects[1].body;
    expect(await body.arrayBuffer()).toEqual(await body.arrayBuffer());
  });

  it('损坏正文、解压膨胀及缺少浏览器恢复检查均拒绝', async () => {
    const result = await prepareVesselOssSave(run, progress);
    const reference = result.objects[0].descriptor.reference;
    await expect(decodeVesselOssObject(reference, new Blob([gzipSync('{"wrong":true}')]))).rejects.toThrow('校验失败');
    const oversized = Buffer.from(JSON.stringify({ value: 'x'.repeat(4 * 1024 * 1024) }));
    const digest = createHash('sha256').update(oversized).digest('hex');
    await expect(decodeVesselOssObject(reference.slice(0, -64) + digest, new Blob([gzipSync(oversized)])))
      .rejects.toThrow('大小超过');
    await expect(prepareVesselOssSave({ ...run, checkpointPreview: undefined }, progress)).rejects.toThrow('恢复检查');
  });
});
