import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SILICONFLOW_MODEL } from '@/lib/ai/provider-config';
import { AI_PROVIDER_SETTINGS_KEY, getDefaultAIProviderSettings } from '@/lib/ai/provider-settings';
import { syncSiliconFlowQwenDefault } from '../../../scripts/db/set-ai-provider-qwen-default';

function fakeDb(initial: unknown) {
  let value = initial;
  const upsert = vi.fn(async ({ where, create, update }: {
    where: { key: string };
    create: { value: unknown };
    update: { value: unknown };
  }) => {
    if (where.key === AI_PROVIDER_SETTINGS_KEY) {
      value = update.value ?? create.value;
    }
  });
  return {
    db: {
      platformSetting: {
        findUnique: vi.fn(async ({ where }: { where: { key: string } }) => (
          where.key === AI_PROVIDER_SETTINGS_KEY ? { value } : null
        )),
        upsert,
      },
    },
    upsert,
    current: () => value,
  };
}

const deepSeekSettings = {
  activeProvider: 'siliconflow',
  providers: [{
    id: 'siliconflow',
    name: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    selectedModel: 'deepseek-ai/DeepSeek-V4-Flash',
    models: [],
  }],
};

const qwenSettings = {
  ...deepSeekSettings,
  providers: [{
    ...deepSeekSettings.providers[0],
    selectedModel: 'Qwen/Qwen3.6-35B-A3B',
  }],
};

const emptySelectedModelSettings = {
  ...deepSeekSettings,
  providers: [{
    ...deepSeekSettings.providers[0],
    selectedModel: '',
  }],
};

describe('set-ai-provider-qwen-default sync', () => {
  it('switches DeepSeek to Qwen and is idempotent on the next run', async () => {
    const { db, upsert, current } = fakeDb(deepSeekSettings);
    const messages: string[] = [];
    const logger = (message: string) => messages.push(message);

    const first = await syncSiliconFlowQwenDefault(db as never, logger);
    expect(first).toEqual({ changed: true, selectedModel: DEFAULT_SILICONFLOW_MODEL });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(current())).toContain(`"selectedModel":"${DEFAULT_SILICONFLOW_MODEL}"`);

    const second = await syncSiliconFlowQwenDefault(db as never, logger);
    expect(second).toEqual({ changed: false, selectedModel: DEFAULT_SILICONFLOW_MODEL });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(messages[1]).toContain('already');
  });

  it('leaves an already-Qwen selection untouched', async () => {
    const { db, upsert } = fakeDb(qwenSettings);

    const result = await syncSiliconFlowQwenDefault(db as never, () => undefined);
    expect(result).toEqual({ changed: false, selectedModel: 'Qwen/Qwen3.6-35B-A3B' });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('writes an empty persisted selection once and is idempotent on the next run', async () => {
    const { db, upsert, current } = fakeDb(emptySelectedModelSettings);
    const messages: string[] = [];
    const logger = (message: string) => messages.push(message);

    const first = await syncSiliconFlowQwenDefault(db as never, logger);
    expect(first).toEqual({ changed: true, selectedModel: DEFAULT_SILICONFLOW_MODEL });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(current())).toContain(`"selectedModel":"${DEFAULT_SILICONFLOW_MODEL}"`);

    const second = await syncSiliconFlowQwenDefault(db as never, logger);
    expect(second).toEqual({ changed: false, selectedModel: DEFAULT_SILICONFLOW_MODEL });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(messages[1]).toContain('already');
  });

  it('writes Qwen even when env fallback would fill a custom model', async () => {
    const { db, upsert, current } = fakeDb(emptySelectedModelSettings);
    const fallback = getDefaultAIProviderSettings({
      AI_PROVIDER: 'siliconflow',
      AI_BASE_URL: 'https://api.siliconflow.cn/v1',
      AI_MODEL: 'custom/model',
      AI_API_KEY: 'sk-test',
    } as unknown as NodeJS.ProcessEnv);

    const first = await syncSiliconFlowQwenDefault(db as never, () => undefined, fallback);
    expect(first).toEqual({ changed: true, selectedModel: 'Qwen/Qwen3.5-35B-A3B' });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(current())).toContain('"selectedModel":"Qwen/Qwen3.5-35B-A3B"');
    expect(JSON.stringify(current())).not.toContain('"selectedModel":"custom/model"');
  });

  it('writes a missing settings row once and is idempotent on the next run', async () => {
    const { db, upsert, current } = fakeDb(null);

    const first = await syncSiliconFlowQwenDefault(db as never, () => undefined);
    expect(first).toEqual({ changed: true, selectedModel: 'Qwen/Qwen3.5-35B-A3B' });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(current())).toContain('"selectedModel":"Qwen/Qwen3.5-35B-A3B"');

    const second = await syncSiliconFlowQwenDefault(db as never, () => undefined);
    expect(second).toEqual({ changed: false, selectedModel: 'Qwen/Qwen3.5-35B-A3B' });
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
