'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileClock,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Target,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  DiagnosisReportApiItem,
  DiagnosisReportsPayload,
} from '@/features/teacher/diagnosis/public-api';
import type { DiagnosisGenerationJobApiItem } from '@/lib/diagnosis-generation';
import type { DiagnosisGenerationPreflightApiItem } from '@/lib/diagnosis-generation-preflight';
import {
  projectReportHistoryCard,
  type EvidenceCoverageGroup,
  type ReportComparison,
} from '@/features/teacher/teacher-diagnosis-report-history-projection';

type ReportHistoryState = 'loading' | 'ready' | 'error';

interface TeacherDiagnosisReportHistoryProps {
  classId: string;
  targetStudentId?: string;
  subjectLabel: string;
}

interface TeacherDiagnosisReportHistoryViewProps {
  classId?: string;
  state: ReportHistoryState;
  reports: DiagnosisReportApiItem[];
  selectedReportId?: string | null;
  subjectLabel: string;
  errorMessage?: string | null;
  onRefresh?: () => void;
  onSelectReport?: (reportId: string) => void;
  generationJob?: DiagnosisGenerationJobApiItem | null;
  generationError?: string | null;
  onGenerate?: () => void;
  onRetryGeneration?: () => void;
  generationPreflight?: DiagnosisGenerationPreflightApiItem | null;
  preflightLoading?: boolean;
  onClosePreflight?: () => void;
  onConfirmGeneration?: (forceReason?: string) => void;
}

const CONFIDENCE_LABELS = {
  high: '高置信度',
  medium: '中置信度',
  low: '低置信度',
  unavailable: '置信度不可用',
} as const;

const RISK_LABELS = {
  stagnation: '停滞',
  constraint: '约束',
  cross_domain: '跨域失衡',
} as const;

const SEVERITY_LABELS = {
  low: '低',
  medium: '中',
  high: '高',
} as const;

const REPORT_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
});

export function TeacherDiagnosisReportHistory({
  classId,
  targetStudentId,
  subjectLabel,
}: TeacherDiagnosisReportHistoryProps) {
  const [state, setState] = useState<ReportHistoryState>('loading');
  const [reports, setReports] = useState<DiagnosisReportApiItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generationJob, setGenerationJob] = useState<DiagnosisGenerationJobApiItem | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationPreflight, setGenerationPreflight] = useState<DiagnosisGenerationPreflightApiItem | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setState('loading');
    setErrorMessage(null);
    try {
      const searchParams = new URLSearchParams({ limit: '20' });
      if (targetStudentId) searchParams.set('studentId', targetStudentId);
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(classId)}/diagnosis-reports?${searchParams.toString()}`,
      );
      const payload = await response.json().catch(() => null) as
        | (Partial<DiagnosisReportsPayload> & { error?: string })
        | null;
      if (!response.ok || !Array.isArray(payload?.reports)) {
        throw new Error(payload?.error || '诊断报告读取失败');
      }
      setReports(payload.reports);
      setSelectedReportId((current) => (
        current && payload.reports!.some((report) => report.id === current)
          ? current
          : payload.reports![0]?.id ?? null
      ));
      setState('ready');
    } catch (error) {
      setReports([]);
      setSelectedReportId(null);
      setErrorMessage(error instanceof Error ? error.message : '诊断报告读取失败');
      setState('error');
    }
  }, [classId, targetStudentId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const loadPreflight = useCallback(async () => {
    setGenerationError(null);
    setPreflightLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (targetStudentId) searchParams.set('studentId', targetStudentId);
      const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(classId)}/diagnosis-reports/preflight${query}`,
      );
      const payload = await response.json().catch(() => null) as {
        preflight?: DiagnosisGenerationPreflightApiItem;
        error?: string;
      } | null;
      if (!response.ok || !payload?.preflight) {
        throw new Error(payload?.error || '读取诊断生成预检失败');
      }
      setGenerationPreflight(payload.preflight);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '读取诊断生成预检失败');
    } finally {
      setPreflightLoading(false);
    }
  }, [classId, targetStudentId]);

  const submitGeneration = useCallback(async (retry = false, forceReason?: string) => {
    setGenerationError(null);
    try {
      const response = retry && generationJob
        ? await fetch(`/api/teacher/diagnosis-generation-jobs/${encodeURIComponent(generationJob.id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'retry', idempotencyKey: crypto.randomUUID() }),
          })
        : await fetch(`/api/teacher/classes/${encodeURIComponent(classId)}/diagnosis-reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey: crypto.randomUUID(),
              ...(targetStudentId ? { targetStudentId } : {}),
              ...(forceReason ? { force: true, forceReason } : {}),
            }),
          });
      const payload = await response.json().catch(() => null) as { job?: DiagnosisGenerationJobApiItem; error?: string } | null;
      if (!payload?.job) throw new Error(payload?.error || '创建诊断生成任务失败');
      setGenerationJob(payload.job);
      setGenerationPreflight(null);
      if (!response.ok) setGenerationError(payload.error || '诊断生成任务投递失败');
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '创建诊断生成任务失败');
    }
  }, [classId, generationJob, targetStudentId]);

  useEffect(() => {
    if (!generationJob || !['QUEUED', 'RUNNING'].includes(generationJob.state)) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/teacher/diagnosis-generation-jobs/${encodeURIComponent(generationJob.id)}`)
        .then(async (response) => {
          const payload = await response.json() as { job?: DiagnosisGenerationJobApiItem; error?: string };
          if (!response.ok || !payload.job) throw new Error(payload.error || '读取诊断生成状态失败');
          setGenerationJob(payload.job);
          if (payload.job.state === 'COMPLETED') void loadReports();
        })
        .catch((error) => setGenerationError(error instanceof Error ? error.message : '读取诊断生成状态失败'));
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [generationJob, loadReports]);

  return (
      <TeacherDiagnosisReportHistoryView
        classId={classId}
      state={state}
      reports={reports}
      selectedReportId={selectedReportId}
      subjectLabel={subjectLabel}
      errorMessage={errorMessage}
      onRefresh={() => void loadReports()}
      onSelectReport={setSelectedReportId}
      generationJob={generationJob}
      generationError={generationError}
      generationPreflight={generationPreflight}
      preflightLoading={preflightLoading}
      onGenerate={() => void loadPreflight()}
      onClosePreflight={() => setGenerationPreflight(null)}
      onConfirmGeneration={(forceReason) => void submitGeneration(false, forceReason)}
      onRetryGeneration={() => void submitGeneration(true)}
    />
  );
}

export function TeacherDiagnosisReportHistoryView({
  classId,
  state,
  reports,
  selectedReportId,
  subjectLabel,
  errorMessage,
  onRefresh,
  onSelectReport,
  generationJob,
  generationError,
  onGenerate,
  onRetryGeneration,
  generationPreflight,
  preflightLoading,
  onClosePreflight,
  onConfirmGeneration,
}: TeacherDiagnosisReportHistoryViewProps) {
  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId],
  );

  return (
    <section
      id="diagnosis-report-history"
      className="surface-card relative overflow-hidden border-sky-500/20"
      data-teacher-diagnosis-report-history
      data-report-history-state={state}
      data-report-history-scope={selectedReport?.scopeType ?? 'empty'}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_62%)]" />
      <header className="relative flex flex-col gap-4 border-b border-border/70 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300">
            <History className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
              可回看诊断记录
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">学情诊断报告历史</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-subtle">
              {subjectLabel} · 读取持久化快照不会重新调用模型，也不会产生新的教学动作。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-diagnosis-generation-action="generate"
            onClick={onGenerate}
            disabled={preflightLoading || generationJob?.state === 'QUEUED' || generationJob?.state === 'RUNNING'}
            className="btn-themed inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm disabled:cursor-wait disabled:opacity-60"
          >
            {preflightLoading || generationJob?.state === 'QUEUED' || generationJob?.state === 'RUNNING'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <BookOpenCheck className="h-4 w-4" />}
            {preflightLoading
              ? '检查生成条件'
              : generationJob?.state === 'QUEUED'
              ? '等待生成'
              : generationJob?.state === 'RUNNING'
                ? '正在生成'
                : '生成新诊断'}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={state === 'loading'}
            className="btn-ghost-themed inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={state === 'loading' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新历史
          </button>
        </div>
      </header>

      {generationPreflight ? (
        <GenerationPreflight
          preflight={generationPreflight}
          onClose={onClosePreflight}
          onConfirm={onConfirmGeneration}
        />
      ) : null}

      {generationJob || generationError ? (
        <GenerationStatus
          job={generationJob}
          error={generationError}
          onRetry={onRetryGeneration}
        />
      ) : null}

      {state === 'loading' ? <LoadingState /> : null}
      {state === 'error' ? <ErrorState message={errorMessage} onRetry={onRefresh} /> : null}
      {state === 'ready' && reports.length === 0 ? <EmptyState /> : null}
      {state === 'ready' && selectedReport ? (
        <div className="relative grid min-w-0 lg:grid-cols-[21rem,minmax(0,1fr)]">
          <ReportIndex
            reports={reports}
            selectedReportId={selectedReport.id}
            onSelectReport={onSelectReport}
          />
          <ReportDetail
            classId={classId}
            report={selectedReport}
            adjacentOlderReport={reports[reports.findIndex((report) => report.id === selectedReport.id) + 1]}
          />
        </div>
      ) : null}
    </section>
  );
}

function GenerationStatus({
  job,
  error,
  onRetry,
}: {
  job?: DiagnosisGenerationJobApiItem | null;
  error?: string | null;
  onRetry?: () => void;
}) {
  const failed = job?.state === 'FAILED' || job?.state === 'TIMED_OUT';
  if (job?.state === 'COMPLETED' && !error) {
    return (
      <details
        className="relative border-b border-emerald-500/20 bg-emerald-500/5 px-5 py-3 text-sm sm:px-6"
        data-diagnosis-generation-state="COMPLETED"
      >
        <summary className="cursor-pointer font-medium text-foreground">
          诊断生成完成，报告历史已更新
        </summary>
        <p className="mt-2 text-xs text-subtle">证据截止：{formatReportTime(job.evidenceCutoff)}</p>
      </details>
    );
  }
  return (
    <div
      className={`relative flex flex-col gap-2 border-b px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
        failed || error ? 'border-amber-500/25 bg-amber-500/10' : 'border-sky-500/20 bg-sky-500/5'
      }`}
      data-diagnosis-generation-state={job?.state ?? 'ERROR'}
    >
      <div>
        <p className="font-medium text-foreground">
          {job?.state === 'QUEUED' ? '诊断任务已进入队列' : null}
          {job?.state === 'RUNNING' ? '正在依据固定证据快照生成诊断' : null}
          {job?.state === 'COMPLETED' ? '诊断生成完成，报告历史已更新' : null}
          {job?.state === 'FAILED' ? '诊断生成失败' : null}
          {job?.state === 'TIMED_OUT' ? '诊断生成超时' : null}
          {!job ? '诊断任务创建失败' : null}
        </p>
        <p className="mt-1 text-xs text-subtle">
          {error || job?.failureMessage || (job ? `证据截止：${formatReportTime(job.evidenceCutoff)}` : '')}
        </p>
      </div>
      {failed && job?.retryable ? (
        <button
          type="button"
          data-diagnosis-generation-action="retry"
          onClick={onRetry}
          className="btn-ghost-themed rounded-lg px-3 py-2 text-sm"
        >
          重试原任务
        </button>
      ) : null}
    </div>
  );
}

function GenerationPreflight({
  preflight,
  onClose,
  onConfirm,
}: {
  preflight: DiagnosisGenerationPreflightApiItem;
  onClose?: () => void;
  onConfirm?: (forceReason?: string) => void;
}) {
  const [forceReason, setForceReason] = useState('');
  const statusCopy = {
    FIRST_GENERATION: ['首次生成', '当前范围尚无正式诊断报告。'],
    NEW_EVIDENCE: ['存在新的诊断依据', '受治理输入已发生有效变化。'],
    VERSION_CHANGE: ['生成版本已变化', '生成器或确定性预检规则已更新。'],
    NO_EFFECTIVE_CHANGE: ['没有有效变化', '与上一份正式报告相比，当前受治理输入和版本均未变化。'],
    ACTIVE_JOB: ['已有生成任务', '当前范围已有排队或运行中的诊断任务。'],
    UNAVAILABLE: ['暂不可生成', '当前范围没有生成器可读取的合格受治理输入。'],
  } as const;
  const [title, description] = statusCopy[preflight.status];
  const categoryLabels = {
    assignment: '作业',
    assessment: '测验',
    learningBehavior: '学习行为',
    risk: '风险',
    eligibility: '诊断资格',
  } as const;
  return (
    <div className="relative border-b border-sky-500/20 bg-sky-500/5 px-5 py-4 sm:px-6" data-diagnosis-preflight-status={preflight.status}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-sm text-subtle">{description}</p>
          {preflight.previousReport ? (
            <p className="mt-1 text-xs text-subtle">
              上一份报告证据截止：{formatReportTime(preflight.previousReport.evidenceCutoff)}
            </p>
          ) : null}
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(preflight.categories).map(([name, category]) => (
              <div key={name} className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
                <dt className="text-xs text-subtle">{categoryLabels[name as keyof typeof categoryLabels]}</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {category.availability === 'unavailable'
                    ? '未接入'
                    : `${category.changedCount ?? 0} 项变化`}
                </dd>
              </div>
            ))}
          </dl>
          {preflight.canForce ? (
            <label className="mt-3 block max-w-xl text-sm text-foreground">
              强制生成理由
              <textarea
                value={forceReason}
                onChange={(event) => setForceReason(event.target.value)}
                minLength={8}
                maxLength={1_000}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="说明为什么在证据未变化时仍需形成新的正式报告（至少 8 个字符）"
              />
            </label>
          ) : null}
        </div>
        <div className="flex flex-none gap-2">
          <button type="button" onClick={onClose} className="btn-ghost-themed rounded-lg px-3 py-2 text-sm">
            取消
          </button>
          {preflight.canGenerate ? (
            <button
              type="button"
              data-diagnosis-generation-action="confirm"
              onClick={() => onConfirm?.()}
              className="btn-themed rounded-lg px-3 py-2 text-sm"
            >
              确认生成
            </button>
          ) : null}
          {preflight.canForce ? (
            <button
              type="button"
              data-diagnosis-generation-action="force"
              disabled={forceReason.trim().length < 8}
              onClick={() => onConfirm?.(forceReason.trim())}
              className="btn-themed rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              强制生成
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReportIndex({
  reports,
  selectedReportId,
  onSelectReport,
}: {
  reports: DiagnosisReportApiItem[];
  selectedReportId: string;
  onSelectReport?: (reportId: string) => void;
}) {
  return (
    <nav
      className="border-b border-border/70 bg-accent/25 p-3 lg:border-b-0 lg:border-r"
      aria-label="诊断报告历史"
    >
      <div className="mb-2 flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-subtle">最近 {reports.length} 份报告</span>
        <FileClock className="h-4 w-4 text-subtle" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[38rem] lg:flex-col lg:overflow-y-auto">
        {reports.map((report, index) => {
          const selected = report.id === selectedReportId;
          const degraded = isDegraded(report);
          const projection = projectReportHistoryCard(report, reports[index + 1]);
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => onSelectReport?.(report.id)}
              aria-current={selected ? 'true' : undefined}
              aria-label={`${projection.scopeLabel}诊断报告，${formatReportTime(report.generatedAt)}，${projection.availability.label}`}
              className={`min-w-[17rem] rounded-lg border px-3 py-3 text-left transition lg:min-w-0 ${
                selected
                  ? 'border-sky-500/40 bg-sky-500/10 shadow-sm'
                  : 'border-border/60 bg-card/60 hover:border-sky-500/25 hover:bg-card'
              }`}
              data-report-history-item={report.id}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
                  报告 {String(reports.length - index).padStart(2, '0')}
                </span>
                <span className={degraded ? 'text-xs font-medium text-amber-700 dark:text-amber-300' : 'text-xs font-medium text-emerald-700 dark:text-emerald-300'}>
                  {projection.availability.label}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{projection.scopeLabel} · {projection.includedStudentsLabel}</p>
              <p className="mt-1 text-xs text-subtle">生成时间：{formatReportTime(report.generatedAt)}</p>
              <p className="mt-1 text-xs text-subtle">证据截止：{projection.evidenceCutoffLabel}</p>
              <p className="mt-2 line-clamp-2 text-sm leading-5 text-foreground">主要薄弱点：{projection.mainWeaknessLabel}</p>
              <p className="mt-1 text-xs text-subtle">风险人数：未提供 · 限制：{projection.declaredLimitations.length + (projection.attributionLimited ? 1 : 0)} 项</p>
              <p className="mt-2 text-xs leading-5 text-subtle">
                {projection.generationReason}
              </p>
              <p className="mt-2 text-xs font-medium leading-5 text-sky-700 dark:text-sky-300">
                {projection.comparison.description}
              </p>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ReportDetail({
  classId,
  report,
  adjacentOlderReport,
}: {
  classId?: string;
  report: DiagnosisReportApiItem;
  adjacentOlderReport?: DiagnosisReportApiItem;
}) {
  const degraded = isDegraded(report);
  const projection = projectReportHistoryCard(report, adjacentOlderReport);
  const evidenceCount = new Set([
    ...report.reportBody.evidenceRefs,
    ...report.reportBody.findings.flatMap((finding) => finding.evidenceRefs),
  ]).size;

  return (
    <article className="min-w-0 p-5 sm:p-6" data-selected-diagnosis-report={report.id} data-report-degraded={degraded}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className={degraded ? 'diagnosis-chip-muted' : 'diagnosis-chip-ready'}>
              {projection.availability.label}
            </span>
            <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-subtle">
              {report.scopeType === 'student' ? '学生报告' : '班级报告'}
            </span>
          </div>
          <p className="mt-4 text-base leading-7 text-foreground">{report.reportBody.summary}</p>
        </div>
        <dl className="grid min-w-0 grid-cols-2 gap-2 text-sm sm:min-w-[17rem]">
          <Metric label="诊断范围" value={projection.scopeLabel} />
          <Metric label="纳入人数" value={projection.includedStudentsLabel} />
          <Metric label="生成时间" value={formatReportTime(report.generatedAt)} />
          <Metric label="证据截止" value={formatReportTime(report.evidenceCutoff)} />
          <Metric label="诊断结构版本" value={report.generatorVersion} mono />
        </dl>
      </div>

      {classId ? (
        <div className="mt-5 flex flex-wrap gap-2" data-diagnosis-delivery-entry>
          <Link
            href={`/teacher/classes/${encodeURIComponent(classId)}/diagnosis-reports/${encodeURIComponent(report.id)}`}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-[background-color,box-shadow,transform] hover:bg-primary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px"
            data-diagnosis-delivery-primary="true"
          >
            打开教师交付版
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {report.scopeType === 'student' ? (
            <Link
              href={`/teacher/classes/${encodeURIComponent(classId)}/diagnosis-reports/${encodeURIComponent(report.id)}?role=student`}
              className="btn-ghost-themed rounded-lg px-3 py-2 text-sm"
            >
              预览学生安全版
            </Link>
          ) : (
            <span className="px-1 py-2 text-xs text-subtle">班级报告不生成学生安全版</span>
          )}
        </div>
      ) : null}

      <section className="mt-6 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4" data-report-availability={projection.availability.label}>
        <h3 className="text-sm font-semibold text-foreground">报告状态：{projection.availability.label}</h3>
        <p className="mt-2 text-sm leading-6 text-subtle">{projection.availability.description}</p>
        <p className="mt-2 text-sm font-medium text-sky-700 dark:text-sky-300">恢复建议：{projection.availability.recoveryAction}</p>
      </section>

      <EvidenceCoverageSummary groups={projection.evidenceGroups} />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="受治理证据" value={`${evidenceCount} 条`} />
        <Metric label="总体置信度" value={CONFIDENCE_LABELS[report.reportBody.confidence]} />
        <Metric label="风险发现" value={`${report.riskSummary.total} 项`} />
        <Metric label="局限说明" value={`${report.reportBody.limitations.length} 项`} />
      </div>

      <ConfidenceExplanation reasons={projection.confidenceReasons} />

      <div className="mt-7">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-sky-600 dark:text-sky-300" />
          <h3 className="text-sm font-semibold text-foreground">受治理发现项</h3>
        </div>
        {report.reportBody.findings.length > 0 ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {report.reportBody.findings.map((finding, index) => (
              <section key={`${finding.title}:${index}`} className="rounded-xl border border-border/70 bg-card/65 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{finding.title}</p>
                    {finding.summary ? <p className="mt-2 text-sm leading-6 text-subtle">{finding.summary}</p> : null}
                  </div>
                  {finding.severity ? (
                    <span className={severityClassName(finding.severity)}>
                      {SEVERITY_LABELS[finding.severity]}风险
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
                  {finding.riskType ? <span>{RISK_LABELS[finding.riskType]}</span> : null}
                  {finding.confidence ? <span>· {CONFIDENCE_LABELS[finding.confidence]}</span> : null}
                  <span>· {finding.evidenceRefs.length} 条受治理证据</span>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-subtle">
            此快照没有形成可展示的结构化发现项；这不代表不存在学习风险。
          </p>
        )}
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        <RiskSummary report={report} />
        <ComparisonSummary comparison={projection.comparison} />
        <Limitations projection={projection} />
      </div>
    </article>
  );
}

function EvidenceCoverageSummary({ groups }: { groups: EvidenceCoverageGroup[] }) {
  return (
    <section className="mt-7" aria-labelledby="diagnosis-evidence-coverage-title">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-sky-600 dark:text-sky-300" />
        <h3 id="diagnosis-evidence-coverage-title" className="text-sm font-semibold text-foreground">证据覆盖摘要</h3>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {groups.map((group) => (
          <section key={group.id} className="rounded-xl border border-border/70 bg-card/65 p-4" data-evidence-group={group.id}>
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-medium text-foreground">{group.label}</h4>
              <span className={coverageStateClassName(group.state)}>{coverageStateLabel(group.state)}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Metric label="纳入" value={group.includedLabel} />
              <Metric label="缺失" value={group.missingLabel} />
            </dl>
            <p className="mt-3 text-xs leading-5 text-subtle">{group.explanation}</p>
            {group.detailSources.length > 0 ? (
              <details className="mt-3 text-xs text-subtle">
                <summary className="cursor-pointer font-medium text-sky-700 dark:text-sky-300">查看来源明细</summary>
                <p className="mt-2 leading-5">{group.detailSources.join('、')}</p>
              </details>
            ) : null}
          </section>
        ))}
      </div>
    </section>
  );
}

function ConfidenceExplanation({ reasons }: { reasons: ReturnType<typeof projectReportHistoryCard>['confidenceReasons'] }) {
  return (
    <section className="mt-7 rounded-xl border border-border/70 bg-accent/25 p-4" aria-labelledby="diagnosis-confidence-reasons-title">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-300" />
        <h3 id="diagnosis-confidence-reasons-title" className="text-sm font-semibold text-foreground">置信度与覆盖说明</h3>
      </div>
      {reasons.length > 0 ? (
        <ul className="mt-3 space-y-3 text-sm leading-6 text-subtle">
          {reasons.map((item) => (
            <li key={item.reason}>
              <p>{item.reason}</p>
              <p className="font-medium text-sky-700 dark:text-sky-300">恢复建议：{item.recoveryAction}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-subtle">当前报告没有发现额外的可验证覆盖限制。</p>
      )}
    </section>
  );
}

function ComparisonSummary({ comparison }: { comparison: ReportComparison }) {
  return (
    <section className="rounded-xl border border-border/70 bg-accent/25 p-4" data-report-comparison={comparison.state}>
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-sky-600 dark:text-sky-300" />
        <h3 className="text-sm font-semibold text-foreground">相邻报告变化</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-subtle">{comparison.description}</p>
      {comparison.state === 'ready' ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="新增" value={comparison.additions ?? 0} />
          <Metric label="持续" value={comparison.persistent ?? 0} />
          <Metric label="改善／风险降级" value={comparison.improved ?? 0} />
          <Metric label="风险升级" value={comparison.riskEscalated ?? 0} />
          <Metric label="风险降级" value={comparison.riskDowngraded ?? 0} />
        </div>
      ) : null}
    </section>
  );
}

function RiskSummary({ report }: { report: DiagnosisReportApiItem }) {
  return (
    <section className="rounded-xl border border-border/70 bg-accent/25 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-rose-500" />
        <h3 className="text-sm font-semibold text-foreground">当前风险摘要</h3>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Object.entries(RISK_LABELS).map(([riskType, label]) => (
          <Metric
            key={riskType}
            label={label}
            value={report.riskSummary.byType[riskType as keyof typeof RISK_LABELS]}
          />
        ))}
      </div>
    </section>
  );
}

function Limitations({
  projection,
}: {
  projection: ReturnType<typeof projectReportHistoryCard>;
}) {
  const limitations = [
    ...projection.declaredLimitations,
    ...(projection.attributionLimited
      ? ['部分发现没有可核验的知识节点映射，精准知识薄弱点仍受限。']
      : []),
  ];
  return (
    <section className="rounded-xl border border-border/70 bg-accent/25 p-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">判断边界</h3>
      </div>
      {limitations.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-subtle">
          {limitations.map((limitation) => (
            <li key={limitation} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
              <span>{limitation}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-subtle">此快照没有附加局限说明。</p>
      )}
    </section>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/45 px-3 py-2.5">
      <dt className="text-[11px] text-subtle">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-56 items-center justify-center gap-3 px-6 py-12 text-sm text-subtle" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
      正在读取受治理报告历史…
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center px-6 py-12 text-center" data-report-history-empty>
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-sky-500/40 bg-sky-500/5 text-sky-500">
        <CalendarClock className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-semibold text-foreground">尚无持久化诊断报告</h3>
      <p className="mt-2 text-sm leading-6 text-subtle">
        当前只表示没有可回看的报告快照，不代表班级或学生没有学习风险。
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  return (
    <div className="mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-semibold text-foreground">报告历史暂时不可用</h3>
      <p className="mt-2 text-sm leading-6 text-subtle">{message || '请稍后重试。'}</p>
      <button type="button" onClick={onRetry} className="btn-ghost-themed mt-4 rounded-lg px-4 py-2 text-sm">
        重新读取
      </button>
    </div>
  );
}

function isDegraded(report: DiagnosisReportApiItem) {
  return projectReportHistoryCard(report).availability.label !== '证据较充分';
}

function formatReportTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? REPORT_TIME_FORMATTER.format(date) : '时间不可用';
}

function severityClassName(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') return 'rounded-full bg-rose-500/10 px-2.5 py-1 text-xs text-rose-600 dark:text-rose-300';
  if (severity === 'medium') return 'rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300';
  return 'rounded-full bg-sky-500/10 px-2.5 py-1 text-xs text-sky-700 dark:text-sky-300';
}

function coverageStateLabel(state: EvidenceCoverageGroup['state']) {
  if (state === 'available') return '覆盖可用';
  if (state === 'partial') return '覆盖不完整';
  return '未接入';
}

function coverageStateClassName(state: EvidenceCoverageGroup['state']) {
  if (state === 'available') return 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300';
  if (state === 'partial') return 'rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300';
  return 'rounded-full bg-slate-500/10 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300';
}
