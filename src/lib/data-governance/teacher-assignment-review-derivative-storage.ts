import { createHash } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { DOMParser, XMLSerializer, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import JSZip from 'jszip';

import { ReviewedDerivativeError, type ReviewedDerivativePlan, type ReviewedDerivativeRenderer } from './teacher-assignment-review-derivative';

type PutClient = Pick<S3Client, 'send'>;
type StorageLimits = { maxSourceBytes: number; maxZipEntries: number; maxZipEntryBytes: number; maxZipExpandedBytes: number; maxXmlBytes: number; maxXmlNodes: number; maxXmlDepth: number; maxPdfPages: number; maxPdfObjects: number; pdfTimeoutMs: number; pdfMaxOldGenerationMb: number; pdfMaxYoungGenerationMb: number; pdfStackMb: number };

export class S3AnnotatedMarkdownDerivativeRenderer implements ReviewedDerivativeRenderer {
  private readonly client: PutClient;

  constructor(
    private readonly config: { bucket: string; sourceBucket?: string; prefix?: string; endpoint?: string; region?: string; accessKey?: string; secretKey?: string; limits?: Partial<StorageLimits> },
    client?: PutClient,
  ) {
    if (!config.bucket) throw new ReviewedDerivativeError('reviewed-derivative-storage-not-configured');
    this.client = client ?? new S3Client({
      endpoint: config.endpoint,
      region: config.region ?? 'us-east-1',
      forcePathStyle: true,
      credentials: config.accessKey && config.secretKey ? { accessKeyId: config.accessKey, secretAccessKey: config.secretKey } : undefined,
    });
  }

  async render(plan: ReviewedDerivativePlan) {
    let actualKind = plan.outputKind;
    let actualMimeType = plan.outputMimeType;
    let actualNative = plan.nativeCapable;
    let actualPrecision = plan.anchorPrecision;
    let limitations = plan.limitations;
    let body: Uint8Array;
    if (plan.outputKind === 'ANNOTATED_MARKDOWN') {
      body = new TextEncoder().encode(renderMarkdown(plan));
    } else {
      const source = await this.readVerifiedSource(plan);
      try {
        body = plan.outputKind === 'REVIEWED_DOCX' ? await renderDocx(plan, source, this.limits()) : await renderPdf(plan, source, this.limits());
      } catch (error) {
        if (!(error instanceof NativeFallbackError)) throw error;
        actualKind = 'ANNOTATED_MARKDOWN'; actualMimeType = 'text/markdown'; actualNative = false; actualPrecision = 'GENERAL';
        limitations = [...new Set([...limitations, error.code])];
        body = new TextEncoder().encode(renderMarkdown({ ...plan, outputKind: actualKind, outputMimeType: actualMimeType, nativeCapable: false, anchorPrecision: 'GENERAL', limitations, annotations: plan.annotations.map((annotation) => ({ ...annotation, anchor: { precision: 'GENERAL' } })) }));
      }
    }
    const digest = createHash('sha256').update(body).digest();
    const checksum = `sha256:${digest.toString('hex')}`;
    const suffix = plan.idempotencyKey.slice('sha256:'.length);
    const prefix = (this.config.prefix ?? 'teacher-reviewed').replace(/^\/+|\/+$/g, '');
    const extension = actualKind === 'REVIEWED_DOCX' ? 'docx' : actualKind === 'REVIEWED_PDF' ? 'pdf' : 'md';
    const objectKey = `${prefix}/${safeSegment(plan.snapshotId)}/${suffix}.${extension}`;
    if (objectKey === plan.sourceObjectKey) throw new ReviewedDerivativeError('reviewed-derivative-source-overwrite-refused', { blocked: true });
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: body,
        ContentType: actualMimeType,
        ContentLength: body.byteLength,
        ChecksumSHA256: digest.toString('base64'),
        Metadata: {
          'source-checksum': plan.sourceChecksum,
          'review-checksum': plan.reviewSnapshotChecksum,
          'generator-id': safeMetadata(plan.generatorId),
          'generator-version': safeMetadata(plan.generatorVersion),
          'anchor-map-version': safeMetadata(plan.anchorMapVersion),
        },
      }));
    } catch {
      throw new ReviewedDerivativeError('reviewed-derivative-storage-write-failed', { retryable: true });
    }
    return { objectKey, checksum, sizeBytes: body.byteLength, outputKind: actualKind, outputMimeType: actualMimeType, nativeCapable: actualNative, anchorPrecision: actualPrecision, limitations };
  }

  private async readVerifiedSource(plan: ReviewedDerivativePlan) {
    if (!plan.sourceObjectKey) throw new ReviewedDerivativeError('reviewed-derivative-source-object-missing', { blocked: true });
    let response: any;
    try {
      response = await this.client.send(new GetObjectCommand({ Bucket: this.config.sourceBucket ?? this.config.bucket, Key: plan.sourceObjectKey }));
    } catch {
      throw new ReviewedDerivativeError('reviewed-derivative-source-read-failed', { retryable: true });
    }
    if (!response?.Body) throw new ReviewedDerivativeError('reviewed-derivative-source-object-empty', { retryable: true });
    const limits = this.limits();
    const announcedSize = Number(response.ContentLength);
    if (Number.isFinite(announcedSize) && (announcedSize > limits.maxSourceBytes || (plan.sourceSizeBytes != null && announcedSize !== plan.sourceSizeBytes))) throw new ReviewedDerivativeError(announcedSize > limits.maxSourceBytes ? 'reviewed-derivative-source-size-limit' : 'reviewed-derivative-source-size-mismatch', { blocked: true });
    const source = await readBodyBounded(response.Body, limits.maxSourceBytes);
    if (plan.sourceSizeBytes != null && source.byteLength !== plan.sourceSizeBytes) throw new ReviewedDerivativeError('reviewed-derivative-source-size-mismatch', { blocked: true });
    const actual = `sha256:${createHash('sha256').update(source).digest('hex')}`;
    if (actual !== plan.sourceChecksum) throw new ReviewedDerivativeError('reviewed-derivative-source-integrity-mismatch', { blocked: true });
    return source;
  }

  private limits(): StorageLimits { return { ...DEFAULT_LIMITS, ...this.config.limits }; }
}

export function createDefaultReviewedDerivativeRenderer() {
  const bucket = process.env.TEACHER_REVIEW_DERIVATIVE_S3_BUCKET ?? process.env.SUBMISSION_S3_BUCKET ?? '';
  if (!bucket) {
    return {
      async render() {
        throw new ReviewedDerivativeError('reviewed-derivative-storage-not-configured', { retryable: true });
      },
    } satisfies ReviewedDerivativeRenderer;
  }
  return new S3AnnotatedMarkdownDerivativeRenderer({
    bucket,
    sourceBucket: process.env.SUBMISSION_S3_BUCKET ?? bucket,
    prefix: process.env.TEACHER_REVIEW_DERIVATIVE_S3_PREFIX ?? 'teacher-reviewed',
    endpoint: process.env.SUBMISSION_S3_ENDPOINT,
    region: process.env.SUBMISSION_S3_REGION,
    accessKey: process.env.TEACHER_REVIEW_DERIVATIVE_S3_ACCESS_KEY ?? process.env.SUBMISSION_S3_ACCESS_KEY,
    secretKey: process.env.TEACHER_REVIEW_DERIVATIVE_S3_SECRET_KEY ?? process.env.SUBMISSION_S3_SECRET_KEY,
  });
}

export async function readReviewedDerivativeObject(objectKey: string) {
  const bucket = process.env.TEACHER_REVIEW_DERIVATIVE_S3_BUCKET ?? process.env.SUBMISSION_S3_BUCKET ?? '';
  if (!bucket || !objectKey) throw new ReviewedDerivativeError('reviewed-derivative-storage-not-configured');
  const accessKey = process.env.TEACHER_REVIEW_DERIVATIVE_S3_ACCESS_KEY ?? process.env.SUBMISSION_S3_ACCESS_KEY;
  const secretKey = process.env.TEACHER_REVIEW_DERIVATIVE_S3_SECRET_KEY ?? process.env.SUBMISSION_S3_SECRET_KEY;
  const client = new S3Client({
    endpoint: process.env.SUBMISSION_S3_ENDPOINT,
    region: process.env.SUBMISSION_S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: accessKey && secretKey ? { accessKeyId: accessKey, secretAccessKey: secretKey } : undefined,
  });
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  if (!response.Body) throw new ReviewedDerivativeError('reviewed-derivative-object-empty', { retryable: true });
  return response.Body.transformToByteArray();
}

function renderMarkdown(plan: ReviewedDerivativePlan) {
  const limitations = plan.limitations.length > 0
    ? `\n## Limitations\n\n${plan.limitations.map((value) => `- ${value}`).join('\n')}\n`
    : '';
  const annotations = plan.annotations.length > 0
    ? plan.annotations.map((annotation, index) => {
      const anchor = annotation.anchor ?? {};
      const precision = String(anchor.precision ?? 'GENERAL');
      const location = precision === 'SPAN' ? `span ${String(anchor.spanStart)}-${String(anchor.spanEnd)}`
        : precision === 'BLOCK' ? `block ${String(anchor.blockId)}`
          : precision === 'PAGE' ? `page ${String(anchor.pageNumber)}` : 'general comment';
      return `${index + 1}. [${location}] ${String(annotation.comment ?? '')}`;
    }).join('\n')
    : 'No inline annotations.';
  return `# Reviewed submission\n\nSource checksum: ${plan.sourceChecksum}\nReview checksum: ${plan.reviewSnapshotChecksum}\nAnchor precision: ${plan.anchorPrecision}\n${limitations}\n## Reviewed content\n\n${plan.canonicalMarkdown}\n\n## Teacher annotations\n\n${annotations}\n\n## Overall comment\n\n${plan.overallComment ?? ''}\n`;
}

async function renderDocx(plan: ReviewedDerivativePlan, source: Uint8Array, limits: StorageLimits) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(source);
  } catch {
    throw new ReviewedDerivativeError('reviewed-derivative-docx-invalid', { blocked: true });
  }
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > limits.maxZipEntries) throw new ReviewedDerivativeError('reviewed-derivative-docx-entry-limit', { blocked: true });
  let expandedTotal = 0;
  for (const entry of entries) {
    const expanded = Number((entry as any)?._data?.uncompressedSize);
    if (!Number.isInteger(expanded) || expanded < 0) throw new ReviewedDerivativeError('reviewed-derivative-docx-entry-size-unavailable', { blocked: true });
    if (expanded > limits.maxZipEntryBytes) throw new ReviewedDerivativeError('reviewed-derivative-docx-entry-size-limit', { blocked: true });
    expandedTotal += expanded;
  }
  if (expandedTotal > limits.maxZipExpandedBytes) throw new ReviewedDerivativeError('reviewed-derivative-docx-expanded-size-limit', { blocked: true });
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new ReviewedDerivativeError('reviewed-derivative-docx-document-missing', { blocked: true });
  const document = parseXml(await boundedZipText(documentFile, limits), 'reviewed-derivative-docx-document-invalid', limits);
  const anchorMap = buildWordAnchorMap(document);
  if (anchorMap.canonicalText !== plan.canonicalMarkdown) throw new NativeFallbackError('reviewed-derivative-docx-anchor-map-mismatch');
  const existingCommentsFile = zip.file('word/comments.xml');
  const existingCommentsDocument = existingCommentsFile ? parseXml(await boundedZipText(existingCommentsFile, limits), 'reviewed-derivative-docx-comments-invalid', limits) : null;
  const usedCommentIds = collectWordCommentIds(document, existingCommentsDocument);
  let nextCommentId = usedCommentIds.size > 0 ? Math.max(...usedCommentIds) + 1 : 0;
  const comments = plan.annotations.map((annotation) => ({ id: nextCommentId++, comment: String(annotation.comment ?? ''), anchor: annotation.anchor }));
  for (const entry of [...comments].sort((a, b) => Number(b.anchor.spanStart) - Number(a.anchor.spanStart))) {
    const start = Number(entry.anchor.spanStart);
    const end = Number(entry.anchor.spanEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > anchorMap.canonicalText.length) {
      throw new NativeFallbackError('reviewed-derivative-docx-range-invalid');
    }
    const rawRange = anchorMap.toRawRange(start, end);
    insertWordCommentRange(document, rawRange.start, rawRange.end, entry.id);
  }
  zip.file('word/document.xml', new XMLSerializer().serializeToString(document));
  zip.file('word/comments.xml', mergeCommentsXml(existingCommentsDocument, comments));
  await ensureDocxCommentRelationship(zip, limits);
  await ensureDocxCommentContentType(zip, limits);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

async function renderPdf(plan: ReviewedDerivativePlan, source: Uint8Array, limits: StorageLimits) {
  const header = new TextDecoder('latin1').decode(source.subarray(0, Math.min(source.byteLength, 1024)));
  if (!header.includes('%PDF-')) throw new ReviewedDerivativeError('reviewed-derivative-pdf-invalid', { blocked: true });
  const objectCount = (new TextDecoder('latin1').decode(source).match(/\b\d+\s+\d+\s+obj\b/g) ?? []).length;
  if (objectCount > limits.maxPdfObjects) throw new ReviewedDerivativeError('reviewed-derivative-pdf-object-limit', { blocked: true });
  try {
    return await runPdfWorker({ source, plan, limits });
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    if (code.startsWith('fallback:')) throw new NativeFallbackError(code.slice('fallback:'.length));
    throw new ReviewedDerivativeError(code.startsWith('blocked:') ? code.slice('blocked:'.length) : 'reviewed-derivative-pdf-worker-failed', { blocked: true });
  }
}

function insertWordCommentRange(document: XmlDocument, start: number, end: number, id: number) {
  const endBoundary = splitWordTextAt(document, end);
  const endMarker = document.createElementNS(WORD_NS, 'w:commentRangeEnd');
  endMarker.setAttributeNS(WORD_NS, 'w:id', String(id));
  endBoundary.parent.insertBefore(endMarker, endBoundary.before);
  const referenceRun = document.createElementNS(WORD_NS, 'w:r');
  const reference = document.createElementNS(WORD_NS, 'w:commentReference');
  reference.setAttributeNS(WORD_NS, 'w:id', String(id));
  referenceRun.appendChild(reference);
  endBoundary.parent.insertBefore(referenceRun, endBoundary.before);
  const startBoundary = splitWordTextAt(document, start);
  const startMarker = document.createElementNS(WORD_NS, 'w:commentRangeStart');
  startMarker.setAttributeNS(WORD_NS, 'w:id', String(id));
  startBoundary.parent.insertBefore(startMarker, startBoundary.before);
}

function splitWordTextAt(document: XmlDocument, offset: number): { parent: XmlNode; before: XmlNode | null } {
  const nodes = Array.from(document.getElementsByTagName('w:t'));
  let cursor = 0;
  for (const textNode of nodes) {
    const value = textNode.textContent ?? '';
    const next = cursor + value.length;
    if (offset >= cursor && offset <= next) {
      const run = textNode.parentNode;
      const parent = run?.parentNode;
      if (!run || !parent || run.nodeName !== 'w:r' || (run as XmlElement).getElementsByTagName('w:t').length !== 1) {
        throw new NativeFallbackError('reviewed-derivative-docx-run-unsupported');
      }
      const local = offset - cursor;
      if (local === 0) return { parent, before: run };
      if (local === value.length) return { parent, before: run.nextSibling };
      const left = run.cloneNode(true) as XmlElement;
      const right = run.cloneNode(true) as XmlElement;
      left.getElementsByTagName('w:t')[0].textContent = value.slice(0, local);
      right.getElementsByTagName('w:t')[0].textContent = value.slice(local);
      parent.insertBefore(left, run);
      parent.insertBefore(right, run);
      parent.removeChild(run);
      return { parent, before: right };
    }
    cursor = next;
  }
  throw new NativeFallbackError('reviewed-derivative-docx-range-invalid');
}

async function ensureDocxCommentRelationship(zip: JSZip, limits: StorageLimits) {
  const path = 'word/_rels/document.xml.rels';
  const file = zip.file(path);
  const document = parseXml(file ? await boundedZipText(file, limits) : `<Relationships xmlns="${REL_NS}"/>`, 'reviewed-derivative-docx-relationships-invalid', limits);
  const commentRelationships = Array.from(document.getElementsByTagName('Relationship')).filter((node) => node.getAttribute('Type') === COMMENT_REL);
  if (commentRelationships.length > 1 || commentRelationships.some((node) => node.getAttribute('Target') !== 'comments.xml' || node.getAttribute('TargetMode') === 'External')) throw new NativeFallbackError('docx-comments-relationship-unsupported');
  const existing = commentRelationships[0];
  if (!Array.from(document.getElementsByTagName('Relationship')).some((node) => node.getAttribute('Type') === COMMENT_REL)) {
    const relationship = document.createElementNS(REL_NS, 'Relationship');
    relationship.setAttribute('Id', uniqueRelationshipId(document));
    relationship.setAttribute('Type', COMMENT_REL);
    relationship.setAttribute('Target', 'comments.xml');
    document.documentElement!.appendChild(relationship);
  }
  zip.file(path, new XMLSerializer().serializeToString(document));
}

async function ensureDocxCommentContentType(zip: JSZip, limits: StorageLimits) {
  const path = '[Content_Types].xml';
  const file = zip.file(path);
  if (!file) throw new ReviewedDerivativeError('reviewed-derivative-docx-content-types-missing', { blocked: true });
  const document = parseXml(await boundedZipText(file, limits), 'reviewed-derivative-docx-content-types-invalid', limits);
  if (!Array.from(document.getElementsByTagName('Override')).some((node) => node.getAttribute('PartName') === '/word/comments.xml')) {
    const override = document.createElementNS(CONTENT_TYPES_NS, 'Override');
    override.setAttribute('PartName', '/word/comments.xml');
    override.setAttribute('ContentType', COMMENTS_CONTENT_TYPE);
    document.documentElement!.appendChild(override);
  }
  zip.file(path, new XMLSerializer().serializeToString(document));
}

function mergeCommentsXml(existing: XmlDocument | null, comments: Array<{ id: number; comment: string }>) {
  const document = existing ?? new DOMParser().parseFromString(`<w:comments xmlns:w="${WORD_NS}"/>`, 'application/xml');
  for (const entry of comments) {
    const comment = document.createElementNS(WORD_NS, 'w:comment');
    comment.setAttributeNS(WORD_NS, 'w:id', String(entry.id));
    comment.setAttributeNS(WORD_NS, 'w:author', 'Teacher');
    const paragraph = document.createElementNS(WORD_NS, 'w:p');
    const run = document.createElementNS(WORD_NS, 'w:r');
    const text = document.createElementNS(WORD_NS, 'w:t');
    text.appendChild(document.createTextNode(entry.comment));
    run.appendChild(text); paragraph.appendChild(run); comment.appendChild(paragraph); document.documentElement!.appendChild(comment);
  }
  return new XMLSerializer().serializeToString(document);
}

function collectWordCommentIds(document: XmlDocument, comments: XmlDocument | null) {
  const ids = new Set<number>();
  for (const tag of ['w:commentRangeStart', 'w:commentRangeEnd', 'w:commentReference']) {
    for (const node of Array.from(document.getElementsByTagName(tag))) addCommentId(ids, node.getAttribute('w:id'));
  }
  if (comments) for (const node of Array.from(comments.getElementsByTagName('w:comment'))) addCommentId(ids, node.getAttribute('w:id'));
  return ids;
}

function addCommentId(ids: Set<number>, value: string | null) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 0) ids.add(parsed);
}

function parseXml(xml: string, code: string, limits: StorageLimits) {
  if (xml.length > limits.maxXmlBytes || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new ReviewedDerivativeError('reviewed-derivative-xml-complexity-limit', { blocked: true });
  const errors: string[] = [];
  const document = new DOMParser({ onError: (level, message) => { if (level === 'error' || level === 'fatalError') errors.push(message); } }).parseFromString(xml, 'application/xml');
  if (errors.length > 0 || document.getElementsByTagName('parsererror').length > 0) throw new ReviewedDerivativeError(code, { blocked: true });
  if (countXmlNodes(document, 0, limits) > limits.maxXmlNodes) throw new ReviewedDerivativeError('reviewed-derivative-xml-complexity-limit', { blocked: true });
  return document;
}

function buildWordAnchorMap(document: XmlDocument) {
  const paragraphs = Array.from(document.getElementsByTagName('w:p'));
  const canonicalCharacters: Array<{ value: string; rawStart: number; rawEnd: number }> = [];
  let rawCursor = 0;
  for (const paragraph of paragraphs) {
    const raw = Array.from(paragraph.getElementsByTagName('w:t')).map((node) => node.textContent ?? '').join('');
    const normalized = normalizeWordParagraph(raw, rawCursor);
    if (normalized.length > 0) {
      if (canonicalCharacters.length > 0) {
        const boundary = normalized[0].rawStart;
        canonicalCharacters.push({ value: '\n', rawStart: boundary, rawEnd: boundary }, { value: '\n', rawStart: boundary, rawEnd: boundary });
      }
      canonicalCharacters.push(...normalized);
    }
    rawCursor += raw.length;
  }
  const canonicalText = canonicalCharacters.map((character) => character.value).join('');
  return {
    canonicalText,
    toRawRange(start: number, end: number) {
      const first = canonicalCharacters[start];
      const last = canonicalCharacters[end - 1];
      if (!first || !last) throw new NativeFallbackError('reviewed-derivative-docx-range-invalid');
      return { start: first.rawStart, end: last.rawEnd };
    },
  };
}

function normalizeWordParagraph(raw: string, rawOffset: number) {
  const characters: Array<{ value: string; rawStart: number; rawEnd: number }> = [];
  let index = 0;
  while (index < raw.length && /\s/u.test(raw[index])) index += 1;
  while (index < raw.length) {
    if (/\s/u.test(raw[index])) {
      const start = index;
      while (index < raw.length && /\s/u.test(raw[index])) index += 1;
      if (index < raw.length) characters.push({ value: ' ', rawStart: rawOffset + start, rawEnd: rawOffset + index });
      continue;
    }
    characters.push({ value: raw[index], rawStart: rawOffset + index, rawEnd: rawOffset + index + 1 });
    index += 1;
  }
  return characters;
}

function uniqueRelationshipId(document: XmlDocument) {
  const ids = new Set(Array.from(document.getElementsByTagName('Relationship')).map((node) => node.getAttribute('Id')));
  let index = 1;
  while (ids.has(`rId${index}`)) index += 1;
  return `rId${index}`;
}

async function runPdfWorker(input: { source: Uint8Array; plan: ReviewedDerivativePlan; limits: StorageLimits }): Promise<Uint8Array> {
  const worker = new Worker(PDF_WORKER_SOURCE, {
    eval: true,
    workerData: { source: input.source, plan: { snapshotId: input.plan.snapshotId, nativeCapable: input.plan.nativeCapable, annotations: input.plan.annotations }, maxPdfPages: input.limits.maxPdfPages },
    resourceLimits: { maxOldGenerationSizeMb: input.limits.pdfMaxOldGenerationMb, maxYoungGenerationSizeMb: input.limits.pdfMaxYoungGenerationMb, stackSizeMb: input.limits.pdfStackMb },
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error('blocked:reviewed-derivative-pdf-timeout')); }, input.limits.pdfTimeoutMs);
    worker.once('message', (message: any) => {
      clearTimeout(timer); void worker.terminate();
      if (message?.error) reject(new Error(message.error));
      else resolve(new Uint8Array(message.bytes));
    });
    worker.once('error', () => { clearTimeout(timer); reject(new Error('blocked:reviewed-derivative-pdf-worker-failed')); });
    worker.once('exit', (code) => { if (code !== 0) { clearTimeout(timer); reject(new Error('blocked:reviewed-derivative-pdf-worker-resource-limit')); } });
  });
}

const PDF_WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { PDFArray, PDFDocument, PDFName } = require('pdf-lib');
function fallback(code) { throw new Error('fallback:' + code); }
function rect(bbox, p, width, height, rotation) {
  if (!p || p.rotation !== rotation || ![0,90,180,270].includes(rotation)) fallback('pdf-coordinate-provenance-mismatch');
  const dw = rotation === 90 || rotation === 270 ? height : width;
  const dh = rotation === 90 || rotation === 270 ? width : height;
  let [x1,y1,x2,y2] = bbox;
  if (p.unit === 'NORMALIZED') { if (p.pageWidth !== dw || p.pageHeight !== dh) fallback('pdf-coordinate-provenance-mismatch'); x1*=dw;x2*=dw;y1*=dh;y2*=dh; }
  else if (p.unit === 'PIXEL') { x1*=dw/p.pageWidth;x2*=dw/p.pageWidth;y1*=dh/p.pageHeight;y2*=dh/p.pageHeight; }
  else if (p.unit !== 'PDF_POINT' || p.pageWidth !== dw || p.pageHeight !== dh) fallback('pdf-coordinate-provenance-mismatch');
  if (p.origin === 'TOP_LEFT') [y1,y2]=[dh-y2,dh-y1]; else if (p.origin !== 'BOTTOM_LEFT') fallback('pdf-coordinate-provenance-mismatch');
  if (rotation === 90) return [width-y2,x1,width-y1,x2];
  if (rotation === 180) return [width-x2,height-y2,width-x1,height-y1];
  if (rotation === 270) return [y1,height-x2,y2,height-x1];
  return [x1,y1,x2,y2];
}
function valid(r,w,h) { return Array.isArray(r)&&r.length===4&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>=0&&r[0]<r[2]&&r[1]<r[3]&&r[2]<=w&&r[3]<=h; }
(async()=>{try{
  const pdf=await PDFDocument.load(workerData.source,{updateMetadata:false});
  if(pdf.getPageCount()>workerData.maxPdfPages) throw new Error('blocked:reviewed-derivative-pdf-page-limit');
  for(const [i,a] of workerData.plan.annotations.entries()){
    const anchor=a.anchor||{}; const n=workerData.plan.nativeCapable?Number(anchor.pageNumber):1; const page=pdf.getPages()[n-1]; if(!page) fallback('reviewed-derivative-pdf-page-invalid');
    const r=workerData.plan.nativeCapable?rect(anchor.bbox,anchor.coordinateProvenance,page.getWidth(),page.getHeight(),page.getRotation().angle):[12,Math.max(12,page.getHeight()-32),32,Math.max(32,page.getHeight()-12)];
    if(!valid(r,page.getWidth(),page.getHeight())) fallback('reviewed-derivative-pdf-geometry-mismatch');
    const d=pdf.context.obj({Type:'Annot',Subtype:'Text',Rect:r,Contents:String(a.comment||''),T:'Teacher review',NM:workerData.plan.snapshotId+':'+i,F:4}); const ref=pdf.context.register(d);
    let annots=page.node.lookupMaybe(PDFName.of('Annots'),PDFArray); if(!annots){annots=pdf.context.obj([]);page.node.set(PDFName.of('Annots'),annots);} annots.push(ref);
  }
  const bytes=await pdf.save(); parentPort.postMessage({bytes},[bytes.buffer]);
}catch(e){const m=String(e&&e.message||e);parentPort.postMessage({error:m.startsWith('fallback:')||m.startsWith('blocked:')?m:'blocked:reviewed-derivative-pdf-invalid'});}})();`;

async function boundedZipText(file: JSZip.JSZipObject, limits: StorageLimits) {
  const bytes = await file.async('uint8array');
  if (bytes.byteLength > limits.maxXmlBytes) throw new ReviewedDerivativeError('reviewed-derivative-xml-complexity-limit', { blocked: true });
  return new TextDecoder().decode(bytes);
}

async function readBodyBounded(body: any, maxBytes: number) {
  if (typeof body?.[Symbol.asyncIterator] === 'function') {
    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
      const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk);
      total += bytes.byteLength;
      if (total > maxBytes) throw new ReviewedDerivativeError('reviewed-derivative-source-size-limit', { blocked: true });
      chunks.push(bytes);
    }
    const output = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
    return output;
  }
  const bytes = new Uint8Array(await body.transformToByteArray());
  if (bytes.byteLength > maxBytes) throw new ReviewedDerivativeError('reviewed-derivative-source-size-limit', { blocked: true });
  return bytes;
}

function countXmlNodes(node: XmlNode, depth: number, limits: StorageLimits): number {
  if (depth > limits.maxXmlDepth) throw new ReviewedDerivativeError('reviewed-derivative-xml-complexity-limit', { blocked: true });
  let count = 1;
  for (let child = node.firstChild; child; child = child.nextSibling) count += countXmlNodes(child, depth + 1, limits);
  return count;
}

class NativeFallbackError extends Error {
  constructor(readonly code: string) { super(code); }
}

const DEFAULT_LIMITS: StorageLimits = {
  maxSourceBytes: 64 * 1024 * 1024,
  maxZipEntries: 2_048,
  maxZipEntryBytes: 16 * 1024 * 1024,
  maxZipExpandedBytes: 128 * 1024 * 1024,
  maxXmlBytes: 8 * 1024 * 1024,
  maxXmlNodes: 200_000,
  maxXmlDepth: 128,
  maxPdfPages: 500,
  maxPdfObjects: 100_000,
  pdfTimeoutMs: 5_000,
  pdfMaxOldGenerationMb: 128,
  pdfMaxYoungGenerationMb: 32,
  pdfStackMb: 4,
};

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const COMMENT_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments';
const COMMENTS_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml';

function safeSegment(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 160);
}

function safeMetadata(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '_').slice(0, 512);
}
