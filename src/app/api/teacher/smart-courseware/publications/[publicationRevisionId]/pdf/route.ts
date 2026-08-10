import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { exportSmartCoursewarePdf } from '@/lib/smart-courseware';

import {
  coursewareIdempotencySchema,
  coursewareIdSchema,
  readCoursewareJson,
  requireSmartCoursewareActor,
  smartCoursewareErrorResponse,
} from '../../../_shared';

const requestSchema = z.object({ idempotencyKey: coursewareIdempotencySchema }).strict();
type RouteContext = { params: Promise<{ publicationRevisionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSmartCoursewareActor();
  if ('response' in auth) return auth.response;
  try {
    const publicationRevisionId = coursewareIdSchema.parse((await context.params).publicationRevisionId);
    const input = requestSchema.parse(await readCoursewareJson(request));
    const exported = await exportSmartCoursewarePdf(prisma, {
      actor: auth.actor,
      publicationRevisionId,
      idempotencyKey: input.idempotencyKey,
    });
    return new NextResponse(exported.artifactBytes, {
      status: 201,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="courseware-${publicationRevisionId}.pdf"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
        'x-smart-courseware-publication-revision': publicationRevisionId,
        'x-smart-courseware-artifact-hash': exported.artifactHash,
      },
    });
  } catch (error) {
    return smartCoursewareErrorResponse(error);
  }
}
