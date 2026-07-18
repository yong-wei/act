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

export async function GET() {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  return NextResponse.json({ courseBases: await listCourseBases(prisma, auth.actor) });
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
