import { privacyViolation } from '../../src/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '../../src/lib/architecture-census/serialize';
import {
  GRAPH_IDS,
  type GraphId,
  type GraphMeasurementReceipt,
} from '../typescript-graphs/contracts';
import {
  QUALITY_GATE_RECEIPT_SCHEMA_VERSION,
  type QualityCommandId,
  type QualityLayerId,
  type RequiredQualityCheck,
} from './registry';

export type LayerReceiptStatus = 'passed' | 'failed' | 'blocked' | 'blocked-unverified';
export type CheckExecutionStatus = 'passed' | 'failed' | 'blocked' | 'skipped';

export interface CheckExecutionResult {
  readonly checkId: string;
  readonly status: CheckExecutionStatus;
  readonly commandIds: readonly QualityCommandId[];
  readonly exitStatus: number | null;
  readonly receiptIds: readonly string[];
  readonly failureCodes: readonly string[];
  readonly unhandledErrors: number;
}

export interface FailureDisposition {
  readonly checkId: string;
  readonly code: string;
  readonly detail: string;
}

export interface ExternalBlocker {
  readonly id: string;
  readonly responseClass: string;
  readonly affectedGate: string;
  readonly resolutionCondition: string;
}

export interface ArtifactIdentity {
  readonly id: string;
  readonly schema: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
}

export interface LayerReceipt {
  readonly schemaVersion: typeof QUALITY_GATE_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly layer: QualityLayerId;
  readonly status: LayerReceiptStatus;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
  readonly workflowRunId: string | null;
  readonly checkIds: readonly string[];
  readonly commandIds: readonly QualityCommandId[];
  readonly scope: string;
  readonly requiredInputs: readonly string[];
  readonly results: readonly CheckExecutionResult[];
  readonly counts: {
    readonly required: number;
    readonly passed: number;
    readonly failed: number;
    readonly blocked: number;
    readonly skipped: number;
  };
  readonly unhandledErrors: number;
  readonly failureDispositions: readonly FailureDisposition[];
  readonly externalBlockers: readonly ExternalBlocker[];
  readonly artifactIdentities: readonly ArtifactIdentity[];
  readonly capturedAt: string;
}

export interface LayerReceiptInput {
  readonly layer: QualityLayerId;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
  readonly workflowRunId?: string | null;
  readonly scope: string;
  readonly requiredInputs: readonly string[];
  readonly checks: readonly RequiredQualityCheck[];
  readonly results: readonly CheckExecutionResult[];
  readonly failureDispositions?: readonly FailureDisposition[];
  readonly externalBlockers?: readonly ExternalBlocker[];
  readonly artifactIdentities?: readonly ArtifactIdentity[];
  readonly capturedAt: string;
}

export interface ReceiptFailure {
  readonly code: string;
  readonly identity: string;
}

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function normalizeResult(result: CheckExecutionResult): CheckExecutionResult {
  return {
    ...result,
    commandIds: sortUnique(result.commandIds) as QualityCommandId[],
    receiptIds: sortUnique(result.receiptIds),
    failureCodes: sortUnique(result.failureCodes),
  };
}

function resultStatusCounts(results: readonly CheckExecutionResult[]) {
  return {
    required: results.length,
    passed: results.filter((result) => result.status === 'passed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    blocked: results.filter((result) => result.status === 'blocked').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
  };
}

function receiptStatus(input: LayerReceiptInput, results: readonly CheckExecutionResult[]): LayerReceiptStatus {
  if (input.externalBlockers && input.externalBlockers.length > 0) return 'blocked';
  if (input.dirty || input.mixedWorktree) return 'blocked';
  if (results.some((result) => result.status === 'blocked' || result.status === 'skipped')) return 'blocked';
  if (results.some((result) => result.status === 'failed' || result.exitStatus !== 0 || result.unhandledErrors > 0)) return 'failed';
  return 'passed';
}

export function createLayerReceipt(input: LayerReceiptInput): LayerReceipt {
  const results = input.results.map(normalizeResult).sort((left, right) => left.checkId.localeCompare(right.checkId));
  const checkIds = sortUnique(input.checks.map((item) => item.checkId));
  const commandIds = sortUnique(results.flatMap((result) => result.commandIds)) as QualityCommandId[];
  const counts = resultStatusCounts(results);
  const body = {
    schemaVersion: QUALITY_GATE_RECEIPT_SCHEMA_VERSION,
    layer: input.layer,
    status: receiptStatus(input, results),
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    dirty: input.dirty,
    mixedWorktree: input.mixedWorktree,
    workflowRunId: input.workflowRunId ?? null,
    checkIds,
    commandIds,
    scope: input.scope,
    requiredInputs: sortUnique(input.requiredInputs),
    results,
    counts,
    unhandledErrors: results.reduce((total, result) => total + result.unhandledErrors, 0),
    failureDispositions: [...(input.failureDispositions ?? [])].sort((left, right) => `${left.checkId}:${left.code}`.localeCompare(`${right.checkId}:${right.code}`)),
    externalBlockers: [...(input.externalBlockers ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    artifactIdentities: [...(input.artifactIdentities ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    capturedAt: input.capturedAt,
  } satisfies Omit<LayerReceipt, 'receiptId'>;
  const serialized = serializeDeterministic(body);
  const violation = privacyViolation(serialized);
  if (violation) throw new Error(`privacy-unsafe-quality-gate-receipt:${violation}`);
  return { ...body, receiptId: sha256Text(serialized) };
}

export function validateLayerReceipt(receipt: LayerReceipt, checks: readonly RequiredQualityCheck[]): ReceiptFailure[] {
  const failures: ReceiptFailure[] = [];
  if (receipt.schemaVersion !== QUALITY_GATE_RECEIPT_SCHEMA_VERSION) failures.push({ code: 'receipt-schema', identity: receipt.layer });
  if (!receipt.sourceCommit) failures.push({ code: 'receipt-source-commit-missing', identity: receipt.layer });
  if (!receipt.sourceTree) failures.push({ code: 'receipt-source-tree-missing', identity: receipt.layer });
  if (receipt.workflowRunId?.startsWith('/')) failures.push({ code: 'receipt-workflow-identity-invalid', identity: receipt.layer });
  const expected = createLayerReceipt({
    layer: receipt.layer,
    sourceCommit: receipt.sourceCommit,
    sourceTree: receipt.sourceTree,
    dirty: receipt.dirty,
    mixedWorktree: receipt.mixedWorktree,
    workflowRunId: receipt.workflowRunId,
    scope: receipt.scope,
    requiredInputs: receipt.requiredInputs,
    checks,
    results: receipt.results,
    failureDispositions: receipt.failureDispositions,
    externalBlockers: receipt.externalBlockers,
    artifactIdentities: receipt.artifactIdentities,
    capturedAt: receipt.capturedAt,
  });
  if (receipt.receiptId !== expected.receiptId) failures.push({ code: 'receipt-id-drift', identity: receipt.layer });
  const requiredIds = sortUnique(checks.filter((item) => item.required).map((item) => item.checkId));
  const resultIds = receipt.results.map((result) => result.checkId);
  for (const checkId of requiredIds) {
    const matches = resultIds.filter((item) => item === checkId).length;
    if (matches === 0) failures.push({ code: 'required-check-result-missing', identity: checkId });
    if (matches > 1) failures.push({ code: 'required-check-result-duplicate', identity: checkId });
  }
  if (receipt.results.some((result) => !requiredIds.includes(result.checkId))) failures.push({ code: 'receipt-unregistered-check', identity: receipt.layer });
  const counts = resultStatusCounts(receipt.results);
  if (serializeDeterministic(receipt.counts) !== serializeDeterministic(counts)) failures.push({ code: 'receipt-count-drift', identity: receipt.layer });
  const expectedStatus = receiptStatus({
    layer: receipt.layer,
    sourceCommit: receipt.sourceCommit,
    sourceTree: receipt.sourceTree,
    dirty: receipt.dirty,
    mixedWorktree: receipt.mixedWorktree,
    workflowRunId: receipt.workflowRunId,
    scope: receipt.scope,
    requiredInputs: receipt.requiredInputs,
    checks,
    results: receipt.results,
    failureDispositions: receipt.failureDispositions,
    externalBlockers: receipt.externalBlockers,
    artifactIdentities: receipt.artifactIdentities,
    capturedAt: receipt.capturedAt,
  }, receipt.results);
  if (receipt.status !== expectedStatus) failures.push({ code: 'receipt-status-drift', identity: receipt.layer });
  if (receipt.status === 'passed' && (receipt.dirty || receipt.mixedWorktree || receipt.unhandledErrors > 0)) failures.push({ code: 'passed-receipt-not-clean', identity: receipt.layer });
  const violation = privacyViolation(serializeDeterministic(receipt));
  if (violation) failures.push({ code: `receipt-privacy-${violation}`, identity: receipt.layer });
  return [...new Map(failures.map((failure) => [`${failure.code}:${failure.identity}`, failure])).values()]
    .sort((left, right) => `${left.code}:${left.identity}`.localeCompare(`${right.code}:${right.identity}`));
}

export function validateTypecheckReceipts(
  receipts: readonly GraphMeasurementReceipt[],
  input: { readonly sourceCommit: string; readonly sourceTree: string; readonly requiredGraphs?: readonly GraphId[] } ,
): ReceiptFailure[] {
  const failures: ReceiptFailure[] = [];
  const requiredGraphs = input.requiredGraphs ?? [...GRAPH_IDS];
  for (const graph of requiredGraphs) {
    const command = `typecheck:${graph}`;
    const matches = receipts.filter((receipt) => receipt.command === command);
    if (matches.length === 0) {
      failures.push({ code: 'typecheck-receipt-missing', identity: command });
      continue;
    }
    if (matches.length > 1) failures.push({ code: 'typecheck-receipt-duplicate', identity: command });
    const receipt = matches[matches.length - 1];
    if (receipt.sourceCommit !== input.sourceCommit || receipt.sourceTree !== input.sourceTree) failures.push({ code: 'typecheck-receipt-stale', identity: command });
    if (receipt.dirty) failures.push({ code: 'typecheck-receipt-dirty', identity: command });
    if (receipt.status !== 'passed') failures.push({ code: 'typecheck-receipt-status', identity: `${command}:${receipt.status}` });
    if (receipt.exitStatus !== 0) failures.push({ code: 'typecheck-receipt-exit', identity: command });
    if (receipt.tscErrorCount !== 0) failures.push({ code: 'typecheck-receipt-tsc-errors', identity: command });
    if (receipt.fixtureProbe) failures.push({ code: 'typecheck-receipt-fixture-probe', identity: command });
  }
  return [...new Map(failures.map((failure) => [`${failure.code}:${failure.identity}`, failure])).values()]
    .sort((left, right) => `${left.code}:${left.identity}`.localeCompare(`${right.code}:${right.identity}`));
}
