import { NextResponse, type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';

import { requireAdminSession } from '@/lib/admin';
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

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'x-export-filename': filename,
      'x-export-total': String(total),
      'x-export-count': String(users.length),
      'x-export-truncated': String(total > users.length),
    },
  });
}
