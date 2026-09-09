import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { parsePublishedResourceHref } from '@/lib/published-resource-reference';
import { resolvePublishedResourceFeature } from '@/lib/published-resource-index';
import { readPathPlannerLearnerStateForSubject } from '@/features/personalization/learner-state/public-api';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) return NextResponse.json({ error: '请先登录。' }, { status: 401 });
    if (session.user.role !== 'STUDENT') return NextResponse.json({ error: '仅学生本人可提交学习反馈。' }, { status: 403 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.reference !== 'string' || !['easy', 'appropriate', 'hard'].includes(body.rating)
      || typeof body.eventId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.eventId)) {
      return NextResponse.json({ error: '反馈格式无效。' }, { status: 400 });
    }
    const ref = parsePublishedResourceHref(body.reference);
    const resolved = ref ? await resolvePublishedResourceFeature(ref) : null;
    if (!resolved?.current || !resolved.resource.executable) {
      return NextResponse.json({ error: '资源版本已变化，请重新打开后反馈。' }, { status: 409 });
    }
    const resource = resolved.resource;
    const learner = await readPathPlannerLearnerStateForSubject(session.user.id).catch(() => null);
    const mastery = resource.canonicalIds.map((key) => learner?.knowledgeMastery?.tags?.[key])
      .filter((entry) => typeof entry?.posteriorMastery === 'number' && (entry.confidence ?? 0) >= 0.6 && (entry.evidenceCount ?? 0) > 0);
    const learnerPreparedness = mastery.length
      ? mastery.reduce((sum, entry) => sum + entry!.posteriorMastery!, 0) / mastery.length : null;
    const id = 'resource-feedback-' + createHash('sha256').update(session.user.id + ':' + body.eventId).digest('hex');
    const result = await prisma.interactionLog.upsert({
      where: { id }, update: {},
      create: {
        id, userId: session.user.id, resourceKey: resource.identity.resourceId, actorRole: 'STUDENT',
        eventType: 'resource_difficulty_feedback', clientEventId: body.eventId,
        eventData: {
          schemaVersion: 'resource-feedback/v1', rating: body.rating,
          resourceFeatureRef: { ...resource.identity, resourceVersion: resource.version, indexId: resolved.index.indexId, learnerPreparedness },
        },
      },
      select: { userId: true, resourceKey: true, eventData: true },
    });
    const saved = result.eventData as { rating?: string; resourceFeatureRef?: { resourceVersion?: string } };
    if (result.userId !== session.user.id || result.resourceKey !== resource.identity.resourceId
      || saved.rating !== body.rating || saved.resourceFeatureRef?.resourceVersion !== resource.version) {
      return NextResponse.json({ error: '该反馈标识已用于另一条记录。' }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    return NextResponse.json({ error: '暂时无法保存反馈，请重试。' }, { status: 503 });
  }
}
