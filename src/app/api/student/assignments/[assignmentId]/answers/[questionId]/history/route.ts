import { NextResponse } from 'next/server';
import { getStudentAssignment } from '@/lib/assignments/submission-service';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string }> }) { const auth = await requireStudentActor(); if ('response' in auth) return auth.response; try { const ids = await params; const revisionId = new URL(request.url).searchParams.get('revisionId') ?? undefined; const assignment = await getStudentAssignment(prisma, auth.actor.id, ids.assignmentId, new Date(), revisionId); const question = assignment.questions.find((item: { id: string }) => item.id === ids.questionId); if (!question) return NextResponse.json({ error: 'question-not-found' }, { status: 404 }); return NextResponse.json({ attempts: question.history }); } catch (error) { rethrowIfNextDynamicError(error); return submissionErrorResponse(error); } }
