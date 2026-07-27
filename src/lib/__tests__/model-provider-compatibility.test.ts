import { describe, expect, it } from 'vitest';

import {
  buildModelProviderCompatibilityMatrix,
  normalizeAnthropicCompatibleResponse,
  normalizeOpenAICompatibleResponse,
  normalizeProviderStructuredText,
  normalizeProviderStreamEvent,
  redactProviderError,
  selectModelProvider,
} from '@/lib/ai/model-provider-compatibility';
import type { AIProviderSettings } from '@/lib/ai/provider-settings';

const settings: AIProviderSettings = {
  activeProvider: 'openai-main',
  providers: [
    {
      id: 'openai-main',
      name: 'OpenAI Compatible',
      providerKind: 'openai-compatible',
      baseURL: 'https://openai-compatible.test/v1',
      authMode: 'bearer-api-key',
      secretRef: 'env:OPENAI_COMPATIBLE_API_KEY',
      selectedModel: 'openai/model',
      enabled: true,
      priority: 20,
      health: 'healthy',
      capabilities: {
        tools: true,
        reasoning: false,
        vision: false,
        jsonSchema: true,
        streaming: true,
        citationNormalization: false,
      },
      models: [{ id: 'openai-model', label: 'OpenAI Model', model: 'openai/model' }],
    },
    {
      id: 'anthropic-cited',
      name: 'Anthropic Compatible',
      providerKind: 'anthropic-compatible',
      baseURL: 'https://anthropic-compatible.test/v1',
      authMode: 'bearer-api-key',
      secretRef: 'env:ANTHROPIC_COMPATIBLE_API_KEY',
      selectedModel: 'claude/model',
      enabled: true,
      priority: 10,
      health: 'healthy',
      capabilities: {
        tools: true,
        reasoning: true,
        vision: true,
        jsonSchema: false,
        streaming: true,
        citationNormalization: true,
      },
      models: [{ id: 'claude-model', label: 'Claude Model', model: 'claude/model' }],
    },
    {
      id: 'openai-cited',
      name: 'OpenAI Compatible With Citations',
      providerKind: 'openai-compatible',
      baseURL: 'https://openai-cited.test/v1',
      authMode: 'bearer-api-key',
      secretRef: 'env:OPENAI_CITED_API_KEY',
      selectedModel: 'openai/cited-model',
      enabled: true,
      priority: 30,
      health: 'healthy',
      capabilities: {
        tools: true,
        reasoning: false,
        vision: false,
        jsonSchema: true,
        streaming: true,
        citationNormalization: true,
      },
      models: [{ id: 'openai-cited-model', label: 'OpenAI Cited Model', model: 'openai/cited-model' }],
    },
  ],
};

describe('model provider compatibility matrix', () => {
  it('orders enabled providers by priority and exposes redacted service metadata', () => {
    const matrix = buildModelProviderCompatibilityMatrix(settings);

    expect(matrix.map((entry) => entry.serviceId)).toEqual(['anthropic-cited', 'openai-main', 'openai-cited']);
    expect(JSON.stringify(matrix)).toContain('env:ANTHROPIC_COMPATIBLE_API_KEY');
    expect(JSON.stringify(matrix)).not.toContain('sk-');
    expect(matrix.find((entry) => entry.serviceId === 'anthropic-cited')?.runtimeSupported).toBe(false);
    expect(matrix.find((entry) => entry.serviceId === 'anthropic-cited')?.runtimeSupport).toMatchObject({
      status: 'adapter-missing',
      category: 'runtime-adapter',
      supported: false,
    });
    expect(matrix.find((entry) => entry.serviceId === 'openai-cited')?.runtimeSupported).toBe(true);
  });

  it('selects providers that satisfy required Konling citation capabilities', () => {
    const selection = selectModelProvider(settings, {
      tools: true,
      streaming: true,
      citationNormalization: true,
    });

    expect(selection.status).toBe('selected');
    expect(selection.provider?.serviceId).toBe('openai-cited');
    expect(selection.missingCapabilities).toEqual([]);
  });

  it('does not select Anthropic-compatible providers until a native runtime adapter exists', () => {
    const anthropicOnly: AIProviderSettings = {
      ...settings,
      activeProvider: 'anthropic-cited',
      providers: settings.providers.filter((provider) => provider.id === 'anthropic-cited'),
    };

    const selection = selectModelProvider(anthropicOnly, {
      tools: true,
      streaming: true,
      citationNormalization: true,
    });

    expect(selection.status).toBe('unavailable');
    expect(selection.provider).toBeNull();
    expect(selection.reason).toContain('without a runtime adapter');
  });

  it('returns an explicit downgraded state when a requested service lacks citations', () => {
    const selection = selectModelProvider(settings, {
      serviceId: 'openai-main',
      tools: true,
      streaming: true,
      citationNormalization: true,
    });

    expect(selection.status).toBe('downgraded');
    expect(selection.provider?.serviceId).toBe('openai-main');
    expect(selection.missingCapabilities).toEqual(['citationNormalization']);
    expect(selection.reason).toContain('openai-main');
  });

  it('normalizes OpenAI-compatible tool calls and citations', () => {
    const normalized = normalizeOpenAICompatibleResponse({
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          content: 'Use the graph.',
          tool_calls: [{
            id: 'call-1',
            function: { name: 'search_knowledge_graph', arguments: '{"query":"root locus"}' },
          }],
          citations: [{ id: 'c1', title: 'Root locus card', url: '/course-runtime/root-locus' }],
        },
      }],
    });

    expect(normalized).toMatchObject({
      providerKind: 'openai-compatible',
      text: 'Use the graph.',
      finishReason: 'tool_calls',
    });
    expect(normalized.toolCalls[0]).toMatchObject({
      id: 'call-1',
      name: 'search_knowledge_graph',
      input: { query: 'root locus' },
    });
    expect(normalized.citations[0]).toMatchObject({ title: 'Root locus card', confidence: 'medium' });
  });

  it('normalizes Anthropic-compatible tool_use blocks and text citations', () => {
    const normalized = normalizeAnthropicCompatibleResponse({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'text',
          text: 'Check this cited node.',
          citations: [{ id: 'c1', title: 'Time-domain card', url: '/course-runtime/time-domain' }],
        },
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'get_plan_context',
          input: { pathId: 'path-1' },
        },
        {
          type: 'tool_result',
          id: 'toolr_1',
          tool_use_id: 'toolu_1',
          content: [{ type: 'text', text: 'plan context' }],
          is_error: false,
        },
      ],
    });

    expect(normalized.providerKind).toBe('anthropic-compatible');
    expect(normalized.text).toBe('Check this cited node.');
    expect(normalized.toolCalls[0]).toMatchObject({
      id: 'toolu_1',
      name: 'get_plan_context',
      input: { pathId: 'path-1' },
    });
    expect(normalized.toolResults[0]).toMatchObject({
      id: 'toolr_1',
      toolCallId: 'toolu_1',
      output: [{ type: 'text', text: 'plan context' }],
      isError: false,
    });
    expect(normalized.citations[0]).toMatchObject({ providerKind: 'anthropic-compatible' });
  });

  it('normalizes streaming deltas without leaking provider-specific shapes', () => {
    expect(normalizeProviderStreamEvent('anthropic-compatible', {
      type: 'content_block_delta',
      delta: { text: 'hello' },
    })).toEqual({ type: 'text_delta', textDelta: 'hello' });

    expect(normalizeProviderStreamEvent('openai-compatible', {
      choices: [{ delta: { content: 'world' } }],
    })).toEqual({ type: 'text_delta', textDelta: 'world' });

    expect(normalizeProviderStreamEvent('anthropic-compatible', {
      type: 'content_block_start',
      content_block: {
        type: 'tool_use',
        id: 'toolu_1',
        name: 'search_citations',
        input: { query: 'root locus' },
      },
    })).toEqual({
      type: 'tool_call',
      toolCall: {
        id: 'toolu_1',
        providerCallId: 'toolu_1',
        name: 'search_citations',
        input: { query: 'root locus' },
      },
    });
  });

  it('normalizes recognized DSML and withholds malformed structured syntax', () => {
    expect(normalizeProviderStructuredText([
      '可见说明。',
      '<tool_call>{"name":"get_plan_context","arguments":{"pathId":"path-1"}}</tool_call>',
    ].join('\n'))).toEqual({
      text: '可见说明。',
      toolCalls: [{
        id: 'dsml-1',
        name: 'get_plan_context',
        input: { pathId: 'path-1' },
      }],
      withheldMalformedSyntax: false,
    });

    expect(normalizeProviderStructuredText(
      '安全前缀。<tool_call>{"name":"get_plan_context","arguments":',
    )).toEqual({
      text: '安全前缀。',
      toolCalls: [],
      withheldMalformedSyntax: true,
    });
  });

  it('deduplicates a native tool call repeated as recognized DSML', () => {
    const normalized = normalizeOpenAICompatibleResponse({
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          content: '<tool_call>{"name":"get_plan_context","arguments":{"pathId":"path-1"}}</tool_call>',
          tool_calls: [{
            id: 'native-1',
            function: {
              name: 'get_plan_context',
              arguments: '{"pathId":"path-1"}',
            },
          }],
        },
      }],
    });

    expect(normalized.text).toBe('');
    expect(normalized.toolCalls).toHaveLength(1);
    expect(normalized.toolCalls[0]?.id).toBe('native-1');
  });

  it('redacts provider secrets and raw authorization errors', () => {
    expect(redactProviderError(new Error('Bearer sk-secret-token failed api_key=abc123'))).toBe(
      'Bearer *** failed api_key=***',
    );
  });
});
