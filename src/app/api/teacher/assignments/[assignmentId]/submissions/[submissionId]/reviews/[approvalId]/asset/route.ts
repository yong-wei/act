import { NextResponse } from 'next/server';

import { requireAssignmentActor } from '@/lib/assignments/assignment-route-guards';
import { AssignmentSubmissionGradeError, teacherReadReviewedAssignmentAsset } from '@/lib/assignments/public-api';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string; approvalId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const { assignmentId, submissionId, approvalId } = await context.params;
  const gradeSnapshotId = new URL(request.url).searchParams.get('snapshotId')?.trim();
  if (!gradeSnapshotId) return NextResponse.json({ error: 'assignment-result-invalid-request' }, { status: 400 });
  try {
    const asset = await teacherReadReviewedAssignmentAsset({ actor: auth.actor, assignmentId, submissionId, approvalId, snapshotId: gradeSnapshotId });
    if (!asset) return NextResponse.json({ error: 'reviewed-asset-not-found' }, { status: 404 });
    return new Response(asset.bytes, { headers: { 'content-type': asset.mimeType, 'content-length': String(asset.bytes.byteLength), 'content-disposition': `inline; filename="${asset.filename}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof AssignmentSubmissionGradeError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: 'reviewed-asset-unavailable' }, { status: 503 });
  }
}
