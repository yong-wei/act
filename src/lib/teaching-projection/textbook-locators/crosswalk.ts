/**
 * Load and validate the public source-resource-crosswalk.jsonl sidecar (#1269).
 *
 * The sidecar never carries textbook body text. Schema and capture identity
 * are validated; semantic ActKG correctness is not re-judged.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_TEXTBOOK_LOCATOR_AUTHORING_RELATIVE,
  type SourceResourceCrosswalkRow,
  type TextbookAccessMode,
  type TextbookLocatorAuthorityBinding,
  type TextbookSliceFailure,
} from './contracts';
import { isTextbookAccessMode } from './identity';

export class TextbookCrosswalkError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TextbookCrosswalkError';
    this.code = code;
  }
}

const FORBIDDEN_BODY_KEYS = [
  'body',
  'rawText',
  'raw_text',
  'exactText',
  'exact_text',
  'textbookBody',
  'textbook_body',
  'content',
  'quote',
  'fullText',
  'full_text',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown, label: string, rowNumber: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TextbookCrosswalkError(
      'schema-invalid',
      `row ${rowNumber}: ${label} must be a non-empty string`,
    );
  }
  return value;
}

function optionalPage(value: unknown, label: string, rowNumber: number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new TextbookCrosswalkError(
      'schema-invalid',
      `row ${rowNumber}: ${label} must be a non-negative integer or null`,
    );
  }
  return value;
}

export function parseSourceResourceCrosswalkLine(
  line: string,
  rowNumber: number,
): SourceResourceCrosswalkRow {
  let raw: unknown;
  try {
    raw = JSON.parse(line) as unknown;
  } catch {
    throw new TextbookCrosswalkError(
      'schema-invalid',
      `row ${rowNumber}: invalid JSON`,
    );
  }
  if (!isRecord(raw)) {
    throw new TextbookCrosswalkError(
      'schema-invalid',
      `row ${rowNumber}: crosswalk row must be an object`,
    );
  }

  for (const key of FORBIDDEN_BODY_KEYS) {
    if (key in raw && raw[key] != null && raw[key] !== '') {
      throw new TextbookCrosswalkError(
        'raw-text-forbidden',
        `row ${rowNumber}: field ${key} is forbidden (no textbook body)`,
      );
    }
  }

  if (!isTextbookAccessMode(raw.accessMode)) {
    throw new TextbookCrosswalkError(
      'schema-invalid',
      `row ${rowNumber}: invalid accessMode ${String(raw.accessMode)}`,
    );
  }

  const canonicalIdsRaw = raw.canonicalIds;
  if (!Array.isArray(canonicalIdsRaw) || canonicalIdsRaw.length === 0) {
    throw new TextbookCrosswalkError(
      'schema-invalid',
      `row ${rowNumber}: canonicalIds must be a non-empty string array`,
    );
  }
  const canonicalIds = canonicalIdsRaw.map((id, index) => {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new TextbookCrosswalkError(
        'schema-invalid',
        `row ${rowNumber}: canonicalIds[${index}] must be a non-empty string`,
      );
    }
    return id;
  });

  // Deterministic unique order for multi-canonical rows.
  const uniqueCanonicalIds = [...new Set(canonicalIds)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    sourceDocumentId: nonEmptyString(raw.sourceDocumentId, 'sourceDocumentId', rowNumber),
    sourceAnchorId: nonEmptyString(raw.sourceAnchorId, 'sourceAnchorId', rowNumber),
    chapterKey: nonEmptyString(raw.chapterKey, 'chapterKey', rowNumber),
    sectionKey: nonEmptyString(raw.sectionKey, 'sectionKey', rowNumber),
    pageStart: optionalPage(raw.pageStart, 'pageStart', rowNumber),
    pageEnd: optionalPage(raw.pageEnd, 'pageEnd', rowNumber),
    canonicalIds: uniqueCanonicalIds,
    accessMode: raw.accessMode as TextbookAccessMode,
    authorityReleaseId: nonEmptyString(raw.authorityReleaseId, 'authorityReleaseId', rowNumber),
    authorityReleaseHash: nonEmptyString(raw.authorityReleaseHash, 'authorityReleaseHash', rowNumber),
    bundleDigest: nonEmptyString(raw.bundleDigest, 'bundleDigest', rowNumber),
    captureRevision: nonEmptyString(raw.captureRevision, 'captureRevision', rowNumber),
    authorizedContentRef: typeof raw.authorizedContentRef === 'string'
      ? raw.authorizedContentRef
      : null,
    rowNumber,
  };
}

export function parseSourceResourceCrosswalkText(text: string): SourceResourceCrosswalkRow[] {
  const lines = text.split(/\r?\n/u);
  const rows: SourceResourceCrosswalkRow[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!.trim();
    if (!line || line.startsWith('#')) continue;
    rows.push(parseSourceResourceCrosswalkLine(line, i + 1));
  }
  return rows;
}

export function loadSourceResourceCrosswalk(input?: {
  repoRoot?: string;
  crosswalkPath?: string;
}): SourceResourceCrosswalkRow[] {
  const root = input?.repoRoot ?? process.cwd();
  const filePath = input?.crosswalkPath
    ?? path.join(
      root,
      DEFAULT_TEXTBOOK_LOCATOR_AUTHORING_RELATIVE,
      'source-resource-crosswalk.jsonl',
    );
  let text: string;
  try {
    text = readFileSync(/*turbopackIgnore: true*/ filePath, 'utf8');
  } catch (error) {
    throw new TextbookCrosswalkError(
      'missing-crosswalk',
      `source-resource-crosswalk unreadable at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (text.trim().length === 0) {
    throw new TextbookCrosswalkError(
      'missing-crosswalk',
      `source-resource-crosswalk is empty: ${filePath}`,
    );
  }
  return parseSourceResourceCrosswalkText(text);
}

/**
 * Structural validation of crosswalk rows against inventory + authority pin.
 * Returns machine-readable failures; does not throw for row-level issues.
 */
export function validateCrosswalkAgainstInventory(input: {
  rows: readonly SourceResourceCrosswalkRow[];
  authority: TextbookLocatorAuthorityBinding;
  sourceDocumentIds: ReadonlySet<string>;
  sourceAnchorIds: ReadonlySet<string>;
  anchorDocumentById: ReadonlyMap<string, string>;
}): { rows: SourceResourceCrosswalkRow[]; failures: TextbookSliceFailure[] } {
  const failures: TextbookSliceFailure[] = [];
  const seenAnchors = new Map<string, number>();
  const accepted: SourceResourceCrosswalkRow[] = [];

  if (input.rows.length === 0) {
    failures.push({
      code: 'missing-crosswalk',
      message: 'source-resource-crosswalk has no rows',
    });
    return { rows: [], failures };
  }

  for (const row of input.rows) {
    const rowNumber = row.rowNumber;

    if (
      row.authorityReleaseId !== input.authority.authorityReleaseId
      || row.authorityReleaseHash !== input.authority.authorityReleaseHash
      || row.bundleDigest !== input.authority.bundleDigest
    ) {
      failures.push({
        code: 'authority-drift',
        message: `row ${rowNumber ?? '?'}: crosswalk authority identity does not match pinned Authority binding`,
        rowNumber,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
      });
      continue;
    }

    if (row.captureRevision !== input.authority.captureRevision) {
      failures.push({
        code: 'capture-drift',
        message: `row ${rowNumber ?? '?'}: captureRevision drifts from pinned capture ${input.authority.captureRevision}`,
        rowNumber,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
      });
      continue;
    }

    if (!input.sourceDocumentIds.has(row.sourceDocumentId)) {
      failures.push({
        code: 'missing-source-document',
        message: `row ${rowNumber ?? '?'}: unknown sourceDocumentId ${row.sourceDocumentId}`,
        rowNumber,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
      });
      continue;
    }

    if (!input.sourceAnchorIds.has(row.sourceAnchorId)) {
      failures.push({
        code: 'missing-source-anchor',
        message: `row ${rowNumber ?? '?'}: unknown sourceAnchorId ${row.sourceAnchorId}`,
        rowNumber,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
      });
      continue;
    }

    const anchorDoc = input.anchorDocumentById.get(row.sourceAnchorId);
    if (anchorDoc && anchorDoc !== row.sourceDocumentId) {
      failures.push({
        code: 'schema-invalid',
        message: `row ${rowNumber ?? '?'}: sourceAnchorId ${row.sourceAnchorId} belongs to ${anchorDoc}, not ${row.sourceDocumentId}`,
        rowNumber,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
      });
      continue;
    }

    if (!row.chapterKey || !row.sectionKey) {
      failures.push({
        code: 'missing-locator',
        message: `row ${rowNumber ?? '?'}: chapterKey/sectionKey locator is required`,
        rowNumber,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
      });
      continue;
    }

    const prior = seenAnchors.get(row.sourceAnchorId);
    if (prior !== undefined) {
      failures.push({
        code: 'duplicate-anchor',
        message: `row ${rowNumber ?? '?'}: duplicate sourceAnchorId ${row.sourceAnchorId} (also row ${prior})`,
        rowNumber,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
      });
      continue;
    }
    seenAnchors.set(row.sourceAnchorId, rowNumber ?? -1);
    accepted.push(row);
  }

  return { rows: accepted, failures };
}
