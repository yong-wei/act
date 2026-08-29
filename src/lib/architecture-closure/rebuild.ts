import { publicObservationIdentity } from './observation-identity';
import { CLOSURE_OWNER } from './stages';
import {
  AUTHORITY_INPUT_IDS,
  CLOSURE_SCHEMA_VERSION,
  CLOSURE_STATUSES,
  EVIDENCE_CLASSES,
  OBSERVATION_CLASSES,
  REQUIRED_TERMINAL_STAGE_IDS,
  WORKTREE_ROLES,
} from './types';
import type {
  BlockedRecord,
  ClosureStatus,
  ClosureTotals,
  CompatibilityRecord,
  NormalizedClosureReceipt,
  NormalizedMetric,
  NormalizedObservation,
  ReceiptIdentity,
  SourceIdentity,
  TerminalCoverage,
} from './types';

const GIT_SHA = /^[a-f0-9]{40}$/u;
const RELATIVE_PATH = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u;
const KNOWN_STAGE_IDS = new Set<string>([...REQUIRED_TERMINAL_STAGE_IDS, ...AUTHORITY_INPUT_IDS]);

export function emptyTotals(): ClosureTotals {
  return { discovered: 0, included: 0, excluded: 0, duplicate: 0, unresolved: 0 };
}

export function asSafeCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

export function rebuildTotals(value: unknown): ClosureTotals {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    discovered: asSafeCount(record.discovered),
    included: asSafeCount(record.included),
    excluded: asSafeCount(record.excluded),
    duplicate: asSafeCount(record.duplicate),
    unresolved: asSafeCount(record.unresolved),
  };
}

function asGitSha(value: string): string {
  return GIT_SHA.test(value) ? value : '0'.repeat(40);
}

function asStatus(value: unknown): ClosureStatus {
  return (CLOSURE_STATUSES as readonly string[]).includes(String(value))
    ? value as ClosureStatus
    : 'unresolved';
}

function knownCoverageIds(values: readonly string[]): string[] {
  return values.filter((value) => KNOWN_STAGE_IDS.has(value));
}

function rebuildCoverage(coverage: TerminalCoverage): TerminalCoverage {
  return {
    expected: [...REQUIRED_TERMINAL_STAGE_IDS],
    present: knownCoverageIds(coverage.present),
    missing: knownCoverageIds(coverage.missing),
    duplicate: knownCoverageIds(coverage.duplicate),
    stale: knownCoverageIds(coverage.stale),
    blocked: knownCoverageIds(coverage.blocked),
    unresolved: knownCoverageIds(coverage.unresolved),
  };
}

function rebuildIdentity(identity: ReceiptIdentity): ReceiptIdentity {
  return {
    stageId: identity.stageId,
    receiptId: identity.receiptId,
    contentDigest: identity.contentDigest,
    schemaVersion: identity.schemaVersion,
    owner: identity.owner,
    scope: identity.scope,
    sourceCommit: identity.sourceCommit,
    sourceTree: identity.sourceTree,
    producerChange: identity.producerChange,
    producerRevision: identity.producerRevision,
    status: asStatus(identity.status),
    current: identity.current === true,
    evidenceClass: (EVIDENCE_CLASSES as readonly string[]).includes(identity.evidenceClass)
      ? identity.evidenceClass
      : 'receipt',
  };
}

function rebuildObservation(observation: NormalizedObservation): NormalizedObservation {
  const next: {
    identity: string;
    classification: NormalizedObservation['classification'];
    sourceStageId: string;
    worktreeRole?: NormalizedObservation['worktreeRole'];
    path?: string;
    contentDigest?: string;
  } = {
    identity: publicObservationIdentity(observation.identity, observation.sourceStageId).identity,
    classification: (OBSERVATION_CLASSES as readonly string[]).includes(observation.classification)
      ? observation.classification
      : 'unresolved',
    sourceStageId: observation.sourceStageId,
  };
  if (observation.worktreeRole && (WORKTREE_ROLES as readonly string[]).includes(observation.worktreeRole)) {
    next.worktreeRole = observation.worktreeRole;
  }
  if (observation.path && RELATIVE_PATH.test(observation.path)) {
    next.path = observation.path;
  }
  if (observation.contentDigest) {
    next.contentDigest = observation.contentDigest;
  }
  return next;
}

function rebuildMetric(metric: NormalizedMetric): NormalizedMetric {
  return {
    metricId: metric.metricId,
    scope: metric.scope,
    unit: metric.unit,
    value: metric.value,
    sourceReceiptId: metric.sourceReceiptId,
    sourceField: metric.sourceField,
    status: asStatus(metric.status),
  };
}

function rebuildCompatibility(record: CompatibilityRecord): CompatibilityRecord {
  return {
    identity: record.identity,
    owner: record.owner,
    inClosureScope: record.inClosureScope === true,
    deletionProof: typeof record.deletionProof === 'string' ? record.deletionProof : null,
    reason: record.reason,
    resolutionCondition: record.resolutionCondition,
  };
}

function rebuildBlocked(record: BlockedRecord): BlockedRecord {
  return {
    identity: record.identity,
    owner: record.owner,
    sourceReceiptId: record.sourceReceiptId,
    reason: record.reason,
    resolutionCondition: record.resolutionCondition,
  };
}

export interface PublicReceiptParts {
  readonly sourceIdentity: SourceIdentity;
  readonly inputReceiptIdentities: readonly ReceiptIdentity[];
  readonly observations: readonly NormalizedObservation[];
  readonly beforeMetrics: readonly NormalizedMetric[];
  readonly afterMetrics: readonly NormalizedMetric[];
  readonly totals: ClosureTotals;
  readonly terminalCoverage: TerminalCoverage;
  readonly remainingCompatibilityRecords: readonly CompatibilityRecord[];
  readonly blockedRecords: readonly BlockedRecord[];
  readonly status: ClosureStatus;
}

export function rebuildPublicReceipt(parts: PublicReceiptParts): Omit<NormalizedClosureReceipt, 'receiptId'> {
  return {
    schemaVersion: CLOSURE_SCHEMA_VERSION,
    sourceIdentity: {
      sourceCommit: asGitSha(parts.sourceIdentity.sourceCommit),
      sourceTree: asGitSha(parts.sourceIdentity.sourceTree),
    },
    inputReceiptIdentities: parts.inputReceiptIdentities.map(rebuildIdentity),
    observations: parts.observations.map(rebuildObservation),
    beforeMetrics: parts.beforeMetrics.map(rebuildMetric),
    afterMetrics: parts.afterMetrics.map(rebuildMetric),
    totals: rebuildTotals(parts.totals),
    terminalCoverage: rebuildCoverage(parts.terminalCoverage),
    remainingCompatibilityRecords: parts.remainingCompatibilityRecords.map(rebuildCompatibility),
    blockedRecords: parts.blockedRecords.map(rebuildBlocked),
    status: asStatus(parts.status),
  };
}

export function privacyFallbackReceipt(sourceIdentity: SourceIdentity): Omit<NormalizedClosureReceipt, 'receiptId'> {
  return rebuildPublicReceipt({
    sourceIdentity,
    inputReceiptIdentities: [],
    observations: [],
    beforeMetrics: [],
    afterMetrics: [],
    totals: emptyTotals(),
    terminalCoverage: {
      expected: [...REQUIRED_TERMINAL_STAGE_IDS],
      present: [],
      missing: [...REQUIRED_TERMINAL_STAGE_IDS],
      duplicate: [],
      stale: [],
      blocked: [],
      unresolved: [],
    },
    remainingCompatibilityRecords: [],
    blockedRecords: [{
      identity: 'privacy-violation',
      owner: CLOSURE_OWNER,
      sourceReceiptId: '0'.repeat(64),
      reason: 'privacy-violation',
      resolutionCondition: 'remove-secrets-absolute-paths-raw-payloads-and-user-identifiers',
    }],
    status: 'unresolved',
  });
}
