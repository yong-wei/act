import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { requireAdminSession } from '@/lib/admin';
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
  type AdminOperationKind,
} from '@/lib/admin-operation-ledger';
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime';
import { prisma } from '@/lib/prisma';
import {
  isGovernanceRiskAction,
  type GovernanceActionAuditRecord,
  type GovernanceRiskAction,
  type GovernanceRiskDispositionStatus,
} from '@/features/admin/admin-governance-action-contract';

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
  const action = payload?.action && isGovernanceRiskAction(payload.action)
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
      resolvedAt: true,
      resolutionNote: true,
      evidenceJson: true,
    },
  });
  if (!risk) {
    return NextResponse.json({ error: '治理风险不存在' }, { status: 404 });
  }
  const preflightConflict = conflictForAction(action, risk.isResolved);
  if (preflightConflict) {
    return NextResponse.json({ error: preflightConflict }, { status: 409 });
  }
  if (action === 'undo' && !hasUndoableDisposition(risk.evidenceJson)) {
    return NextResponse.json({ error: '治理风险没有可撤销的处置记录' }, { status: 409 });
  }

  const assignee = typeof payload?.assignee === 'string' && payload.assignee.trim()
    ? payload.assignee.trim()
    : null;
  const note = typeof payload?.note === 'string' && payload.note.trim()
    ? payload.note.trim()
    : null;
  const resolutionNote = note ?? defaultGovernanceNote(action);
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
  try {
    const result = await withGovernanceAuditRetry(() => prisma.$transaction(async (tx) => {
      const currentRisk = await tx.studentRiskFlag.findUnique({
        where: { id: risk.id },
        select: {
          isResolved: true,
          resolvedAt: true,
          resolutionNote: true,
          evidenceJson: true,
        },
      });
      if (!currentRisk) {
        throw new GovernanceRiskMissingError('治理风险不存在');
      }
      const conflict = conflictForAction(action, currentRisk.isResolved);
      if (conflict) {
        throw new GovernanceActionConflictError(conflict);
      }
      if (action === 'undo' && !hasUndoableDisposition(currentRisk.evidenceJson)) {
        throw new GovernanceActionConflictError('治理风险没有可撤销的处置记录');
      }
      const previousState = dispositionFromRisk(currentRisk.isResolved, currentRisk.resolutionNote, currentRisk.evidenceJson);
      const newState = nextDispositionForAction(action);
      const auditRecord = buildGovernanceAuditRecord({
        action,
        riskId,
        actorId: session.user.id,
        assignee,
        previousState,
        newState,
        note: resolutionNote,
        affectedObject: `student:${risk.userId}`,
        recordedAt: now.toISOString(),
      });
      const operationLedger = buildGovernanceOperationLedger({
        action,
        riskId,
        actorId: session.user.id,
        actorRole: session.user.role,
        assignee,
        resolutionNote,
        previousState,
        newState,
        recordedAt: auditRecord.recordedAt,
        auditRecord,
        currentEvidenceJson: currentRisk.evidenceJson,
      });
      const nextAuditRecord = {
        ...auditRecord,
        operationId: operationLedger.operationId,
        idempotencyKey: operationLedger.idempotencyKey,
        retentionPolicy: operationLedger.retentionPolicy.policy,
      };
      const evidenceJson = appendGovernanceAudit(currentRisk.evidenceJson, nextAuditRecord);

      const updatedRisk = await tx.studentRiskFlag.update({
        where: { id: riskId },
        data: updateDataForAction(action, now, resolutionNote, evidenceJson),
        select: {
          id: true,
          userId: true,
          isResolved: true,
          resolvedAt: true,
          resolutionNote: true,
          evidenceJson: true,
        },
      });
      await persistAdminOperationLedger(operationLedger, [], tx);

      return {
        updatedRisk,
        auditRecord: nextAuditRecord,
        operationLedger,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }));

    return NextResponse.json({
      ok: true,
      risk: result.updatedRisk,
      auditRecord: result.auditRecord,
      operationLedger: result.operationLedger,
    }, {
      headers: operationLedgerHeaders(result.operationLedger),
    });
  } catch (error) {
    if (error instanceof GovernanceRiskMissingError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof GovernanceActionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

function conflictForAction(action: GovernanceRiskAction, isResolved: boolean) {
  if ((action === 'assign' || action === 'resolve' || action === 'ignore') && isResolved) {
    return '治理风险已解决，不能继续提交治理动作';
  }
  if ((action === 'reopen' || action === 'undo') && !isResolved) {
    return '治理风险仍处于待处理状态，无需重新打开';
  }
  return null;
}

function defaultGovernanceNote(action: GovernanceRiskAction) {
  if (action === 'ignore') return '管理员从数据治理工作台忽略该风险';
  if (action === 'reopen') return '管理员从数据治理工作台重新打开该风险';
  if (action === 'undo') return '管理员从数据治理工作台撤销上一次处置';
  return '管理员从数据治理工作台标记处理';
}

function dispositionFromRisk(
  isResolved: boolean,
  resolutionNote: string | null | undefined,
  evidenceJson: Prisma.JsonValue,
): GovernanceRiskDispositionStatus {
  const lastDisposition = readGovernanceLastDisposition(evidenceJson);
  if (isResolved && (lastDisposition === 'ignored' || lastDisposition === 'resolved')) {
    return lastDisposition;
  }
  if (!isResolved && lastDisposition === 'open') {
    return 'open';
  }
  const auditLog = readGovernanceAuditLog(evidenceJson);
  const latestDisposition = [...auditLog].reverse().find((item) => (
    item.action === 'resolve'
    || item.action === 'ignore'
    || item.action === 'reopen'
    || item.action === 'undo'
  ));
  if (!isResolved) return 'open';
  if (latestDisposition?.action === 'ignore' || latestDisposition?.outcome === 'ignored') return 'ignored';
  if (resolutionNote?.includes('忽略')) return 'ignored';
  return 'resolved';
}

function readGovernanceLastDisposition(evidenceJson: Prisma.JsonValue): GovernanceRiskDispositionStatus | null {
  const base = evidenceJson && typeof evidenceJson === 'object' && !Array.isArray(evidenceJson)
    ? evidenceJson as Record<string, unknown>
    : {};
  const governance = base.adminGovernance
    && typeof base.adminGovernance === 'object'
    && !Array.isArray(base.adminGovernance)
    ? base.adminGovernance as Record<string, unknown>
    : {};
  const value = governance.lastDisposition;
  return value === 'open' || value === 'resolved' || value === 'ignored' ? value : null;
}

function hasUndoableDisposition(evidenceJson: Prisma.JsonValue): boolean {
  const auditLog = readGovernanceAuditLog(evidenceJson);
  const latestDisposition = [...auditLog].reverse().find((item) => (
    item.action === 'resolve'
    || item.action === 'ignore'
    || item.action === 'reopen'
    || item.action === 'undo'
  ));
  return Boolean(
    latestDisposition
    && (latestDisposition.action === 'resolve' || latestDisposition.action === 'ignore')
    && latestDisposition.undoAvailable === true
  );
}

function nextDispositionForAction(action: GovernanceRiskAction): GovernanceRiskDispositionStatus {
  if (action === 'ignore') return 'ignored';
  if (action === 'reopen' || action === 'undo') return 'open';
  if (action === 'resolve') return 'resolved';
  return 'open';
}

function buildGovernanceAuditRecord(input: {
  action: GovernanceRiskAction;
  riskId: string;
  actorId: string;
  assignee: string | null;
  previousState: GovernanceRiskDispositionStatus;
  newState: GovernanceRiskDispositionStatus;
  note: string;
  affectedObject: string;
  recordedAt: string;
}): GovernanceActionAuditRecord {
  return {
    actorId: input.actorId,
    action: input.action,
    riskId: input.riskId,
    assignee: input.assignee,
    outcome: outcomeForAction(input.action),
    undoAvailable: input.action === 'resolve' || input.action === 'ignore',
    previousState: input.previousState,
    newState: input.newState,
    note: input.note,
    affectedObject: input.affectedObject,
    recordedAt: input.recordedAt,
  };
}

function outcomeForAction(action: GovernanceRiskAction): GovernanceActionAuditRecord['outcome'] {
  if (action === 'assign') return 'assigned';
  if (action === 'ignore') return 'ignored';
  if (action === 'reopen') return 'reopened';
  if (action === 'undo') return 'undone';
  return 'resolved';
}

function updateDataForAction(
  action: GovernanceRiskAction,
  now: Date,
  resolutionNote: string,
  evidenceJson: Prisma.InputJsonValue,
) {
  if (action === 'resolve' || action === 'ignore') {
    return {
      isResolved: true,
      resolvedAt: now,
      resolutionNote,
      evidenceJson,
    };
  }
  if (action === 'reopen' || action === 'undo') {
    return {
      isResolved: false,
      resolvedAt: null,
      resolutionNote: null,
      evidenceJson,
    };
  }
  return {
    evidenceJson,
  };
}

function buildGovernanceOperationLedger(input: {
  action: GovernanceRiskAction;
  riskId: string;
  actorId: string;
  actorRole: string;
  assignee: string | null;
  resolutionNote: string;
  previousState: GovernanceRiskDispositionStatus;
  newState: GovernanceRiskDispositionStatus;
  recordedAt: string;
  auditRecord: GovernanceActionAuditRecord;
  currentEvidenceJson: Prisma.JsonValue;
}) {
  const auditLog = readGovernanceAuditLog(input.currentEvidenceJson);
  const latestRecord = auditLog.at(-1) ?? null;
  const replayRecord = latestRecord && isSameGovernanceAction(latestRecord, input.auditRecord)
    ? latestRecord
    : null;
  const baseKeyParts = [
    'admin-governance-action',
    input.action,
    input.riskId,
    input.actorId,
    input.assignee ?? '',
    input.action === 'resolve' || input.action === 'ignore' || input.action === 'reopen' || input.action === 'undo'
      ? input.resolutionNote
      : '',
    input.previousState,
    input.newState,
  ];
  const baseIdempotencyKey = buildAdminOperationIdempotencyKey(baseKeyParts);
  const hasEarlierMatchingAction = auditLog.some((item) => (
    isSameGovernanceAction(item, input.auditRecord)
  ));
  const idempotencyKey = typeof replayRecord?.idempotencyKey === 'string'
    ? replayRecord.idempotencyKey
    : hasEarlierMatchingAction && latestRecord
      ? buildAdminOperationIdempotencyKey([
          ...baseKeyParts,
          'after',
          latestRecord.idempotencyKey ?? latestRecord.recordedAt,
        ])
      : baseIdempotencyKey;

  return buildAdminOperationLedgerEntry({
    kind: governanceOperationKind(input.action),
    actorId: input.actorId,
    actorRole: input.actorRole,
    scope: `admin-governance-${input.action}:${input.riskId}`,
    startedAt: input.recordedAt,
    completedAt: input.recordedAt,
    outcome: 'completed',
    idempotencyKey,
    rollback: {
      available: input.action === 'resolve' || input.action === 'ignore',
      rationale: input.action === 'resolve' || input.action === 'ignore'
        ? '可通过重开或撤销动作恢复为待处理状态。'
        : '该治理动作通过后续显式动作修正，不提供隐式自动回滚。',
    },
    auditSummary: governanceAuditSummary(input.action, input.riskId, input.assignee),
    recoveryState: {
      status: 'available',
      action: '刷新治理列表并复核风险状态',
    },
  });
}

function governanceOperationKind(action: GovernanceRiskAction): AdminOperationKind {
  return `admin-governance-${action}`;
}

function governanceAuditSummary(action: GovernanceRiskAction, riskId: string, assignee: string | null) {
  if (action === 'assign') return `治理风险 ${riskId} 已分派给 ${assignee}。`;
  if (action === 'ignore') return `治理风险 ${riskId} 已由管理员忽略。`;
  if (action === 'reopen') return `治理风险 ${riskId} 已重新打开。`;
  if (action === 'undo') return `治理风险 ${riskId} 已撤销处置并恢复待处理。`;
  return `治理风险 ${riskId} 已由管理员标记处理。`;
}

function readGovernanceAuditLog(evidenceJson: Prisma.JsonValue): GovernanceActionAuditRecord[] {
  const base = evidenceJson && typeof evidenceJson === 'object' && !Array.isArray(evidenceJson)
    ? evidenceJson as Record<string, unknown>
    : {};
  const governance = base.adminGovernance
    && typeof base.adminGovernance === 'object'
    && !Array.isArray(base.adminGovernance)
    ? base.adminGovernance as Record<string, unknown>
    : {};
  return Array.isArray(governance.auditLog)
    ? governance.auditLog.filter(isGovernanceAuditRecord)
    : [];
}

function isGovernanceAuditRecord(value: unknown): value is GovernanceActionAuditRecord {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).actorId === 'string'
    && typeof (value as Record<string, unknown>).action === 'string'
    && typeof (value as Record<string, unknown>).riskId === 'string'
    && typeof (value as Record<string, unknown>).recordedAt === 'string'
  );
}

function isSameGovernanceAction(left: GovernanceActionAuditRecord, right: GovernanceActionAuditRecord): boolean {
  return left.actorId === right.actorId
    && left.action === right.action
    && left.riskId === right.riskId
    && (left.assignee ?? null) === (right.assignee ?? null)
    && (left.note ?? null) === (right.note ?? null)
    && (left.previousState ?? null) === (right.previousState ?? null)
    && (left.newState ?? null) === (right.newState ?? null);
}

function appendGovernanceAudit(
  evidenceJson: Prisma.JsonValue,
  auditRecord: GovernanceActionAuditRecord,
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
  const normalizedAuditLog = auditRecord.action === 'reopen' || auditRecord.action === 'undo'
    ? auditLog.map((item) => (
        item
        && typeof item === 'object'
        && !Array.isArray(item)
        && (item as Record<string, unknown>).undoAvailable === true
          ? { ...item, undoAvailable: false }
          : item
      ))
    : auditLog;
  const existingAuditRecord = auditRecord.idempotencyKey
    ? normalizedAuditLog.find((item) => (
        item
        && typeof item === 'object'
        && !Array.isArray(item)
        && (item as Record<string, unknown>).idempotencyKey === auditRecord.idempotencyKey
      ))
    : null;
  const nextAuditLog = existingAuditRecord ? normalizedAuditLog : [...normalizedAuditLog, auditRecord];
  const nextAssignee = auditRecord.action === 'assign' && !existingAuditRecord
    ? auditRecord.assignee
    : governance.currentAssignee ?? null;

  return {
    ...base,
    adminGovernance: {
      ...governance,
      currentAssignee: nextAssignee,
      lastDisposition: auditRecord.newState ?? governance.lastDisposition ?? null,
      auditLog: nextAuditLog,
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
class GovernanceRiskMissingError extends Error {}
