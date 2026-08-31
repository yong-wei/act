import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { reviewGeneratedCandidate } from '@/features/adaptive-assessment/generated-candidate-governance';
import {
  loadGeneratedCandidateStore,
  persistGeneratedCandidateStore,
} from '@/features/adaptive-assessment/generated-candidate-persistence';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '请先登录后再审核候选' }, { status: 401 });
    }
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '只有教师或管理员可以审核候选' }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json() as {
      outcome?: 'approved' | 'rejected' | 'needs-revision';
      rationale?: string;
      itemDecisions?: Record<string, 'accept' | 'reject'>;
    };
    const store = await loadGeneratedCandidateStore(prisma);
    const review = reviewGeneratedCandidate(store, {
      candidateId: id,
      reviewerUserId: session.user.id,
      reviewerRole: session.user.role === 'ADMIN' ? 'admin' : 'teacher',
      outcome: body.outcome ?? 'needs-revision',
      rationale: body.rationale ?? '',
      itemDecisions: body.itemDecisions ?? {},
    });
    await persistGeneratedCandidateStore(prisma, store);
    return NextResponse.json({
      reviewId: review.reviewId,
      outcome: review.outcome,
      stale: review.stale,
      reviewSourceHash: review.reviewSourceHash,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json({
      error: '审核生成候选失败',
      message: error instanceof Error ? error.message : '未知错误',
    }, { status: 400 });
  }
}
