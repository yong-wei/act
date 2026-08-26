import { privacyViolation } from '@/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

export const FAILURE_DISPOSITION_SCHEMA_VERSION = 'act-test-failure-disposition/v1' as const;
export const FAILURE_CLOSURE_RECEIPT_SCHEMA_VERSION = 'act-test-failure-closure-receipt/v1' as const;

export const FAILURE_DISPOSITIONS = ['fix', 'remove', 'release-input', 'external-blocker'] as const;
export const FORBIDDEN_FAILURE_DISPOSITIONS = [
  'accepted',
  'quarantine',
  'silent-skip',
  'skip',
  'flaky-retry',
] as const;

export type FailureDisposition = (typeof FAILURE_DISPOSITIONS)[number];
export type ForbiddenFailureDisposition = (typeof FORBIDDEN_FAILURE_DISPOSITIONS)[number];
export type FailureDispositionStatus = 'open' | 'blocked' | 'closed';
export type FailureClass =
  | 'product-defect'
  | 'test-defect'
  | 'unhandled-error'
  | 'assertion-failure'
  | 'invalid-test-removal'
  | 'release-input-migration'
  | 'external-blocker';

export type FailureEvidence = string | readonly string[] | Readonly<Record<string, unknown>>;

export interface FailureCommandResult {
  readonly command: string;
  readonly exitStatus: number;
  readonly result: 'passed' | 'failed' | 'blocked';
  readonly fingerprints?: readonly string[];
  readonly assertionFailures?: number;
  readonly unhandledErrors?: number;
  readonly unregisteredSkips?: number;
}

export interface FailureClosureProof {
  readonly kind: 'regression-test' | 'retirement-evidence' | 'qualification-manifest';
  readonly evidence: FailureEvidence;
  readonly command?: string;
}

export interface ReleaseInputEvidence {
  readonly manifestPath: string;
  readonly artifactIdentity: string;
  readonly artifactHash: string;
  readonly scope: string;
  readonly capturedAt: string;
}

export interface ExternalBlockerEvidence {
  readonly responseClass: string;
  readonly affectedGate: string;
  readonly responseSummary: string;
  readonly resolutionCondition: string;
}

export interface FailureDispositionRecord {
  readonly schemaVersion: typeof FAILURE_DISPOSITION_SCHEMA_VERSION;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly command: string;
  readonly fingerprint: string;
  readonly testIdentity: string;
  readonly failureClass: FailureClass;
  readonly failureStage: string;
  readonly errorSummary: string;
  readonly evidenceIdentity: string;
  readonly occurrences: number;
  readonly disposition: FailureDisposition;
  readonly owner: string;
  readonly closureCondition: string;
  readonly status: FailureDispositionStatus;
  readonly actionEvidence: FailureEvidence;
  readonly beforeFingerprint?: string;
  readonly afterCommandResult?: FailureCommandResult;
  readonly proof?: FailureClosureProof;
  readonly releaseInput?: ReleaseInputEvidence;
  readonly blocker?: ExternalBlockerEvidence;
}

export interface FailureClosureReceipt {
  readonly schemaVersion: typeof FAILURE_CLOSURE_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly command: string;
  readonly fingerprint: string;
  readonly disposition: FailureDisposition;
  readonly owner: string;
  readonly closureCondition: string;
  readonly status: FailureDispositionStatus;
  readonly beforeFingerprint: string;
  readonly actionEvidence: FailureEvidence;
  readonly afterCommandResult: FailureCommandResult;
  readonly proof?: FailureClosureProof;
  readonly releaseInput?: ReleaseInputEvidence;
  readonly blocker?: ExternalBlockerEvidence;
}

export interface FailureDispositionValidationFailure {
  readonly code: string;
  readonly field: string;
  readonly identity: string;
}

const FAILURE_CLASSES: readonly FailureClass[] = [
  'product-defect',
  'test-defect',
  'unhandled-error',
  'assertion-failure',
  'invalid-test-removal',
  'release-input-migration',
  'external-blocker',
];
const STATUSES: readonly FailureDispositionStatus[] = ['open', 'blocked', 'closed'];
const PROOF_KINDS: readonly FailureClosureProof['kind'][] = [
  'regression-test',
  'retirement-evidence',
  'qualification-manifest',
];
const ABSOLUTE_LOCAL_PATH = /(?:^|[\s"'`=(])(?:\/(?!\/)[^\s"'`]+|~\/|[A-Za-z]:[\\/])/u;
const CREDENTIAL = /(?:authorization\s*[:=]\s*bearer|cookie\s*[:=]|(?:password|(?:access[_-]?)?token|(?:api[_-]?)?key|client[_-]?secret)\s*[:=]\s*[^\s,}]+)/iu;
const FORBIDDEN_WORKAROUND = /(?:widen(?:ed|ing)?(?:\s+the)?[-_ ]*assertions?|broaden(?:ed|ing)?(?:\s+the)?[-_ ]*assertions?|relax(?:ed|ing)?(?:\s+the)?[-_ ]*assertions?|(?:it|describe)\.skip|silent[-_ ]?skip|flaky[-_ ]?retry|quarantin(?:e|ed|ing)|accepted\s+(?:failure|red|test)|(?:inflated|increased|extended|relaxed)\s+(?:the\s+)?timeouts?|timeout[-_ ]?(?:inflated|increased|extended|relaxed|inflation)|(?:filtered|suppressed|ignored)\s+(?:the\s+)?(?:failure|error|test))/iu;

export function validateFailureDisposition(input: unknown): FailureDispositionValidationFailure[] {
  if (!isRecord(input)) return [failure('failure-disposition-shape', 'root')];
  const failures = validateCommon(input, 'failure-disposition');
  requiredString(input, failures, 'testIdentity');
  if (!FAILURE_CLASSES.includes(input.failureClass as FailureClass)) {
    failures.push(failure('failure-disposition-failure-class', 'failureClass'));
  }
  requiredString(input, failures, 'failureStage');
  requiredString(input, failures, 'errorSummary');
  requiredString(input, failures, 'evidenceIdentity');
  if (!Number.isInteger(input.occurrences) || (input.occurrences as number) < 1) {
    failures.push(failure('failure-disposition-occurrences', 'occurrences'));
  }
  if (!hasEvidence(input.actionEvidence)) failures.push(failure('failure-disposition-action-evidence-missing', 'actionEvidence'));
  validateDispositionSpecifics(input, failures);
  return uniqueFailures(failures);
}

export function validateFailureClosureReceipt(input: unknown): FailureDispositionValidationFailure[] {
  if (!isRecord(input)) return [failure('failure-closure-receipt-shape', 'root')];
  const failures = validateCommon(input, 'failure-closure-receipt');
  requiredString(input, failures, 'receiptId');
  requiredString(input, failures, 'beforeFingerprint');
  if (!hasEvidence(input.actionEvidence)) failures.push(failure('failure-closure-action-evidence-missing', 'actionEvidence'));
  if (!isRecord(input.afterCommandResult)) {
    failures.push(failure('failure-closure-after-command-missing', 'afterCommandResult'));
  } else {
    validateCommandResult(input.afterCommandResult, failures);
  }
  validateDispositionSpecifics(input, failures);
  const draft = { ...input } as Record<string, unknown>;
  delete draft.receiptId;
  if (typeof input.receiptId === 'string' && input.receiptId !== sha256Text(serializeDeterministic(draft))) {
    failures.push(failure('failure-closure-receipt-id-drift', 'receiptId'));
  }
  return uniqueFailures(failures);
}

export const validateClosureReceipt = validateFailureClosureReceipt;

export function assertFailureDisposition(input: unknown): asserts input is FailureDispositionRecord {
  const failures = validateFailureDisposition(input);
  if (failures.length > 0) throw new Error(failures.map(formatFailure).join(';'));
}

export function assertFailureClosureReceipt(input: unknown): asserts input is FailureClosureReceipt {
  const failures = validateFailureClosureReceipt(input);
  if (failures.length > 0) throw new Error(failures.map(formatFailure).join(';'));
}

export function createFailureDisposition(
  input: Omit<FailureDispositionRecord, 'schemaVersion'>,
): FailureDispositionRecord {
  return { schemaVersion: FAILURE_DISPOSITION_SCHEMA_VERSION, ...input };
}

export function createFailureClosureReceipt(
  input: Omit<FailureClosureReceipt, 'schemaVersion' | 'receiptId'>,
): FailureClosureReceipt {
  const draft = { schemaVersion: FAILURE_CLOSURE_RECEIPT_SCHEMA_VERSION, ...input };
  return { ...draft, receiptId: sha256Text(serializeDeterministic(draft)) };
}

function validateCommon(
  input: Record<string, unknown>,
  kind: 'failure-disposition' | 'failure-closure-receipt',
): FailureDispositionValidationFailure[] {
  const failures: FailureDispositionValidationFailure[] = [];
  if (input.schemaVersion !== (kind === 'failure-disposition'
    ? FAILURE_DISPOSITION_SCHEMA_VERSION
    : FAILURE_CLOSURE_RECEIPT_SCHEMA_VERSION)) {
    failures.push(failure(`${kind}-schema`, 'schemaVersion'));
  }
  requiredString(input, failures, 'sourceCommit');
  requiredString(input, failures, 'sourceTree');
  requiredString(input, failures, 'command');
  requiredString(input, failures, 'fingerprint', 'failure-disposition-fingerprint-missing');
  requiredString(input, failures, 'owner', 'failure-disposition-owner-missing');
  requiredString(input, failures, 'closureCondition');
  if (!isFailureDisposition(input.disposition)) {
    const code = isForbiddenDisposition(input.disposition)
      ? 'failure-disposition-forbidden'
      : 'failure-disposition-invalid';
    failures.push(failure(code, 'disposition'));
  }
  if (!isStatus(input.status)) failures.push(failure('failure-disposition-status', 'status'));
  if (!hasEvidence(input.actionEvidence)) failures.push(failure(`${kind}-action-evidence-missing`, 'actionEvidence'));
  const privacy = privacyViolation(JSON.stringify(input));
  if (privacy) failures.push(failure(`failure-${privacy}`, 'evidence'));
  if (ABSOLUTE_LOCAL_PATH.test(JSON.stringify(input)) || CREDENTIAL.test(JSON.stringify(input))) {
    failures.push(failure('failure-sensitive-evidence', 'evidence'));
  }
  if (FORBIDDEN_WORKAROUND.test(workaroundText(input)) || hasForbiddenFlag(input)) {
    failures.push(failure('failure-disposition-workaround', 'actionEvidence'));
  }
  if (isRecord(input.afterCommandResult)) validateCommandResult(input.afterCommandResult, failures);
  return failures;
}

function validateDispositionSpecifics(
  input: Record<string, unknown>,
  failures: FailureDispositionValidationFailure[],
): void {
  const disposition = input.disposition;
  const status = input.status;
  if (disposition === 'external-blocker') {
    if (status === 'closed') failures.push(failure('failure-external-blocker-closed', 'status'));
    if (!isRecord(input.afterCommandResult)) {
      failures.push(failure('failure-external-command-result-missing', 'afterCommandResult'));
    } else if (input.afterCommandResult.exitStatus === 0 || input.afterCommandResult.result === 'passed') {
      failures.push(failure('failure-external-blocker-passed', 'afterCommandResult'));
    }
    if (!isRecord(input.blocker)) {
      failures.push(failure('failure-external-blocker-evidence-missing', 'blocker'));
    } else {
      requiredString(input.blocker, failures, 'responseClass', 'failure-external-response-missing');
      requiredString(input.blocker, failures, 'affectedGate', 'failure-external-gate-missing');
      requiredString(input.blocker, failures, 'responseSummary', 'failure-external-response-missing');
      requiredString(input.blocker, failures, 'resolutionCondition', 'failure-external-resolution-missing');
    }
  }
  if (status !== 'closed') return;
  requiredString(input, failures, 'beforeFingerprint', 'failure-closure-before-fingerprint-missing');
  if (!isRecord(input.proof)) {
    failures.push(failure('failure-closure-proof-missing', 'proof'));
  } else {
    requiredString(input.proof, failures, 'kind', 'failure-closure-proof-kind-missing');
    if (!PROOF_KINDS.includes(input.proof.kind as FailureClosureProof['kind'])) {
      failures.push(failure('failure-closure-proof-kind-invalid', 'proof.kind'));
    }
    if (!hasEvidence(input.proof.evidence)) failures.push(failure('failure-closure-proof-evidence-missing', 'proof.evidence'));
    const expectedKind = expectedProofKind(disposition);
    if (expectedKind && input.proof.kind !== expectedKind) {
      failures.push(failure('failure-closure-proof-kind-mismatch', 'proof.kind'));
    }
  }
  if (!isRecord(input.afterCommandResult)) return;
  const result = input.afterCommandResult;
  if (result.exitStatus !== 0 || result.result !== 'passed') {
    failures.push(failure('failure-closure-after-command-failed', 'afterCommandResult'));
  }
  if (Array.isArray(result.fingerprints) && result.fingerprints.includes(String(input.fingerprint))) {
    failures.push(failure('failure-closure-fingerprint-remains', 'afterCommandResult.fingerprints'));
  }
  if (disposition === 'release-input') {
    validateReleaseInput(input, failures);
    if (result.command !== 'test:release') failures.push(failure('failure-release-command', 'afterCommandResult.command'));
  }
}

function validateReleaseInput(
  input: Record<string, unknown>,
  failures: FailureDispositionValidationFailure[],
): void {
  if (!isRecord(input.releaseInput)) {
    failures.push(failure('failure-release-input-evidence-missing', 'releaseInput'));
    return;
  }
  const releaseInput = input.releaseInput;
  requiredString(releaseInput, failures, 'manifestPath', 'failure-release-manifest-missing');
  requiredString(releaseInput, failures, 'artifactIdentity', 'failure-release-artifact-missing');
  requiredString(releaseInput, failures, 'artifactHash', 'failure-release-artifact-hash-missing');
  requiredString(releaseInput, failures, 'scope', 'failure-release-scope-missing');
  requiredString(releaseInput, failures, 'capturedAt', 'failure-release-capture-time-missing');
  if (typeof releaseInput.manifestPath === 'string' && isAbsolutePath(releaseInput.manifestPath)) {
    failures.push(failure('failure-release-manifest-path', 'releaseInput.manifestPath'));
  }
  if (typeof releaseInput.artifactHash === 'string' && !/^(?:sha256:)?[a-f0-9]{64}$/iu.test(releaseInput.artifactHash)) {
    failures.push(failure('failure-release-artifact-hash', 'releaseInput.artifactHash'));
  }
  if (typeof releaseInput.capturedAt === 'string' && !Number.isFinite(Date.parse(releaseInput.capturedAt))) {
    failures.push(failure('failure-release-capture-time', 'releaseInput.capturedAt'));
  }
}

function validateCommandResult(
  input: Record<string, unknown>,
  failures: FailureDispositionValidationFailure[],
): void {
  requiredString(input, failures, 'command', 'failure-closure-command-missing');
  if (!Number.isInteger(input.exitStatus)) failures.push(failure('failure-closure-exit-status', 'afterCommandResult.exitStatus'));
  if (input.result !== 'passed' && input.result !== 'failed' && input.result !== 'blocked') {
    failures.push(failure('failure-closure-result', 'afterCommandResult.result'));
  }
  if (input.fingerprints !== undefined && !isStringArray(input.fingerprints)) {
    failures.push(failure('failure-closure-fingerprints', 'afterCommandResult.fingerprints'));
  }
}

function expectedProofKind(disposition: unknown): FailureClosureProof['kind'] | null {
  if (disposition === 'fix') return 'regression-test';
  if (disposition === 'remove') return 'retirement-evidence';
  if (disposition === 'release-input') return 'qualification-manifest';
  return null;
}

function requiredString(
  input: Record<string, unknown>,
  failures: FailureDispositionValidationFailure[],
  field: string,
  code = `failure-disposition-${field}-missing`,
): void {
  if (typeof input[field] !== 'string' || input[field].trim().length === 0) failures.push(failure(code, field));
}

function hasEvidence(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0 && value.every((item) => typeof item === 'string' && item.trim().length > 0);
  return isRecord(value) && Object.keys(value).length > 0;
}

function workaroundText(input: Record<string, unknown>): string {
  return JSON.stringify({
    actionEvidence: input.actionEvidence,
    proof: input.proof,
    workaround: input.workaround,
    runnerChange: input.runnerChange,
    assertionChange: input.assertionChange,
  });
}

function hasForbiddenFlag(input: Record<string, unknown>): boolean {
  return [
    'accepted',
    'flakyRetry',
    'quarantine',
    'silentSkip',
    'skip',
    'timeoutInflated',
    'widenedAssertions',
    'relaxedAssertions',
  ].some((field) => input[field] === true);
}

function isAbsolutePath(value: string): boolean {
  return ABSOLUTE_LOCAL_PATH.test(value) || value.startsWith('/');
}

function isFailureDisposition(value: unknown): value is FailureDisposition {
  return typeof value === 'string' && FAILURE_DISPOSITIONS.includes(value as FailureDisposition);
}

function isForbiddenDisposition(value: unknown): value is ForbiddenFailureDisposition {
  return typeof value === 'string' && FORBIDDEN_FAILURE_DISPOSITIONS.includes(value as ForbiddenFailureDisposition);
}

function isStatus(value: unknown): value is FailureDispositionStatus {
  return typeof value === 'string' && STATUSES.includes(value as FailureDispositionStatus);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function failure(code: string, field: string): FailureDispositionValidationFailure {
  return { code, field, identity: `failure-disposition:${field}` };
}

function formatFailure(item: FailureDispositionValidationFailure): string {
  return `${item.code}:${item.field}`;
}

function uniqueFailures(
  failures: readonly FailureDispositionValidationFailure[],
): FailureDispositionValidationFailure[] {
  const seen = new Set<string>();
  return failures.filter((item) => {
    const key = `${item.code}:${item.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
