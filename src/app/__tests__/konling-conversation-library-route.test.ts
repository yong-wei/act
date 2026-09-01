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
      findMany: vi.fn(),
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
  resolveRegisteredAIContextFromPath: vi.fn(() => null),
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
    mocks.prisma.agentToolRun.findMany.mockResolvedValue([]);
  });

  it('lists only owner-visible retention-eligible conversations with title-only search and pin ordering', async () => {
    mocks.prisma.konlingSession.findMany.mockResolvedValue([record({ pinnedAt: now })]);
    const response = await listConversations(new NextRequest('http://localhost/api/ai/sessions?search=%E6%A0%B9%E8%BD%A8%E8%BF%B9'));
    expect(response.status).toBe(200);
    expect(mocks.prisma.konlingSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'user-1',
        libraryVisible: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
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

  it('reads, renames, pins and continues an older conversation without scheduled governance expiry', async () => {
    const older = record({
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      lastActivityAt: new Date('2026-06-01T00:00:00.000Z'),
      expiresAt: null,
    });
    mocks.prisma.konlingSession.findMany.mockResolvedValue([older]);
    const listResponse = await listConversations(new NextRequest('http://localhost/api/ai/sessions'));
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({
      conversations: [{ id: 'conversation-1', expiresAt: null }],
    });

    mocks.prisma.konlingSession.findFirst.mockResolvedValue(older);
    const readResponse = await getConversation(
      new NextRequest('http://localhost/api/ai/sessions/conversation-1'),
      routeContext,
    );
    expect(readResponse.status).toBe(200);
    expect(mocks.prisma.konlingSession.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'conversation-1',
        userId: 'user-1',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      }),
    });

    mocks.prisma.konlingSession.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.konlingSession.findUnique.mockResolvedValue(record({
      expiresAt: null,
      title: '旧会话新标题',
      titleIsManual: true,
      pinnedAt: now,
    }));
    const patchResponse = await patchConversation(new NextRequest('http://localhost/api/ai/sessions/conversation-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: '旧会话新标题', pinned: true }),
    }), routeContext);
    expect(patchResponse.status).toBe(200);
    expect(mocks.prisma.konlingSession.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'conversation-1',
        userId: 'user-1',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      }),
      data: {
        title: '旧会话新标题',
        titleIsManual: true,
        pinnedAt: expect.any(Date),
      },
    });
  });

  it('excludes a conversation whose explicit governed expiry has elapsed', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValue(null);
    const response = await getConversation(
      new NextRequest('http://localhost/api/ai/sessions/conversation-expired'),
      { params: Promise.resolve({ id: 'conversation-expired' }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Conversation not found' });
    expect(mocks.prisma.konlingSession.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      }),
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
      where: {
        id: 'conversation-1',
        userId: 'user-1',
        libraryVisible: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      },
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

  it('refuses deletion once the explicit governed expiry has elapsed', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValue(null);
    const response = await deleteConversation(new NextRequest('http://localhost/api/ai/sessions/conversation-1', {
      method: 'DELETE',
      body: JSON.stringify({ confirmed: true }),
    }), routeContext);
    expect(response.status).toBe(404);
    expect(mocks.prisma.konlingSession.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'conversation-1',
        userId: 'user-1',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      }),
      select: { id: true },
    });
    expect(mocks.prisma.konlingSession.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.agentSession.deleteMany).not.toHaveBeenCalled();
  });

  it('rolls back child deletions and reports not-found when a concurrent delete wins the race', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValue(record());
    mocks.prisma.konlingSession.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.agentSession.deleteMany.mockResolvedValue({ count: 1 });
    const response = await deleteConversation(new NextRequest('http://localhost/api/ai/sessions/conversation-1', {
      method: 'DELETE',
      body: JSON.stringify({ confirmed: true }),
    }), routeContext);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Conversation not found' });
  });

  it('rehydrates bounded owner-and-conversation-scoped legacy structured actions', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValue(record({
      messages: [{
        id: 'assistant-legacy',
        role: 'assistant',
        content: '已生成建议。',
        metadata: { konlingTurnId: 'turn-legacy' },
      }],
    }));
    mocks.prisma.agentToolRun.findMany.mockResolvedValue([
      {
        id: 'legacy-pending',
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
        approvalState: 'not_required',
        inputSummary: {
          turnId: 'turn-legacy',
          operation: 'bootstrap',
          proposedTask: {
            topic: '根轨迹',
            courseBasisId: 'private-basis',
          },
        },
        outputSummary: { privateReceipt: 'private-output' },
        errorSummary: null,
      },
      {
        id: 'legacy-terminal',
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
        approvalState: 'ignored',
        inputSummary: {
          turnId: 'turn-legacy',
          operation: 'revise',
          taskId: 'task-public',
          proposedTask: { topic: '闭环稳定性' },
        },
        outputSummary: { privateReceipt: 'private-terminal-output' },
        errorSummary: null,
      },
    ]);

    const response = await getConversation(
      new NextRequest('http://localhost/api/ai/sessions/conversation-1'),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(mocks.prisma.agentToolRun.findMany).toHaveBeenCalledWith({
      where: {
        ownerUserId: 'user-1',
        agentSession: { konlingSessionId: 'conversation-1' },
        toolName: 'propose_smart_lesson_task_change',
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true,
        toolName: true,
        status: true,
        approvalState: true,
        inputSummary: true,
        outputSummary: true,
        errorSummary: true,
      },
    });
    const encoded = JSON.stringify(await response.json());
    expect(encoded).toContain('"actionId":"legacy-pending"');
    expect(encoded).toContain('"state":"pending"');
    expect(encoded).toContain('"actionId":"legacy-terminal"');
    expect(encoded).toContain('"state":"ignored"');
    expect(encoded).not.toContain('private-basis');
    expect(encoded).not.toContain('private-output');
    expect(encoded).not.toContain('private-terminal-output');
  });

  it('refreshes an explicitly referenced old run outside the bounded legacy discovery window', async () => {
    mocks.prisma.konlingSession.findFirst.mockResolvedValue(record({
      messages: [{
        id: 'assistant-current',
        role: 'assistant',
        content: '请确认建议。',
        metadata: {
          konlingTurnId: 'turn-current',
          konlingStructuredActionTurn: {
            toolRuns: [{
              toolRunId: 'referenced-old-run',
              toolName: 'propose_smart_lesson_task_change',
              status: 'succeeded',
              approvalState: 'not_required',
              inputSummary: {
                publicActionId: 'public-current-action',
                turnId: 'turn-current',
                operation: 'bootstrap',
                proposedTask: { topic: '根轨迹' },
              },
            }],
          },
        },
      }],
    }));
    const discoveryWindow = Array.from({ length: 100 }, (_, index) => ({
      id: `newer-legacy-${index}`,
      toolName: 'propose_smart_lesson_task_change',
      status: 'succeeded',
      approvalState: 'ignored',
      inputSummary: {
        turnId: `other-turn-${index}`,
        operation: 'revise',
        proposedTask: { topic: `其他建议 ${index}` },
      },
      outputSummary: null,
      errorSummary: null,
    }));
    mocks.prisma.agentToolRun.findMany
      .mockResolvedValueOnce([{
        id: 'referenced-old-run',
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
        approvalState: 'approved',
        inputSummary: {},
        outputSummary: { actionState: 'applied' },
        errorSummary: null,
      }])
      .mockResolvedValueOnce(discoveryWindow);

    const response = await getConversation(
      new NextRequest('http://localhost/api/ai/sessions/conversation-1'),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(mocks.prisma.agentToolRun.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ['referenced-old-run'] },
        ownerUserId: 'user-1',
        agentSession: { konlingSessionId: 'conversation-1' },
      },
      select: {
        id: true,
        toolName: true,
        status: true,
        approvalState: true,
        inputSummary: true,
        outputSummary: true,
        errorSummary: true,
      },
    });
    expect(mocks.prisma.agentToolRun.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        ownerUserId: 'user-1',
        agentSession: { konlingSessionId: 'conversation-1' },
        toolName: 'propose_smart_lesson_task_change',
      },
      take: 100,
    }));
    const encoded = JSON.stringify(await response.json());
    expect(encoded).toContain('"actionId":"public-current-action"');
    expect(encoded).toContain('"state":"applied"');
    expect(encoded).not.toContain('newer-legacy-');
  });

  it('preserves applied, ignored, and conflict action states after rename and pin', async () => {
    const actionRuns = [
      ['applied-run', 'not_required', 'approved', 'applied'],
      ['ignored-run', 'not_required', 'ignored', 'ignored'],
      ['conflict-run', 'not_required', 'conflict', 'conflict'],
    ] as const;
    const messages = actionRuns.map(([id, persistedApprovalState]) => ({
      id: `assistant-${id}`,
      role: 'assistant',
      content: '请确认建议。',
      metadata: {
        konlingTurnId: `turn-${id}`,
        konlingStructuredActionTurn: {
          toolRuns: [{
            toolRunId: id,
            toolName: 'propose_smart_lesson_task_change',
            status: 'succeeded',
            approvalState: persistedApprovalState,
            inputSummary: {
              publicActionId: `public-${id}`,
              turnId: `turn-${id}`,
              operation: 'revise',
              taskId: 'task-1',
              proposedTask: { topic: id },
            },
          }],
        },
      },
    }));
    mocks.prisma.konlingSession.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.konlingSession.findUnique.mockResolvedValue(record({
      title: '终态会话',
      titleIsManual: true,
      pinnedAt: now,
      messages,
    }));
    mocks.prisma.agentToolRun.findMany
      .mockResolvedValueOnce(actionRuns.map(([id, , currentApprovalState]) => ({
        id,
        toolName: 'propose_smart_lesson_task_change',
        status: 'succeeded',
        approvalState: currentApprovalState,
        inputSummary: {},
        outputSummary: null,
        errorSummary: null,
      })))
      .mockResolvedValueOnce([]);

    const response = await patchConversation(new NextRequest('http://localhost/api/ai/sessions/conversation-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: '终态会话', pinned: true }),
    }), routeContext);

    expect(response.status).toBe(200);
    expect(mocks.prisma.agentToolRun.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: {
        id: { in: ['applied-run', 'ignored-run', 'conflict-run'] },
        ownerUserId: 'user-1',
        agentSession: { konlingSessionId: 'conversation-1' },
      },
    }));
    expect(mocks.prisma.agentToolRun.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        ownerUserId: 'user-1',
        agentSession: { konlingSessionId: 'conversation-1' },
        toolName: 'propose_smart_lesson_task_change',
      },
      take: 100,
    }));
    const responseMessages = (await response.json()).messages as Array<{
      metadata?: { konlingSmartPreparationActions?: Array<{ state: string }> };
    }>;
    expect(responseMessages.map((message) =>
      message.metadata?.konlingSmartPreparationActions?.[0]?.state,
    )).toEqual(['applied', 'ignored', 'conflict']);
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
      where: {
        id: 'conversation-1',
        userId: 'teacher-1',
        libraryVisible: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: expect.any(Date) } },
        ],
      },
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
