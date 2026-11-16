import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { writeSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { findOwnedVesselRun } from '../course-evidence-service';
import { stageVesselEvidenceChunk } from '../course-evidence-chunks';
import type { VesselTraceChunk } from '../course-evidence-contract';

vi.mock('@/lib/prisma', () => ({ prisma: { simulationTrace: { findUnique: vi.fn() } } }));
vi.mock('@/lib/data-governance/simulation-trace-cas', () => ({
  readSimulationTraceChunk: vi.fn(), writeSimulationTraceChunk: vi.fn(),
}));
vi.mock('../course-evidence-service', () => ({
  findOwnedVesselRun: vi.fn(), vesselRunProgress: vi.fn(), vesselRunStorageSummary: vi.fn(),
}));

const chunk: VesselTraceChunk = {
  schema: 'act.vessel-trace-chunk.v1', runRef: '00000000-0000-4000-8000-000000000001',
  chunkIndex: 0, controlStart: 0, nativeStart: 0, parameterHash: 'parameters', endTimeS: 5,
  points: [], changes: [], nativeSamples: [{ signal: 'Heading',
    measurement: { value: 0, t_sample_s: 0, t_arrive_s: 0, quality: 'Good' } }],
};
const checksum = createHash('sha256').update(canonicalJson(chunk)).digest('hex');
const reference = `simulation-cas:file:sha256:${checksum}`;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(findOwnedVesselRun).mockResolvedValue({ id: 'owned-run', status: 'completed' } as never);
  vi.mocked(prisma.simulationTrace.findUnique).mockResolvedValue({ checksum, sampleStorageUri: reference } as never);
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
    vi.mocked(findOwnedVesselRun).mockResolvedValue({ id: 'owned-run', status: 'running' } as never);
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
