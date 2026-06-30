import Link from 'next/link';

import { ActionStatusPanel } from '@/components/platform/action-status';
import { EvidenceTimelineBrowser } from '@/features/data-governance/evidence-timeline-browser';
import { createAuditedActionState } from '@/lib/action-status-contract';
import { buildTeacherEvidenceInterventionAction } from '@/lib/teacher-evidence-intervention-contract';
import {
  buildTeacherReportDeliveryHref,
  resolveTeacherReturnTo,
} from '@/lib/teacher-report-grading-contracts';

export default async function TeacherClassStudentEvidencePage(
  props: {
    params: Promise<{ classId: string; studentId: string }>;
    searchParams?: Promise<{ returnTo?: string; gradingRunId?: string; reportId?: string; source?: string }>;
  }
) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const studentDetailHref = `/teacher/classes/${params.classId}/students/${params.studentId}`;
  const safeBackHref = resolveTeacherReturnTo(
    searchParams?.returnTo,
    studentDetailHref,
  );
  const contextParts = [
    searchParams?.gradingRunId ? `评分运行 ${searchParams.gradingRunId}` : null,
    searchParams?.reportId ? `报告 ${searchParams.reportId}` : null,
    searchParams?.source ? `来源 ${searchParams.source}` : null,
  ].filter((part): part is string => Boolean(part));
  const backHref = mergeTeacherEvidenceContext(safeBackHref, {
    gradingRunId: searchParams?.gradingRunId,
    reportId: searchParams?.reportId,
    source: searchParams?.source,
  });
  const providedReportContext = [
    searchParams?.gradingRunId,
    searchParams?.reportId,
    searchParams?.source,
  ].filter((item): item is string => Boolean(item));
  const hasReportContext = providedReportContext.length > 0;
  const missingContext = hasReportContext ? [
    searchParams?.gradingRunId ? null : 'gradingRunId',
    searchParams?.reportId ? null : 'reportId',
    searchParams?.source ? null : 'source',
  ].filter((item): item is string => Boolean(item)) : [];
  const contextState = missingContext.length > 0 ? 'blocked' : 'ready';
  const hasCompleteReportContext = hasReportContext && missingContext.length === 0;
  const primaryActionHref = hasCompleteReportContext
    ? buildTeacherReportDeliveryHref({
      classId: params.classId,
      action: 'summary',
      reportId: searchParams?.reportId ?? 'control-correction',
      studentId: params.studentId,
      gradingRunId: searchParams?.gradingRunId,
      source: searchParams?.source ?? 'teacher-evidence',
      surface: 'report-book',
      returnTo: backHref,
    })
    : studentDetailHref;
  const primaryActionLabel = hasCompleteReportContext ? '回到报告交付' : '返回学生详情';
  const interventionAction = buildTeacherEvidenceInterventionAction({
    kind: hasCompleteReportContext ? 'grading-writeback' : 'reinforcement-task',
    surface: 'teacher-evidence',
    studentId: params.studentId,
    classId: params.classId,
    gradingRunId: searchParams?.gradingRunId,
    reportId: searchParams?.reportId,
    source: searchParams?.source ?? 'teacher-evidence',
    sourceEvidenceRefs: hasReportContext
      ? [
        searchParams?.gradingRunId ? `grading-run:${searchParams.gradingRunId}` : null,
        searchParams?.reportId ? `teacher-report:${searchParams.reportId}` : null,
      ].filter((ref): ref is string => Boolean(ref))
      : [],
    learnerState: hasCompleteReportContext ? 'ready' : 'missing',
  });
  const evidenceState = createAuditedActionState({
    identity: {
      id: `teacher-evidence:${params.classId}:${params.studentId}:${searchParams?.gradingRunId ?? 'missing-grading'}`,
      category: 'governance-resolve',
      label: '教师证据处置上下文',
      sourceRoute: backHref,
      targetId: params.studentId,
      requestedAction: 'review-evidence',
    },
    status: missingContext.length > 0 ? 'blocked' : 'succeeded',
    message: missingContext.length > 0
      ? `证据页缺少 ${missingContext.join('、')}，仍可浏览证据，但不能完成报告评分处置闭环。`
      : hasReportContext
        ? '证据页已保留评分运行、报告和来源上下文，可回到报告交付或评分链路继续处置。'
        : '证据页以普通浏览模式打开，可按时间查看该学生的学习事实和作答摘要。',
    recoveryAction: missingContext.length > 0 ? '从报告账本或评分工作台重新进入学生证据页' : undefined,
    nextAction: hasCompleteReportContext ? '核验证据后回到报告交付或评分工作台' : undefined,
    displayReference: searchParams?.reportId ?? undefined,
  });
  return (
    <>
      <section
        className="surface-page px-6 pt-6"
        data-teacher-evidence-remediation="context-status"
        data-teacher-evidence-context-state={contextState}
        data-teacher-evidence-grading-run-id={searchParams?.gradingRunId ?? undefined}
        data-teacher-evidence-report-id={searchParams?.reportId ?? undefined}
        data-teacher-evidence-source={searchParams?.source ?? undefined}
        data-teacher-intervention-action-id={interventionAction.id}
        data-teacher-intervention-action-status={interventionAction.status}
        data-teacher-intervention-persistence-target={interventionAction.persistenceTarget}
      >
        <ActionStatusPanel
          state={evidenceState}
          action={(
            <Link
              href={primaryActionHref}
              className="btn-ghost-themed inline-flex rounded-lg px-3 py-2 text-xs"
              data-teacher-evidence-report-handoff={hasCompleteReportContext ? 'available' : undefined}
              data-teacher-evidence-browse-return={hasCompleteReportContext ? undefined : 'available'}
            >
              {primaryActionLabel}
            </Link>
          )}
        />
        <div className="mt-4 rounded-lg border border-border bg-card/70 p-4 text-sm" data-teacher-evidence-next-steps>
          <p className="font-medium text-foreground">证据处置下一步</p>
          <p className="mt-1 text-subtle">
            {interventionAction.privacySafeSummary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-subtle">
            <span
              className="rounded border border-border px-2 py-1"
              data-teacher-evidence-remediation-task={interventionAction.status}
            >
              状态：{interventionAction.status}
            </span>
            <span className="rounded border border-border px-2 py-1">
              写回：{interventionAction.persistenceTarget}
            </span>
            {interventionAction.recoveryAction ? (
              <span className="rounded border border-border px-2 py-1">
                恢复：{interventionAction.recoveryAction}
              </span>
            ) : null}
          </div>
        </div>
      </section>
      <EvidenceTimelineBrowser
        apiPath={`/api/teacher/classes/${params.classId}/students/${params.studentId}/evidence`}
        backHref={backHref}
        contextBadges={contextParts}
        emptyBackHref={hasCompleteReportContext ? undefined : studentDetailHref}
        emptyBackLabel="返回学生详情"
        title="学生证据"
        subtitle={contextParts.length > 0
          ? `保留教师上下文：${contextParts.join(' · ')}`
          : '按时间查看该学生的学习事实和作答摘要'}
      />
      <div className="h-24 md:hidden" aria-hidden="true" />
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur md:hidden"
        data-teacher-evidence-mobile-actions="fixed"
        data-teacher-evidence-context-state={contextState}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">学生证据处置</p>
            <p className="text-xs text-subtle">
              {hasCompleteReportContext ? '长证据时间线中保持报告交付入口可达。' : '长证据时间线中保持返回学生详情可达。'}
            </p>
          </div>
          <Link
            href={primaryActionHref}
            className="btn-ghost-themed inline-flex shrink-0 rounded-lg px-3 py-2 text-xs"
            data-teacher-evidence-mobile-report-handoff={hasCompleteReportContext ? 'available' : undefined}
            data-teacher-evidence-mobile-browse-return={hasCompleteReportContext ? undefined : 'available'}
          >
            {primaryActionLabel}
          </Link>
        </div>
      </div>
    </>
  );
}

function mergeTeacherEvidenceContext(
  href: string,
  context: { gradingRunId?: string; reportId?: string; source?: string },
) {
  const url = new URL(href, 'http://local.teacher');
  if (context.gradingRunId && !url.searchParams.has('gradingRunId')) {
    url.searchParams.set('gradingRunId', context.gradingRunId);
  }
  if (context.reportId && !url.searchParams.has('reportId')) {
    url.searchParams.set('reportId', context.reportId);
  }
  if (context.source && !url.searchParams.has('source')) {
    url.searchParams.set('source', context.source);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
