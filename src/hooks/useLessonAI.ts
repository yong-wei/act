'use client';

/**
 * useLessonAI Hook
 *
 * 连接 ContextInjector 与 AI 请求
 * 自动将课程上下文注入到 AI 对话中
 */

import { useCallback, useMemo, useState } from 'react';
import { useLessonContext } from '@/features/lesson-engine/ContextInjector';
import type { LessonContext } from '@/lib/ai-client';
import { readAITextStream } from '@/lib/ai-stream-compat';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UseLessonAIOptions {
  /** 自定义 AI 角色 */
  persona?: 'tutor' | 'critic' | 'analyst';
  /** 仿真状态 */
  simulationState?: Record<string, unknown>;
  /** 流式响应回调 */
  onStream?: (chunk: string) => void;
  /** 完成回调 */
  onFinish?: (content: string) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

interface UseLessonAIReturn {
  /** 发送消息到 AI */
  sendMessage: (content: string, messages?: Message[]) => Promise<string>;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 构建的课程上下文 */
  lessonContext: LessonContext | null;
}

export function useLessonAI(options: UseLessonAIOptions = {}): UseLessonAIReturn {
  const { persona, simulationState, onStream, onFinish, onError } = options;

  const lessonCtx = useLessonContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 构建课程上下文
  // Note: LessonStep may not have stage property in legacy schema
  const lessonContext: LessonContext | null = useMemo(() => {
    if (!lessonCtx.step) return null;

    const stepWithStage = lessonCtx.step as { stage?: string } | null;
    return {
      stage: stepWithStage?.stage || undefined,
      resourceTitle: lessonCtx.title || undefined,
      aiPersona:
        persona ||
        (lessonCtx.aiConfig?.persona as 'tutor' | 'critic' | 'analyst') ||
        undefined,
      customPrompt: lessonCtx.aiConfig?.systemPromptExtension || undefined,
    };
  }, [
    lessonCtx.step,
    lessonCtx.title,
    lessonCtx.aiConfig?.persona,
    lessonCtx.aiConfig?.systemPromptExtension,
    persona,
  ]);

  const sendMessage = useCallback(
    async (content: string, messages: Message[] = []): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              ...messages,
              { id: Date.now().toString(), role: 'user', content },
            ],
            lessonContext,
            simulationState,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || 'AI 请求失败');
        }

        const fullContent = await readAITextStream(response, onStream);

        onFinish?.(fullContent);
        return fullContent;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [lessonContext, simulationState, onStream, onFinish, onError]
  );

  return {
    sendMessage,
    isLoading,
    error,
    lessonContext,
  };
}

export default useLessonAI;
