import { NextResponse } from 'next/server';

import { readAdaptivePathCandidateBatch } from '@/features/personalization/path-planning/adaptive-path-candidate-batches';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { getLearningPathRequester } from '../../route-helpers';
import {
  assertCanReadCandidateBatch,
  attachCandidateBatchSourcePathVersion,
} from '../route-helpers';

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
    const versionedBatch = await attachCandidateBatchSourcePathVersion(batch);
    if (!versionedBatch) {
      return NextResponse.json({ error: '候选路径批次的来源路径已失效' }, { status: 409 });
    }
    return NextResponse.json({
      batch: versionedBatch,
      focusedCandidate: candidateId
        ? versionedBatch.candidates.find((candidate) => candidate.id === candidateId) ?? null
        : null,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[AdaptivePathCandidateBatch] Error:', error);
    return NextResponse.json({ error: '读取候选路径批次失败' }, { status: 500 });
  }
}
