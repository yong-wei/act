/**
 * Stable textbook locator resource identities (#1269).
 *
 * - act:textbook:<source-document-id>
 * - act:textbook-chapter:<document-id>:<chapter-key>
 * - act:textbook-section:<source-anchor-token>
 *
 * ActKG CURIEs (cts:section-…) are normalized to colon-free tokens for the
 * resource ID path; original CURIEs are preserved on locator/provenance.
 *
 * Token encoding is reversible so `cts:x` and `cts.x` never collide:
 *   1. escape every `.` as `..`
 *   2. replace every `:` with `.`
 * CURIEs without embedded dots keep the historical `cts.section-…` shape.
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
 *
 * Reversible encoding (`.` → `..`, then `:` → `.`):
 * - `cts:section-abc` → `cts.section-abc`
 * - `cts.x` → `cts..x`  (distinct from `cts:x` → `cts.x`)
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
  // Escape dots first so colon→dot cannot collide with a literal dot in the id.
  const token = value.replace(/\./g, '..').replace(/:/g, '.');
  if (token.includes(':') || token.length === 0) {
    throw new TeachingProjectionIdentityError(
      'schema-invalid',
      `${label} normalizes to an invalid resource token`,
    );
  }
  return token;
}

/**
 * Inverse of {@link toResourceIdToken}. Used by tests and diagnostics.
 * Single `.` → `:`, doubled `..` → `.`.
 */
export function fromResourceIdToken(token: string): string {
  let out = '';
  for (let i = 0; i < token.length; i += 1) {
    const ch = token[i]!;
    if (ch === '.') {
      if (token[i + 1] === '.') {
        out += '.';
        i += 1;
      } else {
        out += ':';
      }
    } else {
      out += ch;
    }
  }
  return out;
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
