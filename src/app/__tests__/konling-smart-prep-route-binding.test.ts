import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  getServerSession: vi.fn(),
  resolveServerModeContext: vi.fn(),
  getOrCreateAgentSession: vi.fn(),
  resumeAgentSession: vi.fn(),
  streamText: vi.fn(),
  useActualResolver: false,
  prisma: {
    agentSession: { updateMany: vi.fn() },
    smartLessonTask: { findFirst: vi.fn() },
    konlingSession: {
      findUnique: vi.fn(),
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
  createUIMessageStreamResponse: vi.fn(({ headers }) => new Response('ok', { status: 200, headers })),
  stepCountIs: vi.fn(() => () => false),
  streamText: mocks.streamText,
}));
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
    })),
    buildKonlingToolRuntime: vi.fn(() => ({})),
    buildScopedKonlingAiTools: vi.fn(() => ({})),
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

describe('Konling smart-prep production routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useActualResolver = false;
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER', name: 'Teacher' } });
    mocks.getServerSession.mockResolvedValue({ user: { id: 'teacher-1', role: 'TEACHER', name: 'Teacher' } });
    mocks.resolveServerModeContext.mockResolvedValue(serverContext);
    mocks.getOrCreateAgentSession.mockResolvedValue({ id: 'agent-1', state: {}, pendingApproval: null });
    mocks.resumeAgentSession.mockResolvedValue({ id: 'agent-1', pendingApproval: null });
    mocks.prisma.agentSession.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.konlingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'teacher-1',
      courseId: 'course-1',
      pageId: '/teacher/smart-prep',
      messages: [],
    });
    mocks.prisma.konlingSession.update.mockResolvedValue({});
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
});
