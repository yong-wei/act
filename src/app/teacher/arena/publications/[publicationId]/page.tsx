import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart3, ClipboardList, Copy, FileDown, LockKeyhole, Send, ShieldAlert, Trophy, Users } from 'lucide-react';

import { getServerAuthSession } from '@/lib/auth';
import {
  ArenaPublicationPermissionError,
  prismaArenaPublicationStore,
} from '@/features/arena/teacher/publication-store';

export const dynamic = 'force-dynamic';

interface ArenaPublicationReportPageProps {
  params: Promise<{ publicationId: string }>;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatScore(value: number | null): string {
  return value === null ? '暂无' : value.toFixed(value % 1 === 0 ? 0 : 2);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatAttemptStatus(value: 'effective' | 'late' | 'zero-score' | 'invalid'): string {
  if (value === 'effective') return '有效尝试';
  if (value === 'late') return '迟交';
  if (value === 'zero-score') return '零分';
  return '无效';
}

function lifecycleToneClass(tone: 'success' | 'warning' | 'neutral' | 'muted'): string {
  if (tone === 'neutral') return 'border-primary/35 bg-primary/10 text-primary';
  if (tone === 'success' || tone === 'warning') return 'border-primary/35 bg-primary/10 text-primary';
  return 'border-border bg-muted/40 text-subtle';
}

export default async function ArenaPublicationReportPage(props: ArenaPublicationReportPageProps) {
  const params = await props.params;
  const session = await getServerAuthSession();
  if (!session?.user?.id || !['TEACHER', 'ADMIN'].includes(session.user.role ?? '')) {
    notFound();
  }

  try {
    const report = await prismaArenaPublicationStore.loadReport({
      actor: { id: session.user.id, role: session.user.role as 'TEACHER' | 'ADMIN' },
      publicationId: params.publicationId,
    });

    return (
      <main className="surface-page min-h-screen">
        <section className="mx-auto max-w-[1600px] px-6 pb-[calc(env(safe-area-inset-bottom,0px)+8rem)] pt-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-subtle">竞技场发布报告</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold text-foreground">{report.publicationContext.reportTitle}</h1>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${lifecycleToneClass(report.lifecycle.tone)}`}>
                  {report.lifecycle.primaryLabel}
                </span>
              </div>
              <p className="mt-2 text-sm text-subtle">
                {report.publicationContext.classTitle} · {report.publicationContext.teacherLabel} · 截止 {report.publicationContext.deadlineLabel}
              </p>
              <p className="mt-1 text-xs text-subtle">
                {report.publicationContext.sourceLabel} · {report.lifecycle.detail}
              </p>
            </div>
            <Link href="/teacher/arena" className="btn-ghost-themed rounded-lg border px-3 py-2 text-sm">
              返回竞技场配置
            </Link>
          </div>

          <section className="surface-card mt-6 p-5" data-arena-publication-context={report.lifecycle.state}>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <h2 className="text-lg font-semibold text-foreground">发布上下文</h2>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <SignalRow label="任务" value={report.publicationContext.taskTitle} />
                  <SignalRow label="班级/范围" value={report.publicationContext.classTitle} />
                  <SignalRow label="来源" value={report.publicationContext.sourceLabel} />
                  <SignalRow label="榜单边界" value={report.leaderboardBoundary.sourceLabel} />
                </div>
                <p className="mt-4 rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-sm leading-6 text-subtle">
                  {report.leaderboardBoundary.explanation}
                </p>
              </div>
              <div
                className="rounded-lg border border-border/70 bg-card/55 p-4"
                data-arena-publication-mobile-actions="safe-area"
              >
                <h2 className="text-sm font-semibold text-foreground">报告交付</h2>
                <div className="mt-3 grid gap-2">
                  {report.deliveryActions.map((action) => (
                    <DeliveryActionRow key={action.id} action={action} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            <MetricPanel
              icon={<Users className="h-4 w-4" />}
              label="参与情况"
              value={`${report.participation.participantCount}/${report.participation.expectedStudentCount || report.participation.participantCount}`}
              detail={`未提交 ${report.participation.nonSubmitterCount} 人`}
            />
            <MetricPanel
              icon={<ClipboardList className="h-4 w-4" />}
              label="提交次数"
              value={`${report.submissions.submissionCount}`}
              detail={`有效尝试 ${report.attemptPolicy.effectiveSubmissionCount} 次 / 迟交 ${report.attemptPolicy.lateSubmissionCount} 次`}
            />
            <MetricPanel
              icon={<BarChart3 className="h-4 w-4" />}
              label="有效尝试平均分"
              value={formatScore(report.scores.average)}
              detail={`中位数 ${formatScore(report.scores.median)} / 最高 ${formatScore(report.scores.highest)}`}
            />
            <MetricPanel
              icon={<Trophy className="h-4 w-4" />}
              label="优秀方案"
              value={`${report.excellentSolutions.length}`}
              detail={`零分 ${report.attemptPolicy.zeroScoreSubmissionCount} 次不标记优秀`}
            />
          </div>

          <section className="surface-card mt-6 p-5" data-arena-attempt-policy="visible">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">提交口径</h2>
                <p className="mt-2 text-sm leading-6 text-subtle">{report.attemptPolicy.effectiveRule}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-xs font-medium text-subtle">
                {report.attemptPolicy.officialSubmissionLabel} · 个人最佳有效尝试
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <SignalRow label="有效尝试" value={`${report.attemptPolicy.effectiveSubmissionCount} 次`} />
              <SignalRow label="迟交尝试" value={`${report.attemptPolicy.lateSubmissionCount} 次`} />
              <SignalRow label="零分尝试" value={`${report.attemptPolicy.zeroScoreSubmissionCount} 次`} />
              <SignalRow label="无效尝试" value={`${report.attemptPolicy.invalidSubmissionCount} 次`} />
              <SignalRow label="多次提交学生" value={`${report.attemptPolicy.multipleSubmitterCount} 人`} />
            </div>
            <div className="mt-4 grid gap-2 text-sm text-subtle lg:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2">{report.attemptPolicy.lateRule}</div>
              <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2">{report.attemptPolicy.zeroScoreRule}</div>
              <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2">{report.attemptPolicy.displayRule}</div>
            </div>
          </section>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="surface-card p-5">
              <h2 className="text-lg font-semibold text-foreground">硬约束失败</h2>
              <div className="mt-4 grid gap-2">
                {report.hardConstraintFailures.length === 0 ? (
                  <EmptyLine text="当前没有硬约束失败记录" />
                ) : report.hardConstraintFailures.map((failure) => (
                  <SignalRow key={failure.id} label={failure.label} value={`${failure.count} 次`} />
                ))}
              </div>
            </section>

            <section className="surface-card p-5">
              <h2 className="text-lg font-semibold text-foreground">薄弱指标</h2>
              <div className="mt-4 grid gap-2">
                {report.weakMetrics.length === 0 ? (
                  <EmptyLine text="当前没有低满意度指标" />
                ) : report.weakMetrics.map((metric) => (
                  <SignalRow
                    key={metric.metricId}
                    label={metric.metricId}
                    value={`${metric.affectedSubmissionCount} 次 / 最低 ${formatPercent(metric.lowestSatisfaction)}`}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card p-5">
              <h2 className="text-lg font-semibold text-foreground">全部尝试方法分布</h2>
              <div className="mt-4 grid gap-2">
                {report.methodDistribution.length === 0 ? (
                  <EmptyLine text="暂无提交方法数据" />
                ) : report.methodDistribution.map((method) => (
                  <SignalRow key={method.method} label={method.method} value={`${method.count} 次`} />
                ))}
              </div>
            </section>

            <section className="surface-card p-5">
              <h2 className="text-lg font-semibold text-foreground">未提交学生</h2>
              <div className="mt-4 grid gap-2">
                {report.participation.nonSubmitters.length === 0 ? (
                  <EmptyLine text="当前没有未提交学生" />
                ) : report.participation.nonSubmitters.map((student) => (
                  <SignalRow key={student.userId} label={student.studentLabel} value={student.userId} />
                ))}
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="surface-card p-5">
              <h2 className="text-lg font-semibold text-foreground">个人最佳尝试</h2>
              <div className="mt-4 grid gap-3">
                {report.personalBests.length === 0 ? (
                    <EmptyLine text="暂无个人尝试记录" />
                ) : report.personalBests.map((best) => (
                  <ResultRow
                    key={best.userId}
                    label={best.studentLabel}
                    score={best.score}
                    detail={`${best.method} · ${formatAttemptStatus(best.attemptStatus)} · ${best.rankingExplanation} · ${formatDate(best.submittedAt)}`}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card p-5">
              <h2 className="text-lg font-semibold text-foreground">优秀方案</h2>
              <div className="mt-4 grid gap-3">
                {report.excellentSolutions.length === 0 ? (
                  <EmptyLine text="暂无有效优秀方案" />
                ) : report.excellentSolutions.map((solution) => (
                  <ResultRow
                    key={solution.submissionId}
                    label={solution.studentLabel}
                    score={solution.score}
                    detail={`${solution.method} · ${formatDate(solution.submittedAt)}`}
                  />
                ))}
              </div>
            </section>
          </div>

          <section className="surface-card mt-6 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">课堂复盘</h2>
                <p className="mt-2 text-sm leading-6 text-subtle">{report.classroomReview.privacyNote}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-xs text-subtle">
                {report.classroomReview.participationSummary}
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <ReviewBlock title="典型问题">
                {report.classroomReview.typicalFailures.length === 0 ? (
                  <EmptyLine text="暂无可复盘的典型问题" />
                ) : report.classroomReview.typicalFailures.slice(0, 5).map((failure) => (
                  <SignalRow key={`${failure.kind}-${failure.id}`} label={failure.label} value={`${failure.count} 次`} />
                ))}
              </ReviewBlock>
              <ReviewBlock title="方法模式">
                {report.classroomReview.methodPatterns.length === 0 ? (
                  <EmptyLine text="暂无方法模式数据" />
                ) : report.classroomReview.methodPatterns.map((pattern) => (
                  <SignalRow
                    key={pattern.method}
                    label={pattern.method}
                    value={`${pattern.validCount}/${pattern.count} 有效 · 均分 ${formatScore(pattern.averageScore)}`}
                  />
                ))}
              </ReviewBlock>
              <ReviewBlock title="匿名方案候选">
                {report.classroomReview.showcaseCandidates.length === 0 ? (
                  <EmptyLine text="暂无匿名方案候选" />
                ) : report.classroomReview.showcaseCandidates.map((candidate) => (
                  <ResultRow
                    key={candidate.submissionId}
                    label={candidate.anonymousLabel}
                    score={candidate.score}
                    detail={candidate.evidenceSummary}
                  />
                ))}
              </ReviewBlock>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-subtle lg:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2">{report.classroomReview.gradingMessage}</div>
              <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2">{report.classroomReview.leaderboardVisibilityMessage}</div>
            </div>
          </section>

          {report.submissions.submissionCount === 0 ? (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-subtle">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-primary" />
              <span>当前发布还没有官方提交。报告仍保留任务、班级、截止时间、可见性和榜单策略上下文。</span>
            </div>
          ) : null}
          <div className="sr-only" data-task-workspace-zone="floating-dock-safe-area">
            Arena 发布报告交付动作避让全局浮动控件，并保留移动端底部安全区。
          </div>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof ArenaPublicationPermissionError) {
      notFound();
    }
    throw error;
  }
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}

function MetricPanel({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 text-sm text-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold text-foreground">{value}</div>
      <div className="mt-2 text-xs text-subtle">{detail}</div>
    </div>
  );
}

function DeliveryActionRow({
  action,
}: {
  action: {
    id: 'export-report' | 'send-report' | 'lock-board' | 'copy-commentary';
    label: string;
    statusLabel: string;
    available: boolean;
  };
}) {
  const Icon = action.id === 'export-report'
    ? FileDown
    : action.id === 'send-report'
      ? Send
      : action.id === 'lock-board'
        ? LockKeyhole
        : Copy;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/65 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {action.label}
      </span>
      <span className={action.available ? 'text-subtle' : 'text-muted-foreground'}>
        {action.statusLabel}
      </span>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-sm">
      <span className="text-foreground">{label}</span>
      <span className="text-subtle">{value}</span>
    </div>
  );
}

function ResultRow({ label, score, detail }: { label: string; score: number; detail: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold text-primary">{formatScore(score)}</span>
      </div>
      <div className="mt-1 text-xs text-subtle">{detail}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/55 px-3 py-2 text-sm text-subtle">
      {text}
    </div>
  );
}
