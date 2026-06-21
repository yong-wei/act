import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { requireAdminSession } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

type GovernanceAction = 'resolve' | 'assign';

type GovernanceAuditRecord = {
  actorId: string;
  action: GovernanceAction;
  riskId: string;
  assignee: string | null;
  outcome: 'resolved' | 'assigned';
  undoAvailable: boolean;
  recordedAt: string;
};

export async function POST(
  request: Request,
  props: { params: Promise<{ riskId: string }> },
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { riskId } = await props.params;
  const payload = await request.json().catch(() => null) as {
    action?: string;
    assignee?: string | null;
    note?: string | null;
  } | null;
  const action = payload?.action === 'assign' || payload?.action === 'resolve'
    ? payload.action
    : null;
  if (!action) {
    return NextResponse.json({ error: '治理动作无效' }, { status: 400 });
  }

  const risk = await prisma.studentRiskFlag.findUnique({
    where: { id: riskId },
    select: {
      id: true,
      userId: true,
      isResolved: true,
      evidenceJson: true,
    },
  });
  if (!risk) {
    return NextResponse.json({ error: '治理风险不存在' }, { status: 404 });
  }
  if (risk.isResolved) {
    return NextResponse.json({ error: '治理风险已解决，不能继续提交治理动作' }, { status: 409 });
  }

  const assignee = typeof payload?.assignee === 'string' && payload.assignee.trim()
    ? payload.assignee.trim()
    : null;
  if (action === 'assign') {
    if (!assignee) {
      return NextResponse.json({ error: '缺少负责人' }, { status: 400 });
    }
    const assigneeUser = await prisma.user.findUnique({
      where: { id: assignee },
      select: { id: true },
    });
    if (!assigneeUser) {
      return NextResponse.json({ error: '负责人不存在' }, { status: 404 });
    }
  }

  const now = new Date();
  const auditRecord: GovernanceAuditRecord = {
    actorId: session.user.id,
    action,
    riskId,
    assignee,
    outcome: action === 'resolve' ? 'resolved' : 'assigned',
    undoAvailable: false,
    recordedAt: now.toISOString(),
  };
  try {
    const updated = await withGovernanceAuditRetry(() => prisma.$transaction(async (tx) => {
      const currentRisk = await tx.studentRiskFlag.findUnique({
        where: { id: risk.id },
        select: {
          isResolved: true,
          evidenceJson: true,
        },
      });
      if (!currentRisk) {
        throw new Error('治理风险不存在');
      }
      if (currentRisk.isResolved) {
        throw new GovernanceActionConflictError('治理风险已解决，不能继续提交治理动作');
      }
      const evidenceJson = appendGovernanceAudit(currentRisk.evidenceJson, auditRecord);

      return tx.studentRiskFlag.update({
        where: { id: riskId },
        data: action === 'resolve'
          ? {
              isResolved: true,
              resolvedAt: now,
              resolutionNote: payload?.note?.trim() || '管理员从数据治理工作台标记处理',
              evidenceJson,
            }
          : {
              evidenceJson,
            },
        select: {
          id: true,
          userId: true,
          isResolved: true,
          resolvedAt: true,
          resolutionNote: true,
          evidenceJson: true,
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }));

    return NextResponse.json({
      ok: true,
      risk: updated,
      auditRecord,
    });
  } catch (error) {
    if (error instanceof GovernanceActionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

function appendGovernanceAudit(
  evidenceJson: Prisma.JsonValue,
  auditRecord: GovernanceAuditRecord,
): Prisma.InputJsonValue {
  const base = evidenceJson && typeof evidenceJson === 'object' && !Array.isArray(evidenceJson)
    ? evidenceJson as Record<string, unknown>
    : {};
  const governance = base.adminGovernance
    && typeof base.adminGovernance === 'object'
    && !Array.isArray(base.adminGovernance)
    ? base.adminGovernance as Record<string, unknown>
    : {};
  const auditLog = Array.isArray(governance.auditLog)
    ? governance.auditLog
    : [];

  return {
    ...base,
    adminGovernance: {
      ...governance,
      currentAssignee: auditRecord.assignee ?? governance.currentAssignee ?? null,
      auditLog: [...auditLog, auditRecord],
    },
  } as Prisma.InputJsonValue;
}

async function withGovernanceAuditRetry<T>(operation: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt < 2 && isSerializableWriteConflict(error)) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('治理审计写入失败');
}

function isSerializableWriteConflict(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2034';
}

class GovernanceActionConflictError extends Error {}
