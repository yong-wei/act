import type {
  AIProviderCapabilities,
  AIProviderConfig,
  AIProviderHealthState,
  AIProviderKind,
} from './provider-config';
import type { AIProviderSetting, AIProviderSettings } from './provider-settings';

export type ModelProviderSelectionStatus = 'selected' | 'downgraded' | 'unavailable';
export type NormalizedAIStreamEventType = 'message_start' | 'text_delta' | 'tool_call' | 'tool_result' | 'message_stop';

export interface ModelProviderCapabilityRequirements extends Partial<AIProviderCapabilities> {
  serviceId?: string;
}

export interface ModelProviderCompatibilityEntry {
  serviceId: string;
  providerKind: AIProviderKind;
  endpointRef: string;
  model: string;
  enabled: boolean;
  priority: number;
  health: AIProviderHealthState;
  secretRef: string;
  capabilities: AIProviderCapabilities;
  runtimeSupported: boolean;
}

export interface ModelProviderSelection {
  status: ModelProviderSelectionStatus;
  provider: ModelProviderCompatibilityEntry | null;
  missingCapabilities: Array<keyof AIProviderCapabilities>;
  downgradedCapabilities: Array<keyof AIProviderCapabilities>;
  reason: string | null;
}

export interface NormalizedAIToolCall {
  id: string;
  name: string;
  input: unknown;
  providerCallId?: string;
}

export interface NormalizedAIToolResult {
  id: string;
  toolCallId: string;
  output: unknown;
  isError: boolean;
}

export interface NormalizedAICitation {
  id: string;
  title: string;
  url: string | null;
  providerKind: AIProviderKind;
  confidence: 'none' | 'low' | 'medium' | 'high';
}

export interface NormalizedAIResponse {
  providerKind: AIProviderKind;
  text: string;
  toolCalls: NormalizedAIToolCall[];
  toolResults: NormalizedAIToolResult[];
  citations: NormalizedAICitation[];
  finishReason: string | null;
}

export interface NormalizedAIStreamEvent {
  type: NormalizedAIStreamEventType;
  textDelta?: string;
  toolCall?: NormalizedAIToolCall;
  toolResult?: NormalizedAIToolResult;
}

export function providerSettingToCompatibilityEntry(provider: AIProviderSetting): ModelProviderCompatibilityEntry {
  return {
    serviceId: provider.id,
    providerKind: provider.providerKind,
    endpointRef: provider.baseURL,
    model: provider.selectedModel,
    enabled: provider.enabled,
    priority: provider.priority,
    health: provider.health,
    secretRef: provider.secretRef,
    capabilities: provider.capabilities,
    runtimeSupported: provider.providerKind === 'openai-compatible',
  };
}

export function buildModelProviderCompatibilityMatrix(settings: AIProviderSettings): ModelProviderCompatibilityEntry[] {
  return settings.providers
    .map(providerSettingToCompatibilityEntry)
    .sort((left, right) => left.priority - right.priority || left.serviceId.localeCompare(right.serviceId));
}

export function selectModelProvider(
  settings: AIProviderSettings,
  requirements: ModelProviderCapabilityRequirements,
): ModelProviderSelection {
  const matrix = buildModelProviderCompatibilityMatrix(settings);
  const candidates = matrix.filter((provider) => provider.enabled && provider.runtimeSupported && provider.health !== 'unavailable');
  const requested = requirements.serviceId
    ? candidates.filter((provider) => provider.serviceId === requirements.serviceId)
    : candidates;

  for (const provider of requested) {
    const missing = missingCapabilities(provider.capabilities, requirements);
    if (missing.length === 0) {
      return {
        status: 'selected',
        provider,
        missingCapabilities: [],
        downgradedCapabilities: [],
        reason: null,
      };
    }
  }

  const partial = requested[0] ?? null;
  const missing = partial ? missingCapabilities(partial.capabilities, requirements) : requiredCapabilityNames(requirements);
  return {
    status: partial ? 'downgraded' : 'unavailable',
    provider: partial,
    missingCapabilities: missing,
    downgradedCapabilities: missing,
    reason: partial
      ? `Provider ${partial.serviceId} lacks required capabilities: ${missing.join(', ')}.`
      : 'No enabled provider can satisfy the requested capabilities.',
  };
}

export function normalizeOpenAICompatibleResponse(raw: unknown): NormalizedAIResponse {
  const data = raw && typeof raw === 'object' ? raw as {
    choices?: Array<{
      finish_reason?: string | null;
      message?: {
        content?: string | null;
        tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
        citations?: Array<{ id?: string; title?: string; url?: string }>;
      };
    }>;
  } : {};
  const message = data.choices?.[0]?.message;
  return {
    providerKind: 'openai-compatible',
    text: message?.content ?? '',
    toolCalls: (message?.tool_calls ?? []).map((call, index) => ({
      id: call.id ?? `tool-call-${index + 1}`,
      providerCallId: call.id,
      name: call.function?.name ?? 'unknown_tool',
      input: parseJsonOrText(call.function?.arguments ?? ''),
    })),
    toolResults: [],
    citations: normalizeCitationList(message?.citations, 'openai-compatible'),
    finishReason: data.choices?.[0]?.finish_reason ?? null,
  };
}

export function normalizeAnthropicCompatibleResponse(raw: unknown): NormalizedAIResponse {
  const data = raw && typeof raw === 'object' ? raw as {
    stop_reason?: string | null;
    content?: Array<{
      type?: string;
      text?: string;
      id?: string;
      name?: string;
      input?: unknown;
      citations?: Array<{ id?: string; title?: string; url?: string }>;
    }>;
  } : {};
  const content = data.content ?? [];
  return {
    providerKind: 'anthropic-compatible',
    text: content.filter((part) => part.type === 'text').map((part) => part.text ?? '').join(''),
    toolCalls: content
      .filter((part) => part.type === 'tool_use')
      .map((part, index) => ({
        id: part.id ?? `tool-use-${index + 1}`,
        providerCallId: part.id,
        name: part.name ?? 'unknown_tool',
        input: part.input ?? {},
      })),
    toolResults: [],
    citations: content.flatMap((part) => normalizeCitationList(part.citations, 'anthropic-compatible')),
    finishReason: data.stop_reason ?? null,
  };
}

export function normalizeProviderResponse(kind: AIProviderKind, raw: unknown): NormalizedAIResponse {
  return kind === 'anthropic-compatible'
    ? normalizeAnthropicCompatibleResponse(raw)
    : normalizeOpenAICompatibleResponse(raw);
}

export function normalizeProviderStreamEvent(kind: AIProviderKind, raw: unknown): NormalizedAIStreamEvent | null {
  const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  if (kind === 'anthropic-compatible') {
    if (data.type === 'content_block_delta') {
      const delta = data.delta && typeof data.delta === 'object' ? data.delta as { text?: string } : {};
      return { type: 'text_delta', textDelta: delta.text ?? '' };
    }
    if (data.type === 'message_start') return { type: 'message_start' };
    if (data.type === 'message_stop') return { type: 'message_stop' };
    return null;
  }

  const choices = Array.isArray(data.choices) ? data.choices as Array<{ delta?: { content?: string; tool_calls?: unknown[] }; finish_reason?: string | null }> : [];
  const choice = choices[0];
  if (choice?.delta?.tool_calls?.[0]) {
    return { type: 'tool_call', toolCall: normalizeOpenAICompatibleResponse({ choices: [{ message: { tool_calls: choice.delta.tool_calls } }] }).toolCalls[0] };
  }
  if (typeof choice?.delta?.content === 'string') return { type: 'text_delta', textDelta: choice.delta.content };
  if (choice?.finish_reason) return { type: 'message_stop' };
  return null;
}

export function redactProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+\S+/g, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
    .replace(/api[_-]?key[=:]\s*[^,\s]+/gi, 'api_key=***')
    .slice(0, 500);
}

export function runtimeRequiresCitationGuard(config: AIProviderConfig): ModelProviderCapabilityRequirements {
  return {
    serviceId: config.provider,
    tools: true,
    streaming: true,
    citationNormalization: true,
  };
}

function missingCapabilities(
  capabilities: AIProviderCapabilities,
  requirements: ModelProviderCapabilityRequirements,
): Array<keyof AIProviderCapabilities> {
  return requiredCapabilityNames(requirements).filter((capability) => capabilities[capability] !== true);
}

function requiredCapabilityNames(requirements: ModelProviderCapabilityRequirements): Array<keyof AIProviderCapabilities> {
  return (['tools', 'reasoning', 'vision', 'jsonSchema', 'streaming', 'citationNormalization'] as Array<keyof AIProviderCapabilities>)
    .filter((capability) => requirements[capability] === true);
}

function parseJsonOrText(value: string): unknown {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeCitationList(
  citations: Array<{ id?: string; title?: string; url?: string }> | undefined,
  providerKind: AIProviderKind,
): NormalizedAICitation[] {
  return (citations ?? []).map((citation, index) => ({
    id: citation.id ?? `citation-${index + 1}`,
    title: citation.title ?? citation.url ?? 'Untitled citation',
    url: citation.url ?? null,
    providerKind,
    confidence: citation.url ? 'medium' : 'low',
  }));
}
