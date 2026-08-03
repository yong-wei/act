/**
 * Fail-closed validation of untrusted adapter query results (#1114).
 *
 * Every initial and requery result is bound to the requested adapter namespace,
 * authority owner, versionIdentity, and the closed version-context mapping for
 * that source. Mixed hit provenance is rejected before composition.
 */

import {
  SAR_AUTHORITY_OWNERS,
  type SarCompositionVersionContext,
  type SarSourceAdapter,
  type SarSourceHit,
  type SarSourceNamespace,
  type SarSourceQueryResult,
} from './contracts';
import { expectedSourceVersionClosure } from './version-identity';

export type SarAdapterValidationFailureCode =
  | 'adapter-namespace-mismatch'
  | 'adapter-owner-mismatch'
  | 'adapter-version-mismatch'
  | 'result-namespace-mismatch'
  | 'result-owner-mismatch'
  | 'result-version-mismatch'
  | 'hit-namespace-mismatch'
  | 'hit-version-mismatch'
  | 'hit-release-mismatch'
  | 'hit-overlay-mismatch'
  | 'mixed-hit-provenance'
  | 'duplicate-hit-conflict'
  | 'edge-source-identity-missing';

export class SarAdapterResultError extends Error {
  readonly code: SarAdapterValidationFailureCode;
  readonly namespace: SarSourceNamespace;
  readonly field?: string;

  constructor(
    code: SarAdapterValidationFailureCode,
    namespace: SarSourceNamespace,
    message: string,
    field?: string,
  ) {
    super(message);
    this.name = 'SarAdapterResultError';
    this.code = code;
    this.namespace = namespace;
    this.field = field;
  }
}

function assertHitClosure(
  hit: SarSourceHit,
  expected: ReturnType<typeof expectedSourceVersionClosure>,
  role: 'hit' | 'read-only',
): void {
  if (hit.namespace !== expected.namespace) {
    throw new SarAdapterResultError(
      'hit-namespace-mismatch',
      expected.namespace,
      `${role} ${hit.id} namespace ${hit.namespace} != adapter ${expected.namespace}`,
      hit.id,
    );
  }
  if (hit.versionRef !== expected.versionRef) {
    throw new SarAdapterResultError(
      'hit-version-mismatch',
      expected.namespace,
      `${role} ${hit.id} versionRef ${hit.versionRef} != closed ${expected.versionRef}`,
      hit.id,
    );
  }
  if (hit.releaseSetId !== expected.releaseSetId) {
    throw new SarAdapterResultError(
      'hit-release-mismatch',
      expected.namespace,
      `${role} ${hit.id} releaseSetId mismatch`,
      hit.id,
    );
  }
  if (hit.releaseId !== expected.releaseId) {
    throw new SarAdapterResultError(
      'hit-release-mismatch',
      expected.namespace,
      `${role} ${hit.id} releaseId ${String(hit.releaseId)} != closed ${String(expected.releaseId)}`,
      hit.id,
    );
  }
  if (hit.overlayVersion !== expected.overlayVersion) {
    throw new SarAdapterResultError(
      'hit-overlay-mismatch',
      expected.namespace,
      `${role} ${hit.id} overlayVersion ${String(hit.overlayVersion)} != closed ${String(expected.overlayVersion)}`,
      hit.id,
    );
  }
}

/**
 * Validate one adapter query result against the adapter that produced it and
 * the closed composition version context.
 */
export function assertTrustedAdapterResult(input: {
  adapter: SarSourceAdapter;
  result: SarSourceQueryResult;
  version: SarCompositionVersionContext;
}): SarSourceQueryResult {
  const { adapter, result, version } = input;
  const expected = expectedSourceVersionClosure(adapter.namespace, version);

  if (adapter.namespace !== expected.namespace) {
    throw new SarAdapterResultError(
      'adapter-namespace-mismatch',
      expected.namespace,
      `adapter namespace ${adapter.namespace} != expected ${expected.namespace}`,
    );
  }
  if (adapter.authorityOwner !== SAR_AUTHORITY_OWNERS[adapter.namespace]) {
    throw new SarAdapterResultError(
      'adapter-owner-mismatch',
      adapter.namespace,
      `adapter authorityOwner ${adapter.authorityOwner} is not the pinned owner`,
    );
  }
  if (adapter.versionIdentity !== expected.versionIdentity) {
    throw new SarAdapterResultError(
      'adapter-version-mismatch',
      adapter.namespace,
      `adapter versionIdentity ${adapter.versionIdentity} != closed ${expected.versionIdentity}`,
    );
  }

  if (result.namespace !== adapter.namespace) {
    throw new SarAdapterResultError(
      'result-namespace-mismatch',
      adapter.namespace,
      `result namespace ${result.namespace} != adapter ${adapter.namespace}`,
    );
  }
  if (result.authorityOwner !== adapter.authorityOwner) {
    throw new SarAdapterResultError(
      'result-owner-mismatch',
      adapter.namespace,
      `result authorityOwner ${result.authorityOwner} != adapter ${adapter.authorityOwner}`,
    );
  }
  if (result.versionIdentity !== adapter.versionIdentity) {
    throw new SarAdapterResultError(
      'result-version-mismatch',
      adapter.namespace,
      `result versionIdentity ${result.versionIdentity} != adapter ${adapter.versionIdentity}`,
    );
  }
  if (result.versionIdentity !== expected.versionIdentity) {
    throw new SarAdapterResultError(
      'result-version-mismatch',
      adapter.namespace,
      `result versionIdentity not closed against version context`,
    );
  }

  for (const hit of result.hits) {
    assertHitClosure(hit, expected, 'hit');
  }
  for (const hit of result.readOnlyContext) {
    assertHitClosure(hit, expected, 'read-only');
  }

  // Mixed provenance within the result is already covered by per-hit closure,
  // but reject empty-string identities that would collapse namespaces.
  for (const hit of [...result.hits, ...result.readOnlyContext]) {
    if (!hit.id.trim() || !hit.sourceIdentity.trim()) {
      throw new SarAdapterResultError(
        'mixed-hit-provenance',
        adapter.namespace,
        `hit missing id or sourceIdentity`,
        hit.id,
      );
    }
    if (hit.neighborEdges) {
      for (const edge of hit.neighborEdges) {
        if (!edge.sourceIdentity?.trim()) {
          throw new SarAdapterResultError(
            'edge-source-identity-missing',
            adapter.namespace,
            `neighbor edge ${edge.id} missing sourceIdentity`,
            hit.id,
          );
        }
      }
    }
  }

  assertNoConflictingDuplicateHits(adapter.namespace, [
    ...result.hits,
    ...result.readOnlyContext,
  ]);

  return result;
}

function hitFingerprint(hit: SarSourceHit): string {
  const edges = (hit.neighborEdges ?? [])
    .map((e) =>
      `${e.id}|${e.predicate}|${e.fromId}|${e.toId}|${e.sourceIdentity}`
    )
    .sort()
    .join(';');
  return [
    hit.id,
    hit.objectType,
    hit.label,
    hit.sourceIdentity,
    hit.versionRef,
    hit.releaseSetId,
    String(hit.releaseId),
    String(hit.overlayVersion),
    edges,
  ].join('\0');
}

/**
 * Reject duplicate qualified IDs with conflicting content within one result.
 * Exact identical repeats are allowed (idempotent adapter noise).
 */
export function assertNoConflictingDuplicateHits(
  namespace: SarSourceNamespace,
  hits: readonly SarSourceHit[],
): void {
  const seen = new Map<string, string>();
  for (const hit of hits) {
    const fp = hitFingerprint(hit);
    const prior = seen.get(hit.id);
    if (prior === undefined) {
      seen.set(hit.id, fp);
      continue;
    }
    if (prior !== fp) {
      throw new SarAdapterResultError(
        'duplicate-hit-conflict',
        namespace,
        `Conflicting duplicate hit id ${hit.id} within adapter result`,
        hit.id,
      );
    }
  }
}

/**
 * Merge a hit into the index. Exact identical repeat is allowed; any conflict
 * fails closed (no last-write-wins).
 */
export function mergeHitIntoIndex(
  index: Map<string, SarSourceHit>,
  qualifiedId: string,
  hit: SarSourceHit,
  namespace: SarSourceNamespace,
): void {
  const prior = index.get(qualifiedId);
  if (!prior) {
    index.set(qualifiedId, hit);
    return;
  }
  if (hitFingerprint(prior) !== hitFingerprint(hit)) {
    throw new SarAdapterResultError(
      'duplicate-hit-conflict',
      namespace,
      `Conflicting hit merge for ${qualifiedId}`,
      hit.id,
    );
  }
}
