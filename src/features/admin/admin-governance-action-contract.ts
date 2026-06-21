import { createAuditedActionState, type AuditedActionState } from '@/lib/action-status-contract';

export type GovernanceRiskSummary = {
  id: string;
  userId: string;
  userName: string;
  flagType: string;
  severity: string;
  description: string;
  triggeredAt: string;
  isResolved: boolean;
};

export type GovernanceActionQuery = {
  action?: string | null;
  riskId?: string | null;
  assignee?: string | null;
  format?: string | null;
};

export type GovernanceActionAuditRecord = {
  actorId: string;
  action: string;
  riskId: string | null;
  assignee: string | null;
  outcome: 'ready' | 'missing-risk' | 'missing-assignee' | 'export-ready' | 'unsupported' | 'resolved' | 'assigned';
  undoAvailable: boolean;
  recordedAt: string;
};

export type GovernanceActionContract = {
  state: AuditedActionState | null;
  auditRecord: GovernanceActionAuditRecord | null;
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
          id: `admin-governance-export:${format}`,
          category: 'export',
          label: '治理风险导出',
          sourceRoute: '/admin/data-governance',
          requestedAction: action,
        },
        status: 'succeeded',
        message: '治理风险导出请求已生成，文件由服务端按未解决风险范围生成。',
        nextAction: '下载文件并留存审计记录',
        downloadFilename: filename,
      }),
      auditRecord: {
        actorId: input.actorId,
        action,
        riskId: null,
        assignee: null,
        outcome: 'export-ready',
        undoAvailable: false,
        recordedAt,
      },
    };
  }

  if (action === 'resolve' || action === 'assign') {
    if (!riskId) {
      return {
        state: governanceBlockedState(action, null, '缺少风险 ID，无法定位要处置的治理对象。', '返回风险列表选择具体风险'),
        auditRecord: audit(input.actorId, action, null, assignee, 'missing-risk', false, recordedAt),
      };
    }

    const risk = input.risks.find((item) => item.id === riskId);
    if (!risk) {
      return {
        state: governanceBlockedState(action, riskId, `未找到风险 ${riskId}，它可能已经解决、被删除或不在当前筛选范围内。`, '返回风险列表并刷新数据'),
        auditRecord: audit(input.actorId, action, riskId, assignee, 'missing-risk', false, recordedAt),
      };
    }

    if (action === 'assign' && !assignee) {
      return {
        state: governanceBlockedState(action, riskId, `风险 ${riskId} 存在，但缺少负责人，不能完成分派。`, '选择负责人后重新分派'),
        auditRecord: audit(input.actorId, action, riskId, assignee, 'missing-assignee', false, recordedAt),
      };
    }

    return {
      state: createAuditedActionState({
        identity: {
          id: `admin-governance-${action}:${riskId}`,
          category: action === 'assign' ? 'governance-assign' : 'governance-resolve',
          label: action === 'assign' ? '治理分派' : '治理处置',
          sourceRoute: '/admin/data-governance',
          targetId: riskId,
          requestedAction: action,
        },
        status: 'pending',
        message: action === 'assign'
          ? `风险 ${riskId} 已定位，负责人：${assignee}。请提交分派以保存审计记录。`
          : `风险 ${riskId} 已定位，关联学生：${risk.userName}。请提交处置以保存结果。`,
        nextAction: action === 'assign' ? '提交分派动作' : '提交处置动作',
      }),
      auditRecord: null,
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

function normalizeExportFormat(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'xlsx' || normalized === 'csv' ? normalized : 'json';
}

function governanceBlockedState(action: 'resolve' | 'assign', riskId: string | null, message: string, recoveryAction: string) {
  return createAuditedActionState({
    identity: {
      id: `admin-governance-${action}:${riskId ?? 'missing'}`,
      category: action === 'assign' ? 'governance-assign' : 'governance-resolve',
      label: action === 'assign' ? '治理分派' : '治理处置',
      sourceRoute: '/admin/data-governance',
      targetId: riskId,
      requestedAction: action,
    },
    status: 'blocked',
    message,
    recoveryAction,
    httpStatus: 404,
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
): GovernanceActionAuditRecord {
  return {
    actorId,
    action,
    riskId,
    assignee,
    outcome,
    undoAvailable,
    recordedAt,
  };
}
