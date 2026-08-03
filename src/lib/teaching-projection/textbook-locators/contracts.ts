/**
 * ActKG textbook locator projection contracts (#1269).
 *
 * Public SourceDocument/SourceAnchor locators → ACT TEXTBOOK/CHAPTER/SECTION
 * resources and EXPLAINS bindings. No textbook body is imported or exposed.
 */

import type { TeachingProjectionState } from '@/lib/aggregate-governance/authority-boundary-states';

export const TEXTBOOK_LOCATOR_CONTRACT =
  'act-textbook-locator-projection/v1' as const;
export const TEXTBOOK_LOCATOR_CROSSWALK_CONTRACT =
  'act-textbook-source-resource-crosswalk/v1' as const;
export const TEXTBOOK_LOCATOR_AUTHORITY_BINDING_CONTRACT =
  'act-textbook-locator-authority-binding/v1' as const;
export const TEXTBOOK_LOCATOR_BUILDER_VERSION =
  'act-textbook-locator-builder/v1' as const;

export const DEFAULT_TEXTBOOK_LOCATOR_AUTHORING_RELATIVE =
  'course-content/authoring/knowledge/teaching-projection/textbook-locators' as const;

export const DEFAULT_ACTKG_SOURCE_STUBS_RELATIVE =
  'course-content/authoring/knowledge/releases/root-locus-engineering-v0.1/root-locus-engineering-v0.1.json' as const;

export const DEFAULT_V012_BUNDLE_MANIFEST_RELATIVE =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.12/bundle-manifest.json' as const;

/** Access modes for locator-projected textbook resources. */
export const TEXTBOOK_ACCESS_MODES = [
  'REFERENCE_ONLY',
  'LOCAL_AUTHORIZED',
  'EXTERNAL_AUTHORIZED',
] as const;

export type TextbookAccessMode = (typeof TEXTBOOK_ACCESS_MODES)[number];

export const TEXTBOOK_SLICE_FAILURE_CODES = [
  'missing-source-document',
  'missing-source-anchor',
  'missing-locator',
  'missing-crosswalk',
  'duplicate-anchor',
  'duplicate-resource-id',
  'unknown-canonical',
  'capture-drift',
  'authority-drift',
  'schema-invalid',
  'raw-text-forbidden',
] as const;

export type TextbookSliceFailureCode = (typeof TEXTBOOK_SLICE_FAILURE_CODES)[number];

// ---------------------------------------------------------------------------
// Public ActKG inventory (locator-only)
// ---------------------------------------------------------------------------

/** Public SourceDocument identity (ActKG source work/edition, no body). */
export interface ActkgSourceDocument {
  sourceDocumentId: string;
  /** Raw ActKG source/edition id before normalization. */
  sourceEditionId: string;
  title: string | null;
  language: string | null;
}

/** Public SourceAnchor identity (section-grain locator, no body). */
export interface ActkgSourceAnchor {
  sourceAnchorId: string;
  sourceDocumentId: string;
  sourceEditionId: string;
  /** Content hashes of public evidence-segment stubs (no raw text). */
  contentHashes: string[];
  segmentTypes: string[];
}

export interface TextbookLocatorAuthorityBinding {
  contract: typeof TEXTBOOK_LOCATOR_AUTHORITY_BINDING_CONTRACT | string;
  authorityReleaseId: string;
  authorityReleaseVersion: string;
  authorityReleaseHash: string;
  sourceDatasetHash: string;
  bundleId: string;
  bundleDigest: string;
  captureRevision: string;
  captureTag?: string | null;
  sourceInventory: {
    kind: string;
    componentReleaseId: string;
    componentReleaseHash: string;
    componentPath: string;
    sourceDocumentIds: string[];
  };
}

export interface ActkgSourceLocatorInventory {
  authority: TextbookLocatorAuthorityBinding;
  sourceDocuments: ActkgSourceDocument[];
  sourceAnchors: ActkgSourceAnchor[];
}

// ---------------------------------------------------------------------------
// Authoring sidecar (source-resource-crosswalk)
// ---------------------------------------------------------------------------

export interface SourceResourceCrosswalkRow {
  sourceDocumentId: string;
  sourceAnchorId: string;
  chapterKey: string;
  sectionKey: string;
  pageStart: number | null;
  pageEnd: number | null;
  canonicalIds: string[];
  accessMode: TextbookAccessMode;
  authorityReleaseId: string;
  authorityReleaseHash: string;
  bundleDigest: string;
  captureRevision: string;
  /** Optional authorized runtime content ref — never raw textbook body. */
  authorizedContentRef?: string | null;
  /** 1-based line number in the sidecar file (diagnostics). */
  rowNumber?: number;
}

// ---------------------------------------------------------------------------
// Projection output
// ---------------------------------------------------------------------------

export interface TextbookResourceLocator {
  sourceDocumentId: string;
  sourceAnchorId: string | null;
  chapterKey: string | null;
  sectionKey: string | null;
  pageStart: number | null;
  pageEnd: number | null;
}

export interface TextbookResourceProvenance {
  authorityReleaseId: string;
  authorityReleaseHash: string;
  bundleDigest: string;
  captureRevision: string;
  projectionBuildId: string;
  builderVersion: typeof TEXTBOOK_LOCATOR_BUILDER_VERSION;
  sourceEditionId: string | null;
  contentHashes: string[];
  authorizedContentRef: string | null;
}

export interface TextbookProjectedResource {
  resourceId: string;
  resourceType: 'textbook' | 'textbook-chapter' | 'textbook-section';
  grain: 'TEXTBOOK' | 'CHAPTER' | 'SECTION';
  parentResourceId: string | null;
  title: string | null;
  accessMode: TextbookAccessMode;
  pathEligible: false;
  locator: TextbookResourceLocator;
  provenance: TextbookResourceProvenance;
}

export interface TextbookExplainsBinding {
  bindingId: string;
  resourceId: string;
  canonicalId: string;
  role: 'EXPLAINS';
  scopeId: string;
  sourceDocumentId: string;
  sourceAnchorId: string;
  locator: TextbookResourceLocator;
  provenance: TextbookResourceProvenance;
}

export interface TextbookSliceFailure {
  code: TextbookSliceFailureCode;
  message: string;
  rowNumber?: number;
  sourceDocumentId?: string;
  sourceAnchorId?: string;
  resourceId?: string;
  canonicalId?: string;
}

export interface TextbookRagCitationCandidate {
  resourceId: string;
  sourceDocumentId: string;
  sourceAnchorId: string;
  canonicalId: string;
  accessMode: TextbookAccessMode;
  locator: TextbookResourceLocator;
  provenance: TextbookResourceProvenance;
  /** Locator-only rows are citation targets, never raw bodies. */
  rawContentAvailable: false;
  authorizedBody: boolean;
}

export interface TextbookLocatorProjection {
  contract: typeof TEXTBOOK_LOCATOR_CONTRACT;
  builderVersion: typeof TEXTBOOK_LOCATOR_BUILDER_VERSION;
  scopeId: string;
  projectionBuildId: string;
  authority: TextbookLocatorAuthorityBinding;
  sliceStatus: TeachingProjectionState;
  resources: TextbookProjectedResource[];
  bindings: TextbookExplainsBinding[];
  ragCandidates: TextbookRagCitationCandidate[];
  failures: TextbookSliceFailure[];
  /** True when textbook slice failed; Authority and other slices remain usable. */
  blocksTextbookSliceOnly: true;
  summary: {
    sourceDocumentCount: number;
    sourceAnchorCount: number;
    crosswalkRowCount: number;
    resourceCount: number;
    bindingCount: number;
    failureCount: number;
  };
}

export interface TextbookLocatorBuildInput {
  scopeId: string;
  inventory: ActkgSourceLocatorInventory;
  crosswalkRows: readonly SourceResourceCrosswalkRow[];
  /**
   * Canonical IDs known in the pinned Authority release.
   * Unknown endpoints fail the textbook slice only.
   */
  authorityCanonicalIds: ReadonlySet<string> | readonly string[];
  /** Optional override for deterministic build id (tests). */
  projectionBuildId?: string;
}
