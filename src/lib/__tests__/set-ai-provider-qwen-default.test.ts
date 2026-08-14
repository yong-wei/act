import { describe, expect, it, vi } from 'vitest';

import { AI_PROVIDER_SETTINGS_KEY } from '@/lib/ai/provider-settings';
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

describe('set-ai-provider-qwen-default sync', () => {
  it('switches DeepSeek to Qwen and is idempotent on the next run', async () => {
    const { db, upsert, current } = fakeDb(deepSeekSettings);
    const messages: string[] = [];
    const logger = (message: string) => messages.push(message);

    const first = await syncSiliconFlowQwenDefault(db as never, logger);
    expect(first).toEqual({ changed: true, selectedModel: 'Qwen/Qwen3.6-35B-A3B' });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(current())).toContain('"selectedModel":"Qwen/Qwen3.6-35B-A3B"');

    const second = await syncSiliconFlowQwenDefault(db as never, logger);
    expect(second).toEqual({ changed: false, selectedModel: 'Qwen/Qwen3.6-35B-A3B' });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(messages[1]).toContain('already');
  });

  it('leaves an already-Qwen selection untouched', async () => {
    const { db, upsert } = fakeDb(qwenSettings);

    const result = await syncSiliconFlowQwenDefault(db as never, () => undefined);
    expect(result).toEqual({ changed: false, selectedModel: 'Qwen/Qwen3.6-35B-A3B' });
    expect(upsert).not.toHaveBeenCalled();
  });
});
