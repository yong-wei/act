import { createOpenAI } from '@ai-sdk/openai';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AIProviderConfig } from '../provider-config';
import type { AIProviderAdapter } from './types';

const execFileAsync = promisify(execFile);
const DEEPSEEK_V4_FLASH_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';
const QWEN_3_6_35B_A3B_MODEL = 'Qwen/Qwen3.6-35B-A3B';
const QWEN_3_5_35B_A3B_MODEL = 'Qwen/Qwen3.5-35B-A3B';
const QWEN_3_VL_30B_A3B_INSTRUCT_MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct';
// Leave time to persist a completed response before the grading worker's
// five-minute execution lease expires.
const SILICONFLOW_CURL_TIMEOUT_SECONDS = 210;
const SILICONFLOW_CURL_TOTAL_BUDGET_SECONDS = 270;
const SILICONFLOW_CURL_MIN_RETRY_SECONDS = 30;
const SILICONFLOW_CURL_ATTEMPTS = 3;

function normalizeSiliconFlowCompletion(rawBody: string): string {
  const data = JSON.parse(rawBody) as {
    choices?: Array<{ message?: { role?: string | null } }>;
  };
  if (!data.choices?.[0]?.message) {
    throw new Error('SiliconFlow response did not include choices[0].message.');
  }

  for (const choice of data.choices ?? []) {
    if (choice.message && !choice.message.role) {
      choice.message.role = 'assistant';
    }
  }

  return JSON.stringify(data);
}

function completionToSse(rawBody: string): string {
  const data = JSON.parse(normalizeSiliconFlowCompletion(rawBody)) as {
    id?: string;
    created?: number;
    model?: string;
    usage?: unknown;
    choices?: Array<{
      index?: number;
      finish_reason?: string | null;
      message?: { content?: string | null; tool_calls?: unknown };
    }>;
  };
  const choice = data.choices?.[0];
  const baseChunk = {
    id: data.id,
    object: 'chat.completion.chunk',
    created: data.created,
    model: data.model,
  };
  const textChunk = {
    ...baseChunk,
    choices: [
      {
        index: choice?.index ?? 0,
        delta: {
          role: 'assistant',
          content: choice?.message?.content ?? '',
          ...(choice?.message?.tool_calls ? { tool_calls: choice.message.tool_calls } : {}),
        },
        finish_reason: null,
      },
    ],
  };
  const finishChunk = {
    ...baseChunk,
    choices: [
      {
        index: choice?.index ?? 0,
        delta: {},
        finish_reason: choice?.finish_reason ?? 'stop',
      },
    ],
    usage: data.usage,
  };

  return [
    `data: ${JSON.stringify(textChunk)}\n\n`,
    `data: ${JSON.stringify(finishChunk)}\n\n`,
    'data: [DONE]\n\n',
  ].join('');
}

async function fetchDeepSeekV4Flash(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  apiKey: string
): Promise<Response> {
  if (init?.signal?.aborted) throw siliconFlowAbortError();
  const rawBody = typeof init?.body === 'string' ? init.body : undefined;
  const requestBody = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : undefined;
  const providerBody = JSON.stringify({
    ...requestBody,
    stream: false,
    stream_options: undefined,
  });
  const marker = '\n__HTTP_STATUS__:';
  let responseBody = '';
  let status = 0;
  let lastError: unknown;
  const startedAt = Date.now();
  const requestDirectory = await mkdtemp(join(tmpdir(), 'grading-lab-siliconflow-'));
  const requestFile = join(requestDirectory, 'request.json');
  await writeFile(requestFile, providerBody, 'utf8');

  try {
    for (let attempt = 1; attempt <= SILICONFLOW_CURL_ATTEMPTS; attempt += 1) {
      const elapsedSeconds = Math.ceil((Date.now() - startedAt) / 1000);
      const remainingSeconds = SILICONFLOW_CURL_TOTAL_BUDGET_SECONDS - elapsedSeconds;
      if (remainingSeconds < SILICONFLOW_CURL_MIN_RETRY_SECONDS) break;
      const requestTimeoutSeconds = Math.min(SILICONFLOW_CURL_TIMEOUT_SECONDS, remainingSeconds);
      try {
        const result = await execFileAsync('curl', [
          '-sS', '--connect-timeout', '3', '--max-time', String(requestTimeoutSeconds),
          '-H', `Authorization: Bearer ${apiKey}`, '-H', 'Content-Type: application/json',
          '--data-binary', `@${requestFile}`, '-w', `${marker}%{http_code}`, String(input),
        ], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, signal: init?.signal ?? undefined });
        const markerIndex = result.stdout.lastIndexOf(marker);
        if (markerIndex < 0) throw new Error('SiliconFlow response did not include an HTTP status marker.');
        const rawResponseBody = result.stdout.slice(0, markerIndex);
        status = Number(result.stdout.slice(markerIndex + marker.length).trim());
        responseBody = status >= 400 ? rawResponseBody : normalizeSiliconFlowCompletion(rawResponseBody);
        break;
      } catch (error) {
        if (init?.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw siliconFlowAbortError();
        lastError = error;
      }
    }
  } finally {
    await rm(requestDirectory, { recursive: true, force: true });
  }

  if (!responseBody) {
    const failureType = lastError instanceof Error && lastError.name
      ? lastError.name
      : 'UnknownError';
    const error = new Error(`SiliconFlow DeepSeek request failed after retries (${failureType}).`);
    Object.assign(error, { retryable: true, code: 'siliconflow-request-failed-after-retries' });
    throw error;
  }

  const isStreamRequest = requestBody?.stream === true;
  if (status >= 400 || !isStreamRequest) {
    return new Response(responseBody, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(completionToSse(responseBody), {
    status,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
}

function siliconFlowAbortError(): Error {
  const error = new Error('SiliconFlow DeepSeek request was aborted.');
  error.name = 'AbortError';
  return error;
}

function prepareSiliconFlowRequestBody(
  requestBody: Record<string, unknown>,
  config: AIProviderConfig
): Record<string, unknown> {
  const { stream_options: _streamOptions, ...providerBody } = requestBody;

  if (providerBody.model === QWEN_3_5_35B_A3B_MODEL) {
    const qwen35Body = withQwen35JsonObjectFallback(providerBody);
    return {
      ...qwen35Body,
      enable_thinking: false,
    };
  }

  if (providerBody.model === QWEN_3_VL_30B_A3B_INSTRUCT_MODEL) {
    return withQwen35JsonObjectFallback(providerBody);
  }

  if (providerBody.model === QWEN_3_6_35B_A3B_MODEL) {
    return {
      ...providerBody,
      enable_thinking: config.modelOptions?.enableThinking ?? false,
    };
  }

  return providerBody;
}

function withQwen35JsonObjectFallback(providerBody: Record<string, unknown>): Record<string, unknown> {
  const schema = readJsonSchema(providerBody.response_format);
  if (!schema) return providerBody;
  const messages = Array.isArray(providerBody.messages) ? providerBody.messages : [];
  return {
    ...providerBody,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Return only a JSON object that validates against this JSON Schema: ${JSON.stringify(schema)}`,
      },
      ...messages,
    ],
  };
}

function readJsonSchema(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null;
  const responseFormat = value as Record<string, unknown>;
  if (responseFormat.type !== 'json_schema' || typeof responseFormat.json_schema !== 'object' || responseFormat.json_schema === null) {
    return null;
  }
  const schema = (responseFormat.json_schema as Record<string, unknown>).schema;
  return typeof schema === 'object' && schema !== null && !Array.isArray(schema)
    ? schema as Record<string, unknown>
    : null;
}

export function createSiliconFlowAdapter(config: AIProviderConfig): AIProviderAdapter {
  const siliconflow = createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    name: 'siliconflow',
    fetch: async (input, init) => {
      const rawBody = typeof init?.body === 'string' ? init.body : undefined;
      const requestBody = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : undefined;
      if (requestBody?.model !== DEEPSEEK_V4_FLASH_MODEL) {
        return globalThis.fetch(input, {
          ...init,
          body: requestBody ? JSON.stringify(prepareSiliconFlowRequestBody(requestBody, config)) : init?.body,
        });
      }

      return fetchDeepSeekV4Flash(input, init, config.apiKey);
    },
  });

  return {
    id: 'siliconflow',
    config,
    getModel(modelId?: string) {
      return siliconflow.chat(modelId || config.model);
    },
  };
}
