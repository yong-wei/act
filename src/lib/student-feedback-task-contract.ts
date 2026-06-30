import { createAuditedActionState, type AuditedActionState } from '@/lib/action-status-contract';
import type { EvidenceTimelinePage } from '@/lib/data-governance/evidence-timeline';
import { buildStudentVisibleTeacherIntervention } from '@/lib/teacher-evidence-intervention-contract';

export type FeedbackTaskLifecycleState =
  | 'returned'
  | 'read'
  | 'adopted'
  | 'revising'
  | 'completed'
  | 'written-back'
  | 'teacher-visible'
  | 'missing'
  | 'unsupported';

export interface FeedbackTaskQuery {
  assignment?: string | string[] | null;
  criterion?: string | string[] | null;
  source?: string | string[] | null;
  feedbackSource?: string | string[] | null;
  status?: string | string[] | null;
  action?: string | string[] | null;
  returnTo?: string | string[] | null;
  intent?: string | string[] | null;
  teacherInterventionId?: string | string[] | null;
}

export interface FeedbackTaskContextOptions {
  verifiedTeacherInterventionId?: string | null;
}

export interface StudentFeedbackTaskContext {
  assignmentId: string;
  assignmentTitle: string;
  criterionId: string | null;
  criterionLabel: string | null;
  source: string | null;
  lifecycleState: FeedbackTaskLifecycleState;
  action: string | null;
  intent: string | null;
  returnTo: string | null;
  teacherInterventionId: string | null;
  returnHref: string;
  completionTarget: 'evidence-growth-portfolio' | 'unsupported';
  supported: boolean;
  teacherIntervention: ReturnType<typeof buildStudentVisibleTeacherIntervention>;
  summary: string;
  badges: string[];
}

export interface PortfolioFeedbackDraft {
  id: string;
  status: 'candidate';
  persisted: false;
  source: string | null;
  title: string;
  detail: string;
  returnHref: string;
}

export interface FeedbackTaskMissionTarget {
  missionOrders: number[];
  reason: string;
}

const REPORT_CONTROL_DESIGN = {
  assignmentId: 'report-control-design',
  assignmentTitle: '控制设计报告反馈',
  criteria: {
    'model-assumptions': '模型假设',
    'target-specification': '目标指标',
    'compensator-design': '校正方案',
    'simulation-evidence': '仿真验证',
    'engineering-rationale': '工程论证',
  } as Record<string, string>,
};

const STATE_LABELS: Record<FeedbackTaskLifecycleState, string> = {
  returned: '已返回',
  read: '已读',
  adopted: '已采用',
  revising: '修订中',
  completed: '已完成',
  'written-back': '已写回',
  'teacher-visible': '教师可见',
  missing: '对象缺失',
  unsupported: '暂不支持',
};

export function buildFeedbackTaskContext(
  query: FeedbackTaskQuery,
  options: FeedbackTaskContextOptions = {},
): StudentFeedbackTaskContext | null {
  const assignmentId = firstQueryValue(query.assignment);
  if (!assignmentId) return null;

  const criterionId = firstQueryValue(query.criterion);
  const source = firstQueryValue(query.feedbackSource) ?? firstQueryValue(query.source);
  const action = firstQueryValue(query.action);
  const intent = firstQueryValue(query.intent);
  const teacherInterventionId = firstQueryValue(query.teacherInterventionId);
  const requestedLifecycleState = resolveLifecycleState(firstQueryValue(query.status), action, intent);
  const hasTeacherVisibleInterventionRequest =
    Boolean(teacherInterventionId)
    && (requestedLifecycleState === 'teacher-visible' || requestedLifecycleState === 'written-back');
  const hasVerifiedTeacherIntervention =
    Boolean(teacherInterventionId) && teacherInterventionId === options.verifiedTeacherInterventionId;
  const hasUnverifiedTeacherIntervention =
    hasTeacherVisibleInterventionRequest && !hasVerifiedTeacherIntervention;
  const lifecycleState = hasUnverifiedTeacherIntervention ? 'completed' : requestedLifecycleState;
  const returnTo = sanitizeReturnTo(firstQueryValue(query.returnTo));
  const isDocumentFeedbackAssignment = source === 'document-feedback' && Boolean(criterionId);
  const supported = assignmentId === REPORT_CONTROL_DESIGN.assignmentId || isDocumentFeedbackAssignment;
  const criterionLabel = supported && criterionId
    ? REPORT_CONTROL_DESIGN.criteria[criterionId] ?? criterionId
    : criterionId;
  const context: Omit<StudentFeedbackTaskContext, 'returnHref' | 'summary' | 'badges'> = {
    assignmentId,
    assignmentTitle: supported ? resolveAssignmentTitle(assignmentId, source ?? undefined) : '未知反馈任务',
    criterionId: criterionId ?? null,
    criterionLabel: criterionLabel ?? null,
    source: source ?? null,
    lifecycleState: supported ? lifecycleState : 'missing',
    action: action ?? null,
    intent: intent ?? null,
    returnTo,
    teacherInterventionId,
    completionTarget: supported ? 'evidence-growth-portfolio' : 'unsupported',
    supported,
    teacherIntervention: supported && !hasUnverifiedTeacherIntervention
      ? buildStudentVisibleTeacherIntervention({
        assignmentId,
        status: lifecycleState,
        source,
        teacherInterventionId,
      })
      : null,
  };
  const returnHref = buildFeedbackTaskHref(returnTo ?? '/assessment/document-feedback', context, {
    status: context.lifecycleState,
    omitReturnTo: true,
  });
  return {
    ...context,
    returnHref,
    summary: buildFeedbackTaskSummary({ ...context, returnHref }),
    badges: buildFeedbackTaskBadges({ ...context, returnHref, summary: '' }),
  };
}

export function shouldRenderPortfolioFeedbackTask(query: FeedbackTaskQuery): boolean {
  return firstQueryValue(query.intent) === 'collect' && Boolean(buildFeedbackTaskContext(query)?.supported);
}

export function buildFeedbackTaskHref(
  baseHref: string,
  context: Pick<StudentFeedbackTaskContext, 'assignmentId' | 'criterionId' | 'source' | 'lifecycleState' | 'returnTo'>
    & Partial<Pick<StudentFeedbackTaskContext, 'teacherInterventionId'>>,
  options: {
    status?: FeedbackTaskLifecycleState;
    intent?: string;
    action?: string;
    omitReturnTo?: boolean;
  } = {},
): string {
  if (isExternalHref(baseHref)) return baseHref;
  const hashIndex = baseHref.indexOf('#');
  const hrefWithoutHash = hashIndex >= 0 ? baseHref.slice(0, hashIndex) : baseHref;
  const rawHash = hashIndex >= 0 ? baseHref.slice(hashIndex + 1) : undefined;
  const [path, rawQuery = ''] = hrefWithoutHash.split('?');
  const params = new URLSearchParams(rawQuery);
  const existingSource = params.get('source');
  params.set('assignment', context.assignmentId);
  if (context.criterionId) params.set('criterion', context.criterionId);
  params.set('status', options.status ?? context.lifecycleState);
  if (context.source && existingSource && existingSource !== context.source) {
    params.set('feedbackSource', context.source);
  } else if (context.source) {
    params.set('source', context.source);
  }
  if (options.intent) params.set('intent', options.intent);
  if (options.action) params.set('action', options.action);
  if (context.teacherInterventionId) params.set('teacherInterventionId', context.teacherInterventionId);
  if (!options.omitReturnTo && context.returnTo) params.set('returnTo', context.returnTo);
  const query = params.toString();
  const hrefWithQuery = query ? `${path}?${query}` : path;
  return rawHash === undefined ? hrefWithQuery : `${hrefWithQuery}#${rawHash}`;
}

export async function resolveVerifiedTeacherInterventionId(input: {
  db: {
    evidenceOutbox: {
      findFirst: (args: any) => Promise<{ causationId: string; payload: unknown } | null>;
    };
  };
  userId?: string | null;
  teacherInterventionId?: string | string[] | null;
  assignment?: string | string[] | null;
}) {
  const teacherInterventionId = firstQueryValue(input.teacherInterventionId);
  const assignmentId = firstQueryValue(input.assignment);
  if (!input.userId || !teacherInterventionId) return null;
  const row = await input.db.evidenceOutbox.findFirst({
    where: {
      ownerUserId: input.userId,
      causationId: teacherInterventionId,
      eventType: { startsWith: 'teacher_evidence_intervention.' },
    },
    select: { causationId: true, payload: true },
  });
  if (!row || !isVerifiedTeacherInterventionOutboxPayload(row.payload, teacherInterventionId, assignmentId)) {
    return null;
  }
  return row.causationId;
}

function isVerifiedTeacherInterventionOutboxPayload(
  payload: unknown,
  teacherInterventionId: string,
  assignmentId: string | null,
) {
  if (!payload || typeof payload !== 'object') return false;
  const intervention = (payload as { intervention?: unknown }).intervention;
  if (!intervention || typeof intervention !== 'object') return false;
  const record = intervention as {
    id?: unknown;
    status?: unknown;
    studentFacingTarget?: { href?: unknown; surface?: unknown };
  };
  if (record.id !== teacherInterventionId || record.status !== 'student-visible') return false;
  if (!assignmentId) return true;
  const href = typeof record.studentFacingTarget?.href === 'string' ? record.studentFacingTarget.href : null;
  if (!href) return false;
  const query = href.split('?')[1] ?? '';
  return new URLSearchParams(query).get('assignment') === assignmentId;
}

function isExternalHref(href: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//');
}

export function getFeedbackTaskMissionTarget(context: StudentFeedbackTaskContext): FeedbackTaskMissionTarget | null {
  if (!context.supported) return null;
  if (context.assignmentId !== REPORT_CONTROL_DESIGN.assignmentId && context.source !== 'document-feedback') return null;
  return {
    missionOrders: [2, 3, 4],
    reason: '控制设计报告反馈对应 P/PD/PID 控制器补强任务。',
  };
}

function resolveAssignmentTitle(assignmentId: string, source: string | null | undefined): string {
  if (assignmentId === REPORT_CONTROL_DESIGN.assignmentId) return REPORT_CONTROL_DESIGN.assignmentTitle;
  if (source === 'document-feedback') return '报告评分反馈';
  return REPORT_CONTROL_DESIGN.assignmentTitle;
}

export function buildFeedbackTaskStatusState(
  context: StudentFeedbackTaskContext,
  sourceRoute: string,
): AuditedActionState {
  const identity = {
    id: `student-feedback:${context.assignmentId}:${context.lifecycleState}`,
    category: 'writeback' as const,
    label: '反馈写回',
    sourceRoute,
    targetId: context.assignmentId,
    requestedAction: context.action,
  };

  if (!context.supported) {
    return createAuditedActionState({
      identity,
      status: 'blocked',
      message: '反馈任务不存在或链接已过期。',
      recoveryAction: '返回报告反馈页并刷新任务',
    });
  }

  if (context.lifecycleState === 'written-back' || context.lifecycleState === 'teacher-visible') {
    return createAuditedActionState({
      identity,
      status: 'succeeded',
      message: context.teacherIntervention
        ? '教师处置已写回学习证据、成长记录和作品集候选，并对学生可见。'
        : '反馈任务已写回学习证据、成长记录和作品集候选。',
      nextAction: '查看证据、成长和作品集候选',
    });
  }

  if (context.lifecycleState === 'completed') {
    return createAuditedActionState({
      identity,
      status: 'pending',
      message: '反馈任务已完成，等待写回学习证据和作品集候选。',
      nextAction: '执行写回或查看候选证据',
    });
  }

  if (context.lifecycleState === 'adopted' || context.lifecycleState === 'revising') {
    return createAuditedActionState({
      identity,
      status: 'pending',
      message: `反馈任务${STATE_LABELS[context.lifecycleState]}，下一步需要完成补强动作。`,
      nextAction: '继续自适应练习、任务大厅或资源修订',
    });
  }

  return createAuditedActionState({
    identity,
    status: 'pending',
    message: '反馈任务已返回，等待学生采用建议。',
    nextAction: '采用一项建议并进入补强任务',
  });
}

export function buildPortfolioFeedbackDraft(context: StudentFeedbackTaskContext): PortfolioFeedbackDraft | null {
  if (!context.supported) return null;
  const criterion = context.criterionId ?? 'general';
  return {
    id: `portfolio-candidate:${context.assignmentId}:${criterion}`,
    status: 'candidate',
    persisted: false,
    source: context.source,
    title: `${context.assignmentTitle}收录候选`,
    detail: `${context.criterionLabel ?? '综合反馈'}已形成作品集候选。本页只创建候选草稿，确认后才会保存到学习档案。`,
    returnHref: context.returnHref,
  };
}

export function buildLearningEvidenceAssignmentResponse(
  context: StudentFeedbackTaskContext,
  page: EvidenceTimelinePage,
) {
  return {
    assignmentContext: context,
    writeback: {
      status: context.supported && page.items.length > 0 ? 'available' : context.supported ? 'empty' : 'missing',
      target: context.completionTarget,
      itemCount: page.items.length,
      message: context.supported
        ? page.items.length > 0
          ? '已找到可用于反馈闭环的学习证据。'
          : '当前筛选下尚无可写回证据。'
        : '反馈任务不存在或暂不支持。',
    },
    ...page,
  };
}

export function hasFeedbackTaskQuery(query: FeedbackTaskQuery): boolean {
  return Boolean(firstQueryValue(query.assignment));
}

function resolveLifecycleState(
  status: string | null,
  action: string | null,
  intent: string | null,
): FeedbackTaskLifecycleState {
  if (status === 'written-back' || status === 'teacher-visible') return status;
  if (action === 'writeback') return 'completed';
  if (action === 'adopt') return 'adopted';
  if (intent === 'revise') return 'revising';
  if (
    status === 'returned' ||
    status === 'read' ||
    status === 'adopted' ||
    status === 'revising' ||
    status === 'completed' ||
    status === 'missing' ||
    status === 'unsupported'
  ) {
    return status;
  }
  if (status === 'actionable') return 'returned';
  return 'returned';
}

function buildFeedbackTaskSummary(context: Omit<StudentFeedbackTaskContext, 'summary' | 'badges'>): string {
  if (!context.supported) {
    return `反馈任务不存在：${context.assignmentId}。请返回报告反馈页刷新任务，或联系教师重新发送。`;
  }
  const criterion = context.criterionLabel ? `，量规项为${context.criterionLabel}` : '';
  return `${context.assignmentTitle}${criterion}，当前状态为${STATE_LABELS[context.lifecycleState]}。`;
}

function buildFeedbackTaskBadges(context: Omit<StudentFeedbackTaskContext, 'badges'>): string[] {
  return [
    `反馈任务：${context.assignmentTitle}`,
    context.criterionLabel ? `量规项：${context.criterionLabel}` : null,
    `状态：${STATE_LABELS[context.lifecycleState]}`,
    context.teacherIntervention ? context.teacherIntervention.label : null,
    context.source ? `来源：${context.source}` : null,
  ].filter((item): item is string => Boolean(item));
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  return value;
}

function firstQueryValue(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length > 0 ? normalized : null;
}
