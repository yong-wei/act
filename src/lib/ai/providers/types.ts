import { createOpenAI } from '@ai-sdk/openai';
import type { AIProviderConfig, AIProviderId } from '../provider-config';

export type OpenAICompatibleProvider = ReturnType<typeof createOpenAI>;
export type AIModel = ReturnType<OpenAICompatibleProvider>;

export interface AIProviderAdapter {
  id: AIProviderId;
  config: AIProviderConfig;
  getModel(modelId?: string): AIModel;
}
