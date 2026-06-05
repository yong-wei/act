import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { selectModelProvider, type ModelProviderCapabilityRequirements } from './model-provider-compatibility';
import {
  DEFAULT_ANTHROPIC_COMPATIBLE_CAPABILITIES,
  DEFAULT_OPENAI_COMPATIBLE_CAPABILITIES,
  DEFAULT_SILICONFLOW_MODEL,
  SILICONFLOW_PROVIDER_ID,
  resolveAIProviderConfig,
  type AIProviderAuthMode,
  type AIProviderCapabilities,
  type AIModelRuntimeOptions,
  type AIProviderConfig,
  type AIProviderHealthState,
  type AIProviderKind,
} from './provider-config';

export const AI_PROVIDER_SETTINGS_KEY = 'ai_provider_settings';
export const AI_PROVIDER_SETTINGS_AUDIT_KEY = 'ai_provider_settings_audit';
const SECRET_REF_PATTERN = /^env:[A-Z][A-Z0-9_]*$/;

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
  providerKind: AIProviderKind;
  baseURL: string;
  authMode: AIProviderAuthMode;
  secretRef: string;
  selectedModel: string;
  models: AIProviderModelSetting[];
  enabled: boolean;
  priority: number;
  health: AIProviderHealthState;
  capabilities: AIProviderCapabilities;
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

function defaultSecretRef(id: string): string {
  return `env:${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`;
}

function cleanSecretRef(value: unknown, fallback: string): string {
  const secretRef = cleanText(value) || fallback;
  return SECRET_REF_PATTERN.test(secretRef) ? secretRef : fallback;
}

function cleanProviderKind(value: unknown, fallback: AIProviderKind): AIProviderKind {
  return value === 'anthropic-compatible' || value === 'openai-compatible' ? value : fallback;
}

function cleanAuthMode(value: unknown): AIProviderAuthMode {
  return value === 'none' ? 'none' : 'bearer-api-key';
}

function cleanHealth(value: unknown): AIProviderHealthState {
  return value === 'healthy' || value === 'degraded' || value === 'unavailable' ? value : 'unknown';
}

function capabilityDefaults(kind: AIProviderKind): AIProviderCapabilities {
  return kind === 'anthropic-compatible'
    ? DEFAULT_ANTHROPIC_COMPATIBLE_CAPABILITIES
    : DEFAULT_OPENAI_COMPATIBLE_CAPABILITIES;
}

function normalizeCapabilities(
  value: unknown,
  kind: AIProviderKind,
  fallback?: AIProviderCapabilities,
): AIProviderCapabilities {
  const defaults = fallback ?? capabilityDefaults(kind);
  const raw = value && typeof value === 'object' ? value as Partial<AIProviderCapabilities> : {};
  return {
    tools: typeof raw.tools === 'boolean' ? raw.tools : defaults.tools,
    reasoning: typeof raw.reasoning === 'boolean' ? raw.reasoning : defaults.reasoning,
    vision: typeof raw.vision === 'boolean' ? raw.vision : defaults.vision,
    jsonSchema: typeof raw.jsonSchema === 'boolean' ? raw.jsonSchema : defaults.jsonSchema,
    streaming: typeof raw.streaming === 'boolean' ? raw.streaming : defaults.streaming,
    citationNormalization: typeof raw.citationNormalization === 'boolean'
      ? raw.citationNormalization
      : defaults.citationNormalization,
  };
}

export function validateAIProviderSettings(settings: AIProviderSettings): string[] {
  const errors: string[] = [];
  for (const provider of settings.providers) {
    if (!provider.id) errors.push('Provider id is required.');
    if (provider.providerKind !== 'openai-compatible' && provider.providerKind !== 'anthropic-compatible') {
      errors.push(`Provider ${provider.id} has unsupported providerKind.`);
    }
    if (!provider.baseURL || !isValidHttpUrl(provider.baseURL)) {
      errors.push(`Provider ${provider.id} must use a valid http(s) baseURL.`);
    }
    if (!SECRET_REF_PATTERN.test(provider.secretRef)) {
      errors.push(`Provider ${provider.id} secretRef must use env:VARIABLE_NAME.`);
    }
    if (!Number.isFinite(provider.priority)) {
      errors.push(`Provider ${provider.id} priority must be numeric.`);
    }
    if (provider.health !== 'unknown' && provider.health !== 'healthy' && provider.health !== 'degraded' && provider.health !== 'unavailable') {
      errors.push(`Provider ${provider.id} has invalid health state.`);
    }
    for (const capability of providerCapabilityNames()) {
      if (typeof provider.capabilities[capability] !== 'boolean') {
        errors.push(`Provider ${provider.id} capabilities.${capability} must be boolean.`);
      }
    }
  }
  return errors;
}

export function validateAIProviderSettingsInput(value: unknown): string[] {
  const errors: string[] = [];
  const raw = value && typeof value === 'object' ? value as Partial<AIProviderSettings> : {};
  if (!Array.isArray(raw.providers)) {
    errors.push('providers must be an array.');
    return errors;
  }

  raw.providers.forEach((provider, index) => {
    const item = provider && typeof provider === 'object'
      ? provider as Partial<AIProviderSetting>
      : null;
    const label = cleanText(item?.id) || `provider-${index + 1}`;
    if (!item) {
      errors.push(`Provider ${label} must be an object.`);
      return;
    }
    if (item.providerKind !== undefined && item.providerKind !== 'openai-compatible' && item.providerKind !== 'anthropic-compatible') {
      errors.push(`Provider ${label} has unsupported providerKind.`);
    }
    if (item.baseURL !== undefined && !isValidHttpUrl(cleanText(item.baseURL))) {
      errors.push(`Provider ${label} must use a valid http(s) baseURL.`);
    }
    if (item.secretRef !== undefined && !SECRET_REF_PATTERN.test(cleanText(item.secretRef))) {
      errors.push(`Provider ${label} secretRef must use env:VARIABLE_NAME.`);
    }
    if (item.priority !== undefined && !Number.isFinite(Number(item.priority))) {
      errors.push(`Provider ${label} priority must be numeric.`);
    }
    if (item.health !== undefined && item.health !== 'unknown' && item.health !== 'healthy' && item.health !== 'degraded' && item.health !== 'unavailable') {
      errors.push(`Provider ${label} has invalid health state.`);
    }
    if (item.capabilities !== undefined) {
      const capabilities = item.capabilities && typeof item.capabilities === 'object'
        ? item.capabilities as Partial<Record<keyof AIProviderCapabilities, unknown>>
        : null;
      if (!capabilities) {
        errors.push(`Provider ${label} capabilities must be an object.`);
      } else {
        for (const capability of providerCapabilityNames()) {
          if (typeof capabilities[capability] !== 'boolean') {
            errors.push(`Provider ${label} capabilities.${capability} must be boolean.`);
          }
        }
      }
    }
  });

  return errors;
}

export function resolveProviderSecret(secretRef: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!SECRET_REF_PATTERN.test(secretRef)) return '';
  const envName = secretRef.slice('env:'.length);
  return cleanText(env[envName]);
}

export class AIProviderCapabilityUnavailableError extends Error {
  status = 503;

  constructor(message: string) {
    super(message);
    this.name = 'AIProviderCapabilityUnavailableError';
  }
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
  const models = envConfig.provider === SILICONFLOW_PROVIDER_ID
    ? mergeBuiltinModels([])
    : [];
  if (!models.some((model) => model.model === envConfig.model)) {
    models.unshift({
      id: 'env-selected-model',
      label: envConfig.model,
      model: envConfig.model,
      description: '来自环境变量的当前模型。',
    });
  }

  return {
    activeProvider: envConfig.provider,
    providers: [
      {
        id: envConfig.provider,
        name: envConfig.provider === SILICONFLOW_PROVIDER_ID ? 'SiliconFlow' : envConfig.provider,
        providerKind: envConfig.providerKind,
        baseURL: envConfig.baseURL,
        authMode: 'bearer-api-key',
        secretRef: envConfig.secretRef,
        selectedModel: envConfig.model || DEFAULT_SILICONFLOW_MODEL,
        models,
        enabled: envConfig.enabled,
        priority: envConfig.priority,
        health: envConfig.health,
        capabilities: envConfig.provider === SILICONFLOW_PROVIDER_ID
          ? {
              ...DEFAULT_OPENAI_COMPATIBLE_CAPABILITIES,
              citationNormalization: true,
            }
          : envConfig.capabilities,
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
        const providerKind = cleanProviderKind(item.providerKind, fallbackProvider?.providerKind ?? 'openai-compatible');
        const capabilities = normalizeCapabilities(item.capabilities, providerKind, fallbackProvider?.capabilities);
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
          providerKind,
          baseURL: cleanText(item.baseURL) || fallbackProvider?.baseURL || '',
          authMode: cleanAuthMode(item.authMode ?? fallbackProvider?.authMode),
          secretRef: cleanSecretRef(item.secretRef, fallbackProvider?.secretRef || defaultSecretRef(id)),
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
          enabled: typeof item.enabled === 'boolean' ? item.enabled : fallbackProvider?.enabled ?? true,
          priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : fallbackProvider?.priority ?? 100,
          health: cleanHealth(item.health ?? fallbackProvider?.health),
          capabilities,
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

export function redactAIProviderSettings(settings: AIProviderSettings): AIProviderSettings {
  return {
    activeProvider: settings.activeProvider,
    providers: settings.providers.map((provider) => ({
      ...provider,
      secretRef: provider.secretRef,
    })),
  };
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
  await prisma.platformSetting.upsert({
    where: { key: AI_PROVIDER_SETTINGS_AUDIT_KEY },
    create: {
      key: AI_PROVIDER_SETTINGS_AUDIT_KEY,
      value: {
        updatedAt: new Date().toISOString(),
        providerIds: normalized.providers.map((provider) => provider.id),
        activeProvider: normalized.activeProvider,
        secretRefSchemes: normalized.providers.map((provider) => ({
          providerId: provider.id,
          scheme: provider.secretRef.split(':')[0] ?? 'unknown',
          configured: Boolean(provider.secretRef),
        })),
      } as Prisma.InputJsonValue,
    },
    update: {
      value: {
        updatedAt: new Date().toISOString(),
        providerIds: normalized.providers.map((provider) => provider.id),
        activeProvider: normalized.activeProvider,
        secretRefSchemes: normalized.providers.map((provider) => ({
          providerId: provider.id,
          scheme: provider.secretRef.split(':')[0] ?? 'unknown',
          configured: Boolean(provider.secretRef),
        })),
      } as Prisma.InputJsonValue,
    },
  });
  return normalized;
}

export async function resolveConfiguredAIProviderConfig(
  providerId?: string,
  modelId?: string,
  requirements?: ModelProviderCapabilityRequirements,
  settingsOverride?: AIProviderSettings,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AIProviderConfig> {
  const envConfig = resolveAIProviderConfig(env);
  const settings = settingsOverride ?? await getAIProviderSettings();
  const requestedServiceId = providerId ?? requirements?.serviceId ?? (requirements ? undefined : settings.activeProvider);
  let selection = selectModelProvider(settings, { ...(requirements ?? {}), serviceId: requestedServiceId });
  if (selection.status === 'unavailable' && providerId === undefined && requestedServiceId === settings.activeProvider) {
    selection = selectModelProvider(settings, requirements ?? {});
  }
  if (selection?.status === 'unavailable') {
    throw new AIProviderCapabilityUnavailableError(selection.reason ?? 'No AI provider is available for the requested capabilities.');
  }
  if (selection.status === 'downgraded' && selection.missingCapabilities.length > 0) {
    throw new AIProviderCapabilityUnavailableError(selection.reason ?? 'AI provider cannot satisfy required capabilities.');
  }

  const activeProviderId = selection?.provider?.serviceId || providerId || settings.activeProvider;
  const provider = settings.providers.find((candidate) => candidate.id === activeProviderId);
  if (!provider) {
    throw new Error(`AI provider not found: ${activeProviderId}`);
  }

  const selectedModel = modelId || provider.selectedModel || envConfig.model;
  const apiKeyFromSecretRef = resolveProviderSecret(provider.secretRef, env);
  return {
    provider: provider.id,
    providerKind: provider.providerKind,
    baseURL: provider.baseURL || envConfig.baseURL,
    apiKey: apiKeyFromSecretRef || (provider.secretRef === envConfig.secretRef ? envConfig.apiKey : ''),
    authMode: provider.authMode,
    secretRef: provider.secretRef,
    model: selectedModel,
    enabled: provider.enabled,
    priority: provider.priority,
    health: provider.health,
    capabilities: provider.capabilities,
    modelOptions: getModelRuntimeOptions(settings, provider.id, selectedModel),
  };
}

function providerCapabilityNames(): Array<keyof AIProviderCapabilities> {
  return ['tools', 'reasoning', 'vision', 'jsonSchema', 'streaming', 'citationNormalization'];
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
