import { createHash } from 'node:crypto';

import {
  STRUCTURED_TEXTBOOK_UNIT_KIND,
  type StructuredTextbookUnitIdentity,
} from './types';

export { STRUCTURED_TEXTBOOK_UNIT_KIND };
export type { StructuredTextbookUnitIdentity };

export const TEXTBOOK_COACH_SELECTION_HINT_MAX_LENGTH = 500;

const IDENTITY_KEYS = [
  'resourceId',
  'bookId',
  'edition',
  'sourceRevision',
  'unitId',
  'contentHash',
] as const;

export type TextbookCoachUnavailableReason =
  | 'unauthorized'
  | 'unsupported-resource-type'
  | 'identity-invalid'
  | 'identity-tampered'
  | 'revision-unavailable'
  | 'version-changed'
  | 'anchor-unavailable'
  | 'hash-drift';

const SAFE_ID = /^[\p{L}\p{N}][\p{L}\p{N}._:@/-]{0,255}$/u;
const SAFE_HASH = /^sha256:[a-f0-9]{64}$/;
const SAFE_FRAGMENT = /^(?:formula|figure|table)-[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const UNSUPPORTED_KINDS = new Set([
  'teaching-resource',
  'knowledge-card',
  'knowledge-node',
  'pdf',
  'video',
  'external-webpage',
  'static-text',
]);

export function hashTextbookMarkdown(markdown: string): string {
  return `sha256:${createHash('sha256').update(markdown, 'utf8').digest('hex')}`;
}

export function identitiesEqual(
  left: StructuredTextbookUnitIdentity,
  right: StructuredTextbookUnitIdentity,
): boolean {
  return left.resourceKind === right.resourceKind
    && left.resourceId === right.resourceId
    && left.bookId === right.bookId
    && left.edition === right.edition
    && left.sourceRevision === right.sourceRevision
    && left.unitId === right.unitId
    && left.contentHash === right.contentHash
    && (left.anchorId ?? null) === (right.anchorId ?? null);
}

export function canonicalizeTextbookCoachIdentity(
  value: unknown,
): StructuredTextbookUnitIdentity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const resourceKind = readToken(record.resourceKind);
  if (resourceKind !== STRUCTURED_TEXTBOOK_UNIT_KIND) return null;
  const resourceId = readToken(record.resourceId);
  const bookId = readToken(record.bookId);
  const edition = readBounded(record.edition, 128);
  const sourceRevision = readToken(record.sourceRevision);
  const unitId = readToken(record.unitId);
  const contentHash = readBounded(record.contentHash, 80);
  if (!resourceId || !bookId || !edition || !sourceRevision || !unitId || !contentHash) return null;
  if (!SAFE_ID.test(resourceId) || !SAFE_ID.test(bookId) || !SAFE_ID.test(unitId)) return null;
  if (!SAFE_HASH.test(contentHash)) return null;
  if (resourceId !== unitId) return null;
  const anchorRaw = record.anchorId;
  const anchorId = anchorRaw == null || anchorRaw === ''
    ? null
    : readToken(anchorRaw);
  if (anchorId && !SAFE_FRAGMENT.test(anchorId)) return null;
  return {
    resourceKind: STRUCTURED_TEXTBOOK_UNIT_KIND,
    resourceId,
    bookId,
    edition,
    sourceRevision,
    unitId,
    contentHash,
    anchorId,
  };
}

export function declaredTextbookCoachKind(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return readToken((value as Record<string, unknown>).resourceKind);
}

export function isUnsupportedTextbookCoachKind(kind: string | null): boolean {
  return Boolean(kind && kind !== STRUCTURED_TEXTBOOK_UNIT_KIND && UNSUPPORTED_KINDS.has(kind));
}

export function hasUntrustedIdentityPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ['body', 'markdown', 'href', 'url', 'offset', 'lineNumber', 'domOffset', 'selectedText']
    .some((key) => key in record && record[key] != null && record[key] !== '');
}

export function boundSelectionHint(value: unknown, unitMarkdown: string): string | null {
  if (typeof value !== 'string') return null;
  const hint = value.trim();
  if (!hint || hint.length > TEXTBOOK_COACH_SELECTION_HINT_MAX_LENGTH) return null;
  return unitMarkdown.includes(hint) ? hint : null;
}

export function identityHintRecord(identity: StructuredTextbookUnitIdentity): Record<string, string> {
  return {
    resourceKind: identity.resourceKind,
    resourceId: identity.resourceId,
    bookId: identity.bookId,
    edition: identity.edition,
    sourceRevision: identity.sourceRevision,
    unitId: identity.unitId,
    contentHash: identity.contentHash,
    ...(identity.anchorId ? { anchorId: identity.anchorId } : {}),
  };
}

export function identityFieldKeys(): readonly string[] {
  return IDENTITY_KEYS;
}

function readToken(value: unknown): string | null {
  return typeof value === 'string' && SAFE_ID.test(value) ? value : null;
}

function readBounded(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;
}
