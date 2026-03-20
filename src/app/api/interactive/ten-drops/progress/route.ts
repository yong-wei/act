import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resource = await getTenDropsResource();
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const events = await prisma.interactionLog.findMany({
      where: {
        userId: session.user.id,
        resourceId: resource.id,
        eventType: 'complete',
      },
      select: { eventData: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const completedLevels = new Set<string>();
    const bestScores: Record<string, number> = {};
    let lastLevelId: string | null = null;

    for (const event of events) {
      const parsed = extractTenDropsEvent(event.eventData);
      if (!parsed) continue;

      if (!lastLevelId) {
        lastLevelId = parsed.levelId;
      }

      completedLevels.add(parsed.levelId);

      if (typeof parsed.score === 'number') {
        const currentBest = bestScores[parsed.levelId] ?? 0;
        if (parsed.score > currentBest) {
          bestScores[parsed.levelId] = parsed.score;
        }
      }
    }

    return NextResponse.json({
      resourceId: resource.id,
      completedLevels: Array.from(completedLevels),
      bestScores,
      lastLevelId,
    });
  } catch (error) {
    console.error('[TenDrops Progress API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { levelId, score, dropsRemaining, maxChain } = body as Record<string, unknown>;

    if (!levelId || typeof levelId !== 'string') {
      return NextResponse.json({ error: 'levelId is required' }, { status: 400 });
    }

    const resource = await getTenDropsResource();
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const payload = {
      game: 'ten-drops',
      levelId,
      score: typeof score === 'number' ? score : 0,
      dropsRemaining: typeof dropsRemaining === 'number' ? dropsRemaining : null,
      maxChain: typeof maxChain === 'number' ? maxChain : null,
    };

    await prisma.interactionLog.create({
      data: {
        userId: session.user.id,
        resourceId: resource.id,
        resourceKey: `ten-drops:${levelId}`,
        eventType: 'complete',
        eventData: payload as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TenDrops Progress API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
