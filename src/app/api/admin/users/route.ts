import { NextResponse, type NextRequest } from 'next/server';
import { type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';
import { normalizeAdminUsersQueryContract } from '@/lib/api-ui-contracts';

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
    accountSource: searchParams.get('accountSource'),
    source: searchParams.get('source'),
    page: searchParams.get('page'),
    pageSize: searchParams.get('pageSize'),
    action: searchParams.get('action'),
    targetId: searchParams.get('targetId'),
    userId: searchParams.get('userId'),
  });

  const where: Prisma.UserWhereInput = {};
  if (query.role !== 'ALL') {
    where.role = query.role;
  }
  if (query.accountSource !== 'ALL') {
    where.accountSource = query.accountSource;
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
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return NextResponse.json({
    total,
    page: query.page,
    pageSize: query.pageSize,
    query: {
      search: query.search,
      role: query.role,
      accountSource: query.accountSource,
      action: query.action,
      targetId: query.targetId,
      source: query.source,
    },
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeNumber: user.employeeNumber,
      role: user.role,
      accountSource: user.accountSource ?? 'PLATFORM',
      createdAt: user.createdAt,
      profile: user.profile,
    })),
  });
}

export async function POST() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  return NextResponse.json({ error: '认证账号由统一身份中心管理' }, { status: 410 });
}
