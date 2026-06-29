import { describe, expect, it } from 'vitest';

import { appendFinalCitationGuardMetadata } from '@/lib/konling-final-citation-metadata-stream';

async function readStream(stream: ReadableStream) {
  const reader = stream.getReader();
  const chunks: unknown[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
}

describe('appendFinalCitationGuardMetadata', () => {
  it('appends final citation guard metadata under the konlingCitationGuard key', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'start',
          messageMetadata: {
            konlingCitationGuard: {
              status: 'verified',
              diagnosticReasons: ['assistant-citations-unverified-stream'],
            },
          },
        });
        controller.enqueue({ type: 'text-start', id: 'text-1' });
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: '引用了课程来源' });
        controller.enqueue({ type: 'text-end', id: 'text-1' });
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    });

    const chunks = await readStream(appendFinalCitationGuardMetadata(stream, (assistantContent) => ({
      status: 'verified',
      diagnosticReasons: [],
      assistantContent,
    })));

    expect(chunks.at(-1)).toEqual({
      type: 'message-metadata',
      messageMetadata: {
        konlingCitationGuard: {
          status: 'verified',
          diagnosticReasons: [],
          assistantContent: '引用了课程来源',
        },
      },
    });
  });

  it('preserves extra final message metadata beside the citation guard', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: '解释路径建议' });
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    });

    const chunks = await readStream(appendFinalCitationGuardMetadata(
      stream,
      (assistantContent) => ({
        status: 'verified',
        assistantContent,
      }),
      {
        konlingSarAssociatedGrounding: {
          source: 'sar-association-expansion',
          seedRefs: ['knowledge-node:root-locus'],
          limitations: ['source-pack-ranking-required'],
        },
      },
    ));

    expect(chunks.at(-1)).toEqual({
      type: 'message-metadata',
      messageMetadata: {
        konlingSarAssociatedGrounding: {
          source: 'sar-association-expansion',
          seedRefs: ['knowledge-node:root-locus'],
          limitations: ['source-pack-ranking-required'],
        },
        konlingCitationGuard: {
          status: 'verified',
          assistantContent: '解释路径建议',
        },
      },
    });
  });
});
