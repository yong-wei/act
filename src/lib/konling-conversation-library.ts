import type { Prisma, PrismaClient } from '@prisma/client';
import { getMessageContent, toLegacyMessage, toUIMessage, type IncomingMessage } from '@/lib/ai-message-compat';
import { resolveAIContext } from '@/lib/ai-context-resolver';
import { getStepAIContext } from '@/lib/course-ai-contexts';
import type { Message } from '@/types/ai-message';

export const KONLING_DEFAULT_CONVERSATION_TITLE = '新对话';
export const KONLING_CONVERSATION_TITLE_MAX_LENGTH = 64;
export const KONLING_CONVERSATION_TURN_LEASE_MS = 5 * 60 * 1000;

type ConversationDb = Pick<PrismaClient, 'konlingSession' | '$transaction'>;
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
  const smartPrepCourseBasis = !registeredStep
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
  const resolvedRoute = scope.pageId.startsWith('/')
    ? resolveAIContext(scope.pageId)
    : null;
  const registeredRoute = resolvedRoute?.enabled ? resolvedRoute.pageContext : null;
  if (
    !registeredStep
    && !smartPrepCourseBasis
    && (!registeredRoute || registeredRoute.courseId !== scope.courseId)
  ) {
    return null;
  }

  return {
    authenticatedUserId: scope.authenticatedUserId,
    role: scope.role,
    courseId: registeredStep || smartPrepCourseBasis ? scope.courseId : registeredRoute!.courseId!,
    pageId: registeredStep || smartPrepCourseBasis ? scope.pageId : registeredRoute!.stepId!,
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

export function serializeKonlingConversation(conversation: PersistedConversation) {
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
    messages: conversationMessages(conversation.messages),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    expiresAt: conversation.expiresAt,
  };
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
  const assistantMessage = toLegacyMessage(input.assistantMessage);

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

function removeKonlingTurnMessages(messages: Message[], turnId: string): Message[] {
  return messages.filter((message) => {
    const metadata = message.metadata;
    return !metadata
      || typeof metadata !== 'object'
      || (metadata as Record<string, unknown>).konlingTurnId !== turnId;
  });
}
