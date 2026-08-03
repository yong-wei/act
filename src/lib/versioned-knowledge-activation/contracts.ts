/**
 * Per-consumer versioned knowledge activation contracts (#1276).
 *
 * Independent readiness for Engineering Graph/RAG, course runtime, Konling,
 * Teaching Resource RAG, and learning path. Activation is local, staged, and
 * reversible via digest-checked pointer replacement.
 */

export const CONSUMER_ACTIVATION_CONTRACT =
  'act-versioned-knowledge-consumer-activation/v1' as const;
export const CONSUMER_ACTIVATION_POINTER_CONTRACT =
  'act-versioned-knowledge-consumer-activation-current/v1' as const;
export const CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT =
  'act-versioned-knowledge-consumer-activation-stage-receipt/v1' as const;
export const CONSUMER_ACTIVATION_RECEIPT_CONTRACT =
  'act-versioned-knowledge-consumer-activation-receipt/v1' as const;
export const CONSUMER_ACTIVATION_ROLLBACK_RECEIPT_CONTRACT =
  'act-versioned-knowledge-consumer-activation-rollback-receipt/v1' as const;
export const CONSUMER_ACTIVATION_SHADOW_REPORT_CONTRACT =
  'act-versioned-knowledge-consumer-activation-shadow-report/v1' as const;

export const DEFAULT_CONSUMER_ACTIVATION_ROOT_RELATIVE =
  'course-content/runtime/knowledge/consumer-activation' as const;

/** Named consumers that may hold independent Authority/Projection combinations. */
export const CONSUMER_ACTIVATION_IDS = [
  'engineering-graph',
  'engineering-rag',
  'course-runtime',
  'konling',
  'teaching-resource-rag',
  'learning-path',
] as const;

export type ConsumerActivationId = (typeof CONSUMER_ACTIVATION_IDS)[number];

export const CONSUMER_ACTIVATION_STATUSES = [
  'READY',
  'PINNED_PREVIOUS',
  'BLOCKED_LOCAL_DEPENDENCY',
  'SHADOW',
] as const;

export type ConsumerActivationStatus =
  (typeof CONSUMER_ACTIVATION_STATUSES)[number];

export function isConsumerActivationStatus(
  value: unknown,
): value is ConsumerActivationStatus {
  return (
    typeof value === 'string'
    && (CONSUMER_ACTIVATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isConsumerActivationId(
  value: unknown,
): value is ConsumerActivationId {
  return (
    typeof value === 'string'
    && (CONSUMER_ACTIVATION_IDS as readonly string[]).includes(value)
  );
}

export const ENGINEERING_CONSUMER_IDS = [
  'engineering-graph',
  'engineering-rag',
] as const satisfies readonly ConsumerActivationId[];

export const TEACHING_CONSUMER_IDS = [
  'course-runtime',
  'konling',
  'teaching-resource-rag',
  'learning-path',
] as const satisfies readonly ConsumerActivationId[];

export function consumerRequiresProjection(
  consumerId: ConsumerActivationId,
): boolean {
  return !(ENGINEERING_CONSUMER_IDS as readonly string[]).includes(consumerId);
}

/** Exact Authority + Projection combination bound to one consumer. */
export interface ConsumerVersionCombination {
  authorityReleaseId: string | null;
  authoritySnapshotId: string | null;
  authoritySnapshotHash: string | null;
  projectionId: string | null;
  projectionHash: string | null;
  /** Optional scope pin (course package / lesson). */
  scopeId: string | null;
  captureRevision: string | null;
}

export interface ConsumerActivationRecord {
  consumerId: ConsumerActivationId;
  status: ConsumerActivationStatus;
  combination: ConsumerVersionCombination;
  /** Prior combination retained for pin/rollback diagnostics. */
  priorCombination: ConsumerVersionCombination | null;
  /** Deterministic artifact digests this consumer depends on. */
  artifactHashes: Record<string, string>;
  /** Exact local dependency / readiness reasons. */
  reasons: string[];
  /** When this consumer last changed status under this activation. */
  activatedAt: string | null;
}

export interface ConsumerActivationManifest {
  contract: typeof CONSUMER_ACTIVATION_CONTRACT;
  activationId: string;
  activationHash: string;
  captureRevision: string | null;
  stagedAt: string;
  /** Full per-consumer map (sorted by consumerId when serialized for digests). */
  consumers: ConsumerActivationRecord[];
  /** Impact / readiness summary for diagnostics. */
  impact: {
    readyConsumerIds: ConsumerActivationId[];
    pinnedConsumerIds: ConsumerActivationId[];
    blockedConsumerIds: ConsumerActivationId[];
    shadowConsumerIds: ConsumerActivationId[];
  };
  /** Shadow evidence digest when present; null when not run. */
  shadowReportHash: string | null;
  /** Prior activation pointer target for rollback. */
  priorActivationId: string | null;
  priorActivationHash: string | null;
}

export interface ConsumerActivationCurrentPointer {
  contract: typeof CONSUMER_ACTIVATION_POINTER_CONTRACT;
  activationId: string;
  activationHash: string;
  activationReceiptId: string;
  activatedAt: string;
}

export interface ConsumerActivationStageReceipt {
  contract: typeof CONSUMER_ACTIVATION_STAGE_RECEIPT_CONTRACT;
  receiptId: string;
  activationId: string;
  activationHash: string;
  stagedAt: string;
  status: 'staged' | 'failed';
  reasons: string[];
  artifactHashes: Record<string, string>;
}

export interface ConsumerActivationReceipt {
  contract: typeof CONSUMER_ACTIVATION_RECEIPT_CONTRACT;
  receiptId: string;
  activationId: string;
  activationHash: string;
  previousActivationId: string | null;
  previousActivationHash: string | null;
  activatedAt: string;
  status: 'activated' | 'failed';
  advancedConsumerIds: ConsumerActivationId[];
  pinnedConsumerIds: ConsumerActivationId[];
  blockedConsumerIds: ConsumerActivationId[];
  shadowConsumerIds: ConsumerActivationId[];
  reasons: string[];
}

export interface ConsumerActivationRollbackReceipt {
  contract: typeof CONSUMER_ACTIVATION_ROLLBACK_RECEIPT_CONTRACT;
  receiptId: string;
  fromActivationId: string | null;
  fromActivationHash: string | null;
  toActivationId: string;
  toActivationHash: string;
  rolledBackAt: string;
  status: 'rolled-back' | 'failed';
  reasons: string[];
}

export type ShadowReadKind =
  | 'engineering-graph'
  | 'engineering-rag'
  | 'konling'
  | 'course-runtime'
  | 'teaching-resource-rag'
  | 'card'
  | 'textbook'
  | 'prerequisite'
  | 'learning-path';

export interface ShadowReadSample {
  kind: ShadowReadKind;
  consumerId: ConsumerActivationId;
  /** Stable identity fields compared between old and new. */
  identity: Record<string, string | null>;
  readiness: string;
}

export interface ShadowDiscrepancy {
  kind: ShadowReadKind;
  consumerId: ConsumerActivationId;
  field: string;
  previous: string | null;
  next: string | null;
  reason: string;
}

export interface ConsumerActivationShadowReport {
  contract: typeof CONSUMER_ACTIVATION_SHADOW_REPORT_CONTRACT;
  activationId: string;
  reportHash: string;
  comparedAt: string;
  previousActivationId: string | null;
  samples: {
    previous: ShadowReadSample[];
    next: ShadowReadSample[];
  };
  discrepancies: ShadowDiscrepancy[];
  /**
   * Always true for a valid report: shadow never writes LearningFact,
   * teaching decisions, or upstream relations.
   */
  writesLearningFact: false;
  writesTeachingDecision: false;
  writesUpstreamRelation: false;
  mutatesSelectorOutsideActivationPointer: false;
}

export class ConsumerActivationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ConsumerActivationError';
    this.code = code;
  }
}

export function emptyCombination(): ConsumerVersionCombination {
  return {
    authorityReleaseId: null,
    authoritySnapshotId: null,
    authoritySnapshotHash: null,
    projectionId: null,
    projectionHash: null,
    scopeId: null,
    captureRevision: null,
  };
}

export function combinationEqual(
  a: ConsumerVersionCombination | null | undefined,
  b: ConsumerVersionCombination | null | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.authorityReleaseId === b.authorityReleaseId
    && a.authoritySnapshotId === b.authoritySnapshotId
    && a.authoritySnapshotHash === b.authoritySnapshotHash
    && a.projectionId === b.projectionId
    && a.projectionHash === b.projectionHash
    && a.scopeId === b.scopeId
    && a.captureRevision === b.captureRevision
  );
}
