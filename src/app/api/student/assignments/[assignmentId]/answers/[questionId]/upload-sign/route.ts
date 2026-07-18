import { NextResponse } from 'next/server';
import { uploadIntentSchema } from '@/lib/assignments/submission-domain';
import { createSubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { signQuestionUpload } from '@/lib/assignments/submission-service';
import { guardSubmissionMutation, readBoundedSubmissionJson, requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { prisma } from '@/lib/prisma';
export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string }> }) { const auth = await requireStudentActor(); if ('response' in auth) return auth.response; const blocked = await guardSubmissionMutation(request, auth.actor.id, 'upload'); if (blocked) return blocked; try { const ids = await params; const body = uploadIntentSchema.parse(await readBoundedSubmissionJson(request)); const signed = await signQuestionUpload(prisma, createSubmissionObjectStore(), { studentId: auth.actor.id, ...ids, ...body }); return NextResponse.json({ upload: { intentId: signed.intentId, url: signed.url, expiresAt: signed.expiresAt, requiredHeaders: signed.requiredHeaders } }); } catch (error) { return submissionErrorResponse(error); } }
