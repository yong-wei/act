import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
  assertSubmissionObjectIntegrity,
} from '@/lib/assignments/submission-domain';
import type { StoredObjectMetadata, SubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import {
  assignmentAttachmentRoute,
  readBoundedAssignmentText,
} from './assignment-attachment-understanding';
import {
  evaluateExternalProcessingPolicy,
  normalizeDocumentEvidence,
  normalizeCoordinateProvenance,
  sha256,
  type EvidenceBlockInput,
  type ExternalProcessingPolicy,
  type FrozenCoordinateProvenance,
  type MathGradingProvider,
  type NormalizedAnswerEvidence,
} from './math-document-grading-contracts';
import {
  createWordDualRepresentation,
  WordRepresentationError,
  type WordDualRepresentation,
  type WordRepresentationAdapter,
} from './math-document-word-representation';

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
  wordRepresentation?: WordDualRepresentation | null;
}

export interface MathpixResponse {
  requestId?: string;
  request_id?: string;
  markdown?: string;
  md?: string;
  text?: string;
  image_width?: number;
  image_height?: number;
  auto_rotate_degrees?: number;
  line_data?: Array<{
    text?: string;
    page?: number;
    page_number?: number;
    cnt?: Array<[number, number] | { x?: number; y?: number }>;
    region?: Record<string, unknown>;
    image_width?: number;
    image_height?: number;
    confidence?: number;
  }>;
  lines?: Array<{
    text?: string;
    page?: number;
    pageNumber?: number;
    bbox?: [number, number, number, number] | null;
    coordinateProvenance?: FrozenCoordinateProvenance | {
      origin?: string;
      unit?: string;
      pageWidth?: number;
      pageHeight?: number;
      rotation?: number;
    } | null;
    confidence?: number;
  }>;
}

interface MathpixPdfLinesResponse {
  pages?: Array<{
    page?: number;
    page_width?: number;
    page_height?: number;
    rotation?: number;
    auto_rotate_degrees?: number;
    lines?: Array<{
      text?: string;
      text_display?: string;
      cnt?: Array<[number, number] | { x?: number; y?: number }>;
      region?: Record<string, unknown>;
      confidence?: number;
    }>;
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
    expectedQuestionIds?: readonly string[];
    crossModalSignals?: ReadonlyArray<{ questionId: string; consistent: boolean }>;
    signal?: AbortSignal;
  }): Promise<{
    markdown: string;
    blocks: EvidenceBlockInput[];
    warnings?: string[];
    limitations?: string[];
    renderedBytes?: Uint8Array | null;
    renderedMimeType?: string | null;
    state?: ConversionResult['state'];
    wordRepresentation?: WordDualRepresentation | null;
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
  imageEndpoint?: string;
  documentEndpoint?: string;
  provider?: MathGradingProvider;
  credentialRef?: string;
  classId?: string;
  appId?: string;
  appKey?: string;
  pdfPollIntervalMs?: number;
  pdfMaxPollAttempts?: number;
} = {}): MathpixClient {
  const fetchImpl = input.fetchImpl ?? fetch;
  const imageEndpoint = input.imageEndpoint ?? input.endpoint ?? process.env.MATHPIX_IMAGE_ENDPOINT ?? 'https://api.mathpix.com/v3/text';
  const documentEndpoint = input.documentEndpoint ?? input.endpoint ?? process.env.MATHPIX_DOCUMENT_ENDPOINT ?? 'https://api.mathpix.com/v3/pdf';
  const provider = input.provider ?? 'mathpix';
  const credentialRef = input.credentialRef ?? process.env.MATHPIX_CREDENTIAL_REF ?? 'env:MATHPIX_APP_KEY';
  const appId = input.appId ?? process.env.MATHPIX_APP_ID ?? '';
  const appKey = input.appKey ?? process.env.MATHPIX_APP_KEY ?? '';
  const pdfPollIntervalMs = Math.max(0, input.pdfPollIntervalMs ?? 1_000);
  const pdfMaxPollAttempts = Math.max(1, Math.floor(input.pdfMaxPollAttempts ?? 300));
  return {
    async convert(request) {
      const isImage = request.mimeType.trim().toLowerCase().startsWith('image/');
      const endpoint = isImage ? imageEndpoint : documentEndpoint;
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
      const endpointPath = new URL(endpoint).pathname.replace(/\/+$/, '');
      if (!isImage && endpointPath === '/v3/pdf') {
        return convertMathpixPdf({ fetchImpl, endpoint, appId, appKey, request, pdfPollIntervalMs, pdfMaxPollAttempts });
      }
      if (isImage && endpointPath !== '/v3/text') throw new ConversionBlockedError('mathpix-image-endpoint-invalid');
      if (!isImage) throw new ConversionBlockedError('mathpix-document-endpoint-invalid');
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
          formats: ['text'],
          rm_spaces: true,
          include_line_data: true,
        }),
      });
      const payload = await response.json().catch(() => ({})) as MathpixResponse;
      if (!response.ok) throw new Error(`mathpix-http-${response.status}`);
      const adapted = adaptOfficialMathpixTextResponse(payload);
      return {
        ...adapted,
        requestId: response.headers.get('x-request-id') ?? payload.request_id ?? payload.requestId,
      };
    },
  };
}

async function convertMathpixPdf(input: {
  fetchImpl: typeof fetch;
  endpoint: string;
  appId: string;
  appKey: string;
  request: Parameters<MathpixClient['convert']>[0];
  pdfPollIntervalMs: number;
  pdfMaxPollAttempts: number;
}): Promise<MathpixResponse> {
  const headers = { app_id: input.appId, app_key: input.appKey };
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(input.request.bytes)], { type: input.request.mimeType }), input.request.fileName);
  form.append('options_json', JSON.stringify({}));
  const submitted = await input.fetchImpl(input.endpoint, {
    method: 'POST', headers: { ...headers, ...(input.request.idempotencyKey ? { 'Idempotency-Key': input.request.idempotencyKey } : {}) }, body: form, signal: input.request.signal,
  });
  const submission = await submitted.json().catch(() => ({})) as { pdf_id?: unknown; error?: unknown };
  if (!submitted.ok) throw new Error(`mathpix-http-${submitted.status}`);
  const pdfId = String(submission.pdf_id ?? '');
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(pdfId)) throw new Error('mathpix-pdf-id-invalid');
  const base = input.endpoint.replace(/\/+$/, '');
  let completed = false;
  for (let attempt = 0; attempt < input.pdfMaxPollAttempts; attempt += 1) {
    const response = await input.fetchImpl(`${base}/${pdfId}`, { headers, signal: input.request.signal });
    const status = await response.json().catch(() => ({})) as { status?: unknown; error?: unknown };
    if (!response.ok) throw new Error(`mathpix-http-${response.status}`);
    if (status.status === 'completed') { completed = true; break; }
    if (status.status === 'error') throw new Error('mathpix-pdf-processing-error');
    if (attempt + 1 < input.pdfMaxPollAttempts) await abortableDelay(input.pdfPollIntervalMs, input.request.signal);
  }
  if (!completed) throw new Error('mathpix-pdf-poll-timeout');
  const [linesResponse, markdownResponse] = await Promise.all([
    input.fetchImpl(`${base}/${pdfId}.lines.json`, { headers, signal: input.request.signal }),
    input.fetchImpl(`${base}/${pdfId}.mmd`, { headers, signal: input.request.signal }),
  ]);
  if (!linesResponse.ok) throw new Error(`mathpix-lines-http-${linesResponse.status}`);
  if (!markdownResponse.ok) throw new Error(`mathpix-markdown-http-${markdownResponse.status}`);
  const linesPayload = await linesResponse.json().catch(() => ({})) as MathpixPdfLinesResponse;
  const markdown = await markdownResponse.text();
  return adaptOfficialMathpixPdfResponse(linesPayload, markdown, pdfId);
}

function adaptOfficialMathpixPdfResponse(payload: MathpixPdfLinesResponse, markdown: string, requestId: string): MathpixResponse {
  const lines = (payload.pages ?? []).flatMap((page) => {
    const pageWidth = positiveNumber(page.page_width);
    const pageHeight = positiveNumber(page.page_height);
    const rotation = quarterRotation(page.rotation ?? page.auto_rotate_degrees);
    return (page.lines ?? []).map((line) => {
      const bbox = contourOrRegionBbox(line.cnt, line.region);
      return {
        text: line.text_display ?? line.text,
        page: page.page ?? 1,
        bbox,
        confidence: line.confidence,
        coordinateProvenance: bbox && pageWidth && pageHeight && rotation !== null
          ? { origin: 'TOP_LEFT' as const, unit: 'PIXEL' as const, pageWidth, pageHeight, rotation }
          : null,
      };
    });
  });
  return { requestId, markdown, text: markdown, lines };
}

async function abortableDelay(milliseconds: number, signal?: AbortSignal) {
  if (signal?.aborted) throw new ConversionLeaseLostError();
  if (milliseconds <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => { clearTimeout(timeout); reject(new ConversionLeaseLostError()); };
    const timeout = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function adaptOfficialMathpixTextResponse(payload: MathpixResponse): MathpixResponse {
  const officialLines = Array.isArray(payload.line_data) ? payload.line_data.map((line) => {
    const bbox = contourOrRegionBbox(line.cnt, line.region);
    const pageWidth = positiveNumber(line.image_width) ?? positiveNumber(payload.image_width);
    const pageHeight = positiveNumber(line.image_height) ?? positiveNumber(payload.image_height);
    const rotation = quarterRotation(payload.auto_rotate_degrees);
    return {
      text: line.text,
      page: line.page_number ?? line.page ?? 1,
      bbox,
      confidence: line.confidence,
      coordinateProvenance: bbox && pageWidth && pageHeight && rotation !== null
        ? { origin: 'TOP_LEFT' as const, unit: 'PIXEL' as const, pageWidth, pageHeight, rotation }
        : null,
    };
  }) : [];
  const legacyLines = (payload.lines ?? []).map(({ coordinateProvenance: _untrusted, ...line }) => line);
  return {
    requestId: payload.request_id ?? payload.requestId,
    markdown: payload.markdown ?? payload.md ?? payload.text,
    text: payload.text,
    lines: officialLines.length > 0 ? officialLines : legacyLines,
  };
}

function contourOrRegionBbox(contour: unknown, region: Record<string, unknown> | undefined): [number, number, number, number] | null {
  const points = Array.isArray(contour) ? contour.map((point: any) => Array.isArray(point) ? [Number(point[0]), Number(point[1])] : [Number(point?.x), Number(point?.y)]) : [];
  if (points.length >= 2 && points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) {
    const xs = points.map(([x]) => x); const ys = points.map(([, y]) => y);
    const bbox: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    if (bbox[0] < bbox[2] && bbox[1] < bbox[3] && bbox[0] >= 0 && bbox[1] >= 0) return bbox;
  }
  if (region) {
    const left = Number(region.left ?? region.x ?? region.top_left_x);
    const top = Number(region.top ?? region.y ?? region.top_left_y);
    const right = Number(region.right ?? (Number.isFinite(left) ? left + Number(region.width) : Number.NaN));
    const bottom = Number(region.bottom ?? (Number.isFinite(top) ? top + Number(region.height) : Number.NaN));
    if ([left, top, right, bottom].every(Number.isFinite) && left >= 0 && top >= 0 && left < right && top < bottom) return [left, top, right, bottom];
  }
  return null;
}

function positiveNumber(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function quarterRotation(value: unknown): 0 | 90 | 180 | 270 | null {
  const normalized = ((Number(value ?? 0) % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized as 0 | 90 | 180 | 270 : null;
}

export function createLocalDocumentConverter(input: {
  markItDownCommand?: string;
  exec?: typeof execFileAsync;
  wordPdfPageExtractor?: WordRepresentationAdapter['extractPdfPages'];
} = {}): LocalDocumentConverter {
  const run = input.exec ?? execFileAsync;
  let cachedWordProcessorVersion: string | null = null;
  const resolveWordProcessorVersion = async (signal?: AbortSignal) => {
    if (cachedWordProcessorVersion) return cachedWordProcessorVersion;
    cachedWordProcessorVersion = await readLibreOfficeVersion(run, signal);
    return cachedWordProcessorVersion;
  };
  return {
    async convert(request) {
      if (isWordLike(request.mimeType, request.fileName)) {
        const wordRepresentation = await createWordDualRepresentation({
          sourceBytes: request.bytes,
          fileName: request.fileName,
          mimeType: request.mimeType,
          expectedQuestionIds: request.expectedQuestionIds,
          crossModalSignals: request.crossModalSignals,
          signal: request.signal,
          adapter: {
            resolveWordProcessorVersion,
            normalizeLegacyDoc: (bytes, signal) => normalizeLegacyDocToDocx(bytes, run, signal),
            renderPdf: async (bytes, signal) => {
              const rendered = await renderDocxToPdf(bytes, run, signal);
              if (!rendered.bytes) throw new WordRepresentationError('word-pdf-render-failed');
              return rendered.bytes;
            },
            extractPdfPages: input.wordPdfPageExtractor,
          },
        });
        const limitationCodes = wordRepresentation.integrity.issues.map((issue) => issue.code);
        return {
          markdown: wordRepresentation.markdown,
          blocks: wordRepresentation.blocks,
          warnings: [],
          limitations: limitationCodes,
          renderedBytes: wordRepresentation.renderedPdfBytes,
          renderedMimeType: 'application/pdf',
          state: wordRepresentation.integrity.verdict === 'blocked'
            ? 'blocked'
            : wordRepresentation.integrity.verdict === 'review' ? 'fallback' : 'succeeded',
          wordRepresentation,
        };
      }
      const decodedText = decodeUtf8(request.bytes);
      if (isTextMime(request.mimeType, request.fileName) && decodedText !== null) {
        return textToLocalResult(decodedText);
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
  trustedRedactedSource?: {
    provenance: 'teacher-ai-grading-confirmed-redaction';
    bytes: Uint8Array;
  };
  policy?: ExternalProcessingPolicy | null;
  mathpix?: MathpixClient;
  local?: LocalDocumentConverter;
  now?: Date;
  forceExternal?: boolean;
  assignmentResponse?: boolean;
  isCancellationRequested?: () => Promise<boolean> | boolean;
  isLeaseLost?: () => Promise<boolean> | boolean;
  idempotencyKey?: string;
  requireWordDualRepresentation?: boolean;
  expectedQuestionIds?: readonly string[];
  crossModalSignals?: ReadonlyArray<{ questionId: string; consistent: boolean }>;
  signal?: AbortSignal;
}): Promise<ConversionResult> {
  const ensureNotCancelled = async () => {
    if (input.signal?.aborted) throw new ConversionLeaseLostError();
    if (input.isLeaseLost && await input.isLeaseLost()) throw new ConversionLeaseLostError();
    if (input.isCancellationRequested && await input.isCancellationRequested()) throw new ConversionCancelledError();
  };
  await ensureNotCancelled();
  let bytes: Uint8Array;
  if (input.trustedRedactedSource) {
    if (input.trustedRedactedSource.provenance !== 'teacher-ai-grading-confirmed-redaction') {
      throw new ConversionBlockedError('conversion-trusted-source-invalid');
    }
    bytes = input.trustedRedactedSource.bytes;
  } else {
    const object = await input.store.head(input.source.objectKey);
    assertSourceMetadata(input.source, object);
    bytes = await input.store.readObject(input.source.objectKey);
  }
  assertSubmissionObjectIntegrity(bytes, input.source.sizeBytes, input.source.checksum);
  const local = input.local ?? createLocalDocumentConverter();
  if (input.assignmentResponse && !isWordLike(input.source.mimeType, input.source.originalName)) {
    return convertAssignmentResponseAttachment({
      ...input,
      bytes,
      ensureNotCancelled,
    });
  }
  const mathHeavy = await isMathOrImageHeavy(input.source, bytes);
  const warnings: string[] = [];
  const limitations: string[] = [];

  const requireWordDualRepresentation = input.requireWordDualRepresentation === true
    || (input.expectedQuestionIds?.length ?? 0) > 0
    || isWordLike(input.source.mimeType, input.source.originalName);
  if (mathHeavy && input.mathpix && input.forceExternal !== false && !requireWordDualRepresentation) {
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
    const localResult = await local.convert({
      bytes,
      fileName: input.source.originalName,
      mimeType: input.source.mimeType,
      idempotencyKey: input.idempotencyKey,
      expectedQuestionIds: input.expectedQuestionIds,
      crossModalSignals: input.crossModalSignals,
      signal: input.signal,
    });
    await ensureNotCancelled();
    if (localResult.wordRepresentation || (localResult.markdown && localResult.blocks.length > 0)) {
      const visualEvidenceLimitations = localResult.wordRepresentation?.images.length
        ? ['visual-evidence-not-delivered']
        : [];
      const normalized = normalizeDocumentEvidence({
        sourceHash: input.source.checksum,
        markdown: localResult.markdown,
        blocks: localResult.blocks,
        limitations: [...limitations, ...(localResult.limitations ?? []), ...visualEvidenceLimitations],
      });
      return {
        adapter: mathHeavy ? 'local-fallback' : 'local-markitdown',
        adapterVersion: process.env.MARKITDOWN_VERSION ?? 'local.v1',
        state: localResult.state ?? (warnings.length > 0 || limitations.length > 0 ? 'fallback' : 'succeeded'),
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
        wordRepresentation: localResult.wordRepresentation ?? null,
      };
    }
    warnings.push(...(localResult.warnings ?? []));
    limitations.push(...(localResult.limitations ?? []));
  } catch (error) {
    if (error instanceof ConversionCancelledError || error instanceof ConversionLeaseLostError || input.signal?.aborted) throw error;
    if (error instanceof WordRepresentationError) limitations.push(error.code);
    else warnings.push(`local-conversion-failed:${safeErrorCode(error)}`);
  }

  return {
    adapter: mathHeavy ? 'mathpix-blocked' : 'local-blocked',
    adapterVersion: 'blocked.v1',
    state: limitations.some((reason) => reason.includes('policy') || reason.startsWith('word-') || reason.startsWith('legacy-doc-')) ? 'blocked' : 'failed',
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

async function convertAssignmentResponseAttachment(input: {
  source: ProtectedSubmissionSource;
  bytes: Uint8Array;
  policy?: ExternalProcessingPolicy | null;
  mathpix?: MathpixClient;
  idempotencyKey?: string;
  signal?: AbortSignal;
  ensureNotCancelled: () => Promise<void>;
}): Promise<ConversionResult> {
  const route = assignmentAttachmentRoute(
    input.source.mimeType,
    input.source.originalName,
  );
  if (route === 'direct-text') {
    try {
      const direct = readBoundedAssignmentText(input.bytes);
      const normalized = normalizeDocumentEvidence({
        sourceHash: input.source.checksum,
        markdown: direct.markdown,
        blocks: direct.blocks,
        limitations: direct.limitations,
        anchorVersion: 'assignment-direct-text.v1',
      });
      return {
        adapter: 'assignment-direct-text',
        adapterVersion: 'assignment-direct-text.v1',
        state: normalized.readiness === 'ready' ? 'succeeded' : 'blocked',
        sourceChecksum: input.source.checksum,
        outputChecksum: normalized.readiness === 'ready'
          ? sha256(normalized.canonicalMarkdown)
          : null,
        markdown: normalized.canonicalMarkdown,
        blocks: normalized.blocks,
        precision: normalized.precision,
        confidence: normalized.readiness === 'ready' ? 1 : 0,
        warnings: [],
        limitations: normalized.limitations,
        providerRequestId: null,
        providerRequestedAt: null,
        providerProcessedAt: null,
        renderedBytes: null,
        renderedMimeType: null,
      };
    } catch (error) {
      return unavailableAssignmentUnderstanding(
        input.source.checksum,
        'assignment-direct-text-decode-failed',
        safeErrorCode(error),
      );
    }
  }

  const decision = evaluateExternalProcessingPolicy({
    policy: input.policy,
    provider: 'mathpix',
    purpose: 'answer-conversion',
    classId: input.source.classId,
  });
  if (!decision.allowed || !input.mathpix) {
    return unavailableAssignmentUnderstanding(
      input.source.checksum,
      'assignment-mathpix-only',
      'understanding-unavailable-policy',
      decision.reasons,
    );
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await input.ensureNotCancelled();
      const providerRequestedAt = new Date();
      const response = await input.mathpix.convert({
        bytes: input.bytes,
        fileName: input.source.originalName,
        mimeType: input.source.mimeType,
        policy: input.policy!,
        classId: input.source.classId,
        idempotencyKey: input.idempotencyKey,
        signal: input.signal,
      });
      await input.ensureNotCancelled();
      const result = mathpixToConversionResult(response, input.source.checksum);
      result.providerRequestedAt = providerRequestedAt;
      result.providerProcessedAt = new Date();
      if (result.markdown && result.blocks.length > 0) return result;
      if (attempt === 2) {
        return unavailableAssignmentUnderstanding(
          input.source.checksum,
          'assignment-mathpix-only',
          'understanding-failed',
        );
      }
    } catch (error) {
      if (error instanceof ConversionCancelledError
        || error instanceof ConversionLeaseLostError
        || input.signal?.aborted) throw error;
      if (attempt === 2) {
        return unavailableAssignmentUnderstanding(
          input.source.checksum,
          'assignment-mathpix-only',
          'understanding-failed',
        );
      }
    }
  }
  return unavailableAssignmentUnderstanding(
    input.source.checksum,
    'assignment-mathpix-only',
    'understanding-failed',
  );
}

function unavailableAssignmentUnderstanding(
  sourceChecksum: string,
  adapter: string,
  limitation: string,
  details: string[] = [],
): ConversionResult {
  return {
    adapter,
    adapterVersion: 'assignment-understanding.v1',
    state: 'blocked',
    sourceChecksum,
    outputChecksum: null,
    markdown: '',
    blocks: [],
    precision: 'page',
    confidence: 0,
    warnings: [],
    limitations: [limitation, ...details.map((detail) => `policy:${detail}`)],
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
        coordinateProvenance: normalizeCoordinateProvenance(line.coordinateProvenance),
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

async function normalizeLegacyDocToDocx(
  bytes: Uint8Array,
  run: typeof execFileAsync,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const workdir = await mkdtemp(join(tmpdir(), 'act-doc-normalize-'));
  const inputPath = join(workdir, 'answer.doc');
  try {
    await writeFile(inputPath, bytes);
    const profileDirectory = join(workdir, 'libreoffice-profile');
    await mkdir(profileDirectory);
    await run(process.env.LIBREOFFICE_COMMAND ?? 'soffice', [libreOfficeProfileArgument(profileDirectory), '--headless', '--convert-to', 'docx', '--outdir', workdir, inputPath], {
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
      signal,
    });
    return await readFile(join(workdir, 'answer.docx'));
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function readLibreOfficeVersion(
  run: typeof execFileAsync,
  signal?: AbortSignal,
): Promise<string> {
  try {
    const result = await run(process.env.LIBREOFFICE_COMMAND ?? 'soffice', ['--version'], {
      timeout: 10_000,
      maxBuffer: 256 * 1024,
      signal,
    });
    const version = `${String(result.stdout ?? '')} ${String(result.stderr ?? '')}`.trim().replace(/\s+/gu, ' ');
    if (!/^LibreOffice\b/iu.test(version) || version.length > 200) {
      throw new WordRepresentationError('word-processor-version-unavailable');
    }
    return version;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof WordRepresentationError) throw error;
    throw new WordRepresentationError('word-processor-version-unavailable');
  }
}

async function renderDocxToPdf(bytes: Uint8Array, run: typeof execFileAsync, signal?: AbortSignal): Promise<{ bytes: Uint8Array | null; warnings: string[]; limitations: string[] }> {
  const workdir = await mkdtemp(join(tmpdir(), 'act-docx-render-'));
  const inputPath = join(workdir, 'answer.docx');
  try {
    await writeFile(inputPath, bytes);
    const profileDirectory = join(workdir, 'libreoffice-profile');
    await mkdir(profileDirectory);
    await run(process.env.LIBREOFFICE_COMMAND ?? 'soffice', [libreOfficeProfileArgument(profileDirectory), '--headless', '--convert-to', 'pdf', '--outdir', workdir, inputPath], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024, signal });
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

export async function renderPdfPagesToPng(input: {
  pdfBytes: Uint8Array;
  pageNumbers?: readonly number[];
  run?: typeof execFileAsync;
  signal?: AbortSignal;
}): Promise<Array<{ pageNumber: number; bytes: Buffer }>> {
  if (!Buffer.from(input.pdfBytes).subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new Error('visual-evidence-pdf-invalid');
  }
  const pageNumbers = normalizeRequestedPdfPages(input.pageNumbers);
  const workdir = await mkdtemp(join(tmpdir(), 'act-pdf-pages-'));
  const inputPath = join(workdir, 'source.pdf');
  const outputPrefix = join(workdir, 'page');
  try {
    await writeFile(inputPath, input.pdfBytes);
    if (pageNumbers) {
      const pages = await Promise.all(pageNumbers.map(async (pageNumber) => {
        const selectedOutputPrefix = join(workdir, `page-${pageNumber}`);
        await (input.run ?? execFileAsync)(process.env.PDFTOPPM_COMMAND ?? 'pdftoppm', [
          '-f', String(pageNumber), '-l', String(pageNumber), '-singlefile', '-png', '-r', '144', inputPath, selectedOutputPrefix,
        ], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024, signal: input.signal });
        try {
          return { pageNumber, bytes: await readFile(`${selectedOutputPrefix}.png`) };
        } catch {
          throw new Error('visual-evidence-pdf-render-selected-page-missing');
        }
      }));
      return pages;
    }
    await (input.run ?? execFileAsync)(process.env.PDFTOPPM_COMMAND ?? 'pdftoppm', [
      '-png', '-r', '144', inputPath, outputPrefix,
    ], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024, signal: input.signal });
    const names = (await readdir(workdir))
      .flatMap((name) => /^page-(\d+)\.png$/u.exec(name) ? [{ name, pageNumber: Number(/^page-(\d+)\.png$/u.exec(name)![1]) }] : [])
      .sort((left, right) => left.pageNumber - right.pageNumber);
    if (names.length === 0) throw new Error('visual-evidence-pdf-render-empty');
    return Promise.all(names.map(async ({ name, pageNumber }) => ({ pageNumber, bytes: await readFile(join(workdir, name)) })));
  } catch (error) {
    if (input.signal?.aborted) throw error;
    throw new Error('visual-evidence-pdf-render-failed');
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

function normalizeRequestedPdfPages(pageNumbers: readonly number[] | undefined): number[] | null {
  if (pageNumbers === undefined) return null;
  if (pageNumbers.length === 0 || pageNumbers.some((pageNumber) => !Number.isInteger(pageNumber) || pageNumber < 1)) {
    throw new Error('visual-evidence-pdf-page-selection-invalid');
  }
  const sorted = [...pageNumbers].sort((left, right) => left - right);
  if (sorted.some((pageNumber, index) => index > 0 && pageNumber === sorted[index - 1])) {
    throw new Error('visual-evidence-pdf-page-selection-invalid');
  }
  return sorted;
}

function libreOfficeProfileArgument(profileDirectory: string): string {
  return `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`;
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

function isWordLike(mimeType: string, fileName: string): boolean {
  const extension = extname(fileName).toLowerCase();
  return ['.docx', '.doc', '.wps'].includes(extension)
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || mimeType === 'application/msword'
    || /wps|ms-works/i.test(mimeType);
}

function isPdf(mimeType: string, fileName: string): boolean {
  return mimeType === 'application/pdf' || extname(fileName).toLowerCase() === '.pdf';
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'submission.bin';
}

function averageConfidence(evidence: NormalizedAnswerEvidence): number {
  if (evidence.blocks.length === 0) return 0;
  return Math.round(evidence.blocks.reduce((sum, block) => sum + (block.confidence ?? 0), 0) / evidence.blocks.length * 1000) / 1000;
}

function safeErrorCode(error: unknown): string {
  return error instanceof Error ? error.message.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) : 'unknown-error';
}
