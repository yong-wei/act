import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  retrieveTextbookSourcePackV2,
  retrieveTextbookSourcePackV2Progressive,
} from '@/lib/source-pack/textbook-v2-adapter';
import type { TextbookCitationUnit } from '@/lib/textbook-reader';
import type {
  LoadedTextbookRetrievalIndex,
  TextbookRetrievalResponse,
} from '@/lib/textbook-retrieval';

const units: TextbookCitationUnit[] = [
  {
    id: 'textbook-unit:hu8/direct',
    bookId: 'hu-shousong-auto-control-8th',
    edition: '第八版',
    sourceRevision: 'revision-hu8',
    title: '单位阶跃响应',
    kind: 'section',
    naturalNumber: '3.2',
    structuralPath: ['chapter-3', 'section-3.2'],
    markdown: '一阶系统单位阶跃响应为指数形式。',
    fragments: [{
      id: 'formula-3.2-1',
      kind: 'formula',
      naturalNumber: '3.2',
      ordinal: 1,
    }],
  },
  {
    id: 'textbook-unit:dorf/direct',
    bookId: 'dorf-modern-control-systems',
    edition: '14th Global Edition',
    sourceRevision: 'revision-dorf',
    title: 'Unit-step response',
    kind: 'section',
    naturalNumber: '2.4',
    structuralPath: ['chapter-2', 'section-2.4'],
    markdown: 'The unit-step response（单位阶跃响应）of a first-order system is exponential.',
    fragments: [],
  },
  {
    id: 'textbook-unit:encyclopedia/indirect',
    bookId: 'control-encyclopedia',
    edition: '2015版',
    sourceRevision: 'revision-encyclopedia',
    title: '响应',
    kind: 'entry',
    naturalNumber: null,
    structuralPath: ['response'],
    markdown: '响应是系统输出随输入变化的统称。',
    fragments: [],
  },
];

function response(): TextbookRetrievalResponse {
  return {
    mode: 'lexical-vector',
    results: [
      {
        windowId: 'textbook-window:overlap-a',
        primaryUnitId: units[1].id,
        owningUnitIds: [units[1].id],
        segments: [{
          owningUnitId: units[1].id,
          body: '单位阶跃响应 3.2 的英文教材命中窗口。',
        }],
        bookId: units[1].bookId,
        sourcePaths: ['private/source-a.md'],
        body: '单位阶跃响应 3.2 的英文教材命中窗口。',
        scores: { fused: 0.9 },
      },
      {
        windowId: 'textbook-window:overlap-b',
        primaryUnitId: units[0].id,
        owningUnitIds: [units[0].id],
        segments: [{
          owningUnitId: units[0].id,
          body: '单位阶跃响应 3.2 的中文教材命中窗口。',
        }],
        bookId: units[0].bookId,
        sourcePaths: ['private/source-b.md'],
        body: '单位阶跃响应 3.2 的中文教材命中窗口。',
        scores: { fused: 0.8 },
      },
      {
        windowId: 'textbook-window:indirect',
        primaryUnitId: units[2].id,
        owningUnitIds: [units[2].id],
        segments: [{
          owningUnitId: units[2].id,
          body: 'indirect mention',
        }],
        bookId: units[2].bookId,
        sourcePaths: ['private/source-c.md'],
        body: 'indirect mention',
        scores: { fused: 0.95 },
      },
    ],
    diagnostics: [{
      stage: 'rerank',
      code: 'timeout',
      latencyMs: 2000,
    }],
  };
}

const canonicalIndexRoot = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resources',
  'textbook-hybrid-retrieval',
  'bge-m3',
);

async function captureNormalIndexRoot(overrides: Record<string, unknown> = {}) {
  const loadIndex = vi.fn().mockResolvedValue({
    manifest: { sourcePriority: [] },
  } as unknown as LoadedTextbookRetrievalIndex);
  await retrieveTextbookSourcePackV2({
    query: 'unit-step response',
    retrieve: vi.fn().mockResolvedValue(response()),
    loadIndex,
    loadUnits: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as Parameters<typeof retrieveTextbookSourcePackV2>[0]);
  return loadIndex.mock.calls[0][0] as string;
}

async function captureProgressiveIndexRoot(overrides: Record<string, unknown> = {}) {
  const loadIndex = vi.fn().mockResolvedValue({
    manifest: { sourcePriority: [] },
  } as unknown as LoadedTextbookRetrievalIndex);
  await retrieveTextbookSourcePackV2Progressive({
    query: 'unit-step response',
    retrieveProgressive: vi.fn().mockResolvedValue({
      foreground: response(),
      optimizationPending: false,
      continuation: null,
    }),
    loadIndex,
    loadUnits: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as Parameters<typeof retrieveTextbookSourcePackV2Progressive>[0]);
  return loadIndex.mock.calls[0][0] as string;
}

describe('v2 textbook Source Pack adapter', () => {
  afterEach(() => {
    delete process.env.ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT;
  });

  it('resolves the canonical default index root for normal and progressive retrieval', async () => {
    const [normalRoot, progressiveRoot] = await Promise.all([
      captureNormalIndexRoot(),
      captureProgressiveIndexRoot(),
    ]);

    expect(normalRoot).toBe(canonicalIndexRoot);
    expect(progressiveRoot).toBe(canonicalIndexRoot);
    expect(normalRoot).not.toContain('textbook-retrieval');
  });

  it('uses ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT when explicit indexRoot is absent', async () => {
    process.env.ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT = '/env/index';

    const [normalRoot, progressiveRoot] = await Promise.all([
      captureNormalIndexRoot(),
      captureProgressiveIndexRoot(),
    ]);

    expect(normalRoot).toBe('/env/index');
    expect(progressiveRoot).toBe('/env/index');
  });

  it('gives explicit indexRoot priority over environment and default', async () => {
    process.env.ACT_TEXTBOOK_RETRIEVAL_INDEX_ROOT = '/env/index';

    const [normalRoot, progressiveRoot] = await Promise.all([
      captureNormalIndexRoot({ indexRoot: '/explicit/index' }),
      captureProgressiveIndexRoot({ indexRoot: '/explicit/index' }),
    ]);

    expect(normalRoot).toBe('/explicit/index');
    expect(progressiveRoot).toBe('/explicit/index');
  });

  it('deduplicates owning units, never cites windows, and applies source priority after direct support', async () => {
    const result = await retrieveTextbookSourcePackV2({
      query: '单位阶跃响应',
      indexRoot: '/fixture/index',
      retrieve: vi.fn().mockResolvedValue(response()),
      loadIndex: vi.fn().mockResolvedValue({
        manifest: {
          sourcePriority: [
            'control-encyclopedia',
            'dorf-modern-control-systems',
            'hu-shousong-auto-control-8th',
            'liu-sheng-auto-control-2015',
          ],
        },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue(units),
    });

    expect(result.candidates.map((candidate) => candidate.identity.unitId)).toEqual([
      units[0].id,
      units[1].id,
    ]);
    expect(result.candidates.map((candidate) => candidate.identity.sourceRevision)).toEqual([
      'revision-hu8',
      'revision-dorf',
    ]);
    expect(result.candidates.map((candidate) => candidate.displayNumber)).toEqual([1, 2]);
    expect(JSON.stringify(result.candidates)).not.toContain('textbook-window:');
    expect(JSON.stringify(result.candidates)).not.toContain('private/source');
    expect(result.candidates[0].text).toBe(units[0].markdown);
    expect(result.candidates[1].text).toBe(units[1].markdown);
  });

  it('uses graph refs only to expand candidates and never as evidence', async () => {
    const retrieve = vi.fn().mockResolvedValue(response());
    const result = await retrieveTextbookSourcePackV2({
      query: '单位阶跃响应',
      externalQuery: '自动控制原理 二阶系统前测 快 稳 冲 单位阶跃响应',
      graphNodeRefs: ['knowledge-node:step-response'],
      indexRoot: '/fixture/index',
      retrieve,
      loadIndex: vi.fn().mockResolvedValue({
        manifest: { sourcePriority: units.map((unit) => unit.bookId) },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue(units),
    });

    expect(retrieve).toHaveBeenCalledWith(
      expect.stringContaining('knowledge-node:step-response'),
      expect.objectContaining({
        indexRoot: '/fixture/index',
        externalQuery: '自动控制原理 二阶系统前测 快 稳 冲 单位阶跃响应',
      }),
    );
    expect(result.candidates.map((candidate) => candidate.identity.unitId)).toEqual([
      units[0].id,
      units[1].id,
    ]);
    expect(JSON.stringify(result.candidates)).not.toContain('knowledge-node:step-response');
    expect(result.limitations).toContain('knowledge-graph-candidate-expansion-only');
  });

  it('never promotes a supplemental source to standalone textbook evidence', async () => {
    const supplementalUnit = units[2];
    const result = await retrieveTextbookSourcePackV2({
      query: '单位阶跃响应',
      indexRoot: '/fixture/index',
      retrieve: vi.fn().mockResolvedValue({
        mode: 'lexical',
        results: [{
          windowId: 'textbook-window:supplemental-only',
          primaryUnitId: supplementalUnit.id,
          owningUnitIds: [supplementalUnit.id],
          segments: [{
            owningUnitId: supplementalUnit.id,
            body: '单位阶跃响应是控制系统在单位阶跃输入下的输出响应。',
          }],
          bookId: supplementalUnit.bookId,
          sourcePaths: ['private/encyclopedia.md'],
          body: '单位阶跃响应是控制系统在单位阶跃输入下的输出响应。',
          scores: { fused: 0.99 },
        }],
      }),
      loadIndex: vi.fn().mockResolvedValue({
        manifest: { sourcePriority: [supplementalUnit.bookId] },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue([supplementalUnit]),
    });

    expect(result.candidates).toEqual([]);
    expect(result.limitations).toContain('no-directly-supporting-textbook-unit');
  });

  it('judges overlapping windows against each owning unit body', async () => {
    const relevant = {
      ...units[0],
      id: 'textbook-unit:hu8/relevant',
      markdown: '单位阶跃响应具有指数形式。',
      fragments: [],
    };
    const adjacent = {
      ...units[0],
      id: 'textbook-unit:hu8/adjacent',
      title: '相邻主题',
      markdown: '本节只讨论频率响应。',
      fragments: [],
    };
    const result = await retrieveTextbookSourcePackV2({
      query: '单位阶跃响应',
      indexRoot: '/fixture/index',
      retrieve: vi.fn().mockResolvedValue({
        mode: 'lexical',
        results: [{
          windowId: 'textbook-window:overlap',
          primaryUnitId: relevant.id,
          owningUnitIds: [relevant.id, adjacent.id],
          segments: [
            {
              owningUnitId: relevant.id,
              body: relevant.markdown,
            },
            {
              owningUnitId: adjacent.id,
              body: adjacent.markdown,
            },
          ],
          bookId: relevant.bookId,
          sourcePaths: ['private/overlap.md'],
          body: `${relevant.markdown}\n${adjacent.markdown}`,
          scores: { fused: 0.9 },
        }],
      }),
      loadIndex: vi.fn().mockResolvedValue({
        manifest: { sourcePriority: [relevant.bookId] },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue([relevant, adjacent]),
    });

    expect(result.candidates.map((candidate) => candidate.identity.unitId)).toEqual([
      relevant.id,
    ]);
    expect(result.candidates[0].text).toBe(relevant.markdown);
  });

  it.each([
    ['hu-shousong-auto-control-7th', '第七版 单位阶跃响应'],
    ['hu-shousong-exercise-analysis-3rd', '习题 单位阶跃响应'],
    ['control-encyclopedia', '控制百科 单位阶跃响应'],
  ])('retains %s only for its declared supplemental purpose', async (bookId, query) => {
    const supplementalUnit: TextbookCitationUnit = {
      ...units[2],
      id: `textbook-unit:${bookId}/supplemental`,
      bookId,
      title: `${query}补充`,
      markdown: `${query}的直接补充说明。`,
    };
    const result = await retrieveTextbookSourcePackV2({
      query,
      indexRoot: '/fixture/index',
      retrieve: vi.fn().mockResolvedValue({
        mode: 'lexical',
        results: [{
          windowId: `textbook-window:${bookId}`,
          primaryUnitId: supplementalUnit.id,
          owningUnitIds: [supplementalUnit.id],
          segments: [{
            owningUnitId: supplementalUnit.id,
            body: `${query}的直接补充说明。`,
          }],
          bookId,
          sourcePaths: ['private/supplemental.md'],
          body: `${query}的直接补充说明。`,
          scores: { fused: 0.9 },
        }],
      }),
      loadIndex: vi.fn().mockResolvedValue({
        manifest: { sourcePriority: [bookId] },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue([supplementalUnit]),
    });

    expect(result.candidates.map((candidate) => candidate.identity.bookId)).toEqual([bookId]);
  });

  it('uses registered fragments as citations only when the query identifies the fragment', async () => {
    const result = await retrieveTextbookSourcePackV2({
      query: '单位阶跃响应 3.2',
      indexRoot: '/fixture/index',
      retrieve: vi.fn().mockResolvedValue(response()),
      loadIndex: vi.fn().mockResolvedValue({
        manifest: { sourcePriority: units.map((unit) => unit.bookId) },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue(units),
    });

    expect(result.candidates[0].identity).toMatchObject({
      kind: 'fragment',
      unitId: units[0].id,
      fragmentId: 'formula-3.2-1',
    });
    expect(result.candidates[0].href.endsWith('#formula-3.2-1')).toBe(true);
  });

  it('returns an explicit bounded allowlist DTO and safe provider diagnostics', async () => {
    const result = await retrieveTextbookSourcePackV2({
      query: '单位阶跃响应',
      indexRoot: '/fixture/index',
      maxTextChars: 12,
      retrieve: vi.fn().mockResolvedValue(response()),
      loadIndex: vi.fn().mockResolvedValue({
        manifest: { sourcePriority: units.map((unit) => unit.bookId) },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue(units),
    });

    expect(result).toMatchObject({
      mode: 'lexical-vector',
      diagnostics: [{ stage: 'rerank', code: 'timeout' }],
    });
    expect(Object.keys(result.candidates[0]).sort()).toEqual([
      'displayNumber',
      'href',
      'identity',
      'limitation',
      'priority',
      'text',
      'title',
    ]);
    expect(result.candidates[0].text.length).toBeLessThanOrEqual(12);
    for (const forbidden of [
      'ownerUserId',
      'documentId',
      'versionId',
      'sourcePath',
      'windowId',
      'traceId',
    ]) {
      expect(JSON.stringify(result)).not.toContain(forbidden);
    }
  });

  it('keeps the continuation outside the tool DTO and passes the frozen time budgets', async () => {
    const retrieveProgressive = vi.fn().mockResolvedValue({
      foreground: response(),
      optimizationPending: true,
      continuation: Promise.resolve({
        status: 'complete',
        response: response(),
      }),
    });
    const progressive = await retrieveTextbookSourcePackV2Progressive({
      query: '单位阶跃响应',
      externalQuery: '自动控制原理 单位阶跃响应',
      indexRoot: '/fixture/index',
      retrieveProgressive,
      loadIndex: vi.fn().mockResolvedValue({
        manifest: { sourcePriority: units.map((unit) => unit.bookId) },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue(units),
    });
    expect(retrieveProgressive).toHaveBeenCalledWith(
      '单位阶跃响应',
      expect.objectContaining({
        externalQuery: '自动控制原理 单位阶跃响应',
        embeddingTimeoutMs: 1000,
        rerankTimeoutMs: 2000,
        foregroundWaitMs: 2000,
        backgroundWaitLimitMs: 2500,
      }),
    );
    expect(progressive.foreground).not.toHaveProperty('continuation');
    expect(JSON.stringify(progressive.foreground)).not.toContain('Promise');
    await expect(progressive.continuation).resolves.toMatchObject({
      status: 'complete',
      result: {
        mode: 'lexical-vector',
      },
    });
  });

  it('hands off the matched window body even when the unit match occurs after the old prefix limit', async () => {
    const lateUnit: TextbookCitationUnit = {
      ...units[0],
      id: 'textbook-unit:hu8/late',
      title: '长章节',
      markdown: `${'背景材料'.repeat(500)}单位阶跃响应只出现在 1600 字之后。`,
      fragments: [],
    };
    const matchedWindow = '命中窗口直接解释单位阶跃响应的指数形式。';
    const result = await retrieveTextbookSourcePackV2({
      query: '单位阶跃响应',
      externalQuery: '单位阶跃响应',
      indexRoot: '/fixture/index',
      retrieve: vi.fn().mockResolvedValue({
        mode: 'lexical',
        results: [{
          windowId: 'textbook-window:late',
          primaryUnitId: lateUnit.id,
          owningUnitIds: [lateUnit.id],
          segments: [{
            owningUnitId: lateUnit.id,
            body: matchedWindow,
          }],
          bookId: lateUnit.bookId,
          sourcePaths: ['private/late.md'],
          body: matchedWindow,
          scores: { fused: 0.77 },
        }],
      }),
      loadIndex: vi.fn().mockResolvedValue({
        manifest: { sourcePriority: [lateUnit.bookId] },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue([lateUnit]),
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].text).toContain('单位阶跃响应只出现在 1600 字之后');
    expect(result.candidates[0].text.length).toBeLessThanOrEqual(1600);
    expect(result.candidates[0].identity.unitId).toBe(lateUnit.id);
  });

  it('does not verify an owning unit when only its adjacent window segment supports the query', async () => {
    const adjacentUnit: TextbookCitationUnit = {
      ...units[0],
      id: 'textbook-unit:hu8/adjacent',
      title: '相邻结构单元',
      structuralPath: ['chapter-3', 'section-3.3'],
      markdown: '相邻结构单元讨论稳态误差。',
      fragments: [],
    };
    const result = await retrieveTextbookSourcePackV2({
      query: '单位阶跃响应',
      indexRoot: '/fixture/index',
      retrieve: vi.fn().mockResolvedValue({
        mode: 'lexical',
        results: [{
          windowId: 'textbook-window:overlap-counterexample',
          primaryUnitId: units[0].id,
          owningUnitIds: [units[0].id, adjacentUnit.id],
          segments: [
            {
              owningUnitId: units[0].id,
              body: '单位阶跃响应为指数形式。',
            },
            {
              owningUnitId: adjacentUnit.id,
              body: '本节只讨论稳态误差。',
            },
          ],
          bookId: units[0].bookId,
          sourcePaths: ['private/overlap.md'],
          body: '单位阶跃响应为指数形式。本节只讨论稳态误差。',
          scores: { fused: 0.95 },
        }],
      }),
      loadIndex: vi.fn().mockResolvedValue({
        manifest: { sourcePriority: [units[0].bookId] },
      } as LoadedTextbookRetrievalIndex),
      loadUnits: vi.fn().mockResolvedValue([units[0], adjacentUnit]),
    });

    expect(result.candidates.map((candidate) => candidate.identity.unitId)).toEqual([units[0].id]);
    expect(result.candidates[0].text).toBe(units[0].markdown);
  });
});
