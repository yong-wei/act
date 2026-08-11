import { NextResponse } from 'next/server';

import { readAdaptivePathCandidateBatch } from '@/lib/adaptive-path-candidate-batches';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { getLearningPathRequester } from '../../route-helpers';
import { assertCanReadCandidateBatch } from '../route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ batchId: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const { batchId } = await props.params;
    const batch = await readAdaptivePathCandidateBatch(prisma as any, batchId);
    if (!batch) return NextResponse.json({ error: '候选路径批次不存在' }, { status: 404 });
    const denied = await assertCanReadCandidateBatch(requester, batch);
    if (denied) return denied;
    const candidateId = new URL(request.url).searchParams.get('candidate');
    if (candidateId && !batch.candidates.some((candidate) => candidate.id === candidateId)) {
      return NextResponse.json({ error: '候选路径不属于该批次' }, { status: 404 });
    }
    return NextResponse.json({
      batch,
      focusedCandidate: candidateId
        ? batch.candidates.find((candidate) => candidate.id === candidateId) ?? null
        : null,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[AdaptivePathCandidateBatch] Error:', error);
    return NextResponse.json({ error: '读取候选路径批次失败' }, { status: 500 });
  }
}
