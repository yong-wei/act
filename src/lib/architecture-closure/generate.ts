import type { CharacterizationFinding } from './characterize';
import { CLOSURE_OWNER } from './stages';
import { privacyFallbackReceipt, rebuildPublicReceipt, rebuildTotals } from './rebuild';
import { parseClosureInputReceipt } from './schema';
import { privacyViolation, serializeDeterministic, sha256Text, sha256WithoutKey } from './serialize';
import { isTerminalStageId, sortedUnique } from './stages';
import {
  AUTHORITY_INPUT_IDS,
  CLOSURE_MANIFEST_SCHEMA_VERSION,
  CLOSURE_SCHEMA_VERSION,
  CLOSURE_STATUSES,
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
  NormalizedObservation,
  ReceiptIdentity,
  TerminalCoverage,
} from './types';

const GIT_SHA = /^[a-f0-9]{40}$/u;
const CONTENT_DIGEST = /^[a-f0-9]{64}$/u;

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

function countedTotals(observations: readonly { classification: ClosureObservation['classification'] }[]): ClosureTotals {
  const next = { ...emptyTotals(), discovered: observations.length };
  for (const observation of observations) {
    next[observation.classification] += 1;
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function validateRawContentDigest(
  raw: unknown,
  stageId: string,
  receiptId: string,
  failures: ClosureFailure[],
): void {
  if (!isRecord(raw) || typeof raw.contentDigest !== 'string' || !CONTENT_DIGEST.test(raw.contentDigest)) {
    failures.push({ code: 'invalid-content-digest', stageId, identity: receiptId });
    return;
  }
  if (sha256WithoutKey(raw, 'contentDigest') !== raw.contentDigest) {
    failures.push({ code: 'content-digest-mismatch', stageId, identity: receiptId });
  }
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

function conflictingPaths(observations: readonly ClosureObservation[]): string[] {
  const byPath = new Map<string, ClosureObservation[]>();
  for (const observation of observations) {
    if (!observation.path) continue;
    const list = byPath.get(observation.path) ?? [];
    list.push(observation);
    byPath.set(observation.path, list);
  }
  return [...byPath.entries()]
    .filter(([, group]) => new Set(group.map((item) => item.contentDigest ?? '')).size > 1)
    .map(([path]) => path)
    .sort((left, right) => left.localeCompare(right));
}

function pathConflicts(observations: readonly ClosureObservation[], failures: ClosureFailure[], stageId = 'global'): string[] {
  const conflicts = conflictingPaths(observations);
  for (const path of conflicts) {
    failures.push({ code: 'worktree-path-conflict', stageId, identity: path });
    for (const observation of observations.filter((item) => item.path === path)) {
      failures.push({ code: 'worktree-path-conflict', stageId, identity: observationIdentity(observation) });
    }
  }
  return conflicts;
}

function projectObservations(
  receipts: readonly ClosureInputReceipt[],
  conflictPathList: readonly string[],
): NormalizedObservation[] {
  const conflictPaths = new Set(conflictPathList);
  const projected: NormalizedObservation[] = [];
  for (const receipt of receipts) {
    for (const observation of receipt.observations) {
      const classification = observation.path && conflictPaths.has(observation.path)
        ? 'unresolved'
        : observation.classification;
      const next: {
        identity: string;
        classification: NormalizedObservation['classification'];
        sourceStageId: string;
        worktreeRole?: NormalizedObservation['worktreeRole'];
        path?: string;
        contentDigest?: string;
      } = {
        identity: observationIdentity(observation),
        classification,
        sourceStageId: receipt.stageId,
      };
      if (observation.worktreeRole) next.worktreeRole = observation.worktreeRole;
      if (observation.path) next.path = observation.path;
      if (observation.contentDigest) next.contentDigest = observation.contentDigest;
      projected.push(next);
    }
  }
  projected.sort((left, right) => left.identity.localeCompare(right.identity) || left.sourceStageId.localeCompare(right.sourceStageId));
  return projected;
}

function conflictRecordsFor(
  receipts: readonly ClosureInputReceipt[],
  conflictPathList: readonly string[],
): CompatibilityRecord[] {
  const conflictPaths = new Set(conflictPathList);
  const records: CompatibilityRecord[] = [];
  for (const receipt of receipts) {
    for (const observation of receipt.observations) {
      if (!observation.path || !conflictPaths.has(observation.path)) continue;
      records.push({
        identity: observationIdentity(observation),
        owner: CLOSURE_OWNER,
        inClosureScope: true,
        deletionProof: null,
        reason: 'worktree-path-conflict',
        resolutionCondition: 'retain-both-worktree-observations',
      });
    }
  }
  records.sort((left, right) => left.identity.localeCompare(right.identity));
  return records;
}

function duplicateIdentities(observations: readonly { identity: string }[], failures: ClosureFailure[], stageId = 'global'): void {
  const seen = new Map<string, number>();
  for (const observation of observations) {
    seen.set(observation.identity, (seen.get(observation.identity) ?? 0) + 1);
  }
  for (const [identity, count] of [...seen.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (count > 1) failures.push({ code: 'duplicate-identity', stageId, identity });
  }
}

function validateCurrentReceipt(receipt: ClosureInputReceipt, failures: ClosureFailure[], kind: 'authority' | 'terminal'): void {
  if (receipt.evidenceClass !== 'receipt') {
    failures.push({ code: 'non-receipt-evidence', stageId: receipt.stageId, identity: receipt.evidenceClass });
  }
  if (receipt.current !== true) {
    failures.push({ code: kind === 'authority' ? 'stale-authority' : 'stale-terminal', stageId: receipt.stageId, identity: receipt.receiptId });
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function collectMetrics(receipts: readonly ClosureInputReceipt[], failures: ClosureFailure[]): {
  beforeMetrics: NormalizedMetric[];
  afterMetrics: NormalizedMetric[];
} {
  const beforeMetrics: NormalizedMetric[] = [];
  const afterMetrics: NormalizedMetric[] = [];
  const seen = new Map<string, { phase: string; receiptId: string }[]>();
  const authorities = new Map<string, Set<string>>();

  for (const receipt of receipts) {
    for (const metric of receipt.metrics) {
      if (!asStatus(metric.status)) {
        failures.push({ code: 'invalid-metric-status', stageId: receipt.stageId, identity: String(metric.metricId) });
        continue;
      }
      if (
        !isNonEmptyString(metric.metricId)
        || !isNonEmptyString(metric.scope)
        || !isNonEmptyString(metric.unit)
        || !isNonEmptyString(metric.sourceField)
        || metric.value === undefined
        || metric.value === null
      ) {
        failures.push({
          code: 'missing-metric-value',
          stageId: receipt.stageId,
          identity: `${String(metric.metricId)}|${String(metric.scope)}|${String(metric.unit)}`,
        });
        continue;
      }
      const identity = `${metric.metricId}|${metric.scope}|${metric.unit}`;
      const authority = `${receipt.receiptId}|${metric.sourceField}`;
      const key = `${identity}|${authority}`;
      const sources = authorities.get(identity) ?? new Set<string>();
      sources.add(authority);
      authorities.set(identity, sources);
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
    }
  }

  for (const [identity, sources] of [...authorities.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (sources.size > 1) {
      failures.push({ code: 'metric-authority-mismatch', identity });
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
  observations: readonly NormalizedObservation[];
  competing: readonly CharacterizationFinding[];
}): ClosureStatus {
  const { failures, capture, coverage, receipts, observations, competing } = args;
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
    || receipts.some((item) => item.status === 'unresolved')
    || observations.some((row) => row.classification === 'unresolved')
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

function sealReceipt(draft: Omit<NormalizedClosureReceipt, 'receiptId'>): NormalizedClosureReceipt {
  const body = rebuildPublicReceipt({
    sourceIdentity: draft.sourceIdentity,
    inputReceiptIdentities: draft.inputReceiptIdentities,
    observations: draft.observations,
    beforeMetrics: draft.beforeMetrics,
    afterMetrics: draft.afterMetrics,
    totals: rebuildTotals(draft.totals),
    terminalCoverage: draft.terminalCoverage,
    remainingCompatibilityRecords: draft.remainingCompatibilityRecords,
    blockedRecords: draft.blockedRecords,
    status: draft.status,
  });
  return {
    schemaVersion: CLOSURE_SCHEMA_VERSION,
    receiptId: sha256Text(serializeDeterministic(body)),
    sourceIdentity: body.sourceIdentity,
    inputReceiptIdentities: body.inputReceiptIdentities,
    observations: body.observations,
    beforeMetrics: body.beforeMetrics,
    afterMetrics: body.afterMetrics,
    totals: body.totals,
    terminalCoverage: body.terminalCoverage,
    remainingCompatibilityRecords: body.remainingCompatibilityRecords,
    blockedRecords: body.blockedRecords,
    status: body.status,
  };
}

function publishReceipt(
  draft: Omit<NormalizedClosureReceipt, 'receiptId'>,
  capture: ClosureCapture,
  failures: ClosureFailure[],
): NormalizedClosureReceipt {
  let receipt = sealReceipt(draft);
  if (!privacyViolation(serializeDeterministic(receipt))) return receipt;
  failures.push({ code: 'privacy-violation' });
  receipt = sealReceipt(privacyFallbackReceipt({
    sourceCommit: capture.sourceCommit,
    sourceTree: capture.sourceTree,
  }));
  if (!privacyViolation(serializeDeterministic(receipt))) return receipt;
  receipt = sealReceipt(privacyFallbackReceipt({
    sourceCommit: '0'.repeat(40),
    sourceTree: '0'.repeat(40),
  }));
  return receipt;
}

export function sealClosureInput(input: Omit<ClosureInputReceipt, 'contentDigest'>): ClosureInputReceipt {
  return {
    ...input,
    contentDigest: sha256Text(serializeDeterministic(input)),
  };
}

export function recomputeClosureReceiptId(receipt: NormalizedClosureReceipt): string {
  return sha256WithoutKey(receipt, 'receiptId');
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

  const receipts: ClosureInputReceipt[] = [];
  const terminalReceipts: ClosureInputReceipt[] = [];

  for (const id of AUTHORITY_INPUT_IDS) {
    const parsed = parseClosureInputReceipt(manifest.inputs?.[id], id, failures);
    if (!parsed) continue;
    if (parsed.stageId !== id) failures.push({ code: 'authority-stage-mismatch', stageId: id, identity: parsed.stageId });
    if (parsed.sourceCommit !== capture.sourceCommit || parsed.sourceTree !== capture.sourceTree) {
      failures.push({ code: 'source-identity-drift', stageId: id });
    }
    validateCurrentReceipt(parsed, failures, 'authority');
    validateRawContentDigest(manifest.inputs?.[id], parsed.stageId, parsed.receiptId, failures);
    validateDenominator(parsed, failures);
    receipts.push(parsed);
  }

  const declaredTerminals = Array.isArray(manifest.terminals) ? manifest.terminals : [];
  if (!Array.isArray(manifest.terminals)) {
    failures.push({ code: 'invalid-receipt-payload', stageId: 'terminals' });
  }
  for (const terminal of declaredTerminals) {
    const stageId = typeof terminal?.stageId === 'string' && terminal.stageId ? terminal.stageId : 'unknown';
    const parsed = parseClosureInputReceipt(terminal, stageId, failures);
    if (!parsed) continue;
    if (parsed.sourceCommit !== capture.sourceCommit || parsed.sourceTree !== capture.sourceTree) {
      failures.push({ code: 'source-identity-drift', stageId: parsed.stageId });
    }
    validateRawContentDigest(terminal, parsed.stageId, parsed.receiptId, failures);
    validateDenominator(parsed, failures);
    receipts.push(parsed);
    terminalReceipts.push(parsed);
  }

  const rawObservations = receipts.flatMap((item) => item.observations);
  const conflictPathList = pathConflicts(rawObservations, failures);
  const observations = projectObservations(receipts, conflictPathList);
  duplicateIdentities(observations, failures);
  const coverage = buildCoverage(terminalReceipts, capture, failures);
  const { beforeMetrics, afterMetrics } = collectMetrics(receipts, failures);
  const totals = countedTotals(observations);
  const summed = receipts.reduce((sum, item) => addTotals(sum, item.totals), emptyTotals());
  if (conflictPathList.length === 0 && (
    summed.discovered !== totals.discovered
    || summed.included !== totals.included
    || summed.excluded !== totals.excluded
    || summed.duplicate !== totals.duplicate
    || summed.unresolved !== totals.unresolved
  )) {
    failures.push({ code: 'denominator-mismatch', detail: 'global-sum' });
  }
  if (!totalsClosed(totals)) failures.push({ code: 'denominator-mismatch', detail: 'global' });

  const remainingCompatibilityRecords = receipts
    .flatMap((item) => item.compatibilityRecords)
    .concat(conflictRecordsFor(receipts, conflictPathList))
    .slice()
    .sort((left, right) => left.identity.localeCompare(right.identity));
  for (const record of remainingCompatibilityRecords) {
    if (record.inClosureScope && !record.deletionProof) {
      failures.push({ code: 'blocking-compatibility', identity: record.identity });
    }
  }

  const blockedRecords: BlockedRecord[] = receipts
    .flatMap((item) => item.blockedRecords.map((record) => ({
      identity: record.identity,
      owner: record.owner,
      sourceReceiptId: record.sourceReceiptId || item.receiptId,
      reason: record.reason,
      resolutionCondition: record.resolutionCondition,
    })))
    .concat(receipts.filter((item) => item.status === 'blocked').map((item) => ({
      identity: item.stageId,
      owner: item.owner,
      sourceReceiptId: item.receiptId,
      reason: 'blocked-terminal',
      resolutionCondition: item.conclusion || 'resolve-blocked-terminal-receipt',
    })))
    .sort((left, right) => left.identity.localeCompare(right.identity));

  const status = decideStatus({ failures, capture, coverage, receipts, observations, competing });
  const draft = rebuildPublicReceipt({
    sourceIdentity: { sourceCommit: capture.sourceCommit, sourceTree: capture.sourceTree },
    inputReceiptIdentities: receipts
      .map(identityOf)
      .sort((left, right) => left.stageId.localeCompare(right.stageId) || left.receiptId.localeCompare(right.receiptId)),
    observations,
    beforeMetrics,
    afterMetrics,
    totals,
    terminalCoverage: coverage,
    remainingCompatibilityRecords,
    blockedRecords,
    status,
  });
  const receipt = publishReceipt(draft, capture, failures);
  const serialized = serializeDeterministic(receipt);
  const lateViolation = privacyViolation(serialized);
  if (lateViolation) {
    if (!failures.some((item) => item.code === 'privacy-violation')) {
      failures.push({ code: 'privacy-violation', detail: lateViolation });
    }
    const fallback = sealReceipt(privacyFallbackReceipt({
      sourceCommit: '0'.repeat(40),
      sourceTree: '0'.repeat(40),
    }));
    const fallbackSerialized = serializeDeterministic(fallback);
    return {
      receipt: fallback,
      serialized: fallbackSerialized,
      digest: sha256Text(fallbackSerialized),
      failures,
    };
  }
  return {
    receipt,
    serialized,
    digest: sha256Text(serialized),
    failures,
  };
}
