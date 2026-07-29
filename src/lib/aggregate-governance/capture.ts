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

/**
 * Choose the ReleaseSet that supplies governed baseline coverage / crosswalks /
 * CURRENT binding decisions for the next runner invocation.
 *
 * Candidate self-state is used only when CURRENT governed coverage already
 * exists on the candidate. A packaging no-op receipt alone is insufficient:
 * first packaging no-op persists a receipt without coverage, and exact replay
 * must continue reading the accepted Delta base coverage baseline.
 */
export function selectAggregateGovernanceBaselineSource(input: {
  candidateReleaseSetId: string;
  baseReleaseSetId: string | null | undefined;
  /** True only when the candidate has CURRENT governed coverage rows. */
  candidateHasGovernedCoverage: boolean;
}): {
  baselineReleaseSetId: string;
  usesCandidateSelfState: boolean;
} {
  if (input.candidateHasGovernedCoverage) {
    return {
      baselineReleaseSetId: input.candidateReleaseSetId,
      usesCandidateSelfState: true,
    };
  }
  return {
    baselineReleaseSetId: input.baseReleaseSetId ?? input.candidateReleaseSetId,
    usesCandidateSelfState: false,
  };
}

/**
 * Persisted governance receipt identity needed to detect exact same-input
 * baseline command replay. Not a re-baseline switch — only exact identity match.
 */
export interface PriorGovernanceReceiptIdentity {
  id: string;
  mode: string;
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
  inventoryRunId: string | null;
  structuralUnitIndexVersion: string | null;
  authoringRevision: string | null;
  coverageSourceHash: string | null;
  coverageVersionId: string | null;
}

function nullableText(value: string | null | undefined): string | null {
  return value == null ? null : String(value);
}

/**
 * True only when the persisted prior receipt is the same baseline governance
 * run under the complete current capture identity. A new Delta, inventory,
 * authoring hash, or any other capture slot must return false so later work
 * stays incremental (OpenSpec: baseline exists ⇒ affected work only).
 */
export function isExactBaselineGovernanceReplay(input: {
  prior: PriorGovernanceReceiptIdentity | null | undefined;
  capture: CaptureIdentity;
  deltaClassification: string;
}): boolean {
  const prior = input.prior;
  if (!prior) return false;
  if (prior.mode !== 'baseline') return false;
  if (input.deltaClassification !== prior.deltaClassification) return false;
  if (input.capture.deltaClassification !== prior.deltaClassification) return false;

  const pairs: Array<[string, string | null, string | null]> = [
    ['captureRevision', prior.captureRevision, input.capture.captureRevision],
    ['importCaptureRevision', prior.importCaptureRevision, input.capture.importCaptureRevision],
    ['deltaCaptureRevision', prior.deltaCaptureRevision, input.capture.deltaCaptureRevision],
    ['dbWatermark', prior.dbWatermark, input.capture.dbWatermark],
    ['releaseSetId', prior.releaseSetId, input.capture.releaseSetId],
    ['releaseId', prior.releaseId, input.capture.releaseId],
    ['releaseHash', prior.releaseHash, input.capture.releaseHash],
    ['sourceDatasetHash', nullableText(prior.sourceDatasetHash), nullableText(input.capture.sourceDatasetHash)],
    ['deltaReceiptId', prior.deltaReceiptId, input.capture.deltaReceiptId],
    ['deltaOutputDigest', prior.deltaOutputDigest, input.capture.deltaOutputDigest],
    ['deltaClassification', prior.deltaClassification, input.capture.deltaClassification],
    ['runtimeProjectionId', nullableText(prior.runtimeProjectionId), nullableText(input.capture.runtimeProjectionId)],
    [
      'runtimeProjectionDigest',
      nullableText(prior.runtimeProjectionDigest),
      nullableText(input.capture.runtimeProjectionDigest),
    ],
    ['inventoryRunId', nullableText(prior.inventoryRunId), nullableText(input.capture.inventoryRunId)],
    [
      'structuralUnitIndexVersion',
      nullableText(prior.structuralUnitIndexVersion),
      nullableText(input.capture.structuralUnitIndexVersion),
    ],
    ['authoringRevision', nullableText(prior.authoringRevision), nullableText(input.capture.authoringRevision)],
    [
      'coverageSourceHash',
      nullableText(prior.coverageSourceHash),
      nullableText(input.capture.coverageSourceHash),
    ],
  ];
  return pairs.every(([, left, right]) => left === right);
}

export function priorGovernanceReceiptIdentityFromCapture(input: {
  id: string;
  mode: string;
  capture: CaptureIdentity;
  coverageVersionId: string | null;
}): PriorGovernanceReceiptIdentity {
  return {
    id: input.id,
    mode: input.mode,
    captureRevision: input.capture.captureRevision,
    importCaptureRevision: input.capture.importCaptureRevision,
    deltaCaptureRevision: input.capture.deltaCaptureRevision,
    dbWatermark: input.capture.dbWatermark,
    releaseSetId: input.capture.releaseSetId,
    releaseId: input.capture.releaseId,
    releaseHash: input.capture.releaseHash,
    sourceDatasetHash: input.capture.sourceDatasetHash,
    deltaReceiptId: input.capture.deltaReceiptId,
    deltaOutputDigest: input.capture.deltaOutputDigest,
    deltaClassification: input.capture.deltaClassification,
    runtimeProjectionId: input.capture.runtimeProjectionId,
    runtimeProjectionDigest: input.capture.runtimeProjectionDigest,
    inventoryRunId: input.capture.inventoryRunId,
    structuralUnitIndexVersion: input.capture.structuralUnitIndexVersion,
    authoringRevision: input.capture.authoringRevision,
    coverageSourceHash: input.capture.coverageSourceHash,
    coverageVersionId: input.coverageVersionId,
  };
}
