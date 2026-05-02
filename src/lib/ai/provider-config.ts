export type AIProviderId = 'siliconflow';

export interface AIProviderConfig {
  provider: AIProviderId;
  baseURL: string;
  apiKey: string;
  model: string;
}

const DEFAULT_PROVIDER: AIProviderId = 'siliconflow';
export const DEFAULT_SILICONFLOW_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';
const DEFAULT_SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

function resolveProviderId(value: string | undefined): AIProviderId {
  const provider = (value ?? DEFAULT_PROVIDER).trim().toLowerCase();
  if (provider === 'siliconflow') {
    return 'siliconflow';
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

export function resolveAIProviderConfig(env: NodeJS.ProcessEnv = process.env): AIProviderConfig {
  const provider = resolveProviderId(firstNonEmpty(env.AI_PROVIDER, env.LLM_PROVIDER));

  if (provider === 'siliconflow') {
    return {
      provider,
      baseURL: firstNonEmpty(env.AI_BASE_URL, env.SILICONFLOW_API_URL) ?? DEFAULT_SILICONFLOW_BASE_URL,
      apiKey: firstNonEmpty(env.AI_API_KEY, env.SILICONFLOW_API_KEY) ?? '',
      model: firstNonEmpty(env.AI_MODEL, env.SILICONFLOW_MODEL) ?? DEFAULT_SILICONFLOW_MODEL,
    };
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}
