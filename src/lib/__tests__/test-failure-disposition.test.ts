import { describe, expect, it } from 'vitest';

import {
  createFailureClosureReceipt,
  createFailureDisposition,
  FAILURE_CLOSURE_RECEIPT_SCHEMA_VERSION,
  FAILURE_DISPOSITION_SCHEMA_VERSION,
  type FailureCommandResult,
  validateFailureClosureReceipt,
  validateFailureDisposition,
} from '@/lib/architecture-test-commands';

const SOURCE_COMMIT = 'a'.repeat(40);
const SOURCE_TREE = 'b'.repeat(40);
const FINGERPRINT = 'sha256:test-failure';

function commandResult(overrides: Partial<FailureCommandResult> = {}): FailureCommandResult {
  return {
    command: 'test:unit',
    exitStatus: 0,
    result: 'passed',
    fingerprints: [],
    ...overrides,
  };
}

function disposition(overrides: Record<string, unknown> = {}) {
  return createFailureDisposition({
    sourceCommit: SOURCE_COMMIT,
    sourceTree: SOURCE_TREE,
    command: 'test:unit',
    fingerprint: FINGERPRINT,
    testIdentity: 'src/lib/__tests__/example.test.ts::example',
    failureClass: 'assertion-failure',
    failureStage: 'assertion',
    errorSummary: 'expected value did not match the current contract',
    evidenceIdentity: 'test:unit:example',
    occurrences: 1,
    disposition: 'fix',
    owner: 'platform-test',
    closureCondition: 'the focused unit command passes without the fingerprint',
    status: 'closed',
    beforeFingerprint: FINGERPRINT,
    actionEvidence: 'added a focused regression assertion and repaired the source behavior',
    afterCommandResult: commandResult(),
    proof: {
      kind: 'regression-test',
      evidence: 'focused test command passed with the original fingerprint absent',
      command: 'test:unit',
    },
    ...overrides,
  });
}

function releaseInput() {
  return {
    manifestPath: 'artifacts/release/qualification-manifest.json',
    artifactIdentity: 'runtime-evidence:current',
    artifactHash: 'c'.repeat(64),
    scope: 'runtime',
    capturedAt: '2026-08-27T00:00:00.000Z',
  };
}

describe('failure disposition contracts', () => {
  it.each([
    ['unhandled error', 'unhandled-error'],
    ['assertion failure', 'assertion-failure'],
  ])('closes a %s only with a passing regression proof', (_label, failureClass) => {
    const record = disposition({ failureClass });
    expect(validateFailureDisposition(record)).toEqual([]);
    expect(record.schemaVersion).toBe(FAILURE_DISPOSITION_SCHEMA_VERSION);
  });

  it('closes invalid test removal with retirement evidence', () => {
    const record = disposition({
      disposition: 'remove',
      failureClass: 'invalid-test-removal',
      proof: {
        kind: 'retirement-evidence',
        evidence: {
          replacementCapability: 'test-command-contracts',
          callSiteEvidence: 'the retired assertion has no current owner',
        },
      },
    });
    expect(validateFailureDisposition(record)).toEqual([]);
  });

  it('closes release-input migration only with an explicit release qualification result', () => {
    const record = disposition({
      disposition: 'release-input',
      failureClass: 'release-input-migration',
      afterCommandResult: commandResult({ command: 'test:release' }),
      proof: {
        kind: 'qualification-manifest',
        evidence: 'qualification manifest validated the captured artifact',
        command: 'test:release',
      },
      releaseInput: releaseInput(),
    });
    expect(validateFailureDisposition(record)).toEqual([]);
  });

  it('keeps an external blocker blocked and records a safe resolution condition', () => {
    const record = disposition({
      disposition: 'external-blocker',
      failureClass: 'external-blocker',
      status: 'blocked',
      proof: undefined,
      blocker: {
        responseClass: 'permission-denied',
        affectedGate: 'release qualification',
        responseSummary: 'the external service denied the required operation',
        resolutionCondition: 'the repository owner grants the required permission',
      },
      afterCommandResult: commandResult({ command: 'test:release', exitStatus: 1, result: 'blocked' }),
    });
    expect(validateFailureDisposition(record)).toEqual([]);
  });

  it.each(['accepted', 'quarantine', 'silent-skip', 'skip', 'flaky-retry'])('rejects forbidden disposition %s', (forbidden) => {
    const failures = validateFailureDisposition(disposition({ disposition: forbidden }));
    expect(failures.some((item) => item.code === 'failure-disposition-forbidden')).toBe(true);
  });

  it('rejects a workaround that widens assertions', () => {
    const failures = validateFailureDisposition(disposition({ actionEvidence: 'widened assertions to make the test pass' }));
    expect(failures.some((item) => item.code === 'failure-disposition-workaround')).toBe(true);
  });

  it('rejects an unknown failure class', () => {
    const failures = validateFailureDisposition(disposition({ failureClass: 'historical-debt' }));
    expect(failures.some((item) => item.code === 'failure-disposition-failure-class')).toBe(true);
  });

  it('rejects missing owner, fingerprint, and proof for a closed record', () => {
    const failures = validateFailureDisposition(disposition({
      owner: '',
      fingerprint: '',
      proof: undefined,
    }));
    expect(failures.map((item) => item.code)).toEqual(expect.arrayContaining([
      'failure-disposition-owner-missing',
      'failure-disposition-fingerprint-missing',
      'failure-closure-proof-missing',
    ]));
  });

  it('creates and validates a revision-bound closure receipt', () => {
    const receipt = createFailureClosureReceipt({
      sourceCommit: SOURCE_COMMIT,
      sourceTree: SOURCE_TREE,
      command: 'test:unit',
      fingerprint: FINGERPRINT,
      disposition: 'fix',
      owner: 'platform-test',
      closureCondition: 'the focused unit command passes without the fingerprint',
      status: 'closed',
      beforeFingerprint: FINGERPRINT,
      actionEvidence: 'repaired the source behavior and retained a regression test',
      afterCommandResult: commandResult(),
      proof: {
        kind: 'regression-test',
        evidence: 'focused test command passed with the original fingerprint absent',
        command: 'test:unit',
      },
    });
    expect(receipt.schemaVersion).toBe(FAILURE_CLOSURE_RECEIPT_SCHEMA_VERSION);
    expect(receipt.receiptId).toMatch(/^[a-f0-9]{64}$/u);
    expect(validateFailureClosureReceipt(receipt)).toEqual([]);
  });

  it('rejects absolute paths and credentials in closure evidence', () => {
    const receipt = createFailureClosureReceipt({
      sourceCommit: SOURCE_COMMIT,
      sourceTree: SOURCE_TREE,
      command: 'test:unit',
      fingerprint: FINGERPRINT,
      disposition: 'fix',
      owner: 'platform-test',
      closureCondition: 'the focused unit command passes without the fingerprint',
      status: 'closed',
      beforeFingerprint: FINGERPRINT,
      actionEvidence: 'proof captured at /Users/example/private-output.json with authorization: Bearer secret',
      afterCommandResult: commandResult(),
      proof: {
        kind: 'regression-test',
        evidence: 'focused test command passed',
      },
    });
    const failures = validateFailureClosureReceipt(receipt);
    expect(failures.some((item) => item.code === 'failure-absolute-path' || item.code === 'failure-sensitive-evidence')).toBe(true);
  });
});
