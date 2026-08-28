import { NextResponse } from 'next/server';
import { studentListAssignments } from '@/lib/assignments/public-api';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
export const dynamic = 'force-dynamic';
export async function GET() { const auth = await requireStudentActor(); if ('response' in auth) return auth.response; try { return NextResponse.json({ assignments: await studentListAssignments(auth.actor) }); } catch (error) { return submissionErrorResponse(error); } }
export async function POST() { return NextResponse.json({ error: 'whole-assignment-submission-unsupported' }, { status: 405 }); }
