import { resolveAIProviderConfig } from './provider-config';
import { createSiliconFlowAdapter } from './providers/siliconflow';
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

  throw new Error(`Unsupported AI provider: ${config.provider}`);
}

export function createAIProviderFromConfig(config = resolveAIProviderConfig()): AIProviderAdapter {
  if (config.provider === 'siliconflow') {
    return createSiliconFlowAdapter(config);
  }

  throw new Error(`Unsupported AI provider: ${config.provider}`);
}

export function getAIProviderConfig() {
  return getActiveAIProvider().config;
}
