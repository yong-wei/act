import { NextResponse } from 'next/server';

import { assignmentErrorResponse, requireAssignmentActor } from '@/lib/assignments/assignment-route-guards';
import { teacherListAssignmentSubmissions } from '@/lib/assignments/public-api';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  try {
    const { assignmentId } = await context.params;
    const items = await teacherListAssignmentSubmissions(auth.actor, assignmentId);
    return NextResponse.json({ items });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
