/**
 * 控灵本地会话缓存 Hook（不依赖后端）
 *
 * 仅作为 interactive 资源页的 bounded 历史缓存；正式会话与消息真源在
 * /api/ai/sessions 与 /api/ai/chat 服务端合同，客户端不落第二套 conversation store。
 */

import { useCallback, useEffect, useState } from 'react';
import type { Message } from '@/types/ai-message';

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
