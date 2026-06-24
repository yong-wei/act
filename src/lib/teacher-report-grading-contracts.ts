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

export interface TeacherReportDeliveryQuery {
  action: TeacherReportDeliveryAction | 'unsupported' | null;
  reportId: string;
  versionId: string;
  format: string;
  studentId: string | null;
  returnTo: string;
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
    reportId,
    versionId: version ?? `${classId}:${reportId}:latest`,
    format: firstQueryValue(input.format) ?? 'json',
    studentId: firstQueryValue(input.studentId),
    returnTo: resolveTeacherReturnTo(input.returnTo, `/teacher/classes/${classId}/analytics-v2`),
  };
}

export function buildTeacherReportDeliveryState(query: TeacherReportDeliveryQuery): AuditedActionState | null {
  if (!query.action) return null;
  const identity: AuditedActionIdentity = {
    id: `teacher-report:${query.action}:${query.reportId}`,
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
    });
  }
  if ((query.action === 'send' || query.action === 'deliver') && isMissingIdentifier(query.studentId)) {
    return createAuditedActionState({
      identity,
      status: 'blocked',
      message: `无法交付报告：学生 ${query.studentId} 不存在或不在当前教师可见范围。`,
      recoveryAction: '回到班级学生列表选择有效学生',
      httpStatus: 404,
    });
  }
  if (query.action === 'export' || query.action === 'download') {
    return createAuditedActionState({
      identity,
      status: 'pending',
      message: `报告 ${query.versionId} 已准备导出为 ${query.format.toUpperCase()}。`,
      nextAction: '使用固定交付动作区下载报告文件',
    });
  }
  if (query.action === 'lock') {
    return createAuditedActionState({
      identity,
      status: 'blocked',
      message: `报告 ${query.versionId} 需要生成稳定版本后才能锁定。`,
      recoveryAction: '先导出或刷新报告，再锁定交付版本',
    });
  }
  return createAuditedActionState({
    identity,
    status: 'pending',
    message: `报告 ${query.versionId} 已保留 ${query.action} 上下文。`,
    nextAction: '确认报告版本后继续交付流程',
  });
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
