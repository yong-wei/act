import Link from 'next/link';

import { ActionStatusPanel } from '@/components/platform/action-status';
import {
  buildFeedbackTaskHref,
  buildFeedbackTaskStatusState,
  type StudentFeedbackTaskContext,
} from '@/lib/student-feedback-task-contract';

export function StudentFeedbackTaskPanel({
  context,
  surface,
  className,
}: {
  context: StudentFeedbackTaskContext | null;
  surface: string;
  className?: string;
}) {
  if (!context) return null;
  const state = buildFeedbackTaskStatusState(context, surface);
  const evidenceHref = buildFeedbackTaskHref('/profile/evidence', context, { status: context.lifecycleState });
  const growthHref = buildFeedbackTaskHref('/profile/growth', context, { status: context.lifecycleState });
  const portfolioHref = buildFeedbackTaskHref('/profile/portfolio?category=reflection', context, {
    intent: 'collect',
    status: context.lifecycleState,
  });
  const practiceHref = buildFeedbackTaskHref('/assessment/adaptive-practice', context, {
    intent: 'document-feedback',
    status: context.lifecycleState,
  });
  const missionsHref = buildFeedbackTaskHref('/missions', context, {
    intent: 'start',
    status: context.lifecycleState,
  });

  return (
    <section
      className={`rounded-lg border border-border bg-card/75 p-4 ${className ?? ''}`}
      data-student-feedback-task-surface={surface}
      data-student-feedback-assignment={context.assignmentId}
      data-student-feedback-state={context.lifecycleState}
      data-student-feedback-writeback={context.completionTarget}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-primary">反馈任务闭环</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{context.assignmentTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">{context.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-subtle">
            {context.badges.map((badge) => (
              <span key={badge} className="rounded border border-border px-2 py-1">{badge}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={practiceHref} className="btn-ghost-themed rounded px-3 py-2 text-xs">练习补强</Link>
          <Link href={missionsHref} className="btn-ghost-themed rounded px-3 py-2 text-xs">任务大厅</Link>
          <Link href={evidenceHref} className="btn-ghost-themed rounded px-3 py-2 text-xs">证据</Link>
          <Link href={growthHref} className="btn-ghost-themed rounded px-3 py-2 text-xs">成长</Link>
          <Link href={portfolioHref} className="btn-ghost-themed rounded px-3 py-2 text-xs">作品集候选</Link>
        </div>
      </div>
      <ActionStatusPanel state={state} className="mt-4" />
      {context.returnHref ? (
        <Link href={context.returnHref} className="mt-3 inline-flex text-sm text-primary hover:underline">
          返回报告反馈
        </Link>
      ) : null}
    </section>
  );
}
