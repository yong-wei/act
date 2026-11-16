import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createServerVesselSessionWithAssets } from '@/lib/control-engine/wasm-server';
import { canonicalJson } from '@/lib/student-model-artifact-contract/server-hash';
import { readSimulationTraceChunk, writeSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { findOwnedVesselRun } from '../course-evidence-service';
import { closeVesselEvidenceRun } from '../course-evidence-chunks';
import type { VesselEvidenceClose, VesselTraceChunk } from '../course-evidence-contract';

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock('@/lib/control-engine/wasm-server', () => ({ createServerVesselSessionWithAssets: vi.fn() }));
vi.mock('@/lib/data-governance/simulation-trace-cas', () => ({
  readSimulationTraceChunk: vi.fn(), writeSimulationTraceChunk: vi.fn(),
}));
vi.mock('../course-evidence-service', () => ({
  findOwnedVesselRun: vi.fn(),
  vesselRunStorageSummary: (run: { summary: unknown }) => run.summary,
  vesselRunProgress: (run: { summary: unknown }) => run.summary,
}));

const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const runRef = '00000000-0000-4000-8000-000000000001';
const reference = (index: number) => `simulation-cas:file:sha256:${String(index).padStart(64, '0')}`;
const summary = {
  schema: 'act.vessel-run-storage.v1', reportId: 'report', experimentKey: 'destroyer',
  openingReference: 'opening', configurationHash: digest({}), parameterHash: 'parameters',
  courseKey: 'destroyer', chunkCount: 0, controlCount: 0, nativeCount: 0,
  lastTimeS: 0, nativeWatermarks: {},
};
const chunk = (index: number): VesselTraceChunk => ({
  schema: 'act.vessel-trace-chunk.v1', runRef, chunkIndex: index, controlStart: 0,
  nativeStart: index, parameterHash: 'parameters', endTimeS: index + 1, points: [], changes: [],
  nativeSamples: [{ signal: 'Heading', measurement: {
    value: index, quality: 'Good', t_sample_s: index, t_arrive_s: index,
  } }],
});
const input: VesselEvidenceClose = {
  checkpoint: 'native-checkpoint', endTimeS: 2, controlCount: 0, nativeCount: 2,
  pendingChunks: [reference(1), reference(2)], reason: 'checkpoint', failure: null,
};
const tx = {
  $queryRaw: vi.fn(),
  simulationRun: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
  simulationTrace: { create: vi.fn(), createMany: vi.fn() },
  virtualSimulationReport: { findUniqueOrThrow: vi.fn() },
  appliedRunEnvelope: { update: vi.fn() },
};
const records = new Map<string, unknown>();
const native = { restore: vi.fn(), read: vi.fn(), snapshot: vi.fn(), free: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  records.clear();
  records.set('opening', { configuration: {} });
  records.set(reference(1), chunk(0));
  records.set(reference(2), chunk(1));
  const run = { id: 'run', sourceRefId: runRef, status: 'running', summary: structuredClone(summary) };
  vi.mocked(findOwnedVesselRun).mockResolvedValue(run as never);
  vi.mocked(readSimulationTraceChunk).mockImplementation(async (ref) => structuredClone(records.get(ref)));
  vi.mocked(writeSimulationTraceChunk).mockResolvedValue({ uri: 'saved-checkpoint' } as never);
  vi.mocked(createServerVesselSessionWithAssets).mockResolvedValue(native as never);
  native.snapshot.mockReturnValue('{"configuration":{}}');
  native.read.mockReturnValue(JSON.stringify({
    parameterHash: 'parameters', controllerTicks: 0, timeS: 2, input: {}, parameters: {},
  }));
  tx.simulationRun.findUniqueOrThrow.mockResolvedValue(run);
  tx.virtualSimulationReport.findUniqueOrThrow.mockResolvedValue({ status: 'draft' });
  tx.simulationRun.update.mockImplementation(async ({ data }) => ({ ...run, ...data }));
  vi.mocked(prisma.$transaction).mockImplementation((async (work: (client: typeof tx) => unknown) => work(tx)) as never);
});

describe('采样批次与恢复点的原子提交', () => {
  it('多份已校验分块批量入库，累计进度与恢复点只写一次', async () => {
    const result = await closeVesselEvidenceRun('owner', runRef, input);
    expect(tx.simulationTrace.createMany).toHaveBeenCalledExactlyOnceWith({ data: [
      expect.objectContaining({ runId: 'run', chunkIndex: 0, sampleStorageUri: reference(1), sampleCount: 0,
        summaryMetrics: { startTimeS: 0, endTimeS: 1, controlStart: 0, nativeStart: 0, nativeCount: 1, fineStart: 0, fineCount: 0 } }),
      expect.objectContaining({ runId: 'run', chunkIndex: 1, sampleStorageUri: reference(2), sampleCount: 0,
        summaryMetrics: { startTimeS: 1, endTimeS: 2, controlStart: 0, nativeStart: 1, nativeCount: 1, fineStart: 0, fineCount: 0 } }),
    ] });
    expect(tx.simulationTrace.create).not.toHaveBeenCalled();
    expect(tx.simulationRun.update).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ chunkCount: 2, controlCount: 0, nativeCount: 2, lastTimeS: 2,
      nativeWatermarks: { Heading: 1, 'Heading:arrival': 1 }, lastCheckpointReference: 'saved-checkpoint',
      checkpointHash: digest(input) });
    expect(result).not.toHaveProperty('fineCount');
    expect(native.free).toHaveBeenCalledOnce();
  });

  it('原生仪器先到、控制样本后到时仍记录第一份控制回执和细步水位', async () => {
    const first = chunk(0);
    first.fineStart = 0;
    first.fineSamples = [{ timeS: 1 / 120, positionNedM: [0, 0, 0], attitudeDeg: [0, 0, 0],
      bodyVelocitySi: [0, 0, 0, 0, 0, 0], surfaceDeg: [], shaftRpm: [], azimuthDeg: [], motorPowerW: [] }];
    const second = chunk(1);
    second.fineStart = 1;
    second.fineSamples = [];
    second.points = [{ timeS: 0, command: { headingDeg: 0, shaftRpm: [], surfaceDeg: [] },
      measurements: {}, estimate: { headingDeg: 0, yawRateDegS: 0, groundBodySpeedMps: 0, northM: 0, eastM: 0 },
      truth: { headingDeg: 0, yawRateDegS: 0, rollDeg: 0, pitchDeg: 0, rollRateDegS: 0, pitchRateDegS: 0, waterSpeedMps: 0,
        groundBodySpeedMps: 0, northM: 0, eastM: 0, shaftRpm: [], surfaceDeg: [], azimuthDeg: [],
        windLoad: null, waveFirstLoad: null, waveSecondLoad: null, propellerWorkJ: [], motorPowerW: [],
        positiveMotorWorkJ: 0, fuelKg: null } }];
    records.set(reference(1), first);
    records.set(reference(2), second);
    native.read.mockReturnValue(JSON.stringify({ parameterHash: 'parameters', controllerTicks: 1,
      fineStepWindowSampleCount: 1, timeS: 2, input: {}, parameters: {} }));
    const result = await closeVesselEvidenceRun('owner', runRef, { ...input, controlCount: 1, fineCount: 1 });
    expect(result).toMatchObject({ chunkCount: 2, controlCount: 1, nativeCount: 2, fineCount: 1, fineLastTimeS: 1 / 120 });
    expect(tx.appliedRunEnvelope.update).toHaveBeenCalledExactlyOnceWith({ where: { runRef }, data: {
      firstSampleReceipt: digest(second.points[0]), quality: { status: 'recording', source: 'native-session' },
    } });
  });

  it('锁内发现并发提交已推进时拒绝整批写入', async () => {
    tx.simulationRun.findUniqueOrThrow.mockResolvedValue({ id: 'run', summary: { ...summary, chunkCount: 1 } });
    await expect(closeVesselEvidenceRun('owner', runRef, input)).rejects.toMatchObject({ status: 409 });
    expect(tx.simulationTrace.createMany).not.toHaveBeenCalled();
    expect(tx.simulationRun.update).not.toHaveBeenCalled();
  });

  it('任一分块前缀不连续时不提交任何分块或恢复点', async () => {
    records.set(reference(2), { ...chunk(1), nativeStart: 5 });
    await expect(closeVesselEvidenceRun('owner', runRef, input)).rejects.toMatchObject({ status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(writeSimulationTraceChunk).not.toHaveBeenCalled();
  });

  it('批量写入失败时不推进恢复点', async () => {
    tx.simulationTrace.createMany.mockRejectedValue(new Error('storage unavailable'));
    await expect(closeVesselEvidenceRun('owner', runRef, input)).rejects.toThrow('storage unavailable');
    expect(tx.simulationRun.update).not.toHaveBeenCalled();
  });

  it('相同恢复点重试复用原进度，不重新读取或入库', async () => {
    vi.mocked(findOwnedVesselRun).mockResolvedValue({ summary: { ...summary, checkpointHash: digest(input) } } as never);
    await closeVesselEvidenceRun('owner', runRef, input);
    expect(readSimulationTraceChunk).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('异主在读取分块之前拒绝', async () => {
    vi.mocked(findOwnedVesselRun).mockRejectedValue({ status: 404 });
    await expect(closeVesselEvidenceRun('other', runRef, input)).rejects.toMatchObject({ status: 404 });
    expect(readSimulationTraceChunk).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
