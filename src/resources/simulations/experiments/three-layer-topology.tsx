'use client';

import { ArrowRight, AlertTriangle, Eye, Layers, Sparkles } from 'lucide-react';
import type { MismatchDiagnostics } from './mismatch-diagnostics';

export interface ThreeLayerTopologyProps {
  truthActive?: boolean;
  observerActive?: boolean;
  studentModelLabel?: string | null;
  studentModelActive?: boolean;
  compact?: boolean;
  diagnostics?: MismatchDiagnostics | null;
  onInspectMismatch?: () => void;
}

/**
 * Displays the real-time three-layer isolation dataflow:
 * TruthPlant (black-box physical simulation) -> Observer (noisy filtered sensors) -> StudentModel (student prediction),
 * plus an explicit mismatch warning badge when residual RMSE exceeds threshold.
 */
export function ThreeLayerTopology({
  truthActive = true,
  observerActive = true,
  studentModelLabel,
  studentModelActive = false,
  compact = false,
  diagnostics,
  onInspectMismatch,
}: ThreeLayerTopologyProps) {
  const unit = diagnostics?.thresholds.unitLabel ?? '';
  const peakWindow = diagnostics?.intervals[0] ?? null;

  return (
    <div
      className={compact ? 'space-y-1.5' : 'sim-hud-tile space-y-2 p-2.5'}
      data-three-layer-topology
      data-truth-isolated="true"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-platform-fg-secondary">
          <Layers className="size-3.5 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />
          三层物理隔离信号流
        </span>
        <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
          真值黑箱不可逆写
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-[11px]">
        <div
          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-emerald-800 dark:text-emerald-200"
          title="高保真六自由度连续时间物理真值层（黑箱输出，不可从学生模型回写）"
        >
          <span
            className={`size-1.5 rounded-full ${truthActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
            aria-hidden="true"
          />
          <span className="font-medium">TruthPlant</span>
          {!compact ? <span className="text-[10px] opacity-80">真值层</span> : null}
        </div>

        <ArrowRight className="size-3 shrink-0 text-platform-fg-muted" aria-hidden="true" />

        <div
          className="inline-flex items-center gap-1 rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-cyan-800 dark:text-cyan-200"
          title="传感器量化噪声、波频扰动与状态观测滤波层"
        >
          <span
            className={`size-1.5 rounded-full ${observerActive ? 'bg-cyan-500' : 'bg-slate-400'}`}
            aria-hidden="true"
          />
          <Eye className="size-3 opacity-80" aria-hidden="true" />
          <span className="font-medium">Observer</span>
          {!compact ? <span className="text-[10px] opacity-80">观测滤波</span> : null}
        </div>

        <ArrowRight className="size-3 shrink-0 text-platform-fg-muted" aria-hidden="true" />

        <div
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${
            studentModelActive
              ? 'border-amber-500/40 bg-amber-500/12 text-amber-800 dark:text-amber-200'
              : 'border-border/70 bg-muted/40 text-platform-fg-secondary'
          }`}
          title="学生在辨识/设计页冻结的线性或频域低阶模型（仅做独立预测对比）"
        >
          <span
            className={`size-1.5 rounded-full ${studentModelActive ? 'bg-amber-500' : 'bg-slate-400'}`}
            aria-hidden="true"
          />
          <span className="font-medium">StudentModel</span>
          {!compact && studentModelLabel ? (
            <span className="max-w-[8rem] truncate text-[10px] opacity-85">({studentModelLabel})</span>
          ) : null}
        </div>
      </div>

      {diagnostics && diagnostics.isExceeded ? (
        <div
          role="status"
          data-mismatch-alert
          className="sim-panel-notice flex flex-wrap items-start justify-between gap-2 rounded-md border border-amber-500/45 bg-amber-500/12 px-2.5 py-2 text-[11px] leading-4 text-amber-900 dark:text-amber-100"
          data-sim-tone="warning"
        >
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="flex items-center gap-1 font-semibold">
              <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>线性模型失配区（RMSE 超阈值）</span>
            </p>
            <p className="text-[11px] opacity-90">
              RMSE {diagnostics.rmse.toFixed(2)}
              {unit} &gt; 阈值 {diagnostics.thresholds.rmseThreshold.toFixed(2)}
              {unit} · 峰值残差 {diagnostics.peakResidual.toFixed(2)}
              {unit}
              {diagnostics.peakTimeS !== null ? ` @ t=${diagnostics.peakTimeS.toFixed(1)}s` : ''}
              {peakWindow ? ` · 失配区间 ${peakWindow.startS.toFixed(1)}–${peakWindow.endS.toFixed(1)}s` : ''}
            </p>
            <p className="text-[10px] opacity-80">{diagnostics.reasonHint}</p>
          </div>
          {onInspectMismatch ? (
            <button
              type="button"
              onClick={onInspectMismatch}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/50 bg-amber-500/20 px-2 py-1 text-[11px] font-medium text-amber-900 transition hover:bg-amber-500/30 dark:text-amber-100"
            >
              <Sparkles className="size-3" aria-hidden="true" />
              <span>问控灵成因</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
