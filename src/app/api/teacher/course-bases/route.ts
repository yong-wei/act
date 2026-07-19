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

const listSchema = z.object({
  offset: z.coerce.number().int().finite().min(0).default(0),
  limit: z.coerce.number().int().finite().min(1).max(50).default(50),
  documentOffset: z.coerce.number().int().finite().min(0).default(0),
  versionOffset: z.coerce.number().int().finite().min(0).default(0),
  courseBasisId: z.string().trim().min(1).max(200).optional(),
  documentId: z.string().trim().min(1).max(200).optional(),
}).strict();

export async function GET(request: Request) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const url = new URL(request.url);
    const input = listSchema.parse(Object.fromEntries(url.searchParams));
    const courseBases = await listCourseBases(prisma, auth.actor, input);
    return NextResponse.json({
      courseBases,
      pagination: {
        offset: input.offset,
        limit: input.limit,
        hasMore: !input.courseBasisId && courseBases.length === input.limit,
      },
    });
  } catch (error) {
    return courseBasisErrorResponse(error);
  }
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
