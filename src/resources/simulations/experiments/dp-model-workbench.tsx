'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listFrozenStudentModels, listModelComparisons, readRunEvidence, saveFrozenStudentModel,
  saveModelComparison, type VesselRunSummary } from '@/features/simulations/local-evidence-store';
import { SimField, SimPanelSection } from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import { evaluateVesselHeadingRun, type FrozenVesselStudentModel, type VesselModelComparison } from './student-analysis';
import type { VesselRunMetrics } from '@/features/simulations/run-evidence';
import { identifyDpStudentModel, compareDpStudentModel } from './dp-student-analysis';
import { ModelComparisonCurve } from './model-comparison-curve';

export function DpModelWorkbench({ scopeKey, runs, onArtifactsChange }: {
  scopeKey: string;
  runs: VesselRunSummary[];
  onArtifactsChange: (models: FrozenVesselStudentModel[], comparisons: VesselModelComparison[], scopeKey: string) => void;
}) {
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const [trainingIds, setTrainingIds] = useState(['', '', '']);
  const [validationId, setValidationId] = useState('');
  const [modelId, setModelId] = useState('');
  const [startS, setStartS] = useState(10);
  const [endS, setEndS] = useState(280);
  const [models, setModels] = useState<FrozenVesselStudentModel[]>([]);
  const [comparisons, setComparisons] = useState<VesselModelComparison[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [evaluation, setEvaluation] = useState<{ step: number; metrics: VesselRunMetrics } | null>(null);
  const available = runs.filter((run) => run.scopeKey === scopeKey && run.stoppedAtMs !== null && run.sampleCount >= 20);
  const visibleId = validationId || available[0]?.id || '';
  const ownModels = models.filter((model) => model.scopeKey === scopeKey && model.channel === 'dp-low-frequency');
  const selected = ownModels.find((model) => model.id === modelId);
  const comparison = comparisons.filter((item) => item.scopeKey === scopeKey && item.runId === validationId
    && item.modelId === modelId && item.startS === startS && item.endS === endS).at(-1);

  const reload = useCallback(async () => {
    const [nextModels, nextComparisons] = await Promise.all([listFrozenStudentModels(scopeKey), listModelComparisons(scopeKey)]);
    if (currentScope.current !== scopeKey) return;
    setModels(nextModels);
    setComparisons(nextComparisons);
    onArtifactsChange(nextModels, nextComparisons, scopeKey);
  }, [scopeKey, onArtifactsChange]);
  useEffect(() => { void reload().catch((error: unknown) => setMessage(error instanceof Error ? error.message : '模型读取失败。')); }, [reload]);
  useEffect(() => {
    let cancelled = false;
    setEvaluation(null);
    if (!visibleId) return;
    void readRunEvidence(visibleId).then((run) => {
      if (!run || run.scopeKey !== scopeKey || cancelled) return;
      setEvaluation({ step: run.stepSequence, metrics: evaluateVesselHeadingRun(run).metrics });
    }).catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : '运行评价读取失败。'); });
    return () => { cancelled = true; };
  }, [visibleId, scopeKey]);

  async function analyze(operation: 'identify' | 'compare') {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (operation === 'identify') {
        const sources = await Promise.all(trainingIds.map((id) => readRunEvidence(id)));
        if (sources.some((run) => !run || run.scopeKey !== scopeKey)) throw new Error('请选择本人的三次独立激励运行。');
        const model = identifyDpStudentModel(sources.map((run) => run!), startS, endS);
        await saveFrozenStudentModel(model);
        if (currentScope.current === scopeKey) setModelId(model.id);
        setMessage('本人三通道模型已冻结，三次训练窗口和参数均已保存。');
      } else {
        const run = await readRunEvidence(validationId);
        if (!run || run.scopeKey !== scopeKey || !selected) throw new Error('请选择本人冻结模型与独立验证运行。');
        const result = compareDpStudentModel(run, selected, startS, endS);
        await saveModelComparison(result);
        setMessage('已保存北向、东向和航向的独立对照。');
      }
      await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : '本次分析未完成。'); }
    finally { setBusy(false); }
  }

  return <SimPanelSection title="三通道辨识与独立对照" icon={Activity}>
    <div className="space-y-3" data-vessel-model-workbench>
      {['纵向', '横向', '艏摇'].map((label, index) => <SimField key={label} label={`${label}训练运行`}>
        <select className="sim-hud-input" aria-label={`${label}训练运行`} value={trainingIds[index]}
          onChange={(event) => setTrainingIds((previous) => previous.map((id, position) => position === index ? event.target.value : id))}>
          <option value="">选择本人第3步运行</option>
          {available.filter((run) => run.stepSequence === 3).map((run) => <option key={run.id} value={run.id}>
            {run.courseSettings?.excitationAxis === 'x' ? '纵向' : run.courseSettings?.excitationAxis === 'y' ? '横向' : '艏摇'}激励 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
          </option>)}
        </select>
      </SimField>)}
      <div className="grid grid-cols-2 gap-2">
        <SimField label="窗口起点" value="s"><input className="sim-hud-input" type="number" min={0} step={0.1}
          aria-label="分析窗口起点" value={startS} onChange={(event) => setStartS(Number(event.target.value))} /></SimField>
        <SimField label="窗口终点" value="s"><input className="sim-hud-input" type="number" min={0} step={0.1}
          aria-label="分析窗口终点" value={endS} onChange={(event) => setEndS(Number(event.target.value))} /></SimField>
      </div>
      <Button className={simulationUi.buttonPrimary} disabled={busy} onClick={() => { void analyze('identify'); }}>冻结本人三通道模型</Button>
      <SimField label="本人冻结模型">
        <select className="sim-hud-input" aria-label="三通道冻结模型" value={modelId} onChange={(event) => setModelId(event.target.value)}>
          <option value="">选择本人模型</option>
          {ownModels.map((model, index) => <option key={model.id} value={model.id}>三通道模型 · 版本{index + 1}</option>)}
        </select>
      </SimField>
      {selected?.payload.structure.kind === 'dp_low_freq3' ? <div className="space-y-2 text-xs text-platform-fg-secondary">
        <p>低频状态为北向位置、东向位置和航向，采样周期0.1s。输入为仪器估计的船体纵向力、横向力和艏摇力矩。</p>
        {(['a', 'b'] as const).map((key) => <div key={key}>
          <p>{key.toUpperCase()}矩阵</p>
          <pre className="overflow-x-auto font-mono">{Array.from({ length: 3 }, (_, row) =>
            selected.payload.structure.kind === 'dp_low_freq3' ? selected.payload.structure[key].slice(row * 3, row * 3 + 3)
              .map((value) => value.toExponential(4)).join('  ') : '').join('\n')}</pre>
        </div>)}
      </div> : null}
      <SimField label="独立验证运行">
        <select className="sim-hud-input" aria-label="三通道独立验证运行" value={validationId} onChange={(event) => setValidationId(event.target.value)}>
          <option value="">选择本人独立运行</option>
          {available.map((run) => <option key={run.id} value={run.id}>第{run.stepSequence}步 · {run.lastTimeS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}</option>)}
        </select>
      </SimField>
      {evaluation?.metrics.positionRmsM !== undefined ? <div className="space-y-1 text-xs text-platform-fg-secondary">
        <p>第{evaluation.step}步运行，末180s实际位置均方根 {evaluation.metrics.positionRmsM?.toFixed(3) ?? '—'}m，
          航向均方根 {evaluation.metrics.headingRmsDeg?.toFixed(3) ?? '—'}°。</p>
        <p>最大位置误差 {evaluation.metrics.maximumPositionErrorM?.toFixed(3) ?? '—'}m，
          归一化分配残差均方根 {evaluation.metrics.normalizedAllocationResidualRms?.toFixed(5) ?? '—'}，
          全程正机械功 {(evaluation.metrics.positiveMotorWorkJ / 1e6).toFixed(3)}MJ。</p>
      </div> : null}
      <Button className={simulationUi.buttonPrimary} disabled={busy || !selected} onClick={() => { void analyze('compare'); }}>保存独立三通道对照</Button>
      {comparison ? <>
        <p className="text-xs text-platform-fg-secondary">北向位置 / m</p><ModelComparisonCurve comparison={{ ...comparison,
          actualHeadingDeg: undefined, predictedHeadingDeg: undefined }} />
        <p className="text-xs text-platform-fg-secondary">东向位置 / m</p><ModelComparisonCurve comparison={{ ...comparison,
          actual: comparison.actualEastM ?? [], predicted: comparison.predictedEastM ?? [], outputUnit: 'm',
          actualHeadingDeg: undefined, predictedHeadingDeg: undefined,
          metrics: { rmse: comparison.metrics.east_rmse ?? null, fit_percent: comparison.metrics.east_fit_percent ?? null,
            peak_error: comparison.metrics.east_peak_error ?? null } }} />
        <p className="text-xs text-platform-fg-secondary">航向 / °</p><ModelComparisonCurve comparison={{ ...comparison,
          actual: comparison.actualHeadingDeg?.map((value) => value ?? NaN) ?? [], predicted: comparison.predictedHeadingDeg ?? [], outputUnit: '°',
          actualHeadingDeg: undefined, predictedHeadingDeg: undefined,
          metrics: { rmse: comparison.metrics.heading_rmse == null ? null : comparison.metrics.heading_rmse * 180 / Math.PI,
            fit_percent: comparison.metrics.heading_fit_percent ?? null,
            peak_error: comparison.metrics.heading_peak_error == null ? null : comparison.metrics.heading_peak_error * 180 / Math.PI } }} />
      </> : null}
      <p className="text-xs leading-5 text-platform-fg-secondary">三次独立初态分别参与回归，跨运行的相邻点不会作为物理过渡。模型保留局部低阶近似、交叉响应和独立验证误差。</p>
      {message ? <p className="text-xs text-platform-fg-secondary" role="status">{message}</p> : null}
    </div>
  </SimPanelSection>;
}
