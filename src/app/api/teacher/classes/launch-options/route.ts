import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (session.user.role !== 'TEACHER') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  const [classes, teacher] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: session.user.id, isActive: true },
      select: { id: true, name: true, code: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { defaultTeachingClassId: true },
    }),
  ]);
  const defaultClassId = classes.some((classItem) => classItem.id === teacher?.defaultTeachingClassId)
    ? teacher?.defaultTeachingClassId ?? null
    : null;

  return NextResponse.json({ classes, defaultClassId });
}
