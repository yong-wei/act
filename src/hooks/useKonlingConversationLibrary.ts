'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  expiresAt: string;
}

export interface KonlingConversation extends KonlingConversationSummary {
  userId: string;
  messages: Message[];
}

interface UseKonlingConversationLibraryOptions {
  enabled: boolean;
  courseId?: string;
  pageId?: string;
  pageContext?: PageContext;
  classId?: string;
  resourceId?: string;
  pathNodeId?: string;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || '控灵会话请求失败');
  }
  return response.json() as Promise<T>;
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
}: UseKonlingConversationLibraryOptions) {
  const [conversations, setConversations] = useState<KonlingConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<KonlingConversation | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const activeRequestRef = useRef(0);
  const selectedConversationIdRef = useRef<string | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!enabled) return [];
    setIsLoading(true);
    try {
      const response = await fetch(buildKonlingConversationListUrl(search));
      const body = await readJson<{ conversations: KonlingConversationSummary[] }>(response);
      setConversations(body.conversations);
      setError(null);
      setActiveConversationId((current) => {
        const next = current ?? body.conversations[0]?.id ?? null;
        selectedConversationIdRef.current = next;
        return next;
      });
      return body.conversations;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('控灵会话列表加载失败');
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, [enabled, search]);

  useEffect(() => {
    if (!enabled) return;
    void refreshConversations().catch(() => undefined);
  }, [enabled, refreshConversations]);

  useEffect(() => {
    if (!enabled || !activeConversationId) {
      setActiveConversation(null);
      return;
    }
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setIsLoading(true);
    void fetch(`/api/ai/sessions/${activeConversationId}`)
      .then((response) => readJson<KonlingConversation>(response))
      .then((conversation) => {
        if (activeRequestRef.current !== requestId) return;
        setActiveConversation(conversation);
        setError(null);
      })
      .catch((cause) => {
        if (activeRequestRef.current !== requestId) return;
        setError(cause instanceof Error ? cause : new Error('控灵会话加载失败'));
      })
      .finally(() => {
        if (activeRequestRef.current === requestId) setIsLoading(false);
      });
  }, [activeConversationId, enabled]);

  const createConversation = useCallback(async () => {
    if (!courseId || !pageId) {
      throw new Error('当前页面缺少可用的控灵会话上下文');
    }
    setIsMutating(true);
    try {
      const response = await fetch('/api/ai/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          pageId,
          pageContext,
          classId,
          resourceId,
          pathNodeId,
        }),
      });
      const conversation = await readJson<KonlingConversation>(response);
      setActiveConversationId(conversation.id);
      selectedConversationIdRef.current = conversation.id;
      setActiveConversation(conversation);
      setSearch('');
      await refreshConversations();
      setError(null);
      return conversation;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('新建控灵会话失败');
      setError(nextError);
      throw nextError;
    } finally {
      setIsMutating(false);
    }
  }, [classId, courseId, pageContext, pageId, pathNodeId, refreshConversations, resourceId]);

  const selectConversation = useCallback((conversationId: string) => {
    activeRequestRef.current += 1;
    selectedConversationIdRef.current = conversationId;
    setActiveConversation(null);
    setActiveConversationId(conversationId);
  }, []);

  const renameConversation = useCallback(async (conversationId: string, title: string) => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/ai/sessions/${conversationId}`, {
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
      const nextError = cause instanceof Error ? cause : new Error('对话重命名失败');
      setError(nextError);
      throw nextError;
    } finally {
      setIsMutating(false);
    }
  }, [refreshConversations]);

  const setConversationPinned = useCallback(async (conversationId: string, pinned: boolean) => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/ai/sessions/${conversationId}`, {
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
      const nextError = cause instanceof Error ? cause : new Error('对话置顶状态更新失败');
      setError(nextError);
      throw nextError;
    } finally {
      setIsMutating(false);
    }
  }, [refreshConversations]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/ai/sessions/${conversationId}`, {
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
      const nextError = cause instanceof Error ? cause : new Error('删除控灵会话失败');
      setError(nextError);
      throw nextError;
    } finally {
      setIsMutating(false);
    }
  }, [activeConversationId, refreshConversations]);

  const ensureConversation = useCallback(async () => {
    const selectedConversationId = selectedConversationIdRef.current;
    if (activeConversation?.id === selectedConversationId) return activeConversation;
    if (selectedConversationId) {
      const response = await fetch(`/api/ai/sessions/${selectedConversationId}`);
      const conversation = await readJson<KonlingConversation>(response);
      if (selectedConversationIdRef.current !== selectedConversationId) {
        throw new Error('控灵会话已切换，请重新发送。');
      }
      setActiveConversation(conversation);
      return conversation;
    }
    return createConversation();
  }, [activeConversation, createConversation]);

  return {
    conversations,
    activeConversationId,
    activeConversation,
    search,
    setSearch,
    isLoading,
    isMutating,
    error,
    refreshConversations,
    createConversation,
    ensureConversation,
    selectConversation,
    renameConversation,
    setConversationPinned,
    deleteConversation,
  };
}
