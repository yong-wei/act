'use client';

import { useState } from 'react';
import { SlidersHorizontal, Gauge, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import { SimField, SimPanelSection, SimPanelStack, SimRunControls, SimSwitchInput, SimToggleRow } from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';
import { DRILLING_COURSE_STEPS, type DrillingCourseSettings } from './drilling-course';

interface CapacityResult {
  windSpeedMps: number;
  powerBudgetW: number;
  withinNominalStaticCapacity: boolean;
  allocation: { predictedPowerW: number; normalizedResidual: number };
}

export function DrillingCourseControls({ session, timeS }: {
  session: VesselExperimentController<DrillingCourseSettings>;
  timeS: number;
}) {
  const [capacity, setCapacity] = useState<CapacityResult[]>([]);
  const [capacityError, setCapacityError] = useState('');
  const course = session.course;
  if (!course) return null;
  const sequence = session.activeSeq;
  const settings = course.settings;
  const locked = session.busy || course.running || timeS > 0;
  const update = (patch: Partial<DrillingCourseSettings>) => course.setSettings((previous) => ({ ...previous, ...patch }));
  const models = course.models.filter((model) => model.channel === 'dp-low-frequency' && model.payload.structure.kind === 'dp_low_freq3');
  const selects: Array<{ key: keyof DrillingCourseSettings; label: string; values: Array<number | string>; labels?: string[]; visible: boolean }> = [
    { key: 'thrusterIndex', label: '单台推进器', values: [0, 1, 2, 3, 4, 5, 6, 7], labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'], visible: sequence === 2 },
    { key: 'excitationAxis', label: '组合激励方向', values: ['x', 'y', 'yaw'], labels: ['纯纵向', '纯横向', '纯艏摇'], visible: sequence === 3 },
    { key: 'bandwidthRadS', label: '定位闭环带宽 / rad/s', values: [0.015, 0.025, 0.04], visible: sequence >= 6 && sequence <= 19 },
    { key: 'integralTimeS', label: '积分时间 / s', values: [100, 200, 400], visible: sequence >= 8 && sequence <= 19 },
    { key: 'feedback', label: '位置反馈', values: ['raw', 'low_frequency'], labels: ['原始量测', '低频观测器'], visible: sequence >= 12 && sequence <= 19 },
    { key: 'lowFrequencyCutoffHz', label: '低频观测带宽 / Hz', values: [0.02, 0.04, 0.08], visible: sequence >= 12 && sequence <= 19 },
    { key: 'allocation', label: '推进器分配方法', values: ['pseudoinverse', 'sequential_convex'], labels: ['无约束加权伪逆', '顺序凸约束分配'], visible: sequence >= 13 && sequence <= 19 },
    { key: 'referenceRampS', label: '参考位置斜坡 / s', values: [30, 90, 180], visible: sequence === 14 },
    { key: 'navigationLossStrategy', label: '定位缺测策略', values: ['predict', 'freeze_integral', 'safe_exit'], labels: ['继续模型预测', '继续预测并冻结积分', '退出定位并降低出力'], visible: sequence === 17 },
    { key: 'powerBudgetMw', label: '可用推进功率 / MW', values: [32, 16, 8], visible: [16, 18].includes(sequence) },
    { key: 'energyWeight', label: '节能权重', values: [0.5, 1, 2], visible: sequence === 16 },
    { key: 'windSpeedMps', label: '验证风速 / m/s', values: [8, 12, 18, 24, 30], visible: sequence === 18 },
    { key: 'validationSeed', label: '未见工况样本', values: [17, 29], labels: ['验证样本一', '验证样本二'], visible: sequence === 19 },
  ];
  const toggles: Array<{ key: 'decoupling' | 'integralEnabled' | 'windFeedforward' | 'reallocate'; label: string; visible: boolean }> = [
    { key: 'decoupling', label: '启用本人模型交叉通道补偿', visible: sequence >= 7 && sequence <= 19 },
    { key: 'integralEnabled', label: '启用积分与抗饱和', visible: sequence >= 8 && sequence <= 19 },
    { key: 'windFeedforward', label: '启用测量风前馈', visible: sequence >= 9 && sequence <= 19 },
    { key: 'reallocate', label: '失效后重新分配', visible: [15, 16, 19].includes(sequence) },
  ];
  function computeCapacity() {
    try {
      const rows = [32, 16, 8].flatMap((budget) => [8, 12, 18, 24, 30].map((wind) =>
        computeVirtualSimulationStep<CapacityResult>({ modelId: 'student_model_analysis', operation: 'dp_capacity',
          powerBudgetW: budget * 1e6, windSpeedMps: wind, windFromDeg: 45 })));
      setCapacity(rows);
      setCapacityError('');
      session.setReading('capacity', rows.map((row) => `风速${row.windSpeedMps}m/s，可用${row.powerBudgetW / 1e6}MW，预计正机械功率${(row.allocation.predictedPowerW / 1e6).toFixed(3)}MW，归一化残差${row.allocation.normalizedResidual.toFixed(5)}，${row.withinNominalStaticCapacity ? '处于本次静态能力范围' : '静态能力不足'}。`).join('\n')
        + '\n静态计算采用公开教学风投影、零流速和方位对齐，动态故障、阵风和波浪通过本人实际运行验证。');
    } catch (error) { setCapacityError(error instanceof Error ? error.message : '能力计算尚未完成。'); }
  }
  return <SimPanelStack>
    <SimRunControls running={course.running} primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
      disabled={session.busy} primaryDisabled={!course.ready || course.completed || DRILLING_COURSE_STEPS[sequence - 1].stepKind === 'analysis'}
      onPrimary={() => { void (course.running ? course.pause() : course.start()); }} onReset={() => { void course.reset(); }} />
    <SimPanelSection title="定位与推进器方案" icon={SlidersHorizontal}>
      <div className="space-y-3">
        {sequence >= 4 && sequence <= 19 ? <SimField label="本人三通道模型">
          <select className="sim-hud-input" aria-label="定位所用本人模型" value={course.designModelId} disabled={locked}
            onChange={(event) => course.setDesignModelId(event.target.value)}>
            <option value="">选择本人冻结模型</option>
            {models.map((model, index) => <option key={model.id} value={model.id}>三通道低频模型 · 版本{index + 1}</option>)}
          </select>
        </SimField> : null}
        {selects.filter((item) => item.visible).map((item) => <SimField key={item.key} label={item.label}>
          <select className="sim-hud-input" aria-label={item.label} disabled={locked} value={String(settings[item.key])}
            onChange={(event) => update({ [item.key]: typeof item.values[0] === 'number' ? Number(event.target.value) : event.target.value })}>
            {item.values.map((value, index) => <option key={value} value={value}>{item.labels?.[index] ?? value}</option>)}
          </select>
        </SimField>)}
        {toggles.filter((item) => item.visible).map((item) => <SimToggleRow key={item.key} label={item.label} htmlFor={`dp-${item.key}`}
          control={<SimSwitchInput id={`dp-${item.key}`} checked={settings[item.key]} disabled={locked}
            onChange={() => update({ [item.key]: !settings[item.key] })} />} />)}
        {sequence === 16 ? <div className="grid grid-cols-3 gap-2">{['纵向', '横向', '航向'].map((label, index) => <SimField key={label} label={`${label}权重`}>
          <select className="sim-hud-input" aria-label={`${label}任务权重`} disabled={locked} value={settings.axisWeights[index]}
            onChange={(event) => update({ axisWeights: settings.axisWeights.map((value, axis) => axis === index ? Number(event.target.value) : value) as [number, number, number] })}>
            {[0.5, 1, 2].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </SimField>)}</div> : null}
        <p className="text-xs leading-5 text-platform-fg-secondary">本实验围绕位置保持、推进分配与故障策略开展教学。船体六自由度响应、轴惯量、转向时间及功率限制共同决定实际运动。钻柱与隔水管结构安全需要专门分析。</p>
      </div>
    <p className="text-xs leading-5 text-platform-fg-secondary">波浪复用已有计算结果，差频采用16个代表频率、9个波向的教学系数及插值。适用于低频定位和控制因果比较，幅值统计按50%教学容差验收。各次比较采用同一数据版本与随机种子。</p>
    </SimPanelSection>
    {[16, 19].includes(sequence) ? <SimPanelSection title="本人已冻结方案" icon={Navigation}>
      <SimField label="引用此前完整运行">
        <select className="sim-hud-input" aria-label="引用本人定位方案" value="" disabled={locked} onChange={(event) => {
          const source = course.runs.find((run) => run.id === event.target.value);
          if (!source?.courseSettings) return;
          course.setSettings(source.courseSettings as unknown as DrillingCourseSettings);
          course.setDesignModelId(source.designStudentModelId ?? '');
        }}>
          <option value="">选择本人方案</option>
          {course.runs.filter((run) => run.stoppedAtMs && (sequence === 16 ? run.stepSequence === 15 : [16, 17].includes(run.stepSequence)))
            .map((run) => <option key={run.id} value={run.id}>第{run.stepSequence}步 · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>)}
        </select>
      </SimField>
    </SimPanelSection> : null}
    {sequence === 18 ? <SimPanelSection title="静态能力预测" icon={Gauge}>
      <Button className={simulationUi.buttonOutline} size="sm" disabled={locked || !course.ready} onClick={computeCapacity}>计算并保存十五组能力预测</Button>
      {capacity.length ? <div className="mt-2 overflow-x-auto text-xs"><table className="w-full text-left tabular-nums">
        <thead><tr><th>风速</th><th>预算</th><th>预测出力</th><th>残差</th></tr></thead>
        <tbody>{capacity.map((row) => <tr key={`${row.windSpeedMps}-${row.powerBudgetW}`}>
          <td>{row.windSpeedMps}m/s</td><td>{row.powerBudgetW / 1e6}MW</td><td>{(row.allocation.predictedPowerW / 1e6).toFixed(2)}MW</td>
          <td>{row.allocation.normalizedResidual.toFixed(4)}</td>
        </tr>)}</tbody>
      </table></div> : null}
      {capacityError ? <p role="status" className="text-xs text-platform-fg-secondary">{capacityError}</p> : null}
    </SimPanelSection> : null}
    {sequence === 20 ? <SimPanelSection title="报告引用的本人运行" icon={Gauge}>
      {course.runs.filter((run) => run.stoppedAtMs !== null).map((run) => (
        <label key={run.id} className="flex items-center gap-2 text-xs text-platform-fg-secondary">
          <input type="checkbox" checked={course.reportRunIds.includes(run.id)}
            onChange={(event) => course.setReportRunIds((previous) => event.target.checked
              ? [...previous, run.id] : previous.filter((id) => id !== run.id))} />
          第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
        </label>
      ))}
    </SimPanelSection> : null}
  </SimPanelStack>;
}
