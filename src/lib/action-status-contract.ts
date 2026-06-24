export type AuditedActionCategory =
  | 'submit'
  | 'save'
  | 'filter'
  | 'export'
  | 'download'
  | 'send'
  | 'approve'
  | 'writeback'
  | 'model-test'
  | 'governance-resolve'
  | 'governance-assign';

export type AuditedActionStatus =
  | 'idle'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'unsupported';

export type AuditedActionSeverity = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface AuditedActionIdentity {
  id: string;
  category: AuditedActionCategory | 'unsupported-action';
  label: string;
  sourceRoute: string;
  targetId?: string | null;
  requestedAction?: string | null;
}

export interface AuditedActionState {
  identity: AuditedActionIdentity;
  status: AuditedActionStatus;
  message: string;
  recoveryAction?: string;
  nextAction?: string;
  announcement: string;
  severity: AuditedActionSeverity;
  httpStatus?: number;
  downloadFilename?: string;
}

export interface RouteActionQueryInput {
  action?: string | string[] | null;
  targetId?: string | string[] | null;
  sourceRoute: string;
}

export interface ApiActionResultInput {
  identity: AuditedActionIdentity;
  ok: boolean;
  status: number;
  error?: unknown;
  successMessage?: string;
  filename?: string | null;
}

export const AUDITED_ACTION_CATEGORIES: readonly AuditedActionCategory[] = [
  'submit',
  'save',
  'filter',
  'export',
  'download',
  'send',
  'approve',
  'writeback',
  'model-test',
  'governance-resolve',
  'governance-assign',
];

const ACTION_LABELS: Record<AuditedActionCategory, string> = {
  submit: '提交',
  save: '保存',
  filter: '筛选',
  export: '导出',
  download: '下载',
  send: '发送',
  approve: '审批',
  writeback: '写回',
  'model-test': '模型测试',
  'governance-resolve': '治理处置',
  'governance-assign': '治理分派',
};

const ROUTE_ACTION_ALIASES: Readonly<Record<string, AuditedActionCategory>> = {
  test: 'model-test',
  resolve: 'governance-resolve',
  assign: 'governance-assign',
};

export function isAuditedActionCategory(value: unknown): value is AuditedActionCategory {
  return typeof value === 'string' && AUDITED_ACTION_CATEGORIES.includes(value as AuditedActionCategory);
}

export function createAuditedActionState(input: {
  identity: AuditedActionIdentity;
  status: AuditedActionStatus;
  message: string;
  recoveryAction?: string;
  nextAction?: string;
  httpStatus?: number;
  downloadFilename?: string | null;
}): AuditedActionState {
  const severity = severityForActionStatus(input.status, input.httpStatus);
  const announcement = buildActionAnnouncement({
    label: input.identity.label,
    status: input.status,
    message: input.message,
    filename: input.downloadFilename,
  });

  return {
    identity: input.identity,
    status: input.status,
    message: input.message,
    recoveryAction: input.recoveryAction,
    nextAction: input.nextAction,
    announcement,
    severity,
    httpStatus: input.httpStatus,
    downloadFilename: input.downloadFilename ?? undefined,
  };
}

export function parseRouteActionQuery(input: RouteActionQueryInput): AuditedActionState | null {
  const action = firstQueryValue(input.action);
  if (!action) return null;

  const category = normalizeRouteActionCategory(action);
  if (!category) {
    return createAuditedActionState({
      identity: {
        id: `route-action:${action}`,
        category: 'unsupported-action',
        label: '路由动作',
        sourceRoute: input.sourceRoute,
        targetId: firstQueryValue(input.targetId),
        requestedAction: action,
      },
      status: 'unsupported',
      message: `当前页面不支持动作参数 ${action}。`,
      recoveryAction: '返回页面默认状态',
    });
  }

  return createAuditedActionState({
    identity: {
      id: `route-action:${action}`,
      category,
      label: ACTION_LABELS[category],
      sourceRoute: input.sourceRoute,
      targetId: firstQueryValue(input.targetId),
      requestedAction: action,
    },
    status: 'pending',
    message: `${ACTION_LABELS[category]}动作已进入处理队列。`,
    nextAction: '等待页面展示处理结果',
  });
}

export function mapApiActionResult(input: ApiActionResultInput): AuditedActionState {
  if (input.ok) {
    if (requiresObservableDownload(input.identity.category) && !input.filename) {
      return createAuditedActionState({
        identity: input.identity,
        status: 'blocked',
        message: `${input.identity.label}缺少可验证的下载文件名。`,
        recoveryAction: '显示下载失败状态并重新生成文件',
        httpStatus: input.status,
      });
    }

    return createAuditedActionState({
      identity: input.identity,
      status: 'succeeded',
      message: input.successMessage ?? `${input.identity.label}已完成。`,
      nextAction: input.filename ? '查看下载文件' : '继续当前流程',
      httpStatus: input.status,
      downloadFilename: input.filename,
    });
  }

  const mapped = mapHttpStatusToActionFailure(input.status, input.error);
  return createAuditedActionState({
    identity: input.identity,
    status: mapped.status,
    message: mapped.message,
    recoveryAction: mapped.recoveryAction,
    httpStatus: input.status,
  });
}

export function mapHttpStatusToActionFailure(
  status: number,
  error?: unknown,
): Pick<AuditedActionState, 'status' | 'message' | 'recoveryAction'> {
  const detail = extractErrorMessage(error);
  if (status === 400) {
    return {
      status: 'failed',
      message: detail ?? '提交内容未通过校验。',
      recoveryAction: '检查输入后重试',
    };
  }
  if (status === 401) {
    return {
      status: 'blocked',
      message: detail ?? '登录状态已失效或尚未登录。',
      recoveryAction: '登录后回到当前页面重试',
    };
  }
  if (status === 403) {
    return {
      status: 'blocked',
      message: detail ?? '当前账号没有执行该动作的权限。',
      recoveryAction: '切换有权限的账号或返回工作台',
    };
  }
  if (status === 404) {
    return {
      status: 'blocked',
      message: detail ?? '目标对象不存在或已被移除。',
      recoveryAction: '返回列表并刷新数据',
    };
  }
  if (status === 405) {
    return {
      status: 'unsupported',
      message: detail ?? '当前入口不支持该操作方式。',
      recoveryAction: '返回页面提供的操作入口',
    };
  }
  return {
    status: 'failed',
    message: detail ?? '动作处理失败。',
    recoveryAction: '稍后重试或联系管理员',
  };
}

function severityForActionStatus(status: AuditedActionStatus, httpStatus?: number): AuditedActionSeverity {
  if (status === 'succeeded') return 'success';
  if (status === 'pending') return 'info';
  if (status === 'blocked' || status === 'unsupported') return 'warning';
  if (status === 'failed' || (httpStatus && httpStatus >= 500)) return 'danger';
  return 'neutral';
}

function buildActionAnnouncement(input: {
  label: string;
  status: AuditedActionStatus;
  message: string;
  filename?: string | null;
}) {
  const filename = input.filename ? ` 文件：${input.filename}。` : '';
  return `${input.label}${statusLabel(input.status)}：${input.message}${filename}`;
}

function statusLabel(status: AuditedActionStatus) {
  const labels: Record<AuditedActionStatus, string> = {
    idle: '未开始',
    pending: '处理中',
    succeeded: '已完成',
    failed: '失败',
    blocked: '被阻断',
    unsupported: '不支持',
  };
  return labels[status];
}

function firstQueryValue(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeRouteActionCategory(action: string): AuditedActionCategory | null {
  if (isAuditedActionCategory(action)) return action;
  return ROUTE_ACTION_ALIASES[action] ?? null;
}

function requiresObservableDownload(category: AuditedActionIdentity['category']): boolean {
  return category === 'download' || category === 'export';
}

function extractErrorMessage(error: unknown): string | null {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return null;
  if ('error' in error && typeof error.error === 'string') return error.error;
  if ('message' in error && typeof error.message === 'string') return error.message;
  return null;
}
