import { createAuditedActionState, type AuditedActionIdentity, type AuditedActionState } from '@/lib/action-status-contract';
import { resolveScopedReturnTarget, type ReturnTargetParam } from '@/lib/navigation-return-target';

export type TeacherReportDeliveryAction =
  | 'export'
  | 'download'
  | 'send'
  | 'deliver'
  | 'lock'
  | 'summary'
  | 'reinforcement';

export type TeacherReportDeliveryLedgerStatus =
  | 'draft'
  | 'ready'
  | 'exported'
  | 'sent'
  | 'copied'
  | 'blocked'
  | 'missing-context'
  | 'degraded'
  | 'unavailable';

export type TeacherReportDeliverySurface =
  | 'teacher-home'
  | 'class-analytics'
  | 'history'
  | 'classroom-review'
  | 'report-book';

export type TeacherReportDeliveryRecipientScope = 'class' | 'student' | 'teacher-review' | 'none';

export interface TeacherReportDeliveryQuery {
  action: TeacherReportDeliveryAction | 'unsupported' | null;
  surface: TeacherReportDeliverySurface;
  reportId: string;
  versionId: string;
  format: string;
  studentId: string | null;
  classId: string;
  sessionId: string | null;
  lessonId: string | null;
  actorId: string | null;
  actorRole: string;
  recipientScope: TeacherReportDeliveryRecipientScope;
  returnTo: string;
}

export interface TeacherReportDeliveryLedgerEntry {
  surface: TeacherReportDeliverySurface;
  reportId: string;
  reportType: string;
  classId: string | null;
  sessionId: string | null;
  lessonId: string | null;
  actorId: string | null;
  actorRole: string;
  action: TeacherReportDeliveryAction | 'unsupported';
  actionId: string;
  idempotencyKey: string;
  actionTimestamp: string;
  recipientScope: TeacherReportDeliveryRecipientScope;
  deliveryScope: string;
  deliveryStatus: TeacherReportDeliveryLedgerStatus;
  exportState: TeacherReportDeliveryLedgerStatus;
  sendState: TeacherReportDeliveryLedgerStatus;
  copySummaryState: TeacherReportDeliveryLedgerStatus;
  studentHandoffState: TeacherReportDeliveryLedgerStatus;
  artifactRef: string;
  redactionPolicy: 'student-safe-summary-only';
  studentSafeSummary: string;
  recoveryAction?: string;
}

export interface TeacherGradingRouteQuery {
  gradingRunId: string | null;
  action: string | null;
  method: string | null;
  status: string | null;
  classId: string | null;
  studentId: string | null;
  assignment: string | null;
  returnTo: string;
}

const REPORT_ACTIONS: readonly TeacherReportDeliveryAction[] = [
  'export',
  'download',
  'send',
  'deliver',
  'lock',
  'summary',
  'reinforcement',
];

export function normalizeTeacherReportDeliveryQuery(input: {
  action?: string | string[] | null;
  report?: string | string[] | null;
  reportId?: string | string[] | null;
  version?: string | string[] | null;
  format?: string | string[] | null;
  studentId?: string | string[] | null;
  sessionId?: string | string[] | null;
  lessonId?: string | string[] | null;
  actorId?: string | string[] | null;
  actorRole?: string | string[] | null;
  recipientScope?: string | string[] | null;
  surface?: string | string[] | null;
  returnTo?: ReturnTargetParam | null;
}, classId: string): TeacherReportDeliveryQuery {
  const action = firstQueryValue(input.action);
  const normalizedAction = action && REPORT_ACTIONS.includes(action as TeacherReportDeliveryAction)
    ? action as TeacherReportDeliveryAction
    : action
      ? 'unsupported'
      : null;
  const requestedReportId = firstQueryValue(input.reportId) ?? firstQueryValue(input.report);
  const reportId = requestedReportId === 'control-correction' ? requestedReportId : 'control-correction';
  const version = firstQueryValue(input.version);
  return {
    action: normalizedAction,
    surface: normalizeDeliverySurface(firstQueryValue(input.surface)),
    reportId,
    versionId: version ?? `${classId}:${reportId}:latest`,
    format: firstQueryValue(input.format) ?? 'json',
    studentId: firstQueryValue(input.studentId),
    classId,
    sessionId: firstQueryValue(input.sessionId),
    lessonId: firstQueryValue(input.lessonId),
    actorId: firstQueryValue(input.actorId),
    actorRole: firstQueryValue(input.actorRole) ?? 'teacher',
    recipientScope: normalizeRecipientScope(firstQueryValue(input.recipientScope), firstQueryValue(input.studentId)),
    returnTo: resolveTeacherReturnTo(input.returnTo, `/teacher/classes/${classId}/analytics-v2`),
  };
}

export function buildTeacherReportDeliveryState(query: TeacherReportDeliveryQuery): AuditedActionState | null {
  if (!query.action) return null;
  const ledgerEntry = buildTeacherReportDeliveryLedgerEntry({
    query,
    surface: query.surface,
  });
  const identity: AuditedActionIdentity = {
    id: ledgerEntry.actionId,
    category: getReportDeliveryCategory(query.action),
    label: '教师报告交付',
    sourceRoute: query.returnTo,
    targetId: query.studentId ?? query.reportId,
    requestedAction: query.action,
  };
  if (query.action === 'unsupported') {
    return createAuditedActionState({
      identity,
      status: 'unsupported',
      message: '当前教师报告链接包含不支持的交付动作。',
      recoveryAction: '使用页面固定交付动作区重新选择操作',
      displayReference: ledgerEntry.artifactRef,
    });
  }
  if (ledgerEntry.deliveryStatus === 'missing-context') {
    return createAuditedActionState({
      identity,
      status: 'blocked',
      message: ledgerEntry.studentSafeSummary,
      recoveryAction: ledgerEntry.recoveryAction ?? '回到班级学生列表选择有效对象',
      httpStatus: 404,
      displayReference: ledgerEntry.artifactRef,
    });
  }
  if (query.action === 'export' || query.action === 'download') {
    return createAuditedActionState({
      identity,
      status: 'pending',
      message: `报告 ${query.versionId} 已准备导出为 ${query.format.toUpperCase()}。`,
      nextAction: '使用固定交付动作区下载报告文件',
      displayReference: ledgerEntry.artifactRef,
    });
  }
  if (query.action === 'lock') {
    return createAuditedActionState({
      identity,
      status: 'blocked',
      message: `报告 ${query.versionId} 需要生成稳定版本后才能锁定。`,
      recoveryAction: '先导出或刷新报告，再锁定交付版本',
      displayReference: ledgerEntry.artifactRef,
    });
  }
  if (ledgerEntry.deliveryStatus === 'blocked') {
    return createAuditedActionState({
      identity,
      status: 'blocked',
      message: ledgerEntry.studentSafeSummary,
      recoveryAction: ledgerEntry.recoveryAction ?? '回到班级学生列表选择有效对象',
      httpStatus: 404,
      displayReference: ledgerEntry.artifactRef,
    });
  }
  return createAuditedActionState({
    identity,
    status: 'pending',
    message: `报告 ${query.versionId} 已保留 ${query.action} 上下文。`,
    nextAction: '确认报告版本后继续交付流程',
    displayReference: ledgerEntry.artifactRef,
  });
}

export function buildTeacherReportDeliveryLedgerEntry(input: {
  query: TeacherReportDeliveryQuery;
  surface: TeacherReportDeliverySurface;
  now?: Date;
  reportType?: string;
  studentSafeSummary?: string;
}): TeacherReportDeliveryLedgerEntry {
  const { query } = input;
  const action = query.action ?? 'export';
  const surface = input.surface ?? query.surface;
  const reportType = input.reportType ?? 'class-session-summary';
  const timestamp = (input.now ?? new Date()).toISOString();
  const missingContext = !query.classId || isMissingIdentifier(query.classId) || (
    (action === 'send' || action === 'deliver') && isMissingIdentifier(query.studentId)
  );
  const deliveryStatus = getDeliveryLedgerStatus(action, missingContext);
  const deliveryScope = query.studentId
    ? `student:${opaqueRef(query.studentId)}`
    : `class:${opaqueRef(query.classId)}`;
  const artifactRef = `teacher-report-artifact:${opaqueRef(`${query.reportId}:${query.versionId}`)}`;
  const actionId = `teacher-report:${surface}:${action}:${opaqueRef(query.reportId)}`;
  const idempotencyKey = `teacher-report-idempotency:${opaqueRef([
    surface,
    query.classId || 'missing-class',
    query.sessionId || 'missing-session',
    query.lessonId || 'missing-lesson',
    query.reportId,
    action,
  ].join(':'))}`;
  const fallbackSummary = missingContext
    ? `无法交付报告：${query.studentId ? `学生 ${query.studentId}` : '班级或课堂'} 不存在或不在当前教师可见范围。`
    : `教师报告 ${query.reportId} 已进入 ${action} 交付账本，范围为 ${query.recipientScope}。`;

  return {
    surface,
    reportId: query.reportId,
    reportType,
    classId: query.classId || null,
    sessionId: query.sessionId,
    lessonId: query.lessonId,
    actorId: query.actorId,
    actorRole: query.actorRole,
    action,
    actionId,
    idempotencyKey,
    actionTimestamp: timestamp,
    recipientScope: query.recipientScope,
    deliveryScope,
    deliveryStatus,
    exportState: action === 'export' || action === 'download' ? deliveryStatus : 'ready',
    sendState: action === 'send' || action === 'deliver' ? deliveryStatus : 'draft',
    copySummaryState: action === 'summary' ? deliveryStatus : 'ready',
    studentHandoffState: action === 'reinforcement' ? deliveryStatus : 'draft',
    artifactRef,
    redactionPolicy: 'student-safe-summary-only',
    studentSafeSummary: input.studentSafeSummary ?? fallbackSummary,
    recoveryAction: missingContext ? '回到班级、课堂历史或学生列表选择有效上下文' : undefined,
  };
}

export function buildTeacherReportDeliveryHref(input: {
  classId: string | null | undefined;
  action?: TeacherReportDeliveryAction;
  reportId?: string;
  sessionId?: string | null;
  lessonId?: string | null;
  studentId?: string | null;
  surface?: TeacherReportDeliverySurface;
  returnTo?: string;
}) {
  const classId = input.classId && !isMissingIdentifier(input.classId) ? input.classId : null;
  if (!classId) return '/teacher/classes';
  const params = new URLSearchParams({
    action: input.action ?? 'export',
    report: input.reportId ?? 'control-correction',
    surface: input.surface ?? 'class-analytics',
    returnTo: input.returnTo ?? '/teacher',
  });
  if (input.sessionId) params.set('sessionId', input.sessionId);
  if (input.lessonId) params.set('lessonId', input.lessonId);
  if (input.studentId) params.set('studentId', input.studentId);
  return `/teacher/classes/${classId}/analytics-v2?${params.toString()}`;
}

export function normalizeTeacherGradingRouteQuery(input: {
  gradingRunId?: string | string[] | null;
  action?: string | string[] | null;
  method?: string | string[] | null;
  status?: string | string[] | null;
  classId?: string | string[] | null;
  studentId?: string | string[] | null;
  assignment?: string | string[] | null;
  returnTo?: ReturnTargetParam | null;
}): TeacherGradingRouteQuery {
  return {
    gradingRunId: firstQueryValue(input.gradingRunId),
    action: firstQueryValue(input.action),
    method: firstQueryValue(input.method),
    status: firstQueryValue(input.status),
    classId: firstQueryValue(input.classId),
    studentId: firstQueryValue(input.studentId),
    assignment: firstQueryValue(input.assignment),
    returnTo: resolveTeacherReturnTo(input.returnTo, '/teacher/grading-workbench'),
  };
}

export function buildTeacherGradingRouteState(query: TeacherGradingRouteQuery): AuditedActionState | null {
  const requestedAction = query.action ?? query.method ?? query.status;
  if (!requestedAction && !query.gradingRunId && !query.assignment) return null;
  const identity: AuditedActionIdentity = {
    id: `teacher-grading:${query.gradingRunId ?? query.assignment ?? requestedAction ?? 'empty'}`,
    category: getGradingActionCategory(requestedAction),
    label: '报告评分工作台',
    sourceRoute: query.returnTo,
    targetId: query.gradingRunId ?? query.studentId ?? query.assignment,
    requestedAction,
  };
  if (query.method && query.method.toLowerCase() === 'get') {
    return createAuditedActionState({
      identity,
      status: 'unsupported',
      message: '文档评分提交和写回预览 API 不支持从当前工作台直接 GET 调用。',
      recoveryAction: '通过评分草稿标识打开工作台，或从提交列表创建草稿',
      httpStatus: 405,
    });
  }
  if (isMissingIdentifier(query.gradingRunId)) {
    return createAuditedActionState({
      identity,
      status: 'blocked',
      message: `评分运行 ${query.gradingRunId} 不存在或当前教师不可见。`,
      recoveryAction: '返回报告账本或提交列表选择有效评分草稿',
      httpStatus: 404,
    });
  }
  if (!query.gradingRunId && (query.action === 'approve' || query.action === 'writeback')) {
    return createAuditedActionState({
      identity,
      status: 'blocked',
      message: '审批或写回需要明确的评分运行标识。',
      recoveryAction: '从学生提交生成评分草稿后再审批',
      httpStatus: 400,
    });
  }
  if (query.status === 'draft' || query.assignment) {
    return createAuditedActionState({
      identity,
      status: 'pending',
      message: query.assignment
        ? `正在等待 ${query.assignment} 的评分草稿。`
        : '当前评分草稿处于待审批状态。',
      nextAction: '打开有效 gradingRunId 后审批或返回学生修改',
    });
  }
  return null;
}

export function buildTeacherGradingMissingRunState(query: TeacherGradingRouteQuery): AuditedActionState {
  return createAuditedActionState({
    identity: {
      id: `teacher-grading:${query.gradingRunId ?? 'missing'}`,
      category: 'writeback',
      label: '报告评分工作台',
      sourceRoute: query.returnTo,
      targetId: query.gradingRunId,
      requestedAction: query.action ?? query.method ?? query.status ?? 'open',
    },
    status: 'blocked',
    message: `评分运行 ${query.gradingRunId ?? '未指定'} 不存在或当前教师不可见。`,
    recoveryAction: '返回报告账本或提交列表选择有效评分草稿',
    httpStatus: 404,
  });
}

export function resolveTeacherReturnTo(value: ReturnTargetParam | null | undefined, fallback: string) {
  return resolveScopedReturnTarget(value ?? undefined, fallback, ['/teacher']);
}

function firstQueryValue(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isMissingIdentifier(value: string | null | undefined) {
  return typeof value === 'string' && value.toLowerCase().startsWith('missing');
}

function normalizeRecipientScope(
  value: string | null,
  studentId: string | null,
): TeacherReportDeliveryRecipientScope {
  if (value === 'class' || value === 'student' || value === 'teacher-review' || value === 'none') return value;
  return studentId ? 'student' : 'class';
}

function normalizeDeliverySurface(value: string | null): TeacherReportDeliverySurface {
  if (
    value === 'teacher-home'
    || value === 'class-analytics'
    || value === 'history'
    || value === 'classroom-review'
    || value === 'report-book'
  ) {
    return value;
  }
  return 'class-analytics';
}

function getDeliveryLedgerStatus(
  action: TeacherReportDeliveryAction | 'unsupported',
  missingContext: boolean,
): TeacherReportDeliveryLedgerStatus {
  if (missingContext) return 'missing-context';
  if (action === 'unsupported') return 'blocked';
  if (action === 'export' || action === 'download') return 'ready';
  if (action === 'send' || action === 'deliver' || action === 'summary') return 'ready';
  if (action === 'reinforcement') return 'degraded';
  if (action === 'lock') return 'blocked';
  return 'ready';
}

function opaqueRef(value: string | null | undefined) {
  const source = value && value.trim() ? value.trim() : 'missing';
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ref-${(hash >>> 0).toString(36).padStart(7, '0')}`;
}

function getReportDeliveryCategory(action: TeacherReportDeliveryQuery['action']) {
  if (action === 'export' || action === 'download') return 'export';
  if (action === 'send' || action === 'deliver') return 'send';
  if (action === 'lock' || action === 'summary' || action === 'reinforcement') return 'save';
  return 'unsupported-action';
}

function getGradingActionCategory(action: string | null | undefined) {
  if (action === 'approve') return 'approve';
  if (action === 'writeback') return 'writeback';
  return 'unsupported-action';
}
