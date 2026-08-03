/**
 * Deterministic textbook locator projection builder (#1269).
 *
 * TEXTBOOK → CHAPTER → SECTION resources + EXPLAINS bindings.
 * Sidecar failure marks only the textbook slice REVIEW_REQUIRED.
 */

import path from 'node:path';

import { projectionDigest } from '../hash';
import {
  DEFAULT_TEXTBOOK_LOCATOR_AUTHORING_RELATIVE,
  TEXTBOOK_LOCATOR_AUTHORITY_BINDING_CONTRACT,
  TEXTBOOK_LOCATOR_BUILDER_VERSION,
  TEXTBOOK_LOCATOR_CONTRACT,
  type ActkgSourceLocatorInventory,
  type SourceResourceCrosswalkRow,
  type TextbookExplainsBinding,
  type TextbookLocatorAuthorityBinding,
  type TextbookLocatorBuildInput,
  type TextbookLocatorProjection,
  type TextbookProjectedResource,
  type TextbookRagCitationCandidate,
  type TextbookResourceLocator,
  type TextbookResourceProvenance,
  type TextbookSliceFailure,
  type TextbookSliceFailureCode,
} from './contracts';
import {
  loadSourceResourceCrosswalk,
  TextbookCrosswalkError,
  validateCrosswalkAgainstInventory,
} from './crosswalk';
import {
  deriveTextbookChapterResourceId,
  deriveTextbookExplainsBindingId,
  deriveTextbookResourceId,
  deriveTextbookSectionResourceId,
} from './identity';
import {
  loadActkgSourceLocatorInventory,
  loadAuthorityCanonicalIdsFromSnapshot,
  loadTextbookLocatorAuthorityBinding,
  TextbookLocatorInventoryError,
} from './inventory';

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareCodePoint(keyFn(a), keyFn(b)));
}

function toCanonicalSet(
  value: TextbookLocatorBuildInput['authorityCanonicalIds'],
): Set<string> {
  if (value instanceof Set) return value;
  return new Set(value);
}

function buildProjectionBuildId(input: TextbookLocatorBuildInput): string {
  if (input.projectionBuildId) return input.projectionBuildId;
  return `tbloc-${projectionDigest({
    scopeId: input.scopeId,
    authorityReleaseHash: input.inventory.authority.authorityReleaseHash,
    bundleDigest: input.inventory.authority.bundleDigest,
    captureRevision: input.inventory.authority.captureRevision,
    crosswalk: input.crosswalkRows,
    builderVersion: TEXTBOOK_LOCATOR_BUILDER_VERSION,
  }).slice(0, 32)}`;
}

/**
 * Project ActKG public locators + ACT crosswalk into textbook resources.
 * Never includes raw textbook text. Failures isolate to the textbook slice.
 */
export function buildTextbookLocatorProjection(
  input: TextbookLocatorBuildInput,
): TextbookLocatorProjection {
  const authority = input.inventory.authority;
  const projectionBuildId = buildProjectionBuildId(input);
  const authorityCanonicalIds = toCanonicalSet(input.authorityCanonicalIds);

  const sourceDocumentIds = new Set(
    input.inventory.sourceDocuments.map((d) => d.sourceDocumentId),
  );
  const sourceAnchorIds = new Set(
    input.inventory.sourceAnchors.map((a) => a.sourceAnchorId),
  );
  const anchorDocumentById = new Map(
    input.inventory.sourceAnchors.map((a) => [a.sourceAnchorId, a.sourceDocumentId]),
  );
  const anchorById = new Map(
    input.inventory.sourceAnchors.map((a) => [a.sourceAnchorId, a]),
  );
  const documentById = new Map(
    input.inventory.sourceDocuments.map((d) => [d.sourceDocumentId, d]),
  );

  const validated = validateCrosswalkAgainstInventory({
    rows: input.crosswalkRows,
    authority,
    sourceDocumentIds,
    sourceAnchorIds,
    anchorDocumentById,
  });

  const failures: TextbookSliceFailure[] = [...validated.failures];
  const resourcesById = new Map<string, TextbookProjectedResource>();
  const bindings: TextbookExplainsBinding[] = [];
  const ragCandidates: TextbookRagCitationCandidate[] = [];

  const makeProvenance = (
    sourceEditionId: string | null,
    contentHashes: string[],
    authorizedContentRef: string | null,
  ): TextbookResourceProvenance => ({
    authorityReleaseId: authority.authorityReleaseId,
    authorityReleaseHash: authority.authorityReleaseHash,
    bundleDigest: authority.bundleDigest,
    captureRevision: authority.captureRevision,
    projectionBuildId,
    builderVersion: TEXTBOOK_LOCATOR_BUILDER_VERSION,
    sourceEditionId,
    contentHashes,
    authorizedContentRef,
  });

  const ensureResource = (resource: TextbookProjectedResource): void => {
    const existing = resourcesById.get(resource.resourceId);
    if (existing) {
      // Same identity must remain byte-stable; conflict is a slice failure.
      // Distinct SourceAnchors that collide after token normalization are also
      // treated as duplicate identity (REVIEW_REQUIRED).
      if (
        existing.resourceType !== resource.resourceType
        || existing.parentResourceId !== resource.parentResourceId
        || existing.accessMode !== resource.accessMode
        || existing.locator.sourceDocumentId !== resource.locator.sourceDocumentId
        || existing.locator.sourceAnchorId !== resource.locator.sourceAnchorId
        || existing.locator.chapterKey !== resource.locator.chapterKey
        || existing.locator.sectionKey !== resource.locator.sectionKey
      ) {
        failures.push({
          code: 'duplicate-resource-id',
          message: `conflicting definitions for resource ${resource.resourceId}`
            + (
              existing.locator.sourceAnchorId
              && resource.locator.sourceAnchorId
              && existing.locator.sourceAnchorId !== resource.locator.sourceAnchorId
                ? ` (sourceAnchor collision: ${existing.locator.sourceAnchorId} vs ${resource.locator.sourceAnchorId})`
                : ''
            ),
          resourceId: resource.resourceId,
          sourceDocumentId: resource.locator.sourceDocumentId,
          sourceAnchorId: resource.locator.sourceAnchorId ?? undefined,
        });
      }
      return;
    }
    resourcesById.set(resource.resourceId, resource);
  };

  for (const row of validated.rows) {
    const doc = documentById.get(row.sourceDocumentId);
    const anchor = anchorById.get(row.sourceAnchorId);
    if (!doc || !anchor) {
      // validateCrosswalkAgainstInventory should have filtered these.
      failures.push({
        code: !doc ? 'missing-source-document' : 'missing-source-anchor',
        message: `row ${row.rowNumber ?? '?'}: inventory lookup failed after validation`,
        rowNumber: row.rowNumber,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
      });
      continue;
    }

    const knownCanonicals: string[] = [];
    for (const canonicalId of row.canonicalIds) {
      if (!authorityCanonicalIds.has(canonicalId)) {
        failures.push({
          code: 'unknown-canonical',
          message: `row ${row.rowNumber ?? '?'}: Canonical ID ${canonicalId} is not in the pinned Authority`,
          rowNumber: row.rowNumber,
          sourceDocumentId: row.sourceDocumentId,
          sourceAnchorId: row.sourceAnchorId,
          canonicalId,
        });
        continue;
      }
      knownCanonicals.push(canonicalId);
    }

    // If every Canonical failed, do not emit resources for this row.
    if (knownCanonicals.length === 0) {
      continue;
    }

    const textbookResourceId = deriveTextbookResourceId(row.sourceDocumentId);
    const chapterResourceId = deriveTextbookChapterResourceId(
      row.sourceDocumentId,
      row.chapterKey,
    );
    const sectionResourceId = deriveTextbookSectionResourceId(row.sourceAnchorId);

    const sectionLocator: TextbookResourceLocator = {
      sourceDocumentId: row.sourceDocumentId,
      sourceAnchorId: row.sourceAnchorId,
      chapterKey: row.chapterKey,
      sectionKey: row.sectionKey,
      pageStart: row.pageStart,
      pageEnd: row.pageEnd,
    };
    const chapterLocator: TextbookResourceLocator = {
      sourceDocumentId: row.sourceDocumentId,
      sourceAnchorId: null,
      chapterKey: row.chapterKey,
      sectionKey: null,
      pageStart: null,
      pageEnd: null,
    };
    const bookLocator: TextbookResourceLocator = {
      sourceDocumentId: row.sourceDocumentId,
      sourceAnchorId: null,
      chapterKey: null,
      sectionKey: null,
      pageStart: null,
      pageEnd: null,
    };

    const provenance = makeProvenance(
      anchor.sourceEditionId,
      anchor.contentHashes,
      row.authorizedContentRef ?? null,
    );

    // Book and chapter default to REFERENCE_ONLY containers.
    ensureResource({
      resourceId: textbookResourceId,
      resourceType: 'textbook',
      grain: 'TEXTBOOK',
      parentResourceId: null,
      title: doc.title,
      accessMode: 'REFERENCE_ONLY',
      pathEligible: false,
      locator: bookLocator,
      provenance: makeProvenance(doc.sourceEditionId, [], null),
    });

    ensureResource({
      resourceId: chapterResourceId,
      resourceType: 'textbook-chapter',
      grain: 'CHAPTER',
      parentResourceId: textbookResourceId,
      title: `${doc.title ?? row.sourceDocumentId} / ${row.chapterKey}`,
      accessMode: 'REFERENCE_ONLY',
      pathEligible: false,
      locator: chapterLocator,
      provenance: makeProvenance(doc.sourceEditionId, [], null),
    });

    ensureResource({
      resourceId: sectionResourceId,
      resourceType: 'textbook-section',
      grain: 'SECTION',
      parentResourceId: chapterResourceId,
      title: row.sectionKey,
      accessMode: row.accessMode,
      pathEligible: false,
      locator: sectionLocator,
      provenance,
    });

    for (const canonicalId of knownCanonicals) {
      const bindingId = deriveTextbookExplainsBindingId({
        resourceId: sectionResourceId,
        canonicalId,
        scopeId: input.scopeId,
      });
      bindings.push({
        bindingId,
        resourceId: sectionResourceId,
        canonicalId,
        role: 'EXPLAINS',
        scopeId: input.scopeId,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
        locator: sectionLocator,
        provenance,
      });

      const authorizedBody = row.accessMode !== 'REFERENCE_ONLY'
        && Boolean(row.authorizedContentRef);
      ragCandidates.push({
        resourceId: sectionResourceId,
        sourceDocumentId: row.sourceDocumentId,
        sourceAnchorId: row.sourceAnchorId,
        canonicalId,
        accessMode: row.accessMode,
        locator: sectionLocator,
        provenance,
        rawContentAvailable: false,
        authorizedBody,
      });
    }
  }

  const resources = sortBy([...resourcesById.values()], (r) => r.resourceId);
  const sortedBindings = sortBy(bindings, (b) => b.bindingId);
  const sortedRag = sortBy(
    ragCandidates,
    (c) => `${c.resourceId}\u001f${c.canonicalId}`,
  );
  const sortedFailures = sortBy(
    failures,
    (f) => `${f.code}\u001f${f.rowNumber ?? ''}\u001f${f.sourceAnchorId ?? ''}\u001f${f.canonicalId ?? ''}\u001f${f.message}`,
  );

  const sliceStatus = sortedFailures.length > 0 ? 'REVIEW_REQUIRED' : 'PUBLISHED';

  return {
    contract: TEXTBOOK_LOCATOR_CONTRACT,
    builderVersion: TEXTBOOK_LOCATOR_BUILDER_VERSION,
    scopeId: input.scopeId,
    projectionBuildId,
    authority,
    sliceStatus,
    resources,
    bindings: sortedBindings,
    ragCandidates: sortedRag,
    failures: sortedFailures,
    blocksTextbookSliceOnly: true,
    summary: {
      sourceDocumentCount: input.inventory.sourceDocuments.length,
      sourceAnchorCount: input.inventory.sourceAnchors.length,
      crosswalkRowCount: input.crosswalkRows.length,
      resourceCount: resources.length,
      bindingCount: sortedBindings.length,
      failureCount: sortedFailures.length,
    },
  };
}

/**
 * Build a machine-readable textbook-slice failure projection.
 * Authority pin may still be present for diagnostics; resources stay empty.
 */
export function buildFailedTextbookLocatorProjection(input: {
  scopeId: string;
  authority: TextbookLocatorAuthorityBinding;
  failures: readonly TextbookSliceFailure[];
  inventory?: ActkgSourceLocatorInventory | null;
  crosswalkRowCount?: number;
  projectionBuildId?: string;
}): TextbookLocatorProjection {
  const projectionBuildId = input.projectionBuildId
    ?? `tbloc-failed-${projectionDigest({
      scopeId: input.scopeId,
      failures: input.failures,
      builderVersion: TEXTBOOK_LOCATOR_BUILDER_VERSION,
    }).slice(0, 32)}`;
  const sortedFailures = sortBy(
    [...input.failures],
    (f) => `${f.code}\u001f${f.rowNumber ?? ''}\u001f${f.sourceAnchorId ?? ''}\u001f${f.canonicalId ?? ''}\u001f${f.message}`,
  );
  return {
    contract: TEXTBOOK_LOCATOR_CONTRACT,
    builderVersion: TEXTBOOK_LOCATOR_BUILDER_VERSION,
    scopeId: input.scopeId,
    projectionBuildId,
    authority: input.authority,
    sliceStatus: 'REVIEW_REQUIRED',
    resources: [],
    bindings: [],
    ragCandidates: [],
    failures: sortedFailures,
    blocksTextbookSliceOnly: true,
    summary: {
      sourceDocumentCount: input.inventory?.sourceDocuments.length ?? 0,
      sourceAnchorCount: input.inventory?.sourceAnchors.length ?? 0,
      crosswalkRowCount: input.crosswalkRowCount ?? 0,
      resourceCount: 0,
      bindingCount: 0,
      failureCount: sortedFailures.length,
    },
  };
}

function mapLoadErrorToSliceFailure(error: unknown): TextbookSliceFailure {
  if (error instanceof TextbookCrosswalkError) {
    const code: TextbookSliceFailureCode =
      error.code === 'missing-crosswalk'
        || error.code === 'schema-invalid'
        || error.code === 'raw-text-forbidden'
        ? error.code
        : 'schema-invalid';
    return { code, message: error.message };
  }
  if (error instanceof TextbookLocatorInventoryError) {
    const code: TextbookSliceFailureCode =
      error.code === 'inventory-identity-mismatch'
        || error.code === 'authority-drift'
        || error.code === 'capture-drift'
        || error.code === 'schema-invalid'
        || error.code === 'missing-source-document'
        || error.code === 'missing-source-anchor'
        ? error.code
        : error.code === 'inventory-unreadable'
          ? 'schema-invalid'
          : 'inventory-identity-mismatch';
    return { code, message: error.message };
  }
  return {
    code: 'schema-invalid',
    message: error instanceof Error ? error.message : String(error),
  };
}

function unknownAuthorityBinding(): TextbookLocatorAuthorityBinding {
  return {
    contract: TEXTBOOK_LOCATOR_AUTHORITY_BINDING_CONTRACT,
    authorityReleaseId: 'unknown',
    authorityReleaseVersion: 'unknown',
    authorityReleaseHash: 'unknown',
    sourceDatasetHash: 'unknown',
    bundleId: 'unknown',
    bundleDigest: 'unknown',
    captureRevision: 'unknown',
    captureTag: null,
    sourceInventory: {
      kind: 'actkg-public-source-stubs',
      componentReleaseId: 'unknown',
      componentReleaseHash: 'unknown',
      componentPath: 'unknown',
      sourceDocumentIds: [],
    },
  };
}

/**
 * Load authoring sidecars + inventory and project textbook locators.
 *
 * Sidecar / inventory load failures become textbook-slice REVIEW_REQUIRED
 * failures at this boundary; they never abort the broader Teaching Projection
 * build. Authority identity mismatch is fail-closed for the textbook slice only.
 */
export function loadAndBuildTextbookLocatorProjection(input: {
  scopeId: string;
  repoRoot?: string;
  authorityBindingPath?: string;
  stubsPath?: string;
  crosswalkPath?: string;
  bundleManifestPath?: string;
  /**
   * Canonical IDs known in the pinned Authority release.
   * When omitted, load from the fixed Authority release snapshot
   * (never from the crosswalk sidecar under validation).
   */
  authorityCanonicalIds?: TextbookLocatorBuildInput['authorityCanonicalIds'];
  /** Override path to Authority release.json when auto-loading Canonical IDs. */
  authorityReleasePath?: string;
  projectionBuildId?: string;
}): TextbookLocatorProjection {
  const root = input.repoRoot ?? process.cwd();
  const authorityPath = input.authorityBindingPath
    ?? path.join(root, DEFAULT_TEXTBOOK_LOCATOR_AUTHORING_RELATIVE, 'authority-binding.json');

  let authority: TextbookLocatorAuthorityBinding;
  try {
    authority = loadTextbookLocatorAuthorityBinding(authorityPath);
  } catch (error) {
    return buildFailedTextbookLocatorProjection({
      scopeId: input.scopeId,
      authority: unknownAuthorityBinding(),
      failures: [mapLoadErrorToSliceFailure(error)],
      projectionBuildId: input.projectionBuildId,
    });
  }

  let inventory: ActkgSourceLocatorInventory;
  try {
    inventory = loadActkgSourceLocatorInventory({
      repoRoot: root,
      authorityBindingPath: authorityPath,
      stubsPath: input.stubsPath,
      bundleManifestPath: input.bundleManifestPath,
    });
    authority = inventory.authority;
  } catch (error) {
    return buildFailedTextbookLocatorProjection({
      scopeId: input.scopeId,
      authority,
      failures: [mapLoadErrorToSliceFailure(error)],
      projectionBuildId: input.projectionBuildId,
    });
  }

  let crosswalkRows: SourceResourceCrosswalkRow[];
  try {
    crosswalkRows = loadSourceResourceCrosswalk({
      repoRoot: root,
      crosswalkPath: input.crosswalkPath,
    });
  } catch (error) {
    return buildFailedTextbookLocatorProjection({
      scopeId: input.scopeId,
      authority,
      inventory,
      failures: [mapLoadErrorToSliceFailure(error)],
      projectionBuildId: input.projectionBuildId,
    });
  }

  // Fail closed: Authority Canonical membership comes from the caller or the
  // fixed Authority snapshot — never from the crosswalk being validated.
  let authorityCanonicalIds: TextbookLocatorBuildInput['authorityCanonicalIds'];
  if (input.authorityCanonicalIds !== undefined) {
    authorityCanonicalIds = input.authorityCanonicalIds;
  } else {
    try {
      authorityCanonicalIds = loadAuthorityCanonicalIdsFromSnapshot({
        repoRoot: root,
        authority,
        authorityReleasePath: input.authorityReleasePath,
      });
    } catch (error) {
      return buildFailedTextbookLocatorProjection({
        scopeId: input.scopeId,
        authority,
        inventory,
        crosswalkRowCount: crosswalkRows.length,
        failures: [mapLoadErrorToSliceFailure(error)],
        projectionBuildId: input.projectionBuildId,
      });
    }
  }

  return buildTextbookLocatorProjection({
    scopeId: input.scopeId,
    inventory,
    crosswalkRows,
    authorityCanonicalIds,
    projectionBuildId: input.projectionBuildId,
  });
}

/**
 * Convert textbook section bindings into Teaching Projection authoring inputs.
 * Used to merge the textbook slice into the broader ACT Teaching Projection.
 *
 * Safe default: only PUBLISHED slices are merged. Pass
 * `requirePublishedSlice: false` only for explicit review/debug force-include.
 */
export function textbookProjectionToTeachingAuthoring(input: {
  projection: TextbookLocatorProjection;
  /**
   * When true (default), only emit rows if the textbook slice is PUBLISHED.
   * Set false only to force-include REVIEW_REQUIRED partial resources.
   */
  requirePublishedSlice?: boolean;
}): {
  resources: Array<{
    resourceId: string;
    resourceType: 'textbook' | 'textbook-chapter' | 'textbook-section';
    sourceDocumentId?: string;
    chapterKey?: string;
    sectionId?: string;
    projectionMode: 'OPTIONAL';
    scopeId: string;
    title?: string;
    sourcePath?: string;
  }>;
  bindings: Array<{
    resourceId: string;
    canonicalId: string;
    role: 'EXPLAINS';
    scopeId: string;
    sourcePath?: string;
    primary?: boolean;
  }>;
  included: boolean;
  reason: string | null;
} {
  const { projection } = input;
  // Fail closed by default: unpublished / REVIEW_REQUIRED slices never merge.
  const requirePublishedSlice = input.requirePublishedSlice !== false;
  if (requirePublishedSlice && projection.sliceStatus !== 'PUBLISHED') {
    return {
      resources: [],
      bindings: [],
      included: false,
      reason: `textbook slice is ${projection.sliceStatus}; blocked from Teaching Projection merge`,
    };
  }

  const resources = projection.resources.map((r) => {
    if (r.resourceType === 'textbook') {
      return {
        resourceId: r.resourceId,
        resourceType: 'textbook' as const,
        sourceDocumentId: r.locator.sourceDocumentId,
        projectionMode: 'OPTIONAL' as const,
        scopeId: projection.scopeId,
        title: r.title ?? undefined,
        sourcePath: `actkg-textbook-locator:${r.locator.sourceDocumentId}`,
      };
    }
    if (r.resourceType === 'textbook-chapter') {
      return {
        resourceId: r.resourceId,
        resourceType: 'textbook-chapter' as const,
        sourceDocumentId: r.locator.sourceDocumentId,
        chapterKey: r.locator.chapterKey ?? undefined,
        projectionMode: 'OPTIONAL' as const,
        scopeId: projection.scopeId,
        title: r.title ?? undefined,
        sourcePath: r.locator.chapterKey
          ? `actkg-textbook-locator:${r.locator.sourceDocumentId}:${r.locator.chapterKey}`
          : undefined,
      };
    }
    return {
      resourceId: r.resourceId,
      resourceType: 'textbook-section' as const,
      sectionId: r.locator.sourceAnchorId
        ? r.locator.sourceAnchorId.replace(/:/g, '.')
        : undefined,
      projectionMode: 'OPTIONAL' as const,
      scopeId: projection.scopeId,
      title: r.title ?? undefined,
      sourcePath: r.locator.sourceAnchorId
        ? `actkg-textbook-locator:${r.locator.sourceDocumentId}:${r.locator.sourceAnchorId}`
        : undefined,
    };
  });

  const bindings = projection.bindings.map((b) => ({
    resourceId: b.resourceId,
    canonicalId: b.canonicalId,
    role: 'EXPLAINS' as const,
    scopeId: b.scopeId,
    sourcePath: `actkg-textbook-locator:${b.sourceDocumentId}:${b.sourceAnchorId}`,
    primary: false,
  }));

  return {
    resources,
    bindings,
    included: true,
    reason: null,
  };
}
