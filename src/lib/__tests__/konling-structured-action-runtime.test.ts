import { describe, expect, it, vi } from 'vitest';

import {
  correctKonlingMalformedStructuredResponse,
  createKonlingStructuredActionStream,
  executeKonlingScopedAiTool,
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

  it('normalizes the provider DSML invoke trace with object arguments', () => {
    const trace = [
      '这是教师可见说明。',
      '<｜DSML｜tool_calls>',
      '<｜DSML｜invoke name="propose_smart_lesson_task_change">',
      '<｜DSML｜parameter name="arguments" string="false">',
      '{"operation":"revise","taskId":"task-1","expectedRevision":3,"proposedTask":{"topic":"闭环稳定性"}}',
      '</｜DSML｜parameter>',
      '</｜DSML｜invoke>',
      '</｜DSML｜tool_calls>',
    ].join('');
    const normalized = normalizeKonlingStructuredText(trace);

    expect(normalized).toEqual({
      text: '这是教师可见说明。',
      toolCalls: [{
        id: 'dsml-1',
        name: 'propose_smart_lesson_task_change',
        input: {
          operation: 'revise',
          taskId: 'task-1',
          expectedRevision: 3,
          proposedTask: { topic: '闭环稳定性' },
        },
        source: 'dsml',
      }],
      withheldMalformedSyntax: false,
    });
  });

  it('withholds malformed or incomplete provider DSML while protecting code and ordinary XML', () => {
    for (const value of [
      '安全前缀。<｜DSML｜tool_calls><｜DSML｜invoke name="get_page_context"><｜DSML｜parameter name="arguments" string="false">{"pageId":}</｜DSML｜parameter></｜DSML｜invoke></｜DSML｜tool_calls>不可见',
      '安全前缀。<｜DSML｜tool_calls><｜DSML｜invoke name="get_page_context"><｜DSML｜parameter name="arguments" string="false">{"pageId":"current"}',
    ]) {
      const normalized = normalizeKonlingStructuredText(value);
      expect(normalized.text).toBe('安全前缀。');
      expect(normalized.toolCalls).toEqual([]);
      expect(normalized.withheldMalformedSyntax).toBe(true);
    }

    const literal = [
      '<invoke name="get_page_context"><parameter name="arguments">{}</parameter></invoke>',
      '```xml',
      '<｜DSML｜tool_calls><｜DSML｜invoke name="get_page_context"><｜DSML｜parameter name="arguments" string="false">{}</｜DSML｜parameter></｜DSML｜invoke></｜DSML｜tool_calls>',
      '```',
    ].join('\n');
    expect(normalizeKonlingStructuredText(literal)).toEqual({
      text: literal,
      toolCalls: [],
      withheldMalformedSyntax: false,
    });
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

  it('executes a split provider DSML invoke exactly once without leaking its envelope', async () => {
    const executeToolCall = vi.fn(async () => ({
      suggestionId: 'internal-suggestion',
      status: 'awaiting_teacher_confirmation',
    }));
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-dsml' });
        controller.enqueue({ type: 'text-start', id: 'text-dsml' });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-dsml',
          delta: '<｜DSML｜tool_calls><｜DSML｜invoke name="propose_smart_lesson_task_change">',
        });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-dsml',
          delta: '<｜DSML｜parameter name="arguments" string="false">{"operation":"revise","taskId":"task-1","expectedRevision":3,"proposedTask":{"topic":"根轨迹"}}',
        });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-dsml',
          delta: '</｜DSML｜parameter></｜DSML｜invoke></｜DSML｜tool_calls>',
        });
        controller.enqueue({ type: 'text-end', id: 'text-dsml' });
        controller.enqueue({ type: 'finish', finishReason: 'tool-calls' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall,
    }));

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(executeToolCall).toHaveBeenCalledWith(expect.objectContaining({
      name: 'propose_smart_lesson_task_change',
      input: expect.objectContaining({
        operation: 'revise',
        taskId: 'task-1',
        proposedTask: { topic: '根轨迹' },
      }),
      source: 'dsml',
    }));
    expect(state.toolCalls).toHaveLength(1);
    expect(state.executedToolResults).toHaveLength(1);
    expect(JSON.stringify(chunks)).not.toContain('DSML');
    expect(JSON.stringify(chunks)).not.toContain('根轨迹');
    expect(chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'tool-calls' });
  });

  it('assembles the provider native fragmented proposal trace and executes it once', async () => {
    const executeToolCall = vi.fn(async () => ({
      suggestionId: 'internal-suggestion',
      status: 'awaiting_teacher_confirmation',
    }));
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'tool-input-start',
          toolCallId: 'provider-call-1',
          toolName: 'propose_smart_lesson_task_change',
        });
        controller.enqueue({
          type: 'tool-input-delta',
          toolCallId: 'provider-call-1',
          inputTextDelta: '{"operation":"revise","taskId":"task-1",',
        });
        controller.enqueue({
          type: 'tool-input-delta',
          toolCallId: 'provider-call-1',
          inputTextDelta: '"expectedRevision":3,"proposedTask":{"topic":"根轨迹"}}',
        });
        controller.enqueue({ type: 'finish-step' });
        controller.enqueue({ type: 'text-start', id: 'text-fallback' });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-fallback',
          delta: '建议已生成。结构化操作未能安全完成，请重新生成建议。请确认下方卡片。',
        });
        controller.enqueue({ type: 'text-end', id: 'text-fallback' });
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall,
    }));

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(executeToolCall).toHaveBeenCalledWith(expect.objectContaining({
      id: 'provider-call-1',
      name: 'propose_smart_lesson_task_change',
      input: expect.objectContaining({
        operation: 'revise',
        taskId: 'task-1',
        proposedTask: { topic: '根轨迹' },
      }),
      source: 'native',
    }));
    expect(state.toolCalls).toHaveLength(1);
    expect(state.executedToolResults).toHaveLength(1);
    expect(chunks).toEqual([
      { type: 'finish-step' },
      { type: 'text-start', id: 'text-fallback' },
      { type: 'text-delta', id: 'text-fallback', delta: '建议已生成。请确认下方卡片。' },
      { type: 'text-end', id: 'text-fallback' },
      { type: 'finish', finishReason: 'stop' },
    ]);
  });

  it('does not fallback-execute fragmented input after input-available arrives', async () => {
    const executeToolCall = vi.fn();
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const proposal = { operation: 'bootstrap', proposedTask: { topic: '根轨迹' } };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'tool-input-start',
          toolCallId: 'provider-call-available',
          toolName: 'propose_smart_lesson_task_change',
        });
        controller.enqueue({
          type: 'tool-input-delta',
          toolCallId: 'provider-call-available',
          inputTextDelta: JSON.stringify(proposal),
        });
        controller.enqueue({
          type: 'tool-input-available',
          toolCallId: 'provider-call-available',
          toolName: 'propose_smart_lesson_task_change',
          input: proposal,
          dynamic: true,
        });
        controller.enqueue({
          type: 'tool-output-available',
          toolCallId: 'provider-call-available',
          output: { suggestionId: 'internal-suggestion' },
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

    expect(executeToolCall).not.toHaveBeenCalled();
    expect(state.toolCalls).toHaveLength(1);
    expect(JSON.stringify(chunks)).not.toContain('propose_smart_lesson_task_change');
    expect(JSON.stringify(chunks)).not.toContain('internal-suggestion');
  });

  it('executes only once when fragmented native input is semantically duplicated by DSML', async () => {
    const executeToolCall = vi.fn(async () => ({ page: 'current' }));
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'tool-input-start',
          toolCallId: 'fragment-call',
          toolName: 'get_page_context',
        });
        controller.enqueue({
          type: 'tool-input-delta',
          toolCallId: 'fragment-call',
          inputTextDelta: '{}',
        });
        controller.enqueue({ type: 'text-start', id: 'text-duplicate' });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-duplicate',
          delta: '<tool_call>{"name":"get_page_context","arguments":{}}</tool_call>',
        });
        controller.enqueue({ type: 'text-end', id: 'text-duplicate' });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall,
    }));

    expect(executeToolCall).toHaveBeenCalledTimes(1);
    expect(state.toolCalls).toHaveLength(1);
    expect(state.executedToolResults).toHaveLength(1);
  });

  it.each([
    ['invalid', '{"operation":"revise","proposedTask":}'],
    ['incomplete', '{"operation":"revise"'],
  ])('fails closed for %s fragmented native JSON', async (_label, inputTextDelta) => {
    const executeToolCall = vi.fn();
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'tool-input-start',
          toolCallId: 'malformed-call',
          toolName: 'propose_smart_lesson_task_change',
        });
        controller.enqueue({
          type: 'tool-input-delta',
          toolCallId: 'malformed-call',
          inputTextDelta,
        });
        controller.enqueue({ type: 'finish-step' });
        controller.enqueue({ type: 'text-start', id: 'text-failure' });
        controller.enqueue({
          type: 'text-delta',
          id: 'text-failure',
          delta: '结构化操作未能安全完成，请重新生成建议。',
        });
        controller.enqueue({ type: 'text-end', id: 'text-failure' });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    const chunks = await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall,
    }));

    expect(executeToolCall).not.toHaveBeenCalled();
    expect(state.toolCalls).toEqual([]);
    expect(state.withheldMalformedSyntax).toBe(true);
    expect(JSON.stringify(chunks)).not.toContain(inputTextDelta);
    expect(chunks).toEqual(expect.arrayContaining([
      { type: 'text-start', id: 'text-failure' },
      {
        type: 'text-delta',
        id: 'text-failure',
        delta: '结构化操作未能安全完成，请重新生成建议。',
      },
      { type: 'text-end', id: 'text-failure' },
    ]));
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

  it('logs only safe non-production diagnostics for scoped input validation failures', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const state: KonlingStructuredActionStreamState = {
      toolCalls: [],
      executedToolResults: [],
      withheldMalformedSyntax: false,
      withheldText: '',
    };
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'text-delta',
          id: 'text-private',
          delta: '<tool_call>{"id":"private-call-id","name":"propose_smart_lesson_task_change","arguments":{"targetUserId":"private-user-id","proposedTask":{"topic":"private-topic"},"apiKey":"private-key"}}</tool_call>',
        });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    await readChunks(createKonlingStructuredActionStream({
      stream: source,
      state,
      executeToolCall: (call) => executeKonlingScopedAiTool({
        call,
        tools: {
          propose_smart_lesson_task_change: {
            inputSchema: {
              safeParse: () => ({
                success: false,
                error: {
                  issues: [{
                    path: ['proposedTask', 'topic'],
                    code: 'invalid_type',
                    message: 'private-topic is invalid for private-user-id',
                  }],
                },
              }),
            },
            execute: vi.fn(),
          },
        },
      }),
    }));

    expect(log).toHaveBeenCalledTimes(1);
    const encodedLog = JSON.stringify(log.mock.calls);
    expect(encodedLog).toContain('propose_smart_lesson_task_change');
    expect(encodedLog).toContain('input-schema');
    expect(encodedLog).toContain('structured-tool-input-invalid');
    expect(encodedLog).toContain('invalid_type');
    expect(encodedLog).toContain('proposedTask');
    for (const privateValue of [
      'private-call-id',
      'private-user-id',
      'private-topic',
      'private-key',
    ]) {
      expect(encodedLog).not.toContain(privateValue);
    }
    expect(state.executedToolResults).toEqual([
      expect.objectContaining({
        toolName: 'propose_smart_lesson_task_change',
        errorText: '结构化操作未能安全完成。',
      }),
    ]);
    log.mockRestore();
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
