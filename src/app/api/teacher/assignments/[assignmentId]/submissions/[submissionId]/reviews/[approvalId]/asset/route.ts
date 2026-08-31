import { NextResponse } from 'next/server';

import { requireAssignmentActor } from '@/lib/assignments/assignment-route-guards';
import { AssignmentSubmissionGradeError, getAssignmentSubmissionGrade } from '@/lib/data-governance/assignment-submission-grade';
import { readReviewedDerivativeObject } from '@/lib/data-governance/teacher-assignment-review-derivative-storage';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ assignmentId: string; submissionId: string; approvalId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const { assignmentId, submissionId, approvalId } = await context.params;
  const gradeSnapshotId = new URL(request.url).searchParams.get('snapshotId')?.trim();
  if (!gradeSnapshotId) return NextResponse.json({ error: 'assignment-result-invalid-request' }, { status: 400 });
  try {
    await getAssignmentSubmissionGrade(prisma, { actor: auth.actor, assignmentId, submissionId, snapshotId: gradeSnapshotId });
    const approval = await prisma.teacherAssignmentApprovalSnapshot.findFirst({
      where: { id: approvalId, assignmentId, submissionId },
      include: { reviewedDerivatives: { where: { state: 'READY', outputKind: 'REVIEWED_PDF' }, orderBy: { readyAt: 'desc' }, take: 1 } },
    });
    const derivative = approval?.reviewedDerivatives[0];
    if (!approval || !derivative?.outputObjectKey || !derivative.outputChecksum) return NextResponse.json({ error: 'reviewed-asset-not-found' }, { status: 404 });
    const bytes = await readReviewedDerivativeObject(derivative.outputObjectKey);
    const checksum = `sha256:${Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')}`;
    if (checksum !== derivative.outputChecksum) return NextResponse.json({ error: 'reviewed-asset-integrity-failed' }, { status: 409 });
    return new Response(bytes, { headers: { 'content-type': derivative.outputMimeType, 'content-length': String(bytes.byteLength), 'content-disposition': `inline; filename="reviewed-assignment-${approval.questionId}.pdf"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    if (error instanceof AssignmentSubmissionGradeError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: 'reviewed-asset-unavailable' }, { status: 503 });
  }
}
