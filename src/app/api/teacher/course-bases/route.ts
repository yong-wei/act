import { NextResponse } from 'next/server';
import { z } from 'zod';

import { courseBasisErrorResponse, createCourseBasis, listCourseBases, requireCourseBasisActor } from '@/lib/course-basis';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  courseIdentity: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullish(),
}).strict();

export async function GET(request: Request) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 50)));
  const courseBasisId = url.searchParams.get('courseBasisId') ?? undefined;
  const fullHistory = url.searchParams.get('fullHistory') === 'true';
  const courseBases = await listCourseBases(prisma, auth.actor, { offset, limit, courseBasisId, fullHistory });
  return NextResponse.json({ courseBases, pagination: { offset, limit, hasMore: !courseBasisId && courseBases.length === limit } });
}

export async function POST(request: Request) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const courseBasis = await createCourseBasis(prisma, { actor: auth.actor, ...createSchema.parse(await request.json()) });
    return NextResponse.json({ courseBasis }, { status: 201 });
  } catch (error) {
    return courseBasisErrorResponse(error);
  }
}
