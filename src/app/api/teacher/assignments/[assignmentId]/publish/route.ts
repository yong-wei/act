import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assignmentErrorResponse, readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { publishAssignmentRevision } from '@/lib/assignments/assignment-service';
import { prisma } from '@/lib/prisma';

const publishSchema = z.object({
  revisionId: z.string().trim().min(1).max(120),
  expectedVersion: z.number().int().positive(),
  contentDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  idempotencyKey: z.string().trim().min(16).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  audiences: z.array(z.object({
    classId: z.string().trim().min(1).max(120),
    availableAt: z.string().datetime(),
    dueAt: z.string().datetime(),
  }).strict()).min(1).max(50),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { assignmentId } = await context.params;
    const input = publishSchema.parse(await readBoundedAssignmentJson(request));
    const result = await publishAssignmentRevision(prisma, { actor: auth.actor, assignmentId, ...input });
    return NextResponse.json(result);
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
