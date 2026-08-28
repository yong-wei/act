import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rateLimiter } from '@/lib/rate-limiter';
import { AssignmentDomainError, assertMutationRequest } from './assignment-domain';
import { TeacherAssignmentReviewError } from './assignment-review';
import { SubmissionError } from './submission-domain';

export async function requireAssignmentActor() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { response: NextResponse.json({ error: '未登录' }, { status: 401 }) } as const;
  if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    return { response: NextResponse.json({ error: '权限不足' }, { status: 403 }) } as const;
  }
  return { actor: { id: session.user.id, role: session.user.role } } as const;
}

export function requireAssignmentMutation(request: Request, actorId: string): NextResponse | null {
  try {
    const requestOrigin = new URL(request.url).origin;
    const allowedOrigin = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).origin : requestOrigin;
    assertMutationRequest({
      method: request.method,
      requestOrigin: request.headers.get('origin'),
      allowedOrigin,
      contentLength: parseContentLength(request.headers.get('content-length')),
    });
    const quota = rateLimiter.consume(`assignment-mutation:${actorId}`, { windowMs: 60_000, maxRequests: 60, blockDuration: 60_000 });
    if (!quota.allowed) return NextResponse.json({ error: '请求过于频繁' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfter ?? 60) } });
    return null;
  } catch (error) {
    return assignmentErrorResponse(error);
  }
}

export async function readBoundedAssignmentJson(request: Request, maxBytes = 256_000): Promise<unknown> {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) throw new AssignmentDomainError('payload-too-large');
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new AssignmentDomainError('invalid-json');
  }
}

export function assignmentErrorResponse(error: unknown): NextResponse {
  if (error instanceof TeacherAssignmentReviewError) {
    return NextResponse.json({ error: error.code, details: error.details }, { status: error.status });
  }
  if (error instanceof SubmissionError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  if (error instanceof AssignmentDomainError) {
    const status = error.code.includes('forbidden') || error.code.includes('unauthorized') ? 403
      : error.code === 'assignment-not-found' || error.code === 'draft-not-found' || error.code === 'catalog-source-not-found' ? 404
        : [
          'version-conflict',
          'publication-content-digest-mismatch',
          'publication-baseline-already-published',
          'idempotency-key-reused',
          'publication-conflict-retryable',
          'rubric-generation-revision-stale',
        ].includes(error.code) ? 409
          : error.code === 'rubric-generation-output-invalid' ? 502
            : error.code === 'rubric-generation-unavailable' ? 503
          : error.code === 'payload-too-large' ? 413
            : 400;
    return NextResponse.json({ error: error.code, details: error.details }, { status });
  }
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues ?? [];
    return NextResponse.json({ error: 'invalid-payload', details: issues.map((issue) => issue.message).filter(Boolean) }, { status: 400 });
  }
  return NextResponse.json({ error: 'assignment-operation-failed' }, { status: 500 });
}

function parseContentLength(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
