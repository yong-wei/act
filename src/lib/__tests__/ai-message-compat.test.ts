import { describe, expect, it } from 'vitest';

import { toLegacyMessage, toModelMessages } from '@/lib/ai-message-compat';

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
});
