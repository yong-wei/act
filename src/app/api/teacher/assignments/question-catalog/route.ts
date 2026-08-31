import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assignmentErrorResponse, readBoundedAssignmentJson, requireAssignmentActor, requireAssignmentMutation } from '@/lib/assignments/assignment-route-guards';
import { teacherListQuestionCatalog, teacherSelectQuestionCatalogItem } from '@/lib/assignments/public-api';

export const dynamic = 'force-dynamic';

const selectionSchema = z.object({ sourceId: z.string().trim().min(1).max(200) }).strict();

export async function GET() {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  try {
    return NextResponse.json({ items: await teacherListQuestionCatalog() });
  } catch {
    return NextResponse.json({ error: 'question-catalog-unavailable' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  const blocked = requireAssignmentMutation(request, auth.actor.id);
  if (blocked) return blocked;
  try {
    const { sourceId } = selectionSchema.parse(await readBoundedAssignmentJson(request));
    return NextResponse.json({ question: await teacherSelectQuestionCatalogItem(sourceId) });
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}
