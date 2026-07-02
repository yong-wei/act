import Link from 'next/link';
import { ArrowLeft, Archive, CheckCircle2, RotateCcw, ShieldCheck, TrendingUp } from 'lucide-react';

import { ActionStatusPanel } from '@/components/platform/action-status';
import type {
  CourseEnhancementPack,
  CourseEnhancementPackItem,
  TeacherPrepPackInsertionTarget,
} from '@/lib/data-governance/teacher-prep-pack-generation';
import type { AuditedActionState } from '@/lib/action-status-contract';

export interface PrepPackReviewActionContext {
  packId: string;
  status: CourseEnhancementPack['status'];
  itemIds: string[];
  classId: string;
  lessonId: string;
}

export interface PrepPackReviewEntryContext {
  classId?: string | null;
  clusterId?: string | null;
  graphNodeId?: string | null;
  learningGoalId?: string | null;
  resourceGapStatus?: string | null;
}

const LIFECYCLE_ACTIONS = [
  { id: 'preview', label: '预览 diff', icon: ShieldCheck },
  { id: 'activate', label: '激活 overlay', icon: CheckCircle2 },
  { id: 'rollback', label: '回滚 overlay', icon: RotateCcw },
  { id: 'impact-evidence', label: '记录影响证据', icon: TrendingUp },
  { id: 'archive', label: '归档课前包', icon: Archive },
];

export function TeacherPrepPackReviewSurface({
  pack,
  recovery,
  entryContext,
  actionReceipt,
}: {
  pack?: CourseEnhancementPack | null;
  recovery?: { reason: 'storage-missing' } | null;
  entryContext?: PrepPackReviewEntryContext;
  actionReceipt?: AuditedActionState | null;
}) {
  const actionContext = pack ? {
    packId: pack.id,
    status: pack.status,
    itemIds: pack.items.map((item) => item.id),
    classId: pack.classId,
    lessonId: pack.lessonId,
  } satisfies PrepPackReviewActionContext : undefined;
  const actionItemId = actionContext?.itemIds[0] ?? '';
  const effectiveEntryContext = normalizePrepPackEntryContext(entryContext, pack);

  return (
    <main
      className="surface-page px-6 py-8"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
      data-report-ledger-surface="teacher-prep-pack-review"
      data-report-ledger-privacy-scope="teacher-review"
      data-prep-pack-entry-class-id={effectiveEntryContext.classId ?? undefined}
      data-prep-pack-entry-cluster-id={effectiveEntryContext.clusterId ?? undefined}
      data-prep-pack-entry-graph-node-id={effectiveEntryContext.graphNodeId ?? undefined}
      data-prep-pack-entry-learning-goal-id={effectiveEntryContext.learningGoalId ?? undefined}
      data-prep-pack-entry-resource-gap-status={effectiveEntryContext.resourceGapStatus ?? undefined}
      data-operations-overlay-lifecycle="preview review activate archive rollback"
      data-operations-mutates-base-manifest="false"
    >
      <div className="mb-6">
        <Link href="/teacher" className="inline-flex items-center gap-2 text-sm text-subtle hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          返回教师工作台
        </Link>
      </div>

      {actionReceipt ? <ActionStatusPanel state={actionReceipt} className="mb-6" /> : null}

      <section className="surface-card p-6" data-teacher-prep-pack-entry="class-diagnosis">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Teacher Prep Pack</p>
            <h1 className="mt-2 text-3xl font-bold text-foreground">课前包复核</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-subtle">
              从班级诊断进入候选课前包复核，先看理由、证据、插入点和 runtime diff，再决定预览、激活、回滚或归档。
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-subtle">
            <p className="font-medium text-foreground">发布边界</p>
            <p className="mt-2">复核动作只管理 CourseEnhancementPack overlay，不直接修改基础 runtime manifest。</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {pack?.items.length ? pack.items.map((item) => (
            <PrepPackReviewItem key={item.id} item={item} packStatus={pack.status} />
          )) : (
            <section className="surface-card p-6" data-prep-pack-empty-state>
              {recovery?.reason === 'storage-missing' ? (
                <>
                  <p className="text-sm font-medium text-foreground">课前包存储尚未就绪</p>
                  <p className="mt-2 text-sm leading-6 text-subtle">
                    当前环境缺少 CourseEnhancementPack 存储表。请先完成数据库迁移或联系管理员初始化课前包存储，再返回复核。
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">暂无可复核课前包</p>
                  <p className="mt-2 text-sm leading-6 text-subtle">
                    当前教师账号还没有可加载的 CourseEnhancementPack。请先从班级诊断或教师备课增强包生成流程创建候选包。
                  </p>
                </>
              )}
            </section>
          )}
        </div>

        <aside className="surface-card h-fit p-5" data-prep-pack-lifecycle-actions>
          <h2 className="text-lg font-semibold text-foreground">生命周期动作</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">
            操作必须经过教师复核，并由持久化 CourseEnhancementPack 函数执行权限、班级、课次和 overlay 范围校验。
          </p>
          {actionContext ? (
            <p className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-subtle" data-prep-pack-action-context={actionContext.packId}>
              当前包 {actionContext.packId}；状态 {actionContext.status}；班级 {actionContext.classId}
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-subtle" data-prep-pack-action-state="read-only">
              暂无可执行的持久化课前包，当前页面仅展示复核结构。
            </p>
          )}
          <div className="mt-4 space-y-2">
            {LIFECYCLE_ACTIONS.map((action) => {
              const Icon = action.icon;
              const disabled = isLifecycleActionDisabled(action.id, actionContext, actionItemId);
              return (
                <form key={action.id} action="/teacher/prep-packs/actions" method="post">
                  <input type="hidden" name="packId" value={actionContext?.packId ?? ''} />
                  <input type="hidden" name="itemId" value={actionItemId} />
                  <input type="hidden" name="classId" value={effectiveEntryContext.classId ?? ''} />
                  <input type="hidden" name="clusterId" value={effectiveEntryContext.clusterId ?? ''} />
                  <input type="hidden" name="graphNodeId" value={effectiveEntryContext.graphNodeId ?? ''} />
                  <input type="hidden" name="learningGoalId" value={effectiveEntryContext.learningGoalId ?? ''} />
                  <input type="hidden" name="resourceGapStatus" value={effectiveEntryContext.resourceGapStatus ?? ''} />
                  <input type="hidden" name="reason" value={`${action.label} by teacher review surface`} />
                  <button
                    type="submit"
                    name="action"
                    value={action.id}
                    disabled={disabled}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-left text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    data-prep-pack-action={action.id}
                    data-prep-pack-action-disabled={String(disabled)}
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    {action.label}
                  </button>
                </form>
              );
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}

function normalizePrepPackEntryContext(
  entryContext: PrepPackReviewEntryContext | undefined,
  pack: CourseEnhancementPack | null | undefined,
): Required<PrepPackReviewEntryContext> {
  return {
    classId: entryContext?.classId ?? pack?.classId ?? null,
    clusterId: entryContext?.clusterId ?? null,
    graphNodeId: entryContext?.graphNodeId ?? pack?.items[0]?.resourceCoverageGaps?.[0]?.graphNodeId ?? null,
    learningGoalId: entryContext?.learningGoalId ?? pack?.goalId ?? null,
    resourceGapStatus: entryContext?.resourceGapStatus ?? pack?.items[0]?.resourceCoverageGaps?.[0]?.coverageState ?? null,
  };
}

function PrepPackReviewItem({
  item,
  packStatus,
}: {
  item: CourseEnhancementPackItem;
  packStatus: CourseEnhancementPack['status'];
}) {
  const rationale = item.rationale ?? item.methodologyNotes.join('；');
  const confidence = item.confidence ?? { state: 'none' as const, score: 0, limitations: ['missing-confidence-metadata'] };

  return (
    <article
      className="surface-card p-5"
      data-prep-pack-candidate={item.id}
      data-prep-pack-lifecycle-state={packStatus}
      data-prep-pack-base-manifest-mutated="false"
    >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-primary">候选项</p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-subtle" data-prep-pack-rationale>
                    {rationale}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-subtle" data-prep-pack-methodology>
                    {item.methodologyNotes.join('；')}
                  </p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs text-subtle">
                  {packStatus}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3" data-prep-pack-source-evidence>
                  <p className="text-xs text-subtle">来源证据</p>
                  <ul className="mt-2 space-y-1 text-sm text-foreground">
                    {item.evidenceBasis.map((evidence) => (
                      <li key={`${item.id}-${evidence.sourceType}-${evidence.sourceId}`}>
                        <span className="font-medium">{evidence.displayTitle || evidence.sourceId}</span>
                        <span className="block text-xs text-subtle">{evidence.capsule}</span>
                        <span className="block text-xs text-subtle">
                          Citation {evidence.citationChip.chunkId} · {evidence.citationChip.authorityLevel} · {evidence.citationChip.privacyVisibility}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3" data-prep-pack-insertion-target>
                  <p className="text-xs text-subtle">插入目标</p>
                  <p className="mt-2 text-sm text-foreground">{formatInsertionTarget(item.insertionTarget)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3" data-prep-pack-runtime-diff>
                  <p className="text-xs text-subtle">Runtime diff</p>
                  <p className="mt-2 text-sm text-foreground">
                    新增 1 个 overlay item；阶段 {item.insertionTarget.lessonStage ?? '未指定'}；基础 manifest 未修改。
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3" data-prep-pack-selection-conditions>
                <p className="text-xs text-subtle">选择依据与会改变选择的证据</p>
                <ul className="mt-2 space-y-1 text-sm text-foreground">
                  <li>Confidence {confidence.state} · score {Math.round(confidence.score * 100)}%</li>
                  {confidence.limitations.map((limitation) => (
                    <li key={`${item.id}-limitation-${limitation}`}>Limitation: {formatSelectionCondition(limitation)}</li>
                  ))}
                  {(item.resourceCoverageGaps ?? []).map((gap) => (
                    <li key={`${item.id}-gap-${gap.graphNodeId}`}>
                      Resource gap {gap.graphNodeId}: {gap.coverageState}
                      {gap.missingCoverageTypes.length ? `; missing ${gap.missingCoverageTypes.join(', ')}` : ''}
                    </li>
                  ))}
                  {(item.sourceDiagnosisRefs ?? []).map((ref) => (
                    <li key={`${item.id}-diagnosis-${ref.clusterId}`}>
                      Source diagnosis {ref.clusterId}{ref.claimIds.length ? `; claims ${ref.claimIds.join(', ')}` : ''}
                    </li>
                  ))}
                  <li>{selectionChangeSummary(item, confidence.limitations)}</li>
                </ul>
              </div>
    </article>
  );
}

function isLifecycleActionDisabled(
  actionId: string,
  actionContext: PrepPackReviewActionContext | undefined,
  actionItemId: string,
): boolean {
  if (!actionContext) return true;
  if (actionId === 'rollback' || actionId === 'impact-evidence') {
    return actionContext.status !== 'active' || (actionId === 'impact-evidence' && !actionItemId);
  }
  if (actionId === 'archive') return actionContext.status === 'archived';
  return false;
}

function formatInsertionTarget(target: TeacherPrepPackInsertionTarget): string {
  const parts = [
    target.lessonId,
    target.lessonStage,
    target.lessonStepId,
    target.resourceNodeId,
    target.classSessionId,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : target.type;
}

function formatSelectionCondition(limitation: string): string {
  if (limitation === 'low-denominator-suppressed') return 'sample size must reach the privacy threshold before insertion';
  if (limitation === 'missing-resource-coverage') return 'resource coverage must be linked or replaced by a draft request';
  if (limitation === 'stale-overlay') return 'graph overlay must refresh to current evidence';
  if (limitation === 'missing-evidence') return 'diagnosis needs governed evidence before selection confidence can rise';
  if (limitation.startsWith('resource-coverage-gap:')) {
    return `${limitation.slice('resource-coverage-gap:'.length)} coverage gap must be filled`;
  }
  return limitation;
}

function selectionChangeSummary(item: CourseEnhancementPackItem, limitations: string[]): string {
  const changes: string[] = [];
  if (limitations.includes('low-denominator-suppressed')) {
    changes.push('denominator reaches the privacy threshold');
  }
  if (limitations.includes('stale-overlay')) {
    changes.push('overlay evidence refreshes from stale to current');
  }
  if ((item.resourceCoverageGaps ?? []).length > 0 || limitations.includes('missing-resource-coverage')) {
    changes.push('resource coverage gaps are resolved');
  }
  if (item.evidenceBasis.some((evidence) => evidence.citationChip.authorityLevel !== 'verified')) {
    changes.push('verified citations replace weaker evidence');
  }
  if (changes.length === 0) {
    return 'Selection would change if newer governed evidence lowers confidence or contradicts the diagnosis.';
  }
  return `Selection would change when ${changes.join(', ')}.`;
}
