import type { CharacterizationFinding } from './characterize';
import { privacyViolation, serializeDeterministic, sha256Text } from './serialize';
import { allInputReceipts, isTerminalStageId, sortedUnique } from './stages';
import {
  AUTHORITY_INPUT_IDS,
  CLOSURE_MANIFEST_SCHEMA_VERSION,
  CLOSURE_SCHEMA_VERSION,
  CLOSURE_STATUSES,
  EVIDENCE_CLASSES,
  OBSERVATION_CLASSES,
  REQUIRED_TERMINAL_STAGE_IDS,
} from './types';
import type {
  BlockedRecord,
  ClosureCapture,
  ClosureFailure,
  ClosureGeneration,
  ClosureInputReceipt,
  ClosureManifest,
  ClosureObservation,
  ClosureStatus,
  ClosureTotals,
  CompatibilityRecord,
  NormalizedClosureReceipt,
  NormalizedMetric,
  ReceiptIdentity,
  TerminalCoverage,
} from './types';

const GIT_SHA = /^[a-f0-9]{40}$/u;

function emptyTotals(): ClosureTotals {
  return { discovered: 0, included: 0, excluded: 0, duplicate: 0, unresolved: 0 };
}

function addTotals(left: ClosureTotals, right: ClosureTotals): ClosureTotals {
  return {
    discovered: left.discovered + right.discovered,
    included: left.included + right.included,
    excluded: left.excluded + right.excluded,
    duplicate: left.duplicate + right.duplicate,
    unresolved: left.unresolved + right.unresolved,
  };
}

function totalsClosed(totals: ClosureTotals): boolean {
  return totals.discovered === totals.included + totals.excluded + totals.duplicate + totals.unresolved;
}

function countedTotals(observations: readonly ClosureObservation[]): ClosureTotals {
  const totals = emptyTotals();
  const next = { ...totals };
  next.discovered = observations.length;
  for (const observation of observations) {
    next[observation.classification] += 1;
  }
  return next;
}

function asStatus(value: unknown): ClosureStatus | null {
  return (CLOSURE_STATUSES as readonly string[]).includes(String(value)) ? value as ClosureStatus : null;
}

function identityOf(receipt: ClosureInputReceipt): ReceiptIdentity {
  return {
    stageId: receipt.stageId,
    receiptId: receipt.receiptId,
    contentDigest: receipt.contentDigest,
    schemaVersion: receipt.schemaVersion,
    owner: receipt.owner,
    scope: receipt.scope,
    sourceCommit: receipt.sourceCommit,
    sourceTree: receipt.sourceTree,
    producerChange: receipt.producerChange,
    producerRevision: receipt.producerRevision,
    status: receipt.status,
    current: receipt.current,
    evidenceClass: receipt.evidenceClass,
  };
}

function compareIdentity(left: string, right: string): number {
  return left.localeCompare(right);
}

function observationIdentity(observation: ClosureObservation): string {
  if (observation.path && observation.contentDigest) {
    const role = observation.worktreeRole ?? 'main';
    return `${role}:${observation.path}:${observation.contentDigest}`;
  }
  return observation.identity;
}

function validateReceiptShape(receipt: ClosureInputReceipt | undefined, stageId: string, failures: ClosureFailure[]): receipt is ClosureInputReceipt {
  if (!receipt) {
    failures.push({ code: 'missing-input', stageId });
    return false;
  }
  const required = [
    'receiptId', 'contentDigest', 'schemaVersion', 'owner', 'scope',
    'sourceCommit', 'sourceTree', 'producerChange', 'producerRevision',
  ] as const;
  for (const field of required) {
    if (!receipt[field] || typeof receipt[field] !== 'string') {
      failures.push({ code: 'invalid-receipt-identity', stageId, identity: field });
    }
  }
  if (!asStatus(receipt.status)) {
    failures.push({ code: 'invalid-receipt-status', stageId, identity: String(receipt.status) });
  }
  if (!(EVIDENCE_CLASSES as readonly string[]).includes(receipt.evidenceClass)) {
    failures.push({ code: 'invalid-evidence-class', stageId, identity: String(receipt.evidenceClass) });
  }
  if (!Array.isArray(receipt.observations) || !receipt.totals || !Array.isArray(receipt.metrics)) {
    failures.push({ code: 'invalid-receipt-payload', stageId });
    return false;
  }
  return true;
}

function validateDenominator(receipt: ClosureInputReceipt, failures: ClosureFailure[]): void {
  const counted = countedTotals(receipt.observations);
  for (const observation of receipt.observations) {
    if (!(OBSERVATION_CLASSES as readonly string[]).includes(observation.classification)) {
      failures.push({ code: 'invalid-observation-class', stageId: receipt.stageId, identity: observation.identity });
    }
    if (!observation.identity) {
      failures.push({ code: 'missing-observation-identity', stageId: receipt.stageId });
    }
  }
  if (!totalsClosed(receipt.totals)) {
    failures.push({ code: 'denominator-mismatch', stageId: receipt.stageId, detail: 'declared-totals' });
  }
  if (
    counted.discovered !== receipt.totals.discovered
    || counted.included !== receipt.totals.included
    || counted.excluded !== receipt.totals.excluded
    || counted.duplicate !== receipt.totals.duplicate
    || counted.unresolved !== receipt.totals.unresolved
  ) {
    failures.push({ code: 'denominator-mismatch', stageId: receipt.stageId, detail: 'observation-count' });
  }
}

function pathConflicts(receipt: ClosureInputReceipt, failures: ClosureFailure[]): void {
  const byPath = new Map<string, ClosureObservation[]>();
  for (const observation of receipt.observations) {
    if (!observation.path) continue;
    const list = byPath.get(observation.path) ?? [];
    list.push(observation);
    byPath.set(observation.path, list);
  }
  for (const [path, group] of [...byPath.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const digests = new Set(group.map((item) => item.contentDigest ?? ''));
    if (digests.size <= 1) continue;
    const identities = new Set(group.map(observationIdentity));
    if (identities.size < group.length) {
      failures.push({ code: 'worktree-path-conflict', stageId: receipt.stageId, identity: path });
    }
    for (const observation of group) {
      if (observation.classification !== 'duplicate' && observation.classification !== 'unresolved') {
        failures.push({ code: 'worktree-path-conflict', stageId: receipt.stageId, identity: observationIdentity(observation) });
      }
    }
  }
}

function duplicateIdentities(receipt: ClosureInputReceipt, failures: ClosureFailure[]): void {
  const seen = new Map<string, number>();
  for (const observation of receipt.observations) {
    const identity = observationIdentity(observation);
    seen.set(identity, (seen.get(identity) ?? 0) + 1);
  }
  for (const [identity, count] of [...seen.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (count > 1) failures.push({ code: 'duplicate-identity', stageId: receipt.stageId, identity });
  }
}

function isCurrentTerminal(receipt: ClosureInputReceipt, capture: ClosureCapture): boolean {
  return receipt.evidenceClass === 'receipt'
    && receipt.current === true
    && receipt.sourceCommit === capture.sourceCommit
    && receipt.sourceTree === capture.sourceTree
    && Boolean(asStatus(receipt.status));
}

function buildCoverage(terminals: readonly ClosureInputReceipt[], capture: ClosureCapture, failures: ClosureFailure[]): TerminalCoverage {
  const expected = [...REQUIRED_TERMINAL_STAGE_IDS];
  const grouped = new Map<string, ClosureInputReceipt[]>();
  for (const terminal of terminals) {
    const list = grouped.get(terminal.stageId) ?? [];
    list.push(terminal);
    grouped.set(terminal.stageId, list);
  }
  const present: string[] = [];
  const missing: string[] = [];
  const duplicate: string[] = [];
  const stale: string[] = [];
  const blocked: string[] = [];
  const unresolved: string[] = [];

  for (const stageId of expected) {
    const group = grouped.get(stageId) ?? [];
    if (group.length === 0) {
      missing.push(stageId);
      failures.push({ code: 'missing-terminal', stageId });
      continue;
    }
    if (group.length > 1) {
      duplicate.push(stageId);
      failures.push({ code: 'duplicate-terminal', stageId });
      continue;
    }
    const terminal = group[0]!;
    if (terminal.evidenceClass !== 'receipt') {
      unresolved.push(stageId);
      failures.push({ code: 'non-receipt-evidence', stageId, identity: terminal.evidenceClass });
      continue;
    }
    if (!terminal.current || terminal.sourceCommit !== capture.sourceCommit || terminal.sourceTree !== capture.sourceTree) {
      stale.push(stageId);
      failures.push({ code: 'stale-terminal', stageId, identity: terminal.receiptId });
      continue;
    }
    if (terminal.status === 'unresolved') {
      unresolved.push(stageId);
      continue;
    }
    if (terminal.status === 'blocked') {
      blocked.push(stageId);
      present.push(stageId);
      continue;
    }
    if (!isCurrentTerminal(terminal, capture)) {
      unresolved.push(stageId);
      failures.push({ code: 'unresolved-terminal', stageId });
      continue;
    }
    present.push(stageId);
  }

  for (const stageId of [...grouped.keys()].sort(compareIdentity)) {
    if (!isTerminalStageId(stageId)) {
      unresolved.push(stageId);
      failures.push({ code: 'unknown-terminal-stage', stageId });
    }
  }

  return {
    expected,
    present: sortedUnique(present),
    missing: sortedUnique(missing),
    duplicate: sortedUnique(duplicate),
    stale: sortedUnique(stale),
    blocked: sortedUnique(blocked),
    unresolved: sortedUnique(unresolved),
  };
}

function collectMetrics(receipts: readonly ClosureInputReceipt[], failures: ClosureFailure[]): {
  beforeMetrics: NormalizedMetric[];
  afterMetrics: NormalizedMetric[];
} {
  const beforeMetrics: NormalizedMetric[] = [];
  const afterMetrics: NormalizedMetric[] = [];
  const seen = new Map<string, { phase: string; receiptId: string }[]>();

  for (const receipt of receipts) {
    for (const metric of receipt.metrics) {
      const key = `${metric.metricId}|${metric.scope}|${metric.unit}`;
      const bucket = seen.get(key) ?? [];
      bucket.push({ phase: metric.phase, receiptId: receipt.receiptId });
      seen.set(key, bucket);
      const normalized: NormalizedMetric = {
        metricId: metric.metricId,
        scope: metric.scope,
        unit: metric.unit,
        value: metric.value,
        sourceReceiptId: receipt.receiptId,
        sourceField: metric.sourceField,
        status: metric.status,
      };
      if (metric.phase === 'before') beforeMetrics.push(normalized);
      else if (metric.phase === 'after') afterMetrics.push(normalized);
      else failures.push({ code: 'invalid-metric-phase', stageId: receipt.stageId, identity: key });
      if (metric.value === undefined || metric.value === null || metric.unit === '' || !metric.sourceField) {
        failures.push({ code: 'missing-metric-value', stageId: receipt.stageId, identity: key });
      }
    }
  }

  for (const [key, entries] of [...seen.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const befores = entries.filter((item) => item.phase === 'before');
    const afters = entries.filter((item) => item.phase === 'after');
    if (befores.length > 1 || afters.length > 1) {
      failures.push({ code: 'duplicate-metric', identity: key });
    }
    if (befores.length === 0 || afters.length === 0) {
      failures.push({ code: 'missing-metric-pair', identity: key });
    }
  }

  const byKey = (item: NormalizedMetric) => `${item.metricId}|${item.scope}|${item.unit}|${item.sourceReceiptId}`;
  beforeMetrics.sort((left, right) => byKey(left).localeCompare(byKey(right)));
  afterMetrics.sort((left, right) => byKey(left).localeCompare(byKey(right)));
  return { beforeMetrics, afterMetrics };
}

function decideStatus(args: {
  failures: readonly ClosureFailure[];
  capture: ClosureCapture;
  coverage: TerminalCoverage;
  receipts: readonly ClosureInputReceipt[];
  competing: readonly CharacterizationFinding[];
}): ClosureStatus {
  const { failures, capture, coverage, receipts, competing } = args;
  if (
    capture.dirty
    || capture.mixedWorktree
    || capture.detachedUnresolved
    || !GIT_SHA.test(capture.sourceCommit)
    || !GIT_SHA.test(capture.sourceTree)
    || competing.length > 0
    || coverage.missing.length > 0
    || coverage.duplicate.length > 0
    || coverage.stale.length > 0
    || coverage.unresolved.length > 0
    || failures.some((item) => item.code !== 'blocked-terminal' && item.code !== 'blocking-compatibility')
    || receipts.some((item) => item.status === 'unresolved' || item.observations.some((row) => row.classification === 'unresolved'))
  ) {
    return 'unresolved';
  }
  const blockingCompatibility = receipts.flatMap((item) => item.compatibilityRecords)
    .some((record) => record.inClosureScope && !record.deletionProof);
  if (coverage.blocked.length > 0 || receipts.some((item) => item.status === 'blocked') || blockingCompatibility) {
    return 'blocked';
  }
  if (receipts.some((item) => item.status === 'observed')) return 'observed';
  if (receipts.every((item) => item.status === 'qualified' && item.evidenceClass === 'receipt' && item.current)) {
    return 'qualified';
  }
  return 'observed';
}

function sanitizeReceipt(receipt: NormalizedClosureReceipt): NormalizedClosureReceipt {
  const serialized = serializeDeterministic(receipt);
  if (!privacyViolation(serialized)) return receipt;
  return {
    schemaVersion: CLOSURE_SCHEMA_VERSION,
    receiptId: receipt.receiptId,
    sourceIdentity: receipt.sourceIdentity,
    inputReceiptIdentities: receipt.inputReceiptIdentities.map((item) => ({
      ...item,
      owner: item.owner,
      scope: item.scope,
    })),
    beforeMetrics: [],
    afterMetrics: [],
    totals: receipt.totals,
    terminalCoverage: receipt.terminalCoverage,
    remainingCompatibilityRecords: [],
    blockedRecords: [{
      identity: 'privacy-violation',
      owner: 'platform',
      sourceReceiptId: receipt.receiptId,
      reason: 'privacy-violation',
      resolutionCondition: 'remove-secrets-absolute-paths-raw-payloads-and-user-identifiers',
    }],
    status: 'unresolved',
  };
}

export function sealClosureInput(input: Omit<ClosureInputReceipt, 'contentDigest'>): ClosureInputReceipt {
  return {
    ...input,
    contentDigest: sha256Text(serializeDeterministic(input)),
  };
}

export function generateArchitectureClosure(
  capture: ClosureCapture,
  manifest: ClosureManifest,
  competing: readonly CharacterizationFinding[] = manifest.competingAggregators?.map((identity) => ({ identity, reason: 'competing-global-closure-command' })) ?? [],
): ClosureGeneration {
  const failures: ClosureFailure[] = [];
  if (manifest.schemaVersion !== CLOSURE_MANIFEST_SCHEMA_VERSION) {
    failures.push({ code: 'invalid-manifest-schema', identity: String(manifest.schemaVersion) });
  }
  if (capture.dirty) failures.push({ code: 'dirty-worktree' });
  if (capture.mixedWorktree) failures.push({ code: 'mixed-worktree' });
  if (capture.detachedUnresolved || !GIT_SHA.test(capture.sourceCommit) || !GIT_SHA.test(capture.sourceTree)) {
    failures.push({ code: 'unresolved-git-identity' });
  }
  for (const finding of competing) {
    failures.push({ code: 'competing-aggregator', identity: finding.identity, detail: finding.reason });
  }

  for (const id of AUTHORITY_INPUT_IDS) {
    const receipt = manifest.inputs?.[id];
    if (!validateReceiptShape(receipt, id, failures)) continue;
    if (receipt.stageId !== id) failures.push({ code: 'authority-stage-mismatch', stageId: id, identity: receipt.stageId });
    if (receipt.sourceCommit !== capture.sourceCommit || receipt.sourceTree !== capture.sourceTree) {
      failures.push({ code: 'source-identity-drift', stageId: id });
    }
    validateDenominator(receipt, failures);
    duplicateIdentities(receipt, failures);
    pathConflicts(receipt, failures);
  }

  for (const terminal of manifest.terminals ?? []) {
    if (!validateReceiptShape(terminal, terminal.stageId || 'unknown', failures)) continue;
    if (terminal.sourceCommit !== capture.sourceCommit || terminal.sourceTree !== capture.sourceTree) {
      failures.push({ code: 'source-identity-drift', stageId: terminal.stageId });
    }
    validateDenominator(terminal, failures);
    duplicateIdentities(terminal, failures);
    pathConflicts(terminal, failures);
  }

  const receipts = allInputReceipts(manifest).filter((item): item is ClosureInputReceipt => Boolean(item));
  const coverage = buildCoverage(manifest.terminals ?? [], capture, failures);
  const { beforeMetrics, afterMetrics } = collectMetrics(receipts, failures);
  const totals = receipts.reduce((sum, item) => addTotals(sum, item.totals), emptyTotals());
  if (!totalsClosed(totals)) failures.push({ code: 'denominator-mismatch', detail: 'global' });

  const remainingCompatibilityRecords = receipts
    .flatMap((item) => item.compatibilityRecords)
    .slice()
    .sort((left, right) => left.identity.localeCompare(right.identity));
  for (const record of remainingCompatibilityRecords) {
    if (record.inClosureScope && !record.deletionProof) {
      failures.push({ code: 'blocking-compatibility', identity: record.identity });
    }
  }

  const blockedRecords: BlockedRecord[] = receipts
    .flatMap((item) => item.blockedRecords.map((record) => ({ ...record, sourceReceiptId: record.sourceReceiptId || item.receiptId })))
    .concat(receipts.filter((item) => item.status === 'blocked').map((item) => ({
      identity: item.stageId,
      owner: item.owner,
      sourceReceiptId: item.receiptId,
      reason: 'blocked-terminal',
      resolutionCondition: item.conclusion || 'resolve-blocked-terminal-receipt',
    })))
    .sort((left, right) => left.identity.localeCompare(right.identity));

  const status = decideStatus({ failures, capture, coverage, receipts, competing });
  const draft: Omit<NormalizedClosureReceipt, 'receiptId'> = {
    schemaVersion: CLOSURE_SCHEMA_VERSION,
    sourceIdentity: { sourceCommit: capture.sourceCommit, sourceTree: capture.sourceTree },
    inputReceiptIdentities: receipts.map(identityOf).sort((left, right) => left.stageId.localeCompare(right.stageId) || left.receiptId.localeCompare(right.receiptId)),
    beforeMetrics,
    afterMetrics,
    totals,
    terminalCoverage: coverage,
    remainingCompatibilityRecords,
    blockedRecords,
    status,
  };
  let receipt: NormalizedClosureReceipt = {
    ...draft,
    receiptId: sha256Text(serializeDeterministic(draft)),
  };
  if (privacyViolation(serializeDeterministic(receipt))) {
    failures.push({ code: 'privacy-violation' });
    const sanitized = sanitizeReceipt({ ...receipt, status: 'unresolved' });
    const sanitizedDraft = { ...sanitized, receiptId: undefined };
    delete (sanitizedDraft as { receiptId?: string }).receiptId;
    receipt = {
      ...sanitized,
      status: 'unresolved',
      receiptId: sha256Text(serializeDeterministic({ ...sanitized, receiptId: undefined })),
    };
  }
  const serialized = serializeDeterministic(receipt);
  return {
    receipt,
    serialized,
    digest: sha256Text(serialized),
    failures,
  };
}
