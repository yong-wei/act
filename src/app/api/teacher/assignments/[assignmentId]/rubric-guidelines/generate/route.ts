import { NextResponse } from 'next/server';

import {
  assignmentErrorResponse,
  readBoundedAssignmentJson,
  requireAssignmentActor,
  requireAssignmentMutation,
} from '@/lib/assignments/assignment-route-guards';
import {
  assignmentRubricGenerationRequestSchema,
  teacherGenerateRubricGuidelines,
} from '@/lib/assignments/public-api';
import { rateLimiter } from '@/lib/rate-limiter';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
): Promise<NextResponse> {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response!;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  const quota = rateLimiter.consume(
    `assignment-rubric-generation:${auth.actor.id}`,
    { windowMs: 60_000, maxRequests: 10, blockDuration: 60_000 },
  );
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'rubric-generation-rate-limited' },
      {
        status: 429,
        headers: { 'Retry-After': String(quota.retryAfter ?? 60) },
      },
    );
  }
  try {
    const { assignmentId } = await context.params;
    const input = assignmentRubricGenerationRequestSchema.parse(
      await readBoundedAssignmentJson(request, 16_000),
    );
    const generated = await teacherGenerateRubricGuidelines(auth.actor, assignmentId, input);
    return NextResponse.json({ generated });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
