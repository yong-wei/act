import { NextResponse } from 'next/server';
import { getStudentAssignment } from '@/lib/assignments/submission-service';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export async function GET(_: Request, { params }: { params: Promise<{ assignmentId: string }> }) { const auth = await requireStudentActor(); if ('response' in auth) return auth.response; try { const { assignmentId } = await params; return NextResponse.json({ assignment: await getStudentAssignment(prisma, auth.actor.id, assignmentId) }); } catch (error) { return submissionErrorResponse(error); } }
