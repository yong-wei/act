import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  GRAPH_CONTRACT_SCHEMA_VERSION,
  GRAPH_DEFINITIONS,
  GRAPH_IDS,
  GRAPH_MANIFEST_SCHEMA_VERSION,
  GRAPH_MEASUREMENT_RECEIPT_SCHEMA_VERSION,
  createGraphMeasurementReceipt,
  graphManifestHash,
  type GraphId,
  type GraphManifest,
  type GraphMeasurementReceipt,
} from '../../../scripts/typescript-graphs/contracts.ts';
import { privacyViolation } from '@/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';
import type { CensusCore, CensusObservation, CensusSourceFile } from '@/lib/architecture-census/types';
import { assignOwner } from '@/lib/architecture-charter/assign';
import { checkFitness } from './check';
import { collectViolations } from './collect';
import type {
  BudgetMetricKind,
  BudgetStatus,
  BudgetValue,
  FitnessAllowlist,
  FitnessBudgetFailure,
  FitnessBudgetLedger,
  FitnessBudgetRecord,
  FitnessBudgetReport,
  FitnessBudgetSummary,
} from './types';
import {
  BUDGET_METRIC_KINDS,
  FITNESS_BUDGET_SCHEMA_VERSION,
  FITNESS_REPORT_SCHEMA_VERSION,
} from './types';

const DEPENDENCY_KINDS = ['dependency-edge', 'reverse-edge', 'deep-import', 'scc'] as const;
const BASELINE_CENTER_KINDS = ['file-size', 'center-node'] as const;
const REQUIRED_RECORD_KEYS = [
  'budgetId',
  'metricKind',
  'scope',
  'baselineIdentity',
  'sourceCommit',
  'sourceTree',
  'observedValue',
  'direction',
  'owner',
  'evidenceRefs',
  'exceptionState',
  'deletionCondition',
  'followUpChange',
  'status',
  'totals',
] as const;

export interface SourceState {
  readonly dirty?: boolean;
  readonly mixedWorktree?: boolean;
  readonly detachedUnresolved?: boolean;
}

export interface FitnessBudgetLedgerInput {
  readonly baselineCore: CensusCore;
  readonly allowlist: FitnessAllowlist;
  readonly baselineIdentity?: string;
  readonly dependencyAllowlistIdentity?: string;
  readonly charterIdentity?: string;
}

export interface CompileBudgetProjectionInput {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly baselineIdentity: string;
  readonly receipts: readonly GraphMeasurementReceipt[];
  readonly manifests: readonly GraphManifest[];
  readonly baselineReceipts?: readonly GraphMeasurementReceipt[];
  readonly requireFrozenReceipts?: boolean;
  readonly requiredFrozenGraphs?: readonly GraphId[];
}

export interface CompileBudgetProjection {
  readonly records: readonly FitnessBudgetRecord[];
  readonly failures: readonly FitnessBudgetFailure[];
}

export interface FitnessBudgetEvaluationInput {
  readonly baselineCore: CensusCore;
  readonly baselineCoreHash?: string;
  readonly baselineFiles?: readonly CensusSourceFile[];
  readonly currentCore: CensusCore;
  readonly currentFiles?: readonly CensusSourceFile[];
  readonly sourceState?: SourceState;
  readonly allowlist: FitnessAllowlist;
  readonly baselineAllowlist?: FitnessAllowlist;
  readonly ledger: FitnessBudgetLedger;
  readonly graphReceipts?: readonly GraphMeasurementReceipt[];
  readonly graphManifests?: readonly GraphManifest[];
  readonly graphArtifactFailures?: readonly FitnessBudgetFailure[];
  readonly baselineGraphReceipts?: readonly GraphMeasurementReceipt[];
  readonly requireGraphInputs?: boolean;
  readonly expectedLedgerHash?: string;
  readonly requireFrozenReceipts?: boolean;
}

function safeText(value: string): string {
  return value
    .replace(/(?:\/Users\/|\/home\/|\/private\/|\/var\/folders\/)[^\s"'`=)]*/gu, '[redacted-path]')
    .replace(/(?<![A-Za-z0-9_-])(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/gu, '[redacted-secret]')
    .replace(/postgres(?:ql)?:\/\/[^\s"'\\]+/gu, '[redacted-database-url]');
}

function safeValue(value: BudgetValue): BudgetValue {
  if (Array.isArray(value)) return value.map((item) => safeText(item)).sort();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [safeText(key), typeof item === 'string' ? safeText(item) : item]),
    ) as Readonly<Record<string, boolean | number | string | null>>;
  }
  return typeof value === 'string' ? safeText(value) : value;
}

function safeRefs(refs: readonly string[]): readonly string[] {
  return [...new Set(refs.map(safeText))].sort();
}

function zeroTotals(): { included: number; excluded: number; unresolved: number } {
  return { included: 0, excluded: 0, unresolved: 0 };
}

export function createBudgetRecord(input: FitnessBudgetRecord): FitnessBudgetRecord {
  return {
    ...input,
    budgetId: safeText(input.budgetId),
    scope: safeText(input.scope),
    baselineIdentity: safeText(input.baselineIdentity),
    sourceCommit: safeText(input.sourceCommit),
    sourceTree: safeText(input.sourceTree),
    observedValue: safeValue(input.observedValue),
    owner: safeText(input.owner),
    evidenceRefs: safeRefs(input.evidenceRefs),
    deletionCondition: safeText(input.deletionCondition),
    followUpChange: safeText(input.followUpChange),
    totals: {
      included: input.totals.included,
      excluded: input.totals.excluded,
      unresolved: input.totals.unresolved,
    },
  };
}

function metricKindForViolation(kind: FitnessBudgetRecord['metricKind'] | string): BudgetMetricKind {
  if ((BUDGET_METRIC_KINDS as readonly string[]).includes(kind)) return kind as BudgetMetricKind;
  if (kind === 'lib-file') return 'src-lib-freeze';
  return 'dependency-edge';
}

function baselineHash(core: CensusCore): string {
  return sha256Text(serializeDeterministic(core));
}

function allowlistHash(allowlist: FitnessAllowlist): string {
  return sha256Text(serializeDeterministic({
    ...allowlist,
    entries: [...allowlist.entries].sort((left, right) => left.id.localeCompare(right.id)),
  }));
}

function exceptionFingerprint(entry: FitnessAllowlist['entries'][number]): string {
  return sha256Text(serializeDeterministic({
    ...entry,
    consumers: [...entry.consumers].sort(),
  }));
}

function manifestFor(core: CensusCore, kind: string) {
  return core.manifests.find((item) => item.kind === kind);
}

function centerRows(core: CensusCore): CensusObservation[] {
  return core.observations
    .filter((item) => item.kind === 'change-center')
    .sort((left, right) => left.identity.localeCompare(right.identity));
}

function centerBytes(observation: CensusObservation): number | null {
  const value = observation.attributes.byteLength;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function centerReason(observation: CensusObservation): string | null {
  const value = observation.attributes.reason;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function centerBudget(
  observation: CensusObservation,
  baselineIdentity: string,
  sourceCommit: string,
  sourceTree: string,
  metricKind: 'file-size' | 'center-node',
): FitnessBudgetRecord {
  const bytes = centerBytes(observation);
  const reason = centerReason(observation);
  return createBudgetRecord({
    budgetId: `${metricKind}:${observation.identity}`,
    metricKind,
    scope: 'source-change-centers',
    baselineIdentity,
    sourceCommit,
    sourceTree,
    observedValue: metricKind === 'file-size'
      ? bytes ?? 0
      : { byteLength: bytes ?? 0, reason: reason ?? 'unresolved' },
    direction: 'frozen',
    owner: assignOwner(observation),
    evidenceRefs: [observation.identity, ...observation.evidence],
    exceptionState: 'none',
    deletionCondition: 'split-or-replace-before-frozen-metric-growth',
    followUpChange: 'enforce-modular-domain-dependency-contracts',
    status: bytes === null || reason === null ? 'unresolved' : 'qualified',
    totals: bytes === null || reason === null ? { included: 0, excluded: 0, unresolved: 1 } : { included: 1, excluded: 0, unresolved: 0 },
  });
}

export function createFitnessBudgetLedger(input: FitnessBudgetLedgerInput): FitnessBudgetLedger {
  const baseline = input.baselineCore;
  const baselineIdentity = input.baselineIdentity ?? baselineHash(baseline);
  const dependencyAllowlistIdentity = input.dependencyAllowlistIdentity ?? allowlistHash(input.allowlist);
  const charterIdentity = input.charterIdentity ?? input.allowlist.charterSha256;
  const sourceCommit = baseline.captureIdentity.sourceCommit;
  const sourceTree = baseline.captureIdentity.sourceTree;
  const exceptionBudgets = input.allowlist.entries.map((entry) => createBudgetRecord({
    budgetId: `exception:${entry.id}`,
    metricKind: metricKindForViolation(entry.kind),
    scope: `dependency-contract:${entry.classification}`,
    baselineIdentity,
    sourceCommit,
    sourceTree,
    observedValue: { count: 1, exceptionHash: exceptionFingerprint(entry) },
    direction: 'non-increasing',
    owner: entry.owner,
    evidenceRefs: [entry.id, entry.identity, ...entry.consumers],
    exceptionState: 'inherited',
    deletionCondition: entry.deletionCondition,
    followUpChange: entry.followUpChange,
    status: 'qualified',
    totals: { included: 1, excluded: 0, unresolved: 0 },
  }));
  const denominatorBudgets = DEPENDENCY_KINDS.flatMap((kind) => {
    const manifest = manifestFor(baseline, kind);
    if (!manifest) return [];
    const totals = manifest.totals;
    return [createBudgetRecord({
      budgetId: `denominator:${kind}`,
      metricKind: kind,
      scope: `architecture-census:${kind}`,
      baselineIdentity,
      sourceCommit,
      sourceTree,
      observedValue: totals.represented,
      direction: 'observed',
      owner: 'platform',
      evidenceRefs: [baselineIdentity, `kind:${kind}`],
      exceptionState: 'none',
      deletionCondition: 'keep-forward-reverse-and-scc-denominators-closed',
      followUpChange: 'enforce-modular-domain-dependency-contracts',
      status: totals.unresolved === 0 && totals.duplicate === 0 ? 'qualified' : 'unresolved',
      totals: {
        included: totals.represented,
        excluded: totals.excluded,
        unresolved: totals.unresolved + totals.duplicate,
      },
    })];
  });
  const centers = centerRows(baseline).flatMap((observation) => [
    centerBudget(observation, baselineIdentity, sourceCommit, sourceTree, 'file-size'),
    centerBudget(observation, baselineIdentity, sourceCommit, sourceTree, 'center-node'),
  ]);
  const compileBudgets = GRAPH_IDS.map((graph) => graphBudgetRecord(
    graph,
    {
      sourceCommit,
      sourceTree,
      baselineIdentity,
      receipts: [],
      manifests: [],
      requireFrozenReceipts: false,
    },
    undefined,
    'blocked',
    { included: 0, excluded: 0, unresolved: 1 },
  ));
  return {
    schemaVersion: FITNESS_BUDGET_SCHEMA_VERSION,
    baselineIdentity,
    sourceCommit,
    sourceTree,
    dependencyAllowlistIdentity,
    charterIdentity,
    budgets: [...exceptionBudgets, ...denominatorBudgets, ...centers, ...compileBudgets]
      .sort((left, right) => left.budgetId.localeCompare(right.budgetId)),
  };
}

function failure(
  code: string,
  identity: string,
  budgetId?: string,
  scope?: string,
  detail?: string,
  evidenceRefs?: readonly string[],
): FitnessBudgetFailure {
  return {
    code: safeText(code),
    identity: safeText(identity),
    ...(budgetId ? { budgetId: safeText(budgetId) } : {}),
    ...(scope ? { scope: safeText(scope) } : {}),
    ...(detail ? { detail: safeText(detail) } : {}),
    ...(evidenceRefs ? { evidenceRefs: safeRefs(evidenceRefs) } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateFitnessBudgetLedger(ledger: FitnessBudgetLedger): FitnessBudgetFailure[] {
  const failures: FitnessBudgetFailure[] = [];
  if (ledger.schemaVersion !== FITNESS_BUDGET_SCHEMA_VERSION) {
    failures.push(failure('unsupported-budget-schema', 'ledger'));
  }
  if (!ledger.baselineIdentity) failures.push(failure('budget-baseline-identity-missing', 'ledger'));
  if (!ledger.sourceCommit) failures.push(failure('budget-source-commit-missing', 'ledger'));
  if (!ledger.sourceTree) failures.push(failure('budget-source-tree-missing', 'ledger'));
  if (!Array.isArray(ledger.budgets)) return [...failures, failure('budget-records-missing', 'ledger')];
  const ids = new Set<string>();
  for (const record of ledger.budgets) {
    if (ids.has(record.budgetId)) failures.push(failure('duplicate-budget-id', record.budgetId));
    ids.add(record.budgetId);
    const object = record as unknown as Record<string, unknown>;
    const extra = Object.keys(object).filter((key) => !(REQUIRED_RECORD_KEYS as readonly string[]).includes(key));
    for (const key of extra) failures.push(failure('budget-record-extra-field', record.budgetId, record.budgetId, undefined, key));
    for (const key of REQUIRED_RECORD_KEYS) {
      if (!(key in object)) failures.push(failure('budget-record-field-missing', `${record.budgetId}:${key}`, record.budgetId));
    }
    if (!BUDGET_METRIC_KINDS.includes(record.metricKind)) failures.push(failure('budget-metric-kind-invalid', record.budgetId));
    if (record.baselineIdentity !== ledger.baselineIdentity) failures.push(failure('budget-record-baseline-drift', record.budgetId, record.budgetId));
    if (record.sourceCommit !== ledger.sourceCommit) failures.push(failure('budget-record-source-commit-drift', record.budgetId, record.budgetId));
    if (record.sourceTree !== ledger.sourceTree) failures.push(failure('budget-record-source-tree-drift', record.budgetId, record.budgetId));
    if (!record.scope) failures.push(failure('budget-scope-missing', record.budgetId, record.budgetId));
    if (!record.owner) failures.push(failure('budget-owner-missing', record.budgetId, record.budgetId));
    if (record.evidenceRefs.length === 0) failures.push(failure('budget-evidence-missing', record.budgetId, record.budgetId));
    if (!record.deletionCondition) failures.push(failure('budget-deletion-condition-missing', record.budgetId, record.budgetId));
    if (!record.followUpChange) failures.push(failure('budget-follow-up-change-missing', record.budgetId, record.budgetId));
    if (!['non-increasing', 'frozen', 'observed'].includes(record.direction)) failures.push(failure('budget-direction-invalid', record.budgetId, record.budgetId));
    if (!['qualified', 'blocked', 'observed', 'trend', 'unresolved', 'failed'].includes(record.status)) failures.push(failure('budget-status-invalid', record.budgetId, record.budgetId));
    if (!['none', 'inherited', 'removed', 'blocker', 'unresolved'].includes(record.exceptionState)) failures.push(failure('budget-exception-state-invalid', record.budgetId, record.budgetId));
    if (!isRecord(record.totals)) {
      failures.push(failure('budget-totals-missing', record.budgetId, record.budgetId));
    } else {
      for (const key of ['included', 'excluded', 'unresolved'] as const) {
        if (!Number.isInteger(record.totals[key]) || record.totals[key] < 0) {
          failures.push(failure('budget-total-invalid', `${record.budgetId}:${key}`, record.budgetId));
        }
      }
    }
  }
  return uniqueFailures(failures);
}

function uniqueFailures(failures: readonly FitnessBudgetFailure[]): FitnessBudgetFailure[] {
  const seen = new Set<string>();
  return [...failures]
    .sort((left, right) => `${left.code}:${left.identity}`.localeCompare(`${right.code}:${right.identity}`))
    .filter((item) => {
      const key = `${item.code}:${item.identity}:${item.budgetId ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function exceptionComparable(entry: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(entry)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => [key, key === 'consumers' && Array.isArray(value) ? [...value].sort() : value])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function validateExceptionSet(
  baselineEntries: readonly FitnessAllowlist['entries'][number][],
  candidateEntries: readonly FitnessAllowlist['entries'][number][],
): FitnessBudgetFailure[] {
  const baselineById = new Map(baselineEntries.map((entry) => [entry.id, entry as unknown as Record<string, unknown>]));
  const failures: FitnessBudgetFailure[] = [];
  const candidateIds = new Set<string>();
  for (const entry of candidateEntries) {
    if (candidateIds.has(entry.id)) failures.push(failure('exception-duplicate', entry.id, `exception:${entry.id}`));
    candidateIds.add(entry.id);
    const candidate = entry as unknown as Record<string, unknown>;
    const original = baselineById.get(entry.id);
    if (!original) {
      failures.push(failure('new-exception', entry.id, `exception:${entry.id}`));
      continue;
    }
    const extraFields = Object.keys(candidate).filter((key) => !(key in original));
    for (const key of extraFields) {
      failures.push(failure('exception-field-added', `${entry.id}:${key}`, `exception:${entry.id}`));
      if (key === 'pattern') failures.push(failure('exception-pattern-widened', entry.id, `exception:${entry.id}`));
    }
    if (candidate.owner !== original.owner) {
      failures.push(failure('exception-owner-transfer', entry.id, `exception:${entry.id}`));
    }
    if (!candidate.deletionCondition) {
      failures.push(failure('exception-deletion-condition-removed', entry.id, `exception:${entry.id}`));
    }
    if (candidate.pattern !== undefined && candidate.pattern !== original.pattern) {
      failures.push(failure('exception-pattern-widened', entry.id, `exception:${entry.id}`));
    }
    if (serializeDeterministic(exceptionComparable(original)) !== serializeDeterministic(exceptionComparable(candidate))) {
      failures.push(failure('exception-field-drift', entry.id, `exception:${entry.id}`));
    }
  }
  return uniqueFailures(failures);
}

function observationIds(core: CensusCore, kind: string): string[] {
  return core.observations.filter((item) => item.kind === kind).map((item) => item.identity).sort();
}

export function validateDependencyProjection(core: CensusCore): FitnessBudgetFailure[] {
  const failures: FitnessBudgetFailure[] = [];
  for (const kind of DEPENDENCY_KINDS) {
    const manifests = core.manifests.filter((item) => item.kind === kind);
    if (manifests.length > 1) failures.push(failure('denominator-manifest-duplicate', kind, `denominator:${kind}`));
    const manifest = manifestFor(core, kind);
    if (!manifest) {
      failures.push(failure('denominator-manifest-missing', kind, `denominator:${kind}`));
      continue;
    }
    const ids = observationIds(core, kind);
    const represented = new Set(ids).size;
    const duplicateObservations = ids.length - represented;
    if (manifest.totals.unresolved > 0) failures.push(failure('denominator-unresolved', kind, `denominator:${kind}`));
    if (manifest.totals.duplicate > 0) failures.push(failure('denominator-duplicate', kind, `denominator:${kind}`));
    if (duplicateObservations > 0) failures.push(failure('denominator-observation-duplicate', kind, `denominator:${kind}`));
    if (manifest.totals.represented !== represented) {
      failures.push(failure('denominator-represented-mismatch', kind, `denominator:${kind}`));
    }
    if (manifest.totals.discovered !== manifest.totals.represented + manifest.totals.excluded + manifest.totals.unresolved + manifest.totals.duplicate) {
      failures.push(failure('denominator-not-closed', kind, `denominator:${kind}`));
    }
  }
  const edges = core.observations.filter((item) => item.kind === 'dependency-edge');
  const reverse = new Set(core.observations.filter((item) => item.kind === 'reverse-edge').map((item) => item.identity));
  const expectedReverse = new Set<string>();
  for (const edge of edges) {
    const from = String(edge.attributes.from ?? '');
    const to = String(edge.attributes.to ?? '');
    if (!from || !to) {
      failures.push(failure('dependency-edge-endpoint-missing', edge.identity));
      continue;
    }
    expectedReverse.add(`${to}<-${from}`);
  }
  for (const identity of expectedReverse) {
    if (!reverse.has(identity)) failures.push(failure('reverse-edge-missing', identity));
  }
  for (const identity of reverse) {
    if (!expectedReverse.has(identity)) failures.push(failure('reverse-edge-orphan', identity));
  }
  const edgeIdentities = new Set(edges.map((item) => item.identity));
  for (const scc of core.observations.filter((item) => item.kind === 'scc')) {
    const members = [...new Set(scc.evidence)].sort();
    const edgeIds = [...new Set(scc.notes)].sort();
    if (members.length !== scc.evidence.length) failures.push(failure('scc-member-duplicate', scc.identity));
    if (edgeIds.length !== scc.notes.length) failures.push(failure('scc-edge-duplicate', scc.identity));
    if (scc.attributes.memberCount !== members.length) failures.push(failure('scc-member-count-mismatch', scc.identity));
    if (scc.attributes.edgeCount !== edgeIds.length) failures.push(failure('scc-edge-count-mismatch', scc.identity));
    for (const edgeId of edgeIds) {
      if (!edgeIdentities.has(edgeId)) failures.push(failure('scc-edge-unrepresented', `${scc.identity}:${edgeId}`));
    }
  }
  return uniqueFailures(failures);
}

export function compareFrozenCenters(
  ledger: FitnessBudgetLedger,
  currentCore: CensusCore,
): { records: FitnessBudgetRecord[]; failures: FitnessBudgetFailure[] } {
  const current = new Map(centerRows(currentCore).map((item) => [item.identity, item]));
  const baselinePaths = new Set(
    ledger.budgets.filter((item) => item.metricKind === 'file-size').map((item) => item.budgetId.slice('file-size:'.length)),
  );
  const records: FitnessBudgetRecord[] = [];
  const failures: FitnessBudgetFailure[] = [];
  for (const record of ledger.budgets) {
    if (!(BASELINE_CENTER_KINDS as readonly string[]).includes(record.metricKind)) continue;
    const path = record.budgetId.slice(`${record.metricKind}:`.length);
    const observation = current.get(path);
    if (!observation) {
      records.push(createBudgetRecord({
        ...record,
        sourceCommit: currentCore.captureIdentity.sourceCommit,
        sourceTree: currentCore.captureIdentity.sourceTree,
        observedValue: 0,
        exceptionState: 'removed',
        status: 'qualified',
        totals: { included: 0, excluded: 1, unresolved: 0 },
      }));
      continue;
    }
    const bytes = centerBytes(observation);
    const reason = centerReason(observation);
    const baselineBytes = record.metricKind === 'file-size'
      ? typeof record.observedValue === 'number' ? record.observedValue : null
      : isRecord(record.observedValue) && typeof record.observedValue.byteLength === 'number' ? record.observedValue.byteLength : null;
    if (bytes === null || reason === null || baselineBytes === null) {
      failures.push(failure('frozen-center-evidence-unresolved', path, record.budgetId));
      records.push(createBudgetRecord({
        ...record,
        sourceCommit: currentCore.captureIdentity.sourceCommit,
        sourceTree: currentCore.captureIdentity.sourceTree,
        observedValue: record.metricKind === 'file-size' ? bytes ?? 0 : { byteLength: bytes ?? 0, reason: reason ?? 'unresolved' },
        status: 'unresolved',
        totals: { included: 0, excluded: 0, unresolved: 1 },
      }));
      continue;
    }
    if (bytes > baselineBytes) failures.push(failure('frozen-metric-growth', path, record.budgetId, 'source-change-centers', `${baselineBytes}->${bytes}`));
    if (record.metricKind === 'center-node' && isRecord(record.observedValue) && record.observedValue.reason !== reason) {
      failures.push(failure('center-reason-drift', path, record.budgetId));
    }
    const owner = assignOwner(observation);
    if (owner !== record.owner) failures.push(failure('center-owner-transfer', path, record.budgetId));
    records.push(createBudgetRecord({
      ...record,
      sourceCommit: currentCore.captureIdentity.sourceCommit,
      sourceTree: currentCore.captureIdentity.sourceTree,
      observedValue: record.metricKind === 'file-size' ? bytes : { byteLength: bytes, reason },
      status: bytes > baselineBytes ? 'failed' : 'qualified',
      totals: { included: 1, excluded: 0, unresolved: 0 },
    }));
  }
  for (const observation of centerRows(currentCore)) {
    if (!baselinePaths.has(observation.identity)) {
      for (const metricKind of BASELINE_CENTER_KINDS) {
        const record = centerBudget(
          observation,
          ledger.baselineIdentity,
          currentCore.captureIdentity.sourceCommit,
          currentCore.captureIdentity.sourceTree,
          metricKind,
        );
        records.push(createBudgetRecord({
          ...record,
          status: 'failed',
          totals: { included: 1, excluded: 0, unresolved: 0 },
        }));
      }
      failures.push(failure('new-change-center', observation.identity, `center-node:${observation.identity}`));
    }
  }
  return { records: records.sort((left, right) => left.budgetId.localeCompare(right.budgetId)), failures: uniqueFailures(failures) };
}

function graphReceiptValue(receipt: GraphMeasurementReceipt | undefined): BudgetValue {
  if (!receipt) return null;
  return {
    cacheMode: receipt.cacheMode,
    durationMs: receipt.durationMs,
    fileCount: receipt.fileCount,
    peakRssBytes: receipt.peakRssBytes,
    tscErrorCount: receipt.tscErrorCount,
    boundaryFailureCount: receipt.boundaryFailureCount,
    platform: receipt.platform,
    scope: receipt.scope,
    toolchain: serializeDeterministic(receipt.toolchain).trim(),
  };
}

function graphReceiptContentHash(receipt: GraphMeasurementReceipt): string {
  const { receiptId: _ignored, schemaVersion: _schemaVersion, ...draft } = receipt;
  return createGraphMeasurementReceipt(draft).receiptId;
}

function graphBudgetRecord(
  graph: GraphId,
  input: CompileBudgetProjectionInput,
  receipt: GraphMeasurementReceipt | undefined,
  status: BudgetStatus,
  totals: { included: number; excluded: number; unresolved: number },
  baselineReceipt?: GraphMeasurementReceipt,
): FitnessBudgetRecord {
  return createBudgetRecord({
    budgetId: `compile-resource:${graph}`,
    metricKind: 'compile-resource',
    scope: `typescript-graph:${graph}`,
    baselineIdentity: input.baselineIdentity,
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    observedValue: graphReceiptValue(receipt),
    direction: 'observed',
    owner: 'platform',
    evidenceRefs: receipt
      ? [
          receipt.receiptId,
          receipt.manifestHash,
          receipt.command,
          receipt.scope,
          receipt.fixturePath,
          `platform:${receipt.platform}`,
          `cache:${receipt.cacheMode}`,
          `toolchain:${serializeDeterministic(receipt.toolchain).trim()}`,
          ...(baselineReceipt ? [`baseline-receipt:${baselineReceipt.receiptId}`, `baseline-manifest:${baselineReceipt.manifestHash}`] : []),
        ]
      : [
          `typecheck:${graph}`,
          ...(baselineReceipt ? [`baseline-receipt:${baselineReceipt.receiptId}`, `baseline-manifest:${baselineReceipt.manifestHash}`] : []),
        ],
    exceptionState: 'none',
    deletionCondition: 'retain-source-and-command-bound-measurement-receipt',
    followUpChange: 'enforce-pr-integration-quality-gates',
    status,
    totals,
  });
}

export function projectCompileBudgets(input: CompileBudgetProjectionInput): CompileBudgetProjection {
  const failures: FitnessBudgetFailure[] = [];
  const records: FitnessBudgetRecord[] = [];
  const requiredFrozenGraphs = new Set(
    input.requiredFrozenGraphs
      ?? ((input.requireFrozenReceipts ?? true) ? GRAPH_IDS : []),
  );
  for (const graph of GRAPH_IDS) {
    const definition = GRAPH_DEFINITIONS.find((item) => item.id === graph);
    const receipts = input.receipts.filter((item) => item.graph === graph || item.command === `typecheck:${graph}`);
    const manifests = input.manifests.filter((item) => item.graph === graph);
    const baselineReceipts = (input.baselineReceipts ?? []).filter((item) => item.graph === graph || item.command === `typecheck:${graph}`);
    const receipt = receipts.length === 1 ? receipts[0] : undefined;
    const manifest = manifests.length === 1 ? manifests[0] : undefined;
    const baseline = baselineReceipts.length === 1 ? baselineReceipts[0] : undefined;
    const budgetId = `compile-resource:${graph}`;
    const requireFrozen = requiredFrozenGraphs.has(graph);
    if (receipts.length > 1) failures.push(failure('graph-receipt-duplicate', graph, budgetId));
    if (manifests.length > 1) failures.push(failure('graph-manifest-duplicate', graph, budgetId));
    if (!receipt) failures.push(failure('graph-receipt-missing', graph, budgetId));
    if (!manifest) failures.push(failure('graph-manifest-missing', graph, budgetId));
    if (requireFrozen && !baseline) failures.push(failure('graph-frozen-receipt-missing', graph, budgetId));
    let blocked = receipts.length !== 1 || manifests.length !== 1 || (requireFrozen && !baseline);
    for (const candidate of receipts) {
      if (graphReceiptContentHash(candidate) !== candidate.receiptId) {
        failures.push(failure('graph-receipt-identity-drift', graph, budgetId));
        blocked = true;
      }
    }
    if (receipt) {
      if (receipt.schemaVersion !== GRAPH_MEASUREMENT_RECEIPT_SCHEMA_VERSION) {
        failures.push(failure('graph-receipt-schema-drift', graph, budgetId));
        blocked = true;
      }
      if (receipt.sourceCommit !== input.sourceCommit || receipt.sourceTree !== input.sourceTree) {
        failures.push(failure('graph-receipt-stale', graph, budgetId));
        blocked = true;
      }
      if (receipt.dirty) {
        failures.push(failure('graph-receipt-dirty', graph, budgetId));
        blocked = true;
      }
      if (receipt.status !== 'passed' || receipt.exitStatus !== 0) {
        failures.push(failure('graph-receipt-not-passed', graph, budgetId, undefined, receipt.status));
        blocked = true;
      }
      if (receipt.fixtureProbe) {
        failures.push(failure('graph-fixture-probe-receipt', graph, budgetId));
        blocked = true;
      }
      if (receipt.tscErrorCount > 0) {
        failures.push(failure('graph-tsc-errors', graph, budgetId, undefined, String(receipt.tscErrorCount)));
        blocked = true;
      }
      if (receipt.boundaryFailureCount > 0) {
        failures.push(failure('graph-boundary-failures', graph, budgetId, undefined, String(receipt.boundaryFailureCount)));
        blocked = true;
      }
      if (definition && (receipt.command !== definition.command || receipt.scope !== definition.scope || receipt.fixturePath !== definition.fixturePath)) {
        failures.push(failure('graph-receipt-contract-drift', graph, budgetId));
        blocked = true;
      }
      if (receipt.failureCodes.some((code) => code === 'production-to-tooling' || code.startsWith('production-to-') || code.includes('-includes-'))) {
        failures.push(failure('production-to-tooling-blocker-receipt', graph, budgetId, undefined, 'historical production boundary remains blocked'));
        blocked = true;
      }
    }
    if (manifest) {
      if (manifest.schemaVersion !== GRAPH_MANIFEST_SCHEMA_VERSION || manifest.contractVersion !== GRAPH_CONTRACT_SCHEMA_VERSION) {
        failures.push(failure('graph-manifest-schema-drift', graph, budgetId));
        blocked = true;
      }
      if (manifest.sourceCommit !== input.sourceCommit || manifest.sourceTree !== input.sourceTree) {
        failures.push(failure('graph-manifest-stale', graph, budgetId));
        blocked = true;
      }
      if (definition && (manifest.kind !== definition.kind || manifest.scope !== definition.scope || manifest.configPath !== definition.configPath)) {
        failures.push(failure('graph-manifest-contract-drift', graph, budgetId));
        blocked = true;
      }
      if (receipt && graphManifestHash(manifest) !== receipt.manifestHash) {
        failures.push(failure('graph-manifest-hash-mismatch', graph, budgetId));
        blocked = true;
      }
    }
    for (const candidate of baselineReceipts) {
      if (graphReceiptContentHash(candidate) !== candidate.receiptId) {
        failures.push(failure('graph-receipt-identity-drift', `baseline:${graph}`, budgetId));
        blocked = true;
      }
    }
    if (baseline && receipt) {
      if (baseline.schemaVersion !== GRAPH_MEASUREMENT_RECEIPT_SCHEMA_VERSION || !baseline.sourceCommit || !baseline.sourceTree || !baseline.manifestHash) {
        failures.push(failure('graph-frozen-receipt-invalid', graph, budgetId));
        blocked = true;
      }
      if (baseline.dirty || baseline.status !== 'passed' || baseline.exitStatus !== 0 || baseline.tscErrorCount > 0 || baseline.boundaryFailureCount > 0) {
        failures.push(failure('graph-frozen-receipt-unqualified', graph, budgetId));
        blocked = true;
      }
      if (baseline.cacheMode !== receipt.cacheMode) {
        failures.push(failure('graph-cache-mode-drift', graph, budgetId));
        blocked = true;
      }
      if (receipt.fileCount > baseline.fileCount || receipt.tscErrorCount > baseline.tscErrorCount) {
        failures.push(failure('frozen-compile-metric-growth', graph, budgetId));
        blocked = true;
      }
    }
    let status: BudgetStatus = blocked ? 'blocked' : 'trend';
    if (!blocked && receipt && receipt.peakRssBytes === null) status = 'observed';
    records.push(graphBudgetRecord(
      graph,
      input,
      receipt,
      status,
      blocked ? { included: 0, excluded: 0, unresolved: 1 } : { included: 1, excluded: 0, unresolved: 0 },
      baseline,
    ));
  }
  return { records: records.sort((left, right) => left.budgetId.localeCompare(right.budgetId)), failures: uniqueFailures(failures) };
}

const EXCEPTION_KEYS = [
  'id',
  'kind',
  'identity',
  'owner',
  'classification',
  'consumers',
  'reason',
  'deletionCondition',
  'followUpChange',
] as const;

function validateExceptionShape(entries: readonly FitnessAllowlist['entries'][number][]): FitnessBudgetFailure[] {
  const failures: FitnessBudgetFailure[] = [];
  for (const entry of entries) {
    const object = entry as unknown as Record<string, unknown>;
    for (const key of Object.keys(object)) {
      if (!(EXCEPTION_KEYS as readonly string[]).includes(key)) {
        failures.push(failure('exception-field-added', `${entry.id}:${key}`, `exception:${entry.id}`));
        if (key === 'pattern') failures.push(failure('exception-pattern-widened', entry.id, `exception:${entry.id}`));
      }
    }
    for (const key of EXCEPTION_KEYS) {
      if (!(key in object)) failures.push(failure('exception-field-missing', `${entry.id}:${key}`, `exception:${entry.id}`));
    }
    if (!entry.owner) failures.push(failure('unowned-exception', entry.id, `exception:${entry.id}`));
    if (!entry.deletionCondition) failures.push(failure('exception-deletion-condition-removed', entry.id, `exception:${entry.id}`));
  }
  return uniqueFailures(failures);
}

function ledgerExceptionFailures(
  ledger: FitnessBudgetLedger,
  allowlist: FitnessAllowlist,
): FitnessBudgetFailure[] {
  const baselineIds = new Set(
    ledger.budgets
      .filter((record) => record.budgetId.startsWith('exception:'))
      .map((record) => record.budgetId.slice('exception:'.length)),
  );
  const candidateIds = new Set(allowlist.entries.map((entry) => entry.id));
  const failures: FitnessBudgetFailure[] = [];
  for (const id of candidateIds) {
    if (!baselineIds.has(id)) failures.push(failure('new-exception', id, `exception:${id}`));
    const entry = allowlist.entries.find((item) => item.id === id);
    const record = ledger.budgets.find((item) => item.budgetId === `exception:${id}`);
    const observed = record?.observedValue;
    if (entry && record && isRecord(observed) && typeof observed.exceptionHash === 'string' && observed.exceptionHash !== exceptionFingerprint(entry)) {
      failures.push(failure('exception-field-drift', id, `exception:${id}`));
    }
  }
  return uniqueFailures(failures);
}

function prefixedFailures(prefix: string, failures: readonly FitnessBudgetFailure[]): FitnessBudgetFailure[] {
  return failures.map((item) => ({
    ...item,
    code: `${prefix}-${item.code}`,
  }));
}

function violationRecord(
  violation: ReturnType<typeof collectViolations>[number],
  baselineIdentity: string,
  sourceCommit: string,
  sourceTree: string,
  status: BudgetStatus = 'failed',
  exceptionState: 'blocker' | 'unresolved' = 'blocker',
): FitnessBudgetRecord {
  return createBudgetRecord({
    budgetId: `violation:${violation.id}`,
    metricKind: metricKindForViolation(violation.kind),
    scope: `dependency-contract:${violation.classification}`,
    baselineIdentity,
    sourceCommit,
    sourceTree,
    observedValue: 1,
    direction: 'non-increasing',
    owner: violation.owner,
    evidenceRefs: [violation.id, violation.identity, ...violation.consumers],
    exceptionState,
    deletionCondition: violation.deletionCondition,
    followUpChange: violation.followUpChange,
    status,
    totals: { included: 1, excluded: 0, unresolved: 0 },
  });
}

function currentDenominatorRecord(
  baseline: FitnessBudgetRecord,
  core: CensusCore,
  failures: readonly FitnessBudgetFailure[],
): FitnessBudgetRecord {
  const manifest = manifestFor(core, baseline.metricKind);
  if (!manifest) {
    return createBudgetRecord({
      ...baseline,
      sourceCommit: core.captureIdentity.sourceCommit,
      sourceTree: core.captureIdentity.sourceTree,
      observedValue: null,
      status: 'blocked',
      totals: { included: 0, excluded: 0, unresolved: 1 },
    });
  }
  const hasFailure = failures.length > 0;
  return createBudgetRecord({
    ...baseline,
    sourceCommit: core.captureIdentity.sourceCommit,
    sourceTree: core.captureIdentity.sourceTree,
    observedValue: manifest.totals.represented,
    status: hasFailure ? 'unresolved' : 'qualified',
    totals: {
      included: manifest.totals.represented,
      excluded: manifest.totals.excluded,
      unresolved: manifest.totals.unresolved + manifest.totals.duplicate,
    },
  });
}

function currentExceptionRecord(
  baseline: FitnessBudgetRecord,
  entry: FitnessAllowlist['entries'][number] | undefined,
  active: boolean,
  sourceCommit: string,
  sourceTree: string,
): FitnessBudgetRecord {
  if (!entry) {
    return createBudgetRecord({
      ...baseline,
      sourceCommit,
      sourceTree,
      observedValue: 0,
      exceptionState: 'removed',
      status: 'qualified',
      totals: { included: 0, excluded: 1, unresolved: 0 },
    });
  }
  return createBudgetRecord({
    ...baseline,
    sourceCommit,
    sourceTree,
    observedValue: active ? 1 : 0,
    exceptionState: 'inherited',
    status: 'qualified',
    totals: { included: 1, excluded: 0, unresolved: 0 },
  });
}

function graphRecordMap(records: readonly FitnessBudgetRecord[]): Map<string, FitnessBudgetRecord> {
  return new Map(records.map((record) => [record.budgetId, record]));
}

function summaryFor(records: readonly FitnessBudgetRecord[], failures: readonly FitnessBudgetFailure[]): FitnessBudgetSummary {
  return {
    included: records.reduce((total, record) => total + record.totals.included, 0),
    excluded: records.reduce((total, record) => total + record.totals.excluded, 0),
    unresolved: records.reduce((total, record) => total + record.totals.unresolved, 0),
    duplicate: failures.filter((item) => item.code.includes('duplicate')).length,
    qualified: records.filter((record) => record.status === 'qualified').length,
    observed: records.filter((record) => record.status === 'observed').length,
    trend: records.filter((record) => record.status === 'trend').length,
    blocked: records.filter((record) => record.status === 'blocked').length,
    failed: records.filter((record) => record.status === 'failed').length,
    removedExceptions: records.filter((record) => record.exceptionState === 'removed').length,
  };
}

function reportStatus(records: readonly FitnessBudgetRecord[], failures: readonly FitnessBudgetFailure[]): BudgetStatus {
  if (records.some((record) => record.status === 'failed') || failures.some((item) => (
    item.code.includes('new-')
    || item.code.includes('growth')
    || item.code.includes('widen')
    || item.code.includes('owner-transfer')
    || item.code.includes('field-drift')
    || item.code.includes('field-added')
    || item.code.startsWith('exception-')
    || item.code === 'unowned-exception'
  ))) return 'failed';
  if (records.some((record) => record.status === 'blocked') || failures.some((item) => (
    item.code.includes('dirty')
    || item.code.includes('mixed')
    || item.code.includes('stale')
    || item.code.includes('missing')
    || item.code.includes('schema')
    || item.code.includes('artifact')
    || item.code.includes('contract-drift')
    || item.code.includes('identity')
    || item.code.includes('hash')
    || item.code.includes('receipt')
    || item.code.includes('denominator')
    || item.code.includes('duplicate')
    || item.code.includes('production-to-tooling')
    || item.code.includes('unowned')
    || item.code.includes('unresolved')
  ))) return 'blocked';
  if (records.some((record) => record.status === 'unresolved')) return 'unresolved';
  if (records.some((record) => record.status === 'trend')) return 'trend';
  if (records.some((record) => record.status === 'observed')) return 'observed';
  return 'qualified';
}

export function evaluateFitnessBudgets(input: FitnessBudgetEvaluationInput): FitnessBudgetReport {
  const baselineIdentity = input.ledger.baselineIdentity;
  const sourceCommit = input.currentCore.captureIdentity.sourceCommit;
  const sourceTree = input.currentCore.captureIdentity.sourceTree;
  const failures: FitnessBudgetFailure[] = [];
  const records: FitnessBudgetRecord[] = [];

  failures.push(...validateFitnessBudgetLedger(input.ledger));
  if (input.baselineCore.schemaVersion !== 'act-architecture-census/v1') {
    failures.push(failure('baseline-schema-drift', 'baseline'));
  }
  if (input.currentCore.schemaVersion !== 'act-architecture-census/v1') {
    failures.push(failure('current-schema-drift', 'current'));
  }
  const computedBaselineHash = baselineHash(input.baselineCore);
  if (input.baselineCoreHash && input.baselineCoreHash !== computedBaselineHash) {
    failures.push(failure('baseline-hash-drift', 'baseline'));
  }
  if (baselineIdentity !== computedBaselineHash) {
    failures.push(failure('budget-baseline-identity-drift', baselineIdentity));
  }
  if (input.ledger.sourceCommit !== input.baselineCore.captureIdentity.sourceCommit) {
    failures.push(failure('budget-source-commit-drift', 'baseline'));
  }
  if (input.ledger.sourceTree !== input.baselineCore.captureIdentity.sourceTree) {
    failures.push(failure('budget-source-tree-drift', 'baseline'));
  }
  if (input.expectedLedgerHash !== undefined && input.expectedLedgerHash !== fitnessBudgetLedgerHash(input.ledger)) {
    failures.push(failure('ledger-hash-drift', 'ledger'));
  }
  if (input.allowlist.schemaVersion !== 'act-architecture-fitness/v1') {
    failures.push(failure('allowlist-schema-drift', 'allowlist'));
  }
  if (input.allowlist.baselineSourceCommit !== input.baselineCore.captureIdentity.sourceCommit) {
    failures.push(failure('allowlist-source-commit-drift', 'allowlist'));
  }
  if (input.allowlist.baselineSourceTree !== input.baselineCore.captureIdentity.sourceTree) {
    failures.push(failure('allowlist-source-tree-drift', 'allowlist'));
  }
  if (input.allowlist.charterSha256 !== input.ledger.charterIdentity) {
    failures.push(failure('charter-identity-drift', 'charter'));
  }
  failures.push(...validateExceptionShape(input.allowlist.entries));
  failures.push(...ledgerExceptionFailures(input.ledger, input.allowlist));
  if (input.baselineAllowlist) {
    if (allowlistHash(input.baselineAllowlist) !== input.ledger.dependencyAllowlistIdentity) {
      failures.push(failure('dependency-allowlist-identity-drift', 'baseline-allowlist'));
    }
    failures.push(...validateExceptionSet(input.baselineAllowlist.entries, input.allowlist.entries));
  } else if (
    new Set(input.allowlist.entries.map((entry) => entry.id)).size === input.ledger.budgets.filter((record) => record.budgetId.startsWith('exception:')).length
    && allowlistHash(input.allowlist) !== input.ledger.dependencyAllowlistIdentity
  ) {
    failures.push(failure('dependency-allowlist-identity-drift', 'allowlist'));
  }
  const sourceState = input.sourceState;
  if (sourceState?.dirty) failures.push(failure('dirty-worktree', sourceCommit));
  if (sourceState?.mixedWorktree) failures.push(failure('mixed-worktree', sourceCommit));
  if (sourceState?.detachedUnresolved) failures.push(failure('unresolved-source-identity', sourceCommit));

  const baselineDependencyFailures = validateDependencyProjection(input.baselineCore);
  const currentDependencyFailures = validateDependencyProjection(input.currentCore);
  failures.push(...prefixedFailures('baseline', baselineDependencyFailures));
  failures.push(...prefixedFailures('current', currentDependencyFailures));
  const fitness = checkFitness(input.currentCore, input.allowlist, input.currentFiles ?? []);
  const baselineViolationIds = new Set(collectViolations(input.baselineCore, input.baselineFiles ?? []).map((item) => item.id));
  for (const violation of fitness.newViolations) {
    const isBaselineDebt = baselineViolationIds.has(violation.id);
    failures.push(failure(
      isBaselineDebt ? 'baseline-unallowlisted-debt' : violation.kind === 'scc' ? 'new-scc-member' : 'new-forbidden-dependency',
      violation.identity,
      `violation:${violation.id}`,
      violation.classification,
      isBaselineDebt ? 'baseline-debt-is-not-allowlisted' : violation.reason,
      [violation.id, violation.owner, ...violation.consumers],
    ));
  }

  const activeViolations = new Set(collectViolations(input.currentCore, input.currentFiles ?? []).map((item) => item.id));
  for (const baseline of input.ledger.budgets) {
    if (baseline.budgetId.startsWith('exception:')) {
      const id = baseline.budgetId.slice('exception:'.length);
      records.push(currentExceptionRecord(
        baseline,
        input.allowlist.entries.find((entry) => entry.id === id),
        activeViolations.has(id),
        sourceCommit,
        sourceTree,
      ));
      continue;
    }
    if ((DEPENDENCY_KINDS as readonly string[]).includes(baseline.metricKind)) {
      const relevant = currentDependencyFailures.filter((item) => item.identity === baseline.metricKind || item.budgetId === baseline.budgetId);
      records.push(currentDenominatorRecord(baseline, input.currentCore, relevant));
    }
  }

  const centerProjection = compareFrozenCenters(input.ledger, input.currentCore);
  records.push(...centerProjection.records);
  failures.push(...centerProjection.failures);
  records.push(...fitness.newViolations.map((violation) => {
    const isBaselineDebt = baselineViolationIds.has(violation.id);
    return violationRecord(
      violation,
      baselineIdentity,
      sourceCommit,
      sourceTree,
      isBaselineDebt ? 'blocked' : 'failed',
      isBaselineDebt ? 'unresolved' : 'blocker',
    );
  }));

  const shouldProjectGraphs = input.requireGraphInputs || input.graphReceipts || input.graphManifests || input.baselineGraphReceipts;
  if (shouldProjectGraphs) {
    const frozenReceipts = input.baselineGraphReceipts ?? [];
    const requiredFrozenGraphs = input.requireFrozenReceipts === undefined
      ? GRAPH_IDS.filter((graph) => frozenReceipts.some((receipt) => receipt.graph === graph))
      : input.requireFrozenReceipts ? [...GRAPH_IDS] : [];
    const compileProjection = projectCompileBudgets({
      sourceCommit,
      sourceTree,
      baselineIdentity,
      receipts: input.graphReceipts ?? [],
      manifests: input.graphManifests ?? [],
      baselineReceipts: input.baselineGraphReceipts,
      requireFrozenReceipts: input.requireFrozenReceipts,
      requiredFrozenGraphs,
    });
    const existingGraphRecords = graphRecordMap(records);
    for (const record of compileProjection.records) {
      existingGraphRecords.set(record.budgetId, record);
    }
    records.length = 0;
    records.push(...existingGraphRecords.values());
    failures.push(...compileProjection.failures);
    failures.push(...(input.graphArtifactFailures ?? []));
  }

  const normalizedFailures = uniqueFailures(failures);
  const normalizedRecords = [...new Map(records.map((record) => [record.budgetId, createBudgetRecord(record)])).values()]
    .sort((left, right) => left.budgetId.localeCompare(right.budgetId));
  const status = reportStatus(normalizedRecords, normalizedFailures);
  const ok = !normalizedFailures.length && status !== 'failed' && status !== 'blocked' && status !== 'unresolved';
  return {
    schemaVersion: FITNESS_REPORT_SCHEMA_VERSION,
    baselineIdentity,
    sourceCommit,
    sourceTree,
    status,
    ok,
    budgets: normalizedRecords,
    failures: normalizedFailures,
    summary: summaryFor(normalizedRecords, normalizedFailures),
  };
}

export interface GraphArtifactSet {
  readonly receipts: readonly GraphMeasurementReceipt[];
  readonly manifests: readonly GraphManifest[];
  readonly failures: readonly FitnessBudgetFailure[];
}

function isGraphId(value: unknown): value is GraphId {
  return typeof value === 'string' && (GRAPH_IDS as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function artifactFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(path, name));
}

function readGraphArtifact(path: string, category: 'receipt' | 'manifest'): unknown | FitnessBudgetFailure {
  const displayIdentity = `${category}:${path.split('/').pop() ?? 'unknown'}`;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!isRecord(parsed)) return failure('graph-artifact-invalid', displayIdentity);
    if (category === 'receipt') {
      if (
        parsed.schemaVersion !== GRAPH_MEASUREMENT_RECEIPT_SCHEMA_VERSION
        || !isGraphId(parsed.graph)
        || typeof parsed.receiptId !== 'string'
        || typeof parsed.command !== 'string'
        || typeof parsed.scope !== 'string'
        || typeof parsed.sourceCommit !== 'string'
        || typeof parsed.sourceTree !== 'string'
        || typeof parsed.manifestHash !== 'string'
        || typeof parsed.fixturePath !== 'string'
        || typeof parsed.dirty !== 'boolean'
        || !['cold', 'warm'].includes(String(parsed.cacheMode))
        || !['passed', 'failed', 'blocked'].includes(String(parsed.status))
        || !Number.isInteger(parsed.exitStatus)
        || !Number.isInteger(parsed.tscErrorCount)
        || !Number.isInteger(parsed.boundaryFailureCount)
        || !isStringArray(parsed.failureCodes)
      ) {
        return failure('graph-receipt-invalid', displayIdentity);
      }
    } else if (
      parsed.schemaVersion !== GRAPH_MANIFEST_SCHEMA_VERSION
      || parsed.contractVersion !== GRAPH_CONTRACT_SCHEMA_VERSION
      || !isGraphId(parsed.graph)
      || typeof parsed.sourceCommit !== 'string'
      || typeof parsed.sourceTree !== 'string'
      || !isStringArray(parsed.includeRoots)
      || !isStringArray(parsed.excludeRoots)
      || !Array.isArray(parsed.files)
    ) {
      return failure('graph-manifest-invalid', displayIdentity);
    }
    return parsed;
  } catch (error) {
    return failure('graph-artifact-unreadable', displayIdentity, undefined, undefined, error instanceof Error ? error.name : 'parse-error');
  }
}

export function readGraphArtifacts(
  repoRoot: string,
  artifactRoot = join(repoRoot, '.logs/typescript-graphs'),
): GraphArtifactSet {
  const receipts: GraphMeasurementReceipt[] = [];
  const manifests: GraphManifest[] = [];
  const failures: FitnessBudgetFailure[] = [];
  for (const path of artifactFiles(join(artifactRoot, 'receipts'))) {
    const artifact = readGraphArtifact(path, 'receipt');
    if (isRecord(artifact) && artifact.schemaVersion === GRAPH_MEASUREMENT_RECEIPT_SCHEMA_VERSION) {
      receipts.push(artifact as unknown as GraphMeasurementReceipt);
    } else {
      failures.push(artifact as FitnessBudgetFailure);
    }
  }
  for (const path of artifactFiles(join(artifactRoot, 'manifests'))) {
    const artifact = readGraphArtifact(path, 'manifest');
    if (isRecord(artifact) && artifact.schemaVersion === GRAPH_MANIFEST_SCHEMA_VERSION) {
      manifests.push(artifact as unknown as GraphManifest);
    } else {
      failures.push(artifact as FitnessBudgetFailure);
    }
  }
  return {
    receipts: receipts.sort((left, right) => left.receiptId.localeCompare(right.receiptId)),
    manifests: manifests.sort((left, right) => graphManifestHash(left).localeCompare(graphManifestHash(right))),
    failures: uniqueFailures(failures),
  };
}

function normalizedFailure(item: FitnessBudgetFailure): FitnessBudgetFailure {
  return failure(item.code, item.identity, item.budgetId, item.scope, item.detail, item.evidenceRefs);
}

export function serializeFitnessBudgetReport(report: FitnessBudgetReport): string {
  const normalized: FitnessBudgetReport = {
    ...report,
    baselineIdentity: safeText(report.baselineIdentity),
    sourceCommit: safeText(report.sourceCommit),
    sourceTree: safeText(report.sourceTree),
    budgets: [...report.budgets]
      .map(createBudgetRecord)
      .sort((left, right) => left.budgetId.localeCompare(right.budgetId)),
    failures: uniqueFailures(report.failures.map(normalizedFailure)),
  };
  const serialized = serializeDeterministic(normalized);
  const violation = privacyViolation(serialized);
  if (violation) throw new Error(`privacy-unsafe-fitness-report:${violation}`);
  return serialized;
}

export function assertFitnessBudgetReport(report: FitnessBudgetReport): void {
  if (report.ok) return;
  const first = report.failures[0];
  if (first) throw new Error(`unqualified-fitness-budget:${first.code}:${first.identity}`);
  throw new Error(`unqualified-fitness-report:${report.status}`);
}

export function fitnessBudgetLedgerHash(ledger: FitnessBudgetLedger): string {
  return sha256Text(serializeDeterministic(ledger));
}

export const buildFitnessBudgetLedger = createFitnessBudgetLedger;
export const projectFitnessReport = evaluateFitnessBudgets;
export const checkFitnessBudgets = evaluateFitnessBudgets;
export const assertFitnessBudgets = assertFitnessBudgetReport;
