import { createHash } from 'node:crypto';

import type { TextItem } from 'pdfjs-dist/types/src/display/api';

import {
  CourseBasisError,
  type CourseBasisSource,
  type ExtractedCourseBasisSegment,
} from './domain';

export const COURSE_BASIS_EXTRACTION_VERSION = 'course-basis-text-v1';
export const MAX_COURSE_BASIS_BYTES = 10 * 1024 * 1024;
export const MAX_COURSE_BASIS_PDF_PAGES = 300;
export const MAX_COURSE_BASIS_SEGMENTS = 10_000;
export const MAX_COURSE_BASIS_EXTRACTED_CHARS = 2_000_000;
export const MAX_COURSE_BASIS_SEGMENT_CHARS = 50_000;

export function normalizeCourseBasisMimeType(value: string) {
  return value.split(';', 1)[0].trim().toLowerCase();
}

const MIME_TYPES: Record<CourseBasisSource['sourceType'], readonly string[]> = {
  MARKDOWN: ['text/markdown', 'text/x-markdown'],
  PLAIN_TEXT: ['text/plain'],
  PASTED_TEXT: ['text/plain'],
  SEARCHABLE_PDF: ['application/pdf'],
};

type ExtractionResult = {
  byteSize: number;
  contentHash: string;
  originalContent: Uint8Array;
  normalizedText: string | null;
  extractionState: 'EXTRACTED' | 'UNSUPPORTED' | 'FAILED';
  failureReason: string | null;
  segments: ExtractedCourseBasisSegment[];
};

export function failedCourseBasisExtraction(source: CourseBasisSource, failureReason: string): ExtractionResult {
  const originalContent = typeof source.content === 'string'
    ? new TextEncoder().encode(source.content)
    : new Uint8Array(source.content);
  validateSource(source, originalContent);
  return {
    byteSize: originalContent.byteLength,
    contentHash: sha256(originalContent),
    originalContent,
    normalizedText: null,
    extractionState: 'FAILED',
    failureReason,
    segments: [],
  };
}

export async function extractCourseBasisSource(source: CourseBasisSource): Promise<ExtractionResult> {
  const originalContent = typeof source.content === 'string'
    ? new TextEncoder().encode(source.content)
    : new Uint8Array(source.content);
  validateSource(source, originalContent);

  const base = {
    byteSize: originalContent.byteLength,
    contentHash: sha256(originalContent),
    originalContent,
  };

  if (source.sourceType === 'SEARCHABLE_PDF') {
    const pdf = await extractPdf(originalContent);
    return { ...base, ...pdf };
  }

  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(originalContent);
  } catch {
    throw new CourseBasisError('invalid-text-encoding');
  }
  const text = normalizeText(decoded);
  if (!text) throw new CourseBasisError('empty-text-source');
  const segments = source.sourceType === 'MARKDOWN'
    ? segmentMarkdown(text)
    : segmentPlainText(text);
  if (segments.length === 0) throw new CourseBasisError('empty-text-source');
  assertExtractionBounds(segments);
  return {
    ...base,
    normalizedText: segments.map((segment) => segment.text).join('\n\n'),
    extractionState: 'EXTRACTED',
    failureReason: null,
    segments,
  };
}

function validateSource(source: CourseBasisSource, bytes: Uint8Array) {
  if (bytes.byteLength === 0) throw new CourseBasisError('empty-source');
  if (bytes.byteLength > MAX_COURSE_BASIS_BYTES) {
    throw new CourseBasisError('source-too-large', [String(MAX_COURSE_BASIS_BYTES)]);
  }
  const allowedMimeTypes = MIME_TYPES[source.sourceType] as readonly string[] | undefined;
  if (!allowedMimeTypes || typeof source.mimeType !== 'string'
    || !allowedMimeTypes.includes(normalizeCourseBasisMimeType(source.mimeType))) {
    throw new CourseBasisError('unsupported-source-type', [
      'application/pdf',
      'text/markdown',
      'text/plain',
    ]);
  }
  const pdfSignature = new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  if (source.sourceType === 'SEARCHABLE_PDF' && !pdfSignature) {
    throw new CourseBasisError('mime-content-mismatch');
  }
  if (source.sourceType !== 'SEARCHABLE_PDF' && (pdfSignature || bytes.includes(0))) {
    throw new CourseBasisError('mime-content-mismatch');
  }
}

async function extractPdf(bytes: Uint8Array): Promise<Omit<ExtractionResult, 'byteSize' | 'contentHash' | 'originalContent'>> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: bytes.slice(), isEvalSupported: false, useWorkerFetch: false });
  let document;
  try {
    document = await task.promise;
  } catch {
    await task.destroy().catch(() => undefined);
    throw new CourseBasisError('pdf-extraction-failed');
  }
  if (document.numPages > MAX_COURSE_BASIS_PDF_PAGES) {
    await document.destroy();
    throw new CourseBasisError('pdf-page-limit-exceeded', [String(MAX_COURSE_BASIS_PDF_PAGES)]);
  }
  const segments: ExtractedCourseBasisSegment[] = [];
  let extractedChars = 0;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const paragraphs = pdfParagraphs(content.items.filter((item): item is TextItem => 'str' in item));
      paragraphs.forEach((text, index) => {
        const segment = makeSegment({
          orderIndex: segments.length,
          stableAnchor: `page:${pageNumber}/paragraph:${index + 1}`,
          headingPath: [],
          pageNumber,
          paragraphNumber: index + 1,
          text,
        });
        extractedChars = pushBoundedSegment(segments, segment, extractedChars);
      });
    }
  } catch (error) {
    if (error instanceof CourseBasisError) throw error;
    throw new CourseBasisError('pdf-extraction-failed');
  } finally {
    await document.destroy();
  }
  if (segments.length === 0) {
    return {
      normalizedText: null,
      extractionState: 'UNSUPPORTED',
      failureReason: 'scan-or-empty-text-layer',
      segments: [],
    };
  }
  return {
    normalizedText: segments.map((segment) => segment.text).join('\n\n'),
    extractionState: 'EXTRACTED',
    failureReason: null,
    segments,
  };
}

function pdfParagraphs(items: TextItem[]): string[] {
  const paragraphs: string[] = [];
  let current = '';
  for (const item of items) {
    const piece = normalizeInlineText(item.str);
    if (piece) current = current ? `${current} ${piece}` : piece;
    if (item.hasEOL && current) {
      paragraphs.push(current);
      current = '';
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs.filter(Boolean);
}

function segmentMarkdown(text: string): ExtractedCourseBasisSegment[] {
  const headingPath: Array<{ level: number; label: string; anchor: string }> = [];
  const allocatedHeadingAnchors = new Set<string>();
  const paragraphCounts = new Map<string, number>();
  const segments: ExtractedCourseBasisSegment[] = [];
  let extractedChars = 0;
  let paragraph: string[] = [];

  const flush = () => {
    const value = normalizeInlineText(paragraph.join(' '));
    paragraph = [];
    if (!value) return;
    const path = headingPath.map((heading) => heading.label);
    const key = path.join('/');
    const paragraphNumber = (paragraphCounts.get(key) ?? 0) + 1;
    paragraphCounts.set(key, paragraphNumber);
    const anchorPath = headingPath.map((heading) => `h${heading.level}:${heading.anchor}`).join('/');
    extractedChars = pushBoundedSegment(segments, makeSegment({
      orderIndex: segments.length,
      stableAnchor: `${anchorPath || 'root'}/paragraph:${paragraphNumber}`,
      headingPath: path,
      pageNumber: null,
      paragraphNumber,
      text: value,
    }), extractedChars);
  };

  for (const line of text.split('\n')) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      const textValue = normalizeInlineText(heading[2]);
      while (headingPath.length && headingPath[headingPath.length - 1].level >= level) headingPath.pop();
      const slugValue = slug(textValue);
      const parentAnchor = headingPath.map((item) => item.anchor).join('/');
      let occurrence = 1;
      let anchor = slugValue;
      while (allocatedHeadingAnchors.has(`${parentAnchor}/${anchor}`)) {
        occurrence += 1;
        anchor = `${slugValue}-${occurrence}`;
      }
      allocatedHeadingAnchors.add(`${parentAnchor}/${anchor}`);
      headingPath.push({
        level,
        label: occurrence === 1 ? textValue : `${textValue} (${occurrence})`,
        anchor,
      });
      continue;
    }
    if (!line.trim()) flush();
    else paragraph.push(line.trim());
  }
  flush();
  return segments;
}

function segmentPlainText(text: string): ExtractedCourseBasisSegment[] {
  const segments: ExtractedCourseBasisSegment[] = [];
  let extractedChars = 0;
  for (const paragraph of text.split(/\n\s*\n+/)) {
    const value = normalizeInlineText(paragraph);
    if (!value) continue;
    const paragraphNumber = segments.length + 1;
    extractedChars = pushBoundedSegment(segments, makeSegment({
      orderIndex: segments.length,
      stableAnchor: `root/paragraph:${paragraphNumber}`,
      headingPath: [],
      pageNumber: null,
      paragraphNumber,
      text: value,
    }), extractedChars);
  }
  return segments;
}

function makeSegment(input: Omit<ExtractedCourseBasisSegment, 'contentHash'>): ExtractedCourseBasisSegment {
  return { ...input, contentHash: sha256(new TextEncoder().encode(input.text)) };
}

function assertExtractionBounds(segments: ExtractedCourseBasisSegment[]) {
  let extractedChars = 0;
  for (const segment of segments) extractedChars = assertSegmentBounds(segment, segments.length, extractedChars);
}

function pushBoundedSegment(
  segments: ExtractedCourseBasisSegment[],
  segment: ExtractedCourseBasisSegment,
  extractedChars: number,
) {
  const nextChars = assertSegmentBounds(segment, segments.length + 1, extractedChars);
  segments.push(segment);
  return nextChars;
}

function assertSegmentBounds(segment: ExtractedCourseBasisSegment, segmentCount: number, extractedChars: number) {
  if (segmentCount > MAX_COURSE_BASIS_SEGMENTS) {
    throw new CourseBasisError('segment-limit-exceeded', [String(MAX_COURSE_BASIS_SEGMENTS)]);
  }
  if (segment.text.length > MAX_COURSE_BASIS_SEGMENT_CHARS) {
    throw new CourseBasisError('segment-text-limit-exceeded', [String(MAX_COURSE_BASIS_SEGMENT_CHARS)]);
  }
  const nextChars = extractedChars + segment.text.length + (segmentCount > 1 ? 2 : 0);
  if (nextChars > MAX_COURSE_BASIS_EXTRACTED_CHARS) {
    throw new CourseBasisError('extracted-text-limit-exceeded', [String(MAX_COURSE_BASIS_EXTRACTED_CHARS)]);
  }
  return nextChars;
}

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function slug(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '') || 'section';
}

function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}
