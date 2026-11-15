'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ComparisonModeValue } from '@/lib/student-model-artifact-contract';
import { listFrozenStudentModels, listModelComparisons, readRunEvidence, saveFrozenStudentModel,
  saveModelComparison, type VesselRunSummary } from '@/features/simulations/local-evidence-store';
import { SimField, SimPanelSection } from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import { compareVesselStudentModel, identifyVesselStudentModel, type FrozenVesselStudentModel,
  type IdentificationChannel, type VesselModelComparison } from './student-analysis';
import { ModelComparisonCurve } from './model-comparison-curve';
import { MeasurementWindow } from './measurement-window';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import { studentModelFormula } from './student-model-presentation';
import { DestroyerRunEvaluation } from './destroyer-run-evaluation';
import { LngLiquidSpectrum } from './lng-liquid-spectrum';
import { CruiseRollSpectrum } from './cruise-roll-spectrum';
import { CruiseComfortReadout } from './cruise-comfort-readout';


export function VesselModelWorkbench({ scopeKey, runs, onArtifactsChange, defaultChannel = 'rudder-to-yaw' }: {
  scopeKey: string;
  runs: VesselRunSummary[];
  onArtifactsChange: (models: FrozenVesselStudentModel[], comparisons: VesselModelComparison[], scopeKey: string) => void;
  defaultChannel?: IdentificationChannel;
}) {
  const [loadedModels, setModels] = useState<FrozenVesselStudentModel[]>([]);
  const [loadedComparisons, setComparisons] = useState<VesselModelComparison[]>([]);
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;
  const models = loadedModels.filter((model) => model.scopeKey === scopeKey);
  const comparisons = loadedComparisons.filter((comparison) => comparison.scopeKey === scopeKey);
  const [runId, setRunId] = useState('');
  const [modelId, setModelId] = useState('');
  const [actuatorId, setActuatorId] = useState('');
  const [channel, setChannel] = useState<IdentificationChannel>(defaultChannel);
  const [kind, setKind] = useState<'nomoto1' | 'nomoto2' | 'fopdt' | 'roll_oscillator'>(defaultChannel === 'fin-to-roll'
    ? 'roll_oscillator' : defaultChannel === 'rudder-to-yaw' ? 'nomoto1' : 'fopdt');
  const [freeDecayRunId,setFreeDecayRunId] = useState('');
  const [freeDecayStartS,setFreeDecayStartS] = useState(10);
  const [freeDecayEndS,setFreeDecayEndS] = useState(120);
  const [startS, setStartS] = useState(10);
  const [endS, setEndS] = useState(60);
  const [mode, setMode] = useState<ComparisonModeValue>(defaultChannel === 'shaft-reference-to-speed' ? 'command_to_output' : 'hull_model');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewRun,setPreviewRun] = useState<VesselRunEvidence|null>(null);
  const eligibleRuns = useMemo(() => runs.filter((run) => run.scopeKey === scopeKey && run.sampleCount >= 20), [runs,scopeKey]);
  const visibleRun = previewRun?.id === runId && previewRun.scopeKey === scopeKey ? previewRun : null;
  const selectedModel = models.find((model) => model.id === modelId);
  const selectedRun = eligibleRuns.find((run)=>run.id === runId);
  const selectedComparison = comparisons.filter((comparison)=>comparison.runId === runId && comparison.modelId === modelId
    && comparison.mode === mode && (mode === 'hull_model' || selectedModel?.channel === 'shaft-reference-to-speed' || comparison.actuatorModelId === actuatorId)
    && Math.abs(comparison.startS-startS) < 1e-7 && Math.abs(comparison.endS-endS) < 1e-7).at(-1);

  const reload = useCallback(async () => {
    const [nextModels, nextComparisons] = await Promise.all([listFrozenStudentModels(scopeKey), listModelComparisons(scopeKey)]);
    if (activeScope.current !== scopeKey) return;
    nextComparisons.sort((a,b) => a.createdAtMs-b.createdAtMs);
    setModels(nextModels); setComparisons(nextComparisons);
    onArtifactsChange(nextModels, nextComparisons, scopeKey);
  }, [scopeKey, onArtifactsChange]);

  useEffect(() => { void reload().catch((error: unknown) => setMessage(error instanceof Error ? error.message : '模型记录读取失败。')); }, [reload]);
  useEffect(() => {
    if (runId && eligibleRuns.some((run) => run.id === runId)) return;
    const latest = eligibleRuns[0];
    setRunId(latest?.id ?? '');
    if (latest) setEndS(latest.durationS);
  }, [runId, eligibleRuns]);
  useEffect(()=>{
    let cancelled = false;
    if (!runId) {setPreviewRun(null);return;}
    void readRunEvidence(runId).then((run)=>{if (!cancelled) setPreviewRun(run?.scopeKey === scopeKey ? run : null);})
      .catch((error:unknown)=>{if (!cancelled) setMessage(error instanceof Error ? error.message : '量测窗口读取失败。');});
    return ()=>{cancelled=true;};
  },[runId,scopeKey,selectedRun?.sampleCount,selectedRun?.lastTimeS,selectedRun?.stoppedAtMs]);

  async function analyze(operation: 'identify' | 'compare') {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const run = await readRunEvidence(runId);
      if (!run || run.scopeKey !== scopeKey) throw new Error('请先完成并保存一次运行。');
      if (operation === 'identify') {
        const freeDecay = channel === 'fin-to-roll' && freeDecayRunId ? await readRunEvidence(freeDecayRunId) : undefined;
        const model = identifyVesselStudentModel(run, channel, kind, startS, endS,
          freeDecay ? {run:freeDecay,startS:freeDecayStartS,endS:freeDecayEndS} : undefined);
        await saveFrozenStudentModel(model);
        setModelId(model.id);
        setMessage('本次辨识模型已冻结。更换窗口或结构会保存为另一版本。');
      } else {
        if (!selectedModel) throw new Error('请选择已冻结的本人模型。');
        const comparison = compareVesselStudentModel(run, selectedModel, mode, startS, endS,
          models.find((model) => model.id === actuatorId));
        await saveModelComparison(comparison);
        setMessage('已保存独立对照。运行记录与模型版本均已保留。');
      }
      await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : '本次分析未完成，请重试。'); }
    finally { setBusy(false); }
  }

  return (
    <SimPanelSection title="辨识与模型对照" icon={Activity}>
      <div className="space-y-3" data-vessel-model-workbench>
        <SimField label="本人的运行记录">
          <select className="sim-hud-input" aria-label="分析运行记录" value={runId}
            onChange={(event) => { setRunId(event.target.value); const run = runs.find((item) => item.id === event.target.value); if (run) setEndS(run.durationS); }}>
            <option value="">选择运行</option>
            {eligibleRuns.map((run) => <option key={run.id} value={run.id}>第{run.stepSequence}步 · {run.durationS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}{run.stopReason === 'failure' ? ' · 已中断' : ''}</option>)}
          </select>
        </SimField>
        <div className="grid grid-cols-2 gap-2">
          <SimField label="窗口起点" value="s"><input type="number" min={0} step={0.05} className="sim-hud-input" aria-label="分析窗口起点" value={startS} onChange={(event) => setStartS(Number(event.target.value))} /></SimField>
          <SimField label="窗口终点" value="s"><input type="number" min={0} step={0.05} className="sim-hud-input" aria-label="分析窗口终点" value={endS} onChange={(event) => setEndS(Number(event.target.value))} /></SimField>
        </div>
        {visibleRun ? <MeasurementWindow run={visibleRun} startS={startS} endS={endS}
          signal={channel === 'fin-to-roll' ? 'EstimatedRoll' : channel === 'rudder-servo' ? 'SurfaceEncoder0' : channel.startsWith('shaft-') ? 'SpeedLog' : 'YawRate'}
          unit={channel === 'fin-to-roll' || channel === 'rudder-servo' ? '°' : channel.startsWith('shaft-') ? 'm/s' : '°/s'}
          onSelect={({start,end})=>{setStartS(start.timeS);setEndS(end.timeS);}} /> : null}
        {visibleRun?.courseKey === 'destroyer' ? <DestroyerRunEvaluation run={visibleRun} /> : null}
        {visibleRun?.courseKey === 'lng' ? <LngLiquidSpectrum run={visibleRun} startS={startS} endS={endS} /> : null}
        {visibleRun?.courseKey === 'cruise' ? <>
          <CruiseComfortReadout comfort={visibleRun.cruiseComfort ?? null} />
          <CruiseRollSpectrum run={visibleRun} startS={startS} endS={endS} />
        </> : null}
        <SimField label="量测通道">
          <select className="sim-hud-input" aria-label="辨识量测通道" value={channel} onChange={(event) => {
            const next = event.target.value as IdentificationChannel;
            setChannel(next); setKind(next === 'fin-to-roll' ? 'roll_oscillator' : next === 'rudder-to-yaw' ? 'nomoto1' : 'fopdt');
            if (next === 'shaft-reference-to-speed') setMode('command_to_output');
            if (next === 'fin-to-roll') setMode('hull_model');
          }}>
            <option value="rudder-to-yaw">实际舵角 → 转艏速率</option>
            <option value="rudder-servo">舵指令 → 实际舵角</option>
            <option value="shaft-to-speed">实际轴速 → 对水航速</option>
            <option value="shaft-reference-to-speed">轴速参考 → 对水航速</option>
            {visibleRun?.courseKey === 'cruise' ? <option value="fin-to-roll">实际差动鳍角 → 横摇姿态估计</option> : null}
          </select>
        </SimField>
        <SimField label="候选结构">
          <select className="sim-hud-input" aria-label="候选模型结构" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="nomoto1">一阶模型</option><option value="nomoto2">二阶模型</option><option value="fopdt">一阶惯性与时延</option>
            {channel === 'fin-to-roll' ? <option value="roll_oscillator">二阶横摇振子</option> : null}
          </select>
        </SimField>
        {channel === 'fin-to-roll' ? <SimField label="控制效能辨识所用自由衰减记录">
          <select className="sim-hud-input" aria-label="自由衰减运行记录" value={freeDecayRunId} onChange={(event) => setFreeDecayRunId(event.target.value)}>
            <option value="">当前记录用于辨识自由衰减</option>
            {eligibleRuns.filter((run) => run.stepSequence === 2).map((run) => <option key={run.id} value={run.id}>
              第2步 · {run.durationS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
            </option>)}
          </select>
        </SimField> : null}
        {channel === 'fin-to-roll' && freeDecayRunId ? <div className="grid grid-cols-2 gap-2">
          <SimField label="自由衰减窗口起点" value="s"><input type="number" min={0} step={.05} className="sim-hud-input"
            aria-label="自由衰减窗口起点" value={freeDecayStartS} onChange={(event) => setFreeDecayStartS(Number(event.target.value))} /></SimField>
          <SimField label="自由衰减窗口终点" value="s"><input type="number" min={0} step={.05} className="sim-hud-input"
            aria-label="自由衰减窗口终点" value={freeDecayEndS} onChange={(event) => setFreeDecayEndS(Number(event.target.value))} /></SimField>
        </div> : null}
        <Button className={simulationUi.buttonOutline} size="sm" disabled={busy || !runId} onClick={() => { void analyze('identify'); }}>辨识并冻结模型</Button>
        <SimField label="冻结的学生模型">
          <select className="sim-hud-input" aria-label="冻结的学生模型" value={modelId} onChange={(event) => setModelId(event.target.value)}>
            <option value="">选择模型</option>{models.map((model,index) => <option key={model.id} value={model.id}>{model.label} · 版本{index+1}</option>)}
          </select>
        </SimField>
        {selectedModel ? <p className="break-words text-xs leading-5 text-platform-fg-primary">{studentModelFormula(selectedModel.payload.structure)}</p> : null}
        {selectedModel ? <p className="text-xs text-platform-fg-secondary">
          训练窗口残差RMS {selectedModel.payload.identification.residualRms?.toPrecision(4) ?? '未获得有效值'} {selectedModel.payload.ioContract.outputUnit}
          {typeof selectedModel.payload.identification.settings.trainingFitPercent === 'number'
            ? `，训练拟合FIT ${selectedModel.payload.identification.settings.trainingFitPercent.toFixed(1)}%` : ''}
        </p> : null}
        {models.some((model)=>model.payload.structure.kind === 'nomoto1') ? <div className="overflow-x-auto"><table className="w-full text-left text-xs text-platform-fg-secondary">
          <caption className="pb-1 text-left">本人冻结的一阶船体模型</caption><thead><tr><th>运行初始航速</th><th>K / s⁻¹</th><th>T / s</th></tr></thead><tbody>
            {models.filter((model)=>model.channel === 'rudder-to-yaw' && model.payload.structure.kind === 'nomoto1').map((model)=>{
              const structure = model.payload.structure;
              if (structure.kind !== 'nomoto1') return null;
              return <tr key={model.id}><td>{model.payload.operatingPoint.speedMps} m/s</td><td>{structure.k.toPrecision(4)}</td><td>{structure.t_s.toPrecision(4)}</td></tr>;
            })}
          </tbody></table><p className="mt-1 text-xs text-platform-fg-secondary">初始航速用于区分运行，辨识窗口内的实际航速及其变化请结合计程仪量测判断。</p></div> : null}
        <SimField label="对照方式">
          <select className="sim-hud-input" aria-label="模型对照方式" value={mode} onChange={(event) => setMode(event.target.value as ComparisonModeValue)}>
            <option value="hull_model">A · 实际执行器量测驱动船体模型</option>
            <option value="command_to_output" disabled={selectedModel?.channel === 'fin-to-roll'}>{selectedModel?.channel === 'shaft-reference-to-speed'
              ? 'B · 轴速参考驱动联合惯性模型' : 'B · 指令经舵机模型驱动船体模型'}</option>
            <option value="independent_closed_loop" disabled={selectedModel?.channel === 'fin-to-roll'}>C · 学生模型独立闭环</option>
          </select>
        </SimField>
        {mode !== 'hull_model' && selectedModel?.channel !== 'shaft-reference-to-speed' ? <SimField label="冻结的舵机模型">
          <select className="sim-hud-input" aria-label="冻结的舵机模型" value={actuatorId} onChange={(event) => setActuatorId(event.target.value)}>
            <option value="">选择舵机模型</option>{models.filter((model) => model.channel === 'rudder-servo').map((model,index) => <option key={model.id} value={model.id}>{model.label} · 版本{index+1}</option>)}
          </select>
        </SimField> : null}
        <Button className={simulationUi.buttonOutline} size="sm" disabled={busy || !runId || !selectedModel || selectedModel.channel === 'rudder-servo'} onClick={() => { void analyze('compare'); }}>运行独立对照</Button>
        {selectedModel?.channel === 'rudder-servo' ? <p className="text-xs text-platform-fg-secondary">已冻结舵机模型可在B/C对照或运行前闭环预测中作为执行器模型选用。</p> : null}
        {selectedComparison ? <ModelComparisonCurve comparison={selectedComparison} /> : null}
        {message ? <p role="status" className="text-xs leading-5 text-platform-fg-secondary">{message}</p> : null}
      </div>
    </SimPanelSection>
  );
}
