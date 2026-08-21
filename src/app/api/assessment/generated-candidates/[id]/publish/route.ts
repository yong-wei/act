import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { writeGeneratedCatalogRelease } from '@/features/adaptive-assessment/generated-candidate-catalog';
import { applyGeneratedCandidateStoreToRuntimeOverlay } from '@/features/adaptive-assessment/generated-catalog-runtime';
import { publishGeneratedCandidate } from '@/features/adaptive-assessment/generated-candidate-governance';
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
      return NextResponse.json({ error: '请先登录后再发布候选' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '只有管理员可以发布候选' }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as { catalogReleaseId?: string };
    const store = await loadGeneratedCandidateStore(prisma);
    const receipt = publishGeneratedCandidate(store, {
      candidateId: id,
      publisherUserId: session.user.id,
      catalogReleaseId: body.catalogReleaseId ?? 'generated-catalog.r1',
    });
    await persistGeneratedCandidateStore(prisma, store);
    const publishedItems = applyGeneratedCandidateStoreToRuntimeOverlay(store);
    try {
      writeGeneratedCatalogRelease(store, process.cwd(), publishedItems);
    } catch {
      // Sidecar export is optional and must not write the read-only production runtime mount.
    }
    return NextResponse.json({
      receiptId: receipt.receiptId,
      receiptHash: receipt.receiptHash,
      catalogItemId: receipt.catalogItemId,
      status: receipt.status,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json({
      error: '发布生成候选失败',
      message: error instanceof Error ? error.message : '未知错误',
    }, { status: 400 });
  }
}
