import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { prepareVesselOssSave, decodeVesselOssObject } from '../evidence-worker-format';
import { decodeSimulationTrace } from '@/lib/data-governance/simulation-trace-codec';
import { describeVesselTraceChunk } from '@/features/ilab/course-evidence-prefix';
import { vesselEvidenceOpeningSchema, vesselEvidenceOssObjectSchema } from '@/features/ilab/course-evidence-contract';
import { vesselEvidenceOpeningInput } from '../evidence-opening';
import { canonicalJson } from '@/lib/student-model-artifact-contract';
import { simulationOssReference, simulationOssLocation, simulationTraceReferencePattern, VESSEL_TRACE_COLUMNS } from '../evidence-reference';
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
  it('相同正文的不同gzip长度分别登记，旧OSS和file/S3引用继续兼容', () => {
    const checksum = 'a'.repeat(64);
    const legacy = simulationOssReference(runRef, 'chunk', 2, checksum);
    const first = simulationOssReference(runRef, 'chunk', 2, checksum, 120);
    const second = simulationOssReference(runRef, 'chunk', 2, checksum, 140);
    expect(simulationOssLocation(first)).toMatchObject({ checksum, sequence: 2, storedBytes: 120 });
    expect(simulationOssLocation(first).key).not.toBe(simulationOssLocation(second).key);
    expect(simulationOssLocation(legacy).key).toBe(`experiments/${runRef}/chunk/2/${checksum}.json.gz`);
    for (const backend of ['file', 's3']) expect(simulationTraceReferencePattern.test(`simulation-cas:${backend}:sha256:${checksum}`)).toBe(true);
    expect(() => simulationOssReference(runRef, 'chunk', 2, checksum, 0)).toThrow('引用无效');
    expect(() => simulationOssReference(runRef, 'chunk', 2, checksum, 4 * 1024 * 1024 + 1)).toThrow('引用无效');
  });

  it('运行前预测的首尾空白按开户合同归一，直传初态保留同一哈希', async () => {
    const record = { ...run, courseKey: 'destroyer', courseVersion: 'test-version', stepSequence: 1,
      configuration: {}, initialInput: {}, initialCheckpoint: '{}', prediction: ' \n保留中间 空格和\n换行。\n ',
      createdAtMs: 1 } as unknown as VesselRunEvidence;
    const opening = vesselEvidenceOpeningInput('00000000-0000-4000-8000-000000000002', record);
    const accepted = vesselEvidenceOpeningSchema.parse(opening);
    const openingHash = createHash('sha256').update(canonicalJson(accepted)).digest('hex');
    const prepared = await prepareVesselOssSave(record, { ...progress, openingHash }, opening);
    const object = prepared.objects.find(object => object.descriptor.purpose === 'opening')!;
    const { schema, ...decoded } = await decodeVesselOssObject(object.descriptor.reference, object.body) as Record<string, unknown>;
    expect(schema).toBe('act.vessel-run-opening.v1');
    expect(decoded.prediction).toBe('保留中间 空格和\n换行。');
    expect(createHash('sha256').update(canonicalJson(decoded)).digest('hex')).toBe(openingHash);
    expect(record.prediction).toBe(' \n保留中间 空格和\n换行。\n ');
  });

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

  it('紧凑采样与旧格式解出同一数据和元数据，初态及恢复点使用原编码', async () => {
    const legacy = await prepareVesselOssSave(run, progress);
    const compact = await prepareVesselOssSave(run, { ...progress, traceEncoding: VESSEL_TRACE_COLUMNS });
    for (const [index, object] of compact.objects.entries()) {
      const location = simulationOssLocation(object.descriptor.reference);
      const decoded = await decodeVesselOssObject(object.descriptor.reference, object.body);
      const old = legacy.objects[index];
      if (object.descriptor.purpose !== 'chunk') {
        expect(location.traceEncoding).toBeUndefined();
        continue;
      }
      expect(location.traceEncoding).toBe(VESSEL_TRACE_COLUMNS);
      expect(vesselEvidenceOssObjectSchema.safeParse(object.descriptor).success).toBe(true);
      expect(decoded).toEqual(await decodeVesselOssObject(old.descriptor.reference, old.body));
      expect(object.descriptor.chunk).toEqual(describeVesselTraceChunk(decoded as never));
      const stored = new Uint8Array(await object.body.arrayBuffer());
      await expect(decodeSimulationTrace(stored, location.checksum, location.traceEncoding)).resolves.toEqual(decoded);
      await expect(decodeSimulationTrace(stored, '0'.repeat(64), location.traceEncoding)).rejects.toThrow('校验失败');
    }
  });

  it('损坏正文、解压膨胀及缺少浏览器恢复检查均拒绝', async () => {
    const result = await prepareVesselOssSave(run, progress);
    const reference = result.objects[0].descriptor.reference;
    const wrong = gzipSync('{"wrong":true}');
    const wrongReference = simulationOssReference(runRef, 'chunk', 0, simulationOssLocation(reference).checksum, wrong.length);
    await expect(decodeVesselOssObject(wrongReference, new Blob([wrong]))).rejects.toThrow('校验失败');
    const oversized = Buffer.from(JSON.stringify({ value: 'x'.repeat(4 * 1024 * 1024) }));
    const digest = createHash('sha256').update(oversized).digest('hex');
    const oversizedGzip = gzipSync(oversized);
    await expect(decodeVesselOssObject(simulationOssReference(runRef, 'chunk', 0, digest, oversizedGzip.length), new Blob([oversizedGzip])))
      .rejects.toThrow('大小超过');
    await expect(prepareVesselOssSave({ ...run, checkpointPreview: undefined }, progress)).rejects.toThrow('恢复检查');
  });
});
