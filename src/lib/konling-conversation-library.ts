import type { Prisma, PrismaClient } from '@prisma/client';
import { getMessageContent, toLegacyMessage, toUIMessage, type IncomingMessage } from '@/lib/ai-message-compat';
import { resolveRegisteredAIContextFromPath } from '@/lib/ai-context-resolver';
import { isAdaptivePracticeGoalId } from '@/lib/adaptive-path-goal-options';
import { getStepAIContext } from '@/lib/course-ai-contexts';
import type { Message } from '@/types/ai-message';

export const KONLING_DEFAULT_CONVERSATION_TITLE = '新对话';
export const KONLING_CONVERSATION_TITLE_MAX_LENGTH = 64;
export const KONLING_CONVERSATION_TURN_LEASE_MS = 5 * 60 * 1000;

type ConversationDb = Pick<PrismaClient, 'konlingSession' | '$transaction'>
  & Partial<Pick<PrismaClient, 'agentToolRun'>>;
type ConversationContextDb = Pick<PrismaClient, 'courseBasis' | 'teachingResource' | 'knowledgeNode'>;

type PersistedConversation = {
  id: string;
  userId: string;
  courseId: string;
  pageId: string;
  title: string;
  titleIsManual: boolean;
  pinnedAt: Date | null;
  lastActivityAt: Date;
  libraryVisible: boolean;
  activeTurnId: string | null;
  activeTurnClaimedAt: Date | null;
  messages: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

export interface KonlingAuthorizedPageScope {
  authenticatedUserId?: string;
  role?: 'student' | 'teacher' | 'admin' | 'system';
  courseId: string;
  pageId: string;
  classId?: string | null;
  resourceId?: string | null;
  pathNodeId?: string | null;
}

export async function resolveKonlingContextEventScope(
  db: ConversationContextDb,
  scope: KonlingAuthorizedPageScope,
): Promise<KonlingAuthorizedPageScope | null> {
  const registeredStep = getStepAIContext(scope.courseId, scope.pageId);
  const authorizedSmartPrepBootstrap = scope.pageId === '/teacher/smart-prep'
    && (scope.role === 'teacher' || scope.role === 'admin')
    && scope.courseId === 'smart-prep';
  const authorizedPathAdvisor = scope.role === 'student'
    && (scope.pageId === 'adaptive-path-center' || scope.pageId === 'student-path-center')
    && isAdaptivePracticeGoalId(scope.courseId);
  const smartPrepCourseBasis = !registeredStep
    && !authorizedSmartPrepBootstrap
    && scope.pageId === '/teacher/smart-prep'
    && (scope.role === 'teacher' || scope.role === 'admin')
    && scope.authenticatedUserId
    ? await db.courseBasis.findFirst({
        where: scope.role === 'admin'
          ? { id: scope.courseId }
          : { id: scope.courseId, ownerId: scope.authenticatedUserId },
        select: { id: true },
      })
    : null;
  const registeredRoute = scope.pageId.startsWith('/')
    ? resolveRegisteredAIContextFromPath(scope.pageId)
    : null;
  if (
    !registeredStep
    && !authorizedSmartPrepBootstrap
    && !authorizedPathAdvisor
    && !smartPrepCourseBasis
    && (!registeredRoute || registeredRoute.courseId !== scope.courseId)
  ) {
    return null;
  }

  return {
    authenticatedUserId: scope.authenticatedUserId,
    role: scope.role,
    courseId: registeredStep || authorizedSmartPrepBootstrap || authorizedPathAdvisor || smartPrepCourseBasis
      ? scope.courseId
      : registeredRoute!.courseId!,
    pageId: registeredStep || authorizedSmartPrepBootstrap || authorizedPathAdvisor || smartPrepCourseBasis
      ? scope.pageId
      : registeredRoute!.stepId!,
    classId: scope.classId ?? null,
    // The current schema has no authoritative page-to-resource or
    // page-to-knowledge-node relation. Fail closed instead of treating a
    // client-supplied existing ID as proof that it belongs to this page.
    resourceId: null,
    pathNodeId: null,
  };
}

export interface KonlingContextEventMetadata {
  version: 1;
  identity: string;
  courseId: string;
  pageId: string;
  classId: string | null;
  resourceId: string | null;
  pathNodeId: string | null;
}

export class KonlingConversationTurnConflictError extends Error {
  readonly status = 409;

  constructor(message = 'Conversation already has an active turn.') {
    super(message);
    this.name = 'KonlingConversationTurnConflictError';
  }
}

export function createKonlingMessageId(): string {
  return crypto.randomUUID();
}

export function serializeKonlingConversation(
  conversation: PersistedConversation,
  messages = conversationMessages(conversation.messages),
) {
  return {
    id: conversation.id,
    userId: conversation.userId,
    courseId: conversation.courseId,
    pageId: conversation.pageId,
    title: conversation.title,
    titleIsManual: conversation.titleIsManual,
    pinned: Boolean(conversation.pinnedAt),
    pinnedAt: conversation.pinnedAt,
    lastActivityAt: conversation.lastActivityAt,
    messages: messages.map(projectPublicKonlingMessage),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    expiresAt: conversation.expiresAt,
  };
}

function projectPublicKonlingMessage(message: Message): Message {
  const metadata = recordValue(message.metadata);
  const structuredTurn = recordValue(metadata.konlingStructuredActionTurn);
  const toolRuns = Array.isArray(structuredTurn.toolRuns) ? structuredTurn.toolRuns : [];
  const actions = toolRuns.flatMap((value) => {
    const run = recordValue(value);
    const input = recordValue(run.inputSummary);
    if (
      run.toolName !== 'propose_smart_lesson_task_change'
      || typeof run.toolRunId !== 'string'
      || typeof input.publicActionId !== 'string'
      || (input.operation !== 'bootstrap' && input.operation !== 'revise')
    ) return [];
    return [{
      actionId: input.publicActionId,
      operation: input.operation,
      taskId: typeof input.taskId === 'string' ? input.taskId : undefined,
      state: publicStructuredActionState(run.approvalState),
      affectedStageId: typeof input.affectedStageId === 'string' ? input.affectedStageId : 'topic-goals',
      proposal: projectPublicSmartPreparationProposal(
        input.proposedTask,
        Array.isArray(input.changedFields) ? input.changedFields : [],
        input.operation,
        input.publicBasisSummary,
      ),
    }];
  });
  const citationGuard = recordValue(metadata.konlingCitationGuard);
  const revision = recordValue(metadata.konlingMessageRevision);
  const correction = recordValue(metadata.konlingStructuredCorrection);
  const publicMetadata = {
    ...(Object.keys(citationGuard).length ? { konlingCitationGuard: citationGuard } : {}),
    ...(typeof revision.revision === 'number' ? {
      konlingMessageRevision: {
        revision: revision.revision,
        status: boundedPublicText(revision.status),
        userNotice: boundedPublicText(revision.userNotice),
      },
    } : {}),
    ...(typeof correction.status === 'string' ? {
      konlingStructuredCorrection: {
        status: boundedPublicText(correction.status),
        attempts: typeof correction.attempts === 'number' ? correction.attempts : 0,
      },
    } : {}),
  };
  return toLegacyMessage({
    ...message,
    parts: message.parts.filter((part) =>
      part.type !== 'dynamic-tool' && !part.type.startsWith('tool-')),
    metadata: {
      ...publicMetadata,
      ...(actions.length ? { konlingSmartPreparationActions: actions } : {}),
    },
  });
}

function projectPublicSmartPreparationProposal(
  value: unknown,
  changedFieldsValue: unknown[],
  operation: unknown,
  publicBasisSummaryValue: unknown,
) {
  const proposal = recordValue(value);
  const publicBasisSummary = recordValue(publicBasisSummaryValue);
  const changedFields = new Set(
    changedFieldsValue.filter((field): field is string => typeof field === 'string'),
  );
  const includesField = (field: string) =>
    operation === 'bootstrap' || changedFields.size === 0 || changedFields.has(field);
  const textbookRanges = includesField('textbookRanges') && Array.isArray(proposal.textbookRanges)
    ? proposal.textbookRanges.slice(0, 8).map((range) => {
        const item = recordValue(range);
        return {
          level: typeof item.level === 'string' ? item.level : undefined,
          structuralPath: Array.isArray(item.structuralPath)
            ? item.structuralPath.filter((part): part is string => typeof part === 'string').slice(0, 8)
            : [],
        };
      })
    : [];
  const itemText = (item: unknown, fields: string[]) => {
    const record = recordValue(item);
    const text = fields.map((field) => record[field]).find((candidate) => typeof candidate === 'string');
    return typeof text === 'string' ? Array.from(text).slice(0, 240).join('') : '';
  };
  return {
    topic: includesField('topic') ? boundedPublicText(proposal.topic) : undefined,
    audience: includesField('audience') ? boundedPublicText(proposal.audience) : undefined,
    prerequisitesChanged: includesField('prerequisites'),
    prerequisites: includesField('prerequisites') ? boundedPublicText(proposal.prerequisites) ?? '' : undefined,
    durationMinutes: includesField('durationMinutes') && typeof proposal.durationMinutes === 'number'
      ? proposal.durationMinutes
      : undefined,
    outlineConfirmationRequiredChanged: includesField('outlineConfirmationRequired'),
    outlineConfirmationRequired: includesField('outlineConfirmationRequired')
      && typeof proposal.outlineConfirmationRequired === 'boolean'
      ? proposal.outlineConfirmationRequired
      : undefined,
    selectedClassLabel: boundedPublicText(proposal.selectedClassName ?? proposal.selectedClassLabel),
    selectedClassChanged: includesField('selectedClassId'),
    textbookRanges,
    knowledgePoints: includesField('knowledgePoints') && Array.isArray(proposal.knowledgePoints)
      ? proposal.knowledgePoints.slice(0, 12).map((item) => itemText(item, ['title', 'content'])).filter(Boolean)
      : [],
    goals: includesField('goals') && Array.isArray(proposal.goals)
      ? proposal.goals.slice(0, 12).map((item) => itemText(item, ['content', 'title'])).filter(Boolean)
      : [],
    courseBasis: operation === 'bootstrap' ? boundedPublicText(publicBasisSummary.title) : undefined,
    sources: operation === 'bootstrap' && Array.isArray(publicBasisSummary.sources)
      ? publicBasisSummary.sources
          .map(boundedPublicText)
          .filter((item): item is string => typeof item === 'string' && item.length > 0)
          .slice(0, 12)
      : [],
  };
}

function boundedPublicText(value: unknown) {
  return typeof value === 'string' ? Array.from(value).slice(0, 240).join('') : undefined;
}

function publicStructuredActionState(value: unknown) {
  if (value === 'approved') return 'applied';
  if (value === 'ignored') return 'ignored';
  if (value === 'conflict') return 'conflict';
  if (value === 'action_failed') return 'failed';
  return 'pending';
}

export function refreshKonlingStructuredActionToolRuns(
  messages: Message[],
  toolRuns: Array<{
    id: string;
    approvalState: string;
    outputSummary: unknown;
    errorSummary: unknown;
  }>,
): Message[] {
  if (toolRuns.length === 0) return messages;
  const currentById = new Map(toolRuns.map((run) => [run.id, run]));
  return messages.map((message) => {
    const metadata = recordValue(message.metadata);
    const structuredTurn = recordValue(metadata.konlingStructuredActionTurn);
    const persistedRuns = Array.isArray(structuredTurn.toolRuns) ? structuredTurn.toolRuns : [];
    if (persistedRuns.length === 0) return message;
    let changed = false;
    const nextRuns = persistedRuns.map((persistedRun) => {
      const run = recordValue(persistedRun);
      const current = typeof run.toolRunId === 'string' ? currentById.get(run.toolRunId) : undefined;
      if (!current) return persistedRun;
      changed = true;
      return {
        ...run,
        approvalState: current.approvalState,
        outputSummary: current.outputSummary,
        errorSummary: current.errorSummary,
      };
    });
    if (!changed) return message;
    return {
      ...message,
      metadata: {
        ...metadata,
        konlingStructuredActionTurn: {
          ...structuredTurn,
          toolRuns: nextRuns,
        },
      },
    };
  });
}

export function konlingStructuredActionToolRunIds(messages: Message[]): string[] {
  return [...new Set(messages.flatMap((message) => {
    const structuredTurn = recordValue(recordValue(message.metadata).konlingStructuredActionTurn);
    return (Array.isArray(structuredTurn.toolRuns) ? structuredTurn.toolRuns : [])
      .map((run) => recordValue(run).toolRunId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  }))];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function buildKonlingContextIdentity(scope: KonlingAuthorizedPageScope): string {
  return [
    scope.courseId,
    scope.pageId,
    scope.classId ?? '',
    scope.resourceId ?? '',
    scope.pathNodeId ?? '',
  ].join('\u001f');
}

export function createKonlingContextEvent(
  scope: KonlingAuthorizedPageScope,
  id: string = createKonlingMessageId(),
): Message {
  const metadata: KonlingContextEventMetadata = {
    version: 1,
    identity: buildKonlingContextIdentity(scope),
    courseId: scope.courseId,
    pageId: scope.pageId,
    classId: scope.classId ?? null,
    resourceId: scope.resourceId ?? null,
    pathNodeId: scope.pathNodeId ?? null,
  };
  const content = [
    '[控灵当前页面上下文]',
    `courseId=${metadata.courseId}`,
    `pageId=${metadata.pageId}`,
    ...(metadata.classId ? [`classId=${metadata.classId}`] : []),
    ...(metadata.resourceId ? [`resourceId=${metadata.resourceId}`] : []),
    ...(metadata.pathNodeId ? [`pathNodeId=${metadata.pathNodeId}`] : []),
  ].join('\n');

  return toLegacyMessage({
    id,
    role: 'system',
    content,
    metadata: { konlingContextEvent: metadata },
  });
}

export function prepareKonlingConversationTurn(input: {
  conversation: Pick<PersistedConversation, 'courseId' | 'pageId' | 'messages'>;
  currentScope: KonlingAuthorizedPageScope;
  userMessage: IncomingMessage;
}) {
  const existingMessages = conversationMessages(input.conversation.messages);
  const currentIdentity = buildKonlingContextIdentity(input.currentScope);
  const latestContextIdentity = findLatestKonlingContextIdentity(existingMessages)
    ?? buildKonlingContextIdentity({
      courseId: input.conversation.courseId,
      pageId: input.conversation.pageId,
    });
  const contextMessage = latestContextIdentity === currentIdentity
    ? null
    : createKonlingContextEvent(input.currentScope);
  const userMessage = toLegacyMessage(input.userMessage);
  const turnMessages = contextMessage ? [contextMessage, userMessage] : [userMessage];

  return {
    existingMessages,
    turnMessages,
    modelMessages: [...existingMessages, ...turnMessages],
    contextAppended: Boolean(contextMessage),
  };
}

export async function claimKonlingConversationTurn(
  db: ConversationDb,
  input: {
    conversationId: string;
    ownerUserId: string;
    currentScope: KonlingAuthorizedPageScope;
    userMessage: IncomingMessage;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const staleBefore = new Date(now.getTime() - KONLING_CONVERSATION_TURN_LEASE_MS);
  const userMessage = toLegacyMessage(input.userMessage);
  const turnId = userMessage.id || crypto.randomUUID();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await db.konlingSession.findFirst({
      where: {
        id: input.conversationId,
        userId: input.ownerUserId,
        libraryVisible: true,
        expiresAt: { gt: now },
      },
    });
    if (!current) return null;

    if (
      current.activeTurnId
      && current.activeTurnClaimedAt
      && current.activeTurnClaimedAt > staleBefore
    ) {
      throw new KonlingConversationTurnConflictError();
    }

    const baseMessages = current.activeTurnId
      ? removeKonlingTurnMessages(conversationMessages(current.messages), current.activeTurnId)
      : conversationMessages(current.messages);
    const preparedTurn = prepareKonlingConversationTurn({
      conversation: {
        ...current,
        messages: baseMessages as unknown as Prisma.JsonValue,
      },
      currentScope: input.currentScope,
      userMessage: tagKonlingTurnMessage({ ...userMessage, id: turnId }, turnId),
    });
    const turnMessages = preparedTurn.turnMessages.map((message) =>
      tagKonlingTurnMessage(message, turnId)
    );
    const modelMessages = [...baseMessages, ...turnMessages];
    const updated = await db.konlingSession.updateMany({
      where: {
        id: current.id,
        userId: input.ownerUserId,
        updatedAt: current.updatedAt,
        activeTurnId: current.activeTurnId,
      },
      data: {
        messages: modelMessages as unknown as Prisma.InputJsonValue,
        activeTurnId: turnId,
        activeTurnClaimedAt: now,
        lastActivityAt: now,
        updatedAt: now,
      },
    });
    if (updated.count === 1) {
      const conversation = await db.konlingSession.findUnique({ where: { id: current.id } });
      if (!conversation) return null;
      return {
        conversation,
        turnId,
        turnMessages,
        modelMessages,
      };
    }
  }

  throw new KonlingConversationTurnConflictError();
}

export async function completeKonlingConversationTurn(
  db: ConversationDb,
  input: {
    conversationId: string;
    ownerUserId: string;
    turnId: string;
    assistantMessage: IncomingMessage;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  let assistantMessage = toLegacyMessage(input.assistantMessage);

  const current = await db.konlingSession.findFirst({
    where: {
      id: input.conversationId,
      userId: input.ownerUserId,
    },
  });
  if (!current) return null;

  const currentMessages = conversationMessages(current.messages);
  if (currentMessages.some((message) => message.id === assistantMessage.id)) {
    return current;
  }
  if (current.activeTurnId !== input.turnId) {
    throw new KonlingConversationTurnConflictError('Conversation turn lease is no longer owned by this request.');
  }
  assistantMessage = await attachKonlingTurnToolRuns(db, {
    conversationId: input.conversationId,
    ownerUserId: input.ownerUserId,
    turnId: input.turnId,
    claimedAt: current.activeTurnClaimedAt,
    assistantMessage,
  });

  const firstUserMessage = currentMessages.find((message) => message.role === 'user');
  const nextTitle = firstUserMessage
    ? deriveKonlingConversationTitle(getMessageContent(firstUserMessage))
    : null;
  const updated = await db.konlingSession.updateMany({
    where: {
      id: current.id,
      userId: input.ownerUserId,
      activeTurnId: input.turnId,
    },
    data: {
      messages: [
        ...currentMessages,
        tagKonlingTurnMessage(assistantMessage, input.turnId),
      ] as unknown as Prisma.InputJsonValue,
      activeTurnId: null,
      activeTurnClaimedAt: null,
      lastActivityAt: now,
      updatedAt: now,
    },
  });
  if (updated.count !== 1) {
    throw new KonlingConversationTurnConflictError('Conversation turn lease is no longer owned by this request.');
  }
  if (nextTitle) {
    await db.konlingSession.updateMany({
      where: {
        id: current.id,
        userId: input.ownerUserId,
        titleIsManual: false,
      },
      data: {
        title: nextTitle,
      },
    });
  }
  return db.konlingSession.findUnique({ where: { id: current.id } });
}

async function attachKonlingTurnToolRuns(
  db: ConversationDb,
  input: {
    conversationId: string;
    ownerUserId: string;
    turnId: string;
    claimedAt: Date | null;
    assistantMessage: Message;
  },
): Promise<Message> {
  if (!db.agentToolRun?.findMany || !input.claimedAt) return input.assistantMessage;
  const toolRuns = await db.agentToolRun.findMany({
    where: {
      ownerUserId: input.ownerUserId,
      startedAt: { gte: input.claimedAt },
      agentSession: {
        konlingSessionId: input.conversationId,
        stateJson: {
          path: ['currentTurnId'],
          equals: input.turnId,
        },
      },
    },
    orderBy: [
      { startedAt: 'asc' },
      { id: 'asc' },
    ],
    select: {
      id: true,
      agentSessionId: true,
      toolName: true,
      status: true,
      approvalState: true,
      inputSummary: true,
      outputSummary: true,
      errorSummary: true,
      idempotencyKey: true,
      correlationId: true,
      startedAt: true,
      completedAt: true,
    },
  });
  if (toolRuns.length === 0) return input.assistantMessage;
  const existingMetadata = input.assistantMessage.metadata
    && typeof input.assistantMessage.metadata === 'object'
    && !Array.isArray(input.assistantMessage.metadata)
    ? input.assistantMessage.metadata as Record<string, unknown>
    : {};
  return toLegacyMessage({
    ...input.assistantMessage,
    metadata: {
      ...existingMetadata,
      konlingStructuredActionTurn: {
        version: 1,
        turnId: input.turnId,
        terminal: toolRuns.every((run) =>
          ['succeeded', 'failed', 'cancelled'].includes(run.status)),
        toolRuns: toolRuns.map((run) => ({
          toolRunId: run.id,
          agentSessionId: run.agentSessionId,
          toolName: run.toolName,
          status: run.status,
          approvalState: run.approvalState,
          inputSummary: run.inputSummary,
          outputSummary: run.outputSummary,
          errorSummary: run.errorSummary,
          idempotencyKey: run.idempotencyKey,
          correlationId: run.correlationId,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt?.toISOString() ?? null,
        })),
      },
    },
  });
}

export async function replaceKonlingConversationAssistantRevision(
  db: ConversationDb,
  input: {
    conversationId: string;
    ownerUserId: string;
    assistantMessage: IncomingMessage;
    expectedRevision: number;
    revision: number;
    now?: Date;
  },
) {
  if (input.revision <= input.expectedRevision) return null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await db.konlingSession.findFirst({
      where: {
        id: input.conversationId,
        userId: input.ownerUserId,
      },
    });
    if (!current) return null;
    const messages = conversationMessages(current.messages);
    const index = messages.findIndex((message) => message.id === input.assistantMessage.id);
    if (index < 0) return null;
    const existingRevision = readKonlingPersistedMessageRevision(messages[index]);
    if (existingRevision !== input.expectedRevision || input.revision <= existingRevision) return null;
    const incomingReplacement = toLegacyMessage(input.assistantMessage);
    const existingMetadata = recordValue(messages[index].metadata);
    const replacement = toLegacyMessage({
      ...incomingReplacement,
      metadata: {
        ...existingMetadata,
        ...recordValue(incomingReplacement.metadata),
      },
    });
    const nextMessages = [...messages];
    nextMessages[index] = replacement;
    const attemptNow = input.now ?? new Date();
    const updated = await db.konlingSession.updateMany({
      where: {
        id: current.id,
        userId: input.ownerUserId,
        updatedAt: current.updatedAt,
      },
      data: {
        messages: nextMessages as unknown as Prisma.InputJsonValue,
        lastActivityAt: attemptNow,
        updatedAt: attemptNow,
      },
    });
    if (updated.count === 1) {
      return db.konlingSession.findUnique({ where: { id: current.id } });
    }
  }
  return null;
}

export async function releaseKonlingConversationTurn(
  db: ConversationDb,
  input: {
    conversationId: string;
    ownerUserId: string;
    turnId: string;
  },
) {
  const current = await db.konlingSession.findFirst({
    where: {
      id: input.conversationId,
      userId: input.ownerUserId,
    },
  });
  if (!current || current.activeTurnId !== input.turnId) {
    return { count: 0 };
  }
  return db.konlingSession.updateMany({
    where: {
      id: input.conversationId,
      userId: input.ownerUserId,
      activeTurnId: input.turnId,
    },
    data: {
      messages: removeKonlingTurnMessages(
        conversationMessages(current.messages),
        input.turnId,
      ) as unknown as Prisma.InputJsonValue,
      activeTurnId: null,
      activeTurnClaimedAt: null,
    },
  });
}

export function deriveKonlingConversationTitle(firstPrompt: string): string {
  const redacted = firstPrompt
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[隐私信息]')
    .replace(/\b1[3-9]\d{9}\b/g, '[隐私信息]')
    .replace(/\s+/g, ' ')
    .trim();
  if (!redacted) return KONLING_DEFAULT_CONVERSATION_TITLE;
  const characters = Array.from(redacted);
  if (characters.length <= KONLING_CONVERSATION_TITLE_MAX_LENGTH) return redacted;
  return `${characters.slice(0, KONLING_CONVERSATION_TITLE_MAX_LENGTH - 1).join('')}…`;
}

export function normalizeKonlingManualTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return Array.from(normalized).slice(0, KONLING_CONVERSATION_TITLE_MAX_LENGTH).join('');
}

export function conversationMessages(value: Prisma.JsonValue | null | undefined): Message[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return [];
    const record = message as Prisma.JsonObject;
    if (record.role !== 'system' && record.role !== 'user' && record.role !== 'assistant') return [];
    return [toLegacyMessage(record as IncomingMessage)];
  });
}

function findLatestKonlingContextIdentity(messages: Message[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const metadata = messages[index].metadata;
    if (!metadata || typeof metadata !== 'object') continue;
    const contextEvent = (metadata as Record<string, unknown>).konlingContextEvent;
    if (!contextEvent || typeof contextEvent !== 'object') continue;
    const identity = (contextEvent as Record<string, unknown>).identity;
    if (typeof identity === 'string' && identity) return identity;
  }
  return null;
}

function tagKonlingTurnMessage<T extends IncomingMessage>(message: T, turnId: string): T {
  const metadata = message.metadata && typeof message.metadata === 'object'
    ? message.metadata as Record<string, unknown>
    : {};
  return {
    ...message,
    metadata: {
      ...metadata,
      konlingTurnId: turnId,
    },
  };
}

function readKonlingPersistedMessageRevision(message: Message) {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== 'object') return 0;
  const revision = (metadata as Record<string, unknown>).konlingMessageRevision;
  if (!revision || typeof revision !== 'object') return 0;
  const value = (revision as Record<string, unknown>).revision;
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function removeKonlingTurnMessages(messages: Message[], turnId: string): Message[] {
  return messages.filter((message) => {
    const metadata = message.metadata;
    return !metadata
      || typeof metadata !== 'object'
      || (metadata as Record<string, unknown>).konlingTurnId !== turnId;
  });
}
