import { describe, expect, it } from 'vitest';

import {
  buildGovernanceActionContract,
  type GovernanceRiskSummary,
} from '../admin-governance-action-contract';
import { resolveGovernanceRouteRiskActionTarget } from '../data-governance-dashboard';

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
  },
];

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

  it('marks governance export as a scoped downloadable audit object', () => {
    const contract = buildGovernanceActionContract({
      query: { action: 'export', format: 'xlsx' },
      risks,
      actorId: 'admin-1',
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    expect(contract.state).toMatchObject({
      status: 'succeeded',
      message: '治理风险导出请求已生成，文件由服务端按未解决风险范围生成。',
      downloadFilename: 'data-governance-risks-2026-06-21.xlsx',
    });
    expect(contract.auditRecord).toMatchObject({
      action: 'export',
      outcome: 'export-ready',
      undoAvailable: false,
    });
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
});
