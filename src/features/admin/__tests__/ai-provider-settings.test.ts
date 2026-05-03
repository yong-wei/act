import { describe, expect, it } from 'vitest';
import {
  getDefaultAIProviderSettings,
  getModelRuntimeOptions,
  normalizeAIProviderSettings,
} from '@/lib/ai/provider-settings';

describe('AI provider settings', () => {
  it('uses Qwen3.6 as the default SiliconFlow model and keeps the requested alternatives', () => {
    const settings = getDefaultAIProviderSettings({
      AI_PROVIDER: 'siliconflow',
      AI_BASE_URL: 'https://api.siliconflow.cn/v1',
      AI_API_KEY: 'sk-test',
    } as unknown as NodeJS.ProcessEnv);
    const siliconflow = settings.providers[0];

    expect(settings.activeProvider).toBe('siliconflow');
    expect(siliconflow?.selectedModel).toBe('Qwen/Qwen3.6-35B-A3B');
    expect(siliconflow?.models.map((model) => model.model)).toEqual(
      expect.arrayContaining([
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
          baseURL: 'https://example.test/v1',
          selectedModel: 'custom/model',
          models: [{ id: 'custom-model', label: 'Custom Model', model: 'custom/model' }],
        },
      ],
    });

    expect(settings.activeProvider).toBe('custom-provider');
    expect(settings.providers).toHaveLength(2);
    expect(settings.providers[0]?.models.map((model) => model.model)).toContain('Qwen/Qwen3.6-35B-A3B');
    expect(settings.providers[1]?.models[0]).toMatchObject({ model: 'custom/model' });
  });

  it('marks Qwen3.6 to disable thinking for normal teaching prompts', () => {
    const settings = getDefaultAIProviderSettings({
      AI_PROVIDER: 'siliconflow',
      AI_BASE_URL: 'https://api.siliconflow.cn/v1',
      AI_API_KEY: 'sk-test',
    } as unknown as NodeJS.ProcessEnv);

    expect(getModelRuntimeOptions(settings, 'siliconflow', 'Qwen/Qwen3.6-35B-A3B')).toEqual({
      enableThinking: false,
    });
  });
});
