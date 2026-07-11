import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SUBMISSION_LIMITS, SubmissionError } from './submission-domain';

export async function requireStudentActor() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { response: NextResponse.json({ error: '未登录' }, { status: 401 }) } as const;
  if (session.user.role !== 'STUDENT') return { response: NextResponse.json({ error: '权限不足' }, { status: 403 }) } as const;
  return { actor: { id: session.user.id } } as const;
}

export async function guardSubmissionMutation(request: Request, actorId: string, kind: 'autosave' | 'upload' | 'submit') {
  if (request.method === 'GET' || request.method === 'HEAD') return NextResponse.json({ error: 'mutation-method-required' }, { status: 405 });
  const actualOrigin = request.headers.get('origin'); const expectedOrigin = new URL(process.env.NEXTAUTH_URL ?? request.url).origin;
  if (!actualOrigin || actualOrigin !== expectedOrigin) return NextResponse.json({ error: 'invalid-origin' }, { status: 403 });
  const limits = { autosave: 120, upload: 30, submit: 30 } as const;
  const now = new Date(); const key = `student-assignment:${kind}:${actorId}`;
  const allowed = await prisma.$transaction(async (tx) => {
    const row = await tx.submissionMutationQuota.findUnique({ where: { key } });
    if (row?.blockedUntil && row.blockedUntil > now) return false;
    const freshWindow = !row || now.getTime() - row.windowStart.getTime() >= 60_000;
    const nextCount = freshWindow ? 1 : row.requestCount + 1;
    await tx.submissionMutationQuota.upsert({ where: { key }, create: { key, windowStart: now, requestCount: 1 }, update: { windowStart: freshWindow ? now : row!.windowStart, requestCount: nextCount, blockedUntil: nextCount > limits[kind] ? new Date(now.getTime() + 60_000) : null } });
    return nextCount <= limits[kind];
  }, { isolationLevel: 'Serializable' });
  if (!allowed) return NextResponse.json({ error: 'rate-limited' }, { status: 429, headers: { 'Retry-After': '60' } });
  return null;
}

export async function readBoundedSubmissionJson(request: Request) {
  const body = await request.text(); if (new TextEncoder().encode(body).byteLength > SUBMISSION_LIMITS.body) throw new SubmissionError('payload-too-large', 413);
  try { return JSON.parse(body) as unknown; } catch { throw new SubmissionError('invalid-json'); }
}

export function submissionErrorResponse(error: unknown) {
  if (error instanceof SubmissionError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error && typeof error === 'object' && 'issues' in error) return NextResponse.json({ error: 'invalid-payload' }, { status: 400 });
  return NextResponse.json({ error: 'submission-operation-failed' }, { status: 500 });
}
