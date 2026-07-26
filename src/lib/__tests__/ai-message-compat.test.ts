import { describe, expect, it } from 'vitest';

import {
  replaceMessageTextContent,
  toLegacyMessage,
  toModelMessages,
} from '@/lib/ai-message-compat';

describe('AI SDK message compatibility', () => {
  it('normalizes legacy content messages to UIMessage parts', async () => {
    const message = toLegacyMessage({
      id: 'm1',
      role: 'user',
      content: '请解释 PID 控制。',
    });

    expect(message.content).toBe('请解释 PID 控制。');
    expect(message.parts).toEqual([{ type: 'text', text: '请解释 PID 控制。' }]);

    await expect(toModelMessages([message])).resolves.toEqual([
      { role: 'user', content: [{ type: 'text', text: '请解释 PID 控制。' }] },
    ]);
  });

  it('preserves UIMessage text parts and exposes legacy content', () => {
    const message = toLegacyMessage({
      id: 'm2',
      role: 'assistant',
      parts: [
        { type: 'text', text: '第一段' },
        { type: 'text', text: '第二段' },
      ],
    });

    expect(message.content).toBe('第一段第二段');
  });

  it('preserves metadata when normalizing legacy content messages', () => {
    const message = toLegacyMessage({
      id: 'm4',
      role: 'assistant',
      content: '带引用的回答',
      metadata: {
        konlingCitationGuard: {
          missingContext: ['learner-state'],
          retrievalSources: [{ sourceType: 'content', displayTitle: 'PID 参数整定' }],
          personalizationAvailability: { status: 'limited' },
        },
      },
    });

    expect(message.metadata).toEqual({
      konlingCitationGuard: {
        missingContext: ['learner-state'],
        retrievalSources: [{ sourceType: 'content', displayTitle: 'PID 参数整定' }],
        personalizationAvailability: { status: 'limited' },
      },
    });
  });

  it('maps AI SDK v6 tool parts to legacy tool invocations', () => {
    const message = toLegacyMessage({
      id: 'm3',
      role: 'assistant',
      parts: [
        {
          type: 'tool-get_simulation_status',
          toolCallId: 'tool-1',
          state: 'output-available',
          input: {},
          output: { status: '运行中' },
        } as any,
        {
          type: 'dynamic-tool',
          toolName: 'analyze_result',
          toolCallId: 'tool-2',
          state: 'input-available',
          input: { avgError: 12 },
        } as any,
      ],
    });

    expect(message.toolInvocations).toEqual([
      {
        toolName: 'get_simulation_status',
        state: 'result',
        result: { status: '运行中' },
      },
      {
        toolName: 'analyze_result',
        state: 'call',
        result: undefined,
      },
    ]);
  });

  it('replaces normalized text while preserving tool parts', () => {
    const message = replaceMessageTextContent({
      id: 'm5',
      role: 'assistant',
      parts: [
        { type: 'text', text: '原始正文' },
        {
          type: 'tool-search_textbook',
          toolCallId: 'tool-1',
          state: 'output-available',
          input: { query: '根轨迹' },
          output: { citations: [1] },
        } as any,
        { type: 'text', text: '重复正文' },
      ],
    }, '规范化正文 [1]', {
      konlingMessageRevision: { revision: 2 },
    });

    expect(message.parts).toEqual([
      { type: 'text', text: '规范化正文 [1]' },
      expect.objectContaining({
        type: 'tool-search_textbook',
        toolCallId: 'tool-1',
        state: 'output-available',
      }),
    ]);
    expect(message.metadata).toEqual({
      konlingMessageRevision: { revision: 2 },
    });
  });
});
