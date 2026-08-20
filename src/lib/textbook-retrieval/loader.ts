import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  open,
  readFile,
  realpath,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

import { TextbookRetrievalContractError } from './errors';
import {
  normalizeText,
  TEXTBOOK_RETRIEVAL_FORMAT_VERSION,
  TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION,
} from './normalization';
import type {
  LoadedTextbookIndexWindow,
  LoadedTextbookRetrievalIndex,
  TextbookIndexManifest,
  TextbookLexicalTerm,
} from './types';

const FILE_NAMES = [
  'bodies.utf8',
  'windows.jsonl',
  'lexical-terms.jsonl',
  'lexical-postings.bin',
  'vectors.f32',
  'build-report.json',
] as const;
const RESIDENT_ARTIFACT_BUDGET_BYTES = 150 * 1024 * 1024;
const SHA256_READ_BUFFER_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SAFE_TRACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const sharedIndexes = new Map<string, Promise<LoadedTextbookRetrievalIndex>>();

function fail(message: string): never {
  throw new TextbookRetrievalContractError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length
    && actual.every((key, index) => key === [...keys].sort()[index]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function percentile(values: number[], fraction: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper
    ? ordered[lower]
    : ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower);
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right)
    <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function parseJson(bytes: Buffer, name: string): unknown {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return fail(`${name} is not valid JSON`);
  }
}

function sha256Bytes(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const handle = await open(filePath, 'r');
  const buffer = Buffer.allocUnsafeSlow(SHA256_READ_BUFFER_BYTES);
  try {
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
  } finally {
    await handle.close();
  }
  return `sha256:${hash.digest('hex')}`;
}

async function readExactly(
  handle: Awaited<ReturnType<typeof open>>,
  buffer: Buffer,
  position: number,
): Promise<void> {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await handle.read(
      buffer,
      offset,
      buffer.length - offset,
      position + offset,
    );
    if (bytesRead === 0) fail('unexpected end of index file');
    offset += bytesRead;
  }
}

function validateManifest(value: unknown): TextbookIndexManifest {
  if (!isRecord(value) || !hasExactKeys(value, [
    'recordType', 'formatVersion', 'sourceRevision', 'resourceSetId', 'model',
    'observedDimension', 'normalizationVersion', 'vectorNormalization',
    'vectorEncoding', 'books', 'sourcePriority', 'counts', 'files',
    'productionConnected',
  ])) fail('index manifest shape is invalid');
  if (
    value.recordType !== 'index-manifest'
    || value.formatVersion !== TEXTBOOK_RETRIEVAL_FORMAT_VERSION
    || value.normalizationVersion !== TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION
    || value.vectorNormalization !== 'l2'
    || value.vectorEncoding !== 'float32-le'
    || value.productionConnected !== false
    || !isNonEmptyString(value.sourceRevision)
    || !isNonEmptyString(value.resourceSetId)
    || !isNonEmptyString(value.model)
    || !Number.isInteger(value.observedDimension)
    || (value.observedDimension as number) <= 0
  ) fail('index manifest identity is invalid');

  if (!Array.isArray(value.books) || value.books.length === 0) {
    fail('index manifest books are invalid');
  }
  const bookIds = new Set<string>();
  for (const book of value.books) {
    if (
      !isRecord(book)
      || !hasExactKeys(book, ['bookId', 'edition', 'manifestHash', 'sourceHashes'])
      || !isNonEmptyString(book.bookId)
      || bookIds.has(book.bookId)
      || !isNonEmptyString(book.edition)
      || !isSha256(book.manifestHash)
      || !isRecord(book.sourceHashes)
      || Object.keys(book.sourceHashes).length === 0
      || Object.values(book.sourceHashes).some((hash) => !isSha256(hash))
    ) fail('index manifest book identity is invalid');
    bookIds.add(book.bookId);
  }
  if (
    !Array.isArray(value.sourcePriority)
    || value.sourcePriority.length !== bookIds.size
    || new Set(value.sourcePriority).size !== value.sourcePriority.length
    || value.sourcePriority.some((bookId) => !bookIds.has(bookId))
  ) fail('index source priority is invalid');

  if (
    !isRecord(value.counts)
    || !hasExactKeys(value.counts, [
      'books', 'windows', 'vectors', 'bodyBytes', 'lexicalTerms',
    ])
    || Object.values(value.counts).some((count) =>
      !Number.isInteger(count) || (count as number) < 0)
    || value.counts.books !== value.books.length
    || (value.counts.books as number) < 1
    || (value.counts.windows as number) < 1
    || value.counts.vectors !== value.counts.windows
  ) fail('index manifest counts are invalid');
  if (
    !isRecord(value.files)
    || !hasExactKeys(value.files, FILE_NAMES)
    || Object.values(value.files).some((hash) => !isSha256(hash))
  ) fail('index manifest file inventory is invalid');
  return value as unknown as TextbookIndexManifest;
}

async function parseWindows(filePath: string): Promise<LoadedTextbookIndexWindow[]> {
  const rows: LoadedTextbookIndexWindow[] = [];
  const ids = new Set<string>();
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let rowIndex = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return fail(`windows.jsonl:${rowIndex + 1} is not valid JSON`);
    }
    if (
      !isRecord(value)
      || !hasExactKeys(value, [
        'recordType', 'formatVersion', 'id', 'bookId', 'sourceRevision',
        'sourceWindowId',
        'primaryUnitId', 'owningUnitIds', 'segments', 'sourcePaths', 'vectorRow',
        'bodyOffset', 'bodyLength', 'bodyHash', 'contentHash', 'tokenCount',
      ])
      || value.recordType !== 'index-window'
      || value.formatVersion !== TEXTBOOK_RETRIEVAL_FORMAT_VERSION
      || !isNonEmptyString(value.id)
      || !value.id.startsWith('textbook-window:')
      || ids.has(value.id)
      || !isNonEmptyString(value.sourceWindowId)
      || !value.sourceWindowId.startsWith('textbook-window:')
      || (
        value.id !== value.sourceWindowId
        && !value.id.startsWith(`${value.sourceWindowId}::embedding-chunk-`)
      )
      || !isNonEmptyString(value.bookId)
      || !isNonEmptyString(value.sourceRevision)
      || !isNonEmptyString(value.primaryUnitId)
      || !value.primaryUnitId.startsWith('textbook-unit:')
      || !Array.isArray(value.owningUnitIds)
      || value.owningUnitIds.length === 0
      || new Set(value.owningUnitIds).size !== value.owningUnitIds.length
      || value.owningUnitIds.some((id) =>
        !isNonEmptyString(id) || !id.startsWith('textbook-unit:'))
      || !value.owningUnitIds.includes(value.primaryUnitId)
      || !Array.isArray(value.segments)
      || value.segments.length === 0
      || value.segments.some((segment) =>
        !isRecord(segment)
        || !hasExactKeys(segment, ['owningUnitId', 'bodyOffset', 'bodyLength'])
        || !isNonEmptyString(segment.owningUnitId)
        || !(value.owningUnitIds as unknown[]).includes(segment.owningUnitId)
        || !Number.isInteger(segment.bodyOffset)
        || (segment.bodyOffset as number) < 0
        || !Number.isInteger(segment.bodyLength)
        || (segment.bodyLength as number) <= 0)
      || !segmentsCloseBody(value.segments, value.bodyLength)
      || !Array.isArray(value.sourcePaths)
      || value.sourcePaths.length === 0
      || new Set(value.sourcePaths).size !== value.sourcePaths.length
      || value.sourcePaths.some((sourcePath) => !isNonEmptyString(sourcePath))
      || value.vectorRow !== rowIndex
      || !Number.isInteger(value.bodyOffset)
      || (value.bodyOffset as number) < 0
      || !Number.isInteger(value.bodyLength)
      || (value.bodyLength as number) < 0
      || !isSha256(value.bodyHash)
      || !isSha256(value.contentHash)
      || !Number.isInteger(value.tokenCount)
      || (value.tokenCount as number) < 0
    ) fail('window metadata is invalid');
    ids.add(value.id);
    rows.push({
      id: value.id,
      sourceWindowId: value.sourceWindowId,
      bookId: value.bookId,
      sourceRevision: value.sourceRevision,
      primaryUnitId: value.primaryUnitId,
      owningUnitIds: value.owningUnitIds,
      segments: value.segments,
      sourcePaths: value.sourcePaths,
      bodyOffset: value.bodyOffset,
      bodyLength: value.bodyLength,
      tokenCount: value.tokenCount,
    } as LoadedTextbookIndexWindow);
    rowIndex += 1;
  }
  return rows;
}

function segmentsCloseBody(
  segments: readonly Record<string, unknown>[],
  bodyLength: unknown,
): boolean {
  if (!Number.isInteger(bodyLength) || (bodyLength as number) < 0) return false;
  let nextOffset = 0;
  for (const segment of segments) {
    if (segment.bodyOffset !== nextOffset || !Number.isInteger(segment.bodyLength)) return false;
    nextOffset += segment.bodyLength as number;
  }
  return nextOffset === bodyLength;
}

function validateBodyLayout(
  windows: LoadedTextbookIndexWindow[],
  expectedBytes: number,
): void {
  let nextOffset = 0;
  for (const window of windows) {
    if (window.bodyOffset !== nextOffset) fail('window body offsets are not contiguous');
    const end = nextOffset + window.bodyLength;
    if (!Number.isSafeInteger(end) || end > expectedBytes) {
      fail(`window body range is invalid: ${window.id}`);
    }
    nextOffset = end;
  }
  if (nextOffset !== expectedBytes) fail('body offsets do not close over bodies.utf8');
}

function readUnsignedVarint(
  buffer: Buffer,
  start: number,
  end: number,
): readonly [number, number] {
  let value = 0;
  let shift = 0;
  let offset = start;
  while (offset < end) {
    if (shift > 49) fail('varint value exceeds the supported range');
    const byte = buffer[offset];
    offset += 1;
    const payload = byte & 0x7f;
    value += payload * (2 ** shift);
    if (!Number.isSafeInteger(value)) fail('varint value exceeds the supported range');
    if (byte < 0x80) {
      if (offset - start > 1 && payload === 0) {
        fail('lexical postings contain noncanonical varint');
      }
      return [value, offset];
    }
    shift += 7;
  }
  return fail('lexical postings contain a truncated varint');
}

function scanPostingSlice(
  buffer: Buffer,
  term: TextbookLexicalTerm,
  windows: number,
  visitor?: (row: number, frequency: number) => void,
): void {
  const end = term.byteOffset + term.byteLength;
  if (end > buffer.length) fail('lexical term slice exceeds postings binary');
  let offset = term.byteOffset;
  let previous = -1;
  for (let index = 0; index < term.postingCount; index += 1) {
    const [delta, afterDelta] = readUnsignedVarint(buffer, offset, end);
    const [frequency, afterFrequency] = readUnsignedVarint(
      buffer, afterDelta, end,
    );
    const row = previous + delta;
    if (delta <= 0 || row <= previous || row >= windows || frequency <= 0) {
      fail('lexical posting row is invalid');
    }
    visitor?.(row, frequency);
    previous = row;
    offset = afterFrequency;
  }
  if (offset !== end) fail('lexical posting count does not close its slice');
}

async function loadLexicalIndex(
  filePath: string,
  postingsBuffer: Buffer,
  windows: number,
): Promise<Map<string, TextbookLexicalTerm>> {
  const terms = new Map<string, TextbookLexicalTerm>();
  let nextOffset = 0;
  let previousToken: string | undefined;
  let recordIndex = 0;
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return fail(`lexical-terms.jsonl:${recordIndex + 1} is not valid JSON`);
    }
    if (recordIndex === 0) {
      if (
        !isRecord(value)
        || !hasExactKeys(value, [
          'recordType', 'formatVersion', 'normalizationVersion',
        ])
        || value.recordType !== 'lexical-terms-header'
        || value.formatVersion !== TEXTBOOK_RETRIEVAL_FORMAT_VERSION
        || value.normalizationVersion !== TEXTBOOK_RETRIEVAL_NORMALIZATION_VERSION
      ) fail('lexical terms identity is invalid');
      recordIndex += 1;
      continue;
    }
    const rawTerm = value;
    const token = isRecord(rawTerm) ? rawTerm.token : undefined;
    if (
      typeof token !== 'string'
      || token.length === 0
      || token !== normalizeText(token)
      || !isRecord(rawTerm)
      || !hasExactKeys(rawTerm, [
        'recordType', 'token', 'byteOffset', 'byteLength', 'postingCount',
      ])
      || rawTerm.recordType !== 'lexical-term'
      || (previousToken !== undefined && compareUtf8(token, previousToken) <= 0)
      || rawTerm.byteOffset !== nextOffset
      || !Number.isSafeInteger(rawTerm.byteOffset)
      || (rawTerm.byteOffset as number) < 0
      || !Number.isSafeInteger(rawTerm.byteLength)
      || (rawTerm.byteLength as number) <= 0
      || !Number.isSafeInteger(rawTerm.postingCount)
      || (rawTerm.postingCount as number) <= 0
    ) {
      fail('lexical term offsets are not contiguous and normalized');
    }
    const term: TextbookLexicalTerm = {
      byteOffset: rawTerm.byteOffset as number,
      byteLength: rawTerm.byteLength as number,
      postingCount: rawTerm.postingCount as number,
    };
    scanPostingSlice(postingsBuffer, term, windows);
    terms.set(token, term);
    nextOffset += term.byteLength;
    previousToken = token;
    recordIndex += 1;
  }
  if (recordIndex === 0) fail('lexical terms identity is invalid');
  if (nextOffset !== postingsBuffer.length) {
    fail('lexical term offsets do not close over postings binary');
  }
  return terms;
}

async function loadVectorBuffer(
  filePath: string,
  rows: number,
  dimensions: number,
): Promise<{ buffer: Buffer; vectors: Float32Array }> {
  const expectedBytes = rows * dimensions * 4;
  const fileStat = await stat(filePath);
  if (fileStat.size !== expectedBytes) fail('vector file size is invalid');
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafeSlow(expectedBytes);
    await readExactly(handle, buffer, 0);
    const vectors = new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      rows * dimensions,
    );
    for (let row = 0; row < rows; row += 1) {
      let normSquared = 0;
      const start = row * dimensions;
      for (let column = 0; column < dimensions; column += 1) {
        const value = vectors[start + column];
        if (!Number.isFinite(value)) fail('vector matrix contains a non-finite value');
        normSquared += value * value;
      }
      if (Math.abs(Math.sqrt(normSquared) - 1) > 1e-5) {
        fail('vector matrix contains a non-unit vector');
      }
    }
    return { buffer, vectors };
  } finally {
    await handle.close();
  }
}

function validateBuildReport(
  value: unknown,
  manifest: TextbookIndexManifest,
): void {
  const fileHashes = isRecord(value) && isRecord(value.fileHashes)
    ? value.fileHashes
    : undefined;
  const providerLatency = isRecord(value) && isRecord(value.providerLatencyMs)
    ? value.providerLatencyMs
    : undefined;
  const latencySamples = providerLatency?.samples;
  const traceIds = isRecord(value) ? value.providerTraceIds : undefined;
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      'recordType', 'formatVersion', 'status', 'sourceRevision', 'resourceSetId', 'model',
      'observedDimension', 'normalizationVersion', 'bookCount', 'windowCount',
      'cacheHits', 'cacheMisses', 'providerBatches', 'providerUsageTokens',
      'providerLatencyMs', 'providerTraceIds', 'fileHashes',
    ])
    || value.recordType !== 'build-report'
    || value.formatVersion !== TEXTBOOK_RETRIEVAL_FORMAT_VERSION
    || value.status !== 'complete'
    || value.sourceRevision !== manifest.sourceRevision
    || value.resourceSetId !== manifest.resourceSetId
    || value.model !== manifest.model
    || value.observedDimension !== manifest.observedDimension
    || value.normalizationVersion !== manifest.normalizationVersion
    || value.bookCount !== manifest.counts.books
    || value.windowCount !== manifest.counts.windows
    || !Number.isInteger(value.cacheHits)
    || (value.cacheHits as number) < 0
    || !Number.isInteger(value.cacheMisses)
    || (value.cacheMisses as number) < 0
    || (value.cacheHits as number) + (value.cacheMisses as number)
      !== manifest.counts.windows
    || !Number.isInteger(value.providerBatches)
    || (value.providerBatches as number) < 0
    || !Number.isInteger(value.providerUsageTokens)
    || (value.providerUsageTokens as number) < 0
    || !providerLatency
    || !hasExactKeys(providerLatency, [
      'batchCount', 'samples', 'p50', 'p95', 'total',
    ])
    || !Array.isArray(latencySamples)
    || latencySamples.some((sample) => !isNonNegativeFiniteNumber(sample))
    || providerLatency.batchCount !== latencySamples.length
    || providerLatency.batchCount !== value.providerBatches
    || !isNonNegativeFiniteNumber(providerLatency.p50)
    || !isNonNegativeFiniteNumber(providerLatency.p95)
    || !isNonNegativeFiniteNumber(providerLatency.total)
    || (
      latencySamples.length === 0
        ? providerLatency.p50 !== 0
          || providerLatency.p95 !== 0
          || providerLatency.total !== 0
        : !approximatelyEqual(providerLatency.p50, percentile(latencySamples, 0.5))
          || !approximatelyEqual(providerLatency.p95, percentile(latencySamples, 0.95))
          || !approximatelyEqual(
            providerLatency.total,
            latencySamples.reduce((total, sample) => total + sample, 0),
          )
    )
    || ((value.cacheMisses as number) === 0)
      !== ((value.providerBatches as number) === 0)
    || !Array.isArray(traceIds)
    || new Set(traceIds).size !== traceIds.length
    || traceIds.length > (value.providerBatches as number)
    || traceIds.some((traceId) =>
      typeof traceId !== 'string' || !SAFE_TRACE_ID_PATTERN.test(traceId))
    || !fileHashes
    || !hasExactKeys(
      fileHashes,
      [
        'bodies.utf8',
        'windows.jsonl',
        'lexical-terms.jsonl',
        'lexical-postings.bin',
        'vectors.f32',
      ],
    )
    || ![
      'bodies.utf8',
      'windows.jsonl',
      'lexical-terms.jsonl',
      'lexical-postings.bin',
      'vectors.f32',
    ]
      .every((name) => fileHashes[name] === manifest.files[name])
  ) fail('build report is inconsistent with the index');
}

async function loadIndex(
  root: string,
  manifestBytes: Buffer,
  manifestHash: string,
  cacheKey: string,
): Promise<LoadedTextbookRetrievalIndex> {
  let bodiesHandle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const manifest = validateManifest(parseJson(manifestBytes, 'manifest.json'));
    for (const fileName of FILE_NAMES) {
      const actual = await sha256File(path.join(root, fileName));
      if (actual !== manifest.files[fileName]) fail(`index file hash mismatch: ${fileName}`);
    }
    const windowsPath = path.join(root, 'windows.jsonl');
    const termsPath = path.join(root, 'lexical-terms.jsonl');
    const windows = await parseWindows(windowsPath);
    const bodyStat = await stat(path.join(root, 'bodies.utf8'));
    if (bodyStat.size !== manifest.counts.bodyBytes) fail('body byte count is invalid');
    validateBodyLayout(windows, bodyStat.size);
    const lexicalPostingsBuffer = await readFile(
      path.join(root, 'lexical-postings.bin'),
    );
    const reportBytes = await readFile(path.join(root, 'build-report.json'));
    if (
      windows.length !== manifest.counts.windows
      || windows.some((window) =>
        window.sourceRevision !== manifest.sourceRevision
        || !manifest.books.some((book) => book.bookId === window.bookId)
        || window.sourcePaths.some((sourcePath) =>
          !(sourcePath in (manifest.books.find(
            (book) => book.bookId === window.bookId,
          )?.sourceHashes ?? {})))
      )
    ) fail('window metadata does not match manifest identity');
    const lexicalTerms = await loadLexicalIndex(
      termsPath,
      lexicalPostingsBuffer,
      windows.length,
    );
    if (lexicalTerms.size !== manifest.counts.lexicalTerms) {
      fail('lexical term count is invalid');
    }
    validateBuildReport(parseJson(reportBytes, 'build-report.json'), manifest);
    bodiesHandle = await open(path.join(root, 'bodies.utf8'), 'r');
    const { buffer: vectorBuffer, vectors } = await loadVectorBuffer(
      path.join(root, 'vectors.f32'),
      windows.length,
      manifest.observedDimension,
    );
    const sizes = await Promise.all([
      stat(path.join(root, 'manifest.json')),
      ...FILE_NAMES.map((name) => stat(path.join(root, name))),
    ]);
    const artifactBytes = sizes.reduce((total, item) => total + item.size, 0);
    const residentArtifactBytes = artifactBytes - bodyStat.size;
    if (residentArtifactBytes > RESIDENT_ARTIFACT_BUDGET_BYTES) {
      fail('resident textbook artifacts exceed 150 MiB');
    }
    const lexicalTermsBytes = sizes[3].size;

    const loaded: LoadedTextbookRetrievalIndex = {
      root,
      manifestHash,
      manifest,
      windows,
      lexicalTerms,
      lexicalPostingsBuffer,
      decodePostings(token) {
        const term = lexicalTerms.get(token);
        if (!term) return [];
        const decoded: Array<readonly [number, number]> = [];
        scanPostingSlice(
          lexicalPostingsBuffer,
          term,
          windows.length,
          (row, frequency) => decoded.push([row, frequency]),
        );
        return decoded;
      },
      vectorBuffer,
      vectors,
      bodiesHandle,
      stats: {
        artifactBytes,
        residentArtifactBytes,
        residentArtifactBudgetBytes: RESIDENT_ARTIFACT_BUDGET_BYTES,
        residentArtifactPassed: true,
        bodyResidentBytes: 0,
        lexicalTermsBytes,
        lexicalPostingsBytes: lexicalPostingsBuffer.length,
        windows: windows.length,
        dimensions: manifest.observedDimension,
      },
      closed: false,
      async close() {
        if (loaded.closed) return;
        loaded.closed = true;
        sharedIndexes.delete(cacheKey);
        await loaded.bodiesHandle.close();
      },
    };
    return loaded;
  } catch (error) {
    if (bodiesHandle) await bodiesHandle.close().catch(() => undefined);
    throw error;
  }
}

export async function loadTextbookRetrievalIndex(
  indexRoot: string,
): Promise<LoadedTextbookRetrievalIndex> {
  if (!isNonEmptyString(indexRoot)) fail('indexRoot must be a non-empty string');
  const root = await realpath(path.resolve(indexRoot));
  const manifestBytes = await readFile(path.join(root, 'manifest.json'));
  const manifestHash = sha256Bytes(manifestBytes);
  const cacheKey = `${root}\0${manifestHash}`;
  const existing = sharedIndexes.get(cacheKey);
  if (existing) return existing;
  const pending = loadIndex(root, manifestBytes, manifestHash, cacheKey);
  sharedIndexes.set(cacheKey, pending);
  pending.catch(() => {
    if (sharedIndexes.get(cacheKey) === pending) sharedIndexes.delete(cacheKey);
  });
  return pending;
}

export const getSharedTextbookRetrievalIndex = loadTextbookRetrievalIndex;

export async function closeTextbookRetrievalIndex(
  index: LoadedTextbookRetrievalIndex,
): Promise<void> {
  await index.close();
}

export async function resetTextbookRetrievalForTests(): Promise<void> {
  const pending = [...new Set(sharedIndexes.values())];
  sharedIndexes.clear();
  const loaded = await Promise.all(pending.map((value) => value.catch(() => undefined)));
  await Promise.all(loaded.map((index) => index?.close()));
}
