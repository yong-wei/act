import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KonlingChatFailureError,
  classifyKonlingChatFailure,
  createKonlingSafeFetch,
  normalizeKonlingChatFailure,
} from '@/lib/konling-chat-failure';

const CANARY_BODY = 'INTERNAL-STACK-CANARY-应该永不出现';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('konling chat failure classification', () => {
  it('classifies allowlisted codes ahead of status', () => {
    expect(classifyKonlingChatFailure(503, JSON.stringify({ error: 'AI_SERVICE_UNAVAILABLE' })))
      .toBe('service-unavailable');
    expect(classifyKonlingChatFailure(400, JSON.stringify({ error: 'INVALID_AI_TASK_CONTEXT' })))
      .toBe('task-context-invalid');
    expect(classifyKonlingChatFailure(409, JSON.stringify({ error: 'INTERACTIVE_AI_RESOURCE_MISMATCH' })))
      .toBe('task-context-invalid');
  });

  it('falls back to HTTP status for legacy or unknown payloads', () => {
    expect(classifyKonlingChatFailure(401, JSON.stringify({ error: '未授权' }))).toBe('auth-required');
    expect(classifyKonlingChatFailure(404, JSON.stringify({ error: 'Conversation not found' })))
      .toBe('conversation-missing');
    expect(classifyKonlingChatFailure(400, 'Missing messages')).toBe('task-context-invalid');
    expect(classifyKonlingChatFailure(429, '')).toBe('rate-limited');
    expect(classifyKonlingChatFailure(500, 'Internal Server Error')).toBe('service-unavailable');
  });

  it('fails closed for unclassifiable responses', () => {
    expect(classifyKonlingChatFailure(null, '')).toBe('unknown');
    expect(classifyKonlingChatFailure(200, JSON.stringify({ error: `BRAND_NEW_CODE_${CANARY_BODY}` })))
      .toBe('unknown');
  });

  it('keeps browser and SDK exception text out of student copy', () => {
    const network = normalizeKonlingChatFailure(new TypeError('Failed to fetch'));
    expect(network.category).toBe('network-unavailable');
    expect(network.message).toBe('网络连接不可用，请检查网络后重试。');

    const sdkBody = new Error(`{"error":"AI_SERVICE_UNAVAILABLE","trace":"${CANARY_BODY}"}`);
    const service = normalizeKonlingChatFailure(sdkBody);
    expect(service.category).toBe('service-unavailable');
    expect(service.message).toBe('智能助手暂时无法完成请求，请稍后再试。');
    expect(service.message).not.toContain(CANARY_BODY);

    const legacy = normalizeKonlingChatFailure(new Error('Conversation not found'));
    expect(legacy.category).toBe('conversation-missing');

    const unknown = normalizeKonlingChatFailure(new Error(CANARY_BODY));
    expect(unknown.category).toBe('unknown');
    expect(unknown.message).toBe('智能助手暂时无法完成请求，请稍后再试。');
    expect(unknown.message).not.toContain(CANARY_BODY);
  });

  it('round-trips KonlingChatFailureError without raw text', () => {
    const error = new KonlingChatFailureError('auth-required');
    expect(error.message).toBe('登录状态已失效，请重新登录后再继续。');
    expect(normalizeKonlingChatFailure(error)).toEqual({
      category: 'auth-required',
      message: error.message,
    });
  });
});

describe('createKonlingSafeFetch', () => {
  const nativeFetch = globalThis.fetch;
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = nativeFetch;
  });

  it('throws a student-safe failure for non-2xx JSON responses', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(503, {
      error: 'AI_SERVICE_UNAVAILABLE',
      message: '智能助手暂时无法连接外部模型，请稍后再试。',
    })) as unknown as typeof fetch;

    const safeFetch = createKonlingSafeFetch();
    const rejection = await safeFetch('https://act.example/api/ai/chat', { method: 'POST' })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(KonlingChatFailureError);
    expect(normalizeKonlingChatFailure(rejection)).toEqual({
      category: 'service-unavailable',
      message: '智能助手暂时无法完成请求，请稍后再试。',
    });
    expect((rejection as Error).message).not.toContain('AI_SERVICE_UNAVAILABLE');
  });

  it('throws a network failure when fetch rejects before a response', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    const safeFetch = createKonlingSafeFetch();
    const rejection = await safeFetch('https://act.example/api/ai/chat', { method: 'POST' })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(normalizeKonlingChatFailure(rejection).category).toBe('network-unavailable');
    expect((rejection as Error).message).toBe('网络连接不可用，请检查网络后重试。');
  });

  it('still forwards responses to onResponse and passes 2xx through', async () => {
    const ok = jsonResponse(200, { ok: true });
    globalThis.fetch = vi.fn(async () => ok) as unknown as typeof fetch;
    const onResponse = vi.fn();

    const result = await createKonlingSafeFetch(onResponse)('https://act.example/api/ai/chat');

    expect(result.status).toBe(200);
    expect(onResponse).toHaveBeenCalledTimes(1);
  });
});
