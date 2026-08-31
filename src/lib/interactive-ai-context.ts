import type { Message } from '@/types/ai-message';

export const INTERACTIVE_AI_COURSE_ID = 'interactive';
export const INTERACTIVE_AI_LEARNING_CONTEXT_NOTE =
  '当前互动资源上下文只用于学习辅导。进度和完成状态不是官方成绩、掌握度结论、LearningFact 或学习画像。';

export type InteractiveAiRecoveryStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'ephemeral';

export function interactiveAiPageId(
  resourceId: string,
  classroomSessionId?: string | null,
): string {
  const encodedResource = encodeURIComponent(resourceId);
  const base = `/interactive-learning/resources/${encodedResource}`;
  if (!classroomSessionId || classroomSessionId === 'demo') {
    return base;
  }
  return `${base}/classroom/${encodeURIComponent(classroomSessionId)}`;
}

export function interactiveAiListUrl(pageId: string): string {
  const params = new URLSearchParams({
    courseId: INTERACTIVE_AI_COURSE_ID,
    pageId,
  });
  return `/api/ai/sessions?${params.toString()}`;
}

export function conversationMatchesInteractivePage(
  conversation: { courseId: string; pageId: string },
  authorized: { courseId: string; pageId: string },
): boolean {
  return conversation.courseId === authorized.courseId
    && conversation.pageId === authorized.pageId;
}

export function mapRecoveredInteractiveAiMessages(messages: readonly Message[]): Array<{
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}> {
  return messages.flatMap((message, index) => {
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    return [{
      id: message.id ?? `recovered_${index}`,
      role: message.role,
      content: typeof message.content === 'string' ? message.content : '',
      timestamp: Date.now(),
    }];
  });
}

export function buildInteractiveAiChatBody(input: {
  content: string;
  conversationId?: string;
  resourceTitle: string;
  persona?: 'tutor' | 'critic' | 'analyst';
  customPrompt?: string;
  pageId: string;
}): Record<string, unknown> {
  return {
    messages: [{ role: 'user', content: input.content }],
    conversationId: input.conversationId,
    lessonContext: {
      stage: 'interactive',
      resourceTitle: input.resourceTitle,
      aiPersona: input.persona ?? 'tutor',
      customPrompt: input.customPrompt,
    },
    pageContext: {
      courseId: INTERACTIVE_AI_COURSE_ID,
      courseTitle: '互动学习',
      stepId: input.pageId,
      topic: input.resourceTitle,
      pageType: 'practice',
      url: input.pageId,
    },
  };
}
