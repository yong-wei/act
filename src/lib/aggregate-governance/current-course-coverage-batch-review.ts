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

export interface CurrentCourseCoverageHistoricalNoBindingDigestPair {
  receiptPath: string;
  attestationPath: string;
  receiptDigest: string;
  attestationDigest: string;
}

/**
 * These are the fifteen tracked receipts captured before provenance binding
 * became part of the receipt contract. The values are copied from the tracked
 * receipt and detached-attestation artifacts and are intentionally exact.
 */
export const CURRENT_COURSE_COVERAGE_HISTORICAL_NO_BINDING_DIGEST_PAIRS = [
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1190-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1190-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: '6cd7dc9bd484f5bb79a63db294917a0ff94ea767b37f5a7df030d76532c155dd',
    attestationDigest: '26c49c525e8862eea19ec17ef9c28187a24b2b8e507f2cf1e9592c3cdc11fadf',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1191-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1191-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: '644d1de467f0d3faa5d3d6d3e1514332dbae6c462f04a0cb9c5033d0b59136b4',
    attestationDigest: 'de7311407f65474be55efb64ceda78c3e38c296111b05e0b082051122cf2ea0a',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1192-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1192-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: 'd2972b3edeb69fbbbee80315bf467a1e2fd2f240188b148f4410b916e6e94130',
    attestationDigest: '1aa522a9ee13b940b3e448b6f7e56a8ed651189b4be0e8c13fad6515ddd8d6da',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1193-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1193-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: 'ef2559e270601d29dbca8e8a3c6213f8229a2c27917538e828a68b49f323bc31',
    attestationDigest: '9fd92e5c9108ddffb7f6815c29d1eb96b62eb16bed802f64c112a0e03534f61b',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1194-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1194-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: '5d62ca217b316630e26273d23f763b3a6a1c051a36e05a9fd9ff441f765483ba',
    attestationDigest: 'aabe1220bdeb3c5628cbe9c76ebd7118ed4e23346dd195638704f985a2c9d720',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1195-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1195-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: '333c8c792e5a59064ed80f7560bad2dc560fc06879b8d10fb810d7552b8b79cd',
    attestationDigest: '9ef350cedcd7f97b648025174e87b7c3ba082e37bd08c9fce9155af13c997601',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1196-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1196-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: 'a6736d12049c2132a2d22fce2d7619e533200fec561e56eaf2809ae87d04cc6a',
    attestationDigest: '5888a709321f639dd5473f8ddc9c40b3df1851d015d0ae9387daa471e0ee28e7',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1197-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1197-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: '5f1c37113a611050489fc8919782160c385b57816c00434497c609bc10ac164a',
    attestationDigest: '14a8fa93911e3191f55385729378ea4597195cbf98d3d192ad57ceb701cd8919',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1199-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1199-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: '7608116c46ef6e685bcc7d8e170f84c27b693464ccd4cee870d08183d540753d',
    attestationDigest: 'e5194cb7df9447ce88f3a5d719dfb1eb09e1dea228d0cf93f07c74fa815879ea',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1201-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1201-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: 'f37c8a455672b7affa64f0acc7e7332a7b4747f14446db409b6da0f86b047658',
    attestationDigest: '3d30fbc4af768608f2b911cdd939b38670e3e506d5af312fd33885a9460a683e',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1203-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1203-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: '23df4096c560a8d99ca5eabb407fb69e311977090f8894cdde0afa00d6b4fcab',
    attestationDigest: '3b11c1b7b904396c6671c10db821b41f8a418fd9c270789350dbb66bfc4cbf38',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1205-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1205-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: '5e5fb4fcf1213b874676478478d1295f5e8ccc46e22c3c366d5e0349413c77a6',
    attestationDigest: 'adca425b41e6a80781de8f3d6f8d3ad49c4e8bb05e9758e06ac4e2c7feb2a5c0',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1198-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1198-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: 'f86165449d3216c5d4b4ad5360b7383adeb7e7042fb526e101980251095b58e5',
    attestationDigest: '5b3d39dbecf1e39470219c43225ea572846b8b6b5d2186a1db39ed54a63ee0f5',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1202-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1202-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: '1df6f45facd6a452f00ac2c7616f69750434ffa37630574c5736dd7ceb1067bc',
    attestationDigest: 'c71e8312beef5626a25cf3934f587b4a7103790998828171d55b0a4b339af253',
  },
  {
    receiptPath: 'course-content/authoring/knowledge/issue-1207-course-coverage-review/batch-receipt.json',
    attestationPath: 'course-content/authoring/knowledge/issue-1207-course-coverage-review/batch-boundary-attestation.json',
    receiptDigest: 'a84fb2a44cbf963b807b037fe9ce3822db193658b370c184eb44ffd5145dbf60',
    attestationDigest: '00a905992060e60289bc06b3c5a6331a102ae2998eca66d17f8e84873125d211',
  },
] as const satisfies readonly CurrentCourseCoverageHistoricalNoBindingDigestPair[];

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
    normalizedStageArtifactsExistedDuringReviews: false;
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

export function isCurrentCourseCoverageHistoricalNoBindingReceipt(
  input: Pick<CurrentCourseCoverageHistoricalNoBindingDigestPair, 'receiptPath' | 'receiptDigest'>,
): boolean {
  return CURRENT_COURSE_COVERAGE_HISTORICAL_NO_BINDING_DIGEST_PAIRS.some((pair) =>
    pair.receiptPath === input.receiptPath && pair.receiptDigest === input.receiptDigest);
}

export function isCurrentCourseCoverageHistoricalNoBindingPair(
  input: CurrentCourseCoverageHistoricalNoBindingDigestPair,
): boolean {
  return CURRENT_COURSE_COVERAGE_HISTORICAL_NO_BINDING_DIGEST_PAIRS.some((pair) =>
    pair.receiptPath === input.receiptPath
      && pair.attestationPath === input.attestationPath
      && pair.receiptDigest === input.receiptDigest
      && pair.attestationDigest === input.attestationDigest);
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

function assertChallengerPrimaryArtifactAudit(
  audit: Pick<CurrentCourseCoverageReviewProvenanceStageAudit, 'didNotReadPrimaryArtifact' | 'sessionAuditPrimaryPathMentions'>,
  field: string,
): void {
  if (audit.didNotReadPrimaryArtifact !== true || audit.sessionAuditPrimaryPathMentions !== 0) {
    throw new Error(`Current batch review rejected: ${field} primary artifact audit is not closed`);
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
  assertStageSourceArtifactBindingClosure({
    sourceBinding,
    expectedStage: stage,
    reviewerSessionId: document.reviewer.sessionId,
    auditSourceWriterSessionId: sourceWriterSessionId,
    field: stage,
    stageMismatchMessage: `${stage} source artifact stage mismatch`,
  });
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
    assertChallengerPrimaryArtifactAudit(audit, stage);
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

function stageReviewersAreIndependent(
  left: Pick<CurrentCourseCoverageStageReview, 'reviewer'>,
  right: Pick<CurrentCourseCoverageStageReview, 'reviewer'>,
): boolean {
  return left.reviewer.identity !== right.reviewer.identity
    && left.reviewer.sessionId !== right.reviewer.sessionId;
}

function assertBoundStageReviewerIdentityAndSession(
  record: CurrentCourseCoverageStageReview,
  stageLabel: string,
): void {
  const reviewer = record.reviewer as unknown;
  if (!reviewer || typeof reviewer !== 'object') {
    throw new Error(`Current batch review rejected: bound ${stageLabel} reviewer must be an object`);
  }
  const reviewerRecord = reviewer as Record<string, unknown>;
  if (typeof reviewerRecord.identity !== 'string' || reviewerRecord.identity.trim() === '') {
    throw new Error(`Current batch review rejected: bound ${stageLabel} reviewer.identity must be a non-empty string`);
  }
  if (typeof reviewerRecord.sessionId !== 'string' || reviewerRecord.sessionId.trim() === '') {
    throw new Error(`Current batch review rejected: bound ${stageLabel} reviewer.sessionId must be a non-empty string`);
  }
}

function assertStageSourceArtifactBindingClosure(input: {
  sourceBinding: unknown;
  expectedStage: CourseCoverageReviewStage;
  reviewerSessionId: unknown;
  auditSourceWriterSessionId?: unknown;
  field: string;
  stageMismatchMessage: string;
}): void {
  const sourceBinding = provenanceObject(input.sourceBinding, `${input.field}.sourceArtifactBinding`);
  if (typeof sourceBinding.schemaVersion !== 'string' || !sourceBinding.schemaVersion.trim()) {
    throw new Error(
      `Current batch review rejected: ${input.field}.sourceArtifactBinding.schemaVersion must be a non-empty string`,
    );
  }
  if (sourceBinding.stage !== input.expectedStage) {
    throw new Error(`Current batch review rejected: ${input.stageMismatchMessage}`);
  }
  if (typeof sourceBinding.writerSessionId !== 'string' || !sourceBinding.writerSessionId.trim()) {
    throw new Error(
      `Current batch review rejected: ${input.field}.sourceArtifactBinding.writerSessionId must be a non-empty string`,
    );
  }
  if (typeof input.reviewerSessionId !== 'string' || !input.reviewerSessionId.trim()) {
    throw new Error(`Current batch review rejected: ${input.field}.reviewer.sessionId must be a non-empty string`);
  }
  if (sourceBinding.writerSessionId !== input.reviewerSessionId) {
    throw new Error(`Current batch review rejected: ${input.field} source writer/session mismatch`);
  }
  if (input.auditSourceWriterSessionId !== undefined) {
    if (typeof input.auditSourceWriterSessionId !== 'string' || !input.auditSourceWriterSessionId.trim()) {
      throw new Error(`Current batch review rejected: ${input.field}.sourceWriterSessionId must be a non-empty string`);
    }
    if (sourceBinding.writerSessionId !== input.auditSourceWriterSessionId) {
      throw new Error(`Current batch review rejected: ${input.field} source writer/session closure drift`);
    }
  }
}

function validateFixedProvenanceProtocol(
  protocol: UnknownRecord,
  field: string,
  allowLegacyStageArtifacts: boolean,
): CurrentCourseCoverageReviewProvenanceIndependenceAudit['protocol'] {
  const hasModernNormalizedStageArtifacts = Object.prototype.hasOwnProperty.call(
    protocol,
    'normalizedStageArtifactsExistedDuringReviews',
  );
  const hasLegacyStageArtifacts = Object.prototype.hasOwnProperty.call(
    protocol,
    'stageArtifactsExistedDuringReviews',
  );
  if (!hasModernNormalizedStageArtifacts && !hasLegacyStageArtifacts) {
    throw new Error(`Current batch review rejected: ${field}.normalizedStageArtifactsExistedDuringReviews must be false`);
  }
  if (!hasModernNormalizedStageArtifacts && !allowLegacyStageArtifacts) {
    throw new Error(`Current batch review rejected: ${field}.normalizedStageArtifactsExistedDuringReviews must be false`);
  }
  if (hasModernNormalizedStageArtifacts) {
    provenanceRequiredBoolean(
      protocol.normalizedStageArtifactsExistedDuringReviews,
      `${field}.normalizedStageArtifactsExistedDuringReviews`,
      false,
    );
  }
  if (hasLegacyStageArtifacts) {
    provenanceRequiredBoolean(
      protocol.stageArtifactsExistedDuringReviews,
      `${field}.stageArtifactsExistedDuringReviews`,
      false,
    );
  }
  return {
    primaryCouldReadChallengerArtifact: provenanceRequiredBoolean(
      protocol.primaryCouldReadChallengerArtifact,
      `${field}.primaryCouldReadChallengerArtifact`,
      false,
    ),
    challengerCouldReadPrimaryArtifact: provenanceRequiredBoolean(
      protocol.challengerCouldReadPrimaryArtifact,
      `${field}.challengerCouldReadPrimaryArtifact`,
      false,
    ),
    normalizedStageArtifactsExistedDuringReviews: false,
    sourceArtifactsCreatedByIndependentWriters: provenanceRequiredBoolean(
      protocol.sourceArtifactsCreatedByIndependentWriters,
      `${field}.sourceArtifactsCreatedByIndependentWriters`,
      true,
    ),
    sourceArtifactsBoundToNormalizedReviews: provenanceRequiredBoolean(
      protocol.sourceArtifactsBoundToNormalizedReviews,
      `${field}.sourceArtifactsBoundToNormalizedReviews`,
      true,
    ),
    semanticConclusionsGeneratedByAssembler: provenanceRequiredBoolean(
      protocol.semanticConclusionsGeneratedByAssembler,
      `${field}.semanticConclusionsGeneratedByAssembler`,
      false,
    ),
  } as CurrentCourseCoverageReviewProvenanceIndependenceAudit['protocol'];
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
      protocol: validateFixedProvenanceProtocol(
        provenanceObject(provenance.independenceProtocol, 'provenance.independenceProtocol'),
        'provenance.independenceProtocol',
        true,
      ),
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
  );
  validateFixedProvenanceProtocol(
    protocol,
    'reviewProvenanceBinding.independenceAudit.protocol',
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
    assertChallengerPrimaryArtifactAudit(
      challenger,
      'reviewProvenanceBinding.independenceAudit.challenger',
    );
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

function assertBoundStageRecordClosure(receipt: CurrentCourseCoverageBatchReceipt): void {
  const binding = receipt.reviewProvenanceBinding;
  const stageRecords = receipt.stageRecords;
  const stageDocuments = receipt.stageDocuments;
  if (!binding || !stageRecords || typeof stageRecords !== 'object'
    || !stageDocuments || typeof stageDocuments !== 'object'
    || !stageRecords.primary || !binding.independenceAudit.primary) {
    throw new Error('Current batch review rejected: bound primary stage closure is incomplete');
  }
  if (stageDocuments.primaryDigest !== stageRecords.primary.documentDigest) {
    throw new Error('Current batch review rejected: bound primary stage document closure drift');
  }
  if (binding.independenceAudit.primary.normalizedDocumentDigest !== stageRecords.primary.documentDigest) {
    throw new Error('Current batch review rejected: bound primary provenance normalized document closure drift');
  }
  const assertBoundStageSlot = (
    expectedStage: CourseCoverageReviewStage,
    record: CurrentCourseCoverageStageReview,
    audit: CurrentCourseCoverageReviewProvenanceStageAudit,
  ): void => {
    const stageLabel = expectedStage.toLowerCase();
    assertBoundStageReviewerIdentityAndSession(record, stageLabel);
    if (record.stage !== expectedStage || audit.stage !== expectedStage) {
      throw new Error(`Current batch review rejected: bound ${stageLabel} stage slot closure drift`);
    }
    if (audit.provider !== record.reviewer.provider) {
      throw new Error(`Current batch review rejected: bound ${stageLabel} provider closure drift`);
    }
    if (audit.sessionId !== record.reviewer.sessionId
      || audit.reviewSessionId !== record.reviewer.sessionId
      || audit.sessionId !== audit.reviewSessionId) {
      throw new Error(`Current batch review rejected: bound ${stageLabel} session closure drift`);
    }
    const sourceBinding = record.sourceArtifactBinding;
    if (!sourceBinding) {
      throw new Error(`Current batch review rejected: bound ${stageLabel} source artifact binding is missing`);
    }
    assertStageSourceArtifactBindingClosure({
      sourceBinding,
      expectedStage,
      reviewerSessionId: record.reviewer.sessionId,
      auditSourceWriterSessionId: audit.sourceWriterSessionId,
      field: `bound ${stageLabel}`,
      stageMismatchMessage: `bound ${stageLabel} source stage closure drift`,
    });
    if (audit.sourceArtifactPath !== sourceBinding.artifactPath
      || audit.sourceArtifactSha256 !== sourceBinding.artifactSha256) {
      throw new Error(`Current batch review rejected: bound ${stageLabel} source artifact closure drift`);
    }
  };
  const assertBoundStageReviewerIndependence = (
    leftStage: CourseCoverageReviewStage,
    leftRecord: CurrentCourseCoverageStageReview,
    rightStage: CourseCoverageReviewStage,
    rightRecord: CurrentCourseCoverageStageReview,
  ): void => {
    if (!stageReviewersAreIndependent(leftRecord, rightRecord)) {
      throw new Error(
        `Current batch review rejected: bound ${leftStage.toLowerCase()}/${rightStage.toLowerCase()} reviewer independence closure drift`,
      );
    }
  };
  assertBoundStageSlot('PRIMARY', stageRecords.primary, binding.independenceAudit.primary);
  const assertOptionalStageClosure = (
    stage: 'challenger' | 'third',
    expectedStage: 'CHALLENGER' | 'THIRD',
    record: CurrentCourseCoverageStageReview | null | undefined,
    audit: CurrentCourseCoverageReviewProvenanceStageAudit | null | undefined,
    digest: string | null | undefined,
  ): void => {
    const recordPresent = record !== null && record !== undefined;
    const auditPresent = audit !== null && audit !== undefined;
    if (recordPresent !== auditPresent) {
      throw new Error(`Current batch review rejected: bound ${stage} stage/provenance closure mismatch`);
    }
    if (recordPresent && digest !== record.documentDigest) {
      throw new Error(`Current batch review rejected: bound ${stage} stage document closure drift`);
    }
    if (recordPresent && audit && audit.normalizedDocumentDigest !== record.documentDigest) {
      throw new Error(`Current batch review rejected: bound ${stage} provenance normalized document closure drift`);
    }
    if (recordPresent && audit) assertBoundStageSlot(expectedStage, record, audit);
    if (!recordPresent && digest !== null) {
      throw new Error(`Current batch review rejected: bound ${stage} stage document must be null when stage is absent`);
    }
  };
  assertOptionalStageClosure(
    'challenger',
    'CHALLENGER',
    stageRecords.challenger,
    binding.independenceAudit.challenger,
    stageDocuments.challengerDigest,
  );
  assertOptionalStageClosure(
    'third',
    'THIRD',
    stageRecords.third,
    binding.independenceAudit.third,
    stageDocuments.thirdDigest,
  );
  if (stageRecords.challenger) {
    assertBoundStageReviewerIndependence(
      'PRIMARY',
      stageRecords.primary,
      'CHALLENGER',
      stageRecords.challenger,
    );
  }
  if (stageRecords.third) {
    assertBoundStageReviewerIndependence(
      'PRIMARY',
      stageRecords.primary,
      'THIRD',
      stageRecords.third,
    );
    if (stageRecords.challenger) {
      assertBoundStageReviewerIndependence(
        'CHALLENGER',
        stageRecords.challenger,
        'THIRD',
        stageRecords.third,
      );
    }
  }
}

function receiptRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Current batch review rejected: ${field} must be a non-empty string`);
  }
  return value;
}

function assertReceiptDecisionContract(
  value: unknown,
  field: string,
): asserts value is CurrentCourseCoverageStageDecision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Current batch review rejected: ${field} is invalid`);
  }
  const decision = value as CurrentCourseCoverageStageDecision;
  if (!['INCLUDE', 'EXCLUDE', 'DEFER'].includes(decision.conclusion)) {
    throw new Error(`Current batch review rejected: ${field}.conclusion is invalid`);
  }
  if (!['SUFFICIENT', 'INSUFFICIENT'].includes(decision.evidenceSufficiency)) {
    throw new Error(`Current batch review rejected: ${field}.evidenceSufficiency is invalid`);
  }
  if (!Array.isArray(decision.evidenceSelectors) || decision.evidenceSelectors.length === 0) {
    throw new Error(`Current batch review rejected: ${field}.evidenceSelectors must be non-empty`);
  }
  const selectors = new Set<string>();
  for (const [index, selector] of decision.evidenceSelectors.entries()) {
    const normalized = receiptRequiredString(selector, `${field}.evidenceSelectors[${index}]`);
    if (selectors.has(normalized)) {
      throw new Error(`Current batch review rejected: ${field} repeats evidence selector`);
    }
    selectors.add(normalized);
  }
  receiptRequiredString(decision.rationale, `${field}.rationale`);
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
}

const CURRENT_COURSE_COVERAGE_ISSUE_1200_RECEIPT_PATH =
  'course-content/authoring/knowledge/issue-1200-course-coverage-review/batch-receipt.json';

const CURRENT_COURSE_COVERAGE_ISSUE_1200_FROZEN_BATCH_BINDING = {
  batchId: '3c6973d82b44357efc73f2f8',
  manifestBatchIndex: 10,
  sequence: 0,
  semanticGroupKey: 'ctr:release:frequency-domain-analysis-engineering-v0.1::entityType:Formula',
  memberCount: 232,
  memberDigest: '321f283c747e5068c1de2dcb0e69939afe0991c6154dc3d8db3e9f853f0455c8',
  worklistInputDigest: '55d9a896cccc5e55d0cb754187ccdc06ef8f6a845b5152f0c0106620039662c2',
  worklistDigest: 'bd80f5e20ad0713dd4203e5336328b5c919d44b98a376d8b5d3cf6835a398489',
  manifestDigest: '2f5fa8f4b9e1d7fa75c7d2be5f2629be792e0fb35907e678f8ff3a3fa2a6c818',
  manifestArtifactSha256: '786a305f3c6de217c6cc561a4e5200517615a651e346bf4bff73c9bdb54593e8',
} as const satisfies CurrentCourseCoverageBatchBinding;

const CURRENT_COURSE_COVERAGE_ISSUE_1200_PRIMARY_SESSION_ID =
  '42eca660-ca20-49d4-b9df-93d9651ad3f2';
const CURRENT_COURSE_COVERAGE_ISSUE_1200_CHALLENGER_SESSION_ID =
  '37cc1c54-54d1-4cc0-a174-c440ed0294fe';
const CURRENT_COURSE_COVERAGE_ISSUE_1200_PROVENANCE_SHA256 =
  'eee0d6dcbccab41287492f2feb7348a0419b62478d0be0565c509a9e97122a18';
const CURRENT_COURSE_COVERAGE_ISSUE_1200_PROTECTED_PATHS = [
  'course-content/authoring/knowledge/course-coverage/active/automatic-control.json',
  'course-content/authoring/knowledge/course-coverage/aggregate/active/automatic-control.json',
  'src/lib/canonical-rag/authority.ts',
  'src/lib/canonical-learning-fact-identity/authority.ts',
  'src/lib/canonical-learning-fact-identity/capability.ts',
  'src/lib/canonical-learning-fact-identity/writer.ts',
] as const;
const CURRENT_COURSE_COVERAGE_ISSUE_1200_PRIMARY_SCOPE =
  'act:issue-1200:course-coverage-primary';
const CURRENT_COURSE_COVERAGE_ISSUE_1200_CHALLENGER_SCOPE =
  'act:issue-1200:course-coverage-challenger';
// Covers the complete persisted provenance/audit and stage binding metadata;
// decisions remain governed by the receipt closure below.
const CURRENT_COURSE_COVERAGE_ISSUE_1200_FROZEN_PROVENANCE_CLOSURE_DIGEST =
  '1fceae2e88e1f18c4fb695c4b4f8aa3864d0834fd13e59887e42592baa79769b';

function issue1200ProvenanceClosureDigest(
  receipt: CurrentCourseCoverageBatchReceipt,
): string {
  const stages = ['primary', 'challenger', 'third'] as const;
  return sha256Canonical({
    reviewProvenanceBinding: receipt.reviewProvenanceBinding,
    stageRecords: Object.fromEntries(stages.map((stage) => {
      const record = receipt.stageRecords[stage];
      return [stage, record ? {
        schemaVersion: record.schemaVersion,
        stage: record.stage,
        reviewer: record.reviewer,
        sourceArtifactBinding: record.sourceArtifactBinding,
        reviewInputDigest: record.reviewInputDigest,
        documentDigest: record.documentDigest,
      } : null];
    })),
  });
}

function assertCurrentCourseCoverageIssue1200FrozenContract(
  receipt: CurrentCourseCoverageBatchReceipt,
): void {
  if (!sameBinding(receipt.batchBinding, CURRENT_COURSE_COVERAGE_ISSUE_1200_FROZEN_BATCH_BINDING)) {
    throw new Error('Current batch review rejected: frozen issue-1200 binding closure drift');
  }
  if (receipt.stageRecords.primary.reviewer.sessionId
    !== CURRENT_COURSE_COVERAGE_ISSUE_1200_PRIMARY_SESSION_ID) {
    throw new Error('Current batch review rejected: frozen issue-1200 Primary session drift');
  }
  if (!receipt.stageRecords.challenger) {
    throw new Error('Current batch review rejected: frozen issue-1200 Challenger stage is required');
  }
  if (receipt.stageRecords.challenger.reviewer.sessionId
    !== CURRENT_COURSE_COVERAGE_ISSUE_1200_CHALLENGER_SESSION_ID) {
    throw new Error('Current batch review rejected: frozen issue-1200 Challenger session drift');
  }
  if (!receipt.reviewProvenanceBinding
    || receipt.reviewProvenanceBinding.provenanceSha256
      !== CURRENT_COURSE_COVERAGE_ISSUE_1200_PROVENANCE_SHA256) {
    throw new Error('Current batch review rejected: frozen issue-1200 provenance SHA drift');
  }
  const protectedPaths = receipt.productionBoundaryProof.protectedPaths;
  if (!Array.isArray(protectedPaths)
    || protectedPaths.length !== CURRENT_COURSE_COVERAGE_ISSUE_1200_PROTECTED_PATHS.length
    || protectedPaths.some((path, index) => path !== CURRENT_COURSE_COVERAGE_ISSUE_1200_PROTECTED_PATHS[index])) {
    throw new Error('Current batch review rejected: frozen issue-1200 protected-path drift');
  }
  const audit = receipt.reviewProvenanceBinding.independenceAudit;
  if (audit.primary.reviewSessionScope !== CURRENT_COURSE_COVERAGE_ISSUE_1200_PRIMARY_SCOPE) {
    throw new Error('Current batch review rejected: frozen issue-1200 Primary reviewSessionScope drift');
  }
  if (!audit.challenger
    || audit.challenger.reviewSessionScope !== CURRENT_COURSE_COVERAGE_ISSUE_1200_CHALLENGER_SCOPE) {
    throw new Error('Current batch review rejected: frozen issue-1200 Challenger reviewSessionScope drift');
  }
  if (audit.primary.sourceWriterScope !== CURRENT_COURSE_COVERAGE_ISSUE_1200_PRIMARY_SCOPE) {
    throw new Error('Current batch review rejected: frozen issue-1200 Primary sourceWriterScope drift');
  }
  if (audit.challenger.sourceWriterScope !== CURRENT_COURSE_COVERAGE_ISSUE_1200_CHALLENGER_SCOPE) {
    throw new Error('Current batch review rejected: frozen issue-1200 Challenger sourceWriterScope drift');
  }
  if (issue1200ProvenanceClosureDigest(receipt)
    !== CURRENT_COURSE_COVERAGE_ISSUE_1200_FROZEN_PROVENANCE_CLOSURE_DIGEST) {
    throw new Error('Current batch review rejected: frozen issue-1200 provenance/audit closure drift');
  }
}

function assertCurrentCourseCoverageBatchReceiptInternalClosure(
  receipt: CurrentCourseCoverageBatchReceipt,
  issue1200FrozenPolicy = false,
): void {
  if (receipt.schemaVersion !== CURRENT_COURSE_COVERAGE_BATCH_RECEIPT_SCHEMA_VERSION
    || receipt.protocol !== 'current-course-coverage-batch-review/1') {
    throw new Error('Current batch review rejected: bound receipt schema/protocol mismatch');
  }
  const orderedMembers = receipt.orderedMembers;
  if (!Array.isArray(orderedMembers)) {
    throw new Error('Current batch review rejected: orderedMembers is invalid');
  }
  const orderedIndex = new Map<string, number>();
  const orderedRevisions = new Map<string, string>();
  const normalizedOrderedMembers = orderedMembers.map((member, index) => {
    if (!member || typeof member !== 'object' || Array.isArray(member)) {
      throw new Error(`Current batch review rejected: orderedMembers[${index}] is invalid`);
    }
    const row = member as Record<string, unknown>;
    const canonicalId = receiptRequiredString(row.canonicalId, `orderedMembers[${index}].canonicalId`);
    const canonicalRevision = receiptRequiredString(
      row.canonicalRevision,
      `orderedMembers[${index}].canonicalRevision`,
    );
    assertSha(canonicalRevision, `orderedMembers[${index}].canonicalRevision`);
    if (orderedIndex.has(canonicalId)) {
      throw new Error(`Current batch review rejected: orderedMembers repeats ${canonicalId}`);
    }
    orderedIndex.set(canonicalId, index);
    orderedRevisions.set(canonicalId, canonicalRevision);
    return { canonicalId, canonicalRevision };
  });
  if (orderedMembers.length !== receipt.batchBinding.memberCount) {
    throw new Error('Current batch review rejected: orderedMembers/memberCount closure drift');
  }
  if (receipt.batchBinding.memberDigest !== sha256Canonical(normalizedOrderedMembers)) {
    throw new Error('Current batch review rejected: orderedMembers memberDigest mismatch');
  }
  if (sha256Canonical(orderedMembers) !== sha256Canonical(normalizedOrderedMembers)) {
    throw new Error('Current batch review rejected: orderedMembers shape drift');
  }

  const validateStageRecord = (
    expectedStage: CourseCoverageReviewStage,
    record: CurrentCourseCoverageReceiptStageRecord | null,
    requireFullOrderedMembers = expectedStage === 'PRIMARY',
  ): Map<string, CurrentCourseCoverageStageDecision> => {
    if (!record) return new Map();
    const stageLabel = expectedStage.toLowerCase();
    if (record.schemaVersion !== CURRENT_COURSE_COVERAGE_STAGE_REVIEW_SCHEMA_VERSION) {
      throw new Error(`Current batch review rejected: bound ${stageLabel} stage schema mismatch`);
    }
    if (record.stage !== expectedStage || !sameBinding(receipt.batchBinding, record.batchBinding)) {
      throw new Error(`Current batch review rejected: bound ${stageLabel} stage/batch binding drift`);
    }
    if (!Array.isArray(record.decisions)) {
      throw new Error(`Current batch review rejected: bound ${stageLabel} decisions are invalid`);
    }
    const decisionsById = new Map<string, CurrentCourseCoverageStageDecision>();
    let previousOrderedIndex = -1;
    for (const [index, value] of record.decisions.entries()) {
      const field = `bound ${stageLabel}.decisions[${index}]`;
      assertReceiptDecisionContract(value, field);
      const decision = value;
      const canonicalId = receiptRequiredString(decision.canonicalId, `${field}.canonicalId`);
      const canonicalRevision = receiptRequiredString(
        decision.canonicalRevision,
        `${field}.canonicalRevision`,
      );
      assertSha(canonicalRevision, `${field}.canonicalRevision`);
      const expectedRevision = orderedRevisions.get(canonicalId);
      const memberIndex = orderedIndex.get(canonicalId);
      if (expectedRevision === undefined || memberIndex === undefined
        || canonicalRevision !== expectedRevision) {
        throw new Error(`Current batch review rejected: ${field} member closure drift`);
      }
      if (memberIndex <= previousOrderedIndex || decisionsById.has(canonicalId)) {
        throw new Error(`Current batch review rejected: bound ${stageLabel} decision order/uniqueness drift`);
      }
      previousOrderedIndex = memberIndex;
      const { decisionDigest: storedDecisionDigest, ...withoutDecisionDigest } = decision;
      assertSha(storedDecisionDigest, `${field}.decisionDigest`);
      if (storedDecisionDigest !== decisionDigest({
        stage: expectedStage,
        reviewer: record.reviewer,
        reviewInputDigest: record.reviewInputDigest,
        decision: withoutDecisionDigest,
      })) {
        throw new Error(`Current batch review rejected: ${field}.decisionDigest mismatch`);
      }
      decisionsById.set(canonicalId, decision);
    }
    if (requireFullOrderedMembers) {
      if (record.decisions.length !== normalizedOrderedMembers.length) {
        throw new Error(`Current batch review rejected: bound ${stageLabel} must cover orderedMembers exactly`);
      }
      for (const [index, member] of normalizedOrderedMembers.entries()) {
        const decision = record.decisions[index]!;
        if (decision.canonicalId !== member.canonicalId
          || decision.canonicalRevision !== member.canonicalRevision) {
          throw new Error(`Current batch review rejected: bound ${stageLabel} decision order drift`);
        }
      }
    }
    const { documentDigest: storedDocumentDigest, ...withoutDocumentDigest } = record;
    assertSha(storedDocumentDigest, `bound ${stageLabel}.documentDigest`);
    if (storedDocumentDigest !== sha256Canonical(withoutDocumentDigest)) {
      throw new Error(`Current batch review rejected: bound ${stageLabel} documentDigest mismatch`);
    }
    return decisionsById;
  };

  const primary = validateStageRecord('PRIMARY', receipt.stageRecords.primary);
  const challengerMustCoverFullBatch = issue1200FrozenPolicy;
  const challengerRecord = receipt.stageRecords.challenger;
  if (challengerMustCoverFullBatch && !challengerRecord) {
    throw new Error('Current batch review rejected: bound Challenger stage is required for frozen issue-1200 batch');
  }
  const challenger = validateStageRecord(
    'CHALLENGER',
    challengerRecord,
    challengerMustCoverFullBatch,
  );
  if (issue1200FrozenPolicy) {
    assertCurrentCourseCoverageIssue1200FrozenContract(receipt);
  }
  const third = validateStageRecord('THIRD', receipt.stageRecords.third);
  const conflictIds = normalizedOrderedMembers
    .map((member) => member.canonicalId)
    .filter((canonicalId) => {
      const primaryDecision = primary.get(canonicalId);
      const challengerDecision = challenger.get(canonicalId);
      return Boolean(primaryDecision && challengerDecision
        && !sameSemanticConclusion(primaryDecision, challengerDecision));
    });
  if (conflictIds.length > 0 && !receipt.stageRecords.challenger) {
    throw new Error('Current batch review rejected: bound Challenger is required for conflicts');
  }
  if (conflictIds.length === 0 && receipt.stageRecords.third) {
    throw new Error('Current batch review rejected: bound Third is forbidden without conflicts');
  }
  const thirdIds = [...third.keys()];
  if (sha256Canonical(thirdIds) !== sha256Canonical(conflictIds)) {
    throw new Error('Current batch review rejected: bound Third decision set does not match conflicts');
  }

  const expectedTerminalMembers = normalizedOrderedMembers.map((member) => {
    const primaryDecision = primary.get(member.canonicalId);
    if (!primaryDecision) {
      throw new Error('Current batch review rejected: bound primary decision set is incomplete');
    }
    const challengerDecision = challenger.get(member.canonicalId);
    const thirdDecision = third.get(member.canonicalId);
    const terminal = thirdDecision ?? primaryDecision;
    const stageDecisionDigests = [
      primaryDecision.decisionDigest,
      challengerDecision?.decisionDigest,
      thirdDecision?.decisionDigest,
    ].filter((value): value is string => Boolean(value));
    return {
      canonicalId: member.canonicalId,
      canonicalRevision: member.canonicalRevision,
      conclusion: terminal.conclusion,
      role: terminal.role ?? null,
      evidenceSufficiency: terminal.evidenceSufficiency,
      terminalSource: thirdDecision ? 'THIRD' as const : challengerDecision ? 'CONSENSUS' as const : 'PRIMARY' as const,
      stageDecisionDigests,
      coverageAuthorityState: terminal.conclusion === 'DEFER'
        ? 'UNRESOLVED_BLOCKING' as const
        : 'REVIEWED_NOT_CURRENT' as const,
    };
  });
  if (!Array.isArray(receipt.terminalMembers)
    || sha256Canonical(receipt.terminalMembers) !== sha256Canonical(expectedTerminalMembers)) {
    throw new Error('Current batch review rejected: terminalMembers closure drift');
  }
  const expectedCounts = {
    members: expectedTerminalMembers.length,
    included: expectedTerminalMembers.filter((member) => member.conclusion === 'INCLUDE').length,
    excluded: expectedTerminalMembers.filter((member) => member.conclusion === 'EXCLUDE').length,
    deferredEvidenceBlocked: expectedTerminalMembers.filter((member) => member.conclusion === 'DEFER').length,
    conflicts: conflictIds.length,
    thirdReviewed: third.size,
  };
  if (sha256Canonical(receipt.counts) !== sha256Canonical(expectedCounts)) {
    throw new Error('Current batch review rejected: counts closure drift');
  }
  const expectedStatus = expectedCounts.deferredEvidenceBlocked > 0
    ? 'DEFERRED_EVIDENCE_BLOCKED'
    : 'PASS';
  const expectedGate = expectedCounts.deferredEvidenceBlocked > 0
    ? 'BLOCKED_UNRESOLVED_EVIDENCE'
    : 'BLOCKED_PENDING_ALL_BATCHES';
  if (receipt.status !== expectedStatus || receipt.aggregateCoverageGate !== expectedGate) {
    throw new Error('Current batch review rejected: status/aggregate gate closure drift');
  }
  if (!receipt.productionBoundaryProof.mutationFlags
    || sha256Canonical(receipt.productionBoundaries) !== sha256Canonical(receipt.productionBoundaryProof.mutationFlags)
    || Object.values(receipt.productionBoundaryProof.mutationFlags).some(Boolean)) {
    throw new Error('Current batch review rejected: production boundary mutation closure drift');
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

export type CurrentCourseCoverageReceiptCompatibility =
  | 'BOUND_PROVENANCE'
  | 'HISTORICAL_V3_NO_BINDING'
  | 'LEGACY_V2_V1';

export function classifyCurrentCourseCoverageReceiptCompatibility(input: {
  receipt: CurrentCourseCoverageBatchReceipt;
  attestation: CurrentCourseCoverageProductionBoundaryAttestation;
  receiptPath: string;
  attestationPath: string;
}): CurrentCourseCoverageReceiptCompatibility {
  const proofProtocol = input.receipt.productionBoundaryProof.verificationProtocol;
  const isCurrentProof = proofProtocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL;
  const isLegacyProof = proofProtocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL_V2;
  const isCurrentAttestation = input.attestation.schemaVersion
    === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION
    && input.attestation.protocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL;
  const isLegacyAttestation = input.attestation.schemaVersion
    === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_SCHEMA_VERSION_V1
    && input.attestation.protocol === CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_ATTESTATION_PROTOCOL_V1;
  if ((!isCurrentProof && !isLegacyProof) || (!isCurrentAttestation && !isLegacyAttestation)
    || isCurrentProof !== isCurrentAttestation || isLegacyProof !== isLegacyAttestation) {
    throw new Error('Current batch review rejected: production boundary proof/attestation version mismatch');
  }
  if (input.receipt.reviewProvenanceBinding) {
    if (!isCurrentProof || !isCurrentAttestation) {
      throw new Error('Current batch review rejected: review provenance binding requires the current v3/v2 boundary pair');
    }
    return 'BOUND_PROVENANCE';
  }
  if (!isCurrentCourseCoverageHistoricalNoBindingPair({
    receiptPath: input.receiptPath,
    attestationPath: input.attestationPath,
    receiptDigest: input.receipt.receiptDigest,
    attestationDigest: input.attestation.attestationDigest,
  })) {
    throw new Error('Current batch review rejected: receipt without provenance binding is not an allowlisted historical artifact');
  }
  return isCurrentProof ? 'HISTORICAL_V3_NO_BINDING' : 'LEGACY_V2_V1';
}

export function assertCurrentCourseCoverageProductionBoundaryBundle(input: {
  receipt: CurrentCourseCoverageBatchReceipt;
  attestation: CurrentCourseCoverageProductionBoundaryAttestation;
  receiptPath: string;
  attestationPath: string;
}): CurrentCourseCoverageReceiptCompatibility {
  const { receipt, attestation } = input;
  const { receiptDigest, ...withoutReceiptDigest } = receipt;
  assertSha(receiptDigest, 'receiptDigest');
  if (receiptDigest !== sha256Canonical(withoutReceiptDigest)) {
    throw new Error('Current batch review rejected: receipt digest mismatch');
  }
  const hasBoundReviewProvenance = Object.prototype.hasOwnProperty.call(receipt, 'reviewProvenanceBinding');
  if (hasBoundReviewProvenance) {
    if (!receipt.reviewProvenanceBinding) {
      throw new Error('Current batch review rejected: review provenance binding is invalid');
    }
    assertCurrentCourseCoverageReviewProvenanceBinding(receipt.reviewProvenanceBinding);
    assertBoundStageRecordClosure(receipt);
  }
  const proof = receipt.productionBoundaryProof;
  validateProductionBoundaryProof(proof);
  if (proof.receiptPath !== input.receiptPath || proof.attestationPath !== input.attestationPath) {
    throw new Error('Current batch review rejected: receipt/attestation path binding mismatch');
  }
  if (hasBoundReviewProvenance) {
    assertCurrentCourseCoverageBatchReceiptInternalClosure(
      receipt,
      input.receiptPath === CURRENT_COURSE_COVERAGE_ISSUE_1200_RECEIPT_PATH,
    );
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
  const compatibility = classifyCurrentCourseCoverageReceiptCompatibility({
    receipt,
    attestation,
    receiptPath: input.receiptPath,
    attestationPath: input.attestationPath,
  });
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
  return compatibility;
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
    assertStageSourceArtifactBindingClosure({
      sourceBinding,
      expectedStage,
      reviewerSessionId: reviewer.sessionId,
      field: expectedStage,
      stageMismatchMessage: `${expectedStage} source artifact stage mismatch`,
    });
    requiredString(sourceBinding.artifactPath, `${expectedStage}.sourceArtifactBinding.artifactPath`);
    assertSha(sourceBinding.artifactSha256, `${expectedStage}.sourceArtifactBinding.artifactSha256`);
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
    if (input.productionBoundaryProof.verificationProtocol
      !== CURRENT_COURSE_COVERAGE_PRODUCTION_BOUNDARY_PROTOCOL) {
      throw new Error('Current batch review rejected: review provenance binding requires the current v3 boundary proof');
    }
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
    if (!stageReviewersAreIndependent(input.primary, input.challenger)) {
      throw new Error('Current batch review rejected: Primary and Challenger are not independent');
    }
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
    if (!stageReviewersAreIndependent(input.primary, input.third)
      || (input.challenger && !stageReviewersAreIndependent(input.challenger, input.third))) {
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
  const receiptDigest = sha256Canonical(withoutReceiptDigest);
  if (!input.reviewProvenanceBinding) {
    if (!isCurrentCourseCoverageHistoricalNoBindingReceipt({
      receiptPath: input.productionBoundaryProof.receiptPath,
      receiptDigest,
    })) {
      throw new Error('Current batch review rejected: receipt without provenance binding is not an allowlisted historical artifact');
    }
  }
  return { ...withoutReceiptDigest, receiptDigest };
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
