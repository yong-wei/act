import { describe, expect, it } from 'vitest';
import {
  extractAITextFromStreamLine,
  readAITextStream,
} from '@/lib/ai/stream-compat';

describe('AI stream compatibility helpers', () => {
  it('extracts legacy AI SDK data-stream text lines', () => {
    expect(extractAITextFromStreamLine('0:"hello"')).toBe('hello');
  });

  it('extracts AI SDK v6 UI message text deltas', () => {
    expect(
      extractAITextFromStreamLine(
        'data: {"type":"text-delta","id":"text-1","delta":"hello"}'
      )
    ).toBe('hello');
  });

  it('ignores non-text UI message stream control events', () => {
    expect(
      extractAITextFromStreamLine('data: {"type":"text-start","id":"text-1"}')
    ).toBe('');
    expect(extractAITextFromStreamLine('data: [DONE]')).toBe('');
  });

  it('preserves existing content and text object compatibility', () => {
    expect(extractAITextFromStreamLine('data: {"content":"hello"}')).toBe(
      'hello'
    );
    expect(extractAITextFromStreamLine('data: {"text":"world"}')).toBe('world');
  });

  it('reads split stream lines without losing text', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"text-delta","id":"text-1"')
        );
        controller.enqueue(encoder.encode(',"delta":"he"}\n'));
        controller.enqueue(encoder.encode('0:"llo"\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n'));
        controller.close();
      },
    });

    const chunks: string[] = [];
    await expect(
      readAITextStream(new Response(stream), (text) => chunks.push(text))
    ).resolves.toBe('hello');
    expect(chunks).toEqual(['he', 'llo']);
  });
});
