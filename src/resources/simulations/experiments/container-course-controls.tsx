'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gauge, Navigation, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import {
  SimChip, SimField, SimLockedChip, SimNotice, SimPanelSection, SimPanelStack,
  SimRunControls, SimSwitchInput, SimToggleRow,
} from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import { ModelComparisonCurve } from './model-comparison-curve';
import { ContainerVoyageTradeoff } from './container-voyage-tradeoff';
import { CONTAINER_COURSE_STEPS, type ContainerCourseSettings } from './container-course';
import {
  collectDistinctContainerOpModels, completeContainerBankForPrimary, CONTAINER_SCHEME_DIFF_FIELDS,
  diffContainerSchemeDimensions, formatContainerModelTag, hasValidContainerModelBank,
  missingContainerModelSteps, resolveContainerPriorStepSettings,
} from './container-step-specs';
import type { FrozenVesselStudentModel } from './student-analysis';

function BaselineReadOnlyDetails({ summary, settings, models, includeVoyage = false, defaultOpen = false }: {
  summary: string; settings: ContainerCourseSettings; models: FrozenVesselStudentModel[]; includeVoyage?: boolean; defaultOpen?: boolean;
}) {
  const primary = models.find((m) => m.id === settings.modelIds[1]);
  return (
    <details open={defaultOpen} className="rounded-lg border border-platform-fg-primary/15 bg-platform-canvas/40 px-2.5 py-2 text-xs">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 font-medium text-platform-fg-primary">
        <span>{summary}</span><SimLockedChip locked>只读基线</SimLockedChip>
      </summary>
      <div className="mt-2 space-y-1 text-[11px] leading-5 text-platform-fg-secondary">
        <p>主工作点模型：{formatContainerModelTag(primary)}</p>
        <p>PI 倍率：Kp {settings.kpMultiplier.toFixed(1)}× · Ti {settings.tiMultiplier.toFixed(1)}× · 调度 {settings.schedulingEnabled ? '开启' : '关闭'} · 无扰 {settings.bumpless ? '开启' : '关闭'} · 抗饱和 {settings.antiWindup ? '开启' : '关闭'}</p>
        {includeVoyage ? (
          <p>四段航速：{settings.segmentSpeedsMps.map((v) => v.toFixed(1)).join(' / ')} m/s · 滤波 {settings.filterTauS} s · 前视 {settings.losLookaheadM} m · 反馈 {settings.feedback === 'ground' ? '低频对地' : '对水计程仪'}</p>
        ) : null}
      </div>
    </details>
  );
}

function Step18DiffBanner({ baselineEtaS, changedDims }: {
  baselineEtaS: number;
  changedDims: Array<{ key: keyof ContainerCourseSettings; label: string }>;
}) {
  const tone = changedDims.length === 1
    ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200'
    : changedDims.length === 0
      ? 'border-amber-500/45 bg-amber-500/10 text-amber-800 dark:text-amber-200'
      : 'border-rose-500/45 bg-rose-500/12 text-rose-800 dark:text-rose-200';
  return (
    <div data-step18-diff-counter className={`rounded-md border px-2.5 py-2 text-xs ${tone}`}>
      <div className="flex items-center justify-between font-semibold">
        <span>已修改维度：{changedDims.length}/1</span>
        <span className="font-mono">{changedDims.length === 1 ? '合规' : '待调整'}</span>
      </div>
      <p className="mt-0.5 text-[11px]">
        {changedDims.length === 1 ? `当前仅修改「${changedDims[0].label}」（第 17 步 ETA ${baselineEtaS.toFixed(1)}s）`
          : changedDims.length === 0 ? `请恰好修改 1 个设计维度（第 17 步 ETA ${baselineEtaS.toFixed(1)}s）`
            : `同时改动了 ${changedDims.map((d) => d.label).join('、')}，请缩减至仅保留 1 个维度差异`}
      </p>
    </div>
  );
}

export function ContainerCourseControls({ session, timeS }: { session: VesselExperimentController<ContainerCourseSettings>; timeS: number }) {
  const course = session.course;
  const seq = session.activeSeq;
  const settings = course?.settings;
  const locked = session.busy || Boolean(course?.running) || timeS > 0;
  const [selectedStep17Id, setSelectedStep17Id] = useState('');
  const [selectedBlindSchemeId, setSelectedBlindSchemeId] = useState('');

  const models = useMemo(() => (course?.models ?? []).filter((m) => m.channel === 'shaft-reference-to-speed' && m.payload.structure.kind === 'fopdt'), [course?.models]);
  const distinctOpModels = useMemo(() => collectDistinctContainerOpModels(models), [models]);
  const missingSteps = useMemo(() => missingContainerModelSteps(models), [models]);
  const completedRuns = useMemo(() => (course?.runs ?? []).filter((r) => r.stoppedAtMs !== null), [course?.runs]);
  const step17Runs = useMemo(() => completedRuns.filter((r) => r.stepSequence === 17), [completedRuns]);
  const frozen17Or18Runs = useMemo(() => completedRuns.filter((r) => r.stepSequence === 17 || r.stepSequence === 18), [completedRuns]);

  useEffect(() => {
    if (!course || !settings || locked || seq < 7 || seq > 19) return;
    const inherited = resolveContainerPriorStepSettings(seq, settings, completedRuns, models, distinctOpModels);
    if (inherited) {
      if (seq === 18 && inherited.sourceRunId) setSelectedStep17Id(inherited.sourceRunId);
      if (seq === 19 && inherited.sourceRunId) setSelectedBlindSchemeId(inherited.sourceRunId);
      course.setSettings(inherited.settings);
      course.setDesignModelId(inherited.designModelId);
      return;
    }
    if (settings.modelIds[1] && models.some((m) => m.id === settings.modelIds[1]) && course.designModelId !== settings.modelIds[1]) {
      course.setDesignModelId(settings.modelIds[1]);
    }
  }, [course, settings, locked, seq, models, distinctOpModels, completedRuns]);

  useEffect(() => {
    if (seq === 18 && !selectedStep17Id && step17Runs[0]) setSelectedStep17Id(step17Runs[0].id);
  }, [seq, selectedStep17Id, step17Runs]);

  useEffect(() => {
    if (seq !== 19 || selectedBlindSchemeId || frozen17Or18Runs.length === 0 || !settings) return;
    const match = frozen17Or18Runs.find((run) => {
      const cfg = run.courseSettings as Partial<ContainerCourseSettings> | undefined;
      return cfg && CONTAINER_SCHEME_DIFF_FIELDS.every((f) => JSON.stringify(cfg[f.key]) === JSON.stringify(settings[f.key]));
    });
    if (match) setSelectedBlindSchemeId(match.id);
  }, [seq, selectedBlindSchemeId, frozen17Or18Runs, settings]);

  if (!course || !settings) return null;
  const step = CONTAINER_COURSE_STEPS[seq - 1];
  const liveFrame = course.read();
  const livePowerW = liveFrame
    ? liveFrame.truth.actuator_states.motor_torques_nm.reduce((sum, t, i) => sum + t * (liveFrame.truth.actuator_states.propeller_shaft_speed_rad_s[i] ?? 0), 0)
    : 0;
  const update = (patch: Partial<ContainerCourseSettings>) => course.setSettings((prev) => ({ ...prev, ...patch }));
  const forecast = course.comparisons.filter((item) => item.purpose === 'forecast' && item.runId === course.plannedRunId).at(-1);

  const baselineRun17 = step17Runs.find((r) => r.id === selectedStep17Id) ?? step17Runs[0];
  const changedDims18 = diffContainerSchemeDimensions(baselineRun17?.courseSettings as Partial<ContainerCourseSettings> | undefined, settings);
  const blindSchemeLocked = seq === 19 && (frozen17Or18Runs.some((r) => r.id === selectedBlindSchemeId) || hasValidContainerModelBank(settings.modelIds, models));

  const applyFrozenRun = (runId: string, onSelectId: (id: string) => void) => {
    onSelectId(runId);
    const source = course.runs.find((run) => run.id === runId);
    if (!source?.courseSettings) return;
    const frozen = source.courseSettings as unknown as ContainerCourseSettings;
    course.setSettings({ ...frozen, validationSeed: settings.validationSeed });
    course.setDesignModelId(source.designStudentModelId ?? frozen.modelIds?.[1] ?? '');
  };

  const renderToggle = (id: string, label: string, key: 'schedulingEnabled' | 'bumpless' | 'antiWindup' | 'meanWaveResistanceEnabled') => (
    <SimToggleRow key={id} label={label} htmlFor={id} control={<SimSwitchInput id={id} checked={Boolean(settings[key])} disabled={locked} onChange={() => update({ [key]: !settings[key] })} />} />
  );

  const renderThreePointSchedule = (withTable = false) => (
    <div className="space-y-2.5">
      {distinctOpModels.length < 3 ? <SimNotice tone="warning" title="三点模型数量不足">还缺{missingSteps.join('、')}冻结模型，请先前往第 3/5/6 步冻结。</SimNotice> : null}
      {(['工作点1（轻载端）', '工作点2（中载基准）', '工作点3（重载端）'] as const).map((label, index) => (
        <SimField key={index} label={label}>
          <select className="sim-hud-input" aria-label={`调度工作点${index + 1}`} disabled={locked} value={settings.modelIds[index]} onChange={(event) => {
            const ids: ContainerCourseSettings['modelIds'] = [...settings.modelIds];
            ids[index] = event.target.value;
            update({ modelIds: ids });
            if (index === 1) course.setDesignModelId(event.target.value);
          }}>
            <option value="">选择本人冻结模型</option>
            {models.map((m, at) => <option key={m.id} value={m.id}>{formatContainerModelTag(m)} · 版本{at + 1}</option>)}
          </select>
        </SimField>
      ))}
      {withTable ? (
        <div className="overflow-x-auto rounded-md border border-platform-fg-primary/10 bg-platform-canvas/40 p-2 text-[11px]">
          <table className="w-full text-left tabular-nums text-platform-fg-secondary">
            <thead><tr className="text-platform-fg-primary"><th>点位</th><th>装载/航速</th><th>K</th><th>T / s</th><th>L / s</th></tr></thead>
            <tbody>{settings.modelIds.map((id, idx) => {
              const m = models.find((item) => item.id === id);
              const s = m?.payload.structure.kind === 'fopdt' ? m.payload.structure : null;
              return <tr key={idx}><td>点 {idx + 1}</td><td>{m ? `${Number(m.payload.operatingPoint.loadingRatio ?? 0).toFixed(2)} / ${Number(m.payload.operatingPoint.speedMps ?? 0).toFixed(1)}` : '未选'}</td><td>{s ? s.k.toFixed(4) : '—'}</td><td>{s ? s.t_s.toFixed(1) : '—'}</td><td>{s ? s.delay_s.toFixed(1) : '—'}</td></tr>;
            })}</tbody>
          </table>
        </div>
      ) : null}
    </div>
  );

  const renderPiInputs = () =>
    ([['kpMultiplier', 'Kp相对IMC建议值', 0.2, 3], ['tiMultiplier', 'Ti相对IMC建议值', 0.3, 3]] as const).map(([key, label, min, max]) => (
      <SimField key={key} label={label}>
        <input className="sim-hud-input" type="number" aria-label={label} min={min} max={max} step={0.1} disabled={locked} value={settings[key]}
          onChange={(event) => update({ [key]: Number(event.target.value) })} />
      </SimField>
    ));

  const numericSelects: Array<{
    key: 'loadingRatio' | 'initialSpeedMps' | 'excitationPercent' | 'filterTauS';
    label: string;
    visible: boolean;
    options: Array<{ value: number; label: string }>;
  }> = [
    { key: 'loadingRatio', label: '装载率', visible: [2, 5, 8, 9, 14].includes(seq), options: (seq === 2 ? [0.2, 0.6, 0.9] : [0.2, 0.9]).map((v) => ({ value: v, label: `${v.toFixed(1)}（${v === 0.2 ? '轻载' : v === 0.6 ? '中载' : '重载'}）` })) },
    { key: 'initialSpeedMps', label: '初始航速 / m/s', visible: seq === 6, options: [{ value: 6, label: '6 m/s（低速工作点）' }, { value: 10, label: '10 m/s（高速工作点）' }] },
    { key: 'excitationPercent', label: '轴速参考阶跃 / %', visible: [5, 6].includes(seq), options: [{ value: 5, label: '+5%' }, { value: -5, label: '-5%' }] },
    { key: 'filterTauS', label: '量测滤波 / s', visible: [16, 17, 18].includes(seq), options: [0.2, 1, 3].map((v) => ({ value: v, label: `${v} s` })) },
  ];
  const aux0 = models.find((m) => m.id === settings.modelIds[0]);
  const aux2 = models.find((m) => m.id === settings.modelIds[2]);

  return (
    <SimPanelStack>
      {seq !== 20 ? (
        <SimRunControls running={course.running} primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
          disabled={session.busy} primaryDisabled={!course.ready || course.completed || step.stepKind === 'analysis'}
          onPrimary={() => { void (course.running ? course.pause() : course.start()); }} onReset={() => { void course.reset(); }} />
      ) : null}

      {seq === 1 ? <SimNotice tone="neutral" title="静水匀速直航观测">本步参数锁定（60% 中载 · 8.0 m/s · 60 s），请直接点击「开始」观察瞬时功率与累计燃油曲线差异。</SimNotice> : null}
      {[3, 4].includes(seq) ? (
        <SimNotice tone="neutral" title={seq === 3 ? '自动 +5% 轴速小阶跃激励' : '自动 −4% 轴速减速验证阶跃'}>
          {seq === 3 ? '初始航速 8.0 m/s（60% 中载），t=30 s 自动施加 +5% 轴速阶跃，600 s 结束后前往「评估」页签冻结模型。'
            : '初始航速 8.0 m/s（60% 中载），t=30 s 自动施加 −4% 轴速阶跃，600 s 结束后前往「评估」页签以第 3 步模型执行独立对照。'}
        </SimNotice>
      ) : null}

      {numericSelects.filter((item) => item.visible).map((item) => (
        <SimField key={item.key} label={item.label}>
          <select className="sim-hud-input" aria-label={item.label} disabled={locked} value={settings[item.key]}
            onChange={(event) => update({ [item.key]: Number(event.target.value) } as Partial<ContainerCourseSettings>)}>
            {item.options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </SimField>
      ))}

      {seq === 7 ? (
        <SimPanelSection title="单模型固定 PI 设计" icon={SlidersHorizontal}>
          <div className="space-y-3">
            {distinctOpModels.length < 3 ? <SimNotice tone="warning" title="工作点模型尚不完整">还缺{missingSteps.join('、')}冻结模型，请先前往第 3/5/6 步完成辨识并冻结（当前 {distinctOpModels.length}/3 个不同工况模型）。</SimNotice> : null}
            <SimField label="主工作点模型（固定控制器基准，默认中载）">
              <select className="sim-hud-input" aria-label="调度工作点2" disabled={locked} value={settings.modelIds[1]} onChange={(event) => {
                const primaryId = event.target.value;
                const bank = completeContainerBankForPrimary(models, distinctOpModels, primaryId);
                update({ modelIds: bank ?? [settings.modelIds[0], primaryId, settings.modelIds[2]] });
                course.setDesignModelId(primaryId);
              }}>
                <option value="">选择本人冻结主模型</option>
                {models.map((m, idx) => <option key={m.id} value={m.id}>{formatContainerModelTag(m)} · 版本{idx + 1}</option>)}
              </select>
            </SimField>
            {aux0 && aux2 ? <p className="rounded-md border border-platform-fg-primary/10 bg-platform-canvas/40 px-2 py-1 text-[11px] text-platform-fg-secondary">已自动配齐辅助工作点：{formatContainerModelTag(aux0)} ｜ {formatContainerModelTag(aux2)}</p> : null}
            {renderPiInputs()}
          </div>
        </SimPanelSection>
      ) : null}

      {seq === 8 ? <BaselineReadOnlyDetails summary="沿用第 7 步固定增益与主模型" settings={settings} models={models} defaultOpen /> : null}

      {seq === 9 ? (
        <SimPanelSection title="三点工作点调度表（轻/中/重）" icon={SlidersHorizontal}>
          <div className="space-y-3">
            {renderThreePointSchedule(true)}
            {renderToggle('container-schedule', '三点线性增益调度', 'schedulingEnabled')}
            <BaselineReadOnlyDetails summary="PI 相对倍率基线" settings={settings} models={models} />
          </div>
        </SimPanelSection>
      ) : null}

      {seq === 10 ? (
        <SimPanelSection title="无扰积分切换对比" icon={SlidersHorizontal}>
          <div className="space-y-3">
            {renderToggle('container-bumpless', '无扰积分跟踪', 'bumpless')}
            <BaselineReadOnlyDetails summary="已固定的模型、Kp/Ti 与抗饱和参数" settings={settings} models={models} />
          </div>
        </SimPanelSection>
      ) : null}

      {seq === 15 ? (
        <SimPanelSection title="教学平均附加阻力">
          <div className="space-y-2">
            {renderToggle('container-mean-resistance', '启用教学平均附加阻力', 'meanWaveResistanceEnabled')}
            <p className="text-xs leading-5 text-platform-fg-secondary">短波反射教学近似参考范围为航速 6–12 m/s、有效波高不超过 1.5 m、谱峰波长不超过半船长；标称值的 0.5–1.5 倍为假设敏感性范围。</p>
          </div>
        </SimPanelSection>
      ) : null}

      {[17, 18].includes(seq) ? (
        <SimPanelSection title="本人航速控制方案" icon={SlidersHorizontal}>
          <div className="space-y-3">
            {seq === 18 ? (
              <div className="space-y-2">
                <SimField label="已冻结的综合方案（第 17 步基准）">
                  <select className="sim-hud-input" aria-label="引用综合航次方案" disabled={locked} value={selectedStep17Id}
                    onChange={(event) => applyFrozenRun(event.target.value, setSelectedStep17Id)}>
                    <option value="">选择第 17 步方案</option>
                    {step17Runs.map((run) => <option key={run.id} value={run.id}>第17步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>)}
                  </select>
                </SimField>
                {baselineRun17 ? <Step18DiffBanner baselineEtaS={baselineRun17.lastTimeS} changedDims={changedDims18} />
                  : <SimNotice tone="warning">请先完成第 17 步综合航次，再导入基线形成单维对比方案。</SimNotice>}
              </div>
            ) : null}
            {renderThreePointSchedule()}{renderPiInputs()}
            {renderToggle('container-schedule', '三点线性增益调度', 'schedulingEnabled')}
            {renderToggle('container-bumpless', '无扰积分跟踪', 'bumpless')}
            {renderToggle('container-aw', '积分抗饱和回算', 'antiWindup')}
          </div>
        </SimPanelSection>
      ) : null}

      {seq === 19 ? (
        <SimPanelSection title="未知工况盲测设置" icon={SlidersHorizontal}>
          <div className="space-y-3">
            <SimField label="未见工况">
              <select className="sim-hud-input" aria-label="未见工况" disabled={locked} value={settings.validationSeed}
                onChange={(event) => update({ validationSeed: Number(event.target.value) as 17 | 29 })}>
                <option value={17}>0.35 轻载盲测</option><option value={29}>0.80 重载盲测</option>
              </select>
            </SimField>
            <SimField label="已冻结的综合方案（第 17/18 步）">
              <select className="sim-hud-input" aria-label="引用综合航次方案" disabled={locked} value={selectedBlindSchemeId}
                onChange={(event) => applyFrozenRun(event.target.value, setSelectedBlindSchemeId)}>
                <option value="">选择第 17/18 步冻结方案</option>
                {frozen17Or18Runs.map((run) => <option key={run.id} value={run.id}>第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>)}
              </select>
            </SimField>
            {blindSchemeLocked
              ? <BaselineReadOnlyDetails summary="已锁定冻结方案全部控制与航速参数" settings={settings} models={models} includeVoyage defaultOpen />
              : <SimNotice tone="warning">请先完成第 17 或第 18 步并在此选定冻结方案，选中后将自动只读锁定全套参数。</SimNotice>}
          </div>
        </SimPanelSection>
      ) : null}

      {step.voyageTask ? (
        <SimPanelSection title="6000m四段航次" icon={Navigation}>
          <div className="space-y-2.5">
            {seq === 11 ? (
              <div className="flex items-center justify-between rounded-md border border-platform-fg-primary/15 bg-platform-canvas/40 px-2.5 py-2 text-xs">
                <span className="text-platform-fg-secondary">四段航速计划</span>
                <span className="font-mono font-semibold text-platform-fg-primary">8.0 / 8.0 / 8.0 / 8.0 m/s（锁定）</span>
              </div>
            ) : null}
            {[12, 17, 18].includes(seq) ? settings.segmentSpeedsMps.map((speed, index) => (
              <SimField key={index} label={`第${index + 1}段航速 / m/s`}>
                <input className="sim-hud-input" type="number" aria-label={`第${index + 1}段航速`} min={6} max={12} step={0.2}
                  disabled={locked} value={speed} onChange={(event) => {
                    const speeds: ContainerCourseSettings['segmentSpeedsMps'] = [...settings.segmentSpeedsMps];
                    speeds[index] = Number(event.target.value);
                    update({ segmentSpeedsMps: speeds });
                  }} />
              </SimField>
            )) : null}
            {seq === 13 ? (
              <SimField label="航速反馈">
                <select className="sim-hud-input" aria-label="航速反馈" disabled={locked} value={settings.feedback}
                  onChange={(event) => update({ feedback: event.target.value as 'water' | 'ground' })}>
                  <option value="water">对水计程仪</option><option value="ground">低频对地航速估计</option>
                </select>
              </SimField>
            ) : null}
            {[13, 16, 17, 18].includes(seq) ? (
              <SimField label="LOS前视距离 / m">
                <input className="sim-hud-input" type="number" aria-label="LOS前视距离" min={200} max={800} step={50} disabled={locked}
                  value={settings.losLookaheadM} onChange={(event) => update({ losLookaheadM: Number(event.target.value) })} />
              </SimField>
            ) : null}
            {[11, 12, 13, 14, 15, 16].includes(seq) ? (
              <BaselineReadOnlyDetails summary="已固定的控制与航次基线参数" settings={settings} models={models} includeVoyage={seq >= 13} />
            ) : null}
            <p className="text-xs leading-5 text-platform-fg-secondary">每段 1500 m，参考斜率上限 0.05 m/s²。实际到达时限 900 s，运行最长 1200 s，燃油比较须核对末速 8±0.3 m/s 与横偏。</p>
            <ContainerVoyageTradeoff timeS={timeS} positionX={liveFrame?.truth.position_ned[0] ?? 0}
              speedMps={liveFrame?.waterVelocityBody[0] ?? settings.segmentSpeedsMps[0] ?? 8} powerW={livePowerW}
              fuelKg={liveFrame?.teachingFuel?.state.fuel_kg ?? 0}
              rudderDeg={((liveFrame?.truth.actuator_states.control_surface_angles_rad[0] ?? 0) * 180) / Math.PI}
              voyage={liveFrame?.containerVoyage} compact />
          </div>
        </SimPanelSection>
      ) : null}

      {[7, 11].includes(seq) ? (
        <div className="space-y-2">
          <Button size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={locked || !course.ready || !course.designModelId}
            onClick={() => { void course.freezePrediction(); }}>冻结理想速度与航次预测</Button>
          {forecast ? (
            <>
              <ModelComparisonCurve comparison={forecast} />
              {step.voyageTask ? (
                <p className="text-xs leading-5 text-platform-fg-secondary">
                  理想到达时间 {forecast.metrics.ideal_arrival_s == null ? '窗口内未到达' : `${forecast.metrics.ideal_arrival_s.toFixed(1)}s`}，
                  理想燃油 {forecast.metrics.ideal_fuel_kg == null ? '缺少工作点' : `${forecast.metrics.ideal_fuel_kg.toFixed(1)}kg`}。
                  采用固定工作点速度立方近似与教学发动机曲线，实际燃油由轴功率积分。
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {seq === 20 ? (
        <SimPanelSection title="报告引用的本人运行" icon={Gauge}
          aside={<SimChip tone={course.reportRunIds.length >= 5 ? 'success' : 'warning'}>已选 {course.reportRunIds.length} 次</SimChip>}>
          {completedRuns.length === 0 ? (
            <p className="text-xs text-platform-fg-secondary">尚无已完成的本人运行记录，请先完成前序步骤仿真运行。</p>
          ) : (
            <div className="space-y-1.5">
              {completedRuns.map((run) => (
                <label key={run.id} className="flex items-center gap-2 text-xs text-platform-fg-secondary">
                  <input type="checkbox" checked={course.reportRunIds.includes(run.id)} onChange={(event) =>
                    course.setReportRunIds((prev) => event.target.checked ? [...prev, run.id] : prev.filter((id) => id !== run.id))} />
                  第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
                </label>
              ))}
            </div>
          )}
        </SimPanelSection>
      ) : null}
    </SimPanelStack>
  );
}
