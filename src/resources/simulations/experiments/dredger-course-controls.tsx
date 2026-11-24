'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Anchor, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SimChip, SimField, SimLockedChip, SimNotice, SimPanelSection, SimPanelStack,
  SimRunControls, SimSwitchInput, SimToggleRow,
} from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import { DREDGER_COURSE_STEPS, type DredgerCourseSettings } from './dredger-course';
import {
  DREDGER_INTEGRAL_POLICY_LABELS, diffDredgerStrategyFields, doesDredgerForecastMatch,
  dredgerSchemeMatchesRun, formatDredgerModelTag, isDredgerCompleteRun,
  normalizeDredgerSettings, resolveDredgerPriorStepSettings,
} from './dredger-step-specs';
import { ModelComparisonCurve } from './model-comparison-curve';
import type { FrozenVesselStudentModel } from './student-analysis';

interface NumericFieldSpec {
  key: keyof DredgerCourseSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  seqs: number[];
}

const NUMERIC_FIELDS: readonly NumericFieldSpec[] = [
  { key: 'transitRpm', label: '自航双轴参考 / rpm', min: -180, max: 180, step: 5, seqs: [2] },
  { key: 'rudderDeg', label: '手动舵角 / °', min: -35, max: 35, step: 1, seqs: [2] },
  { key: 'manualWinchMps', label: '单侧收放速度 / m/s', min: -0.05, max: 0.05, step: 0.005, seqs: [4] },
  { key: 'targetDepthM', label: '刀位包络目标深度 / m', min: 19.5, max: 20.5, step: 0.1, seqs: [7, 9, 12, 15, 16, 18] },
  { key: 'cutterRpm', label: '绞刀参考 / rpm', min: 10, max: 40, step: 5, seqs: [8, 9, 12, 15] },
  { key: 'referenceMps', label: '横移速度参考 / m/s', min: 0.03, max: 0.15, step: 0.01, seqs: [9, 11, 12, 13, 15, 18] },
  { key: 'halfAngleDeg', label: '横移半幅 / °', min: 1, max: 15, step: 1, seqs: [9, 13, 15] },
  { key: 'kpMultiplier', label: '比例增益相对本人IMC初值', min: 0.2, max: 3, step: 0.1, seqs: [10, 11, 15] },
  { key: 'tiMultiplier', label: '积分时间相对本人IMC初值', min: 0.2, max: 3, step: 0.1, seqs: [10, 11, 15] },
  { key: 'entrySpeedMps', label: '允许进入切削的船速 / m/s', min: 0.03, max: 0.1, step: 0.01, seqs: [15, 17, 18] },
  { key: 'safetyFraction', label: '提前中止阈值相对标称值', min: 0.7, max: 1, step: 0.05, seqs: [15, 17, 18] },
  { key: 'depthFilterTauS', label: '深度量测滤波 / s', min: 0.05, max: 5, step: 0.05, seqs: [7, 15, 16, 17] },
  { key: 'swayFilterTauS', label: '横移量测滤波 / s', min: 0.05, max: 5, step: 0.05, seqs: [15, 17] },
];

const STATIC_STEP_NOTICES: Record<number, { title: string; text: string }> = {
  1: { title: '静水停船受力基准', text: '本步无需调节参数（双桨零转速、未落桩、未挂缆、绞刀停转），直接点击「开始」完成 120 秒观察。' },
  3: { title: '预设倒桩与台车连锁序列', text: '系统在 60 秒请求退出，80 至 120 秒以 0.025 m/s 移动台车，140 秒重新落桩。机构只在停刀、抬刀、撤桩和低船速条件均满足后移动台车。' },
  6: { title: '反向小横移留出独立验证', text: '本步参数锁定（t=40–100 s 负向、t=160–220 s 正向差动阶跃）。运行结束后请前往「评估」页签以第 5 步冻结模型保存 A 与 B 两类对照，严禁重拟合。' },
  8: { title: '绞刀离床 0.5 m 空载实验', text: '刀位深度自动保持 19.5 m（海床上 0.5 m），仅开放绞刀参考转速。请对比轴系加速动态与零土体移除体积。' },
};

function DredgerSchemeSummary({ title, settings, model, defaultOpen = false }: {
  title: string; settings: DredgerCourseSettings; model: FrozenVesselStudentModel | undefined; defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} data-dredger-scheme-summary className="rounded-lg border border-platform-fg-primary/15 bg-platform-canvas/40 px-2.5 py-2 text-xs">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 font-medium text-platform-fg-primary">
        <span>{title}</span><SimLockedChip locked>只读锁定</SimLockedChip>
      </summary>
      <div className="mt-2 space-y-1 text-[11px] leading-5 text-platform-fg-secondary">
        <p>联合模型：{formatDredgerModelTag(model)}</p>
        <p>刀位 {settings.targetDepthM.toFixed(1)} m · 绞刀 {settings.cutterRpm} rpm · 横移 {settings.referenceMps.toFixed(2)} m/s · 半幅 {settings.halfAngleDeg}°</p>
        <p>PI 倍率：Kp {settings.kpMultiplier.toFixed(1)}× / Ti {settings.tiMultiplier.toFixed(1)}× · 换向斜坡 {settings.reversalRampS} s · 积分{DREDGER_INTEGRAL_POLICY_LABELS[settings.integralPolicy]}</p>
        <p>入切船速 {settings.entrySpeedMps.toFixed(2)} m/s · 保持 {settings.entryHoldS} s · 安全系数 {settings.safetyFraction.toFixed(2)} · 滤波 深{settings.depthFilterTauS}s / 移{settings.swayFilterTauS}s</p>
      </div>
    </details>
  );
}

function StepConditionProgress({ chips }: { chips: Array<{ label: string; done: boolean }> }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-dredger-step-progress>
      {chips.map((chip) => (
        <SimChip key={chip.label} tone={chip.done ? 'success' : 'warning'}>{chip.label}：{chip.done ? '已完成' : '待运行'}</SimChip>
      ))}
    </div>
  );
}

export function DredgerCourseControls({ session, timeS }: {
  session: VesselExperimentController<DredgerCourseSettings>;
  timeS: number;
}) {
  const course = session.course;
  const sequence = session.activeSeq;
  const settings = course?.settings;
  const tourActive = Boolean(session.tour?.active);
  const locked = Boolean(session.busy || course?.running || timeS > 0 || tourActive);

  const [selectedCalmRunId, setSelectedCalmRunId] = useState('');
  const [selectedStep17RunId, setSelectedStep17RunId] = useState('');
  const [selectedBlindRunId, setSelectedBlindRunId] = useState('');
  const autoSyncedStepRef = useRef('');

  const allModels = useMemo(() => course?.models ?? [], [course?.models]);
  const models = useMemo(() => allModels.filter((m) => m.channel === 'winch-reference-to-sway'), [allModels]);
  const actualModels = useMemo(() => allModels.filter((m) => m.channel === 'winch-speed-to-sway'), [allModels]);
  const allRuns = useMemo(() => course?.runs ?? [], [course?.runs]);
  const completedRuns = useMemo(() => allRuns.filter(isDredgerCompleteRun), [allRuns]);
  const stepRuns = useMemo(() => completedRuns.filter((r) => r.stepSequence === sequence), [completedRuns, sequence]);
  const calmRuns = useMemo(() => completedRuns.filter((r) => r.stepSequence >= 9 && r.stepSequence <= 14), [completedRuns]);
  const step17Runs = useMemo(() => completedRuns.filter((r) => r.stepSequence === 17), [completedRuns]);
  const frozen17Or18Runs = useMemo(() => completedRuns.filter((r) => r.stepSequence === 17 || r.stepSequence === 18), [completedRuns]);
  const comparisons = useMemo(() => course?.comparisons ?? [], [course?.comparisons]);

  useEffect(() => {
    setSelectedCalmRunId('');
    setSelectedStep17RunId('');
    setSelectedBlindRunId('');
  }, [sequence, course?.scopeKey]);

  useEffect(() => {
    if (!course?.ready || !settings || locked || sequence < 9 || sequence > 19 || models.length === 0) return;
    const syncKey = `${course.scopeKey ?? 'default'}:${sequence}`;
    if (autoSyncedStepRef.current === syncKey) return;
    autoSyncedStepRef.current = syncKey;
    const inherited = resolveDredgerPriorStepSettings(sequence, settings, course.designModelId ?? '', allRuns, models);
    if (!inherited) return;
    if (sequence === 15 && inherited.sourceRunId) setSelectedCalmRunId(inherited.sourceRunId);
    if (sequence === 18 && inherited.sourceRunId) setSelectedStep17RunId(inherited.sourceRunId);
    if (sequence === 19 && inherited.sourceRunId) setSelectedBlindRunId(inherited.sourceRunId);
    course.setSettings(inherited.settings);
    if (inherited.designModelId && inherited.designModelId !== course.designModelId) {
      course.setDesignModelId(inherited.designModelId);
    }
  }, [course, settings, locked, sequence, allRuns, models]);

  useEffect(() => {
    if (sequence !== 19 || !settings || !course) return;
    if (selectedBlindRunId && frozen17Or18Runs.some((r) => r.id === selectedBlindRunId)) return;
    const matched = frozen17Or18Runs.find((r) => dredgerSchemeMatchesRun(r, settings, course.designModelId ?? ''));
    if (matched) setSelectedBlindRunId(matched.id);
  }, [sequence, settings, course, selectedBlindRunId, frozen17Or18Runs]);

  if (!course || !settings) return null;
  const step = DREDGER_COURSE_STEPS[sequence - 1];
  const update = (patch: Partial<DredgerCourseSettings>) => course.setSettings((prev) => ({ ...prev, ...patch }));
  const forecast = comparisons.filter((item) => item.purpose === 'forecast' && item.runId === course.plannedRunId).at(-1);
  const forecastCurrent = doesDredgerForecastMatch(forecast, course.designModelId ?? '', settings);
  const selectedModel = models.find((m) => m.id === course.designModelId);

  if (sequence === 20) {
    const finishedRuns = allRuns.filter((run) => run.stoppedAtMs !== null);
    return (
      <SimPanelStack>
        <SimPanelSection title="报告引用的本人运行" icon={Activity} aside={<SimChip tone={course.reportRunIds.length >= 6 ? 'success' : 'warning'}>已选 {course.reportRunIds.length}/6 次</SimChip>}>
          {finishedRuns.length === 0 ? (
            <p className="text-xs text-platform-fg-secondary">尚无已完成的本人运行记录，请先完成前序关键步骤仿真运行。</p>
          ) : (
            <div className="space-y-1.5">
              {finishedRuns.map((run) => (
                <label key={run.id} className="flex items-center gap-2 text-xs text-platform-fg-secondary">
                  <input type="checkbox" checked={course.reportRunIds.includes(run.id)} onChange={(event) =>
                    course.setReportRunIds((prev) => event.target.checked ? [...prev, run.id] : prev.filter((id) => id !== run.id))} />
                  第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
                </label>
              ))}
            </div>
          )}
        </SimPanelSection>
        <SimPanelSection title="机构与适用范围" icon={Anchor}>
          <p className="text-xs leading-5 text-platform-fg-secondary">
            钢桩10秒建立有限支承，两条弹性锚缆承受拉力。桥架与绞刀的载荷参与船体运动。砂与黏土采用局部切削近似，产量累计实际新移除体积。报告采用绞刀、横移绞车和推进轴系的机械能耗口径，适用于均质土层的低速教学工况。
          </p>
        </SimPanelSection>
      </SimPanelStack>
    );
  }

  const applyImportedRun = (runId: string, onPick: (id: string) => void, keepWaves: boolean) => {
    onPick(runId);
    const source = allRuns.find((r) => r.id === runId);
    if (!source?.courseSettings) return;
    const imported = normalizeDredgerSettings(source.courseSettings, sequence);
    course.setSettings({
      ...imported,
      wavesEnabled: keepWaves ? settings.wavesEnabled : imported.wavesEnabled,
      validationSeed: settings.validationSeed,
    });
    course.setDesignModelId(source.designStudentModelId ?? '');
  };

  const step15Baseline = sequence === 15 ? [...stepRuns].sort((a, b) => a.createdAtMs - b.createdAtMs)[0] : undefined;
  const step15Diffs = step15Baseline ? diffDredgerStrategyFields(step15Baseline.courseSettings, settings) : [];
  const step15SameModel = step15Baseline ? (course.designModelId ?? '') === (step15Baseline.designStudentModelId ?? '') : true;

  const blindMatchedRun = sequence === 19
    ? frozen17Or18Runs.find((r) => r.id === selectedBlindRunId && dredgerSchemeMatchesRun(r, settings, course.designModelId ?? ''))
      ?? frozen17Or18Runs.find((r) => dredgerSchemeMatchesRun(r, settings, course.designModelId ?? ''))
    : undefined;

  const step16Existing = sequence === 16 ? stepRuns[0] : undefined;
  const step16ControllerAligned = !step16Existing || (
    (step16Existing.designStudentModelId ?? '') === (course.designModelId ?? '') &&
    step16Existing.initialInput.dredger?.depthFilterTauS === settings.depthFilterTauS &&
    step16Existing.initialInput.dredger?.commands.depthReferenceM === settings.targetDepthM
  );

  const staticNotice = STATIC_STEP_NOTICES[sequence];

  return (
    <SimPanelStack>
      <SimRunControls
        running={course.running}
        primaryLabel={course.completed ? '已结束' : course.running ? '暂停' : '开始'}
        disabled={session.busy || tourActive}
        primaryDisabled={!course.ready || course.completed || step.stepKind === 'analysis'}
        onPrimary={() => { void (course.running ? course.pause() : course.start()); }}
        onReset={() => { void course.reset(); }}
      />

      {staticNotice ? <SimNotice tone="neutral" title={staticNotice.title}>{staticNotice.text}</SimNotice> : null}

      {sequence === 5 ? (
        <div className="space-y-2">
          <SimNotice tone="neutral" title="双向差动绞车阶跃激励">
            钢桩保持下，t=40–100 s 正向差动、t=160–220 s 反向差动（±0.015 m/s）。运行 300 s 结束后前往「评估」页签基于同一次运行冻结双通道模型。
          </SimNotice>
          <StepConditionProgress chips={[
            { label: '绞车指令联合模型', done: models.some((m) => m.payload.trainingRuns.some((w) => stepRuns.some((r) => r.id === w.runRef))) },
            { label: '实际绞车速度模型', done: actualModels.some((m) => m.payload.trainingRuns.some((w) => stepRuns.some((r) => r.id === w.runRef))) },
          ]} />
        </div>
      ) : null}

      {sequence === 4 ? (
        <div className="space-y-2">
          <SimField label="单侧绞车">
            <select className="sim-hud-input" aria-label="单侧绞车" disabled={locked} value={settings.manualCable}
              onChange={(event) => update({ manualCable: event.target.value as 'port' | 'starboard' })}>
              <option value="port">左舷</option><option value="starboard">右舷</option>
            </select>
            <p className="mt-1 text-xs text-platform-fg-secondary">负速度收缆，正速度放缆。命令在 30 至 90 秒作用于所选单侧绞车。</p>
          </SimField>
          <StepConditionProgress chips={[
            { label: '左舷作用', done: stepRuns.some((r) => r.courseSettings?.manualCable === 'port') },
            { label: '右舷作用', done: stepRuns.some((r) => r.courseSettings?.manualCable === 'starboard') },
          ]} />
        </div>
      ) : null}

      {NUMERIC_FIELDS.filter((field) => field.seqs.includes(sequence)).map((field) => (
        <div key={field.key} className="space-y-1.5">
          <SimField label={field.label}>
            <input className="sim-hud-input" type="number" aria-label={field.label} min={field.min} max={field.max} step={field.step}
              disabled={locked} value={Number(settings[field.key])} onChange={(event) => update({ [field.key]: Number(event.target.value) } as Partial<DredgerCourseSettings>)} />
          </SimField>
          {sequence === 12 && field.key === 'targetDepthM' ? (
            <div className="flex flex-wrap gap-1.5">
              {([[20.3, '一键设为 20.3 m（切厚 0.3 m）'], [20.5, '一键设为 20.5 m（切厚 0.5 m）']] as const).map(([depth, btnLabel]) => {
                const active = Math.abs(settings.targetDepthM - depth) < 1e-4;
                return (
                  <Button key={depth} type="button" size="sm" variant={active ? 'default' : 'outline'}
                    className={active ? simulationUi.buttonPrimary : simulationUi.buttonOutline} disabled={locked} onClick={() => update({ targetDepthM: depth })}>
                    {btnLabel}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}

      {step.closedLoop ? (
        <SimPanelSection title="本人横移与模式方案" icon={SlidersHorizontal}>
          <div className="space-y-3">
            {models.length === 0 ? (
              <SimNotice tone="warning" title="尚未冻结联合模型">尚未冻结绞车联合模型：请先在第 5 步完成双向绞车阶跃并在评估页签同时冻结双通道模型</SimNotice>
            ) : null}

            {sequence === 15 ? (
              <div className="space-y-2">
                <SimField label="引用已冻结的静水作业方案">
                  <select className="sim-hud-input" aria-label="引用已冻结的静水作业方案" disabled={locked} value={selectedCalmRunId}
                    onChange={(event) => applyImportedRun(event.target.value, setSelectedCalmRunId, true)}>
                    <option value="">选择第 9–14 步已完成静水方案</option>
                    {calmRuns.map((run) => (
                      <option key={run.id} value={run.id}>第{run.stepSequence}步 · {run.lastTimeS.toFixed(0)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>
                    ))}
                  </select>
                </SimField>
                <SimNotice tone={step15Baseline && step15SameModel && step15Diffs.length === 1 ? 'success' : 'neutral'}>
                  {!step15Baseline ? '先用原静水方案跑风流基准，再只改一项控制策略重跑对比。'
                    : !step15SameModel ? '请保持与风流基准相同的「本人冻结的绞车联合模型」，再修改唯一一项控制策略。'
                      : step15Diffs.length === 1 ? `已相对风流基准仅修改「${step15Diffs[0].label}」(1/1 项)，请先冻结预测再开始对比运行。`
                        : step15Diffs.length === 0 ? '当前与风流基准方案一致 (0/1 项)：请仅调整 1 项控制策略完成对比运行。'
                          : `相对风流基准改动了 ${step15Diffs.length} 项（${step15Diffs.map((d) => d.label).join('、')}），请缩减至仅保留 1 项差异。`}
                </SimNotice>
              </div>
            ) : null}

            {sequence === 18 ? (
              <SimField label="引用第 17 步方案">
                <select className="sim-hud-input" aria-label="引用第 17 步方案" disabled={locked} value={selectedStep17RunId}
                  onChange={(event) => applyImportedRun(event.target.value, setSelectedStep17RunId, false)}>
                  <option value="">选择第 17 步已完成方案</option>
                  {step17Runs.map((run) => (
                    <option key={run.id} value={run.id}>第17步 · 保持 {run.initialInput.dredger?.entryHoldS ?? 10}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>
                  ))}
                </select>
              </SimField>
            ) : null}

            {sequence === 19 ? (
              <div className="space-y-2.5">
                <SimField label="引用第 17 或第 18 步综合方案">
                  <select className="sim-hud-input" aria-label="引用第 17 或第 18 步综合方案" disabled={locked} value={selectedBlindRunId}
                    onChange={(event) => applyImportedRun(event.target.value, setSelectedBlindRunId, false)}>
                    <option value="">选择第 17 或第 18 步完整方案</option>
                    {frozen17Or18Runs.map((run) => (
                      <option key={run.id} value={run.id}>第{run.stepSequence}步 · {run.lastTimeS.toFixed(0)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>
                    ))}
                  </select>
                </SimField>
                <SimField label="未见土层工况">
                  <select className="sim-hud-input" aria-label="未见土层工况" disabled={locked} value={settings.validationSeed}
                    onChange={(event) => update({ validationSeed: Number(event.target.value) as 17 | 29 })}>
                    <option value={17}>未见砂层工况甲</option><option value={29}>未见黏土工况乙</option>
                  </select>
                </SimField>
                <StepConditionProgress chips={[
                  { label: '未见砂层工况甲', done: stepRuns.some((r) => r.configuration.seed === 17) },
                  { label: '未见黏土工况乙', done: stepRuns.some((r) => r.configuration.seed === 29) },
                ]} />
                {blindMatchedRun ? (
                  <DredgerSchemeSummary title={`已锁定第 ${blindMatchedRun.stepSequence} 步综合方案（全部参数只读）`} settings={settings} model={selectedModel} defaultOpen />
                ) : (
                  <SimNotice tone="warning" title="请先引用第 17/18 步方案">请先完成第 17 或第 18 步并从上方下拉引用完整方案；为保证盲测一致验证，本步已隐藏并锁定所有方案调参输入。</SimNotice>
                )}
              </div>
            ) : (
              <SimField label="本人冻结的绞车联合模型">
                <select className="sim-hud-input" aria-label="本人冻结的绞车联合模型" disabled={locked} value={course.designModelId}
                  onChange={(event) => course.setDesignModelId(event.target.value)}>
                  <option value="">选择本人固定模式辨识结果</option>
                  {models.map((model, index) => <option key={model.id} value={model.id}>{formatDredgerModelTag(model)} · 版本{index + 1}</option>)}
                </select>
              </SimField>
            )}

            {sequence === 10 ? (
              <div className="space-y-2">
                <SimNotice tone="neutral">两次对照保持其余参数不变，另在评估页签保存 C 独立闭环对照（两组对比之间仅改变比例增益倍率）。</SimNotice>
                <StepConditionProgress chips={[
                  { label: '低增益组 (Kp≤0.6)', done: stepRuns.some((r) => (r.initialInput.dredger?.kpMultiplier ?? 0.2) <= 0.6) },
                  { label: '高增益组 (Kp>0.6)', done: stepRuns.some((r) => (r.initialInput.dredger?.kpMultiplier ?? 0.2) > 0.6) },
                ]} />
              </div>
            ) : null}

            {sequence === 11 ? <SimNotice tone="neutral">请先选用第 5 步砂层模型完成黏土运行并在评估页签保存失配对照，再从黏土单一模式窗口重辨识黏土联合模型。</SimNotice> : null}

            {sequence === 12 ? (
              <StepConditionProgress chips={[
                { label: '0.3 m 切厚 (20.3 m)', done: stepRuns.some((r) => Math.abs((r.initialInput.dredger?.commands.depthReferenceM ?? 0) - 20.3) < 1e-4) },
                { label: '0.5 m 切厚 (20.5 m)', done: stepRuns.some((r) => Math.abs((r.initialInput.dredger?.commands.depthReferenceM ?? 0) - 20.5) < 1e-4) },
              ]} />
            ) : null}

            {[13, 15].includes(sequence) ? (
              <div className="space-y-2">
                <SimField label="换向斜坡 / s">
                  <select className="sim-hud-input" aria-label="换向斜坡 / s" disabled={locked} value={settings.reversalRampS}
                    onChange={(event) => update({ reversalRampS: Number(event.target.value) as 5 | 15 | 30 })}>
                    {[5, 15, 30].map((value) => <option key={value} value={value}>{value} s</option>)}
                  </select>
                </SimField>
                {sequence === 13 ? <StepConditionProgress chips={([5, 15, 30] as const).map((ramp) => ({ label: `${ramp} s`, done: stepRuns.some((r) => r.initialInput.dredger?.reversalRampS === ramp) }))} /> : null}
              </div>
            ) : null}

            {[14, 15].includes(sequence) ? (
              <div className="space-y-2">
                <SimField label="模式切换时的积分处理">
                  <select className="sim-hud-input" aria-label="模式切换时的积分处理" disabled={locked} value={settings.integralPolicy}
                    onChange={(event) => update({ integralPolicy: event.target.value as DredgerCourseSettings['integralPolicy'] })}>
                    <option value="track">跟踪实际输出</option><option value="freeze">冻结积分</option><option value="reset">直接重置</option>
                  </select>
                </SimField>
                {sequence === 14 ? (
                  <>
                    <SimNotice tone="neutral">保持联合模型与进入保持时间完全一致，分别完成「直接重置」与「跟踪实际输出」两次运行。</SimNotice>
                    <StepConditionProgress chips={[
                      { label: '直接重置', done: stepRuns.some((r) => r.initialInput.dredger?.integralPolicy === 'reset') },
                      { label: '跟踪实际输出', done: stepRuns.some((r) => r.initialInput.dredger?.integralPolicy === 'track') },
                    ]} />
                  </>
                ) : null}
              </div>
            ) : null}

            {[14, 15, 17].includes(sequence) ? (
              <div className="space-y-2">
                <SimField label="进入条件保持 / s">
                  <select className="sim-hud-input" aria-label="进入条件保持 / s" disabled={locked} value={settings.entryHoldS}
                    onChange={(event) => update({ entryHoldS: Number(event.target.value) as 5 | 10 | 20 })}>
                    {[5, 10, 20].map((value) => <option key={value} value={value}>{value} s</option>)}
                  </select>
                </SimField>
                {sequence === 17 ? <StepConditionProgress chips={([5, 10, 20] as const).map((hold) => ({ label: `${hold} s`, done: stepRuns.some((r) => r.initialInput.dredger?.entryHoldS === hold) }))} /> : null}
              </div>
            ) : null}

            {sequence === 16 ? (
              <div className="space-y-2">
                <SimToggleRow label="0.5m横浪" htmlFor="dredger-wave" control={<SimSwitchInput id="dredger-wave" checked={settings.wavesEnabled} disabled={locked} onChange={() => update({ wavesEnabled: !settings.wavesEnabled })} />} />
                <SimNotice tone={step16ControllerAligned ? 'neutral' : 'warning'}>
                  {step16ControllerAligned ? '先跑无浪与 0.5 m 横浪对比，保持其余控制与滤波参数完全一致！'
                    : '当前模型、滤波或深度与已保存的无浪/有浪记录不一致，请保持完全一致或重置后重新跑齐两组对比。'}
                </SimNotice>
                <StepConditionProgress chips={[
                  { label: '无浪关闭', done: stepRuns.some((r) => r.configuration.environmentSwitches?.wave_enabled === false) },
                  { label: '0.5 m 横浪开启', done: stepRuns.some((r) => r.configuration.environmentSwitches?.wave_enabled === true) },
                ]} />
              </div>
            ) : null}

            {sequence === 18 ? <SimNotice tone="neutral">所选方案必须能在 t=180 s 前稳定进入横移切削状态，方可在 t=180 s 断缆时记录有效停刀抬刀与安全退出证据。</SimNotice> : null}

            {sequence >= 10 && sequence <= 18 ? <DredgerSchemeSummary title="当前完整作业方案（含锁定基线参数）" settings={settings} model={selectedModel} /> : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className={simulationUi.buttonOutline}
                disabled={locked || !course.ready || !course.designModelId || (sequence === 19 && !blindMatchedRun)}
                onClick={() => { void course.freezePrediction(); }}>
                冻结独立横移预测
              </Button>
              {course.designModelId ? <SimChip tone={forecastCurrent ? 'success' : 'warning'}>{forecastCurrent ? '独立预测已对齐' : '待冻结预测'}</SimChip> : null}
            </div>
            <p className="text-xs leading-5 text-platform-fg-secondary">
              控制器比例积分初值由本人联合模型生成；独立预测采用固定横移切削模式及标称准备时间，实际土层、波浪与保护动作通过独立对照检验。
            </p>
            {forecast ? <ModelComparisonCurve comparison={forecast} studentModel={models.find((model) => model.id === forecast.modelId)} /> : null}
          </div>
        </SimPanelSection>
      ) : null}

      <SimPanelSection title="机构与适用范围" icon={Anchor}>
        <p className="text-xs leading-5 text-platform-fg-secondary">
          钢桩10秒建立有限支承，两条弹性锚缆承受拉力。桥架与绞刀的载荷参与船体运动。砂与黏土采用局部切削近似，产量累计实际新移除体积。报告采用绞刀、横移绞车和推进轴系的机械能耗口径，适用于均质土层的低速教学工况。
        </p>
      </SimPanelSection>
    </SimPanelStack>
  );
}
