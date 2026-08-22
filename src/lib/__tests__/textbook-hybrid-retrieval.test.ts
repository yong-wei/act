import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getSharedTextbookRetrievalIndex,
  lexicalTokens,
  loadTextbookRetrievalIndex,
  normalizeText,
  resetTextbookRetrievalForTests,
  retrieve,
  retrieveTextbookHybrid,
  retrieveTextbookHybridProgressive,
  SiliconFlowTextbookEmbeddingClient,
  TEXTBOOK_RETRIEVAL_FORMAT_VERSION,
  TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION,
  TextbookRetrievalContractError,
} from '@/lib/textbook-retrieval';
import type {
  EmbeddingResponse,
  RerankRequest,
  RerankResponse,
  TextbookEmbeddingClient,
  TextbookRerankClient,
} from '@/lib/textbook-retrieval';
import { runAcceptance } from '../../../course-content/scripts/benchmark_textbook_hybrid_runtime.mjs';

const sha256 = (value: Uint8Array | string) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

interface RuntimeAcceptanceFixture {
  args: string[];
  configPath: string;
  index: {
    manifestHash: string;
    manifest: {
      model: string;
      observedDimension: number;
      normalizationVersion: string;
      vectorNormalization: 'l2';
    };
    windows: Array<{
      id: string;
      primaryUnitId: string;
      owningUnitIds: string[];
    }>;
  };
  outputPath: string;
}

async function buildRuntimeAcceptanceFixture(): Promise<RuntimeAcceptanceFixture> {
  const root = await mkdtemp(path.join(tmpdir(), 'textbook-runtime-acceptance-'));
  const paths = {
    benchmark: path.join(root, 'benchmark.jsonl'),
    split: path.join(root, 'split.json'),
    lock: path.join(root, 'benchmark-lock.json'),
    config: path.join(root, 'config.json'),
    selection: path.join(root, 'selection-report.json'),
    output: path.join(root, 'runtime-acceptance.json'),
  };
  const rows = [
    {
      schemaVersion: 'textbook-retrieval-benchmark-entry.v1',
      queryId: 'tuning-private-query',
      query: 'TUNING_QUERY_MUST_NOT_LOAD',
      category: 'concept',
      language: 'zh',
      acceptableUnitIds: ['textbook-unit:fixture/tuning'],
      preferredUnitId: 'textbook-unit:fixture/tuning',
      sourceBookIds: ['fixture-book'],
      rationale: 'tuning only',
      labelingVersion: 'fixture-v1',
    },
    {
      schemaVersion: 'textbook-retrieval-benchmark-entry.v1',
      queryId: 'known-failure-first-order-unit-step-response',
      query: 'SECRET_KNOWN_FAILURE_QUERY',
      category: 'formula',
      language: 'zh',
      acceptableUnitIds: ['textbook-unit:fixture/known'],
      preferredUnitId: 'textbook-unit:fixture/known',
      sourceBookIds: ['fixture-book'],
      rationale: 'known failure',
      labelingVersion: 'fixture-v1',
    },
    {
      schemaVersion: 'textbook-retrieval-benchmark-entry.v1',
      queryId: 'blind-runtime-fallback',
      query: 'SECRET_FALLBACK_QUERY',
      category: 'concept',
      language: 'zh',
      acceptableUnitIds: ['textbook-unit:fixture/fallback'],
      preferredUnitId: 'textbook-unit:fixture/fallback',
      sourceBookIds: ['fixture-book'],
      rationale: 'fallback',
      labelingVersion: 'fixture-v1',
    },
  ];
  const benchmarkBytes = Buffer.from(
    `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
  );
  const split = {
    schemaVersion: 'textbook-retrieval-benchmark-split.v1',
    strategy: 'fixture',
    lockedAt: '2026-07-25T15:29:42Z',
    tuningQueryIds: ['tuning-private-query'],
    acceptanceQueryIds: [
      'known-failure-first-order-unit-step-response',
      'blind-runtime-fallback',
    ],
  };
  const splitBytes = Buffer.from(`${JSON.stringify(split, null, 2)}\n`);
  const lock = {
    recordType: 'benchmark-lock',
    lockVersion: 'textbook-hybrid-retrieval-benchmark-lock.v1',
    benchmarkHash: sha256(benchmarkBytes),
    splitHash: sha256(splitBytes),
    queryCount: rows.length,
    tuningQueryCount: split.tuningQueryIds.length,
    acceptanceQueryCount: split.acceptanceQueryIds.length,
    tuningQueryIdsHash: sha256(canonicalJson(split.tuningQueryIds)),
    acceptanceQueryIdsHash: sha256(canonicalJson(split.acceptanceQueryIds)),
    candidateModels: ['BAAI/bge-m3'],
    pricing: {},
  };
  const lockBytes = Buffer.from(`${JSON.stringify(lock, null, 2)}\n`);
  const manifestHash = sha256('fixture-index-manifest');
  const selection = {
    recordType: 'selection-report',
    acceptanceEvaluated: false,
    benchmarkHash: lock.benchmarkHash,
    splitHash: lock.splitHash,
    benchmarkLockHash: sha256(canonicalJson(lock)),
    selectedIndexManifestHash: manifestHash,
    selectedModel: 'BAAI/bge-m3',
    selectedObservedDimension: 1024,
    selectedNormalizationVersion: TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION,
  };
  const selectionBytes = Buffer.from(`${JSON.stringify(selection, null, 2)}\n`);
  const config = {
    recordType: 'textbook-hybrid-retrieval-config',
    formatVersion: 'textbook-hybrid-retrieval.v1',
    locked: true,
    selectionReportHash: sha256(selectionBytes),
    selectedModel: 'BAAI/bge-m3',
    selectedObservedDimension: 1024,
    selectedNormalizationVersion: TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION,
    selectedIndexManifestHash: manifestHash,
    rerankerModel: 'BAAI/bge-reranker-v2-m3',
    embeddingTimeoutMs: 1000,
    rerankTimeoutMs: 2000,
    benchmarkHash: lock.benchmarkHash,
    splitHash: lock.splitHash,
    benchmarkLockHash: sha256(canonicalJson(lock)),
    runtimeAcceptance: {
      runtimeEntry: 'src/lib/textbook-retrieval/retrieval.ts#retrieveTextbookHybrid',
      topK: 10,
      candidateCount: 24,
      recallAt10Threshold: 0.8,
      knownFailureQueryId: 'known-failure-first-order-unit-step-response',
    },
  };
  await Promise.all([
    writeFile(paths.benchmark, benchmarkBytes),
    writeFile(paths.split, splitBytes),
    writeFile(paths.lock, lockBytes),
    writeFile(paths.config, `${JSON.stringify(config, null, 2)}\n`),
    writeFile(paths.selection, selectionBytes),
  ]);
  return {
    args: [
      '--index-dir', path.join(root, 'selected-index'),
      '--benchmark', paths.benchmark,
      '--split-file', paths.split,
      '--benchmark-lock', paths.lock,
      '--locked-config', paths.config,
      '--selection-report', paths.selection,
      '--output', paths.output,
    ],
    configPath: paths.config,
    index: {
      manifestHash,
      manifest: {
        model: 'BAAI/bge-m3',
        observedDimension: 1024,
        normalizationVersion: TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION,
        vectorNormalization: 'l2',
      },
      windows: [
        {
          id: 'textbook-window:fixture/known',
          primaryUnitId: 'textbook-unit:fixture/known',
          owningUnitIds: ['textbook-unit:fixture/known'],
        },
        {
          id: 'textbook-window:fixture/fallback',
          primaryUnitId: 'textbook-unit:fixture/fallback',
          owningUnitIds: ['textbook-unit:fixture/fallback'],
        },
      ],
    },
    outputPath: paths.output,
  };
}

function encodeUnsignedVarint(value: number): Buffer {
  const bytes: number[] = [];
  while (value >= 0x80) {
    bytes.push((value & 0x7f) | 0x80);
    value = Math.floor(value / 0x80);
  }
  bytes.push(value);
  return Buffer.from(bytes);
}

interface FixtureWindow {
  id: string;
  body: string;
  sourcePath: string;
  bookId?: string;
}

interface RankingFixtureOptions {
  windows?: FixtureWindow[];
  vectors?: number[][];
  books?: Array<{ bookId: string; edition: string }>;
  sourcePriority?: string[];
}

async function buildIndexFixture(
  firstBody = '反馈控制 feedback control',
  options: RankingFixtureOptions = {},
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'textbook-hybrid-node-'));
  const windows: FixtureWindow[] = options.windows ?? [
    {
      id: 'textbook-window:fixture/feedback',
      body: firstBody,
      sourcePath: 'chapter-01/feedback.md',
    },
    {
      id: 'textbook-window:fixture/formula',
      body: '单位阶跃响应 G(s)=1/(s+1)',
      sourcePath: 'chapter-01/formula.md',
    },
    {
      id: 'textbook-window:fixture/stability',
      body: '稳定裕度 phase margin',
      sourcePath: 'chapter-02/stability.md',
    },
  ];
  const vectors = options.vectors ?? [
    [1, 0],
    [0, 1],
    [Math.SQRT1_2, Math.SQRT1_2],
  ];
  const books = options.books ?? [{
    bookId: 'fixture-book',
    edition: 'fixture-edition',
  }];
  const sourcePriority = options.sourcePriority
    ?? books.map((book) => book.bookId);
  const dimension = vectors[0].length;
  const bodies = Buffer.concat(windows.map((window) => Buffer.from(window.body)));
  const metadata = [];
  const postings = new Map<string, Map<number, number>>();
  let offset = 0;
  for (const [row, window] of windows.entries()) {
    const body = Buffer.from(window.body);
    const counts = new Map<string, number>();
    for (const token of lexicalTokens(window.body)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
    for (const [token, frequency] of counts) {
      const rows = postings.get(token) ?? new Map<number, number>();
      rows.set(row, frequency);
      postings.set(token, rows);
    }
    metadata.push({
      recordType: 'index-window',
      formatVersion: TEXTBOOK_RETRIEVAL_FORMAT_VERSION,
      id: window.id,
      sourceWindowId: window.id,
      bookId: window.bookId ?? books[0].bookId,
      sourceRevision: 'fixture-revision',
      primaryUnitId: `textbook-unit:fixture/${row}`,
      owningUnitIds: [`textbook-unit:fixture/${row}`],
      segments: [{
        owningUnitId: `textbook-unit:fixture/${row}`,
        bodyOffset: 0,
        bodyLength: body.length,
      }],
      sourcePaths: [window.sourcePath],
      vectorRow: row,
      bodyOffset: offset,
      bodyLength: body.length,
      bodyHash: sha256(body),
      contentHash: sha256(Buffer.from(normalizeText(window.body))),
      tokenCount: lexicalTokens(window.body).length,
    });
    offset += body.length;
  }

  const windowsBytes = Buffer.from(
    `${metadata.map((row) => JSON.stringify(row)).join('\n')}\n`,
  );
  const lexicalPostingParts: Buffer[] = [];
  const terms: Array<{
    token: string;
    byteOffset: number;
    byteLength: number;
    postingCount: number;
  }> = [];
  let lexicalOffset = 0;
  for (const [token, rows] of [...postings].sort(
    ([left], [right]) => Buffer.compare(
      Buffer.from(left, 'utf8'),
      Buffer.from(right, 'utf8'),
    ),
  )) {
    let previous = -1;
    const encodedRows: Buffer[] = [];
    for (const [row, frequency] of rows) {
      encodedRows.push(encodeUnsignedVarint(row - previous));
      encodedRows.push(encodeUnsignedVarint(frequency));
      previous = row;
    }
    const encoded = Buffer.concat(encodedRows);
    terms.push({
      token,
      byteOffset: lexicalOffset,
      byteLength: encoded.length,
      postingCount: rows.size,
    });
    lexicalPostingParts.push(encoded);
    lexicalOffset += encoded.length;
  }
  const lexicalTermsBytes = Buffer.from(`${[
    {
      recordType: 'lexical-terms-header',
      formatVersion: TEXTBOOK_RETRIEVAL_FORMAT_VERSION,
      normalizationVersion: TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION,
    },
    ...terms.map((term) => ({ recordType: 'lexical-term', ...term })),
  ].map((record) => JSON.stringify(record)).join('\n')}\n`);
  const lexicalPostingsBytes = Buffer.concat(lexicalPostingParts);
  const vectorBytes = Buffer.alloc(vectors.length * dimension * 4);
  vectors.flat().forEach((value, index) => vectorBytes.writeFloatLE(value, index * 4));

  await Promise.all([
    writeFile(path.join(root, 'bodies.utf8'), bodies),
    writeFile(path.join(root, 'windows.jsonl'), windowsBytes),
    writeFile(path.join(root, 'lexical-terms.jsonl'), lexicalTermsBytes),
    writeFile(path.join(root, 'lexical-postings.bin'), lexicalPostingsBytes),
    writeFile(path.join(root, 'vectors.f32'), vectorBytes),
  ]);
  const coreHashes = {
    'bodies.utf8': sha256(bodies),
    'windows.jsonl': sha256(windowsBytes),
    'lexical-terms.jsonl': sha256(lexicalTermsBytes),
    'lexical-postings.bin': sha256(lexicalPostingsBytes),
    'vectors.f32': sha256(vectorBytes),
  };
  const buildReportBytes = Buffer.from(`${JSON.stringify({
    recordType: 'build-report',
    formatVersion: TEXTBOOK_RETRIEVAL_FORMAT_VERSION,
    status: 'complete',
    sourceRevision: 'fixture-revision',
    resourceSetId: 'fixture-resource-set-v1',
    model: 'fixture/embedding',
    observedDimension: dimension,
    normalizationVersion: TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION,
    bookCount: books.length,
    windowCount: windows.length,
    cacheHits: 0,
    cacheMisses: windows.length,
    providerBatches: 1,
    providerUsageTokens: 42,
    providerLatencyMs: {
      batchCount: 1,
      samples: [12],
      p50: 12,
      p95: 12,
      total: 12,
    },
    providerTraceIds: ['fixture-build-trace'],
    fileHashes: coreHashes,
  }, null, 2)}\n`);
  await writeFile(path.join(root, 'build-report.json'), buildReportBytes);
  await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify({
    recordType: 'index-manifest',
    formatVersion: TEXTBOOK_RETRIEVAL_FORMAT_VERSION,
    sourceRevision: 'fixture-revision',
    resourceSetId: 'fixture-resource-set-v1',
    model: 'fixture/embedding',
    observedDimension: dimension,
    normalizationVersion: TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION,
    vectorNormalization: 'l2',
    vectorEncoding: 'float32-le',
    books: books.map((book) => ({
      ...book,
      manifestHash: sha256('fixture-manifest'),
      sourceHashes: Object.fromEntries(
        windows.filter((window) =>
          (window.bookId ?? books[0].bookId) === book.bookId)
          .map((window) => [window.sourcePath, sha256(window.body)]),
      ),
    })),
    sourcePriority,
    counts: {
      books: books.length,
      windows: windows.length,
      vectors: windows.length,
      bodyBytes: bodies.length,
      lexicalTerms: postings.size,
    },
    files: {
      ...coreHashes,
      'build-report.json': sha256(buildReportBytes),
    },
    productionConnected: false,
  }, null, 2)}\n`);
  return root;
}

async function refreshManifestHashes(
  root: string,
  names: string[],
): Promise<void> {
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const name of names) {
    manifest.files[name] = sha256(await readFile(path.join(root, name)));
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
}

const embedding = (
  vector: number[],
  responseModel = 'fixture/embedding',
): TextbookEmbeddingClient => ({
  embed: vi.fn(async () => ({
    embedding: vector,
    model: responseModel,
  })),
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await resetTextbookRetrievalForTests();
});

describe('textbook hybrid retrieval runtime', () => {
  it('uses the server-owned external query for embedding and rerank providers', async () => {
    const root = await buildIndexFixture();
    const embeddingClient: TextbookEmbeddingClient = {
      embed: vi.fn(async () => ({
        embedding: [1, 0],
        model: 'fixture/embedding',
      })),
    };
    const rerankClient: TextbookRerankClient = {
      rerank: vi.fn(async (
        { documents }: Parameters<TextbookRerankClient['rerank']>[0],
      ) => ({
        results: documents.map((document) => ({
          index: document.index,
          score: 1 - document.index * 0.01,
        })),
      })),
    };

    await retrieveTextbookHybrid(
      '反馈控制 我的答案是 K=37 张三 student-1 mastery=0.2 risk=high 学习记录=private',
      {
        indexRoot: root,
        externalQuery: '自动控制原理 反馈控制',
        embeddingClient,
        rerankClient,
        rerankModel: 'fixture/reranker',
      },
    );

    expect(embeddingClient.embed).toHaveBeenCalledWith(expect.objectContaining({
      input: '自动控制原理 反馈控制',
    }));
    expect(rerankClient.rerank).toHaveBeenCalledWith(expect.objectContaining({
      query: '自动控制原理 反馈控制',
    }));
    const providerPayloads = JSON.stringify([
      vi.mocked(embeddingClient.embed).mock.calls,
      vi.mocked(rerankClient.rerank).mock.calls,
    ]);
    for (const forbidden of ['K=37', '张三', 'student-1', 'mastery', 'risk', '学习记录', 'private']) {
      expect(providerPayloads).not.toContain(forbidden);
    }
  });

  it('ranks within the confirmed scope before topK across lexical, vector, and rerank paths', async () => {
    const windows = [
      ...Array.from({ length: 25 }, (_, index) => ({
        id: `textbook-window:global/${index}`,
        body: '反馈控制 '.repeat(20),
        sourcePath: `global/${index}.md`,
        bookId: 'global-book',
      })),
      {
        id: 'textbook-window:confirmed/late',
        body: '反馈控制',
        sourcePath: 'confirmed/late.md',
        bookId: 'confirmed-book',
      },
    ];
    const root = await buildIndexFixture('unused', {
      windows,
      vectors: windows.map(() => [1, 0]),
      books: [
        { bookId: 'global-book', edition: '1' },
        { bookId: 'confirmed-book', edition: '1' },
      ],
      sourcePriority: ['global-book', 'confirmed-book'],
    });
    const embeddingClient = embedding([1, 0]);
    const rerankClient: TextbookRerankClient = {
      rerank: vi.fn(async ({ documents }) => ({
        results: documents.map((document: RerankRequest['documents'][number]) => ({
          index: document.index,
          score: 1,
        })),
      })),
    };

    const unscoped = await retrieveTextbookHybrid('反馈控制', {
      indexRoot: root,
      topK: 8,
      externalQuery: null,
    });
    expect(unscoped.results.map((item) => item.windowId))
      .not.toContain('textbook-window:confirmed/late');

    const result = await retrieveTextbookHybrid('反馈控制', {
      indexRoot: root,
      topK: 8,
      scope: [{ bookId: 'confirmed-book' }],
      embeddingClient,
      rerankClient,
      rerankModel: 'fixture/reranker',
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      windowId: 'textbook-window:confirmed/late',
      bookId: 'confirmed-book',
    });
    expect(rerankClient.rerank).toHaveBeenCalledWith(expect.objectContaining({
      documents: [expect.objectContaining({ text: '反馈控制' })],
    }));
  });

  it('keeps local lexical retrieval but disables embedding and rerank without a safe external query', async () => {
    const root = await buildIndexFixture();
    const embeddingClient = embedding([1, 0]);
    const rerankClient: TextbookRerankClient = {
      rerank: vi.fn(async () => ({ results: [] })),
    };

    const result = await retrieveTextbookHybrid(
      '我的答案是 K=37，请解释反馈控制',
      {
        indexRoot: root,
        externalQuery: null,
        embeddingClient,
        rerankClient,
        rerankModel: 'fixture/reranker',
      },
    );

    expect(result.mode).toBe('lexical');
    expect(embeddingClient.embed).not.toHaveBeenCalled();
    expect(rerankClient.rerank).not.toHaveBeenCalled();
  });

  it.each([
    [1_999, false, 'lexical-vector'],
    [2_000, true, 'lexical'],
  ] as const)(
    'uses the external result at %dms only before the 2000ms foreground boundary',
    async (latencyMs, optimizationPending, foregroundMode) => {
      const root = await buildIndexFixture();
      await getSharedTextbookRetrievalIndex(root);
      vi.useFakeTimers();
      vi.setSystemTime(0);
      let markEmbeddingStarted!: () => void;
      const embeddingStarted = new Promise<void>((resolve) => {
        markEmbeddingStarted = resolve;
      });
      const embeddingClient: TextbookEmbeddingClient = {
        embed: vi.fn(({ signal }) => new Promise<EmbeddingResponse>((resolve, reject) => {
          markEmbeddingStarted();
          const timer = setTimeout(() => resolve({
            embedding: [1, 0],
            model: 'fixture/embedding',
          }), latencyMs);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        })),
      };
      const pending = retrieveTextbookHybridProgressive('反馈控制', {
        indexRoot: root,
        embeddingClient,
        embeddingTimeoutMs: 2_500,
        foregroundWaitMs: 2_000,
        backgroundWaitLimitMs: 2_500,
        now: () => Date.now(),
      });
      await embeddingStarted;
      await vi.advanceTimersByTimeAsync(latencyMs);
      const result = await pending;
      expect(result.optimizationPending).toBe(optimizationPending);
      expect(result.foreground.mode).toBe(foregroundMode);
      if (optimizationPending) {
        await expect(result.continuation).resolves.toMatchObject({
          status: 'complete',
          response: { mode: 'lexical-vector' },
        });
      } else {
        expect(result.continuation).toBeNull();
      }
    },
  );

  it.each([
    [2_499, 'complete'],
    [2_500, 'capped'],
  ] as const)(
    'accepts external completion at %dms only before the absolute cap',
    async (latencyMs, expectedStatus) => {
      const root = await buildIndexFixture();
      await getSharedTextbookRetrievalIndex(root);
      vi.useFakeTimers();
      vi.setSystemTime(0);
      let markEmbeddingStarted!: () => void;
      const embeddingStarted = new Promise<void>((resolve) => {
        markEmbeddingStarted = resolve;
      });
      const embeddingClient: TextbookEmbeddingClient = {
        embed: vi.fn(({ signal }) => new Promise<EmbeddingResponse>((resolve, reject) => {
          markEmbeddingStarted();
          const timer = setTimeout(() => resolve({
            embedding: [1, 0],
            model: 'fixture/embedding',
          }), latencyMs);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        })),
      };
      const pending = retrieveTextbookHybridProgressive('反馈控制', {
        indexRoot: root,
        embeddingClient,
        embeddingTimeoutMs: 2_500,
        foregroundWaitMs: 2_000,
        backgroundWaitLimitMs: 2_500,
        now: () => Date.now(),
      });
      await embeddingStarted;
      await vi.advanceTimersByTimeAsync(2_000);
      const foreground = await pending;
      expect(foreground.optimizationPending).toBe(true);
      await vi.advanceTimersByTimeAsync(latencyMs - 2_000);
      await expect(foreground.continuation).resolves.toMatchObject({
        status: expectedStatus,
      });
    },
  );

  it('clips reranking to the remaining absolute budget and aborts cleanly', async () => {
    const root = await buildIndexFixture();
    await getSharedTextbookRetrievalIndex(root);
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let rerankAbortedAt = -1;
    let markEmbeddingStarted!: () => void;
    let markRerankStarted!: () => void;
    const embeddingStarted = new Promise<void>((resolve) => {
      markEmbeddingStarted = resolve;
    });
    const rerankStarted = new Promise<void>((resolve) => {
      markRerankStarted = resolve;
    });
    const embeddingClient: TextbookEmbeddingClient = {
      embed: vi.fn(() => new Promise<EmbeddingResponse>((resolve) => {
        markEmbeddingStarted();
        setTimeout(() => resolve({
          embedding: [1, 0],
          model: 'fixture/embedding',
        }), 2_490);
      })),
    };
    const rerankClient: TextbookRerankClient = {
      rerank: vi.fn(({ signal }) => new Promise<RerankResponse>((_, reject) => {
        markRerankStarted();
        signal.addEventListener('abort', () => {
          rerankAbortedAt = performance.now();
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      })),
    };
    const pending = retrieveTextbookHybridProgressive('反馈控制', {
      indexRoot: root,
      embeddingClient,
      embeddingTimeoutMs: 2_500,
      rerankClient,
      rerankModel: 'fixture/reranker',
      rerankTimeoutMs: 2_000,
      foregroundWaitMs: 2_000,
      backgroundWaitLimitMs: 2_500,
      now: () => Date.now(),
    });
    await embeddingStarted;
    await vi.advanceTimersByTimeAsync(2_000);
    const foreground = await pending;
    await vi.advanceTimersByTimeAsync(490);
    await rerankStarted;
    await vi.advanceTimersByTimeAsync(10);
    await expect(foreground.continuation).resolves.toMatchObject({
      status: 'capped',
    });
    expect(rerankAbortedAt).toBeGreaterThanOrEqual(2_499);
    expect(rerankAbortedAt).toBeLessThanOrEqual(2_500);
  });

  it('settles an in-flight continuation as aborted without an unhandled rejection', async () => {
    const root = await buildIndexFixture();
    await getSharedTextbookRetrievalIndex(root);
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const controller = new AbortController();
    let markEmbeddingStarted!: () => void;
    const embeddingStarted = new Promise<void>((resolve) => {
      markEmbeddingStarted = resolve;
    });
    const embeddingClient: TextbookEmbeddingClient = {
      embed: vi.fn(({ signal }) => new Promise<EmbeddingResponse>((_, reject) => {
        markEmbeddingStarted();
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      })),
    };
    const pending = retrieveTextbookHybridProgressive('反馈控制', {
      indexRoot: root,
      embeddingClient,
      embeddingTimeoutMs: 2_500,
      foregroundWaitMs: 2_000,
      backgroundWaitLimitMs: 2_500,
      abortSignal: controller.signal,
      now: () => Date.now(),
    });
    await embeddingStarted;
    await vi.advanceTimersByTimeAsync(2_000);
    const foreground = await pending;
    expect(foreground.optimizationPending).toBe(true);
    controller.abort();
    await expect(foreground.continuation).resolves.toEqual({
      status: 'aborted',
    });
  });

  it('reads the SiliconFlow trace header from embedding responses', async () => {
    vi.stubEnv('SILICONFLOW_API_KEY', 'test-only-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: [{ embedding: [1, 0] }],
      model: 'fixture/embedding',
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-siliconcloud-trace-id': 'siliconflow-trace-1047',
        'x-request-id': 'fallback-request-id',
      },
    })));
    const client = new SiliconFlowTextbookEmbeddingClient();
    await expect(client.embed({
      model: 'fixture/embedding',
      input: '反馈控制',
      signal: new AbortController().signal,
    })).resolves.toMatchObject({
      traceId: 'siliconflow-trace-1047',
    });
  });

  it('matches Python NFKC, CJK unigram/bigram, and technical token rules', () => {
    expect(normalizeText('ＡＢＣ 控制')).toBe('abc 控制');
    expect(new Set(lexicalTokens('控制系统 G(s)=１.０ STEP_response ω_n≈ζ')))
      .toEqual(expect.objectContaining(new Set([
        '控', '制', '控制', '系统', 'g', 's', '=', '1.0',
        'step_response', 'ω_n', '≈', 'ζ',
      ])));
  });

  it('shares one manifest-hash keyed instance and closes it deterministically', async () => {
    const root = await buildIndexFixture();
    const [first, second] = await Promise.all([
      loadTextbookRetrievalIndex(root),
      getSharedTextbookRetrievalIndex(path.join(root, '.')),
    ]);
    expect(second).toBe(first);
    expect(first.windows[0].sourceWindowId).toBe(first.windows[0].id);
    expect(first.windows[0]).not.toHaveProperty('recordType');
    expect(first.windows[0]).not.toHaveProperty('formatVersion');
    expect(first.windows[0]).not.toHaveProperty('vectorRow');
    expect(first.windows[0]).not.toHaveProperty('bodyHash');
    expect(first.windows[0]).not.toHaveProperty('contentHash');
    expect(first.windows[0].tokenCount).toBeGreaterThan(0);
    await first.close();
    expect(first.closed).toBe(true);
    const reopened = await loadTextbookRetrievalIndex(root);
    expect(reopened).not.toBe(first);
  });

  it('fails closed for file hash and vector dimension corruption', async () => {
    const hashRoot = await buildIndexFixture();
    await writeFile(path.join(hashRoot, 'vectors.f32'), Buffer.alloc(24));
    await expect(loadTextbookRetrievalIndex(hashRoot)).rejects.toThrow(
      /file hash mismatch: vectors\.f32/u,
    );

    const dimensionRoot = await buildIndexFixture();
    const manifestPath = path.join(dimensionRoot, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.observedDimension = 3;
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    await expect(loadTextbookRetrievalIndex(dimensionRoot)).rejects.toThrow(
      /build report is inconsistent|vector file size is invalid/u,
    );
  });

  it('fails closed when index manifest omits resourceSetId', async () => {
    const root = await buildIndexFixture();
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    delete manifest.resourceSetId;
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    await expect(loadTextbookRetrievalIndex(root)).rejects.toThrow(
      /index manifest shape is invalid/u,
    );
  });

  it('fails closed when build report resourceSetId diverges from manifest', async () => {
    const root = await buildIndexFixture();
    const reportPath = path.join(root, 'build-report.json');
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    report.resourceSetId = 'different-resource-set';
    const reportBytes = Buffer.from(`${JSON.stringify(report)}\n`);
    await writeFile(reportPath, reportBytes);
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.files['build-report.json'] = sha256(reportBytes);
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    await expect(loadTextbookRetrievalIndex(root)).rejects.toThrow(
      /build report is inconsistent/u,
    );
  });

  it('fails closed for legacy, noncanonical, overlapping, and trailing lexical layouts', async () => {
    const legacyRoot = await buildIndexFixture();
    const legacyManifestPath = path.join(legacyRoot, 'manifest.json');
    const legacyManifest = JSON.parse(await readFile(legacyManifestPath, 'utf8'));
    delete legacyManifest.files['lexical-terms.jsonl'];
    delete legacyManifest.files['lexical-postings.bin'];
    legacyManifest.files['lexical-terms.json'] = sha256('legacy');
    await writeFile(legacyManifestPath, `${JSON.stringify(legacyManifest)}\n`);
    await expect(loadTextbookRetrievalIndex(legacyRoot)).rejects.toThrow(
      /index manifest file inventory is invalid/u,
    );

    const overlapRoot = await buildIndexFixture();
    const overlapTermsPath = path.join(overlapRoot, 'lexical-terms.jsonl');
    const overlapTerms = (await readFile(overlapTermsPath, 'utf8'))
      .trim().split('\n').map((line) => JSON.parse(line));
    overlapTerms[2].byteOffset = 0;
    await writeFile(
      overlapTermsPath,
      `${overlapTerms.map((row) => JSON.stringify(row)).join('\n')}\n`,
    );
    await refreshManifestHashes(overlapRoot, ['lexical-terms.jsonl']);
    await expect(loadTextbookRetrievalIndex(overlapRoot)).rejects.toThrow(
      /offsets are not contiguous/u,
    );

    const trailingRoot = await buildIndexFixture();
    const trailingPath = path.join(trailingRoot, 'lexical-postings.bin');
    const trailing = Buffer.concat([await readFile(trailingPath), Buffer.from([0])]);
    await writeFile(trailingPath, trailing);
    await refreshManifestHashes(trailingRoot, ['lexical-postings.bin']);
    await expect(loadTextbookRetrievalIndex(trailingRoot)).rejects.toThrow(
      /do not close over postings binary/u,
    );

    const noncanonicalRoot = await buildIndexFixture();
    const noncanonicalTermsPath = path.join(noncanonicalRoot, 'lexical-terms.jsonl');
    const noncanonicalTerms = (await readFile(noncanonicalTermsPath, 'utf8'))
      .trim().split('\n').map((line) => JSON.parse(line));
    const first = noncanonicalTerms[1];
    const original = await readFile(path.join(noncanonicalRoot, 'lexical-postings.bin'));
    const noncanonical = Buffer.concat([
      Buffer.from([0x81, 0x00]),
      original.subarray(1),
    ]);
    first.byteLength += 1;
    for (const term of noncanonicalTerms.slice(2)) {
      term.byteOffset += 1;
    }
    await writeFile(
      noncanonicalTermsPath,
      `${noncanonicalTerms.map((row) => JSON.stringify(row)).join('\n')}\n`,
    );
    await writeFile(
      path.join(noncanonicalRoot, 'lexical-postings.bin'),
      noncanonical,
    );
    await refreshManifestHashes(noncanonicalRoot, [
      'lexical-terms.jsonl',
      'lexical-postings.bin',
    ]);
    await expect(loadTextbookRetrievalIndex(noncanonicalRoot)).rejects.toThrow(
      /noncanonical varint/u,
    );
  });

  it('rejects tampered source window identity and body offset layout', async () => {
    const identityRoot = await buildIndexFixture();
    const windowsPath = path.join(identityRoot, 'windows.jsonl');
    const rows = (await readFile(windowsPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    rows[0].sourceWindowId = 'textbook-window:fixture/tampered';
    const windowsBytes = Buffer.from(
      `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    );
    await writeFile(windowsPath, windowsBytes);
    const manifestPath = path.join(identityRoot, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.files['windows.jsonl'] = sha256(windowsBytes);
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    await expect(loadTextbookRetrievalIndex(identityRoot)).rejects.toThrow(
      /window metadata is invalid/u,
    );

    const offsetRoot = await buildIndexFixture();
    const offsetPath = path.join(offsetRoot, 'windows.jsonl');
    const offsetRows = (await readFile(offsetPath, 'utf8'))
      .trim().split('\n').map((line) => JSON.parse(line));
    offsetRows[1].bodyOffset += 1;
    await writeFile(
      offsetPath,
      `${offsetRows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    );
    await refreshManifestHashes(offsetRoot, ['windows.jsonl']);
    await expect(loadTextbookRetrievalIndex(offsetRoot)).rejects.toThrow(
      /body offsets are not contiguous/u,
    );
  });

  it('rejects tampered metadata that is discarded after loading', async () => {
    const cases = [
      ['recordType', 'tampered'],
      ['formatVersion', 'tampered'],
      ['vectorRow', 1],
      ['bodyHash', 'sha256:tampered'],
      ['contentHash', 'sha256:tampered'],
      ['tokenCount', -1],
    ] as const;

    for (const [field, value] of cases) {
      const root = await buildIndexFixture();
      const windowsPath = path.join(root, 'windows.jsonl');
      const rows = (await readFile(windowsPath, 'utf8'))
        .trim().split('\n').map((line) => JSON.parse(line));
      rows[0][field] = value;
      await writeFile(
        windowsPath,
        `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
      );
      await refreshManifestHashes(root, ['windows.jsonl']);
      await expect(loadTextbookRetrievalIndex(root)).rejects.toThrow(
        /window metadata is invalid/u,
      );
    }
  });

  it('rejects body tampering through the manifest file hash', async () => {
    const root = await buildIndexFixture();
    const bodyPath = path.join(root, 'bodies.utf8');
    const body = await readFile(bodyPath);
    body[0] ^= 1;
    await writeFile(bodyPath, body);
    await expect(loadTextbookRetrievalIndex(root)).rejects.toThrow(
      /file hash mismatch: bodies\.utf8/u,
    );
  });

  it('fails closed when build provider evidence violates the new contract', async () => {
    const root = await buildIndexFixture();
    const reportPath = path.join(root, 'build-report.json');
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    report.providerUsageTokens = -1;
    const reportBytes = Buffer.from(`${JSON.stringify(report)}\n`);
    await writeFile(reportPath, reportBytes);
    const manifestPath = path.join(root, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.files['build-report.json'] = sha256(reportBytes);
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    await expect(loadTextbookRetrievalIndex(root)).rejects.toThrow(
      /build report is inconsistent/u,
    );
  });

  it('uses exact vector dot ranking without lexical hits', async () => {
    const root = await buildIndexFixture();
    const response = await retrieve('unseen-query', {
      indexRoot: root,
      embeddingClient: embedding([0, 1]),
    });
    expect(response.mode).toBe('lexical-vector');
    expect(response.results[0]).toMatchObject({
      windowId: 'textbook-window:fixture/formula',
      primaryUnitId: 'textbook-unit:fixture/1',
      owningUnitIds: ['textbook-unit:fixture/1'],
      bookId: 'fixture-book',
      sourcePaths: ['chapter-01/formula.md'],
      body: '单位阶跃响应 G(s)=1/(s+1)',
      scores: { vector: 1 },
    });
  });

  it('falls back to lexical ranking with stable development diagnostics', async () => {
    const root = await buildIndexFixture();
    const response = await retrieve('单位阶跃响应', {
      indexRoot: root,
      embeddingClient: {
        embed: vi.fn(async () => {
          throw new Error('private vendor response');
        }),
      },
    });
    expect(response.mode).toBe('lexical');
    expect(response.results[0].windowId).toBe('textbook-window:fixture/formula');
    expect(response.diagnostics).toEqual([
      expect.objectContaining({
        stage: 'embedding',
        code: 'provider-unavailable',
      }),
    ]);
    expect(JSON.stringify(response)).not.toContain('private vendor response');
  });

  it('preserves the prior lexical frequency ranking exactly', async () => {
    const root = await buildIndexFixture();
    const query = '反馈控制 feedback control';
    const bodies = [
      '反馈控制 feedback control',
      '单位阶跃响应 G(s)=1/(s+1)',
      '稳定裕度 phase margin',
    ];
    const expected = bodies.map((body, row) => {
      const frequencies = new Map<string, number>();
      for (const token of lexicalTokens(body)) {
        frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
      }
      return {
        row,
        score: lexicalTokens(query).reduce(
          (score, token) => score + (frequencies.get(token) ?? 0),
          0,
        ),
      };
    }).filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || left.row - right.row);
    const response = await retrieve(query, {
      indexRoot: root,
      embeddingClient: {
        embed: vi.fn(async () => {
          throw new Error('offline');
        }),
      },
    });
    expect(response.results.map((result) => result.scores.lexical))
      .toEqual(expected.map(({ score }) => score));
    expect(response.results.map((result) => result.windowId))
      .toEqual(expected.map(({ row }) => [
        'textbook-window:fixture/feedback',
        'textbook-window:fixture/formula',
        'textbook-window:fixture/stability',
      ][row]));
  });

  it('gates BM25 and source-local vector ranks and exposes all four score bases', async () => {
    const root = await buildIndexFixture('', {
      windows: [
        {
          id: 'textbook-window:hu/primary',
          body: '中文 中文 术语 反馈控制',
          sourcePath: 'hu/primary.md',
          bookId: 'hu-shousong-auto-control-8th',
        },
        {
          id: 'textbook-window:hu/secondary',
          body: '中文 术语 反馈控制',
          sourcePath: 'hu/secondary.md',
          bookId: 'hu-shousong-auto-control-8th',
        },
        {
          id: 'textbook-window:dorf/control',
          body: '中文 术语 现代控制',
          sourcePath: 'dorf/control.md',
          bookId: 'dorf-modern-control-systems',
        },
        {
          id: 'textbook-window:reference/stability',
          body: '普通查询 稳定裕度',
          sourcePath: 'reference/stability.md',
          bookId: 'reference-work',
        },
      ],
      vectors: [
        [1, 0],
        [0.8, 0.6],
        [0, 1],
        [-1, 0],
      ],
      books: [
        { bookId: 'hu-shousong-auto-control-8th', edition: '第八版' },
        { bookId: 'dorf-modern-control-systems', edition: '14th Global Edition' },
        { bookId: 'reference-work', edition: '2015版' },
      ],
    });
    const ordinary = await retrieve('反馈控制', {
      indexRoot: root,
      embeddingClient: embedding([1, 0]),
    });
    expect(ordinary.results.every((result) =>
      result.scores.bm25 === undefined
      && result.scores.sourceLocalVector === undefined)).toBe(true);

    const bilingual = await retrieve('反馈控制中文叫什么', {
      indexRoot: root,
      embeddingClient: embedding([1, 0]),
    });
    expect(bilingual.results.some((result) => result.scores.bm25 !== undefined))
      .toBe(true);
    expect(bilingual.results.every((result) =>
      result.scores.sourceLocalVector === undefined)).toBe(true);

    const bookIdMatch = await retrieve('hu shousong 反馈控制', {
      indexRoot: root,
      embeddingClient: embedding([1, 0]),
    });
    expect(bookIdMatch.results.filter((result) =>
      result.bookId === 'hu-shousong-auto-control-8th')
      .every((result) => result.scores.sourceLocalVector !== undefined)).toBe(true);
    expect(bookIdMatch.results.filter((result) =>
      result.bookId !== 'hu-shousong-auto-control-8th')
      .every((result) => result.scores.sourceLocalVector === undefined)).toBe(true);

    const editionMatch = await retrieve('第八版 反馈控制', {
      indexRoot: root,
      embeddingClient: embedding([1, 0]),
    });
    expect(editionMatch.results.filter((result) =>
      result.bookId === 'hu-shousong-auto-control-8th')
      .every((result) => result.scores.sourceLocalVector !== undefined)).toBe(true);

    const fourChannel = await retrieve(
      'hu shousong 8th 第八版 反馈控制中文叫什么',
      {
        indexRoot: root,
        embeddingClient: embedding([1, 0]),
      },
    );
    const primary = fourChannel.results.find((result) =>
      result.windowId === 'textbook-window:hu/primary');
    expect(primary?.scores).toMatchObject({
      lexical: expect.any(Number),
      vector: 1,
      bm25: expect.any(Number),
      sourceLocalVector: 1,
    });
    expect(primary?.scores.fused).toBeCloseTo(3 / 61 + 1.5 / 62, 12);
  });

  it('breaks a final fused-score tie by source priority before row', async () => {
    const root = await buildIndexFixture('', {
      windows: [
        {
          id: 'textbook-window:lower-priority/lexical-first',
          body: '反馈反馈',
          sourcePath: 'lower/lexical.md',
          bookId: 'lower-priority-book',
        },
        {
          id: 'textbook-window:higher-priority/vector-first',
          body: '反馈',
          sourcePath: 'higher/vector.md',
          bookId: 'higher-priority-book',
        },
      ],
      vectors: [
        [0, 1],
        [1, 0],
      ],
      books: [
        { bookId: 'lower-priority-book', edition: 'lower' },
        { bookId: 'higher-priority-book', edition: 'higher' },
      ],
      sourcePriority: ['higher-priority-book', 'lower-priority-book'],
    });
    const response = await retrieve('反馈', {
      indexRoot: root,
      embeddingClient: embedding([1, 0]),
    });
    expect(response.results.map((result) => result.windowId)).toEqual([
      'textbook-window:higher-priority/vector-first',
      'textbook-window:lower-priority/lexical-first',
    ]);
    expect(response.results[0].scores.fused)
      .toBeCloseTo(response.results[1].scores.fused, 15);
  });

  it('rejects model and dimension mismatch into lexical fallback', async () => {
    const root = await buildIndexFixture();
    const modelMismatch = await retrieve('反馈控制', {
      indexRoot: root,
      embeddingClient: embedding([1, 0], 'other/model'),
    });
    expect(modelMismatch.mode).toBe('lexical');
    expect(modelMismatch.diagnostics?.[0].code).toBe('model-mismatch');

    const dimensionMismatch = await retrieve('反馈控制', {
      indexRoot: root,
      embeddingClient: embedding([1, 0, 0]),
    });
    expect(dimensionMismatch.mode).toBe('lexical');
    expect(dimensionMismatch.diagnostics?.[0].code).toBe('dimension-mismatch');
  });

  it('keeps local fused order on malformed rerank and timeout', async () => {
    const root = await buildIndexFixture();
    const base = await retrieve('反馈控制', {
      indexRoot: root,
      embeddingClient: embedding([1, 0]),
    });
    const malformed: TextbookRerankClient = {
      rerank: vi.fn(async () => ({
        results: [{ index: 0, score: 1 }, { index: 0, score: 0 }],
      })),
    };
    const malformedResult = await retrieve('反馈控制', {
      indexRoot: root,
      embeddingClient: embedding([1, 0]),
      rerankClient: malformed,
      rerankModel: 'fixture/rerank',
    });
    expect(malformedResult.results.map((row) => row.windowId))
      .toEqual(base.results.map((row) => row.windowId));
    expect(malformedResult.diagnostics?.at(-1)?.code).toBe('invalid-response');

    const timeout: TextbookRerankClient = {
      rerank: vi.fn(() => new Promise<never>(() => undefined)),
    };
    const timeoutResult = await retrieve('反馈控制', {
      indexRoot: root,
      embeddingClient: embedding([1, 0]),
      rerankClient: timeout,
      rerankModel: 'fixture/rerank',
      rerankTimeoutMs: 5,
    });
    expect(timeoutResult.results.map((row) => row.windowId))
      .toEqual(base.results.map((row) => row.windowId));
    expect(timeoutResult.diagnostics?.at(-1)?.code).toBe('timeout');
  });

  it('sends only normalized query, model, and bounded candidate bodies', async () => {
    const root = await buildIndexFixture();
    const embedClient = embedding([1, 0]);
    const rerankClient: TextbookRerankClient = {
      rerank: vi.fn(async () => ({ results: [{ index: 1, score: 2 }] })),
    };
    const response = await retrieve('ＦＥＥＤＢＡＣＫ Control', {
      indexRoot: root,
      embeddingClient: embedClient,
      rerankClient,
      rerankModel: 'fixture/rerank',
    });
    expect(embedClient.embed).toHaveBeenCalledWith({
      model: 'fixture/embedding',
      input: 'feedback control',
      signal: expect.any(AbortSignal),
    });
    expect(rerankClient.rerank).toHaveBeenCalledWith({
      model: 'fixture/rerank',
      query: 'feedback control',
      documents: expect.arrayContaining([
        expect.objectContaining({
          index: expect.any(Number),
          text: expect.any(String),
        }),
      ]),
      signal: expect.any(AbortSignal),
    });
    const rerankRequest = vi.mocked(rerankClient.rerank).mock.calls[0][0];
    expect(rerankRequest.documents.length).toBeLessThanOrEqual(24);
    expect(Object.keys(rerankRequest).sort())
      .toEqual(['documents', 'model', 'query', 'signal']);
    expect(response.results[0].scores.rerank).toBe(2);
    await expect(retrieve({ learnerId: 'private' } as unknown as string, {
      indexRoot: root,
      embeddingClient: embedClient,
    })).rejects.toThrow(TypeError);
  });

  it('reads UTF-8 bodies by positional offsets and exposes measurable budgets', async () => {
    const root = await buildIndexFixture();
    const index = await loadTextbookRetrievalIndex(root);
    const response = await retrieve('稳定裕度', {
      indexRoot: root,
      embeddingClient: embedding([Math.SQRT1_2, Math.SQRT1_2]),
    });
    expect(response.results.find(
      (row) => row.windowId === 'textbook-window:fixture/stability',
    )?.body).toBe('稳定裕度 phase margin');
    expect(index.vectorBuffer.buffer).toBe(index.vectors.buffer);
    expect(index.stats).toMatchObject({
      bodyResidentBytes: 0,
      residentArtifactBudgetBytes: 150 * 1024 * 1024,
      residentArtifactPassed: true,
      lexicalTermsBytes: expect.any(Number),
      lexicalPostingsBytes: expect.any(Number),
      windows: 3,
      dimensions: 2,
    });
    expect(index.stats.residentArtifactBytes).toBeGreaterThanOrEqual(
      index.stats.lexicalTermsBytes + index.stats.lexicalPostingsBytes,
    );
    expect(index.stats.residentArtifactBytes).toBeLessThan(150 * 1024 * 1024);
    expect(index.stats.artifactBytes).toBeGreaterThan(index.vectorBuffer.length);
  });

  it('decodes posting slices only for query tokens present in the dictionary', async () => {
    const root = await buildIndexFixture();
    const index = await loadTextbookRetrievalIndex(root);
    const decode = vi.spyOn(index, 'decodePostings');
    await retrieve('稳定裕度 absent_token', {
      indexRoot: root,
      embeddingClient: {
        embed: vi.fn(async () => {
          throw new Error('offline');
        }),
      },
    });
    expect(decode.mock.calls.map(([token]) => token))
      .toEqual(lexicalTokens('稳定裕度').filter(
        (token) => index.lexicalTerms.has(token),
      ));
  });

  it('hides provider diagnostics in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const root = await buildIndexFixture();
    const response = await retrieve('反馈控制', {
      indexRoot: root,
      embeddingClient: {
        embed: vi.fn(async () => {
          throw new TextbookRetrievalContractError('vendor body');
        }),
      },
    });
    expect(response.diagnostics).toBeUndefined();
    expect(JSON.stringify(response)).not.toContain('vendor body');
  });

  it('scores only final runtime Top-10 results and records lexical fallback safely', async () => {
    const fixture = await buildRuntimeAcceptanceFixture();
    const embeddingCalls = vi.fn(async (request: { input: string }) => {
      if (request.input === 'SECRET_FALLBACK_QUERY') {
        const error = new Error('PRIVATE_PROVIDER_BODY');
        Object.assign(error, { traceId: 'embedding-timeout-trace' });
        throw error;
      }
      return {
        embedding: Array.from({ length: 1024 }, (_, index) => index === 0 ? 1 : 0),
        model: 'BAAI/bge-m3',
        traceId: 'embedding-success-trace',
      };
    });
    const rerankCalls = vi.fn(async () => ({
      results: [{ index: 1, score: 1 }],
      traceId: 'rerank-changed-top10-trace',
    }));
    class MockEmbeddingClient {
      embed = embeddingCalls;
    }
    class MockRerankClient {
      rerank = rerankCalls;
    }
    const finalResult = (
      windowId: string,
      unitId: string,
      body: string,
    ) => ({
      windowId,
      primaryUnitId: unitId,
      owningUnitIds: [unitId],
      segments: [{ owningUnitId: unitId, body }],
      bookId: 'fixture-book',
      sourcePaths: ['/PRIVATE/PHYSICAL/PATH.md'],
      body,
      scores: { fused: 1 },
    });
    const retrieveTextbookHybrid = vi.fn(async (
      query: string,
      options: {
        embeddingClient: { embed(request: { input: string }): Promise<unknown> };
        rerankClient: { rerank(request: unknown): Promise<{ results: Array<{ index: number }> }> };
      },
    ) => {
      try {
        await options.embeddingClient.embed({ input: query });
      } catch {
        return {
          mode: 'lexical',
          results: [
            finalResult(
              'textbook-window:fixture/fallback',
              'textbook-unit:fixture/fallback',
              'PRIVATE_LEXICAL_BODY',
            ),
          ],
          diagnostics: [{
            stage: 'embedding',
            code: 'timeout',
            latencyMs: 1000,
            traceId: 'embedding-timeout-trace',
          }],
        };
      }
      const reranked = await options.rerankClient.rerank({
        documents: Array.from({ length: 24 }, (_, index) => ({
          index,
          text: `PRIVATE_CANDIDATE_BODY_${index}`,
        })),
      });
      return {
        mode: 'lexical-vector',
        results: reranked.results[0].index === 1
          ? [
            finalResult(
              'textbook-window:fixture/known',
              'textbook-unit:fixture/known',
              'PRIVATE_RERANKED_BODY',
            ),
          ]
          : [
            finalResult(
              'textbook-window:fixture/fallback',
              'textbook-unit:fixture/fallback',
              'PRIVATE_LOCAL_FUSION_BODY',
            ),
          ],
      };
    });
    const closeTextbookRetrievalIndex = vi.fn(async () => undefined);
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const report = await runAcceptance(fixture.args, {
        loadTextbookRetrievalIndex: vi.fn(async () => fixture.index),
        closeTextbookRetrievalIndex,
        retrieveTextbookHybrid,
        SiliconFlowTextbookEmbeddingClient: MockEmbeddingClient,
        SiliconFlowTextbookRerankClient: MockRerankClient,
      });
      expect(retrieveTextbookHybrid).toHaveBeenCalledTimes(2);
      expect(retrieveTextbookHybrid.mock.calls.map(([query]) => query)).toEqual([
        'SECRET_KNOWN_FAILURE_QUERY',
        'SECRET_FALLBACK_QUERY',
      ]);
      expect(retrieveTextbookHybrid).not.toHaveBeenCalledWith(
        'TUNING_QUERY_MUST_NOT_LOAD',
        expect.anything(),
      );
      expect(retrieveTextbookHybrid.mock.calls[0][1]).toMatchObject({
        topK: 10,
        candidateCount: 24,
        embeddingTimeoutMs: 1000,
        rerankModel: 'BAAI/bge-reranker-v2-m3',
        rerankTimeoutMs: 2000,
      });
      expect(rerankCalls).toHaveBeenCalledTimes(1);
      expect(report).toMatchObject({
        evaluatedQueries: 2,
        hitsAt10: 2,
        recallAt10: 1,
        threshold: 0.8,
        knownFailureHit: true,
        allResultsResolved: true,
        passed: true,
        queries: [
          {
            queryId: 'known-failure-first-order-unit-step-response',
            hit: true,
            outcome: 'success',
          },
          {
            queryId: 'blind-runtime-fallback',
            hit: true,
            outcome: 'fallback',
            providerFailures: [
              expect.objectContaining({
                stage: 'embedding',
                code: 'timeout',
                traceId: 'embedding-timeout-trace',
              }),
            ],
          },
        ],
      });
      const written = await readFile(fixture.outputPath, 'utf8');
      expect(written).not.toMatch(
        /SECRET_|PRIVATE_|textbook-runtime-acceptance-|selected-index/u,
      );
      expect(written).not.toContain('TUNING_QUERY_MUST_NOT_LOAD');
      expect(closeTextbookRetrievalIndex).toHaveBeenCalledWith(fixture.index);
    } finally {
      stdout.mockRestore();
    }
  });

  it('fails closed before retrieval when the locked config identity drifts', async () => {
    const fixture = await buildRuntimeAcceptanceFixture();
    const config = JSON.parse(await readFile(fixture.configPath, 'utf8'));
    config.selectedModel = 'Qwen/Qwen3-Embedding-0.6B';
    await writeFile(fixture.configPath, `${JSON.stringify(config, null, 2)}\n`);
    const retrieveTextbookHybrid = vi.fn();
    const closeTextbookRetrievalIndex = vi.fn(async () => undefined);
    await expect(runAcceptance(fixture.args, {
      loadTextbookRetrievalIndex: vi.fn(async () => fixture.index),
      closeTextbookRetrievalIndex,
      retrieveTextbookHybrid,
      SiliconFlowTextbookEmbeddingClient: class {},
      SiliconFlowTextbookRerankClient: class {},
    })).rejects.toThrow(/locked runtime acceptance configuration/u);
    expect(retrieveTextbookHybrid).not.toHaveBeenCalled();
    expect(closeTextbookRetrievalIndex).toHaveBeenCalledWith(fixture.index);
  });
});
