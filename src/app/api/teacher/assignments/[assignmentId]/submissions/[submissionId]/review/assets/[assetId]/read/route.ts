import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  assignmentErrorResponse,
  requireAssignmentActor,
  requireAssignmentMutation,
} from '@/lib/assignments/assignment-route-guards';
import { teacherReadOriginalAsset, teacherSignOriginalAssetRead } from '@/lib/assignments/public-api';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  reviewId: z.string().trim().min(1).max(160),
  token: z.string().trim().min(1).max(256).optional(),
  download: z.enum(['1']).optional(),
}).strict();

type RouteContext = {
  params: Promise<{
    assignmentId: string;
    submissionId: string;
    assetId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const ids = await context.params;
    const query = querySchema.omit({ token: true, download: true }).parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const access = await teacherSignOriginalAssetRead(auth.actor, {
      ...ids,
      reviewId: query.reviewId,
    });
    return NextResponse.json(
      { access },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return assignmentErrorResponse(error);
  }
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  try {
    const ids = await context.params;
    const query = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const asset = await teacherReadOriginalAsset(auth.actor, {
      ...ids,
      reviewId: query.reviewId,
      token: query.token,
    });
    const dispositionType = query.download === '1' ? 'attachment' : 'inline';
    const disposition = `${dispositionType}; filename*=UTF-8''${encodeURIComponent(asset.displayName)}`;
    return new NextResponse(Buffer.from(asset.bytes), {
      status: 200,
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(asset.bytes.byteLength),
        'Content-Disposition': disposition,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return assignmentErrorResponse(error);
  }
}
