import { NextResponse } from 'next/server';

import { requireAssignmentActor } from '@/lib/assignments/assignment-route-guards';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const classes = await prisma.class.findMany({
    where: auth.actor.role === 'ADMIN' ? { isActive: true } : { teacherId: auth.actor.id, isActive: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, code: true, year: true, semester: true },
  });
  return NextResponse.json({ classes });
}
