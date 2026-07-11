import { NextResponse } from 'next/server';
import { listStudentAssignments } from '@/lib/assignments/submission-service';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export async function GET() { const auth = await requireStudentActor(); if ('response' in auth) return auth.response; try { return NextResponse.json({ assignments: await listStudentAssignments(prisma, auth.actor.id) }); } catch (error) { return submissionErrorResponse(error); } }
// Whole-assignment mutation is deliberately unsupported; every mutation route requires a question id.
export async function POST() { return NextResponse.json({ error: 'whole-assignment-submission-unsupported' }, { status: 405 }); }
