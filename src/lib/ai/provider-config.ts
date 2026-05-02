export type AIProviderId = string;

export interface AIModelRuntimeOptions {
  enableThinking?: boolean;
}

export interface AIProviderConfig {
  provider: AIProviderId;
  baseURL: string;
  apiKey: string;
  model: string;
  modelOptions?: AIModelRuntimeOptions;
}

export const SILICONFLOW_PROVIDER_ID = 'siliconflow';
const DEFAULT_PROVIDER: AIProviderId = SILICONFLOW_PROVIDER_ID;
export const DEFAULT_SILICONFLOW_MODEL = 'Qwen/Qwen3.6-35B-A3B';
const DEFAULT_SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

function resolveProviderId(value: string | undefined): AIProviderId {
  const provider = (value ?? DEFAULT_PROVIDER).trim().toLowerCase();
  if (provider === SILICONFLOW_PROVIDER_ID) {
    return SILICONFLOW_PROVIDER_ID;
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

export function resolveAIProviderConfig(env: NodeJS.ProcessEnv = process.env): AIProviderConfig {
  const provider = resolveProviderId(firstNonEmpty(env.AI_PROVIDER, env.LLM_PROVIDER));

  if (provider === SILICONFLOW_PROVIDER_ID) {
    return {
      provider,
      baseURL: firstNonEmpty(env.AI_BASE_URL, env.SILICONFLOW_API_URL) ?? DEFAULT_SILICONFLOW_BASE_URL,
      apiKey: firstNonEmpty(env.AI_API_KEY, env.SILICONFLOW_API_KEY) ?? '',
      model: firstNonEmpty(env.AI_MODEL, env.SILICONFLOW_MODEL) ?? DEFAULT_SILICONFLOW_MODEL,
    };
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}
