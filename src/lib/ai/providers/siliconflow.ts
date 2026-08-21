import { createOpenAI } from '@ai-sdk/openai';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AIProviderConfig } from '../provider-config';
import type { AIProviderAdapter } from './types';

const execFileAsync = promisify(execFile);
const DEEPSEEK_V4_FLASH_MODEL = 'deepseek-ai/DeepSeek-V4-Flash';
const QWEN_3_5_35B_A3B_MODEL = 'Qwen/Qwen3.5-35B-A3B';
const QWEN_3_6_35B_A3B_MODEL = 'Qwen/Qwen3.6-35B-A3B';
const QWEN_MAIN_MODELS = new Set([
  QWEN_3_5_35B_A3B_MODEL,
  QWEN_3_6_35B_A3B_MODEL,
]);
const SILICONFLOW_CURL_TIMEOUT_SECONDS = 240;
const SILICONFLOW_CURL_TOTAL_BUDGET_SECONDS = 300;
const SILICONFLOW_CURL_MIN_RETRY_SECONDS = 60;
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

  for (let attempt = 1; attempt <= SILICONFLOW_CURL_ATTEMPTS; attempt += 1) {
    const elapsedSeconds = Math.ceil((Date.now() - startedAt) / 1000);
    const remainingSeconds = SILICONFLOW_CURL_TOTAL_BUDGET_SECONDS - elapsedSeconds;
    if (remainingSeconds < SILICONFLOW_CURL_MIN_RETRY_SECONDS) {
      break;
    }
    const requestTimeoutSeconds = Math.min(SILICONFLOW_CURL_TIMEOUT_SECONDS, remainingSeconds);
    try {
      const result = await execFileAsync(
        'curl',
        [
          '-sS',
          '--connect-timeout',
          '3',
          '--max-time',
          String(requestTimeoutSeconds),
          '-H',
          `Authorization: Bearer ${apiKey}`,
          '-H',
          'Content-Type: application/json',
          '--data-binary',
          providerBody,
          '-w',
          `${marker}%{http_code}`,
          String(input),
        ],
        {
          encoding: 'utf8',
          maxBuffer: 4 * 1024 * 1024,
          signal: init?.signal ?? undefined,
        }
      );
      const markerIndex = result.stdout.lastIndexOf(marker);
      if (markerIndex < 0) {
        throw new Error('SiliconFlow response did not include an HTTP status marker.');
      }

      const rawResponseBody = result.stdout.slice(0, markerIndex);
      status = Number(result.stdout.slice(markerIndex + marker.length).trim());
      responseBody = status >= 400 ? rawResponseBody : normalizeSiliconFlowCompletion(rawResponseBody);
      break;
    } catch (error) {
      if (init?.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw siliconFlowAbortError();
      }
      lastError = error;
    }
  }

  if (!responseBody) {
    const failureType = lastError instanceof Error && lastError.name
      ? lastError.name
      : 'UnknownError';
    throw new Error(`SiliconFlow DeepSeek request failed after retries (${failureType}).`);
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

  if (typeof providerBody.model === 'string' && QWEN_MAIN_MODELS.has(providerBody.model)) {
    return {
      ...providerBody,
      enable_thinking: config.modelOptions?.enableThinking ?? false,
    };
  }

  return providerBody;
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
