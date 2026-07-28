import {
  TextbookRetrievalProviderError,
} from './errors';
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  RerankRequest,
  RerankResponse,
  TextbookEmbeddingClient,
  TextbookRerankClient,
} from './types';

const DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1';
const SAFE_TRACE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;

function endpoint(path: string): string {
  const base = process.env.SILICONFLOW_API_URL?.trim() || DEFAULT_BASE_URL;
  return `${base.replace(/\/+$/u, '')}/${path}`;
}

function apiKey(stage: 'embedding' | 'rerank'): string {
  const value = process.env.SILICONFLOW_API_KEY?.trim();
  if (!value) {
    throw new TextbookRetrievalProviderError(stage, 'provider-unavailable');
  }
  return value;
}

function traceId(response: Response): string | undefined {
  const siliconFlowTraceId = response.headers.get('x-siliconcloud-trace-id');
  if (siliconFlowTraceId !== null) {
    return SAFE_TRACE_ID.test(siliconFlowTraceId) ? siliconFlowTraceId : undefined;
  }
  const fallbackTraceId = response.headers.get('x-request-id')
    ?? response.headers.get('x-trace-id');
  return fallbackTraceId && SAFE_TRACE_ID.test(fallbackTraceId)
    ? fallbackTraceId
    : undefined;
}

async function parseJson(
  response: Response,
  stage: 'embedding' | 'rerank',
): Promise<{ value: unknown; traceId?: string }> {
  const requestTraceId = traceId(response);
  if (!response.ok) {
    throw new TextbookRetrievalProviderError(stage, 'http-error', requestTraceId);
  }
  try {
    return { value: await response.json(), traceId: requestTraceId };
  } catch {
    throw new TextbookRetrievalProviderError(
      stage,
      'invalid-response',
      requestTraceId,
    );
  }
}

export class SiliconFlowTextbookEmbeddingClient implements TextbookEmbeddingClient {
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    let response: Response;
    try {
      response = await fetch(endpoint('embeddings'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey('embedding')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          input: request.input,
        }),
        signal: request.signal,
      });
    } catch (error) {
      if (request.signal.aborted) {
        throw new TextbookRetrievalProviderError('embedding', 'timeout');
      }
      if (error instanceof TextbookRetrievalProviderError) throw error;
      throw new TextbookRetrievalProviderError('embedding', 'http-error');
    }

    const parsed = await parseJson(response, 'embedding');
    const body = parsed.value;
    if (
      typeof body !== 'object'
      || body === null
      || !Array.isArray((body as { data?: unknown }).data)
      || (body as { data: unknown[] }).data.length !== 1
    ) {
      throw new TextbookRetrievalProviderError(
        'embedding',
        'invalid-response',
        parsed.traceId,
      );
    }
    const row = (body as { data: unknown[] }).data[0];
    if (
      typeof row !== 'object'
      || row === null
      || !Array.isArray((row as { embedding?: unknown }).embedding)
    ) {
      throw new TextbookRetrievalProviderError(
        'embedding',
        'invalid-response',
        parsed.traceId,
      );
    }
    const model = (body as { model?: unknown }).model;
    return {
      embedding: (row as { embedding: number[] }).embedding,
      model: typeof model === 'string' ? model : undefined,
      traceId: parsed.traceId,
    };
  }
}

export class SiliconFlowTextbookRerankClient implements TextbookRerankClient {
  async rerank(request: RerankRequest): Promise<RerankResponse> {
    let response: Response;
    try {
      response = await fetch(endpoint('rerank'), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey('rerank')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          query: request.query,
          documents: request.documents.map((document) => document.text),
        }),
        signal: request.signal,
      });
    } catch (error) {
      if (request.signal.aborted) {
        throw new TextbookRetrievalProviderError('rerank', 'timeout');
      }
      if (error instanceof TextbookRetrievalProviderError) throw error;
      throw new TextbookRetrievalProviderError('rerank', 'http-error');
    }

    const parsed = await parseJson(response, 'rerank');
    const body = parsed.value;
    const rows = typeof body === 'object' && body !== null
      ? (body as { results?: unknown }).results
      : undefined;
    if (!Array.isArray(rows)) {
      throw new TextbookRetrievalProviderError(
        'rerank',
        'invalid-response',
        parsed.traceId,
      );
    }
    return {
      results: rows.map((row) => {
        if (
          typeof row !== 'object'
          || row === null
          || typeof (row as { index?: unknown }).index !== 'number'
          || typeof (row as { relevance_score?: unknown }).relevance_score !== 'number'
        ) {
          throw new TextbookRetrievalProviderError(
            'rerank',
            'invalid-response',
            parsed.traceId,
          );
        }
        return {
          index: (row as { index: number }).index,
          score: (row as { relevance_score: number }).relevance_score,
        };
      }),
      traceId: parsed.traceId,
    };
  }
}
