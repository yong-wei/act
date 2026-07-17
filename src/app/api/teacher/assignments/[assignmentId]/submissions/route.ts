import { NextResponse } from 'next/server';

import { requireAssignmentActor } from '@/lib/assignments/assignment-route-guards';
import { listTeacherAssignmentSubmissions } from '@/lib/data-governance/teacher-assignment-review';
import { teacherAssignmentReviewErrorResponse } from '@/lib/data-governance/teacher-assignment-review-api';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  try {
    const { assignmentId } = await context.params;
    const items = await listTeacherAssignmentSubmissions(prisma, { actor: auth.actor, assignmentId });
    return NextResponse.json({ items });
  } catch (error) {
    return teacherAssignmentReviewErrorResponse(error);
  }
}
