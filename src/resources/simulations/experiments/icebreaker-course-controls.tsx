'use client';

import { Gauge, SlidersHorizontal, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import { SimField, SimPanelSection, SimPanelStack, SimRunControls, SimSwitchInput, SimToggleRow } from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import { ModelComparisonCurve } from './model-comparison-curve';
import { ICEBREAKER_COURSE_STEPS, type IcebreakerCourseSettings } from './icebreaker-course';

export function IcebreakerCourseControls({ session, timeS }: {
  session: VesselExperimentController<IcebreakerCourseSettings>; timeS: number;
}) {
  const course = session.course;
  if (!course) return null;
  const sequence = session.activeSeq;
  const step = ICEBREAKER_COURSE_STEPS[sequence - 1];
  const settings = course.settings;
  const locked = session.busy || course.running || timeS > 0 || session.tour.active;
  const update = (patch: Partial<IcebreakerCourseSettings>) => course.setSettings((previous) => ({ ...previous, ...patch }));
  const models = course.models.filter((model) => model.channel === 'azimuth-to-yaw' && model.payload.structure.kind === 'nomoto1');
  const forecast = course.comparisons.filter((item) => item.purpose === 'forecast' && item.runId === course.plannedRunId).at(-1);
  const selectors: Array<{ key: 'initialSpeedMps' | 'thicknessM' | 'strengthMpa' | 'filterTauS' | 'rampS' | 'validationSeed';
    label: string; values: number[]; visible: boolean }> = [
    { key: 'initialSpeedMps', label: '初始航速 / m/s', values: sequence === 6 ? [.5, 4] : [.5, 1, 1.5], visible: [6, 16].includes(sequence) },
    { key: 'thicknessM', label: '平整冰厚 / m', values: [.3, .6, .9], visible: sequence === 12 },
    { key: 'strengthMpa', label: '抗弯强度 / MPa', values: [.35, .65], visible: sequence === 13 },
    { key: 'filterTauS', label: '测量微分滤波 / s', values: [0, .2, 1, 3], visible: step.closedLoop },
    { key: 'rampS', label: '参考斜坡时间 / s', values: [10, 60], visible: sequence === 15 },
    { key: 'validationSeed', label: '未见工况', values: [17, 29], visible: sequence === 19 },
  ];
  return <SimPanelStack>
    <SimRunControls running={course.running} primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
      disabled={session.busy || session.tour.active} primaryDisabled={!course.ready || course.completed || step.stepKind === 'analysis'}
      onPrimary={() => { void (course.running ? course.pause() : course.start()); }} onReset={() => { void course.reset(); }} />
    {sequence === 19 && course.canFinish ? <Button size="sm" variant="outline" className={simulationUi.buttonOutline}
      disabled={session.busy || session.tour.active} onClick={() => { void course.finish(); }}>按实际时刻结束故障观察</Button> : null}
    {selectors.filter((item) => item.visible).map((item) => <SimField key={item.key} label={item.label}>
      <select className="sim-hud-input" aria-label={item.label} disabled={locked} value={settings[item.key]}
        onChange={(event) => update({ [item.key]: Number(event.target.value) })}>
        {item.values.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </SimField>)}
    {step.closedLoop ? <SimPanelSection title="本人航向控制方案" icon={SlidersHorizontal}>
      <div className="space-y-3">
        <SimField label="本人冻结的局部模型">
          <select className="sim-hud-input" aria-label="本人冻结的局部模型" disabled={locked}
            value={course.designModelId} onChange={(event) => course.setDesignModelId(event.target.value)}>
            <option value="">选择本人吊舱—转艏速率模型</option>
            {models.map((model, index) => <option key={model.id} value={model.id}>
              {model.label} · {Number(model.payload.operatingPoint.speedMps).toFixed(1)}m/s · 冰厚{Number(model.payload.operatingPoint.iceThicknessM ?? 0).toFixed(2)}m · 版本{index + 1}
            </option>)}
          </select>
        </SimField>
        {([['kpMultiplier', 'Kp相对本人模型建议值', .2, 3], ['kdMultiplier', 'Kd相对本人模型建议值', .2, 3],
          ['integralTimeS', '积分时间 / s', 50, 400]] as const).map(([key, label, min, max]) => <SimField key={key} label={label}>
          <input className="sim-hud-input" type="number" aria-label={label} min={min} max={max} step={key === 'integralTimeS' ? 10 : .1}
            disabled={locked} value={settings[key]} onChange={(event) => update({ [key]: Number(event.target.value) })} />
        </SimField>)}
        <SimToggleRow label="启用积分" htmlFor="ice-heading-integral" control={<SimSwitchInput id="ice-heading-integral"
          checked={settings.integralEnabled} disabled={locked} onChange={() => update({ integralEnabled: !settings.integralEnabled })} />} />
        {sequence >= 14 ? <>
          <SimToggleRow label="按已声明冰厚调度" htmlFor="ice-heading-schedule" control={<SimSwitchInput id="ice-heading-schedule"
            checked={settings.scheduling} disabled={locked} onChange={() => update({ scheduling: !settings.scheduling })} />} />
          {settings.scheduling ? <SimField label="第二工况的本人冰区模型">
            <select className="sim-hud-input" aria-label="第二工况的本人冰区模型" disabled={locked} value={settings.iceModelId}
              onChange={(event) => update({ iceModelId: event.target.value })}>
              <option value="">选择本人冰区辨识结果</option>
              {models.filter((model) => Number(model.payload.operatingPoint.iceThicknessM) > 0).map((model) =>
                <option key={model.id} value={model.id}>{model.label}</option>)}
            </select>
          </SimField> : null}
        </> : null}
        {sequence >= 17 && sequence <= 19 ? <SimField label="对水航速参考 / m/s">
          <input className="sim-hud-input" type="number" aria-label="对水航速参考 / m/s" min={.3} max={1.5} step={.1}
            disabled={locked} value={settings.speedReferenceMps} onChange={(event) => update({ speedReferenceMps: Number(event.target.value) })} />
        </SimField> : null}
        {sequence >= 17 && sequence <= 19 ? <SimField label="航向参考补偿 / °">
          <input className="sim-hud-input" type="number" aria-label="航向参考补偿 / °" min={-15} max={15} step={.5}
            disabled={locked} value={settings.headingBiasDeg ?? 0} onChange={(event) => update({ headingBiasDeg: Number(event.target.value) })} />
          <p className="mt-1 text-xs text-platform-fg-secondary">根据本人航迹和风流量测选择迎流角，比较横偏与推进余量。</p>
        </SimField> : null}
        {[18, 19].includes(sequence) ? <SimField label="引用本人综合方案">
          <select className="sim-hud-input" aria-label="引用本人综合方案" disabled={locked} value="" onChange={(event) => {
            const source = course.runs.find((run) => run.id === event.target.value);
            if (!source?.courseSettings) return;
            course.setSettings({ ...source.courseSettings as unknown as IcebreakerCourseSettings,
              validationSeed: settings.validationSeed, jamFault: settings.jamFault, stopOnJam: settings.stopOnJam });
            course.setDesignModelId(source.designStudentModelId ?? '');
          }}><option value="">选择第17或18步的本人方案</option>
            {course.runs.filter((run) => [17, 18].includes(run.stepSequence) && run.stepSequence < sequence
              && run.stoppedAtMs !== null).map((run) => <option key={run.id} value={run.id}>
                第{run.stepSequence}步 · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
              </option>)}
          </select>
        </SimField> : null}
        {sequence === 19 ? <>
          <SimToggleRow label="180秒单吊舱卡滞" htmlFor="ice-pod-jam" control={<SimSwitchInput id="ice-pod-jam"
            checked={settings.jamFault} disabled={locked} onChange={() => update({ jamFault: !settings.jamFault })} />} />
          <SimToggleRow label="卡滞后停桨" htmlFor="ice-stop-on-jam" control={<SimSwitchInput id="ice-stop-on-jam"
            checked={settings.stopOnJam} disabled={locked} onChange={() => update({ stopOnJam: !settings.stopOnJam })} />} />
        </> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-platform-fg-secondary">航向增益来自本人冻结模型。负时间常数表示局部开环方向不稳定，需结合残差与独立窗口判断。
        航速PI使用同一推进平衡点与60秒标称时间尺度的T级设计模板，其适用性需由实际响应检验。双吊舱功率和转向速率受实际约束。</p>
      <Button size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={locked || !course.ready || !course.designModelId}
        onClick={() => { void course.freezePrediction(); }}>冻结独立航向预测</Button>
      {forecast ? <ModelComparisonCurve comparison={forecast} studentModel={models.find((model) => model.id === forecast.modelId)} /> : null}
    </SimPanelSection> : null}
    {sequence >= 8 ? <SimPanelSection title="冰区任务条件" icon={Snowflake}>
      <p className="text-xs leading-5 text-platform-fg-secondary">平整无雪冰覆盖北向200至700m、横向正负60m。通道终点为北向800m，允许横偏正负25m。
        冰区波浪关闭，综合工况保留风、流与量测噪声。断裂浮冰显示当前船旁最近的128块，完整运动状态随实验保存。
        接触采用T级条带冰板近似，省略浮冰之间的挤压与裂纹传播；耗散和清排量由实际接触计算。</p>
    </SimPanelSection> : null}
    {sequence === 20 ? <SimPanelSection title="报告引用的本人运行" icon={Gauge}>
      {course.runs.filter((run) => run.stoppedAtMs !== null).map((run) => <label key={run.id} className="flex items-center gap-2 text-xs text-platform-fg-secondary">
        <input type="checkbox" checked={course.reportRunIds.includes(run.id)} onChange={(event) => course.setReportRunIds((previous) =>
          event.target.checked ? [...previous, run.id] : previous.filter((id) => id !== run.id))} />
        第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
      </label>)}
    </SimPanelSection> : null}
  </SimPanelStack>;
}
