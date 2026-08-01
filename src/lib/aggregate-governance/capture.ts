import { spawnSync } from 'node:child_process';

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

/**
 * Independently observed counterpart of CaptureIdentity. Every CaptureIdentity
 * field is compared by verifyCoherentCapture; null and undefined normalize as empty.
 */
export type ObservedCaptureFields = {
  [K in keyof CaptureIdentity]?: CaptureIdentity[K] | null | undefined;
};

/** CaptureIdentity fields compared field-wise for expected/observed coherence. */
const CAPTURE_IDENTITY_FIELDS = [
  'captureRevision',
  'importCaptureRevision',
  'deltaCaptureRevision',
  'dbWatermark',
  'releaseSetId',
  'releaseId',
  'releaseHash',
  'sourceDatasetHash',
  'deltaReceiptId',
  'deltaOutputDigest',
  'deltaClassification',
  'runtimeProjectionId',
  'runtimeProjectionDigest',
  'inventoryRunId',
  'structuralUnitIndexVersion',
  'authoringRevision',
  'coverageSourceHash',
] as const satisfies ReadonlyArray<keyof CaptureIdentity>;

/** null and undefined both normalize to empty; non-empty strings stay as String(value). */
function normalizeCaptureField(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

/**
 * Fail closed when any bound identity drifts from its independently observed
 * value. expected and observed must not be the same object reference.
 *
 * Compares every CaptureIdentity field after null/undefined normalization:
 * both empty → match; empty vs non-empty or unequal values → drift.
 *
 * Does NOT require importCaptureRevision / deltaCaptureRevision /
 * authoringRevision to equal captureRevision — those are independent historical
 * lineage identities. Git ancestry of import/delta/authoring is enforced by
 * assertAggregateCaptureRevisionLineage (production runner / harness).
 * Governance capture itself is the current clean HEAD (authoring loader +
 * inventory); that equality is enforced at the runner boundary, not here.
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

  const failures: CoherentCaptureGateResult['failures'] = [];
  for (const field of CAPTURE_IDENTITY_FIELDS) {
    const expectedText = normalizeCaptureField(input.expected[field]);
    const actualText = normalizeCaptureField(input.observed[field]);
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

/** Injectable Git ops so unit tests need no repo; production uses createRepoGitCaptureLineageOps. */
export interface GitCaptureLineageOps {
  /** True when sha is a resolvable 40-char commit in the repository. */
  isResolvableCommit: (sha: string) => boolean;
  /**
   * True when ancestor is an ancestor of descendant, or the same commit.
   * Must fail closed (return false) when either side is unresolvable.
   */
  isAncestorOrEqual: (ancestor: string, descendant: string) => boolean;
}

/**
 * Bind historical lineage captures to the current governance capture without
 * requiring SHA equality.
 *
 * Required historical slots (each must be a resolvable commit that is an
 * ancestor of governanceCaptureRevision, or equal to it):
 * - importCaptureRevision (immutable candidate import/bundle receipt)
 * - deltaCaptureRevision (Delta implementation receipt.captureRevision)
 * - authoringRevision when present (reviewed overlay source revision; may predate
 *   the commit that last touched the active file on the current clean HEAD)
 *
 * Governance itself must be resolvable. Does not invent lineage.
 */
export function assertAggregateCaptureRevisionLineage(input: {
  governanceCaptureRevision: string;
  importCaptureRevision: string;
  deltaCaptureRevision: string;
  /** Reviewed coverage overlay source revision; optional when unbound. */
  authoringRevision?: string | null;
  git: GitCaptureLineageOps;
}): void {
  const governance = input.governanceCaptureRevision;
  if (!COMMIT.test(governance)) {
    throw new Error(
      'Aggregate governance rejected: governance captureRevision is not a 40-char commit',
    );
  }
  if (!input.git.isResolvableCommit(governance)) {
    throw new Error(
      `Aggregate governance rejected: governance captureRevision=${governance} `
      + 'is not a resolvable Git commit',
    );
  }

  const historical: Array<[string, string]> = [
    ['importCaptureRevision', input.importCaptureRevision],
    ['deltaCaptureRevision', input.deltaCaptureRevision],
  ];
  if (input.authoringRevision != null && input.authoringRevision !== '') {
    historical.push(['authoringRevision', String(input.authoringRevision)]);
  }

  for (const [field, sha] of historical) {
    if (!COMMIT.test(sha)) {
      throw new Error(
        `Aggregate governance rejected: ${field} is not a 40-char commit`,
      );
    }
    if (!input.git.isResolvableCommit(sha)) {
      throw new Error(
        `Aggregate governance rejected: ${field}=${sha} is not a resolvable Git commit`,
      );
    }
    if (!input.git.isAncestorOrEqual(sha, governance)) {
      throw new Error(
        `Aggregate governance rejected: ${field}=${sha} is not an ancestor of `
        + `governance capture ${governance}`,
      );
    }
  }
}

/**
 * Delta's candidateEvidenceCaptureRevision must equal the immutable candidate
 * import/bundle receipt capture (not the delta implementation capture).
 */
export function assertCandidateEvidenceCaptureBinding(input: {
  candidateEvidenceCaptureRevision: string | null | undefined;
  candidateImportCaptureRevision: string;
}): void {
  const evidence = input.candidateEvidenceCaptureRevision == null
    ? null
    : String(input.candidateEvidenceCaptureRevision);
  const importCapture = String(input.candidateImportCaptureRevision);
  if (!evidence || !COMMIT.test(evidence)) {
    throw new Error(
      'Aggregate governance rejected: delta.candidateEvidenceCaptureRevision is missing or invalid',
    );
  }
  if (evidence !== importCapture) {
    throw new Error(
      `Aggregate governance rejected: delta.candidateEvidenceCaptureRevision ${evidence} `
      + `does not equal candidate import capture ${importCapture}`,
    );
  }
}

/**
 * Production Git ops for capture lineage. Uses only process git against gitRoot;
 * no fabricated ancestry. Unresolvable commits fail closed (false).
 */
export function createRepoGitCaptureLineageOps(gitRoot: string): GitCaptureLineageOps {
  const run = (args: string[]): { status: number | null; stdout: string } => {
    const result = spawnSync('git', args, {
      cwd: gitRoot,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    return {
      status: result.status,
      stdout: (result.stdout ?? '').trim(),
    };
  };
  return {
    isResolvableCommit: (sha: string) => {
      if (!COMMIT.test(sha)) return false;
      const resolved = run(['rev-parse', '--verify', `${sha}^{commit}`]);
      return resolved.status === 0 && COMMIT.test(resolved.stdout);
    },
    isAncestorOrEqual: (ancestor: string, descendant: string) => {
      if (!COMMIT.test(ancestor) || !COMMIT.test(descendant)) return false;
      if (ancestor === descendant) {
        const self = run(['rev-parse', '--verify', `${ancestor}^{commit}`]);
        return self.status === 0 && self.stdout === ancestor;
      }
      const check = run(['merge-base', '--is-ancestor', ancestor, descendant]);
      return check.status === 0;
    },
  };
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

/** Default hop bound for packaging-noop ancestry walks (fail closed beyond). */
export const AGGREGATE_PACKAGING_ANCESTRY_MAX_HOPS = 16;

/**
 * One ReleaseSet node on a packaging-noop ancestry chain. Production builds
 * this from CURRENT coverage + latest governance receipt + that receipt's
 * accepted Delta base link. Missing fields fail closed during resolution.
 */
export interface PackagingNoopAncestryNode {
  releaseSetId: string;
  hasGovernedCoverage: boolean;
  /** Latest AggregateGovernanceReceipt.mode for this ReleaseSet, if any. */
  latestReceiptMode: string | null;
  /**
   * Base ReleaseSet of the accepted Delta that produced this node
   * (receipt.deltaReceiptId → Delta.baseReleaseSetId). Required to walk past
   * packaging-only intermediates.
   */
  acceptedDeltaBaseReleaseSetId: string | null;
}

/**
 * Choose the ReleaseSet that supplies governed baseline coverage / crosswalks /
 * CURRENT binding decisions for the next runner invocation.
 *
 * Candidate self-state is used only when CURRENT governed coverage already
 * exists on the candidate. A packaging no-op receipt alone is insufficient:
 * first packaging no-op persists a receipt without coverage, and exact replay
 * must continue reading the accepted Delta base coverage baseline.
 *
 * When the accepted Delta base is itself packaging-only, walk only a verified
 * packaging-noop ancestry chain until CURRENT governed coverage is found.
 * Non-packaging intermediates, missing Delta links, cycles, and hop overflow
 * fail closed. Does not invent lineage or alter prior receipt audit identity.
 */
export function selectAggregateGovernanceBaselineSource(input: {
  candidateReleaseSetId: string;
  baseReleaseSetId: string | null | undefined;
  /** True only when the candidate has CURRENT governed coverage rows. */
  candidateHasGovernedCoverage: boolean;
  /**
   * Optional packaging ancestry resolver. Required when the direct Delta base
   * may be packaging-only (production multi-hop). Omitted only for simple
   * single-hop unit fixtures that already point at the semantic baseline.
   */
  resolveAncestryNode?: (releaseSetId: string) => PackagingNoopAncestryNode | null;
  maxHops?: number;
}): {
  baselineReleaseSetId: string;
  usesCandidateSelfState: boolean;
  walkedReleaseSetIds: string[];
} {
  if (input.candidateHasGovernedCoverage) {
    return {
      baselineReleaseSetId: input.candidateReleaseSetId,
      usesCandidateSelfState: true,
      walkedReleaseSetIds: [input.candidateReleaseSetId],
    };
  }

  const start = input.baseReleaseSetId ?? input.candidateReleaseSetId;
  if (!input.resolveAncestryNode) {
    return {
      baselineReleaseSetId: start,
      usesCandidateSelfState: false,
      walkedReleaseSetIds: [start],
    };
  }

  const maxHops = input.maxHops ?? AGGREGATE_PACKAGING_ANCESTRY_MAX_HOPS;
  if (!Number.isInteger(maxHops) || maxHops < 1) {
    throw new Error(
      'Aggregate governance rejected: packaging ancestry maxHops must be a positive integer',
    );
  }

  const walked: string[] = [];
  const visited = new Set<string>();
  let cursor: string | null = start;

  while (cursor != null) {
    if (visited.has(cursor)) {
      throw new Error(
        `Aggregate governance rejected: packaging ancestry cycle at ${cursor}`,
      );
    }
    if (walked.length >= maxHops) {
      throw new Error(
        `Aggregate governance rejected: packaging ancestry exceeded max hops (${maxHops})`,
      );
    }
    visited.add(cursor);
    walked.push(cursor);

    const node = input.resolveAncestryNode(cursor);
    if (!node) {
      throw new Error(
        `Aggregate governance rejected: packaging ancestry node missing for ${cursor}`,
      );
    }
    if (node.releaseSetId !== cursor) {
      throw new Error(
        `Aggregate governance rejected: packaging ancestry identity conflict for ${cursor}`,
      );
    }
    if (node.hasGovernedCoverage) {
      return {
        baselineReleaseSetId: cursor,
        usesCandidateSelfState: false,
        walkedReleaseSetIds: walked,
      };
    }
    // Intermediate without CURRENT coverage must be a verified packaging no-op.
    if (node.latestReceiptMode !== 'packaging_noop') {
      throw new Error(
        `Aggregate governance rejected: packaging ancestry intermediate ${cursor} `
        + `lacks CURRENT coverage and is not a packaging_noop receipt `
        + `(mode=${node.latestReceiptMode ?? 'null'})`,
      );
    }
    if (!node.acceptedDeltaBaseReleaseSetId) {
      throw new Error(
        `Aggregate governance rejected: packaging ancestry missing Delta base link for ${cursor}`,
      );
    }
    if (node.acceptedDeltaBaseReleaseSetId === cursor) {
      throw new Error(
        `Aggregate governance rejected: packaging ancestry self-link at ${cursor}`,
      );
    }
    cursor = node.acceptedDeltaBaseReleaseSetId;
  }

  throw new Error(
    'Aggregate governance rejected: packaging ancestry exhausted without CURRENT coverage',
  );
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
