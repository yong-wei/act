import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { gunzip, gzip, gzipSync } from 'node:zlib';
import { readSimulationTraceChunk, writeSimulationTraceChunk } from '../data-governance/simulation-trace-cas';

vi.mock('node:zlib', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:zlib')>();
  return { ...original, gzip: vi.fn(original.gzip), gunzip: vi.fn(original.gunzip) };
});

let root: string;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv('SIMULATION_CPU_WORKERS', '0');
  root = await mkdtemp(path.join(os.tmpdir(),'act-simulation-trace-'));
  vi.stubEnv('SIMULATION_EVIDENCE_ROOT',root);
  for (const key of ['SUBMISSION_S3_ENDPOINT','SUBMISSION_S3_BUCKET','SUBMISSION_S3_ACCESS_KEY','SUBMISSION_S3_SECRET_KEY']) vi.stubEnv(key,'');
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root,{ recursive:true,force:true }); });

describe('SimulationTrace私有内容寻址分块', () => {
  it('相同原始分块并发写入后读取同一完整对象', async () => {
    const data = { schema:'test',values:[1,2,null,4],units:'°/s' };
    const [first,second] = await Promise.all([writeSimulationTraceChunk(data),writeSimulationTraceChunk(data)]);
    expect(first.uri).toBe(second.uri);
    expect(first.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(await readSimulationTraceChunk(first.uri)).toEqual(data);
    const file = path.join(root,'sha256',first.checksum.slice(0,2),`${first.checksum}.json.gz`);
    expect((await readFile(file)).byteLength).toBe(first.storedBytes);
  });

  it('损坏或错误内容与目录穿越引用均拒绝', async () => {
    const stored = await writeSimulationTraceChunk({ samples:[1,2,3] });
    const file = path.join(root,'sha256',stored.checksum.slice(0,2),`${stored.checksum}.json.gz`);
    await writeFile(file,gzipSync(Buffer.from('{"samples":[9]}')));
    await expect(readSimulationTraceChunk(stored.uri)).rejects.toThrow('校验失败');
    await expect(readSimulationTraceChunk('simulation-cas:file:sha256:../../private')).rejects.toThrow('引用无效');
  });

  it('读取旧分块并以相同内容身份保存快速压缩分块', async () => {
    const legacyText = '{"schema":"test","units":"°/s","values":[1,2,null,4]}';
    const checksum = createHash('sha256').update(legacyText).digest('hex');
    const reference = `simulation-cas:file:sha256:${checksum}`;
    const file = path.join(root, 'sha256', checksum.slice(0, 2), `${checksum}.json.gz`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, gzipSync(legacyText));
    const data = { values: [1, 2, null, 4], units: '°/s', schema: 'test' };

    expect(await readSimulationTraceChunk(reference)).toEqual(data);
    const stored = await writeSimulationTraceChunk(data);
    expect(stored.uri).toBe(reference);
    expect(await readFile(file)).toEqual(gzipSync(legacyText,{ level:3 }));
    expect(gzip).toHaveBeenCalledOnce();
    expect(gunzip).toHaveBeenCalledOnce();
  });

  it('异步解压继续拒绝超过原文大小上限的压缩分块', async () => {
    const text = JSON.stringify({ value: 'x'.repeat(4 * 1024 * 1024) });
    const checksum = createHash('sha256').update(text).digest('hex');
    const file = path.join(root, 'sha256', checksum.slice(0, 2), `${checksum}.json.gz`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, gzipSync(text));

    await expect(readSimulationTraceChunk(`simulation-cas:file:sha256:${checksum}`)).rejects.toThrow();
  });
});
