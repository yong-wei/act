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
  refreshKonlingStructuredActionToolRuns,
  replaceKonlingConversationAssistantRevision,
  resolveKonlingContextEventScope,
  serializeKonlingConversation,
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
  it('serializes structured actions through a bounded public projection', () => {
    const serialized = serializeKonlingConversation(conversation({
      messages: [{
        id: 'assistant-action',
        role: 'assistant',
        content: '',
        parts: [{
          type: 'dynamic-tool',
          toolCallId: 'provider-call-private',
          toolName: 'propose_smart_lesson_task_change',
          state: 'output-available',
          input: { raw: 'private-input' },
          output: { raw: 'private-output' },
        }],
        metadata: {
          konlingStructuredActionTurn: {
            toolRuns: [{
              toolRunId: 'action-public',
              agentSessionId: 'session-private',
              toolName: 'propose_smart_lesson_task_change',
              approvalState: 'not_required',
              inputSummary: {
                publicActionId: 'public-action',
                operation: 'revise',
                taskId: 'task-public',
                turnId: 'turn-private',
                proposedTask: {
                  topic: '闭环稳定性',
                  knowledgePoints: [{ title: '劳斯判据', sourceBindings: [{ raw: 'private' }] }],
                  goals: [{ content: '判断闭环稳定性' }],
                },
              },
              outputSummary: { raw: 'private-output-summary' },
              errorSummary: { raw: 'private-error' },
              idempotencyKey: 'private-key',
              correlationId: 'private-correlation',
            }],
          },
        },
      }],
    }));
    const encoded = JSON.stringify(serialized.messages);

    expect(encoded).toContain('public-action');
    expect(encoded).not.toContain('action-public');
    expect(encoded).toContain('闭环稳定性');
    expect(encoded).toContain('劳斯判据');
    expect(encoded).not.toContain('session-private');
    expect(encoded).not.toContain('turn-private');
    expect(encoded).not.toContain('private-output');
    expect(encoded).not.toContain('private-error');
    expect(encoded).not.toContain('private-key');
    expect(encoded).not.toContain('private-correlation');
    expect(encoded).not.toContain('propose_smart_lesson_task_change');
  });

  it('removes raw adaptive-path tool data and internal identifiers from the public DTO', () => {
    const serialized = serializeKonlingConversation(conversation({
      messages: [{
        id: 'assistant-adaptive',
        role: 'assistant',
        content: '已生成学习建议。',
        parts: [
          { type: 'text', text: '已生成学习建议。' },
          {
            type: 'dynamic-tool',
            toolCallId: 'stable-tool-call-private',
            toolName: 'recommend_next_action',
            state: 'output-error',
            input: {
              targetUserId: 'target-user-private',
              actorUserId: 'actor-user-private',
              idempotencyKey: 'idempotency-private',
            },
            errorText: 'session-private correlation-private',
          },
        ],
        metadata: {
          agentSessionId: 'session-private',
          correlationId: 'correlation-private',
          idempotencyKey: 'idempotency-private',
          konlingStructuredActionTurn: {
            toolRuns: [{
              toolRunId: 'stable-tool-run-private',
              toolName: 'recommend_next_action',
              inputSummary: {
                targetUserId: 'target-user-private',
                actorUserId: 'actor-user-private',
              },
              outputSummary: { targetUserId: 'target-user-private' },
            }],
          },
        },
      }],
    }));
    const encoded = JSON.stringify(serialized.messages);

    expect(encoded).toContain('已生成学习建议。');
    for (const privateValue of [
      'target-user-private',
      'actor-user-private',
      'stable-tool-call-private',
      'stable-tool-run-private',
      'session-private',
      'correlation-private',
      'idempotency-private',
      'recommend_next_action',
    ]) {
      expect(encoded).not.toContain(privateValue);
    }
  });

  it('projects prerequisite and outline-only revisions as readable differences', () => {
    const serialized = serializeKonlingConversation(conversation({
      messages: [{
        id: 'assistant-action',
        role: 'assistant',
        content: '',
        metadata: {
          konlingStructuredActionTurn: {
            toolRuns: [{
              toolRunId: 'action-public',
              toolName: 'propose_smart_lesson_task_change',
              approvalState: 'not_required',
              inputSummary: {
                publicActionId: 'public-action',
                operation: 'revise',
                taskId: 'task-public',
                changedFields: ['prerequisites', 'outlineConfirmationRequired'],
                proposedTask: {
                  prerequisites: '已掌握拉普拉斯变换',
                  outlineConfirmationRequired: true,
                  courseBasisId: 'basis-private',
                  sourceVersionIds: ['version-private'],
                },
              },
            }],
          },
        },
      }],
    }));
    const encoded = JSON.stringify(serialized.messages);

    expect(encoded).toContain('已掌握拉普拉斯变换');
    expect(encoded).toContain('"outlineConfirmationRequired":true');
    expect(encoded).not.toContain('basis-private');
    expect(encoded).not.toContain('version-private');
  });

  it('projects bootstrap course basis and sources as bounded labels without raw ids', () => {
    const serialized = serializeKonlingConversation(conversation({
      messages: [{
        id: 'assistant-action',
        role: 'assistant',
        metadata: {
          konlingStructuredActionTurn: {
            toolRuns: [{
              toolRunId: 'action-public',
              toolName: 'propose_smart_lesson_task_change',
              approvalState: 'not_required',
              inputSummary: {
                publicActionId: 'public-action',
                operation: 'bootstrap',
                proposedTask: {
                  courseBasisId: 'basis-private',
                  sourceVersionIds: ['version-private'],
                  topic: '根轨迹',
                },
                publicBasisSummary: {
                  title: '自动控制原理',
                  sources: ['根轨迹讲义 v3'],
                },
              },
            }],
          },
        },
      }],
    }));
    const encoded = JSON.stringify(serialized.messages);

    expect(encoded).toContain('自动控制原理');
    expect(encoded).toContain('根轨迹讲义 v3');
    expect(encoded).not.toContain('basis-private');
    expect(encoded).not.toContain('version-private');
  });

  it('refreshes persisted structured-action state without rerunning the tool', () => {
    const messages = [{
      id: 'assistant-1',
      role: 'assistant' as const,
      content: '',
      metadata: {
        konlingStructuredActionTurn: {
          toolRuns: [{
            toolRunId: 'tool-run-1',
            approvalState: 'not_required',
            outputSummary: { status: 'awaiting_teacher_confirmation' },
          }],
        },
      },
    }];
    const refreshed = refreshKonlingStructuredActionToolRuns(messages as never, [{
      id: 'tool-run-1',
      approvalState: 'ignored',
      outputSummary: { actionState: 'ignored' },
      errorSummary: null,
    }]);

    expect(refreshed[0]?.metadata).toMatchObject({
      konlingStructuredActionTurn: {
        toolRuns: [{
          toolRunId: 'tool-run-1',
          approvalState: 'ignored',
          outputSummary: { actionState: 'ignored' },
        }],
      },
    });
  });

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

  it('persists current-turn tool-run lineage with a pure-tool assistant message for reload', async () => {
    const store = statefulConversationDb();
    const toolRunStartedAt = new Date(now.getTime() + 1);
    const findToolRuns = vi.fn(async () => [{
      id: 'tool-run-1',
      agentSessionId: 'agent-session-1',
      toolName: 'get_plan_context',
      status: 'succeeded',
      approvalState: 'not_required',
      inputSummary: { pathId: '[redacted]' },
      outputSummary: { readiness: 'ready' },
      errorSummary: null,
      idempotencyKey: 'turn-1:get-plan',
      correlationId: 'agent-session-1:get_plan_context:1',
      startedAt: toolRunStartedAt,
      completedAt: new Date(toolRunStartedAt.getTime() + 5),
    }]);
    Object.assign(store.db, {
      agentToolRun: {
        findMany: findToolRuns,
      },
    });
    await claimKonlingConversationTurn(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      currentScope: { courseId: 'course-a', pageId: 'page-a' },
      userMessage: { id: 'turn-with-tool', role: 'user', content: '读取计划' },
      now,
    });
    await completeKonlingConversationTurn(store.db as never, {
      conversationId: 'conversation-1',
      ownerUserId: 'user-1',
      turnId: 'turn-with-tool',
      assistantMessage: {
        id: 'assistant-tool-only',
        role: 'assistant',
        parts: [{
          type: 'dynamic-tool',
          toolCallId: 'provider-call-1',
          toolName: 'get_plan_context',
          state: 'output-available',
          input: {},
          output: { readiness: 'ready' },
        }],
      },
      now: new Date(now.getTime() + 10),
    });

    const assistant = (store.current().messages as unknown as Array<Record<string, any>>)
      .find((message) => message.id === 'assistant-tool-only');
    expect(assistant?.content).toBe('');
    expect(assistant?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'dynamic-tool',
        state: 'output-available',
      }),
    ]));
    expect(assistant?.metadata?.konlingStructuredActionTurn).toMatchObject({
      turnId: 'turn-with-tool',
      terminal: true,
      toolRuns: [{
        toolRunId: 'tool-run-1',
        toolName: 'get_plan_context',
        status: 'succeeded',
        idempotencyKey: 'turn-1:get-plan',
      }],
    });
    expect(findToolRuns).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ownerUserId: 'user-1',
        agentSession: {
          konlingSessionId: 'conversation-1',
          stateJson: {
            path: ['currentTurnId'],
            equals: 'turn-with-tool',
          },
        },
      }),
    }));
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
          metadata: {
            konlingMessageRevision: { revision: 1 },
            konlingStructuredActionTurn: {
              toolRuns: [{ toolRunId: 'tool-run-1', approvalState: 'not_required' }],
            },
          },
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
      metadata: {
        konlingMessageRevision: { revision: 2 },
        konlingStructuredActionTurn: {
          toolRuns: [{ toolRunId: 'tool-run-1', approvalState: 'not_required' }],
        },
      },
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
