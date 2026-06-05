import { resolveAIProviderConfig } from './provider-config';
import { createSiliconFlowAdapter } from './providers/siliconflow';
import { createOpenAICompatibleAdapter } from './providers/openai-compatible';
import type { AIProviderAdapter } from './providers/types';

let activeProvider: AIProviderAdapter | null = null;

export function getActiveAIProvider(): AIProviderAdapter {
  if (activeProvider) {
    return activeProvider;
  }

  const config = resolveAIProviderConfig();
  if (config.provider === 'siliconflow') {
    activeProvider = createSiliconFlowAdapter(config);
    return activeProvider;
  }
  if (config.providerKind === 'openai-compatible') {
    activeProvider = createOpenAICompatibleAdapter(config);
    return activeProvider;
  }

  throw new Error(`AI provider ${config.provider} is ${config.providerKind} and requires a native adapter before runtime use.`);
}

export function createAIProviderFromConfig(config = resolveAIProviderConfig()): AIProviderAdapter {
  if (config.provider === 'siliconflow') {
    return createSiliconFlowAdapter(config);
  }
  if (config.providerKind === 'openai-compatible') {
    return createOpenAICompatibleAdapter(config);
  }

  throw new Error(`AI provider ${config.provider} is ${config.providerKind} and requires a native adapter before runtime use.`);
}

export function getAIProviderConfig() {
  return getActiveAIProvider().config;
}
