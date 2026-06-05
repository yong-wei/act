import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { requireAdminSession } from '@/lib/admin';
import { redactProviderError } from '@/lib/ai/model-provider-compatibility';
import { createAIProviderFromConfig } from '@/lib/ai/provider-registry';
import {
  AI_MODEL_TEST_PROMPT,
  AIProviderCapabilityUnavailableError,
  resolveConfiguredAIProviderConfig,
} from '@/lib/ai/provider-settings';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

interface TestPayload {
  providerId?: string;
  model?: string;
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as TestPayload | null;
  const providerId = typeof payload?.providerId === 'string' ? payload.providerId.trim() : undefined;
  const model = typeof payload?.model === 'string' ? payload.model.trim() : undefined;
  if (!providerId || !model) {
    return NextResponse.json({ error: 'Missing providerId or model' }, { status: 400 });
  }

  try {
    const config = await resolveConfiguredAIProviderConfig(providerId, model);
    if (config.authMode !== 'none' && !config.apiKey.trim()) {
      return NextResponse.json({ error: 'AI API key is not configured' }, { status: 503 });
    }

    const startedAt = Date.now();
    const result = await generateText({
      model: createAIProviderFromConfig(config).getModel(config.model),
      prompt: AI_MODEL_TEST_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 800,
    });
    const elapsedMs = Date.now() - startedAt;
    const text = result.text.trim();

    return NextResponse.json({
      ok: text.length > 0,
      providerId,
      model,
      elapsedMs,
      chars: text.length,
      text,
      finishReason: result.finishReason,
      usage: result.usage,
    });
  } catch (error) {
    const status = error instanceof AIProviderCapabilityUnavailableError ? error.status : 500;
    return NextResponse.json(
      {
        ok: false,
        providerId,
        model,
        error: redactProviderError(error),
      },
      { status }
    );
  }
}
