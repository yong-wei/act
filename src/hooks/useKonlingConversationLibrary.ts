'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  KonlingChatFailureError,
  classifyKonlingChatFailure,
} from '@/lib/konling-chat-failure';
import type { PageContext } from '@/types/ai-context';
import type { Message } from '@/types/ai-message';

export interface KonlingConversationSummary {
  id: string;
  courseId: string;
  pageId: string;
  title: string;
  titleIsManual: boolean;
  pinned: boolean;
  pinnedAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  // null 表示当前没有已安排的治理到期，而非“永久保证”
  expiresAt: string | null;
}

export interface KonlingConversation extends KonlingConversationSummary {
  userId: string;
  messages: Message[];
  assistantBinding: KonlingConversationAssistantBinding | null;
}

export interface KonlingConversationAssistantBinding {
  teachingAssistantModeId: string;
  modeClientContextHints: Record<string, unknown>;
}

interface UseKonlingConversationLibraryOptions {
  enabled: boolean;
  courseId?: string;
  pageId?: string;
  pageContext?: PageContext;
  classId?: string;
  resourceId?: string;
  pathNodeId?: string;
  assistantBinding?: KonlingConversationAssistantBinding | null;
  // 资源辅导等按身份恢复的入口在等待精确匹配期间不得自动选中无关会话
  autoSelectFirstConversation?: boolean;
}

const ASSISTANT_BINDING_STORAGE_PREFIX = 'konling:conversation-assistant-binding:';

export function readKonlingConversationAssistantBinding(
  conversationId: string,
): KonlingConversationAssistantBinding | null {
  if (typeof window === 'undefined') return null;
  const serialized = window.sessionStorage.getItem(`${ASSISTANT_BINDING_STORAGE_PREFIX}${conversationId}`);
  if (!serialized) return null;
  try {
    const binding = JSON.parse(serialized) as Partial<KonlingConversationAssistantBinding>;
    if (
      typeof binding.teachingAssistantModeId !== 'string'
      || !binding.modeClientContextHints
      || typeof binding.modeClientContextHints !== 'object'
      || Array.isArray(binding.modeClientContextHints)
    ) return null;
    return binding as KonlingConversationAssistantBinding;
  } catch {
    return null;
  }
}

export function writeKonlingConversationAssistantBinding(
  conversationId: string,
  binding: KonlingConversationAssistantBinding | null,
): void {
  if (typeof window === 'undefined') return;
  const key = `${ASSISTANT_BINDING_STORAGE_PREFIX}${conversationId}`;
  if (binding) window.sessionStorage.setItem(key, JSON.stringify(binding));
  else window.sessionStorage.removeItem(key);
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new KonlingChatFailureError(classifyKonlingChatFailure(response.status, bodyText));
  }
  return response.json() as Promise<T>;
}

// 网络层 fetch 拒绝（断网/DNS）同样归一化为学生安全失败，避免原始
// TypeError 文案经 conversationError/actionStatus 进入界面
async function konlingConversationFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new KonlingChatFailureError('network-unavailable');
  }
}

export function buildKonlingConversationListUrl(search: string): string {
  const query = search.trim();
  return query
    ? `/api/ai/sessions?search=${encodeURIComponent(query)}`
    : '/api/ai/sessions';
}

export function visibleKonlingMessages(messages: readonly Message[]): Message[] {
  return messages.filter((message) => message.role === 'user' || message.role === 'assistant');
}

export function useKonlingConversationLibrary({
  enabled,
  courseId,
  pageId,
  pageContext,
  classId,
  resourceId,
  pathNodeId,
  assistantBinding = null,
  autoSelectFirstConversation = true,
}: UseKonlingConversationLibraryOptions) {
  const [conversations, setConversations] = useState<KonlingConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<KonlingConversation | null>(null);
  const [activeAssistantBinding, setActiveAssistantBinding] = useState<KonlingConversationAssistantBinding | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [hasHydratedList, setHasHydratedList] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const listRequestRef = useRef(0);
  const activeRequestRef = useRef(0);
  const selectedConversationIdRef = useRef<string | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!enabled) return [];
    const requestId = listRequestRef.current + 1;
    listRequestRef.current = requestId;
    setIsLoading(true);
    try {
      const response = await konlingConversationFetch(buildKonlingConversationListUrl(search));
      const body = await readJson<{ conversations: KonlingConversationSummary[] }>(response);
      if (listRequestRef.current !== requestId) return body.conversations;
      setConversations(body.conversations);
      setError(null);
      setHasHydratedList(true);
      if (autoSelectFirstConversation) {
        setActiveConversationId((current) => {
          const next = current ?? body.conversations[0]?.id ?? null;
          selectedConversationIdRef.current = next;
          return next;
        });
      }
      return body.conversations;
    } catch (cause) {
      if (listRequestRef.current !== requestId) return [];
      const nextError = cause instanceof Error ? cause : new Error('控灵会话列表加载失败');
      setError(nextError);
      throw nextError;
    } finally {
      if (listRequestRef.current === requestId) setIsLoading(false);
    }
  }, [autoSelectFirstConversation, enabled, search]);

  useEffect(() => {
    if (!enabled) return;
    void refreshConversations().catch(() => undefined);
  }, [enabled, refreshConversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setActiveConversation(null);
      setActiveAssistantBinding(null);
      return;
    }
    setActiveAssistantBinding(null);
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setIsLoading(true);
    void konlingConversationFetch(`/api/ai/sessions/${activeConversationId}`)
      .then((response) => readJson<KonlingConversation>(response))
      .then((conversation) => {
        if (activeRequestRef.current !== requestId) return;
        setActiveConversation(conversation);
        setActiveAssistantBinding(conversation.assistantBinding);
        setError(null);
      })
      .catch((cause) => {
        if (activeRequestRef.current !== requestId) return;
        setError(cause instanceof Error ? cause : new Error('控灵会话加载失败'));
      })
      .finally(() => {
        if (activeRequestRef.current === requestId) setIsLoading(false);
      });
  }, [activeConversationId]);

  const refreshActiveConversation = useCallback(async () => {
    const conversationId = selectedConversationIdRef.current;
    if (!enabled || !conversationId) return null;
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setIsLoading(true);
    try {
      const response = await konlingConversationFetch(`/api/ai/sessions/${conversationId}`);
      const conversation = await readJson<KonlingConversation>(response);
      if (
        activeRequestRef.current !== requestId
        || selectedConversationIdRef.current !== conversationId
      ) {
        return null;
      }
      setActiveConversation(conversation);
      setActiveAssistantBinding(conversation.assistantBinding);
      setError(null);
      return conversation;
    } catch (cause) {
      if (activeRequestRef.current === requestId) {
        setError(cause instanceof Error ? cause : new Error('控灵会话加载失败'));
      }
      throw cause;
    } finally {
      if (activeRequestRef.current === requestId) setIsLoading(false);
    }
  }, [enabled]);

  const createConversation = useCallback(async (
    binding: KonlingConversationAssistantBinding | null = assistantBinding,
  ) => {
    if (!courseId || !pageId) {
      throw new Error('当前页面缺少可用的控灵会话上下文');
    }
    setIsMutating(true);
    try {
      const response = await konlingConversationFetch('/api/ai/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          pageId,
          pageContext,
          classId,
          resourceId,
          pathNodeId,
          ...(binding ? {
            assistantBinding: {
              modeId: binding.teachingAssistantModeId,
              clientContextHints: binding.modeClientContextHints,
            },
          } : {}),
        }),
      });
      const conversation = await readJson<KonlingConversation>(response);
      writeKonlingConversationAssistantBinding(conversation.id, binding);
      setActiveConversationId(conversation.id);
      selectedConversationIdRef.current = conversation.id;
      setActiveConversation(conversation);
      setActiveAssistantBinding(conversation.assistantBinding ?? binding);
      setSearch('');
      await refreshConversations();
      setError(null);
      return conversation;
    } catch (cause) {
      throw cause instanceof Error ? cause : new Error('新建控灵会话失败');
    } finally {
      setIsMutating(false);
    }
  }, [assistantBinding, classId, courseId, pageContext, pageId, pathNodeId, refreshConversations, resourceId]);

  const selectConversation = useCallback((conversationId: string) => {
    activeRequestRef.current += 1;
    selectedConversationIdRef.current = conversationId;
    setActiveConversation(null);
    setActiveAssistantBinding(null);
    setActiveConversationId(conversationId);
  }, []);

  // 进入未落库空白态：仅清除选择，不创建任何会话
  const enterBlankConversation = useCallback(() => {
    activeRequestRef.current += 1;
    selectedConversationIdRef.current = null;
    setActiveConversationId(null);
    setActiveConversation(null);
    setActiveAssistantBinding(null);
  }, []);

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    setIsMutating(true);
    try {
      const response = await konlingConversationFetch(`/api/ai/sessions/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const conversation = await readJson<KonlingConversation>(response);
      setActiveConversation((current) => current?.id === conversationId ? conversation : current);
      await refreshConversations();
      setError(null);
      return conversation;
    } catch (cause) {
      throw cause instanceof Error ? cause : new Error('对话重命名失败');
    } finally {
      setIsMutating(false);
    }
  }, [refreshConversations]);

  const setConversationPinned = useCallback(async (conversationId: string, pinned: boolean) => {
    setIsMutating(true);
    try {
      const response = await konlingConversationFetch(`/api/ai/sessions/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      });
      const conversation = await readJson<KonlingConversation>(response);
      setActiveConversation((current) => current?.id === conversationId ? conversation : current);
      await refreshConversations();
      setError(null);
      return conversation;
    } catch (cause) {
      throw cause instanceof Error ? cause : new Error('对话置顶状态更新失败');
    } finally {
      setIsMutating(false);
    }
  }, [refreshConversations]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    setIsMutating(true);
    try {
      const response = await konlingConversationFetch(`/api/ai/sessions/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });
      await readJson<{ success: true; deletedConversationId: string }>(response);
      const wasActive = activeConversationId === conversationId;
      if (wasActive) {
        activeRequestRef.current += 1;
        selectedConversationIdRef.current = null;
        setActiveConversationId(null);
        setActiveConversation(null);
      }
      await refreshConversations();
      setError(null);
      return wasActive;
    } catch (cause) {
      throw cause instanceof Error ? cause : new Error('删除控灵会话失败');
    } finally {
      setIsMutating(false);
    }
  }, [activeConversationId, refreshConversations]);

  const ensureConversation = useCallback(async () => {
    const selectedConversationId = selectedConversationIdRef.current;
    if (activeConversation?.id === selectedConversationId) return activeConversation;
    if (selectedConversationId) {
      const response = await konlingConversationFetch(`/api/ai/sessions/${selectedConversationId}`);
      const conversation = await readJson<KonlingConversation>(response);
      if (selectedConversationIdRef.current !== selectedConversationId) {
        throw new Error('控灵会话已切换，请重新发送。');
      }
      setActiveConversation(conversation);
      setActiveAssistantBinding(conversation.assistantBinding);
      return conversation;
    }
    return createConversation();
  }, [activeConversation, createConversation]);

  return {
    conversations,
    activeConversationId,
    activeConversation,
    activeAssistantBinding,
    search,
    setSearch,
    isLoading,
    isMutating,
    hasHydratedList,
    error,
    refreshConversations,
    refreshActiveConversation,
    createConversation,
    ensureConversation,
    selectConversation,
    enterBlankConversation,
    renameConversation,
    setConversationPinned,
    deleteConversation,
  };
}
