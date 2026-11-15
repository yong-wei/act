'use client';

import { Gauge, Navigation, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import { SimField, SimPanelSection, SimPanelStack, SimRunControls, SimSwitchInput, SimToggleRow } from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import { ModelComparisonCurve } from './model-comparison-curve';
import { ContainerVoyageTradeoff } from './container-voyage-tradeoff';
import { CONTAINER_COURSE_STEPS, type ContainerCourseSettings } from './container-course';

export function ContainerCourseControls({session, timeS}: {
  session: VesselExperimentController<ContainerCourseSettings>; timeS: number;
}) {
  const course = session.course;
  if (!course) return null;
  const step = CONTAINER_COURSE_STEPS[session.activeSeq - 1];
  const settings = course.settings;
  const locked = session.busy || course.running || timeS > 0;
  const liveFrame = course.read();
  const livePowerW = liveFrame
    ? liveFrame.truth.actuator_states.motor_torques_nm.reduce(
        (sum, torque, index) => sum + torque * (liveFrame.truth.actuator_states.propeller_shaft_speed_rad_s[index] ?? 0),
        0,
      )
    : 0;
  const update = (patch: Partial<ContainerCourseSettings>) => course.setSettings((previous) => ({...previous, ...patch}));
  const models = course.models.filter((model) => model.channel === 'shaft-reference-to-speed' && model.payload.structure.kind === 'fopdt');
  const forecast = course.comparisons.filter((item) => item.purpose === 'forecast' && item.runId === course.plannedRunId).at(-1);
  const selectors: Array<{key: 'loadingRatio' | 'initialSpeedMps' | 'excitationPercent' | 'filterTauS' | 'validationSeed'; label: string; values: number[]; visible: boolean}> = [
    {key: 'loadingRatio', label: '装载率', values: session.activeSeq === 2 ? [.2, .6, .9] : [.2, .9], visible: [2, 5, 8, 9, 14].includes(session.activeSeq)},
    {key: 'initialSpeedMps', label: '初始航速 / m/s', values: [6, 10], visible: session.activeSeq === 6},
    {key: 'excitationPercent', label: '轴速参考阶跃 / %', values: [-5, 5], visible: [5, 6].includes(session.activeSeq)},
    {key: 'filterTauS', label: '量测滤波 / s', values: [.2, 1, 3], visible: session.activeSeq === 16},
    {key: 'validationSeed', label: '未见工况种子', values: [17, 29], visible: session.activeSeq === 19},
  ];
  return <SimPanelStack>
    <SimRunControls running={course.running} primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
      disabled={session.busy} primaryDisabled={!course.ready || course.completed || step.stepKind === 'analysis'}
      onPrimary={() => {void (course.running ? course.pause() : course.start());}} onReset={() => {void course.reset();}} />
    {selectors.filter((item) => item.visible).map((item) => <SimField key={item.key} label={item.label}>
      <select className="sim-hud-input" aria-label={item.label} disabled={locked} value={settings[item.key]}
        onChange={(event) => update({[item.key]: Number(event.target.value)})}>
        {item.values.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </SimField>)}
    {session.activeSeq >= 15 && session.activeSeq <= 19 ? <SimPanelSection title="教学平均附加阻力">
      {session.activeSeq === 15 ? <SimToggleRow label="启用教学平均附加阻力" htmlFor="container-mean-resistance"
        control={<SimSwitchInput id="container-mean-resistance" checked={Boolean(settings.meanWaveResistanceEnabled)} disabled={locked}
          onChange={() => update({meanWaveResistanceEnabled: !settings.meanWaveResistanceEnabled})} />} /> : null}
      <p className="text-xs leading-5 text-platform-fg-secondary">T级近似采用ITTC短波反射尺度，方向函数与跨装载复用属于教学假设。
        参考范围为航速6至12m/s、波高不超过1.5m、谱峰波长不超过半船长。标称值的0.5至1.5倍为假设敏感性范围，实际误差尚未校准。
        平均阻力与作用点力矩参与实际航程和燃油积分。</p>
    </SimPanelSection> : null}
    {step.speedControl ? <SimPanelSection title="本人航速控制方案" icon={SlidersHorizontal}>
      <div className="space-y-3">
        {settings.modelIds.map((id, index) => <SimField key={index} label={`工作点${index + 1}${index === 1 ? '（固定控制器基准）' : ''}`}>
          <select className="sim-hud-input" aria-label={`调度工作点${index + 1}`} disabled={locked} value={id} onChange={(event) => {
            const ids: ContainerCourseSettings['modelIds'] = [...settings.modelIds]; ids[index] = event.target.value;
            update({modelIds: ids}); if (index === 1) course.setDesignModelId(event.target.value);
          }}><option value="">选择本人冻结模型</option>{models.map((model, at) => <option key={model.id} value={model.id}>
            {model.label} · 装载{Number(model.payload.operatingPoint.loadingRatio).toFixed(2)} · {Number(model.payload.operatingPoint.speedMps).toFixed(1)}m/s · 版本{at + 1}
          </option>)}</select>
        </SimField>)}
        {([['kpMultiplier', 'Kp相对IMC建议值', .2, 3], ['tiMultiplier', 'Ti相对IMC建议值', .3, 3]] as const).map(([key, label, min, max]) =>
          <SimField key={key} label={label}><input className="sim-hud-input" type="number" aria-label={label} min={min} max={max} step={.1}
            disabled={locked} value={settings[key]} onChange={(event) => update({[key]: Number(event.target.value)})} /></SimField>)}
        {session.activeSeq >= 9 ? <SimToggleRow label="三点线性增益调度" htmlFor="container-schedule"
          control={<SimSwitchInput id="container-schedule" checked={settings.schedulingEnabled} disabled={locked}
            onChange={() => update({schedulingEnabled: !settings.schedulingEnabled})} />} /> : null}
        <SimToggleRow label="无扰积分跟踪" htmlFor="container-bumpless" control={<SimSwitchInput id="container-bumpless"
          checked={settings.bumpless} disabled={locked} onChange={() => update({bumpless: !settings.bumpless})} />} />
        <SimToggleRow label="积分抗饱和回算" htmlFor="container-aw" control={<SimSwitchInput id="container-aw"
          checked={settings.antiWindup} disabled={locked} onChange={() => update({antiWindup: !settings.antiWindup})} />} />
        {[18, 19].includes(session.activeSeq) ? <SimField label="已冻结的综合方案">
          <select className="sim-hud-input" aria-label="引用综合航次方案" disabled={locked} value="" onChange={(event) => {
            const source = course.runs.find((run) => run.id === event.target.value);
            if (!source?.courseSettings) return;
            const frozen = source.courseSettings as unknown as ContainerCourseSettings;
            course.setSettings({...frozen, validationSeed: settings.validationSeed});
            course.setDesignModelId(source.designStudentModelId ?? '');
          }}><option value="">选择本人综合航次</option>{course.runs.filter((run) => [17, 18].includes(run.stepSequence)
            && run.stoppedAtMs !== null && run.stepSequence < session.activeSeq).map((run) => <option key={run.id} value={run.id}>
              第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
            </option>)}</select>
        </SimField> : null}
      </div>
    </SimPanelSection> : null}
    {step.voyageTask ? <SimPanelSection title="6000m四段航次" icon={Navigation}>
      <div className="space-y-2">{settings.segmentSpeedsMps.map((speed, index) => <SimField key={index} label={`第${index + 1}段航速 / m/s`}>
        <input className="sim-hud-input" type="number" aria-label={`第${index + 1}段航速`} min={6} max={12} step={.2}
          disabled={locked || session.activeSeq === 11} value={session.activeSeq === 11 ? 8 : speed} onChange={(event) => {
            const speeds: ContainerCourseSettings['segmentSpeedsMps'] = [...settings.segmentSpeedsMps]; speeds[index] = Number(event.target.value);
            update({segmentSpeedsMps: speeds});
          }} />
      </SimField>)}
        {session.activeSeq === 13 ? <SimField label="航速反馈"><select className="sim-hud-input" aria-label="航速反馈" disabled={locked}
          value={settings.feedback} onChange={(event) => update({feedback: event.target.value as 'water' | 'ground'})}>
          <option value="water">对水计程仪</option><option value="ground">低频对地航速估计</option>
        </select></SimField> : null}
        {[13, 16, 17, 18, 19].includes(session.activeSeq) ? <SimField label="LOS前视距离 / m"><input className="sim-hud-input" type="number"
          aria-label="LOS前视距离" min={200} max={800} step={50} disabled={locked} value={settings.losLookaheadM}
          onChange={(event) => update({losLookaheadM: Number(event.target.value)})} /></SimField> : null}
        <p className="text-xs leading-5 text-platform-fg-secondary">每段1500m，参考斜率上限0.05m/s²。实际到达时限900s，运行最长1200s，燃油比较还需核对末速8±0.3m/s、横偏和航向。</p>
        <ContainerVoyageTradeoff
          timeS={timeS}
          positionX={liveFrame?.truth.position_ned[0] ?? 0}
          speedMps={liveFrame?.waterVelocityBody[0] ?? settings.segmentSpeedsMps[0] ?? 8}
          powerW={livePowerW}
          fuelKg={liveFrame?.teachingFuel?.state.fuel_kg ?? 0}
          rudderDeg={((liveFrame?.truth.actuator_states.control_surface_angles_rad[0] ?? 0) * 180) / Math.PI}
          voyage={liveFrame?.containerVoyage}
          compact
        />
      </div>
    </SimPanelSection> : null}
    {step.speedControl ? <>
      <Button size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={locked || !course.ready || !course.designModelId}
        onClick={() => {void course.freezePrediction();}}>冻结理想速度与航次预测</Button>
      {forecast ? <><ModelComparisonCurve comparison={forecast} />{step.voyageTask ? <p className="text-xs leading-5 text-platform-fg-secondary">
        理想到达时间 {forecast.metrics.ideal_arrival_s == null ? '窗口内未到达' : `${forecast.metrics.ideal_arrival_s.toFixed(1)}s`}，
        理想燃油 {forecast.metrics.ideal_fuel_kg == null ? '缺少工作点' : `${forecast.metrics.ideal_fuel_kg.toFixed(1)}kg`}。
        采用固定工作点速度立方近似与教学发动机曲线，实际燃油由轴功率积分。</p> : null}</> : null}
    </> : null}
    {session.activeSeq === 20 ? <SimPanelSection title="报告引用的本人运行" icon={Gauge}>
      {course.runs.filter((run) => run.stoppedAtMs !== null).map((run) => <label key={run.id} className="flex items-center gap-2 text-xs text-platform-fg-secondary">
        <input type="checkbox" checked={course.reportRunIds.includes(run.id)} onChange={(event) => course.setReportRunIds((previous) =>
          event.target.checked ? [...previous, run.id] : previous.filter((id) => id !== run.id))} />
        第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
      </label>)}
    </SimPanelSection> : null}
  </SimPanelStack>;
}
