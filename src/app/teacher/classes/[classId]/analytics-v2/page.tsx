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
import type { ControlCorrectionTeacherReport } from '@/lib/data-governance/control-correction-teacher-report';
import type { PersonalizedPathEffectEvaluation } from '@/lib/personalized-path-effect-evaluation';
import { PersonalizedPathEffectPanel } from '@/features/teacher/personalized-path-effect-panel';
import {
  buildTeacherStudentInsightsHref,
  formatTeacherStudentDisplayId,
  type GovernanceTone,
} from '@/features/teacher/teacher-insights';
import { ActionStatusPanel } from '@/components/platform/action-status';
import { createAuditedActionState, type AuditedActionState } from '@/lib/action-status-contract';
import {
  PORTRAIT_V2_DIMENSIONS,
  type PortraitV2DimensionId,
} from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  buildTeacherReportDeliveryLedgerEntry,
  buildTeacherReportDeliveryState,
  normalizeTeacherReportDeliveryQuery,
  type TeacherReportDeliveryLedgerEntry,
} from '@/lib/teacher-report-grading-contracts';

type GraphCenterClassView = 'diagnosis' | 'population';

function normalizeGraphCenterClassView(view: string | null): GraphCenterClassView {
  return view === 'population' ? 'population' : 'diagnosis';
}

function resolveGraphCenterTraceDomain(nodeId: string | null): 'knowledge' | 'capability' | 'quality' {
  if (nodeId?.startsWith('cap:')) return 'capability';
  if (nodeId?.startsWith('qual:')) return 'quality';
  return 'knowledge';
}

export default function ClassAnalyticsV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const classId = params?.classId as string;
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';
  const graphCenterNodeId = searchParams.get('graphNodeId')?.trim() || null;
  const graphCenterView = normalizeGraphCenterClassView(searchParams.get('view'));
  const graphCenterPopulationActive = Boolean(graphCenterNodeId && graphCenterView === 'population');
  const graphCenterViewLabel = graphCenterPopulationActive ? '影响学生' : '薄弱节点诊断';
  const graphCenterTraceDomain = resolveGraphCenterTraceDomain(graphCenterNodeId);

  const [insights, setInsights] = useState<TeacherClassInsightsPayload | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [correctionReport, setCorrectionReport] = useState<ControlCorrectionTeacherReport | null>(null);
  const [pathEffect, setPathEffect] = useState<PersonalizedPathEffectEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveryState, setDeliveryState] = useState<AuditedActionState | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [insightsRes, heatmapRes, correctionReportRes, pathEffectRes] = await Promise.all([
        fetch(`/api/teacher/classes/${classId}/insights`),
        fetch(`/api/teacher/classes/${classId}/heatmap`),
        fetch(`/api/teacher/classes/${classId}/control-correction-report`),
        fetch(`/api/teacher/classes/${classId}/personalized-path-effect`),
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
      if (correctionReportRes.ok) {
        const correctionReportPayload = await correctionReportRes.json() as { report?: ControlCorrectionTeacherReport };
        setCorrectionReport(correctionReportPayload.report ?? null);
      } else {
        setCorrectionReport(null);
      }
      if (pathEffectRes.ok) {
        const pathEffectPayload = await pathEffectRes.json() as { evaluation?: PersonalizedPathEffectEvaluation };
        setPathEffect(pathEffectPayload.evaluation ?? null);
      } else {
        setPathEffect(null);
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
    sessionId: searchParams.get('sessionId'),
    lessonId: searchParams.get('lessonId'),
    gradingRunId: searchParams.get('gradingRunId'),
    source: searchParams.get('source'),
    actorId: session?.user?.id ?? null,
    actorRole: session?.user?.role ?? 'teacher',
    recipientScope: searchParams.get('recipientScope'),
    surface: searchParams.get('surface'),
    returnTo: searchParams.get('returnTo') ?? `/teacher/classes/${classId}/analytics-v2`,
  }, classId), [classId, searchParams, session?.user?.id, session?.user?.role]);

  const routeDeliveryState = useMemo(
    () => buildTeacherReportDeliveryState(deliveryQuery),
    [deliveryQuery]
  );
  const deliveryLedgerEntry = useMemo(
    () => buildTeacherReportDeliveryLedgerEntry({
      query: deliveryQuery,
      surface: deliveryQuery.surface,
      studentSafeSummary: `${insights?.classInfo.name ?? classId} 的教师报告交付状态仅包含班级、课堂和学生安全摘要。`,
    }),
    [classId, deliveryQuery, insights?.classInfo.name]
  );

  useEffect(() => {
    setDeliveryState(null);
  }, [
    deliveryQuery.action,
    deliveryQuery.actorId,
    deliveryQuery.actorRole,
    deliveryQuery.classId,
    deliveryQuery.format,
    deliveryQuery.gradingRunId,
    deliveryQuery.lessonId,
    deliveryQuery.recipientScope,
    deliveryQuery.reportId,
    deliveryQuery.returnTo,
    deliveryQuery.sessionId,
    deliveryQuery.source,
    deliveryQuery.studentId,
    deliveryQuery.surface,
    deliveryQuery.versionId,
  ]);

  const activeDeliveryState = deliveryState ?? routeDeliveryState;
  const canDeliverReport = deliveryLedgerEntry.contextState === 'ready';

  const reportVersionLabel = useMemo(
    () => `${deliveryQuery.reportId} · ${insights?.governance.lastUpdatedLabel ?? '等待刷新'}`,
    [deliveryQuery.reportId, insights?.governance.lastUpdatedLabel]
  );

  const handleReportDownload = useCallback(async () => {
    if (!canDeliverReport) {
      setDeliveryState(createAuditedActionState({
        identity: buildDeliveryActionIdentity(deliveryLedgerEntry, '教师报告导出', 'export'),
        status: 'blocked',
        message: '报告交付缺少课堂、课次或学生上下文，暂不能导出。',
        recoveryAction: '从课堂复盘、学生证据或班级报告入口重新进入',
        displayReference: deliveryLedgerEntry.artifactRef,
      }));
      return;
    }
    try {
      setDeliveryState(createAuditedActionState({
        identity: buildDeliveryActionIdentity(deliveryLedgerEntry, '教师报告导出', 'export'),
        status: 'pending',
        message: '正在生成教师报告导出文件。',
        nextAction: '等待浏览器下载 JSON 文件',
        displayReference: deliveryLedgerEntry.artifactRef,
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
        identity: buildDeliveryActionIdentity(deliveryLedgerEntry, '教师报告导出', 'export'),
        status: 'succeeded',
        message: '教师报告导出文件已生成。',
        nextAction: '检查下载文件并交付给学生',
        displayReference: deliveryLedgerEntry.artifactRef,
        downloadFilename: filename,
      }));
    } catch (err) {
      setDeliveryState(createAuditedActionState({
        identity: buildDeliveryActionIdentity(deliveryLedgerEntry, '教师报告导出', 'export'),
        status: 'failed',
        message: err instanceof Error ? err.message : '教师报告导出失败。',
        recoveryAction: '刷新报告数据后重试',
        displayReference: deliveryLedgerEntry.artifactRef,
      }));
    }
  }, [canDeliverReport, classId, deliveryLedgerEntry]);

  const handleRecordIntervention = useCallback(async () => {
    const identity = {
      id: deliveryLedgerEntry.interventionAction.id,
      category: 'writeback' as const,
      label: '教师证据处置',
      sourceRoute: '/teacher/classes/report-delivery-ledger',
      targetId: deliveryLedgerEntry.interventionAction.studentId ?? deliveryLedgerEntry.interventionAction.classId,
      requestedAction: deliveryLedgerEntry.interventionAction.kind,
    };
    if (!canDeliverReport || !deliveryLedgerEntry.interventionAction.studentId) {
      setDeliveryState(createAuditedActionState({
        identity,
        status: 'blocked',
        message: deliveryLedgerEntry.interventionAction.studentId
          ? '报告交付缺少课堂、课次或学生上下文，暂不能创建教师处置。'
          : '班级级报告需要先选择具体学生，才能创建学生证据处置记录。',
        recoveryAction: deliveryLedgerEntry.interventionAction.studentId
          ? '从课堂复盘、学生证据或班级报告入口重新进入'
          : '从学生画像、学生证据页或带 studentId 的报告链接进入',
        displayReference: deliveryLedgerEntry.artifactRef,
      }));
      return;
    }
    try {
      setDeliveryState(createAuditedActionState({
        identity,
        status: 'pending',
        message: '正在创建教师证据处置记录。',
        nextAction: '等待处置记录写入证据队列',
        displayReference: deliveryLedgerEntry.interventionAction.id,
      }));
      const response = await fetch('/api/teacher/evidence-interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildInterventionRequestBody(deliveryLedgerEntry)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(readApiError(payload) ?? '教师证据处置创建失败');
      }
      if (!hasPersistedIntervention(payload)) {
        setDeliveryState(createAuditedActionState({
          identity,
          status: 'blocked',
          message: '当前处置没有写入学生证据队列，不能声明记录已创建。',
          recoveryAction: '选择具体学生或有效补练路径后重试',
          displayReference: deliveryLedgerEntry.interventionAction.id,
        }));
        return;
      }
      setDeliveryState(createAuditedActionState({
        identity,
        status: 'succeeded',
        message: '教师证据处置记录已创建，等待学生侧写回完成。',
        nextAction: '回到评分工作台或学生证据页继续跟踪',
        displayReference: typeof payload?.action?.id === 'string'
          ? payload.action.id
          : deliveryLedgerEntry.interventionAction.id,
      }));
    } catch (error) {
      setDeliveryState(createAuditedActionState({
        identity,
        status: 'failed',
        message: error instanceof Error ? error.message : '教师证据处置创建失败。',
        recoveryAction: '检查学生、报告和来源证据后重试',
        displayReference: deliveryLedgerEntry.interventionAction.id,
      }));
    }
  }, [canDeliverReport, deliveryLedgerEntry]);

  const handleCopySummary = useCallback(async () => {
    if (!canDeliverReport) {
      setDeliveryState(createAuditedActionState({
        identity: buildDeliveryActionIdentity(deliveryLedgerEntry, '教师报告摘要', 'summary'),
        status: 'blocked',
        message: '报告交付缺少课堂、课次或学生上下文，暂不能复制交付摘要。',
        recoveryAction: '从课堂复盘、学生证据或班级报告入口重新进入',
        displayReference: deliveryLedgerEntry.artifactRef,
      }));
      return;
    }
    const summary = `${insights?.classInfo.name ?? '班级'}：${insights?.governance.detail ?? '累计画像尚不可用'}。当前累计证据风险需关注 ${insights?.overview.attentionStudents ?? 0} 人。`;
    try {
      await navigator.clipboard.writeText(summary);
      setDeliveryState(createAuditedActionState({
        identity: buildDeliveryActionIdentity(deliveryLedgerEntry, '教师报告摘要', 'summary'),
        status: 'succeeded',
        message: '教师报告摘要已复制。',
        nextAction: '粘贴到班级通知或学生反馈中',
        displayReference: deliveryLedgerEntry.artifactRef,
      }));
    } catch {
      setDeliveryState(createAuditedActionState({
        identity: buildDeliveryActionIdentity(deliveryLedgerEntry, '教师报告摘要', 'summary'),
        status: 'failed',
        message: '复制摘要失败。',
        recoveryAction: '手动选择报告摘要后复制',
        displayReference: deliveryLedgerEntry.artifactRef,
      }));
    }
  }, [canDeliverReport, deliveryLedgerEntry, insights]);

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
      data-graph-center-class-context={graphCenterNodeId ? 'true' : undefined}
      data-graph-center-node-id={graphCenterNodeId ?? undefined}
      data-graph-center-view={graphCenterNodeId ? graphCenterView : undefined}
    >
      <header className="surface-topbar px-6 py-4">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/teacher/classes/${classId}`} className="text-subtle transition hover:text-foreground" aria-label="返回班级详情">
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
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={fetchData} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm" aria-label="刷新班级学情总览数据">
              <RefreshCw className="h-4 w-4" />
              刷新数据
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 pb-32 pt-8 md:pb-8">
        <ReportDeliveryPanel
          state={activeDeliveryState}
          ledgerEntry={deliveryLedgerEntry}
          canDeliver={canDeliverReport}
          versionLabel={reportVersionLabel}
          onDownload={handleReportDownload}
          onCopySummary={handleCopySummary}
          onRecordIntervention={handleRecordIntervention}
        />
        {graphCenterNodeId ? (
          <section
            className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-subtle"
            data-graph-center-class-action-context="true"
            data-graph-center-node-id={graphCenterNodeId}
            data-graph-center-view={graphCenterView}
          >
            <div className="font-semibold text-foreground">图谱上下文：{graphCenterViewLabel}</div>
            <div className="mt-1">
              当前班级诊断已定位到图谱节点 <span className="font-mono text-xs text-foreground">{graphCenterNodeId}</span>。
            </div>
            <Link
              href={`/teacher/classes/${encodeURIComponent(classId)}/kaq-evidence-trace?domain=${graphCenterTraceDomain}&nodeId=${encodeURIComponent(graphCenterNodeId)}`}
              className="mt-3 inline-flex rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
              data-teacher-kaq-evidence-trace-entry="graph-center-context"
            >
              查看 K/A/Q 证据追踪
            </Link>
          </section>
        ) : null}
        <div className="sr-only" role="status" aria-live="polite" data-teacher-report-delivery-status>
          {activeDeliveryState?.announcement ?? activeDeliveryState?.message ?? '教师报告交付动作已就绪。'}
        </div>
        <div className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-subtle" data-teacher-attainment-scope="cumulative">
          <span className="font-medium text-foreground">{insights.scopeLabel}</span>
          ：基于当前班级名册与每名学生的全部有效学习事实。趋势和风险均为最后一次证据触发的累计状态。
          {insights.availability.reason !== 'available'
            ? ` 当前班级画像不可用：${formatAvailabilityReason(insights.availability.reason)}。`
            : null}
        </div>
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
                title="累计能力达成指数"
                value={insights.overview.overallIndex ?? '不可用'}
                detail="当前成员累计画像的等权聚合结果"
                icon={<TrendingUp className="h-5 w-5 text-sky-500 dark:text-sky-300" />}
              />
              <MetricCard
                title="累计证据重点关注学生"
                value={insights.overview.attentionStudents}
                detail="当前存在中高证据风险或累计能力需提升"
                icon={<ShieldAlert className="h-5 w-5 text-rose-500" />}
              />
              <MetricCard
                title="高风险学生"
                value={insights.overview.highRiskStudents}
                detail="由最后一次相关学习证据触发"
                icon={<Sparkles className="h-5 w-5 text-amber-500" />}
              />
            </div>
          </div>
        </section>

        <CorrectionOutcomeSummaryPanel report={correctionReport} />
        <PersonalizedPathEffectPanel evaluation={pathEffect} />

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
              <h2 className="text-lg font-semibold text-foreground">累计能力达成概览</h2>
                    <p className="mt-1 text-sm text-subtle">七维累计画像分别按有有效证据的当前成员计算，不将缺失值计为零。</p>
              </div>
            </div>
            <div className="space-y-4">
              {insights.ability.dimensions.map((item) => (
                <div key={item.dimension} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-subtle">
                      {item.mean === null
                        ? `无有效证据 · 缺失 ${item.missingCount} 人`
                        : `均值 ${item.mean} · 纳入 ${item.includedCount} 人 · 缺失 ${item.missingCount} 人`}
                    </p>
                  </div>
                  <div className="teacher-insight-track">
                    <div className="teacher-insight-fill" style={{ width: `${Math.min(item.mean ?? 0, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">画像等级分布</h2>
              <p className="mt-1 text-sm text-subtle">只统计已有有效累计画像的当前成员。</p>
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

        <section
          className="surface-card mb-8 p-6"
          data-graph-center-diagnosis-view={graphCenterNodeId && graphCenterView === 'diagnosis' ? 'true' : undefined}
          data-graph-center-node-id={graphCenterNodeId ?? undefined}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">能力矩阵</h2>
              <p className="mt-1 text-sm text-subtle">
                按学生查看全部有效学习事实形成的七维能力分与覆盖状态；缺失或不可用状态不会显示为零分。
              </p>
            </div>
          </div>

          {!heatmap || heatmap.students.length === 0 ? (
            <div className="teacher-insight-metric">
              <p className="text-sm text-subtle">当前班级没有成员，暂不生成累计能力矩阵。</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-x-auto">
              <div className="teacher-insight-metric" data-cumulative-coverage-state={getCoverageState(heatmap.coverage)}>
                <p className="text-sm font-medium text-foreground">
                  有效画像覆盖 {heatmap.coverage.coveredStudents}/{heatmap.coverage.rosterStudents}
                </p>
                <p className="mt-1 text-xs text-subtle">{getCoverageLabel(heatmap.coverage)}</p>
              </div>
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
                        className={`teacher-insight-matrix-cell text-center ${getHeatmapCellClass(cell)}`}
                      >
                        {renderHeatmapCellValue(cell, student.coverageState)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8 grid gap-4 lg:grid-cols-3" data-cumulative-state-distributions>
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">累计趋势分布</h2>
            <p className="mt-1 text-sm text-subtle">聚合成员最后一次证据触发的个人趋势。</p>
            <DistributionRows
              distribution={insights.trendDistribution}
              labels={{ up: '上升', stable: '稳定', down: '下降', 'not-comparable': '尚无可比' }}
              emptyLabel="累计趋势尚不可用"
            />
          </div>
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">累计风险分布</h2>
            <p className="mt-1 text-sm text-subtle">只包含 constraint、stagnation 和 cross_domain 证据风险。</p>
            <DistributionRows
              distribution={insights.riskDistribution?.bySeverity ?? null}
              labels={{ high: '高', medium: '中', low: '低' }}
              emptyLabel="累计风险尚不可用"
            />
          </div>
          <div className="surface-card p-6">
            <h2 className="text-lg font-semibold text-foreground">七维累计诊断</h2>
            {insights.diagnosis ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-subtle">
                  优势：{formatDimensionList(insights.diagnosis.strengths)}
                </p>
                <p className="text-subtle">
                  待提升：{formatDimensionList(insights.diagnosis.improvementClusters)}
                </p>
                {insights.diagnosis.limitations.length > 0 ? (
                  <p className="text-subtle">限制：{insights.diagnosis.limitations.join('；')}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-subtle">
                {formatAvailabilityReason(insights.availability.reason)}
              </p>
            )}
          </div>
        </section>

        <section
          id="graph-center-affected-population"
          className="surface-card p-6"
          data-graph-center-population-view={graphCenterPopulationActive ? 'true' : undefined}
          data-graph-center-node-id={graphCenterNodeId ?? undefined}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">累计画像重点学生</h2>
              <p className="mt-1 text-sm text-subtle">依据当前累计能力、最后趋势和仍有效的证据风险排序。</p>
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
                      <p className="text-sm text-subtle">
                        趋势：{formatTrendDirection(student.trendDirection)}
                      </p>
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
                      <p className="text-2xl font-semibold text-foreground">{student.overallScore ?? '不可用'}</p>
                      <p className="mt-2 text-xs text-subtle">
                        证据截至 {formatEvidenceCutoff(student.evidenceStatus.lastEvidenceAt)}
                      </p>
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
        ledgerEntry={deliveryLedgerEntry}
        canDeliver={canDeliverReport}
        versionLabel={reportVersionLabel}
        onDownload={handleReportDownload}
        onCopySummary={handleCopySummary}
      />
    </div>
  );
}

function ReportDeliveryPanel({
  state,
  ledgerEntry,
  canDeliver,
  versionLabel,
  onDownload,
  onCopySummary,
  onRecordIntervention,
}: {
  state: AuditedActionState | null;
  ledgerEntry: TeacherReportDeliveryLedgerEntry;
  canDeliver: boolean;
  versionLabel: string;
  onDownload: () => void;
  onCopySummary: () => void;
  onRecordIntervention: () => void;
}) {
  return (
    <section
      className="surface-card mb-8 p-5"
      data-teacher-report-delivery="workspace"
      data-report-version={versionLabel}
      data-report-ledger-action-id={ledgerEntry.actionId}
      data-report-ledger-idempotency-key={ledgerEntry.idempotencyKey}
      data-report-ledger-artifact-ref={ledgerEntry.artifactRef}
      data-report-ledger-redaction-policy={ledgerEntry.redactionPolicy}
      data-report-ledger-delivery-status={ledgerEntry.deliveryStatus}
      data-report-ledger-context-state={ledgerEntry.contextState}
      data-report-ledger-class-id={ledgerEntry.classId ?? undefined}
      data-report-ledger-session-id={ledgerEntry.sessionId ?? undefined}
      data-report-ledger-lesson-id={ledgerEntry.lessonId ?? undefined}
      data-report-ledger-grading-run-id={ledgerEntry.gradingRunId ?? undefined}
      data-report-ledger-source={ledgerEntry.source ?? undefined}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Report delivery</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">教师报告交付</h2>
          <p className="mt-1 text-sm text-subtle">
            版本 {versionLabel} · {canDeliver
              ? '当前可导出报告和复制摘要；发送对象、版本锁定和补强任务保留为可恢复状态。'
              : '缺少课堂、课次或学生上下文，导出、摘要复制和评分交接暂不可执行。'}
          </p>
        </div>
        <ReportDeliveryActions
          canDeliver={canDeliver}
          onDownload={onDownload}
          onCopySummary={onCopySummary}
        />
      </div>
      <ReportDeliveryCapabilityNote />
      <ReportDeliveryHandoffStates entry={ledgerEntry} canDeliver={canDeliver} onRecordIntervention={onRecordIntervention} />
      <ReportDeliveryLedgerDetails entry={ledgerEntry} />
      {state ? <ActionStatusPanel state={state} className="mt-4" /> : null}
    </section>
  );
}

function CorrectionOutcomeSummaryPanel({
  report,
}: {
  report: ControlCorrectionTeacherReport | null;
}) {
  const summary = report?.correctionOutcomeSummary;
  const states: Array<{
    key: keyof NonNullable<ControlCorrectionTeacherReport['correctionOutcomeSummary']>['states'];
    label: string;
  }> = [
    { key: 'improved', label: '后续证据显示已改善' },
    { key: 'needs-review', label: '后续证据显示仍需复习' },
    { key: 'pending-verification', label: '尚未有足够后续证据' },
    { key: 'indeterminate', label: '证据无法判断' },
  ];

  return (
    <section className="surface-card mb-8 p-6" data-teacher-correction-outcome-summary="aggregate-only">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">纠偏方案后续证据</h2>
        <p className="mt-1 text-sm text-subtle">
          仅统计已确认并应用的方案；这些结果反映后续证据，不代表纠偏方案造成了结果。
        </p>
      </div>
      {!summary ? (
        <p className="text-sm text-subtle">当前暂无可用的班级聚合数据。</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-correction-outcome-total={summary.total}>
          {states.map(({ key, label }) => {
            const item = summary.states[key];
            return (
              <div key={key} className="teacher-insight-metric" data-correction-outcome-state={key}>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{item.count}</p>
                <p className="text-xs text-subtle">{Math.round(item.rate * 100)}% of eligible corrections</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function buildDeliveryActionIdentity(
  entry: TeacherReportDeliveryLedgerEntry,
  label: string,
  requestedAction: 'export' | 'summary',
) {
  const actionId = entry.actionId.replace(`:${entry.action}:`, `:${requestedAction}:`);
  return {
    id: actionId,
    category: requestedAction === 'export' ? 'export' as const : 'save' as const,
    label,
    sourceRoute: '/teacher/classes/report-delivery-ledger',
    targetId: entry.artifactRef,
    requestedAction,
  };
}

function ReportDeliveryDock({
  state,
  ledgerEntry,
  canDeliver,
  versionLabel,
  onDownload,
  onCopySummary,
}: {
  state: AuditedActionState | null;
  ledgerEntry: TeacherReportDeliveryLedgerEntry;
  canDeliver: boolean;
  versionLabel: string;
  onDownload: () => void;
  onCopySummary: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur md:hidden"
      data-teacher-report-delivery="mobile-fixed-actions"
      data-report-ledger-action-id={ledgerEntry.actionId}
      data-report-ledger-delivery-status={ledgerEntry.deliveryStatus}
      data-report-ledger-context-state={ledgerEntry.contextState}
      data-report-ledger-session-id={ledgerEntry.sessionId ?? undefined}
    >
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">教师报告交付 · {versionLabel}</p>
          <p className="text-xs text-subtle">{state ? state.message : '固定动作区可在长报告任意位置完成导出和摘要复制。'}</p>
        </div>
        <ReportDeliveryActions
          canDeliver={canDeliver}
          onDownload={onDownload}
          onCopySummary={onCopySummary}
        />
      </div>
    </div>
  );
}

function ReportDeliveryLedgerDetails({ entry }: { entry: TeacherReportDeliveryLedgerEntry }) {
  return (
    <div
      className="mt-4 grid gap-2 text-xs text-subtle lg:grid-cols-4"
      data-teacher-report-ledger-details="class-analytics"
    >
      <span className="rounded border border-border/70 px-3 py-2">动作：{entry.action}</span>
      <span className="rounded border border-border/70 px-3 py-2">范围：{entry.deliveryScope}</span>
      <span className="rounded border border-border/70 px-3 py-2">产物：{entry.artifactRef}</span>
      <span className="rounded border border-border/70 px-3 py-2">脱敏：{entry.redactionPolicy}</span>
      <span className="rounded border border-border/70 px-3 py-2">上下文：{entry.contextState}</span>
      <span className="rounded border border-border/70 px-3 py-2">课堂：{entry.sessionId ?? '未指定'}</span>
    </div>
  );
}

function ReportDeliveryActions({
  canDeliver,
  onDownload,
  onCopySummary,
}: {
  canDeliver: boolean;
  onDownload: () => void;
  onCopySummary: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onDownload}
        disabled={!canDeliver}
        className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="导出教师报告 JSON 文件"
        data-report-ledger-action-disabled={canDeliver ? 'false' : 'missing-context'}
      >
        <Download className="h-4 w-4" />
        导出 JSON
      </button>
      <button
        type="button"
        onClick={onCopySummary}
        disabled={!canDeliver}
        className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="复制教师报告摘要"
        data-report-ledger-action-disabled={canDeliver ? 'false' : 'missing-context'}
      >
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

function ReportDeliveryHandoffStates({
  entry,
  canDeliver,
  onRecordIntervention,
}: {
  entry: TeacherReportDeliveryLedgerEntry;
  canDeliver: boolean;
  onRecordIntervention: () => void;
}) {
  const gradingHref = buildReportDeliveryGradingHref(entry);
  const canRecordIntervention = canDeliver && Boolean(entry.interventionAction.studentId);

  return (
    <div
      className="mt-4 grid gap-2 text-xs text-subtle sm:grid-cols-3"
      data-teacher-report-handoff-states="delivery-status-contract"
    >
      <div
        className="rounded border border-border/70 px-3 py-2"
        data-report-ledger-send-publish-state="degraded"
        data-teacher-intervention-action-id={entry.interventionAction.id}
        data-teacher-intervention-action-status={entry.interventionAction.status}
        data-teacher-intervention-persistence-target={entry.interventionAction.persistenceTarget}
      >
        发送/发布：{entry.interventionAction.privacySafeSummary}
        <button
          type="button"
          disabled={!canRecordIntervention}
          onClick={onRecordIntervention}
          className="mt-2 block rounded border border-border px-2 py-1 text-left text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          data-teacher-intervention-record-action={canRecordIntervention ? 'available' : canDeliver ? 'needs-student' : 'missing-context'}
        >
          {canRecordIntervention ? '创建处置记录' : '选择学生后创建处置记录'}
        </button>
      </div>
      {canDeliver ? (
        <Link
          href={gradingHref}
          className="rounded border border-border/70 px-3 py-2 transition hover:border-primary/40 hover:text-foreground"
          data-report-ledger-grading-handoff-state="ready"
          data-report-ledger-grading-context={entry.contextState}
        >
          评分交接：进入报告评分工作台处理草稿。
        </Link>
      ) : (
        <div
          className="rounded border border-border/70 px-3 py-2"
          data-report-ledger-grading-handoff-state="blocked"
          data-report-ledger-grading-context={entry.contextState}
        >
          评分交接：缺少课堂、课次或学生上下文后暂不可进入。
        </div>
      )}
      <div
        className="rounded border border-border/70 px-3 py-2"
        data-report-ledger-retry-state="available"
        data-teacher-intervention-student-target={entry.interventionAction.studentFacingTarget.surface}
      >
        失败重试：导出、复制或对象缺失时保留恢复动作。
      </div>
    </div>
  );
}

function buildReportDeliveryGradingHref(entry: TeacherReportDeliveryLedgerEntry) {
  const returnTo = entry.classId
    ? `/teacher/classes/${entry.classId}/analytics-v2`
    : '/teacher/classes';
  const params = new URLSearchParams({
    status: 'draft',
    source: 'report-ledger',
    reportId: entry.reportId,
    returnTo,
  });
  if (entry.classId) params.set('classId', entry.classId);
  if (entry.sessionId) params.set('sessionId', entry.sessionId);
  if (entry.lessonId) params.set('lessonId', entry.lessonId);
  if (entry.gradingRunId) params.set('gradingRunId', entry.gradingRunId);
  if (entry.studentId) params.set('studentId', entry.studentId);
  return `/teacher/grading-workbench?${params.toString()}`;
}

function buildInterventionRequestBody(entry: TeacherReportDeliveryLedgerEntry) {
  const action = entry.interventionAction;
  return {
    kind: action.kind,
    surface: action.surface,
    studentId: action.studentId,
    classId: action.classId,
    sessionId: action.sessionId,
    lessonId: action.lessonId,
    reportId: action.reportId,
    gradingRunId: action.gradingRunId,
    source: action.source,
    sourceEvidenceRefs: action.sourceEvidenceRefs,
    learnerState: action.studentId ? 'ready' : 'partial',
  };
}

function readApiError(payload: unknown) {
  return payload && typeof payload === 'object' && !Array.isArray(payload) && typeof (payload as { error?: unknown }).error === 'string'
    ? (payload as { error: string }).error
    : null;
}

function hasPersistedIntervention(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const record = payload as { outbox?: unknown; interventionId?: unknown };
  return record.outbox === 'recorded' || record.outbox === 'duplicate' || typeof record.interventionId === 'string';
}

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: ReactNode;
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

function getHeatmapCellClass(cell: HeatmapData['matrix'][number] | undefined) {
  if (!cell) {
    return 'text-subtle';
  }

  if (cell.score >= 85) return 'text-emerald-600 dark:text-emerald-300';
  if (cell.score >= 70) return 'text-sky-600 dark:text-sky-300';
  if (cell.score >= 55) return 'text-amber-600 dark:text-amber-300';
  return 'text-rose-600 dark:text-rose-300';
}

function getCoverageState(coverage: HeatmapData['coverage']) {
  if (coverage.rosterStudents === 0 || coverage.coveredStudents === 0) return 'none';
  return coverage.coveredStudents >= coverage.rosterStudents ? 'complete' : 'partial';
}

function getCoverageLabel(coverage: HeatmapData['coverage']) {
  const state = getCoverageState(coverage);
  if (state === 'none') {
    return `当前名册尚无有效累计画像：${coverage.noEvidenceStudents} 名无合格证据，${coverage.unavailableStudents} 名不可用。`;
  }
  if (state === 'complete') return '当前名册已全部生成有效累计画像。';
  return `当前名册部分可用：${coverage.noEvidenceStudents} 名无合格证据，${coverage.unavailableStudents} 名不可用。`;
}

function renderHeatmapCellValue(
  cell: HeatmapData['matrix'][number] | undefined,
  coverageState: HeatmapData['students'][number]['coverageState'],
) {
  if (!cell) {
    if (coverageState === 'no-evidence') return '无合格证据';
    if (coverageState === 'unavailable') return '不可用';
    return '该维度缺失';
  }

  return cell.score;
}

function DistributionRows({
  distribution,
  labels,
  emptyLabel,
}: {
  distribution: Record<string, number> | null;
  labels: Record<string, string>;
  emptyLabel: string;
}) {
  if (!distribution) {
    return <p className="mt-4 text-sm text-subtle">{emptyLabel}</p>;
  }
  return (
    <div className="mt-4 space-y-2">
      {Object.entries(labels).map(([key, label]) => (
        <div key={key} className="flex items-center justify-between text-sm">
          <span className="text-subtle">{label}</span>
          <span className="font-medium text-foreground">{distribution[key] ?? 0} 人</span>
        </div>
      ))}
    </div>
  );
}

function formatTrendDirection(direction: TeacherClassInsightsPayload['students'][number]['trendDirection']) {
  if (direction === 'up') return '上升';
  if (direction === 'down') return '下降';
  if (direction === 'stable') return '稳定';
  return '尚无可比';
}

function formatDimensionList(dimensions: PortraitV2DimensionId[]) {
  if (dimensions.length === 0) return '尚无';
  const labels = new Map(PORTRAIT_V2_DIMENSIONS.map((dimension) => [dimension.id, dimension.label]));
  return dimensions.map((dimension) => labels.get(dimension) ?? dimension).join('、');
}

function formatAvailabilityReason(reason: string) {
  if (reason === 'available') return '可使用';
  if (reason === 'no-eligible-evidence') return '没有合格学习事实';
  if (reason === 'no-evidence-after-revocation') return '支持证据已撤销';
  if (reason === 'migration-in-progress') return '累计画像迁移中';
  if (reason === 'processing-failed') return '累计画像处理失败';
  return '累计画像版本或发布状态不一致';
}

function formatEvidenceCutoff(value: string | null) {
  if (!value) return '不可用';
  return new Date(value).toLocaleString('zh-CN');
}
