import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  verifyKonlingRuntimeScope: vi.fn(),
  prisma: {
    konlingSession: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    teachingResource: {
      findUnique: vi.fn(),
    },
    knowledgeNode: {
      findUnique: vi.fn(),
    },
    agentSession: {
      deleteMany: vi.fn(),
    },
    agentToolRun: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/konling-agent-runtime', () => ({
  verifyKonlingRuntimeScope: mocks.verifyKonlingRuntimeScope,
}));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));
vi.mock('@/lib/course-ai-contexts', () => ({
  getStepAIContext: vi.fn(() => ({
    courseId: 'course-1',
    stepId: 'page-1',
    courseTitle: '受控课程',
  })),
}));
vi.mock('@/lib/ai-context-resolver', () => ({
  resolveAIContext: vi.fn(() => ({
    pageContext: null,
    enabled: false,
    tools: [],
    quickQuestions: [],
  })),
}));

import { GET as listConversations, POST as createConversation } from '@/app/api/ai/sessions/route';
import {
  DELETE as deleteConversation,
  GET as getConversation,
  PATCH as patchConversation,
} from '@/app/api/ai/sessions/[id]/route';

const routeContext = { params: Promise.resolve({ id: 'conversation-1' }) };
const now = new Date('2026-07-26T00:00:00.000Z');

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation-1',
    userId: 'user-1',
    courseId: 'course-1',
    pageId: 'page-1',
    title: '根轨迹',
    titleIsManual: false,
    pinnedAt: null,
    lastActivityAt: now,
    libraryVisible: true,
    migrationSourceId: null,
    messages: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('Konling conversation library routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'STUDENT' } });
    mocks.verifyKonlingRuntimeScope.mockResolvedValue({
      ok: true,
      scope: {
        authenticatedUserId: 'user-1',
        targetUserId: 'user-1',
        role: 'student',
        courseId: 'course-1',
        pageId: 'page-1',
        classId: null,
        resourceId: 'forged-resource',
        pathNodeId: 'forged-path',
        privacyScopes: ['self'],
      },
    });
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('lists only owner-visible unexpired conversations with title-only search and pin ordering', async () => {
    mocks.prisma.konlingSession.findMany.mockResolvedValue([record({ pinnedAt: now })]);
    const response = await listConversations(new NextRequest('http://localhost/api/ai/sessions?search=%E6%A0%B9%E8%BD%A8%E8%BF%B9'));
    expect(response.status).toBe(200);
    expect(mocks.prisma.konlingSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'user-1',
        libraryVisible: true,
        expiresAt: { gt: expect.any(Date) },
        title: { contains: '根轨迹', mode: 'insensitive' },
      },
      orderBy: [
        { pinnedAt: { sort: 'desc', nulls: 'last' } },
        { lastActivityAt: 'desc' },
        { id: 'desc' },
      ],
    }));
    expect(await response.json()).toMatchObject({
      conversations: [{ id: 'conversation-1', pinned: true }],
    });
  });

  it('creates a new blank conversation with one server-authored initiating context', async () => {
    mocks.prisma.konlingSession.create.mockImplementation(async ({ data }) => record({
      ...data,
      title: '新对话',
      messages: data.messages,
    }));
    const response = await createConversation(new NextRequest('http://localhost/api/ai/sessions', {
      method: 'POST',
      body: JSON.stringify({
        courseId: 'forged-course',
        pageId: 'forged-page',
        pageContext: { courseId: 'forged-course', stepId: 'forged-page', secret: 'not-persisted' },
      }),
    }));
    expect(response.status).toBe(201);
    const createInput = mocks.prisma.konlingSession.create.mock.calls[0]?.[0].data;
    expect(createInput.userId).toBe('user-1');
    expect(createInput.messages).toHaveLength(1);
    expect(createInput.messages[0]).toMatchObject({
      role: 'system',
      metadata: {
        konlingContextEvent: {
          courseId: 'course-1',
          pageId: 'page-1',
        },
      },
    });
    expect(JSON.stringify(createInput.messages)).not.toContain('not-persisted');
    expect(JSON.stringify(createInput.messages)).not.toContain('forged-course');
    expect(JSON.stringify(createInput.messages)).not.toContain('forged-page');
    expect(JSON.stringify(createInput.messages)).not.toContain('forged-resource');
    expect(JSON.stringify(createInput.messages)).not.toContain('forged-path');
  });

  it('reads, renames, pins, and deletes only through owner-scoped predicates', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValue(record());
    const readResponse = await getConversation(
      new NextRequest('http://localhost/api/ai/sessions/conversation-1'),
      routeContext,
    );
    expect(readResponse.status).toBe(200);
    expect(mocks.prisma.konlingSession.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'conversation-1', userId: 'user-1' }),
    });

    mocks.prisma.konlingSession.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.konlingSession.findUnique.mockResolvedValue(record({
      title: '手工标题',
      titleIsManual: true,
      pinnedAt: now,
    }));
    const patchResponse = await patchConversation(new NextRequest('http://localhost/api/ai/sessions/conversation-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: ' 手工标题 ', pinned: true }),
    }), routeContext);
    expect(patchResponse.status).toBe(200);
    expect(mocks.prisma.konlingSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'conversation-1', userId: 'user-1' }),
      data: {
        title: '手工标题',
        titleIsManual: true,
        pinnedAt: expect.any(Date),
      },
    });

    const unconfirmed = await deleteConversation(new NextRequest('http://localhost/api/ai/sessions/conversation-1', {
      method: 'DELETE',
      body: JSON.stringify({ confirmed: false }),
    }), routeContext);
    expect(unconfirmed.status).toBe(400);
    expect(mocks.prisma.konlingSession.deleteMany).not.toHaveBeenCalled();

    mocks.prisma.konlingSession.findFirst.mockResolvedValue(record());
    mocks.prisma.konlingSession.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.agentSession.deleteMany.mockResolvedValue({ count: 1 });
    const deleted = await deleteConversation(new NextRequest('http://localhost/api/ai/sessions/conversation-1', {
      method: 'DELETE',
      body: JSON.stringify({ confirmed: true }),
    }), routeContext);
    expect(deleted.status).toBe(200);
    expect(mocks.prisma.konlingSession.deleteMany).toHaveBeenCalledWith({
      where: { id: 'conversation-1', userId: 'user-1' },
    });
    expect(mocks.prisma.agentSession.deleteMany).toHaveBeenCalledWith({
      where: {
        konlingSessionId: 'conversation-1',
        ownerUserId: 'user-1',
        actorUserId: 'user-1',
      },
    });
    expect(mocks.prisma.agentToolRun.deleteMany).not.toHaveBeenCalled();
  });

  it('returns the same not-found response for another owner', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValue(null);
    const response = await getConversation(
      new NextRequest('http://localhost/api/ai/sessions/conversation-other'),
      { params: Promise.resolve({ id: 'conversation-other' }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Conversation not found' });
  });

  it('deletes only a teacher-owned message library and preserves student-target tool audit rows', async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.prisma.konlingSession.findFirst.mockResolvedValue(record({ userId: 'teacher-1' }));
    mocks.prisma.konlingSession.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.agentSession.deleteMany.mockResolvedValue({ count: 0 });
    const response = await deleteConversation(new NextRequest('http://localhost/api/ai/sessions/conversation-1', {
      method: 'DELETE',
      body: JSON.stringify({ confirmed: true }),
    }), routeContext);
    expect(response.status).toBe(200);
    expect(mocks.prisma.konlingSession.deleteMany).toHaveBeenCalledWith({
      where: { id: 'conversation-1', userId: 'teacher-1' },
    });
    expect(mocks.prisma.agentSession.deleteMany).toHaveBeenCalledWith({
      where: {
        konlingSessionId: 'conversation-1',
        ownerUserId: 'teacher-1',
        actorUserId: 'teacher-1',
      },
    });
    expect(mocks.prisma.agentToolRun.deleteMany).not.toHaveBeenCalled();
  });
});
