'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Server,
  Bell,
  Shield,
  Save,
  RefreshCcw,
  Plus,
  Trash2,
  Gauge,
  Pencil,
  Check,
  X,
} from 'lucide-react';

import { ActionStatusPanel } from '@/components/platform/action-status';
import {
  buildAdminOperationId,
  buildAdminOperationIdempotencyKey,
  type AdminOperationLedgerEntry,
} from '@/lib/admin-operation-ledger';
import { createAuditedActionState } from '@/lib/action-status-contract';
import { AdminConsoleHeader } from './admin-console-header';
import type { AdminConsoleUser } from './admin-console-config';

interface AIProviderModelSetting {
  id: string;
  label: string;
  model: string;
  description?: string;
}

type AIProviderKind = 'openai-compatible' | 'anthropic-compatible';
type AIProviderHealthState = 'unknown' | 'healthy' | 'degraded' | 'unavailable';

interface AIProviderCapabilities {
  tools: boolean;
  reasoning: boolean;
  vision: boolean;
  jsonSchema: boolean;
  streaming: boolean;
  citationNormalization: boolean;
}

interface AIProviderSetting {
  id: string;
  name: string;
  providerKind: AIProviderKind;
  baseURL: string;
  authMode: 'bearer-api-key' | 'none';
  secretRef: string;
  selectedModel: string;
  models: AIProviderModelSetting[];
  enabled: boolean;
  priority: number;
  health: AIProviderHealthState;
  capabilities: AIProviderCapabilities;
}

interface AIProviderSettings {
  activeProvider: string;
  providers: AIProviderSetting[];
}

type AIProviderSettingsResponse = AIProviderSettings & {
  operationLedger?: AdminOperationLedgerEntry;
};

type PlatformSettingsResponse = {
  homeDynamicModelEnabled?: boolean;
  dataCenterShowDemoSourceLabels?: boolean;
  operationLedger?: AdminOperationLedgerEntry;
};

type AdminConfigSaveErrorResponse = {
  error?: string;
  issues?: string[];
  operationLedger?: AdminOperationLedgerEntry;
};

interface SystemConfig {
  siteName: string;
  maintenanceMode: boolean;
  maxStudentsPerClass: number;
  defaultPassword: string;
  aiProvider: string;
  aiModelEndpoint: string;
  aiModelName: string;
  enableNotifications: boolean;
  ethicsAlertThreshold: number;
  homeDynamicModelEnabled: boolean;
  dataCenterShowDemoSourceLabels: boolean;
}

interface ModelTestResult {
  status: 'running' | 'success' | 'error';
  operationId?: string;
  idempotencyKey?: string;
  auditSummary?: string;
  elapsedMs?: number;
  chars?: number;
  text?: string;
  error?: string;
}

type ConfigModelTestQuery = {
  provider?: string | null;
  model?: string | null;
  action?: string | null;
};

const DEFAULT_AI_SETTINGS: AIProviderSettings = {
  activeProvider: 'siliconflow',
  providers: [
    {
      id: 'siliconflow',
      name: 'SiliconFlow',
      providerKind: 'openai-compatible',
      baseURL: 'https://api.siliconflow.cn/v1',
      authMode: 'bearer-api-key',
      secretRef: 'env:SILICONFLOW_API_KEY',
      selectedModel: 'Qwen/Qwen3.6-35B-A3B',
      enabled: true,
      priority: 100,
      health: 'unknown',
      capabilities: {
        tools: true,
        reasoning: false,
        vision: false,
        jsonSchema: true,
        streaming: true,
        citationNormalization: true,
      },
      models: [
        {
          id: 'qwen-3-6-35b-a3b',
          label: 'Qwen3.6 35B A3B',
          model: 'Qwen/Qwen3.6-35B-A3B',
          description: '当前主力语言模型，默认关闭推理输出以提升课堂问答可用性。',
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
      ],
    },
  ],
};

function makeId(value: string, fallback: string): string {
  const id = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return id || fallback;
}

function defaultSecretRef(providerId: string): string {
  return `env:${providerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`;
}

type SystemConfigDashboardProps = {
  currentUser: AdminConsoleUser;
  initialTestQuery?: ConfigModelTestQuery | null;
};

type ConfigLedgerSnapshot = {
  homeDynamicModelEnabled: boolean;
  dataCenterShowDemoSourceLabels: boolean;
  activeProvider: string;
  providerCount: number;
  enabledProviderCount: number;
  selectedModel: string;
};

function buildConfigLedgerSnapshot(config: SystemConfig, aiSettings: AIProviderSettings): ConfigLedgerSnapshot {
  const activeProvider = aiSettings.providers.find((provider) => provider.id === aiSettings.activeProvider);
  return {
    homeDynamicModelEnabled: config.homeDynamicModelEnabled,
    dataCenterShowDemoSourceLabels: config.dataCenterShowDemoSourceLabels,
    activeProvider: aiSettings.activeProvider,
    providerCount: aiSettings.providers.length,
    enabledProviderCount: aiSettings.providers.filter((provider) => provider.enabled).length,
    selectedModel: activeProvider?.selectedModel ?? '',
  };
}

function summarizeConfigDiff(before: ConfigLedgerSnapshot | null, after: ConfigLedgerSnapshot) {
  if (!before) return '首次保存当前系统配置快照。';
  const changed = Object.entries(after)
    .filter(([key, value]) => before[key as keyof ConfigLedgerSnapshot] !== value)
    .map(([key]) => key);
  return changed.length > 0 ? `变更字段：${changed.join('、')}。` : '配置内容未变化，本次保存复用相同 idempotency key。';
}

function statusFromLedgerOutcome(outcome: AdminOperationLedgerEntry['outcome']) {
  if (outcome === 'pending') return 'pending';
  if (outcome === 'failed') return 'failed';
  if (outcome === 'blocked') return 'blocked';
  return 'succeeded';
}

function actionStateFromLedger(input: {
  ledger: AdminOperationLedgerEntry;
  label: string;
  category: 'save' | 'model-test';
  sourceRoute: string;
  targetId?: string;
  requestedAction: string;
  messagePrefix?: string;
  nextAction?: string;
  httpStatus?: number;
}) {
  return createAuditedActionState({
    identity: {
      id: input.ledger.operationId,
      category: input.category,
      label: input.label,
      sourceRoute: input.sourceRoute,
      targetId: input.targetId,
      requestedAction: input.requestedAction,
    },
    status: statusFromLedgerOutcome(input.ledger.outcome),
    message: `${input.messagePrefix ?? ''}${input.ledger.auditSummary}`,
    nextAction: input.nextAction,
    recoveryAction: input.ledger.recoveryState.action,
    recoveryKind: input.ledger.recoveryState.status,
    displayReference: input.ledger.idempotencyKey,
    httpStatus: input.httpStatus,
  });
}

export function SystemConfigDashboard({ currentUser, initialTestQuery }: SystemConfigDashboardProps) {
  const [config, setConfig] = useState<SystemConfig>({
    siteName: 'AI-OBE 船舶智控平台',
    maintenanceMode: false,
    maxStudentsPerClass: 100,
    defaultPassword: '123456',
    aiProvider: 'siliconflow',
    aiModelEndpoint: '',
    aiModelName: '',
    enableNotifications: true,
    ethicsAlertThreshold: 3,
    homeDynamicModelEnabled: false,
    dataCenterShowDemoSourceLabels: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [aiSettings, setAiSettings] = useState<AIProviderSettings>(DEFAULT_AI_SETTINGS);
  const [newProvider, setNewProvider] = useState<{
    id: string;
    name: string;
    providerKind: AIProviderKind;
    baseURL: string;
    secretRef: string;
  }>({ id: '', name: '', providerKind: 'openai-compatible', baseURL: '', secretRef: '' });
  const [newModel, setNewModel] = useState({ label: '', model: '', description: '' });
  const [editingModel, setEditingModel] = useState<{
    providerId: string;
    modelId: string;
    label: string;
    model: string;
    description: string;
  } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ModelTestResult>>({});
  const [configSaveStates, setConfigSaveStates] = useState<Array<ReturnType<typeof createAuditedActionState>>>([]);
  const [modelTestActionState, setModelTestActionState] = useState<ReturnType<typeof createAuditedActionState> | null>(null);
  const lastSavedConfigRef = useRef<ConfigLedgerSnapshot | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const clearNoticeTimer = useCallback(() => {
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }, []);
  const scheduleNoticeClear = useCallback(() => {
    clearNoticeTimer();
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, 3000);
  }, [clearNoticeTimer]);

  useEffect(() => {
    const controller = new AbortController();
    const loadConfig = async () => {
      try {
        const [platformResponse, aiResponse] = await Promise.all([
          fetch('/api/admin/platform-settings', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/admin/ai-settings', { cache: 'no-store', signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        if (!platformResponse.ok) {
          throw new Error('加载配置失败');
        }
        const payload = await platformResponse.json() as {
          homeDynamicModelEnabled?: boolean;
          dataCenterShowDemoSourceLabels?: boolean;
        };
        const aiPayload = aiResponse.ok ? await aiResponse.json() as AIProviderSettingsResponse : DEFAULT_AI_SETTINGS;
        if (controller.signal.aborted) return;
        const activeProvider = aiPayload.providers.find((provider) => provider.id === aiPayload.activeProvider) ?? aiPayload.providers[0];
        setConfig((prev) => ({
          ...prev,
          homeDynamicModelEnabled: payload.homeDynamicModelEnabled === true,
          dataCenterShowDemoSourceLabels: payload.dataCenterShowDemoSourceLabels === true,
          aiProvider: aiPayload.activeProvider,
          aiModelEndpoint: activeProvider?.baseURL ?? '',
          aiModelName: activeProvider?.selectedModel ?? '',
        }));
        setAiSettings(aiPayload);
        lastSavedConfigRef.current = buildConfigLedgerSnapshot({
          siteName: 'AI-OBE 船舶智控平台',
          maintenanceMode: false,
          maxStudentsPerClass: 100,
          defaultPassword: '123456',
          homeDynamicModelEnabled: payload.homeDynamicModelEnabled === true,
          dataCenterShowDemoSourceLabels: payload.dataCenterShowDemoSourceLabels === true,
          aiProvider: aiPayload.activeProvider,
          aiModelEndpoint: activeProvider?.baseURL ?? '',
          aiModelName: activeProvider?.selectedModel ?? '',
          enableNotifications: true,
          ethicsAlertThreshold: 3,
        }, aiPayload);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setNotice({ type: 'error', message: '读取平台配置失败，已使用默认值' });
        scheduleNoticeClear();
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadConfig();
    return () => {
      controller.abort();
      clearNoticeTimer();
    };
  }, [clearNoticeTimer, scheduleNoticeClear]);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    scheduleNoticeClear();
  };

  const handleSave = async () => {
    setSaving(true);
    const nextSnapshot = buildConfigLedgerSnapshot(config, aiSettings);
    const diffSummary = summarizeConfigDiff(lastSavedConfigRef.current, nextSnapshot);
    const impactScope = `运行时供应商 ${nextSnapshot.activeProvider} / 模型 ${nextSnapshot.selectedModel || '未选择'} / 启用供应商 ${nextSnapshot.enabledProviderCount}`;
    const platformIdempotencyKey = buildAdminOperationIdempotencyKey([
      'admin-config-save',
      'platform-settings',
      config.homeDynamicModelEnabled,
      config.dataCenterShowDemoSourceLabels,
      currentUser.id,
    ]);
    const aiIdempotencyKey = buildAdminOperationIdempotencyKey([
      'admin-config-save',
      'ai-settings',
      JSON.stringify(nextSnapshot),
      currentUser.id,
    ]);
    const platformOperationId = buildAdminOperationId({
      kind: 'admin-config-save',
      scope: 'admin-config-platform-settings',
      seed: platformIdempotencyKey,
    });
    const aiOperationId = buildAdminOperationId({
      kind: 'admin-config-save',
      scope: `admin-config-ai-settings:${nextSnapshot.activeProvider}`,
      seed: aiIdempotencyKey,
    });
    const invalidProviderName = aiSettings.providers.find((provider) => !provider.name.trim());
    if (invalidProviderName) {
      setConfigSaveStates([
        createAuditedActionState({
          identity: {
            id: aiOperationId,
            category: 'save',
            label: 'AI 设置保存',
            sourceRoute: '/admin/config',
            targetId: invalidProviderName.id,
            requestedAction: 'save-ai-settings',
          },
          status: 'blocked',
          message: `${diffSummary}影响范围：${impactScope}。审计输出：供应商名称不能为空，保存未提交。`,
          recoveryAction: '补全供应商名称后重新保存',
          displayReference: aiIdempotencyKey,
          httpStatus: 400,
        }),
      ]);
      showNotice('error', '供应商名称不能为空');
      setSaving(false);
      return;
    }
    setConfigSaveStates([
      createAuditedActionState({
        identity: {
          id: platformOperationId,
          category: 'save',
          label: '平台参数保存',
          sourceRoute: '/admin/config',
          requestedAction: 'save-platform-settings',
        },
        status: 'pending',
        message: `${diffSummary}影响范围：${impactScope}。`,
        nextAction: '等待平台参数保存完成',
        displayReference: platformIdempotencyKey,
      }),
      createAuditedActionState({
        identity: {
          id: aiOperationId,
          category: 'save',
          label: 'AI 设置保存',
          sourceRoute: '/admin/config',
          requestedAction: 'save-ai-settings',
        },
        status: 'pending',
        message: `${diffSummary}影响范围：${impactScope}。`,
        nextAction: '等待 AI 设置保存完成',
        displayReference: aiIdempotencyKey,
      }),
    ]);
    try {
      const [platformResponse, aiResponse] = await Promise.all([
        fetch('/api/admin/platform-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeDynamicModelEnabled: config.homeDynamicModelEnabled,
            dataCenterShowDemoSourceLabels: config.dataCenterShowDemoSourceLabels,
          }),
        }),
        fetch('/api/admin/ai-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiSettings),
        }),
      ]);
      const platformPayload = await platformResponse.json().catch(() => null) as (PlatformSettingsResponse & AdminConfigSaveErrorResponse) | null;
      const aiPayload = await aiResponse.json().catch(() => null) as (AIProviderSettingsResponse & AdminConfigSaveErrorResponse) | null;
      const platformState =
        platformResponse.ok && platformPayload?.operationLedger
          ? actionStateFromLedger({
              ledger: platformPayload.operationLedger,
              label: '平台参数保存',
              category: 'save',
              sourceRoute: '/admin/config',
              requestedAction: 'save-platform-settings',
              messagePrefix: `${diffSummary}影响范围：${impactScope}。审计输出：`,
              nextAction: '执行模型测试或返回业务页面复核效果',
            })
          : createAuditedActionState({
              identity: {
                id: platformPayload?.operationLedger?.operationId ?? platformOperationId,
                category: 'save',
                label: '平台参数保存',
                sourceRoute: '/admin/config',
                requestedAction: 'save-platform-settings',
              },
              status: platformResponse.ok ? 'succeeded' : 'failed',
              message: platformResponse.ok
                ? `${diffSummary}影响范围：${impactScope}。审计输出：平台参数保存完成。`
                : `${diffSummary}影响范围：${impactScope}。审计输出：${platformPayload?.error ?? '平台参数保存失败'}。`,
              nextAction: platformResponse.ok ? '执行模型测试或返回业务页面复核效果' : undefined,
              recoveryAction: platformResponse.ok ? '需要回退时按 diff summary 手动恢复上一组配置' : '检查平台参数接口后重试相同保存',
              displayReference: platformPayload?.operationLedger?.idempotencyKey ?? platformIdempotencyKey,
              httpStatus: platformResponse.ok ? undefined : platformResponse.status,
            });
      const aiIssues = aiPayload?.issues?.join('；');
      const aiState =
        aiResponse.ok && aiPayload?.operationLedger
          ? actionStateFromLedger({
              ledger: aiPayload.operationLedger,
              label: 'AI 设置保存',
              category: 'save',
              sourceRoute: '/admin/config',
              requestedAction: 'save-ai-settings',
              messagePrefix: `${diffSummary}影响范围：${impactScope}。审计输出：`,
              nextAction: '执行模型测试或返回业务页面复核效果',
            })
          : createAuditedActionState({
              identity: {
                id: aiPayload?.operationLedger?.operationId ?? aiOperationId,
                category: 'save',
                label: 'AI 设置保存',
                sourceRoute: '/admin/config',
                requestedAction: 'save-ai-settings',
              },
              status: aiResponse.ok ? 'succeeded' : 'failed',
              message: aiResponse.ok
                ? `${diffSummary}影响范围：${impactScope}。审计输出：AI 设置保存完成。`
                : `${diffSummary}影响范围：${impactScope}。审计输出：${aiIssues || aiPayload?.error || 'AI 设置保存失败'}。`,
              nextAction: aiResponse.ok ? '执行模型测试或返回业务页面复核效果' : undefined,
              recoveryAction: aiResponse.ok ? '需要回退时按 diff summary 手动恢复上一组配置' : '检查 AI 设置接口后重试相同保存',
              displayReference: aiPayload?.operationLedger?.idempotencyKey ?? aiIdempotencyKey,
              httpStatus: aiResponse.ok ? undefined : aiResponse.status,
            });
      setConfigSaveStates([platformState, aiState]);
      if (!platformResponse.ok || !aiResponse.ok) {
        showNotice('error', '保存失败');
        return;
      }
      if (aiPayload) {
        setAiSettings(aiPayload);
        lastSavedConfigRef.current = buildConfigLedgerSnapshot(config, aiPayload);
      }
      showNotice('success', '配置已保存');
    } catch {
      setConfigSaveStates([
        createAuditedActionState({
          identity: {
            id: platformOperationId,
            category: 'save',
            label: '平台参数保存',
            sourceRoute: '/admin/config',
            requestedAction: 'save-platform-settings',
          },
          status: 'failed',
          message: `${diffSummary}影响范围：${impactScope}。审计输出：平台参数保存请求未完成。`,
          recoveryAction: '检查网络与平台参数接口后重试相同保存',
          displayReference: platformIdempotencyKey,
          httpStatus: 500,
        }),
        createAuditedActionState({
          identity: {
            id: aiOperationId,
            category: 'save',
            label: 'AI 设置保存',
            sourceRoute: '/admin/config',
            requestedAction: 'save-ai-settings',
          },
          status: 'failed',
          message: `${diffSummary}影响范围：${impactScope}。审计输出：AI 设置保存请求未完成。`,
          recoveryAction: '检查网络与 AI 设置接口后重试相同保存',
          displayReference: aiIdempotencyKey,
          httpStatus: 500,
        }),
      ]);
      showNotice('error', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const activeProvider = aiSettings.providers.find((provider) => provider.id === aiSettings.activeProvider) ?? aiSettings.providers[0];

  const updateProvider = (providerId: string, patch: Partial<AIProviderSetting>) => {
    setAiSettings((prev) => {
      const providers = prev.providers.map((provider) => (
        provider.id === providerId ? { ...provider, ...patch } : provider
      ));
      const next = { ...prev, providers };
      const updatedProvider = providers.find((provider) => provider.id === providerId);
      if (updatedProvider && providerId === prev.activeProvider) {
        setConfig((current) => ({
          ...current,
          aiProvider: providerId,
          aiModelEndpoint: updatedProvider.baseURL,
          aiModelName: updatedProvider.selectedModel,
        }));
      }
      return next;
    });
  };

  const updateProviderCapability = (
    providerId: string,
    capability: keyof AIProviderCapabilities,
    enabled: boolean,
  ) => {
    const provider = aiSettings.providers.find((item) => item.id === providerId);
    if (!provider) return;
    updateProvider(providerId, {
      capabilities: {
        ...provider.capabilities,
        [capability]: enabled,
      },
    });
  };

  const selectProvider = (providerId: string) => {
    const provider = aiSettings.providers.find((item) => item.id === providerId);
    if (!provider) {
      showNotice('error', '供应商不存在，不能设为当前供应商');
      return;
    }
    setAiSettings((prev) => ({ ...prev, activeProvider: providerId }));
    setConfig((prev) => ({
      ...prev,
      aiProvider: providerId,
      aiModelEndpoint: provider.baseURL,
      aiModelName: provider.selectedModel,
    }));
  };

  const selectModel = (providerId: string, model: string) => {
    updateProvider(providerId, { selectedModel: model });
  };

  const addProvider = () => {
    const providerName = newProvider.name.trim();
    const baseURL = newProvider.baseURL.trim();
    if (!providerName) {
      showNotice('error', '供应商名称不能为空');
      return;
    }
    if (!baseURL) {
      showNotice('error', 'API 端点不能为空');
      return;
    }
    const id = makeId(newProvider.id || newProvider.name, `provider-${aiSettings.providers.length + 1}`);
    if (aiSettings.providers.some((provider) => provider.id === id)) {
      showNotice('error', '供应商 ID 已存在');
      return;
    }
    const provider: AIProviderSetting = {
      id,
      name: providerName,
      providerKind: newProvider.providerKind,
      baseURL,
      authMode: 'bearer-api-key',
      secretRef: newProvider.secretRef.trim() || defaultSecretRef(id),
      selectedModel: '',
      enabled: true,
      priority: 100,
      health: 'unknown',
      capabilities: newProvider.providerKind === 'anthropic-compatible'
        ? {
            tools: true,
            reasoning: true,
            vision: true,
            jsonSchema: false,
            streaming: true,
            citationNormalization: true,
          }
        : {
            tools: true,
            reasoning: false,
            vision: false,
            jsonSchema: true,
            streaming: true,
            citationNormalization: false,
          },
      models: [],
    };
    setAiSettings((prev) => ({
      activeProvider: prev.activeProvider,
      providers: [...prev.providers, provider],
    }));
    setNewProvider({ id: '', name: '', providerKind: 'openai-compatible', baseURL: '', secretRef: '' });
    showNotice('success', '供应商已加入列表，需显式选用后才会影响运行时配置');
  };

  const removeProvider = (providerId: string) => {
    if (providerId === 'siliconflow') {
      showNotice('error', '默认 SiliconFlow 供应商不能删除');
      return;
    }
    setAiSettings((prev) => {
      const providers = prev.providers.filter((provider) => provider.id !== providerId);
      const activeProviderId = prev.activeProvider === providerId ? providers[0]?.id ?? 'siliconflow' : prev.activeProvider;
      return { activeProvider: activeProviderId, providers };
    });
  };

  const addModel = () => {
    if (!activeProvider) return;
    const model = newModel.model.trim();
    if (!model) {
      showNotice('error', '模型 ID 不能为空');
      return;
    }
    if (activeProvider.models.some((item) => item.model === model)) {
      showNotice('error', '该模型已存在');
      return;
    }
    const nextModel: AIProviderModelSetting = {
      id: makeId(newModel.label || model, `model-${activeProvider.models.length + 1}`),
      label: newModel.label.trim() || model,
      model,
      description: newModel.description.trim() || undefined,
    };
    updateProvider(activeProvider.id, {
      models: [...activeProvider.models, nextModel],
      selectedModel: activeProvider.selectedModel || model,
    });
    setNewModel({ label: '', model: '', description: '' });
  };

  const startEditModel = (providerId: string, model: AIProviderModelSetting) => {
    setEditingModel({
      providerId,
      modelId: model.id,
      label: model.label,
      model: model.model,
      description: model.description ?? '',
    });
  };

  const saveEditedModel = () => {
    if (!editingModel) return;
    const provider = aiSettings.providers.find((item) => item.id === editingModel.providerId);
    if (!provider) return;
    const nextModelId = editingModel.model.trim();
    if (!nextModelId) {
      showNotice('error', '模型 ID 不能为空');
      return;
    }
    if (provider.models.some((item) => item.id !== editingModel.modelId && item.model === nextModelId)) {
      showNotice('error', '该模型已存在');
      return;
    }
    const currentModel = provider.models.find((item) => item.id === editingModel.modelId);
    const models = provider.models.map((item) => (
      item.id === editingModel.modelId
        ? {
            ...item,
            label: editingModel.label.trim() || nextModelId,
            model: nextModelId,
            description: editingModel.description.trim() || undefined,
          }
        : item
    ));
    updateProvider(provider.id, {
      models,
      selectedModel: currentModel?.model === provider.selectedModel ? nextModelId : provider.selectedModel,
    });
    setEditingModel(null);
  };

  const removeModel = (providerId: string, model: string) => {
    const provider = aiSettings.providers.find((item) => item.id === providerId);
    if (!provider) return;
    const models = provider.models.filter((item) => item.model !== model);
    updateProvider(providerId, {
      models,
      selectedModel: provider.selectedModel === model ? models[0]?.model ?? '' : provider.selectedModel,
    });
  };

  const testModel = async (providerId: string, model: string) => {
    const key = `${providerId}:${model}`;
    const idempotencyKey = buildAdminOperationIdempotencyKey([
      'admin-config-model-test',
      providerId,
      model,
      currentUser.id,
    ]);
    const operationId = buildAdminOperationId({
      kind: 'admin-config-model-test',
      scope: `admin-config-model-test:${providerId}:${model}`,
      seed: idempotencyKey,
    });
    let failedOperationLedger: AdminOperationLedgerEntry | null = null;
    setTestResults((prev) => ({
      ...prev,
      [key]: {
        status: 'running',
        operationId,
        idempotencyKey,
        auditSummary: `模型测试已排队：${providerId}/${model}`,
      },
    }));
    setModelTestActionState(createAuditedActionState({
      identity: {
        id: operationId,
        category: 'model-test',
        label: '模型测试',
        sourceRoute: '/admin/config',
        targetId: model,
        requestedAction: 'test',
      },
      status: 'pending',
      message: `模型 ${model} 测试已开始。审计输出：模型测试已排队。`,
      nextAction: '等待供应商响应',
      displayReference: idempotencyKey,
    }));
    try {
      const response = await fetch('/api/admin/ai-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, model }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as {
          error?: string;
          operationLedger?: AdminOperationLedgerEntry;
        } | null;
        if (payload?.operationLedger) {
          failedOperationLedger = payload.operationLedger;
          setModelTestActionState(actionStateFromLedger({
            ledger: payload.operationLedger,
            label: '模型测试',
            category: 'model-test',
            sourceRoute: '/admin/config',
            targetId: model,
            requestedAction: 'test',
            messagePrefix: `模型 ${model} 测试失败。审计输出：`,
            httpStatus: response.status,
          }));
        }
        throw new Error(payload?.error || '测试失败');
      }
      const payload = await response.json() as {
        operationLedger?: AdminOperationLedgerEntry;
        elapsedMs: number;
        chars: number;
        text: string;
      };
      const successOperationId = payload.operationLedger?.operationId ?? operationId;
      const successIdempotencyKey = payload.operationLedger?.idempotencyKey ?? idempotencyKey;
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          status: 'success',
          operationId: successOperationId,
          idempotencyKey: successIdempotencyKey,
          auditSummary: payload.operationLedger?.auditSummary ?? `模型测试成功：${providerId}/${model}`,
          elapsedMs: payload.elapsedMs,
          chars: payload.chars,
          text: payload.text,
        },
      }));
      setModelTestActionState(payload.operationLedger
        ? actionStateFromLedger({
            ledger: payload.operationLedger,
            label: '模型测试',
            category: 'model-test',
            sourceRoute: '/admin/config',
            targetId: model,
            requestedAction: 'test',
            messagePrefix: `模型 ${model} 测试成功，用时 ${payload.elapsedMs}ms。审计输出：`,
            nextAction: '保存供应商配置',
          })
        : createAuditedActionState({
            identity: {
              id: operationId,
              category: 'model-test',
              label: '模型测试',
              sourceRoute: '/admin/config',
              targetId: model,
              requestedAction: 'test',
            },
            status: 'succeeded',
            message: `模型 ${model} 测试成功，用时 ${payload.elapsedMs}ms。审计输出：模型测试成功。`,
            nextAction: '保存供应商配置',
            displayReference: idempotencyKey,
          }));
    } catch (error) {
      const failedOperationId = failedOperationLedger?.operationId ?? operationId;
      const failedIdempotencyKey = failedOperationLedger?.idempotencyKey ?? idempotencyKey;
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          status: 'error',
          operationId: failedOperationId,
          idempotencyKey: failedIdempotencyKey,
          auditSummary: failedOperationLedger?.auditSummary ?? `模型测试失败：${providerId}/${model}`,
          error: error instanceof Error ? error.message : '测试失败',
        },
      }));
      setModelTestActionState((current) => failedOperationLedger
        ? current
        : current?.identity.id !== operationId
        ? current
        : createAuditedActionState({
            identity: {
              id: operationId,
              category: 'model-test',
              label: '模型测试',
              sourceRoute: '/admin/config',
              targetId: model,
              requestedAction: 'test',
            },
            status: 'failed',
            message: error instanceof Error ? error.message : '测试失败',
            recoveryAction: '检查密钥、模型 ID 和供应商能力后重试',
            displayReference: idempotencyKey,
            httpStatus: 500,
          }));
    }
  };

  const handleReset = () => {
    setConfig({
      siteName: 'AI-OBE 船舶智控平台',
      maintenanceMode: false,
      maxStudentsPerClass: 100,
      defaultPassword: '123456',
      aiProvider: 'siliconflow',
      aiModelEndpoint: '',
      aiModelName: '',
      enableNotifications: true,
      ethicsAlertThreshold: 3,
      homeDynamicModelEnabled: false,
      dataCenterShowDemoSourceLabels: false,
    });
    setAiSettings(DEFAULT_AI_SETTINGS);
    showNotice('success', '已重置为默认配置');
  };

  const routeModelTestState = (() => {
    if (initialTestQuery?.action !== 'test') return null;
    const providerId = initialTestQuery.provider?.trim();
    const modelId = initialTestQuery.model?.trim();
    const provider = providerId
      ? aiSettings.providers.find((item) => item.id === providerId || item.name === providerId)
      : null;
    const model = provider && modelId
      ? provider.models.find((item) => item.model === modelId || item.id === modelId)
      : null;

    if (!providerId) {
      return createAuditedActionState({
        identity: {
          id: 'admin-config-model-test:missing-provider-param',
          category: 'model-test',
          label: '模型测试',
          sourceRoute: '/admin/config',
          requestedAction: 'test',
        },
        status: 'blocked',
        message: '模型测试缺少 provider 参数，不能定位供应商。',
        recoveryAction: '选择供应商后从模型列表重新测试',
        httpStatus: 400,
      });
    }

    if (!provider) {
      return createAuditedActionState({
        identity: {
          id: `admin-config-model-test:provider:${providerId}`,
          category: 'model-test',
          label: '模型测试',
          sourceRoute: '/admin/config',
          targetId: providerId,
          requestedAction: 'test',
        },
        status: 'blocked',
        message: `供应商 ${providerId} 不存在或当前配置不可见。`,
        recoveryAction: '返回供应商列表并刷新配置',
        httpStatus: 404,
      });
    }

    if (!modelId) {
      return createAuditedActionState({
        identity: {
          id: `admin-config-model-test:model-missing:${provider.id}`,
          category: 'model-test',
          label: '模型测试',
          sourceRoute: '/admin/config',
          targetId: provider.id,
          requestedAction: 'test',
        },
        status: 'blocked',
        message: `供应商 ${provider.name} 缺少 model 参数，不能执行模型测试。`,
        recoveryAction: '选择模型后重新测试',
        httpStatus: 400,
      });
    }

    if (!model) {
      return createAuditedActionState({
        identity: {
          id: `admin-config-model-test:${provider.id}:${modelId}`,
          category: 'model-test',
          label: '模型测试',
          sourceRoute: '/admin/config',
          targetId: modelId,
          requestedAction: 'test',
        },
        status: 'blocked',
        message: `供应商 ${provider.name} 下不存在模型 ${modelId}。`,
        recoveryAction: '检查模型目录或新增模型后重试',
        httpStatus: 404,
      });
    }

    const result = testResults[`${provider.id}:${model.model}`];
    return createAuditedActionState({
      identity: {
        id: `admin-config-model-test:${provider.id}:${model.model}`,
        category: 'model-test',
        label: '模型测试',
        sourceRoute: '/admin/config',
        targetId: model.model,
        requestedAction: 'test',
      },
      status: result?.status === 'success' ? 'succeeded' : result?.status === 'error' ? 'failed' : 'pending',
      message: result?.status === 'success'
        ? `模型 ${model.model} 测试成功，用时 ${result.elapsedMs ?? 0}ms。审计输出：${result.auditSummary ?? '模型测试已完成'}。`
        : result?.status === 'error'
          ? result.error ?? '模型测试失败。'
          : `模型 ${model.model} 已定位，可从模型列表执行测试。`,
      nextAction: result?.status === 'success' ? '保存供应商配置' : undefined,
      recoveryAction: result?.status === 'error' ? '检查密钥、模型 ID 和供应商能力后重试' : undefined,
      displayReference: result?.operationId ?? buildAdminOperationId({
        kind: 'admin-config-model-test',
        scope: `admin-config-model-test:${provider.id}:${model.model}`,
        seed: buildAdminOperationIdempotencyKey(['admin-config-model-test', provider.id, model.model, currentUser.id]),
      }),
      httpStatus: result?.status === 'error' ? 500 : undefined,
    });
  })();

  if (loading) {
    return (
      <div
        className="admin-console-shell"
        data-commercial-operations-workspace="admin-operations"
        data-commercial-workspace-zone="instrument-area"
        data-operations-status-semantics="loading"
      >
        <AdminConsoleHeader
          currentUser={currentUser}
          currentHref="/admin/config"
          backHref="/admin"
          eyebrow="平台参数"
          title="系统配置"
          description="管理平台基础参数、AI 供应商、模型目录与响应测试。"
        />
        <main className="admin-console-container py-8">
          <div className="admin-console-surface animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-slate-800" />
            <div className="h-64 rounded-xl bg-slate-800" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="admin-console-shell"
      data-commercial-operations-workspace="admin-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics={saving ? 'saving' : notice?.type === 'error' ? 'validation-error' : 'ready'}
    >
      <AdminConsoleHeader
        currentUser={currentUser}
        currentHref="/admin/config"
        backHref="/admin"
        eyebrow="平台参数"
        title="系统配置"
        description="管理平台基础参数、AI 供应商、模型目录与响应测试。"
        actions={
          <>
            <button type="button"
              onClick={handleReset}
              className="admin-console-button"
            >
              <RefreshCcw className="h-4 w-4" />
              重置为默认
            </button>
            <button type="button"
              onClick={handleSave}
              disabled={saving}
              className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : '保存配置'}
            </button>
          </>
        }
      />

      <main className="admin-console-container py-8">
        {routeModelTestState ? (
          <ActionStatusPanel state={routeModelTestState} className="mb-6" />
        ) : null}
        {configSaveStates.map((state) => (
          <ActionStatusPanel key={state.identity.id} state={state} className="mb-6" />
        ))}
        {modelTestActionState ? (
          <ActionStatusPanel state={modelTestActionState} className="mb-6" />
        ) : null}

        {notice && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              notice.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
            }`}
          >
            {notice.message}
          </div>
        )}

        <div className="grid gap-6">
          {/* 基础设置 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Server className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">基础设置</h2>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <div>
                <label htmlFor="system-config-dashboard-control-1" className="mb-2 block text-sm font-medium text-slate-300">
                  平台名称
                </label>
                <input id="system-config-dashboard-control-1"
                  type="text"
                  value={config.siteName}
                  onChange={(e) => setConfig({ ...config, siteName: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </div>
              <div>
                <label htmlFor="system-config-dashboard-control-2" className="mb-2 block text-sm font-medium text-slate-300">
                  默认密码
                </label>
                <input id="system-config-dashboard-control-2" aria-label="新账号默认密码"
                  type="text"
                  value={config.defaultPassword}
                  onChange={(e) => setConfig({ ...config, defaultPassword: e.target.value })}
                  placeholder="新账号默认密码"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
                <p className="mt-1 text-xs text-slate-500">批量创建账号时使用的默认密码</p>
              </div>
              <div>
                <label htmlFor="system-config-dashboard-control-3" className="mb-2 block text-sm font-medium text-slate-300">
                  每班最大学生数
                </label>
                <input id="system-config-dashboard-control-3"
                  type="number"
                  value={config.maxStudentsPerClass}
                  onChange={(e) => setConfig({ ...config, maxStudentsPerClass: parseInt(e.target.value) || 0 })}
                  min={1}
                  max={500}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">维护模式</p>
                  <p className="text-xs text-slate-500">开启后仅管理员可访问</p>
                </div>
                <button type="button"
                  aria-label="切换维护模式"
                  onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.maintenanceMode ? 'bg-cyan-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.maintenanceMode ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">首页动态模型渲染</p>
                  <p className="text-xs text-slate-500">关闭后首页仅显示静态图片，仿真页保持不变</p>
                </div>
                <button type="button"
                  aria-label="切换首页动态模型渲染"
                  onClick={() => setConfig({ ...config, homeDynamicModelEnabled: !config.homeDynamicModelEnabled })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.homeDynamicModelEnabled ? 'bg-cyan-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.homeDynamicModelEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-platform-border bg-platform-surface px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-platform-fg-primary">数据中心演示来源标签</p>
                  <p className="text-xs text-platform-fg-muted">仅控制普通数据中心可见标签，治理审计来源保持可用</p>
                </div>
                <button type="button"
                  aria-label="切换数据中心演示来源标签"
                  onClick={() => setConfig({
                    ...config,
                    dataCenterShowDemoSourceLabels: !config.dataCenterShowDemoSourceLabels,
                  })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.dataCenterShowDemoSourceLabels ? 'bg-platform-action-primary' : 'bg-platform-border-strong'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-platform-surface transition ${
                      config.dataCenterShowDemoSourceLabels ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* AI 模型配置 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Gauge className="h-5 w-5 text-cyan-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">AI 供应商与模型</h2>
                <p className="text-xs text-slate-500">保存后，业务 AI route 会按当前选择调用</p>
              </div>
            </div>
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label htmlFor="system-config-dashboard-control-4" className="mb-2 block text-sm font-medium text-slate-300">当前供应商</label>
                  <select id="system-config-dashboard-control-4"
                    value={aiSettings.activeProvider}
                    onChange={(event) => selectProvider(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                  >
                    {aiSettings.providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="system-config-dashboard-control-5" className="mb-2 block text-sm font-medium text-slate-300">当前模型</label>
                  <select id="system-config-dashboard-control-5"
                    value={activeProvider?.selectedModel ?? ''}
                    onChange={(event) => activeProvider && selectModel(activeProvider.id, event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                  >
                    {(activeProvider?.models ?? []).map((model) => (
                      <option key={model.model} value={model.model}>{model.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {activeProvider && (
                <div className="admin-console-surface-soft space-y-4">
                    <div className="grid gap-3 md:grid-cols-[0.8fr_1fr]">
                      <div>
                        <label htmlFor="system-config-dashboard-control-6" className="mb-2 block text-xs font-medium text-platform-fg-muted">供应商名称</label>
                        <input id="system-config-dashboard-control-6"
                        type="text"
                        value={activeProvider.name}
                        onChange={(event) => updateProvider(activeProvider.id, { name: event.target.value })}
                        className="admin-console-input w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="system-config-dashboard-api-7" className="mb-2 block text-xs font-medium text-platform-fg-muted">API 端点</label>
                      <input id="system-config-dashboard-api-7"
                        type="text"
                        value={activeProvider.baseURL}
                        onChange={(event) => updateProvider(activeProvider.id, { baseURL: event.target.value })}
                        className="admin-console-input w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="system-config-dashboard-control-8" className="mb-2 block text-xs font-medium text-platform-fg-muted">供应商类型</label>
                      <select id="system-config-dashboard-control-8"
                        value={activeProvider.providerKind}
                        onChange={(event) => updateProvider(activeProvider.id, { providerKind: event.target.value as AIProviderKind })}
                        className="admin-console-input w-full px-3 py-2 text-sm"
                      >
                        <option value="openai-compatible">OpenAI Compatible</option>
                        <option value="anthropic-compatible">Anthropic Compatible</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="system-config-dashboard-control-9" className="mb-2 block text-xs font-medium text-platform-fg-muted">密钥引用</label>
                      <input id="system-config-dashboard-control-9" aria-label="env:CUSTOM_PROVIDER_API_KEY"
                        type="text"
                        value={activeProvider.secretRef}
                        onChange={(event) => updateProvider(activeProvider.id, { secretRef: event.target.value })}
                        placeholder="env:CUSTOM_PROVIDER_API_KEY"
                        className="admin-console-input w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="flex items-center justify-between rounded-lg border border-platform-border bg-platform-surface px-3 py-2 text-xs text-platform-fg-secondary">
                        启用
                        <input
                          type="checkbox"
                          checked={activeProvider.enabled}
                          onChange={(event) => updateProvider(activeProvider.id, { enabled: event.target.checked })}
                          className="h-4 w-4 accent-platform-action-primary"
                        />
                      </label>
                      <div>
                        <label htmlFor="system-config-dashboard-control-10" className="mb-2 block text-xs font-medium text-platform-fg-muted">优先级</label>
                        <input id="system-config-dashboard-control-10"
                          type="number"
                          value={activeProvider.priority}
                          onChange={(event) => updateProvider(activeProvider.id, { priority: Number(event.target.value) })}
                          className="admin-console-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="system-config-dashboard-control-11" className="mb-2 block text-xs font-medium text-platform-fg-muted">健康状态</label>
                        <select id="system-config-dashboard-control-11"
                          value={activeProvider.health}
                          onChange={(event) => updateProvider(activeProvider.id, { health: event.target.value as AIProviderHealthState })}
                          className="admin-console-input w-full px-3 py-2 text-sm"
                        >
                          <option value="unknown">unknown</option>
                          <option value="healthy">healthy</option>
                          <option value="degraded">degraded</option>
                          <option value="unavailable">unavailable</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    {([
                      ['tools', '工具'],
                      ['streaming', '流式'],
                      ['citationNormalization', '引用归一'],
                      ['jsonSchema', 'JSON Schema'],
                      ['reasoning', '推理'],
                      ['vision', '视觉'],
                    ] as Array<[keyof AIProviderCapabilities, string]>).map(([capability, label]) => (
                      <label key={capability} className="flex items-center justify-between rounded-lg border border-platform-border bg-platform-surface px-3 py-2 text-xs text-platform-fg-secondary">
                        {label}
                        <input
                          type="checkbox"
                          checked={activeProvider.capabilities[capability]}
                          onChange={(event) => updateProviderCapability(activeProvider.id, capability, event.target.checked)}
                          className="h-4 w-4 accent-platform-action-primary"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {activeProvider.models.map((model) => {
                      const key = `${activeProvider.id}:${model.model}`;
                      const result = testResults[key];
                      const isEditing = editingModel?.providerId === activeProvider.id && editingModel.modelId === model.id;
                      return (
                        <div key={model.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            {isEditing && editingModel ? (
                              <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[0.7fr_1fr_1.2fr]">
                                <input aria-label="模型显示名"
                                  type="text"
                                  value={editingModel.label}
                                  onChange={(event) => setEditingModel({ ...editingModel, label: event.target.value })}
                                  placeholder="模型显示名"
                                  className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                                />
                                <input aria-label="模型 ID，例如 vendor/model"
                                  type="text"
                                  value={editingModel.model}
                                  onChange={(event) => setEditingModel({ ...editingModel, model: event.target.value })}
                                  placeholder="模型 ID，例如 vendor/model"
                                  className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                                />
                                <input aria-label="备注，可选"
                                  type="text"
                                  value={editingModel.description}
                                  onChange={(event) => setEditingModel({ ...editingModel, description: event.target.value })}
                                  placeholder="备注，可选"
                                  className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                                />
                              </div>
                            ) : (
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-100">{model.label}</p>
                                <p className="break-all text-xs text-slate-400">{model.model}</p>
                                {model.description && <p className="mt-1 text-xs text-slate-500">{model.description}</p>}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button type="button" onClick={saveEditedModel} className="rounded-md border border-emerald-500/50 p-1.5 text-emerald-200 transition hover:bg-emerald-500/10" aria-label="保存模型">
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={() => setEditingModel(null)} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:border-slate-500 hover:text-slate-200" aria-label="取消编辑">
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" onClick={() => selectModel(activeProvider.id, model.model)} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-500 hover:text-cyan-200">
                                    选用
                                  </button>
                                  <button type="button" onClick={() => testModel(activeProvider.id, model.model)} disabled={result?.status === 'running'} className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">
                                    {result?.status === 'running' ? '测试中...' : '测试'}
                                  </button>
                                  <button type="button" onClick={() => startEditModel(activeProvider.id, model)} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:border-cyan-500 hover:text-cyan-200" aria-label="编辑模型">
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              <button type="button" onClick={() => removeModel(activeProvider.id, model.model)} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:border-rose-500 hover:text-rose-300" aria-label="删除模型">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {result && result.status !== 'running' && (
                            <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${result.status === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/30 bg-rose-500/10 text-rose-100'}`}>
                              {result.status === 'success' ? (
                                <>
                                  <p>响应时间：{((result.elapsedMs ?? 0) / 1000).toFixed(2)} 秒，正文 {result.chars ?? 0} 字。</p>
                                  <p className="mt-1 line-clamp-3 text-slate-300">{result.text}</p>
                                </>
                              ) : (
                                <p>{result.error}</p>
                              )}
                              <p className="mt-2 break-all text-platform-fg-muted">
                                操作：{result.operationId} · 去重键：{result.idempotencyKey}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 border-t border-slate-800 pt-4 md:grid-cols-[0.7fr_1fr_1.2fr_auto]">
                    <input aria-label="模型显示名" type="text" value={newModel.label} onChange={(event) => setNewModel({ ...newModel, label: event.target.value })} placeholder="模型显示名" className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500" />
                    <input aria-label="模型 ID，例如 vendor/model" type="text" value={newModel.model} onChange={(event) => setNewModel({ ...newModel, model: event.target.value })} placeholder="模型 ID，例如 vendor/model" className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500" />
                    <input aria-label="备注，可选" type="text" value={newModel.description} onChange={(event) => setNewModel({ ...newModel, description: event.target.value })} placeholder="备注，可选" className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500" />
                    <button type="button" onClick={addModel} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/50 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-500/10">
                      <Plus className="h-4 w-4" />
                      添加模型
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-200">供应商目录</p>
                  {activeProvider && activeProvider.id !== 'siliconflow' && (
                    <button type="button" onClick={() => removeProvider(activeProvider.id)} className="inline-flex items-center gap-1 text-xs text-rose-300 transition hover:text-rose-200">
                      <Trash2 className="h-3.5 w-3.5" />
                      删除当前供应商
                    </button>
                  )}
                </div>
	                <div className="grid gap-3 md:grid-cols-[0.7fr_0.9fr_0.9fr_1fr_1fr_auto]">
                  <input aria-label="provider-id" type="text" value={newProvider.id} onChange={(event) => setNewProvider({ ...newProvider, id: event.target.value })} placeholder="provider-id" className="admin-console-input px-3 py-2 text-sm" />
                  <input aria-label="供应商名称" type="text" value={newProvider.name} onChange={(event) => setNewProvider({ ...newProvider, name: event.target.value })} placeholder="供应商名称" className="admin-console-input px-3 py-2 text-sm" />
                  <select value={newProvider.providerKind} onChange={(event) => setNewProvider({ ...newProvider, providerKind: event.target.value as AIProviderKind })} className="admin-console-input px-3 py-2 text-sm">
                    <option value="openai-compatible">OpenAI Compatible</option>
                    <option value="anthropic-compatible">Anthropic Compatible</option>
                  </select>
                  <input aria-label="https://example.com/v1" type="text" value={newProvider.baseURL} onChange={(event) => setNewProvider({ ...newProvider, baseURL: event.target.value })} placeholder="https://example.com/v1" className="admin-console-input px-3 py-2 text-sm" />
                  <input aria-label="env:CUSTOM_API_KEY" type="text" value={newProvider.secretRef} onChange={(event) => setNewProvider({ ...newProvider, secretRef: event.target.value })} placeholder="env:CUSTOM_API_KEY" className="admin-console-input px-3 py-2 text-sm" />
                  <button type="button" onClick={addProvider} className="admin-console-button inline-flex items-center justify-center gap-2 px-3 py-2 text-sm">
                    <Plus className="h-4 w-4" />
                    添加供应商
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                API Key 仍从环境变量读取。当前只有 SiliconFlow 具备运行时适配；新增供应商会先进入目录，待适配器实现后可启用调用。
              </p>
            </div>
          </div>

          {/* 通知设置 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Bell className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">通知设置</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">启用通知</p>
                  <p className="text-xs text-slate-500">系统消息和预警通知</p>
                </div>
                <button type="button"
                  aria-label="切换通知"
                  onClick={() => setConfig({ ...config, enableNotifications: !config.enableNotifications })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    config.enableNotifications ? 'bg-cyan-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      config.enableNotifications ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 伦理监测 */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6 flex items-center gap-3">
              <Shield className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">伦理监测</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="system-config-dashboard-control-12" className="mb-2 block text-sm font-medium text-slate-300">
                  预警阈值
                </label>
                <input id="system-config-dashboard-control-12"
                  type="number"
                  value={config.ethicsAlertThreshold}
                  onChange={(e) => setConfig({ ...config, ethicsAlertThreshold: parseInt(e.target.value) || 1 })}
                  min={1}
                  max={10}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
                <p className="mt-1 text-xs text-slate-500">
                  当学生违规次数达到此值时触发预警
                </p>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
