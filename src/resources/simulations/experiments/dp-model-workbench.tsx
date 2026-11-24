'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listFrozenStudentModels, listModelComparisons, readRunEvidence, saveFrozenStudentModel,
  saveModelComparison, type VesselRunSummary,
} from '@/features/simulations/local-evidence-store';
import type { VesselRunEvidence, VesselRunMetrics } from '@/features/simulations/run-evidence';
import {
  SimChip, SimField, SimMeter, SimNotice, SimPanelSection, SimReadout, SimReadoutGrid,
} from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import { evaluateVesselHeadingRun, type FrozenVesselStudentModel, type VesselModelComparison } from './student-analysis';
import { identifyDpStudentModel, compareDpStudentModel } from './dp-student-analysis';
import { ModelComparisonCurve } from './model-comparison-curve';
import { getVesselWorkbenchPolicy, resolveVesselCourseKey, type VesselCourseKey } from './vessel-workbench-policy';
import {
  buildDpConditionKey, defaultDpSnapshot, getDpWorkbenchSnapshot, getScopeArtifactsSnapshot,
  setDpWorkbenchSnapshot, setScopeArtifactsSnapshot, workbenchCacheKey, type DpWorkbenchSnapshot,
} from './workbench-state-cache';

interface TailAxisRms { northRmsM: number | null; eastRmsM: number | null }

function computeDpTailAxisRms(run: VesselRunEvidence): TailAxisRms {
  const start = Math.max(0, run.lastTimeS - 180);
  const tail = run.trace.filter((p) => p.timeS >= start - 1e-7 && p.timeS <= run.lastTimeS + 1e-7);
  if (!tail.length) return { northRmsM: null, eastRmsM: null };
  let northSq = 0;
  let eastSq = 0;
  for (const p of tail) {
    const nErr = p.truth.northM - (p.dp?.targetPositionM[0] ?? 0);
    const eErr = p.truth.eastM - (p.dp?.targetPositionM[1] ?? 0);
    northSq += nErr * nErr;
    eastSq += eErr * eErr;
  }
  return { northRmsM: Math.sqrt(northSq / tail.length), eastRmsM: Math.sqrt(eastSq / tail.length) };
}

function DpMatrixDisplay({ a, b }: { a: number[]; b: number[] }) {
  const axes = ['北向 / 纵向', '东向 / 横向', '航向 / 艏摇'] as const;
  return (
    <div className="space-y-2 text-xs text-platform-fg-secondary" data-dp-matrix-display>
      <p>低频状态为北向位置、东向位置和航向，采样周期 0.1 s。对角线高亮为主通道，非对角线为交叉耦合项。</p>
      {([['A 矩阵（状态转移）', a], ['B 矩阵（输入响应）', b]] as const).map(([title, matrix]) => (
        <div key={title} className="space-y-1">
          <p className="font-medium text-platform-fg-primary">{title}</p>
          <div className="grid grid-cols-3 gap-1 font-mono text-[11px]">
            {axes.map((rowLabel, row) => [0, 1, 2].map((col) => {
              const value = matrix[row * 3 + col] ?? 0;
              const diagonal = row === col;
              return (
                <div
                  key={`${row}-${col}`}
                  className={diagonal
                    ? 'rounded border border-platform-action-primary/40 bg-platform-action-primary/10 px-1.5 py-1 text-platform-fg-primary'
                    : 'rounded border border-platform-border-subtle bg-platform-surface-subtle/50 px-1.5 py-1 text-platform-fg-secondary'}
                  title={`${rowLabel} ← 通道${col + 1}（${diagonal ? '主通道' : '交叉耦合'}）`}
                >
                  <div className="text-[10px] opacity-75">{diagonal ? '主通道' : '耦合'}</div>
                  <div className="tabular-nums">{value.toExponential(3)}</div>
                </div>
              );
            }))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DpFrozenModelCompactSummary({ model }: { model: FrozenVesselStudentModel }) {
  const s = model.payload.structure;
  if (s.kind !== 'dp_low_freq3') return null;
  const startS = Number(model.payload.identification.settings.startS ?? 0);
  const endS = Number(model.payload.identification.settings.endS ?? 0);
  return (
    <div className="sim-hud-tile space-y-1.5 p-2.5 text-xs" data-dp-model-summary>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-platform-fg-primary">{model.label}</span>
        <SimChip tone="success">已冻结</SimChip>
      </div>
      <p className="text-[11px] text-platform-fg-secondary">
        训练窗 {startS.toFixed(1)}–{endS.toFixed(1)} s · 训练残差 {model.payload.identification.residualRms?.toPrecision(3) ?? '—'} m
      </p>
      <p className="font-mono text-[11px] text-platform-fg-secondary">
        主通道 B 对角项：[{s.b[0].toExponential(2)}, {s.b[4].toExponential(2)}, {s.b[8].toExponential(2)}]
      </p>
    </div>
  );
}

function DpRunEvaluation({ step, metrics, tailAxisRms }: { step: number; metrics: VesselRunMetrics; tailAxisRms: TailAxisRms }) {
  return (
    <SimPanelSection title={`第 ${step} 步定位与能耗评价`} data-dp-run-evaluation>
      <SimReadoutGrid>
        <SimReadout label="末 180s 位置 RMS" value={metrics.positionRmsM?.toFixed(3) ?? '—'} unit="m" />
        <SimReadout label="末 180s 航向 RMS" value={metrics.headingRmsDeg?.toFixed(3) ?? '—'} unit="°" />
        <SimReadout label="末 180s 北向 RMS" value={tailAxisRms.northRmsM?.toFixed(3) ?? '—'} unit="m" />
        <SimReadout label="末 180s 东向 RMS" value={tailAxisRms.eastRmsM?.toFixed(3) ?? '—'} unit="m" />
        <SimReadout label="最大位置误差" value={metrics.maximumPositionErrorM?.toFixed(3) ?? '—'} unit="m" />
        <SimReadout label="全程正机械功" value={Number.isFinite(metrics.positiveMotorWorkJ) ? (metrics.positiveMotorWorkJ / 1e6).toFixed(3) : '—'} unit="MJ" />
        <SimReadout span label="归一化分配残差 RMS" value={metrics.normalizedAllocationResidualRms?.toFixed(5) ?? '—'} />
      </SimReadoutGrid>
    </SimPanelSection>
  );
}

export function DpModelWorkbench({
  scopeKey, runs, onArtifactsChange, courseKey = 'drilling', stepSequence,
}: {
  scopeKey: string;
  runs: VesselRunSummary[];
  onArtifactsChange: (models: FrozenVesselStudentModel[], comparisons: VesselModelComparison[], scopeKey: string) => void;
  courseKey?: VesselCourseKey;
  stepSequence?: number;
}) {
  const policy = useMemo(
    () => getVesselWorkbenchPolicy(resolveVesselCourseKey(courseKey, 'dp-low-frequency'), stepSequence),
    [courseKey, stepSequence],
  );
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const cacheKey = workbenchCacheKey(scopeKey, policy.courseKey, policy.stepSequence);
  const initialSnap = getDpWorkbenchSnapshot(cacheKey);
  const seed: DpWorkbenchSnapshot = initialSnap ?? defaultDpSnapshot();
  const initialArtifacts = getScopeArtifactsSnapshot(scopeKey);

  const [trainingIds, setTrainingIds] = useState<string[]>(seed.trainingIds);
  const [validationId, setValidationId] = useState(seed.validationId);
  const [modelId, setModelId] = useState(seed.modelId);
  const [startS, setStartS] = useState(seed.startS);
  const [endS, setEndS] = useState(seed.endS);
  const [models, setModels] = useState<FrozenVesselStudentModel[]>(() => initialArtifacts?.models ?? []);
  const [comparisons, setComparisons] = useState<VesselModelComparison[]>(() => initialArtifacts?.comparisons ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(seed.message);
  const [analyzedConditionKey, setAnalyzedConditionKey] = useState<string | null>(seed.analyzedConditionKey);
  const [userModifiedCondition, setUserModifiedCondition] = useState(seed.userModifiedCondition);
  const [evaluation, setEvaluation] = useState<{ step: number; metrics: VesselRunMetrics; tailAxisRms: TailAxisRms } | null>(null);
  const [hydratedKey, setHydratedKey] = useState(cacheKey);
  const prevCacheKeyRef = useRef(cacheKey);
  const lastStepRef = useRef<number | null>(initialSnap ? policy.stepSequence : null);

  const available = useMemo(
    () => runs.filter((run) => run.scopeKey === scopeKey && run.stoppedAtMs !== null && run.sampleCount >= 20),
    [runs, scopeKey],
  );
  const step3Runs = useMemo(
    () => available.filter((run) => run.stepSequence === 3 && run.stopReason !== 'failure'),
    [available],
  );
  const axisCounts = useMemo(() => {
    const counts = { x: 0, y: 0, yaw: 0 };
    for (const run of step3Runs) {
      const axis = run.courseSettings?.excitationAxis;
      if (axis === 'x' || axis === 'y' || axis === 'yaw') counts[axis] += 1;
    }
    return counts;
  }, [step3Runs]);
  const completedAxes = Number(axisCounts.x > 0) + Number(axisCounts.y > 0) + Number(axisCounts.yaw > 0);

  const ownModels = useMemo(() => models.filter((m) => m.scopeKey === scopeKey && m.channel === 'dp-low-frequency'), [models, scopeKey]);
  const latestModel = ownModels.at(-1);
  const selected = ownModels.find((m) => m.id === modelId) ?? (policy.stepSequence > 0 && !userModifiedCondition ? latestModel : undefined);
  const effectiveModelId = selected?.id ?? '';

  const visibleId = validationId && available.some((r) => r.id === validationId)
    ? validationId
    : ((policy.stepSequence > 0 ? available.filter((r) => r.stepSequence === policy.stepSequence && !r.remoteOnly).at(-1)?.id : undefined)
      ?? available.filter((r) => !r.remoteOnly).at(-1)?.id ?? '');

  const comparison = comparisons.filter((c) => c.scopeKey === scopeKey && c.runId === visibleId
    && c.modelId === effectiveModelId && c.startS === startS && c.endS === endS).at(-1);

  const reload = useCallback(async () => {
    const [nextModels, nextComparisons] = await Promise.all([listFrozenStudentModels(scopeKey), listModelComparisons(scopeKey)]);
    if (currentScope.current !== scopeKey) return;
    setModels(nextModels);
    setComparisons(nextComparisons);
    setScopeArtifactsSnapshot(scopeKey, { models: nextModels, comparisons: nextComparisons });
    onArtifactsChange(nextModels, nextComparisons, scopeKey);
  }, [scopeKey, onArtifactsChange]);

  useEffect(() => {
    if (prevCacheKeyRef.current === cacheKey) return;
    prevCacheKeyRef.current = cacheKey;
    const saved = getDpWorkbenchSnapshot(cacheKey);
    const target = saved ?? defaultDpSnapshot();
    setTrainingIds(target.trainingIds); setValidationId(target.validationId); setModelId(target.modelId);
    setStartS(target.startS); setEndS(target.endS); setMessage(target.message);
    setAnalyzedConditionKey(target.analyzedConditionKey); setUserModifiedCondition(target.userModifiedCondition);
    lastStepRef.current = saved ? policy.stepSequence : null;
    setHydratedKey(cacheKey);
  }, [cacheKey, policy.stepSequence]);
  useEffect(() => {
    if (hydratedKey !== cacheKey) return;
    const ids: [string, string, string] = [trainingIds[0] ?? '', trainingIds[1] ?? '', trainingIds[2] ?? ''];
    setDpWorkbenchSnapshot(cacheKey, { trainingIds: ids, validationId, modelId, startS, endS, message, analyzedConditionKey, userModifiedCondition });
  }, [hydratedKey, cacheKey, trainingIds, validationId, modelId, startS, endS, message, analyzedConditionKey, userModifiedCondition]);
  useEffect(() => { void reload().catch((err: unknown) => setMessage(err instanceof Error ? err.message : '模型读取失败。')); }, [reload]);

  useEffect(() => {
    const axes = ['x', 'y', 'yaw'] as const;
    setTrainingIds((previous) => {
      const next = axes.map((axis, idx) => (previous[idx] && step3Runs.some((r) => r.id === previous[idx])
        ? previous[idx]
        : step3Runs.filter((r) => !r.remoteOnly && r.courseSettings?.excitationAxis === axis).at(-1)?.id ?? ''));
      return next.every((val, idx) => val === previous[idx]) ? previous : next;
    });
  }, [step3Runs]);

  useEffect(() => {
    const stepChanged = lastStepRef.current !== policy.stepSequence;
    if (!stepChanged && validationId && (available.length === 0 || available.some((r) => r.id === validationId))) return;
    lastStepRef.current = policy.stepSequence;
    const preferred = (policy.stepSequence > 0
      ? available.filter((r) => r.stepSequence === policy.stepSequence && !r.remoteOnly).at(-1)
      : undefined) ?? available.filter((r) => !r.remoteOnly).at(-1);
    setValidationId(preferred?.id ?? '');
    if (preferred) { setStartS(Math.min(10, preferred.lastTimeS / 4)); setEndS(preferred.lastTimeS); }
  }, [available, policy.stepSequence, validationId]);

  useEffect(() => {
    let cancelled = false;
    setEvaluation(null);
    if (!visibleId) return;
    void readRunEvidence(visibleId).then((run) => {
      if (!run || run.scopeKey !== scopeKey || cancelled) return;
      setEvaluation({ step: run.stepSequence, metrics: evaluateVesselHeadingRun(run).metrics, tailAxisRms: computeDpTailAxisRms(run) });
    }).catch((err: unknown) => { if (!cancelled) setMessage(err instanceof Error ? err.message : '运行评价读取失败。'); });
    return () => { cancelled = true; };
  }, [visibleId, scopeKey]);

  const markConditionModified = (clearModel = policy.showIdentify && !policy.showValidate) => {
    setUserModifiedCondition(true);
    if (!analyzedConditionKey) return;
    setAnalyzedConditionKey(null);
    if (clearModel) setModelId('');
    setMessage(policy.showIdentify && !policy.showValidate
      ? '辨识条件已修改，点击「冻结本人三通道模型」可按新条件重新辨识。'
      : '验证条件已修改，点击「保存独立三通道对照」重新计算。');
  };

  async function analyze(operation: 'identify' | 'compare') {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      if (operation === 'identify') {
        const sources = await Promise.all(trainingIds.map((id) => readRunEvidence(id)));
        if (sources.some((run) => !run || run.scopeKey !== scopeKey)) throw new Error('请选择本人的三次独立激励运行。');
        const model = identifyDpStudentModel(sources.map((run) => run!), startS, endS);
        await saveFrozenStudentModel(model);
        const condKey = buildDpConditionKey({ trainingIds, validationId, modelId: model.id, startS, endS, showValidate: false });
        const nextMsg = '本人三通道模型已冻结，三次训练窗口和参数均已保存。';
        if (currentScope.current === scopeKey) {
          setModelId(model.id); setUserModifiedCondition(false); setAnalyzedConditionKey(condKey); setMessage(nextMsg);
          const ids: [string, string, string] = [trainingIds[0] ?? '', trainingIds[1] ?? '', trainingIds[2] ?? ''];
          setDpWorkbenchSnapshot(cacheKey, { trainingIds: ids, validationId, modelId: model.id, startS, endS, message: nextMsg, analyzedConditionKey: condKey, userModifiedCondition: false });
        }
      } else {
        const run = await readRunEvidence(visibleId);
        if (!run || run.scopeKey !== scopeKey || !selected) throw new Error('请选择本人冻结模型与独立验证运行。');
        const result = compareDpStudentModel(run, selected, startS, endS);
        await saveModelComparison(result);
        const condKey = buildDpConditionKey({ trainingIds, validationId: visibleId, modelId: selected.id, startS, endS, showValidate: true });
        const nextMsg = '已保存北向、东向和航向的独立对照。';
        setUserModifiedCondition(false); setAnalyzedConditionKey(condKey); setMessage(nextMsg);
        const ids: [string, string, string] = [trainingIds[0] ?? '', trainingIds[1] ?? '', trainingIds[2] ?? ''];
        setDpWorkbenchSnapshot(cacheKey, { trainingIds: ids, validationId: visibleId, modelId: selected.id, startS, endS, message: nextMsg, analyzedConditionKey: condKey, userModifiedCondition: false });
      }
      await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : '本次分析未完成。'); }
    finally { setBusy(false); }
  }

  const seq = policy.stepSequence;
  const independentComparisonCount = comparisons.filter((item) => item.purpose !== 'forecast').length;

  return (
    <SimPanelSection title="三通道辨识与独立对照" icon={Activity}>
      <div className="space-y-3" data-vessel-model-workbench data-course-key={policy.courseKey} data-step-seq={seq}>
        <p className="sim-hud-tile p-2.5 text-xs leading-5 text-platform-fg-secondary" data-workbench-focus-note>{policy.stepFocusNote}</p>

        {seq === 1 || seq === 2 ? (
          <SimNotice tone="neutral">当前步骤聚焦动力定位通道认知与推进器力矩臂实测，无需拟合或验证三通道模型。</SimNotice>
        ) : null}

        {seq === 3 ? (
          <div className="sim-hud-tile space-y-2.5 p-2.5" data-dp-step3-progress>
            <SimMeter value={completedAxes / 3} tone={completedAxes === 3 ? 'success' : 'accent'}
              label="第 3 步三轴物理激励采集进度" valueLabel={`${completedAxes}/3 轴`} scale={['0', '1', '2', '3 轴']} />
            <div className="flex flex-wrap gap-1.5">
              {([['x', '纯纵向 (X)'], ['y', '纯横向 (Y)'], ['yaw', '纯艏摇 (Yaw)']] as const).map(([axis, label]) => (
                <SimChip key={axis} tone={axisCounts[axis] > 0 ? 'success' : 'warning'}>
                  {label}：{axisCounts[axis] > 0 ? `已采集 ${axisCounts[axis]} 次` : '待采集'}
                </SimChip>
              ))}
            </div>
            <p className="text-xs leading-5 text-platform-fg-secondary">
              {completedAxes === 3 ? '三轴独立激励已全部完成，请前往第 4 步在评估页签冻结三通道低频模型。'
                : '请在控制页签依次切换激励轴并完成三组 300 s 运行，齐备后前往第 4 步冻结三通道模型。'}
            </p>
          </div>
        ) : null}

        {policy.showIdentify ? (
          <div className="space-y-3" data-dp-identify-section>
            {step3Runs.length === 0 ? <SimNotice tone="warning" data-empty-run-hint>{policy.emptyRunHint}</SimNotice> : null}
            {(['纵向', '横向', '艏摇'] as const).map((label, index) => {
              const axis = index === 0 ? 'x' : index === 1 ? 'y' : 'yaw';
              const axisRuns = step3Runs.filter((r) => !r.courseSettings?.excitationAxis || r.courseSettings.excitationAxis === axis);
              const list = axisRuns.length ? axisRuns : step3Runs;
              return (
                <SimField key={label} label={`${label}训练运行`}>
                  <select className="sim-hud-input" aria-label={`${label}训练运行`} value={trainingIds[index]}
                    onChange={(e) => { setTrainingIds((prev) => prev.map((id, pos) => (pos === index ? e.target.value : id))); markConditionModified(); }}>
                    <option value="">选择本人第3步运行</option>
                    {list.map((run) => (
                      <option key={run.id} value={run.id}>
                        {run.courseSettings?.excitationAxis === 'x' ? '纵向' : run.courseSettings?.excitationAxis === 'y' ? '横向' : '艏摇'}激励 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
                      </option>
                    ))}
                  </select>
                </SimField>
              );
            })}
            <div className="grid grid-cols-2 gap-2">
              <SimField label="窗口起点" value="s"><input className="sim-hud-input" type="number" min={0} step={0.1} aria-label="分析窗口起点" value={startS} onChange={(e) => { setStartS(Number(e.target.value)); markConditionModified(); }} /></SimField>
              <SimField label="窗口终点" value="s"><input className="sim-hud-input" type="number" min={0} step={0.1} aria-label="分析窗口终点" value={endS} onChange={(e) => { setEndS(Number(e.target.value)); markConditionModified(); }} /></SimField>
            </div>
            <Button className={simulationUi.buttonPrimary} disabled={busy} onClick={() => { void analyze('identify'); }}>冻结本人三通道模型</Button>
          </div>
        ) : null}

        {policy.showIdentify || policy.showValidate ? (
          <div className="space-y-2">
            <SimField label="本人冻结模型">
              <select className="sim-hud-input" aria-label="三通道冻结模型" value={effectiveModelId} onChange={(e) => { setModelId(e.target.value); if (policy.showValidate) markConditionModified(false); }}>
                <option value="">选择本人模型</option>
                {ownModels.map((model, index) => <option key={model.id} value={model.id}>三通道模型 · 版本{index + 1}</option>)}
              </select>
            </SimField>
            {ownModels.length === 0 ? <p className="text-xs leading-5 text-platform-fg-secondary" data-empty-model-hint>{policy.emptyModelHint}</p> : null}
            {selected?.payload.structure.kind === 'dp_low_freq3' ? (
              seq === 5 ? <DpFrozenModelCompactSummary model={selected} />
                : <DpMatrixDisplay a={selected.payload.structure.a} b={selected.payload.structure.b} />
            ) : null}
          </div>
        ) : null}

        {policy.showValidate ? (
          <div className="space-y-3" data-dp-validate-section>
            {seq === 5 ? (
              <div className="grid grid-cols-2 gap-2">
                <SimField label="验证窗口起点" value="s"><input className="sim-hud-input" type="number" min={0} step={0.1} aria-label="分析窗口起点" value={startS} onChange={(e) => { setStartS(Number(e.target.value)); markConditionModified(false); }} /></SimField>
                <SimField label="验证窗口终点" value="s"><input className="sim-hud-input" type="number" min={0} step={0.1} aria-label="分析窗口终点" value={endS} onChange={(e) => { setEndS(Number(e.target.value)); markConditionModified(false); }} /></SimField>
              </div>
            ) : null}
            <SimField label="独立验证运行">
              <select className="sim-hud-input" aria-label="三通道独立验证运行" value={visibleId} onChange={(e) => { setValidationId(e.target.value); markConditionModified(false); }}>
                <option value="">选择本人独立运行</option>
                {available.map((run) => <option key={run.id} value={run.id}>第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>)}
              </select>
            </SimField>
            <Button className={simulationUi.buttonPrimary} disabled={busy || !selected || !visibleId} onClick={() => { void analyze('compare'); }}>保存独立三通道对照</Button>
            {comparison ? (
              <>
                <p className="text-xs text-platform-fg-secondary">北向位置 / m</p>
                <ModelComparisonCurve studentModel={selected} comparison={{ ...comparison, actualHeadingDeg: undefined, predictedHeadingDeg: undefined }} />
                <p className="text-xs text-platform-fg-secondary">东向位置 / m</p>
                <ModelComparisonCurve studentModel={selected} comparison={{
                  ...comparison, actual: comparison.actualEastM ?? [], predicted: comparison.predictedEastM ?? [], outputUnit: 'm',
                  actualHeadingDeg: undefined, predictedHeadingDeg: undefined,
                  metrics: { rmse: comparison.metrics.east_rmse ?? null, fit_percent: comparison.metrics.east_fit_percent ?? null, peak_error: comparison.metrics.east_peak_error ?? null },
                }} />
                <p className="text-xs text-platform-fg-secondary">航向 / °</p>
                <ModelComparisonCurve studentModel={selected} comparison={{
                  ...comparison, actual: comparison.actualHeadingDeg?.map((v) => v ?? NaN) ?? [], predicted: comparison.predictedHeadingDeg ?? [], outputUnit: '°',
                  actualHeadingDeg: undefined, predictedHeadingDeg: undefined,
                  metrics: {
                    rmse: comparison.metrics.heading_rmse == null ? null : (comparison.metrics.heading_rmse * 180) / Math.PI,
                    fit_percent: comparison.metrics.heading_fit_percent ?? null,
                    peak_error: comparison.metrics.heading_peak_error == null ? null : (comparison.metrics.heading_peak_error * 180) / Math.PI,
                  },
                }} />
              </>
            ) : null}
          </div>
        ) : null}

        {policy.showRunEvaluation && !policy.showValidate ? (
          <div className="space-y-3" data-dp-evaluation-only>
            {latestModel ? <DpFrozenModelCompactSummary model={latestModel} />
              : <SimNotice tone="warning" data-empty-model-hint>{policy.emptyModelHint}</SimNotice>}
            <SimField label="查看本步或历史运行">
              <select className="sim-hud-input" aria-label="三通道独立验证运行" value={visibleId} onChange={(e) => setValidationId(e.target.value)}>
                <option value="">选择本步或历史运行</option>
                {available.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.stepSequence === seq ? '本步' : `第${run.stepSequence}步`} · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
                  </option>
                ))}
              </select>
            </SimField>
            {available.length === 0 ? <p className="text-xs text-platform-fg-secondary">暂无完整运行记录，请先在控制页签完成一次定位运行。</p> : null}
          </div>
        ) : null}

        {policy.showRunEvaluation && evaluation?.metrics.positionRmsM !== undefined
          ? <DpRunEvaluation step={evaluation.step} metrics={evaluation.metrics} tailAxisRms={evaluation.tailAxisRms} /> : null}

        {seq === 20 ? (
          <div className="sim-hud-tile space-y-2 p-3 text-xs" data-dp-step20-summary>
            <p className="font-semibold text-platform-fg-primary">第 20 步三通道模型与独立对照确认</p>
            <SimReadoutGrid>
              <SimReadout label="已冻结三通道模型" value={ownModels.length} unit="个" tone={ownModels.length ? 'success' : 'warning'} />
              <SimReadout label="已保存独立对照" value={independentComparisonCount} unit="次" tone={independentComparisonCount ? 'success' : 'warning'} />
            </SimReadoutGrid>
            {latestModel ? <DpFrozenModelCompactSummary model={latestModel} /> : null}
            <p className="leading-5 text-platform-fg-secondary">
              {ownModels.length > 0 && independentComparisonCount > 0
                ? '模型与独立验证证据已齐全，请在控制/报告页签勾选至少 6 次完整运行并提交六部分实验报告。'
                : '请确认已完成第 4 步三通道模型冻结与第 5 步独立验证对照，并在报告中引用不少于 6 次本人运行。'}
            </p>
          </div>
        ) : null}

        <p className="text-xs leading-5 text-platform-fg-secondary">
          三次独立初态分别参与回归，跨运行的相邻点不会作为物理过渡。模型保留局部低阶近似、交叉响应和独立验证误差。
        </p>
        {message ? <p className="text-xs text-platform-fg-secondary" role="status">{message}</p> : null}
      </div>
    </SimPanelSection>
  );
}
