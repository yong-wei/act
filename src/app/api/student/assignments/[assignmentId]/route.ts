import { NextResponse } from 'next/server';
import { getStudentAssignment } from '@/lib/assignments/submission-service';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) { const auth = await requireStudentActor(); if ('response' in auth) return auth.response; try { const { assignmentId } = await params; const revisionId = new URL(request.url).searchParams.get('revisionId') ?? undefined; return NextResponse.json({ assignment: await getStudentAssignment(prisma, auth.actor.id, assignmentId, new Date(), revisionId) }); } catch (error) { rethrowIfNextDynamicError(error); return submissionErrorResponse(error); } }
