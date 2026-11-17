import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { writeSimulationTraceChunk, storeEncodedSimulationTrace } from '@/lib/data-governance/simulation-trace-cas';
import { evidenceCpuWorkersEnabled, runEvidenceCpuTask } from '@/lib/control-engine/evidence-cpu-pool';
import { findOwnedVesselRun } from '../course-evidence-service';
import { stageVesselEvidenceChunk, stageVesselEvidenceBytes } from '../course-evidence-chunks';
import type { VesselTraceChunk } from '../course-evidence-contract';
import { describeVesselTraceChunk } from '../course-evidence-prefix';

vi.mock('@/lib/prisma', () => ({ prisma: { $executeRaw: vi.fn(), simulationTrace: { findUnique: vi.fn() } } }));
vi.mock('@/lib/data-governance/simulation-trace-cas', () => ({
  readSimulationTraceChunk: vi.fn(), writeSimulationTraceChunk: vi.fn(), storeEncodedSimulationTrace: vi.fn(),
}));
vi.mock('@/lib/control-engine/evidence-cpu-pool', () => ({
  evidenceCpuWorkersEnabled: vi.fn(), runEvidenceCpuTask: vi.fn(),
}));
vi.mock('../course-evidence-service', () => ({
  findOwnedVesselRun: vi.fn(), vesselRunProgress: vi.fn(),
  vesselRunStorageSummary: (run: { summary: unknown }) => run.summary,
}));

const chunk: VesselTraceChunk = {
  schema: 'act.vessel-trace-chunk.v1', runRef: '00000000-0000-4000-8000-000000000001',
  chunkIndex: 0, controlStart: 0, nativeStart: 0, parameterHash: 'parameters', endTimeS: 5,
  points: [], changes: [], nativeSamples: [{ signal: 'Heading',
    measurement: { value: 0, t_sample_s: 0, t_arrive_s: 0, quality: 'Good' } }],
};
const checksum = createHash('sha256').update(canonicalJson(chunk)).digest('hex');
const reference = `simulation-cas:file:sha256:${checksum}`;
const ownedRun = { id: 'owned-run', ownerUserId: 'owner', sourceRefId: chunk.runRef,
  runtimeVersion: 'runtime', modelVersion: 'model', summary: {
    reportId: 'report', openingHash: 'opening-hash', courseVersion: 'course', parameterHash: chunk.parameterHash,
  } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findOwnedVesselRun).mockResolvedValue({ ...ownedRun, status: 'completed' } as never);
  vi.mocked(prisma.simulationTrace.findUnique).mockResolvedValue({ checksum, sampleStorageUri: reference } as never);
});

describe('合并计算后的原始分块入口', () => {
  const bytes = Buffer.from(JSON.stringify(chunk));
  const encoded = { checksum, compressed: new Uint8Array([1, 2]), uncompressedBytes: bytes.length };

  beforeEach(() => {
    vi.mocked(evidenceCpuWorkersEnabled).mockReturnValue(true);
    vi.mocked(runEvidenceCpuTask).mockResolvedValue({ runRef: chunk.runRef, chunkIndex: 0,
      metadata: describeVesselTraceChunk(chunk), encoded });
    vi.mocked(storeEncodedSimulationTrace).mockResolvedValue({ uri: reference } as never);
  });

  it('在所有权检查通过后才持久化编码结果', async () => {
    vi.mocked(findOwnedVesselRun).mockResolvedValue({ ...ownedRun, status: 'running' } as never);
    expect(await stageVesselEvidenceBytes('owner', chunk.runRef, bytes)).toEqual({ reference });
    expect(runEvidenceCpuTask).toHaveBeenCalledWith('trace-stage', bytes);
    expect(findOwnedVesselRun).toHaveBeenCalledWith('owner', chunk.runRef);
    expect(storeEncodedSimulationTrace).toHaveBeenCalledWith(encoded);
    expect(vi.mocked(findOwnedVesselRun).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(storeEncodedSimulationTrace).mock.invocationCallOrder[0]);
    expect(writeSimulationTraceChunk).not.toHaveBeenCalled();
  });

  it('地址不匹配和其他账号均拒绝且不会写入', async () => {
    await expect(stageVesselEvidenceBytes('owner', 'other-run', bytes)).rejects.toMatchObject({ status: 400 });
    expect(findOwnedVesselRun).not.toHaveBeenCalled();
    vi.mocked(findOwnedVesselRun).mockRejectedValue({ status: 404 });
    await expect(stageVesselEvidenceBytes('other', chunk.runRef, bytes)).rejects.toMatchObject({ status: 404 });
    expect(storeEncodedSimulationTrace).not.toHaveBeenCalled();
  });

  it('已结束运行同正文复用原回执，不同正文或不存在的分块返回409', async () => {
    expect(await stageVesselEvidenceBytes('owner', chunk.runRef, bytes)).toEqual({ reference });
    vi.mocked(prisma.simulationTrace.findUnique).mockResolvedValue({ checksum: 'changed', sampleStorageUri: reference } as never);
    await expect(stageVesselEvidenceBytes('owner', chunk.runRef, bytes)).rejects.toMatchObject({ status: 409 });
    vi.mocked(prisma.simulationTrace.findUnique).mockResolvedValue(null);
    await expect(stageVesselEvidenceBytes('owner', chunk.runRef, bytes)).rejects.toMatchObject({ status: 409 });
    expect(storeEncodedSimulationTrace).not.toHaveBeenCalled();
  });

  it('计算任务失败时保留原运行与存储', async () => {
    vi.mocked(runEvidenceCpuTask).mockRejectedValue({ status: 503 });
    await expect(stageVesselEvidenceBytes('owner', chunk.runRef, bytes)).rejects.toMatchObject({ status: 503 });
    expect(findOwnedVesselRun).not.toHaveBeenCalled();
    expect(storeEncodedSimulationTrace).not.toHaveBeenCalled();
  });

  it('关闭线程后继续支持同一原始字节入口及400校验', async () => {
    vi.mocked(evidenceCpuWorkersEnabled).mockReturnValue(false);
    expect(await stageVesselEvidenceBytes('owner', chunk.runRef, bytes)).toEqual({ reference });
    await expect(stageVesselEvidenceBytes('owner', chunk.runRef, Buffer.from('{'))).rejects.toMatchObject({ status: 400 });
    await expect(stageVesselEvidenceBytes('owner', 'other-run', bytes)).rejects.toMatchObject({ status: 400 });
    expect(runEvidenceCpuTask).not.toHaveBeenCalled();
  });
});

describe('结束保存回执丢失后的分块重试', () => {
  it('重试过程中运行已经结束时，同一正文复用已保存引用', async () => {
    expect(await stageVesselEvidenceChunk('owner', chunk)).toEqual({ reference });
    expect(prisma.simulationTrace.findUnique).toHaveBeenCalledWith({
      where: { runId_chunkIndex: { runId: 'owned-run', chunkIndex: 0 } },
      select: { checksum: true, sampleStorageUri: true },
    });
    expect(writeSimulationTraceChunk).not.toHaveBeenCalled();
  });

  it('相同索引的不同正文及未提交分块继续拒绝', async () => {
    await expect(stageVesselEvidenceChunk('owner', { ...chunk, endTimeS: 6 })).rejects.toMatchObject({ status: 409 });
    vi.mocked(prisma.simulationTrace.findUnique).mockResolvedValue(null);
    await expect(stageVesselEvidenceChunk('owner', chunk)).rejects.toMatchObject({ status: 409 });
    expect(writeSimulationTraceChunk).not.toHaveBeenCalled();
  });

  it('进行中的运行保持原暂存入口', async () => {
    vi.mocked(findOwnedVesselRun).mockResolvedValue({ ...ownedRun, status: 'running' } as never);
    vi.mocked(writeSimulationTraceChunk).mockResolvedValue({ uri: reference } as never);
    expect(await stageVesselEvidenceChunk('owner', chunk)).toEqual({ reference });
    expect(writeSimulationTraceChunk).toHaveBeenCalledWith(chunk);
    expect(prisma.simulationTrace.findUnique).not.toHaveBeenCalled();
  });

  it('其他账号在检查任何分块前拒绝', async () => {
    vi.mocked(findOwnedVesselRun).mockRejectedValue({ status: 404 });
    await expect(stageVesselEvidenceChunk('other', chunk)).rejects.toMatchObject({ status: 404 });
    expect(prisma.simulationTrace.findUnique).not.toHaveBeenCalled();
    expect(writeSimulationTraceChunk).not.toHaveBeenCalled();
  });
});
