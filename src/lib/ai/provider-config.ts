export type AIProviderId = string;
export type AIProviderKind = 'openai-compatible' | 'anthropic-compatible';
export type AIProviderAuthMode = 'bearer-api-key' | 'none';
export type AIProviderHealthState = 'unknown' | 'healthy' | 'degraded' | 'unavailable';

export interface AIProviderCapabilities {
  tools: boolean;
  reasoning: boolean;
  vision: boolean;
  jsonSchema: boolean;
  streaming: boolean;
  citationNormalization: boolean;
}

export interface AIModelRuntimeOptions {
  enableThinking?: boolean;
}

export interface AIProviderConfig {
  provider: AIProviderId;
  providerKind: AIProviderKind;
  baseURL: string;
  apiKey: string;
  authMode: AIProviderAuthMode;
  secretRef: string;
  model: string;
  enabled: boolean;
  priority: number;
  health: AIProviderHealthState;
  capabilities: AIProviderCapabilities;
  modelOptions?: AIModelRuntimeOptions;
}

export const SILICONFLOW_PROVIDER_ID = 'siliconflow';
const DEFAULT_PROVIDER: AIProviderId = SILICONFLOW_PROVIDER_ID;
export const DEFAULT_SILICONFLOW_MODEL = 'Qwen/Qwen3.6-35B-A3B';
const DEFAULT_SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';
export const DEFAULT_OPENAI_COMPATIBLE_CAPABILITIES: AIProviderCapabilities = {
  tools: true,
  reasoning: false,
  vision: false,
  jsonSchema: true,
  streaming: true,
  citationNormalization: false,
};
export const DEFAULT_ANTHROPIC_COMPATIBLE_CAPABILITIES: AIProviderCapabilities = {
  tools: true,
  reasoning: true,
  vision: true,
  jsonSchema: false,
  streaming: true,
  citationNormalization: true,
};

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

function resolveProviderId(value: string | undefined): AIProviderId {
  const provider = (value ?? DEFAULT_PROVIDER).trim().toLowerCase();
  return provider || SILICONFLOW_PROVIDER_ID;
}

function resolveProviderKind(value: string | undefined): AIProviderKind {
  return value === 'anthropic-compatible' || value === 'openai-compatible'
    ? value
    : 'openai-compatible';
}

export function resolveAIProviderConfig(env: NodeJS.ProcessEnv = process.env): AIProviderConfig {
  const provider = resolveProviderId(firstNonEmpty(env.AI_PROVIDER, env.LLM_PROVIDER));
  const providerKind = provider === SILICONFLOW_PROVIDER_ID
    ? 'openai-compatible'
    : resolveProviderKind(firstNonEmpty(env.AI_PROVIDER_KIND, env.LLM_PROVIDER_KIND));
  const isAnthropicCompatible = providerKind === 'anthropic-compatible';

  return {
    provider,
    providerKind,
    baseURL: firstNonEmpty(env.AI_BASE_URL, env.SILICONFLOW_API_URL) ?? DEFAULT_SILICONFLOW_BASE_URL,
    apiKey: provider === SILICONFLOW_PROVIDER_ID
      ? firstNonEmpty(env.AI_API_KEY, env.SILICONFLOW_API_KEY) ?? ''
      : firstNonEmpty(env.AI_API_KEY) ?? '',
    authMode: 'bearer-api-key',
    secretRef: provider === SILICONFLOW_PROVIDER_ID
      ? firstNonEmpty(env.AI_SECRET_REF, env.SILICONFLOW_SECRET_REF) ?? 'env:SILICONFLOW_API_KEY'
      : firstNonEmpty(env.AI_SECRET_REF) ?? 'env:AI_API_KEY',
    model: firstNonEmpty(env.AI_MODEL, env.SILICONFLOW_MODEL) ?? DEFAULT_SILICONFLOW_MODEL,
    enabled: firstNonEmpty(env.AI_PROVIDER_ENABLED) !== 'false',
    priority: Number.isFinite(Number(firstNonEmpty(env.AI_PROVIDER_PRIORITY)))
      ? Number(firstNonEmpty(env.AI_PROVIDER_PRIORITY))
      : 100,
    health: 'unknown',
    capabilities: isAnthropicCompatible
      ? DEFAULT_ANTHROPIC_COMPATIBLE_CAPABILITIES
      : DEFAULT_OPENAI_COMPATIBLE_CAPABILITIES,
  };
}
