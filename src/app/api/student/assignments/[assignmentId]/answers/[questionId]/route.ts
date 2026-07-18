import { NextResponse } from 'next/server';
import { textDraftSchema } from '@/lib/assignments/submission-domain';
import { saveQuestionDraft } from '@/lib/assignments/submission-service';
import { guardSubmissionMutation, readBoundedSubmissionJson, requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { prisma } from '@/lib/prisma';
export async function PATCH(request: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string }> }) { const auth = await requireStudentActor(); if ('response' in auth) return auth.response; const blocked = await guardSubmissionMutation(request, auth.actor.id, 'autosave'); if (blocked) return blocked; try { const ids = await params; const body = textDraftSchema.parse(await readBoundedSubmissionJson(request)); const answer = await saveQuestionDraft(prisma, { studentId: auth.actor.id, ...ids, ...body }); return NextResponse.json({ answer: { id: answer.id, state: answer.state, version: answer.version, textDraft: answer.textDraft } }); } catch (error) { return submissionErrorResponse(error); } }
