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
import {
  completePlannedPathToActualExtent,
  createEqualCoordinateScale,
} from './turning-path-utils';

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

function minDistanceToObstacle(turning: NonlinearAnalysisResult['turningRadius']) {
  if (!turning) return Number.POSITIVE_INFINITY;
  return turning.path.actual.reduce((current, point) => {
    const distance = Math.hypot(
      turning.path.obstacleCenter.x - point.x,
      turning.path.obstacleCenter.y - point.y,
    );
    return Math.min(current, distance);
  }, Number.POSITIVE_INFINITY);
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

function hasCompleteTurningRadiusResult(result: NonlinearAnalysisResult | null | undefined) {
  const turning = result?.turningRadius;
  return Boolean(
    turning &&
    typeof turning.minDistanceM === 'number' &&
    turning.path &&
    Array.isArray(turning.path.nominal) &&
    Array.isArray(turning.path.actual) &&
    turning.path.obstacleCenter &&
    typeof turning.path.obstacleRadius === 'number' &&
    typeof turning.path.clearanceRadius === 'number',
  );
}

function scaleSeries(
  defaults: { minX: number; maxX: number; minY: number; maxY: number },
) {
  const { minX, maxX, minY, maxY } = defaults;
  const scaleX = (x: number) => 36 + ((x - minX) / Math.max(1e-6, maxX - minX)) * 568;
  const scaleY = (y: number) => 294 - ((y - minY) / Math.max(1e-6, maxY - minY)) * 238;
  const scaleRadiusX = (radius: number) => Math.abs(scaleX(minX + radius) - scaleX(minX));
  const scaleRadiusY = (radius: number) => Math.abs(scaleY(minY + radius) - scaleY(minY));
  return { scaleX, scaleY, scaleRadiusX, scaleRadiusY };
}

function SvgPathPanel({
  title,
  series,
  obstacle,
  startRadius,
}: {
  title: string;
  series: CurveSeries[];
  obstacle?: { center: NonlinearPoint; radius: number; clearanceRadius: number };
  startRadius?: number;
}) {
  const { scaleX, scaleY, scaleRadius, plotLeft, plotRight, plotTop, plotBottom } = createEqualCoordinateScale({
    minX: 0,
    maxX: 260,
    minY: -45,
    maxY: 165,
    plotX: 36,
    plotY: 56,
    plotWidth: 568,
    plotHeight: 238,
  });
  const xTicks = [0, 50, 100, 150, 200, 250];
  const yTicks = [-40, 0, 40, 80, 120, 160];
  return (
    <svg viewBox="0 0 640 340" className="h-[340px] w-full rounded-xl border border-slate-200 bg-white" aria-label={title}>
      <defs>
        <clipPath id="turning-path-plot">
          <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop} />
        </clipPath>
      </defs>
      <text x="36" y="28" className="fill-slate-800 text-[16px] font-semibold">{title}</text>
      <line x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom} stroke="#cbd5e1" />
      <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotBottom} stroke="#cbd5e1" />
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={scaleX(tick)} y1={plotBottom} x2={scaleX(tick)} y2={plotBottom + 6} stroke="#94a3b8" />
          <text x={scaleX(tick)} y={plotBottom + 24} textAnchor="middle" className="fill-slate-500 text-[14px]">{tick}</text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={plotLeft - 6} y1={scaleY(tick)} x2={plotLeft} y2={scaleY(tick)} stroke="#94a3b8" />
          <text x={plotLeft - 12} y={scaleY(tick) + 4} textAnchor="end" className="fill-slate-500 text-[14px]">{tick}</text>
        </g>
      ))}
      <text x="580" y="336" textAnchor="end" className="fill-slate-500 text-[13px]">x / m</text>
      <text x="10" y="70" textAnchor="middle" className="fill-slate-500 text-[13px]" transform="rotate(-90 10 70)">y / m</text>
      {obstacle ? (
        <g clipPath="url(#turning-path-plot)">
          {startRadius ? (
            <circle
              cx={scaleX(obstacle.center.x)}
              cy={scaleY(obstacle.center.y)}
              r={scaleRadius(startRadius)}
              fill="none"
              stroke="#64748b"
              strokeDasharray="8 7"
              strokeWidth="1.8"
            />
          ) : null}
          <circle
            cx={scaleX(obstacle.center.x)}
            cy={scaleY(obstacle.center.y)}
            r={Math.max(6, scaleRadius(obstacle.radius))}
            fill="#fee2e2"
            stroke="#dc2626"
            strokeWidth="2"
          />
          <circle
            cx={scaleX(obstacle.center.x)}
            cy={scaleY(obstacle.center.y)}
            r={Math.max(8, scaleRadius(obstacle.clearanceRadius))}
            fill="none"
            stroke="#f97316"
            strokeDasharray="6 5"
            strokeWidth="2"
          />
        </g>
      ) : null}
      <g clipPath="url(#turning-path-plot)">
        {series.map((item) => {
          const d = item.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x).toFixed(1)} ${scaleY(point.y).toFixed(1)}`)
            .join(' ');
          return (
            <path
              key={item.id}
              d={d}
              fill="none"
              stroke={item.color}
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={item.dashed ? '6 5' : undefined}
            />
          );
        })}
      </g>
      {series.map((item, index) => (
        <g key={item.id} transform={`translate(${390}, ${32 + index * 18})`}>
          <line x1="0" y1="0" x2="24" y2="0" stroke={item.color} strokeWidth="3" strokeDasharray={item.dashed ? '6 5' : undefined} />
          <text x="30" y="4" className="fill-slate-600 text-[11px]">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}

function SvgSignalPanel({ title, series }: { title: string; series: CurveSeries[] }) {
  const { scaleX, scaleY } = scaleSeries({ minX: 0, maxX: 82, minY: -20, maxY: 48 });
  const xTicks = [0, 20, 40, 60, 80];
  const yTicks = [-20, 0, 18, 36, 48];
  return (
    <svg viewBox="0 0 640 340" className="h-[340px] w-full rounded-xl border border-slate-200 bg-white" aria-label={title}>
      <defs>
        <clipPath id="turning-signal-plot">
          <rect x="36" y="56" width="568" height="238" />
        </clipPath>
      </defs>
      <text x="36" y="28" className="fill-slate-800 text-[16px] font-semibold">{title}</text>
      <line x1="36" y1="294" x2="604" y2="294" stroke="#cbd5e1" />
      <line x1="36" y1="56" x2="36" y2="294" stroke="#cbd5e1" />
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={scaleX(tick)} y1="294" x2={scaleX(tick)} y2="300" stroke="#94a3b8" />
          <text x={scaleX(tick)} y="318" textAnchor="middle" className="fill-slate-500 text-[14px]">{tick}</text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1="30" y1={scaleY(tick)} x2="36" y2={scaleY(tick)} stroke="#94a3b8" />
          <line x1="36" y1={scaleY(tick)} x2="604" y2={scaleY(tick)} stroke="#e2e8f0" strokeDasharray={tick === 0 ? undefined : '3 5'} />
          <text x="24" y={scaleY(tick) + 4} textAnchor="end" className="fill-slate-500 text-[14px]">{tick}</text>
        </g>
      ))}
      <text x="580" y="336" textAnchor="end" className="fill-slate-500 text-[13px]">t / s</text>
      <text x="10" y="88" textAnchor="middle" className="fill-slate-500 text-[13px]" transform="rotate(-90 10 88)">舵角 / deg</text>
      <g clipPath="url(#turning-signal-plot)">
        {series.map((item) => {
          const d = item.points
            .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x).toFixed(1)} ${scaleY(point.y).toFixed(1)}`)
            .join(' ');
          return (
            <path
              key={item.id}
              d={d}
              fill="none"
              stroke={item.color}
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={item.dashed ? '6 5' : undefined}
            />
          );
        })}
      </g>
      {series.map((item, index) => (
        <g key={item.id} transform={`translate(${390}, ${32 + index * 18})`}>
          <line x1="0" y1="0" x2="24" y2="0" stroke={item.color} strokeWidth="3" strokeDasharray={item.dashed ? '6 5' : undefined} />
          <text x="30" y="4" className="fill-slate-600 text-[11px]">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}

function TurningSteeringPanel({ result }: { result: NonlinearAnalysisResult | null }) {
  const curves = result?.turningRadius?.headingCurves ?? [];
  const targetCurve = curves.find((curve) => curve.id.includes('target') || curve.id.includes('delta_target'));
  const actualCurve = curves.find((curve) => curve.id.includes('actual_delta') || curve.id === 'delta');
  const timeSeries: CurveSeries[] = [
    {
      id: targetCurve?.id ?? 'estimated-rudder-command',
      label: '估计舵角指令',
      color: '#f97316',
      points: targetCurve?.points ?? [],
      dashed: true,
    },
    {
      id: actualCurve?.id ?? 'actual-limited-rudder',
      label: '实际舵角信号',
      color: '#2563eb',
      points: actualCurve?.points ?? [],
    },
  ];
  return <SvgSignalPanel title="舵角指令" series={timeSeries} />;
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
  const needsStructureFallback = Boolean(result?.turningRadius && !hasCompleteTurningRadiusResult(result));
  const displayResult = resultRequestKey === requestKey
    ? needsStructureFallback
      ? fallback
      : result
    : null;
  const turning = displayResult?.turningRadius;
  const displayIsFallback = isFallback || needsStructureFallback;
  const actualPath = turning?.path.actual ?? [];
  const plannedPath = completePlannedPathToActualExtent(turning?.path.nominal ?? [], actualPath);
  const pathSeries: CurveSeries[] = [
    { id: 'nominal', label: '规划航迹', color: '#f97316', points: plannedPath, dashed: true },
    { id: 'actual', label: '实际航迹', color: '#2563eb', points: actualPath },
  ];
  const obstacle = turning
    ? {
      center: turning.path.obstacleCenter,
      radius: turning.path.obstacleRadius,
      clearanceRadius: turning.path.clearanceRadius,
    }
    : undefined;
  const calculationNotice = error
    ? error
    : displayResult && displayIsFallback
      ? '当前曲线为浏览器端备用计算结果，实时计算返回后会自动替换。'
      : null;
  const minDistanceM = turning ? numeric(turning.minDistanceM, minDistanceToObstacle(turning)) : null;
  const collisionActive = turning
    ? typeof turning.collisionActive === 'boolean'
      ? turning.collisionActive
      : (minDistanceM ?? Number.POSITIVE_INFINITY) < turning.path.obstacleRadius
    : false;
  const safetyConstraintSatisfied = turning
    ? typeof turning.safetyConstraintSatisfied === 'boolean'
      ? turning.safetyConstraintSatisfied
      : (minDistanceM ?? 0) >= turning.path.clearanceRadius
    : false;
  const statusTags = turning
    ? [
      ['避障启动距离', `${turning.dStartM.toFixed(1)} m`],
      ['名义舵角', `${turning.deltaDDeg.toFixed(1)}°`],
      ['最大实际舵角', `${turning.maxDeltaDeg.toFixed(1)}°`],
      ['舵角饱和', turning.saturationActive ? '已触发' : '未触发'],
      ['安全约束', safetyConstraintSatisfied && !collisionActive ? '满足' : '未满足'],
    ]
    : [];

  useEffect(() => {
    if (!turning) return;
    const measuredMinDistanceM = minDistanceM ?? minDistanceToObstacle(turning);
    onParameterChange?.(step.id, {
      R_m: String(radius),
      d_start_m: turning.dStartM.toFixed(2),
      delta_d_deg: turning.deltaDDeg.toFixed(2),
      max_delta_deg: turning.maxDeltaDeg.toFixed(2),
      saturation_active: String(turning.saturationActive),
      min_distance_m: measuredMinDistanceM.toFixed(2),
      collision_active: String(collisionActive),
      safety_constraint_satisfied: String(safetyConstraintSatisfied),
    });
  }, [collisionActive, minDistanceM, onParameterChange, radius, safetyConstraintSatisfied, step.id, turning]);

  return (
    <section className="premium-lesson-panel space-y-4" data-nonlinear-panel="rust_turning_radius_panel">
      <div>
        <h3 className="premium-lesson-title text-base font-semibold leading-7 tracking-normal">{asString(module.payload.title, step.title)}</h3>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <TurningSteeringPanel result={displayResult} />
        <div className="space-y-4">
          <SvgPathPanel title="避障航线" series={pathSeries} obstacle={obstacle} startRadius={turning?.dStartM} />
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
      {statusTags.length ? (
        <div className="grid gap-2 sm:grid-cols-5" data-testid="unit-5-3-turning-status-tags">
          {statusTags.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="premium-lesson-caption text-xs">{label}</div>
              <div className="premium-lesson-title mt-1 text-sm font-semibold">{value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {calculationNotice ? (
        <div className="rounded-lg bg-white p-3 text-xs leading-6 text-amber-700">
          {calculationNotice}
        </div>
      ) : null}
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
  viewerRole,
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
  viewerRole: 'student' | 'teacher';
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
  const role = viewerRole;
  const activeManifest = requireUnit53Manifest(manifest);
  const stepManifest = getUNIT_5_3ManifestStepFromManifest(activeManifest, step.id);
  const baseRegistry = createManifestContentModuleRegistry({
    revealProgress,
    allowInlineReveal,
    onInlineReveal: onAdvanceReveal,
  });
  const summaryCardRenderer = baseRegistry['summary-card'];
  const renderInteractiveFigurePanel = ({
    step: manifestStep,
    module,
  }: {
    step: InteractiveRuntimeStepManifest;
    module: InteractiveRuntimeModuleManifest;
  }) => {
    if (panelId(module) === 'rust_turning_radius_panel') {
      return <TurningRadiusPanel step={manifestStep} module={module} onParameterChange={onParameterChange} />;
    }
    return <div className="premium-lesson-panel text-sm text-rose-700">未知互动图面板：{panelId(module)}</div>;
  };
  const renderSummaryCard = (props: Parameters<InteractiveModuleRegistry<ContentRegistryExtra>[string]>[0]) => {
    const manifestModule = props.module as InteractiveRuntimeModuleManifest;
    if (manifestModule.id === 'class-stats') {
      if (viewerRole === 'student') {
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
  };
  const moduleRegistry: InteractiveModuleRegistry<ContentRegistryExtra> = {
    ...baseRegistry,
    'compute.panel': (props) => {
      const legacyKind = typeof props.module.payload.legacyKind === 'string' ? props.module.payload.legacyKind : '';
      if (legacyKind === 'interactive-figure-panel') {
        return renderInteractiveFigurePanel(props);
      }
      return baseRegistry['compute.panel'](props);
    },
    'content.cardSet': (props) => {
      const legacyKind = typeof props.module.payload.legacyKind === 'string' ? props.module.payload.legacyKind : '';
      if (props.module.id === 'class-stats' && legacyKind === 'summary-card') {
        return renderSummaryCard(props);
      }
      return baseRegistry['content.cardSet'](props);
    },
  };
  if (viewerRole === 'student' && !browseEnabled && stepManifest.studentAccess.browse_required === true) {
    moduleRegistry['content.reveal'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-reveal" />;
    moduleRegistry['content.figure'] = () => <div hidden aria-hidden="true" data-role-hidden-module="browse-required-media" />;
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
  readOnly = false,
}: {
  step: UNIT_5_3StepDefinition;
  manifest?: InteractiveRuntimeManifest | null;
  savedResponse?: ManifestStepResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: ManifestStepResponse) => void;
  readOnly?: boolean;
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
        readOnly,
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
