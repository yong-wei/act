'use client';

import { useState, useEffect } from 'react';
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
}

interface ModelTestResult {
  status: 'running' | 'success' | 'error';
  elapsedMs?: number;
  chars?: number;
  text?: string;
  error?: string;
}

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
};

export function SystemConfigDashboard({ currentUser }: SystemConfigDashboardProps) {
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

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [platformResponse, aiResponse] = await Promise.all([
          fetch('/api/admin/platform-settings', { cache: 'no-store' }),
          fetch('/api/admin/ai-settings', { cache: 'no-store' }),
        ]);
        if (!platformResponse.ok) {
          throw new Error('加载配置失败');
        }
        const payload = await platformResponse.json() as { homeDynamicModelEnabled?: boolean };
        const aiPayload = aiResponse.ok ? await aiResponse.json() as AIProviderSettings : DEFAULT_AI_SETTINGS;
        const activeProvider = aiPayload.providers.find((provider) => provider.id === aiPayload.activeProvider) ?? aiPayload.providers[0];
        setConfig((prev) => ({
          ...prev,
          homeDynamicModelEnabled: payload.homeDynamicModelEnabled === true,
          aiProvider: aiPayload.activeProvider,
          aiModelEndpoint: activeProvider?.baseURL ?? '',
          aiModelName: activeProvider?.selectedModel ?? '',
        }));
        setAiSettings(aiPayload);
      } catch {
        setNotice({ type: 'error', message: '读取平台配置失败，已使用默认值' });
        setTimeout(() => setNotice(null), 3000);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const [platformResponse, aiResponse] = await Promise.all([
        fetch('/api/admin/platform-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeDynamicModelEnabled: config.homeDynamicModelEnabled,
          }),
        }),
        fetch('/api/admin/ai-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiSettings),
        }),
      ]);
      if (!platformResponse.ok || !aiResponse.ok) {
        throw new Error('保存失败');
      }
      const savedAiSettings = await aiResponse.json() as AIProviderSettings;
      setAiSettings(savedAiSettings);
      showNotice('success', '配置已保存');
    } catch {
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
    setAiSettings((prev) => ({ ...prev, activeProvider: providerId }));
    setConfig((prev) => ({
      ...prev,
      aiProvider: providerId,
      aiModelEndpoint: provider?.baseURL ?? '',
      aiModelName: provider?.selectedModel ?? '',
    }));
  };

  const selectModel = (providerId: string, model: string) => {
    updateProvider(providerId, { selectedModel: model });
  };

  const addProvider = () => {
    const id = makeId(newProvider.id || newProvider.name, `provider-${aiSettings.providers.length + 1}`);
    if (aiSettings.providers.some((provider) => provider.id === id)) {
      showNotice('error', '供应商 ID 已存在');
      return;
    }
    const provider: AIProviderSetting = {
      id,
      name: newProvider.name.trim() || id,
      providerKind: newProvider.providerKind,
      baseURL: newProvider.baseURL.trim(),
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
      activeProvider: id,
      providers: [...prev.providers, provider],
    }));
    setNewProvider({ id: '', name: '', providerKind: 'openai-compatible', baseURL: '', secretRef: '' });
    setConfig((prev) => ({ ...prev, aiProvider: id, aiModelEndpoint: provider.baseURL, aiModelName: '' }));
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
    setTestResults((prev) => ({ ...prev, [key]: { status: 'running' } }));
    try {
      const response = await fetch('/api/admin/ai-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, model }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || '测试失败');
      }
      const payload = await response.json() as {
        elapsedMs: number;
        chars: number;
        text: string;
      };
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          status: 'success',
          elapsedMs: payload.elapsedMs,
          chars: payload.chars,
          text: payload.text,
        },
      }));
    } catch (error) {
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          status: 'error',
          error: error instanceof Error ? error.message : '测试失败',
        },
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
    });
    setAiSettings(DEFAULT_AI_SETTINGS);
    showNotice('success', '已重置为默认配置');
  };

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
            <button
              onClick={handleReset}
              className="admin-console-button"
            >
              <RefreshCcw className="h-4 w-4" />
              重置为默认
            </button>
            <button
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
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  平台名称
                </label>
                <input
                  type="text"
                  value={config.siteName}
                  onChange={(e) => setConfig({ ...config, siteName: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  默认密码
                </label>
                <input
                  type="text"
                  value={config.defaultPassword}
                  onChange={(e) => setConfig({ ...config, defaultPassword: e.target.value })}
                  placeholder="新账号默认密码"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                />
                <p className="mt-1 text-xs text-slate-500">批量创建账号时使用的默认密码</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  每班最大学生数
                </label>
                <input
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
                <button
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
                <button
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
                  <label className="mb-2 block text-sm font-medium text-slate-300">当前供应商</label>
                  <select
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
                  <label className="mb-2 block text-sm font-medium text-slate-300">当前模型</label>
                  <select
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
                        <label className="mb-2 block text-xs font-medium text-platform-fg-muted">供应商名称</label>
                        <input
                        type="text"
                        value={activeProvider.name}
                        onChange={(event) => updateProvider(activeProvider.id, { name: event.target.value })}
                        className="admin-console-input w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-platform-fg-muted">API 端点</label>
                      <input
                        type="text"
                        value={activeProvider.baseURL}
                        onChange={(event) => updateProvider(activeProvider.id, { baseURL: event.target.value })}
                        className="admin-console-input w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-platform-fg-muted">供应商类型</label>
                      <select
                        value={activeProvider.providerKind}
                        onChange={(event) => updateProvider(activeProvider.id, { providerKind: event.target.value as AIProviderKind })}
                        className="admin-console-input w-full px-3 py-2 text-sm"
                      >
                        <option value="openai-compatible">OpenAI Compatible</option>
                        <option value="anthropic-compatible">Anthropic Compatible</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-platform-fg-muted">密钥引用</label>
                      <input
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
                        <label className="mb-2 block text-xs font-medium text-platform-fg-muted">优先级</label>
                        <input
                          type="number"
                          value={activeProvider.priority}
                          onChange={(event) => updateProvider(activeProvider.id, { priority: Number(event.target.value) })}
                          className="admin-console-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-platform-fg-muted">健康状态</label>
                        <select
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
                                <input
                                  type="text"
                                  value={editingModel.label}
                                  onChange={(event) => setEditingModel({ ...editingModel, label: event.target.value })}
                                  placeholder="模型显示名"
                                  className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                                />
                                <input
                                  type="text"
                                  value={editingModel.model}
                                  onChange={(event) => setEditingModel({ ...editingModel, model: event.target.value })}
                                  placeholder="模型 ID，例如 vendor/model"
                                  className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500"
                                />
                                <input
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
                            <div className="flex items-center gap-2">
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
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 border-t border-slate-800 pt-4 md:grid-cols-[0.7fr_1fr_1.2fr_auto]">
                    <input type="text" value={newModel.label} onChange={(event) => setNewModel({ ...newModel, label: event.target.value })} placeholder="模型显示名" className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500" />
                    <input type="text" value={newModel.model} onChange={(event) => setNewModel({ ...newModel, model: event.target.value })} placeholder="模型 ID，例如 vendor/model" className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500" />
                    <input type="text" value={newModel.description} onChange={(event) => setNewModel({ ...newModel, description: event.target.value })} placeholder="备注，可选" className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500" />
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
                  <input type="text" value={newProvider.id} onChange={(event) => setNewProvider({ ...newProvider, id: event.target.value })} placeholder="provider-id" className="admin-console-input px-3 py-2 text-sm" />
                  <input type="text" value={newProvider.name} onChange={(event) => setNewProvider({ ...newProvider, name: event.target.value })} placeholder="供应商名称" className="admin-console-input px-3 py-2 text-sm" />
                  <select value={newProvider.providerKind} onChange={(event) => setNewProvider({ ...newProvider, providerKind: event.target.value as AIProviderKind })} className="admin-console-input px-3 py-2 text-sm">
                    <option value="openai-compatible">OpenAI Compatible</option>
                    <option value="anthropic-compatible">Anthropic Compatible</option>
                  </select>
                  <input type="text" value={newProvider.baseURL} onChange={(event) => setNewProvider({ ...newProvider, baseURL: event.target.value })} placeholder="https://example.com/v1" className="admin-console-input px-3 py-2 text-sm" />
                  <input type="text" value={newProvider.secretRef} onChange={(event) => setNewProvider({ ...newProvider, secretRef: event.target.value })} placeholder="env:CUSTOM_API_KEY" className="admin-console-input px-3 py-2 text-sm" />
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
                <button
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
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  预警阈值
                </label>
                <input
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
