import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import {
  DEFAULT_COMPANION_TRIGGER_CONFIG,
  confirmPauseCandidate,
  isCoolingDown,
  pauseSignalsEligible,
  type CompanionEventType,
  type CompanionPageKind,
} from '@/features/ai/companion/trigger-engine';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PAGE_KINDS: CompanionPageKind[] = ['resource-textbook', 'adaptive-practice'];
const PAUSE_EVENT_TYPES: CompanionEventType[] = ['pause-candidate'];
const DIRECT_EVENT_TYPES: CompanionEventType[] = ['wrong-answer', 'progress-milestone', 'resource-completed'];
const MAX_REF_LENGTH = 256;

function isCompanionEnabled() {
  return process.env.KONLING_COMPANION_ENABLED === 'true';
}

/** 停顿候选/直发事件上报：服务端时间权威，冷却去重即刻判定。 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isCompanionEnabled()) {
      return NextResponse.json({ error: 'Companion disabled' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const pageKind = String(body?.pageKind ?? '');
    const pageRef = String(body?.pageRef ?? '').slice(0, MAX_REF_LENGTH);
    const eventType = String(body?.eventType ?? '');
    const signals = body?.signals && typeof body.signals === 'object' ? body.signals : null;

    if (!PAGE_KINDS.includes(pageKind as CompanionPageKind) || !pageRef) {
      return NextResponse.json({ error: 'Invalid page context' }, { status: 400 });
    }
    if (![...PAUSE_EVENT_TYPES, ...DIRECT_EVENT_TYPES].includes(eventType as CompanionEventType)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }
    if (eventType === 'pause-candidate') {
      if (!signals
        || typeof signals.visible !== 'boolean'
        || typeof signals.focused !== 'boolean'
        || typeof signals.mediaPlaying !== 'boolean'
        || typeof signals.recentActionCount !== 'number') {
        return NextResponse.json({ error: 'Invalid pause signals' }, { status: 400 });
      }
      // 停顿候选在上报时就要求证据成立，两阶段确认在 PATCH 阶段复核。
      if (!pauseSignalsEligible(signals)) {
        return NextResponse.json({ status: 'suppressed' }, { status: 200 });
      }
    }

    const now = new Date();
    const userId = session.user.id;
    const previous = await prisma.konlingCompanionEvent.findFirst({
      where: { userId, eventType: eventType as CompanionEventType },
      orderBy: { createdAt: 'desc' },
      select: { eventType: true, createdAt: true },
    });
    if (isCoolingDown(previous, now)) {
      return NextResponse.json({ status: 'suppressed', reason: 'cooldown' }, { status: 200 });
    }

    const created = await prisma.konlingCompanionEvent.create({
      data: {
        userId,
        pageKind,
        pageRef,
        eventType,
        status: eventType === 'pause-candidate' ? 'candidate' : 'confirmed',
        evidence: {
          pageKind,
          eventType,
          ...(eventType === 'pause-candidate'
            ? {
                idle: DEFAULT_COMPANION_TRIGGER_CONFIG.minIdleSeconds,
                recentActionCount: signals?.recentActionCount ?? 0,
              }
            : {}),
        },
        expiresAt: new Date(now.getTime() + DEFAULT_COMPANION_TRIGGER_CONFIG.cooldownMs),
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({ eventId: created.id, status: created.status }, { status: 201 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('companion event report failed', error);
    return NextResponse.json({ error: 'Companion event failed' }, { status: 500 });
  }
}

/** 停顿候选二次确认：窗口与信号在服务端复核，返回可投递状态。 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isCompanionEnabled()) {
      return NextResponse.json({ error: 'Companion disabled' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const eventId = String(body?.eventId ?? '');
    const signals = body?.signals && typeof body.signals === 'object' ? body.signals : null;
    if (!eventId || !signals
      || typeof signals.visible !== 'boolean'
      || typeof signals.focused !== 'boolean'
      || typeof signals.mediaPlaying !== 'boolean'
      || typeof signals.recentActionCount !== 'number') {
      return NextResponse.json({ error: 'Invalid confirmation' }, { status: 400 });
    }

    const userId = session.user.id;
    const candidate = await prisma.konlingCompanionEvent.findFirst({
      where: { id: eventId, userId, status: 'candidate' },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const { decision } = confirmPauseCandidate(candidate, signals, new Date());
    if (decision !== 'confirmed') {
      const status = decision === 'expired' ? 'expired' : 'suppressed';
      await prisma.konlingCompanionEvent.update({
        where: { id: candidate.id },
        data: { status },
      });
      return NextResponse.json({ status }, { status: 200 });
    }

    const updated = await prisma.konlingCompanionEvent.update({
      where: { id: candidate.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
      select: { id: true, status: true },
    });
    return NextResponse.json({ eventId: updated.id, status: updated.status }, { status: 200 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('companion event confirm failed', error);
    return NextResponse.json({ error: 'Companion confirmation failed' }, { status: 500 });
  }
}
