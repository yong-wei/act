'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import type { AIMessage, InteractiveAIContextValue, InteractiveConfig } from '../types';
import { readAITextStream } from './ai-stream';
import {
  INTERACTIVE_AI_COURSE_ID,
  buildInteractiveAiChatBody,
  interactiveAiListUrl,
  interactiveAiPageId,
  mapRecoveredInteractiveAiMessages,
} from '@/lib/interactive-ai-context';
import type { Message } from '@/types/ai-message';

interface UseInteractiveAIOptions {
  config: InteractiveConfig;
  persona?: 'tutor' | 'critic' | 'analyst';
  classroomSessionId?: string | null;
  /** 客户端进度字段不得进入模型或授权上下文；保留仅为兼容既有调用方。 */
  contextData?: Record<string, unknown>;
  onMessage?: (message: AIMessage) => void;
  onEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}

async function ensureInteractiveConversation(pageId: string, resourceTitle: string): Promise<string> {
  const created = await fetch('/api/ai/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId: INTERACTIVE_AI_COURSE_ID,
      pageId,
      pageContext: {
        courseId: INTERACTIVE_AI_COURSE_ID,
        courseTitle: '互动学习',
        stepId: pageId,
        topic: resourceTitle,
        pageType: 'practice',
        url: pageId,
      },
    }),
  });
  if (!created.ok) {
    throw new Error('无法建立可恢复的学习对话');
  }
  const payload = await created.json() as { id?: string };
  if (typeof payload.id !== 'string' || payload.id.length === 0) {
    throw new Error('无法建立可恢复的学习对话');
  }
  return payload.id;
}

/**
 * 互动 AI 钩子
 *
 * 认证学生复用控灵会话；未认证开发路径保持一轮且不可恢复。
 */
export function useInteractiveAI(
  options: UseInteractiveAIOptions
): InteractiveAIContextValue {
  const { config, persona = 'tutor', classroomSessionId, onMessage, onEvent } = options;
  const { data: session, status: authStatus } = useSession();
  const pageId = interactiveAiPageId(config.resourceId, classroomSessionId);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<InteractiveAIContextValue['recoveryStatus']>('idle');

  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const isEnabled = config.config.ai?.enabled !== false;
  const isAuthenticated = Boolean(session?.user?.id);

  const recover = useCallback(async () => {
    if (authStatus === 'loading') {
      setRecoveryStatus('loading');
      return;
    }
    if (!isAuthenticated) {
      conversationIdRef.current = null;
      setRecoveryStatus('ephemeral');
      return;
    }
    setRecoveryStatus('loading');
    try {
      const listRes = await fetch(interactiveAiListUrl(pageId));
      if (!listRes.ok) {
        throw new Error('recovery-failed');
      }
      const list = await listRes.json() as { conversations?: Array<{ id?: string }> };
      const existingId = list.conversations?.[0]?.id;
      if (typeof existingId !== 'string' || existingId.length === 0) {
        conversationIdRef.current = null;
        setMessages([]);
        setRecoveryStatus('ready');
        return;
      }
      const detailRes = await fetch(`/api/ai/sessions/${existingId}`);
      if (!detailRes.ok) {
        throw new Error('recovery-failed');
      }
      const detail = await detailRes.json() as { id?: string; messages?: Message[] };
      conversationIdRef.current = typeof detail.id === 'string' ? detail.id : existingId;
      setMessages(mapRecoveredInteractiveAiMessages(detail.messages ?? []));
      setRecoveryStatus('ready');
      setError(null);
    } catch {
      conversationIdRef.current = null;
      setRecoveryStatus('unavailable');
      setError(new Error('无法恢复学习对话，请重试或返回当前资源。'));
    }
  }, [authStatus, isAuthenticated, pageId]);

  useEffect(() => {
    void recover();
  }, [recover]);

  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => {
      const next = !prev;
      if (next) {
        onEvent?.('ai_panel_open', {
          resourceKey: config.resourceId,
          resourceId: config.resourceId,
        });
      }
      return next;
    });
  }, [config.resourceId, onEvent]);

  const sendMessage = useCallback(async (content: string): Promise<string> => {
    if (!isEnabled) {
      throw new Error('AI is not enabled for this resource');
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage: AIMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    onMessage?.(userMessage);
    onEvent?.('ai_query_submit', {
      question: content,
      resourceKey: config.resourceId,
      resourceId: config.resourceId,
    });

    setIsLoading(true);
    setError(null);

    try {
      let conversationId = conversationIdRef.current;
      if (isAuthenticated && !conversationId) {
        conversationId = await ensureInteractiveConversation(pageId, config.title);
        conversationIdRef.current = conversationId;
        setRecoveryStatus('ready');
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildInteractiveAiChatBody({
          content,
          conversationId: conversationId ?? undefined,
          resourceTitle: config.title,
          persona: config.config.ai?.persona || persona,
          customPrompt: config.aiHints,
          pageId,
        })),
        signal: abortControllerRef.current.signal,
      });

      if (response.status === 409) {
        conversationIdRef.current = null;
        setMessages([userMessage]);
        throw new Error('当前资源的对话已隔离，请重新提问。');
      }
      if (response.status === 404 && conversationId) {
        conversationIdRef.current = null;
        setRecoveryStatus('unavailable');
        throw new Error('无法恢复学习对话，请重试或返回当前资源。');
      }
      if (!response.ok) {
        throw new Error(`AI request failed: ${response.status}`);
      }

      const sessionKind = response.headers.get('X-Interactive-AI-Session');
      if (sessionKind === 'ephemeral') {
        setRecoveryStatus('ephemeral');
      } else if (sessionKind === 'recoverable') {
        setRecoveryStatus('ready');
      }

      const assistantContent = await readAITextStream(response);

      const assistantMessage: AIMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      onMessage?.(assistantMessage);

      return assistantContent;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw e;
      }
      const err = e instanceof Error ? e : new Error('Unknown error');
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, isAuthenticated, config, persona, pageId, onMessage, onEvent]);

  return {
    isEnabled,
    isPanelOpen,
    togglePanel,
    sendMessage,
    messages,
    isLoading,
    error,
    recoveryStatus,
    retryRecovery: recover,
  };
}
