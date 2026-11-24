'use client';

import { useEffect, useMemo, useState } from 'react';
import { Gauge, Navigation, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import {
  SimChip, SimField, SimLockedChip, SimMeter, SimNotice, SimPanelSection, SimPanelStack,
  SimReadout, SimReadoutGrid, SimRunControls, SimSwitchInput, SimToggleRow,
} from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import { DRILLING_COURSE_STEPS, type DrillingCourseSettings } from './drilling-course';
import { DRILLING_RUN_DURATIONS_S } from './drilling-evidence';

interface CapacityResult {
  windSpeedMps: number;
  powerBudgetW: number;
  withinNominalStaticCapacity: boolean;
  allocation: { predictedPowerW: number; normalizedResidual: number };
}

const THRUSTER_LABELS = [
  'T1（艉左 · -45m, -30m）', 'T2（艉右 · -45m, +30m）', 'T3（中艉左 · -30m, -35m）', 'T4（中艉右 · -30m, +35m）',
  'T5（艏左 · +45m, -30m）', 'T6（艏右 · +45m, +30m）', 'T7（中艏左 · +30m, -35m）', 'T8（中艏右 · +30m, +35m）',
];
const LOSS_LABELS: Record<DrillingCourseSettings['navigationLossStrategy'], string> = {
  predict: '继续模型预测', freeze_integral: '继续预测并冻结积分', safe_exit: '退出定位并降低出力',
};
const SINGLE_FACTOR_EXCLUDE: Record<number, string[]> = {
  6: ['bandwidthRadS'], 7: ['decoupling'], 8: ['integralEnabled'],
  9: ['windFeedforward'], 12: ['feedback'], 13: ['allocation'], 14: [], 15: [], 17: [],
};

const isCompleteRun = (run: VesselRunSummary) => {
  const required = DRILLING_RUN_DURATIONS_S[run.stepSequence - 1] ?? Number.POSITIVE_INFINITY;
  return run.stoppedAtMs !== null && run.stopReason !== 'failure' && run.lastTimeS + 1e-7 >= required;
};

function resolvePowerBudgetMw(run: VesselRunSummary): 8 | 16 | 32 {
  const fromSettings = run.courseSettings?.powerBudgetMw;
  if (fromSettings === 8 || fromSettings === 16 || fromSettings === 32) return fromSettings;
  const fromConfig = typeof run.configuration?.propulsionPowerBudgetW === 'number'
    ? Math.round(run.configuration.propulsionPowerBudgetW / 1e6) : 32;
  return fromConfig === 8 || fromConfig === 16 || fromConfig === 32 ? fromConfig : 32;
}

function schemeSignature(designModelId: string, settings: Partial<DrillingCourseSettings> | Record<string, unknown>): string {
  const copy = { ...settings };
  delete copy.validationSeed;
  return JSON.stringify([designModelId || '', copy]);
}

function SelectControl({ label, ariaLabel, value, disabled, options, onChange }: {
  label: string; ariaLabel?: string; value: string | number; disabled: boolean;
  options: Array<{ value: string | number; label: string | number }>; onChange: (value: string) => void;
}) {
  return (
    <SimField label={label}>
      <select className="sim-hud-input" aria-label={ariaLabel ?? label} disabled={disabled}
        value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {options.map((item) => <option key={String(item.value)} value={String(item.value)}>{item.label}</option>)}
      </select>
    </SimField>
  );
}

function ToggleControl({ id, label, checked, disabled, onToggle }: {
  id: string; label: string; checked: boolean; disabled: boolean; onToggle: () => void;
}) {
  return (
    <SimToggleRow label={label} htmlFor={id}
      control={<SimSwitchInput id={id} checked={checked} disabled={disabled} onChange={onToggle} />} />
  );
}

function BaselineSnapshotGrid({ settings, designModelId, excludeKeys = [], showAllocationExtras = false }: {
  settings: DrillingCourseSettings; designModelId: string; excludeKeys?: string[]; showAllocationExtras?: boolean;
}) {
  const excluded = new Set(excludeKeys);
  const rows: Array<[string, string, string | number, string?]> = [
    ['bandwidthRadS', '闭环带宽', settings.bandwidthRadS, 'rad/s'],
    ['decoupling', '模型解耦', settings.decoupling ? (designModelId ? '开启（已绑模型）' : '开启（待选模型）') : '关闭'],
    ['integralEnabled', '积分控制', settings.integralEnabled ? `开启（${settings.integralTimeS} s）` : '关闭'],
    ['windFeedforward', '测量风前馈', settings.windFeedforward ? '开启' : '关闭'],
    ['feedback', '位置反馈', settings.feedback === 'raw' ? '原始量测' : `低频观测（${settings.lowFrequencyCutoffHz} Hz）`],
    ['allocation', '分配方法', settings.allocation === 'pseudoinverse' ? '加权伪逆' : '顺序凸约束'],
  ];
  return (
    <SimReadoutGrid columns={2}>
      {rows.filter(([key]) => !excluded.has(key)).map(([key, label, value, unit]) => (
        <SimReadout key={key} label={label} value={value} unit={unit} />
      ))}
      {showAllocationExtras ? (
        <>
          <SimReadout label="电力预算" value={settings.powerBudgetMw} unit="MW" />
          <SimReadout label="三轴与节能权重" value={`${settings.axisWeights.join(':')} / ${settings.energyWeight}`} />
          <SimReadout label="失效重分配" value={settings.reallocate ? '开启' : '关闭'} />
          <SimReadout label="缺测策略" value={LOSS_LABELS[settings.navigationLossStrategy]} />
        </>
      ) : null}
    </SimReadoutGrid>
  );
}

function FoldedBaselineDetails(props: {
  settings: DrillingCourseSettings; designModelId: string; excludeKeys: string[]; showAllocationExtras?: boolean;
}) {
  return (
    <details className="sim-panel-section" data-drilling-baseline-summary>
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 text-xs font-semibold text-platform-fg-primary">
        <span>已固定前序基线参数（只读）</span>
        <SimLockedChip locked />
      </summary>
      <div className="mt-2.5"><BaselineSnapshotGrid {...props} /></div>
    </details>
  );
}

function Step3AxisProgress({ runs }: { runs: VesselRunSummary[] }) {
  const step3Runs = runs.filter((run) => run.stepSequence === 3 && isCompleteRun(run));
  const axes = [
    ['纯纵向', step3Runs.some((run) => run.courseSettings?.excitationAxis === 'x')],
    ['纯横向', step3Runs.some((run) => run.courseSettings?.excitationAxis === 'y')],
    ['纯艏摇', step3Runs.some((run) => run.courseSettings?.excitationAxis === 'yaw')],
  ] as const;
  const doneCount = axes.filter(([, done]) => done).length;
  return (
    <div className="sim-hud-tile space-y-2 p-2.5" data-drilling-step3-progress>
      <SimMeter value={doneCount / 3} tone={doneCount === 3 ? 'success' : 'accent'}
        label="三轴组合激励已完成" valueLabel={`${doneCount}/3`} scale={['0', '1', '2', '3 轴']} />
      <div className="flex flex-wrap gap-1.5">
        {axes.map(([label, done]) => <SimChip key={label} tone={done ? 'success' : 'warning'}>{label}：{done ? '已完成' : '待运行'}</SimChip>)}
      </div>
      <p className="text-xs leading-5 text-platform-fg-secondary">
        {doneCount === 3 ? '三轴 300 秒激励已全部完成，请前往第 4 步「评估」页签冻结三通道模型。' : '请依次切换纯纵向、纯横向与纯艏摇各运行一次 300 秒，齐备后前往第 4 步冻结三通道模型。'}
      </p>
    </div>
  );
}

function CapacitySection({ capacity, capacityError, disabled, onCompute }: {
  capacity: CapacityResult[]; capacityError: string; disabled: boolean; onCompute: () => void;
}) {
  return (
    <SimPanelSection title="静态能力预测" icon={Gauge}>
      <div className="space-y-2.5">
        <Button className={simulationUi.buttonOutline} size="sm" disabled={disabled} onClick={onCompute}>计算并保存十五组能力预测</Button>
        {capacity.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {([32, 16, 8] as const).map((budget) => {
                const ok = capacity.filter((r) => Math.round(r.powerBudgetW / 1e6) === budget && r.withinNominalStaticCapacity);
                const maxW = ok.length > 0 ? Math.max(...ok.map((r) => r.windSpeedMps)) : 0;
                return <SimChip key={budget} tone={maxW >= 30 ? 'success' : 'warning'}>{budget}MW 静态上限：{maxW}m/s</SimChip>;
              })}
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left tabular-nums">
                <thead><tr><th>风速</th><th>预算</th><th>预测出力</th><th>残差</th><th>判定</th></tr></thead>
                <tbody>{capacity.map((row) => (
                  <tr key={`${row.windSpeedMps}-${row.powerBudgetW}`}>
                    <td>{row.windSpeedMps}m/s</td><td>{row.powerBudgetW / 1e6}MW</td>
                    <td>{(row.allocation.predictedPowerW / 1e6).toFixed(2)}MW</td>
                    <td>{row.allocation.normalizedResidual.toFixed(4)}</td><td>{row.withinNominalStaticCapacity ? '可行' : '超限'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        ) : null}
        {capacityError ? <p role="status" className="text-xs text-platform-fg-secondary">{capacityError}</p> : null}
      </div>
    </SimPanelSection>
  );
}

export function DrillingCourseControls({ session, timeS }: {
  session: VesselExperimentController<DrillingCourseSettings>; timeS: number;
}) {
  const [capacity, setCapacity] = useState<CapacityResult[]>([]);
  const [capacityError, setCapacityError] = useState('');
  const course = session.course;
  const sequence = session.activeSeq;
  const settings = course?.settings;
  const runs = useMemo(() => course?.runs ?? [], [course?.runs]);

  const completeRuns = useMemo(() => runs.filter(isCompleteRun).sort((a, b) => b.createdAtMs - a.createdAtMs), [runs]);
  const latestStep10Run = useMemo(() => completeRuns.find((run) => run.stepSequence === 10), [completeRuns]);
  const schemeRuns = useMemo(() => completeRuns.filter((run) => run.stepSequence === 16 || run.stepSequence === 17), [completeRuns]);
  const matchedSchemeRun = useMemo(() => {
    if (!course || !settings || sequence !== 19) return undefined;
    const currentSig = schemeSignature(course.designModelId, settings);
    return schemeRuns.find((run) => run.courseSettings
      && schemeSignature(run.designStudentModelId ?? '', { ...run.courseSettings, powerBudgetMw: resolvePowerBudgetMw(run) }) === currentSig);
  }, [course, schemeRuns, sequence, settings]);

  useEffect(() => {
    if (!course || !settings || sequence !== 11 || course.running || timeS > 0 || !latestStep10Run?.courseSettings) return;
    const nextSettings = latestStep10Run.courseSettings as unknown as DrillingCourseSettings;
    const nextModelId = latestStep10Run.designStudentModelId ?? '';
    if (schemeSignature(course.designModelId, settings) !== schemeSignature(nextModelId, nextSettings)) {
      course.setSettings({ ...nextSettings });
      course.setDesignModelId(nextModelId);
    }
  }, [course, latestStep10Run, sequence, settings, timeS]);

  useEffect(() => {
    if (!course || !settings || sequence !== 19 || course.running || timeS > 0 || matchedSchemeRun) return;
    const fallback = schemeRuns[0];
    if (!fallback?.courseSettings) return;
    const sourceSettings = fallback.courseSettings as unknown as DrillingCourseSettings;
    course.setSettings((prev) => ({ ...sourceSettings, powerBudgetMw: resolvePowerBudgetMw(fallback), validationSeed: prev.validationSeed }));
    course.setDesignModelId(fallback.designStudentModelId ?? '');
  }, [course, matchedSchemeRun, schemeRuns, sequence, settings, timeS]);

  if (!course || !settings) return null;

  if (sequence === 20) {
    const finishedRuns = runs.filter((run) => run.stoppedAtMs !== null);
    return (
      <SimPanelStack>
        <SimPanelSection title="报告引用的本人运行" icon={Gauge}>
          {finishedRuns.length === 0 ? <p className="text-xs text-platform-fg-secondary">暂无已保存运行，请先完成前序步骤完整运行。</p>
            : finishedRuns.map((run) => (
              <label key={run.id} className="flex items-center gap-2 text-xs text-platform-fg-secondary">
                <input type="checkbox" checked={course.reportRunIds.includes(run.id)}
                  onChange={(e) => course.setReportRunIds((prev) => e.target.checked ? [...prev, run.id] : prev.filter((id) => id !== run.id))} />
                第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
              </label>
            ))}
        </SimPanelSection>
      </SimPanelStack>
    );
  }

  const locked = session.busy || course.running || timeS > 0;
  const update = (patch: Partial<DrillingCourseSettings>) => course.setSettings((prev) => ({ ...prev, ...patch }));
  const models = course.models.filter((m) => m.channel === 'dp-low-frequency' && m.payload.structure.kind === 'dp_low_freq3');

  function computeCapacity() {
    try {
      const rows = [32, 16, 8].flatMap((budget) => [8, 12, 18, 24, 30].map((wind) =>
        computeVirtualSimulationStep<CapacityResult>({
          modelId: 'student_model_analysis', operation: 'dp_capacity', powerBudgetW: budget * 1e6, windSpeedMps: wind, windFromDeg: 45,
        })));
      setCapacity(rows);
      setCapacityError('');
      const limits = ([32, 16, 8] as const).map((b) => {
        const ok = rows.filter((r) => Math.round(r.powerBudgetW / 1e6) === b && r.withinNominalStaticCapacity);
        return `${b}MW→${ok.length ? Math.max(...ok.map((r) => r.windSpeedMps)) : 0}m/s`;
      });
      session.setReading('capacity', `静态可行风速上限：${limits.join('，')}。\n`
        + rows.map((r) => `风速${r.windSpeedMps}m/s，可用${r.powerBudgetW / 1e6}MW，预计正机械功率${(r.allocation.predictedPowerW / 1e6).toFixed(3)}MW，归一化残差${r.allocation.normalizedResidual.toFixed(5)}，${r.withinNominalStaticCapacity ? '处于本次静态能力范围' : '静态能力不足'}。`).join('\n')
        + '\n静态计算采用公开教学风投影、零流速和方位对齐，动态故障、阵风和波浪通过本人实际运行验证。');
    } catch (error) { setCapacityError(error instanceof Error ? error.message : '能力计算尚未完成。'); }
  }

  const bandwidthEl = <SelectControl label="定位闭环带宽 / rad/s" value={settings.bandwidthRadS} disabled={locked}
    options={[0.015, 0.025, 0.04].map((v) => ({ value: v, label: v }))} onChange={(v) => update({ bandwidthRadS: Number(v) as DrillingCourseSettings['bandwidthRadS'] })} />;
  const decouplingEl = (
    <>
      <ToggleControl id="dp-decoupling" label="启用本人模型交叉通道补偿" checked={settings.decoupling} disabled={locked} onToggle={() => update({ decoupling: !settings.decoupling })} />
      {sequence >= 7 && settings.decoupling ? (
        <div className="space-y-2">
          <SelectControl label="本人三通道模型" ariaLabel="定位所用本人模型" value={course.designModelId} disabled={locked}
            options={[{ value: '', label: '选择本人冻结模型' }, ...models.map((m, i) => ({ value: m.id, label: `三通道低频模型 · 版本${i + 1}` }))]}
            onChange={(v) => course.setDesignModelId(v)} />
          {models.length === 0 ? <SimNotice tone="warning">尚未冻结本人三通道模型，请先在第 4 步「评估」页签冻结后再开启解耦补偿。</SimNotice> : null}
        </div>
      ) : null}
    </>
  );
  const integralEl = (
    <>
      <ToggleControl id="dp-integralEnabled" label="启用积分与抗饱和" checked={settings.integralEnabled} disabled={locked} onToggle={() => update({ integralEnabled: !settings.integralEnabled })} />
      {settings.integralEnabled ? <SelectControl label="积分时间 / s" value={settings.integralTimeS} disabled={locked}
        options={[100, 200, 400].map((v) => ({ value: v, label: v }))} onChange={(v) => update({ integralTimeS: Number(v) as DrillingCourseSettings['integralTimeS'] })} /> : null}
    </>
  );
  const feedbackEl = (
    <>
      <SelectControl label="位置反馈" value={settings.feedback} disabled={locked}
        options={[{ value: 'raw', label: '原始量测' }, { value: 'low_frequency', label: '低频观测器' }]}
        onChange={(v) => update({ feedback: v as DrillingCourseSettings['feedback'] })} />
      {settings.feedback !== 'raw' ? <SelectControl label="低频观测带宽 / Hz" value={settings.lowFrequencyCutoffHz} disabled={locked}
        options={[0.02, 0.04, 0.08].map((v) => ({ value: v, label: v }))} onChange={(v) => update({ lowFrequencyCutoffHz: Number(v) as DrillingCourseSettings['lowFrequencyCutoffHz'] })} /> : null}
    </>
  );
  const allocationEl = <SelectControl label="推进器分配方法" value={settings.allocation} disabled={locked}
    options={[{ value: 'pseudoinverse', label: '无约束加权伪逆' }, { value: 'sequential_convex', label: '顺序凸约束分配' }]}
    onChange={(v) => update({ allocation: v as DrillingCourseSettings['allocation'] })} />;
  const powerEl = <SelectControl label="可用推进功率 / MW" value={settings.powerBudgetMw} disabled={locked}
    options={[32, 16, 8].map((v) => ({ value: v, label: v }))} onChange={(v) => update({ powerBudgetMw: Number(v) as DrillingCourseSettings['powerBudgetMw'] })} />;
  const windFfEl = <ToggleControl id="dp-windFeedforward" label="启用测量风前馈" checked={settings.windFeedforward} disabled={locked} onToggle={() => update({ windFeedforward: !settings.windFeedforward })} />;
  const reallocateEl = <ToggleControl id="dp-reallocate" label="失效后重新分配" checked={settings.reallocate} disabled={locked} onToggle={() => update({ reallocate: !settings.reallocate })} />;

  const singleFactorEl: Record<number, React.ReactNode> = {
    6: bandwidthEl, 7: decouplingEl, 8: integralEl, 9: windFfEl, 12: feedbackEl, 13: allocationEl, 15: reallocateEl,
    14: <SelectControl label="参考位置斜坡 / s" value={settings.referenceRampS} disabled={locked} options={[30, 90, 180].map((v) => ({ value: v, label: v }))}
      onChange={(v) => update({ referenceRampS: Number(v) as DrillingCourseSettings['referenceRampS'] })} />,
    17: <SelectControl label="定位缺测策略" value={settings.navigationLossStrategy} disabled={locked}
      options={Object.entries(LOSS_LABELS).map(([value, label]) => ({ value, label }))}
      onChange={(v) => update({ navigationLossStrategy: v as DrillingCourseSettings['navigationLossStrategy'] })} />,
  };

  return (
    <SimPanelStack>
      {sequence === 3 ? <Step3AxisProgress runs={runs} /> : null}
      <SimRunControls running={course.running} primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
        disabled={session.busy}
        primaryDisabled={!course.ready || course.completed || DRILLING_COURSE_STEPS[sequence - 1].stepKind === 'analysis' || (sequence === 11 && !latestStep10Run)}
        onPrimary={() => { void (course.running ? course.pause() : course.start()); }}
        onReset={() => { void course.reset(); }} />

      {sequence === 1 ? <SimNotice tone="neutral">本步为 120 秒平静海况零激励基线观察，无需调节控制参数；请先完成上方通道预测，再开始运行并查看左侧八台推进器与六自由度读数。</SimNotice> : null}
      {sequence === 2 ? (
        <SimPanelSection title="单台推进器力矩臂激励" icon={SlidersHorizontal}>
          <SelectControl label="单台推进器" value={settings.thrusterIndex} disabled={locked}
            options={THRUSTER_LABELS.map((label, value) => ({ value, label }))} onChange={(v) => update({ thrusterIndex: Number(v) })} />
        </SimPanelSection>
      ) : null}
      {sequence === 3 ? (
        <SimPanelSection title="组合激励方向" icon={SlidersHorizontal}>
          <SelectControl label="组合激励方向" value={settings.excitationAxis} disabled={locked}
            options={[{ value: 'x', label: '纯纵向' }, { value: 'y', label: '纯横向' }, { value: 'yaw', label: '纯艏摇' }]}
            onChange={(v) => update({ excitationAxis: v as DrillingCourseSettings['excitationAxis'] })} />
        </SimPanelSection>
      ) : null}
      {sequence === 4 ? (
        <SimPanelSection title="离线三通道模型辨识" icon={SlidersHorizontal}
          aside={<SimChip tone={models.length > 0 ? 'success' : 'accent'}>已冻结 {models.length} 个</SimChip>}>
          <SimNotice tone="accent">本步为纯离线分析步（无需运行新仿真）：请先在上方完成预测选答，再前往右侧「评估」页签选入第 3 步三轴激励运行并冻结本人三通道模型。</SimNotice>
        </SimPanelSection>
      ) : null}
      {sequence === 5 ? (
        <SimPanelSection title="独立验证基线工况" icon={SlidersHorizontal} aside={<SimLockedChip locked />}>
          <SimReadoutGrid columns={2}>
            <SimReadout label="目标阶跃" value="(2, −2) m / 0°" /><SimReadout label="闭环带宽" value={settings.bandwidthRadS} unit="rad/s" />
            <SimReadout label="模型解耦" value="关闭" /><SimReadout label="已冻结模型" value={models.length} unit="个" />
          </SimReadoutGrid>
          <p className="mt-2 text-xs leading-5 text-platform-fg-secondary">本步无需调整控制参数；运行结束后前往「评估」页签保存三通道独立对照，并与上方预测手绘比对。</p>
        </SimPanelSection>
      ) : null}
      {sequence in SINGLE_FACTOR_EXCLUDE ? (
        <>
          <SimPanelSection title="本步单因素控制变量" icon={SlidersHorizontal}><div className="space-y-3">{singleFactorEl[sequence]}</div></SimPanelSection>
          <FoldedBaselineDetails settings={settings} designModelId={course.designModelId}
            excludeKeys={SINGLE_FACTOR_EXCLUDE[sequence]} showAllocationExtras={sequence >= 15} />
        </>
      ) : null}
      {sequence === 10 ? (
        <SimPanelSection title="第 10 步基准控制器方案" icon={SlidersHorizontal}>
          <div className="space-y-3">
            {bandwidthEl}{decouplingEl}{integralEl}{windFfEl}{feedbackEl}{allocationEl}
            <p className="text-xs leading-5 text-platform-fg-secondary">本步所选控制器参数将作为第 11 步识别二阶慢漂的锁定基线。</p>
          </div>
        </SimPanelSection>
      ) : null}
      {sequence === 11 ? (
        <SimPanelSection title="第 10 步基线控制器（已锁定）" icon={SlidersHorizontal} aside={<SimLockedChip locked />}>
          <div className="space-y-2.5">
            {!latestStep10Run ? <SimNotice tone="warning">请先完成第 10 步运行以同步基线控制器</SimNotice>
              : <SimNotice tone="success">已自动同步第 10 步最新完整运行的控制器方案并全程锁定，本步仅开启二阶差频慢漂载荷。</SimNotice>}
            <BaselineSnapshotGrid settings={settings} designModelId={course.designModelId} />
          </div>
        </SimPanelSection>
      ) : null}
      {sequence === 16 ? (
        <>
          <SimPanelSection title="本人已冻结方案" icon={Navigation}>
            <SelectControl label="引用此前完整运行" ariaLabel="引用本人定位方案" value="" disabled={locked}
              options={[{ value: '', label: '选择第 15 步基线方案' }, ...runs.filter((r) => r.stoppedAtMs !== null && r.stepSequence === 15)
                .map((r) => ({ value: r.id, label: `第${r.stepSequence}步 · ${new Date(r.createdAtMs).toLocaleTimeString('zh-CN')}` }))]}
              onChange={(id) => {
                const src = runs.find((r) => r.id === id);
                if (!src?.courseSettings) return;
                course.setSettings((prev) => ({ ...(src.courseSettings as unknown as DrillingCourseSettings),
                  powerBudgetMw: prev.powerBudgetMw, axisWeights: prev.axisWeights, energyWeight: prev.energyWeight }));
                course.setDesignModelId(src.designStudentModelId ?? '');
              }} />
          </SimPanelSection>
          <SimPanelSection title="故障恢复权重与电力预算" icon={SlidersHorizontal}>
            <div className="space-y-3">
              {powerEl}
              <div className="grid grid-cols-3 gap-2">
                {(['纵向', '横向', '航向'] as const).map((label, index) => (
                  <SelectControl key={label} label={`${label}权重`} ariaLabel={`${label}任务权重`} value={settings.axisWeights[index]} disabled={locked}
                    options={[0.5, 1, 2].map((v) => ({ value: v, label: v }))}
                    onChange={(v) => update({ axisWeights: settings.axisWeights.map((val, ax) => ax === index ? Number(v) : val) as [number, number, number] })} />
                ))}
              </div>
              <SelectControl label="节能权重" value={settings.energyWeight} disabled={locked} options={[0.5, 1, 2].map((v) => ({ value: v, label: v }))}
                onChange={(v) => update({ energyWeight: Number(v) })} />
              {reallocateEl}
            </div>
          </SimPanelSection>
          <FoldedBaselineDetails settings={settings} designModelId={course.designModelId} excludeKeys={[]} />
        </>
      ) : null}
      {sequence === 18 ? (
        <>
          <CapacitySection capacity={capacity} capacityError={capacityError} disabled={locked || !course.ready} onCompute={computeCapacity} />
          <SimPanelSection title="实测验证风速与电力预算" icon={SlidersHorizontal}>
            <div className="space-y-3">
              {powerEl}
              <SelectControl label="验证风速 / m/s" value={settings.windSpeedMps} disabled={locked}
                options={[8, 12, 18, 24, 30].map((v) => ({ value: v, label: v }))}
                onChange={(v) => update({ windSpeedMps: Number(v) as DrillingCourseSettings['windSpeedMps'] })} />
            </div>
          </SimPanelSection>
          <FoldedBaselineDetails settings={settings} designModelId={course.designModelId} excludeKeys={[]} />
        </>
      ) : null}
      {sequence === 19 ? (
        <>
          <SimPanelSection title="本人已冻结方案（第 16/17 步）" icon={Navigation} aside={<SimLockedChip locked />}>
            <div className="space-y-3">
              <SelectControl label="引用此前完整运行" ariaLabel="引用本人定位方案" value={matchedSchemeRun?.id ?? ''} disabled={locked}
                options={[{ value: '', label: '选择本人第 16 或 17 步方案' }, ...schemeRuns.map((run) => ({
                  value: run.id, label: `第${run.stepSequence}步 · ${resolvePowerBudgetMw(run)}MW · ${new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}`,
                }))]}
                onChange={(id) => {
                  const src = schemeRuns.find((run) => run.id === id);
                  if (!src?.courseSettings) return;
                  course.setSettings((prev) => ({ ...(src.courseSettings as unknown as DrillingCourseSettings),
                    powerBudgetMw: resolvePowerBudgetMw(src), validationSeed: prev.validationSeed }));
                  course.setDesignModelId(src.designStudentModelId ?? '');
                }} />
              {schemeRuns.length === 0 ? <SimNotice tone="warning">未检测到第 16 或第 17 步完整运行，请先完成前序方案设计后再进行未见工况验证。</SimNotice> : null}
              <BaselineSnapshotGrid settings={settings} designModelId={course.designModelId} showAllocationExtras />
            </div>
          </SimPanelSection>
          <SimPanelSection title="未见海况验证样本" icon={SlidersHorizontal}>
            <SelectControl label="验证样本" value={settings.validationSeed} disabled={locked}
              options={[{ value: 17, label: '验证样本一' }, { value: 29, label: '验证样本二' }]}
              onChange={(v) => update({ validationSeed: Number(v) as DrillingCourseSettings['validationSeed'] })} />
          </SimPanelSection>
        </>
      ) : null}
    </SimPanelStack>
  );
}
