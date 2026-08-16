/**
 * Idempotent DB sync: ensure the persisted SiliconFlow selectedModel is the
 * Qwen main model when it still points at DeepSeek or is empty.
 */
import { pathToFileURL } from 'node:url';

import { createPrismaClient } from '../../src/lib/prisma-client';
import { DEFAULT_SILICONFLOW_MODEL } from '../../src/lib/ai/provider-config';
import {
  AI_PROVIDER_SETTINGS_KEY,
  AIProviderSettingsDb,
  getDefaultAIProviderSettings,
  normalizeAIProviderSettings,
  setAIProviderSettings,
  type AIProviderSettings,
} from '../../src/lib/ai/provider-settings';

export interface SyncSiliconFlowQwenDefaultResult {
  changed: boolean;
  selectedModel: string;
}

function readRawSiliconFlowSelectedModel(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const providers = (value as Record<string, unknown>).providers;
  if (!Array.isArray(providers)) return '';
  const siliconflow = providers.find((provider) => (
    provider && typeof provider === 'object' && !Array.isArray(provider)
    && (provider as Record<string, unknown>).id === 'siliconflow'
  ));
  if (!siliconflow) return '';
  const selectedModel = (siliconflow as Record<string, unknown>).selectedModel;
  return typeof selectedModel === 'string' ? selectedModel.trim() : '';
}

export async function syncSiliconFlowQwenDefault(
  db: AIProviderSettingsDb,
  logger: (message: string) => void = (message) => console.log(message),
  fallback: AIProviderSettings = getDefaultAIProviderSettings(),
): Promise<SyncSiliconFlowQwenDefaultResult> {
  const row = await db.platformSetting.findUnique({
    where: { key: AI_PROVIDER_SETTINGS_KEY },
    select: { value: true },
  });
  const rawSelectedModel = readRawSiliconFlowSelectedModel(row?.value);
  const needsSync = rawSelectedModel === '' || rawSelectedModel === 'deepseek-ai/DeepSeek-V4-Flash';
  const current = normalizeAIProviderSettings(row?.value, fallback);
  const next = needsSync
    ? {
        ...current,
        providers: current.providers.map((provider) => (
          provider.id === 'siliconflow'
            ? { ...provider, selectedModel: DEFAULT_SILICONFLOW_MODEL }
            : provider
        )),
      }
    : current;
  const siliconflow = next.providers.find((provider) => provider.id === 'siliconflow');
  const selectedModel = siliconflow?.selectedModel ?? '';
  if (!needsSync) {
    logger(`SiliconFlow selectedModel is already ${selectedModel}.`);
    return { changed: false, selectedModel };
  }
  await setAIProviderSettings(next, db);
  logger(`Updated SiliconFlow selectedModel to ${selectedModel}.`);
  return { changed: true, selectedModel };
}

async function main() {
  const prisma = createPrismaClient();
  try {
    await syncSiliconFlowQwenDefault(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[set-ai-provider-qwen-default]', error);
    process.exitCode = 1;
  });
}
