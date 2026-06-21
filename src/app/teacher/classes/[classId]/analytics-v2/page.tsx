'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  BarChart3,
  Clipboard,
  Download,
  Lock,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

import type { TeacherClassInsightsPayload } from '@/app/api/teacher/classes/[classId]/insights/route';
import type { HeatmapData } from '@/app/api/teacher/classes/[classId]/heatmap/route';
import {
  buildTeacherStudentInsightsHref,
  formatTeacherStudentDisplayId,
  type GovernanceTone,
} from '@/features/teacher/teacher-insights';
import { ActionStatusPanel } from '@/components/platform/action-status';
import { createAuditedActionState, type AuditedActionState } from '@/lib/action-status-contract';
import {
  buildTeacherReportDeliveryState,
  normalizeTeacherReportDeliveryQuery,
} from '@/lib/teacher-report-grading-contracts';

type HeatmapView = 'score' | 'change' | 'risk';

export default function ClassAnalyticsV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const classId = params?.classId as string;
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';

  const [insights, setInsights] = useState<TeacherClassInsightsPayload | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [heatmapView, setHeatmapView] = useState<HeatmapView>('score');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveryState, setDeliveryState] = useState<AuditedActionState | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [insightsRes, heatmapRes] = await Promise.all([
        fetch(`/api/teacher/classes/${classId}/insights`),
        fetch(`/api/teacher/classes/${classId}/heatmap`),
      ]);

      if (!insightsRes.ok) {
        throw new Error('获取班级学情总览失败');
      }

      const insightsPayload = (await insightsRes.json()) as TeacherClassInsightsPayload;
      setInsights(insightsPayload);

      if (heatmapRes.ok) {
        const heatmapPayload = (await heatmapRes.json()) as HeatmapData;
        setHeatmap(heatmapPayload);
      } else {
        setHeatmap(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && classId) {
      if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
        router.replace('/dashboard');
        return;
      }
      void fetchData();
    }
  }, [classId, fetchData, router, session, status]);

  const matrixByStudent = useMemo(() => {
    const matrix = new Map<string, Map<string, HeatmapData['matrix'][number]>>();
    heatmap?.matrix.forEach((item) => {
      const studentMap = matrix.get(item.studentId) ?? new Map();
      studentMap.set(item.dimension, item);
      matrix.set(item.studentId, studentMap);
    });
    return matrix;
  }, [heatmap]);

  const deliveryQuery = useMemo(() => normalizeTeacherReportDeliveryQuery({
    action: searchParams.get('action'),
    report: searchParams.get('report'),
    reportId: searchParams.get('reportId'),
    version: searchParams.get('version'),
    format: searchParams.get('format'),
    studentId: searchParams.get('studentId'),
    returnTo: searchParams.get('returnTo') ?? `/teacher/classes/${classId}/analytics-v2`,
  }, classId), [classId, searchParams]);

  const routeDeliveryState = useMemo(
    () => buildTeacherReportDeliveryState(deliveryQuery),
    [deliveryQuery]
  );

  useEffect(() => {
    setDeliveryState(null);
  }, [deliveryQuery.action, deliveryQuery.reportId, deliveryQuery.studentId, deliveryQuery.versionId]);

  const activeDeliveryState = deliveryState ?? routeDeliveryState;

  const reportVersionLabel = useMemo(
    () => `${deliveryQuery.reportId} · ${insights?.governance.lastUpdatedLabel ?? '等待刷新'}`,
    [deliveryQuery.reportId, insights?.governance.lastUpdatedLabel]
  );

  const handleReportDownload = useCallback(async () => {
    try {
      setDeliveryState(createAuditedActionState({
        identity: {
          id: `teacher-report-download:${deliveryQuery.reportId}`,
          category: 'export',
          label: '教师报告导出',
          sourceRoute: `/teacher/classes/${classId}/analytics-v2`,
          targetId: deliveryQuery.reportId,
          requestedAction: 'export',
        },
        status: 'pending',
        message: '正在生成教师报告导出文件。',
        nextAction: '等待浏览器下载 JSON 文件',
      }));
      const response = await fetch(`/api/teacher/classes/${classId}/control-correction-report?export=true`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('教师报告导出失败');
      }
      const payload = await response.json();
      const filename = `teacher-report-${classId}-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([JSON.stringify(payload.export ?? payload.report ?? payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setDeliveryState(createAuditedActionState({
        identity: {
          id: `teacher-report-download:${deliveryQuery.reportId}`,
          category: 'export',
          label: '教师报告导出',
          sourceRoute: `/teacher/classes/${classId}/analytics-v2`,
          targetId: deliveryQuery.reportId,
          requestedAction: 'export',
        },
        status: 'succeeded',
        message: '教师报告导出文件已生成。',
        nextAction: '检查下载文件并交付给学生',
        downloadFilename: filename,
      }));
    } catch (err) {
      setDeliveryState(createAuditedActionState({
        identity: {
          id: `teacher-report-download:${deliveryQuery.reportId}`,
          category: 'export',
          label: '教师报告导出',
          sourceRoute: `/teacher/classes/${classId}/analytics-v2`,
          targetId: deliveryQuery.reportId,
          requestedAction: 'export',
        },
        status: 'failed',
        message: err instanceof Error ? err.message : '教师报告导出失败。',
        recoveryAction: '刷新报告数据后重试',
      }));
    }
  }, [classId, deliveryQuery.reportId]);

  const handleCopySummary = useCallback(async () => {
    const summary = `${insights?.classInfo.name ?? '班级'}：${insights?.governance.detail ?? '报告暂未生成'}。重点关注 ${insights?.overview.attentionStudents ?? 0} 人。`;
    try {
      await navigator.clipboard.writeText(summary);
      setDeliveryState(createAuditedActionState({
        identity: {
          id: `teacher-report-summary:${deliveryQuery.reportId}`,
          category: 'export',
          label: '教师报告摘要',
          sourceRoute: `/teacher/classes/${classId}/analytics-v2`,
          targetId: deliveryQuery.reportId,
          requestedAction: 'summary',
        },
        status: 'succeeded',
        message: '教师报告摘要已复制。',
        nextAction: '粘贴到班级通知或学生反馈中',
      }));
    } catch {
      setDeliveryState(createAuditedActionState({
        identity: {
          id: `teacher-report-summary:${deliveryQuery.reportId}`,
          category: 'export',
          label: '教师报告摘要',
          sourceRoute: `/teacher/classes/${classId}/analytics-v2`,
          targetId: deliveryQuery.reportId,
          requestedAction: 'summary',
        },
        status: 'failed',
        message: '复制摘要失败。',
        recoveryAction: '手动选择报告摘要后复制',
      }));
    }
  }, [classId, deliveryQuery.reportId, insights]);

  if (status === 'loading' || loading) {
    return (
      <div
        className="teacher-insight-shell flex items-center justify-center"
        data-intelligent-teaching-assistant-demo-surface="teacher-class-analytics"
        data-commercial-operations-workspace="teacher-operations"
        data-commercial-workspace-zone="instrument-area"
        data-operations-status-semantics="loading"
        data-report-ledger-surface="teacher-class-analytics-report"
        data-report-ledger-watermark="low-contrast-brand"
        data-report-ledger-privacy-scope="teacher-review"
        data-report-ledger-export="restricted"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          <p className="text-subtle">加载班级学情总览...</p>
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div
        className="teacher-insight-shell flex items-center justify-center"
        data-intelligent-teaching-assistant-demo-surface="teacher-class-analytics"
        data-commercial-operations-workspace="teacher-operations"
        data-commercial-workspace-zone="instrument-area"
        data-operations-status-semantics="error"
        data-report-ledger-surface="teacher-class-analytics-report"
        data-report-ledger-watermark="low-contrast-brand"
        data-report-ledger-privacy-scope="teacher-review"
        data-report-ledger-export="restricted"
      >
        <div className="text-center">
          <p className="text-xl text-red-500">{error || '加载失败'}</p>
          <button type="button" onClick={fetchData} className="btn-ghost-themed mt-4 rounded-lg px-6 py-2">
            重试
          </button>
        </div>
      </div>
    );
  }

  const governanceToneClass = getGovernanceToneClass(insights.governance.tone);

  return (
    <div
      className="teacher-insight-shell"
      data-intelligent-teaching-assistant-demo-surface="teacher-class-analytics"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics="ready"
      data-report-ledger-surface="teacher-class-analytics-report"
      data-report-ledger-watermark="low-contrast-brand"
      data-report-ledger-privacy-scope="teacher-review"
      data-report-ledger-export="restricted"
    >
      <header className="surface-topbar px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/teacher/classes/${classId}`} className="text-subtle transition hover:text-foreground">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">班级学情总览</h1>
                <span className={`teacher-insight-chip ${governanceToneClass}`}>{insights.governance.label}</span>
              </div>
              <p className="text-sm text-subtle">
                {insights.classInfo.name} · {insights.classInfo.studentCount} 名学生 · {insights.governance.lastUpdatedLabel}
              </p>
            </div>
          </div>
          <button type="button" onClick={fetchData} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
            <RefreshCw className="h-4 w-4" />
            刷新数据
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 pb-32 pt-8 md:pb-8">
        <ReportDeliveryPanel
          state={activeDeliveryState}
          versionLabel={reportVersionLabel}
          onDownload={handleReportDownload}
          onCopySummary={handleCopySummary}
        />
        <section className="teacher-insight-hero mb-8">
          <div className="grid gap-4 xl:grid-cols-[1.3fr,0.7fr]">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-500 dark:text-sky-300">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">从治理结果回看班级学情</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">
                    这里不再展示孤立的技术分和伦理分，而是围绕能力矩阵、风险分层、治理覆盖度和重点学生，为教师提供可行动的班级判断依据。
                  </p>
                </div>
              </div>
              <div className="teacher-insight-metric">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">治理覆盖进度</p>
                    <p className="mt-1 text-sm text-subtle">{insights.governance.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-foreground">
                      {insights.governance.coveredStudents}/{insights.governance.totalStudents}
                    </p>
                    <p className="text-xs text-subtle">已生成画像</p>
                  </div>
                </div>
                <div className="teacher-insight-track mt-4">
                  <div
                    className="teacher-insight-fill"
                    style={{ width: `${Math.min(insights.governance.coverageRatio * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <MetricCard
                title="班级总体指数"
                value={insights.overview.overallIndex}
                detail="最新班级快照与学生画像聚合值"
                icon={<TrendingUp className="h-5 w-5 text-sky-500 dark:text-sky-300" />}
              />
              <MetricCard
                title="重点关注学生"
                value={insights.overview.attentionStudents}
                detail="中高风险或整体表现偏弱"
                icon={<ShieldAlert className="h-5 w-5 text-rose-500" />}
              />
              <MetricCard
                title="高风险学生"
                value={insights.overview.highRiskStudents}
                detail="建议优先一对一跟进"
                icon={<Sparkles className="h-5 w-5 text-amber-500" />}
              />
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">能力维度概览</h2>
                <p className="mt-1 text-sm text-subtle">六维能力均值与波动，可快速判断本班共性短板。</p>
              </div>
            </div>
            <div className="space-y-4">
              {insights.ability.dimensions.map((item) => (
                <div key={item.dimension} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-subtle">均值 {item.mean} / 波动 {item.stdDev}</p>
                  </div>
                  <div className="teacher-insight-track">
                    <div className="teacher-insight-fill" style={{ width: `${Math.min(item.mean, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">画像等级分布</h2>
              <p className="mt-1 text-sm text-subtle">基于当前治理结果的班级层级结构。</p>
            </div>
            <div className="space-y-3">
              {Object.entries(insights.ability.levelDistribution).map(([key, value]) => (
                <div key={key} className="teacher-insight-metric">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-foreground">{getDistributionLabel(key)}</p>
                    <p className="text-sm text-subtle">{value} 人</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="surface-card mb-8 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">能力矩阵</h2>
              <p className="mt-1 text-sm text-subtle">
                按学生逐项查看能力分、变化趋势或风险等级，让教师先看到“谁需要关注”，再决定看哪一门能力。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'score', label: '能力分' },
                { key: 'change', label: '近阶段变化' },
                { key: 'risk', label: '风险等级' },
              ].map((view) => (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => setHeatmapView(view.key as HeatmapView)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    heatmapView === view.key
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border/70 bg-card/70 text-subtle hover:text-foreground'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          {!heatmap || heatmap.students.length === 0 ? (
            <div className="teacher-insight-metric">
              <p className="text-sm text-subtle">当前还没有可展示的班级能力矩阵，请等待学生画像快照生成。</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-x-auto">
              <div className="teacher-insight-matrix min-w-[980px]">
                <div className="teacher-insight-matrix-cell font-medium text-foreground">学生</div>
                {heatmap.dimensions.map((dimension) => (
                  <div key={dimension} className="teacher-insight-matrix-cell text-center font-medium text-foreground">
                    {insights.ability.dimensions.find((item) => item.dimension === dimension)?.label || dimension}
                  </div>
                ))}
              </div>
              {heatmap.students.map((student) => (
                <div key={student.id} className="teacher-insight-matrix min-w-[980px]">
                  <Link
                    href={buildTeacherStudentInsightsHref(classId, student.id)}
                    className="teacher-insight-matrix-cell flex items-center justify-between gap-3 hover:border-primary/40"
                  >
                    <div>
                      <p className="font-medium text-foreground">{student.name || '未命名学生'}</p>
                      <p className="text-xs text-subtle">
                        {formatTeacherStudentDisplayId({
                          studentNumber: student.studentNumber,
                          email: null,
                          fallbackId: student.id,
                        })}
                      </p>
                    </div>
                    <Users className="h-4 w-4 text-subtle" />
                  </Link>
                  {heatmap.dimensions.map((dimension) => {
                    const cell = matrixByStudent.get(student.id)?.get(dimension);
                    return (
                      <div
                        key={`${student.id}-${dimension}`}
                        className={`teacher-insight-matrix-cell text-center ${getHeatmapCellClass(heatmapView, cell)}`}
                      >
                        {renderHeatmapCellValue(heatmapView, cell)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="surface-card p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">重点学生</h2>
              <p className="mt-1 text-sm text-subtle">按风险、整体表现与成长记录综合排序，便于教师快速锁定跟进对象。</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {insights.spotlightStudents.length === 0 ? (
              <div className="teacher-insight-metric">
                <p className="text-sm text-subtle">当前没有需要特别提示的学生，继续观察班级治理结果即可。</p>
              </div>
            ) : (
              insights.spotlightStudents.map((student) => (
                <Link
                  key={student.id}
                  href={buildTeacherStudentInsightsHref(classId, student.id)}
                  className="teacher-insight-entry"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{student.name}</p>
                        <span className={`teacher-insight-chip teacher-insight-risk-${student.riskLevel}`}>
                          {student.riskLabel}
                        </span>
                      </div>
                      <p className="text-sm text-subtle">{student.recentTrend}</p>
                      <div className="flex flex-wrap gap-2">
                        {student.weaknesses.slice(0, 2).map((item) => (
                          <span key={item} className="teacher-insight-chip teacher-insight-chip-warning">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-subtle">综合指数</p>
                      <p className="text-2xl font-semibold text-foreground">{student.overallScore}</p>
                      <p className="mt-2 text-xs text-subtle">成长档案 {student.growthRecordCount} 条</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </main>
      <ReportDeliveryDock
        state={activeDeliveryState}
        versionLabel={reportVersionLabel}
        onDownload={handleReportDownload}
        onCopySummary={handleCopySummary}
      />
    </div>
  );
}

function ReportDeliveryPanel({
  state,
  versionLabel,
  onDownload,
  onCopySummary,
}: {
  state: AuditedActionState | null;
  versionLabel: string;
  onDownload: () => void;
  onCopySummary: () => void;
}) {
  return (
    <section
      className="surface-card mb-8 p-5"
      data-teacher-report-delivery="workspace"
      data-report-version={versionLabel}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Report delivery</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">教师报告交付</h2>
          <p className="mt-1 text-sm text-subtle">版本 {versionLabel} · 当前可导出报告和复制摘要；发送对象、版本锁定和补强任务保留为可恢复状态。</p>
        </div>
        <ReportDeliveryActions
          onDownload={onDownload}
          onCopySummary={onCopySummary}
        />
      </div>
      <ReportDeliveryCapabilityNote />
      {state ? <ActionStatusPanel state={state} className="mt-4" /> : null}
    </section>
  );
}

function ReportDeliveryDock({
  state,
  versionLabel,
  onDownload,
  onCopySummary,
}: {
  state: AuditedActionState | null;
  versionLabel: string;
  onDownload: () => void;
  onCopySummary: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur md:hidden"
      data-teacher-report-delivery="mobile-fixed-actions"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">教师报告交付 · {versionLabel}</p>
          <p className="text-xs text-subtle">{state ? state.message : '固定动作区可在长报告任意位置完成导出和摘要复制。'}</p>
        </div>
        <ReportDeliveryActions
          onDownload={onDownload}
          onCopySummary={onCopySummary}
        />
      </div>
    </div>
  );
}

function ReportDeliveryActions({
  onDownload,
  onCopySummary,
}: {
  onDownload: () => void;
  onCopySummary: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onDownload} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
        <Download className="h-4 w-4" />
        导出 JSON
      </button>
      <button type="button" onClick={onCopySummary} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
        <Clipboard className="h-4 w-4" />
        复制摘要
      </button>
    </div>
  );
}

function ReportDeliveryCapabilityNote() {
  return (
    <div className="mt-4 grid gap-2 text-xs text-subtle sm:grid-cols-2">
      <div className="flex items-center gap-2 rounded border border-border/70 px-3 py-2">
        <Send className="h-4 w-4" />
        <span>发送学生：通过有效学生 deep link 进入；缺失对象显示阻断恢复。</span>
      </div>
      <div className="flex items-center gap-2 rounded border border-border/70 px-3 py-2">
        <Lock className="h-4 w-4" />
        <span>锁定版本：等待稳定版本生成后开放，当前不会作为可点击动作。</span>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="teacher-insight-metric">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-subtle">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
        </div>
        {icon}
      </div>
      <p className="mt-2 text-xs text-subtle">{detail}</p>
    </div>
  );
}

function getGovernanceToneClass(tone: GovernanceTone) {
  if (tone === 'healthy') return 'teacher-insight-chip-healthy';
  if (tone === 'warning') return 'teacher-insight-chip-warning';
  return 'teacher-insight-chip-pending';
}

function getDistributionLabel(level: string) {
  if (level === 'excellent') return '优秀';
  if (level === 'good') return '良好';
  if (level === 'average') return '中等';
  if (level === 'needsImprovement') return '需提升';
  return '需关注';
}

function getHeatmapCellClass(view: HeatmapView, cell: HeatmapData['matrix'][number] | undefined) {
  if (!cell) {
    return 'text-subtle';
  }

  if (view === 'risk') {
    if (cell.riskLevel === 'high') return 'teacher-insight-risk-high';
    if (cell.riskLevel === 'medium') return 'teacher-insight-risk-medium';
    if (cell.riskLevel === 'low') return 'teacher-insight-risk-low';
    return 'teacher-insight-risk-none';
  }

  if (view === 'change') {
    if (cell.change > 0) return 'text-emerald-600 dark:text-emerald-300';
    if (cell.change < 0) return 'text-rose-600 dark:text-rose-300';
    return 'text-subtle';
  }

  if (cell.score >= 85) return 'text-emerald-600 dark:text-emerald-300';
  if (cell.score >= 70) return 'text-sky-600 dark:text-sky-300';
  if (cell.score >= 55) return 'text-amber-600 dark:text-amber-300';
  return 'text-rose-600 dark:text-rose-300';
}

function renderHeatmapCellValue(view: HeatmapView, cell: HeatmapData['matrix'][number] | undefined) {
  if (!cell) {
    return '-';
  }

  if (view === 'risk') {
    if (cell.riskLevel === 'high') return '高';
    if (cell.riskLevel === 'medium') return '中';
    if (cell.riskLevel === 'low') return '低';
    return '稳';
  }

  if (view === 'change') {
    return `${cell.change > 0 ? '+' : ''}${cell.change}`;
  }

  return cell.score;
}
