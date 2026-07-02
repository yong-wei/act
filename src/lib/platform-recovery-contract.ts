import { createAuditedActionState, type AuditedActionState } from '@/lib/action-status-contract';

export type PlatformRecoveryKind =
  | 'invalid-object-route'
  | 'missing-object'
  | 'permission-boundary'
  | 'classroom-code-error'
  | 'stale-object'
  | 'no-match'
  | 'unsupported-method'
  | 'password-validation'
  | 'recovery-action'
  | 'storage-unavailable';

export interface PlatformRecoveryInput {
  kind: PlatformRecoveryKind;
  sourceRoute: string;
  targetLabel: string;
  displayReference?: string | null;
  message?: string;
  recoveryAction?: string;
  nextAction?: string;
}

const RECOVERY_DEFAULTS: Record<PlatformRecoveryKind, {
  status: AuditedActionState['status'];
  message: (targetLabel: string) => string;
  recoveryAction: string;
}> = {
  'invalid-object-route': {
    status: 'blocked',
    message: (targetLabel) => `${targetLabel}参数无法识别。`,
    recoveryAction: '检查链接或返回来源页面重新进入',
  },
  'missing-object': {
    status: 'blocked',
    message: (targetLabel) => `${targetLabel}不存在或当前账号不可见。`,
    recoveryAction: '返回列表并刷新数据',
  },
  'permission-boundary': {
    status: 'blocked',
    message: (targetLabel) => `当前账号不能访问该${targetLabel}。`,
    recoveryAction: '切换有权限账号或返回工作台',
  },
  'classroom-code-error': {
    status: 'failed',
    message: (targetLabel) => `${targetLabel}未通过校验。`,
    recoveryAction: '核对教师提供的加入码后重试',
  },
  'stale-object': {
    status: 'blocked',
    message: (targetLabel) => `${targetLabel}已过期或不再可用。`,
    recoveryAction: '返回来源页面并刷新最新状态',
  },
  'no-match': {
    status: 'blocked',
    message: (targetLabel) => `没有找到匹配的${targetLabel}。`,
    recoveryAction: '调整筛选条件后重试',
  },
  'unsupported-method': {
    status: 'blocked',
    message: (targetLabel) => `${targetLabel}不支持当前操作方法。`,
    recoveryAction: '返回页面使用支持的操作入口',
  },
  'password-validation': {
    status: 'failed',
    message: () => '密码未通过校验。',
    recoveryAction: '按页面要求修改密码后重试',
  },
  'recovery-action': {
    status: 'succeeded',
    message: (targetLabel) => `${targetLabel}恢复动作已执行。`,
    recoveryAction: '继续当前流程',
  },
  'storage-unavailable': {
    status: 'blocked',
    message: (targetLabel) => `${targetLabel}存储暂不可用。`,
    recoveryAction: '完成存储初始化后重试',
  },
};

export function buildPlatformRecoveryState(input: PlatformRecoveryInput): AuditedActionState {
  const defaults = RECOVERY_DEFAULTS[input.kind];

  return createAuditedActionState({
    identity: {
      id: `platform-recovery:${input.kind}:${input.sourceRoute}`,
      category: 'unsupported-action',
      label: input.targetLabel,
      sourceRoute: input.sourceRoute,
    },
    status: defaults.status,
    message: input.message ?? defaults.message(input.targetLabel),
    recoveryAction: input.recoveryAction ?? defaults.recoveryAction,
    nextAction: input.nextAction,
    displayReference: normalizeDisplayReference(input.displayReference),
    recoveryKind: input.kind,
  });
}

function normalizeDisplayReference(reference: string | null | undefined): string | undefined {
  const value = reference?.trim().replace(/\s+/g, ' ');
  if (!value) return undefined;
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}
