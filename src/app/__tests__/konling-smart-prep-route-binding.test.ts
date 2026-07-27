import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  getServerSession: vi.fn(),
  resolveServerModeContext: vi.fn(),
  getOrCreateAgentSession: vi.fn(),
  resumeAgentSession: vi.fn(),
  streamText: vi.fn(),
  generateText: vi.fn(async () => ({ text: '[]' })),
  buildScopedTools: vi.fn(),
  emittedChunks: [] as any[],
  useActualResolver: false,
  prisma: {
    agentSession: { findFirst: vi.fn(), updateMany: vi.fn() },
    agentToolRun: { findMany: vi.fn() },
    smartLessonTask: { findFirst: vi.fn() },
    konlingSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('next-auth', () => ({ getServerSession: mocks.getServerSession }));
vi.mock('@/lib/auth', () => ({
  authOptions: {},
  getServerAuthSession: mocks.getServerAuthSession,
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/ai-client', () => ({
  SYSTEM_PROMPT: 'system',
  buildContextAwarePrompt: vi.fn(() => 'system'),
  getConfiguredAIModel: vi.fn(async () => ({})),
  isConfiguredAIServiceAvailable: vi.fn(async () => true),
}));
vi.mock('@/lib/ai-prompt-builder', () => ({ buildKonlingSystemPrompt: vi.fn(() => 'system') }));
vi.mock('@/lib/ai-tools', () => ({ aiTools: {}, updateSimulationState: vi.fn() }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));
vi.mock('@/lib/course-ai-contexts', () => ({
  getStepAIContext: vi.fn((courseId: string, stepId: string) => ({
    courseId,
    stepId,
    courseTitle: '受控课程',
  })),
}));
vi.mock('@/lib/ai-context-resolver', () => ({
  resolveRegisteredAIContextFromPath: vi.fn(() => null),
}));
vi.mock('@/lib/konling-streaming-citation-fallback', () => ({
  buildStreamingCitationFallbackNotice: vi.fn(() => null),
  insertStreamingCitationFallbackNotice: vi.fn((stream) => stream),
}));
vi.mock('@/lib/konling-final-citation-metadata-stream', () => ({
  appendFinalCitationGuardMetadata: vi.fn((stream) => stream),
}));
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    convertToModelMessages: vi.fn(async (messages) => messages),
    consumeStream: vi.fn(),
    createUIMessageStreamResponse: vi.fn(({ headers, stream }) => {
      void (async () => {
        const reader = stream.getReader();
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          mocks.emittedChunks.push(next.value);
        }
      })();
      return new Response('ok', { status: 200, headers });
    }),
    generateText: mocks.generateText,
    isToolUIPart: actual.isToolUIPart,
    stepCountIs: vi.fn(() => () => false),
    streamText: mocks.streamText,
  };
});
vi.mock('@/lib/konling-teaching-assistant-server-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/konling-teaching-assistant-server-context')>();
  return {
    ...actual,
    resolveKonlingTeachingAssistantScopeOverride: vi.fn(async () => ({})),
    resolveKonlingTeachingAssistantServerModeContext: (...args: Parameters<typeof actual.resolveKonlingTeachingAssistantServerModeContext>) => (
      mocks.useActualResolver
        ? actual.resolveKonlingTeachingAssistantServerModeContext(...args)
        : mocks.resolveServerModeContext(...args)
    ),
  };
});
vi.mock('@/lib/konling-agent-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/konling-agent-runtime')>();
  return {
    ...actual,
    applyKonlingCitationFallback: vi.fn((content) => content),
    buildKonlingCitationGuard: vi.fn(() => ({
      status: 'grounded',
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      diagnosticReasons: [],
      personalizationAvailability: 'available',
      citations: [],
    })),
    buildKonlingCitationRetrievalSources: vi.fn(() => []),
    buildKonlingRuntimeContext: vi.fn(async () => ({ pageContext: {}, userProfile: {}, citationContext: [] })),
    buildKonlingSarAssociatedGroundingMetadataPayload: vi.fn(() => null),
    buildKonlingStreamingCitationGuard: vi.fn(() => ({
      status: 'grounded',
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      diagnosticReasons: [],
      personalizationAvailability: 'available',
      citations: [],
    })),
    buildKonlingTeachingAssistantRuntimeContract: vi.fn(() => ({
      mode: { id: 'prep-coauthor' },
      status: 'ready',
      unavailableReasons: [],
      degradedReasons: [],
      clientHintsRejected: [],
      groundingContext: { missingContext: [], sarAssociatedGrounding: null },
      permittedTools: [],
      smartPreparation: { bootstrap: false },
    })),
    buildKonlingToolRuntime: vi.fn(() => ({ getAssignedCitations: () => [] })),
    buildScopedKonlingAiTools: mocks.buildScopedTools,
    getOrCreateKonlingAgentSession: mocks.getOrCreateAgentSession,
    normalizeKonlingKnowledgeWorkspaceHint: vi.fn(() => null),
    persistKonlingSessionMemories: vi.fn(async () => undefined),
    resumeKonlingAgentSession: mocks.resumeAgentSession,
    serializeKonlingCitationMetadata: vi.fn((citation) => citation),
    verifyKonlingRuntimeScope: vi.fn(async (_db, input) => ({
      ok: true,
      scope: {
        authenticatedUserId: input.authenticatedUserId,
        targetUserId: input.targetUserId,
        role: 'teacher',
        classId: input.classId ?? null,
        courseId: input.courseId,
        pageId: input.pageId,
        resourceId: input.resourceId ?? null,
        pathNodeId: input.pathNodeId ?? null,
        privacyScopes: ['teacher-scoped'],
      },
    })),
  };
});

import { POST as chatPOST } from '@/app/api/ai/chat/route';
import { POST as sessionMessagePOST } from '@/app/api/ai/sessions/[id]/messages/route';

const serverContext = {
  smartPreparation: {
    taskId: 'server-task',
    taskRevision: '7',
    selectedCourseBasisVersions: [],
    unresolvedAmbiguities: [],
    confirmedDecisions: [],
    citationState: 'missing',
    reviewState: 'draft',
    clarificationReadiness: { status: 'ready' as const, canGenerate: true, unresolvedAmbiguityIds: [] },
    updatePolicy: {
      suggestionStatus: 'draft' as const,
      requiresExplicitTeacherConfirmation: true as const,
      expectedTaskRevision: '7',
    },
  },
};

function expectStructuredProposalSteps(streamTextCall: Record<string, unknown>) {
  expect(streamTextCall.stopWhen).toEqual(expect.any(Function));
  expect(streamTextCall.prepareStep).toEqual(expect.any(Function));
  const prepareStep = streamTextCall.prepareStep as (input: { stepNumber: number }) => unknown;
  expect(prepareStep({ stepNumber: 0 })).toEqual({
    activeTools: ['propose_smart_lesson_task_change'],
    toolChoice: { type: 'tool', toolName: 'propose_smart_lesson_task_change' },
  });
  expect(prepareStep({ stepNumber: 1 })).toEqual({ activeTools: [], toolChoice: 'none' });
}

function mockCompletedSessionAssistant(parts: any[], id = 'assistant-structured-terminal') {
  mocks.streamText.mockResolvedValue({
    toUIMessageStream: (options: {
      onFinish?: (event: Record<string, unknown>) => Promise<void> | void;
    }) => new ReadableStream({
      async start(controller) {
        await options.onFinish?.({
          responseMessage: {
            id,
            role: 'assistant',
            parts,
          },
          isAborted: false,
        });
        controller.close();
      },
    }),
  });
}

describe('Konling smart-prep production routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.useActualResolver = false;
    mocks.emittedChunks.length = 0;
    mocks.buildScopedTools.mockReturnValue({});
    mocks.prisma.agentToolRun.findMany.mockResolvedValue([]);
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER', name: 'Teacher' } });
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER', name: 'Teacher' } });
    mocks.resolveServerModeContext.mockResolvedValue(serverContext);
    mocks.getOrCreateAgentSession.mockResolvedValue({ id: 'agent-1', state: {}, pendingApproval: null });
    mocks.resumeAgentSession.mockResolvedValue({ id: 'agent-1', pendingApproval: null });
    mocks.prisma.agentSession.updateMany.mockResolvedValue({ count: 1 });
    let currentConversation = {
      id: 'session-1',
      userId: 'teacher-1',
      courseId: 'course-1',
      pageId: '/teacher/smart-prep',
      title: '新对话',
      titleIsManual: false,
      messages: [],
      libraryVisible: true,
      activeTurnId: null,
      activeTurnClaimedAt: null,
      updatedAt: new Date('2026-07-26T00:00:00.000Z'),
      expiresAt: new Date('2026-08-02T00:00:00.000Z'),
    };
    mocks.prisma.konlingSession.findUnique.mockImplementation(async () => ({ ...currentConversation }));
    mocks.prisma.konlingSession.findFirst.mockImplementation(async () => ({ ...currentConversation }));
    mocks.prisma.konlingSession.update.mockResolvedValue({});
    mocks.prisma.konlingSession.updateMany.mockImplementation(async ({ data }) => {
      currentConversation = { ...currentConversation, ...data };
      return { count: 1 };
    });
    mocks.streamText.mockResolvedValue({
      textStream: (async function* () { yield 'answer'; })(),
      toUIMessageStream: (options: {
        onFinish?: (event: Record<string, unknown>) => Promise<void> | void;
      }) => new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'start', messageId: 'assistant-1' });
          controller.enqueue({ type: 'start-step' });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'answer' });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({ type: 'finish-step' });
          await options.onFinish?.({
            responseMessage: {
              id: 'assistant-1',
              role: 'assistant',
              parts: [{ type: 'text', text: 'answer' }],
            },
            isAborted: false,
          });
          controller.enqueue({ type: 'finish' });
          controller.close();
        },
      }),
    });
  });

  it('chat route derives the AgentSession binding from verified server context, not client hints', async () => {
    const response = await chatPOST(new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ id: 'm1', role: 'user', content: 'help' }],
        courseId: 'course-1',
        pageId: '/teacher/smart-prep',
        teachingAssistantModeId: 'prep-coauthor',
        agentSessionId: 'agent-from-client',
        modeClientContextHints: { smartTaskId: 'client-task', smartTaskRevision: '999' },
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.getOrCreateAgentSession).toHaveBeenCalledWith(mocks.prisma, expect.objectContaining({
      agentSessionId: 'agent-from-client',
      smartPrepBinding: { taskId: 'server-task', taskRevision: '7' },
    }));
    expectStructuredProposalSteps(mocks.streamText.mock.calls[0]?.[0]);
  });

  it('persists a fragmented pure-tool proposal and emits its public action metadata immediately', async () => {
    const executeProposal = vi.fn(async () => ({
      suggestionId: 'internal-tool-run',
      status: 'awaiting_teacher_confirmation',
    }));
    mocks.buildScopedTools.mockReturnValue({
      propose_smart_lesson_task_change: {
        inputSchema: {
          safeParse: (value: unknown) => ({ success: true, data: value }),
        },
        execute: executeProposal,
      },
    });
    mocks.prisma.agentToolRun.findMany.mockResolvedValue([{
      id: 'internal-tool-run',
      agentSessionId: 'agent-1',
      toolName: 'propose_smart_lesson_task_change',
      status: 'succeeded',
      approvalState: 'not_required',
      inputSummary: {
        publicActionId: 'public-action-1',
        operation: 'revise',
        taskId: 'server-task',
        changedFields: ['topic'],
        proposedTask: { topic: '根轨迹' },
      },
      outputSummary: { status: 'awaiting_teacher_confirmation' },
      errorSummary: null,
      idempotencyKey: 'private-idempotency',
      correlationId: 'private-correlation',
      startedAt: new Date('2026-07-26T00:00:01.000Z'),
      completedAt: new Date('2026-07-26T00:00:01.010Z'),
    }]);
    mocks.streamText.mockResolvedValue({
      toUIMessageStream: (options: {
        onFinish?: (event: Record<string, unknown>) => Promise<void> | void;
        onError?: (error: unknown) => string;
      }) => new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'start', messageId: 'assistant-tool-only' });
          controller.enqueue({
            type: 'tool-input-start',
            toolCallId: 'provider-call-1',
            toolName: 'propose_smart_lesson_task_change',
          });
          controller.enqueue({
            type: 'tool-input-delta',
            toolCallId: 'provider-call-1',
            inputTextDelta: '{"operation":"revise","taskId":"server-task","expectedRevision":7,',
          });
          controller.enqueue({
            type: 'tool-input-delta',
            toolCallId: 'provider-call-1',
            inputTextDelta: '"proposedTask":{"topic":"根轨迹"}}',
          });
          controller.enqueue({ type: 'finish-step' });
          controller.enqueue({ type: 'text-start', id: 'text-failure' });
          controller.enqueue({
            type: 'text-delta',
            id: 'text-failure',
            delta: '结构化操作未能安全完成，请重新生成建议。',
          });
          controller.enqueue({ type: 'text-end', id: 'text-failure' });
          controller.enqueue({
            type: 'error',
            errorText: options.onError?.(new Error('provider-native-tool-input-incomplete')),
          });
          await options.onFinish?.({
            responseMessage: {
              id: 'assistant-tool-only',
              role: 'assistant',
              parts: [],
            },
            isAborted: false,
          });
          controller.enqueue({ type: 'finish' });
          controller.close();
        },
      }),
    });

    const response = await chatPOST(new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: 'session-1',
        messages: [{ id: 'user-tool-only', role: 'user', content: '把主题改为根轨迹' }],
        courseId: 'course-1',
        pageId: '/teacher/smart-prep',
        teachingAssistantModeId: 'prep-coauthor',
      }),
    }));

    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(mocks.emittedChunks.some((chunk) =>
        chunk.type === 'data-konling-message-revision'
        && chunk.data?.metadata?.konlingSmartPreparationActions?.[0]?.actionId === 'public-action-1'
      )).toBe(true);
    });
    expect(executeProposal).toHaveBeenCalledTimes(1);
    const revision = mocks.emittedChunks.find((chunk) =>
      chunk.type === 'data-konling-message-revision'
      && chunk.data?.metadata?.konlingSmartPreparationActions?.[0]?.actionId === 'public-action-1');
    const encodedRevision = JSON.stringify(revision);
    expect(encodedRevision).toContain('public-action-1');
    expect(encodedRevision).toContain('根轨迹');
    expect(encodedRevision).not.toContain('internal-tool-run');
    expect(encodedRevision).not.toContain('private-idempotency');
    expect(encodedRevision).not.toContain('private-correlation');
    const persistedMessages = mocks.prisma.konlingSession.updateMany.mock.calls
      .filter((call) => Array.isArray(call[0].data.messages))
      .at(-1)?.[0].data.messages;
    expect(persistedMessages?.some((message: { id?: string; role: string }) =>
      message.id === 'assistant-tool-only' && message.role === 'assistant'
    )).toBe(true);
  });

  it('releases a force-structured turn when the external provider closes without finish', async () => {
    mocks.streamText.mockResolvedValue({
      toUIMessageStream: (options: {
        onError?: (error: unknown) => string;
      }) => new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'start', messageId: 'assistant-provider-error' });
          controller.enqueue({
            type: 'error',
            errorText: options.onError?.(new Error('provider connection closed')),
          });
          controller.close();
        },
      }),
    });

    const response = await chatPOST(new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: 'session-1',
        messages: [{ id: 'user-provider-error', role: 'user', content: '生成建议' }],
        courseId: 'course-1',
        pageId: '/teacher/smart-prep',
        teachingAssistantModeId: 'prep-coauthor',
      }),
    }));

    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(mocks.prisma.konlingSession.updateMany.mock.calls.some((call) =>
        call[0].data.activeTurnId === null
        && call[0].data.activeTurnClaimedAt === null
      )).toBe(true);
    });
    expect(mocks.emittedChunks.some((chunk) =>
      chunk.type === 'data-konling-message-revision'
      && chunk.data?.messageId === 'assistant-provider-error'
    )).toBe(false);
  });

  it('session message route applies the same server binding to create and resume', async () => {
    const response = await sessionMessagePOST(new NextRequest('http://localhost/api/ai/sessions/session-1/messages', {
      method: 'POST',
      body: JSON.stringify({
        content: 'help',
        teachingAssistantModeId: 'prep-coauthor',
        agentSessionId: 'agent-from-client',
        modeClientContextHints: { smartTaskId: 'client-task', smartTaskRevision: '999' },
      }),
    }), { params: Promise.resolve({ id: 'session-1' }) });

    expect(response.status).toBe(200);
    expect(mocks.getOrCreateAgentSession).toHaveBeenCalledWith(mocks.prisma, expect.objectContaining({
      agentSessionId: 'agent-from-client',
      smartPrepBinding: { taskId: 'server-task', taskRevision: '7' },
    }));
    expect(mocks.resumeAgentSession).toHaveBeenCalledWith(mocks.prisma, expect.objectContaining({
      agentSessionId: 'agent-1',
      smartPrepBinding: { taskId: 'server-task', taskRevision: '7' },
    }));
    expectStructuredProposalSteps(mocks.streamText.mock.calls[0]?.[0]);
  });

  it.each([
    {
      label: 'output-error',
      part: {
        type: 'dynamic-tool',
        toolCallId: 'native-error',
        toolName: 'get_page_context',
        state: 'output-error',
        input: {},
        errorText: 'private provider failure',
      },
    },
    {
      label: 'output-denied',
      part: {
        type: 'tool-get_page_context',
        toolCallId: 'block-denied',
        state: 'output-denied',
        input: {},
        denialReason: 'private provider denial',
      },
    },
  ])('returns a safe failure body for a bodyless native $label terminal state', async ({ part }) => {
    const execute = vi.fn();
    mocks.buildScopedTools.mockReturnValue({
      get_page_context: {
        inputSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
        execute,
      },
    });
    mockCompletedSessionAssistant([part]);

    const response = await sessionMessagePOST(new NextRequest('http://localhost/api/ai/sessions/session-1/messages', {
      method: 'POST',
      body: JSON.stringify({
        content: '读取当前页面',
        teachingAssistantModeId: 'prep-coauthor',
      }),
    }), { params: Promise.resolve({ id: 'session-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.assistantMessage.content).toBe('结构化操作未能安全完成，请重新生成建议。');
    expect(JSON.stringify(payload)).not.toContain('private provider');
    expect(execute).not.toHaveBeenCalled();
  });

  it('keeps the success fallback for a bodyless successful native tool result', async () => {
    const execute = vi.fn();
    mocks.buildScopedTools.mockReturnValue({
      get_page_context: {
        inputSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
        execute,
      },
    });
    mockCompletedSessionAssistant([{
      type: 'dynamic-tool',
      toolCallId: 'native-success',
      toolName: 'get_page_context',
      state: 'output-available',
      input: {},
      output: { page: 'current' },
    }]);

    const response = await sessionMessagePOST(new NextRequest('http://localhost/api/ai/sessions/session-1/messages', {
      method: 'POST',
      body: JSON.stringify({
        content: '读取当前页面',
        teachingAssistantModeId: 'prep-coauthor',
      }),
    }), { params: Promise.resolve({ id: 'session-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.assistantMessage.content).toBe('已完成结构化操作。');
    expect(execute).not.toHaveBeenCalled();
  });

  it('preserves an existing assistant body when a native tool part failed', async () => {
    mockCompletedSessionAssistant([
      {
        type: 'dynamic-tool',
        toolCallId: 'native-error-with-body',
        toolName: 'get_page_context',
        state: 'output-error',
        input: {},
        errorText: 'private provider failure',
      },
      { type: 'text', text: '未能读取页面，请稍后重试。' },
    ]);

    const response = await sessionMessagePOST(new NextRequest('http://localhost/api/ai/sessions/session-1/messages', {
      method: 'POST',
      body: JSON.stringify({
        content: '读取当前页面',
        teachingAssistantModeId: 'prep-coauthor',
      }),
    }), { params: Promise.resolve({ id: 'session-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.assistantMessage.content).toBe('未能读取页面，请稍后重试。');
    expect(JSON.stringify(payload)).not.toContain('private provider failure');
  });

  it('keeps the existing DSML execution path for bodyless structured calls', async () => {
    const execute = vi.fn(async () => ({ page: 'current' }));
    mocks.buildScopedTools.mockReturnValue({
      get_page_context: {
        inputSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
        execute,
      },
    });
    mockCompletedSessionAssistant([{
      type: 'text',
      text: '<tool_call>{"name":"get_page_context","arguments":{}}</tool_call>',
    }], 'assistant-dsml-success');

    const response = await sessionMessagePOST(new NextRequest('http://localhost/api/ai/sessions/session-1/messages', {
      method: 'POST',
      body: JSON.stringify({
        content: '读取当前页面',
        teachingAssistantModeId: 'prep-coauthor',
      }),
    }), { params: Promise.resolve({ id: 'session-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.assistantMessage.content).toBe('已完成结构化操作。');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('withholds a non-JSON tool envelope and publishes only the bounded correction', async () => {
    const execute = vi.fn();
    mocks.buildScopedTools.mockReturnValue({
      get_page_context: {
        inputSchema: { safeParse: (value: unknown) => ({ success: true, data: value }) },
        execute,
      },
    });
    mocks.generateText.mockResolvedValueOnce({ text: '结构化操作未完成，请重新生成建议。' });
    mockCompletedSessionAssistant([{
      type: 'text',
      text: '安全前缀。<tool_call>get_page_context</tool_call>private suffix',
    }], 'assistant-non-json-envelope');

    const response = await sessionMessagePOST(new NextRequest('http://localhost/api/ai/sessions/session-1/messages', {
      method: 'POST',
      body: JSON.stringify({
        content: '读取当前页面',
        teachingAssistantModeId: 'prep-coauthor',
      }),
    }), { params: Promise.resolve({ id: 'session-1' }) });
    const payload = await response.json();
    const encoded = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.assistantMessage.content).toBe('结构化操作未完成，请重新生成建议。');
    expect(encoded).not.toContain('tool_call');
    expect(encoded).not.toContain('private suffix');
    expect(execute).not.toHaveBeenCalled();
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 0,
      maxOutputTokens: 500,
      abortSignal: expect.any(AbortSignal),
    }));
  });

  it('uses the task identity to resolve the current server revision', async () => {
    mocks.useActualResolver = true;
    mocks.prisma.smartLessonTask.findFirst.mockResolvedValue({
      id: 'server-task', ownerId: 'teacher-1', revision: 7, topic: '稳定性', audience: '本科生', durationMinutes: 45,
      scopeConfirmedAt: new Date('2026-07-19T00:00:00Z'), goalsConfirmedAt: new Date('2026-07-19T00:00:00Z'),
      sources: [{ sourceVersionId: 'version-1', sourceVersion: { reviewState: 'CONFIRMED', retiredAt: null } }],
      knowledgePoints: [{ id: 'kp-1', state: 'CONFIRMED', title: '稳定性' }],
      goals: [{ id: 'goal-1', state: 'CONFIRMED', content: '判断稳定性' }],
    });
    const response = await chatPOST(new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ id: 'm1', role: 'user', content: '继续修订' }],
        courseId: 'course-1', pageId: '/teacher/smart-prep', teachingAssistantModeId: 'prep-coauthor',
        modeClientContextHints: { smartTaskId: 'server-task', smartTaskRevision: '7' },
      }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.prisma.smartLessonTask.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'server-task', ownerId: 'teacher-1' },
    }));
    expect(mocks.getOrCreateAgentSession).toHaveBeenCalledWith(mocks.prisma, expect.objectContaining({
      smartPrepBinding: { taskId: 'server-task', taskRevision: '7' },
    }));
  });

  it('keeps conversationId separate from AgentSession and persists a cross-page exchange after stream completion', async () => {
    const createdAt = new Date('2026-07-26T00:00:00.000Z');
    const initialContext = {
      id: 'context-a',
      role: 'system',
      content: '[控灵当前页面上下文]\ncourseId=course-1\npageId=page-a',
      parts: [{ type: 'text', text: '[控灵当前页面上下文]\ncourseId=course-1\npageId=page-a' }],
      metadata: {
        konlingContextEvent: {
          version: 1,
          identity: 'course-1\u001fpage-a\u001f\u001f\u001f',
          courseId: 'course-1',
          pageId: 'page-a',
          classId: null,
          resourceId: null,
          pathNodeId: null,
        },
      },
    };
    const conversation = {
      id: 'conversation-1',
      userId: 'teacher-1',
      courseId: 'course-1',
      pageId: 'page-a',
      title: '新对话',
      titleIsManual: false,
      pinnedAt: null,
      lastActivityAt: createdAt,
      libraryVisible: true,
      migrationSourceId: null,
      activeTurnId: null,
      activeTurnClaimedAt: null,
      messages: [initialContext],
      createdAt,
      updatedAt: createdAt,
      expiresAt: new Date('2026-08-02T00:00:00.000Z'),
    };
    let currentConversation = { ...conversation };
    mocks.prisma.konlingSession.findFirst.mockImplementation(async () => ({ ...currentConversation }));
    mocks.prisma.konlingSession.findUnique.mockImplementation(async () => ({ ...currentConversation }));
    mocks.prisma.konlingSession.updateMany.mockImplementation(async ({ data }) => {
      currentConversation = { ...currentConversation, ...data };
      return { count: 1 };
    });
    mocks.prisma.agentSession.findFirst.mockResolvedValue(null);
    mocks.streamText.mockResolvedValue({
      toUIMessageStream: (options: {
        onFinish?: (event: Record<string, unknown>) => Promise<void>;
      }) => {
        void options.onFinish?.({
          responseMessage: {
            id: 'assistant-1',
            role: 'assistant',
            content: '跨页答案',
            parts: [
              {
                type: 'dynamic-tool',
                toolCallId: 'tool-1',
                toolName: 'search_textbook',
                state: 'output-available',
                input: { query: '跨页' },
                output: { candidates: ['教材证据'] },
              },
              { type: 'text', text: '跨页答案' },
            ],
          },
          isAborted: false,
        });
        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start', messageId: 'assistant-1' });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: '跨页答案' });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({ type: 'finish' });
            controller.close();
          },
        });
      },
    });

    const response = await chatPOST(new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: 'conversation-1',
        agentSessionId: 'agent-from-another-context',
        messages: [{ id: 'user-cross-page', role: 'user', content: '结合当前页继续' }],
        courseId: 'course-1',
        pageId: 'page-b',
        teachingAssistantModeId: 'prep-coauthor',
        modeClientContextHints: { smartTaskId: 'client-task', smartTaskRevision: '999' },
      }),
    }));
    await vi.waitFor(() => {
      const persisted = mocks.prisma.konlingSession.updateMany.mock.calls
        .filter((call) => Array.isArray(call[0].data.messages))
        .at(-1)?.[0].data.messages;
      expect(persisted?.some((message: { role: string }) => message.role === 'assistant')).toBe(true);
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Konling-Conversation-Id')).toBe('conversation-1');
    expect(mocks.getOrCreateAgentSession).toHaveBeenCalledWith(mocks.prisma, expect.objectContaining({
      agentSessionId: undefined,
      konlingSessionId: 'conversation-1',
    }));
    const persistedMessages = mocks.prisma.konlingSession.updateMany.mock.calls
      .filter((call) => Array.isArray(call[0].data.messages))
      .at(-1)?.[0].data.messages;
    expect(persistedMessages).toBeDefined();
    expect(persistedMessages.map((message: { role: string }) => message.role)).toEqual([
      'system',
      'system',
      'user',
      'assistant',
    ]);
    expect(persistedMessages.at(-1)?.parts).toEqual([
      {
        type: 'dynamic-tool',
        toolCallId: 'tool-1',
        toolName: 'search_textbook',
        state: 'output-available',
        input: { query: '跨页' },
        output: { candidates: ['教材证据'] },
      },
      { type: 'text', text: '跨页答案' },
    ]);
    expect(persistedMessages[1]).toMatchObject({
      metadata: {
        konlingContextEvent: {
          courseId: 'course-1',
          pageId: 'page-b',
        },
      },
    });
    expect(conversation.messages).toEqual([initialContext]);
  });
});
