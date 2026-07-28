import { NextResponse } from 'next/server';
import { z } from 'zod';

import { courseBasisErrorResponse, createCourseBasisDocument, requireCourseBasisActor } from '@/lib/course-basis';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['STANDARD', 'TEXTBOOK', 'OTHER']),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ courseBasisId: string }> }) {
  const auth = await requireCourseBasisActor();
  if ('response' in auth) return auth.response;
  try {
    const { courseBasisId } = await context.params;
    const document = await createCourseBasisDocument(prisma, {
      actor: auth.actor,
      courseBasisId,
      ...schema.parse(await request.json()),
    });
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return courseBasisErrorResponse(error);
  }
}
