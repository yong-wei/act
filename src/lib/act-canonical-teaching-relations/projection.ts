import {
  ACT_TEACHING_FAMILIES,
  ACT_TEACHING_PROJECTION_RECEIPT_CONTRACT,
  ACT_TEACHING_RELATION_GOVERNANCE_BUILDER_VERSION,
  COURSE_ROOT_DISPOSITION,
  LEGACY_FOUR_PREREQUISITE_PROJECTION_ID,
  LEGACY_FOUR_PREREQUISITE_PUBLICATION_ID,
  NO_RELATION_DISPOSITION,
  PENDING_REVIEW_DISPOSITION,
  PUBLISHED_EDGE_DISPOSITION,
  type ActTeachingFamilyCounts,
  type ActTeachingProjectionArtifacts,
  type ActTeachingProjectionReceipt,
  type ActTeachingPublishedEdge,
  type ActTeachingQualificationReceipt,
  type ActTeachingReviewPackManifest,
  type ActTeachingCandidate,
  type ActTeachingDecision,
  type ActTeachingFamilyDisposition,
  type ActTeachingScope,
} from './contracts';
import { assertContainmentSkeleton } from './families';
import { ActTeachingRelationError, projectionDigest } from './hash';
import { assertReviewPackPrivacy } from './review-pack';

export function familyCountsFor(
  scope: ActTeachingScope,
  dispositions: readonly ActTeachingFamilyDisposition[],
  edges: readonly ActTeachingPublishedEdge[],
): ActTeachingFamilyCounts[] {
  return ACT_TEACHING_FAMILIES.map((family) => {
    const rows = dispositions.filter((row) => row.family === family);
    return {
      family,
      memberCount: scope.memberIds.length,
      closedCount: rows.filter((row) => (
        row.kind === COURSE_ROOT_DISPOSITION
        || row.kind === NO_RELATION_DISPOSITION
        || row.kind === PUBLISHED_EDGE_DISPOSITION
      )).length,
      publishedEdgeCount: edges.filter((edge) => edge.family === family).length,
      pendingCount: rows.filter((row) => row.kind === PENDING_REVIEW_DISPOSITION).length,
      noRelationCount: rows.filter((row) => row.kind === NO_RELATION_DISPOSITION).length,
      courseRootCount: rows.filter((row) => row.kind === COURSE_ROOT_DISPOSITION).length,
    };
  });
}

export function publishActTeachingProjection(input: {
  scope: ActTeachingScope;
  dispositions: readonly ActTeachingFamilyDisposition[];
  edges: readonly ActTeachingPublishedEdge[];
  reviewPack: ActTeachingReviewPackManifest;
  qualification: ActTeachingQualificationReceipt;
  candidates: readonly ActTeachingCandidate[];
  decisions: readonly ActTeachingDecision[];
}): ActTeachingProjectionArtifacts {
  if (
    input.edges.some((edge) => (
      edge.edgeId.startsWith(LEGACY_FOUR_PREREQUISITE_PUBLICATION_ID)
      || edge.edgeId.startsWith(LEGACY_FOUR_PREREQUISITE_PROJECTION_ID)
    ))
  ) {
    throw new ActTeachingRelationError(
      'legacy-four-prerequisite-rejected',
      'unmatched four-prerequisite projection cannot enter the ACT relation layer',
    );
  }

  const publicationState = input.scope.memberIds.length === 0
    ? 'EMPTY' as const
    : 'PARTIAL' as const;
  if (publicationState === 'PARTIAL') {
    assertContainmentSkeleton({
      scope: input.scope,
      dispositions: input.dispositions,
      edges: input.edges,
    });
  }

  const familyCounts = familyCountsFor(input.scope, input.dispositions, input.edges);
  const pendingCount = familyCounts.reduce((sum, row) => sum + row.pendingCount, 0);
  const body: Omit<ActTeachingProjectionReceipt, 'projectionId' | 'projectionHash'> & {
    edgeIds: string[];
  } = {
    contract: ACT_TEACHING_PROJECTION_RECEIPT_CONTRACT,
    builderVersion: ACT_TEACHING_RELATION_GOVERNANCE_BUILDER_VERSION,
    publicationState,
    scopeHash: input.scope.scopeHash,
    courseId: input.scope.courseId,
    authority: input.scope.authority,
    catalog: input.scope.catalog,
    memberCount: input.scope.memberIds.length,
    familyCounts,
    publishedEdgeCount: input.edges.length,
    pendingCount,
    reviewPackHash: input.reviewPack.packHash,
    qualificationReceiptId: input.qualification.receiptId,
    pipelineVersion: input.qualification.pipelineVersion,
    edgeIds: input.edges.map((edge) => edge.edgeId).sort(),
  };
  const projectionHash = projectionDigest(body);
  const { edgeIds: _edgeIds, ...receiptBody } = body;
  const receipt: ActTeachingProjectionReceipt = {
    ...receiptBody,
    projectionId: `atr-${projectionHash}`,
    projectionHash,
  };
  const artifacts: ActTeachingProjectionArtifacts = {
    receipt,
    scope: input.scope,
    edges: [...input.edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId)),
    dispositions: [...input.dispositions].sort((a, b) => {
      const byId = a.canonicalId.localeCompare(b.canonicalId);
      return byId !== 0 ? byId : a.family.localeCompare(b.family);
    }),
    reviewPack: input.reviewPack,
    candidates: input.candidates,
    decisions: input.decisions,
    qualification: input.qualification,
  };
  assertReviewPackPrivacy({
    candidates: artifacts.candidates,
    decisions: artifacts.decisions,
    reviewPack: artifacts.reviewPack,
  });
  return artifacts;
}

export function runtimeEdgesOnly(
  artifacts: ActTeachingProjectionArtifacts,
): readonly ActTeachingPublishedEdge[] {
  return artifacts.edges;
}
