'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Database,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

import type { TeacherStudentInsightsPayload } from '@/app/api/teacher/classes/[classId]/students/[studentId]/insights/route';
import { DiagnosisSurfacePanel } from '@/features/adaptive/diagnosis-surface-panel';
import { TeacherDiagnosisReportHistory } from '@/features/teacher/teacher-diagnosis-report-history';

type PortraitRefreshState = 'idle' | 'submitted' | 'processing' | 'completed' | 'failed';

export default function TeacherStudentInsightsPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params?.classId as string;
  const studentId = params?.studentId as string;
  const { data: session, status } = useSession();
  const [data, setData] = useState<TeacherStudentInsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portraitRefreshState, setPortraitRefreshState] = useState<PortraitRefreshState>('idle');
  const [portraitRefreshGeneration, setPortraitRefreshGeneration] = useState<number | null>(null);
  const [portraitRefreshError, setPortraitRefreshError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/teacher/classes/${classId}/students/${studentId}/insights`);
      if (!response.ok) throw new Error('获取学生学情失败');
      setData(await response.json() as TeacherStudentInsightsPayload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [classId, studentId]);

  const requestPortraitRefresh = useCallback(async () => {
    try {
      setPortraitRefreshState('submitted');
      setPortraitRefreshError(null);
      const response = await fetch(
        `/api/teacher/classes/${classId}/students/${studentId}/portrait-refresh`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      );
      const payload = await response.json() as { generation?: number; error?: string };
      if (!response.ok || !Number.isInteger(payload.generation)) {
        throw new Error(payload.error || '提交画像更新失败');
      }
      setPortraitRefreshGeneration(payload.generation!);
    } catch (refreshError) {
      setPortraitRefreshState('failed');
      setPortraitRefreshError(refreshError instanceof Error ? refreshError.message : '提交画像更新失败');
    }
  }, [classId, studentId]);

  useEffect(() => {
    if (
      portraitRefreshGeneration === null ||
      (portraitRefreshState !== 'submitted' && portraitRefreshState !== 'processing')
    ) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/teacher/classes/${classId}/students/${studentId}/portrait-refresh?generation=${portraitRefreshGeneration}`,
        );
        const payload = await response.json() as {
          status?: 'queued' | 'processing' | 'completed' | 'failed' | 'superseded';
          errorCode?: string | null;
        };
        if (!response.ok) throw new Error('读取画像更新状态失败');
        if (payload.status === 'completed') {
          setPortraitRefreshState('completed');
          await fetchData();
          return;
        }
        if (payload.status === 'failed' || payload.status === 'superseded') {
          setPortraitRefreshState('failed');
          setPortraitRefreshError(payload.errorCode || '画像更新失败');
          return;
        }
        setPortraitRefreshState(payload.status === 'processing' ? 'processing' : 'submitted');
      } catch (refreshError) {
        setPortraitRefreshState('failed');
        setPortraitRefreshError(refreshError instanceof Error ? refreshError.message : '读取画像更新状态失败');
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [
    classId,
    fetchData,
    portraitRefreshGeneration,
    portraitRefreshState,
    studentId,
  ]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || !classId || !studentId) return;
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
    void fetchData();
  }, [classId, fetchData, router, session, status, studentId]);

  if (status === 'loading' || loading) {
    return <StatusShell message="加载累计能力达成..." />;
  }
  if (error || !data) {
    return (
      <StatusShell message={error || '加载失败'}>
        <button type="button" onClick={fetchData} className="btn-ghost-themed mt-4 rounded-lg px-6 py-2">
          重试
        </button>
      </StatusShell>
    );
  }

  return (
    <div
      className="teacher-insight-shell"
      data-intelligent-teaching-assistant-demo-surface="teacher-student-insights"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics="ready"
    >
      <header className="surface-topbar px-6 py-4">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/teacher/classes/${classId}`} className="text-subtle transition hover:text-foreground">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <p className="text-sm text-subtle">{data.student.className}</p>
              <h1 className="text-xl font-bold text-foreground">{data.student.name} 的累计能力达成</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={fetchData} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
              <RefreshCw className="h-4 w-4" />
              刷新数据
            </button>
            <button
              type="button"
              onClick={() => void requestPortraitRefresh()}
              disabled={portraitRefreshState === 'submitted' || portraitRefreshState === 'processing'}
              className="cta-primary rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {portraitRefreshState === 'submitted'
                ? '画像更新已提交'
                : portraitRefreshState === 'processing'
                  ? '画像更新处理中'
                  : portraitRefreshState === 'failed' ? '重试更新画像' : '更新画像'}
            </button>
          </div>
        </div>
        {portraitRefreshState === 'completed' ? (
          <p className="mt-2 text-right text-sm text-emerald-600" role="status">
            画像更新完成，已读取最新结果。
          </p>
        ) : null}
        {portraitRefreshState === 'failed' ? (
          <p className="mt-2 text-right text-sm text-red-500" role="alert">
            {portraitRefreshError || '画像更新失败，可重试。'}
          </p>
        ) : null}
      </header>

      <main className="space-y-8 px-6 py-8">
        <section className="teacher-insight-hero">
          <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
            <div>
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 text-2xl font-bold text-sky-500 dark:text-sky-300">
                  {data.student.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{data.student.name}</h2>
                  <p className="mt-1 text-sm text-subtle">
                    {data.student.studentNumber || data.student.email || '暂无学号信息'}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-subtle">{data.overallDiagnosis.conclusion}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <MetricCard
                  title="累计综合分"
                  value={data.overview.overallScore ?? '不可用'}
                  detail={data.overview.overallLevel ?? formatAvailability(data.overview.availabilityReason)}
                />
                <MetricCard
                  title="证据覆盖"
                  value={`${data.overview.evidencedDimensionCount}/7`}
                  detail={`缺失 ${data.overview.missingDimensionCount} 个维度`}
                />
                <MetricCard
                  title="证据截止"
                  value={data.overview.evidenceAsOf ? formatDate(data.overview.evidenceAsOf) : '不可用'}
                  detail={data.overview.generatedAt ? `画像生成 ${formatDate(data.overview.generatedAt)}` : formatAvailability(data.overview.availabilityReason)}
                />
              </div>
            </div>
            <div className="teacher-insight-metric">
              <p className="text-sm font-medium text-foreground">最后证据状态</p>
              <dl className="mt-4 space-y-4 text-sm">
                <SummaryRow label="趋势" value={formatTrend(data.overview.lastTrend)} />
                <SummaryRow
                  label="风险"
                  value={data.overview.lastRisk.length > 0
                    ? data.overview.lastRisk.map((risk) => `${formatRiskType(risk.type)}（${formatSeverity(risk.severity)}）`).join('、')
                    : '无当前证据风险'}
                />
                <SummaryRow
                  label="置信度"
                  value={data.overview.confidence === null ? '不可用' : `${Math.round(data.overview.confidence * 100)}%`}
                />
              </dl>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <SummaryList title="累计优势" items={data.overview.strengths} empty="暂无达到优势阈值的维度" />
          <SummaryList title="待提升点" items={data.overview.improvementAreas} empty="暂无低于提升阈值的维度" warning />
        </section>

        <section className="surface-card p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">七维累计能力与班级对比</h2>
            <p className="mt-1 text-sm text-subtle">缺失证据不计为零；班级维度没有有效分母时不计算均值和差距。</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.classComparison.map((item) => (
              <div key={item.dimension} className="teacher-insight-metric">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="mt-1 text-xs text-subtle">
                      {item.availabilityReason === 'available'
                        ? `班级纳入 ${item.includedCount} 人，缺失 ${item.missingCount} 人`
                        : formatComparisonAvailability(item.availabilityReason)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-foreground">{item.studentScore ?? '—'}</p>
                    <p className="text-xs text-subtle">班级均值 {item.classAverage ?? '—'}</p>
                  </div>
                </div>
                {item.gap !== null && (
                  <p className="mt-3 text-sm text-subtle">
                    较班级均值{item.gap >= 0 ? '高' : '低'} {Math.abs(item.gap)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {data.taskAttainment.personal?.state === 'EVIDENCE' ? (
          <details className="surface-card p-6" data-simulation-task-attainment>
            <summary className="cursor-pointer font-medium text-foreground">
              仿真任务构成：已完成 {data.taskAttainment.personal.completedTaskCount} / 相关 {data.taskAttainment.personal.relatedTaskCount}
            </summary>
            <div className="mt-4 space-y-4">
              {data.taskAttainment.personal.groupedTaskSummary.map((group) => (
                <div key={group.source}>
                  <p className="text-sm font-medium text-foreground">
                    {group.displayGroup}：{group.completedTaskCount}/{group.relatedTaskCount}
                  </p>
                  <ul className="mt-2 grid gap-2 text-sm text-subtle sm:grid-cols-2">
                    {group.tasks.map((task) => (
                      <li key={task.taskKey}>
                        {task.completed ? '已完成' : '未完成'} · {task.displayName}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-subtle">
                仅显示二元完成结论；部分进度、原始答案、轨迹和隐藏评分不在此处展示。
              </p>
              <p className="text-xs text-subtle">
                限制：{data.taskAttainment.personal.limitations.join('；')} · {data.taskAttainment.personal.calculationVersion}
              </p>
              {data.taskAttainment.classAggregate ? (
                <p className="text-xs text-subtle">
                  班级可用成员 {data.taskAttainment.classAggregate.usableMemberCount}/
                  {data.taskAttainment.classAggregate.rosterTotal}
                  {data.taskAttainment.classAggregate.meanScore === null
                    ? '，班级任务均值不可用。'
                    : `，任务达成均值 ${Math.round(data.taskAttainment.classAggregate.meanScore)}%。`}
                </p>
              ) : null}
            </div>
          </details>
        ) : data.taskAttainment.personal?.state === 'NO_EVIDENCE' ? (
          <div className="surface-card p-6" data-simulation-task-no-evidence>
            <p className="font-medium text-foreground">该学生暂无合格的仿真任务达成证据</p>
            <p className="mt-2 text-sm text-subtle">
              当前仅保留受治理的审计上下文；部分进度不会显示为未完成任务清单或能力结论。
            </p>
            <p className="mt-2 text-xs text-subtle">
              限制：{data.taskAttainment.personal.limitations.join('；')}
            </p>
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-500" />
              <h2 className="text-lg font-semibold text-foreground">当前风险</h2>
            </div>
            <div className="mt-4 space-y-3">
              {data.overview.lastRisk.length > 0 ? data.overview.lastRisk.map((risk) => (
                <div key={`${risk.type}-${risk.occurredAt}`} className="teacher-insight-metric">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{formatRiskType(risk.type)}</p>
                    <span className={`teacher-insight-chip teacher-insight-risk-${risk.severity}`}>
                      {formatSeverity(risk.severity)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-subtle">{risk.description}</p>
                  {risk.occurredAt && <p className="mt-2 text-xs text-subtle">证据触发于 {formatDate(risk.occurredAt)}</p>}
                </div>
              )) : <p className="text-sm text-subtle">当前没有证据支持的风险状态。</p>}
            </div>
          </div>
          <div className="surface-card p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-sky-500" />
              <h2 className="text-lg font-semibold text-foreground">成长档案</h2>
            </div>
            <div className="teacher-insight-timeline mt-4">
              {data.growthRecords.length > 0 ? data.growthRecords.map((record) => (
                <div key={record.id} className="teacher-insight-timeline-item">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{record.title}</p>
                    <span className="text-xs text-subtle">{formatDate(record.occurredAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-subtle">{record.description}</p>
                </div>
              )) : <p className="text-sm text-subtle">暂无累计成长事件。</p>}
            </div>
          </div>
        </section>

        <section className="surface-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">最新活动</h2>
              <p className="mt-1 text-sm text-subtle">活动按发生时间倒序展示，不作为另一套画像或诊断口径。</p>
            </div>
            <Link
              href={`/teacher/classes/${classId}/students/${studentId}/evidence`}
              className="btn-ghost-themed inline-flex items-center rounded-lg px-4 py-2 text-sm"
            >
              <Database className="mr-2 h-4 w-4" />
              查看完整证据
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ActivityColumn
              icon={<TrendingUp className="h-4 w-4" />}
              title="学习事实"
              items={data.latestActivity.facts.map((fact) => ({
                id: fact.id,
                title: fact.lessonId || fact.moduleId || fact.factType,
                detail: `${fact.outcome}${fact.score === null ? '' : ` · ${fact.score} 分`}`,
                at: fact.startedAt,
              }))}
            />
            <ActivityColumn
              icon={<ClipboardList className="h-4 w-4" />}
              title="持久提交"
              items={data.latestActivity.durableSubmissions.map((submission) => ({
                id: submission.id,
                title: submission.sessionTitle,
                detail: `${submission.answerCount} 项作答 · ${submission.quality}`,
                at: submission.submittedAt,
              }))}
            />
            <ActivityColumn
              icon={<BookOpen className="h-4 w-4" />}
              title="学习报告"
              items={data.latestActivity.sessionReports.map((report) => ({
                id: `${report.sessionId}-${report.updatedAt}`,
                title: report.title,
                detail: report.summary || report.status,
                at: report.updatedAt,
              }))}
            />
          </div>
        </section>

        <section>
          <DiagnosisSurfacePanel
            diagnosis={data.goalSpecificDiagnosis}
            mode="teacher-student"
            title={`${data.student.name} 的专项学习目标诊断`}
            description="专项诊断是累计七维能力达成的从属入口，不替代整体画像。"
          />
        </section>

        <TeacherDiagnosisReportHistory
          classId={classId}
          targetStudentId={studentId}
          subjectLabel={`${data.student.name} · ${data.student.className}`}
        />
      </main>
    </div>
  );
}

function StatusShell({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="teacher-insight-shell flex items-center justify-center">
      <div className="text-center">
        <p className="text-subtle">{message}</p>
        {children}
      </div>
    </div>
  );
}

function MetricCard({ title, value, detail }: { title: string; value: number | string; detail: string }) {
  return (
    <div className="teacher-insight-metric">
      <p className="text-sm text-subtle">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs text-subtle">{detail}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-subtle">{label}</dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  );
}

function SummaryList({ title, items, empty, warning = false }: {
  title: string;
  items: string[];
  empty: string;
  warning?: boolean;
}) {
  return (
    <div className="surface-card p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length > 0 ? items.map((item) => (
          <span key={item} className={`teacher-insight-chip ${warning ? 'teacher-insight-chip-warning' : 'teacher-insight-chip-healthy'}`}>
            {item}
          </span>
        )) : <p className="text-sm text-subtle">{empty}</p>}
      </div>
    </div>
  );
}

function ActivityColumn({ icon, title, items }: {
  icon: React.ReactNode;
  title: string;
  items: Array<{ id: string; title: string; detail: string; at: string }>;
}) {
  return (
    <div className="teacher-insight-metric">
      <div className="flex items-center gap-2 font-medium text-foreground">{icon}{title}</div>
      <div className="mt-3 space-y-3">
        {items.length > 0 ? items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border/70 bg-card/80 p-3">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-1 text-xs text-subtle">{item.detail}</p>
            <p className="mt-1 text-xs text-subtle">{formatDate(item.at)}</p>
          </div>
        )) : <p className="text-sm text-subtle">暂无活动。</p>}
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN');
}

function formatTrend(value: TeacherStudentInsightsPayload['overview']['lastTrend']): string {
  if (value === 'up') return '上升';
  if (value === 'down') return '下降';
  if (value === 'stable') return '稳定';
  if (value === 'not-comparable') return '尚无可比状态';
  return '不可用';
}

function formatRiskType(value: 'constraint' | 'stagnation' | 'cross_domain'): string {
  if (value === 'constraint') return '约束风险';
  if (value === 'stagnation') return '停滞风险';
  return '跨域迁移风险';
}

function formatSeverity(value: 'low' | 'medium' | 'high'): string {
  if (value === 'high') return '高';
  if (value === 'medium') return '中';
  return '低';
}

function formatAvailability(value: string): string {
  const labels: Record<string, string> = {
    'no-eligible-evidence': '无合格累计证据',
    'no-evidence-after-revocation': '证据撤销后无有效画像',
    'migration-in-progress': '累计画像迁移中',
    'current-state-unavailable': '累计画像尚未物化',
    'current-state-version-mismatch': '累计画像版本不匹配',
    'invalid-current-snapshot': '累计画像校验失败',
  };
  return labels[value] ?? value;
}

function formatComparisonAvailability(
  value: TeacherStudentInsightsPayload['classComparison'][number]['availabilityReason'],
): string {
  if (value === 'student-no-evidence') return '学生在该维度无合格证据';
  if (value === 'class-no-evidence') return '班级在该维度无有效分母';
  if (value === 'class-portrait-unavailable') return '班级累计画像不可用';
  return '可比较';
}
