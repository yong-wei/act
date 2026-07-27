import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  getServerSession: vi.fn(),
  resolveScopeOverride: vi.fn(),
  resolveServerModeContext: vi.fn(),
  buildPrompt: vi.fn(),
  buildRuntimeContext: vi.fn(),
  buildRuntimeContract: vi.fn(),
  verifyRuntimeScope: vi.fn(),
  getOrCreateAgentSession: vi.fn(),
  resumeAgentSession: vi.fn(),
  streamText: vi.fn(),
  useActualResolver: false,
  prisma: {
    agentSession: { findFirst: vi.fn(), updateMany: vi.fn() },
    smartLessonTask: { findFirst: vi.fn() },
    learningEvidenceDraft: { findMany: vi.fn() },
    learningFact: { findMany: vi.fn() },
    studentProfile: { findFirst: vi.fn(), findMany: vi.fn() },
    teachingResource: { findMany: vi.fn() },
    class: { findUnique: vi.fn() },
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
vi.mock('@/lib/ai-prompt-builder', () => ({ buildKonlingSystemPrompt: mocks.buildPrompt }));
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
vi.mock('ai', () => ({
  convertToModelMessages: vi.fn(async (messages) => messages),
  consumeStream: vi.fn(),
  createUIMessageStreamResponse: vi.fn(({ headers, stream }) => {
    void (async () => {
      const reader = stream.getReader();
      while (!(await reader.read()).done) {
        // Drain the stream so final message revision persistence runs.
      }
    })();
    return new Response('ok', { status: 200, headers });
  }),
  generateText: vi.fn(async () => ({ text: '[]' })),
  stepCountIs: vi.fn(() => () => false),
  streamText: mocks.streamText,
}));
vi.mock('@/lib/konling-teaching-assistant-server-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/konling-teaching-assistant-server-context')>();
  return {
    ...actual,
    resolveKonlingTeachingAssistantScopeOverride: mocks.resolveScopeOverride,
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
    buildKonlingRuntimeContext: mocks.buildRuntimeContext,
    buildKonlingSarAssociatedGroundingMetadataPayload: vi.fn(() => null),
    buildKonlingStreamingCitationGuard: vi.fn(() => ({
      status: 'grounded',
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      diagnosticReasons: [],
      personalizationAvailability: 'available',
      citations: [],
    })),
    buildKonlingTeachingAssistantRuntimeContract: mocks.buildRuntimeContract,
    buildKonlingToolRuntime: vi.fn(() => ({ getAssignedCitations: () => [] })),
    buildScopedKonlingAiTools: vi.fn(() => ({})),
    getOrCreateKonlingAgentSession: mocks.getOrCreateAgentSession,
    normalizeKonlingKnowledgeWorkspaceHint: vi.fn(() => null),
    persistKonlingSessionMemories: vi.fn(async () => undefined),
    resumeKonlingAgentSession: mocks.resumeAgentSession,
    serializeKonlingCitationMetadata: vi.fn((citation) => citation),
    verifyKonlingRuntimeScope: mocks.verifyRuntimeScope,
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

describe('Konling smart-prep production routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.useActualResolver = false;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER', name: 'Teacher' } });
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER', name: 'Teacher' } });
    mocks.resolveScopeOverride.mockResolvedValue({});
    mocks.resolveServerModeContext.mockResolvedValue(serverContext);
    mocks.buildPrompt.mockReturnValue('system');
    mocks.buildRuntimeContext.mockImplementation(async (_db, input) => ({
      pageContext: {
        courseId: input.courseId,
        courseTitle: input.courseId,
        pageType: 'theory',
        stepId: input.pageId,
        topic: input.pageId,
        learningObjectives: [],
        knowledgeType: 'C',
        candidateGraph: input.serverAuthorizedCandidateGraph ?? null,
      },
      userProfile: {},
      citationContext: {
        required: true,
        contentCitations: [],
        evidenceCitations: [],
        missingCitationClasses: [],
        lowConfidenceReasons: [],
      },
      permittedTools: [],
    }));
    mocks.buildRuntimeContract.mockImplementation(({ modeId }) => ({
      mode: { id: modeId ?? 'generic-chat' },
      status: 'ready',
      unavailableReasons: [],
      degradedReasons: [],
      clientHintsRejected: [],
      groundingContext: { missingContext: [], sarAssociatedGrounding: null },
      permittedTools: [],
      smartPreparation: modeId === 'prep-coauthor' ? { bootstrap: false } : null,
    }));
    mocks.verifyRuntimeScope.mockImplementation(async (_db, input) => ({
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
        candidateGraph: input.pageContextHint?.candidateGraph
          ? {
              ...input.pageContextHint.candidateGraph,
              selectedCanonicalType: 'Formula',
              coverageStatus: 'ready',
              objectCount: 7,
              relationCount: 9,
            }
          : null,
      },
    }));
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
      toUIMessageStream: () => new ReadableStream(),
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
    'grading-assistant',
    'feedback-explainer',
    'class-summarizer',
    'prep-coauthor',
  ])('keeps candidate routes isolated from %s mode readers and forged hints', async (forgedMode) => {
    const candidateGraph = {
      authorityState: 'candidate',
      releaseSetId: 'actkg-authoritative-candidate-v1',
      releaseId: 'root-locus-engineering-v0.1',
      selectedCanonicalId: 'canonical-a',
      selectedCanonicalType: 'forged-type',
      governanceFilter: 'CORE',
      canonicalTypeFilter: 'forged-type',
      coverageStatus: 'empty',
      objectCount: 999,
      relationCount: 999,
    };
    const forgedHints = {
      targetUserId: 'student-victim',
      classId: 'class-victim',
      evidenceDraftId: 'draft-victim',
      assessmentId: 'assessment-victim',
      resourceId: 'resource-victim',
      smartTaskId: 'task-victim',
      smartTaskRevision: '999',
    };
    const pageContext = {
      courseId: 'knowledge',
      courseTitle: '知识图谱',
      pageType: 'theory',
      stepId: '/knowledge',
      topic: '候选权威图谱',
      learningObjectives: [],
      knowledgeType: 'C',
      candidateGraph,
    };

    const chatResponse = await chatPOST(new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ id: 'candidate-chat', role: 'user', content: '解释根轨迹' }],
        courseId: 'knowledge',
        pageId: '/knowledge',
        classId: 'class-victim',
        resourceId: 'resource-victim',
        teachingAssistantModeId: forgedMode,
        modeClientContextHints: forgedHints,
        knowledgeWorkspaceHint: { selected_node: { id: 'legacy-victim' } },
        pageContext,
      }),
    }));
    expect(chatResponse.status).toBe(200);

    const sessionResponse = await sessionMessagePOST(new NextRequest(
      'http://localhost/api/ai/sessions/session-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({
          content: '解释根轨迹',
          classId: 'class-victim',
          resourceId: 'resource-victim',
          teachingAssistantModeId: forgedMode,
          modeClientContextHints: forgedHints,
          knowledgeWorkspaceHint: { selected_node: { id: 'legacy-victim' } },
          pageContext,
        }),
      },
    ), { params: Promise.resolve({ id: 'session-1' }) });
    expect(sessionResponse.status).toBe(200);

    expect(mocks.resolveScopeOverride).not.toHaveBeenCalled();
    expect(mocks.resolveServerModeContext).not.toHaveBeenCalled();
    for (const reader of [
      mocks.prisma.learningEvidenceDraft.findMany,
      mocks.prisma.learningFact.findMany,
      mocks.prisma.studentProfile.findFirst,
      mocks.prisma.studentProfile.findMany,
      mocks.prisma.teachingResource.findMany,
      mocks.prisma.class.findUnique,
      mocks.prisma.smartLessonTask.findFirst,
    ]) {
      expect(reader).not.toHaveBeenCalled();
    }
    expect(mocks.verifyRuntimeScope).toHaveBeenCalledTimes(2);
    for (const [, input] of mocks.verifyRuntimeScope.mock.calls) {
      expect(input).toMatchObject({
        targetUserId: 'teacher-1',
        classId: null,
        courseId: 'knowledge',
        pageId: '/knowledge',
        resourceId: null,
        pathNodeId: null,
      });
    }
    for (const [, input] of mocks.buildRuntimeContext.mock.calls) {
      expect(input).toMatchObject({
        targetUserId: 'teacher-1',
        classId: null,
        courseId: 'knowledge',
        pageId: '/knowledge',
        resourceId: null,
        pathNodeId: null,
        teachingAssistantModeId: null,
        teachingAssistantServerModeContext: null,
        knowledgeWorkspaceHint: null,
      });
    }
    for (const input of mocks.buildRuntimeContract.mock.calls.map((call) => call[0])) {
      expect(input).toMatchObject({
        modeId: null,
        serverModeContext: null,
      });
      expect(input.clientContextHints).toBeUndefined();
    }
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
