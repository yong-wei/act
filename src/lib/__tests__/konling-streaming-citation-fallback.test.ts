import { describe, expect, it } from 'vitest';

import {
  buildStreamingCitationFallbackNotice,
  insertStreamingCitationFallbackNotice,
} from '@/lib/konling-streaming-citation-fallback';

async function readChunks(stream: ReadableStream<any>) {
  const reader = stream.getReader();
  const chunks: any[] = [];
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    chunks.push(result.value);
  }
  return chunks;
}

describe('Konling streaming citation fallback', () => {
  it('builds a student-visible citation fallback notice for unverified streaming replies', () => {
    const notice = buildStreamingCitationFallbackNotice({
      status: 'low-confidence',
      missingCitationClasses: ['learning-path'],
      lowConfidenceReasons: ['streaming-final-text-unverified'],
      citations: [{
        id: 'path:node-1',
        displayTitle: '根轨迹补救路径',
        evidenceBasis: 'active learning path',
      }],
    });

    expect(notice).toContain('【控灵证据提示】');
    expect(notice).toContain('根轨迹补救路径');
    expect(notice).toContain('learning-path');
    expect(notice).toContain('streaming-final-text-unverified');
  });

  it('injects the fallback as text-delta content after the stream start chunk', async () => {
    const source = new ReadableStream<any>({
      start(controller) {
        controller.enqueue({ type: 'start', messageId: 'assistant-1' });
        controller.enqueue({ type: 'text-start', id: 'answer' });
        controller.enqueue({ type: 'text-delta', id: 'answer', delta: '原始回答' });
        controller.enqueue({ type: 'text-end', id: 'answer' });
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    });

    const chunks = await readChunks(insertStreamingCitationFallbackNotice(source, '【控灵证据提示】引用不足\n\n'));

    expect(chunks[0]).toEqual({ type: 'start', messageId: 'assistant-1' });
    expect(chunks[1]).toEqual({ type: 'text-start', id: 'konling-citation-fallback' });
    expect(chunks[2]).toEqual({
      type: 'text-delta',
      id: 'konling-citation-fallback',
      delta: '【控灵证据提示】引用不足\n\n',
    });
    expect(chunks.map((chunk) => chunk.delta).filter(Boolean).join('')).toContain('【控灵证据提示】引用不足');
    expect(chunks.map((chunk) => chunk.delta).filter(Boolean).join('')).toContain('原始回答');
  });
});
