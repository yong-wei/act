export const LEGACY_DOCUMENT_RUBRIC_SOURCE_TYPE = 'document_rubric_grading' as const;

export type LegacyDocumentGradingDisposition =
  | 'preserve-materialized'
  | 'map-to-snapshot'
  | 'map-to-historical-authority'
  | 'blocked-unparseable'
  | 'retained-governance';

export type LegacyDocumentGradingHistoricalRecord = {
  draftId: string;
  disposition: LegacyDocumentGradingDisposition;
  authorityKind: 'TeacherAssignmentApprovalSnapshot' | 'historical-read-only' | 'blocked';
  authorityId: string | null;
  factIds: string[];
  sourceEventIds: string[];
};

export function classifyLegacyDocumentGradingDraft(input: {
  draftId: string;
  sourceType: string;
  reviewerState?: string | null;
  approvalSnapshotId?: string | null;
  factIds?: string[];
  sourceEventIds?: string[];
}): LegacyDocumentGradingHistoricalRecord {
  if (input.sourceType !== LEGACY_DOCUMENT_RUBRIC_SOURCE_TYPE) {
    return {
      draftId: input.draftId,
      disposition: 'blocked-unparseable',
      authorityKind: 'blocked',
      authorityId: null,
      factIds: input.factIds ?? [],
      sourceEventIds: input.sourceEventIds ?? [],
    };
  }
  if (input.approvalSnapshotId) {
    return {
      draftId: input.draftId,
      disposition: 'map-to-snapshot',
      authorityKind: 'TeacherAssignmentApprovalSnapshot',
      authorityId: input.approvalSnapshotId,
      factIds: input.factIds ?? [],
      sourceEventIds: input.sourceEventIds ?? [],
    };
  }
  if ((input.factIds ?? []).length > 0) {
    return {
      draftId: input.draftId,
      disposition: 'preserve-materialized',
      authorityKind: 'historical-read-only',
      authorityId: input.draftId,
      factIds: input.factIds ?? [],
      sourceEventIds: input.sourceEventIds ?? [],
    };
  }
  if (input.reviewerState === 'approved') {
    return {
      draftId: input.draftId,
      disposition: 'map-to-historical-authority',
      authorityKind: 'historical-read-only',
      authorityId: input.draftId,
      factIds: [],
      sourceEventIds: input.sourceEventIds ?? [],
    };
  }
  return {
    draftId: input.draftId,
    disposition: 'retained-governance',
    authorityKind: 'blocked',
    authorityId: null,
    factIds: input.factIds ?? [],
    sourceEventIds: input.sourceEventIds ?? [],
  };
}

export function historicalAdapterMayWriteLearningFact(): false {
  return false;
}
