'use client';

import { useMemo } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, ClipboardCheck, Crosshair, Link2, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import { cn } from '@/lib/utils';
import { simulationUi } from '../components/simulation-ui';
import type { FrozenVesselStudentModel, VesselModelComparison } from '../experiments/student-analysis';
import { studentModelFormula } from '../experiments/student-model-presentation';
import { SketchPad } from './sketch-pad';
import {
  vesselValue, type StepInterpretationSpec, type StepObservationMetricDef, type StepObservationSpec,
  type StepPredictionSpec, type VesselReadings, type VesselSample,
} from './vessel-experiment';

const CHANNEL_LABELS: Record<string, string> = {
  YawRate: '转艏速率', SpeedLog: '对水航速', EstimatedRoll: '横摇姿态', roll_deg: '横摇角',
  DredgerSwaySpeed: '横移速度', EquivalentAzimuth: '等效吊舱角', SurfaceEncoder0: '实际舵角',
  North: '北向位置', East: '东向位置', Heading: '航向角',
};

function modelKindLabel(kind: FrozenVesselStudentModel['payload']['structure']['kind']): string {
  if (kind === 'nomoto1') return '一阶模型';
  if (kind === 'nomoto2') return '二阶模型';
  if (kind === 'fopdt') return '一阶惯性与时滞模型';
  if (kind === 'roll_oscillator') return '二阶横摇振子模型';
  return '三自由度低频模型';
}

function extractMetricFromSamples(samples: VesselSample[], seriesId?: string, pickMode: StepObservationMetricDef['pickMode'] = 'steady'): string | null {
  if (!seriesId || samples.length === 0) return null;
  const valid = samples.map((item) => ({ t: item.time, v: vesselValue(item, seriesId) })).filter((item) => Number.isFinite(item.v));
  if (valid.length === 0) return null;
  let chosen = valid[valid.length - 1];
  if (pickMode === 'peak') chosen = valid.reduce((a, b) => (Math.abs(b.v) >= Math.abs(a.v) ? b : a), valid[0]);
  else if (pickMode === 'max') chosen = valid.reduce((a, b) => (b.v >= a.v ? b : a), valid[0]);
  else if (pickMode === 'min') chosen = valid.reduce((a, b) => (b.v <= a.v ? b : a), valid[0]);
  const abs = Math.abs(chosen.v);
  return chosen.v.toFixed(abs >= 100 ? 1 : abs < 1 ? 3 : 2);
}

function buildPredictionSummary(spec: StepPredictionSpec, next: VesselReadings): string {
  if (spec.kind === 'text' && !spec.sketch) return next.prediction ?? '';
  const parts: string[] = [];
  const choice = next.predictionChoice?.trim() ?? '';
  if (choice) parts.push(`预估判断：${spec.options?.find((o) => o.value === choice)?.label ?? choice}`);
  const target = next.predictionTarget?.trim() ?? '';
  if (target) parts.push(`预期靶标：${target}${spec.unit ? ` ${spec.unit}` : ''}`);
  const rank = next.predictionRank?.trim() ?? '';
  if (rank) parts.push(`排序预估：${rank}`);
  const rationale = next.predictionRationale?.trim() ?? '';
  if (rationale) parts.push(`依据：${rationale}`);
  if (spec.sketch) {
    const sketchEval = next.sketchEvaluation?.trim() ?? '';
    if (sketchEval) parts.push(`手绘预期：${sketchEval}`);
    else if (next.sketchImage?.startsWith('data:image/') && parts.length === 0) parts.push('已完成运行前手绘预测草图');
  }
  return parts.join('；');
}

function buildArtifactPreview(
  kind: StepObservationSpec['artifactKind'],
  models: FrozenVesselStudentModel[],
  comparisons: VesselModelComparison[],
  stepRuns: VesselRunSummary[],
): string {
  const lines: string[] = [];
  if (kind === 'model' || kind === 'dual_model' || kind === 'dp_model') {
    const picked = kind === 'dp_model' ? models.filter((m) => m.channel === 'dp-low-frequency') : models;
    for (const model of (kind === 'dual_model' ? picked.slice(-3) : picked.slice(-2))) {
      const rms = model.payload.identification.residualRms;
      lines.push(`${model.label}（${modelKindLabel(model.payload.structure.kind)}）：${studentModelFormula(model.payload.structure)}，残差RMS=${rms != null ? rms.toPrecision(3) : '—'} ${model.payload.ioContract.outputUnit}`);
    }
  }
  if (kind === 'comparison' || comparisons.length > 0) {
    const comp = comparisons.at(-1);
    if (comp) {
      const rmse = typeof comp.metrics.rmse === 'number' ? comp.metrics.rmse.toFixed(4) : '—';
      const fit = typeof comp.metrics.fit_percent === 'number' ? `${comp.metrics.fit_percent.toFixed(1)}%` : '—';
      const ch = comp.outputChannel ? (CHANNEL_LABELS[comp.outputChannel] ?? comp.outputChannel) : '目标通道';
      lines.push(`独立对照（${ch}，${comp.startS.toFixed(0)}–${comp.endS.toFixed(0)}s）：RMSE=${rmse} ${comp.outputUnit ?? ''}，FIT=${fit}`);
    }
  }
  if ((kind === 'capacity' || kind === 'spectrum' || lines.length === 0) && stepRuns.length > 0) {
    for (const run of stepRuns.slice(0, 3)) {
      const extras = [
        typeof run.configuration.propulsionPowerBudgetW === 'number' ? `功率上限 ${(run.configuration.propulsionPowerBudgetW / 1e6).toFixed(0)} MW` : '',
        typeof run.courseSettings?.windSpeedMps === 'number' ? `风速 ${run.courseSettings.windSpeedMps} m/s` : '',
      ].filter(Boolean);
      lines.push(`第${run.stepSequence}步实测运行（时长 ${run.lastTimeS.toFixed(1)}s${extras.length ? `，${extras.join('，')}` : ''}）`);
    }
  }
  return lines.join('\n');
}

export function synthesizeObservationSummary(spec: StepObservationSpec, next: VesselReadings): string {
  if (spec.kind === 'text') return next.observation ?? '';
  const lines: string[] = [];
  if (spec.kind === 'channel_match') {
    for (const pair of spec.pairs ?? []) {
      const val = next[`obs_match_${pair.id}`]?.trim();
      if (val) lines.push(`${pair.item}：${val}`);
    }
  } else if (spec.kind === 'structured_metrics') {
    for (const metric of spec.metrics ?? []) {
      const val = next[`obs_metric_${metric.key}`]?.trim();
      if (val) lines.push(`${metric.label}=${val}${metric.unit ? ` ${metric.unit}` : ''}`);
    }
  } else if (spec.kind === 'multi_run_slots') {
    for (const slot of spec.slots ?? []) {
      const filled = slot.metrics.map((m) => {
        const val = next[`obs_slot_${slot.id}_${m.key}`]?.trim();
        return val ? `${m.label}=${val}${m.unit ? ` ${m.unit}` : ''}` : '';
      }).filter(Boolean);
      if (filled.length > 0) lines.push(`[${slot.label}] ${filled.join('，')}`);
    }
  } else if (spec.kind === 'artifact_binding' && next.obs_artifact_summary?.trim()) {
    lines.push(next.obs_artifact_summary.trim());
  }
  if (next.obs_note?.trim()) lines.push(`补充记录：${next.obs_note.trim()}`);
  return lines.join('\n');
}

export function resolveActiveObservationSlotKey(
  spec: StepObservationSpec, activePickSlot?: string | null, seriesId?: string, readings?: VesselReadings,
): string | null {
  if (spec.kind === 'structured_metrics') {
    const metrics = spec.metrics ?? [];
    if (activePickSlot && metrics.some((m) => `obs_metric_${m.key}` === activePickSlot)) return activePickSlot;
    const match = (seriesId ? metrics.find((m) => m.seriesId === seriesId) : undefined) ?? metrics.find((m) => Boolean(m.seriesId)) ?? metrics[0];
    return match ? `obs_metric_${match.key}` : null;
  }
  if (spec.kind === 'multi_run_slots') {
    const slots = spec.slots ?? [];
    const curveMetrics = (metrics: StepObservationMetricDef[]) => metrics.filter((m) => Boolean(m.seriesId));
    const keys = new Set(slots.flatMap((slot) => curveMetrics(slot.metrics).map((m) => `obs_slot_${slot.id}_${m.key}`)));
    if (activePickSlot && keys.has(activePickSlot)) return activePickSlot;
    const candidates = slots.map((slot) => {
      const available = curveMetrics(slot.metrics);
      const metric = (seriesId ? available.find((m) => m.seriesId === seriesId) : undefined) ?? available[0];
      return metric ? `obs_slot_${slot.id}_${metric.key}` : null;
    }).filter((k): k is string => Boolean(k));
    return (readings ? candidates.find((k) => !readings[k]?.trim()) : undefined) ?? candidates[0] ?? null;
  }
  return null;
}

function PickSlotButton({ active, activeLabel, idleLabel, onClick }: { active: boolean; activeLabel: string; idleLabel: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[10px] transition',
      active ? 'border-platform-action-primary bg-platform-action-primary/15 text-platform-action-primary'
        : 'border-platform-fg-primary/15 text-platform-fg-muted hover:text-platform-fg-primary')}>
      {active ? activeLabel : idleLabel}
    </button>
  );
}

export function StepPredictionStage({
  spec, stepSeq, stepTitle, vesselTitle, readings, samples, runs, locked, originId, studentModel = null, onChange,
}: {
  spec: StepPredictionSpec; stepSeq: number; stepTitle: string; vesselTitle?: string;
  readings: VesselReadings; samples: VesselSample[]; runs: VesselRunSummary[];
  locked: boolean; originId?: string; studentModel?: FrozenVesselStudentModel | null; onChange: (key: string, value: string) => void;
}) {
  const matchedRuns = useMemo(() => runs.filter((run) => run.stepSequence === stepSeq), [runs, stepSeq]);
  const showOverlay = locked || samples.length > 0 || matchedRuns.length > 0;
  const actualSeries = useMemo(() => (showOverlay && spec.sketch?.overlayExtractor ? spec.sketch.overlayExtractor(samples, runs) : undefined),
    [showOverlay, spec.sketch, samples, runs]);
  const updateField = (patch: Partial<Record<string, string>>) => {
    const next: VesselReadings = { ...readings };
    for (const [k, v] of Object.entries(patch)) if (typeof v === 'string') { next[k] = v; onChange(k, v); }
    if (spec.kind !== 'text' || spec.sketch) onChange('prediction', buildPredictionSummary(spec, next));
  };
  const rankItems = useMemo(() => spec.rankItems ?? [], [spec.rankItems]);
  const currentRank = useMemo(() => {
    const saved = (readings.predictionRank ?? '').split(/\s*>\s*/).map((s) => s.trim()).filter(Boolean);
    return saved.length === rankItems.length && rankItems.every((item) => saved.includes(item)) ? saved : rankItems;
  }, [readings.predictionRank, rankItems]);
  const moveRankItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= currentRank.length) return;
    const nextOrder = [...currentRank];
    [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
    updateField({ predictionRank: nextOrder.join(' > ') });
  };

  return (
    <section className="space-y-2.5 rounded-lg border border-platform-action-primary/30 bg-platform-action-primary/5 p-3 text-xs" data-step-prediction>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={simulationUi.sectionTitle}>运行前预测</span>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
            <Lock className="h-3 w-3" aria-hidden="true" /><span>运行已开始，预测已锁定</span>
          </span>
        ) : null}
      </div>
      <p className="leading-5 text-platform-fg-primary">{spec.prompt}</p>
      {spec.kind === 'choice' && spec.options ? (
        <div className="grid gap-1.5">
          {spec.options.map((opt) => {
            const active = readings.predictionChoice === opt.value;
            return (
              <button key={opt.value} type="button" disabled={locked} aria-pressed={active} onClick={() => updateField({ predictionChoice: opt.value })}
                className={cn('w-full rounded-md border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-65',
                  active ? 'border-platform-action-primary bg-platform-action-primary/15 text-platform-fg-primary'
                    : 'border-platform-fg-primary/15 bg-platform-canvas/40 text-platform-fg-secondary hover:border-platform-action-primary/45')}>
                <span className="block font-medium text-platform-fg-primary">{opt.label}</span>
                {opt.detail ? <span className="mt-0.5 block text-[11px] leading-4 text-platform-fg-secondary">{opt.detail}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {spec.kind === 'ranking' && currentRank.length > 0 ? (
        <div className="space-y-1.5">
          {currentRank.map((item, idx) => (
            <div key={item} className="sim-hud-tile flex items-center gap-2 px-2 py-1.5">
              <span className="w-5 shrink-0 font-mono font-bold text-platform-action-primary">#{idx + 1}</span>
              <span className="min-w-0 flex-1 text-platform-fg-primary">{item}</span>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" size="sm" variant="outline" className={cn(simulationUi.buttonOutline, 'h-6 w-6 p-0')} disabled={locked || idx === 0} aria-label={`上移 ${item}`} onClick={() => moveRankItem(idx, -1)}><ArrowUp className="h-3 w-3" /></Button>
                <Button type="button" size="sm" variant="outline" className={cn(simulationUi.buttonOutline, 'h-6 w-6 p-0')} disabled={locked || idx === currentRank.length - 1} aria-label={`下移 ${item}`} onClick={() => moveRankItem(idx, 1)}><ArrowDown className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
          {!readings.predictionRank ? (
            <Button type="button" size="sm" variant="outline" className={simulationUi.buttonOutline} disabled={locked} onClick={() => updateField({ predictionRank: currentRank.join(' > ') })}>确认当前排序作为预估</Button>
          ) : null}
        </div>
      ) : null}
      {(spec.kind === 'numeric_target' || (spec.kind === 'choice' && spec.unit)) ? (
        <label className="block space-y-1 text-platform-fg-secondary">
          <span className="flex items-center justify-between">
            <span>预期数值靶标（同步显示曲线黄虚线）</span>
            {spec.unit ? <span className="font-mono text-[10px] text-platform-fg-muted">{spec.unit}</span> : null}
          </span>
          <input type="text" inputMode="decimal" disabled={locked} className="sim-hud-input font-mono tabular-nums" aria-label="预期数值靶标"
            placeholder={spec.targetPlaceholder ?? '输入预期数值'} value={readings.predictionTarget ?? ''}
            onChange={(event) => updateField({ predictionTarget: event.target.value })} />
        </label>
      ) : null}
      {spec.kind === 'text' ? (
        <textarea rows={3} disabled={locked} className="sim-hud-input" aria-label="运行前预测与方案依据"
          placeholder={spec.targetPlaceholder ?? spec.rationalePlaceholder ?? '写下运行前预测与理由...'}
          value={spec.sketch ? (readings.predictionRationale ?? readings.prediction ?? '') : (readings.prediction ?? '')}
          onChange={(event) => spec.sketch ? updateField({ predictionRationale: event.target.value }) : onChange('prediction', event.target.value)} />
      ) : null}
      {spec.allowRationale && spec.kind !== 'text' ? (
        <label className="block space-y-1 text-platform-fg-secondary">
          <span>一句话物理依据</span>
          <input type="text" disabled={locked} className="sim-hud-input" aria-label="预估物理依据"
            placeholder={spec.rationalePlaceholder ?? '简述你的物理判断依据...'} value={readings.predictionRationale ?? ''}
            onChange={(event) => updateField({ predictionRationale: event.target.value })} />
        </label>
      ) : null}
      {spec.sketch ? (
        <SketchPad
          key={`pred-sketch-${stepSeq}-${spec.sketch.plotId}`} mode="prediction" defaultPlotId={spec.sketch.plotId}
          lockPlotId={spec.sketch.lockPlotId} label={spec.sketch.label} hint={spec.sketch.hint}
          coordinateOverride={spec.sketch.coordinateOverride}
          context={{
            mode: 'prediction', plotId: spec.sketch.plotId, stepSeq, stepTitle,
            vesselTitle, promptFocus: spec.sketch.promptFocus, originId,
          }}
          value={readings.sketchImage} studentModel={studentModel} disabled={locked} actualSeries={actualSeries}
          onChange={(dataUrl) => updateField({ sketchImage: dataUrl })}
          onRecognized={(verdict) => updateField({ sketchKind: verdict.sketchKind, sketchBlank: verdict.sketchBlank ? '1' : '0', sketchEvaluation: verdict.sketchEvaluation })}
        />
      ) : null}
    </section>
  );
}

export function StepObservationStage({
  spec, readings, samples, runs, models, comparisons, stepSeq, onChange, activePickSlot, onChangeActivePickSlot,
}: {
  spec: StepObservationSpec; readings: VesselReadings; samples: VesselSample[]; runs: VesselRunSummary[];
  models: FrozenVesselStudentModel[]; comparisons: VesselModelComparison[]; stepSeq: number;
  onChange: (key: string, value: string) => void; activePickSlot?: string | null; onChangeActivePickSlot?: (slotKey: string) => void;
}) {
  const stepRuns = useMemo(() => runs.filter((run) => run.stepSequence === stepSeq), [runs, stepSeq]);
  const artifactPreview = useMemo(() => buildArtifactPreview(spec.artifactKind, models, comparisons, stepRuns),
    [spec.artifactKind, models, comparisons, stepRuns]);
  const commitBatch = (patch: Record<string, string>) => {
    const next: VesselReadings = { ...readings, ...patch };
    for (const [k, v] of Object.entries(patch)) onChange(k, v);
    onChange('observation', synthesizeObservationSummary(spec, next));
  };
  if (spec.kind === 'text') {
    return (
      <label className="block space-y-1 text-xs text-platform-fg-secondary" data-step-observation>
        <span>本人读数与观察记录</span>
        <textarea rows={3} className="sim-hud-input" aria-label="本人读数与观察记录"
          placeholder={spec.placeholder ?? '记录实测曲线变化与关键数值...'} value={readings.observation ?? ''}
          onChange={(event) => onChange('observation', event.target.value)} />
      </label>
    );
  }
  const pairs = spec.pairs ?? [];
  const pairDone = pairs.filter((pair) => Boolean(readings[`obs_match_${pair.id}`]?.trim())).length;

  return (
    <div className="space-y-2.5 rounded-lg border border-platform-fg-primary/15 bg-platform-canvas/35 p-2.5 text-xs" data-step-observation>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-platform-fg-primary">运行中观察与采集</span>
        {spec.kind === 'channel_match' ? (
          <span className="rounded bg-platform-action-primary/12 px-1.5 py-0.5 font-mono text-[10px] text-platform-action-primary">已完成 {pairDone}/{pairs.length} 项</span>
        ) : null}
      </div>
      <p className="text-platform-fg-secondary">{spec.prompt}</p>
      {spec.kind === 'channel_match' ? pairs.map((pair) => {
        const val = readings[`obs_match_${pair.id}`] ?? '';
        return (
          <div key={pair.id} className="sim-hud-tile space-y-1.5 p-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-platform-fg-primary">{pair.item}</span>
              {pair.hint ? <span className="text-[10px] text-platform-fg-muted">{pair.hint}</span> : null}
            </div>
            <div className="flex flex-wrap gap-1">
              {pair.choices.map((choice) => (
                <Button key={choice} type="button" size="sm" variant={val === choice ? 'default' : 'outline'} className={val === choice ? simulationUi.buttonPrimary : simulationUi.buttonOutline} onClick={() => commitBatch({ [`obs_match_${pair.id}`]: choice })}>{choice}</Button>
              ))}
            </div>
          </div>
        );
      }) : null}
      {spec.kind === 'structured_metrics' ? (spec.metrics ?? []).map((metric) => {
        const fieldKey = `obs_metric_${metric.key}`;
        return (
          <div key={metric.key} className="sim-hud-tile space-y-1 p-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="font-medium text-platform-fg-primary">{metric.label}{metric.unit ? <span className="ml-1 font-mono text-[10px] text-platform-fg-muted">({metric.unit})</span> : null}</span>
              <div className="flex items-center gap-1">
                {onChangeActivePickSlot && metric.seriesId ? <PickSlotButton active={activePickSlot === fieldKey} activeLabel="曲线拾取目标" idleLabel="设为拾取目标" onClick={() => onChangeActivePickSlot(fieldKey)} /> : null}
                {metric.seriesId ? (
                  <Button type="button" size="sm" variant="outline" disabled={samples.length === 0} className={cn(simulationUi.buttonOutline, 'h-6 px-2 text-[11px]')}
                    onClick={() => { const val = extractMetricFromSamples(samples, metric.seriesId, metric.pickMode); if (val !== null) commitBatch({ [fieldKey]: val }); }}>
                    <Crosshair className="mr-1 h-3 w-3" aria-hidden="true" /><span>从当前曲线读取</span>
                  </Button>
                ) : null}
              </div>
            </div>
            <input type="text" className="sim-hud-input font-mono tabular-nums" aria-label={metric.label} placeholder={metric.placeholder ?? '输入或从曲线读取'} value={readings[fieldKey] ?? ''} onChange={(event) => commitBatch({ [fieldKey]: event.target.value })} />
          </div>
        );
      }) : null}
      {spec.kind === 'multi_run_slots' ? (spec.slots ?? []).map((slot) => {
        const matchedRun = slot.matcher ? stepRuns.find((r) => r.stoppedAtMs !== null && slot.matcher!(r)) ?? stepRuns.find((r) => slot.matcher!(r)) : undefined;
        const done = Boolean(matchedRun && matchedRun.stoppedAtMs !== null);
        const canExtract = Boolean((matchedRun && slot.metrics.some((m) => m.extract)) || (samples.length > 0 && slot.metrics.some((m) => m.seriesId)));
        const badgeTone = done ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : matchedRun ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'border-platform-fg-primary/15 bg-platform-canvas/40 text-platform-fg-muted';
        return (
          <div key={slot.id} className="sim-hud-tile space-y-1.5 p-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="min-w-0">
                <span className="font-medium text-platform-fg-primary">{slot.label}</span>
                {slot.conditionHint ? <span className="ml-1.5 text-[10px] text-platform-fg-muted">{slot.conditionHint}</span> : null}
              </div>
              <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium', badgeTone)}>
                {done ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : null}
                <span>{done ? `已采集 · ${matchedRun!.lastTimeS.toFixed(1)}s` : matchedRun ? `运行中 · ${matchedRun.lastTimeS.toFixed(1)}s` : '待运行'}</span>
              </span>
            </div>
            <div className="grid gap-1.5">
              {slot.metrics.map((metric) => {
                const slotKey = `obs_slot_${slot.id}_${metric.key}`;
                return (
                  <div key={slotKey} className="flex items-center gap-1.5">
                    <span className="w-24 shrink-0 truncate text-[11px] text-platform-fg-secondary" title={metric.label}>{metric.label}{metric.unit ? `(${metric.unit})` : ''}</span>
                    <input type="text" className="sim-hud-input h-7 min-w-0 flex-1 font-mono text-[11px] tabular-nums" aria-label={`${slot.label} ${metric.label}`} placeholder={metric.placeholder ?? '填读数'} value={readings[slotKey] ?? ''} onChange={(event) => commitBatch({ [slotKey]: event.target.value })} />
                    {onChangeActivePickSlot && metric.seriesId ? <PickSlotButton active={activePickSlot === slotKey} activeLabel="拾取中" idleLabel="曲线填入" onClick={() => onChangeActivePickSlot(slotKey)} /> : null}
                  </div>
                );
              })}
            </div>
            {slot.metrics.some((m) => m.extract || m.seriesId) ? (
              <Button type="button" size="sm" variant="outline" disabled={!canExtract} className={cn(simulationUi.buttonOutline, 'h-6 px-2 text-[11px]')}
                onClick={() => {
                  const patch: Record<string, string> = {};
                  for (const m of slot.metrics) {
                    const val = (matchedRun && m.extract ? m.extract(matchedRun) : null) ?? (m.seriesId ? extractMetricFromSamples(samples, m.seriesId, m.pickMode) : null);
                    if (val !== null) patch[`obs_slot_${slot.id}_${m.key}`] = val;
                  }
                  if (Object.keys(patch).length > 0) commitBatch(patch);
                }}>
                <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" /><span>一键提取本工况读数</span>
              </Button>
            ) : null}
          </div>
        );
      }) : null}
      {spec.kind === 'artifact_binding' ? (
        <div className="sim-hud-tile space-y-2 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 font-medium text-platform-fg-primary"><Link2 className="h-3.5 w-3.5 text-platform-action-primary" aria-hidden="true" /><span>关联工件与定量证据</span></span>
            <Button type="button" size="sm" variant="outline" disabled={!artifactPreview} className={cn(simulationUi.buttonOutline, 'h-6 px-2 text-[11px]')} onClick={() => commitBatch({ obs_artifact_summary: artifactPreview })}>一键引用已冻结工件摘要</Button>
          </div>
          <p className="whitespace-pre-wrap text-[11px] leading-4 text-platform-fg-secondary">{artifactPreview || '尚未在评估工作台冻结本步所需模型或对照结果，请先完成保存后点击引用。'}</p>
          {readings.obs_artifact_summary ? <p className="rounded bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300">已引用：{readings.obs_artifact_summary}</p> : null}
        </div>
      ) : null}
      <label className="block space-y-1 text-platform-fg-secondary">
        <span>补充观察备注（可选）</span>
        <input type="text" className="sim-hud-input" aria-label="补充观察备注" placeholder={spec.placeholder ?? '可补充记录拐点时刻或异常现象...'} value={readings.obs_note ?? ''} onChange={(event) => commitBatch({ obs_note: event.target.value })} />
      </label>
    </div>
  );
}

export function StepInterpretationStage({
  spec, value, checksValue = '', onChange,
}: {
  spec: StepInterpretationSpec; value: string; checksValue?: string; onChange: (key: string, value: string) => void;
}) {
  const parts = checksValue.split('|');
  const toggleCheck = (index: number) => {
    onChange('interpChecks', spec.checklist.map((_, idx) => ((idx === index ? parts[idx] !== '1' : parts[idx] === '1') ? '1' : '0')).join('|'));
  };
  return (
    <div className="space-y-2 text-xs" data-step-interpretation>
      <div className="flex items-center gap-1.5 font-medium text-platform-fg-primary">
        <ClipboardCheck className="h-3.5 w-3.5 text-platform-action-primary" aria-hidden="true" /><span>因果解释与适用边界</span>
      </div>
      {spec.checklist.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {spec.checklist.map((item, idx) => {
            const checked = parts[idx] === '1';
            return (
              <label key={item} className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition',
                checked ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'border-platform-fg-primary/15 bg-platform-canvas/40 text-platform-fg-secondary')}>
                <input type="checkbox" className="h-3 w-3" checked={checked} onChange={() => toggleCheck(idx)} /><span>{item}</span>
              </label>
            );
          })}
        </div>
      ) : null}
      <textarea rows={3} className="sim-hud-input" aria-label="因果解释与适用边界" placeholder={spec.placeholder} value={value} onChange={(event) => onChange('interpretation', event.target.value)} />
    </div>
  );
}
