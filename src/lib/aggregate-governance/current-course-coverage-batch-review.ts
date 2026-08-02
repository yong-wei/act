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
  rationale: string;
  decisionDigest: string;
}

export interface CurrentCourseCoverageProtectedPathSnapshot {
  relativePath: string;
  workingTreeDigest: string;
  headDigest: string;
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
  sourceArtifactBinding: CurrentCourseCoverageStageSourceBinding;
  reviewInputDigest: string;
  decisions: CurrentCourseCoverageStageDecision[];
  documentDigest: string;
}

export interface CurrentCourseCoverageReviewProvenanceStageAudit {
  stage: CourseCoverageReviewStage;
  provider: string;
  sessionId: string;
  reviewSessionId: string;
  reviewSessionScope: string;
  sourceWriterSessionId: string;
  sourceWriterScope: string;
  sourceArtifactPath: string;
  sourceArtifactSha256: string;
  normalizedStageArtifactPath: string;
  normalizedDocumentDigest: string;
  didNotReadPrimaryArtifact?: boolean;
  sessionAuditPrimaryPathMentions?: number;
  didNotReadChallengerArtifact?: boolean;
  sessionAuditChallengerPathMentions?: number;
}

export interface CurrentCourseCoverageReviewProvenanceIndependenceAudit {
  protocol: {
    primaryCouldReadChallengerArtifact: false;
    challengerCouldReadPrimaryArtifact: false;
    normalizedStageArtifactsExistedDuringReviews?: false;
    sourceArtifactsCreatedByIndependentWriters: true;
    sourceArtifactsBoundToNormalizedReviews: true;
    semanticConclusionsGeneratedByAssembler: false;
  };
  primary: CurrentCourseCoverageReviewProvenanceStageAudit;
  challenger: CurrentCourseCoverageReviewProvenanceStageAudit | null;
  third: CurrentCourseCoverageReviewProvenanceStageAudit | null;
}

export interface CurrentCourseCoverageReviewProvenanceBinding {
  provenancePath: string;
  provenanceSha256: string;
  independenceAudit: CurrentCourseCoverageReviewProvenanceIndependenceAudit;
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
  reviewProvenanceBinding?: CurrentCourseCoverageReviewProvenanceBinding;
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

type UnknownRecord = Record<string, unknown>;

function provenanceObject(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Current batch review rejected: ${field} is invalid`);
  }
  return value as UnknownRecord;
}

function provenanceRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Current batch review rejected: ${field} is required`);
  }
  return value.trim();
}

function provenanceRequiredBoolean(value: unknown, field: string, expected: boolean): boolean {
  if (value !== expected) {
    throw new Error(`Current batch review rejected: ${field} must be ${String(expected)}`);
  }
  return expected;
}

function provenanceOptionalBoolean(
  record: UnknownRecord,
  field: string,
): boolean | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, field)) return undefined;
  if (typeof record[field] !== 'boolean') {
    throw new Error(`Current batch review rejected: ${field} must be boolean`);
  }
  return record[field] as boolean;
}

function provenanceOptionalCount(
  record: UnknownRecord,
  field: string,
): number | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, field)) return undefined;
  const value = record[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Current batch review rejected: ${field} must be a non-negative integer`);
  }
  return value;
}

function assertRepoRelativeProvenancePath(value: string, field: string): string {
  const normalized = value.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (!normalized || normalized.startsWith('/') || parts.includes('..') || parts.includes('.')) {
    throw new Error(`Current batch review rejected: ${field} must be repository-relative`);
  }
  return normalized;
}

function pathBasename(value: string): string {
  return value.replaceAll('\\', '/').split('/').at(-1) ?? '';
}

function provenanceStageRecord(
  provenance: UnknownRecord,
  stage: CourseCoverageReviewStage,
  required: boolean,
): UnknownRecord | null {
  const field = stage.toLowerCase();
  const value = provenance[field];
  if (value === null || value === undefined) {
    if (required) throw new Error(`Current batch review rejected: provenance.${field} is required`);
    return null;
  }
  return provenanceObject(value, `provenance.${field}`);
}

function assertStageAuditShape(
  audit: CurrentCourseCoverageReviewProvenanceStageAudit,
  field: string,
): void {
  if (!['PRIMARY', 'CHALLENGER', 'THIRD'].includes(audit.stage)) {
    throw new Error(`Current batch review rejected: ${field}.stage is invalid`);
  }
  provenanceRequiredString(audit.provider, `${field}.provider`);
  provenanceRequiredString(audit.sessionId, `${field}.sessionId`);
  provenanceRequiredString(audit.reviewSessionId, `${field}.reviewSessionId`);
  provenanceRequiredString(audit.reviewSessionScope, `${field}.reviewSessionScope`);
  provenanceRequiredString(audit.sourceWriterSessionId, `${field}.sourceWriterSessionId`);
  provenanceRequiredString(audit.sourceWriterScope, `${field}.sourceWriterScope`);
  assertRepoRelativeProvenancePath(audit.sourceArtifactPath, `${field}.sourceArtifactPath`);
  assertSha(audit.sourceArtifactSha256, `${field}.sourceArtifactSha256`);
  assertRepoRelativeProvenancePath(
    audit.normalizedStageArtifactPath,
    `${field}.normalizedStageArtifactPath`,
  );
  assertSha(audit.normalizedDocumentDigest, `${field}.normalizedDocumentDigest`);
  if (audit.didNotReadPrimaryArtifact !== undefined
    && typeof audit.didNotReadPrimaryArtifact !== 'boolean') {
    throw new Error(`Current batch review rejected: ${field}.didNotReadPrimaryArtifact is invalid`);
  }
  if (audit.sessionAuditPrimaryPathMentions !== undefined
    && (!Number.isInteger(audit.sessionAuditPrimaryPathMentions)
      || audit.sessionAuditPrimaryPathMentions < 0)) {
    throw new Error(`Current batch review rejected: ${field}.sessionAuditPrimaryPathMentions is invalid`);
  }
  if (audit.didNotReadChallengerArtifact !== undefined
    && typeof audit.didNotReadChallengerArtifact !== 'boolean') {
    throw new Error(`Current batch review rejected: ${field}.didNotReadChallengerArtifact is invalid`);
  }
  if (audit.sessionAuditChallengerPathMentions !== undefined
    && (!Number.isInteger(audit.sessionAuditChallengerPathMentions)
      || audit.sessionAuditChallengerPathMentions < 0)) {
    throw new Error(`Current batch review rejected: ${field}.sessionAuditChallengerPathMentions is invalid`);
  }
}

function deriveProvenanceStageAudit(input: {
  stage: CourseCoverageReviewStage;
  document: CurrentCourseCoverageStageReview;
  record: UnknownRecord;
}): CurrentCourseCoverageReviewProvenanceStageAudit {
  const { stage, document, record } = input;
  const field = `provenance.${stage.toLowerCase()}`;
  const provider = provenanceRequiredString(record.provider, `${field}.provider`);
  if (provider !== document.reviewer.provider) {
    throw new Error(`Current batch review rejected: ${stage} provenance provider/session closure drift`);
  }
  const sessionId = provenanceRequiredString(record.sessionId, `${field}.sessionId`);
  const reviewSessionId = provenanceRequiredString(record.reviewSessionId, `${field}.reviewSessionId`);
  if (reviewSessionId !== sessionId) {
    throw new Error(`Current batch review rejected: ${stage} review session identity drift`);
  }
  const reviewSessionScope = provenanceRequiredString(
    record.reviewSessionScope,
    `${field}.reviewSessionScope`,
  );
  const sourceWriterSessionId = provenanceRequiredString(
    record.sourceWriterSessionId,
    `${field}.sourceWriterSessionId`,
  );
  const sourceWriterScope = provenanceRequiredString(
    record.sourceWriterScope,
    `${field}.sourceWriterScope`,
  );
  const sourceBinding = document.sourceArtifactBinding;
  if (!sourceBinding) {
    throw new Error(`Current batch review rejected: ${stage} source artifact binding is required for provenance`);
  }
  if (sourceBinding.writerSessionId !== sourceWriterSessionId) {
    throw new Error(`Current batch review rejected: ${stage} source writer/session closure drift`);
  }
  const provenanceSourceBinding = provenanceObject(
    record.sourceArtifactBinding,
    `${field}.sourceArtifactBinding`,
  );
  if (sha256Canonical(provenanceSourceBinding) !== sha256Canonical(sourceBinding)) {
    throw new Error(`Current batch review rejected: ${stage} provenance/source binding drift`);
  }
  const sourceArtifactPath = assertRepoRelativeProvenancePath(
    provenanceRequiredString(record.sourceArtifactPath, `${field}.sourceArtifactPath`),
    `${field}.sourceArtifactPath`,
  );
  const sourceArtifact = provenanceRequiredString(record.sourceArtifact, `${field}.sourceArtifact`);
  if (sourceArtifact !== pathBasename(sourceArtifactPath)
    || sourceArtifactPath !== assertRepoRelativeProvenancePath(
      sourceBinding.artifactPath,
      `${stage}.sourceArtifactBinding.artifactPath`,
    )) {
    throw new Error(`Current batch review rejected: ${stage} provenance source artifact path drift`);
  }
  const sourceArtifactSha256 = provenanceRequiredString(
    record.sourceArtifactSha256,
    `${field}.sourceArtifactSha256`,
  );
  assertSha(sourceArtifactSha256, `${field}.sourceArtifactSha256`);
  if (sourceArtifactSha256 !== sourceBinding.artifactSha256) {
    throw new Error(`Current batch review rejected: ${stage} provenance source artifact SHA drift`);
  }
  const normalizedStageArtifactPath = assertRepoRelativeProvenancePath(
    provenanceRequiredString(record.normalizedStageArtifactPath, `${field}.normalizedStageArtifactPath`),
    `${field}.normalizedStageArtifactPath`,
  );
  const normalizedStageArtifact = provenanceRequiredString(
    record.normalizedStageArtifact,
    `${field}.normalizedStageArtifact`,
  );
  if (normalizedStageArtifact !== pathBasename(normalizedStageArtifactPath)) {
    throw new Error(`Current batch review rejected: ${stage} normalized artifact path drift`);
  }
  const normalizedDocumentDigest = provenanceRequiredString(
    record.normalizedDocumentDigest,
    `${field}.normalizedDocumentDigest`,
  );
  assertSha(normalizedDocumentDigest, `${field}.normalizedDocumentDigest`);
  if (normalizedDocumentDigest !== document.documentDigest) {
    throw new Error(`Current batch review rejected: ${stage} normalized document digest drift`);
  }
  const audit: CurrentCourseCoverageReviewProvenanceStageAudit = {
    stage,
    provider,
    sessionId,
    reviewSessionId,
    reviewSessionScope,
    sourceWriterSessionId,
    sourceWriterScope,
    sourceArtifactPath,
    sourceArtifactSha256,
    normalizedStageArtifactPath,
    normalizedDocumentDigest,
  };
  const didNotReadPrimaryArtifact = provenanceOptionalBoolean(record, `${'didNotReadPrimaryArtifact'}`);
  const sessionAuditPrimaryPathMentions = provenanceOptionalCount(
    record,
    'sessionAuditPrimaryPathMentions',
  );
  const didNotReadChallengerArtifact = provenanceOptionalBoolean(
    record,
    'didNotReadChallengerArtifact',
  );
  const sessionAuditChallengerPathMentions = provenanceOptionalCount(
    record,
    'sessionAuditChallengerPathMentions',
  );
  if (didNotReadPrimaryArtifact !== undefined) audit.didNotReadPrimaryArtifact = didNotReadPrimaryArtifact;
  if (sessionAuditPrimaryPathMentions !== undefined) {
    audit.sessionAuditPrimaryPathMentions = sessionAuditPrimaryPathMentions;
  }
  if (didNotReadChallengerArtifact !== undefined) {
    audit.didNotReadChallengerArtifact = didNotReadChallengerArtifact;
  }
  if (sessionAuditChallengerPathMentions !== undefined) {
    audit.sessionAuditChallengerPathMentions = sessionAuditChallengerPathMentions;
  }
  if (stage === 'CHALLENGER') {
    if (audit.didNotReadPrimaryArtifact !== true || audit.sessionAuditPrimaryPathMentions !== 0) {
      throw new Error(`Current batch review rejected: ${stage} primary artifact audit is not closed`);
    }
  }
  return audit;
}

function assertAuditStagesIndependent(
  left: CurrentCourseCoverageReviewProvenanceStageAudit,
  right: CurrentCourseCoverageReviewProvenanceStageAudit,
): void {
  if (left.sessionId === right.sessionId
    || left.reviewSessionId === right.reviewSessionId
    || left.sourceWriterSessionId === right.sourceWriterSessionId
    || left.reviewSessionScope === right.reviewSessionScope
    || left.sourceWriterScope === right.sourceWriterScope) {
    throw new Error('Current batch review rejected: provenance stage sessions/scopes are not independent');
  }
}

function deriveProvenanceProtocol(
  provenance: UnknownRecord,
): CurrentCourseCoverageReviewProvenanceIndependenceAudit['protocol'] {
  const protocol = provenanceObject(provenance.independenceProtocol, 'provenance.independenceProtocol');
  const normalizedStageArtifactsExistedDuringReviews = Object.prototype.hasOwnProperty.call(
    protocol,
    'normalizedStageArtifactsExistedDuringReviews',
  )
    ? provenanceRequiredBoolean(
      protocol.normalizedStageArtifactsExistedDuringReviews,
      'provenance.independenceProtocol.normalizedStageArtifactsExistedDuringReviews',
      false,
    )
    : Object.prototype.hasOwnProperty.call(protocol, 'stageArtifactsExistedDuringReviews')
      ? provenanceRequiredBoolean(
        protocol.stageArtifactsExistedDuringReviews,
        'provenance.independenceProtocol.stageArtifactsExistedDuringReviews',
        false,
      )
      : undefined;
  const audit = {
    primaryCouldReadChallengerArtifact: provenanceRequiredBoolean(
      protocol.primaryCouldReadChallengerArtifact,
      'provenance.independenceProtocol.primaryCouldReadChallengerArtifact',
      false,
    ),
    challengerCouldReadPrimaryArtifact: provenanceRequiredBoolean(
      protocol.challengerCouldReadPrimaryArtifact,
      'provenance.independenceProtocol.challengerCouldReadPrimaryArtifact',
      false,
    ),
    ...(normalizedStageArtifactsExistedDuringReviews === false
      ? { normalizedStageArtifactsExistedDuringReviews: false as const }
      : {}),
    sourceArtifactsCreatedByIndependentWriters: provenanceRequiredBoolean(
      protocol.sourceArtifactsCreatedByIndependentWriters,
      'provenance.independenceProtocol.sourceArtifactsCreatedByIndependentWriters',
      true,
    ),
    sourceArtifactsBoundToNormalizedReviews: provenanceRequiredBoolean(
      protocol.sourceArtifactsBoundToNormalizedReviews,
      'provenance.independenceProtocol.sourceArtifactsBoundToNormalizedReviews',
      true,
    ),
    semanticConclusionsGeneratedByAssembler: provenanceRequiredBoolean(
      protocol.semanticConclusionsGeneratedByAssembler,
      'provenance.independenceProtocol.semanticConclusionsGeneratedByAssembler',
      false,
    ),
  } as CurrentCourseCoverageReviewProvenanceIndependenceAudit['protocol'];
  return audit;
}

export function deriveCurrentCourseCoverageReviewProvenanceBinding(input: {
  provenancePath: string;
  provenanceSha256: string;
  provenance: unknown;
  batchId: string;
  primary: CurrentCourseCoverageStageReview;
  challenger?: CurrentCourseCoverageStageReview | null;
  third?: CurrentCourseCoverageStageReview | null;
}): CurrentCourseCoverageReviewProvenanceBinding {
  const provenance = provenanceObject(input.provenance, 'provenance');
  const provenancePath = assertRepoRelativeProvenancePath(input.provenancePath, 'provenancePath');
  assertSha(input.provenanceSha256, 'provenanceSha256');
  const provenanceBatchId = provenanceRequiredString(provenance.batchId, 'provenance.batchId');
  if (provenanceBatchId !== input.batchId) {
    throw new Error('Current batch review rejected: provenance batchId drift');
  }
  const primaryRecord = provenanceStageRecord(provenance, 'PRIMARY', true)!;
  const challengerRecord = provenanceStageRecord(provenance, 'CHALLENGER', Boolean(input.challenger));
  const thirdRecord = provenanceStageRecord(provenance, 'THIRD', Boolean(input.third));
  if (!input.challenger && provenance.challenger !== null && provenance.challenger !== undefined) {
    throw new Error('Current batch review rejected: provenance Challenger closure drift');
  }
  if (!input.third && provenance.third !== null && provenance.third !== undefined) {
    throw new Error('Current batch review rejected: provenance Third closure drift');
  }
  const primary = deriveProvenanceStageAudit({ stage: 'PRIMARY', document: input.primary, record: primaryRecord });
  const challenger = input.challenger && challengerRecord
    ? deriveProvenanceStageAudit({ stage: 'CHALLENGER', document: input.challenger, record: challengerRecord })
    : null;
  const third = input.third && thirdRecord
    ? deriveProvenanceStageAudit({ stage: 'THIRD', document: input.third, record: thirdRecord })
    : null;
  if (challenger) assertAuditStagesIndependent(primary, challenger);
  if (third) {
    assertAuditStagesIndependent(primary, third);
    if (challenger) assertAuditStagesIndependent(challenger, third);
  }
  return {
    provenancePath,
    provenanceSha256: input.provenanceSha256,
    independenceAudit: {
      protocol: deriveProvenanceProtocol(provenance),
      primary,
      challenger,
      third,
    },
  };
}

export function assertCurrentCourseCoverageReviewProvenanceBinding(
  binding: CurrentCourseCoverageReviewProvenanceBinding,
): void {
  if (!binding || typeof binding !== 'object') {
    throw new Error('Current batch review rejected: review provenance binding is invalid');
  }
  assertRepoRelativeProvenancePath(binding.provenancePath, 'reviewProvenanceBinding.provenancePath');
  assertSha(binding.provenanceSha256, 'reviewProvenanceBinding.provenanceSha256');
  const audit = provenanceObject(
    binding.independenceAudit,
    'reviewProvenanceBinding.independenceAudit',
  ) as unknown as CurrentCourseCoverageReviewProvenanceIndependenceAudit;
  const protocol = provenanceObject(
    audit.protocol,
    'reviewProvenanceBinding.independenceAudit.protocol',
  ) as unknown as CurrentCourseCoverageReviewProvenanceIndependenceAudit['protocol'];
  provenanceRequiredBoolean(
    protocol.primaryCouldReadChallengerArtifact,
    'reviewProvenanceBinding.independenceAudit.protocol.primaryCouldReadChallengerArtifact',
    false,
  );
  provenanceRequiredBoolean(
    protocol.challengerCouldReadPrimaryArtifact,
    'reviewProvenanceBinding.independenceAudit.protocol.challengerCouldReadPrimaryArtifact',
    false,
  );
  if (protocol.normalizedStageArtifactsExistedDuringReviews !== undefined) {
    provenanceRequiredBoolean(
      protocol.normalizedStageArtifactsExistedDuringReviews,
      'reviewProvenanceBinding.independenceAudit.protocol.normalizedStageArtifactsExistedDuringReviews',
      false,
    );
  }
  provenanceRequiredBoolean(
    protocol.sourceArtifactsCreatedByIndependentWriters,
    'reviewProvenanceBinding.independenceAudit.protocol.sourceArtifactsCreatedByIndependentWriters',
    true,
  );
  provenanceRequiredBoolean(
    protocol.sourceArtifactsBoundToNormalizedReviews,
    'reviewProvenanceBinding.independenceAudit.protocol.sourceArtifactsBoundToNormalizedReviews',
    true,
  );
  provenanceRequiredBoolean(
    protocol.semanticConclusionsGeneratedByAssembler,
    'reviewProvenanceBinding.independenceAudit.protocol.semanticConclusionsGeneratedByAssembler',
    false,
  );
  const primary = provenanceObject(
    audit.primary,
    'reviewProvenanceBinding.independenceAudit.primary',
  ) as unknown as CurrentCourseCoverageReviewProvenanceStageAudit;
  assertStageAuditShape(primary, 'reviewProvenanceBinding.independenceAudit.primary');
  if (audit.challenger !== null && audit.challenger !== undefined) {
    const challenger = provenanceObject(
      audit.challenger,
      'reviewProvenanceBinding.independenceAudit.challenger',
    ) as unknown as CurrentCourseCoverageReviewProvenanceStageAudit;
    assertStageAuditShape(challenger, 'reviewProvenanceBinding.independenceAudit.challenger');
    assertAuditStagesIndependent(primary, challenger);
  }
  if (audit.third !== null && audit.third !== undefined) {
    const third = provenanceObject(
      audit.third,
      'reviewProvenanceBinding.independenceAudit.third',
    ) as unknown as CurrentCourseCoverageReviewProvenanceStageAudit;
    assertStageAuditShape(third, 'reviewProvenanceBinding.independenceAudit.third');
    assertAuditStagesIndependent(primary, third);
    if (audit.challenger !== null && audit.challenger !== undefined) {
      const challenger = provenanceObject(
        audit.challenger,
        'reviewProvenanceBinding.independenceAudit.challenger',
      ) as unknown as CurrentCourseCoverageReviewProvenanceStageAudit;
      assertAuditStagesIndependent(challenger, third);
    }
  }
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
  if (Object.prototype.hasOwnProperty.call(receipt, 'reviewProvenanceBinding')) {
    if (!receipt.reviewProvenanceBinding) {
      throw new Error('Current batch review rejected: review provenance binding is invalid');
    }
    assertCurrentCourseCoverageReviewProvenanceBinding(receipt.reviewProvenanceBinding);
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
  allowLegacySourceArtifactBinding?: boolean;
}): Map<string, CurrentCourseCoverageStageDecision> {
  const {
    document,
    expectedStage,
    binding,
    batch,
    items,
    requiredIds,
    allowLegacySourceArtifactBinding = false,
  } = input;
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
  reviewProvenanceBinding?: CurrentCourseCoverageReviewProvenanceBinding;
  allowLegacySourceArtifactBinding?: boolean;
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
  if (input.reviewProvenanceBinding) {
    assertCurrentCourseCoverageReviewProvenanceBinding(input.reviewProvenanceBinding);
  }
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
    ...(input.reviewProvenanceBinding
      ? { reviewProvenanceBinding: structuredClone(input.reviewProvenanceBinding) }
      : {}),
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
