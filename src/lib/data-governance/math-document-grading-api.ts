import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { GradingMutationError, MATH_DOCUMENT_GRADING_LIMITS } from './math-document-grading-contracts';

export async function requireGradingTeacherActor() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return { response: NextResponse.json({ error: '未授权' }, { status: 401 }) } as const;
  if (session.user.role !== UserRole.TEACHER && session.user.role !== UserRole.ADMIN) return { response: NextResponse.json({ error: '无权操作文档批改管线' }, { status: 403 }) } as const;
  return { actor: { id: session.user.id, role: session.user.role as 'TEACHER' | 'ADMIN' } } as const;
}

export async function readGradingJson(request: Request): Promise<unknown> {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MATH_DOCUMENT_GRADING_LIMITS.bodyBytes) throw new GradingMutationError('payload-too-large', 413);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new GradingMutationError('invalid-json', 400);
  }
}

export function legacyDocumentGradingRouteDisabled(): boolean {
  return true;
}

export function legacyDocumentRubricDraftRetiredResponse() {
  return NextResponse.json({
    error: 'legacy-document-rubric-grading-retired',
    replacement: '/teacher/assignments',
  }, { status: 410, headers: { Deprecation: 'true' } });
}

export function gradingApiError(error: unknown) {
  if (error instanceof GradingMutationError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error && typeof error === 'object' && 'issues' in error) return NextResponse.json({ error: 'invalid-pipeline-payload' }, { status: 400 });
  if (error instanceof Error && /content-unavailable|association-missing|parent-lineage-missing|attempt-(?:missing|not-found)|asset-(?:or-answer-)?missing|batch-item-content-unavailable/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 410 });
  }
  if (error instanceof Error && /forbidden|unauthorized|policy-blocked|policy-snapshot|policy-purpose|idempotency|not-found|not-ready|scope|quota|retry-reason|finalized|binding|clean/i.test(error.message)) {
    const status = /forbidden|unauthorized/.test(error.message) ? 403 : /not-found/.test(error.message) ? 404 : /quota/.test(error.message) ? 429 : 409;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: '文档批改管线操作失败' }, { status: 500 });
}
