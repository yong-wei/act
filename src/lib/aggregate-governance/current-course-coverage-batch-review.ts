import {
  COURSE_COVERAGE_ROLES,
  type CourseCoverageRole,
} from './contracts';
import { sha256Canonical } from './hash';
import {
  assertBatchManifestClosure,
  computeCurrentWorklistDigest,
  computeCurrentWorklistInputDigest,
  type CurrentCourseCoverageWorklist,
  type CurrentCourseCoverageWorklistItem,
  type CurrentReviewBatch,
  type CurrentReviewBatchManifest,
} from './current-course-coverage-review';

export const CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION_V1 =
  'current-course-coverage-stage-review/v1' as const;
export const CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION =
  'current-course-coverage-stage-review/v2' as const;
export const CURRENT_COURSE_COVERAGE_BATCH_RECEIPT_SCHEMA_VERSION =
  'current-course-coverage-batch-receipt/v1' as const;
export const CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2 =
  'git-head-and-production-authority-pre-publication-snapshot/v2' as const;
export const CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL =
  'git-head-and-production-authority-pre-publication-snapshot/v3' as const;
export const CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION_V1 =
  'current-course-coverage-production-boundary-attestation/v1' as const;
export const CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION =
  'current-course-coverage-production-boundary-attestation/v2' as const;
export const CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL_V1 =
  'git-head-and-production-authority-detached-post-publication-attestation/v1' as const;
export const CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL =
  'git-head-and-production-authority-detached-post-publication-attestation/v2' as const;

const SHA256 = /^[a-f0-9]{64}$/u;
const ACTIVE_ROLES = new Set<CourseCoverageRole>([
  'formal_objective',
  'necessary_prerequisite',
  'explicit_extension',
]);

export type CourseCoverageReviewStage = 'PRIMARY' | 'CHALLENGER' | 'THIRD';
export type CourseCoverageStageConclusion = 'INCLUDE' | 'EXCLUDE' | 'DEFER';
export type CourseCoverageEvidenceSufficiency = 'SUFFICIENT' | 'INSUFFICIENT';

export interface CurrentCourseCoverageStageSourceBinding {
  artifactPath: string;
  artifactSha256: string;
  schemaVersion: string;
  stage: CourseCoverageReviewStage;
  writerSessionId: string;
}

export interface CurrentCourseCoverageBatchBinding {
  batchId: string;
  manifestBatchIndex: number;
  sequence: number;
  semanticGroupKey: string;
  memberCount: number;
  memberDigest: string;
  worklistInputDigest: string;
  worklistDigest: string;
  manifestDigest: string;
  manifestArtifactSha256: string;
}

export interface CurrentCourseCoverageStageDecision {
  canonicalId: string;
  canonicalRevision: string;
  conclusion: CourseCoverageStageConclusion;
  role?: CourseCoverageRole;
  evidenceSufficiency: CourseCoverageEvidenceSufficiency;
  evidenceSelectors: string[];
  /** Exact frozen evidence identities for selectors that are not unique. */
  evidenceIds?: string[];
  rationale: string;
  decisionDigest: string;
}

export interface CurrentCourseCoverageProtectedPathSnapshot {
  relativePath: string;
  workingTreeDigest: string;
  headDigest: string;
}

export interface CurrentCourseCoverageStageReview {
  schemaVersion:
    | typeof CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION_V1
    | typeof CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION;
  batchBinding: CurrentCourseCoverageBatchBinding;
  stage: CourseCoverageReviewStage;
  reviewer: {
    identity: string;
    provider: string;
    sessionId: string;
    promptVersion: string;
  };
  sourceArtifactBinding: CurrentCourseCoverageStageSourceBinding;
  reviewInputDigest: string;
  decisions: CurrentCourseCoverageStageDecision[];
  documentDigest: string;
}

interface CurrentCourseCoverageProductionBoundaryProofBase {
  receiptPath: string;
  attestationPath: string;
  headBefore: string;
  protectedPaths: string[];
  statusBefore: string[];
  authoritySnapshotBeforeDigest: string;
  gitDiffCheck: 'PASS';
  mutationFlags: {
    currentCoverageDecisionWritten: false;
    productionSelectorChanged: false;
    graphRagSelectorChanged: false;
    writerFenceChanged: false;
  };
}

export interface CurrentCourseCoverageProductionBoundaryProofV2
  extends CurrentCourseCoverageProductionBoundaryProofBase {
  verificationProtocol: typeof CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2;
}

export interface CurrentCourseCoverageProductionBoundaryProofV3
  extends CurrentCourseCoverageProductionBoundaryProofBase {
  verificationProtocol: typeof CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL;
  protectedPathSnapshots: CurrentCourseCoverageProtectedPathSnapshot[];
}

export type CurrentCourseCoverageProductionBoundaryProof =
  | CurrentCourseCoverageProductionBoundaryProofV2
  | CurrentCourseCoverageProductionBoundaryProofV3;

interface CurrentCourseCoverageProductionBoundaryAttestationBase {
  receiptPath: string;
  attestationPath: string;
  receiptDigest: string;
  batchId: string;
  headBefore: string;
  headAfter: string;
  protectedPaths: string[];
  statusBefore: string[];
  statusAfter: string[];
  authoritySnapshotBeforeDigest: string;
  authoritySnapshotAfterDigest: string;
  gitDiffCheck: 'PASS';
  attestationDigest: string;
}

export interface CurrentCourseCoverageProductionBoundaryAttestationV1
  extends CurrentCourseCoverageProductionBoundaryAttestationBase {
  schemaVersion: typeof CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION_V1;
  protocol: typeof CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL_V1;
}

export interface CurrentCourseCoverageProductionBoundaryAttestationV2
  extends CurrentCourseCoverageProductionBoundaryAttestationBase {
  schemaVersion: typeof CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION;
  protocol: typeof CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL;
  protectedPathSnapshotsBefore: CurrentCourseCoverageProtectedPathSnapshot[];
  protectedPathSnapshotsAfter: CurrentCourseCoverageProtectedPathSnapshot[];
}

export type CurrentCourseCoverageProductionBoundaryAttestation =
  | CurrentCourseCoverageProductionBoundaryAttestationV1
  | CurrentCourseCoverageProductionBoundaryAttestationV2;

type CurrentCourseCoverageProductionBoundaryAttestationWithoutDigest =
  | Omit<CurrentCourseCoverageProductionBoundaryAttestationV1, 'attestationDigest'>
  | Omit<CurrentCourseCoverageProductionBoundaryAttestationV2, 'attestationDigest'>;

export type CurrentCourseCoverageReceiptStageRecord = CurrentCourseCoverageStageReview;

export interface CurrentCourseCoverageBatchReceipt {
  schemaVersion: typeof CURRENT_COURSE_COVERAGE_BATCH_RECEIPT_SCHEMA_VERSION;
  protocol: 'current-course-coverage-batch-review/1';
  status: 'PASS' | 'DEFERRED_EVIDENCE_BLOCKED';
  batchBinding: CurrentCourseCoverageBatchBinding;
  orderedMembers: Array<{ canonicalId: string; canonicalRevision: string }>;
  stageDocuments: {
    primaryDigest: string;
    challengerDigest: string | null;
    thirdDigest: string | null;
  };
  stageRecords: {
    primary: CurrentCourseCoverageReceiptStageRecord;
    challenger: CurrentCourseCoverageReceiptStageRecord | null;
    third: CurrentCourseCoverageReceiptStageRecord | null;
  };
  terminalMembers: Array<{
    canonicalId: string;
    canonicalRevision: string;
    conclusion: CourseCoverageStageConclusion;
    role: CourseCoverageRole | null;
    evidenceSufficiency: CourseCoverageEvidenceSufficiency;
    terminalSource: 'PRIMARY' | 'CONSENSUS' | 'THIRD';
    stageDecisionDigests: string[];
    coverageAuthorityState: 'REVIEWED_NOT_CURRENT' | 'UNRESOLVED_BLOCKING';
  }>;
  counts: {
    members: number;
    included: number;
    excluded: number;
    deferredEvidenceBlocked: number;
    conflicts: number;
    thirdReviewed: number;
  };
  aggregateCoverageGate: 'BLOCKED_PENDING_ALL_BATCHES' | 'BLOCKED_UNRESOLVED_EVIDENCE';
  productionBoundaries: {
    currentCoverageDecisionWritten: false;
    productionSelectorChanged: false;
    graphRagSelectorChanged: false;
    writerFenceChanged: false;
  };
  productionBoundaryProof: CurrentCourseCoverageProductionBoundaryProof;
  receiptDigest: string;
}

type StageReviewWithoutDigest = Omit<CurrentCourseCoverageStageReview, 'documentDigest' | 'decisions'> & {
  decisions: Array<Omit<CurrentCourseCoverageStageDecision, 'decisionDigest'>>;
};

function requiredString(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`Current batch review rejected: ${field} is required`);
  return normalized;
}

function assertSha(value: string, field: string): void {
  if (!SHA256.test(value)) throw new Error(`Current batch review rejected: ${field} must be a SHA-256`);
}

function validateProtectedPathSnapshots(
  rows: unknown,
  protectedPaths: readonly string[],
  field: string,
): asserts rows is CurrentCourseCoverageProtectedPathSnapshot[] {
  if (!Array.isArray(rows) || rows.length !== protectedPaths.length) {
    throw new Error(`Current batch review rejected: ${field} must cover every protected authority path`);
  }
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`Current batch review rejected: ${field}[${index}] is invalid`);
    }
    const snapshot = row as Record<string, unknown>;
    const relativePath = requiredString(snapshot.relativePath, `${field}[${index}].relativePath`);
    if (relativePath !== protectedPaths[index] || seen.has(relativePath)) {
      throw new Error(`Current batch review rejected: ${field} path set drift`);
    }
    seen.add(relativePath);
    const workingTreeDigest = requiredString(
      snapshot.workingTreeDigest,
      `${field}[${index}].workingTreeDigest`,
    );
    const headDigest = requiredString(snapshot.headDigest, `${field}[${index}].headDigest`);
    assertSha(workingTreeDigest, `${field}[${index}].workingTreeDigest`);
    assertSha(headDigest, `${field}[${index}].headDigest`);
    if (workingTreeDigest !== headDigest) {
      throw new Error(`Current batch review rejected: ${field}[${index}] differs between working tree and capture HEAD`);
    }
  });
}

function assertSnapshotDigest(input: {
  head: string;
  rows: readonly CurrentCourseCoverageProtectedPathSnapshot[];
  digest: string;
  field: string;
}): void {
  if (sha256Canonical({ head: input.head, rows: input.rows }) !== input.digest) {
    throw new Error(`Current batch review rejected: ${input.field} digest mismatch`);
  }
}

function assertCommit(value: string, field: string): void {
  if (!/^[a-f0-9]{40}$/u.test(value)) {
    throw new Error(`Current batch review rejected: ${field} must be a 40-hex Git revision`);
  }
}

function validateProductionBoundaryProof(
  proof: CurrentCourseCoverageProductionBoundaryProof,
): void {
  if (proof.verificationProtocol !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL
    && proof.verificationProtocol !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2) {
    throw new Error('Current batch review rejected: production boundary verification protocol mismatch');
  }
  requiredString(proof.receiptPath, 'productionBoundaryProof.receiptPath');
  requiredString(proof.attestationPath, 'productionBoundaryProof.attestationPath');
  assertCommit(proof.headBefore, 'productionBoundaryProof.headBefore');
  if (!Array.isArray(proof.protectedPaths) || proof.protectedPaths.length === 0
    || proof.protectedPaths.some((value) => !requiredString(value, 'productionBoundaryProof.protectedPaths'))) {
    throw new Error('Current batch review rejected: protected authority path snapshot is empty');
  }
  if (!Array.isArray(proof.statusBefore) || proof.statusBefore.length > 0) {
    throw new Error('Current batch review rejected: production authority paths are dirty');
  }
  assertSha(proof.authoritySnapshotBeforeDigest, 'productionBoundaryProof.authoritySnapshotBeforeDigest');
  if (proof.gitDiffCheck !== 'PASS') {
    throw new Error('Current batch review rejected: production boundary git diff check failed');
  }
  if (proof.verificationProtocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL) {
    validateProtectedPathSnapshots(
      proof.protectedPathSnapshots,
      proof.protectedPaths,
      'productionBoundaryProof.protectedPathSnapshots',
    );
    assertSnapshotDigest({
      head: proof.headBefore,
      rows: proof.protectedPathSnapshots,
      digest: proof.authoritySnapshotBeforeDigest,
      field: 'productionBoundaryProof.authoritySnapshotBeforeDigest',
    });
  }
  const flags = proof.mutationFlags;
  if (!flags || flags.currentCoverageDecisionWritten || flags.productionSelectorChanged
    || flags.graphRagSelectorChanged || flags.writerFenceChanged) {
    throw new Error('Current batch review rejected: production authority mutation evidence is not clean');
  }
}

function assertAttestationDigest(
  attestation: CurrentCourseCoverageProductionBoundaryAttestation,
): void {
  const { attestationDigest, ...withoutDigest } = attestation;
  assertSha(attestationDigest, 'productionBoundaryAttestation.attestationDigest');
  if (attestationDigest !== sha256Canonical(withoutDigest)) {
    throw new Error('Current batch review rejected: production boundary attestation digest mismatch');
  }
}

export function sealCurrentCourseCoverageProductionBoundaryAttestation(
  attestation: CurrentCourseCoverageProductionBoundaryAttestationWithoutDigest,
): CurrentCourseCoverageProductionBoundaryAttestation {
  return { ...attestation, attestationDigest: sha256Canonical(attestation) };
}

export function assertCurrentCourseCoverageProductionBoundaryBundle(input: {
  receipt: CurrentCourseCoverageBatchReceipt;
  attestation: CurrentCourseCoverageProductionBoundaryAttestation;
  receiptPath: string;
  attestationPath: string;
}): void {
  const { receipt, attestation } = input;
  const { receiptDigest, ...withoutReceiptDigest } = receipt;
  assertSha(receiptDigest, 'receiptDigest');
  if (receiptDigest !== sha256Canonical(withoutReceiptDigest)) {
    throw new Error('Current batch review rejected: receipt digest mismatch');
  }
  const proof = receipt.productionBoundaryProof;
  validateProductionBoundaryProof(proof);
  if (proof.receiptPath !== input.receiptPath || proof.attestationPath !== input.attestationPath) {
    throw new Error('Current batch review rejected: receipt/attestation path binding mismatch');
  }
  const isLegacyAttestation = attestation.schemaVersion === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION_V1
    && attestation.protocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL_V1;
  const isCurrentAttestation = attestation.schemaVersion === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION
    && attestation.protocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL;
  if (!isLegacyAttestation && !isCurrentAttestation) {
    throw new Error('Current batch review rejected: production boundary attestation protocol mismatch');
  }
  const isCurrentProof = proof.verificationProtocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL;
  if (isCurrentProof !== isCurrentAttestation) {
    throw new Error('Current batch review rejected: production boundary proof/attestation version mismatch');
  }
  if (attestation.receiptPath !== input.receiptPath || attestation.attestationPath !== input.attestationPath) {
    throw new Error('Current batch review rejected: attestation path binding mismatch');
  }
  if (attestation.receiptDigest !== receiptDigest || attestation.batchId !== receipt.batchBinding.batchId) {
    throw new Error('Current batch review rejected: attestation receipt identity mismatch');
  }
  if (attestation.headBefore !== proof.headBefore
    || attestation.authoritySnapshotBeforeDigest !== proof.authoritySnapshotBeforeDigest
    || sha256Canonical(attestation.protectedPaths) !== sha256Canonical(proof.protectedPaths)
    || sha256Canonical(attestation.statusBefore) !== sha256Canonical(proof.statusBefore)) {
    throw new Error('Current batch review rejected: attestation pre-publication snapshot mismatch');
  }
  assertCommit(attestation.headAfter, 'productionBoundaryAttestation.headAfter');
  assertSha(attestation.authoritySnapshotAfterDigest, 'productionBoundaryAttestation.authoritySnapshotAfterDigest');
  if (attestation.headAfter !== attestation.headBefore
    || attestation.authoritySnapshotAfterDigest !== attestation.authoritySnapshotBeforeDigest) {
    throw new Error('Current batch review rejected: production authority drifted across receipt publication');
  }
  if (isCurrentAttestation) {
    validateProtectedPathSnapshots(
      attestation.protectedPathSnapshotsBefore,
      proof.protectedPaths,
      'productionBoundaryAttestation.protectedPathSnapshotsBefore',
    );
    validateProtectedPathSnapshots(
      attestation.protectedPathSnapshotsAfter,
      proof.protectedPaths,
      'productionBoundaryAttestation.protectedPathSnapshotsAfter',
    );
    if (proof.verificationProtocol !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL
      || sha256Canonical(attestation.protectedPathSnapshotsBefore)
        !== sha256Canonical(proof.protectedPathSnapshots)) {
      throw new Error('Current batch review rejected: production boundary path snapshot mismatch');
    }
    if (sha256Canonical(attestation.protectedPathSnapshotsAfter)
      !== sha256Canonical(attestation.protectedPathSnapshotsBefore)) {
      throw new Error('Current batch review rejected: production boundary path snapshot drifted');
    }
    assertSnapshotDigest({
      head: attestation.headBefore,
      rows: attestation.protectedPathSnapshotsBefore,
      digest: attestation.authoritySnapshotBeforeDigest,
      field: 'productionBoundaryAttestation.authoritySnapshotBeforeDigest',
    });
    assertSnapshotDigest({
      head: attestation.headAfter,
      rows: attestation.protectedPathSnapshotsAfter,
      digest: attestation.authoritySnapshotAfterDigest,
      field: 'productionBoundaryAttestation.authoritySnapshotAfterDigest',
    });
  }
  if (!Array.isArray(attestation.statusBefore) || !Array.isArray(attestation.statusAfter)) {
    throw new Error('Current batch review rejected: attestation status snapshots are invalid');
  }
  if (attestation.statusBefore.length > 0 || attestation.statusAfter.length > 0) {
    throw new Error('Current batch review rejected: attestation records dirty production authority paths');
  }
  if (attestation.gitDiffCheck !== 'PASS') {
    throw new Error('Current batch review rejected: attestation git diff check failed');
  }
  assertAttestationDigest(attestation);
}

function sameBinding(
  expected: CurrentCourseCoverageBatchBinding,
  observed: CurrentCourseCoverageBatchBinding,
): boolean {
  return sha256Canonical(expected) === sha256Canonical(observed);
}

function bindingFor(
  manifest: CurrentReviewBatchManifest,
  batch: CurrentReviewBatch,
  manifestBatchIndex: number,
  manifestArtifactSha256: string,
): CurrentCourseCoverageBatchBinding {
  return {
    batchId: batch.batchId,
    manifestBatchIndex,
    sequence: batch.sequence,
    semanticGroupKey: batch.semanticGroupKey,
    memberCount: batch.members.length,
    memberDigest: batch.memberDigest,
    worklistInputDigest: batch.worklistInputDigest,
    worklistDigest: batch.worklistDigest,
    manifestDigest: manifest.manifestDigest,
    manifestArtifactSha256,
  };
}

function stageInputDigest(input: {
  binding: CurrentCourseCoverageBatchBinding;
  stage: CourseCoverageReviewStage;
  promptVersion: string;
  batch: CurrentReviewBatch;
  items: ReadonlyMap<string, CurrentCourseCoverageWorklistItem>;
}): string {
  return sha256Canonical({
    batchBinding: input.binding,
    stage: input.stage,
    promptVersion: input.promptVersion,
    members: input.batch.members.map((member) => {
      const item = input.items.get(member.canonicalId)!;
      return {
        canonicalId: member.canonicalId,
        canonicalRevision: member.canonicalRevision,
        evidenceDigest: item.evidenceDigest,
        riskFlags: item.riskFlags,
      };
    }),
  });
}

function decisionDigest(input: {
  stage: CourseCoverageReviewStage;
  reviewer: CurrentCourseCoverageStageReview['reviewer'];
  reviewInputDigest: string;
  decision: Omit<CurrentCourseCoverageStageDecision, 'decisionDigest'>;
}): string {
  return sha256Canonical(input);
}

export function sealCurrentCourseCoverageStageReview(
  document: StageReviewWithoutDigest,
): CurrentCourseCoverageStageReview {
  const decisions = document.decisions.map((decision) => ({
    ...decision,
    decisionDigest: decisionDigest({
      stage: document.stage,
      reviewer: document.reviewer,
      reviewInputDigest: document.reviewInputDigest,
      decision,
    }),
  }));
  const withoutDocumentDigest = {
    ...document,
    schemaVersion: CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION,
    decisions,
  };
  return {
    ...withoutDocumentDigest,
    documentDigest: sha256Canonical(withoutDocumentDigest),
  };
}

function assertConclusion(
  decision: CurrentCourseCoverageStageDecision,
  item: CurrentCourseCoverageWorklistItem,
  field: string,
  schemaVersion: CurrentCourseCoverageStageReview['schemaVersion'],
): void {
  if (!['INCLUDE', 'EXCLUDE', 'DEFER'].includes(decision.conclusion)) {
    throw new Error(`Current batch review rejected: ${field}.conclusion is invalid`);
  }
  if (!['SUFFICIENT', 'INSUFFICIENT'].includes(decision.evidenceSufficiency)) {
    throw new Error(`Current batch review rejected: ${field}.evidenceSufficiency is invalid`);
  }
  if (!Array.isArray(decision.evidenceSelectors) || decision.evidenceSelectors.length === 0) {
    throw new Error(`Current batch review rejected: ${field}.evidenceSelectors must be non-empty`);
  }
  const byEvidenceId = new Map(item.evidenceRefs.map((ref) => [ref.evidenceId, ref]));
  // Only v1 stage records receive the historical deterministic last-wins
  // selector lookup. Current v2 records must disambiguate frozen references
  // with evidenceIds when a selector is not unique.
  const legacyBySelector = schemaVersion === CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION_V1
    ? new Map(item.evidenceRefs.map((ref) => [ref.selector, ref]))
    : undefined;
  const citedEvidence = [];
  if (decision.evidenceIds !== undefined) {
    const evidenceIds = decision.evidenceIds;
    if (!Array.isArray(evidenceIds) || evidenceIds.length !== decision.evidenceSelectors.length) {
      throw new Error(`Current batch review rejected: ${field}.evidenceIds must align with evidenceSelectors`);
    }
    const seenIds = new Set<string>();
    decision.evidenceSelectors.forEach((selector, index) => {
      const normalizedSelector = requiredString(selector, `${field}.evidenceSelectors`);
      const evidenceId = requiredString(evidenceIds[index], `${field}.evidenceIds`);
      const cited = byEvidenceId.get(evidenceId);
      if (!cited) throw new Error(`Current batch review rejected: ${field} cites unknown evidence identity`);
      if (seenIds.has(evidenceId)) {
        throw new Error(`Current batch review rejected: ${field} repeats evidence identity`);
      }
      if (cited.selector !== normalizedSelector) {
        throw new Error(`Current batch review rejected: ${field} evidence identity/selector mismatch`);
      }
      seenIds.add(evidenceId);
      citedEvidence.push(cited);
    });
  } else {
    const seenSelectors = new Set<string>();
    for (const selector of decision.evidenceSelectors) {
      const normalized = requiredString(selector, `${field}.evidenceSelectors`);
      if (seenSelectors.has(normalized)) throw new Error(`Current batch review rejected: ${field} repeats evidence selector`);
      seenSelectors.add(normalized);
      let cited = legacyBySelector?.get(normalized);
      if (!legacyBySelector) {
        const matches = item.evidenceRefs.filter((ref) => ref.selector === normalized);
        if (matches.length > 1) {
          throw new Error(`Current batch review rejected: ${field} evidence selector is ambiguous; evidenceIds are required`);
        }
        cited = matches[0];
      }
      if (!cited) throw new Error(`Current batch review rejected: ${field} cites unknown evidence`);
      citedEvidence.push(cited);
    }
  }
  requiredString(decision.rationale, `${field}.rationale`);
  if (decision.conclusion === 'INCLUDE') {
    if (!decision.role || !ACTIVE_ROLES.has(decision.role)) {
      throw new Error(`Current batch review rejected: ${field} INCLUDE requires an active role`);
    }
    if (decision.evidenceSufficiency !== 'SUFFICIENT') {
      throw new Error(`Current batch review rejected: ${field} INCLUDE requires sufficient evidence`);
    }
  } else if (decision.conclusion === 'EXCLUDE') {
    if (decision.role !== 'excluded_with_rationale' || decision.evidenceSufficiency !== 'SUFFICIENT') {
      throw new Error(`Current batch review rejected: ${field} EXCLUDE requires excluded_with_rationale and sufficient evidence`);
    }
  } else if (decision.role !== undefined || decision.evidenceSufficiency !== 'INSUFFICIENT') {
    throw new Error(`Current batch review rejected: ${field} DEFER must remain role-free and evidence-insufficient`);
  }
  if (decision.conclusion !== 'DEFER'
    && !citedEvidence.some((ref) => ref.boundary === 'independent-course')) {
    throw new Error(`Current batch review rejected: ${field} must cite independent course evidence for a role decision`);
  }
  if (decision.role && !(COURSE_COVERAGE_ROLES as readonly string[]).includes(decision.role)) {
    throw new Error(`Current batch review rejected: ${field}.role is invalid`);
  }
}

function validateStage(input: {
  document: CurrentCourseCoverageStageReview;
  expectedStage: CourseCoverageReviewStage;
  binding: CurrentCourseCoverageBatchBinding;
  batch: CurrentReviewBatch;
  items: ReadonlyMap<string, CurrentCourseCoverageWorklistItem>;
  requiredIds: readonly string[];
  allowLegacySourceArtifactBinding?: boolean;
  allowLegacyStageSchema?: boolean;
}): Map<string, CurrentCourseCoverageStageDecision> {
  const {
    document,
    expectedStage,
    binding,
    batch,
    items,
    requiredIds,
    allowLegacySourceArtifactBinding = false,
    allowLegacyStageSchema = false,
  } = input;
  const requiredSet = new Set(requiredIds);
  const isCurrentStageSchema = document.schemaVersion === CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION;
  const isLegacyStageSchema = document.schemaVersion === CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION_V1;
  if (!isCurrentStageSchema && !isLegacyStageSchema) {
    throw new Error(`Current batch review rejected: ${expectedStage} schema mismatch`);
  }
  if (isLegacyStageSchema && !allowLegacyStageSchema) {
    throw new Error(`Current batch review rejected: ${expectedStage} legacy stage schema requires replay compatibility`);
  }
  if (document.stage !== expectedStage) throw new Error(`Current batch review rejected: expected ${expectedStage} stage`);
  if (!sameBinding(binding, document.batchBinding)) throw new Error(`Current batch review rejected: ${expectedStage} binding drift`);
  const reviewer = document.reviewer;
  requiredString(reviewer.identity, `${expectedStage}.reviewer.identity`);
  requiredString(reviewer.provider, `${expectedStage}.reviewer.provider`);
  requiredString(reviewer.sessionId, `${expectedStage}.reviewer.sessionId`);
  requiredString(reviewer.promptVersion, `${expectedStage}.reviewer.promptVersion`);
  const sourceBinding = document.sourceArtifactBinding;
  if (!sourceBinding && !allowLegacySourceArtifactBinding) {
    throw new Error(`Current batch review rejected: ${expectedStage} source artifact binding is required`);
  }
  if (sourceBinding) {
    requiredString(sourceBinding.artifactPath, `${expectedStage}.sourceArtifactBinding.artifactPath`);
    assertSha(sourceBinding.artifactSha256, `${expectedStage}.sourceArtifactBinding.artifactSha256`);
    requiredString(sourceBinding.schemaVersion, `${expectedStage}.sourceArtifactBinding.schemaVersion`);
    if (sourceBinding.stage !== expectedStage) {
      throw new Error(`Current batch review rejected: ${expectedStage} source artifact stage mismatch`);
    }
    if (sourceBinding.writerSessionId !== reviewer.sessionId) {
      throw new Error(`Current batch review rejected: ${expectedStage} source writer/session mismatch`);
    }
  }
  const expectedInputDigest = stageInputDigest({
    binding,
    stage: expectedStage,
    promptVersion: reviewer.promptVersion,
    batch,
    items,
  });
  if (document.reviewInputDigest !== expectedInputDigest) {
    throw new Error(`Current batch review rejected: ${expectedStage} input digest mismatch`);
  }
  const byId = new Map<string, CurrentCourseCoverageStageDecision>();
  for (const [index, decision] of document.decisions.entries()) {
    const field = `${expectedStage}.decisions[${index}]`;
    if (byId.has(decision.canonicalId)) throw new Error(`Current batch review rejected: duplicate ${expectedStage} member`);
    const item = items.get(decision.canonicalId);
    if (!item) throw new Error(`Current batch review rejected: ${expectedStage} contains out-of-slice member`);
    if (decision.canonicalRevision !== item.canonicalRevision) {
      throw new Error(`Current batch review rejected: ${expectedStage} canonical revision drift`);
    }
    assertConclusion(decision, item, field, document.schemaVersion);
    const { decisionDigest: storedDecisionDigest, ...withoutDecisionDigest } = decision;
    assertSha(storedDecisionDigest, `${field}.decisionDigest`);
    if (storedDecisionDigest !== decisionDigest({
      stage: expectedStage,
      reviewer,
      reviewInputDigest: document.reviewInputDigest,
      decision: withoutDecisionDigest,
    })) throw new Error(`Current batch review rejected: ${field}.decisionDigest mismatch`);
    byId.set(decision.canonicalId, decision);
  }
  if (document.decisions.length !== requiredIds.length
    || document.decisions.some((decision, index) => decision.canonicalId !== requiredIds[index])) {
    throw new Error(`Current batch review rejected: ${expectedStage} member order differs from the frozen slice`);
  }
  for (const id of requiredSet) {
    if (!byId.has(id)) throw new Error(`Current batch review rejected: ${expectedStage} omits required member ${id}`);
  }
  for (const id of byId.keys()) {
    if (!requiredSet.has(id)) throw new Error(`Current batch review rejected: ${expectedStage} contains unexpected member ${id}`);
  }
  const { documentDigest: storedDocumentDigest, ...withoutDocumentDigest } = document;
  assertSha(storedDocumentDigest, `${expectedStage}.documentDigest`);
  if (storedDocumentDigest !== sha256Canonical(withoutDocumentDigest)) {
    throw new Error(`Current batch review rejected: ${expectedStage} document digest mismatch`);
  }
  return byId;
}

function sameSemanticConclusion(
  first: CurrentCourseCoverageStageDecision,
  second: CurrentCourseCoverageStageDecision,
): boolean {
  return first.conclusion === second.conclusion
    && (first.role ?? null) === (second.role ?? null)
    && first.evidenceSufficiency === second.evidenceSufficiency;
}

export function buildCurrentCourseCoverageBatchReceipt(input: {
  worklist: CurrentCourseCoverageWorklist;
  manifest: CurrentReviewBatchManifest;
  expectedBinding: CurrentCourseCoverageBatchBinding;
  observedManifestArtifactSha256: string;
  primary: CurrentCourseCoverageStageReview;
  challenger?: CurrentCourseCoverageStageReview | null;
  third?: CurrentCourseCoverageStageReview | null;
  productionBoundaryProof: CurrentCourseCoverageProductionBoundaryProof;
  allowLegacySourceArtifactBinding?: boolean;
  allowLegacyStageSchema?: boolean;
}): CurrentCourseCoverageBatchReceipt {
  const {
    worklistDigest: storedWorklistDigest,
    worklistInputDigest: storedWorklistInputDigest,
    ...withoutWorklistDigests
  } = input.worklist;
  validateProductionBoundaryProof(input.productionBoundaryProof);
  const allowLegacySourceArtifactBinding = input.allowLegacySourceArtifactBinding === true
    && input.productionBoundaryProof.verificationProtocol
      === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2;
  const allowLegacyStageSchema = input.allowLegacyStageSchema === true;
  if (computeCurrentWorklistInputDigest(withoutWorklistDigests) !== storedWorklistInputDigest) {
    throw new Error('Current batch review rejected: worklist input digest mismatch');
  }
  if (input.worklist.items.some((item) => item.worklistInputDigest !== storedWorklistInputDigest)) {
    throw new Error('Current batch review rejected: item worklist input digest mismatch');
  }
  if (computeCurrentWorklistDigest({
    ...withoutWorklistDigests,
    worklistInputDigest: storedWorklistInputDigest,
  }) !== storedWorklistDigest) {
    throw new Error('Current batch review rejected: worklist digest mismatch');
  }
  assertBatchManifestClosure(input.worklist, input.manifest);
  assertSha(input.observedManifestArtifactSha256, 'observedManifestArtifactSha256');
  if (input.expectedBinding.manifestArtifactSha256 !== input.observedManifestArtifactSha256) {
    throw new Error(`Current batch review rejected: manifest artifact digest mismatch (${input.expectedBinding.manifestArtifactSha256} != ${input.observedManifestArtifactSha256})`);
  }
  const batch = input.manifest.batches[input.expectedBinding.manifestBatchIndex];
  if (!batch) throw new Error('Current batch review rejected: manifest batch index is missing');
  const binding = bindingFor(
    input.manifest,
    batch,
    input.expectedBinding.manifestBatchIndex,
    input.observedManifestArtifactSha256,
  );
  if (!sameBinding(input.expectedBinding, binding)) throw new Error('Current batch review rejected: expected batch binding drift');
  const allIds = batch.members.map((member) => member.canonicalId);
  const worklistItems = new Map(input.worklist.items.map((item) => [item.canonicalId, item]));
  const items = new Map(batch.members.map((member) => [member.canonicalId, worklistItems.get(member.canonicalId)!]));
  const riskIds = batch.members
    .filter((member) => member.profileOnly || member.riskFlags.new || member.riskFlags.changed || member.riskFlags.highRisk)
    .map((member) => member.canonicalId);
  const primary = validateStage({
    document: input.primary,
    expectedStage: 'PRIMARY',
    binding,
    batch,
    items,
    requiredIds: allIds,
    allowLegacySourceArtifactBinding,
    allowLegacyStageSchema,
  });
  const challenger = input.challenger
    ? validateStage({
      document: input.challenger,
      expectedStage: 'CHALLENGER',
      binding,
      batch,
      items,
      requiredIds: riskIds,
      allowLegacySourceArtifactBinding,
      allowLegacyStageSchema,
    })
    : new Map<string, CurrentCourseCoverageStageDecision>();
  if (riskIds.length > 0 && !input.challenger) throw new Error('Current batch review rejected: Challenger is required for risk members');
  if (input.challenger) {
    const sameIdentity = input.primary.reviewer.identity === input.challenger.reviewer.identity
      || input.primary.reviewer.sessionId === input.challenger.reviewer.sessionId;
    if (sameIdentity) throw new Error('Current batch review rejected: Primary and Challenger are not independent');
  }
  const conflictIds: string[] = [];
  for (const id of riskIds) {
    if (!sameSemanticConclusion(primary.get(id)!, challenger.get(id)!)) conflictIds.push(id);
  }
  const third = input.third
    ? validateStage({
      document: input.third,
      expectedStage: 'THIRD',
      binding,
      batch,
      items,
      requiredIds: conflictIds,
      allowLegacySourceArtifactBinding,
      allowLegacyStageSchema,
    })
    : new Map<string, CurrentCourseCoverageStageDecision>();
  if (conflictIds.length > 0 && !input.third) throw new Error('Current batch review rejected: Third is required for conflicts');
  if (conflictIds.length === 0 && input.third) throw new Error('Current batch review rejected: Third is forbidden without conflicts');
  if (input.third) {
    const identities = [input.primary.reviewer.identity, input.challenger?.reviewer.identity];
    const sessions = [input.primary.reviewer.sessionId, input.challenger?.reviewer.sessionId];
    if (identities.includes(input.third.reviewer.identity) || sessions.includes(input.third.reviewer.sessionId)) {
      throw new Error('Current batch review rejected: Third is not independent');
    }
  }
  const terminalMembers = batch.members.map((member) => {
    const primaryDecision = primary.get(member.canonicalId)!;
    const challengerDecision = challenger.get(member.canonicalId);
    const thirdDecision = third.get(member.canonicalId);
    const terminal = thirdDecision ?? primaryDecision;
    const terminalSource = thirdDecision ? 'THIRD' : challengerDecision ? 'CONSENSUS' : 'PRIMARY';
    const stageDecisionDigests = [primaryDecision.decisionDigest, challengerDecision?.decisionDigest, thirdDecision?.decisionDigest]
      .filter((value): value is string => Boolean(value));
    return {
      canonicalId: member.canonicalId,
      canonicalRevision: member.canonicalRevision,
      conclusion: terminal.conclusion,
      role: terminal.role ?? null,
      evidenceSufficiency: terminal.evidenceSufficiency,
      terminalSource,
      stageDecisionDigests,
      coverageAuthorityState: terminal.conclusion === 'DEFER' ? 'UNRESOLVED_BLOCKING' : 'REVIEWED_NOT_CURRENT',
    } as const;
  });
  const deferred = terminalMembers.filter((member) => member.conclusion === 'DEFER').length;
  const withoutReceiptDigest = {
    schemaVersion: CURRENT_COURSE_COVERAGE_BATCH_RECEIPT_SCHEMA_VERSION,
    protocol: 'current-course-coverage-batch-review/1' as const,
    status: deferred > 0 ? 'DEFERRED_EVIDENCE_BLOCKED' as const : 'PASS' as const,
    batchBinding: binding,
    orderedMembers: batch.members.map(({ canonicalId, canonicalRevision }) => ({ canonicalId, canonicalRevision })),
    stageDocuments: {
      primaryDigest: input.primary.documentDigest,
      challengerDigest: input.challenger?.documentDigest ?? null,
      thirdDigest: input.third?.documentDigest ?? null,
    },
    stageRecords: {
      primary: structuredClone(input.primary),
      challenger: input.challenger ? structuredClone(input.challenger) : null,
      third: input.third ? structuredClone(input.third) : null,
    },
    terminalMembers,
    counts: {
      members: terminalMembers.length,
      included: terminalMembers.filter((member) => member.conclusion === 'INCLUDE').length,
      excluded: terminalMembers.filter((member) => member.conclusion === 'EXCLUDE').length,
      deferredEvidenceBlocked: deferred,
      conflicts: conflictIds.length,
      thirdReviewed: third.size,
    },
    aggregateCoverageGate: deferred > 0
      ? 'BLOCKED_UNRESOLVED_EVIDENCE' as const
      : 'BLOCKED_PENDING_ALL_BATCHES' as const,
    productionBoundaries: input.productionBoundaryProof.mutationFlags,
    productionBoundaryProof: structuredClone(input.productionBoundaryProof),
  };
  return { ...withoutReceiptDigest, receiptDigest: sha256Canonical(withoutReceiptDigest) };
}

export function currentCourseCoverageStageInputDigest(input: {
  worklist: CurrentCourseCoverageWorklist;
  manifest: CurrentReviewBatchManifest;
  binding: CurrentCourseCoverageBatchBinding;
  stage: CourseCoverageReviewStage;
  promptVersion: string;
}): string {
  assertBatchManifestClosure(input.worklist, input.manifest);
  const batch = input.manifest.batches[input.binding.manifestBatchIndex];
  if (!batch) throw new Error('Current batch review rejected: manifest batch index is missing');
  const items = new Map(input.worklist.items.map((item) => [item.canonicalId, item]));
  return stageInputDigest({ binding: input.binding, stage: input.stage, promptVersion: input.promptVersion, batch, items });
}
