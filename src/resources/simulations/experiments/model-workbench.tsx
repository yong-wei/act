'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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


export function VesselModelWorkbench({ scopeKey, runs, onArtifactsChange }: {
  scopeKey: string;
  runs: VesselRunSummary[];
  onArtifactsChange: (models: FrozenVesselStudentModel[], comparisons: VesselModelComparison[]) => void;
}) {
  const [models, setModels] = useState<FrozenVesselStudentModel[]>([]);
  const [comparisons, setComparisons] = useState<VesselModelComparison[]>([]);
  const [runId, setRunId] = useState('');
  const [modelId, setModelId] = useState('');
  const [actuatorId, setActuatorId] = useState('');
  const [channel, setChannel] = useState<IdentificationChannel>('rudder-to-yaw');
  const [kind, setKind] = useState<'nomoto1' | 'nomoto2' | 'fopdt'>('nomoto1');
  const [startS, setStartS] = useState(10);
  const [endS, setEndS] = useState(60);
  const [mode, setMode] = useState<ComparisonModeValue>('hull_model');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewRun,setPreviewRun] = useState<VesselRunEvidence|null>(null);
  const eligibleRuns = useMemo(() => runs.filter((run) => run.sampleCount >= 20), [runs]);
  const selectedModel = models.find((model) => model.id === modelId);
  const selectedComparison = comparisons.filter((comparison)=>comparison.runId === runId && comparison.modelId === modelId
    && comparison.mode === mode && (mode === 'hull_model' || comparison.actuatorModelId === actuatorId)
    && Math.abs(comparison.startS-startS) < 1e-7 && Math.abs(comparison.endS-endS) < 1e-7).at(-1);

  const reload = useCallback(async () => {
    const [nextModels, nextComparisons] = await Promise.all([listFrozenStudentModels(scopeKey), listModelComparisons(scopeKey)]);
    nextModels.sort((a,b) => a.createdAtMs-b.createdAtMs);
    nextComparisons.sort((a,b) => a.createdAtMs-b.createdAtMs);
    setModels(nextModels); setComparisons(nextComparisons);
    onArtifactsChange(nextModels, nextComparisons);
  }, [scopeKey, onArtifactsChange]);

  useEffect(() => { void reload().catch((error: unknown) => setMessage(error instanceof Error ? error.message : '模型记录读取失败。')); }, [reload]);
  useEffect(() => {
    if (runId && eligibleRuns.some((run) => run.id === runId)) return;
    const latest = eligibleRuns[0];
    if (latest) { setRunId(latest.id); setEndS(latest.durationS); }
  }, [runId, eligibleRuns]);
  useEffect(()=>{
    let cancelled = false;
    if (!runId) {setPreviewRun(null);return;}
    void readRunEvidence(runId).then((run)=>{if (!cancelled) setPreviewRun(run?.scopeKey === scopeKey ? run : null);})
      .catch((error:unknown)=>{if (!cancelled) setMessage(error instanceof Error ? error.message : '量测窗口读取失败。');});
    return ()=>{cancelled=true;};
  },[runId,scopeKey,eligibleRuns]);

  async function analyze(operation: 'identify' | 'compare') {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const run = await readRunEvidence(runId);
      if (!run || run.scopeKey !== scopeKey) throw new Error('请先完成并保存一次运行。');
      if (operation === 'identify') {
        const model = identifyVesselStudentModel(run, channel, kind, startS, endS);
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
        {previewRun ? <MeasurementWindow run={previewRun} startS={startS} endS={endS}
          signal={channel === 'rudder-servo' ? 'SurfaceEncoder0' : channel === 'shaft-to-speed' ? 'SpeedLog' : 'YawRate'}
          unit={channel === 'rudder-servo' ? '°' : channel === 'shaft-to-speed' ? 'm/s' : '°/s'}
          onSelect={({start,end})=>{setStartS(start.timeS);setEndS(end.timeS);}} /> : null}
        <SimField label="量测通道">
          <select className="sim-hud-input" aria-label="辨识量测通道" value={channel} onChange={(event) => {
            const next = event.target.value as IdentificationChannel; setChannel(next); setKind(next === 'rudder-servo' || next === 'shaft-to-speed' ? 'fopdt' : 'nomoto1');
          }}>
            <option value="rudder-to-yaw">实际舵角 → 转艏速率</option>
            <option value="rudder-servo">舵指令 → 实际舵角</option>
            <option value="shaft-to-speed">实际轴速 → 对水航速</option>
          </select>
        </SimField>
        <SimField label="候选结构">
          <select className="sim-hud-input" aria-label="候选模型结构" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="nomoto1">一阶模型</option><option value="nomoto2">二阶模型</option><option value="fopdt">一阶惯性与时延</option>
          </select>
        </SimField>
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
            <option value="command_to_output">B · 指令经舵机模型驱动船体模型</option>
            <option value="independent_closed_loop">C · 学生模型独立闭环</option>
          </select>
        </SimField>
        {mode !== 'hull_model' ? <SimField label="冻结的舵机模型">
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
