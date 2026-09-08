import { describe, expect, it } from 'vitest';
import {
  resolveAIProviderConfig,
} from '@/lib/ai/provider-config';
import {
  getDefaultAIProviderSettings,
  getModelRuntimeOptions,
  normalizeAIProviderSettings,
  resolveConfiguredAIProviderConfig,
  resolveProviderSecret,
  validateAIProviderSettingsInput,
} from '@/lib/ai/provider-settings';

describe('AI provider settings', () => {
  it('uses Qwen3.5 as the default SiliconFlow model and keeps the requested alternatives', () => {
    const settings = getDefaultAIProviderSettings({
      AI_PROVIDER: 'siliconflow',
      AI_BASE_URL: 'https://api.siliconflow.cn/v1',
      AI_API_KEY: 'sk-test',
    } as unknown as NodeJS.ProcessEnv);
    const siliconflow = settings.providers[0];

    expect(settings.activeProvider).toBe('siliconflow');
    expect(siliconflow?.selectedModel).toBe('Qwen/Qwen3.5-35B-A3B');
    expect(siliconflow).toMatchObject({
      providerKind: 'openai-compatible',
      authMode: 'bearer-api-key',
      secretRef: 'env:SILICONFLOW_API_KEY',
      enabled: true,
      health: 'unknown',
      capabilities: expect.objectContaining({
        tools: true,
        streaming: true,
        citationNormalization: true,
      }),
    });
    expect(siliconflow?.models.map((model) => model.model)).toEqual(
      expect.arrayContaining([
        'Qwen/Qwen3.5-35B-A3B',
        'Qwen/Qwen3.6-35B-A3B',
        'deepseek-ai/DeepSeek-V4-Flash',
        'MiniMaxAI/MiniMax-M2.5',
      ])
    );
  });

  it('normalizes admin-added providers and models without dropping SiliconFlow defaults', () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'custom-provider',
      providers: [
        {
          id: 'siliconflow',
          name: 'SiliconFlow',
          baseURL: 'https://api.siliconflow.cn/v1',
          selectedModel: 'MiniMaxAI/MiniMax-M2.5',
          models: [],
        },
        {
          id: 'custom-provider',
          name: 'Custom Provider',
          providerKind: 'anthropic-compatible',
          baseURL: 'https://example.test/v1',
          secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
          selectedModel: 'custom/model',
          enabled: true,
          priority: 5,
          capabilities: { tools: true, reasoning: true, vision: true, jsonSchema: false, streaming: true, citationNormalization: true },
          models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
        },
      ],
    });

    expect(settings.activeProvider).toBe('custom-provider');
    expect(settings.providers).toHaveLength(2);
    expect(settings.providers[0]?.models.map((model) => model.model)).toContain('Qwen/Qwen3.6-35B-A3B');
    expect(settings.providers[1]).toMatchObject({
      providerKind: 'anthropic-compatible',
      secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
      priority: 5,
      models: [expect.objectContaining({ model: 'custom/model' })],
    });
    expect(JSON.stringify(settings)).not.toContain('sk-test');
  });

  it('preserves SiliconFlow citation capability when normalizing legacy saved settings', () => {
    const fallback = getDefaultAIProviderSettings({
      AI_PROVIDER: 'siliconflow',
      SILICONFLOW_API_KEY: 'sk-test',
    } as unknown as NodeJS.ProcessEnv);
    const settings = normalizeAIProviderSettings({
      activeProvider: 'siliconflow',
      providers: [{
        id: 'siliconflow',
        name: 'SiliconFlow',
        baseURL: 'https://api.siliconflow.cn/v1',
        selectedModel: 'Qwen/Qwen3.6-35B-A3B',
        models: [],
      }],
    }, fallback);

    expect(settings.providers[0]?.capabilities).toMatchObject({
      tools: true,
      streaming: true,
      citationNormalization: true,
    });
  });

  it.each(['Qwen/Qwen3.5-35B-A3B', 'Qwen/Qwen3.6-35B-A3B'])('marks %s to disable thinking for normal teaching prompts', (model) => {
    const settings = getDefaultAIProviderSettings({
      AI_PROVIDER: 'siliconflow',
      AI_BASE_URL: 'https://api.siliconflow.cn/v1',
      AI_API_KEY: 'sk-test',
    } as unknown as NodeJS.ProcessEnv);

    expect(getModelRuntimeOptions(settings, 'siliconflow', model)).toEqual({
      enableThinking: false,
    });
  });

  it('keeps provider capability metadata for mixed OpenAI and Anthropic compatible settings', () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'openai-main',
      providers: [
        {
          id: 'openai-main',
          name: 'OpenAI Main',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-main.test/v1',
          selectedModel: 'openai/model',
          secretRef: 'env:OPENAI_MAIN_API_KEY',
          priority: 20,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
          models: [{ id: 'openai-model', label: 'OpenAI Model', model: 'openai/model' }],
        },
        {
          id: 'anthropic-cited',
          name: 'Anthropic Cited',
          providerKind: 'anthropic-compatible',
          baseURL: 'https://anthropic-cited.test/v1',
          selectedModel: 'claude/model',
          secretRef: 'env:ANTHROPIC_CITED_API_KEY',
          priority: 10,
          capabilities: { tools: true, reasoning: true, vision: true, jsonSchema: false, streaming: true, citationNormalization: true },
          models: [{ id: 'claude-model', label: 'Claude Model', model: 'claude/model' }],
        },
      ],
    });

    expect(settings.activeProvider).toBe('openai-main');
    expect(settings.providers.map((provider) => [provider.id, provider.providerKind, provider.capabilities.citationNormalization])).toEqual([
      ['openai-main', 'openai-compatible', false],
      ['anthropic-cited', 'anthropic-compatible', true],
    ]);
  });

  it('resolves environment fallback as an Anthropic-compatible config without exposing plaintext in settings', async () => {
    const settings = getDefaultAIProviderSettings({
      AI_PROVIDER: 'anthropic-school',
      AI_PROVIDER_KIND: 'anthropic-compatible',
      AI_BASE_URL: 'https://anthropic-school.test/v1',
      AI_API_KEY: 'sk-anthropic-secret',
      AI_MODEL: 'claude-school',
      AI_SECRET_REF: 'env:ANTHROPIC_SCHOOL_API_KEY',
    } as unknown as NodeJS.ProcessEnv);

    expect(settings.activeProvider).toBe('anthropic-school');
    expect(settings.providers[0]).toMatchObject({
      id: 'anthropic-school',
      providerKind: 'anthropic-compatible',
      secretRef: 'env:ANTHROPIC_SCHOOL_API_KEY',
      capabilities: expect.objectContaining({
        tools: true,
        citationNormalization: true,
      }),
    });
    expect(JSON.stringify(settings)).not.toContain('sk-anthropic-secret');
  });

  it('does not reuse the SiliconFlow secret for a custom provider env config', () => {
    const config = resolveAIProviderConfig({
      AI_PROVIDER: 'custom-openai',
      AI_PROVIDER_KIND: 'openai-compatible',
      AI_BASE_URL: 'https://custom-openai.test/v1',
      SILICONFLOW_API_KEY: 'sk-siliconflow-only',
      SILICONFLOW_SECRET_REF: 'env:SILICONFLOW_API_KEY',
      AI_MODEL: 'custom/model',
    } as unknown as NodeJS.ProcessEnv);

    expect(config.provider).toBe('custom-openai');
    expect(config.apiKey).toBe('');
    expect(config.secretRef).toBe('env:AI_API_KEY');
  });

  it('falls back to OpenAI-compatible when provider kind is invalid', () => {
    const config = resolveAIProviderConfig({
      AI_PROVIDER: 'custom-provider',
      AI_PROVIDER_KIND: 'not-a-provider-kind',
      AI_BASE_URL: 'https://custom-provider.test/v1',
      AI_API_KEY: 'sk-custom',
      AI_MODEL: 'custom/model',
    } as unknown as NodeJS.ProcessEnv);

    expect(config.providerKind).toBe('openai-compatible');
  });

  it('resolves secretRef values only from explicit env references', () => {
    expect(resolveProviderSecret('env:OPENAI_MAIN_API_KEY', {
      OPENAI_MAIN_API_KEY: 'sk-openai-main',
    } as unknown as NodeJS.ProcessEnv)).toBe('sk-openai-main');
    expect(resolveProviderSecret('sk-plaintext-secret')).toBe('');
  });

  it('normalizes plaintext secretRef values to a safe env reference', () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        name: 'Custom Provider',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        secretRef: 'sk-plaintext-secret',
        selectedModel: 'custom/model',
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    });

    expect(settings.providers[0]?.secretRef).toBe('env:CUSTOM_PROVIDER_API_KEY');
    expect(JSON.stringify(settings)).not.toContain('sk-plaintext-secret');
  });

  it('selects a runtime-supported fallback when the active provider cannot run without explicit requirements', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'anthropic-cited',
      providers: [
        {
          id: 'anthropic-cited',
          name: 'Anthropic Cited',
          providerKind: 'anthropic-compatible',
          baseURL: 'https://anthropic-cited.test/v1',
          secretRef: 'env:ANTHROPIC_CITED_API_KEY',
          selectedModel: 'claude/model',
          priority: 10,
          capabilities: { tools: true, reasoning: true, vision: true, jsonSchema: false, streaming: true, citationNormalization: true },
          models: [{ id: 'claude-model', label: 'Claude Model', model: 'claude/model' }],
        },
        {
          id: 'openai-main',
          name: 'OpenAI Main',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-main.test/v1',
          secretRef: 'env:OPENAI_MAIN_API_KEY',
          selectedModel: 'openai/model',
          priority: 20,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
          models: [{ id: 'openai-model', label: 'OpenAI Model', model: 'openai/model' }],
        },
      ],
    });

    const config = await resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      undefined,
      settings,
      {
        AI_PROVIDER: 'siliconflow',
        SILICONFLOW_API_KEY: 'sk-siliconflow',
        OPENAI_MAIN_API_KEY: 'sk-openai-main',
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(config.provider).toBe('openai-main');
    expect(config.apiKey).toBe('sk-openai-main');
  });

  it('does not treat a custom bearer provider as configured from SiliconFlow secrets', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'custom-openai',
      providers: [{
        id: 'custom-openai',
        name: 'Custom OpenAI',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-openai.test/v1',
        secretRef: 'env:AI_API_KEY',
        selectedModel: 'custom/model',
        priority: 10,
        capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
        models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
      }],
    });

    await expect(resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      undefined,
      settings,
      {
        AI_PROVIDER: 'custom-openai',
        AI_PROVIDER_KIND: 'openai-compatible',
        AI_BASE_URL: 'https://custom-openai.test/v1',
        SILICONFLOW_SECRET_REF: 'env:SILICONFLOW_API_KEY',
        SILICONFLOW_API_KEY: 'sk-siliconflow-only',
        AI_MODEL: 'custom/model',
      } as unknown as NodeJS.ProcessEnv,
    )).rejects.toThrow('No enabled provider can satisfy the requested capabilities.');
  });

  it('rejects downgraded providers for any explicitly required capability', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'openai-main',
      providers: [{
        id: 'openai-main',
        name: 'OpenAI Main',
        providerKind: 'openai-compatible',
        baseURL: 'https://openai-main.test/v1',
        secretRef: 'env:OPENAI_MAIN_API_KEY',
        selectedModel: 'openai/model',
        priority: 10,
        capabilities: { tools: false, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
        models: [{ id: 'openai-model', label: 'OpenAI Model', model: 'openai/model' }],
      }],
    });

    await expect(resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      { tools: true },
      settings,
      { OPENAI_MAIN_API_KEY: 'sk-openai-main' } as unknown as NodeJS.ProcessEnv,
    )).rejects.toThrow('lacks required capabilities');
  });

  it('honors the active provider before priority fallbacks when runtime capabilities are required', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'siliconflow',
      providers: [
        {
          id: 'siliconflow',
          name: 'SiliconFlow',
          providerKind: 'openai-compatible',
          baseURL: 'https://api.siliconflow.cn/v1',
          secretRef: 'env:SILICONFLOW_API_KEY',
          selectedModel: 'deepseek-ai/DeepSeek-V4-Flash',
          priority: 100,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: true },
          models: [{ id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', model: 'deepseek-ai/DeepSeek-V4-Flash' }],
        },
        {
          id: 'deepseek-official',
          name: 'DeepSeek Official',
          providerKind: 'openai-compatible',
          baseURL: 'https://api.deepseek.com',
          secretRef: 'env:AI_API_KEY',
          selectedModel: 'deepseek-v4-flash',
          priority: 90,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: true },
          models: [{ id: 'deepseek-v4-flash-official', label: 'DeepSeek V4 Flash', model: 'deepseek-v4-flash' }],
        },
      ],
    });

    const config = await resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      { tools: true, streaming: true, citationNormalization: true },
      settings,
      {
        SILICONFLOW_API_KEY: 'sk-siliconflow',
        AI_API_KEY: 'sk-deepseek-official',
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(config.provider).toBe('siliconflow');
    expect(config.baseURL).toBe('https://api.siliconflow.cn/v1');
    expect(config.secretRef).toBe('env:SILICONFLOW_API_KEY');
    expect(config.apiKey).toBe('sk-siliconflow');
  });

  it('selects another provider when the active provider lacks required capabilities', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'openai-main',
      providers: [
        {
          id: 'openai-main',
          name: 'OpenAI Main',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-main.test/v1',
          secretRef: 'env:OPENAI_MAIN_API_KEY',
          selectedModel: 'openai/model',
          priority: 10,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
          models: [{ id: 'openai-model', label: 'OpenAI Model', model: 'openai/model' }],
        },
        {
          id: 'openai-cited',
          name: 'OpenAI Cited',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-cited.test/v1',
          secretRef: 'env:OPENAI_CITED_API_KEY',
          selectedModel: 'openai/cited-model',
          priority: 20,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: true },
          models: [{ id: 'openai-cited-model', label: 'OpenAI Cited Model', model: 'openai/cited-model' }],
        },
      ],
    });

    const config = await resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      { tools: true, streaming: true, citationNormalization: true },
      settings,
      {
        OPENAI_MAIN_API_KEY: 'sk-openai-main',
        OPENAI_CITED_API_KEY: 'sk-openai-cited',
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(config.provider).toBe('openai-cited');
    expect(config.apiKey).toBe('sk-openai-cited');
  });

  it('skips enabled bearer providers with missing secrets during runtime selection', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'openai-main',
      providers: [
        {
          id: 'openai-main',
          name: 'OpenAI Main',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-main.test/v1',
          secretRef: 'env:OPENAI_MAIN_API_KEY',
          selectedModel: 'openai/model',
          priority: 10,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
          models: [{ id: 'openai-model', label: 'OpenAI Model', model: 'openai/model' }],
        },
        {
          id: 'openai-backup',
          name: 'OpenAI Backup',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-backup.test/v1',
          secretRef: 'env:OPENAI_BACKUP_API_KEY',
          selectedModel: 'openai/backup-model',
          priority: 20,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
          models: [{ id: 'openai-backup-model', label: 'OpenAI Backup Model', model: 'openai/backup-model' }],
        },
      ],
    });

    const config = await resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      { tools: true, streaming: true },
      settings,
      { OPENAI_BACKUP_API_KEY: 'sk-openai-backup' } as unknown as NodeJS.ProcessEnv,
    );

    expect(config.provider).toBe('openai-backup');
    expect(config.apiKey).toBe('sk-openai-backup');
  });

  it('keeps legacy AI_API_KEY-only SiliconFlow deployments selectable', async () => {
    const settings = getDefaultAIProviderSettings({
      AI_PROVIDER: 'siliconflow',
      AI_API_KEY: 'sk-legacy-ai-key',
    } as unknown as NodeJS.ProcessEnv);

    const config = await resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      { tools: true, streaming: true, citationNormalization: true },
      settings,
      {
        AI_PROVIDER: 'siliconflow',
        AI_API_KEY: 'sk-legacy-ai-key',
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(config.provider).toBe('siliconflow');
    expect(config.secretRef).toBe('env:SILICONFLOW_API_KEY');
    expect(config.apiKey).toBe('sk-legacy-ai-key');
  });

  it('skips providers without a selected model instead of using the global env model', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'custom-empty-model',
      providers: [
        {
          id: 'custom-empty-model',
          name: 'Custom Empty Model',
          providerKind: 'openai-compatible',
          baseURL: 'https://custom-empty.test/v1',
          secretRef: 'env:CUSTOM_EMPTY_API_KEY',
          selectedModel: '',
          priority: 10,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
          models: [],
        },
        {
          id: 'openai-backup',
          name: 'OpenAI Backup',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-backup.test/v1',
          secretRef: 'env:OPENAI_BACKUP_API_KEY',
          selectedModel: 'openai/backup-model',
          priority: 20,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
          models: [{ id: 'openai-backup-model', label: 'OpenAI Backup Model', model: 'openai/backup-model' }],
        },
      ],
    });

    const config = await resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      { tools: true, streaming: true },
      settings,
      {
        CUSTOM_EMPTY_API_KEY: 'sk-custom-empty',
        OPENAI_BACKUP_API_KEY: 'sk-openai-backup',
        AI_MODEL: 'Qwen/Qwen3.6-35B-A3B',
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(config.provider).toBe('openai-backup');
    expect(config.model).toBe('openai/backup-model');
  });

  it('preserves explicit serviceId selection failures without falling back to backups', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'openai-main',
      providers: [
        {
          id: 'openai-main',
          name: 'OpenAI Main',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-main.test/v1',
          secretRef: 'env:OPENAI_MAIN_API_KEY',
          selectedModel: 'openai/main-model',
          priority: 10,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
          models: [{ id: 'openai-main-model', label: 'OpenAI Main Model', model: 'openai/main-model' }],
        },
        {
          id: 'openai-backup',
          name: 'OpenAI Backup',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-backup.test/v1',
          secretRef: 'env:OPENAI_BACKUP_API_KEY',
          selectedModel: 'openai/backup-model',
          priority: 20,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: true },
          models: [{ id: 'openai-backup-model', label: 'OpenAI Backup Model', model: 'openai/backup-model' }],
        },
      ],
    });

    await expect(resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      { serviceId: 'openai-main', tools: true, streaming: true, citationNormalization: true },
      settings,
      {
        OPENAI_MAIN_API_KEY: 'sk-openai-main',
        OPENAI_BACKUP_API_KEY: 'sk-openai-backup',
      } as unknown as NodeJS.ProcessEnv,
    )).rejects.toThrow('Provider openai-main lacks required capabilities: citationNormalization.');
  });

  it('preserves explicit providerId selection failures without falling back to backups', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'openai-backup',
      providers: [
        {
          id: 'openai-main',
          name: 'OpenAI Main',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-main.test/v1',
          secretRef: 'env:OPENAI_MAIN_API_KEY',
          selectedModel: 'openai/main-model',
          priority: 10,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: false },
          models: [{ id: 'openai-main-model', label: 'OpenAI Main Model', model: 'openai/main-model' }],
        },
        {
          id: 'openai-backup',
          name: 'OpenAI Backup',
          providerKind: 'openai-compatible',
          baseURL: 'https://openai-backup.test/v1',
          secretRef: 'env:OPENAI_BACKUP_API_KEY',
          selectedModel: 'openai/backup-model',
          priority: 20,
          capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: true },
          models: [{ id: 'openai-backup-model', label: 'OpenAI Backup Model', model: 'openai/backup-model' }],
        },
      ],
    });

    await expect(resolveConfiguredAIProviderConfig(
      'openai-main',
      undefined,
      { tools: true, streaming: true, citationNormalization: true },
      settings,
      {
        OPENAI_MAIN_API_KEY: 'sk-openai-main',
        OPENAI_BACKUP_API_KEY: 'sk-openai-backup',
      } as unknown as NodeJS.ProcessEnv,
    )).rejects.toThrow('Provider openai-main lacks required capabilities: citationNormalization.');
  });

  it('uses the configured secretRef even when the provider id matches the env provider', async () => {
    const settings = normalizeAIProviderSettings({
      activeProvider: 'siliconflow',
      providers: [{
        id: 'siliconflow',
        name: 'SiliconFlow',
        providerKind: 'openai-compatible',
        baseURL: 'https://api.siliconflow.cn/v1',
        secretRef: 'env:SILICONFLOW_ALT_API_KEY',
        selectedModel: 'Qwen/Qwen3.6-35B-A3B',
        priority: 100,
        capabilities: { tools: true, reasoning: false, vision: false, jsonSchema: true, streaming: true, citationNormalization: true },
        models: [{ id: 'qwen', label: 'Qwen', model: 'Qwen/Qwen3.6-35B-A3B' }],
      }],
    });

    const config = await resolveConfiguredAIProviderConfig(
      undefined,
      undefined,
      undefined,
      settings,
      {
        AI_PROVIDER: 'siliconflow',
        SILICONFLOW_API_KEY: 'sk-default',
        SILICONFLOW_ALT_API_KEY: 'sk-alt',
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(config.apiKey).toBe('sk-alt');
  });

  it('rejects non-boolean capability values before normalization', () => {
    expect(validateAIProviderSettingsInput({
      activeProvider: 'custom-provider',
      providers: [{
        id: 'custom-provider',
        providerKind: 'openai-compatible',
        baseURL: 'https://custom-provider.test/v1',
        secretRef: 'env:CUSTOM_PROVIDER_API_KEY',
        capabilities: { tools: 'yes' },
      }],
    }).join('\n')).toContain('capabilities.tools');
  });
});
