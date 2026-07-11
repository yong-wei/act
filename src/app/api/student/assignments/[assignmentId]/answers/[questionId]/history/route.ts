import { NextResponse } from 'next/server';
import { getStudentAssignment } from '@/lib/assignments/submission-service';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { prisma } from '@/lib/prisma';
export async function GET(_: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string }> }) { const auth = await requireStudentActor(); if ('response' in auth) return auth.response; try { const ids = await params; const assignment = await getStudentAssignment(prisma, auth.actor.id, ids.assignmentId); const question = assignment.questions.find((item: { id: string }) => item.id === ids.questionId); if (!question) return NextResponse.json({ error: 'question-not-found' }, { status: 404 }); return NextResponse.json({ attempts: question.history }); } catch (error) { return submissionErrorResponse(error); } }
