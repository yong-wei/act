import { createOpenAI } from '@ai-sdk/openai';
import type { AIProviderConfig } from '../provider-config';
import type { AIProviderAdapter } from './types';

export function createOpenAICompatibleAdapter(config: AIProviderConfig): AIProviderAdapter {
  const provider = createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.authMode === 'none' ? undefined : config.apiKey,
    name: config.provider,
  });

  return {
    id: config.provider,
    config,
    getModel(modelId?: string) {
      return provider.chat(modelId || config.model);
    },
  };
}
