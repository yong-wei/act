import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const TEN_DROPS_REGISTRY_ID = 'ten-drops-game-v1';

function extractTenDropsEvent(eventData: Prisma.JsonValue) {
  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) return null;
  const data = eventData as Record<string, unknown>;

  if (data.game && data.game !== 'ten-drops') return null;

  const levelId = typeof data.levelId === 'string' ? data.levelId : null;
  const score = typeof data.score === 'number' ? data.score : null;

  return levelId ? { levelId, score } : null;
}

async function getTenDropsResource() {
  return prisma.teachingResource.findFirst({
    where: { registryId: TEN_DROPS_REGISTRY_ID },
    select: { id: true },
  });
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const levelId = searchParams.get('levelId');
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '10', 10)));

    if (!levelId) {
      return NextResponse.json({ error: 'levelId is required' }, { status: 400 });
    }

    const resource = await getTenDropsResource();
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const events = await prisma.interactionLog.findMany({
      where: {
        resourceId: resource.id,
        eventType: 'complete',
      },
      select: {
        eventData: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const bestByUser = new Map<string, { userId: string; name: string | null; score: number }>();

    for (const event of events) {
      const parsed = extractTenDropsEvent(event.eventData);
      if (!parsed || parsed.levelId !== levelId || typeof parsed.score !== 'number') continue;

      const existing = bestByUser.get(event.user.id);
      if (!existing || parsed.score > existing.score) {
        bestByUser.set(event.user.id, {
          userId: event.user.id,
          name: event.user.name,
          score: parsed.score,
        });
      }
    }

    const entries = Array.from(bestByUser.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return NextResponse.json({
      levelId,
      entries,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TenDrops Leaderboard API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
