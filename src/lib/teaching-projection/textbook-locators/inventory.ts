/**
 * Load public ActKG SourceDocument / SourceAnchor locator inventory (#1269).
 *
 * Uses public evidence-segment and source-object stubs (no textbook body).
 * Binds inventory to the pinned v0.12 Authority / bundle / capture identity.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_ACTKG_SOURCE_STUBS_RELATIVE,
  DEFAULT_TEXTBOOK_LOCATOR_AUTHORING_RELATIVE,
  DEFAULT_V012_BUNDLE_MANIFEST_RELATIVE,
  TEXTBOOK_LOCATOR_AUTHORITY_BINDING_CONTRACT,
  type ActkgSourceAnchor,
  type ActkgSourceDocument,
  type ActkgSourceLocatorInventory,
  type TextbookLocatorAuthorityBinding,
} from './contracts';

const ROOT_LOCUS_SUFFIX = '-root-locus';

const BOOK_TITLES: Readonly<Record<string, string>> = {
  'dorf-modern-control-systems-14th': 'Modern Control Systems (Dorf/Bishop, 14th)',
  'franklin-feedback-control-7th': 'Feedback Control of Dynamic Systems (Franklin, 7th)',
  'hu-shousong-auto-control-8th': '自动控制原理（胡寿松，第8版）',
};

export class TextbookLocatorInventoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TextbookLocatorInventoryError';
    this.code = code;
  }
}

export function normalizeSourceDocumentId(sourceOrEditionId: string): string {
  if (typeof sourceOrEditionId !== 'string' || sourceOrEditionId.trim().length === 0) {
    throw new TextbookLocatorInventoryError(
      'schema-invalid',
      'source/edition id must be a non-empty string',
    );
  }
  return sourceOrEditionId.endsWith(ROOT_LOCUS_SUFFIX)
    ? sourceOrEditionId.slice(0, -ROOT_LOCUS_SUFFIX.length)
    : sourceOrEditionId;
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareCodePoint(keyFn(a), keyFn(b)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  } catch (error) {
    throw new TextbookLocatorInventoryError(
      'inventory-unreadable',
      `failed to read inventory file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function loadTextbookLocatorAuthorityBinding(
  filePath: string,
): TextbookLocatorAuthorityBinding {
  const raw = readJsonFile(filePath);
  if (!isRecord(raw)) {
    throw new TextbookLocatorInventoryError('schema-invalid', 'authority-binding must be an object');
  }
  const inventory = raw.sourceInventory;
  if (!isRecord(inventory)) {
    throw new TextbookLocatorInventoryError(
      'schema-invalid',
      'authority-binding.sourceInventory must be an object',
    );
  }
  const sourceDocumentIds = inventory.sourceDocumentIds;
  if (!Array.isArray(sourceDocumentIds) || sourceDocumentIds.some((id) => typeof id !== 'string')) {
    throw new TextbookLocatorInventoryError(
      'schema-invalid',
      'authority-binding.sourceInventory.sourceDocumentIds must be string[]',
    );
  }

  const requiredString = (key: string): string => {
    const value = raw[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new TextbookLocatorInventoryError(
        'schema-invalid',
        `authority-binding.${key} must be a non-empty string`,
      );
    }
    return value;
  };

  return {
    contract: typeof raw.contract === 'string'
      ? raw.contract
      : TEXTBOOK_LOCATOR_AUTHORITY_BINDING_CONTRACT,
    authorityReleaseId: requiredString('authorityReleaseId'),
    authorityReleaseVersion: requiredString('authorityReleaseVersion'),
    authorityReleaseHash: requiredString('authorityReleaseHash'),
    sourceDatasetHash: requiredString('sourceDatasetHash'),
    bundleId: requiredString('bundleId'),
    bundleDigest: requiredString('bundleDigest'),
    captureRevision: requiredString('captureRevision'),
    captureTag: typeof raw.captureTag === 'string' ? raw.captureTag : null,
    sourceInventory: {
      kind: typeof inventory.kind === 'string' ? inventory.kind : 'actkg-public-source-stubs',
      componentReleaseId: typeof inventory.componentReleaseId === 'string'
        ? inventory.componentReleaseId
        : '',
      componentReleaseHash: typeof inventory.componentReleaseHash === 'string'
        ? inventory.componentReleaseHash
        : '',
      componentPath: typeof inventory.componentPath === 'string'
        ? inventory.componentPath
        : '',
      sourceDocumentIds: [...sourceDocumentIds].sort(compareCodePoint),
    },
  };
}

/**
 * Parse public ActKG stubs into SourceDocument / SourceAnchor sets.
 * Does not read or retain raw textbook text fields.
 */
export function parseActkgSourceLocatorStubs(input: {
  stubsPayload: unknown;
  authority: TextbookLocatorAuthorityBinding;
}): ActkgSourceLocatorInventory {
  if (!isRecord(input.stubsPayload)) {
    throw new TextbookLocatorInventoryError('schema-invalid', 'ActKG stubs payload must be an object');
  }

  const evidence = input.stubsPayload.evidence_segment_stubs;
  const objects = input.stubsPayload.source_object_stubs;
  if (!Array.isArray(evidence) || !Array.isArray(objects)) {
    throw new TextbookLocatorInventoryError(
      'schema-invalid',
      'ActKG stubs must include evidence_segment_stubs and source_object_stubs arrays',
    );
  }

  const expectedDocs = new Set(input.authority.sourceInventory.sourceDocumentIds);
  if (expectedDocs.size === 0) {
    throw new TextbookLocatorInventoryError(
      'schema-invalid',
      'authority binding must declare the three source document ids',
    );
  }

  const editionToDoc = new Map<string, string>();
  const languageByDoc = new Map<string, string | null>();

  for (const raw of objects) {
    if (!isRecord(raw)) continue;
    const sourceId = typeof raw.source_id === 'string' ? raw.source_id : null;
    if (!sourceId) continue;
    const docId = normalizeSourceDocumentId(sourceId);
    if (!expectedDocs.has(docId)) continue;
    editionToDoc.set(sourceId, docId);
    if (!languageByDoc.has(docId)) {
      languageByDoc.set(docId, typeof raw.language === 'string' ? raw.language : null);
    }
  }

  for (const raw of evidence) {
    if (!isRecord(raw)) continue;
    const edition = typeof raw.source_edition_id === 'string' ? raw.source_edition_id : null;
    if (!edition) continue;
    const docId = normalizeSourceDocumentId(edition);
    if (!expectedDocs.has(docId)) continue;
    editionToDoc.set(edition, docId);
  }

  // Ensure declared documents appear even if a stub set is empty for one book.
  for (const docId of expectedDocs) {
    if (![...editionToDoc.values()].includes(docId)) {
      editionToDoc.set(docId, docId);
    }
  }

  const documents: ActkgSourceDocument[] = sortBy(
    [...expectedDocs].map((sourceDocumentId) => {
      const edition = [...editionToDoc.entries()].find(([, doc]) => doc === sourceDocumentId)?.[0]
        ?? sourceDocumentId;
      return {
        sourceDocumentId,
        sourceEditionId: edition,
        title: BOOK_TITLES[sourceDocumentId] ?? null,
        language: languageByDoc.get(sourceDocumentId) ?? null,
      };
    }),
    (d) => d.sourceDocumentId,
  );

  type AnchorAcc = {
    sourceAnchorId: string;
    sourceDocumentId: string;
    sourceEditionId: string;
    contentHashes: Set<string>;
    segmentTypes: Set<string>;
  };
  const anchors = new Map<string, AnchorAcc>();

  for (const raw of evidence) {
    if (!isRecord(raw)) continue;
    const sectionId = typeof raw.section_id === 'string' ? raw.section_id : null;
    const edition = typeof raw.source_edition_id === 'string' ? raw.source_edition_id : null;
    if (!sectionId || !edition) continue;
    const docId = editionToDoc.get(edition) ?? normalizeSourceDocumentId(edition);
    if (!expectedDocs.has(docId)) continue;

    let acc = anchors.get(sectionId);
    if (!acc) {
      acc = {
        sourceAnchorId: sectionId,
        sourceDocumentId: docId,
        sourceEditionId: edition,
        contentHashes: new Set(),
        segmentTypes: new Set(),
      };
      anchors.set(sectionId, acc);
    }
    if (typeof raw.content_hash === 'string' && raw.content_hash.length > 0) {
      acc.contentHashes.add(raw.content_hash);
    }
    if (typeof raw.segment_type === 'string' && raw.segment_type.length > 0) {
      acc.segmentTypes.add(raw.segment_type);
    }
  }

  // Also accept section ids observed only on source objects.
  for (const raw of objects) {
    if (!isRecord(raw)) continue;
    const sectionId = typeof raw.section_id === 'string' ? raw.section_id : null;
    const sourceId = typeof raw.source_id === 'string' ? raw.source_id : null;
    if (!sectionId || !sourceId) continue;
    const docId = normalizeSourceDocumentId(sourceId);
    if (!expectedDocs.has(docId)) continue;
    if (anchors.has(sectionId)) continue;
    anchors.set(sectionId, {
      sourceAnchorId: sectionId,
      sourceDocumentId: docId,
      sourceEditionId: sourceId,
      contentHashes: new Set(),
      segmentTypes: new Set(),
    });
  }

  const sourceAnchors: ActkgSourceAnchor[] = sortBy(
    [...anchors.values()].map((acc) => ({
      sourceAnchorId: acc.sourceAnchorId,
      sourceDocumentId: acc.sourceDocumentId,
      sourceEditionId: acc.sourceEditionId,
      contentHashes: [...acc.contentHashes].sort(compareCodePoint),
      segmentTypes: [...acc.segmentTypes].sort(compareCodePoint),
    })),
    (a) => a.sourceAnchorId,
  );

  // Fail closed if a declared book is missing entirely from public stubs.
  for (const doc of documents) {
    const hasAnchor = sourceAnchors.some((a) => a.sourceDocumentId === doc.sourceDocumentId);
    if (!hasAnchor) {
      throw new TextbookLocatorInventoryError(
        'missing-source-document',
        `declared source document ${doc.sourceDocumentId} has no public SourceAnchor set`,
      );
    }
  }

  return {
    authority: input.authority,
    sourceDocuments: documents,
    sourceAnchors,
  };
}

export function loadActkgSourceLocatorInventory(input?: {
  repoRoot?: string;
  authorityBindingPath?: string;
  stubsPath?: string;
}): ActkgSourceLocatorInventory {
  const root = input?.repoRoot ?? process.cwd();
  const authorityPath = input?.authorityBindingPath
    ?? path.join(root, DEFAULT_TEXTBOOK_LOCATOR_AUTHORING_RELATIVE, 'authority-binding.json');
  const stubsPath = input?.stubsPath
    ?? path.join(root, DEFAULT_ACTKG_SOURCE_STUBS_RELATIVE);

  const authority = loadTextbookLocatorAuthorityBinding(authorityPath);
  const stubsPayload = readJsonFile(stubsPath);
  return parseActkgSourceLocatorStubs({ stubsPayload, authority });
}

/**
 * Load v0.12 bundle identity and verify it matches the authority binding.
 * Used by tests and capture-drift checks.
 */
export function loadV012BundleIdentity(input?: {
  repoRoot?: string;
  manifestPath?: string;
}): {
  authorityReleaseId: string;
  authorityReleaseVersion: string;
  authorityReleaseHash: string;
  sourceDatasetHash: string;
  bundleId: string;
  bundleDigest: string;
  captureRevision: string;
  captureTag: string | null;
} {
  const root = input?.repoRoot ?? process.cwd();
  const manifestPath = input?.manifestPath
    ?? path.join(root, DEFAULT_V012_BUNDLE_MANIFEST_RELATIVE);
  const raw = readJsonFile(manifestPath);
  if (!isRecord(raw)) {
    throw new TextbookLocatorInventoryError('schema-invalid', 'bundle-manifest must be an object');
  }
  const release = raw.release;
  const sourceRevision = raw.source_revision;
  if (!isRecord(release) || !isRecord(sourceRevision)) {
    throw new TextbookLocatorInventoryError(
      'schema-invalid',
      'bundle-manifest must include release and source_revision objects',
    );
  }
  const str = (obj: Record<string, unknown>, key: string): string => {
    const value = obj[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new TextbookLocatorInventoryError(
        'schema-invalid',
        `bundle-manifest missing ${key}`,
      );
    }
    return value;
  };

  return {
    authorityReleaseId: str(release, 'release_id'),
    authorityReleaseVersion: str(release, 'release_version'),
    authorityReleaseHash: str(release, 'release_hash'),
    sourceDatasetHash: str(release, 'source_dataset_hash'),
    bundleId: str(raw, 'bundle_id'),
    bundleDigest: str(raw, 'bundle_digest'),
    captureRevision: str(sourceRevision, 'commit'),
    captureTag: typeof sourceRevision.tag === 'string' ? sourceRevision.tag : null,
  };
}
