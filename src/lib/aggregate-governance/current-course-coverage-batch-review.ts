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

export const CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION =
  'current-course-coverage-stage-review/v1' as const;
export const CURRENT_COURSE_COVERAGE_BATCH_RECEIPT_SCHEMA_VERSION =
  'current-course-coverage-batch-receipt/v1' as const;
export const CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL =
  'git-head-and-production-authority-pre-publication-snapshot/v2' as const;
export const CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION =
  'current-course-coverage-production-boundary-attestation/v1' as const;
export const CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL =
  'git-head-and-production-authority-detached-post-publication-attestation/v1' as const;

const SHA256 = /^[a-f0-9]{64}$/u;
const ACTIVE_ROLES = new Set<CourseCoverageRole>([
  'formal_objective',
  'necessary_prerequisite',
  'explicit_extension',
]);

export type CourseCoverageReviewStage = 'PRIMARY' | 'CHALLENGER' | 'THIRD';
export type CourseCoverageStageConclusion = 'INCLUDE' | 'EXCLUDE' | 'DEFER';
export type CourseCoverageEvidenceSufficiency = 'SUFFICIENT' | 'INSUFFICIENT';

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
  rationale: string;
  decisionDigest: string;
}

export interface CurrentCourseCoverageStageReview {
  schemaVersion: typeof CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION;
  batchBinding: CurrentCourseCoverageBatchBinding;
  stage: CourseCoverageReviewStage;
  reviewer: {
    identity: string;
    provider: string;
    sessionId: string;
    promptVersion: string;
  };
  reviewInputDigest: string;
  decisions: CurrentCourseCoverageStageDecision[];
  documentDigest: string;
}

export interface CurrentCourseCoverageProductionBoundaryProof {
  verificationProtocol: typeof CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL;
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

export interface CurrentCourseCoverageProductionBoundaryAttestation {
  schemaVersion: typeof CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION;
  protocol: typeof CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL;
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

function assertCommit(value: string, field: string): void {
  if (!/^[a-f0-9]{40}$/u.test(value)) {
    throw new Error(`Current batch review rejected: ${field} must be a 40-hex Git revision`);
  }
}

function validateProductionBoundaryProof(
  proof: CurrentCourseCoverageProductionBoundaryProof,
): void {
  if (proof.verificationProtocol !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL) {
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
  attestation: Omit<CurrentCourseCoverageProductionBoundaryAttestation, 'attestationDigest'>,
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
  if (attestation.schemaVersion !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION
    || attestation.protocol !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL) {
    throw new Error('Current batch review rejected: production boundary attestation protocol mismatch');
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
  const withoutDocumentDigest = { ...document, decisions };
  return {
    ...withoutDocumentDigest,
    documentDigest: sha256Canonical(withoutDocumentDigest),
  };
}

function assertConclusion(
  decision: CurrentCourseCoverageStageDecision,
  item: CurrentCourseCoverageWorklistItem,
  field: string,
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
  const available = new Map(item.evidenceRefs.map((ref) => [ref.selector, ref]));
  const seen = new Set<string>();
  const citedEvidence = [];
  for (const selector of decision.evidenceSelectors) {
    const normalized = requiredString(selector, `${field}.evidenceSelectors`);
    const cited = available.get(normalized);
    if (!cited) throw new Error(`Current batch review rejected: ${field} cites unknown evidence`);
    if (seen.has(normalized)) throw new Error(`Current batch review rejected: ${field} repeats evidence selector`);
    seen.add(normalized);
    citedEvidence.push(cited);
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
}): Map<string, CurrentCourseCoverageStageDecision> {
  const { document, expectedStage, binding, batch, items, requiredIds } = input;
  const requiredSet = new Set(requiredIds);
  if (document.schemaVersion !== CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION) {
    throw new Error(`Current batch review rejected: ${expectedStage} schema mismatch`);
  }
  if (document.stage !== expectedStage) throw new Error(`Current batch review rejected: expected ${expectedStage} stage`);
  if (!sameBinding(binding, document.batchBinding)) throw new Error(`Current batch review rejected: ${expectedStage} binding drift`);
  const reviewer = document.reviewer;
  requiredString(reviewer.identity, `${expectedStage}.reviewer.identity`);
  requiredString(reviewer.provider, `${expectedStage}.reviewer.provider`);
  requiredString(reviewer.sessionId, `${expectedStage}.reviewer.sessionId`);
  requiredString(reviewer.promptVersion, `${expectedStage}.reviewer.promptVersion`);
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
    assertConclusion(decision, item, field);
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
}): CurrentCourseCoverageBatchReceipt {
  const {
    worklistDigest: storedWorklistDigest,
    worklistInputDigest: storedWorklistInputDigest,
    ...withoutWorklistDigests
  } = input.worklist;
  validateProductionBoundaryProof(input.productionBoundaryProof);
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
  const primary = validateStage({ document: input.primary, expectedStage: 'PRIMARY', binding, batch, items, requiredIds: allIds });
  const challenger = input.challenger
    ? validateStage({ document: input.challenger, expectedStage: 'CHALLENGER', binding, batch, items, requiredIds: riskIds })
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
    ? validateStage({ document: input.third, expectedStage: 'THIRD', binding, batch, items, requiredIds: conflictIds })
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
