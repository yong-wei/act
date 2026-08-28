import { NextResponse } from 'next/server';
import { studentGetAssignment } from '@/lib/assignments/public-api';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) { const auth = await requireStudentActor(); if ('response' in auth) return auth.response; try { const { assignmentId } = await params; const revisionId = new URL(request.url).searchParams.get('revisionId') ?? undefined; return NextResponse.json({ assignment: await studentGetAssignment(auth.actor, assignmentId, revisionId) }); } catch (error) { rethrowIfNextDynamicError(error); return submissionErrorResponse(error); } }
