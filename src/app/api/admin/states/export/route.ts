import { NextRequest, NextResponse } from 'next/server';

import { requireAdminSession } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
} from '@/lib/admin-operation-ledger';
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime';
import { adminStatesMockData } from '@/features/admin/states/stats-data';
import { buildSystemUsageData, type SystemUsageData } from '@/features/admin/states/system-usage-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const source = request.nextUrl.searchParams.get('source') === 'real' ? 'real' : 'demo';
  const format = request.nextUrl.searchParams.get('format') === 'json'
    ? 'json'
    : 'json';
  const data = source === 'real' ? await loadRealSystemUsageData() : adminStatesMockData;
  const totals = {
    interactionTotal: data.interactionByType.reduce((sum, item) => sum + item.count, 0),
    simulationVisitTotal: data.simulationVisits.reduce((sum, item) => sum + item.visits, 0),
  };
  const completedAt = new Date().toISOString();
  const filename = `admin-system-usage-${completedAt.slice(0, 10)}.${format}`;
  const idempotencyKey = buildAdminOperationIdempotencyKey([
    'admin-states-export',
    source,
    totals.interactionTotal,
    totals.simulationVisitTotal,
    session.user.id,
  ]);
  const operationLedger = buildAdminOperationLedgerEntry({
    kind: 'admin-states-export',
    actorId: session.user.id,
    actorRole: session.user.role,
    scope: `admin-states-${source}`,
    startedAt: completedAt,
    completedAt,
    outcome: 'export-ready',
    idempotencyKey,
    artifactRefs: [{
      id: `admin-states-export:${filename}`,
      kind: 'export',
      label: '系统使用量 JSON 导出',
      authorizedRoles: ['ADMIN'],
      piiMinimized: true,
      rowCount: data.monthlyTrend.length,
      revocable: true,
    }],
    rollback: {
      available: false,
      rationale: '系统使用量导出只生成只读文件，不修改业务数据，无需回滚。',
    },
    auditSummary: `系统使用量导出已生成：source=${source}，interactionTotal=${totals.interactionTotal}。`,
    recoveryState: {
      status: 'available',
      action: '下载文件并归档审计记录',
    },
  });
  await persistAdminOperationLedger(operationLedger);

  return new NextResponse(JSON.stringify({
    generatedAt: completedAt,
    actorId: session.user.id,
    source,
    data,
    operationLedger,
    auditRecord: {
      action: 'admin-states-export',
      outcome: 'export-ready',
      operationId: operationLedger.operationId,
      idempotencyKey,
      filename,
      format,
      retentionPolicy: operationLedger.retentionPolicy.policy,
    },
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'x-export-filename': filename,
      ...operationLedgerHeaders(operationLedger),
    },
  });
}

async function loadRealSystemUsageData(): Promise<SystemUsageData> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [
    students,
    teachers,
    admins,
    interactionLogs,
    simulationSessions,
    simulationLogs,
    learningFacts,
    llmSessions,
    ethicalLogCount,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'TEACHER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.interactionLog.findMany({
      where: { createdAt: { gte: start } },
      select: {
        userId: true,
        eventType: true,
        resourceKey: true,
        lessonKey: true,
        createdAt: true,
      },
    }),
    prisma.simulationSession.findMany({
      where: { createdAt: { gte: start } },
      select: {
        userId: true,
        simType: true,
        createdAt: true,
      },
    }),
    prisma.simulationLog.findMany({
      where: { createdAt: { gte: start } },
      select: {
        duration: true,
        inputParams: true,
        createdAt: true,
      },
    }),
    prisma.learningFact.findMany({
      where: { createdAt: { gte: start } },
      select: {
        factType: true,
        outcome: true,
        createdAt: true,
      },
    }),
    prisma.llmSession.findMany({
      where: { createdAt: { gte: start } },
      select: {
        userId: true,
        module: true,
        createdAt: true,
      },
    }),
    prisma.ethicalLog.count({
      where: { createdAt: { gte: start } },
    }),
  ]);

  return buildSystemUsageData({
    now,
    users: {
      students,
      teachers,
      admins,
    },
    interactionLogs,
    simulationSessions,
    simulationLogs,
    learningFacts,
    llmSessions,
    ethicalLogCount,
  });
}
