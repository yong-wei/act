import { createHash } from 'node:crypto';

import { DOMParser, XMLSerializer, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import JSZip from 'jszip';

export const TEACHER_AI_GRADING_LAB_REDACTION_VERSION = 'teacher-ai-grading-redaction.v1' as const;
export const TEACHER_AI_GRADING_LAB_REVIEW_VERSION = 'teacher-ai-grading-redaction-review.v1' as const;
export const TEACHER_AI_GRADING_LAB_DELETION_VERSION = 'teacher-ai-grading-deletion-checklist.v1' as const;

export type TeacherAiGradingRedactionErrorCode =
  | 'LAB_REDACTION_SAMPLE_ID_INVALID'
  | 'LAB_REDACTION_DOCX_INVALID'
  | 'LAB_REDACTION_DOCX_LIMIT_EXCEEDED'
  | 'LAB_REDACTION_LEGACY_DOC_REQUIRES_CONVERSION'
  | 'LAB_REDACTION_UNRESOLVED'
  | 'LAB_REDACTION_OWNER_REQUIRED'
  | 'LAB_REDACTION_STATE_INVALID'
  | 'LAB_REDACTION_CHECKSUM_MISMATCH'
  | 'LAB_RETENTION_NOT_ALLOWED';

export class TeacherAiGradingRedactionError extends Error {
  constructor(public readonly code: TeacherAiGradingRedactionErrorCode) {
    super(code);
    this.name = 'TeacherAiGradingRedactionError';
  }
}

export type TeacherAiGradingIdentityKind = 'student-name' | 'student-number' | 'email' | 'other';

export interface TeacherAiGradingIdentityTerm {
  kind: TeacherAiGradingIdentityKind;
  value: string;
}

export type TeacherAiGradingRedactionScope =
  | 'file-name'
  | 'document-properties'
  | 'body'
  | 'header'
  | 'footer'
  | 'comments';

export interface TeacherAiGradingRedactionFinding {
  scope: TeacherAiGradingRedactionScope;
  kind: TeacherAiGradingIdentityKind | 'metadata-author' | 'comment-author';
  occurrenceCount: number;
  resolution: 'replaced-file-name' | 'redacted-text' | 'cleared-metadata';
}

export interface TeacherAiGradingRedactedDocument {
  schemaVersion: typeof TEACHER_AI_GRADING_LAB_REDACTION_VERSION;
  sampleId: string;
  questionId: string;
  sourceChecksum: string;
  redactedChecksum: string;
  outputFileName: string;
  bytes: Buffer;
  findings: TeacherAiGradingRedactionFinding[];
  unresolvedFindingCount: number;
}

export interface TeacherAiGradingRedactionReview {
  schemaVersion: typeof TEACHER_AI_GRADING_LAB_REVIEW_VERSION;
  sampleId: string;
  questionId: string;
  redactedChecksum: string;
  findingCount: number;
  unresolvedFindingCount: number;
  status: 'REVIEW_REQUIRED' | 'CONFIRMED' | 'REJECTED';
  confirmedBy: string | null;
  confirmedAt: string | null;
}

export interface TeacherAiGradingModelSubmission {
  sampleId: string;
  questionId: string;
  fileName: string;
  documentBytes: Buffer;
}

export interface TeacherAiGradingDeletionChecklist {
  schemaVersion: typeof TEACHER_AI_GRADING_LAB_DELETION_VERSION;
  datasetId: string;
  datasetVersion: string;
  items: Array<{
    id: 'source-package' | 'original-submissions' | 'identity-mapping' | 'runtime-artifacts';
    completed: boolean;
    completedBy: string | null;
    completedAt: string | null;
  }>;
}

export interface TeacherAiGradingRetentionDecision {
  artifactKind: 'redacted-sample' | 'experiment-config' | 'aggregate-metrics';
  artifactId: string;
  retain: boolean;
  containsIdentity: boolean;
  containsRawSource: boolean;
  irreversibleRedactionConfirmed: boolean;
  identityMappingDeleted: boolean;
  reidentificationRiskReviewed: boolean;
  decidedBy: string;
  decidedAt: string;
}

interface RedactionMatch {
  start: number;
  end: number;
  kind: TeacherAiGradingRedactionFinding['kind'];
}

interface XmlPart {
  path: string;
  scope: Exclude<TeacherAiGradingRedactionScope, 'file-name'>;
}

const MAX_ZIP_ENTRIES = 2_048;
const MAX_EXPANDED_BYTES = 128 * 1024 * 1024;
const MAX_XML_BYTES = 8 * 1024 * 1024;
const MAX_XML_NODES = 200_000;
const MAX_XML_DEPTH = 128;
const SAMPLE_ID = /^sample-[a-z0-9]{4,32}$/;
const CORE_AUTHOR_TAGS = new Set(['creator', 'lastModifiedBy']);
const PERSONAL_METADATA_ATTRIBUTES = new Set([
  'w:author',
  'w:initials',
  'w:date',
  'w15:author',
  'w15:authorId',
  'author',
  'authorId',
  'initials',
  'date',
]);

export async function createTeacherAiGradingRedactedDocument(input: {
  sampleId: string;
  questionId: string;
  sourceFileName: string;
  sourceBytes: Buffer;
  identityTerms: readonly TeacherAiGradingIdentityTerm[];
}): Promise<TeacherAiGradingRedactedDocument> {
  if (!SAMPLE_ID.test(input.sampleId)) throw new TeacherAiGradingRedactionError('LAB_REDACTION_SAMPLE_ID_INVALID');
  if (!/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(input.questionId)) throw new TeacherAiGradingRedactionError('LAB_REDACTION_SAMPLE_ID_INVALID');
  if (/\.doc$/i.test(input.sourceFileName)) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_LEGACY_DOC_REQUIRES_CONVERSION');
  }
  if (!/\.docx$/i.test(input.sourceFileName)) throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_INVALID');

  const archive = await loadBoundedDocx(input.sourceBytes);
  const matchers = buildMatchers(input.identityTerms);
  const findings: TeacherAiGradingRedactionFinding[] = [];
  const fileNameMatches = findMatches(input.sourceFileName, matchers, true);
  addFindings(findings, 'file-name', fileNameMatches, 'replaced-file-name');

  const parts = Object.keys(archive.files).flatMap((path): XmlPart[] => {
    if (/^docProps\/(?:core|custom|app)\.xml$/i.test(path)) return [{ path, scope: 'document-properties' }];
    if (path === 'word/document.xml') return [{ path, scope: 'body' }];
    if (/^word\/header\d*\.xml$/i.test(path)) return [{ path, scope: 'header' }];
    if (/^word\/footer\d*\.xml$/i.test(path)) return [{ path, scope: 'footer' }];
    if (/^word\/(?:comments\d*|people)\.xml$/i.test(path)) return [{ path, scope: 'comments' }];
    return [];
  });
  if (!parts.some((part) => part.path === 'word/document.xml')) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_INVALID');
  }

  for (const part of parts) {
    const file = archive.file(part.path);
    if (!file) continue;
    const xml = await readBoundedXml(file);
    const document = parseBoundedXml(xml);
    redactXmlPart(document, part.scope, matchers, findings);
    archive.file(part.path, new XMLSerializer().serializeToString(document));
  }

  const bytes = await archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return {
    schemaVersion: TEACHER_AI_GRADING_LAB_REDACTION_VERSION,
    sampleId: input.sampleId,
    questionId: input.questionId,
    sourceChecksum: sha256(input.sourceBytes),
    redactedChecksum: sha256(bytes),
    outputFileName: `${input.questionId}.docx`,
    bytes,
    findings,
    unresolvedFindingCount: 0,
  };
}

export function createTeacherAiGradingRedactionReview(
  document: TeacherAiGradingRedactedDocument,
): TeacherAiGradingRedactionReview {
  return {
    schemaVersion: TEACHER_AI_GRADING_LAB_REVIEW_VERSION,
    sampleId: document.sampleId,
    questionId: document.questionId,
    redactedChecksum: document.redactedChecksum,
    findingCount: document.findings.reduce((sum, finding) => sum + finding.occurrenceCount, 0),
    unresolvedFindingCount: document.unresolvedFindingCount,
    status: 'REVIEW_REQUIRED',
    confirmedBy: null,
    confirmedAt: null,
  };
}

export function confirmTeacherAiGradingRedaction(input: {
  review: TeacherAiGradingRedactionReview;
  redactedDocument: TeacherAiGradingRedactedDocument;
  actorUserId: string;
  ownerTeacherUserId: string;
  confirmedAt?: Date;
}): TeacherAiGradingRedactionReview {
  if (input.actorUserId !== input.ownerTeacherUserId) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_OWNER_REQUIRED');
  }
  if (input.review.status !== 'REVIEW_REQUIRED') {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_STATE_INVALID');
  }
  if (input.review.sampleId !== input.redactedDocument.sampleId
    || input.review.questionId !== input.redactedDocument.questionId
    || input.review.redactedChecksum !== input.redactedDocument.redactedChecksum
    || input.review.unresolvedFindingCount !== input.redactedDocument.unresolvedFindingCount
    || sha256(input.redactedDocument.bytes) !== input.redactedDocument.redactedChecksum) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_CHECKSUM_MISMATCH');
  }
  if (input.redactedDocument.unresolvedFindingCount !== 0) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_UNRESOLVED');
  }
  return {
    ...input.review,
    status: 'CONFIRMED',
    confirmedBy: input.actorUserId,
    confirmedAt: (input.confirmedAt ?? new Date()).toISOString(),
  };
}

export function rejectTeacherAiGradingRedaction(
  review: TeacherAiGradingRedactionReview,
): TeacherAiGradingRedactionReview {
  if (review.status !== 'REVIEW_REQUIRED') throw new TeacherAiGradingRedactionError('LAB_REDACTION_STATE_INVALID');
  return { ...review, status: 'REJECTED', confirmedBy: null, confirmedAt: null };
}

export function projectTeacherAiGradingModelSubmission(input: {
  review: TeacherAiGradingRedactionReview;
  redactedDocument: TeacherAiGradingRedactedDocument;
  ownerTeacherUserId: string;
}): TeacherAiGradingModelSubmission {
  if (input.review.status !== 'CONFIRMED'
    || input.review.confirmedBy !== input.ownerTeacherUserId
    || input.review.unresolvedFindingCount !== 0) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_UNRESOLVED');
  }
  if (input.review.sampleId !== input.redactedDocument.sampleId
    || input.review.questionId !== input.redactedDocument.questionId
    || input.review.redactedChecksum !== input.redactedDocument.redactedChecksum
    || sha256(input.redactedDocument.bytes) !== input.review.redactedChecksum) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_CHECKSUM_MISMATCH');
  }
  return {
    sampleId: input.review.sampleId,
    questionId: input.review.questionId,
    fileName: `${input.review.questionId}.docx`,
    documentBytes: Buffer.from(input.redactedDocument.bytes),
  };
}

export function projectTeacherAiGradingSafeEvent(input: {
  sampleId: string;
  code: string;
  stage: string;
  status: string;
}) {
  return {
    sampleId: SAMPLE_ID.test(input.sampleId) ? input.sampleId : 'sample-invalid',
    code: /^LAB_[A-Z0-9_]{1,64}$/.test(input.code) ? input.code : 'LAB_OPERATION_FAILED',
    stage: safeProjectionToken(input.stage, new Set(['redaction', 'redaction-review', 'conversion', 'grading', 'retention'])),
    status: safeProjectionToken(input.status, new Set(['pending', 'blocked', 'failed', 'confirmed', 'completed'])),
  };
}

export function projectTeacherAiGradingSafeError(error: unknown, sampleId?: string) {
  const candidate = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  const code = /^LAB_[A-Z0-9_]{1,64}$/.test(candidate) ? candidate : 'LAB_OPERATION_FAILED';
  return sampleId && SAMPLE_ID.test(sampleId) ? { code, sampleId } : { code };
}

export function createTeacherAiGradingDeletionChecklist(
  datasetId: string,
  datasetVersion: string,
): TeacherAiGradingDeletionChecklist {
  return {
    schemaVersion: TEACHER_AI_GRADING_LAB_DELETION_VERSION,
    datasetId: sanitizeToken(datasetId),
    datasetVersion: sanitizeToken(datasetVersion),
    items: ['source-package', 'original-submissions', 'identity-mapping', 'runtime-artifacts'].map((id) => ({
      id: id as TeacherAiGradingDeletionChecklist['items'][number]['id'],
      completed: false,
      completedBy: null,
      completedAt: null,
    })),
  };
}

export function completeTeacherAiGradingDeletionItem(input: {
  checklist: TeacherAiGradingDeletionChecklist;
  itemId: TeacherAiGradingDeletionChecklist['items'][number]['id'];
  actorUserId: string;
  ownerTeacherUserId: string;
  completedAt?: Date;
}): TeacherAiGradingDeletionChecklist {
  if (input.actorUserId !== input.ownerTeacherUserId) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_OWNER_REQUIRED');
  }
  return {
    ...input.checklist,
    items: input.checklist.items.map((item) => item.id === input.itemId ? {
      ...item,
      completed: true,
      completedBy: input.actorUserId,
      completedAt: (input.completedAt ?? new Date()).toISOString(),
    } : item),
  };
}

export function recordTeacherAiGradingRetentionDecision(
  decision: TeacherAiGradingRetentionDecision,
  ownerTeacherUserId: string,
): TeacherAiGradingRetentionDecision {
  if (decision.decidedBy !== ownerTeacherUserId) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_OWNER_REQUIRED');
  }
  const identitySafe = !decision.containsIdentity && !decision.containsRawSource;
  const redactedSampleSafe = decision.artifactKind !== 'redacted-sample'
    || (decision.irreversibleRedactionConfirmed && decision.identityMappingDeleted && decision.reidentificationRiskReviewed);
  if (decision.retain && (!identitySafe || !redactedSampleSafe)) {
    throw new TeacherAiGradingRedactionError('LAB_RETENTION_NOT_ALLOWED');
  }
  return { ...decision, artifactId: sanitizeToken(decision.artifactId) };
}

async function loadBoundedDocx(bytes: Buffer): Promise<JSZip> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_INVALID');
  }
  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_ZIP_ENTRIES) throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_LIMIT_EXCEEDED');
  let expandedTotal = 0;
  for (const entry of entries) {
    const expanded = Number((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize);
    if (!Number.isInteger(expanded) || expanded < 0) throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_INVALID');
    expandedTotal += expanded;
  }
  if (expandedTotal > MAX_EXPANDED_BYTES) throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_LIMIT_EXCEEDED');
  return archive;
}

async function readBoundedXml(file: JSZip.JSZipObject): Promise<string> {
  const bytes = await file.async('uint8array');
  if (bytes.byteLength > MAX_XML_BYTES) throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_LIMIT_EXCEEDED');
  return new TextDecoder().decode(bytes);
}

function parseBoundedXml(xml: string): XmlDocument {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_LIMIT_EXCEEDED');
  const errors: string[] = [];
  const document = new DOMParser({ onError: (level, message) => {
    if (level === 'error' || level === 'fatalError') errors.push(message);
  } }).parseFromString(xml, 'application/xml');
  if (errors.length > 0 || document.getElementsByTagName('parsererror').length > 0) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_INVALID');
  }
  if (countXmlNodes(document, 0) > MAX_XML_NODES) {
    throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_LIMIT_EXCEEDED');
  }
  return document;
}

function redactXmlPart(
  document: XmlDocument,
  scope: XmlPart['scope'],
  matchers: ReadonlyArray<{ regex: RegExp; kind: TeacherAiGradingRedactionFinding['kind'] }>,
  findings: TeacherAiGradingRedactionFinding[],
) {
  if (scope === 'document-properties') clearAuthorMetadata(document, scope, findings);
  clearPersonalMetadata(document, scope, findings);
  redactIdentityAttributes(document, scope, matchers, findings);
  const groups = allElements(document).filter((element) => elementLocalName(element) === 'p');
  if (groups.length > 0) {
    for (const group of groups) redactTextNodes(collectTextNodes(group), scope, matchers, findings);
  } else {
    for (const element of leafTextElements(document)) redactTextNodes(collectTextNodes(element), scope, matchers, findings);
  }
}

function redactIdentityAttributes(
  document: XmlDocument,
  scope: XmlPart['scope'],
  matchers: ReadonlyArray<{ regex: RegExp; kind: TeacherAiGradingRedactionFinding['kind'] }>,
  findings: TeacherAiGradingRedactionFinding[],
) {
  for (const element of allElements(document)) {
    for (const attribute of Array.from(element.attributes ?? [])) {
      const matches = findMatches(attribute.value, matchers, false);
      if (matches.length === 0) continue;
      addFindings(findings, scope, matches, 'redacted-text');
      attribute.value = replaceMatches(attribute.value, matches);
    }
  }
}

function clearAuthorMetadata(
  document: XmlDocument,
  scope: XmlPart['scope'],
  findings: TeacherAiGradingRedactionFinding[],
) {
  for (const tag of CORE_AUTHOR_TAGS) {
    for (const element of allElements(document).filter((candidate) => elementLocalName(candidate) === tag)) {
      const nodes = collectTextNodes(element);
      if (nodes.some((node) => (node.nodeValue ?? '').trim() !== '')) {
        addFinding(findings, scope, 'metadata-author', 1, 'cleared-metadata');
        for (const node of nodes) node.textContent = '';
      }
    }
  }
}

function clearPersonalMetadata(
  document: XmlDocument,
  scope: XmlPart['scope'],
  findings: TeacherAiGradingRedactionFinding[],
) {
  for (const element of allElements(document)) {
    for (const attribute of Array.from(element.attributes ?? [])) {
      if (PERSONAL_METADATA_ATTRIBUTES.has(attribute.name) && attribute.value.trim() !== '') {
        addFinding(findings, scope, scope === 'comments' ? 'comment-author' : 'metadata-author', 1, 'cleared-metadata');
        element.setAttribute(attribute.name, '');
      }
    }
  }
}

function redactTextNodes(
  nodes: XmlNode[],
  scope: XmlPart['scope'],
  matchers: ReadonlyArray<{ regex: RegExp; kind: TeacherAiGradingRedactionFinding['kind'] }>,
  findings: TeacherAiGradingRedactionFinding[],
) {
  if (nodes.length === 0) return;
  const text = nodes.map((node) => node.nodeValue ?? '').join('');
  const matches = findMatches(text, matchers, false);
  if (matches.length === 0) return;
  addFindings(findings, scope, matches, 'redacted-text');
  let offset = 0;
  for (const node of nodes) {
    const value = node.nodeValue ?? '';
    let redacted = '';
    for (let index = 0; index < value.length; index += 1) {
      redacted += matches.some((match) => offset + index >= match.start && offset + index < match.end) ? '█' : value[index];
    }
    node.textContent = redacted;
    offset += value.length;
  }
}

function buildMatchers(identityTerms: readonly TeacherAiGradingIdentityTerm[]) {
  const explicit = identityTerms
    .map((term) => ({ ...term, value: term.value.trim() }))
    .filter((term) => term.value.length >= 2)
    .sort((left, right) => right.value.length - left.value.length)
    .map((term) => ({ regex: new RegExp(escapeRegex(term.value), 'giu'), kind: term.kind }));
  return [
    ...explicit,
    { regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, kind: 'email' as const },
    { regex: /(?:姓名|学生姓名|name)\s*[:：]\s*[^\s,，;；]{2,32}/giu, kind: 'student-name' as const },
    { regex: /(?:学号|student(?:\s+id|\s+number))\s*[:：]?\s*[A-Z0-9-]{4,32}/giu, kind: 'student-number' as const },
    { regex: /(?<!\d)1[3-9]\d{9}(?!\d)/gu, kind: 'other' as const },
  ];
}

function findMatches(
  text: string,
  matchers: ReadonlyArray<{ regex: RegExp; kind: TeacherAiGradingRedactionFinding['kind'] }>,
  fileName: boolean,
): RedactionMatch[] {
  const matches = matchers.flatMap(({ regex, kind }) => {
    regex.lastIndex = 0;
    return [...text.matchAll(regex)].map((match) => ({ start: match.index, end: match.index + match[0].length, kind }));
  });
  if (fileName) {
    for (const match of text.matchAll(/(?<!\d)\d{6,20}(?!\d)/g)) {
      matches.push({ start: match.index, end: match.index + match[0].length, kind: 'student-number' });
    }
  }
  const accepted: RedactionMatch[] = [];
  for (const match of matches.sort((left, right) => left.start - right.start || right.end - left.end)) {
    if (accepted.every((existing) => match.start >= existing.end || match.end <= existing.start)) accepted.push(match);
  }
  return accepted;
}

function addFindings(
  findings: TeacherAiGradingRedactionFinding[],
  scope: TeacherAiGradingRedactionScope,
  matches: RedactionMatch[],
  resolution: TeacherAiGradingRedactionFinding['resolution'],
) {
  const counts = new Map<TeacherAiGradingRedactionFinding['kind'], number>();
  for (const match of matches) counts.set(match.kind, (counts.get(match.kind) ?? 0) + 1);
  for (const [kind, count] of counts) addFinding(findings, scope, kind, count, resolution);
}

function addFinding(
  findings: TeacherAiGradingRedactionFinding[],
  scope: TeacherAiGradingRedactionScope,
  kind: TeacherAiGradingRedactionFinding['kind'],
  count: number,
  resolution: TeacherAiGradingRedactionFinding['resolution'],
) {
  const existing = findings.find((finding) => finding.scope === scope && finding.kind === kind && finding.resolution === resolution);
  if (existing) existing.occurrenceCount += count;
  else findings.push({ scope, kind, occurrenceCount: count, resolution });
}

function collectTextNodes(node: XmlNode): XmlNode[] {
  const output: XmlNode[] = [];
  const visit = (candidate: XmlNode) => {
    if (candidate.nodeType === 3 || candidate.nodeType === 4) output.push(candidate);
    for (let child = candidate.firstChild; child; child = child.nextSibling) visit(child);
  };
  visit(node);
  return output;
}

function leafTextElements(document: XmlDocument): XmlElement[] {
  return allElements(document).filter((element) => (
    collectTextNodes(element).length > 0
    && !(Array.from(element.childNodes) as XmlNode[]).some((child) => child.nodeType === 1 && collectTextNodes(child).length > 0)
  ));
}

function allElements(document: XmlDocument): XmlElement[] {
  return Array.from(document.getElementsByTagName('*')) as XmlElement[];
}

function elementLocalName(element: XmlElement): string {
  return element.localName || element.nodeName.split(':').at(-1) || element.nodeName;
}

function countXmlNodes(node: XmlNode, depth: number): number {
  if (depth > MAX_XML_DEPTH) throw new TeacherAiGradingRedactionError('LAB_REDACTION_DOCX_LIMIT_EXCEEDED');
  let count = 1;
  for (let child = node.firstChild; child; child = child.nextSibling) count += countXmlNodes(child, depth + 1);
  return count;
}

function sanitizeToken(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80);
  return sanitized || 'unknown';
}

function safeProjectionToken(value: string, allowed: ReadonlySet<string>): string {
  return allowed.has(value) ? value : 'unknown';
}

function replaceMatches(value: string, matches: RedactionMatch[]): string {
  let output = '';
  for (let index = 0; index < value.length; index += 1) {
    output += matches.some((match) => index >= match.start && index < match.end) ? '█' : value[index];
  }
  return output;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sha256(value: Uint8Array): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
