/**
 * Provider runtime 唯一入口：模型解析、能力门控与运行时绑定。
 * 配置真源为 PlatformSetting（provider-settings）；adapter 选择在 provider-registry。
 */

import { createAIProviderFromConfig, getActiveAIProvider } from '@/lib/ai/provider-registry';
import { resolveAIProviderConfig } from '@/lib/ai/provider-config';
import {
  AIProviderCapabilityUnavailableError,
  resolveConfiguredAIProviderConfig,
} from '@/lib/ai/provider-settings';
import type { ModelProviderCapabilityRequirements } from '@/lib/ai/model-provider-compatibility';
import { resolveKonlingE2EChatModel } from '@/lib/ai/konling-e2e-chat-model';

// 默认模型
export const DEFAULT_MODEL = resolveAIProviderConfig().model;

// 获取 AI 模型实例
export function getAIModel(modelId?: string) {
  return getActiveAIProvider().getModel(modelId || DEFAULT_MODEL);
}

export function isAIServiceConfigured(): boolean {
  return resolveAIProviderConfig().apiKey.trim().length > 0;
}

export async function getConfiguredAIModel(modelId?: string, requirements?: ModelProviderCapabilityRequirements) {
  const fixture = resolveKonlingE2EChatModel();
  if (fixture && requirements?.tools && requirements.streaming) return fixture;
  const config = await resolveConfiguredAIProviderConfig(undefined, modelId, requirements);
  return createAIProviderFromConfig(config).getModel(modelId || config.model);
}

export async function getConfiguredAIProviderBinding(modelId?: string) {
  const config = await resolveConfiguredAIProviderConfig(undefined, modelId);
  return { provider: config.provider, model: modelId || config.model, endpoint: config.baseURL, credentialRef: config.secretRef };
}

export async function getConfiguredAIProviderRuntime(providerId: string, modelId: string) {
  const config = await resolveConfiguredAIProviderConfig(providerId, modelId);
  return {
    binding: { provider: config.provider, model: modelId || config.model, endpoint: config.baseURL, credentialRef: config.secretRef },
    configured: config.authMode === 'none' || config.apiKey.trim().length > 0,
    model: createAIProviderFromConfig(config).getModel(modelId || config.model),
  };
}

export async function isConfiguredAIServiceAvailable(requirements?: ModelProviderCapabilityRequirements): Promise<boolean> {
  try {
    const config = await resolveConfiguredAIProviderConfig(undefined, undefined, requirements);
    if (config.authMode === 'none') {
      return true;
    }
    return config.apiKey.trim().length > 0;
  } catch (error) {
    if (error instanceof AIProviderCapabilityUnavailableError) {
      return false;
    }
    throw error;
  }
}
