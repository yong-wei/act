import { createHash } from 'node:crypto';
import { posix } from 'node:path';

import { DOMParser, XMLSerializer, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import JSZip from 'jszip';

import type { EvidenceBlockInput } from './math-document-grading-contracts';

export const WORD_REPRESENTATION_VERSION = 'math-document-word-representation.v1' as const;
export const WORD_ANCHOR_VERSION = 'math-document-word-anchor.v1' as const;

export type SubmissionDocumentFormat = 'docx' | 'doc' | 'wps' | 'pdf' | 'image' | 'text' | 'zip' | 'unknown';
export type WordIntegrityVerdict = 'scorable' | 'review' | 'blocked';

export class WordRepresentationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'WordRepresentationError';
  }
}

export interface SubmissionDocumentFormatDetection {
  claimedFormat: SubmissionDocumentFormat;
  detectedFormat: SubmissionDocumentFormat;
  supported: boolean;
  reasons: string[];
}

export interface WordRepresentationAdapter {
  wordProcessorVersion?: string;
  resolveWordProcessorVersion?(signal?: AbortSignal): Promise<string>;
  normalizeLegacyDoc?(bytes: Uint8Array, signal?: AbortSignal): Promise<Uint8Array>;
  renderPdf(bytes: Uint8Array, signal?: AbortSignal): Promise<Uint8Array>;
  extractPdfPages?(bytes: Uint8Array): Promise<PdfPageRepresentation[]>;
}

export interface PdfPageRepresentation {
  pageNumber: number;
  text: string;
  imageCount: number;
  pageWidth?: number;
  pageHeight?: number;
  rotation?: 0 | 90 | 180 | 270;
  textItems?: Array<{ text: string; bbox: [number, number, number, number] }>;
}

export interface WordParagraphRepresentation {
  id: string;
  paragraphIndex: number;
  text: string;
  questionId: string | null;
  introducesQuestion: boolean;
}

export interface WordFormulaRepresentation {
  id: string;
  paragraphId: string;
  questionId: string | null;
  text: string;
  omml: string;
}

export interface WordImageRepresentation {
  id: string;
  paragraphId: string;
  questionId: string | null;
  relationshipId: string;
  path: string;
  mediaType: string;
  checksum: string;
  bytes: Buffer;
}

export interface WordRepresentationAnchor {
  blockId: string;
  paragraphId: string;
  questionId: string | null;
  sourcePart: 'word/document.xml';
  pdfPageNumber: number | null;
  bbox: [number, number, number, number] | null;
  coordinateProvenance: { origin: 'BOTTOM_LEFT'; unit: 'PDF_POINT'; pageWidth: number; pageHeight: number; rotation: 0 | 90 | 180 | 270 } | null;
  precision: 'page' | 'block';
  mappingDecision: 'pdf-text-region-match' | 'pdf-page-match' | 'paragraph-order-fallback';
  mappingConfidence: number;
  verified: boolean;
}

export interface WordImagePageAnchor {
  imageId: string;
  paragraphId: string;
  questionId: string | null;
  pdfPageNumber: number | null;
  verified: boolean;
  mappingMethod: 'rendered-image-order' | 'unresolved';
}

export interface WordIntegrityIssue {
  code: string;
  severity: 'review' | 'blocked';
  questionId: string | null;
  blockId: string | null;
}

export interface WordQuestionState {
  questionId: string;
  state: 'scorable' | 'review-required' | 'blocked';
  reasons: string[];
  candidateBlockIds: string[];
  selectedBlockIds: string[];
  mappingDecision: 'pdf-text-region-match' | 'pdf-page-match' | 'paragraph-order-fallback' | 'unmapped';
  mappingConfidence: number;
}

export interface WordDualRepresentation {
  schemaVersion: typeof WORD_REPRESENTATION_VERSION;
  anchorVersion: typeof WORD_ANCHOR_VERSION;
  sourceFormat: 'docx' | 'doc';
  normalizedFormat: 'docx';
  sourceChecksum: string;
  normalizedChecksum: string;
  renderedPdfChecksum: string;
  renderedPdfPageCount: number;
  extractorVersion: string;
  normalizerVersion: string | null;
  rendererVersion: string;
  normalizedDocxBytes: Buffer;
  renderedPdfBytes: Buffer;
  markdown: string;
  blocks: EvidenceBlockInput[];
  paragraphs: WordParagraphRepresentation[];
  formulas: WordFormulaRepresentation[];
  images: WordImageRepresentation[];
  imageAnchors: WordImagePageAnchor[];
  anchors: WordRepresentationAnchor[];
  questionStates: WordQuestionState[];
  integrity: { verdict: WordIntegrityVerdict; issues: WordIntegrityIssue[] };
}

interface RawParagraph {
  paragraph: WordParagraphRepresentation;
  formulas: Array<{ text: string; omml: string }>;
  imageRelationshipIds: string[];
}

interface ImageRelationship {
  id: string;
  path: string | null;
}

const MAX_ZIP_ENTRIES = 2_048;
const MAX_ZIP_EXPANDED_BYTES = 128 * 1024 * 1024;
const MAX_XML_BYTES = 8 * 1024 * 1024;
const MAX_XML_NODES = 200_000;
const MAX_XML_DEPTH = 128;
const DOC_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const LEGACY_WORD_DOCUMENT_STREAM = Buffer.from('WordDocument', 'utf16le');
const QUESTION_ID = /\b([A-Za-z]\d+(?:-\d+)+)\b/u;
const QUESTION_IDS = /\b[A-Za-z]\d+(?:-\d+)+\b/gu;

export async function detectSubmissionDocumentFormat(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<SubmissionDocumentFormatDetection> {
  const claimedFormat = claimedDocumentFormat(input.fileName, input.mimeType);
  const detectedFormat = await detectedDocumentFormat(input.bytes);
  const reasons: string[] = [];
  if (claimedFormat === 'wps') reasons.push('word-format-wps-unsupported');
  if (['docx', 'doc'].includes(claimedFormat) && claimedFormat !== detectedFormat) reasons.push('word-format-mismatch');
  if (!['docx', 'doc'].includes(detectedFormat)) reasons.push('word-format-unsupported');
  return {
    claimedFormat,
    detectedFormat,
    supported: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}

export async function createWordDualRepresentation(input: {
  sourceBytes: Uint8Array;
  fileName: string;
  mimeType: string;
  expectedQuestionIds?: readonly string[];
  crossModalSignals?: ReadonlyArray<{ questionId: string; consistent: boolean }>;
  adapter: WordRepresentationAdapter;
  signal?: AbortSignal;
}): Promise<WordDualRepresentation> {
  const detection = await detectSubmissionDocumentFormat({
    bytes: input.sourceBytes,
    fileName: input.fileName,
    mimeType: input.mimeType,
  });
  if (detection.claimedFormat === 'wps') throw new WordRepresentationError('word-format-wps-unsupported');
  if (!detection.supported) throw new WordRepresentationError(detection.reasons[0] ?? 'word-format-unsupported');
  const sourceFormat = detection.detectedFormat as 'docx' | 'doc';
  const wordProcessorVersion = await resolveWordProcessorVersion(input.adapter, input.signal);
  const normalizedDocxBytes = sourceFormat === 'docx'
    ? Buffer.from(input.sourceBytes)
    : Buffer.from(await requireLegacyNormalization(input.adapter, input.sourceBytes, input.signal));
  const normalizedDetection = await detectedDocumentFormat(normalizedDocxBytes);
  if (normalizedDetection !== 'docx') throw new WordRepresentationError('legacy-doc-normalization-invalid');

  const expectedQuestionIds = [...new Set(input.expectedQuestionIds ?? [])];
  const extracted = await extractDocxRepresentation(normalizedDocxBytes, expectedQuestionIds);
  let renderedPdfBytes: Buffer;
  try {
    renderedPdfBytes = Buffer.from(await input.adapter.renderPdf(normalizedDocxBytes, input.signal));
  } catch {
    throw new WordRepresentationError('word-pdf-render-failed');
  }
  if (!startsWith(renderedPdfBytes, Buffer.from('%PDF-'))) throw new WordRepresentationError('word-pdf-render-invalid');
  const pdfPages = await (input.adapter.extractPdfPages ?? extractPdfPages)(renderedPdfBytes);
  const mapped = mapParagraphsToPdf(extracted.paragraphs, pdfPages);
  const issues = [...extracted.issues, ...mapped.issues, ...detectCrossQuestionRegionOverlaps(mapped.blocks)];

  const hasElectronicAnswerContent = extracted.formulas.length > 0
    || extracted.paragraphs.some((paragraph) => substantiveText(paragraph.text).length > 0);
  if (!hasElectronicAnswerContent && extracted.images.length > 0) {
    issues.push(issue('scanned-document-unsupported', 'blocked'));
  } else if (!hasElectronicAnswerContent) {
    issues.push(issue('word-content-empty', 'blocked'));
  }
  const renderedImageCount = pdfPages.reduce((sum, page) => sum + page.imageCount, 0);
  if (extracted.images.length > renderedImageCount) issues.push(issue('rendered-image-missing', 'review'));
  for (const signal of input.crossModalSignals ?? []) {
    if (!signal.consistent) issues.push(issue('text-image-conflict', 'review', signal.questionId));
  }

  const questionStates = buildQuestionStates(expectedQuestionIds, extracted, mapped.blocks, issues);
  const verdict = issues.some((entry) => entry.severity === 'blocked')
    ? 'blocked'
    : issues.length > 0 ? 'review' : 'scorable';
  const blocks = mapped.blocks;
  return {
    schemaVersion: WORD_REPRESENTATION_VERSION,
    anchorVersion: WORD_ANCHOR_VERSION,
    sourceFormat,
    normalizedFormat: 'docx',
    sourceChecksum: checksum(input.sourceBytes),
    normalizedChecksum: checksum(normalizedDocxBytes),
    renderedPdfChecksum: checksum(renderedPdfBytes),
    renderedPdfPageCount: pdfPages.length,
    extractorVersion: WORD_REPRESENTATION_VERSION,
    normalizerVersion: sourceFormat === 'doc' ? wordProcessorVersion : null,
    rendererVersion: wordProcessorVersion,
    normalizedDocxBytes,
    renderedPdfBytes,
    markdown: blocks.map((block) => block.markdown ?? block.text).join('\n\n'),
    blocks,
    paragraphs: extracted.paragraphs,
    formulas: extracted.formulas,
    images: extracted.images,
    imageAnchors: mapImagesToPdf(extracted.images, pdfPages),
    anchors: mapped.anchors,
    questionStates,
    integrity: { verdict, issues: uniqueIssues(issues) },
  };
}

async function extractDocxRepresentation(bytes: Buffer, expectedQuestionIds: readonly string[]) {
  const archive = await loadValidatedDocx(bytes);
  const document = parseXml(await readZipText(archive, 'word/document.xml'));
  const rawParagraphs = readParagraphs(document, expectedQuestionIds);
  const relationships = await readImageRelationships(archive);
  const contentTypes = parseContentTypes(parseXml(await readZipText(archive, '[Content_Types].xml')));
  const issues: WordIntegrityIssue[] = [];
  const formulas: WordFormulaRepresentation[] = [];
  const images: WordImageRepresentation[] = [];

  for (const raw of rawParagraphs) {
    raw.formulas.forEach((formula) => {
      const entry = {
        id: `word-formula-${formulas.length + 1}`,
        paragraphId: raw.paragraph.id,
        questionId: raw.paragraph.questionId,
        text: formula.text,
        omml: formula.omml,
      };
      formulas.push(entry);
      if (!formula.text.trim() || formula.text.includes('\uFFFD')) {
        issues.push(issue('formula-content-invalid', 'review', raw.paragraph.questionId, raw.paragraph.id));
      }
    });
    for (const relationshipId of raw.imageRelationshipIds) {
      const relationship = relationships.get(relationshipId);
      if (!relationship?.path) {
        issues.push(issue('image-relationship-missing', 'review', raw.paragraph.questionId, raw.paragraph.id));
        continue;
      }
      const file = archive.file(relationship.path);
      if (!file) {
        issues.push(issue('image-target-missing', 'review', raw.paragraph.questionId, raw.paragraph.id));
        continue;
      }
      const imageBytes = Buffer.from(await file.async('uint8array'));
      images.push({
        id: `word-image-${images.length + 1}`,
        paragraphId: raw.paragraph.id,
        questionId: raw.paragraph.questionId,
        relationshipId,
        path: relationship.path,
        mediaType: contentTypes.get(posix.extname(relationship.path).slice(1).toLowerCase()) ?? 'application/octet-stream',
        checksum: checksum(imageBytes),
        bytes: imageBytes,
      });
    }
  }

  const paragraphs = rawParagraphs.map((entry) => entry.paragraph);
  const explicitQuestionCount = paragraphs.filter((paragraph) => paragraph.introducesQuestion).length;
  if (expectedQuestionIds.length > 1 && explicitQuestionCount === 0 && paragraphs.some((paragraph) => paragraph.text.trim())) {
    issues.push(issue('question-mapping-unresolved', 'review'));
  }
  return { paragraphs, formulas, images, issues };
}

function readParagraphs(document: XmlDocument, expectedQuestionIds: readonly string[]): RawParagraph[] {
  const paragraphElements = allElements(document).filter((element) => localName(element) === 'p');
  const raw = paragraphElements.map((element, paragraphIndex) => {
    const text = normalizeText(allElements(element)
      .filter((candidate) => localName(candidate) === 't')
      .map((candidate) => candidate.textContent ?? '')
      .join(''));
    const detectedQuestionId = text.match(/^\s*([A-Za-z]\d+(?:-\d+)+)(?:\s|[:：.、)）-]|$)/u)?.[1] ?? null;
    const questionOrdinal = text.match(/^\s*(?:[\(（]\s*)?(\d+)\s*(?:[\)）]|[.、:：-])(?:\s|$)/u)?.[1] ?? null;
    const ordinalCandidates = questionOrdinal
      ? expectedQuestionIds.filter((questionId) => questionId.split('-').at(-1) === questionOrdinal)
      : [];
    const explicitQuestionId = detectedQuestionId && (expectedQuestionIds.length === 0 || expectedQuestionIds.includes(detectedQuestionId))
      ? detectedQuestionId
      : ordinalCandidates.length === 1 ? ordinalCandidates[0]!
      : null;
    const formulaElements = allElements(element).filter((candidate) => localName(candidate) === 'oMath');
    const formulas = formulaElements.map((formula) => ({
      text: normalizeText(allElements(formula).filter((candidate) => localName(candidate) === 't').map((candidate) => candidate.textContent ?? '').join('')),
      omml: new XMLSerializer().serializeToString(formula),
    }));
    const imageRelationshipIds = allElements(element)
      .filter((candidate) => localName(candidate) === 'blip')
      .map((candidate) => attributeByLocalName(candidate, 'embed'))
      .filter((value): value is string => Boolean(value));
    return { paragraphIndex, text, explicitQuestionId, hasQuestionMarker: Boolean(detectedQuestionId || questionOrdinal), formulas, imageRelationshipIds };
  });
  const explicitIds = raw.flatMap((paragraph) => paragraph.explicitQuestionId ? [paragraph.explicitQuestionId] : []);
  let currentQuestionId: string | null = expectedQuestionIds.length === 1 ? expectedQuestionIds[0] : null;
  return raw.map((entry) => {
    if (entry.explicitQuestionId) currentQuestionId = entry.explicitQuestionId;
    else if (entry.hasQuestionMarker && expectedQuestionIds.length > 1) currentQuestionId = null;
    return {
      paragraph: {
        id: `word-paragraph-${entry.paragraphIndex + 1}`,
        paragraphIndex: entry.paragraphIndex,
        text: entry.text,
        questionId: currentQuestionId,
        introducesQuestion: entry.explicitQuestionId !== null,
      },
      formulas: entry.formulas,
      imageRelationshipIds: entry.imageRelationshipIds,
    };
  });
}

function mapParagraphsToPdf(
  paragraphs: WordParagraphRepresentation[],
  pages: PdfPageRepresentation[],
) {
  let spanStart = 0;
  const issues: WordIntegrityIssue[] = [];
  const anchors: WordRepresentationAnchor[] = [];
  const blocks = paragraphs.filter((paragraph) => paragraph.text.trim()).map((paragraph, blockIndex) => {
    const normalizedParagraph = comparableText(paragraph.text);
    const match = normalizedParagraph.length >= 2
      ? findPdfTextRegion(pages, normalizedParagraph)
      : null;
    const matchingPage = match?.page;
    const coordinateProvenance = match?.bbox && matchingPage?.pageWidth && matchingPage.pageHeight
      ? { origin: 'BOTTOM_LEFT' as const, unit: 'PDF_POINT' as const, pageWidth: matchingPage.pageWidth, pageHeight: matchingPage.pageHeight, rotation: matchingPage.rotation ?? 0 }
      : null;
    const blockId = `word-block-${blockIndex + 1}`;
    const block: EvidenceBlockInput = {
      id: blockId,
      blockIndex,
      pageNumber: matchingPage?.pageNumber ?? null,
      text: paragraph.text,
      markdown: paragraph.text,
      spanStart,
      spanEnd: spanStart + paragraph.text.length,
      precision: matchingPage ? 'page' : 'block',
      confidence: match?.bbox ? 0.96 : matchingPage ? 0.92 : 0.68,
      questionId: paragraph.questionId,
      bbox: match?.bbox ?? null,
      coordinateProvenance,
    };
    spanStart = (block.spanEnd ?? spanStart) + 2;
    anchors.push({
      blockId,
      paragraphId: paragraph.id,
      questionId: paragraph.questionId,
      sourcePart: 'word/document.xml',
      pdfPageNumber: matchingPage?.pageNumber ?? null,
      bbox: match?.bbox ?? null,
      coordinateProvenance,
      precision: matchingPage ? 'page' : 'block',
      mappingDecision: match?.bbox ? 'pdf-text-region-match' : matchingPage ? 'pdf-page-match' : 'paragraph-order-fallback',
      mappingConfidence: match?.bbox ? 0.96 : matchingPage ? 0.92 : 0.68,
      verified: Boolean(matchingPage),
    });
    if (!matchingPage) issues.push(issue('pdf-text-anchor-unresolved', 'review', paragraph.questionId, blockId));
    return block;
  });
  for (const paragraph of paragraphs.filter((candidate) => !candidate.text.trim())) {
    anchors.push({
      blockId: paragraph.id,
      paragraphId: paragraph.id,
      questionId: paragraph.questionId,
      sourcePart: 'word/document.xml',
      pdfPageNumber: null,
      bbox: null,
      coordinateProvenance: null,
      precision: 'block',
      mappingDecision: 'paragraph-order-fallback',
      mappingConfidence: 0.4,
      verified: false,
    });
  }
  return { blocks, anchors, issues };
}

function findPdfTextRegion(pages: PdfPageRepresentation[], query: string): { page: PdfPageRepresentation; bbox: [number, number, number, number] | null } | null {
  for (const page of pages) {
    const text = comparableText(page.text);
    if (!text.includes(query)) continue;
    const bbox = findPdfTextItemBbox(page, query);
    return { page, bbox };
  }
  return null;
}

function findPdfTextItemBbox(page: PdfPageRepresentation, query: string): [number, number, number, number] | null {
  const items = page.textItems ?? [];
  if (items.length === 0) return null;
  let combined = '';
  const ranges = items.map((item) => {
    const start = combined.length;
    combined += comparableText(item.text);
    return { start, end: combined.length, bbox: item.bbox };
  });
  const start = combined.indexOf(query);
  if (start < 0) return null;
  const end = start + query.length;
  const matched = ranges.filter((range) => range.start < end && range.end > start).map((range) => range.bbox);
  return unionBbox(matched);
}

function unionBbox(boxes: Array<[number, number, number, number]>): [number, number, number, number] | null {
  if (boxes.length === 0 || boxes.some(([left, bottom, right, top]) => !Number.isFinite(left) || !Number.isFinite(bottom) || !Number.isFinite(right) || !Number.isFinite(top) || left >= right || bottom >= top)) return null;
  return [
    Math.min(...boxes.map(([left]) => left)),
    Math.min(...boxes.map(([, bottom]) => bottom)),
    Math.max(...boxes.map(([, , right]) => right)),
    Math.max(...boxes.map(([, , , top]) => top)),
  ];
}

function detectCrossQuestionRegionOverlaps(blocks: EvidenceBlockInput[]): WordIntegrityIssue[] {
  const issues: WordIntegrityIssue[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const left = blocks[index]!;
    if (!left.questionId || left.pageNumber == null || !left.bbox) continue;
    for (const right of blocks.slice(index + 1)) {
      if (!right.questionId || right.questionId === left.questionId || right.pageNumber !== left.pageNumber || !right.bbox) continue;
      if (boxesOverlap(left.bbox, right.bbox)) {
        issues.push(issue('question-region-overlap', 'review', left.questionId, left.id ?? null));
        issues.push(issue('question-region-overlap', 'review', right.questionId, right.id ?? null));
      }
    }
  }
  return issues;
}

function boxesOverlap(left: [number, number, number, number], right: [number, number, number, number]): boolean {
  return Math.max(left[0], right[0]) < Math.min(left[2], right[2])
    && Math.max(left[1], right[1]) < Math.min(left[3], right[3]);
}

function mapImagesToPdf(
  images: WordImageRepresentation[],
  pages: Array<{ pageNumber: number; imageCount: number }>,
): WordImagePageAnchor[] {
  const renderedImagePages = pages.flatMap((page) => Array.from({ length: page.imageCount }, () => page.pageNumber));
  const verified = images.length === renderedImagePages.length;
  return images.map((image, index) => ({
    imageId: image.id,
    paragraphId: image.paragraphId,
    questionId: image.questionId,
    pdfPageNumber: verified ? renderedImagePages[index] : null,
    verified,
    mappingMethod: verified ? 'rendered-image-order' as const : 'unresolved' as const,
  }));
}

function buildQuestionStates(
  expectedQuestionIds: readonly string[],
  extracted: { paragraphs: WordParagraphRepresentation[]; formulas: WordFormulaRepresentation[]; images: WordImageRepresentation[] },
  blocks: EvidenceBlockInput[],
  issues: WordIntegrityIssue[],
): WordQuestionState[] {
  const globalBlocked = issues.some((entry) => entry.severity === 'blocked' && entry.questionId === null);
  return expectedQuestionIds.map((questionId) => {
    const paragraphs = extracted.paragraphs.filter((paragraph) => paragraph.questionId === questionId);
    const hasAnswerText = paragraphs.some((paragraph) => {
      const withoutId = paragraph.text.replace(questionId, '').replace(/^\s*[:：.-]?\s*/u, '').trim();
      return !paragraph.introducesQuestion || withoutId.length > 0;
    });
    const hasAnswer = hasAnswerText
      || extracted.formulas.some((formula) => formula.questionId === questionId)
      || extracted.images.some((image) => image.questionId === questionId);
    if (!hasAnswer) issues.push(issue('answer-not-found', 'review', questionId));
    const reasons = uniqueIssues(issues.filter((entry) => entry.questionId === questionId)).map((entry) => entry.code);
    const blocked = globalBlocked || issues.some((entry) => entry.questionId === questionId && entry.severity === 'blocked');
    const candidates = blocks.filter((block) => block.questionId === questionId);
    const selected = candidates
      .slice()
      .sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0) || (left.blockIndex ?? 0) - (right.blockIndex ?? 0))
      .slice(0, 1);
    const mappingConfidence = selected.length > 0
      ? selected.reduce((total, block) => total + (block.confidence ?? 0), 0) / selected.length
      : candidates.length > 0 ? Math.max(...candidates.map((block) => block.confidence ?? 0)) : 0;
    const mappingDecision = selected.some((block) => block.bbox != null)
      ? 'pdf-text-region-match' as const
      : selected.some((block) => block.pageNumber != null) ? 'pdf-page-match' as const
      : candidates.length > 0 ? 'paragraph-order-fallback' as const : 'unmapped' as const;
    return {
      questionId,
      state: blocked ? 'blocked' : reasons.length > 0 ? 'review-required' : 'scorable',
      reasons,
      candidateBlockIds: candidates.map((block) => block.id ?? ''),
      selectedBlockIds: selected.map((block) => block.id ?? ''),
      mappingDecision,
      mappingConfidence,
    };
  });
}

async function readImageRelationships(archive: JSZip): Promise<Map<string, ImageRelationship>> {
  const file = archive.file('word/_rels/document.xml.rels');
  if (!file) return new Map();
  const document = parseXml(await readZipObjectText(file));
  return new Map(allElements(document)
    .filter((element) => localName(element) === 'Relationship' && (element.getAttribute('Type') ?? '').endsWith('/image'))
    .map((element): [string, ImageRelationship] => {
      const id = element.getAttribute('Id') ?? '';
      const target = element.getAttribute('Target') ?? '';
      const external = (element.getAttribute('TargetMode') ?? '').toLowerCase() === 'external';
      const path = external ? null : resolveWordTarget(target);
      return [id, { id, path }];
    })
    .filter(([id]) => Boolean(id)));
}

function parseContentTypes(document: XmlDocument): Map<string, string> {
  return new Map(allElements(document)
    .filter((element) => localName(element) === 'Default')
    .map((element): [string, string] => [
      (element.getAttribute('Extension') ?? '').toLowerCase(),
      element.getAttribute('ContentType') ?? 'application/octet-stream',
    ])
    .filter(([extension]) => Boolean(extension)));
}

async function detectedDocumentFormat(bytes: Uint8Array): Promise<SubmissionDocumentFormat> {
  const buffer = Buffer.from(bytes);
  if (startsWith(buffer, DOC_MAGIC)) return buffer.includes(LEGACY_WORD_DOCUMENT_STREAM) ? 'doc' : 'wps';
  if (startsWith(buffer, Buffer.from('%PDF-'))) return 'pdf';
  if (startsWith(buffer, Buffer.from([0x89, 0x50, 0x4e, 0x47])) || startsWith(buffer, Buffer.from([0xff, 0xd8, 0xff]))) return 'image';
  if (startsWith(buffer, Buffer.from('PK'))) return await isValidDocxPackage(buffer) ? 'docx' : 'zip';
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  if (!decoded.includes('\u0000') && decoded.trim()) return 'text';
  return 'unknown';
}

function claimedDocumentFormat(fileName: string, mimeType: string): SubmissionDocumentFormat {
  const lowerName = fileName.trim().toLowerCase();
  const lowerMime = mimeType.trim().toLowerCase();
  if (lowerName.endsWith('.wps') || lowerMime.includes('wps') || lowerMime.includes('ms-works')) return 'wps';
  if (lowerName.endsWith('.docx')) return 'docx';
  if (lowerName.endsWith('.doc')) return 'doc';
  if (lowerName.endsWith('.pdf') || lowerMime === 'application/pdf') return 'pdf';
  if (lowerMime.startsWith('image/')) return 'image';
  if (lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (lowerMime === 'application/msword') return 'doc';
  if (lowerMime.startsWith('text/')) return 'text';
  return 'unknown';
}

async function isValidDocxPackage(bytes: Buffer): Promise<boolean> {
  try {
    await loadValidatedDocx(bytes);
    return true;
  } catch {
    return false;
  }
}

async function loadValidatedDocx(bytes: Buffer): Promise<JSZip> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch {
    throw new WordRepresentationError('word-docx-invalid');
  }
  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_ZIP_ENTRIES) throw new WordRepresentationError('word-docx-limit-exceeded');
  let expandedTotal = 0;
  for (const entry of entries) {
    if (entry.name.includes('\\') || entry.name.startsWith('/') || entry.name.split('/').some((part) => part === '..')) {
      throw new WordRepresentationError('word-docx-path-unsafe');
    }
    const expanded = Number((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize);
    if (!Number.isInteger(expanded) || expanded < 0) throw new WordRepresentationError('word-docx-invalid');
    expandedTotal += expanded;
  }
  if (expandedTotal > MAX_ZIP_EXPANDED_BYTES) throw new WordRepresentationError('word-docx-limit-exceeded');
  for (const path of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
    if (!archive.file(path)) throw new WordRepresentationError('word-docx-structure-invalid');
  }
  const contentTypes = parseXml(await readZipText(archive, '[Content_Types].xml'));
  const mainType = allElements(contentTypes).some((element) => (
    localName(element) === 'Override'
    && element.getAttribute('PartName') === '/word/document.xml'
    && (element.getAttribute('ContentType') ?? '').includes('wordprocessingml.document.main+xml')
  ));
  const relationships = parseXml(await readZipText(archive, '_rels/.rels'));
  const mainRelationship = allElements(relationships).some((element) => (
    localName(element) === 'Relationship'
    && (element.getAttribute('Type') ?? '').endsWith('/officeDocument')
    && element.getAttribute('Target') === 'word/document.xml'
    && (element.getAttribute('TargetMode') ?? '').toLowerCase() !== 'external'
  ));
  if (!mainType || !mainRelationship) throw new WordRepresentationError('word-docx-structure-invalid');
  return archive;
}

async function readZipText(archive: JSZip, path: string): Promise<string> {
  const file = archive.file(path);
  if (!file) throw new WordRepresentationError('word-docx-structure-invalid');
  return readZipObjectText(file);
}

async function readZipObjectText(file: JSZip.JSZipObject): Promise<string> {
  const bytes = await file.async('uint8array');
  if (bytes.byteLength > MAX_XML_BYTES) throw new WordRepresentationError('word-docx-limit-exceeded');
  return new TextDecoder().decode(bytes);
}

function parseXml(xml: string): XmlDocument {
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw new WordRepresentationError('word-docx-xml-unsafe');
  const errors: string[] = [];
  const document = new DOMParser({ onError: (level, message) => {
    if (level === 'error' || level === 'fatalError') errors.push(message);
  } }).parseFromString(xml, 'application/xml');
  if (errors.length > 0 || document.getElementsByTagName('parsererror').length > 0) throw new WordRepresentationError('word-docx-xml-invalid');
  if (countXmlNodes(document, 0) > MAX_XML_NODES) throw new WordRepresentationError('word-docx-limit-exceeded');
  return document;
}

async function extractPdfPages(bytes: Uint8Array): Promise<PdfPageRepresentation[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: Uint8Array.from(bytes), isEvalSupported: false, useWorkerFetch: false });
  const document = await task.promise;
  const imageOps = new Set([
    pdfjs.OPS.paintImageXObject,
    pdfjs.OPS.paintInlineImageXObject,
    pdfjs.OPS.paintImageMaskXObject,
  ]);
  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const [content, operators] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
      const viewport = page.getViewport({ scale: 1 });
      const textItems = content.items.flatMap((item: any) => {
        if (!('str' in item) || typeof item.str !== 'string' || !item.str) return [];
        const [, , , height, x, y] = item.transform as number[];
        const width = Number(item.width);
        const itemHeight = Math.abs(Number(height)) || Math.abs(Number(item.height));
        const bbox: [number, number, number, number] = [x, y - itemHeight, x + width, y];
        return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && width > 0 && Number.isFinite(itemHeight) && itemHeight > 0
          ? [{ text: item.str, bbox }]
          : [];
      });
      const text = content.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ');
      pages.push({ pageNumber, text, imageCount: operators.fnArray.filter((operator) => imageOps.has(operator)).length, pageWidth: viewport.width, pageHeight: viewport.height, rotation: (page.rotate ?? 0) as 0 | 90 | 180 | 270, textItems });
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

async function requireLegacyNormalization(
  adapter: WordRepresentationAdapter,
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (!adapter.normalizeLegacyDoc) throw new WordRepresentationError('legacy-doc-normalizer-unavailable');
  try {
    return await adapter.normalizeLegacyDoc(bytes, signal);
  } catch {
    throw new WordRepresentationError('legacy-doc-normalization-failed');
  }
}

async function resolveWordProcessorVersion(
  adapter: WordRepresentationAdapter,
  signal?: AbortSignal,
): Promise<string> {
  const version = adapter.wordProcessorVersion ?? await adapter.resolveWordProcessorVersion?.(signal);
  const normalized = version?.trim().replace(/\s+/gu, ' ') ?? '';
  if (!normalized || normalized.length > 200) throw new WordRepresentationError('word-processor-version-unavailable');
  return normalized;
}

function resolveWordTarget(target: string): string | null {
  if (!target || target.startsWith('/') || target.includes('\\')) return null;
  const resolved = posix.normalize(posix.join('word', target));
  return resolved.startsWith('word/') && !resolved.includes('../') ? resolved : null;
}

function allElements(node: XmlDocument | XmlElement): XmlElement[] {
  return Array.from(node.getElementsByTagName('*')) as XmlElement[];
}

function localName(element: XmlElement): string {
  return element.localName || element.nodeName.split(':').at(-1) || element.nodeName;
}

function attributeByLocalName(element: XmlElement, name: string): string | null {
  const attribute = Array.from(element.attributes ?? []).find((candidate) => (
    candidate.localName === name || candidate.name.split(':').at(-1) === name
  ));
  return attribute?.value ?? null;
}

function countXmlNodes(node: XmlNode, depth: number): number {
  if (depth > MAX_XML_DEPTH) throw new WordRepresentationError('word-docx-limit-exceeded');
  let count = 1;
  for (let child = node.firstChild; child; child = child.nextSibling) count += countXmlNodes(child, depth + 1);
  return count;
}

function issue(code: string, severity: 'review' | 'blocked', questionId: string | null = null, blockId: string | null = null): WordIntegrityIssue {
  return { code, severity, questionId, blockId };
}

function uniqueIssues(issues: WordIntegrityIssue[]): WordIntegrityIssue[] {
  const seen = new Set<string>();
  return issues.filter((entry) => {
    const key = `${entry.code}:${entry.severity}:${entry.questionId ?? ''}:${entry.blockId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function startsWith(value: Uint8Array, prefix: Uint8Array): boolean {
  return prefix.length <= value.length && prefix.every((byte, index) => value[index] === byte);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function comparableText(value: string): string {
  return value.normalize('NFKC').replace(/[\s\u00A0]+/gu, '').toLowerCase();
}

function substantiveText(value: string): string {
  return normalizeText(value)
    .replace(QUESTION_IDS, '')
    .replace(/[\p{P}\p{S}\s]/gu, '');
}

function checksum(value: Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
