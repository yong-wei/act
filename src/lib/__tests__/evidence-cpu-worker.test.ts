import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeEvidenceCpuPool, evidenceCpuPoolStats, runEvidenceCpuTask } from '../control-engine/evidence-cpu-pool';
import { vesselTraceChunkSchema } from '@/features/ilab/course-evidence-contract';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';

beforeAll(() => vi.stubEnv('SIMULATION_CPU_WORKERS', '1'));
afterAll(async () => { await closeEvidenceCpuPool(); vi.unstubAllEnvs(); });

describe('真实保存工作线程与历史数据兼容', () => {
  it('现有入口加载线程，规范化原文及内容哈希与历史黄金值一致', async () => {
    const legacy = '{"schema":"test","units":"°/s","values":[1,2,null,4]}';
    const checksum = createHash('sha256').update(legacy).digest('hex');
    const encoded = await runEvidenceCpuTask('encode', { values: [1, 2, null, 4], units: '°/s', schema: 'test' });
    expect(encoded.checksum).toBe(checksum);
    expect(encoded.uncompressedBytes).toBe(Buffer.byteLength(legacy));
    expect(gunzipSync(encoded.compressed).toString()).toBe(legacy);
    expect(Buffer.from(encoded.compressed)).toEqual(gzipSync(legacy, { level: 3 }));
    expect(await runEvidenceCpuTask('decode', { compressed: gzipSync(legacy), checksum })).toEqual(JSON.parse(legacy));
    expect(evidenceCpuPoolStats()).toMatchObject({ workers: 1, completedJobs: 2 });
  });

  it('分块在同一任务中解析并按原合同规范化，外部枚举对象保留', async () => {
    const raw = {
      schema: 'act.vessel-trace-chunk.v1', runRef: '00000000-0000-4000-8000-000000000001',
      chunkIndex: 0, controlStart: 0, nativeStart: 0, parameterHash: 'parameters', endTimeS: 5,
      points: [], changes: [], extra: 'discarded', nativeSamples: [
        { signal: { SurfaceEncoder: 0, extra: 'discarded' },
          measurement: { value: 1, t_sample_s: 0, t_arrive_s: 0, quality: 'Good', extra: 'discarded' } },
        { signal: 'WindDirection', measurement: { value: null, t_sample_s: 0, t_arrive_s: 0, quality: 'Undefined' } },
      ],
    };
    const normalized = vesselTraceChunkSchema.parse(raw);
    const prepared = await runEvidenceCpuTask('trace-stage', Buffer.from(JSON.stringify(raw)));
    const text = canonicalJson(normalized);
    expect(prepared).toMatchObject({ runRef: raw.runRef, chunkIndex: 0 });
    expect(gunzipSync(prepared.encoded.compressed).toString()).toBe(text);
    expect(prepared.encoded.checksum).toBe(createHash('sha256').update(text).digest('hex'));
  });

  it('无效原文和合同分别返回原有400，线程继续处理有效任务', async () => {
    await expect(runEvidenceCpuTask('trace-stage', Buffer.from('{'))).rejects.toMatchObject({ status: 400 });
    await expect(runEvidenceCpuTask('trace-stage', Buffer.from('{}'))).rejects.toMatchObject({ status: 400 });
    expect((await runEvidenceCpuTask('encode', { retried: true })).checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('损坏内容和超过4MiB上限的数据均拒绝', async () => {
    const compressed = gzipSync('{"values":[1]}');
    await expect(runEvidenceCpuTask('decode', { compressed, checksum: '0'.repeat(64) })).rejects.toThrow('校验失败');
    const oversized = JSON.stringify({ value: 'x'.repeat(4 * 1024 * 1024) });
    await expect(runEvidenceCpuTask('decode', {
      compressed: gzipSync(oversized), checksum: createHash('sha256').update(oversized).digest('hex'),
    })).rejects.toThrow();
    await expect(runEvidenceCpuTask('encode', { value: oversized })).rejects.toThrow('过大');
    await expect(runEvidenceCpuTask('decode', { compressed: new Uint8Array(4 * 1024 * 1024 + 1),
      checksum: '0'.repeat(64) })).rejects.toThrow('大小无效');
  });
});
