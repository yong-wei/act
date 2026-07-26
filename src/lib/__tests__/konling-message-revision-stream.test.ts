import { describe, expect, it } from 'vitest';

import {
  applyKonlingMessageRevision,
  applyKonlingOptimizationStatus,
  createKonlingMessageRevisionStream,
} from '@/lib/konling-message-revision-stream';
import type { KonlingUIMessage } from '@/types/ai-message';

async function readChunks(stream: ReadableStream<any>): Promise<any[]> {
  const chunks: any[] = [];
  const reader = stream.getReader();
  while (true) {
    const next = await reader.read();
    if (next.done) return chunks;
    chunks.push(next.value);
  }
}

describe('Konling message revision reducer', () => {
  it('atomically replaces body and metadata only for a higher revision', () => {
    const message: KonlingUIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      metadata: {
        konlingMessageRevision: { revision: 2 },
        konlingCitationGuard: { status: 'low-confidence' },
      },
      parts: [{ type: 'text', text: '旧正文' }],
    };
    const lower = applyKonlingMessageRevision([message], {
      messageId: 'assistant-1',
      revision: 1,
      body: '不应显示',
      citations: [],
      status: 'verified',
      userNotice: null,
      metadata: { konlingCitationGuard: { status: 'verified' } },
    });
    expect(lower[0]).toBe(message);

    const higher = applyKonlingMessageRevision([message], {
      messageId: 'assistant-1',
      revision: 3,
      body: '最终正文 [1]',
      citations: [],
      status: 'partial',
      userNotice: '部分引用未能核验',
      metadata: { konlingCitationGuard: { status: 'low-confidence' } },
    });
    expect(higher[0]?.parts).toEqual([{ type: 'text', text: '最终正文 [1]' }]);
    expect(higher[0]?.metadata).toMatchObject({
      konlingMessageRevision: {
        revision: 3,
        status: 'partial',
        userNotice: '部分引用未能核验',
      },
      konlingCitationGuard: { status: 'low-confidence' },
    });
  });

  it('keeps one message id through pending, revision 1, revision 2, and completion', async () => {
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-1' });
        controller.enqueue({ type: 'text-delta', delta: '首轮回答' });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    const stream = createKonlingMessageRevisionStream({
      stream: source,
      hasPendingOptimization: () => true,
      finalize: async () => ({
        body: '首轮回答',
        citations: [],
        status: 'verified',
        userNotice: null,
        metadata: {},
      }),
      finalizeOptimization: async ({ messageId }) => ({
        messageId,
        revision: 2,
        body: '优化回答',
        citations: [],
        status: 'verified',
        userNotice: null,
        metadata: {},
      }),
    });
    const chunks = await readChunks(stream);
    expect(chunks.filter((chunk) =>
      chunk.type === 'data-konling-message-revision').map((chunk) => [
        chunk.data.messageId,
        chunk.data.revision,
      ])).toEqual([
      ['assistant-1', 1],
      ['assistant-1', 2],
    ]);
    expect(chunks.filter((chunk) =>
      chunk.type === 'data-konling-optimization-status').map((chunk) =>
        chunk.data.active)).toEqual([true, false]);
  });

  it('does not emit revision 2 when the persistence CAS gate rejects it', async () => {
    const source = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-1' });
        controller.enqueue({ type: 'text-delta', delta: '保留回答' });
        controller.enqueue({ type: 'finish' });
        controller.close();
      },
    });
    const stream = createKonlingMessageRevisionStream({
      stream: source,
      hasPendingOptimization: () => true,
      finalize: async () => ({
        body: '保留回答',
        citations: [],
        status: 'verified',
        userNotice: null,
        metadata: {},
      }),
      finalizeOptimization: async () => null,
    });
    const chunks = await readChunks(stream);
    expect(chunks.filter((chunk) =>
      chunk.type === 'data-konling-message-revision')).toHaveLength(1);
    expect(chunks.at(-1)).toMatchObject({
      type: 'data-konling-optimization-status',
      data: { active: false },
    });
  });

  it('keeps optimization status transient in the client-only message metadata', () => {
    const message: KonlingUIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: '回答' }],
    };
    const active = applyKonlingOptimizationStatus([message], {
      messageId: 'assistant-1',
      active: true,
    });
    expect(active[0].metadata).toMatchObject({
      konlingOptimizationActive: true,
    });
    const completed = applyKonlingOptimizationStatus(active, {
      messageId: 'assistant-1',
      active: false,
    });
    expect(completed[0].metadata).toMatchObject({
      konlingOptimizationActive: false,
    });
  });
});
