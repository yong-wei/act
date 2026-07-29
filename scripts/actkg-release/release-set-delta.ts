/**
 * ACT ReleaseSet Delta facade (#1132).
 *
 * Orchestrates snapshot load → pure compute → optional upstream cross-check
 * → immutable receipt/signal persistence. Never moves selectors.
 */
import path from 'node:path';

import type { PrismaClient } from '@prisma/client';

import { resolveTrustedCaptureRevision } from './capture-revision';
import {
  assertSignalsAreGeneric,
  computeReleaseSetDelta,
  emptyEvidenceRef,
  parseUpstreamReleaseDiff,
} from './release-set-delta-compute';
import {
  loadCandidateEvidenceByReleaseId,
  loadStandardAcceptedEvidence,
  loadUpstreamReleaseDiffRaw,
  resolveBaseForCandidate,
  type LoadedAcceptedEvidence,
} from './release-set-delta-load';
import {
  persistReleaseSetDelta,
  verifyReleaseSetDelta,
} from './release-set-delta-persist';
import type {
  ComputedReleaseSetDelta,
  PersistedDeltaReceiptResult,
  UpstreamReleaseDiffV1,
} from './release-set-delta-types';
import { RELEASE_SET_DELTA_ALGORITHM_VERSION } from './release-set-delta-types';

export {
  RELEASE_SET_DELTA_ALGORITHM_VERSION,
  UPSTREAM_RELEASE_DIFF_CONTRACT,
} from './release-set-delta-types';
export type {
  ComputedReleaseSetDelta,
  DeltaClassification,
  DeltaSemanticSnapshot,
  PersistedDeltaReceiptResult,
  ReleaseSetDeltaDetails,
} from './release-set-delta-types';
export {
  computeReleaseSetDelta,
  emitDeltaSignals,
  emptyDetails,
  emptyEvidenceRef,
  isPackagingRevisionOnly,
  parseUpstreamReleaseDiff,
  crossCheckUpstreamDiff,
  assertSignalsAreGeneric,
  computeSignalDigest,
  buildVocabulary,
  computeSemanticCollectionDigest,
  digestObjectMaterialIdentity,
  digestPayload,
  canonicalJson,
  sha256Hex,
} from './release-set-delta-compute';
export {
  loadCandidateEvidenceByReleaseId,
  loadExactAcceptedEvidence,
  loadStandardAcceptedEvidence,
  listAcceptedAnchors,
  resolveBaseForCandidate,
  isStrictlyPriorAnchor,
  anchorSortKey,
} from './release-set-delta-load';
export {
  persistReleaseSetDelta,
  verifyReleaseSetDelta,
  assertSignalDigestSetsMatch,
} from './release-set-delta-persist';

/**
 * Protected paths for ACT delta capture-revision resolution.
 * Dirty or untracked drift on any of these fails closed.
 * Test-only helpers (e.g. actkg-postgres-harness-policy) are intentionally excluded.
 */
export const DELTA_CAPTURE_PROTECTED_PATHS = [
  'scripts/actkg-release/release-set-delta.ts',
  'scripts/actkg-release/release-set-delta-compute.ts',
  'scripts/actkg-release/release-set-delta-load.ts',
  'scripts/actkg-release/release-set-delta-persist.ts',
  'scripts/actkg-release/release-set-delta-types.ts',
  'scripts/actkg-release/capture-revision.ts',
  'scripts/actkg-release/standard-bundle-import.ts',
  'scripts/db/compute-actkg-release-set-delta.ts',
  'scripts/db/import-compatible-actkg-public-bundle.ts',
  'prisma/schema.prisma',
  'prisma/migrations/20260729180000_govern_actkg_release_set_deltas/migration.sql',
] as const;

export interface ComputeAndPersistDeltaOptions {
  /** Candidate release id (exact or standard). Always validated against loaded evidence. */
  candidateReleaseId: string;
  /** Optional standard Bundle digest to pin packaging evidence. */
  candidateBundleDigest?: string;
  /** Optional standard Bundle receipt id. */
  candidateBundleReceiptId?: string;
  /** When true, recompute and compare only; never write. */
  verifyOnly?: boolean;
  /**
   * Optional expected capture revision. Compared to the real current Git HEAD
   * only after cleanliness and tracking succeed. Never authorizes a dirty tree
   * and never becomes a fallback source of truth.
   */
  expectedCaptureRevision?: string;
  /** Git root for capture resolution. Defaults to process.cwd(). */
  gitRoot?: string;
}

function failCapture(message: string): never {
  throw new Error(`ActKG ReleaseSet Delta capture rejected: ${message}`);
}

/**
 * Resolve the trusted ACT delta implementation capture revision.
 */
export function resolveDeltaCaptureRevision(options?: {
  gitRoot?: string;
  expectedCaptureRevision?: string;
}): string {
  const gitRoot = path.resolve(options?.gitRoot ?? process.cwd());
  return resolveTrustedCaptureRevision({
    gitRoot,
    trackedPaths: [...DELTA_CAPTURE_PROTECTED_PATHS],
    expectedCaptureRevision: options?.expectedCaptureRevision,
    fail: failCapture,
  });
}

async function loadCandidate(
  db: PrismaClient,
  options: ComputeAndPersistDeltaOptions,
): Promise<LoadedAcceptedEvidence> {
  if (options.candidateBundleReceiptId) {
    const loaded = await loadStandardAcceptedEvidence(db, options.candidateBundleReceiptId);
    if (loaded.snapshot.releaseId !== options.candidateReleaseId) {
      throw new Error(
        `candidate release id mismatch: requested ${options.candidateReleaseId}, `
        + `bundle receipt binds ${loaded.snapshot.releaseId}`,
      );
    }
    if (
      options.candidateBundleDigest
      && loaded.evidence.bundleDigest !== options.candidateBundleDigest
    ) {
      throw new Error(
        `candidate bundle digest mismatch: requested ${options.candidateBundleDigest}, `
        + `loaded ${loaded.evidence.bundleDigest}`,
      );
    }
    return loaded;
  }
  return loadCandidateEvidenceByReleaseId(db, options.candidateReleaseId, {
    bundleDigest: options.candidateBundleDigest,
  });
}

function prepareUpstream(
  rawResult: { required: boolean; raw: unknown | null; parseError: string | null },
): { upstreamDiff: UpstreamReleaseDiffV1 | null; upstreamParseError: string | null } {
  if (rawResult.parseError) {
    // Ambiguous multi-artifact and required artifacts always fail authorization.
    if (rawResult.required) {
      return { upstreamDiff: null, upstreamParseError: rawResult.parseError };
    }
    return { upstreamDiff: null, upstreamParseError: null };
  }
  if (!rawResult.raw) {
    return { upstreamDiff: null, upstreamParseError: null };
  }
  try {
    const parsed = parseUpstreamReleaseDiff(rawResult.raw);
    return { upstreamDiff: parsed, upstreamParseError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (rawResult.required) {
      return { upstreamDiff: null, upstreamParseError: message };
    }
    return { upstreamDiff: null, upstreamParseError: null };
  }
}

/**
 * Fully recompute a ReleaseSet Delta from verified DB snapshots.
 */
export async function recomputeReleaseSetDelta(
  db: PrismaClient,
  options: ComputeAndPersistDeltaOptions,
): Promise<ComputedReleaseSetDelta> {
  const candidate = await loadCandidate(db, options);
  if (candidate.snapshot.releaseId !== options.candidateReleaseId) {
    throw new Error(
      `candidate release id mismatch: requested ${options.candidateReleaseId}, `
      + `loaded ${candidate.snapshot.releaseId}`,
    );
  }

  const base = await resolveBaseForCandidate(db, candidate);
  const upstreamRaw = await loadUpstreamReleaseDiffRaw(db, candidate);
  const { upstreamDiff, upstreamParseError } = prepareUpstream(upstreamRaw);

  const captureRevision = resolveDeltaCaptureRevision({
    gitRoot: options.gitRoot,
    expectedCaptureRevision: options.expectedCaptureRevision,
  });

  const computed = computeReleaseSetDelta({
    candidateSnapshot: candidate.snapshot,
    candidateEvidence: candidate.evidence,
    baseSnapshot: base?.snapshot ?? null,
    baseEvidence: base?.evidence ?? emptyEvidenceRef(),
    captureRevision,
    upstreamDiff,
    upstreamParseError,
  });

  if (computed.authorizationState === 'ACCEPTED') {
    assertSignalsAreGeneric(computed.signals);
  }
  return computed;
}

/**
 * Recompute and either persist or verify-only.
 *
 * verify-only never writes. When a receipt already exists it is cross-checked
 * against the recomputation; when no receipt exists yet the recomputed result is
 * returned without persistence.
 */
export async function computeAndPersistReleaseSetDelta(
  db: PrismaClient,
  options: ComputeAndPersistDeltaOptions,
): Promise<{ computed: ComputedReleaseSetDelta; persisted: PersistedDeltaReceiptResult }> {
  const computed = await recomputeReleaseSetDelta(db, options);
  if (!options.verifyOnly) {
    const persisted = await persistReleaseSetDelta(db, computed);
    return { computed, persisted };
  }

  const existing = await db.actkgReleaseSetDeltaReceipt.findUnique({
    where: { naturalKey: computed.naturalKey },
    select: { id: true },
  });
  if (existing) {
    const persisted = await verifyReleaseSetDelta(db, computed);
    return { computed, persisted };
  }

  return {
    computed,
    persisted: {
      mode: 'verify-only',
      receiptId: `unpersisted:${computed.naturalKey}`,
      classification: computed.classification,
      authorizationState: computed.authorizationState,
      inputDigest: computed.inputDigest,
      outputDigest: computed.outputDigest,
      naturalKey: computed.naturalKey,
      signalCount: computed.signals.length,
      upstreamCrosscheckStatus: computed.upstream.status,
      selectorsUnchanged: true,
    },
  };
}
