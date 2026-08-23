/**
 * Coordinated latest-Authority and active-OSS resource cutover (#1509).
 *
 * This module defines the version-neutral coordination contracts: execution-
 * time Authority capture, active-baseline-plus-explicit-delta denominators,
 * dependency-complete cache identities, the one-way coordination identity
 * graph, and the stopped-service transaction receipts. It never mutates a
 * production selector on its own; candidate generation, deployment, and
 * activation remain separately authorized operations.
 */


export const LATEST_AUTHORITY_CUTOVER_CONTRACT =
  'latest-authority-active-oss-resource-cutover/v1' as const;
export const AUTHORITY_CAPTURE_RECEIPT_CONTRACT =
  'authority-capture-receipt/v2' as const;
export const AUTHORITY_COMPATIBILITY_CONTRACT =
  'authority-adapter-compatibility/v1' as const;
export const SUCCESSOR_RESOURCE_DENOMINATOR_CONTRACT =
  'successor-resource-denominator/v1' as const;
export const COORDINATION_DERIVATION_RECEIPT_CONTRACT =
  'coordination-derivation-receipt/v1' as const;
export const RESOURCE_CONTINUITY_RECEIPT_CONTRACT =
  'resource-continuity-receipt/v1' as const;
export const RESOURCE_RETIREMENT_DECISION_CONTRACT =
  'resource-owner-retirement-decision/v1' as const;
export const TEACHING_CLOSURE_RECEIPT_CONTRACT =
  'coordinated-teaching-closure-receipt/v1' as const;
export const COORDINATION_ALLOCATION_CONTRACT =
  'coordination-allocation-record/v1' as const;
export const COORDINATED_CANDIDATE_RECEIPT_CONTRACT =
  'coordinated-candidate-receipt/v1' as const;
export const CUTOVER_TRANSACTION_JOURNAL_CONTRACT =
  'cutover-transaction-journal/v1' as const;
export const CUTOVER_MUTATION_RECEIPT_CONTRACT =
  'cutover-selector-mutation-receipt/v1' as const;
export const COORDINATED_ACTIVE_RECEIPT_CONTRACT =
  'coordinated-active-receipt/v1' as const;
export const COORDINATED_RUNTIME_MANIFEST_EXTENSION_CONTRACT =
  'coordinated-runtime-manifest-extension/v1' as const;
export const LATEST_AUTHORITY_CUTOVER_BUILDER_VERSION =
  'latest-authority-oss-cutover-builder/v1' as const;

export const AUTHORITY_COMPONENT_KINDS = [
  'module',
  'terminology',
  'integration',
  'coverage',
  'overlay',
  'registry',
] as const;
export type AuthorityComponentKind = (typeof AUTHORITY_COMPONENT_KINDS)[number];

export const AUTHORITY_CAPTURE_PUBLICATION_STATES = [
  'PUBLISHED_COMPLETE',
] as const;
export type AuthorityCapturePublicationState =
  (typeof AUTHORITY_CAPTURE_PUBLICATION_STATES)[number];

export const AUTHORITY_COMPATIBILITY_CLASSIFICATIONS = [
  'COMPATIBLE',
  'ADAPTATION_REQUIRED',
] as const;
export type AuthorityCompatibilityClassification =
  (typeof AUTHORITY_COMPATIBILITY_CLASSIFICATIONS)[number];

export const DENOMINATOR_ENTRY_ORIGINS = ['BASELINE', 'DELTA'] as const;
export type DenominatorEntryOrigin = (typeof DENOMINATOR_ENTRY_ORIGINS)[number];

export const SUCCESSOR_DELTA_CHANGE_KINDS = ['NEW', 'CHANGED'] as const;
export type SuccessorDeltaChangeKind = (typeof SUCCESSOR_DELTA_CHANGE_KINDS)[number];

export const CONTINUITY_FAILURE_KINDS = [
  'missing-script',
  'failed-recognition',
  'invalid-atomization',
  'invalid-time-alignment',
  'unsafe-anchor',
  'weak-canonical-mapping',
  'unsupported-launcher',
  'incomplete-atomic-dispositions',
  'no-canonical-binding',
  'unqualified-launch-contract',
  'other-technical-failure',
] as const;
export type ContinuityFailureKind = (typeof CONTINUITY_FAILURE_KINDS)[number];

export const TEACHING_CLOSURE_FAMILIES = [
  'containment',
  'prerequisite',
  'association',
] as const;
export type TeachingClosureFamily = (typeof TEACHING_CLOSURE_FAMILIES)[number];

export class LatestAuthorityCutoverError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'LatestAuthorityCutoverError';
    this.code = code;
  }
}

/** One declared ActKG component closure member of a captured aggregate. */
export interface AuthorityComponentIdentity {
  readonly kind: AuthorityComponentKind;
  readonly componentId: string;
  readonly version: string;
  readonly sha256: string;
}

/**
 * The exact public-contract surface the existing ACT adapter must validate
 * before a captured Authority may continue through the reuse path.
 */
export interface CapturedPublicContract {
  readonly schemaVersion: string;
  readonly schemaSha256: string;
  readonly contractVersion: string;
  readonly requiredMembers: readonly string[];
  readonly profiles: readonly string[];
  /** Outcome of one complete representative parse through the adapter. */
  readonly representativeParse: 'COMPLETE' | 'FAILED';
}

/** The adapter-side support surface the captured contract is checked against. */
export interface SupportedPublicContract {
  readonly schemaIdentities: Readonly<Record<string, string>>;
  readonly contractVersions: readonly string[];
  readonly requiredMembers: readonly string[];
  readonly profiles: readonly string[];
}

export interface AuthorityCompatibility {
  readonly contract: typeof AUTHORITY_COMPATIBILITY_CONTRACT;
  readonly adapterContractVersion: string;
  readonly classification: AuthorityCompatibilityClassification;
  readonly incompatibleReasons: readonly string[];
  readonly captured: CapturedPublicContract;
}

/** Immutable execution-time capture of the latest complete formal Authority. */
export interface AuthorityCaptureReceipt {
  readonly contract: typeof AUTHORITY_CAPTURE_RECEIPT_CONTRACT;
  readonly captureId: string;
  readonly capturedAt: string;
  readonly actkgMainCommit: string;
  readonly sourceCommit: string;
  readonly sourceTag: string;
  readonly packagingCommit: string;
  readonly stableTag: string;
  readonly releaseId: string;
  readonly releaseVersion: string;
  readonly bundleId: string;
  readonly bundleDigest: string;
  readonly manifestSha256: string;
  readonly sha256sumsSha256: string;
  readonly validationReportSha256: string;
  readonly publicationState: AuthorityCapturePublicationState;
  readonly componentIdentities: readonly AuthorityComponentIdentity[];
  readonly predecessorBundleId: string | null;
  readonly candidateChain: readonly string[];
  readonly compatibility: AuthorityCompatibility;
  readonly captureHash: string;
}

/** Logical-resource entry classification reopened from the active release. */
export interface ActiveBaselineEntry {
  readonly entryId: string;
  readonly resourceId: string | null;
  readonly classification: 'resource' | 'non-resource';
  readonly subtype: string | null;
}

export interface ActiveRuntimeReleaseIdentity {
  readonly releaseId: string;
  readonly manifestSha256: string;
  readonly treeSha256: string;
  readonly activeReceiptHash: string;
  readonly lifecycleGeneration: number;
}

export interface ActiveBaseline {
  readonly contract: typeof SUCCESSOR_RESOURCE_DENOMINATOR_CONTRACT;
  readonly activeRelease: ActiveRuntimeReleaseIdentity;
  readonly entries: readonly ActiveBaselineEntry[];
  readonly logicalResourceCount: number;
  readonly nonResourceCount: number;
  readonly inventoryHash: string;
  readonly baselineHash: string;
}

export interface ExplicitDeltaInput {
  readonly resourceId: string;
  readonly subtype: string;
  readonly change: SuccessorDeltaChangeKind;
  readonly sourceIdentity: string;
}

export interface ExplicitDelta {
  readonly contract: typeof SUCCESSOR_RESOURCE_DENOMINATOR_CONTRACT;
  readonly orderedInputs: readonly ExplicitDeltaInput[];
  readonly deltaHash: string;
}

export interface DenominatorEntry {
  readonly key: string;
  readonly resourceId: string;
  readonly origin: DenominatorEntryOrigin;
  readonly subtype: string;
  readonly classification: 'resource' | 'non-resource';
}

export interface CombinedDenominator {
  readonly contract: typeof SUCCESSOR_RESOURCE_DENOMINATOR_CONTRACT;
  readonly baselineHash: string;
  readonly deltaHash: string;
  readonly denominatorHash: string;
  readonly entries: readonly DenominatorEntry[];
}

/** Complete semantic cache identity inputs for one resource binding. */
export interface ResourceBindingCacheIdentityInput {
  readonly resourceId: string;
  readonly atomId: string;
  readonly resourceContentSha256: string;
  readonly atomContentSha256: string;
  readonly canonicalId: string;
  readonly canonicalSemanticRevision: string;
  readonly role: string;
  readonly courseScopeId: string;
  readonly sourceIdentity: string;
  readonly qualifiedPipelineIdentity: string;
  readonly anchorContract: string;
  readonly launcherContract: string;
}

/** Complete semantic cache identity inputs for one teaching decision. */
export interface TeachingDecisionCacheIdentityInput {
  readonly canonicalId: string;
  readonly canonicalSemanticRevision: string;
  readonly family: TeachingClosureFamily;
  readonly scopeHash: string;
  readonly evidenceDigest: string;
  readonly candidateOrDecisionHash: string;
  readonly qualifiedPipelineIdentity: string;
}

export interface DerivationReceipt {
  readonly contract: typeof COORDINATION_DERIVATION_RECEIPT_CONTRACT;
  readonly reusedCount: number;
  readonly invalidatedCount: number;
  readonly recomputedCount: number;
  readonly reusedHash: string;
  readonly invalidatedHash: string;
  readonly recomputedHash: string;
  readonly summaryIdentity: string;
  readonly receiptId: string;
}

export interface RetirementDecision {
  readonly contract: typeof RESOURCE_RETIREMENT_DECISION_CONTRACT;
  readonly retirementId: string;
  readonly resourceId: string;
  readonly activeReleaseId: string;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly invalidationRules: readonly string[];
}

export interface ResourceSuccessorDisposition {
  readonly resourceId: string;
  readonly atomicDispositionsComplete: boolean;
  readonly canonicalBindingCount: number;
  readonly launchContractQualified: boolean;
  readonly failureKinds: readonly ContinuityFailureKind[];
}

export interface ContinuityLedgerHashes {
  readonly includedHash: string;
  readonly retiredHash: string;
  readonly developmentOnlyHash: string;
  readonly failedHash: string;
  readonly atomHash: string;
  readonly bindingHash: string;
  readonly launcherHash: string;
  readonly qualificationHash: string;
}

export interface ResourceContinuityReceipt {
  readonly contract: typeof RESOURCE_CONTINUITY_RECEIPT_CONTRACT;
  readonly builderVersion: typeof LATEST_AUTHORITY_CUTOVER_BUILDER_VERSION;
  readonly denominatorHash: string;
  readonly status: 'QUALIFIED' | 'BLOCKED';
  readonly blocked: readonly { resourceId: string; failureKinds: readonly ContinuityFailureKind[] }[];
  readonly included: readonly string[];
  readonly retired: readonly string[];
  readonly developmentOnly: readonly string[];
  readonly failed: readonly string[];
  readonly ledgers: ContinuityLedgerHashes;
  readonly receiptHash: string;
}

export interface TeachingFamilyClosureCounts {
  readonly family: TeachingClosureFamily;
  readonly memberCount: number;
  readonly closedCount: number;
  readonly admittedRelationCount: number;
  readonly noRelationCount: number;
  readonly courseRootCount: number;
  readonly rejectedCount: number;
  readonly modifiedCount: number;
  readonly unresolvedCount: number;
}

export interface TeachingClosureReceipt {
  readonly contract: typeof TEACHING_CLOSURE_RECEIPT_CONTRACT;
  readonly builderVersion: typeof LATEST_AUTHORITY_CUTOVER_BUILDER_VERSION;
  readonly scopeHash: string;
  readonly authorityCaptureHash: string;
  readonly status: 'COMPLETE' | 'INCOMPLETE';
  readonly zeroUnresolved: boolean;
  readonly familyCounts: readonly TeachingFamilyClosureCounts[];
  readonly countsHash: string;
  readonly receiptHash: string;
}

/**
 * The first sealed artifact of the one-way identity graph. Every inner
 * artifact may bind this record's hash; no inner artifact may bind the later
 * outer candidate or active receipt hashes.
 */
export interface CoordinationAllocationRecord {
  readonly contract: typeof COORDINATION_ALLOCATION_CONTRACT;
  readonly coordinationRunId: string;
  readonly sealedAt: string;
  readonly captureHash: string;
  readonly compatibilityClassification: AuthorityCompatibilityClassification;
  readonly scopeHash: string;
  readonly denominatorHash: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly implementationIdentities: Readonly<Record<string, string>>;
  readonly allocationHash: string;
}

/** Binding of one inner artifact onto the allocation record and earlier deps. */
export interface InnerArtifactBinding {
  readonly artifactId: string;
  readonly artifactKind: string;
  readonly allocationHash: string;
  readonly dependsOn: readonly { artifactId: string; artifactHash: string }[];
  readonly artifactHash: string;
}

export interface PredecessorSelectorState {
  readonly selectorId: string;
  readonly identity: string;
}

export interface SuccessorSelectorExpectation {
  readonly selectorId: string;
  readonly expectedSuccessorIdentity: string;
}

export interface CoordinatedCandidateReceipt {
  readonly contract: typeof COORDINATED_CANDIDATE_RECEIPT_CONTRACT;
  readonly builderVersion: typeof LATEST_AUTHORITY_CUTOVER_BUILDER_VERSION;
  readonly candidateId: string;
  readonly sealedAt: string;
  readonly selectable: false;
  readonly allocationHash: string;
  readonly authorityCaptureHash: string;
  readonly localeQualificationHash: string;
  readonly teachingProjectionHash: string;
  readonly teachingClosureReceiptHash: string;
  readonly formalResourceEnvelopeHash: string;
  readonly continuityReceiptHash: string;
  readonly derivationReceiptHash: string;
  readonly successorRuntimeManifestHash: string;
  readonly successorRuntimeMaterializationHash: string;
  readonly domainShardCatalogHash: string;
  readonly domainShardSetHash: string;
  readonly prerequisitePublicationHash: string;
  readonly consumerActivationHash: string;
  readonly predecessor: readonly PredecessorSelectorState[];
  readonly predecessorRuntimeLifecycleGeneration: number;
  readonly successorSelectorExpectations: readonly SuccessorSelectorExpectation[];
  readonly transactionImplementationIdentity: string;
  readonly rollbackPlanHash: string;
  readonly verificationPolicyHash: string;
  readonly receiptHash: string;
}

export interface JournaledMutationPlan {
  readonly selectorId: string;
  readonly expectedPredecessorIdentity: string;
  readonly successorIdentity: string;
}

export interface CutoverCompensationAction {
  readonly selectorId: string;
  readonly restoreIdentity: string;
}

export interface CutoverTransactionJournal {
  readonly contract: typeof CUTOVER_TRANSACTION_JOURNAL_CONTRACT;
  readonly transactionId: string;
  readonly openedAt: string;
  readonly candidateReceiptHash: string;
  readonly predecessor: readonly PredecessorSelectorState[];
  readonly orderedMutations: readonly JournaledMutationPlan[];
  readonly compensationPlan: readonly CutoverCompensationAction[];
  readonly journalHash: string;
}

export interface SelectorMutationReceipt {
  readonly contract: typeof CUTOVER_MUTATION_RECEIPT_CONTRACT;
  readonly receiptId: string;
  readonly transactionId: string;
  readonly candidateReceiptHash: string;
  readonly selectorId: string;
  readonly appliedAt: string;
  readonly beforeIdentity: string;
  readonly afterIdentity: string;
}

export interface CoordinatedActiveReceipt {
  readonly contract: typeof COORDINATED_ACTIVE_RECEIPT_CONTRACT;
  readonly receiptId: string;
  readonly sealedAt: string;
  readonly transactionId: string;
  readonly journalHash: string;
  readonly candidateReceiptHash: string;
  readonly committedSelectors: readonly { selectorId: string; identity: string }[];
  readonly mutationReceiptHashes: readonly string[];
  readonly runtimeActiveReceiptHash: string | null;
  readonly receiptHash: string;
}

export interface CoordinatedRuntimeManifestExtension {
  readonly contract: typeof COORDINATED_RUNTIME_MANIFEST_EXTENSION_CONTRACT;
  readonly allocationHash: string;
  readonly denominatorHash: string;
  readonly captureHash: string;
  readonly teachingProjectionHash: string;
  readonly teachingClosureReceiptHash: string;
  readonly formalResourceEnvelopeHash: string;
  readonly continuityReceiptHash: string;
  readonly domainShardSetHash: string;
  readonly prerequisitePublicationHash: string;
  readonly consumerActivationHash: string;
  readonly predecessorRuntimeReleaseId: string;
  readonly predecessorRuntimeManifestSha256: string;
  readonly predecessorLifecycleGeneration: number;
}
