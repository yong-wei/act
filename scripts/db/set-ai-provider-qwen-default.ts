/**
 * Idempotent DB sync: ensure the persisted SiliconFlow selectedModel is the
 * Qwen main model when it still points at DeepSeek or is empty.
 */
import { createPrismaClient } from '../../src/lib/prisma-client';
import {
  AI_PROVIDER_SETTINGS_KEY,
  getDefaultAIProviderSettings,
  normalizeAIProviderSettings,
  setAIProviderSettings,
  withSiliconFlowQwenDefault,
} from '../../src/lib/ai/provider-settings';

async function main() {
  const prisma = createPrismaClient();
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: AI_PROVIDER_SETTINGS_KEY },
      select: { value: true },
    });
    const current = normalizeAIProviderSettings(row?.value, getDefaultAIProviderSettings());
    const next = withSiliconFlowQwenDefault(current);
    if (JSON.stringify(next) === JSON.stringify(current)) {
      console.log('SiliconFlow selectedModel is already Qwen/Qwen3.6-35B-A3B.');
      return;
    }
    await setAIProviderSettings(next, prisma);
    const siliconflow = next.providers.find((provider) => provider.id === 'siliconflow');
    console.log(`Updated SiliconFlow selectedModel to ${siliconflow?.selectedModel ?? 'unknown'}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[set-ai-provider-qwen-default]', error);
  process.exitCode = 1;
});
