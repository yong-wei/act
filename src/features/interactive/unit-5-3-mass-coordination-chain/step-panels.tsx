'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  createManifestContentModuleRegistry,
} from '@/features/interactive/shared/manifest-runtime/content-renderers';
import {
  createManifestStudentActivityRegistry,
  createManifestTeacherActivityRegistry,
  renderStudentInteractiveActivity,
  renderTeacherInteractiveActivity,
  type ManifestStepResponse,
} from '@/features/interactive/shared/manifest-runtime/activity-renderers';
import {
  type InteractiveModuleRegistry,
  renderInteractiveManifestStep,
  type InteractiveRuntimeModuleManifest,
  type InteractiveRuntimeStepManifest,
} from '@/features/interactive/shared/manifest-runtime/layout-renderer';
import {
  getUNIT_5_3ManifestStepFromManifest,
  type UNIT_5_3StepDefinition,
} from '@/lib/unit-5-3-course';
import type { InteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import {
  createFallbackNonlinearAnalysisResult,
  useNonlinearAnalysisEngine,
} from '@/resources/control-system/analysis/use-nonlinear-analysis-engine';
import type {
  NonlinearAnalysisRequest,
  NonlinearAnalysisResult,
  NonlinearPoint,
} from '@/resources/control-system/analysis/nonlinear-analysis-types';

type TeacherResponseItem = { studentName: string; response: ManifestStepResponse };
type ContentRecord = Record<string, unknown>;
type ContentRegistryExtra = {
  revealProgress: number;
  allowInlineReveal: boolean;
  onInlineReveal?: () => void;
};
type CurveSeries = { id: string; label: string; color: string; points: NonlinearPoint[]; dashed?: boolean };

function requireUnit53Manifest(manifest: InteractiveRuntimeManifest | null | undefined) {
  if (!manifest) {
    throw new Error('5-3 runtime manifest is required for page rendering.');
  }
  return manifest;
}

function asRecord(value: unknown): ContentRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ContentRecord : {};
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numeric(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function panelId(module: InteractiveRuntimeModuleManifest) {
  return asString(module.payload.panel_id ?? module.payload.panelId, module.id);
}

function turningRadiusRequest(radius: number): NonlinearAnalysisRequest {
  return {
    runtimeMode: 'nonlinear_analysis',
    analysisKind: 'turning_radius',
    modelId: 'mass_avoidance_turn',
    parameters: { R_m: radius },
    timeRange: { start: 0, end: 82, samples: 180 },
  };
}

function scaleSeries(series: CurveSeries[]) {
  const points = series.flatMap((item) => item.points);
  const safePoints = points.length ? points : [{ x: 0, y: 0 }];
  const xs = safePoints.map((point) => point.x);
  const ys = safePoints.map((point) => point.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 170);
  const minY = Math.min(...ys, -50);
  const maxY = Math.max(...ys, 120);
  const scaleX = (x: number) => 36 + ((x - minX) / Math.max(1e-6, maxX - minX)) * 568;
  const scaleY = (y: number) => 294 - ((y - minY) / Math.max(1e-6, maxY - minY)) * 238;
  return { scaleX, scaleY };
}

function SvgPathPanel({
  series,
  obstacle,
}: {
  series: CurveSeries[];
  obstacle?: { center: NonlinearPoint; radius: number; clearanceRadius: number };
}) {
  const { scaleX, scaleY } = scaleSeries(series);
  return (
    <svg viewBox="0 0 640 340" className="h-[340px] w-full rounded-xl border border-slate-200 bg-white">
      <line x1="36" y1="294" x2="604" y2="294" stroke="#cbd5e1" />
      <line x1="36" y1="56" x2="36" y2="294" stroke="#cbd5e1" />
      {obstacle ? (
        <>
          <circle
            cx={scaleX(obstacle.center.x)}
            cy={scaleY(obstacle.center.y)}
            r={Math.max(6, Math.abs(scaleX(obstacle.center.x + obstacle.radius) - scaleX(obstacle.center.x)))}
            fill="#fee2e2"
            stroke="#dc2626"
            strokeWidth="2"
          />
          <circle
            cx={scaleX(obstacle.center.x)}
            cy={scaleY(obstacle.center.y)}
            r={Math.max(8, Math.abs(scaleX(obstacle.center.x + obstacle.clearanceRadius) - scaleX(obstacle.center.x)))}
            fill="none"
            stroke="#f97316"
            strokeDasharray="6 5"
            strokeWidth="2"
          />
        </>
      ) : null}
      {series.map((item) => {
        const d = item.points
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x).toFixed(1)} ${scaleY(point.y).toFixed(1)}`)
          .join(' ');
        return (
          <g key={item.id}>
            <path
              d={d}
              fill="none"
              stroke={item.color}
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={item.dashed ? '6 5' : undefined}
            />
          </g>
        );
      })}
      {series.map((item, index) => (
        <g key={item.id} transform={`translate(${390}, ${32 + index * 18})`}>
          <line x1="0" y1="0" x2="24" y2="0" stroke={item.color} strokeWidth="3" strokeDasharray={item.dashed ? '6 5' : undefined} />
          <text x="30" y="4" className="fill-slate-600 text-[11px]">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}

function TurningHeadingPanel({ result }: { result: NonlinearAnalysisResult | null }) {
  const curves = result?.turningRadius?.headingCurves ?? [];
  const timeSeries: CurveSeries[] = curves.map((curve, index) => ({
    id: curve.id,
    label: curve.label,
    color: ['#2563eb', '#dc2626', '#0f766e', '#7c3aed'][index] ?? '#475569',
    points: curve.points,
    dashed: curve.id.includes('target'),
  }));
  return <SvgPathPanel series={timeSeries} />;
}

function TurningRadiusPanel({
  step,
  module,
  onParameterChange,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
}) {
  const [radius, setRadius] = useState(140);
  const request = useMemo(() => turningRadiusRequest(radius), [radius]);
  const fallback = useMemo(() => createFallbackNonlinearAnalysisResult(request), [request]);
  const {
    result,
    error,
    isFallback,
    requestKey,
    resultRequestKey,
  } = useNonlinearAnalysisEngine(request, fallback);
  const displayResult = resultRequestKey === requestKey ? result : null;
  const turning = displayResult?.turningRadius;
  const pathSeries: CurveSeries[] = [
    { id: 'actual', label: '实际航迹', color: '#2563eb', points: turning?.path.actual ?? [] },
    { id: 'nominal', label: '名义规划圆弧', color: '#f97316', points: turning?.path.nominal ?? [], dashed: true },
  ];
  const obstacle = turning
    ? {
      center: turning.path.obstacleCenter,
      radius: turning.path.obstacleRadius,
      clearanceRadius: turning.path.clearanceRadius,
    }
    : undefined;
  const metrics = [
    ['避障启动距离', `${turning?.dStartM.toFixed(1) ?? '--'} m`],
    ['名义舵角', `${turning?.deltaDDeg.toFixed(2) ?? '--'}°`],
    ['最大实际舵角', `${turning?.maxDeltaDeg.toFixed(2) ?? '--'}°`],
    ['舵角饱和', turning?.saturationActive ? '已触发' : '未触发'],
    ['安全约束', turning?.safetyConstraintSatisfied ? '满足' : '不满足'],
  ];

  useEffect(() => {
    if (!turning) return;
    onParameterChange?.(step.id, {
      R_m: String(radius),
      d_start_m: turning.dStartM.toFixed(2),
      delta_d_deg: turning.deltaDDeg.toFixed(2),
      max_delta_deg: turning.maxDeltaDeg.toFixed(2),
      saturation_active: String(turning.saturationActive),
      safety_constraint_satisfied: String(turning.safetyConstraintSatisfied),
    });
  }, [onParameterChange, radius, step.id, turning]);

  return (
    <section className="premium-lesson-panel space-y-4" data-nonlinear-panel="rust_turning_radius_panel">
      <div>
        <div className="premium-lesson-kicker">Rust/WASM 转弯半径联动面板</div>
        <h3 className="premium-lesson-title mt-1 text-lg font-semibold">{asString(module.payload.title, step.title)}</h3>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <SvgPathPanel series={pathSeries} obstacle={obstacle} />
        <div className="space-y-4">
          <TurningHeadingPanel result={displayResult} />
          <label className="block rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
            <span className="flex justify-between">
              <span>规划半径 R_m</span>
              <span>{radius.toFixed(0)} m</span>
            </span>
            <input
              type="range"
              min={35}
              max={160}
              step={5}
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
              className="mt-3 w-full"
            />
          </label>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        {metrics.map(([label, value]) => (
          <div key={label} className="premium-lesson-surface-elevated px-3 py-3">
            <div className="premium-lesson-caption text-xs">{label}</div>
            <div className="premium-lesson-title mt-1 text-base font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-white p-3 text-xs leading-6 text-slate-600">
        <div className="font-semibold text-slate-800">{displayResult?.summary.outcome ?? '等待计算'}</div>
        {(displayResult?.summary.metrics ?? []).map((item) => <div key={item}>{item}</div>)}
        {error || (displayResult && isFallback) ? <div className="mt-2 text-amber-700">{error ?? displayResult?.fallbackMessage}</div> : null}
      </div>
    </section>
  );
}

export function Unit53StudentSummaryStats({
  submittedCount,
  viewedCount,
  turningSubmissionCount,
  prePostCompletion,
}: {
  submittedCount: number;
  viewedCount: number;
  turningSubmissionCount: number;
  prePostCompletion: string;
}) {
  const abilitySummary = turningSubmissionCount > 0 ? '已形成避碰转弯半径证据记录' : '继续补齐可行半径判断证据';
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-3-student-summary-stats">
      <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">个人课堂表现</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">已浏览页面</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{viewedCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">提交页面</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{submittedCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">半径探索提交</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{turningSubmissionCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">后测完成</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">{prePostCompletion}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3 sm:col-span-4">
          <div className="premium-lesson-caption text-xs">学习记录判断</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">{abilitySummary}</div>
        </div>
      </div>
    </section>
  );
}

export function Unit53TeacherSummaryStats({
  studentCount,
  submittedStudents,
  totalResponses,
  turningCoverage,
  objectiveAccuracy,
  postTestCompletion,
  misconceptionSummary,
}: {
  studentCount: number;
  submittedStudents: number;
  totalResponses: number;
  turningCoverage: number;
  objectiveAccuracy: number;
  postTestCompletion: number;
  misconceptionSummary: string;
}) {
  const rate = studentCount ? Math.round((submittedStudents / studentCount) * 100) : 0;
  return (
    <section className="premium-lesson-panel p-4" data-testid="unit-5-3-teacher-summary-stats">
      <div className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">班级整体表现统计</div>
      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">参与学生</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{studentCount}</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">提交覆盖</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{rate}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">客观题正确率</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{objectiveAccuracy}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">后测完成率</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{postTestCompletion}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3">
          <div className="premium-lesson-caption text-xs">半径探索覆盖</div>
          <div className="premium-lesson-title mt-1 text-2xl font-semibold">{turningCoverage}%</div>
        </div>
        <div className="premium-lesson-surface-elevated px-3 py-3 md:col-span-5">
          <div className="premium-lesson-caption text-xs">常见误判标签</div>
          <div className="premium-lesson-title mt-1 text-sm font-semibold">
            {misconceptionSummary} · 提交总数 {totalResponses}
          </div>
        </div>
      </div>
    </section>
  );
}

export function UNIT_5_3StepContentPanel({
  step,
  manifest,
  revealProgress,
  allowInlineReveal,
  browseEnabled = true,
  role,
  submittedCount = 0,
  viewedCount = 0,
  studentCount = 0,
  submittedStudents = 0,
  totalResponses = 0,
  turningSubmissionCount = 0,
  prePostCompletion = '等待提交',
  turningCoverage = 0,
  objectiveAccuracy = 0,
  postTestCompletion = 0,
  misconceptionSummary = '暂无聚合',
  onParameterChange,
  onAdvanceReveal,
}: {
  step: UNIT_5_3StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  revealProgress: number;
  allowInlineReveal: boolean;
  browseEnabled?: boolean;
  role: 'student' | 'teacher';
  submittedCount?: number;
  viewedCount?: number;
  studentCount?: number;
  submittedStudents?: number;
  totalResponses?: number;
  turningSubmissionCount?: number;
  prePostCompletion?: string;
  turningCoverage?: number;
  objectiveAccuracy?: number;
  postTestCompletion?: number;
  misconceptionSummary?: string;
  onParameterChange?: (stepId: string, values: Record<string, string>) => void;
  onAdvanceReveal?: () => void;
}) {
  const activeManifest = requireUnit53Manifest(manifest);
  const stepManifest = getUNIT_5_3ManifestStepFromManifest(activeManifest, step.id);
  const baseRegistry = createManifestContentModuleRegistry({
    revealProgress,
    allowInlineReveal,
    onInlineReveal: onAdvanceReveal,
  });
  const summaryCardRenderer = baseRegistry['summary-card'];
  const moduleRegistry: InteractiveModuleRegistry<ContentRegistryExtra> = {
    ...baseRegistry,
    'interactive-figure-panel': ({ step: manifestStep, module }: { step: InteractiveRuntimeStepManifest; module: InteractiveRuntimeModuleManifest }) => {
      if (panelId(module) === 'rust_turning_radius_panel') {
        return <TurningRadiusPanel step={manifestStep} module={module} onParameterChange={onParameterChange} />;
      }
      return <div className="premium-lesson-panel text-sm text-rose-700">未知互动图面板：{panelId(module)}</div>;
    },
    'summary-card': (props) => {
      const manifestModule = props.module as InteractiveRuntimeModuleManifest;
      if (manifestModule.id === 'class-stats') {
        if (role === 'student') {
          return (
            <Unit53StudentSummaryStats
              submittedCount={submittedCount}
              viewedCount={viewedCount}
              turningSubmissionCount={turningSubmissionCount}
              prePostCompletion={prePostCompletion}
            />
          );
        }
        return (
          <Unit53TeacherSummaryStats
            studentCount={studentCount}
            submittedStudents={submittedStudents}
            totalResponses={totalResponses}
            turningCoverage={turningCoverage}
            objectiveAccuracy={objectiveAccuracy}
            postTestCompletion={postTestCompletion}
            misconceptionSummary={misconceptionSummary}
          />
        );
      }
      return summaryCardRenderer?.(props) ?? null;
    },
  };
  if (role === 'student' && !browseEnabled && stepManifest.studentAccess.browse_required === true) {
    moduleRegistry['step-reveal-chain'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-reveal" />;
    moduleRegistry['step-reveal'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-reveal" />;
    moduleRegistry['image-panel'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-media" />;
  }

  return (
    <section className="space-y-4">
      {renderInteractiveManifestStep({
        manifest: activeManifest,
        step: stepManifest,
        moduleRegistry,
        extra: { revealProgress, allowInlineReveal, onInlineReveal: onAdvanceReveal },
      })}
    </section>
  );
}

export function UNIT_5_3StudentActivityForm({
  step,
  manifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  step: UNIT_5_3StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
}) {
  const activeManifest = requireUnit53Manifest(manifest);
  const stepManifest = getUNIT_5_3ManifestStepFromManifest(activeManifest, step.id);
  return (
    <>
      {renderStudentInteractiveActivity({
        registry: createManifestStudentActivityRegistry<UNIT_5_3StepDefinition>(),
        step,
        stepManifest,
        savedResponse,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        onSubmit,
      })}
    </>
  );
}

export function UNIT_5_3TeacherActivitySummary({
  step,
  manifest,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  step: UNIT_5_3StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  responses: TeacherResponseItem[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const activeManifest = requireUnit53Manifest(manifest);
  const stepManifest = getUNIT_5_3ManifestStepFromManifest(activeManifest, step.id);
  return (
    <>
      {renderTeacherInteractiveActivity({
        registry: createManifestTeacherActivityRegistry<UNIT_5_3StepDefinition>(),
        step,
        stepManifest,
        responses,
        released,
        browseEnabled,
        answerVisible,
        revealProgress,
        onToggleRelease,
        onToggleBrowse,
        onToggleAnswerVisible,
        onAdvanceReveal,
        onResetReveal,
      })}
    </>
  );
}
