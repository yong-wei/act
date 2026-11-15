'use client';

import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, PlusCircle } from 'lucide-react';
import { VESSEL_REPORT_SECTION_LABELS, type VesselReportSections } from '@/features/ilab/course-artifact-contract';
import type { VesselSessionConfiguration } from '@/lib/control-engine/vessel-session';

export type VesselReportSectionKey = keyof VesselReportSections;
import type { FrozenVesselStudentModel, VesselModelComparison } from './student-analysis';
import { studentModelFormula } from './student-model-presentation';

export interface Step20RunSummary {
  id: string;
  stepSequence: number;
  lastTimeS: number;
  stopReason: string | null;
  createdAtMs: number;
  configuration?: VesselSessionConfiguration | null;
  faultOccurred?: boolean;
  faultSummary?: string | null;
}

export function resolveRunFaultEvidence(run: Step20RunSummary): {
  isFault: boolean;
  detail: string | null;
} {
  if (typeof run.faultOccurred === 'boolean') {
    return {
      isFault: run.faultOccurred,
      detail: run.faultOccurred ? (run.faultSummary ?? '含故障注入工况验证') : null,
    };
  }
  const cfg = run.configuration;
  if (cfg?.cruise?.finFailureTimeS != null && run.lastTimeS >= cfg.cruise.finFailureTimeS) {
    return {
      isFault: true,
      detail: `含 t≥${cfg.cruise.finFailureTimeS}s 减摇鳍卡阻故障段验证`,
    };
  }
  if (cfg?.driveCutFault && run.lastTimeS >= 180) {
    return {
      isFault: true,
      detail: '含 t≥180s 推进器断桨故障重分配验证',
    };
  }
  if (cfg?.gnssOutageFault && run.lastTimeS >= 60) {
    return {
      isFault: true,
      detail: '含卫导中断降级观测验证',
    };
  }
  if ((cfg?.headingBiasFault || cfg?.azimuthJamFault) && run.lastTimeS > 0) {
    return {
      isFault: true,
      detail: '含传感器偏置/全回转卡滞故障验证',
    };
  }
  if (run.stopReason === 'failure') {
    return {
      isFault: true,
      detail: '运行触发故障保护终止',
    };
  }
  return { isFault: false, detail: null };
}

export interface EvidenceCapsule {
  id: string;
  category: 'model' | 'comparison' | 'fault_run' | 'run';
  badge: string;
  summary: string;
  snippet: string;
}

export interface Step20RubricDimension {
  key: 'assumptions' | 'evidence' | 'tradeoff' | 'safety';
  label: string;
  maxPoints: number;
  previewPoints: number;
  met: boolean;
  hint: string;
}

export interface Step20RubricResult {
  totalPreviewScore: number;
  maxTotalScore: number;
  dimensions: Step20RubricDimension[];
}

const SECTION_KEYS = Object.keys(VESSEL_REPORT_SECTION_LABELS) as VesselReportSectionKey[];

/**
 * Build quantitative evidence capsules from frozen models, comparisons, and completed runs.
 */
export function buildStep20EvidenceCapsules({
  models,
  comparisons,
  runs,
}: {
  models: FrozenVesselStudentModel[];
  comparisons: VesselModelComparison[];
  runs: Step20RunSummary[];
}): EvidenceCapsule[] {
  const capsules: EvidenceCapsule[] = [];

  for (const model of models) {
    const formula = studentModelFormula(model.payload.structure);
    const rms = model.payload.identification.residualRms;
    capsules.push({
      id: `model-${model.id}`,
      category: 'model',
      badge: '冻结模型',
      summary: `${model.label} · ${formula}`,
      snippet: `[冻结模型 ${model.label}] ${formula}，采样周期 ${model.payload.sampleDt}s，训练残差 RMS=${rms != null ? rms.toPrecision(4) : '—'} ${model.payload.ioContract.outputUnit}。`,
    });
  }

  for (const comp of comparisons) {
    const rmse = typeof comp.metrics.rmse === 'number' ? comp.metrics.rmse.toFixed(4) : '—';
    const fit = typeof comp.metrics.fit_percent === 'number' ? `${comp.metrics.fit_percent.toFixed(1)}%` : '—';
    capsules.push({
      id: `comp-${comp.id}`,
      category: 'comparison',
      badge: '模型对照',
      summary: `${comp.outputChannel ?? '通道'} · RMSE ${rmse} · FIT ${fit}`,
      snippet: `[对照验证 ${comp.startS.toFixed(1)}–${comp.endS.toFixed(1)}s] ${comp.outputChannel ?? '通道'} 实测与预测 RMSE=${rmse} ${comp.outputUnit ?? ''}，FIT=${fit}。`,
    });
  }

  for (const run of runs) {
    const faultEvidence = resolveRunFaultEvidence(run);
    capsules.push({
      id: `run-${run.id}`,
      category: faultEvidence.isFault ? 'fault_run' : 'run',
      badge: faultEvidence.isFault ? '故障/异常工况' : '实测运行',
      summary: `第 ${run.stepSequence} 步 · ${run.lastTimeS.toFixed(1)} s`,
      snippet: `[第${run.stepSequence}步实测] 运行时长 ${run.lastTimeS.toFixed(1)}s${faultEvidence.detail ? `（${faultEvidence.detail}）` : ''}。`,
    });
  }

  return capsules;
}

/**
 * Evaluate 4-dimension Step 20 report rubric alignment (3 + 3 + 2 + 2 = 10 pts).
 */
export function evaluateStep20Rubric(
  readings: Record<string, string | undefined>,
  counts: { models: number; comparisons: number; runs: number },
): Step20RubricResult {
  const joined = [
    ...SECTION_KEYS.map((key) => readings[key] ?? ''),
    readings.problem ?? '',
    readings.identification ?? '',
    readings.comparison ?? '',
    readings.revision ?? '',
    readings.validation ?? '',
    readings.conclusion ?? '',
  ].join('\n');
  const trimmedLen = joined.trim().length;

  const assumptionText = `${readings.studyObjectAndAssumptions ?? ''} ${readings.identificationResultsAndChecks ?? ''} ${readings.problem ?? ''} ${readings.identification ?? ''}`.trim();
  const identText = `${readings.identificationResultsAndChecks ?? ''} ${readings.identification ?? ''}`.trim();
  const comparisonText = `${readings.controlDesignAndComparison ?? ''} ${readings.comparison ?? ''} ${readings.revision ?? ''}`.trim();
  const safetyText = `${readings.boundaryAndFailureDiscussion ?? ''} ${readings.revision ?? ''} ${readings.validation ?? ''} ${readings.conclusion ?? ''}`.trim();
  const conclusionText = `${readings.conclusion ?? ''}`.trim();

  const hasAssumptions =
    /(模型|一阶|二阶|时滞|振子|线性化|工作点|假设|惯性|适用域|K|T|ζ|ωn)/i.test(assumptionText) &&
    (identText.length >= 12 || assumptionText.length >= 24);

  const hasQuantitativeEvidence =
    counts.runs + counts.comparisons + counts.models > 0 &&
    /(RMSE|FIT|实测|t=|第\d+步|残差|误差|秒|\d+\.\d+)/i.test(joined);

  const hasComparison =
    /(比较|对比|权衡|方案|调度|前馈|解耦|代价|功耗|油耗|ETA|舒适|MSI)/i.test(comparisonText) &&
    comparisonText.length >= 12;

  const hasSafety =
    /(边界|饱和|限幅|35°|32MW|失速|180s|断桨|警戒|解脱|2\.5m|外推|失配|卡阻)/i.test(safetyText) &&
    conclusionText.length >= 10;

  const dimensions: Step20RubricDimension[] = [
    {
      key: 'assumptions',
      label: '模型假设与结构适用域',
      maxPoints: 3,
      previewPoints: hasAssumptions ? 3 : trimmedLen > 20 ? 1 : 0,
      met: hasAssumptions,
      hint: '在「研究对象与模型假设 / 辨识与校验」写清模型结构、工作点与适用域前提。',
    },
    {
      key: 'evidence',
      label: '实证数据与误差定量绑定',
      maxPoints: 3,
      previewPoints: hasQuantitativeEvidence ? 3 : counts.runs > 0 ? 1 : 0,
      met: hasQuantitativeEvidence,
      hint: '插入至少一条带时间戳/RMSE/FIT 的本人实测或对照胶囊。',
    },
    {
      key: 'tradeoff',
      label: '多方案比较与权衡分析',
      maxPoints: 2,
      previewPoints: hasComparison ? 2 : comparisonText.length > 6 ? 1 : 0,
      met: hasComparison,
      hint: '在「控制方案设计与比较」阐述调度、前馈或舒适/油耗权衡依据。',
    },
    {
      key: 'safety',
      label: '安全包络与失效边界陈述',
      maxPoints: 2,
      previewPoints: hasSafety ? 2 : 0,
      met: hasSafety,
      hint: '明确饱和限幅、t=180s 故障或海工安全包络边界并在结论总结。',
    },
  ];

  return {
    totalPreviewScore: dimensions.reduce((sum, item) => sum + item.previewPoints, 0),
    maxTotalScore: 10,
    dimensions,
  };
}

export function Step20EvidenceWorkbench({
  readings,
  activeSection,
  onSelectSection,
  onInsertSnippet,
  models,
  comparisons,
  runs,
}: {
  readings: Record<string, string | undefined>;
  activeSection: VesselReportSectionKey;
  onSelectSection: (section: VesselReportSectionKey) => void;
  onInsertSnippet: (section: VesselReportSectionKey, snippet: string) => void;
  models: FrozenVesselStudentModel[];
  comparisons: VesselModelComparison[];
  runs: Step20RunSummary[];
}) {
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const capsules = buildStep20EvidenceCapsules({ models, comparisons, runs });
  const rubric = evaluateStep20Rubric(readings, {
    models: models.length,
    comparisons: comparisons.length,
    runs: runs.length,
  });

  const handleInsert = (capsule: EvidenceCapsule) => {
    const existing = readings[activeSection]?.trim() ?? '';
    const nextText = existing ? `${existing}\n${capsule.snippet}` : capsule.snippet;
    onInsertSnippet(activeSection, nextText);
    setInsertedId(capsule.id);
  };

  return (
    <div className="space-y-3 rounded-lg border border-platform-border/80 bg-background/50 p-2.5 text-xs" data-step20-evidence-workbench>
      {/* 四维 AI 量规预检高亮 */}
      <div className="space-y-1.5" data-step20-rubric-precheck>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 font-semibold text-platform-fg-primary">
            <ClipboardCheck className="size-3.5 text-emerald-500" aria-hidden="true" />
            <span>四维报告量规对齐预检</span>
          </span>
          <span className="font-mono font-semibold text-platform-fg-secondary">
            自检覆盖 {rubric.totalPreviewScore}/{rubric.maxTotalScore} 分
          </span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {rubric.dimensions.map((dim) => (
            <div
              key={dim.key}
              data-rubric-dimension={dim.key}
              data-rubric-met={dim.met ? 'true' : 'false'}
              className={`rounded border px-2 py-1.5 ${
                dim.met
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between font-medium">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className={`size-3 ${dim.met ? 'opacity-100' : 'opacity-40'}`} aria-hidden="true" />
                  <span>{dim.label}</span>
                </span>
                <span className="font-mono text-[10px]">{dim.previewPoints}/{dim.maxPoints}</span>
              </div>
              {!dim.met ? <p className="mt-0.5 text-[10px] opacity-85">{dim.hint}</p> : null}
            </div>
          ))}
        </div>
      </div>

      {/* 步 1-19 实测证据胶囊库 */}
      <div className="space-y-1.5" data-step20-capsule-library>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-platform-fg-primary">步 1–19 实测证据胶囊</span>
          <select
            aria-label="插入证据目标章节"
            className="sim-hud-input h-7 w-auto px-2 py-0.5 text-[11px]"
            value={activeSection}
            onChange={(event) => onSelectSection(event.target.value as VesselReportSectionKey)}
          >
            {SECTION_KEYS.map((key) => (
              <option key={key} value={key}>
                插入至：{VESSEL_REPORT_SECTION_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        {capsules.length === 0 ? (
          <p className="text-[11px] text-platform-fg-muted">
            尚无本轮冻结模型或独立对照，可在运行实验并冻结模型后返回一键引用。
          </p>
        ) : (
          <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
            {capsules.map((capsule) => (
              <li
                key={capsule.id}
                className="flex items-start justify-between gap-2 rounded border border-platform-border/70 bg-platform-surface/50 px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <span className="mr-1.5 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-800 dark:text-cyan-200">
                    {capsule.badge}
                  </span>
                  <span className="text-[11px] text-platform-fg-secondary">{capsule.summary}</span>
                </div>
                <button
                  type="button"
                  data-insert-capsule={capsule.id}
                  onClick={() => handleInsert(capsule)}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                >
                  <PlusCircle className="size-3" aria-hidden="true" />
                  <span>{insertedId === capsule.id ? '已插入' : '+ 插入证据胶囊'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
