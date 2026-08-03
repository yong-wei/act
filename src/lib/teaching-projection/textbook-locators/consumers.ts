/**
 * Consumer adapters for textbook locator projection (#1269).
 *
 * Surgical contracts for ResourceNode registry, segment/scene binding, and
 * RAG citation provenance. Locator rows never grant path eligibility or raw
 * textbook body access.
 */

import type {
  TextbookExplainsBinding,
  TextbookLocatorProjection,
  TextbookProjectedResource,
  TextbookRagCitationCandidate,
} from './contracts';

/** Registry-facing row: reference-governed, never path-eligible from locator alone. */
export interface TextbookLocatorRegistryRow {
  resourceId: string;
  grain: 'TEXTBOOK' | 'CHAPTER' | 'SECTION';
  parentResourceId: string | null;
  title: string | null;
  sourceDocumentId: string;
  sourceAnchorId: string | null;
  chapterKey: string | null;
  sectionKey: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  accessMode: TextbookProjectedResource['accessMode'];
  /** Always false for locator-only projection. */
  pathEligible: false;
  /** Always false — raw body is never projected from public locators. */
  rawTextIncluded: false;
  authorityReleaseId: string;
  authorityReleaseHash: string;
  captureRevision: string;
  projectionBuildId: string;
  contentHashes: string[];
  reviewDisposition: 'reference-governed';
  exclusionReason: string | null;
}

/** Segment/scene binding row: EXPLAINS to Canonical without path scene allowance. */
export interface TextbookLocatorSegmentBinding {
  segmentId: string;
  resourceId: string;
  sourceDocumentId: string;
  sourceAnchorId: string;
  canonicalId: string;
  role: 'EXPLAINS';
  locator: {
    chapterKey: string | null;
    sectionKey: string | null;
    pageStart: number | null;
    pageEnd: number | null;
  };
  authorityReleaseId: string;
  authorityReleaseHash: string;
  captureRevision: string;
  projectionBuildId: string;
  /** path scene is never allowed from locator alone. */
  sceneAvailability: {
    path: { allowed: false; reason: 'locator-only-not-path-eligible' };
    konling: { allowed: boolean; reason: string | null };
    diagnosis: { allowed: false; reason: 'locator-only-not-path-eligible' };
    grading: { allowed: false; reason: 'locator-only-not-path-eligible' };
    'prep-pack': { allowed: boolean; reason: string | null };
    report: { allowed: boolean; reason: string | null };
  };
  citationReadiness: {
    status: 'resolvable' | 'missing-target';
    verified: false;
    limitations: string[];
  };
}

export interface TextbookLocatorConsumerViews {
  registryRows: TextbookLocatorRegistryRow[];
  segmentBindings: TextbookLocatorSegmentBinding[];
  ragCandidates: TextbookRagCitationCandidate[];
  /** Non-textbook Teaching Projection / Authority remain selectable. */
  authoritySelectable: true;
  otherTeachingResourcesSelectable: true;
  textbookSliceSelectable: boolean;
  textbookSliceStatus: TextbookLocatorProjection['sliceStatus'];
  textbookSliceFailures: TextbookLocatorProjection['failures'];
}

function registryRowFromResource(
  resource: TextbookProjectedResource,
): TextbookLocatorRegistryRow {
  const exclusionReason = resource.accessMode === 'REFERENCE_ONLY'
    ? 'locator-only-reference-governed'
    : null;
  return {
    resourceId: resource.resourceId,
    grain: resource.grain,
    parentResourceId: resource.parentResourceId,
    title: resource.title,
    sourceDocumentId: resource.locator.sourceDocumentId,
    sourceAnchorId: resource.locator.sourceAnchorId,
    chapterKey: resource.locator.chapterKey,
    sectionKey: resource.locator.sectionKey,
    pageStart: resource.locator.pageStart,
    pageEnd: resource.locator.pageEnd,
    accessMode: resource.accessMode,
    pathEligible: false,
    rawTextIncluded: false,
    authorityReleaseId: resource.provenance.authorityReleaseId,
    authorityReleaseHash: resource.provenance.authorityReleaseHash,
    captureRevision: resource.provenance.captureRevision,
    projectionBuildId: resource.provenance.projectionBuildId,
    contentHashes: resource.provenance.contentHashes,
    reviewDisposition: 'reference-governed',
    exclusionReason,
  };
}

function segmentBindingFromExplains(
  binding: TextbookExplainsBinding,
): TextbookLocatorSegmentBinding {
  const referenceOnly = true; // EXPLAINS bindings originate from locator rows.
  return {
    segmentId: `seg:${binding.resourceId}`,
    resourceId: binding.resourceId,
    sourceDocumentId: binding.sourceDocumentId,
    sourceAnchorId: binding.sourceAnchorId,
    canonicalId: binding.canonicalId,
    role: 'EXPLAINS',
    locator: {
      chapterKey: binding.locator.chapterKey,
      sectionKey: binding.locator.sectionKey,
      pageStart: binding.locator.pageStart,
      pageEnd: binding.locator.pageEnd,
    },
    authorityReleaseId: binding.provenance.authorityReleaseId,
    authorityReleaseHash: binding.provenance.authorityReleaseHash,
    captureRevision: binding.provenance.captureRevision,
    projectionBuildId: binding.provenance.projectionBuildId,
    sceneAvailability: {
      path: { allowed: false, reason: 'locator-only-not-path-eligible' },
      konling: {
        allowed: true,
        reason: referenceOnly ? 'reference-citation-only' : null,
      },
      diagnosis: { allowed: false, reason: 'locator-only-not-path-eligible' },
      grading: { allowed: false, reason: 'locator-only-not-path-eligible' },
      'prep-pack': {
        allowed: true,
        reason: 'reference-citation-only',
      },
      report: {
        allowed: true,
        reason: 'reference-citation-only',
      },
    },
    citationReadiness: {
      status: 'resolvable',
      verified: false,
      limitations: [
        'locator-only',
        'no-raw-textbook-body',
        'path-eligibility-requires-separate-review',
      ],
    },
  };
}

/**
 * Project textbook locator output into registry / segment / RAG consumer views.
 * When the textbook slice is REVIEW_REQUIRED, textbook consumer rows are empty
 * while Authority and other teaching resources remain selectable.
 */
export function projectTextbookLocatorConsumers(
  projection: TextbookLocatorProjection,
): TextbookLocatorConsumerViews {
  const textbookSliceSelectable = projection.sliceStatus === 'PUBLISHED';

  if (!textbookSliceSelectable) {
    return {
      registryRows: [],
      segmentBindings: [],
      ragCandidates: [],
      authoritySelectable: true,
      otherTeachingResourcesSelectable: true,
      textbookSliceSelectable: false,
      textbookSliceStatus: projection.sliceStatus,
      textbookSliceFailures: projection.failures,
    };
  }

  return {
    registryRows: projection.resources.map(registryRowFromResource),
    segmentBindings: projection.bindings.map(segmentBindingFromExplains),
    ragCandidates: projection.ragCandidates.map((candidate) => ({
      ...candidate,
      rawContentAvailable: false as const,
    })),
    authoritySelectable: true,
    otherTeachingResourcesSelectable: true,
    textbookSliceSelectable: true,
    textbookSliceStatus: projection.sliceStatus,
    textbookSliceFailures: [],
  };
}

/**
 * Build a citation-safe RAG provenance record from a locator candidate.
 * Never synthesizes textbook body text.
 */
export function textbookLocatorToRagProvenance(
  candidate: TextbookRagCitationCandidate,
): {
  resourceId: string;
  sourceDocumentId: string;
  sourceAnchorId: string;
  canonicalId: string;
  authorityReleaseId: string;
  authorityReleaseHash: string;
  captureRevision: string;
  projectionBuildId: string;
  locator: TextbookRagCitationCandidate['locator'];
  accessMode: TextbookRagCitationCandidate['accessMode'];
  rawContentAvailable: false;
  authorizedBody: boolean;
  citationSafe: true;
} {
  return {
    resourceId: candidate.resourceId,
    sourceDocumentId: candidate.sourceDocumentId,
    sourceAnchorId: candidate.sourceAnchorId,
    canonicalId: candidate.canonicalId,
    authorityReleaseId: candidate.provenance.authorityReleaseId,
    authorityReleaseHash: candidate.provenance.authorityReleaseHash,
    captureRevision: candidate.provenance.captureRevision,
    projectionBuildId: candidate.provenance.projectionBuildId,
    locator: candidate.locator,
    accessMode: candidate.accessMode,
    rawContentAvailable: false,
    authorizedBody: candidate.authorizedBody,
    citationSafe: true,
  };
}
