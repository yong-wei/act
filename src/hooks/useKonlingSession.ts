/**
 * 控灵会话管理 Hook
 *
 * 管理AI会话的创建、恢复和消息存储
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import type { Message } from '@/types/ai-message';
import type { PageContext } from '@/types/ai-context';
import { toLegacyMessage } from '@/lib/ai-message-compat';
import type { KonlingTeachingAssistantEntryPoint } from '@/lib/konling-agent-runtime';

interface KonlingSession {
  id: string;
  userId: string;
  courseId: string;
  pageId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

interface UseKonlingSessionOptions {
  courseId: string;
  pageId: string;
  title?: string;
  pageContext?: PageContext;
  konlingEntryPoint?: KonlingTeachingAssistantEntryPoint | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json();
};

export function useKonlingSession({
  courseId,
  pageId,
  title,
  pageContext,
  konlingEntryPoint,
}: UseKonlingSessionOptions) {
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const createSessionPromiseRef = useRef<Promise<KonlingSession> | null>(null);

  // 获取或创建会话
  const { data: session, error, mutate } = useSWR<KonlingSession | null>(
    `/api/ai/sessions?courseId=${courseId}&pageId=${pageId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (data) {
          setSessionId(data.id);
          setLocalMessages((data.messages || []).map(toLegacyMessage));
        }
      },
    }
  );

  // 创建新会话
  const createSession = useCallback(async () => {
    if (createSessionPromiseRef.current) {
      return createSessionPromiseRef.current;
    }

    const createSessionPromise = (async () => {
      try {
        const res = await fetch('/api/ai/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId,
            pageId,
            title: title || `${courseId} - ${pageId}`,
            pageContext,
          }),
        });

        if (!res.ok) throw new Error('Failed to create session');

        const data = await res.json();
        setSessionId(data.id);
        setLocalMessages([]);
        await mutate();
        return data;
      } catch (err) {
        console.error('Error creating session:', err);
        throw err;
      }
    })();

    createSessionPromiseRef.current = createSessionPromise;
    try {
      return await createSessionPromise;
    } finally {
      createSessionPromiseRef.current = null;
    }
  }, [courseId, pageId, title, pageContext, mutate]);

  useEffect(() => {
    if (session !== null || sessionId) {
      return;
    }
    void createSession();
  }, [createSession, session, sessionId]);

  // 发送消息
  const sendMessage = useCallback(async (content: string) => {
    let activeSessionId = sessionId;
    if (!sessionId) {
      // 如果没有会话，先创建
      const createdSession = await createSession();
      activeSessionId = createdSession.id;
    }

    // 乐观更新本地消息
    const userMessage: Message = toLegacyMessage({
      id: Date.now().toString(),
      role: 'user',
      content,
    });
    setLocalMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch(`/api/ai/sessions/${activeSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          pageContext,
          teachingAssistantModeId: konlingEntryPoint?.mode,
          modeClientContextHints: konlingEntryPoint?.serverContext,
          classId: konlingEntryPoint?.serverContext.classId,
          resourceId: konlingEntryPoint?.serverContext.resourceId,
          pathNodeId: konlingEntryPoint?.serverContext.pathNodeId,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message');

      const data = await res.json();

      // 更新本地消息列表（包含AI回复）
      if (data.messages) {
        setLocalMessages(data.messages.map(toLegacyMessage));
      }

      await mutate();
      return data;
    } catch (err) {
      console.error('Error sending message:', err);
      // 回滚乐观更新
      setLocalMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      throw err;
    }
  }, [sessionId, createSession, konlingEntryPoint, mutate, pageContext]);

  // 清空会话
  const clearSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await fetch(`/api/ai/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      setLocalMessages([]);
      setSessionId(null);
      await mutate(undefined, false);
    } catch (err) {
      console.error('Error clearing session:', err);
    }
  }, [sessionId, mutate]);

  // 保存消息到会话
  const saveMessages = useCallback(async (messages: Message[]) => {
    if (!sessionId) return;

    try {
      await fetch(`/api/ai/sessions/${sessionId}/messages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });

      await mutate();
    } catch (err) {
      console.error('Error saving messages:', err);
    }
  }, [sessionId, mutate]);

  return {
    session,
    sessionId,
    messages: localMessages.length > 0 ? localMessages : session?.messages || [],
    isLoading: !error && session === undefined,
    error,
    createSession,
    sendMessage,
    clearSession,
    saveMessages,
    refresh: mutate,
  };
}

/**
 * 简化的本地存储会话Hook（不依赖后端）
 */
export function useLocalKonlingSession(
  courseId: string,
  pageId: string,
  maxMessages: number = 50
) {
  const storageKey = `konling-session-${courseId}-${pageId}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 检查是否过期（7天）
        if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
          return parsed.messages || [];
        }
      }
    } catch (e) {
      console.error('Error loading session from localStorage:', e);
    }
    return [];
  });

  // 保存到localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const data = {
        courseId,
        pageId,
        messages: messages.slice(-maxMessages),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving session to localStorage:', e);
    }
  }, [messages, courseId, pageId, maxMessages, storageKey]);

  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message].slice(-maxMessages));
  }, [maxMessages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return {
    messages,
    addMessage,
    clearMessages,
    setMessages,
  };
}
