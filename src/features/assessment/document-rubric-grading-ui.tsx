import type {
  StudentGradingFeedbackView,
  TeacherGradingWorkbenchView,
} from '@/lib/data-governance/document-rubric-grading-workbench';
import { DocumentGradingApprovalButton } from './document-rubric-grading-actions';

export function TeacherDocumentGradingWorkbench({ view }: { view: TeacherGradingWorkbenchView }) {
  return (
    <main className="surface-page">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
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
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded border border-border bg-card/75 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">转换预览</h2>
              <span className="text-sm text-muted-foreground">confidence {view.conversion.confidence}</span>
            </div>
            <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded bg-background p-4 text-sm leading-7 text-foreground">
              {view.preview.markdown}
            </pre>
            {view.conversion.warnings.length > 0 ? (
              <div className="mt-4 rounded border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
                {view.conversion.warnings.join(' / ')}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <section className="rounded border border-border bg-card/75 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">评分量规</h2>
                <span className="text-sm text-muted-foreground">
                  draft confidence {view.draftSummary.averageConfidence}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {view.rubricTree.map((criterion) => (
                  <article key={criterion.criterionId} className="rounded border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{criterion.label}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {criterion.selectedLevelId ?? 'pending'} · evidence {criterion.evidenceCount}
                        </p>
                      </div>
                      <span className="text-lg font-semibold text-primary">{criterion.editableScore ?? '-'}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded border border-border bg-card/75 p-5">
              <h2 className="text-lg font-medium">审批动作</h2>
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
              <p className="mt-4 text-sm text-muted-foreground">{view.konlingEntryPoint.promptContext}</p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

export function TeacherDocumentGradingEmptyState() {
  return (
    <main className="surface-page">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="border-b border-border pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Document grading</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">报告评分工作台</h1>
          <p className="mt-2 text-sm text-muted-foreground">当前没有打开的文档评分草稿。</p>
        </header>
        <section className="rounded border border-border bg-card/75 p-6 text-muted-foreground">
          请选择已转换的学生提交，或通过评分草稿标识进入审批工作台。
        </section>
      </div>
    </main>
  );
}

export function StudentDocumentGradingFeedback({ view }: { view: StudentGradingFeedbackView }) {
  return (
    <main className="surface-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="border-b border-border pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Returned feedback</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">报告反馈</h1>
          <p className="mt-2 text-sm text-muted-foreground">{view.assignmentId} · {view.status}</p>
        </header>

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
                {view.konlingEntryPoint ? (
                  <p className="mt-4 rounded border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    {view.konlingEntryPoint.promptContext}
                  </p>
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
    </main>
  );
}
