import { NextResponse } from 'next/server';

import { requireStudentActor } from '@/lib/assignments/submission-route-guards';
import { readReviewedDerivativeObject } from '@/lib/data-governance/teacher-assignment-review-derivative-storage';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, context: { params: Promise<{ assignmentId: string; snapshotId: string }> }) {
  const auth = await requireStudentActor();
  if ('response' in auth) return auth.response;
  const { assignmentId, snapshotId } = await context.params;
  const snapshot = await prisma.teacherAssignmentApprovalSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      submission: true,
      feedbackRelease: { include: { derivative: true } },
      outboxCommands: { where: { command: 'RELEASE_STUDENT_FEEDBACK', state: 'SUCCEEDED' }, select: { id: true } },
    },
  });
  const derivative = snapshot?.feedbackRelease?.derivative;
  if (!snapshot
    || snapshot.assignmentId !== assignmentId
    || snapshot.submission.studentId !== auth.actor.id
    || snapshot.submission.frozenStudentId !== auth.actor.id
    || snapshot.feedbackRelease?.ownerStudentId !== auth.actor.id
    || snapshot.outboxCommands.length !== 1
    || derivative?.state !== 'READY'
    || !derivative.outputObjectKey
    || !derivative.outputChecksum) {
    return NextResponse.json({ error: 'reviewed-asset-not-found' }, { status: 404 });
  }
  try {
    const bytes = await readReviewedDerivativeObject(derivative.outputObjectKey);
    const checksum = `sha256:${Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')}`;
    if (checksum !== derivative.outputChecksum) return NextResponse.json({ error: 'reviewed-asset-integrity-failed' }, { status: 409 });
    const extension = derivative.outputKind === 'REVIEWED_DOCX' ? 'docx' : derivative.outputKind === 'REVIEWED_PDF' ? 'pdf' : 'md';
    return new Response(bytes, {
      headers: {
        'content-type': derivative.outputMimeType,
        'content-length': String(bytes.byteLength),
        'content-disposition': `attachment; filename="reviewed-assignment-${snapshot.questionId}.${extension}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'reviewed-asset-unavailable' }, { status: 503 });
  }
}
