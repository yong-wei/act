import type {
  StudentGradingFeedbackView,
  TeacherGradingWorkbenchView,
} from '@/features/teacher/document-rubric-grading-workbench';
import type { AuditedActionState } from '@/lib/action-status-contract';
import { ActionStatusPanel } from '@/components/platform/action-status';
import { KonlingEntryPointButton } from '@/components/ai/konling-entry-point-button';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import type { StudentFeedbackTaskContext } from '@/lib/student-feedback-task-contract';
import { DocumentGradingApprovalButton } from './document-rubric-grading-actions';

function conversionAdapterLabel(value: TeacherGradingWorkbenchView['conversion']['adapter']) {
  return value === 'markitdown' ? '文档解析' : '基础解析';
}

function conversionStatusLabel(value: TeacherGradingWorkbenchView['conversion']['status']) {
  const labels: Record<TeacherGradingWorkbenchView['conversion']['status'], string> = {
    pending: '等待解析',
    converted: '解析完成',
    failed: '解析失败',
    fallback: '基础解析',
  };
  return labels[value];
}

function referencePrecisionLabel(value: TeacherGradingWorkbenchView['conversion']['referencePrecision']) {
  const labels: Record<TeacherGradingWorkbenchView['conversion']['referencePrecision'], string> = {
    page: '页级定位',
    block: '段落级定位',
    span: '精确定位',
  };
  return labels[value];
}

function conversionWarningLabel(value: string) {
  const labels: Record<string, string> = {
    'layout-span-mapping-unavailable': '当前文件只提供段落级定位，逐字定位需教师复核',
    'converted-markdown-blocks-mismatch': '解析内容与原文分段不完全一致',
    'converted-block-source-mismatch': '部分证据段需要人工核对原文',
    'evidence-block-mismatch': '证据段与评分草稿未完全匹配',
  };
  return labels[value] ?? value.replaceAll('-', ' ');
}

function blockReferenceLabel(value: string) {
  const blockMatch = value.match(/^block-(\d+)$/);
  if (blockMatch) return `证据段 ${blockMatch[1]}`;
  const fallbackMatch = value.match(/^fallback-block-(\d+)$/);
  if (fallbackMatch) return `基础证据段 ${fallbackMatch[1]}`;
  return '证据段';
}

function annotationRoleLabel(value: TeacherGradingWorkbenchView['annotations'][number]['authorRole']) {
  return value === 'teacher' ? '教师标注' : '评分草稿';
}

function runActionLabel(value: TeacherGradingWorkbenchView['actions'][number]) {
  const labels: Record<TeacherGradingWorkbenchView['actions'][number], string> = {
    'retry-conversion': '重新解析',
    'edit-criterion': '调整量规',
    'add-annotation': '补充标注',
    approve: '批准返回',
    'return-feedback': '返回反馈',
  };
  return labels[value];
}

function criterionLimitationLabel(value: NonNullable<TeacherGradingWorkbenchView['rubricTree'][number]['limitationState']>) {
  const labels: Record<NonNullable<TeacherGradingWorkbenchView['rubricTree'][number]['limitationState']>, string> = {
    none: '无限制',
    'missing-evidence': '缺少证据',
    'low-confidence': '证据可信度偏低',
    'conversion-limited': '解析定位有限',
  };
  return labels[value];
}

function criterionLevelLabel(value: string | null) {
  if (!value) return '待选择';
  const labels: Record<string, string> = {
    beginning: '初步达成',
    developing: '继续发展',
    proficient: '熟练达成',
    advanced: '表现突出',
  };
  return labels[value] ?? value;
}

function feedbackStatusLabel(value: StudentGradingFeedbackView['status']) {
  const labels: Record<StudentGradingFeedbackView['status'], string> = {
    'hidden-unapproved': '等待教师批准',
    visible: '已返回',
  };
  return labels[value];
}

function approvalBlockReasonLabel(value: string) {
  const labels: Record<string, string> = {
    'low-confidence-evidence': '证据可信度不足',
    'missing-required-evidence': '缺少必要证据',
    'unapproved-teacher-edits': '存在尚未确认的教师修改',
  };
  return labels[value] ?? value.replaceAll('-', ' ');
}

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
      <div className="box-border flex w-full flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-3 border-b border-border pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">报告评分</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">报告评分工作台</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                {view.asset.fileName} · 学生 {view.asset.studentId} · 校验码 {view.asset.checksum.slice(0, 12)}
              </p>
            </div>
            <div className="rounded border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
              {conversionAdapterLabel(view.conversion.adapter)} · {conversionStatusLabel(view.conversion.status)} · {referencePrecisionLabel(view.conversion.referencePrecision)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded border border-border px-2 py-1">来源质量：{conversionStatusLabel(view.conversion.status)}</span>
            <span className="rounded border border-border px-2 py-1">隐私范围：教师复核</span>
            <span className="rounded border border-border px-2 py-1">状态：{view.draftSummary.requiresTeacherApproval ? 'AI 评分待教师审批' : 'AI 证据已完成教师决策'}</span>
            <span className="rounded border border-border px-2 py-1">导出：受限脱敏</span>
          </div>
          {routeState ? <ActionStatusPanel state={routeState} /> : null}
        </header>

        <section className="grid min-w-0 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 rounded border border-border bg-card/75 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">转换预览</h2>
              <span className="text-sm text-muted-foreground">可信度 {view.conversion.confidence}</span>
            </div>
            <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded bg-background p-4 text-sm leading-7 text-foreground">
              {view.preview.markdown}
            </pre>
            {view.conversion.warnings.length > 0 ? (
              <div className="mt-4 break-words rounded border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
                {view.conversion.warnings.map(conversionWarningLabel).join(' / ')}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <section className="min-w-0 rounded border border-border bg-card/75 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">评分量规</h2>
                <span className="text-sm text-muted-foreground">
                  草稿可信度 {view.draftSummary.averageConfidence}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {view.rubricTree.map((criterion) => (
                  <article key={criterion.criterionId} className="min-w-0 rounded border border-border p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium">{criterion.label}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {criterionLevelLabel(criterion.selectedLevelId)} · 证据 {criterion.evidenceCount} 条
                        </p>
                        {criterion.limitationState && criterion.limitationState !== 'none' ? (
                          <p className="mt-1 text-xs text-primary">{criterionLimitationLabel(criterion.limitationState)}</p>
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
                        {annotationRoleLabel(annotation.authorRole)} · {referencePrecisionLabel(annotation.reference.precision)}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm text-muted-foreground">{annotation.comment}</p>
                    <p className="mt-2 text-xs text-primary">
                      {annotation.reference.pageNumber ? `第 ${annotation.reference.pageNumber} 页` : '页码待核对'} · {blockReferenceLabel(annotation.reference.blockId)}
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
                      <li key={reason}>{approvalBlockReasonLabel(reason)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {view.actions.map((action) => (
                  action === 'approve' && view.gradingRunId ? (
                    <DocumentGradingApprovalButton key={`approve:${view.gradingRunId}`} gradingRunId={view.gradingRunId} criteria={view.rubricTree} />
                  ) : (
                    <button key={action} type="button" className="rounded border border-border px-3 py-2 text-sm text-foreground transition hover:border-primary hover:text-primary">
                      {runActionLabel(action)}
                    </button>
                  )
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded border border-border bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 break-words text-sm text-muted-foreground">
                  {view.draftSummary.requiresTeacherApproval ? '已绑定当前 AI 评分、学生报告与量规版本。' : '当前展示 AI 评分证据与已完成的教师决策。'}
                </p>
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
      <div className="box-border flex w-full flex-col gap-6 px-6 py-8">
        <header className="border-b border-border pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">报告评分</p>
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

export function TeacherDocumentGradingUnavailableState({ reasons }: { reasons: string[] }) {
  return <main className="surface-page" data-document-grading-content="unavailable"><div className="px-6 py-8"><h1 className="text-3xl font-semibold">报告内容不可用</h1><p className="mt-3 text-sm text-muted-foreground">该评分材料已到期、删除、阻断，或冻结契约不再有效，正文与证据不会显示。</p><ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-destructive">{reasons.map((reason) => <li key={reason}>{approvalBlockReasonLabel(reason)}</li>)}</ul></div></main>;
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
      <div className="flex w-full flex-col gap-6 px-6 py-8">
        <header className="border-b border-border pb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">返回反馈</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">报告反馈</h1>
          <p className="mt-2 text-sm text-muted-foreground">{view.assignmentId} · {feedbackStatusLabel(view.status)}</p>
        </header>
        <StudentFeedbackTaskPanel context={feedbackContext ?? null} surface="document-feedback" />

        {view.status === 'visible' && view.document ? (
          <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded border border-border bg-card/75 p-5">
              <h2 className="text-lg font-medium">{view.document.fileName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">证据定位：{referencePrecisionLabel(view.document.referencePrecision)}</p>
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
                      <p className="mt-2 text-xs text-primary">可信度 {capsule.confidence}</p>
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
                        学情贡献 {impact.contribution} · 可信度 {impact.confidence}
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
                          {card.criterionId} · 证据 {card.evidenceRefCount} 条
                        </span>
                      </a>
                    ))}
                  </div>
                ) : null}
                {view.konlingEntryPoint ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded border border-border bg-background px-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      已绑定本次反馈记录，可请求进一步解释。
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
