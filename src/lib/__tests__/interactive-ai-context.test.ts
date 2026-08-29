import { describe, expect, it } from 'vitest';

import {
  INTERACTIVE_AI_COURSE_ID,
  buildInteractiveAiChatBody,
  conversationMatchesInteractivePage,
  interactiveAiListUrl,
  interactiveAiPageId,
  mapRecoveredInteractiveAiMessages,
} from '@/lib/interactive-ai-context';
import type { Message } from '@/types/ai-message';

describe('interactive AI context contract', () => {
  it('builds resource-bound page ids and isolates classroom sessions', () => {
    expect(interactiveAiPageId('pid-tuner')).toBe('/interactive-learning/resources/pid-tuner');
    expect(interactiveAiPageId('pid-tuner', 'demo')).toBe('/interactive-learning/resources/pid-tuner');
    expect(interactiveAiPageId('pid-tuner', 'class-session-1'))
      .toBe('/interactive-learning/resources/pid-tuner/classroom/class-session-1');
  });

  it('looks up existing conversations by course and page identity', () => {
    expect(interactiveAiListUrl('/interactive-learning/resources/pid-tuner')).toBe(
      '/api/ai/sessions?courseId=interactive&pageId=%2Finteractive-learning%2Fresources%2Fpid-tuner',
    );
  });

  it('sends only the current question plus governed session hints', () => {
    const body = buildInteractiveAiChatBody({
      content: '那我刚才的判断为什么不成立？',
      conversationId: 'conv-1',
      resourceTitle: 'PID 调节',
      pageId: '/interactive-learning/resources/pid-tuner',
    });
    expect(body.messages).toEqual([{ role: 'user', content: '那我刚才的判断为什么不成立？' }]);
    expect(body.conversationId).toBe('conv-1');
    expect(body).not.toHaveProperty('contextData');
    expect(body.pageContext).toMatchObject({
      courseId: INTERACTIVE_AI_COURSE_ID,
      stepId: '/interactive-learning/resources/pid-tuner',
    });
  });

  it('does not treat a mismatched conversation as the current resource history', () => {
    expect(conversationMatchesInteractivePage(
      { courseId: 'interactive', pageId: '/interactive-learning/resources/a' },
      { courseId: 'interactive', pageId: '/interactive-learning/resources/b' },
    )).toBe(false);
  });

  it('restores only user and assistant turns in stable order', () => {
    const restored = mapRecoveredInteractiveAiMessages([
      { id: 'ctx', role: 'system', content: '[控灵当前页面上下文]' },
      { id: 'u1', role: 'user', content: '这一步的控制目标是什么？' },
      { id: 'a1', role: 'assistant', content: '保持航向误差收敛。' },
    ] as Message[]);
    expect(restored.map((message) => message.id)).toEqual(['u1', 'a1']);
    expect(restored[0]?.role).toBe('user');
  });
});
