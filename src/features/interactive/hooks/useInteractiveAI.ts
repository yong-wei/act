'use client';

import { useState, useCallback, useRef } from 'react';
import type { AIMessage, InteractiveAIContextValue, InteractiveConfig } from '../types';
import { extractAITextFromStreamChunk } from './ai-stream';

interface UseInteractiveAIOptions {
  config: InteractiveConfig;
  persona?: 'tutor' | 'critic' | 'analyst';
  contextData?: Record<string, unknown>;
  onMessage?: (message: AIMessage) => void;
  onEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}

/**
 * 互动 AI 钩子
 *
 * 提供 AI 对话功能，自动注入资源上下文
 */
export function useInteractiveAI(
  options: UseInteractiveAIOptions
): InteractiveAIContextValue {
  const { config, persona = 'tutor', contextData, onMessage, onEvent } = options;

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // AI 是否启用
  const isEnabled = config.config.ai?.enabled !== false;

  // 切换面板
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

  // 发送消息
  const sendMessage = useCallback(async (content: string): Promise<string> => {
    if (!isEnabled) {
      throw new Error('AI is not enabled for this resource');
    }

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // 添加用户消息
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
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content }],
          lessonContext: {
            stage: 'interactive',
            resourceTitle: config.title,
            aiPersona: config.config.ai?.persona || persona,
            customPrompt: config.aiHints,
          },
          contextData: {
            ...contextData,
            resourceId: config.resourceId,
            registryId: config.registryId,
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`AI request failed: ${response.status}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let assistantContent = '';
      let pendingBuffer = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pendingBuffer += decoder.decode(value, { stream: true });
        const lines = pendingBuffer.split('\n');
        pendingBuffer = lines.pop() ?? '';

        for (const line of lines) {
          assistantContent += extractAITextFromStreamChunk(line);
        }
      }

      if (pendingBuffer) {
        assistantContent += extractAITextFromStreamChunk(pendingBuffer);
      }

      // 添加助手消息
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
  }, [isEnabled, config, persona, contextData, onMessage, onEvent]);

  return {
    isEnabled,
    isPanelOpen,
    togglePanel,
    sendMessage,
    messages,
    isLoading,
    error,
  };
}
