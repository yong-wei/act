import { describe, expect, it, vi } from 'vitest';

const retrievalMocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/source-pack/textbook-v2-adapter', () => ({
  retrieveTextbookSourcePackV2: retrievalMocks.retrieve,
}));
vi.mock('@/lib/structured-textbook-runtime', () => ({
  STRUCTURED_TEXTBOOK_TITLES: { 'book-1': '自动控制原理' },
  loadAllStructuredTextbookBooks: vi.fn(async () => [{
    manifest: { bookId: 'book-1', edition: '8' },
    units: [
      { id: 'chapter-1', bookId: 'book-1', kind: 'chapter', structuralPath: ['chapter-1'] },
      { id: 'section-1', bookId: 'book-1', kind: 'section', structuralPath: ['chapter-1', 'section-1'] },
      { id: 'example-1', bookId: 'book-1', kind: 'example', structuralPath: ['chapter-1', 'section-1', 'example-1'] },
      { id: 'section-2', bookId: 'book-1', kind: 'section', structuralPath: ['chapter-1', 'section-2'] },
    ],
  }]),
}));

import { retrieveConfirmedTextbookBindings } from '../textbook-resource-pack';

describe('confirmed textbook resource-pack retrieval', () => {
  it('passes the confirmed structural range into retrieval before topK selection', async () => {
    retrievalMocks.retrieve.mockResolvedValue({
      mode: 'lexical-vector',
      limitations: [],
      diagnostics: [],
      candidates: [{
        displayNumber: 1,
        title: '单位阶跃响应',
        text: '一阶系统单位阶跃响应为指数形式。',
        identity: {
          kind: 'unit',
          unitId: 'section-1',
          fragmentId: null,
          bookId: 'book-1',
          edition: '8',
          sourceRevision: 'revision-1',
          structuralPath: ['chapter-1', 'section-1'],
        },
        href: '/textbooks/book-1/8/chapter-1/section-1',
        priority: 1,
        limitation: null,
      }],
    });

    await expect(retrieveConfirmedTextbookBindings('单位阶跃响应', [{
      bookId: 'book-1',
      level: 'SECTION',
      unitId: 'section-1',
      structuralPath: ['chapter-1', 'section-1'],
    }])).resolves.toEqual([
      expect.objectContaining({
        sourceKind: 'textbook',
        anchor: 'section-1',
        snippet: '一阶系统单位阶跃响应为指数形式。',
      }),
    ]);

    expect(retrievalMocks.retrieve).toHaveBeenCalledWith(expect.objectContaining({
      query: '单位阶跃响应',
      topK: 8,
      scope: [{
        bookId: 'book-1',
        unitIds: ['section-1', 'example-1'],
      }],
    }));
  });
});
