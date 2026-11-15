import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';

const mocks = vi.hoisted(() => ({
  session: vi.fn(), report: vi.fn(), attempts: vi.fn(), run: vi.fn(), read: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {
  ilabExperimentRun: { findFirst: mocks.session }, virtualSimulationReport: { findFirst: mocks.report },
  stepSubmissionAttempt: { findMany: mocks.attempts }, simulationRun: { findFirst: mocks.run },
} }));
vi.mock('@/lib/data-governance/simulation-trace-cas', () => ({ readSimulationTraceChunk: mocks.read }));
import { formatSimulationKonlingEvidence, loadSimulationKonlingEvidence } from '../adapters/konling-simulation-evidence';

const point = {
  timeS: 60, command: { headingDeg: 12 },
  measurements: { Heading: { value: 11.5, quality: 'Good', sampledAtS: 59.95 },
    WindDirection: { value: 999, quality: 'Undefined', sampledAtS: 60 } },
  estimate: { northM: 3, eastM: -2, headingDeg: 11.4 },
  cruise: { requestedMomentNm: 1e6, allocatedMomentNm: 9e5, lowSpeedAuthority: true },
  truth: { hiddenHydrodynamicDerivative: 'private-truth-sentinel' },
  prediction: 'private-answer-sentinel', id: 'private-identity-sentinel',
} as unknown as VesselTracePoint;

describe('控灵读取本次本人仿真证据', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ reportId: null, stepDrafts: { activeSeq: 3,
      courseState: { reportClientRef: 'current-round' }, bySeq: { '3': { prediction: 'private-answer-sentinel' } } } });
    mocks.report.mockResolvedValue({ id: 'current-report', clientRef: 'current-round' });
    mocks.attempts.mockResolvedValue([{ stepKey: 'cruise-step-1' }]);
    mocks.run.mockResolvedValue({ traces: [{ sampleStorageUri: 'private-cas-reference' }] });
    mocks.read.mockResolvedValue({ points: [point] });
  });

  it('只为注册的船舶步骤读取证据', async () => {
    expect(await loadSimulationKonlingEvidence('owner', 'other-course', 'step-3')).toBe('');
    expect(await loadSimulationKonlingEvidence('owner', 'cruise-comfort-experiment', 'cruise-comfort-step-21')).toBe('');
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it('绑定认证用户、当前报告轮次、指定步骤和最新一块采样', async () => {
    const text = await loadSimulationKonlingEvidence('owner', 'cruise-comfort-experiment', 'cruise-comfort-step-2');
    expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner', vesselId: 'fleet-cruise-adora' } }));
    expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner', clientRef: 'current-round', experimentKey: 'cruise' } }));
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerUserId: 'owner', sourceDomain: 'ilab-course',
      AND: [{ summary: { path: ['reportId'], equals: 'current-report' } }, { summary: { path: ['stepSequence'], equals: 2 } }] } }));
    expect(text).toContain('本页船舶实验第2步');
    expect(text).toContain('当前操作步骤为第3步');
    expect(text).toContain('已保存1步');
    expect(text).toContain('航向量测11.5000°');
    expect(text).toContain('可能落后于浏览器');
    expect(text).not.toContain('private-');
  });

  it('未定义量测和低速鳍能力按实际状态表达，保持原始采样', () => {
    const before = structuredClone(point);
    const text = formatSimulationKonlingEvidence(point);
    expect(text).toContain('相对风向量测当前缺测或未定义');
    expect(text).not.toContain('999');
    expect(text).toContain('当前低来流下鳍控制能力不足');
    expect(point).toEqual(before);
  });

  it('历史轮次选择必须同时受本人身份约束，关联报告优先于草稿引用', async () => {
    mocks.session.mockResolvedValue({ reportId: 'bound-report', stepDrafts: {
      courseState: { reportClientRef: 'wrong-round' } } });
    await loadSimulationKonlingEvidence('owner', 'cruise-comfort-experiment', 'cruise-comfort-step-2', 'historical-origin');
    expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({ where: {
      userId: 'owner', vesselId: 'fleet-cruise-adora', originId: 'historical-origin' } }));
    expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ where: {
      userId: 'owner', id: 'bound-report', experimentKey: 'cruise' } }));
    mocks.session.mockResolvedValue(null); mocks.report.mockClear();
    await loadSimulationKonlingEvidence('another-user', 'cruise-comfort-experiment', 'cruise-comfort-step-2', 'historical-origin');
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it('新实验轮次没有报告时仅提供当前目标', async () => {
    mocks.report.mockResolvedValue(null);
    expect(await loadSimulationKonlingEvidence('owner', 'cruise-comfort-experiment', 'cruise-comfort-step-2')).toContain('本轮尚无已保存');
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('没有本步采样时仍注入服务端步骤机理与实际坐标约定', async () => {
    mocks.run.mockResolvedValue(null);
    const text = await loadSimulationKonlingEvidence('owner', 'drilling-dp-experiment', 'drilling-dp-step-2');
    expect(text).toContain('检验推进器力矩臂');
    expect(text).toContain('x向船艏、y向右舷、z向下');
    expect(text).toContain('俯视顺时针');
    expect(text).toContain('N = x F_y - y F_x');
    expect(text).toContain('当前提问步骤尚无服务端采样');
    expect(text).toContain('围绕本页实验和已保存证据直接继续指导');
  });

  it('采样暂不可读时保持步骤与进度指导', async () => {
    mocks.read.mockRejectedValue(new Error('private-storage-detail'));
    const text = await loadSimulationKonlingEvidence('owner', 'cruise-comfort-experiment', 'cruise-comfort-step-2');
    expect(text).toContain('本步采样暂时无法读取');
    expect(text).not.toContain('private-storage-detail');
  });
});
