import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { readSimulationTraceChunk } from '@/lib/data-governance/simulation-trace-cas';
import { CRUISE_COURSE_STEPS } from '@/resources/simulations/experiments/cruise-course';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';
import { validateSavedVesselAttempt } from '../course-attempt-validation';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/data-governance/simulation-trace-cas', () => ({
  readSimulationTraceChunk: vi.fn(), writeSimulationTraceChunk: vi.fn(),
}));

const opening = {
  startedAtMs: 1000, configuration: CRUISE_COURSE_STEPS[0].configuration,
  input: {}, courseSettings: { finsEnabled: false },
};
const ending = { reason: 'duration', appliedFinalInput: { targetHeadingDeg: 0 } };
const attempt = { stepSequence: 1, runRefs: ['run-ref'], modelClientRefs: [], comparisonClientRefs: [],
  answers: { observation: '本次直航的航向稳定。', interpretation: '按相同初态比较执行器响应。' }, outcome: 'submitted' as const };
const tx = {
  simulationRun: { findMany: vi.fn() }, studentModelArtifact: { findMany: vi.fn() },
  comparisonArtifact: { findMany: vi.fn() },
};

function storedRun() {
  return {
    id: 'run-id', sourceRefId: 'run-ref', ownerUserId: 'owner', sourceDomain: 'ilab-course',
    status: 'completed', completedAt: new Date(61000), runtimeVersion: 'runtime-version',
    summary: { schema: 'act.vessel-run-storage.v1', reportId: 'report-id',
      courseVersion: VESSEL_COURSE_VERSION, stepSequence: 1, lastTimeS: 60, controlCount: 1200,
      nativeCount: 4000, openingReference: 'opening-reference', lastCheckpointReference: 'checkpoint-reference',
      checkpointHash: 'current-checkpoint',
      evidenceVerification: { status: 'verified', checkpointHash: 'current-checkpoint',
        runtimeVersion: 'runtime-version', evidenceHash: 'confirmed-evidence' },
      recoveryHeader: structuredClone(opening), recoveryCheckpoint: structuredClone(ending) },
  };
}

const validate = () => validateSavedVesselAttempt(tx as unknown as Prisma.TransactionClient,
  'owner', 'report-id', 'cruise:round-ref', 'cruise', attempt);

beforeEach(() => {
  vi.resetAllMocks();
  tx.studentModelArtifact.findMany.mockResolvedValue([]);
  tx.comparisonArtifact.findMany.mockResolvedValue([]);
  vi.mocked(readSimulationTraceChunk).mockImplementation(async (reference) => {
    if (reference === 'opening-reference') return structuredClone(opening) as never;
    if (reference === 'checkpoint-reference') return structuredClone(ending) as never;
    throw new Error('Unexpected object read');
  });
});

describe('步骤验收复用已确认的运行元数据', () => {
  it('已核验运行使用相同教学判据且不重复读取初态和结束正文', async () => {
    tx.simulationRun.findMany.mockResolvedValue([storedRun()]);
    expect(await validate()).toEqual({ feedback: null, outcome: 'submitted' });
    expect(readSimulationTraceChunk).not.toHaveBeenCalled();
    expect(tx.simulationRun.findMany).toHaveBeenCalledWith({ where: {
      ownerUserId: 'owner', sourceDomain: 'ilab-course', summary: { path: ['reportId'], equals: 'report-id' },
    } });
  });

  it('历史记录缺少缓存字段时读取原始对象，保持相同验收结果', async () => {
    const run = storedRun();
    delete (run.summary as Partial<typeof run.summary>).recoveryHeader;
    delete (run.summary as Partial<typeof run.summary>).recoveryCheckpoint;
    delete (run.summary as Partial<typeof run.summary>).evidenceVerification;
    tx.simulationRun.findMany.mockResolvedValue([run]);
    expect(await validate()).toEqual({ feedback: null, outcome: 'submitted' });
    expect(readSimulationTraceChunk).toHaveBeenCalledTimes(2);
  });

  it.each(['appliedFinalInput', 'reason'] as const)('历史结束元数据缺少%s时只补读结束对象', async (field) => {
    const run = storedRun();
    delete (run.summary.recoveryCheckpoint as Partial<typeof ending>)[field];
    tx.simulationRun.findMany.mockResolvedValue([run]);
    expect(await validate()).toEqual({ feedback: null, outcome: 'submitted' });
    expect(readSimulationTraceChunk).toHaveBeenCalledExactlyOnceWith('checkpoint-reference');
  });

  it.each(['pending', 'failed', 'stale'])('已有%s核验状态时保持正式提交限制', async (status) => {
    const run = storedRun();
    if (status === 'stale') run.summary.evidenceVerification.checkpointHash = 'older-checkpoint';
    else run.summary.evidenceVerification.status = status;
    tx.simulationRun.findMany.mockResolvedValue([run]);
    await expect(validate()).rejects.toMatchObject({ status: 409 });
    expect(readSimulationTraceChunk).not.toHaveBeenCalled();
  });

  it('已保存的失败停止原因继续导致原有教学验收失败', async () => {
    const run = storedRun();
    run.summary.recoveryCheckpoint = { ...ending, reason: 'failure' };
    vi.mocked(readSimulationTraceChunk).mockImplementation(async (reference) =>
      structuredClone(reference === 'opening-reference' ? opening : run.summary.recoveryCheckpoint) as never);
    tx.simulationRun.findMany.mockResolvedValue([run]);
    expect(await validate()).toEqual({ feedback: '本步需要至少1次完整独立运行。', outcome: 'model_mismatch' });
    expect(readSimulationTraceChunk).not.toHaveBeenCalled();
  });
});
