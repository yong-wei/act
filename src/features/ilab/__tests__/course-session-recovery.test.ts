import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { readSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import { loadCourseSessionRecovery, loadOwnedCourseRunRecovery } from '../adapters/course-session-recovery';

vi.mock('@/lib/prisma', () => ({ prisma: {
  virtualSimulationReport: { findFirst: vi.fn() },
  ilabExperimentRun: { findFirst: vi.fn() },
  simulationRun: { findMany: vi.fn(), findUnique: vi.fn() },
  studentModelArtifact: { findMany: vi.fn() },
  comparisonArtifact: { findMany: vi.fn() },
  stepSubmissionAttempt: { findMany: vi.fn() },
} }));
vi.mock('@/lib/data-governance/simulation-trace-cas', () => ({
  readSimulationTraceChunk: vi.fn(), writeSimulationTraceChunk: vi.fn(),
}));

const report = {
  id: 'report-id', clientRef: 'report-client', userId: 'owner',
  experimentKey: 'destroyer', experimentVersion: VESSEL_COURSE_VERSION,
  title: '恢复测试', status: 'draft', revision: 1, score: 0, maxScore: 100,
  sections: {}, evidenceRefs: {}, rubric: null, teacherFeedback: null,
  reportHtml: '', updatedAt: new Date(1000),
};
const points = [{ timeS: 5, headingDeg: 1 }];
const nativeSamples = [{ sensor_id: 'heading', t_arrive_s: 5, value: 1 }];
const configuration = { vessel: 'destroyer-055', environment: 'P0' };
const initialInput = { targetHeadingDeg: 0 };
const finalInput = { targetHeadingDeg: 1 };
const records = new Map<string, unknown>();

function storedRun(id: string, status = 'completed') {
  records.set(`${id}-opening`, {
    startedAtMs: 1000, configuration, input: initialInput, courseSettings: { gain: 1 },
    initialCheckpoint: 'initial-checkpoint', prediction: '保存的运行前预测',
  });
  records.set(`${id}-checkpoint`, {
    checkpoint: `${id}-saved-checkpoint`, reason: status === 'running' ? 'checkpoint' : 'duration',
    durationS: 60, endTimeS: 5, controlCount: 1, nativeCount: 1, fineCount: 0,
    appliedFinalInput: finalInput,
  });
  records.set(`${id}-trace`, { points, nativeSamples });
  return {
    id: `${id}-database`, sourceRefId: id, ownerUserId: 'owner',
    status, createdAt: new Date(1000), completedAt: status === 'running' ? null : new Date(6000),
    runtimeVersion: 'runtime-version',
    summary: {
      schema: 'act.vessel-run-storage.v1', reportId: report.id,
      courseKey: 'destroyer', courseVersion: VESSEL_COURSE_VERSION, stepSequence: 1,
      parameterHash: 'parameter-hash', openingReference: `${id}-opening`,
      lastCheckpointReference: `${id}-checkpoint`, lastTimeS: 5,
      chunkCount: 1, controlCount: 1, nativeCount: 1, fineCount: 0,
    },
    traces: [{ chunkIndex: 0, sampleStorageUri: `${id}-trace` }],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  records.clear();
  vi.mocked(prisma.virtualSimulationReport.findFirst).mockResolvedValue(report as never);
  vi.mocked(prisma.ilabExperimentRun.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.studentModelArtifact.findMany).mockResolvedValue([]);
  vi.mocked(prisma.comparisonArtifact.findMany).mockResolvedValue([]);
  vi.mocked(prisma.stepSubmissionAttempt.findMany).mockResolvedValue([]);
  vi.mocked(readSimulationTraceChunk).mockImplementation(async (reference) => {
    if (!records.has(reference)) throw new Error('分块缺失');
    return structuredClone(records.get(reference));
  });
});

const request = { userId: 'owner', courseKey: 'destroyer' as const, reportClientRef: report.clientRef };

describe('课程恢复的按需读取', () => {
  it('延迟曲线恢复省略数据库分块索引，保留当前检查点和历史回执', async () => {
    vi.mocked(prisma.simulationRun.findMany).mockResolvedValue([
      storedRun('history'), storedRun('active', 'running'),
    ] as never);
    const result = await loadCourseSessionRecovery({ ...request, deferTraceChunks: true, lazyHistory: true });
    expect(prisma.simulationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ownerUserId: 'owner', summary: { path: ['reportId'], equals: report.id } }),
      include: { traces: false },
    }));
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({ id: 'active', checkpoint: 'active-saved-checkpoint',
      resumable: true, trace: [], nativeSensorSamples: [],
      traceManifest: { chunkCount: 1, controlCount: 1, nativeCount: 1, fineCount: 0 } });
    expect(result.archivedRuns?.[0]).toMatchObject({ id: 'history', configuration, initialInput,
      finalInput, remoteOnly: true, sampleCount: 1, uploadReceipt: { controlCount: 1, nativeCount: 1 } });
    expect(vi.mocked(readSimulationTraceChunk).mock.calls.map(([reference]) => reference))
      .not.toContain('history-trace');
  });

  it('完整读取和单独选中历史运行均保留原返回合同', async () => {
    vi.mocked(prisma.simulationRun.findMany).mockResolvedValue([storedRun('history')] as never);
    const full = await loadCourseSessionRecovery(request);
    expect(full.runs[0]).toMatchObject({ trace: points, nativeSensorSamples: nativeSamples,
      checkpoint: 'history-saved-checkpoint', resumable: true });
    expect(prisma.simulationRun.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      include: { traces: { orderBy: { chunkIndex: 'asc' } } },
    }));
    const selected = await loadCourseSessionRecovery({ ...request, onlyRunRef: 'history',
      lazyHistory: true, deferTraceChunks: true });
    expect(selected.archivedRuns).toEqual([]);
    expect(selected.runs[0]).toMatchObject({ id: 'history', checkpoint: 'history-saved-checkpoint' });
    expect(prisma.simulationRun.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sourceRefId: 'history', ownerUserId: 'owner' }),
    }));
  });

  it('历史状态读取使用有界并行，并保持数据库顺序', async () => {
    const rows = Array.from({ length: 12 }, (_, index) => storedRun(`history-${index}`));
    vi.mocked(prisma.simulationRun.findMany).mockResolvedValue(rows as never);
    let active = 0;
    let maximum = 0;
    vi.mocked(readSimulationTraceChunk).mockImplementation(async (reference) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return structuredClone(records.get(reference));
    });
    const result = await loadCourseSessionRecovery({ ...request, deferTraceChunks: true, lazyHistory: true });
    expect(maximum).toBeGreaterThan(2);
    expect(maximum).toBeLessThanOrEqual(8);
    expect(result.archivedRuns?.map((run) => run.id)).toEqual(rows.map((row) => row.sourceRefId));
  });

  it('旧记录、缺失与计数不一致的恢复点继续保留原降级语义', async () => {
    const missing = storedRun('missing');
    records.delete('missing-opening');
    const legacy = storedRun('legacy');
    legacy.summary.lastTimeS = 0;
    legacy.summary.controlCount = 0;
    legacy.summary.nativeCount = 0;
    legacy.summary.lastCheckpointReference = 'legacy-opening';
    const mismatch = storedRun('mismatch');
    records.set('mismatch-checkpoint', { endTimeS: 5, controlCount: 99, nativeCount: 1, fineCount: 0 });
    vi.mocked(prisma.simulationRun.findMany).mockResolvedValue([missing, legacy, mismatch] as never);
    const result = await loadCourseSessionRecovery({ ...request, deferTraceChunks: true });
    expect(result.runs.map((run) => run.id)).toEqual(['legacy', 'mismatch']);
    expect(result.runs[0]).toMatchObject({ checkpoint: 'initial-checkpoint', resumable: true });
    expect(result.runs[1].resumable).toBe(false);
    expect(result.runs[1].uploadReceipt).toBeUndefined();
  });

  it('其他账号的运行在读取任何私有状态前拒绝', async () => {
    vi.mocked(prisma.simulationRun.findUnique).mockResolvedValue({ ...storedRun('private'), ownerUserId: 'other' } as never);
    await expect(loadOwnedCourseRunRecovery('owner', 'private')).rejects.toMatchObject({ status: 404 });
    expect(readSimulationTraceChunk).not.toHaveBeenCalled();
  });
});
