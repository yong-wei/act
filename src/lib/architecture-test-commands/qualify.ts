import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';
import { REQUIRED_BASELINE } from '@/lib/architecture-charter';

import type {
  DiscoveryCore,
  FailClosedInput,
  FailClosedResult,
  QualificationFailure,
  TestMeasurementReceipt,
} from './types';
import { REQUIRED_CHARTER, TEST_MEASUREMENT_RECEIPT_SCHEMA_VERSION } from './types';

export function evaluateFailClosed(input: FailClosedInput): FailClosedResult {
  const reasons: string[] = [];
  if (input.assertionFailures > 0) reasons.push('assertion-failure');
  if (input.unhandledErrors > 0) reasons.push('unhandled-error');
  if (input.unregisteredSkips.length > 0) reasons.push('unregistered-skip');
  if (input.unresolved > 0) reasons.push('unresolved-discovery');
  if (input.denominatorGaps > 0) reasons.push('denominator-gap');
  if (input.evidenceDrift > 0) reasons.push('evidence-drift');
  if (input.acceptedFailures > 0) reasons.push('accepted-failure');
  if (input.receiptDrift > 0) reasons.push('receipt-drift');
  return { ok: reasons.length === 0, reasons };
}

export function qualifyDiscovery(
  core: DiscoveryCore,
  options: {
    readonly charterSha256?: string | null;
    readonly charterPresent?: boolean;
    readonly dirty?: boolean;
    readonly mixedWorktree?: boolean;
    readonly writeQualified?: boolean;
  } = {},
): QualificationFailure[] {
  const failures: QualificationFailure[] = [];
  if (options.charterPresent === false || !options.charterSha256) {
    failures.push({ code: 'charter-missing-or-unqualified', identity: REQUIRED_CHARTER.schemaVersion });
  } else if (options.charterSha256 !== REQUIRED_CHARTER.sha256) {
    failures.push({ code: 'charter-hash-drift', identity: options.charterSha256 });
  }
  if (core.charter.sha256 !== REQUIRED_CHARTER.sha256) {
    failures.push({ code: 'charter-identity-mismatch', identity: core.charter.sha256 });
  }
  if (core.baseline.censusCoreSha256 !== REQUIRED_BASELINE.censusCoreSha256) {
    failures.push({ code: 'baseline-artifact-hash-drift', identity: core.baseline.censusCoreSha256 });
  }
  if (core.baseline.sourceCommit !== REQUIRED_BASELINE.sourceCommit || core.baseline.sourceTree !== REQUIRED_BASELINE.sourceTree) {
    failures.push({ code: 'baseline-identity-drift', identity: core.baseline.sourceCommit });
  }
  if (core.totals.unresolved > 0) {
    failures.push({ code: 'discovery-denominator-incomplete', identity: String(core.totals.unresolved) });
  }
  if (core.totals.discovered !== core.totals.classified + core.totals.excluded + core.unresolved.filter((item) => item.code === 'missing-root' || item.code === 'missing-classification').length) {
    failures.push({ code: 'discovery-denominator-gap', identity: 'universe-not-closed' });
  }
  if (options.writeQualified && options.dirty) failures.push({ code: 'dirty-worktree', identity: core.sourceCommit });
  if (options.writeQualified && options.mixedWorktree) failures.push({ code: 'mixed-worktree', identity: core.sourceTree });
  return uniqueFailures(failures);
}

export function assertQualified(failures: readonly QualificationFailure[]): void {
  if (failures.length === 0) return;
  throw new Error(failures.map((item) => `${item.code}:${item.identity}`).join(';'));
}

export function createTestMeasurementReceipt(
  input: Omit<TestMeasurementReceipt, 'schemaVersion' | 'receiptId'>,
): TestMeasurementReceipt {
  const draft = {
    schemaVersion: TEST_MEASUREMENT_RECEIPT_SCHEMA_VERSION,
    ...input,
  };
  return {
    ...draft,
    receiptId: sha256Text(serializeDeterministic(draft)),
  };
}

export function deterministicDiscoveryText(core: DiscoveryCore): string {
  return serializeDeterministic(core);
}

export function discoveryCoreHash(core: DiscoveryCore): string {
  return sha256Text(deterministicDiscoveryText(core));
}

function uniqueFailures(failures: readonly QualificationFailure[]): QualificationFailure[] {
  const seen = new Set<string>();
  const result: QualificationFailure[] = [];
  for (const failure of failures) {
    const key = `${failure.code}:${failure.identity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(failure);
  }
  return result;
}
