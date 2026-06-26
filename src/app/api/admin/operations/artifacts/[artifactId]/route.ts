import { NextResponse, type NextRequest } from 'next/server';

import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
  type PiiMinimizedFailedImportRow,
} from '@/lib/admin-operation-ledger';
import {
  loadAuthorizedAdminOperationArtifact,
  persistAdminOperationLedger,
} from '@/lib/admin-operation-ledger-runtime';
import { requireAdminSession } from '@/lib/admin';
import { toCsv } from '@/lib/csv-export';

type RouteContext = {
  params: Promise<{
    artifactId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { artifactId } = await context.params;
  const artifactResult = await loadAuthorizedAdminOperationArtifact({
    artifactId: decodeURIComponent(artifactId),
    actorRole: session.user.role,
  });

  if (artifactResult.status === 'missing') {
    return NextResponse.json({ error: 'artifact 不存在' }, { status: 404 });
  }
  if (artifactResult.status === 'forbidden') {
    return NextResponse.json({ error: '无权下载该 artifact' }, { status: 403 });
  }
  if (artifactResult.status === 'expired') {
    return NextResponse.json({ error: 'artifact 已过期' }, { status: 410 });
  }
  if (artifactResult.status === 'revoked') {
    return NextResponse.json({ error: 'artifact 已撤销' }, { status: 410 });
  }

  const artifact = artifactResult.artifact;
  const failedRows = readFailedRows(artifact.payload);
  const completedAt = new Date().toISOString();
  const idempotencyKey = buildAdminOperationIdempotencyKey([
    'admin-import-failed-rows-download',
    artifact.artifactId,
    session.user.id,
  ]);
  const operationLedger = buildAdminOperationLedgerEntry({
    kind: 'admin-import-failed-rows-download',
    actorId: session.user.id,
    actorRole: session.user.role,
    scope: artifact.artifactId,
    startedAt: completedAt,
    completedAt,
    outcome: 'download-ready',
    idempotencyKey,
    artifactRefs: [{
      id: artifact.artifactId,
      kind: 'failed-rows',
      label: artifact.label,
      authorizedRoles: ['ADMIN'],
      piiMinimized: true,
      rowCount: artifact.rowCount ?? failedRows.length,
      expiresAt: artifact.expiresAt?.toISOString(),
      revocable: true,
    }],
    rollback: {
      available: false,
      rationale: '失败行 artifact 下载不修改系统状态，无需回滚。',
    },
    auditSummary: `失败行 artifact 已下载：${failedRows.length} 行。`,
    recoveryState: {
      status: 'available',
      action: '修正源文件后重新预览或提交导入',
    },
  });
  await persistAdminOperationLedger(operationLedger);

  return new NextResponse(toCsv([
    ['row', 'accountFingerprint', 'reason'],
    ...failedRows.map((row) => [row.row, row.accountFingerprint ?? '', row.reason]),
  ]), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${artifact.artifactId}.csv"`,
      ...operationLedgerHeaders(operationLedger),
    },
  });
}

function readFailedRows(payload: unknown): PiiMinimizedFailedImportRow[] {
  if (!payload || typeof payload !== 'object' || !('failedRows' in payload)) {
    return [];
  }
  const rows = (payload as { failedRows?: unknown }).failedRows;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const value = row as Partial<PiiMinimizedFailedImportRow>;
      if (typeof value.row !== 'number' || typeof value.reason !== 'string') return null;
      return {
        row: value.row,
        accountFingerprint: typeof value.accountFingerprint === 'string' ? value.accountFingerprint : null,
        reason: value.reason,
      };
    })
    .filter((row): row is PiiMinimizedFailedImportRow => row !== null);
}
