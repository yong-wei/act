/**
 * Stable textbook locator resource identities (#1269).
 *
 * - act:textbook:<source-document-id>
 * - act:textbook-chapter:<document-id>:<chapter-key>
 * - act:textbook-section:<source-anchor-token>
 *
 * ActKG CURIEs (cts:section-…) are normalized to colon-free tokens for the
 * resource ID path; original CURIEs are preserved on locator/provenance.
 */

import {
  TeachingProjectionIdentityError,
  assertNonEmptyToken,
} from '../identity';
import { projectionDigest } from '../hash';

const TEXTBOOK_PATTERN = /^act:textbook:[^:\s]+$/u;
const TEXTBOOK_CHAPTER_PATTERN = /^act:textbook-chapter:[^:\s]+:[^:\s]+$/u;
const TEXTBOOK_SECTION_PATTERN = /^act:textbook-section:[^:\s]+$/u;

/**
 * Convert an ActKG CURIE or free token into a resource-ID path token.
 * `cts:section-abc` → `cts.section-abc`
 */
export function toResourceIdToken(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      `${label} must be a non-empty string`,
    );
  }
  if (/\s/u.test(value)) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      `${label} must not contain whitespace`,
    );
  }
  const token = value.replace(/:/g, '.');
  if (token.includes(':') || token.length === 0) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      `${label} normalizes to an invalid resource token`,
    );
  }
  return token;
}

export function deriveTextbookResourceId(sourceDocumentId: string): string {
  const token = assertNonEmptyToken(sourceDocumentId, 'sourceDocumentId');
  return `act:textbook:${token}`;
}

export function deriveTextbookChapterResourceId(
  sourceDocumentId: string,
  chapterKey: string,
): string {
  const doc = assertNonEmptyToken(sourceDocumentId, 'sourceDocumentId');
  const chapter = assertNonEmptyToken(chapterKey, 'chapterKey');
  return `act:textbook-chapter:${doc}:${chapter}`;
}

export function deriveTextbookSectionResourceId(sourceAnchorId: string): string {
  const token = toResourceIdToken(sourceAnchorId, 'sourceAnchorId');
  return `act:textbook-section:${token}`;
}

export function assertTextbookResourceId(resourceId: string): void {
  if (
    TEXTBOOK_PATTERN.test(resourceId)
    || TEXTBOOK_CHAPTER_PATTERN.test(resourceId)
    || TEXTBOOK_SECTION_PATTERN.test(resourceId)
  ) {
    return;
  }
  throw new TeachingProjectionIdentityError(
    'malformed-resource-id',
    `malformed textbook resource ID: ${resourceId}`,
  );
}

export function deriveTextbookExplainsBindingId(input: {
  resourceId: string;
  canonicalId: string;
  scopeId: string;
}): string {
  assertTextbookResourceId(input.resourceId);
  if (!input.canonicalId || input.canonicalId.trim().length === 0) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      'binding canonicalId must be non-empty',
    );
  }
  if (!input.scopeId || input.scopeId.trim().length === 0) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      'binding scopeId must be non-empty',
    );
  }
  const digest = projectionDigest({
    resourceId: input.resourceId,
    canonicalId: input.canonicalId,
    role: 'EXPLAINS',
    scopeId: input.scopeId,
  });
  return `bind-${digest.slice(0, 32)}`;
}

export function isTextbookAccessMode(value: unknown): value is string {
  return value === 'REFERENCE_ONLY'
    || value === 'LOCAL_AUTHORIZED'
    || value === 'EXTERNAL_AUTHORIZED';
}
