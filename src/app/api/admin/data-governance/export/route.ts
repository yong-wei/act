import { NextResponse, type NextRequest } from 'next/server';
import writeXlsxFile from 'write-excel-file/node';

import { requireAdminSession } from '@/lib/admin';
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
} from '@/lib/admin-operation-ledger';
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime';
import { toCsv } from '@/lib/csv-export';
import { prisma } from '@/lib/prisma';

type ExportFormat = 'json' | 'csv' | 'xlsx';

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = normalizeFormat(searchParams.get('format'));
  const risks = await prisma.studentRiskFlag.findMany({
    where: { isResolved: false },
    orderBy: { triggeredAt: 'desc' },
    take: 5000,
    select: {
      id: true,
      userId: true,
      flagType: true,
      severity: true,
      description: true,
      triggeredAt: true,
      isResolved: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
  const generatedAt = new Date().toISOString();
  const filename = `data-governance-risks-${generatedAt.slice(0, 10)}.${format}`;
  const rows = risks.map((risk) => ({
    id: risk.id,
    userId: risk.userId,
    userName: risk.user.name || risk.user.email || risk.userId.slice(0, 8),
    flagType: risk.flagType,
    severity: risk.severity,
    description: risk.description,
    triggeredAt: risk.triggeredAt.toISOString(),
    isResolved: risk.isResolved,
  }));
  const operationLedger = buildAdminOperationLedgerEntry({
    kind: 'admin-governance-export',
    actorId: session.user.id,
    actorRole: session.user.role,
    scope: `admin-data-governance-export:${format}`,
    startedAt: generatedAt,
    completedAt: generatedAt,
    outcome: 'export-ready',
    idempotencyKey: buildAdminOperationIdempotencyKey([
      'admin-governance-export',
      format,
      rows.length,
      session.user.id,
      generatedAt.slice(0, 10),
    ]),
    artifactRefs: [{
      id: `admin-governance-export:${filename}`,
      kind: 'export',
      label: '数据治理风险导出',
      authorizedRoles: ['ADMIN'],
      piiMinimized: false,
      rowCount: rows.length,
      revocable: true,
    }],
    rollback: {
      available: false,
      rationale: '治理风险导出不修改系统状态，无需回滚。',
    },
    auditSummary: `治理风险导出已生成：${rows.length} 条未解决风险。`,
    recoveryState: {
      status: 'available',
      action: '下载文件并归档审计记录',
    },
  });
  await persistAdminOperationLedger(operationLedger);

  if (format === 'json') {
    return new NextResponse(JSON.stringify({
      generatedAt,
      actorId: session.user.id,
      risks: rows,
      operationLedger,
      auditRecord: {
        actorId: session.user.id,
        action: 'export',
        outcome: 'export-ready',
        operationId: operationLedger.operationId,
        idempotencyKey: operationLedger.idempotencyKey,
        recordedAt: generatedAt,
      },
    }, null, 2), {
      status: 200,
      headers: exportHeaders(filename, 'application/json; charset=utf-8', rows.length, operationLedger),
    });
  }

  const table = [
    ['id', 'userId', 'userName', 'flagType', 'severity', 'description', 'triggeredAt', 'isResolved'],
    ...rows.map((risk) => [
      risk.id,
      risk.userId,
      risk.userName,
      risk.flagType,
      risk.severity,
      risk.description,
      risk.triggeredAt,
      String(risk.isResolved),
    ]),
  ];

  if (format === 'csv') {
    return new NextResponse(toCsv(table), {
      status: 200,
      headers: exportHeaders(filename, 'text/csv; charset=utf-8', rows.length, operationLedger),
    });
  }

  const buffer = await writeXlsxFile(table, { sheet: '治理风险' }).toBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: exportHeaders(
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      rows.length,
      operationLedger,
    ),
  });
}

function normalizeFormat(value: string | null): ExportFormat {
  return value === 'csv' || value === 'xlsx' ? value : 'json';
}

function exportHeaders(
  filename: string,
  contentType: string,
  count: number,
  operationLedger: ReturnType<typeof buildAdminOperationLedgerEntry>,
) {
  return {
    'content-type': contentType,
    'content-disposition': `attachment; filename="${filename}"`,
    'x-export-filename': filename,
    'x-export-count': String(count),
    ...operationLedgerHeaders(operationLedger),
  };
}
