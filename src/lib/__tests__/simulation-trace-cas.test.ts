import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gzipSync } from 'node:zlib';
import { readSimulationTraceChunk, writeSimulationTraceChunk } from '../data-governance/simulation-trace-cas';

let root: string;
beforeEach(async () => {
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
});
