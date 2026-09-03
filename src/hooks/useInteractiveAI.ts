/**
 * 互动课程AI助手 Hook
 *
 * 为当前互动课程提供控灵AI助手集成
 */

'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import type { PageContext, UserProfile, StepAIContext } from '@/types/ai-context';
import type { Message } from '@/types/ai-message';
import { toLegacyMessage } from '@/lib/ai/message-compat';
import { readAITextStream } from '@/lib/ai/stream-compat';
import { KONLING_BRAND } from '@/lib/ai-branding';
import { useLocalKonlingSession } from './useKonlingSession';

interface UseInteractiveAIOptions {
  courseId: string;
  stepId: string;
  stepTitle: string;
  stepType: PageContext['pageType'];
  aiContext?: StepAIContext;
  onAiEvent?: (eventType: string, data?: Record<string, unknown>) => void;
}

interface UseInteractiveAIReturn {
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  handleQuickQuestion: (question: string) => void;
  quickQuestions: Array<{ label: string; question: string }>;
  pageContext: PageContext;
  userProfile: UserProfile | null;
}

export function useInteractiveAI({
  courseId,
  stepId,
  stepTitle,
  stepType,
  aiContext,
  onAiEvent,
}: UseInteractiveAIOptions): UseInteractiveAIReturn {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 本地会话管理
  const { messages, addMessage } = useLocalKonlingSession(courseId, stepId);

  // 构建页面上下文
  const pageContext = useMemo<PageContext>(
    () => ({
      courseId,
      courseTitle: getCourseTitle(courseId),
      stepId,
      topic: stepTitle,
      pageType: stepType,
      learningObjectives: aiContext?.learningObjectives || [],
      knowledgeType: aiContext?.knowledgeType || 'C',
      url: pathname || '',
    }),
    [courseId, stepId, stepTitle, stepType, aiContext?.learningObjectives, aiContext?.knowledgeType, pathname]
  );

  // 仅保留认证身份；学习风格与能力事实由服务端受治理画像提供。
  const userProfile = useMemo<UserProfile | null>(
    () =>
      session?.user
        ? {
            id: session.user.id || 'anonymous',
            name: session.user.name || '同学',
          }
        : null,
    [session]
  );

  const openPanel = useCallback(() => {
    setIsOpen(true);
    onAiEvent?.('panel_opened', { stepId });
  }, [onAiEvent, stepId]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    onAiEvent?.('panel_closed', { stepId });
  }, [onAiEvent, stepId]);

  const togglePanel = useCallback(() => {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }, [isOpen, openPanel, closePanel]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!input.trim() || isLoading) return;

      const content = input.trim();
      setInput('');
      setIsLoading(true);

      // 添加用户消息
      const userMessage: Message = toLegacyMessage({
        id: Date.now().toString(),
        role: 'user',
        content,
      });
      addMessage(userMessage);

      // 追踪事件
      onAiEvent?.('message_sent', { stepId, contentLength: content.length });

      try {
        // 调用API
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            pageContext,
            courseId,
            pageId: stepId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const assistantContent = await readAITextStream(response);

        // 添加AI回复
        if (assistantContent) {
          const assistantMessage: Message = toLegacyMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: assistantContent,
          });
          addMessage(assistantMessage);
        }
      } catch (error) {
        console.error('AI chat error:', error);
        // 添加错误消息
        const errorMessage: Message = toLegacyMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '抱歉，我遇到了一些问题。请稍后再试，或者换一种方式提问。',
        });
        addMessage(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, pageContext, courseId, stepId, addMessage, onAiEvent]
  );

  const handleQuickQuestion = useCallback((question: string) => {
    setInput(question);
  }, []);

  // 获取快捷问题
  const quickQuestions = getQuickQuestions(courseId, aiContext?.keyConcepts);

  // ESC键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closePanel();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, closePanel]);

  return {
    isOpen,
    openPanel,
    closePanel,
    togglePanel,
    messages,
    input,
    setInput,
    isLoading,
    handleSubmit,
    handleQuickQuestion,
    quickQuestions,
    pageContext,
    userProfile,
  };
}

/**
 * 获取课程标题
 */
function getCourseTitle(courseId: string): string {
  const titles: Record<string, string> = {};
  return titles[courseId] || courseId;
}

/**
 * 根据课程和关键概念获取快捷问题
 */
function getQuickQuestions(
  courseId: string,
  keyConcepts?: string[]
): Array<{ label: string; question: string }> {
  // 基于关键概念生成问题
  if (keyConcepts && keyConcepts.length > 0) {
    return keyConcepts.slice(0, 4).map((concept) => ({
      label: concept.slice(0, 6),
      question: `请解释一下「${concept}」`,
    }));
  }

  return [...KONLING_BRAND.quickQuestions.simulation];
}
