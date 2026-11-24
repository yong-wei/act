'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ComparisonModeValue } from '@/lib/student-model-artifact-contract';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import {
  listFrozenStudentModels, listModelComparisons, readRunEvidence, saveFrozenStudentModel,
  saveModelComparison, type VesselRunSummary,
} from '@/features/simulations/local-evidence-store';
import { SimChip, SimField, SimLockedChip, SimNotice, SimPanelSection } from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';
import {
  compareVesselStudentModel, identifyVesselStudentModel, type FrozenVesselStudentModel,
  type IdentificationChannel, type VesselModelComparison,
} from './student-analysis';
import { ModelComparisonCurve } from './model-comparison-curve';
import { MeasurementWindow } from './measurement-window';
import { studentModelFormula } from './student-model-presentation';
import { DestroyerRunEvaluation } from './destroyer-run-evaluation';
import { LngLiquidSpectrum } from './lng-liquid-spectrum';
import { CruiseRollSpectrum } from './cruise-roll-spectrum';
import { CruiseComfortReadout } from './cruise-comfort-readout';
import { DpModelWorkbench } from './dp-model-workbench';
import { IceContactEvidence } from './ice-contact-evidence';
import { ContainerVoyageTradeoff } from './container-voyage-tradeoff';
import {
  WORKBENCH_CHANNEL_LABELS, WORKBENCH_KIND_LABELS, comparisonModeLabel, computeDredgerStep5Progress,
  defaultKindForChannel, defaultWindowForRun, extractContainerVoyageProps,
  getVesselWorkbenchPolicy, measurementSpecForChannel, preferredRunSequenceForStep, resolveVesselCourseKey,
  type ModelKindValue, type VesselCourseKey,
} from './vessel-workbench-policy';
import {
  buildScalarConditionKey, commitScalarAnalysisSnapshot, defaultScalarSnapshot,
  findMatchingFrozenModelForRun, getScalarWorkbenchSnapshot, getScopeArtifactsSnapshot,
  setScalarWorkbenchSnapshot, setScopeArtifactsSnapshot, workbenchCacheKey, type ScalarWorkbenchSnapshot,
} from './workbench-state-cache';

export interface WorkbenchProps {
  scopeKey: string;
  runs: VesselRunSummary[];
  onArtifactsChange: (models: FrozenVesselStudentModel[], comparisons: VesselModelComparison[], scopeKey: string) => void;
  defaultChannel?: IdentificationChannel | 'dp-low-frequency';
  courseKey?: VesselCourseKey;
  stepSequence?: number;
}

function ReadOnlyModelsSummary({ models }: { models: FrozenVesselStudentModel[] }) {
  if (!models.length) return <p className="text-xs text-platform-fg-secondary">本轮次暂未冻结学生辨识模型。</p>;
  return (
    <div className="space-y-1.5" data-readonly-models-summary>
      <p className="text-xs font-medium text-platform-fg-primary">已冻结模型只读摘要（{models.length} 个）</p>
      {models.map((model, index) => (
        <div key={model.id} className="sim-hud-tile p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-platform-fg-primary">{model.label} · 版本{index + 1}</span>
            <span className="font-mono text-[11px] text-platform-fg-secondary">残差 {model.payload.identification.residualRms?.toPrecision(3) ?? '—'} {model.payload.ioContract.outputUnit}</span>
          </div>
          <p className="mt-0.5 break-words text-[11px] text-platform-fg-secondary">{studentModelFormula(model.payload.structure)}</p>
        </div>
      ))}
    </div>
  );
}

function DredgerStep5Progress({ runs, selectedRunId, models }: { runs: VesselRunSummary[]; selectedRunId: string; models: FrozenVesselStudentModel[] }) {
  const { hasJoint, hasActual, done } = computeDredgerStep5Progress(runs, selectedRunId, models);
  return (
    <div className="sim-hud-tile space-y-1.5 p-2.5 text-xs" data-dredger-step5-progress>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-platform-fg-primary">第 5 步双通道冻结进度（需基于同一次运行）</span>
        <SimChip tone={done === 2 ? 'success' : 'warning'}>{done}/2</SimChip>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <SimChip tone={hasJoint ? 'success' : 'neutral'}>绞车指令 → 横移速度：{hasJoint ? '已冻结' : '待冻结'}</SimChip>
        <SimChip tone={hasActual ? 'success' : 'neutral'}>实际绞车速度 → 横移速度：{hasActual ? '已冻结' : '待冻结'}</SimChip>
      </div>
      {done === 1 ? <p className="text-[11px] text-platform-fg-secondary">请保持同一次第 5 步运行不变，切换「量测通道」冻结另一个通道模型。</p> : null}
    </div>
  );
}

function WindowInputs({ startS, endS, startLabel, endLabel, onStart, onEnd }: {
  startS: number; endS: number; startLabel: string; endLabel: string; onStart: (v: number) => void; onEnd: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <SimField label="窗口起点" value="s"><input type="number" min={0} step={0.05} className="sim-hud-input" aria-label={startLabel} value={startS} onChange={(e) => onStart(Number(e.target.value))} /></SimField>
      <SimField label="窗口终点" value="s"><input type="number" min={0} step={0.05} className="sim-hud-input" aria-label={endLabel} value={endS} onChange={(e) => onEnd(Number(e.target.value))} /></SimField>
    </div>
  );
}

export function VesselModelWorkbench(props: WorkbenchProps) {
  const resolvedCourseKey = resolveVesselCourseKey(props.courseKey, props.defaultChannel);
  return resolvedCourseKey === 'drilling' || props.defaultChannel === 'dp-low-frequency'
    ? <DpModelWorkbench {...props} courseKey={resolvedCourseKey} />
    : <ScalarVesselModelWorkbench {...props} resolvedCourseKey={resolvedCourseKey} />;
}

function ScalarVesselModelWorkbench({
  scopeKey, runs, onArtifactsChange, resolvedCourseKey, stepSequence,
}: WorkbenchProps & { resolvedCourseKey: VesselCourseKey }) {
  const policy = useMemo(() => getVesselWorkbenchPolicy(resolvedCourseKey, stepSequence), [resolvedCourseKey, stepSequence]);
  const allowedChannels = policy.allowedChannels;
  const fallbackChannel = (policy.defaultChannel !== 'dp-low-frequency' && allowedChannels.includes(policy.defaultChannel)
    ? policy.defaultChannel : allowedChannels[0]) ?? 'rudder-to-yaw';
  const defaultMode = policy.allowedModesForChannel(fallbackChannel)[0] ?? 'hull_model';
  const cacheKey = workbenchCacheKey(scopeKey, resolvedCourseKey, policy.stepSequence);
  const initialSnap = getScalarWorkbenchSnapshot(cacheKey);
  const initialArtifacts = getScopeArtifactsSnapshot(scopeKey);

  const [loadedModels, setModels] = useState<FrozenVesselStudentModel[]>(() => initialArtifacts?.models ?? []);
  const [loadedComparisons, setComparisons] = useState<VesselModelComparison[]>(() => initialArtifacts?.comparisons ?? []);
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;
  const models = useMemo(() => loadedModels.filter((m) => m.scopeKey === scopeKey), [loadedModels, scopeKey]);
  const comparisons = useMemo(() => loadedComparisons.filter((c) => c.scopeKey === scopeKey), [loadedComparisons, scopeKey]);

  const [snap, setSnap] = useState<ScalarWorkbenchSnapshot>(() => initialSnap ?? defaultScalarSnapshot(fallbackChannel, policy.defaultKind, defaultMode));
  const { runId, modelId, actuatorId, channel, kind, freeDecayRunId, freeDecayStartS, freeDecayEndS, startS, endS, mode, message, analyzedConditionKey, userModifiedCondition } = snap;
  const [freeDecayPreviewRun, setFreeDecayPreviewRun] = useState<VesselRunEvidence | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewRun, setPreviewRun] = useState<VesselRunEvidence | null>(null);
  const [hydratedKey, setHydratedKey] = useState(cacheKey);
  const prevCacheKeyRef = useRef(cacheKey);
  const lastRunStepRef = useRef<number | null>(initialSnap ? policy.stepSequence : null);
  const lastModeStepRef = useRef<number | null>(initialSnap ? policy.stepSequence : null);

  const eligibleRuns = useMemo(() => runs.filter((r) => r.scopeKey === scopeKey && r.sampleCount >= 20), [runs, scopeKey]);
  const step2FreeDecayRuns = useMemo(() => eligibleRuns.filter((r) => r.stepSequence === 2), [eligibleRuns]);
  const visibleRun = previewRun?.id === runId && previewRun.scopeKey === scopeKey ? previewRun : null;
  const selectedRun = eligibleRuns.find((r) => r.id === runId);

  const effectiveChannel = allowedChannels.includes(channel) ? channel : fallbackChannel;
  const effectiveKind = policy.allowedKinds.includes(kind) ? kind : policy.defaultKind;
  const selectableModels = useMemo(() => (policy.stepSequence > 0
    ? models.filter((m) => m.channel !== 'dp-low-frequency' && allowedChannels.includes(m.channel))
    : models), [models, policy.stepSequence, allowedChannels]);
  const effectiveModel = selectableModels.find((m) => m.id === modelId);
  const effectiveModelId = effectiveModel?.id ?? '';

  const modeChannel = effectiveModel && effectiveModel.channel !== 'dp-low-frequency' ? effectiveModel.channel : effectiveChannel;
  const allowedModes = useMemo(() => policy.allowedModesForChannel(modeChannel), [policy, modeChannel]);
  const preferredDefaultMode: ComparisonModeValue = (
    ((resolvedCourseKey === 'destroyer' || resolvedCourseKey === 'dredger') && policy.stepSequence === 10)
    || (resolvedCourseKey === 'container' && policy.stepSequence === 7)
  ) && allowedModes.includes('independent_closed_loop')
    ? 'independent_closed_loop' : (allowedModes[0] ?? 'hull_model');
  const effectiveMode = allowedModes.includes(mode) ? mode : preferredDefaultMode;

  const isJointChannel = modeChannel === 'shaft-reference-to-speed' || modeChannel === 'winch-reference-to-sway';
  const actuatorModels = useMemo(() => (policy.cascadeActuator
    ? models.filter((m) => m.channel === policy.cascadeActuator!.channel) : []), [models, policy.cascadeActuator]);
  const effectiveActuatorId = actuatorModels.some((m) => m.id === actuatorId) ? actuatorId : '';
  const showCascadeActuator = Boolean(policy.cascadeActuator && !isJointChannel && effectiveMode !== 'hull_model' && !effectiveModel?.channel.endsWith('-servo'));
  const selectedComparison = comparisons.filter((c) => c.runId === runId && c.modelId === effectiveModelId
    && c.mode === effectiveMode && (effectiveMode === 'hull_model' || isJointChannel || c.actuatorModelId === effectiveActuatorId)
    && Math.abs(c.startS - startS) < 1e-7 && Math.abs(c.endS - endS) < 1e-7).at(-1);

  const reload = useCallback(async () => {
    const [nextModels, nextComparisons] = await Promise.all([listFrozenStudentModels(scopeKey), listModelComparisons(scopeKey)]);
    if (activeScope.current !== scopeKey) return;
    nextComparisons.sort((a, b) => a.createdAtMs - b.createdAtMs);
    setModels(nextModels); setComparisons(nextComparisons);
    setScopeArtifactsSnapshot(scopeKey, { models: nextModels, comparisons: nextComparisons });
    onArtifactsChange(nextModels, nextComparisons, scopeKey);
  }, [scopeKey, onArtifactsChange]);

  useEffect(() => {
    if (prevCacheKeyRef.current === cacheKey) return;
    prevCacheKeyRef.current = cacheKey;
    const saved = getScalarWorkbenchSnapshot(cacheKey);
    setSnap(saved ?? defaultScalarSnapshot(fallbackChannel, policy.defaultKind, preferredDefaultMode));
    lastRunStepRef.current = saved ? policy.stepSequence : null;
    lastModeStepRef.current = saved ? policy.stepSequence : null;
    setHydratedKey(cacheKey);
  }, [cacheKey, fallbackChannel, policy.defaultKind, policy.stepSequence, preferredDefaultMode]);
  useEffect(() => {
    if (hydratedKey !== cacheKey) return;
    setScalarWorkbenchSnapshot(cacheKey, { ...snap, channel: effectiveChannel, kind: effectiveKind, mode: effectiveMode });
  }, [hydratedKey, cacheKey, snap, effectiveChannel, effectiveKind, effectiveMode]);
  useEffect(() => { void reload().catch((err: unknown) => setSnap((p) => ({ ...p, message: err instanceof Error ? err.message : '模型记录读取失败。' }))); }, [reload]);
  useEffect(() => {
    if (!allowedChannels.includes(channel)) {
      const nk = defaultKindForChannel(fallbackChannel);
      const nextKind = policy.allowedKinds.includes(nk) ? nk : policy.defaultKind;
      setSnap((p) => (p.channel === fallbackChannel && p.kind === nextKind ? p : { ...p, channel: fallbackChannel, kind: nextKind }));
    } else if (!policy.allowedKinds.includes(kind)) setSnap((p) => (p.kind === policy.defaultKind ? p : { ...p, kind: policy.defaultKind }));
  }, [allowedChannels, channel, fallbackChannel, kind, policy.allowedKinds, policy.defaultKind]);
  useEffect(() => {
    const stepChanged = lastModeStepRef.current !== policy.stepSequence;
    lastModeStepRef.current = policy.stepSequence;
    if ((!allowedModes.includes(mode) && allowedModes.length > 0) || stepChanged)
      setSnap((p) => (p.mode === preferredDefaultMode ? p : { ...p, mode: preferredDefaultMode }));
  }, [allowedModes, mode, policy.stepSequence, preferredDefaultMode]);
  useEffect(() => {
    const stepChanged = lastRunStepRef.current !== policy.stepSequence;
    if (!stepChanged && runId && (eligibleRuns.length === 0 || eligibleRuns.some((r) => r.id === runId))) return;
    lastRunStepRef.current = policy.stepSequence;
    const preferredSeq = preferredRunSequenceForStep(resolvedCourseKey, policy.stepSequence);
    const localRuns = eligibleRuns.filter((r) => !r.remoteOnly);
    const chosen = (preferredSeq ? localRuns.filter((r) => r.stepSequence === preferredSeq).at(-1) : undefined) ?? localRuns.at(-1) ?? eligibleRuns[0];
    const nextRunId = chosen?.id ?? '';
    const win = chosen ? defaultWindowForRun(chosen) : null;
    setSnap((p) => (p.runId === nextRunId && (!win || (p.startS === win.startS && p.endS === win.endS)) ? p : { ...p, runId: nextRunId, ...(win ?? {}) }));
  }, [runId, eligibleRuns, policy.stepSequence, resolvedCourseKey]);
  useEffect(() => {
    if (!policy.showValidate || policy.showIdentify || effectiveModelId || !selectableModels.length) return;
    const candidate = selectableModels.filter((m) => !m.channel.endsWith('-servo')
      && (resolvedCourseKey !== 'cruise' || (m.payload.structure.kind === 'roll_oscillator' && m.payload.structure.control_gain > 0))).at(-1);
    if (candidate) setSnap((p) => ({ ...p, modelId: candidate.id }));
  }, [policy.showValidate, policy.showIdentify, effectiveModelId, selectableModels, resolvedCourseKey]);
  useEffect(() => {
    if (!policy.showIdentify || policy.showValidate || userModifiedCondition || effectiveModelId || !runId || !selectableModels.length) return;
    const found = findMatchingFrozenModelForRun(selectableModels, effectiveChannel, runId);
    if (!found) return;
    setSnap((p) => {
      const nextStart = found.startS ?? p.startS; const nextEnd = found.endS ?? p.endS;
      return {
        ...p, modelId: found.model.id, startS: nextStart, endS: nextEnd, message: p.message || '已恢复本运行已冻结的辨识模型。',
        analyzedConditionKey: buildScalarConditionKey({ runId: p.runId, channel: effectiveChannel, kind: effectiveKind, startS: nextStart, endS: nextEnd,
          freeDecayRunId: p.freeDecayRunId, freeDecayStartS: p.freeDecayStartS, freeDecayEndS: p.freeDecayEndS, showValidate: false }),
      };
    });
  }, [policy.showIdentify, policy.showValidate, userModifiedCondition, effectiveModelId, runId, selectableModels, effectiveChannel, effectiveKind]);
  useEffect(() => {
    if (showCascadeActuator && !effectiveActuatorId && actuatorModels.length > 0) setSnap((p) => ({ ...p, actuatorId: actuatorModels.at(-1)!.id }));
  }, [showCascadeActuator, effectiveActuatorId, actuatorModels]);
  useEffect(() => {
    if (!policy.showFreeDecaySelector) { if (freeDecayRunId) setSnap((p) => ({ ...p, freeDecayRunId: '' })); setFreeDecayPreviewRun(null); return; }
    if (policy.requireFreeDecayRun && (!freeDecayRunId || !step2FreeDecayRuns.some((r) => r.id === freeDecayRunId))) {
      const latest = step2FreeDecayRuns.at(-1);
      const nextId = latest?.id ?? '';
      setSnap((p) => (p.freeDecayRunId === nextId ? p : { ...p, freeDecayRunId: nextId,
        ...(latest ? { freeDecayStartS: Math.min(10, latest.lastTimeS / 4), freeDecayEndS: latest.lastTimeS } : {}) }));
    }
  }, [policy.showFreeDecaySelector, policy.requireFreeDecayRun, freeDecayRunId, step2FreeDecayRuns]);
  useEffect(() => {
    let cancelled = false;
    if (!runId) { setPreviewRun(null); return; }
    void readRunEvidence(runId).then((run) => { if (!cancelled) setPreviewRun(run?.scopeKey === scopeKey ? run : null); })
      .catch((err: unknown) => { if (!cancelled) setSnap((p) => ({ ...p, message: err instanceof Error ? err.message : '量测窗口读取失败。' })); });
    return () => { cancelled = true; };
  }, [runId, scopeKey, selectedRun?.sampleCount, selectedRun?.lastTimeS, selectedRun?.stoppedAtMs]);
  useEffect(() => {
    let cancelled = false;
    if (!policy.showFreeDecaySelector || !freeDecayRunId) { setFreeDecayPreviewRun(null); return; }
    void readRunEvidence(freeDecayRunId).then((run) => { if (!cancelled) setFreeDecayPreviewRun(run?.scopeKey === scopeKey ? run : null); })
      .catch(() => { if (!cancelled) setFreeDecayPreviewRun(null); });
    return () => { cancelled = true; };
  }, [policy.showFreeDecaySelector, freeDecayRunId, scopeKey]);

  const modifyCondition = (patch: Partial<ScalarWorkbenchSnapshot>, clearModel = policy.showIdentify && !policy.showValidate) => {
    setSnap((p) => {
      const next: ScalarWorkbenchSnapshot = { ...p, ...patch, userModifiedCondition: true };
      if (!p.analyzedConditionKey) return next;
      return {
        ...next, analyzedConditionKey: null,
        modelId: clearModel ? '' : next.modelId,
        message: policy.showIdentify && !policy.showValidate
          ? '辨识条件已修改，点击「辨识并冻结模型」可按新条件重新辨识。'
          : '对照条件已修改，点击「运行独立对照」重新计算。',
      };
    });
  };

  async function analyze(operation: 'identify' | 'compare') {
    if (busy) return;
    setBusy(true); setSnap((p) => ({ ...p, message: '' }));
    try {
      const run = await readRunEvidence(runId);
      if (!run || run.scopeKey !== scopeKey) throw new Error('请先完成并保存一次运行。');
      let targetModelId = effectiveModel?.id ?? '';
      let nextMsg = '已保存独立对照。运行记录与模型版本均已保留。';
      if (operation === 'identify') {
        if (policy.requireFreeDecayRun && !freeDecayRunId) {
          throw new Error('请先在第 2 步完成自由衰减运行，并选择该记录后联合冻结鳍控制效能模型。');
        }
        const freeDecay = effectiveChannel === 'fin-to-roll' && policy.showFreeDecaySelector && freeDecayRunId
          ? await readRunEvidence(freeDecayRunId) : undefined;
        const model = identifyVesselStudentModel(run, effectiveChannel, effectiveKind, startS, endS,
          freeDecay ? { run: freeDecay, startS: freeDecayStartS, endS: freeDecayEndS } : undefined);
        await saveFrozenStudentModel(model);
        targetModelId = model.id;
        nextMsg = '本次辨识模型已冻结。更换窗口或结构会保存为另一版本。';
      } else {
        if (!effectiveModel) throw new Error('请选择已冻结的本人模型。');
        const actuator = showCascadeActuator ? models.find((m) => m.id === effectiveActuatorId) : undefined;
        await saveModelComparison(compareVesselStudentModel(run, effectiveModel, effectiveMode, startS, endS, actuator));
      }
      const committed = commitScalarAnalysisSnapshot(cacheKey, {
        ...snap, runId, modelId: targetModelId, channel: effectiveChannel, kind: effectiveKind, mode: effectiveMode, message: nextMsg,
      }, policy.showValidate);
      setSnap(committed);
      await reload();
    } catch (error) { setSnap((p) => ({ ...p, message: error instanceof Error ? error.message : '本次分析未完成，请重试。' })); }
    finally { setBusy(false); }
  }

  const hasSpecialist = policy.showRunEvaluation || policy.showComfortReadout || policy.showRollSpectrum
    || policy.showLiquidSpectrum || policy.showIceContact || policy.showVoyageTradeoff;
  const showWindow = policy.showIdentify || policy.showValidate || policy.showRollSpectrum
    || policy.showLiquidSpectrum || policy.showIceContact;
  const activeMeasureChannel = policy.showIdentify ? effectiveChannel
    : (effectiveModel?.channel && effectiveModel.channel !== 'dp-low-frequency' ? effectiveModel.channel : effectiveChannel);
  const measureSpec = measurementSpecForChannel(activeMeasureChannel);
  const missingCruiseFull = resolvedCourseKey === 'cruise' && policy.stepSequence === 4
    && !selectableModels.some((m) => m.payload.structure.kind === 'roll_oscillator' && m.payload.structure.control_gain > 0);
  const showEmptyModelHint = selectableModels.length === 0 || missingCruiseFull;

  return (
    <SimPanelSection title="辨识与模型对照" icon={Activity}>
      <div className="space-y-3" data-vessel-model-workbench data-course-key={resolvedCourseKey} data-step-seq={policy.stepSequence}>
        <p className="sim-hud-tile p-2.5 text-xs leading-5 text-platform-fg-secondary" data-workbench-focus-note>{policy.stepFocusNote}</p>

        {!policy.showIdentify && !policy.showValidate && !hasSpecialist ? (
          <div className="space-y-3" data-workbench-simplified-card>
            <SimNotice tone="neutral">当前步骤无需重新辨识或运行独立模型对照。</SimNotice>
            <ReadOnlyModelsSummary models={models} />
          </div>
        ) : (
          <>
            <SimField label="本人的运行记录">
              <select className="sim-hud-input" aria-label="分析运行记录" value={runId} onChange={(event) => {
                const nextId = event.target.value;
                const chosen = runs.find((item) => item.id === nextId);
                modifyCondition({ runId: nextId, ...(chosen ? defaultWindowForRun(chosen) : {}) });
              }}>
                <option value="">选择运行</option>
                {eligibleRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    第{run.stepSequence}步 · {run.durationS.toFixed(1)}s · {new Date(run.createdAtMs).toLocaleTimeString('zh-CN')}
                    {run.stopReason === 'failure' ? ' · 已中断' : ''}
                  </option>
                ))}
              </select>
            </SimField>
            {eligibleRuns.length === 0 ? <p className="text-xs leading-5 text-platform-fg-secondary" data-empty-run-hint>{policy.emptyRunHint}</p> : null}

            {showWindow ? (
              <>
                <WindowInputs startS={startS} endS={endS} startLabel="分析窗口起点" endLabel="分析窗口终点"
                  onStart={(v) => modifyCondition({ startS: v })} onEnd={(v) => modifyCondition({ endS: v })} />
                {visibleRun ? <MeasurementWindow run={visibleRun} startS={startS} endS={endS} signal={measureSpec.signal} unit={measureSpec.unit}
                  onSelect={({ start, end }) => modifyCondition({ startS: start.timeS, endS: end.timeS })} /> : null}
              </>
            ) : null}

            {policy.showRunEvaluation && visibleRun && (visibleRun.courseKey === 'destroyer' || visibleRun.courseKey === 'dredger')
              ? <DestroyerRunEvaluation run={visibleRun} /> : null}
            {policy.showLiquidSpectrum && visibleRun?.courseKey === 'lng' ? <LngLiquidSpectrum run={visibleRun} startS={startS} endS={endS} /> : null}
            {policy.showComfortReadout && visibleRun?.courseKey === 'cruise' ? <CruiseComfortReadout comfort={visibleRun.cruiseComfort ?? null} /> : null}
            {policy.showRollSpectrum && visibleRun?.courseKey === 'cruise' ? <CruiseRollSpectrum run={visibleRun} startS={startS} endS={endS} /> : null}
            {policy.showIceContact && visibleRun?.courseKey === 'icebreaker' && visibleRun.configuration.ice
              ? <IceContactEvidence run={visibleRun} startS={startS} endS={endS} onWindow={(s, e) => modifyCondition({ startS: s, endS: e })} /> : null}
            {policy.showVoyageTradeoff && visibleRun?.courseKey === 'container'
              && ((policy.stepSequence >= 11 && policy.stepSequence <= 19) || Boolean(visibleRun.configuration.containerVoyage) || visibleRun.stepSequence >= 11)
              ? <ContainerVoyageTradeoff {...extractContainerVoyageProps(visibleRun)} compact /> : null}

            {policy.showIdentify ? (
              <div className="space-y-3" data-workbench-identify-section>
                {resolvedCourseKey === 'dredger' && policy.stepSequence === 5
                  ? <DredgerStep5Progress runs={eligibleRuns} selectedRunId={runId} models={models} /> : null}
                <SimField label="量测通道">
                  <select className="sim-hud-input" aria-label="辨识量测通道" value={effectiveChannel} onChange={(event) => {
                    const next = event.target.value as IdentificationChannel;
                    const nextKind = defaultKindForChannel(next);
                    const nextModes = policy.allowedModesForChannel(next);
                    modifyCondition({
                      channel: next,
                      ...(policy.allowedKinds.includes(nextKind) ? { kind: nextKind } : {}),
                      ...(!nextModes.includes(mode) ? { mode: nextModes[0] ?? 'hull_model' } : {}),
                    });
                  }}>
                    {allowedChannels.map((item) => <option key={item} value={item}>{WORKBENCH_CHANNEL_LABELS[item]}</option>)}
                  </select>
                </SimField>
                <SimField label="候选结构">
                  <select className="sim-hud-input" aria-label="候选模型结构" value={effectiveKind}
                    onChange={(e) => modifyCondition({ kind: e.target.value as ModelKindValue })}>
                    {policy.allowedKinds.map((item) => <option key={item} value={item}>{WORKBENCH_KIND_LABELS[item]}</option>)}
                  </select>
                </SimField>
                {policy.showFreeDecaySelector ? (
                  <div className="space-y-2">
                    {policy.requireFreeDecayRun && step2FreeDecayRuns.length === 0 ? <SimNotice tone="warning">请先在第 2 步完成自由衰减运行</SimNotice> : null}
                    <SimField label="控制效能辨识所用自由衰减记录">
                      <select className="sim-hud-input" aria-label="自由衰减运行记录" value={freeDecayRunId} onChange={(e) => {
                        const nextId = e.target.value;
                        const chosen = step2FreeDecayRuns.find((r) => r.id === nextId);
                        modifyCondition({
                          freeDecayRunId: nextId,
                          ...(chosen ? { freeDecayStartS: Math.min(10, chosen.lastTimeS / 4), freeDecayEndS: chosen.lastTimeS } : {}),
                        });
                      }}>
                        <option value="">{policy.requireFreeDecayRun ? '选择第 2 步自由衰减记录' : '当前记录用于辨识自由衰减'}</option>
                        {step2FreeDecayRuns.map((r) => <option key={r.id} value={r.id}>第2步 · {r.durationS.toFixed(1)}s · {new Date(r.createdAtMs).toLocaleTimeString('zh-CN')}</option>)}
                      </select>
                    </SimField>
                    {freeDecayRunId ? (
                      <>
                        <WindowInputs startS={freeDecayStartS} endS={freeDecayEndS} startLabel="自由衰减窗口起点" endLabel="自由衰减窗口终点"
                          onStart={(v) => modifyCondition({ freeDecayStartS: v })} onEnd={(v) => modifyCondition({ freeDecayEndS: v })} />
                        {freeDecayPreviewRun ? <MeasurementWindow run={freeDecayPreviewRun} startS={freeDecayStartS} endS={freeDecayEndS}
                          signal="EstimatedRoll" unit="°" onSelect={({ start, end }) => modifyCondition({ freeDecayStartS: start.timeS, freeDecayEndS: end.timeS })} /> : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
                <Button className={simulationUi.buttonOutline} size="sm" disabled={busy || !runId || (policy.requireFreeDecayRun && !freeDecayRunId)}
                  onClick={() => { void analyze('identify'); }}>辨识并冻结模型</Button>
              </div>
            ) : null}

            {policy.showIdentify || policy.showValidate ? (
              <div className="space-y-2">
                <SimField label="冻结的学生模型">
                  <select className="sim-hud-input" aria-label="冻结的学生模型" value={effectiveModelId} onChange={(e) => {
                    if (policy.showValidate) modifyCondition({ modelId: e.target.value }, false);
                    else setSnap((p) => ({ ...p, modelId: e.target.value }));
                  }}>
                    <option value="">选择模型</option>
                    {selectableModels.map((model, index) => <option key={model.id} value={model.id}>{model.label} · 版本{index + 1}</option>)}
                  </select>
                </SimField>
                {showEmptyModelHint ? <p className="text-xs leading-5 text-platform-fg-secondary" data-empty-model-hint>{policy.emptyModelHint}</p> : null}
                {effectiveModel ? (
                  <>
                    <p className="break-words text-xs leading-5 text-platform-fg-primary">{studentModelFormula(effectiveModel.payload.structure)}</p>
                    {effectiveModel.payload.structure.kind === 'nomoto1' && effectiveModel.payload.structure.t_s < 0 ? (
                      <p className="text-xs leading-5 text-platform-fg-secondary">该局部模型具有开环不稳定极点。PD设计需满足K·Kp/T大于0及(1+K·Kd)/T大于0，请结合本人窗口、残差与独立验证判断适用范围。</p>
                    ) : null}
                    <p className="text-xs text-platform-fg-secondary">
                      训练窗口残差RMS {effectiveModel.payload.identification.residualRms?.toPrecision(4) ?? '未获得有效值'} {effectiveModel.payload.ioContract.outputUnit}
                      {typeof effectiveModel.payload.identification.settings.trainingFitPercent === 'number'
                        ? `，训练拟合FIT ${effectiveModel.payload.identification.settings.trainingFitPercent.toFixed(1)}%` : ''}
                    </p>
                  </>
                ) : null}
                {selectableModels.some((m) => m.channel.endsWith('-to-yaw') && m.payload.structure.kind === 'nomoto1') ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-platform-fg-secondary">
                      <caption className="pb-1 text-left">本人冻结的一阶船体模型</caption>
                      <thead><tr><th>运行初始航速</th><th>K / s⁻¹</th><th>T / s</th></tr></thead>
                      <tbody>{selectableModels.map((m) => m.channel.endsWith('-to-yaw') && m.payload.structure.kind === 'nomoto1'
                        ? <tr key={m.id}><td>{m.payload.operatingPoint.speedMps} m/s</td><td>{m.payload.structure.k.toPrecision(4)}</td><td>{m.payload.structure.t_s.toPrecision(4)}</td></tr>
                        : null)}</tbody>
                    </table>
                    <p className="mt-1 text-xs text-platform-fg-secondary">初始航速用于区分运行，辨识窗口内的实际航速及其变化请结合计程仪量测判断。</p>
                  </div>
                ) : null}
              </div>
            ) : <ReadOnlyModelsSummary models={models} />}

            {policy.showValidate ? (
              <div className="space-y-3" data-workbench-validate-section>
                <p className="text-xs leading-5 text-platform-fg-secondary">请从已冻结模型库中直接对比，不得重拟合验证集。</p>
                <SimField label="对照方式">
                  <div className="space-y-1.5">
                    <select className="sim-hud-input" aria-label="模型对照方式" value={effectiveMode} disabled={allowedModes.length <= 1}
                      onChange={(e) => modifyCondition({ mode: e.target.value as ComparisonModeValue }, false)}>
                      {allowedModes.map((item) => <option key={item} value={item}>{comparisonModeLabel(item, isJointChannel)}</option>)}
                    </select>
                    <SimLockedChip locked={allowedModes.length <= 1}>已锁定唯一合法对照方式</SimLockedChip>
                  </div>
                </SimField>
                {showCascadeActuator && policy.cascadeActuator ? (
                  <div className="space-y-1.5">
                    <SimField label={policy.cascadeActuator.label}>
                      <select className="sim-hud-input" aria-label={policy.cascadeActuator.label} value={effectiveActuatorId}
                        onChange={(e) => modifyCondition({ actuatorId: e.target.value }, false)}>
                        <option value="">{policy.cascadeActuator.placeholder}</option>
                        {actuatorModels.map((model, index) => <option key={model.id} value={model.id}>{model.label} · 版本{index + 1}</option>)}
                      </select>
                    </SimField>
                    {actuatorModels.length === 0 ? <p className="text-xs leading-5 text-platform-fg-secondary" data-empty-actuator-hint>{policy.cascadeActuator.emptyHint}</p> : null}
                  </div>
                ) : null}
                <Button className={simulationUi.buttonOutline} size="sm" disabled={busy || !runId || !effectiveModel || effectiveModel.channel.endsWith('-servo')}
                  onClick={() => { void analyze('compare'); }}>运行独立对照</Button>
                {effectiveModel?.channel.endsWith('-servo') ? <p className="text-xs text-platform-fg-secondary">已冻结伺服模型可在B/C对照或运行前闭环预测中作为执行器模型选用。</p> : null}
                {selectedComparison ? <ModelComparisonCurve comparison={selectedComparison} studentModel={effectiveModel} /> : null}
              </div>
            ) : null}
          </>
        )}
        {message ? <p role="status" className="text-xs leading-5 text-platform-fg-secondary">{message}</p> : null}
      </div>
    </SimPanelSection>
  );
}
