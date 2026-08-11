import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  requireAssignmentActor,
  requireAssignmentMutation,
} from '@/lib/assignments/assignment-route-guards';
import {
  SubmissionError,
} from '@/lib/assignments/submission-domain';
import { assertSubmissionObjectIntegrity } from '@/lib/assignments/submission-integrity';
import { createSubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import {
  consumeTeacherAssignmentOriginalAssetRead,
  signTeacherAssignmentOriginalAssetRead,
  TeacherAssignmentReviewError,
} from '@/lib/data-governance/teacher-assignment-review';
import { teacherAssignmentReviewErrorResponse } from '@/lib/data-governance/teacher-assignment-review-api';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

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
    const access = await signTeacherAssignmentOriginalAssetRead(prisma, {
      actor: auth.actor,
      ...ids,
      reviewId: query.reviewId,
    });
    return NextResponse.json(
      { access },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return originalAssetErrorResponse(error);
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
    if (!query.token) {
      throw new TeacherAssignmentReviewError(
        'teacher-review-original-asset-token-invalid',
        403,
      );
    }
    const asset = await consumeTeacherAssignmentOriginalAssetRead(prisma, {
      actor: auth.actor,
      ...ids,
      reviewId: query.reviewId,
      token: query.token,
    });
    const bytes = await createSubmissionObjectStore().readObject(
      asset.objectKey,
    );
    assertSubmissionObjectIntegrity(bytes, asset.sizeBytes, asset.checksum);
    const dispositionType = query.download === '1' ? 'attachment' : 'inline';
    const disposition = `${dispositionType}; filename*=UTF-8''${encodeURIComponent(asset.displayName)}`;
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': disposition,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return originalAssetErrorResponse(error);
  }
}

function originalAssetErrorResponse(error: unknown) {
  if (error instanceof TeacherAssignmentReviewError) {
    return teacherAssignmentReviewErrorResponse(error);
  }
  if (error instanceof SubmissionError) {
    return submissionErrorResponse(error);
  }
  return teacherAssignmentReviewErrorResponse(error);
}
