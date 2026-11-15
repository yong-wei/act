'use client';

import {Activity, Anchor, SlidersHorizontal} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {VesselExperimentController} from '../simulations/use-vessel-experiment';
import {SimField, SimPanelSection, SimPanelStack, SimRunControls, SimSwitchInput, SimToggleRow} from '../components/simulation-panels';
import {simulationUi} from '../components/simulation-ui';
import {ModelComparisonCurve} from './model-comparison-curve';
import {DREDGER_COURSE_STEPS, type DredgerCourseSettings} from './dredger-course';

export function DredgerCourseControls({session, timeS}: {
  session: VesselExperimentController<DredgerCourseSettings>; timeS: number;
}) {
  const course = session.course;
  if (!course) return null;
  const sequence = session.activeSeq;
  const step = DREDGER_COURSE_STEPS[sequence - 1];
  const settings = course.settings;
  const locked = session.busy || course.running || timeS > 0 || session.tour.active;
  const update = (patch: Partial<DredgerCourseSettings>) => course.setSettings((previous) => ({...previous, ...patch}));
  const models = course.models.filter((model) => model.channel === 'winch-reference-to-sway');
  const forecast = course.comparisons.filter((item) => item.purpose === 'forecast' && item.runId === course.plannedRunId).at(-1);
  const fields: Array<{key: keyof DredgerCourseSettings; label: string; min: number; max: number; step: number; visible: boolean}> = [
    {key: 'transitRpm', label: '自航双轴参考 / rpm', min: -180, max: 180, step: 5, visible: sequence === 2},
    {key: 'rudderDeg', label: '手动舵角 / °', min: -35, max: 35, step: 1, visible: sequence === 2},
    {key: 'manualWinchMps', label: '单侧收放速度 / m/s', min: -0.05, max: 0.05, step: 0.005, visible: sequence === 4},
    {key: 'targetDepthM', label: '刀位包络目标深度 / m', min: 19.5, max: 20.5, step: 0.1, visible: sequence === 7 || step.closedLoop},
    {key: 'cutterRpm', label: '绞刀参考 / rpm', min: 10, max: 40, step: 5, visible: sequence === 8 || step.closedLoop},
    {key: 'referenceMps', label: '横移速度参考 / m/s', min: 0.03, max: 0.15, step: 0.01, visible: step.closedLoop},
    {key: 'halfAngleDeg', label: '横移半幅 / °', min: 1, max: 15, step: 1, visible: step.closedLoop},
    {key: 'kpMultiplier', label: '比例增益相对本人IMC初值', min: 0.2, max: 3, step: 0.1, visible: step.closedLoop},
    {key: 'tiMultiplier', label: '积分时间相对本人IMC初值', min: 0.2, max: 3, step: 0.1, visible: step.closedLoop},
    {key: 'entrySpeedMps', label: '允许进入切削的船速 / m/s', min: 0.03, max: 0.1, step: 0.01, visible: step.closedLoop},
    {key: 'safetyFraction', label: '提前中止阈值相对标称值', min: 0.7, max: 1, step: 0.05, visible: step.closedLoop},
    {key: 'depthFilterTauS', label: '深度量测滤波 / s', min: 0.05, max: 5, step: 0.05, visible: sequence === 7 || step.closedLoop},
    {key: 'swayFilterTauS', label: '横移量测滤波 / s', min: 0.05, max: 5, step: 0.05, visible: step.closedLoop},
  ];
  return <SimPanelStack>
    <SimRunControls running={course.running} primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
      disabled={session.busy || session.tour.active} primaryDisabled={!course.ready || course.completed || step.stepKind === 'analysis'}
      onPrimary={() => { void (course.running ? course.pause() : course.start()); }} onReset={() => { void course.reset(); }} />
    {sequence === 4 ? <SimField label="单侧绞车">
      <select className="sim-hud-input" aria-label="单侧绞车" disabled={locked} value={settings.manualCable}
        onChange={(event) => update({manualCable: event.target.value as 'port' | 'starboard'})}>
        <option value="port">左舷</option><option value="starboard">右舷</option>
      </select>
      <p className="mt-1 text-xs text-platform-fg-secondary">负速度收缆，正速度放缆。命令在30至90秒作用于所选绞车。</p>
    </SimField> : null}
    {sequence === 3 ? <p className="text-xs leading-5 text-platform-fg-secondary">给定倒桩链在60秒请求退出，80至120秒以0.025m/s移动台车，140秒重新落桩。
      机构只在停刀、抬刀、撤桩和低船速条件均满足后移动台车，请观察接触反力的建立与撤除。</p> : null}
    {fields.filter((field) => field.visible).map((field) => <SimField key={field.key} label={field.label}>
      <input className="sim-hud-input" type="number" aria-label={field.label} min={field.min} max={field.max} step={field.step}
        disabled={locked} value={Number(settings[field.key])} onChange={(event) => update({[field.key]: Number(event.target.value)})} />
    </SimField>)}
    {step.closedLoop ? <SimPanelSection title="本人横移与模式方案" icon={SlidersHorizontal}>
      <div className="space-y-3">
        <SimField label="本人冻结的绞车联合模型">
          <select className="sim-hud-input" aria-label="本人冻结的绞车联合模型" disabled={locked} value={course.designModelId}
            onChange={(event) => course.setDesignModelId(event.target.value)}>
            <option value="">选择本人固定模式辨识结果</option>
            {models.map((model, index) => <option key={model.id} value={model.id}>{model.label} · 版本{index + 1}</option>)}
          </select>
        </SimField>
        <SimField label="换向斜坡 / s">
          <select className="sim-hud-input" aria-label="换向斜坡 / s" disabled={locked} value={settings.reversalRampS}
            onChange={(event) => update({reversalRampS: Number(event.target.value) as 5 | 15 | 30})}>
            {[5, 15, 30].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </SimField>
        <SimField label="进入条件保持 / s">
          <select className="sim-hud-input" aria-label="进入条件保持 / s" disabled={locked} value={settings.entryHoldS}
            onChange={(event) => update({entryHoldS: Number(event.target.value) as 5 | 10 | 20})}>
            {[5, 10, 20].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </SimField>
        <SimField label="模式切换时的积分处理">
          <select className="sim-hud-input" aria-label="模式切换时的积分处理" disabled={locked} value={settings.integralPolicy}
            onChange={(event) => update({integralPolicy: event.target.value as DredgerCourseSettings['integralPolicy']})}>
            <option value="track">跟踪实际输出</option><option value="freeze">冻结积分</option><option value="reset">直接重置</option>
          </select>
        </SimField>
        {sequence === 16 ? <SimToggleRow label="0.5m横浪" htmlFor="dredger-wave" control={<SimSwitchInput id="dredger-wave"
          checked={settings.wavesEnabled} disabled={locked} onChange={() => update({wavesEnabled: !settings.wavesEnabled})} />} /> : null}
        {sequence === 19 ? <>
          <SimField label="未见土层工况">
            <select className="sim-hud-input" aria-label="未见土层工况" disabled={locked} value={settings.validationSeed}
              onChange={(event) => update({validationSeed: Number(event.target.value) as 17 | 29})}>
              <option value={17}>工况甲</option><option value={29}>工况乙</option>
            </select>
          </SimField>
        </> : null}
        {[18, 19].includes(sequence) ? <>
          <SimField label="引用本人已保存的综合方案">
            <select className="sim-hud-input" aria-label="引用本人已保存的综合方案" disabled={locked} value="" onChange={(event) => {
              const source = course.runs.find((run) => run.id === event.target.value);
              if (!source?.courseSettings) return;
              course.setSettings({...source.courseSettings as unknown as DredgerCourseSettings, validationSeed: settings.validationSeed});
              course.setDesignModelId(source.designStudentModelId ?? '');
            }}><option value="">选择此前的本人综合方案</option>
              {course.runs.filter((run) => [17, 18].includes(run.stepSequence) && run.stepSequence < sequence && run.stoppedAtMs !== null).map((run) =>
                <option key={run.id} value={run.id}>第{run.stepSequence}步 · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>)}
            </select>
          </SimField>
        </> : null}
      </div>
      <p className="mt-2 text-xs leading-5 text-platform-fg-secondary">PI初值来自本人模型。二阶模型按两时间常数之和生成初值。
        C预测采用固定横移切削模式及标称准备时间，实际土层、波浪与保护动作通过独立对照检验。</p>
      <Button size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={locked || !course.ready || !course.designModelId}
        onClick={() => { void course.freezePrediction(); }}>冻结独立横移预测</Button>
      {forecast ? <ModelComparisonCurve comparison={forecast} studentModel={models.find((model) => model.id === forecast.modelId)} /> : null}
    </SimPanelSection> : null}
    <SimPanelSection title="机构与适用范围" icon={Anchor}>
      <p className="text-xs leading-5 text-platform-fg-secondary">钢桩10秒建立有限支承，两条弹性锚缆承受拉力。桥架与绞刀的载荷参与船体运动。
        砂与黏土采用Miedema局部切削近似，产量累计实际新移除体积。报告采用绞刀、横移绞车和推进轴系的机械能耗口径，适用于均质土层的低速教学工况。</p>
    </SimPanelSection>
    {sequence === 20 ? <SimPanelSection title="报告引用的本人运行" icon={Activity}>
      {course.runs.filter((run) => run.stoppedAtMs !== null).map((run) => <label key={run.id} className="flex items-center gap-2 text-xs text-platform-fg-secondary">
        <input type="checkbox" checked={course.reportRunIds.includes(run.id)} onChange={(event) => course.setReportRunIds((previous) =>
          event.target.checked ? [...previous, run.id] : previous.filter((id) => id !== run.id))} />
        第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
      </label>)}
    </SimPanelSection> : null}
  </SimPanelStack>;
}
