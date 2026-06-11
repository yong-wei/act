import {
  normalizeOpenAICompatibleResponse,
  normalizeProviderStreamEvent,
  selectModelProvider,
  type NormalizedAIResponse,
} from './model-provider-compatibility';
import type { AIProviderSettings } from './provider-settings';

export type ProviderRuntimeSmokeCapabilityCategory =
  | 'chat'
  | 'structured-grading'
  | 'citation-answer'
  | 'streaming'
  | 'unavailable-fallback';

export interface ProviderRuntimeSmokeCheck {
  id: string;
  ok: boolean;
  providerId: string | null;
  capabilityCategory: ProviderRuntimeSmokeCapabilityCategory;
  detail: string;
}

export interface ProviderRuntimeSmokeReport {
  ok: boolean;
  checks: ProviderRuntimeSmokeCheck[];
}

export const PROVIDER_RUNTIME_SMOKE_FIXTURE_SETTINGS: AIProviderSettings = {
  activeProvider: 'anthropic-metadata-only',
  providers: [
    {
      id: 'anthropic-metadata-only',
      name: 'Anthropic Metadata Only',
      providerKind: 'anthropic-compatible',
      baseURL: 'https://anthropic-compatible.test/v1',
      authMode: 'bearer-api-key',
      secretRef: 'env:ANTHROPIC_COMPATIBLE_API_KEY',
      selectedModel: 'claude-fixture',
      enabled: true,
      priority: 10,
      health: 'healthy',
      capabilities: {
        tools: true,
        reasoning: true,
        vision: false,
        jsonSchema: false,
        streaming: true,
        citationNormalization: true,
      },
      models: [{ id: 'claude-fixture', label: 'Claude Fixture', model: 'claude-fixture' }],
    },
    {
      id: 'openai-runtime',
      name: 'OpenAI Runtime',
      providerKind: 'openai-compatible',
      baseURL: 'https://openai-compatible.test/v1',
      authMode: 'bearer-api-key',
      secretRef: 'env:OPENAI_COMPATIBLE_API_KEY',
      selectedModel: 'openai-fixture',
      enabled: true,
      priority: 20,
      health: 'healthy',
      capabilities: {
        tools: true,
        reasoning: false,
        vision: false,
        jsonSchema: true,
        streaming: true,
        citationNormalization: true,
      },
      models: [{ id: 'openai-fixture', label: 'OpenAI Fixture', model: 'openai-fixture' }],
    },
  ],
};

export function buildProviderRuntimeSmokeReport(
  settings: AIProviderSettings = PROVIDER_RUNTIME_SMOKE_FIXTURE_SETTINGS,
): ProviderRuntimeSmokeReport {
  const checks: ProviderRuntimeSmokeCheck[] = [];

  const chatSelection = selectModelProvider(settings, {});
  checks.push({
    id: 'provider.chat.selection',
    ok: chatSelection.status === 'selected' && chatSelection.provider?.runtimeSupported === true,
    providerId: chatSelection.provider?.serviceId ?? null,
    capabilityCategory: 'chat',
    detail: chatSelection.status === 'selected'
      ? 'Chat selected a runtime-supported provider.'
      : chatSelection.reason ?? 'Chat provider unavailable.',
  });

  const structuredSelection = selectModelProvider(settings, { tools: true, jsonSchema: true });
  const structuredDraft = normalizeStructuredDraftGradingFixture();
  checks.push({
    id: 'provider.structured-grading.fixture',
    ok: structuredSelection.status === 'selected'
      && structuredDraft.toolCalls.some((call) => call.name === 'draft_document_grade')
      && typeof structuredDraft.toolCalls[0]?.input === 'object',
    providerId: structuredSelection.provider?.serviceId ?? null,
    capabilityCategory: 'structured-grading',
    detail: structuredSelection.status === 'selected'
      ? 'Structured grading fixture normalized a tool call with JSON arguments.'
      : structuredSelection.reason ?? 'Structured grading provider unavailable.',
  });

  const citationSelection = selectModelProvider(settings, {
    tools: true,
    streaming: true,
    citationNormalization: true,
  });
  const citedAnswer = normalizeOpenAICompatibleResponse({
    choices: [{
      finish_reason: 'stop',
      message: {
        content: 'Root locus guidance with a governed citation.',
        citations: [{ id: 'citation-root-locus', title: 'Root locus card', url: '/course-runtime/root-locus' }],
      },
    }],
  });
  checks.push({
    id: 'provider.citation-answer.fixture',
    ok: citationSelection.status === 'selected'
      && citedAnswer.citations.length > 0
      && citedAnswer.citations.every((citation) => citation.url !== null),
    providerId: citationSelection.provider?.serviceId ?? null,
    capabilityCategory: 'citation-answer',
    detail: citationSelection.status === 'selected'
      ? 'Citation-bearing answer normalized governed citation metadata.'
      : citationSelection.reason ?? 'Citation provider unavailable.',
  });

  const openAIStream = normalizeProviderStreamEvent('openai-compatible', {
    choices: [{ delta: { content: 'delta' } }],
  });
  const anthropicToolStream = normalizeProviderStreamEvent('anthropic-compatible', {
    type: 'content_block_start',
    content_block: { type: 'tool_use', id: 'toolu_1', name: 'get_citation', input: { id: 'citation-root-locus' } },
  });
  checks.push({
    id: 'provider.streaming.fixture',
    ok: openAIStream?.type === 'text_delta'
      && openAIStream.textDelta === 'delta'
      && anthropicToolStream?.type === 'tool_call'
      && anthropicToolStream.toolCall?.name === 'get_citation',
    providerId: citationSelection.provider?.serviceId ?? null,
    capabilityCategory: 'streaming',
    detail: 'OpenAI text delta and Anthropic tool-use stream fixtures normalized.',
  });

  const anthropicOnly = {
    ...settings,
    providers: settings.providers.filter((provider) => provider.providerKind === 'anthropic-compatible'),
  };
  const fallbackSelection = selectModelProvider(anthropicOnly, {
    tools: true,
    streaming: true,
    citationNormalization: true,
  });
  checks.push({
    id: 'provider.unavailable-fallback.runtime-adapter',
    ok: fallbackSelection.status === 'unavailable'
      && fallbackSelection.provider === null
      && fallbackSelection.reason?.includes('runtime adapter') === true,
    providerId: fallbackSelection.provider?.serviceId ?? null,
    capabilityCategory: 'unavailable-fallback',
    detail: fallbackSelection.reason ?? 'Unavailable fallback did not explain runtime adapter support.',
  });

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

function normalizeStructuredDraftGradingFixture(): NormalizedAIResponse {
  return normalizeOpenAICompatibleResponse({
    choices: [{
      finish_reason: 'tool_calls',
      message: {
        content: null,
        tool_calls: [{
          id: 'call-draft-grade',
          function: {
            name: 'draft_document_grade',
            arguments: JSON.stringify({
              assignmentId: 'assignment-1',
              criterionId: 'root-locus',
              score: 0.82,
              evidenceRefs: ['citation-root-locus'],
            }),
          },
        }],
      },
    }],
  });
}
