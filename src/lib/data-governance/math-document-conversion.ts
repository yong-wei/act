import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';

import {
  assertSubmissionObjectIntegrity,
} from '@/lib/assignments/submission-domain';
import type { StoredObjectMetadata, SubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import {
  evaluateExternalProcessingPolicy,
  normalizeDocumentEvidence,
  sha256,
  type EvidenceBlockInput,
  type ExternalProcessingPolicy,
  type MathGradingProvider,
  type NormalizedAnswerEvidence,
} from './math-document-grading-contracts';

const execFileAsync = promisify(execFile);

export interface ProtectedSubmissionSource {
  assetId: string;
  attemptId: string;
  answerId: string;
  ownerId: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  classId: string;
}

export interface ConversionResult {
  adapter: string;
  adapterVersion: string;
  state: 'succeeded' | 'fallback' | 'blocked' | 'failed';
  sourceChecksum: string;
  outputChecksum: string | null;
  markdown: string;
  blocks: EvidenceBlockInput[];
  precision: 'span' | 'block' | 'page';
  confidence: number;
  warnings: string[];
  limitations: string[];
  providerRequestId: string | null;
  providerRequestedAt: Date | null;
  providerProcessedAt: Date | null;
  renderedBytes: Uint8Array | null;
  renderedMimeType: string | null;
}

export interface MathpixResponse {
  requestId?: string;
  markdown?: string;
  text?: string;
  lines?: Array<{
    text?: string;
    page?: number;
    pageNumber?: number;
    bbox?: [number, number, number, number];
    confidence?: number;
  }>;
}

export interface MathpixClient {
  convert(input: {
    bytes: Uint8Array;
    fileName: string;
    mimeType: string;
    policy: ExternalProcessingPolicy;
    classId?: string;
    idempotencyKey?: string;
    signal?: AbortSignal;
  }): Promise<MathpixResponse>;
}

export interface LocalDocumentConverter {
  convert(input: {
    bytes: Uint8Array;
    fileName: string;
    mimeType: string;
    idempotencyKey?: string;
    signal?: AbortSignal;
  }): Promise<{
    markdown: string;
    blocks: EvidenceBlockInput[];
    warnings?: string[];
    limitations?: string[];
    renderedBytes?: Uint8Array | null;
    renderedMimeType?: string | null;
  }>;
}

export class ConversionBlockedError extends Error {
  constructor(public readonly code: string, public readonly reasons: string[] = []) {
    super(reasons.length > 0 ? `${code}:${reasons.join(',')}` : code);
  }
}

export class ConversionCancelledError extends Error {
  constructor() {
    super('conversion-cancelled');
  }
}

export class ConversionLeaseLostError extends Error {
  constructor() {
    super('conversion-worker-lease-lost');
  }
}

export function createMathpixClient(input: {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  provider?: MathGradingProvider;
  credentialRef?: string;
  classId?: string;
  appId?: string;
  appKey?: string;
} = {}): MathpixClient {
  const fetchImpl = input.fetchImpl ?? fetch;
  const endpoint = input.endpoint ?? process.env.MATHPIX_ENDPOINT ?? 'https://api.mathpix.com/v3/text';
  const provider = input.provider ?? 'mathpix';
  const credentialRef = input.credentialRef ?? process.env.MATHPIX_CREDENTIAL_REF ?? 'env:MATHPIX_APP_KEY';
  const appId = input.appId ?? process.env.MATHPIX_APP_ID ?? '';
  const appKey = input.appKey ?? process.env.MATHPIX_APP_KEY ?? '';
  return {
    async convert(request) {
      const decision = evaluateExternalProcessingPolicy({
        policy: request.policy,
        provider,
        purpose: 'answer-conversion',
        classId: request.classId ?? input.classId ?? request.policy.classScope.find((scope) => scope !== '*') ?? '*',
        endpoint,
        credentialRef,
      });
      if (!decision.allowed) throw new ConversionBlockedError('mathpix-policy-blocked', decision.reasons);
      if (!appId || !appKey) throw new ConversionBlockedError('mathpix-credentials-missing');
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          app_id: appId,
          app_key: appKey,
          ...(request.idempotencyKey ? { 'Idempotency-Key': request.idempotencyKey } : {}),
        },
        signal: request.signal,
        body: JSON.stringify({
          src: `data:${request.mimeType};base64,${Buffer.from(request.bytes).toString('base64')}`,
          formats: ['md'],
          rm_spaces: true,
          include_line_data: true,
        }),
      });
      const payload = await response.json().catch(() => ({})) as MathpixResponse;
      if (!response.ok) throw new Error(`mathpix-http-${response.status}`);
      return {
        ...payload,
        requestId: response.headers.get('x-request-id') ?? payload.requestId,
      };
    },
  };
}

export function createLocalDocumentConverter(input: {
  markItDownCommand?: string;
  exec?: typeof execFileAsync;
} = {}): LocalDocumentConverter {
  const run = input.exec ?? execFileAsync;
  return {
    async convert(request) {
      const decodedText = decodeUtf8(request.bytes);
      if (isTextMime(request.mimeType, request.fileName) && decodedText !== null) {
        return textToLocalResult(decodedText);
      }
      if (isDocx(request.mimeType, request.fileName)) {
        const extracted = await extractDocxText(request.bytes, run, request.signal);
        if (extracted.markdown) {
          const rendered = await renderDocxToPdf(request.bytes, run, request.signal);
          return {
            ...extracted,
            warnings: [...extracted.warnings, ...rendered.warnings],
            limitations: [...extracted.limitations, ...rendered.limitations],
            renderedBytes: rendered.bytes,
            renderedMimeType: rendered.bytes ? 'application/pdf' : null,
          };
        }
      }
      const workdir = await mkdtemp(join(tmpdir(), 'act-grading-conversion-'));
      const inputPath = join(workdir, safeFileName(request.fileName));
      try {
        await writeFile(inputPath, request.bytes);
        const configuredCommand = input.markItDownCommand ?? process.env.MARKITDOWN_COMMAND;
        const command = configuredCommand ?? 'python3';
        const args = configuredCommand ? [inputPath] : ['-m', 'markitdown', inputPath];
        const result = await run(command, args, { timeout: 120_000, maxBuffer: 10 * 1024 * 1024, signal: request.signal });
        const markdown = String(result.stdout ?? '').trim();
        if (markdown) return textToLocalResult(markdown, ['layout-span-mapping-unavailable']);
      } catch (error) {
        if (request.signal?.aborted) throw error;
        // The local adapter is deliberately failure-closed; the caller records the warning and may route to Mathpix.
      } finally {
        await rm(workdir, { recursive: true, force: true });
      }
      if (isPdf(request.mimeType, request.fileName)) {
        return { markdown: '', blocks: [], warnings: ['local-pdf-extractor-unavailable'], limitations: ['pdf-text-unavailable'] };
      }
      return { markdown: '', blocks: [], warnings: ['local-converter-unavailable'], limitations: ['local-conversion-unavailable'] };
    },
  };
}

export async function convertProtectedSubmission(input: {
  source: ProtectedSubmissionSource;
  store: SubmissionObjectStore;
  policy?: ExternalProcessingPolicy | null;
  mathpix?: MathpixClient;
  local?: LocalDocumentConverter;
  now?: Date;
  forceExternal?: boolean;
  isCancellationRequested?: () => Promise<boolean> | boolean;
  isLeaseLost?: () => Promise<boolean> | boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
}): Promise<ConversionResult> {
  const ensureNotCancelled = async () => {
    if (input.signal?.aborted) throw new ConversionLeaseLostError();
    if (input.isLeaseLost && await input.isLeaseLost()) throw new ConversionLeaseLostError();
    if (input.isCancellationRequested && await input.isCancellationRequested()) throw new ConversionCancelledError();
  };
  await ensureNotCancelled();
  const object = await input.store.head(input.source.objectKey);
  assertSourceMetadata(input.source, object);
  const bytes = await input.store.readObject(input.source.objectKey);
  assertSubmissionObjectIntegrity(bytes, input.source.sizeBytes, input.source.checksum);
  const local = input.local ?? createLocalDocumentConverter();
  const mathHeavy = await isMathOrImageHeavy(input.source, bytes);
  const warnings: string[] = [];
  const limitations: string[] = [];

  if (mathHeavy && input.mathpix && input.forceExternal !== false) {
    await ensureNotCancelled();
    const decision = evaluateExternalProcessingPolicy({
      policy: input.policy,
      provider: 'mathpix',
      purpose: 'answer-conversion',
      classId: input.source.classId,
    });
    if (decision.allowed) {
      try {
        const providerRequestedAt = new Date();
        const response = await input.mathpix.convert({
          bytes,
          fileName: input.source.originalName,
          mimeType: input.source.mimeType,
          policy: input.policy!,
          classId: input.source.classId,
          idempotencyKey: input.idempotencyKey,
          signal: input.signal,
        });
        await ensureNotCancelled();
        const result = mathpixToConversionResult(response, input.source.checksum);
        result.providerRequestedAt = providerRequestedAt;
        result.providerProcessedAt = new Date();
        if (result.markdown && result.blocks.length > 0) return result;
        warnings.push('mathpix-empty-output');
      } catch (error) {
        if (error instanceof ConversionCancelledError || error instanceof ConversionLeaseLostError || input.signal?.aborted) throw error;
        warnings.push(`mathpix-failed:${safeErrorCode(error)}`);
      }
    } else {
      warnings.push('mathpix-policy-blocked');
      limitations.push(...decision.reasons.map((reason) => `mathpix:${reason}`));
    }
  }

  await ensureNotCancelled();
  try {
    const localResult = await local.convert({ bytes, fileName: input.source.originalName, mimeType: input.source.mimeType, idempotencyKey: input.idempotencyKey, signal: input.signal });
    await ensureNotCancelled();
    if (localResult.markdown && localResult.blocks.length > 0) {
      const normalized = normalizeDocumentEvidence({
        sourceHash: input.source.checksum,
        markdown: localResult.markdown,
        blocks: localResult.blocks,
        limitations: [...limitations, ...(localResult.limitations ?? [])],
      });
      return {
        adapter: mathHeavy ? 'local-fallback' : 'local-markitdown',
        adapterVersion: process.env.MARKITDOWN_VERSION ?? 'local.v1',
        state: warnings.length > 0 || limitations.length > 0 ? 'fallback' : 'succeeded',
        sourceChecksum: input.source.checksum,
        outputChecksum: sha256(normalized.canonicalMarkdown),
        markdown: normalized.canonicalMarkdown,
        blocks: normalized.blocks,
        precision: normalized.precision,
        confidence: averageConfidence(normalized),
        warnings: [...warnings, ...(localResult.warnings ?? [])],
        limitations: normalized.limitations,
        providerRequestId: null,
        providerRequestedAt: null,
        providerProcessedAt: null,
        renderedBytes: localResult.renderedBytes ?? null,
        renderedMimeType: localResult.renderedMimeType ?? null,
      };
    }
    warnings.push(...(localResult.warnings ?? []));
    limitations.push(...(localResult.limitations ?? []));
  } catch (error) {
    if (error instanceof ConversionCancelledError || error instanceof ConversionLeaseLostError || input.signal?.aborted) throw error;
    warnings.push(`local-conversion-failed:${safeErrorCode(error)}`);
  }

  return {
    adapter: mathHeavy ? 'mathpix-blocked' : 'local-blocked',
    adapterVersion: 'blocked.v1',
    state: limitations.some((reason) => reason.includes('policy')) ? 'blocked' : 'failed',
    sourceChecksum: input.source.checksum,
    outputChecksum: null,
    markdown: '',
    blocks: [],
    precision: 'page',
    confidence: 0,
    warnings: [...new Set(warnings)],
    limitations: [...new Set(limitations.length > 0 ? limitations : ['no-usable-conversion'])],
    providerRequestId: null,
    providerRequestedAt: null,
    providerProcessedAt: null,
    renderedBytes: null,
    renderedMimeType: null,
  };
}

export function mathpixToConversionResult(response: MathpixResponse, sourceChecksum: string): ConversionResult {
  const markdown = (response.markdown ?? response.text ?? '').trim();
  const lines = response.lines?.filter((line) => typeof line.text === 'string' && line.text.trim()) ?? [];
  const blocks: EvidenceBlockInput[] = lines.length > 0
    ? lines.map((line, index) => ({
        id: `mathpix-block-${index + 1}`,
        blockIndex: index,
        pageNumber: line.pageNumber ?? line.page ?? null,
        text: line.text!.trim(),
        markdown: line.text!.trim(),
        bbox: line.bbox ?? null,
        confidence: line.confidence ?? 0.75,
        precision: line.bbox ? 'block' : line.page || line.pageNumber ? 'page' : 'block',
      }))
    : markdown.split(/\n{2,}/).filter(Boolean).map((text, index) => ({
        id: `mathpix-block-${index + 1}`,
        blockIndex: index,
        pageNumber: null,
        text: text.trim(),
        markdown: text.trim(),
        confidence: 0.7,
        precision: 'block' as const,
      }));
  const normalized = normalizeDocumentEvidence({ sourceHash: sourceChecksum, markdown, blocks });
  return {
    adapter: 'mathpix',
    adapterVersion: process.env.MATHPIX_VERSION ?? 'mathpix.v1',
    state: 'succeeded',
    sourceChecksum,
    outputChecksum: sha256(normalized.canonicalMarkdown),
    markdown: normalized.canonicalMarkdown,
    blocks: normalized.blocks,
    precision: normalized.precision,
    confidence: averageConfidence(normalized),
    warnings: normalized.limitations,
    limitations: normalized.limitations,
    providerRequestId: response.requestId ?? null,
    providerRequestedAt: null,
    providerProcessedAt: null,
    renderedBytes: null,
    renderedMimeType: null,
  };
}

export function toAnswerEvidence(result: ConversionResult): NormalizedAnswerEvidence {
  return normalizeDocumentEvidence({
    sourceHash: result.sourceChecksum,
    markdown: result.markdown,
    blocks: result.blocks,
    limitations: [...result.warnings, ...result.limitations],
    anchorVersion: `${result.adapterVersion}:anchors`,
  });
}

async function extractDocxText(bytes: Uint8Array, run: typeof execFileAsync, signal?: AbortSignal): Promise<{
  markdown: string;
  blocks: EvidenceBlockInput[];
  warnings: string[];
  limitations: string[];
}> {
  try {
    const xml = await readDocxXml(bytes, run, signal);
    if (!xml) return { markdown: '', blocks: [], warnings: ['ooxml-extraction-unavailable'], limitations: ['docx-structure-unavailable'] };
    const paragraphs = [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)]
      .map((match) => decodeXml(match[1].replace(/<w:tab\s*\/?>(?:<\/w:tab>)?/g, '\t').replace(/<[^>]+>/g, '')))
      .map((text) => text.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const markdown = paragraphs.join('\n\n');
    const blocks = paragraphs.map((text, index) => ({
      id: `docx-block-${index + 1}`,
      blockIndex: index,
      pageNumber: null,
      text,
      markdown: text,
      spanStart: markdown.indexOf(text),
      spanEnd: markdown.indexOf(text) + text.length,
      confidence: 0.82,
      precision: 'span' as const,
    }));
    const limitations = /<m:oMath|<w:drawing|<pic:pic/.test(xml) ? ['ooxml-formula-or-image-geometry-not-proven'] : [];
    return { markdown, blocks, warnings: limitations.length > 0 ? ['formula-or-image-region-coordinates-unavailable'] : [], limitations };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { markdown: '', blocks: [], warnings: ['ooxml-extraction-unavailable'], limitations: ['docx-structure-unavailable'] };
  }
}

async function readDocxXml(bytes: Uint8Array, run: typeof execFileAsync, signal?: AbortSignal): Promise<string> {
  const workdir = await mkdtemp(join(tmpdir(), 'act-docx-ooxml-'));
  const inputPath = join(workdir, 'answer.docx');
  try {
    await writeFile(inputPath, bytes);
    return String((await run('unzip', ['-p', inputPath, 'word/document.xml'], { timeout: 30_000, maxBuffer: 10 * 1024 * 1024, signal })).stdout ?? '');
  } catch (error) {
    if (signal?.aborted) throw error;
    return '';
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function renderDocxToPdf(bytes: Uint8Array, run: typeof execFileAsync, signal?: AbortSignal): Promise<{ bytes: Uint8Array | null; warnings: string[]; limitations: string[] }> {
  const workdir = await mkdtemp(join(tmpdir(), 'act-docx-render-'));
  const inputPath = join(workdir, 'answer.docx');
  try {
    await writeFile(inputPath, bytes);
    await run(process.env.LIBREOFFICE_COMMAND ?? 'soffice', ['--headless', '--convert-to', 'pdf', '--outdir', workdir, inputPath], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024, signal });
    const renderedPath = join(workdir, 'answer.pdf');
    const rendered = await readFile(renderedPath);
    return { bytes: rendered, warnings: [], limitations: [] };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { bytes: null, warnings: ['rendered-pages-unavailable'], limitations: ['rendered-representation-not-produced'] };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function textToLocalResult(markdown: string, warnings: string[] = []) {
  const lines = markdown.split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);
  return {
    markdown: markdown.trim(),
    blocks: lines.map((text, index) => ({
      id: `local-block-${index + 1}`,
      blockIndex: index,
      pageNumber: null,
      text: text.replace(/^[-*+]\s+/, '').trim(),
      markdown: text,
      confidence: 0.72,
      precision: 'block' as const,
    })),
    warnings,
    limitations: ['layout-span-mapping-unavailable'],
  };
}

async function isMathOrImageHeavy(source: ProtectedSubmissionSource, bytes: Uint8Array): Promise<boolean> {
  if (source.mimeType.startsWith('image/')) return true;
  if (isDocx(source.mimeType, source.originalName)) {
    const xml = await readDocxXml(bytes, execFileAsync);
    return /<m:oMath|<w:drawing|<pic:pic|equation|formula/i.test(xml);
  }
  return /(?:formula|math|equation|作业|手写|scan|image)/i.test(`${source.originalName} ${source.mimeType}`)
    || isPdf(source.mimeType, source.originalName);
}

function assertSourceMetadata(source: ProtectedSubmissionSource, object: StoredObjectMetadata | null): asserts object is StoredObjectMetadata {
  if (!object) throw new ConversionBlockedError('source-object-missing');
  if (object.key !== source.objectKey || object.ownerId !== source.ownerId || object.answerId !== source.answerId) throw new ConversionBlockedError('source-object-binding-mismatch');
  if (object.sizeBytes !== source.sizeBytes || object.mimeType !== source.mimeType || object.checksum !== source.checksum) throw new ConversionBlockedError('source-object-metadata-mismatch');
  if (object.scanState !== 'CLEAN') throw new ConversionBlockedError('source-object-not-clean');
}

function decodeUtf8(bytes: Uint8Array): string | null {
  const text = Buffer.from(bytes).toString('utf8');
  return text.includes('\uFFFD') ? null : text;
}

function isTextMime(mimeType: string, fileName: string): boolean {
  return mimeType.startsWith('text/') || /\.(md|markdown|txt|csv)$/i.test(fileName);
}

function isDocx(mimeType: string, fileName: string): boolean {
  return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extname(fileName).toLowerCase() === '.docx';
}

function isPdf(mimeType: string, fileName: string): boolean {
  return mimeType === 'application/pdf' || extname(fileName).toLowerCase() === '.pdf';
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'submission.bin';
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function averageConfidence(evidence: NormalizedAnswerEvidence): number {
  if (evidence.blocks.length === 0) return 0;
  return Math.round(evidence.blocks.reduce((sum, block) => sum + (block.confidence ?? 0), 0) / evidence.blocks.length * 1000) / 1000;
}

function safeErrorCode(error: unknown): string {
  return error instanceof Error ? error.message.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) : 'unknown-error';
}
