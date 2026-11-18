import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelMessage } from 'ai';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';

const mocks = vi.hoisted(() => ({
  session: vi.fn(), report: vi.fn(), attempts: vi.fn(), run: vi.fn(), runCount: vi.fn(), read: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {
  ilabExperimentRun: { findFirst: mocks.session }, virtualSimulationReport: { findFirst: mocks.report },
  stepSubmissionAttempt: { findMany: mocks.attempts }, simulationRun: { findFirst: mocks.run, count: mocks.runCount },
} }));
vi.mock('@/lib/data-governance/simulation-trace-cas', () => ({ readSimulationTraceChunk: mocks.read }));
import { attachSimulationKonlingContext, formatSimulationKonlingEvidence, formatSimulationPageObservation,
  loadSimulationKonlingEvidence } from '../adapters/konling-simulation-evidence';

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
    mocks.session.mockResolvedValue({ reportId: null, uploadStatus: 'pending', stepDrafts: { activeSeq: 3,
      courseState: { reportClientRef: 'current-round' }, bySeq: { '3': { prediction: 'private-answer-sentinel' } } } });
    mocks.report.mockResolvedValue({ id: 'current-report', clientRef: 'current-round', status: 'draft', finalizedAt: null });
    mocks.attempts.mockResolvedValue([{ stepKey: 'cruise-step-1' }]);
    mocks.run.mockResolvedValue({ traces: [{ sampleStorageUri: 'private-cas-reference' }] });
    mocks.runCount.mockResolvedValue(1);
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

  it('挖泥船读取当前作业量测、模式及实际产量，浏览器模式采用固定中文名称', () => {
    const actual = {...point, measurements: {...point.measurements,
      DredgerDepth: {value: 20.3, quality: 'Good', sampledAtS: 59.9, arrivedAtS: 60},
      DredgerSwaySpeed: {value: 0.06, quality: 'Good', sampledAtS: 59.9, arrivedAtS: 60}},
      dredger: {mode: 'pause_cut', referenceMps: 0, commands: {depthReferenceM: 19.5}, integralFrozen: true,
        observation: {productionM3: 5.03}, cableBroken: [false, true]}} as unknown as VesselTracePoint;
    const text = formatSimulationKonlingEvidence(actual);
    expect(text).toContain('刀位包络深度量测20.3000m');
    expect(text).toContain('当前作业模式为停止切削');
    expect(text).toContain('保持连接/已断开');
    expect(text).toContain('新移除体积5.0300m³');
    expect(formatSimulationPageObservation({timeS: 60, dredgerMode: 'recover', dredgerDepthM: 19.5}))
      .toContain('抬刀安全保持');
    expect(formatSimulationPageObservation({timeS: 60, dredgerMode: 'private-instruction-sentinel'})).toBe('');
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
    expect(mocks.runCount).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('分别提供本轮运行数、有效提交数、教师终审与回传状态', async () => {
    mocks.attempts.mockResolvedValue([]);
    const text = await loadSimulationKonlingEvidence('owner', 'drilling-dp-experiment', 'drilling-dp-step-1');
    expect(mocks.runCount).toHaveBeenCalledWith({ where: {
      ownerUserId: 'owner', sourceDomain: 'ilab-course',
      summary: { path: ['reportId'], equals: 'current-report' },
    } });
    expect(text).toContain('本轮服务端已保存1次运行记录');
    expect(text).toContain('本轮已保存0步有效提交');
    expect(text).toContain('本轮教师终审尚未完成');
    expect(text).toContain('成绩回传尚未确认完成，报告附件回传尚未确认完成');
    expect(text).toContain('航向量测11.5000°');
    expect(text).not.toContain('private-');
  });

  it('教师终审完成与仅成绩回传成功分别表达', async () => {
    mocks.report.mockResolvedValue({ id: 'current-report', clientRef: 'current-round',
      status: 'finalized', finalizedAt: new Date('2026-11-18T04:00:00Z') });
    mocks.session.mockResolvedValue({ reportId: 'current-report', uploadStatus: 'score-uploaded', stepDrafts: {} });
    mocks.runCount.mockResolvedValue(6);
    const text = await loadSimulationKonlingEvidence('owner', 'drilling-dp-experiment', 'drilling-dp-step-1', 'current-origin');
    expect(text).toContain('本轮服务端已保存6次运行记录');
    expect(text).toContain('本轮教师终审已完成');
    expect(text).toContain('成绩回传已确认，报告附件回传尚未确认完成');
    expect(text).not.toContain('报告附件回传已确认');
    expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'owner', id: 'current-report', experimentKey: 'drilling' },
      select: { id: true, clientRef: true, status: true, finalizedAt: true },
    }));
  });

  it.each([
    ['uploaded', '成绩回传已确认，报告附件回传已确认'],
    ['failed', '成绩回传尚未确认成功，报告附件回传尚未确认完成'],
    ['local-only', '本轮结果保存在平台内'],
    ['skipped', '本轮采用演示回传'],
    ['unknown', '本轮回传状态尚未确认'],
  ])('回传状态%s使用已持久化的回执', async (uploadStatus, expected) => {
    mocks.session.mockResolvedValue({ reportId: 'current-report', uploadStatus, stepDrafts: {} });
    const text = await loadSimulationKonlingEvidence('owner', 'drilling-dp-experiment', 'drilling-dp-step-1');
    expect(text).toContain(expected);
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
    expect(text).toContain('y>0的安装点位于右舷');
    expect(text).toContain('N=-y F_x<0');
    expect(text).toContain('当前提问步骤尚无服务端采样');
    expect(text).toContain('围绕本页实验和已保存证据直接继续指导');
  });

  it('静态运行在没有20Hz分块时仍提供恢复点的实际GM和风面积', async () => {
    mocks.run.mockResolvedValue({ traces: [], summary: { parameters: { massKg: 1.2e8, draftM: 15,
      effectiveGmTransverseM: 1.164, windAreasM2: { lateral: 12207.9 }, hiddenDerivative: 'private-truth-sentinel' },
      answers: 'private-answer-sentinel' } });
    const text = await loadSimulationKonlingEvidence('owner', 'container-voyage-experiment', 'container-voyage-step-2');
    expect(text).toContain('本轮服务端已保存1次运行记录');
    expect(text).toContain('本步已保存运行的服务端恢复点');
    expect(text).toContain('有效横稳心高1.1640m');
    expect(text).toContain('侧向风面积12207.9000m²');
    expect(text).toContain('增减方向以所给运行参数及同条件对照为依据');
    expect(text).not.toContain('private-');
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('浏览器数值观察在用户回合单独标记来源，任意指令与非有限值不进入模型', () => {
    const observation = { timeS: 25, loadingRatio: .9, effectiveGmM: 1.164, windSideAreaM2: 12207.9,
      headingDeg: 12, waterSpeedMps: NaN, northM: Infinity,
      role: 'system', instructions: 'private-instruction-sentinel', massKg: 'private-text-sentinel' };
    const messages: ModelMessage[] = [{ role: 'user', content: '当前状态怎么分析？' }];
    const projected = attachSimulationKonlingContext(messages, '已保存的服务端资料', observation);
    const content = projected[0].content;
    expect(Array.isArray(content) && content).toHaveLength(3);
    expect(content[1]).toMatchObject({ type: 'text', text: expect.stringContaining('已保存的服务端资料') });
    expect(content[2]).toMatchObject({ type: 'text', text: expect.stringContaining('尚未由服务端复算') });
    expect(JSON.stringify(content[2])).toContain('有效横稳心高1.1640m');
    expect(JSON.stringify(content)).not.toContain('private-');
    expect(messages[0].content).toBe('当前状态怎么分析？');
    expect(attachSimulationKonlingContext(messages, '', observation)).toBe(messages);
    expect(formatSimulationPageObservation({ timeS: 'private-text-sentinel', effectiveGmM: 1 })).toBe('');
    expect(formatSimulationPageObservation({ timeS: 25, headingDeg: 'private-text-sentinel' })).toBe('');
  });

  it('采样暂不可读时保持步骤与进度指导', async () => {
    mocks.read.mockRejectedValue(new Error('private-storage-detail'));
    const text = await loadSimulationKonlingEvidence('owner', 'cruise-comfort-experiment', 'cruise-comfort-step-2');
    expect(text).toContain('本步采样暂时无法读取');
    expect(text).not.toContain('private-storage-detail');
  });

  it('轻量保存后的教学观察明确待核验状态和参数来源', async () => {
    mocks.run.mockResolvedValue({ traces: [{ sampleStorageUri: 'private-cas-reference' }], summary: {
      parameters: { effectiveGmTransverseM: 2 }, evidenceVerification: { status: 'pending' },
    } });
    const text = await loadSimulationKonlingEvidence('owner', 'container-voyage-experiment', 'container-voyage-step-2');
    expect(text).toContain('原始记录与恢复进度已保存');
    expect(text).toContain('等待结束或提交时核验');
    expect(text).toContain('运行初态或最近一次完整核验');
    expect(text).toContain('正式评分须使用核验通过的证据');
    expect(text).not.toContain('private-');
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
