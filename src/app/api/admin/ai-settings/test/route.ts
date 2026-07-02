import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { requireAdminSession } from '@/lib/admin';
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
} from '@/lib/admin-operation-ledger';
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime';
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

  const operationStartedAt = new Date().toISOString();
  const idempotencyKey = buildAdminOperationIdempotencyKey([
    'admin-config-model-test',
    providerId,
    model,
    session.user.id,
  ]);
  try {
    const config = await resolveConfiguredAIProviderConfig(providerId, model);
    if (config.authMode !== 'none' && !config.apiKey.trim()) {
      const completedAt = new Date().toISOString();
      const operationLedger = buildAdminOperationLedgerEntry({
        kind: 'admin-config-model-test',
        actorId: session.user.id,
        actorRole: session.user.role,
        scope: `admin-config-model-test:${providerId}:${model}`,
        startedAt: operationStartedAt,
        completedAt,
        outcome: 'failed',
        idempotencyKey,
        rollback: {
          available: false,
          rationale: '模型测试不修改系统状态，无需回滚。',
        },
        auditSummary: `模型测试失败：provider=${providerId}，model=${model}，missingApiKey=true。`,
        recoveryState: {
          status: 'retry',
          action: '配置供应商 API key 后重试',
        },
      });
      await persistAdminOperationLedger(operationLedger);
      return NextResponse.json(
        {
          ok: false,
          providerId,
          model,
          operationLedger,
          error: 'AI API key is not configured',
        },
        {
          status: 503,
          headers: operationLedgerHeaders(operationLedger),
        },
      );
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
    const completedAt = new Date().toISOString();
    const operationLedger = buildAdminOperationLedgerEntry({
      kind: 'admin-config-model-test',
      actorId: session.user.id,
      actorRole: session.user.role,
      scope: `admin-config-model-test:${providerId}:${model}`,
      startedAt: operationStartedAt,
      completedAt,
      outcome: text.length > 0 ? 'completed' : 'completed-with-errors',
      idempotencyKey,
      rollback: {
        available: false,
        rationale: '模型测试不修改系统状态，无需回滚。',
      },
      auditSummary: `模型测试完成：provider=${providerId}，model=${model}，elapsedMs=${elapsedMs}。`,
      recoveryState: {
        status: text.length > 0 ? 'available' : 'retry',
        action: text.length > 0 ? '保存供应商配置或继续测试其他模型' : '检查模型输出后重试',
      },
    });
    await persistAdminOperationLedger(operationLedger);

    return NextResponse.json({
      ok: text.length > 0,
      providerId,
      model,
      operationLedger,
      elapsedMs,
      chars: text.length,
      text,
      finishReason: result.finishReason,
      usage: result.usage,
    }, {
      headers: operationLedgerHeaders(operationLedger),
    });
  } catch (error) {
    const status = error instanceof AIProviderCapabilityUnavailableError ? error.status : 500;
    const completedAt = new Date().toISOString();
    const operationLedger = buildAdminOperationLedgerEntry({
      kind: 'admin-config-model-test',
      actorId: session.user.id,
      actorRole: session.user.role,
      scope: `admin-config-model-test:${providerId}:${model}`,
      startedAt: operationStartedAt,
      completedAt,
      outcome: 'failed',
      idempotencyKey,
      rollback: {
        available: false,
        rationale: '模型测试不修改系统状态，无需回滚。',
      },
      auditSummary: `模型测试失败：provider=${providerId}，model=${model}。`,
      recoveryState: {
        status: 'retry',
        action: '检查密钥、模型 ID 和供应商能力后重试',
      },
    });
    await persistAdminOperationLedger(operationLedger);
    return NextResponse.json(
      {
        ok: false,
        providerId,
        model,
        operationLedger,
        error: redactProviderError(error),
      },
      {
        status,
        headers: operationLedgerHeaders(operationLedger),
      }
    );
  }
}
