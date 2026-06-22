import type {
  StudentGradingFeedbackView,
  TeacherGradingWorkbenchView,
} from '@/lib/data-governance/document-rubric-grading-workbench';
import type { AuditedActionState } from '@/lib/action-status-contract';
import { ActionStatusPanel } from '@/components/platform/action-status';
import { KonlingEntryPointButton } from '@/components/ai/konling-entry-point-button';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import type { StudentFeedbackTaskContext } from '@/lib/student-feedback-task-contract';
import { DocumentGradingApprovalButton } from './document-rubric-grading-actions';

export function TeacherDocumentGradingWorkbench({
  view,
  routeState,
}: {
  view: TeacherGradingWorkbenchView;
  routeState?: AuditedActionState | null;
}) {
  return (
    <main
      className="surface-page"
      data-intelligent-teaching-assistant-demo-surface="document-grading-workbench"
      data-report-ledger-surface="document-grading-workbench-ledger"
      data-report-ledger-watermark="low-contrast-brand"
      data-report-ledger-privacy-scope="teacher-review"
      data-report-ledger-export="restricted"
    >
      <div className="mx-auto box-border flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-3 border-b border-border pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Document grading</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">报告评分工作台</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {view.asset.fileName} · {view.asset.studentId} · checksum {view.asset.checksum.slice(0, 12)}
              </p>
            </div>
            <div className="rounded border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
              {view.conversion.adapter} · {view.conversion.status} · {view.conversion.referencePrecision}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded border border-border px-2 py-1">来源质量：{view.conversion.status}</span>
            <span className="rounded border border-border px-2 py-1">隐私范围：教师复核</span>
            <span className="rounded border border-border px-2 py-1">状态图例：草稿需人工审批</span>
            <span className="rounded border border-border px-2 py-1">导出：受限脱敏</span>
          </div>
          {routeState ? <ActionStatusPanel state={routeState} /> : null}
        </header>

        <section className="grid min-w-0 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 rounded border border-border bg-card/75 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">转换预览</h2>
              <span className="text-sm text-muted-foreground">confidence {view.conversion.confidence}</span>
            </div>
            <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded bg-background p-4 text-sm leading-7 text-foreground">
              {view.preview.markdown}
            </pre>
            {view.conversion.warnings.length > 0 ? (
              <div className="mt-4 break-words rounded border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
                {view.conversion.warnings.join(' / ')}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <section className="min-w-0 rounded border border-border bg-card/75 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">评分量规</h2>
                <span className="text-sm text-muted-foreground">
                  draft confidence {view.draftSummary.averageConfidence}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {view.rubricTree.map((criterion) => (
                  <article key={criterion.criterionId} className="min-w-0 rounded border border-border p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium">{criterion.label}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {criterion.selectedLevelId ?? 'pending'} · evidence {criterion.evidenceCount}
                        </p>
                        {criterion.limitationState && criterion.limitationState !== 'none' ? (
                          <p className="mt-1 text-xs text-primary">limitation {criterion.limitationState}</p>
                        ) : null}
                      </div>
                      <span className="text-lg font-semibold text-primary">{criterion.editableScore ?? '-'}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="min-w-0 rounded border border-border bg-card/75 p-5">
              <h2 className="text-lg font-medium">注释与锚点</h2>
              <div className="mt-4 space-y-3">
                {view.annotations.map((annotation) => (
                  <article key={annotation.id} className="min-w-0 rounded border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{annotation.criterionId}</p>
                      <span className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                        {annotation.authorRole} · {annotation.reference.precision}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm text-muted-foreground">{annotation.comment}</p>
                    <p className="mt-2 text-xs text-primary">
                      {annotation.reference.pageNumber ? `P${annotation.reference.pageNumber}` : 'page pending'} · {annotation.reference.blockId}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="min-w-0 rounded border border-border bg-card/75 p-5">
              <h2 className="text-lg font-medium">审批动作</h2>
              {view.evaluator.status === 'blocked' && view.evaluator.blockedReasons.length > 0 ? (
                <div className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-medium">评估器输出已阻塞</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {view.evaluator.blockedReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {view.actions.map((action) => (
                  action === 'approve' && view.gradingRunId ? (
                    <DocumentGradingApprovalButton key={action} gradingRunId={view.gradingRunId} />
                  ) : (
                    <button key={action} type="button" className="rounded border border-border px-3 py-2 text-sm text-foreground transition hover:border-primary hover:text-primary">
                      {action}
                    </button>
                  )
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded border border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 break-words text-sm text-muted-foreground">{view.konlingEntryPoint.promptContext}</p>
                <KonlingEntryPointButton entryPoint={view.konlingEntryPoint} label="打开批改助手" />
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

export function TeacherDocumentGradingEmptyState({
  routeState,
}: {
  routeState?: AuditedActionState | null;
} = {}) {
  return (
    <main
      className="surface-page"
      data-intelligent-teaching-assistant-demo-surface="document-grading-workbench"
      data-report-ledger-surface="document-grading-workbench-ledger"
      data-report-ledger-watermark="low-contrast-brand"
      data-report-ledger-privacy-scope="teacher-review"
      data-report-ledger-export="restricted"
      data-operations-status-semantics="empty"
    >
      <div className="mx-auto box-border flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="border-b border-border pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Document grading</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">报告评分工作台</h1>
          <p className="mt-2 text-sm text-muted-foreground">当前没有打开的文档评分草稿。</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded border border-border px-2 py-1">来源质量：无打开草稿</span>
            <span className="rounded border border-border px-2 py-1">隐私范围：教师复核</span>
            <span className="rounded border border-border px-2 py-1">状态图例：等待选择</span>
            <span className="rounded border border-border px-2 py-1">导出：受限脱敏</span>
          </div>
          {routeState ? <ActionStatusPanel state={routeState} className="mt-4" /> : null}
        </header>
        <section className="rounded border border-border bg-card/75 p-6 text-muted-foreground">
          请选择已转换的学生提交，或通过评分草稿标识进入审批工作台。
        </section>
      </div>
    </main>
  );
}

export function StudentDocumentGradingFeedback({
  view,
  feedbackContext,
}: {
  view: StudentGradingFeedbackView;
  feedbackContext?: StudentFeedbackTaskContext | null;
}) {
  return (
    <section className="w-full" data-intelligent-teaching-assistant-demo-surface="document-feedback">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="border-b border-border pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Returned feedback</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">报告反馈</h1>
          <p className="mt-2 text-sm text-muted-foreground">{view.assignmentId} · {view.status}</p>
        </header>
        <StudentFeedbackTaskPanel context={feedbackContext ?? null} surface="document-feedback" />

        {view.status === 'visible' && view.document ? (
          <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded border border-border bg-card/75 p-5">
              <h2 className="text-lg font-medium">{view.document.fileName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">reference precision: {view.document.referencePrecision}</p>
              <pre className="mt-4 whitespace-pre-wrap rounded bg-background p-4 text-sm leading-7 text-foreground">
                {view.document.markdown}
              </pre>
            </div>

            <div className="space-y-5">
              <section className="rounded border border-border bg-card/75 p-5">
                <h2 className="text-lg font-medium">量规得分</h2>
                <div className="mt-4 space-y-3">
                  {view.rubricBreakdown.map((criterion) => (
                    <article key={criterion.criterionId} className="rounded border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium">{criterion.label}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{criterion.comment}</p>
                        </div>
                        <span className="text-lg font-semibold text-primary">{criterion.score}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded border border-border bg-card/75 p-5">
                <h2 className="text-lg font-medium">证据胶囊</h2>
                <div className="mt-4 space-y-3">
                  {view.evidenceCapsules.map((capsule) => (
                    <article key={capsule.title} className="rounded border border-border p-3">
                      <p className="font-medium">{capsule.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{capsule.detail}</p>
                      <p className="mt-2 text-xs text-primary">confidence {capsule.confidence}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded border border-border bg-card/75 p-5">
                <h2 className="text-lg font-medium">学情影响</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {view.profileImpactSummary.map((impact) => (
                    <div key={impact.goalDimension} className="rounded border border-border p-3">
                      <p className="font-medium">{impact.goalDimension}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        contribution {impact.contribution} · confidence {impact.confidence}
                      </p>
                    </div>
                  ))}
                </div>
                {view.actionCards.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {view.actionCards.map((card) => (
                      <a
                        key={card.id}
                        href={card.href}
                        className="rounded border border-border bg-background p-3 text-sm transition hover:border-primary hover:text-primary"
                      >
                        <span className="block font-medium">{card.label}</span>
                        <span className="mt-1 block text-muted-foreground">
                          {card.criterionId} · evidence {card.evidenceRefCount}
                        </span>
                      </a>
                    ))}
                  </div>
                ) : null}
                {view.konlingEntryPoint ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded border border-border bg-background px-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {view.konlingEntryPoint.promptContext}
                    </p>
                    <KonlingEntryPointButton entryPoint={view.konlingEntryPoint} label="解释反馈" />
                  </div>
                ) : null}
              </section>
            </div>
          </section>
        ) : (
          <section className="rounded border border-border bg-card/75 p-6 text-muted-foreground">
            当前反馈尚未由教师批准返回。
          </section>
        )}
      </div>
    </section>
  );
}
