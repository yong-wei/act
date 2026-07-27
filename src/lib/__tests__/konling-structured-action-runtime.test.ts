import { describe, expect, it, vi } from 'vitest';

import {
  correctKonlingMalformedStructuredResponse,
  createKonlingStructuredActionStream,
  normalizeKonlingAssistantMessage,
  normalizeKonlingStructuredText,
  type KonlingStructuredActionStreamState,
} from '@/lib/konling-structured-action-runtime';

async function readChunks(stream: ReadableStream<any>): Promise<any[]> {
  const chunks: any[] = [];
  const reader = stream.getReader();
  while (true) {
    const next = await reader.read();
    if (next.done) return chunks;
    chunks.push(next.value);
  }
}

describe('Konling structured action runtime', () => {
  it('replays a buffered AI SDK text part with its original id before finish', async () => {
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-1' });
        controller.enqueue({ type: 'text-start', id: 'text-provider-7' });
        controller.enqueue({ type: 'text-delta', id: 'text-provider-7', delta: '第一段' });
        controller.enqueue({ type: 'text-delta', id: 'text-provider-7', delta: '第二段' });
        controller.enqueue({ type: 'text-end', id: 'text-provider-7' });
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({ stream: source, state }));

    expect(chunks).toEqual([
      { type: 'start', messageId: 'assistant-1' },
      { type: 'text-start', id: 'text-provider-7' },
      { type: 'text-delta', id: 'text-provider-7', delta: '第一段第二段' },
      { type: 'text-end', id: 'text-provider-7' },
      { type: 'finish', finishReason: 'stop' },
    ]);
  });

  it('replays a complete text lifecycle from the flush fallback', async () => {
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-start', id: 'text-flush-1' });
        controller.enqueue({ type: 'text-delta', id: 'text-flush-1', delta: '流提前结束' });
        controller.enqueue({ type: 'text-end', id: 'text-flush-1' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({ stream: source, state }));

    expect(chunks).toEqual([
      { type: 'text-start', id: 'text-flush-1' },
      { type: 'text-delta', id: 'text-flush-1', delta: '流提前结束' },
      { type: 'text-end', id: 'text-flush-1' },
    ]);
  });

  it('normalizes recognized DSML without placing its envelope in prose', () => {
    const normalized = normalizeKonlingStructuredText([
      '我已准备好建议。',
      '<tool_call>{"id":"call-1","name":"propose_smart_lesson_task_change","arguments":{"taskId":"task-1"}}</tool_call>',
    ].join('\n'));

    expect(normalized.text).toBe('我已准备好建议。');
    expect(normalized.toolCalls).toEqual([{
      id: 'call-1',
      name: 'propose_smart_lesson_task_change',
      input: { taskId: 'task-1' },
      source: 'dsml',
    }]);
    expect(normalized.withheldMalformedSyntax).toBe(false);
  });

  it('normalizes DeepSeek block syntax and deduplicates mixed native and DSML calls', () => {
    const message = normalizeKonlingAssistantMessage({
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: 'native-1',
          toolName: 'get_plan_context',
          state: 'input-available',
          input: { pathId: 'path-1' },
        },
        {
          type: 'text',
          text: [
            '正在读取计划。',
            '<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>get_plan_context<｜tool▁sep｜>{"pathId":"path-1"}<｜tool▁call▁end｜><｜tool▁calls▁end｜>',
          ].join('\n'),
        },
      ],
    });

    expect(message.message.content).toBe('正在读取计划。');
    expect(message.toolCalls).toHaveLength(1);
    expect(message.message.parts.filter((part) => part.type === 'dynamic-tool')).toHaveLength(1);
  });

  it('withholds malformed structured syntax instead of presenting it as a successful answer', () => {
    const normalized = normalizeKonlingStructuredText(
      '安全前缀。<tool_call>{"name":"get_plan_context","arguments":',
    );

    expect(normalized.text).toBe('安全前缀。');
    expect(normalized.toolCalls).toEqual([]);
    expect(normalized.withheldMalformedSyntax).toBe(true);
  });

  it('withholds complete JSON-like envelopes that are malformed', () => {
    for (const value of [
      '安全前缀。<tool_call>{"name":"get_plan_context","arguments":}</tool_call>不可见后缀',
      '安全前缀。<｜tool▁call▁begin｜>get_plan_context<｜tool▁sep｜>{"pathId":}<｜tool▁call▁end｜>不可见后缀',
    ]) {
      const normalized = normalizeKonlingStructuredText(value);

      expect(normalized.text).toBe('安全前缀。');
      expect(normalized.toolCalls).toEqual([]);
      expect(normalized.withheldMalformedSyntax).toBe(true);
    }
  });

  it('keeps ordinary text streaming while withholding split structured syntax', async () => {
    const executeToolCall = vi.fn(async () => ({ page: 'current' }));
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-1' });
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: '可见说明。<tool_' });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-1',
          delta: 'call>{"name":"get_page_context","arguments":{}}</tool_call>',
        });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall,
    }));
    const visibleText = chunks
      .filter((chunk) => chunk.type === 'text-delta')
      .map((chunk) => chunk.delta)
      .join('');

    expect(visibleText).toBe('可见说明。');
    expect(visibleText).not.toContain('tool_call');
    expect(chunks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'tool-input-available',
        toolName: 'get_page_context',
        input: {},
      }),
    ]));
    expect(state.toolCalls).toHaveLength(1);
    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(chunks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'tool-output-available',
        output: { page: 'current' },
      }),
    ]));
  });

  it('withholds a malformed closed envelope split across chunks without executing it', async () => {
    const executeToolCall = vi.fn();
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: '安全前缀。<tool_call>{"name":' });
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: '"get_page_context","arguments":}</tool_call>不可见后缀' });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall,
    }));

    expect(chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.delta).join(''))
      .toBe('安全前缀。');
    expect(state.withheldMalformedSyntax).toBe(true);
    expect(executeToolCall).not.toHaveBeenCalled();
  });

  it('does not treat ordinary XML-like text or fenced examples as structured calls', () => {
    const value = [
      '<invoke>demo</invoke>',
      '<function_call>literal</function_call>',
      '<tool_call>demo</tool_call>',
      '```xml',
      '<tool_call>{"name":"get_page_context","arguments":{}}</tool_call>',
      '```',
    ].join('\n');
    const normalized = normalizeKonlingStructuredText(value);

    expect(normalized.text).toBe(value);
    expect(normalized.toolCalls).toEqual([]);
    expect(normalized.withheldMalformedSyntax).toBe(false);
  });

  it('fails closed when a recognized DSML call cannot use a permitted scoped tool', async () => {
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-1' });
        controller.enqueue({ type: 'text-start', id: 'text-1' });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-1',
          delta: '<tool_call>{"name":"unknown_tool","arguments":{}}</tool_call>',
        });
        controller.enqueue({ type: 'text-end', id: 'text-1' });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall: async () => {
        throw new Error('not permitted');
      },
    }));

    expect(chunks.filter((chunk) => chunk.type === 'text-delta').map((chunk) => chunk.delta).join(''))
      .toBe('结构化操作未能安全完成，请重新生成建议。');
    expect(chunks).toEqual(expect.arrayContaining([
      { type: 'text-start', id: 'text-1' },
      {
        type: 'text-delta',
        id: 'text-1',
        delta: '结构化操作未能安全完成，请重新生成建议。',
      },
      { type: 'text-end', id: 'text-1' },
      expect.objectContaining({ type: 'tool-output-error' }),
    ]));
  });

  it('emits no text part for a successful pure-tool response and executes it once', async () => {
    const executeToolCall = vi.fn(async () => ({ page: 'current' }));
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-1' });
        controller.enqueue({ type: 'text-start', id: 'text-tool-only' });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-tool-only',
          delta: '<tool_call>{"name":"get_page_context","arguments":{}}</tool_call>',
        });
        controller.enqueue({ type: 'text-end', id: 'text-tool-only' });
        controller.enqueue({ type: 'finish', finishReason: 'tool-calls' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall,
    }));

    expect(chunks.filter((chunk) => chunk.type.startsWith('text-'))).toEqual([]);
    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(chunks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tool-input-available', toolName: 'get_page_context' }),
      expect.objectContaining({ type: 'tool-output-available', output: { page: 'current' } }),
    ]));
    expect(chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'tool-calls' });
  });

  it('does not execute a DSML duplicate after the native call already ran', async () => {
    const executeToolCall = vi.fn();
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-1' });
        controller.enqueue({
          type: 'tool-input-available',
          toolCallId: 'native-1',
          toolName: 'get_page_context',
          input: {},
          dynamic: true,
        });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-1',
          delta: '<tool_call>{"name":"get_page_context","arguments":{}}</tool_call>',
        });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall,
    }));

    expect(state.toolCalls).toHaveLength(1);
    expect(state.toolCalls[0]?.source).toBe('native');
    expect(executeToolCall).not.toHaveBeenCalled();
  });

  it('keeps smart-preparation action payloads out of the client stream', async () => {
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-1' });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-1',
          delta: '<tool_call>{"name":"propose_smart_lesson_task_change","arguments":{"proposedTask":{"topic":"private-topic"}}}</tool_call>',
        });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall: async () => ({ suggestionId: 'private-suggestion', status: 'awaiting_teacher_confirmation' }),
    }));
    const encoded = JSON.stringify(chunks);

    expect(state.executedToolResults).toHaveLength(1);
    expect(encoded).not.toContain('private-topic');
    expect(encoded).not.toContain('private-suggestion');
    expect(encoded).not.toContain('propose_smart_lesson_task_change');
  });

  it('bounds malformed-response correction by the shared absolute deadline', async () => {
    const startedAt = Date.now();
    const correction = await correctKonlingMalformedStructuredResponse({
      timeoutMs: 5,
      generate: () => new Promise<string>(() => undefined),
    });

    expect(correction.status).toBe('failed');
    expect(Date.now() - startedAt).toBeLessThan(100);
  });
});
