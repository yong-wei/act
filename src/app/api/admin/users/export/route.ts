import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';

import { requireAdminSession } from '@/lib/admin';
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
} from '@/lib/admin-operation-ledger';
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime';
import { normalizeAdminUsersQueryContract } from '@/lib/api-ui-contracts';
import { toCsv } from '@/lib/csv-export';
import { prisma } from '@/lib/prisma';

const EXPORT_LIMIT = 5000;

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = normalizeAdminUsersQueryContract({
    q: searchParams.get('q'),
    search: searchParams.get('search'),
    role: searchParams.get('role'),
  });

  if (!query.source.roleSupported) {
    return NextResponse.json(
      {
        error: '角色筛选参数无效，已阻止导出。',
        code: 'invalid-role-filter',
      },
      { status: 400 },
    );
  }

  const where: Prisma.UserWhereInput = {};
  if (query.role !== 'ALL') {
    where.role = query.role;
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { employeeNumber: { contains: query.search, mode: 'insensitive' } },
      { profile: { is: { studentNumber: { contains: query.search } } } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        profile: {
          select: {
            studentNumber: true,
            className: true,
          },
        },
      },
      take: EXPORT_LIMIT,
    }),
  ]);

  const csv = toCsv([
    ['id', 'name', 'email', 'role', 'account', 'className', 'createdAt'],
    ...users.map((user) => [
      user.id,
      user.name ?? '',
      user.email ?? '',
      user.role,
      user.profile?.studentNumber ?? user.employeeNumber ?? '',
      user.profile?.className ?? '',
      user.createdAt.toISOString(),
    ]),
  ]);
  const filename = `admin-users-${query.role.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  const completedAt = new Date().toISOString();
  const operationLedger = buildAdminOperationLedgerEntry({
    kind: 'admin-users-export',
    actorId: session.user.id,
    actorRole: session.user.role,
    scope: `admin-users-export:${query.role}`,
    startedAt: completedAt,
    completedAt,
    outcome: 'export-ready',
    idempotencyKey: buildAdminOperationIdempotencyKey([
      'admin-users-export',
      query.role,
      query.search,
      total,
      users.length,
      session.user.id,
    ]),
    artifactRefs: [{
      id: `admin-users-export:${filename}`,
      kind: 'export',
      label: '账号筛选导出',
      authorizedRoles: ['ADMIN'],
      piiMinimized: false,
      rowCount: users.length,
      revocable: true,
    }],
    rollback: {
      available: false,
      rationale: '账号导出不修改系统状态，无需回滚。',
    },
    auditSummary: `账号导出已生成：${users.length}/${total} 条。`,
    recoveryState: {
      status: total > users.length ? 'retry' : 'available',
      action: total > users.length ? '缩小筛选范围后重新导出完整数据' : '下载文件并归档审计记录',
    },
  });
  await persistAdminOperationLedger(operationLedger);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'x-export-filename': filename,
      'x-export-total': String(total),
      'x-export-count': String(users.length),
      'x-export-truncated': String(total > users.length),
      ...operationLedgerHeaders(operationLedger),
    },
  });
}
