import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildGovernanceActionContract,
  type GovernanceRiskSummary,
} from '../admin-governance-action-contract';
import {
  graphCenterAuditInitialTab,
  normalizeGraphCenterAuditContext,
  resolveGovernanceRouteRiskActionTarget,
} from '../data-governance-dashboard';

const risks: GovernanceRiskSummary[] = [
  {
    id: 'risk-1',
    userId: 'student-1',
    userName: '张三',
    flagType: 'participation',
    severity: 'high',
    description: '参与度不足',
    triggeredAt: '2026-06-21T08:00:00.000Z',
    isResolved: false,
    safeLabel: '张三 · participation · high',
    affectedObjectLabel: 'student:student-1',
    evidenceHref: '/admin/data-governance?tab=risks&riskId=risk-1&action=evidence',
    currentAssignee: null,
    dispositionStatus: 'open',
    auditTrail: [],
  },
  {
    id: 'risk-2',
    userId: 'student-2',
    userName: '李四',
    flagType: 'stagnation',
    severity: 'medium',
    description: '能力停滞',
    triggeredAt: '2026-06-20T08:00:00.000Z',
    isResolved: true,
    resolvedAt: '2026-06-21T08:00:00.000Z',
    resolutionNote: '已人工复核',
    dispositionStatus: 'resolved',
    auditTrail: [
      {
        actorId: 'admin-1',
        action: 'resolve',
        riskId: 'risk-2',
        assignee: null,
        outcome: 'resolved',
        undoAvailable: true,
        recordedAt: '2026-06-21T08:00:00.000Z',
      },
    ],
  },
];

const dataGovernanceDashboardSource = readFileSync(
  join(process.cwd(), 'src/features/admin/data-governance-dashboard.tsx'),
  'utf8',
);

describe('admin governance action contract', () => {
  it('blocks missing risk resolve with an auditable recovery state', () => {
    const contract = buildGovernanceActionContract({
      query: { action: 'resolve', riskId: 'missing-risk' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(contract.state).toMatchObject({
      status: 'blocked',
      identity: {
        id: 'admin-governance-resolve:missing-risk',
        category: 'governance-resolve',
        targetId: 'missing-risk',
      },
    });
    expect(contract.auditRecord).toMatchObject({
      actorId: 'admin-1',
      action: 'resolve',
      riskId: 'missing-risk',
      outcome: 'missing-risk',
      undoAvailable: false,
    });
  });

  it('blocks assign when a valid risk has no assignee', () => {
    const contract = buildGovernanceActionContract({
      query: { action: 'assign', riskId: 'risk-1' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(contract.state).toMatchObject({
      status: 'blocked',
      httpStatus: 400,
      identity: {
        category: 'governance-assign',
        targetId: 'risk-1',
      },
    });
    expect(contract.auditRecord).toMatchObject({
      outcome: 'missing-assignee',
      assignee: null,
    });
  });

  it('reports already handled before missing assignee for stale assign links', () => {
    const contract = buildGovernanceActionContract({
      query: { action: 'assign', riskId: 'risk-2' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(contract.state).toMatchObject({
      status: 'blocked',
      httpStatus: 409,
      recoveryAction: '查看审计记录，或使用重开/撤销恢复为待处理',
      identity: {
        category: 'governance-assign',
        targetId: 'risk-2',
      },
    });
    expect(contract.auditRecord).toMatchObject({
      outcome: 'already-handled',
      assignee: null,
      undoAvailable: true,
      previousState: 'resolved',
      affectedObject: 'student-2',
    });
  });

  it('keeps valid resolve links pending until the API persists the action', () => {
    const contract = buildGovernanceActionContract({
      query: { action: 'resolve', riskId: 'risk-1' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(contract.state).toMatchObject({
      status: 'pending',
      identity: {
        category: 'governance-resolve',
        targetId: 'risk-1',
      },
    });
    expect(contract.auditRecord).toBeNull();
  });

  it('keeps ignore links pending and blocks duplicate handled dispositions', () => {
    const pending = buildGovernanceActionContract({
      query: { action: 'ignore', riskId: 'risk-1' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });
    const handled = buildGovernanceActionContract({
      query: { action: 'resolve', riskId: 'risk-2' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(pending.state).toMatchObject({
      status: 'pending',
      identity: {
        category: 'governance-ignore',
        targetId: 'risk-1',
      },
    });
    expect(handled.state).toMatchObject({
      status: 'blocked',
      recoveryAction: '查看审计记录，或使用重开/撤销恢复为待处理',
    });
    expect(handled.auditRecord).toMatchObject({
      outcome: 'already-handled',
      undoAvailable: true,
      previousState: 'resolved',
      affectedObject: 'student-2',
    });
  });

  it('opens reopen and undo intents only for handled risks', () => {
    const reopen = buildGovernanceActionContract({
      query: { action: 'reopen', riskId: 'risk-2' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });
    const openUndo = buildGovernanceActionContract({
      query: { action: 'undo', riskId: 'risk-1' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(reopen.state).toMatchObject({
      status: 'pending',
      identity: {
        category: 'governance-reopen',
        targetId: 'risk-2',
      },
    });
    expect(openUndo.state).toMatchObject({
      status: 'blocked',
      identity: {
        category: 'governance-undo',
        targetId: 'risk-1',
      },
    });
    expect(openUndo.auditRecord).toMatchObject({
      outcome: 'already-open',
      undoAvailable: false,
    });
  });

  it('blocks undo deep links when the handled risk has no undoable disposition', () => {
    const contract = buildGovernanceActionContract({
      query: { action: 'undo', riskId: 'risk-2' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(contract.state).toMatchObject({
      status: 'blocked',
      message: '风险 risk-2 没有可撤销的处置记录。',
      identity: {
        category: 'governance-undo',
        targetId: 'risk-2',
      },
    });
    expect(contract.auditRecord).toMatchObject({
      outcome: 'undo-unavailable',
      undoAvailable: false,
    });
  });

  it('treats evidence links as URL-only risk context instead of unsupported actions', () => {
    const contract = buildGovernanceActionContract({
      query: { action: 'evidence', riskId: 'risk-1' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(contract.state).toMatchObject({
      status: 'succeeded',
      identity: {
        category: 'governance-evidence',
        targetId: 'risk-1',
        requestedAction: 'evidence',
      },
    });
    expect(contract.auditRecord).toMatchObject({
      action: 'evidence',
      outcome: 'evidence-ready',
      affectedObject: 'student:student-1',
    });
  });

  it('blocks missing evidence links with a recovery state', () => {
    const contract = buildGovernanceActionContract({
      query: { action: 'evidence', riskId: 'missing-risk' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(contract.state).toMatchObject({
      status: 'blocked',
      identity: {
        category: 'governance-evidence',
        targetId: 'missing-risk',
      },
    });
    expect(contract.auditRecord).toMatchObject({
      outcome: 'missing-risk',
    });
  });

  it('marks governance export as a scoped downloadable audit object', () => {
    const contract = buildGovernanceActionContract({
      query: { action: 'export', format: 'xlsx' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(contract.state).toMatchObject({
      status: 'succeeded',
      message: '治理风险导出请求已就绪，文件和操作账本 ID 将由服务端下载响应返回。',
      identity: {
        id: 'admin-governance-export-request:xlsx:2026-06-21',
      },
      downloadFilename: 'data-governance-risks-2026-06-21.xlsx',
    });
    expect(contract.state?.displayReference).toBeUndefined();
    expect(contract.auditRecord).toMatchObject({
      action: 'export',
      outcome: 'export-ready',
      undoAvailable: false,
      retentionPolicy: 'admin-operation-ledger-30d',
    });
    expect(contract.auditRecord?.operationId).toBeUndefined();
    expect(contract.auditRecord?.idempotencyKey).toBeUndefined();
  });

  it('resolves route action targets from target and recent risk collections', () => {
    const targetRisk = {
      ...risks[0],
      id: 'target-risk',
    };

    expect(resolveGovernanceRouteRiskActionTarget({
      targetRiskFlag: targetRisk,
      recentRiskFlags: risks,
    }, 'target-risk')).toEqual(targetRisk);
    expect(resolveGovernanceRouteRiskActionTarget({
      targetRiskFlag: null,
      recentRiskFlags: risks,
    }, ' risk-1 ')).toEqual(risks[0]);
    expect(resolveGovernanceRouteRiskActionTarget({
      targetRiskFlag: null,
      recentRiskFlags: risks,
    }, 'missing-risk')).toBeNull();
  });

  it('maps Graph Center governance audit links to concrete dashboard tabs', () => {
    expect(normalizeGraphCenterAuditContext('resource-binding')).toBe('resource-binding');
    expect(normalizeGraphCenterAuditContext('citation-readiness')).toBe('citation-readiness');
    expect(normalizeGraphCenterAuditContext('overlay-limitations')).toBe('overlay-limitations');
    expect(normalizeGraphCenterAuditContext('new-audit')).toBe('custom');
    expect(graphCenterAuditInitialTab('resource-binding')).toBe('sources');
    expect(graphCenterAuditInitialTab('citation-readiness')).toBe('sources');
    expect(graphCenterAuditInitialTab('overlay-limitations')).toBe('cache');
    expect(graphCenterAuditInitialTab('custom')).toBe('overview');
  });

  it('keeps governance dashboard tabs, status updates, and risk tables accessible on mobile', () => {
    expect(dataGovernanceDashboardSource).toContain('data-admin-governance-status');
    expect(dataGovernanceDashboardSource).toContain("initialActionQuery?.tab === 'risks'");
    expect(dataGovernanceDashboardSource).toContain('data-admin-risk-governance-row');
    expect(dataGovernanceDashboardSource).toContain('data-admin-risk-governance-evidence');
    expect(dataGovernanceDashboardSource).toContain('data-admin-risk-governance-evidence-state');
    expect(dataGovernanceDashboardSource).toContain('data-admin-risk-governance-assignment');
    expect(dataGovernanceDashboardSource).toContain('data-admin-risk-governance-disposition-action="ignore"');
    expect(dataGovernanceDashboardSource).toContain('data-admin-risk-governance-disposition-action="reopen"');
    expect(dataGovernanceDashboardSource).toContain('data-admin-risk-governance-disposition-action="undo"');
    expect(dataGovernanceDashboardSource).toContain('data-admin-risk-governance-audit');
    expect(dataGovernanceDashboardSource).toContain('compactAdminIdentifier(record.actorId)');
    expect(dataGovernanceDashboardSource).toContain('操作者：{compactAdminIdentifier(visibleAuditRecord.actorId)}');
    expect(dataGovernanceDashboardSource).toContain('负责人：{compactAdminIdentifier(visibleAuditRecord.assignee)}');
    expect(dataGovernanceDashboardSource).toContain('risk.undoAvailable ? (');
    expect(dataGovernanceDashboardSource).toContain('function governanceFailureOutcome');
    expect(dataGovernanceDashboardSource).toContain("function isAssigneeFailure(message: string)");
    expect(dataGovernanceDashboardSource).toContain("message.includes('负责人不存在') || message.includes('缺少负责人')");
    expect(dataGovernanceDashboardSource).toContain("if (isAssigneeFailure(message)) return 'missing-assignee'");
    expect(dataGovernanceDashboardSource).toContain("if (isAssigneeFailure(message)) return '重新选择负责人后提交分派'");
    expect(dataGovernanceDashboardSource.indexOf("if (isAssigneeFailure(message)) return 'missing-assignee'"))
      .toBeLessThan(dataGovernanceDashboardSource.indexOf("if (responseStatus === 404) return 'missing-risk'"));
    expect(dataGovernanceDashboardSource.indexOf("if (isAssigneeFailure(message)) return '重新选择负责人后提交分派'"))
      .toBeLessThan(dataGovernanceDashboardSource.indexOf("if (responseStatus === 404) return '返回风险列表并刷新数据'"));
    expect(dataGovernanceDashboardSource).toContain("return 'undo-unavailable'");
    expect(dataGovernanceDashboardSource).toContain("return 'already-open'");
    expect(dataGovernanceDashboardSource).toContain('aria-pressed={activeTab === tab.id}');
    expect(dataGovernanceDashboardSource).toContain(`aria-current={activeTab === tab.id ? 'page' : undefined}`);
    expect(dataGovernanceDashboardSource).toContain('data-admin-mobile-cards="true"');
    expect(dataGovernanceDashboardSource).toContain('aria-label={`处置治理风险 ${risk.flagLabel} ${risk.userName}`}');
    expect(dataGovernanceDashboardSource).toContain('aria-label="刷新数据治理状态"');
    expect(dataGovernanceDashboardSource).toContain('const [refreshActionState, setRefreshActionState]');
    expect(dataGovernanceDashboardSource).toContain("category: 'refresh'");
    expect(dataGovernanceDashboardSource).toContain('function governanceRefreshStatusFromLedgerOutcome');
    expect(dataGovernanceDashboardSource).toContain("if (outcome === 'blocked') return 'blocked'");
    expect(dataGovernanceDashboardSource).toContain('<ActionStatusPanel state={refreshActionState} />');
    expect(dataGovernanceDashboardSource).toContain('function governanceActionStateFromLedger');
    expect(dataGovernanceDashboardSource).toContain('operationLedger?: AdminOperationLedgerEntry');
    expect(dataGovernanceDashboardSource).toContain('payload?.operationLedger');
    expect(dataGovernanceDashboardSource).toContain('去重键：{visibleAuditRecord.idempotencyKey ??');
    expect(dataGovernanceDashboardSource).toContain('保留策略：{visibleAuditRecord.retentionPolicy ??');
    expect(dataGovernanceDashboardSource).toContain("params.set('graphNodeId', initialActionQuery.graphNodeId.trim())");
    expect(dataGovernanceDashboardSource).toContain("params.set('audit', initialActionQuery.audit.trim())");
    expect(dataGovernanceDashboardSource).toContain('const [retainedRiskQuery, setRetainedRiskQuery]');
    expect(dataGovernanceDashboardSource).toContain("overrideQuery?: { riskId?: string | null; tab?: GovernanceDashboardTab | null }");
    expect(dataGovernanceDashboardSource).toContain("const requestedRiskId = overrideQuery?.riskId ?? retainedRiskQuery?.riskId ?? initialActionQuery?.riskId ?? ''");
    expect(dataGovernanceDashboardSource).toContain("const requestedTab = overrideQuery?.tab ?? retainedRiskQuery?.tab ?? initialActionQuery?.tab ?? ''");
    expect(dataGovernanceDashboardSource).toContain("setRetainedRiskQuery({ riskId: input.riskId, tab: 'risks' })");
    expect(dataGovernanceDashboardSource).toContain("setActiveTab('risks')");
    expect(dataGovernanceDashboardSource).toContain("fetchStatus(false, { riskId: input.riskId, tab: 'risks' })");
    expect(dataGovernanceDashboardSource).toContain('data-graph-center-preferred-tab');
    expect(dataGovernanceDashboardSource).toContain("status: responseStatus === 409 ? 'blocked' : 'failed'");
  });
});
