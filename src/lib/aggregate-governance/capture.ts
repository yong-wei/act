import type {
  CaptureIdentity,
  CoherentCaptureGateResult,
} from './contracts';

const COMMIT = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export function assertCaptureIdentityShape(capture: CaptureIdentity): void {
  if (!COMMIT.test(capture.captureRevision)) {
    throw new Error('Aggregate governance rejected: captureRevision (governance) is invalid');
  }
  if (!COMMIT.test(capture.importCaptureRevision)) {
    throw new Error('Aggregate governance rejected: importCaptureRevision is invalid');
  }
  if (!COMMIT.test(capture.deltaCaptureRevision)) {
    throw new Error('Aggregate governance rejected: deltaCaptureRevision is invalid');
  }
  if (!capture.dbWatermark || capture.dbWatermark === 'unknown') {
    throw new Error('Aggregate governance rejected: dbWatermark is required');
  }
  if (!capture.releaseSetId || !capture.releaseId) {
    throw new Error('Aggregate governance rejected: ReleaseSet identity is required');
  }
  if (!SHA256.test(capture.releaseHash)) {
    throw new Error('Aggregate governance rejected: releaseHash is invalid');
  }
  if (!capture.deltaReceiptId || !SHA256.test(capture.deltaOutputDigest)) {
    throw new Error('Aggregate governance rejected: Delta Receipt identity is required');
  }
}

export type ObservedCaptureFields = Partial<CaptureIdentity> & {
  captureRevision?: string | null;
  importCaptureRevision?: string | null;
  deltaCaptureRevision?: string | null;
  dbWatermark?: string | null;
  releaseSetId?: string | null;
  releaseId?: string | null;
  releaseHash?: string | null;
  sourceDatasetHash?: string | null;
  deltaReceiptId?: string | null;
  deltaOutputDigest?: string | null;
  runtimeProjectionDigest?: string | null;
  inventoryRunId?: string | null;
  structuralUnitIndexVersion?: string | null;
  authoringRevision?: string | null;
  coverageSourceHash?: string | null;
};

/**
 * Fail closed when any bound identity drifts from its independently observed value.
 * expected and observed must not be the same object reference.
 *
 * Governance / import / delta capture revisions are distinct immutable
 * identities. They are compared field-wise but are not required to equal each other.
 */
export function verifyCoherentCapture(input: {
  expected: CaptureIdentity;
  observed: ObservedCaptureFields;
}): CoherentCaptureGateResult {
  assertCaptureIdentityShape(input.expected);
  if (input.expected === input.observed) {
    return {
      coherent: false,
      failures: [{
        field: 'observed',
        expected: 'independently observed capture fields',
        actual: 'same object as expected (tautological capture gate)',
      }],
    };
  }

  const pairs: Array<[keyof CaptureIdentity, string | null | undefined]> = [
    ['captureRevision', input.observed.captureRevision],
    ['importCaptureRevision', input.observed.importCaptureRevision],
    ['deltaCaptureRevision', input.observed.deltaCaptureRevision],
    ['dbWatermark', input.observed.dbWatermark],
    ['releaseSetId', input.observed.releaseSetId],
    ['releaseId', input.observed.releaseId],
    ['releaseHash', input.observed.releaseHash],
    ['deltaReceiptId', input.observed.deltaReceiptId],
    ['deltaOutputDigest', input.observed.deltaOutputDigest],
  ];
  if (input.expected.sourceDatasetHash != null) {
    pairs.push(['sourceDatasetHash', input.observed.sourceDatasetHash]);
  }
  if (input.expected.runtimeProjectionDigest != null) {
    pairs.push(['runtimeProjectionDigest', input.observed.runtimeProjectionDigest]);
  }
  if (input.expected.inventoryRunId != null) {
    pairs.push(['inventoryRunId', input.observed.inventoryRunId]);
  }
  if (input.expected.structuralUnitIndexVersion != null) {
    pairs.push(['structuralUnitIndexVersion', input.observed.structuralUnitIndexVersion]);
  }
  if (input.expected.authoringRevision != null) {
    pairs.push(['authoringRevision', input.observed.authoringRevision]);
  }
  if (input.expected.coverageSourceHash != null) {
    pairs.push(['coverageSourceHash', input.observed.coverageSourceHash]);
  }

  const failures: CoherentCaptureGateResult['failures'] = [];
  for (const [field, actual] of pairs) {
    const expected = input.expected[field];
    const expectedText = expected == null ? null : String(expected);
    const actualText = actual == null ? null : String(actual);
    if (expectedText !== actualText) {
      failures.push({
        field,
        expected: expectedText ?? 'null',
        actual: actualText,
      });
    }
  }
  return { coherent: failures.length === 0, failures };
}

export function requireCoherentCapture(
  input: Parameters<typeof verifyCoherentCapture>[0],
): void {
  const result = verifyCoherentCapture(input);
  if (!result.coherent) {
    const detail = result.failures
      .map((row) => `${row.field}: expected ${row.expected}, actual ${row.actual}`)
      .join('; ');
    throw new Error(`Aggregate governance rejected: capture drift (${detail})`);
  }
}

export function buildExpectedCapture(input: {
  captureRevision: string;
  importCaptureRevision: string;
  deltaCaptureRevision: string;
  dbWatermark: string;
  releaseSetId: string;
  releaseId: string;
  releaseHash: string;
  sourceDatasetHash: string | null;
  deltaReceiptId: string;
  deltaOutputDigest: string;
  deltaClassification: string;
  runtimeProjectionId: string | null;
  runtimeProjectionDigest: string | null;
  inventoryRunId: string;
  structuralUnitIndexVersion: string;
  authoringRevision: string;
  coverageSourceHash: string;
}): CaptureIdentity {
  return {
    captureRevision: input.captureRevision,
    importCaptureRevision: input.importCaptureRevision,
    deltaCaptureRevision: input.deltaCaptureRevision,
    dbWatermark: input.dbWatermark,
    releaseSetId: input.releaseSetId,
    releaseId: input.releaseId,
    releaseHash: input.releaseHash,
    sourceDatasetHash: input.sourceDatasetHash,
    deltaReceiptId: input.deltaReceiptId,
    deltaOutputDigest: input.deltaOutputDigest,
    deltaClassification: input.deltaClassification,
    runtimeProjectionId: input.runtimeProjectionId,
    runtimeProjectionDigest: input.runtimeProjectionDigest,
    inventoryRunId: input.inventoryRunId,
    structuralUnitIndexVersion: input.structuralUnitIndexVersion,
    authoringRevision: input.authoringRevision,
    coverageSourceHash: input.coverageSourceHash,
  };
}
