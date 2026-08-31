import {
  CLOSURE_STATUSES,
  EVIDENCE_CLASSES,
  METRIC_PHASES,
  OBSERVATION_CLASSES,
  WORKTREE_ROLES,
} from './types';
import type {
  BlockedRecord,
  ClosureFailure,
  ClosureInputReceipt,
  ClosureMetric,
  ClosureObservation,
  ClosureStatus,
  ClosureTotals,
  CompatibilityRecord,
  EvidenceClass,
  MetricPhase,
  ObservationClass,
  WorktreeRole,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : null;
}

function requireObjectArray(
  value: unknown,
): readonly Record<string, unknown>[] | null {
  if (!Array.isArray(value)) return null;
  const items: Record<string, unknown>[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    items.push(item);
  }
  return items;
}

function parseTotals(value: unknown): ClosureTotals | null {
  if (!isRecord(value)) return null;
  const discovered = asCount(value.discovered);
  const included = asCount(value.included);
  const excluded = asCount(value.excluded);
  const duplicate = asCount(value.duplicate);
  const unresolved = asCount(value.unresolved);
  if (
    discovered === null
    || included === null
    || excluded === null
    || duplicate === null
    || unresolved === null
  ) {
    return null;
  }
  return { discovered, included, excluded, duplicate, unresolved };
}

function parseObservation(
  value: Record<string, unknown>,
  stageId: string,
  failures: ClosureFailure[],
): ClosureObservation | null {
  const identity = asNonEmptyString(value.identity);
  const classification = asEnum(value.classification, OBSERVATION_CLASSES);
  if (!identity) {
    failures.push({ code: 'missing-observation-identity', stageId });
    return null;
  }
  if (!classification) {
    failures.push({
      code: 'invalid-observation-class',
      stageId,
      identity,
      detail: String(value.classification),
    });
    return null;
  }
  const observation: {
    identity: string;
    classification: ObservationClass;
    worktreeRole?: WorktreeRole;
    path?: string;
    contentDigest?: string;
    reason?: string;
  } = { identity, classification };
  if (value.worktreeRole !== undefined) {
    const worktreeRole = asEnum(value.worktreeRole, WORKTREE_ROLES);
    if (!worktreeRole) {
      failures.push({ code: 'invalid-observation-class', stageId, identity, detail: 'worktreeRole' });
      return null;
    }
    observation.worktreeRole = worktreeRole;
  }
  if (value.path !== undefined) {
    const path = asNonEmptyString(value.path);
    if (!path) {
      failures.push({ code: 'invalid-observation-class', stageId, identity, detail: 'path' });
      return null;
    }
    observation.path = path;
  }
  if (value.contentDigest !== undefined) {
    const contentDigest = asNonEmptyString(value.contentDigest);
    if (!contentDigest) {
      failures.push({ code: 'invalid-observation-class', stageId, identity, detail: 'contentDigest' });
      return null;
    }
    observation.contentDigest = contentDigest;
  }
  if (value.reason !== undefined) {
    const reason = asNonEmptyString(value.reason);
    if (!reason) {
      failures.push({ code: 'invalid-observation-class', stageId, identity, detail: 'reason' });
      return null;
    }
    observation.reason = reason;
  }
  return observation;
}

function parseMetric(
  value: Record<string, unknown>,
  stageId: string,
  failures: ClosureFailure[],
): ClosureMetric | null {
  const metricId = asNonEmptyString(value.metricId);
  const scope = asNonEmptyString(value.scope);
  const unit = asNonEmptyString(value.unit);
  const sourceField = asNonEmptyString(value.sourceField);
  const phase = asEnum(value.phase, METRIC_PHASES);
  const status = asEnum(value.status, CLOSURE_STATUSES);
  const identity = `${String(metricId)}|${String(scope)}|${String(unit)}`;
  if (!status) {
    failures.push({ code: 'invalid-metric-status', stageId, identity, detail: String(value.status) });
    return null;
  }
  if (!phase) {
    failures.push({ code: 'invalid-metric-phase', stageId, identity, detail: String(value.phase) });
    return null;
  }
  const valueOk = value.value !== undefined
    && value.value !== null
    && (
      (typeof value.value === 'number' && Number.isFinite(value.value))
      || (typeof value.value === 'string' && value.value.length > 0)
    );
  if (!metricId || !scope || !unit || !sourceField || !valueOk) {
    failures.push({ code: 'missing-metric-value', stageId, identity });
    return null;
  }
  return {
    metricId,
    scope,
    unit,
    value: value.value as number | string,
    sourceField,
    phase: phase as MetricPhase,
    status,
  };
}

function parseCompatibility(value: Record<string, unknown>): CompatibilityRecord | null {
  const identity = asNonEmptyString(value.identity);
  const owner = asNonEmptyString(value.owner);
  const reason = asNonEmptyString(value.reason);
  const resolutionCondition = asNonEmptyString(value.resolutionCondition);
  if (!identity || !owner || !reason || !resolutionCondition) return null;
  if (typeof value.inClosureScope !== 'boolean') return null;
  if (value.deletionProof !== null && typeof value.deletionProof !== 'string') return null;
  return {
    identity,
    owner,
    inClosureScope: value.inClosureScope,
    deletionProof: value.deletionProof,
    reason,
    resolutionCondition,
  };
}

function parseBlocked(value: Record<string, unknown>): BlockedRecord | null {
  const identity = asNonEmptyString(value.identity);
  const owner = asNonEmptyString(value.owner);
  const sourceReceiptId = asNonEmptyString(value.sourceReceiptId);
  const reason = asNonEmptyString(value.reason);
  const resolutionCondition = asNonEmptyString(value.resolutionCondition);
  if (!identity || !owner || !sourceReceiptId || !reason || !resolutionCondition) return null;
  return { identity, owner, sourceReceiptId, reason, resolutionCondition };
}

export function parseClosureInputReceipt(
  value: unknown,
  stageId: string,
  failures: ClosureFailure[],
): ClosureInputReceipt | null {
  if (!isRecord(value)) {
    failures.push({ code: 'missing-input', stageId });
    return null;
  }

  const observationsRaw = requireObjectArray(value.observations);
  const metricsRaw = requireObjectArray(value.metrics);
  const compatibilityRaw = requireObjectArray(value.compatibilityRecords);
  const blockedRaw = requireObjectArray(value.blockedRecords);
  const totals = parseTotals(value.totals);
  if (!observationsRaw || !metricsRaw || !compatibilityRaw || !blockedRaw || !totals) {
    failures.push({ code: 'invalid-receipt-payload', stageId });
    return null;
  }

  const observations: ClosureObservation[] = [];
  for (const item of observationsRaw) {
    const parsed = parseObservation(item, stageId, failures);
    if (!parsed) {
      failures.push({ code: 'invalid-receipt-payload', stageId });
      return null;
    }
    observations.push(parsed);
  }

  const compatibilityRecords: CompatibilityRecord[] = [];
  for (const item of compatibilityRaw) {
    const parsed = parseCompatibility(item);
    if (!parsed) {
      failures.push({ code: 'invalid-receipt-payload', stageId });
      return null;
    }
    compatibilityRecords.push(parsed);
  }

  const blockedRecords: BlockedRecord[] = [];
  for (const item of blockedRaw) {
    const parsed = parseBlocked(item);
    if (!parsed) {
      failures.push({ code: 'invalid-receipt-payload', stageId });
      return null;
    }
    blockedRecords.push(parsed);
  }

  const metrics: ClosureMetric[] = [];
  for (const item of metricsRaw) {
    const parsed = parseMetric(item, stageId, failures);
    if (parsed) metrics.push(parsed);
  }

  const required = [
    'receiptId', 'contentDigest', 'schemaVersion', 'owner', 'scope',
    'sourceCommit', 'sourceTree', 'producerChange', 'producerRevision',
  ] as const;
  for (const field of required) {
    if (!asNonEmptyString(value[field])) {
      failures.push({ code: 'invalid-receipt-identity', stageId, identity: field });
    }
  }

  const status = asEnum(value.status, CLOSURE_STATUSES);
  if (!status) {
    failures.push({ code: 'invalid-receipt-status', stageId, identity: String(value.status) });
  }
  const evidenceClass = asEnum(value.evidenceClass, EVIDENCE_CLASSES);
  if (!evidenceClass) {
    failures.push({ code: 'invalid-evidence-class', stageId, identity: String(value.evidenceClass) });
  }

  return {
    stageId: asNonEmptyString(value.stageId) ?? stageId,
    receiptId: asNonEmptyString(value.receiptId) ?? '',
    contentDigest: asNonEmptyString(value.contentDigest) ?? '',
    schemaVersion: asNonEmptyString(value.schemaVersion) ?? '',
    owner: asNonEmptyString(value.owner) ?? '',
    scope: asNonEmptyString(value.scope) ?? '',
    sourceCommit: asNonEmptyString(value.sourceCommit) ?? '',
    sourceTree: asNonEmptyString(value.sourceTree) ?? '',
    producerChange: asNonEmptyString(value.producerChange) ?? '',
    producerRevision: asNonEmptyString(value.producerRevision) ?? '',
    status: (status ?? 'unresolved') as ClosureStatus,
    current: value.current === true,
    evidenceClass: (evidenceClass ?? 'receipt') as EvidenceClass,
    conclusion: asNonEmptyString(value.conclusion) ?? '',
    observations,
    totals,
    metrics,
    compatibilityRecords,
    blockedRecords,
  };
}
