import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_SILICONFLOW_MODEL,
  SILICONFLOW_PROVIDER_ID,
  resolveAIProviderConfig,
  type AIModelRuntimeOptions,
  type AIProviderConfig,
} from './provider-config';

export const AI_PROVIDER_SETTINGS_KEY = 'ai_provider_settings';

export interface AIProviderModelSetting {
  id: string;
  label: string;
  model: string;
  description?: string;
  options?: AIModelRuntimeOptions;
}

export interface AIProviderSetting {
  id: string;
  name: string;
  baseURL: string;
  selectedModel: string;
  models: AIProviderModelSetting[];
}

export interface AIProviderSettings {
  activeProvider: string;
  providers: AIProviderSetting[];
}

export const AI_MODEL_TEST_PROMPT = [
  '你是 AI-OBE 平台的智能学习助手「控灵」。',
  '当前学生正在邮轮航向控制仿真中观察二阶响应曲线。',
  '请用 120 到 180 字解释超调量、阻尼比和调节时间之间的关系，并给出一条具体调参建议。',
].join('\n');

const BUILTIN_SILICONFLOW_MODELS: AIProviderModelSetting[] = [
  {
    id: 'qwen-3-6-35b-a3b',
    label: 'Qwen3.6 35B A3B',
    model: 'Qwen/Qwen3.6-35B-A3B',
    description: '当前主力语言模型，默认关闭推理输出以提升课堂问答可用性。',
    options: { enableThinking: false },
  },
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    model: 'deepseek-ai/DeepSeek-V4-Flash',
    description: '保留为可选模型，当前响应速度可能较慢。',
  },
  {
    id: 'minimax-m2-5',
    label: 'MiniMax M2.5',
    model: 'MiniMaxAI/MiniMax-M2.5',
    description: 'SiliconFlow 可选语言模型。',
  },
];

function cleanId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeModel(model: unknown, fallbackIndex: number): AIProviderModelSetting | null {
  if (!model || typeof model !== 'object') {
    return null;
  }

  const raw = model as Partial<AIProviderModelSetting>;
  const modelId = cleanText(raw.model);
  if (!modelId) {
    return null;
  }

  const id = cleanId(raw.id) || `model-${fallbackIndex + 1}`;
  return {
    id,
    label: cleanText(raw.label) || modelId,
    model: modelId,
    description: cleanText(raw.description) || undefined,
    options: raw.options && typeof raw.options === 'object'
      ? { enableThinking: raw.options.enableThinking === false ? false : raw.options.enableThinking === true ? true : undefined }
      : undefined,
  };
}

function mergeBuiltinModels(models: AIProviderModelSetting[]): AIProviderModelSetting[] {
  const byModel = new Map<string, AIProviderModelSetting>();
  for (const model of [...BUILTIN_SILICONFLOW_MODELS, ...models]) {
    byModel.set(model.model, model);
  }
  return Array.from(byModel.values());
}

export function getDefaultAIProviderSettings(env: NodeJS.ProcessEnv = process.env): AIProviderSettings {
  const envConfig = resolveAIProviderConfig(env);
  const models = mergeBuiltinModels([]);
  if (!models.some((model) => model.model === envConfig.model)) {
    models.unshift({
      id: 'env-selected-model',
      label: envConfig.model,
      model: envConfig.model,
      description: '来自环境变量的当前模型。',
    });
  }

  return {
    activeProvider: SILICONFLOW_PROVIDER_ID,
    providers: [
      {
        id: SILICONFLOW_PROVIDER_ID,
        name: 'SiliconFlow',
        baseURL: envConfig.baseURL,
        selectedModel: envConfig.model || DEFAULT_SILICONFLOW_MODEL,
        models,
      },
    ],
  };
}

export function normalizeAIProviderSettings(
  value: unknown,
  fallback: AIProviderSettings = getDefaultAIProviderSettings()
): AIProviderSettings {
  const raw = value && typeof value === 'object' ? value as Partial<AIProviderSettings> : {};
  const providers = Array.isArray(raw.providers)
    ? raw.providers
      .map((provider, index): AIProviderSetting | null => {
        if (!provider || typeof provider !== 'object') {
          return null;
        }
        const item = provider as Partial<AIProviderSetting>;
        const id = cleanId(item.id) || `provider-${index + 1}`;
        const fallbackProvider = fallback.providers.find((candidate) => candidate.id === id);
        const models = (Array.isArray(item.models) ? item.models : [])
          .map((model, modelIndex) => normalizeModel(model, modelIndex))
          .filter((model): model is AIProviderModelSetting => model !== null);
        const mergedModels = id === SILICONFLOW_PROVIDER_ID ? mergeBuiltinModels(models) : models;
        const selectedModel = cleanText(item.selectedModel)
          || fallbackProvider?.selectedModel
          || mergedModels[0]?.model
          || '';

        return {
          id,
          name: cleanText(item.name) || fallbackProvider?.name || id,
          baseURL: cleanText(item.baseURL) || fallbackProvider?.baseURL || '',
          selectedModel,
          models: mergedModels.some((model) => model.model === selectedModel) || !selectedModel
            ? mergedModels
            : [
                ...mergedModels,
                {
                  id: 'selected-model',
                  label: selectedModel,
                  model: selectedModel,
                  description: '当前选择的模型。',
                },
              ],
        };
      })
      .filter((provider): provider is AIProviderSetting => provider !== null)
    : [];

  const normalizedProviders = providers.length > 0 ? providers : fallback.providers;
  const activeProvider = cleanId(raw.activeProvider)
    || fallback.activeProvider
    || normalizedProviders[0]?.id
    || SILICONFLOW_PROVIDER_ID;

  return {
    activeProvider: normalizedProviders.some((provider) => provider.id === activeProvider)
      ? activeProvider
      : normalizedProviders[0]?.id ?? SILICONFLOW_PROVIDER_ID,
    providers: normalizedProviders,
  };
}

export function getModelRuntimeOptions(settings: AIProviderSettings, providerId: string, modelId: string): AIModelRuntimeOptions | undefined {
  return settings.providers
    .find((provider) => provider.id === providerId)
    ?.models.find((model) => model.model === modelId)
    ?.options;
}

export async function getAIProviderSettings(): Promise<AIProviderSettings> {
  const fallback = getDefaultAIProviderSettings();
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: AI_PROVIDER_SETTINGS_KEY },
      select: { value: true },
    });
    return normalizeAIProviderSettings(setting?.value, fallback);
  } catch (error) {
    console.warn('[ai-provider-settings] 读取 AI 供应商设置失败，已回退环境变量。', error);
    return fallback;
  }
}

export async function setAIProviderSettings(settings: AIProviderSettings): Promise<AIProviderSettings> {
  const normalized = normalizeAIProviderSettings(settings);
  const value = normalized as unknown as Prisma.InputJsonValue;
  await prisma.platformSetting.upsert({
    where: { key: AI_PROVIDER_SETTINGS_KEY },
    create: { key: AI_PROVIDER_SETTINGS_KEY, value },
    update: { value },
  });
  return normalized;
}

export async function resolveConfiguredAIProviderConfig(providerId?: string, modelId?: string): Promise<AIProviderConfig> {
  const envConfig = resolveAIProviderConfig();
  const settings = await getAIProviderSettings();
  const activeProviderId = providerId || settings.activeProvider;
  const provider = settings.providers.find((candidate) => candidate.id === activeProviderId);
  if (!provider) {
    throw new Error(`AI provider not found: ${activeProviderId}`);
  }
  if (provider.id !== SILICONFLOW_PROVIDER_ID) {
    throw new Error(`Unsupported AI provider: ${provider.id}`);
  }

  const selectedModel = modelId || provider.selectedModel || envConfig.model;
  return {
    provider: SILICONFLOW_PROVIDER_ID,
    baseURL: provider.baseURL || envConfig.baseURL,
    apiKey: envConfig.apiKey,
    model: selectedModel,
    modelOptions: getModelRuntimeOptions(settings, provider.id, selectedModel),
  };
}
