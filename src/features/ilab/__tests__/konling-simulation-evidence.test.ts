import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelMessage } from 'ai';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';

const mocks = vi.hoisted(() => ({
  session: vi.fn(), report: vi.fn(), attempts: vi.fn(), run: vi.fn(), read: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {
  ilabExperimentRun: { findFirst: mocks.session }, virtualSimulationReport: { findFirst: mocks.report },
  stepSubmissionAttempt: { findMany: mocks.attempts }, simulationRun: { findFirst: mocks.run },
} }));
vi.mock('@/lib/data-governance/simulation-trace-cas', () => ({ readSimulationTraceChunk: mocks.read }));
import { attachSimulationKonlingContext, formatSimulationKonlingEvidence, loadSimulationKonlingEvidence } from '../adapters/konling-simulation-evidence';

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

  it('首份报告生成前提供已保存的操作步骤和当前目标', async () => {
    mocks.report.mockResolvedValue(null);
    const text = await loadSimulationKonlingEvidence('owner', 'cruise-comfort-experiment', 'cruise-comfort-step-2');
    expect(text).toContain('本轮尚无已保存');
    expect(text).toContain('当前操作步骤为第3步');
    expect(mocks.run).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('没有已保存操作步骤时明确其状态，同时标明当前提问步骤', async () => {
    mocks.session.mockResolvedValue(null);
    const text = await loadSimulationKonlingEvidence('owner', 'container-voyage-experiment', 'container-voyage-step-2');
    expect(text).toContain('本页船舶实验第2步');
    expect(text).toContain('服务端尚未保存当前操作步骤');
    expect(text).not.toContain('当前操作步骤为第2步');
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

  it('在跨船历史后的本次问题中保留当前页面资料，并通过模型系统消息过滤', async () => {
    mocks.run.mockResolvedValue(null);
    const context = await loadSimulationKonlingEvidence('owner', 'container-voyage-experiment', 'container-voyage-step-1');
    const history: ModelMessage[] = [
      { role: 'user', content: '我已进入邮轮第2步，怎样辨识横摇衰减？' },
      { role: 'assistant', content: '当前为第2步：辨识横摇衰减。' },
      { role: 'user', content: '我现在正在查看哪艘船的第几步，目标是什么？' },
    ];
    const before = structuredClone(history);
    const projected = attachSimulationKonlingContext(history, context)
      .filter((message) => message.role !== 'system');

    expect(projected.slice(0, 2)).toEqual(history.slice(0, 2));
    expect(projected.at(-1)).toEqual({ role: 'user', content: [
      { type: 'text', text: history[2].content },
      { type: 'text', text: expect.stringContaining('第 1 步：区分瞬时与累计量') },
    ] });
    expect(JSON.stringify(projected.at(-1))).toContain('集装箱船航速、准点与燃油');
    expect(JSON.stringify(projected.at(-1))).toContain('当前操作步骤为第3步');
    expect(history).toEqual(before);
  });

  it('保留当前问题的图片和文字，只为最后一个用户回合附加页面资料', () => {
    const history: ModelMessage[] = [
      { role: 'user', content: '前一次问题' },
      { role: 'assistant', content: '前一次回答' },
      { role: 'user', content: [
        { type: 'text', text: '请分析当前曲线' },
        { type: 'image', image: new URL('https://example.com/curve.png') },
      ] },
    ];
    const projected = attachSimulationKonlingContext(history, '当前为981第2步。');
    expect(projected.slice(0, 2)).toEqual(history.slice(0, 2));
    expect(projected[2].content).toEqual([
      ...(history[2].content as unknown[]),
      { type: 'text', text: expect.stringContaining('当前为981第2步。') },
    ]);
    expect((history[2].content as unknown[])).toHaveLength(2);
  });

  it('没有仿真资料或用户问题时保持既有模型输入', () => {
    const history: ModelMessage[] = [{ role: 'assistant', content: '已有回答' }];
    expect(attachSimulationKonlingContext(history, '')).toBe(history);
    expect(attachSimulationKonlingContext(history, '当前页面')).toEqual(history);
  });
});
