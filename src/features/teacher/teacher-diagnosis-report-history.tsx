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
} from '@/app/api/teacher/classes/[classId]/diagnosis-reports/route';

type ReportHistoryState = 'loading' | 'ready' | 'error';

interface TeacherDiagnosisReportHistoryProps {
  classId: string;
  targetStudentId?: string;
  subjectLabel: string;
}

interface TeacherDiagnosisReportHistoryViewProps {
  state: ReportHistoryState;
  reports: DiagnosisReportApiItem[];
  selectedReportId?: string | null;
  subjectLabel: string;
  errorMessage?: string | null;
  onRefresh?: () => void;
  onSelectReport?: (reportId: string) => void;
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

  return (
    <TeacherDiagnosisReportHistoryView
      state={state}
      reports={reports}
      selectedReportId={selectedReportId}
      subjectLabel={subjectLabel}
      errorMessage={errorMessage}
      onRefresh={() => void loadReports()}
      onSelectReport={setSelectedReportId}
    />
  );
}

export function TeacherDiagnosisReportHistoryView({
  state,
  reports,
  selectedReportId,
  subjectLabel,
  errorMessage,
  onRefresh,
  onSelectReport,
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
              Governed evidence ledger
            </p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">学情诊断报告历史</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-subtle">
              {subjectLabel} · 读取持久化快照不会重新调用模型，也不会产生新的教学动作。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={state === 'loading'}
          className="btn-ghost-themed inline-flex items-center justify-center gap-2 self-start rounded-lg px-3 py-2 text-sm disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={state === 'loading' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新历史
        </button>
      </header>

      {state === 'loading' ? <LoadingState /> : null}
      {state === 'error' ? <ErrorState message={errorMessage} onRetry={onRefresh} /> : null}
      {state === 'ready' && reports.length === 0 ? <EmptyState /> : null}
      {state === 'ready' && selectedReport ? (
        <div className="relative grid min-w-0 lg:grid-cols-[17rem,minmax(0,1fr)]">
          <ReportIndex
            reports={reports}
            selectedReportId={selectedReport.id}
            onSelectReport={onSelectReport}
          />
          <ReportDetail report={selectedReport} />
        </div>
      ) : null}
    </section>
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
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => onSelectReport?.(report.id)}
              aria-current={selected ? 'true' : undefined}
              className={`min-w-[13.5rem] rounded-lg border px-3 py-3 text-left transition lg:min-w-0 ${
                selected
                  ? 'border-sky-500/40 bg-sky-500/10 shadow-sm'
                  : 'border-border/60 bg-card/60 hover:border-sky-500/25 hover:bg-card'
              }`}
              data-report-history-item={report.id}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
                  Snapshot {String(reports.length - index).padStart(2, '0')}
                </span>
                {degraded ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{formatReportTime(report.generatedAt)}</p>
              <p className="mt-1 text-xs text-subtle">
                {CONFIDENCE_LABELS[report.reportBody.confidence]} · {report.reportBody.findings.length} 项发现
              </p>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ReportDetail({ report }: { report: DiagnosisReportApiItem }) {
  const degraded = isDegraded(report);
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
              {degraded ? '受限快照' : '证据就绪'}
            </span>
            <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-subtle">
              {report.scopeType === 'student' ? '学生报告' : '班级报告'}
            </span>
          </div>
          <p className="mt-4 text-base leading-7 text-foreground">{report.reportBody.summary}</p>
        </div>
        <dl className="grid min-w-0 grid-cols-2 gap-2 text-sm sm:min-w-[17rem]">
          <Metric label="生成时间" value={formatReportTime(report.generatedAt)} />
          <Metric label="证据截止" value={formatReportTime(report.evidenceCutoff)} />
          <Metric label="证据引用" value={`${evidenceCount} 条`} />
          <Metric label="生成版本" value={report.generatorVersion} mono />
        </dl>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CoverageMetric report={report} />
        <Metric label="总体置信度" value={CONFIDENCE_LABELS[report.reportBody.confidence]} />
        <Metric label="风险发现" value={`${report.riskSummary.total} 项`} />
        <Metric label="局限说明" value={`${report.reportBody.limitations.length} 项`} />
      </div>

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
                {finding.prepLink ? (
                  <Link
                    href={finding.prepLink}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-500/10 dark:text-sky-300"
                  >
                    <BookOpenCheck className="h-3.5 w-3.5" />
                    打开对应备课位置
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </section>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-subtle">
            此快照没有形成可展示的结构化发现项；这不代表不存在学习风险。
          </p>
        )}
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <RiskSummary report={report} />
        <Limitations report={report} />
      </div>
    </article>
  );
}

function CoverageMetric({ report }: { report: DiagnosisReportApiItem }) {
  const coverage = report.reportBody.sourceCoverage;
  if (typeof coverage.coverage === 'number') {
    return <Metric label="证据覆盖" value={`${Math.round(coverage.coverage * 100)}%`} />;
  }
  if (typeof coverage.includedStudents === 'number' && typeof coverage.classMembers === 'number') {
    return <Metric label="证据覆盖" value={`${coverage.includedStudents}/${coverage.classMembers} 人`} />;
  }
  return <Metric label="知识进度证据" value={`${coverage.progressRows ?? 0} 行`} />;
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

function Limitations({ report }: { report: DiagnosisReportApiItem }) {
  return (
    <section className="rounded-xl border border-border/70 bg-accent/25 p-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">判断边界</h3>
      </div>
      {report.reportBody.limitations.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-subtle">
          {report.reportBody.limitations.map((limitation) => (
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
  return report.reportBody.confidence === 'low'
    || report.reportBody.confidence === 'unavailable'
    || report.reportBody.limitations.length > 0;
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
