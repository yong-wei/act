/**
 * Idempotent DB sync: ensure the persisted SiliconFlow selectedModel is the
 * Qwen main model when it still points at DeepSeek or is empty.
 */
import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  AI_PROVIDER_SETTINGS_KEY,
  AIProviderSettingsDb,
  getDefaultAIProviderSettings,
  normalizeAIProviderSettings,
  setAIProviderSettings,
  withSiliconFlowQwenDefault,
} from '../../src/lib/ai/provider-settings';

export interface SyncSiliconFlowQwenDefaultResult {
  changed: boolean;
  selectedModel: string;
}

export async function syncSiliconFlowQwenDefault(
  db: AIProviderSettingsDb,
  logger: (message: string) => void = (message) => console.log(message),
): Promise<SyncSiliconFlowQwenDefaultResult> {
  const row = await db.platformSetting.findUnique({
    where: { key: AI_PROVIDER_SETTINGS_KEY },
    select: { value: true },
  });
  const current = normalizeAIProviderSettings(row?.value, getDefaultAIProviderSettings());
  const next = withSiliconFlowQwenDefault(current);
  const siliconflow = next.providers.find((provider) => provider.id === 'siliconflow');
  const selectedModel = siliconflow?.selectedModel ?? '';
  if (JSON.stringify(next) === JSON.stringify(current)) {
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

main().catch((error) => {
  console.error('[set-ai-provider-qwen-default]', error);
  process.exitCode = 1;
});
