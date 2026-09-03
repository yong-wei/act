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

    expect(notice).toContain('【控灵开发诊断｜仅排障，非学习内容】');
    expect(notice).toContain('根轨迹补救路径');
    expect(notice).toContain('learning-path');
    expect(notice).toContain('streaming-final-text-unverified');
  });

  it('keeps production streaming answers free of raw diagnostics while surfacing safe low-confidence guidance', () => {
    const notice = buildStreamingCitationFallbackNotice({
      status: 'low-confidence',
      missingCitationClasses: ['learning-path'],
      lowConfidenceReasons: ['assistant-citations-unverified-stream'],
      citations: [],
    }, {
      nodeEnv: 'production',
    });

    expect(notice).toContain('【控灵证据提示】');
    expect(notice).toContain('引用证据仍需核验');
    expect(notice).not.toContain('learning-path');
    expect(notice).not.toContain('assistant-citations-unverified-stream');
  });

  it('allows explicit production debug notice injection for support review', () => {
    const notice = buildStreamingCitationFallbackNotice({
      status: 'low-confidence',
      missingCitationClasses: ['learning-path'],
      lowConfidenceReasons: ['assistant-citations-unverified-stream'],
      citations: [],
    }, {
      nodeEnv: 'production',
      debugInjectionOverride: true,
    });

    expect(notice).toContain('【控灵开发诊断｜仅排障，非学习内容】');
    expect(notice).toContain('assistant-citations-unverified-stream');
  });

  it('injects complete development diagnostics for verified streaming replies with audit reasons', () => {
    const notice = buildStreamingCitationFallbackNotice({
      status: 'verified',
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      diagnosticReasons: ['assistant-citations-unverified-stream'],
      missingContext: ['learner-state', 'path-execution'],
      personalizationAvailability: {
        status: 'limited',
        missingCitationClasses: ['learner-state'],
        lowConfidenceReasons: ['missing-learner-state'],
      },
      retrievalSources: [{
        sourceType: 'content',
        displayTitle: 'PID 参数整定',
        evidenceBasis: 'course-ai-context',
        confidence: 'high',
      }],
      citations: [],
    }, {
      nodeEnv: 'development',
    });

    expect(notice).toContain('【控灵开发诊断｜仅排障，非学习内容】');
    expect(notice).toContain('PID 参数整定');
    expect(notice).toContain('learner-state');
    expect(notice).toContain('path-execution');
    expect(notice).toContain('assistant-citations-unverified-stream');
    expect(notice).toContain('missing-learner-state');
    expect(notice).toContain('limited');
  });

  it('allows explicit production debug injection for verified streaming diagnostics', () => {
    const notice = buildStreamingCitationFallbackNotice({
      status: 'verified',
      missingCitationClasses: [],
      lowConfidenceReasons: [],
      diagnosticReasons: ['assistant-citations-unverified-stream'],
      missingContext: ['learner-state'],
      citations: [],
    }, {
      nodeEnv: 'production',
      debugInjectionOverride: true,
    });

    expect(notice).toContain('assistant-citations-unverified-stream');
    expect(notice).toContain('learner-state');
  });

  it('labels injected diagnostics as development-mode and keeps them distinct from the student citation notice', () => {
    const guard = {
      status: 'unverified',
      missingCitationClasses: ['learner-state'],
      lowConfidenceReasons: [],
      diagnosticReasons: ['missing-learner-state', 'missing-path-execution'],
      citations: [],
    };
    const devNotice = buildStreamingCitationFallbackNotice(guard as never, { nodeEnv: 'development' });
    expect(devNotice).toContain('【控灵开发诊断｜仅排障，非学习内容】');
    expect(devNotice).toContain('missing-learner-state');
    const prodNotice = buildStreamingCitationFallbackNotice(guard as never, { nodeEnv: 'production' });
    expect(prodNotice).not.toContain('missing-learner-state');
    expect(prodNotice).toContain('【控灵证据提示】');
    expect(prodNotice).not.toContain('开发诊断');
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
