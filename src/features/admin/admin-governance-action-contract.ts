import { createAuditedActionState, type AuditedActionState } from '@/lib/action-status-contract';

export type GovernanceRiskAction = 'resolve' | 'assign' | 'ignore' | 'reopen' | 'undo';

export type GovernanceRiskDispositionStatus = 'open' | 'resolved' | 'ignored';

export type GovernanceRiskSummary = {
  id: string;
  userId: string;
  userName: string;
  flagType: string;
  severity: string;
  description: string;
  triggeredAt: string;
  isResolved: boolean;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  safeLabel?: string;
  affectedObjectLabel?: string;
  evidenceHref?: string;
  currentAssignee?: string | null;
  dispositionStatus?: GovernanceRiskDispositionStatus;
  undoAvailable?: boolean;
  auditTrail?: GovernanceActionAuditRecord[];
};

export type GovernanceActionQuery = {
  action?: string | null;
  riskId?: string | null;
  assignee?: string | null;
  format?: string | null;
  surface?: string | null;
  tab?: string | null;
  lessonPlanId?: string | null;
  graphNodeId?: string | null;
  audit?: string | null;
};

export type GovernanceActionAuditRecord = {
  actorId: string;
  action: string;
  riskId: string | null;
  assignee: string | null;
  outcome:
    | 'ready'
    | 'evidence-ready'
    | 'missing-risk'
    | 'missing-assignee'
    | 'already-handled'
    | 'already-open'
    | 'undo-unavailable'
    | 'export-ready'
    | 'unsupported'
    | 'resolved'
    | 'assigned'
    | 'ignored'
    | 'reopened'
    | 'undone';
  undoAvailable: boolean;
  previousState?: string | null;
  newState?: string | null;
  note?: string | null;
  affectedObject?: string | null;
  operationId?: string;
  idempotencyKey?: string;
  retentionPolicy?: string;
  recordedAt: string;
};

export type GovernanceActionContract = {
  state: AuditedActionState | null;
  auditRecord: GovernanceActionAuditRecord | null;
};

const ACTION_LABELS: Record<GovernanceRiskAction, string> = {
  resolve: '治理处置',
  assign: '治理分派',
  ignore: '治理忽略',
  reopen: '治理重开',
  undo: '治理撤销',
};

const ACTION_NEXT: Record<GovernanceRiskAction, string> = {
  resolve: '提交处置动作',
  assign: '提交分派动作',
  ignore: '提交忽略动作',
  reopen: '提交重开动作',
  undo: '提交撤销动作',
};

export function buildGovernanceActionContract(input: {
  query: GovernanceActionQuery | null | undefined;
  risks: readonly GovernanceRiskSummary[];
  actorId: string;
  now: Date;
}): GovernanceActionContract {
  const action = input.query?.action?.trim();
  if (!action) return { state: null, auditRecord: null };

  const riskId = input.query?.riskId?.trim() || null;
  const assignee = input.query?.assignee?.trim() || null;
  const recordedAt = input.now.toISOString();

  if (action === 'export') {
    const format = normalizeExportFormat(input.query?.format);
    const filename = `data-governance-risks-${recordedAt.slice(0, 10)}.${format}`;
    return {
      state: createAuditedActionState({
        identity: {
          id: `admin-governance-export-request:${format}:${recordedAt.slice(0, 10)}`,
          category: 'export',
          label: '治理风险导出',
          sourceRoute: '/admin/data-governance',
          requestedAction: action,
        },
        status: 'succeeded',
        message: '治理风险导出请求已就绪，文件和操作账本 ID 将由服务端下载响应返回。',
        nextAction: '下载文件并使用响应中的审计 ID 留存记录',
        downloadFilename: filename,
      }),
      auditRecord: {
        actorId: input.actorId,
        action,
        riskId: null,
        assignee: null,
        outcome: 'export-ready',
        undoAvailable: false,
        retentionPolicy: 'admin-operation-ledger-30d',
        recordedAt,
      },
    };
  }

  if (!isGovernanceRiskAction(action)) {
    if (action === 'evidence') {
      if (!riskId) {
        return {
          state: createAuditedActionState({
            identity: {
              id: 'admin-governance-evidence:missing',
              category: 'governance-evidence',
              label: '治理证据',
              sourceRoute: '/admin/data-governance',
              targetId: null,
              requestedAction: action,
            },
            status: 'blocked',
            message: '缺少风险 ID，无法定位治理风险证据。',
            recoveryAction: '返回风险列表选择具体风险',
            httpStatus: 404,
          }),
          auditRecord: audit(input.actorId, action, null, assignee, 'missing-risk', false, recordedAt),
        };
      }
      const risk = input.risks.find((item) => item.id === riskId);
      if (!risk) {
        return {
          state: createAuditedActionState({
            identity: {
              id: `admin-governance-evidence:${riskId}`,
              category: 'governance-evidence',
              label: '治理证据',
              sourceRoute: '/admin/data-governance',
              targetId: riskId,
              requestedAction: action,
            },
            status: 'blocked',
            message: `未找到风险 ${riskId} 的证据上下文。`,
            recoveryAction: '返回风险列表并刷新数据',
            httpStatus: 404,
          }),
          auditRecord: audit(input.actorId, action, riskId, assignee, 'missing-risk', false, recordedAt),
        };
      }
      return {
        state: createAuditedActionState({
          identity: {
            id: `admin-governance-evidence:${riskId}`,
            category: 'governance-evidence',
            label: '治理证据',
            sourceRoute: '/admin/data-governance',
            targetId: riskId,
            requestedAction: action,
          },
          status: 'succeeded',
          message: risk.auditTrail && risk.auditTrail.length > 0
            ? `风险 ${riskId} 的证据上下文已定位，可从审计记录回溯。`
            : `风险 ${riskId} 已定位，但暂无附加证据记录。`,
          nextAction: '复核风险行中的证据、负责人和审计记录',
        }),
        auditRecord: audit(input.actorId, action, riskId, assignee, 'evidence-ready', false, recordedAt, risk),
      };
    }

    return {
      state: createAuditedActionState({
        identity: {
          id: `admin-governance-action:${action}`,
          category: 'unsupported-action',
          label: '治理动作',
          sourceRoute: '/admin/data-governance',
          targetId: riskId,
          requestedAction: action,
        },
        status: 'unsupported',
        message: `数据治理页不支持动作参数 ${action}。`,
        recoveryAction: '返回治理看板默认状态',
      }),
      auditRecord: audit(input.actorId, action, riskId, assignee, 'unsupported', false, recordedAt),
    };
  }

  if (!riskId) {
    return {
      state: governanceBlockedState(action, null, '缺少风险 ID，无法定位要处置的治理对象。', '返回风险列表选择具体风险', 404),
      auditRecord: audit(input.actorId, action, null, assignee, 'missing-risk', false, recordedAt),
    };
  }

  const risk = input.risks.find((item) => item.id === riskId);
  if (!risk) {
    return {
      state: governanceBlockedState(action, riskId, `未找到风险 ${riskId}，它可能已删除或不在当前管理员可见范围内。`, '返回风险列表并刷新数据', 404),
      auditRecord: audit(input.actorId, action, riskId, assignee, 'missing-risk', false, recordedAt),
    };
  }

  const currentlyClosed = risk.isResolved || risk.dispositionStatus === 'resolved' || risk.dispositionStatus === 'ignored';
  if ((action === 'resolve' || action === 'assign' || action === 'ignore') && currentlyClosed) {
    return {
      state: governanceBlockedState(action, riskId, `风险 ${riskId} 已处理，不能重复提交 ${action} 动作。`, '查看审计记录，或使用重开/撤销恢复为待处理', 409),
      auditRecord: audit(input.actorId, action, riskId, assignee, 'already-handled', true, recordedAt, risk),
    };
  }

  if (action === 'assign' && !assignee) {
    return {
      state: governanceBlockedState(action, riskId, `风险 ${riskId} 存在，但缺少负责人，不能完成分派。`, '选择负责人后重新分派', 400),
      auditRecord: audit(input.actorId, action, riskId, assignee, 'missing-assignee', false, recordedAt, risk),
    };
  }

  if ((action === 'reopen' || action === 'undo') && !currentlyClosed) {
    return {
      state: governanceBlockedState(action, riskId, `风险 ${riskId} 仍处于待处理状态，无需执行 ${action}。`, '继续分派、处置或忽略该风险', 409),
      auditRecord: audit(input.actorId, action, riskId, assignee, 'already-open', false, recordedAt, risk),
    };
  }

  if (action === 'undo' && currentlyClosed && !risk.undoAvailable) {
    return {
      state: governanceBlockedState(action, riskId, `风险 ${riskId} 没有可撤销的处置记录。`, '查看审计记录，或使用重开恢复为待处理', 409),
      auditRecord: audit(input.actorId, action, riskId, assignee, 'undo-unavailable', false, recordedAt, risk),
    };
  }

  return {
    state: createAuditedActionState({
      identity: {
        id: `admin-governance-${action}:${riskId}`,
        category: governanceCategory(action),
        label: ACTION_LABELS[action],
        sourceRoute: '/admin/data-governance',
        targetId: riskId,
        requestedAction: action,
      },
      status: 'pending',
      message: governancePendingMessage(action, risk, assignee),
      nextAction: ACTION_NEXT[action],
    }),
    auditRecord: null,
  };
}

export function isGovernanceRiskAction(value: string): value is GovernanceRiskAction {
  return value === 'resolve'
    || value === 'assign'
    || value === 'ignore'
    || value === 'reopen'
    || value === 'undo';
}

export function governanceCategory(action: GovernanceRiskAction) {
  if (action === 'resolve') return 'governance-resolve';
  if (action === 'assign') return 'governance-assign';
  if (action === 'ignore') return 'governance-ignore';
  if (action === 'reopen') return 'governance-reopen';
  return 'governance-undo';
}

function normalizeExportFormat(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'xlsx' || normalized === 'csv' ? normalized : 'json';
}

function governancePendingMessage(action: GovernanceRiskAction, risk: GovernanceRiskSummary, assignee: string | null) {
  if (action === 'assign') {
    return `风险 ${risk.id} 已定位，负责人：${assignee}。请提交分派以保存审计记录。`;
  }
  if (action === 'reopen' || action === 'undo') {
    return `风险 ${risk.id} 已定位，当前状态：${risk.dispositionStatus ?? (risk.isResolved ? 'resolved' : 'open')}。请提交${action === 'reopen' ? '重开' : '撤销'}以恢复待处理状态。`;
  }
  if (action === 'ignore') {
    return `风险 ${risk.id} 已定位，关联学生：${risk.userName}。请提交忽略并保存审计记录。`;
  }
  return `风险 ${risk.id} 已定位，关联学生：${risk.userName}。请提交处置以保存结果。`;
}

function governanceBlockedState(
  action: GovernanceRiskAction,
  riskId: string | null,
  message: string,
  recoveryAction: string,
  httpStatus: number,
) {
  return createAuditedActionState({
    identity: {
      id: `admin-governance-${action}:${riskId ?? 'missing'}`,
      category: governanceCategory(action),
      label: ACTION_LABELS[action],
      sourceRoute: '/admin/data-governance',
      targetId: riskId,
      requestedAction: action,
    },
    status: 'blocked',
    message,
    recoveryAction,
    httpStatus,
  });
}

function audit(
  actorId: string,
  action: string,
  riskId: string | null,
  assignee: string | null,
  outcome: GovernanceActionAuditRecord['outcome'],
  undoAvailable: boolean,
  recordedAt: string,
  risk?: GovernanceRiskSummary,
): GovernanceActionAuditRecord {
  return {
    actorId,
    action,
    riskId,
    assignee,
    outcome,
    undoAvailable,
    previousState: risk?.dispositionStatus ?? (risk?.isResolved ? 'resolved' : risk ? 'open' : null),
    newState: outcome,
    affectedObject: risk?.affectedObjectLabel ?? risk?.userId ?? null,
    recordedAt,
  };
}
