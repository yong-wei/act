import { NextResponse } from 'next/server';

import { requireAssignmentActor } from '@/lib/assignments/assignment-route-guards';
import { teacherListManagedClasses } from '@/lib/assignments/public-api';

export async function GET() {
  const auth = await requireAssignmentActor();
  if ('response' in auth) return auth.response;
  return NextResponse.json({ classes: await teacherListManagedClasses(auth.actor) });
}
