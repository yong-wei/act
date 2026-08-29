export const CLOSURE_SCHEMA_VERSION = 'act-modular-monolith-closure/v1' as const;
export const CLOSURE_MANIFEST_SCHEMA_VERSION = 'act-modular-monolith-closure-manifest/v1' as const;

export const REQUIRED_TERMINAL_STAGE_IDS = [
  'governance-1548',
  'quality-1554',
  'toolchain-1557',
  'toolchain-1558',
  'toolchain-1559',
  'assessment-personalization-1567',
  'course-classroom-1576',
  'learning-record-1587',
  'knowledge-resource-1592',
  'practice-1602',
  'assignment-retirement-1607',
  'generated-content-reconciliation-1608',
] as const;

export const AUTHORITY_INPUT_IDS = [
  'baseline',
  'charter',
  'dependency',
  'fitness',
  'qa',
] as const;

export const CLOSURE_STATUSES = ['qualified', 'blocked', 'observed', 'unresolved'] as const;
export const OBSERVATION_CLASSES = ['included', 'excluded', 'duplicate', 'unresolved'] as const;
export const EVIDENCE_CLASSES = ['receipt', 'proposal', 'issue', 'task', 'archive'] as const;
export const METRIC_PHASES = ['before', 'after'] as const;
export const WORKTREE_ROLES = ['main', 'isolated'] as const;

export type TerminalStageId = (typeof REQUIRED_TERMINAL_STAGE_IDS)[number];
export type AuthorityInputId = (typeof AUTHORITY_INPUT_IDS)[number];
export type ClosureStatus = (typeof CLOSURE_STATUSES)[number];
export type ObservationClass = (typeof OBSERVATION_CLASSES)[number];
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];
export type MetricPhase = (typeof METRIC_PHASES)[number];
export type WorktreeRole = (typeof WORKTREE_ROLES)[number];

export interface ClosureCapture {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
  readonly detachedUnresolved: boolean;
}

export interface ClosureTotals {
  readonly discovered: number;
  readonly included: number;
  readonly excluded: number;
  readonly duplicate: number;
  readonly unresolved: number;
}

export interface ClosureObservation {
  readonly identity: string;
  readonly classification: ObservationClass;
  readonly worktreeRole?: WorktreeRole;
  readonly path?: string;
  readonly contentDigest?: string;
  readonly reason?: string;
}

export interface ClosureMetric {
  readonly metricId: string;
  readonly scope: string;
  readonly unit: string;
  readonly value: number | string;
  readonly sourceField: string;
  readonly phase: MetricPhase;
  readonly status: ClosureStatus;
}

export interface CompatibilityRecord {
  readonly identity: string;
  readonly owner: string;
  readonly inClosureScope: boolean;
  readonly deletionProof: string | null;
  readonly reason: string;
  readonly resolutionCondition: string;
}

export interface BlockedRecord {
  readonly identity: string;
  readonly owner: string;
  readonly sourceReceiptId: string;
  readonly reason: string;
  readonly resolutionCondition: string;
}

export interface ClosureInputReceipt {
  readonly stageId: string;
  readonly receiptId: string;
  readonly contentDigest: string;
  readonly schemaVersion: string;
  readonly owner: string;
  readonly scope: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly producerChange: string;
  readonly producerRevision: string;
  readonly status: ClosureStatus;
  readonly current: boolean;
  readonly evidenceClass: EvidenceClass;
  readonly conclusion: string;
  readonly observations: readonly ClosureObservation[];
  readonly totals: ClosureTotals;
  readonly metrics: readonly ClosureMetric[];
  readonly compatibilityRecords: readonly CompatibilityRecord[];
  readonly blockedRecords: readonly BlockedRecord[];
}

export interface ClosureManifest {
  readonly schemaVersion: typeof CLOSURE_MANIFEST_SCHEMA_VERSION;
  readonly inputs: Record<AuthorityInputId, ClosureInputReceipt>;
  readonly terminals: readonly ClosureInputReceipt[];
  readonly competingAggregators?: readonly string[];
}

export interface ClosureFailure {
  readonly code: string;
  readonly stageId?: string;
  readonly identity?: string;
  readonly detail?: string;
}

export interface ReceiptIdentity {
  readonly stageId: string;
  readonly receiptId: string;
  readonly contentDigest: string;
  readonly schemaVersion: string;
  readonly owner: string;
  readonly scope: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly producerChange: string;
  readonly producerRevision: string;
  readonly status: ClosureStatus;
  readonly current: boolean;
  readonly evidenceClass: EvidenceClass;
}

export interface NormalizedMetric {
  readonly metricId: string;
  readonly scope: string;
  readonly unit: string;
  readonly value: number | string;
  readonly sourceReceiptId: string;
  readonly sourceField: string;
  readonly status: ClosureStatus;
}

export interface TerminalCoverage {
  readonly expected: readonly string[];
  readonly present: readonly string[];
  readonly missing: readonly string[];
  readonly duplicate: readonly string[];
  readonly stale: readonly string[];
  readonly blocked: readonly string[];
  readonly unresolved: readonly string[];
}

export interface SourceIdentity {
  readonly sourceCommit: string;
  readonly sourceTree: string;
}

export interface NormalizedClosureReceipt {
  readonly schemaVersion: typeof CLOSURE_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly sourceIdentity: SourceIdentity;
  readonly inputReceiptIdentities: readonly ReceiptIdentity[];
  readonly beforeMetrics: readonly NormalizedMetric[];
  readonly afterMetrics: readonly NormalizedMetric[];
  readonly totals: ClosureTotals;
  readonly terminalCoverage: TerminalCoverage;
  readonly remainingCompatibilityRecords: readonly CompatibilityRecord[];
  readonly blockedRecords: readonly BlockedRecord[];
  readonly status: ClosureStatus;
}

export interface ClosureGeneration {
  readonly receipt: NormalizedClosureReceipt;
  readonly serialized: string;
  readonly digest: string;
  readonly failures: readonly ClosureFailure[];
}
