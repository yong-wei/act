import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  runCompanionProactiveTurn: vi.fn(),
  prisma: {
    konlingCompanionEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    konlingCompanionDelivery: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    konlingSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));
vi.mock('@/features/ai/companion/proactive-turn', () => ({
  runCompanionProactiveTurn: mocks.runCompanionProactiveTurn,
}));

import { PATCH, POST as postEvent } from '@/app/api/ai/companion/events/route';
import { POST as postDelivery } from '@/app/api/ai/companion/delivery/route';

const now = new Date('2026-09-04T10:00:00.000Z');
vi.setSystemTime(now);

const eligibleSignals = {
  visible: true,
  focused: true,
  mediaPlaying: false,
  recentActionCount: 0,
};

function eventPost(body: unknown) {
  return new NextRequest('http://localhost/api/ai/companion/events', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function eventPatch(body: unknown) {
  return new NextRequest('http://localhost/api/ai/companion/events', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function deliveryPost(body: unknown) {
  return new NextRequest('http://localhost/api/ai/companion/delivery', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const resourceCards = [{
  resourceId: 'resource-1',
  versionHash: 'hash-1',
  reason: '巩固错题知识点',
  kind: 'interactive',
}];

beforeEach(() => {
  vi.resetAllMocks();
  process.env.KONLING_COMPANION_ENABLED = 'true';
  mocks.getServerSession.mockResolvedValue({ user: { id: 'student-1' } });
  mocks.runCompanionProactiveTurn.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.KONLING_COMPANION_ENABLED;
});

describe('POST /api/ai/companion/events', () => {
  it('rejects unauthenticated callers', async () => {
    mocks.getServerSession.mockResolvedValueOnce(null);
    const response = await postEvent(eventPost({
      pageKind: 'resource-textbook', pageRef: 'r-1', eventType: 'pause-candidate', signals: eligibleSignals,
    }));
    expect(response.status).toBe(401);
  });

  it('returns 404 when the companion flag is off', async () => {
    delete process.env.KONLING_COMPANION_ENABLED;
    const response = await postEvent(eventPost({
      pageKind: 'resource-textbook', pageRef: 'r-1', eventType: 'pause-candidate', signals: eligibleSignals,
    }));
    expect(response.status).toBe(404);
    expect(mocks.prisma.konlingCompanionEvent.create).not.toHaveBeenCalled();
  });

  it('suppresses pause candidates whose signals already fail', async () => {
    const response = await postEvent(eventPost({
      pageKind: 'resource-textbook',
      pageRef: 'r-1',
      eventType: 'pause-candidate',
      signals: { ...eligibleSignals, mediaPlaying: true },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'suppressed' });
    expect(mocks.prisma.konlingCompanionEvent.create).not.toHaveBeenCalled();
  });

  it('suppresses new events inside the cooldown window', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce({
      eventType: 'pause-candidate',
      createdAt: new Date(now.getTime() - 60_000),
    });
    const response = await postEvent(eventPost({
      pageKind: 'resource-textbook', pageRef: 'r-1', eventType: 'pause-candidate', signals: eligibleSignals,
    }));
    await expect(response.json()).resolves.toMatchObject({ status: 'suppressed', reason: 'cooldown' });
    expect(mocks.prisma.konlingCompanionEvent.create).not.toHaveBeenCalled();
  });

  it('stores pause candidates with candidate status and direct events confirmed', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValue(null);
    mocks.prisma.konlingCompanionEvent.create.mockImplementation(async ({ data }: { data: { status: string } }) => ({
      id: 'event-1', status: data.status,
    }));
    const pause = await postEvent(eventPost({
      pageKind: 'resource-textbook', pageRef: 'r-1', eventType: 'pause-candidate', signals: eligibleSignals,
    }));
    await expect(pause.json()).resolves.toMatchObject({ eventId: 'event-1', status: 'candidate' });

    const wrong = await postEvent(eventPost({
      pageKind: 'adaptive-practice', pageRef: 'practice-1', eventType: 'wrong-answer',
    }));
    await expect(wrong.json()).resolves.toMatchObject({ status: 'confirmed' });
  });
});

describe('PATCH /api/ai/companion/events', () => {
  it('confirms an eligible candidate inside the window', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce({
      id: 'event-1',
      userId: 'student-1',
      pageKind: 'resource-textbook',
      pageRef: 'r-1',
      eventType: 'pause-candidate',
      status: 'candidate',
      createdAt: new Date(now.getTime() - 20_000),
      confirmedAt: null,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    mocks.prisma.konlingCompanionEvent.update.mockResolvedValue({ id: 'event-1', status: 'confirmed' });
    const response = await PATCH(eventPatch({ eventId: 'event-1', signals: eligibleSignals }));
    await expect(response.json()).resolves.toMatchObject({ eventId: 'event-1', status: 'confirmed' });
    expect(mocks.prisma.konlingCompanionEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'confirmed', confirmedAt: expect.any(Date) } }),
    );
  });

  it('expires a candidate whose confirmation window has passed', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce({
      id: 'event-stale',
      userId: 'student-1',
      pageKind: 'resource-textbook',
      pageRef: 'r-1',
      eventType: 'pause-candidate',
      status: 'candidate',
      createdAt: new Date(now.getTime() - 120_000),
      confirmedAt: null,
      expiresAt: new Date(now.getTime() - 10_000),
    });
    const response = await PATCH(eventPatch({ eventId: 'event-stale', signals: eligibleSignals }));
    await expect(response.json()).resolves.toMatchObject({ status: 'expired' });
  });

  it('scopes candidate lookup to the caller', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce(null);
    const response = await PATCH(eventPatch({ eventId: 'other-user-event', signals: eligibleSignals }));
    expect(response.status).toBe(404);
    expect(mocks.prisma.konlingCompanionEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'student-1' }) }),
    );
  });
});

describe('POST /api/ai/companion/delivery', () => {
  const confirmedEvent = {
    id: 'event-1',
    userId: 'student-1',
    pageKind: 'adaptive-practice',
    pageRef: 'practice-1',
    eventType: 'wrong-answer',
    status: 'confirmed',
  };

  it('reuses the latest matching private session and writes a companion-origin assistant message', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce(confirmedEvent);
    mocks.prisma.konlingCompanionDelivery.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce({ id: 'session-9', messages: [] });
    mocks.prisma.konlingSession.update.mockResolvedValue({ id: 'session-9' });
    mocks.prisma.konlingCompanionDelivery.create.mockResolvedValue({ id: 'delivery-1' });
    mocks.prisma.konlingCompanionEvent.update.mockResolvedValue({ id: 'event-1' });

    const response = await postDelivery(deliveryPost({
      eventId: 'event-1', courseId: 'course-1', resources: resourceCards,
    }));
    await expect(response.json()).resolves.toMatchObject({ sessionId: 'session-9', deduplicated: false });

    const updateCall = mocks.prisma.konlingSession.update.mock.calls[0][0];
    const appended = updateCall.data.messages[0];
    expect(appended.role).toBe('assistant');
    expect(appended.origin).toBe('companion');
    expect(appended.companionContext.resources).toEqual(resourceCards);
    expect(mocks.prisma.konlingSession.create).not.toHaveBeenCalled();
  });

  it('creates a new private session when none matches', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce(confirmedEvent);
    mocks.prisma.konlingCompanionDelivery.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.create.mockResolvedValue({ id: 'session-new' });
    mocks.prisma.konlingCompanionDelivery.create.mockResolvedValue({ id: 'delivery-2' });
    mocks.prisma.konlingCompanionEvent.update.mockResolvedValue({ id: 'event-1' });

    const response = await postDelivery(deliveryPost({
      eventId: 'event-1', courseId: 'course-1', resources: resourceCards,
    }));
    await expect(response.json()).resolves.toMatchObject({ sessionId: 'session-new' });
    expect(mocks.prisma.konlingSession.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'student-1', courseId: 'course-1' }) }),
    );
  });

  it('deduplicates by the unique delivery constraint on concurrent tabs', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce(confirmedEvent);
    mocks.prisma.konlingCompanionDelivery.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.create.mockResolvedValue({ id: 'session-new' });
    mocks.prisma.konlingCompanionDelivery.create.mockRejectedValueOnce(new Error('unique'));
    mocks.prisma.konlingCompanionDelivery.findUnique.mockResolvedValueOnce({ sessionId: 'session-winner' });

    const response = await postDelivery(deliveryPost({
      eventId: 'event-1', courseId: 'course-1', resources: resourceCards,
    }));
    await expect(response.json()).resolves.toMatchObject({ sessionId: 'session-winner', deduplicated: true });
    expect(mocks.prisma.konlingCompanionEvent.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'delivered' } }),
    );
  });

  it('rejects missing resource-card fields without touching sessions', async () => {
    const response = await postDelivery(deliveryPost({
      eventId: 'event-1',
      courseId: 'course-1',
      resources: [{ resourceId: 'r', reason: 'x', kind: 'video' }],
    }));
    expect(response.status).toBe(400);
    expect(mocks.prisma.konlingSession.findFirst).not.toHaveBeenCalled();
  });

  it('allows an empty resource list (wrong-answer comfort without cards)', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce(confirmedEvent);
    mocks.prisma.konlingCompanionDelivery.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.create.mockResolvedValue({ id: 'session-empty' });
    mocks.prisma.konlingCompanionDelivery.create.mockResolvedValue({ id: 'delivery-3' });
    mocks.prisma.konlingCompanionEvent.update.mockResolvedValue({ id: 'event-1' });

    const response = await postDelivery(deliveryPost({ eventId: 'event-1', courseId: 'course-1' }));
    expect(response.status).toBe(201);
    const createCall = mocks.prisma.konlingSession.create.mock.calls[0][0];
    expect(createCall.data.messages[0].companionContext.resources).toEqual([]);
  });

  it('returns a bubble message that never leaks knowledge points', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce({ ...confirmedEvent, eventType: 'wrong-answer' });
    mocks.prisma.konlingCompanionDelivery.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce({ id: 'session-9', messages: [] });
    mocks.prisma.konlingSession.update.mockResolvedValue({ id: 'session-9' });
    mocks.prisma.konlingCompanionDelivery.create.mockResolvedValue({ id: 'delivery-4' });
    mocks.prisma.konlingCompanionEvent.update.mockResolvedValue({ id: 'event-1' });

    const response = await postDelivery(deliveryPost({
      eventId: 'event-1', courseId: 'course-1', resources: resourceCards,
    }));
    const body = await response.json();
    expect(body.message).toContain('没关系');
    expect(mocks.runCompanionProactiveTurn).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'wrong-answer', userId: 'student-1' }),
    );
  });

  it('appends a proactive-turn assistant message when generation succeeds', async () => {
    mocks.runCompanionProactiveTurn.mockResolvedValue('这题思路已经有了，我们一步步看。');
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce(confirmedEvent);
    mocks.prisma.konlingCompanionDelivery.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce({ id: 'session-9', messages: [] });
    mocks.prisma.konlingSession.update.mockResolvedValue({ id: 'session-9' });
    mocks.prisma.konlingCompanionDelivery.create.mockResolvedValue({ id: 'delivery-5' });
    mocks.prisma.konlingCompanionEvent.update.mockResolvedValue({ id: 'event-1' });
    // findUnique 按首条 update 已写入的 companion 消息回放（尾部 id 匹配才追加回合消息）。
    mocks.prisma.konlingSession.findUnique.mockImplementation(async () => {
      const first = mocks.prisma.konlingSession.update.mock.calls[0]?.[0];
      return first ? { messages: first.data.messages } : { messages: [] };
    });

    const response = await postDelivery(deliveryPost({
      eventId: 'event-1', courseId: 'course-1', resources: resourceCards,
    }));
    expect(response.status).toBe(201);
    expect(mocks.prisma.konlingSession.update).toHaveBeenCalledTimes(2);
    const secondUpdate = mocks.prisma.konlingSession.update.mock.calls[1][0];
    const turnMessage = secondUpdate.data.messages[secondUpdate.data.messages.length - 1];
    expect(turnMessage.role).toBe('assistant');
    expect(turnMessage.origin).toBe('companion');
    expect(turnMessage.content).toBe('这题思路已经有了，我们一步步看。');
    expect(turnMessage.metadata.companionProactiveTurn.eventId).toBe('event-1');
  });

  it('degrades silently when the proactive turn fails', async () => {
    mocks.runCompanionProactiveTurn.mockResolvedValue(null);
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce(confirmedEvent);
    mocks.prisma.konlingCompanionDelivery.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.konlingSession.findFirst.mockResolvedValueOnce({ id: 'session-9', messages: [] });
    mocks.prisma.konlingSession.update.mockResolvedValue({ id: 'session-9' });
    mocks.prisma.konlingCompanionDelivery.create.mockResolvedValue({ id: 'delivery-6' });
    mocks.prisma.konlingCompanionEvent.update.mockResolvedValue({ id: 'event-1' });

    const response = await postDelivery(deliveryPost({
      eventId: 'event-1', courseId: 'course-1', resources: resourceCards,
    }));
    expect(response.status).toBe(201);
    expect(mocks.prisma.konlingSession.update).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.konlingSession.findUnique).not.toHaveBeenCalled();
  });

  it('reuses an existing delivery for a delivered event with a bubble message', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce({ ...confirmedEvent, status: 'delivered' });
    mocks.prisma.konlingCompanionDelivery.findUnique.mockResolvedValueOnce({ sessionId: 'session-earlier' });

    const response = await postDelivery(deliveryPost({
      eventId: 'event-1', courseId: 'course-1', resources: resourceCards,
    }));
    await expect(response.json()).resolves.toMatchObject({
      sessionId: 'session-earlier',
      deduplicated: true,
      message: expect.any(String),
    });
    expect(mocks.runCompanionProactiveTurn).not.toHaveBeenCalled();
  });

  it('rejects events owned by another user', async () => {
    mocks.prisma.konlingCompanionEvent.findFirst.mockResolvedValueOnce(null);
    const response = await postDelivery(deliveryPost({
      eventId: 'foreign-event', courseId: 'course-1', resources: resourceCards,
    }));
    expect(response.status).toBe(404);
    expect(mocks.prisma.konlingCompanionEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'student-1' }) }),
    );
  });
});
