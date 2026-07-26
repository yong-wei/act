import { describe, expect, it, vi } from 'vitest';
import {
  buildKonlingContextIdentity,
  claimKonlingConversationTurn,
  completeKonlingConversationTurn,
  createKonlingContextEvent,
  createKonlingMessageId,
  deriveKonlingConversationTitle,
  KonlingConversationTurnConflictError,
  prepareKonlingConversationTurn,
  releaseKonlingConversationTurn,
  replaceKonlingConversationAssistantRevision,
  resolveKonlingContextEventScope,
} from '@/lib/konling-conversation-library';

const now = new Date('2026-07-26T00:00:00.000Z');

function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conversation-1',
    userId: 'user-1',
    courseId: 'course-a',
    pageId: 'page-a',
    title: '新对话',
    titleIsManual: false,
    pinnedAt: null,
    lastActivityAt: now,
    libraryVisible: true,
    activeTurnId: null,
    activeTurnClaimedAt: null,
    messages: [createKonlingContextEvent({ courseId: 'course-a', pageId: 'page-a' }, 'context-a')] as never,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  };
}

function statefulConversationDb(initial = conversation()) {
  let state = { ...initial };
  const db = {
    konlingSession: {
      findFirst: vi.fn(async ({ where }) => {
        if (where.id !== state.id || where.userId !== state.userId) return null;
        if (where.libraryVisible === true && !state.libraryVisible) return null;
        if (where.expiresAt?.gt && state.expiresAt <= where.expiresAt.gt) return null;
        return { ...state };
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        if (
          where.id !== state.id
          || where.userId !== state.userId
          || (Object.hasOwn(where, 'updatedAt') && where.updatedAt !== state.updatedAt)
          || (Object.hasOwn(where, 'activeTurnId') && where.activeTurnId !== state.activeTurnId)
          || (Object.hasOwn(where, 'titleIsManual') && where.titleIsManual !== state.titleIsManual)
        ) {
          return { count: 0 };
        }
        state = { ...state, ...data };
        return { count: 1 };
      }),
      findUnique: vi.fn(async ({ where }) => where.id === state.id ? { ...state } : null),
    },
    $transaction: vi.fn(),
  };
  return { db, current: () => state };
}

describe('Konling conversation library', () => {
  it('authorizes smart-prep conversations against the server-owned course basis', async () => {
    const findFirst = vi.fn(async ({ where }) => (
      where.id === 'basis-1' && where.ownerId === 'teacher-1' ? { id: 'basis-1' } : null
    ));
    const db = { courseBasis: { findFirst } };

    await expect(resolveKonlingContextEventScope(db as never, {
      authenticatedUserId: 'teacher-1',
      role: 'teacher',
      courseId: 'basis-1',
      pageId: '/teacher/smart-prep',
    })).resolves.toMatchObject({
      courseId: 'basis-1',
      pageId: '/teacher/smart-prep',
    });
    await expect(resolveKonlingContextEventScope(db as never, {
      authenticatedUserId: 'teacher-2',
      role: 'teacher',
      courseId: 'basis-1',
      pageId: '/teacher/smart-prep',
    })).resolves.toBeNull();
  });

  it('accepts registered routes and rejects arbitrary inferred page contexts', async () => {
    for (const [courseId, pageId] of [
      ['knowledge', '/knowledge'],
      ['arena', '/arena'],
      ['data-center', '/data-center'],
      ['simulation', '/simulations/cruise'],
    ]) {
      await expect(resolveKonlingContextEventScope({} as never, {
        authenticatedUserId: 'user-1',
        role: 'student',
        courseId,
        pageId,
      })).resolves.toMatchObject({ courseId, pageId: pageId === '/simulations/cruise' ? 'cruise' : pageId });
    }
    await expect(resolveKonlingContextEventScope({} as never, {
      authenticatedUserId: 'user-1',
      role: 'student',
      courseId: 'forged-page',
      pageId: '/forged-page',
    })).resolves.toBeNull();
  });

  it('authorizes only bounded bootstrap and path-advisor entry contexts', async () => {
    await expect(resolveKonlingContextEventScope({} as never, {
      authenticatedUserId: 'teacher-1',
      role: 'teacher',
      courseId: 'smart-prep',
      pageId: '/teacher/smart-prep',
    })).resolves.toMatchObject({ courseId: 'smart-prep', pageId: '/teacher/smart-prep' });
    await expect(resolveKonlingContextEventScope({} as never, {
      authenticatedUserId: 'student-1',
      role: 'student',
      courseId: 'control-correction',
      pageId: 'adaptive-path-center',
    })).resolves.toMatchObject({ courseId: 'control-correction', pageId: 'adaptive-path-center' });
    await expect(resolveKonlingContextEventScope({} as never, {
      authenticatedUserId: 'student-1',
      role: 'student',
      courseId: 'client-invented-goal',
      pageId: 'adaptive-path-center',
    })).resolves.toBeNull();
  });

  it('does not duplicate same-page context and appends cross-page context immediately before the user message', () => {
    const original = conversation();
    const originalSnapshot = JSON.stringify(original.messages);
    const samePage = prepareKonlingConversationTurn({
      conversation: original,
      currentScope: { courseId: 'course-a', pageId: 'page-a' },
      userMessage: { id: 'user-1', role: 'user', content: '继续解释' },
    });
    expect(samePage.contextAppended).toBe(false);
    expect(samePage.turnMessages.map((message) => message.role)).toEqual(['user']);

    const crossPage = prepareKonlingConversationTurn({
      conversation: original,
      currentScope: {
        courseId: 'course-a',
        pageId: 'page-b',
        resourceId: 'resource-1',
      },
      userMessage: { id: 'user-2', role: 'user', content: '结合当前页解释' },
    });
    expect(crossPage.contextAppended).toBe(true);
    expect(crossPage.turnMessages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(crossPage.turnMessages[0]?.metadata).toMatchObject({
      konlingContextEvent: {
        identity: buildKonlingContextIdentity({
          courseId: 'course-a',
          pageId: 'page-b',
          resourceId: 'resource-1',
        }),
        courseId: 'course-a',
        pageId: 'page-b',
        resourceId: 'resource-1',
      },
    });
    expect(JSON.stringify(original.messages)).toBe(originalSnapshot);
  });

  it('claims the user turn before completion, generates a redacted title, and never overwrites a manual title', async () => {
    const automatic = statefulConversationDb();
    const claim = await claimKonlingConversationTurn(automatic.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      currentScope: { courseId: 'course-a', pageId: 'page-a' },
      userMessage: { id: 'turn-1', role: 'user', content: '请联系 test@example.com 解释根轨迹' },
      now,
    });
    expect(claim?.modelMessages.at(-1)).toMatchObject({ id: 'turn-1', role: 'user' });
    await completeKonlingConversationTurn(automatic.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      turnId: 'turn-1',
      assistantMessage: { id: 'answer-1', role: 'assistant', content: '根轨迹描述闭环极点。' },
      now,
    });
    expect(automatic.current()).toMatchObject({
      title: '请联系 [隐私信息] 解释根轨迹',
      activeTurnId: null,
      activeTurnClaimedAt: null,
    });

    const manual = statefulConversationDb(conversation({ title: '我的根轨迹复习', titleIsManual: true }));
    await claimKonlingConversationTurn(manual.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      currentScope: { courseId: 'course-a', pageId: 'page-a' },
      userMessage: { id: 'turn-2', role: 'user', content: '新问题' },
      now,
    });
    await completeKonlingConversationTurn(manual.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      turnId: 'turn-2',
      assistantMessage: { id: 'answer-2', role: 'assistant', content: '新答案' },
      now,
    });
    expect(manual.current().title).toBe('我的根轨迹复习');
  });

  it('keeps title derivation bounded by Unicode characters', () => {
    expect(Array.from(deriveKonlingConversationTitle('控'.repeat(100)))).toHaveLength(64);
  });

  it('CAS-replaces the same assistant message revision without appending a second message', async () => {
    const initial = conversation({
      messages: [
        createKonlingContextEvent({ courseId: 'course-a', pageId: 'page-a' }, 'context-a'),
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '初始正文',
          metadata: { konlingMessageRevision: { revision: 1 } },
        },
      ],
    });
    const store = statefulConversationDb(initial);
    await replaceKonlingConversationAssistantRevision(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      assistantMessage: {
        id: 'assistant-1',
        role: 'assistant',
        content: '修复后正文 [1]',
        metadata: { konlingMessageRevision: { revision: 2 } },
      },
      expectedRevision: 1,
      revision: 2,
      now,
    });

    const assistants = (store.current().messages as unknown as Array<Record<string, unknown>>)
      .filter((message) => message.role === 'assistant');
    expect(assistants).toHaveLength(1);
    expect(assistants[0]).toMatchObject({
      id: 'assistant-1',
      content: '修复后正文 [1]',
      metadata: { konlingMessageRevision: { revision: 2 } },
    });
  });

  it('retries a bounded CAS conflict and gives up without replacing after three conflicts', async () => {
    const initial = conversation({
      messages: [{
        id: 'assistant-1',
        role: 'assistant',
        content: '初始正文',
        metadata: { konlingMessageRevision: { revision: 1 } },
      }],
    });
    const retrying = statefulConversationDb(initial);
    const update = retrying.db.konlingSession.updateMany.getMockImplementation()!;
    let conflicts = 0;
    retrying.db.konlingSession.updateMany.mockImplementation(async (args) => {
      if (conflicts < 2) {
        conflicts += 1;
        return { count: 0 };
      }
      return update(args);
    });
    await expect(replaceKonlingConversationAssistantRevision(retrying.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      assistantMessage: {
        id: 'assistant-1',
        role: 'assistant',
        content: '最终正文',
        metadata: { konlingMessageRevision: { revision: 2 } },
      },
      expectedRevision: 1,
      revision: 2,
      now,
    })).resolves.not.toBeNull();
    expect(retrying.db.konlingSession.updateMany).toHaveBeenCalledTimes(3);

    const exhausted = statefulConversationDb(initial);
    exhausted.db.konlingSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(replaceKonlingConversationAssistantRevision(exhausted.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      assistantMessage: {
        id: 'assistant-1',
        role: 'assistant',
        content: '不应写入',
        metadata: { konlingMessageRevision: { revision: 2 } },
      },
      expectedRevision: 1,
      revision: 2,
      now,
    })).resolves.toBeNull();
    expect(exhausted.db.konlingSession.updateMany).toHaveBeenCalledTimes(3);
    expect((exhausted.current().messages as unknown as Array<{ content: string }>)[0].content)
      .toBe('初始正文');
  });

  it('generates unique message ids for concurrent turns created in the same millisecond', () => {
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(1_722_000_000_000);
    const ids = Array.from({ length: 100 }, () => createKonlingMessageId());
    expect(new Set(ids)).toHaveLength(ids.length);
    dateNow.mockRestore();
  });

  it('returns null without exposing a conversation outside the owner or retention scope', async () => {
    const db = {
      konlingSession: {
        findFirst: vi.fn(async () => null),
      },
      $transaction: vi.fn(),
    };
    await expect(claimKonlingConversationTurn(db as never, {
      conversationId: 'conversation-other',
      ownerUserId: 'user-1',
      currentScope: { courseId: 'course-a', pageId: 'page-a' },
      userMessage: { id: 'turn-1', role: 'user', content: '问题' },
      now,
    })).resolves.toBeNull();
    expect(db.konlingSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'conversation-other',
        userId: 'user-1',
        libraryVisible: true,
        expiresAt: { gt: now },
      },
    });
  });

  it('allows only one of four concurrent requests to claim model execution and never loses the delivered exchange', async () => {
    const store = statefulConversationDb();
    const attempts = await Promise.allSettled(
      Array.from({ length: 4 }, (_, index) => claimKonlingConversationTurn(store.db as never, {
        conversationId: 'conversation-1',
        ownerUserId: 'user-1',
        currentScope: { courseId: 'course-a', pageId: 'page-a' },
        userMessage: { id: `turn-${index + 1}`, role: 'user', content: `问题 ${index + 1}` },
        now,
      })),
    );
    const claimed = attempts.filter((result) => result.status === 'fulfilled' && result.value);
    const conflicts = attempts.filter((result) =>
      result.status === 'rejected' && result.reason instanceof KonlingConversationTurnConflictError
    );
    expect(claimed).toHaveLength(1);
    expect(conflicts).toHaveLength(3);

    const winner = claimed[0] as PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof claimKonlingConversationTurn>>>>;
    await completeKonlingConversationTurn(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      turnId: winner.value.turnId,
      assistantMessage: { id: 'delivered-answer', role: 'assistant', content: '已交付答案' },
      now,
    });
    expect(store.current().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: winner.value.turnId, role: 'user' }),
      expect.objectContaining({ id: 'delivered-answer', role: 'assistant' }),
    ]));
    expect(store.current().activeTurnId).toBeNull();
  });

  it('removes only the failed pending turn before a retry', async () => {
    const store = statefulConversationDb();
    await claimKonlingConversationTurn(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      currentScope: { courseId: 'course-a', pageId: 'page-a' },
      userMessage: { id: 'failed-turn', role: 'user', content: '会失败的问题' },
      now,
    });
    await releaseKonlingConversationTurn(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      turnId: 'failed-turn',
    });
    expect(store.current().messages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'failed-turn' }),
    ]));
    expect(store.current().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'context-a' }),
    ]));
    expect(store.current().activeTurnId).toBeNull();
  });

  it('completes a leased turn despite concurrent title or pin metadata updates', async () => {
    const store = statefulConversationDb();
    await claimKonlingConversationTurn(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      currentScope: { courseId: 'course-a', pageId: 'page-a' },
      userMessage: { id: 'turn-with-metadata-race', role: 'user', content: '问题' },
      now,
    });
    const claimed = store.current();
    const renamedAt = new Date(now.getTime() + 1);
    Object.assign(claimed, {
      title: '并发人工标题',
      titleIsManual: true,
      pinnedAt: renamedAt,
      updatedAt: renamedAt,
    });

    await completeKonlingConversationTurn(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      turnId: 'turn-with-metadata-race',
      assistantMessage: { id: 'answer-after-metadata-race', role: 'assistant', content: '答案' },
      now: renamedAt,
    });
    expect(store.current()).toMatchObject({
      title: '并发人工标题',
      pinnedAt: renamedAt,
      activeTurnId: null,
    });
    expect(store.current().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'answer-after-metadata-race' }),
    ]));
  });

  it('preserves a manual rename committed after completion reads the conversation', async () => {
    const store = statefulConversationDb();
    await claimKonlingConversationTurn(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      currentScope: { courseId: 'course-a', pageId: 'page-a' },
      userMessage: { id: 'turn-with-rename-race', role: 'user', content: '自动标题来源' },
      now,
    });

    store.db.konlingSession.findFirst.mockImplementationOnce(async () => {
      const snapshot = { ...store.current() };
      Object.assign(store.current(), {
        title: '并发人工重命名',
        titleIsManual: true,
      });
      return snapshot;
    });

    await completeKonlingConversationTurn(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      turnId: 'turn-with-rename-race',
      assistantMessage: { id: 'answer-after-rename-race', role: 'assistant', content: '答案' },
      now,
    });

    expect(store.current()).toMatchObject({
      title: '并发人工重命名',
      titleIsManual: true,
      activeTurnId: null,
    });
    expect(store.current().messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'answer-after-rename-race' }),
    ]));
  });
});
