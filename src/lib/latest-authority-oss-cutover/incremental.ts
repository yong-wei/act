/**
 * Dependency-complete incremental derivation (#1509, tasks 4.x).
 *
 * An unchanged result is reusable only when its complete semantic cache
 * identity is unchanged. Cache identities deliberately exclude global
 * Authority and Runtime Release version labels: an Authority version change
 * alone never invalidates a binding whose referenced Canonical semantics are
 * unchanged, and no input change triggers an unconditional full-library
 * rebuild.
 */

import { projectionDigest } from '@/lib/teaching-projection/hash';

import {
  LatestAuthorityCutoverError,
  type DerivationReceipt,
  type ResourceBindingCacheIdentityInput,
  type TeachingDecisionCacheIdentityInput,
} from './contracts';

/**
 * Complete semantic cache identity for one resource binding: resource and
 * atom identities/content hashes, Canonical id and semantic revision, role,
 * course scope, source identity, qualified pipeline identity, anchor
 * contract, and launcher contract.
 */
export function resourceBindingCacheIdentity(
  input: ResourceBindingCacheIdentityInput,
): string {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new LatestAuthorityCutoverError(
        'cache-identity-incomplete',
        `Resource-binding cache identity field ${key} must be a non-empty string.`,
      );
    }
  }
  return projectionDigest({ kind: 'resource-binding', ...input });
}

/**
 * Complete semantic cache identity for one teaching decision: Canonical
 * member and revision, relation family, scope, evidence, candidate or
 * decision hash, and qualified pipeline identity.
 */
export function teachingDecisionCacheIdentity(
  input: TeachingDecisionCacheIdentityInput,
): string {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new LatestAuthorityCutoverError(
        'cache-identity-incomplete',
        `Teaching-decision cache identity field ${key} must be a non-empty string.`,
      );
    }
  }
  return projectionDigest({ kind: 'teaching-decision', ...input });
}

export interface ComputeDerivationDeltaInput {
  /**
   * Cache identities computed for the predecessor capture, keyed by record
   * identity (e.g. bindingId or decisionId).
   */
  readonly predecessor: Readonly<Record<string, string>>;
  /** Cache identities computed for the successor capture over the same keys. */
  readonly successor: Readonly<Record<string, string>>;
  /**
   * Records that must be recomputed because an upstream dependency changed
   * even though their own cache identity is unchanged (e.g. a dependent
   * summary over a recomputed atom). Optional.
   */
  readonly forceRecomputeKeys?: readonly string[];
}

export interface DerivationDelta {
  readonly reused: readonly string[];
  readonly invalidated: readonly string[];
  readonly recomputed: readonly string[];
  readonly receipt: DerivationReceipt;
}

/**
 * Compute the predecessor-to-successor derivation delta. A record is reused
 * only when its complete cache identity matches exactly; anything else is
 * invalidated and recomputed. The receipt records reuse, invalidation,
 * recomputation, and summary identities.
 */
export function computeDerivationDelta(input: ComputeDerivationDeltaInput): DerivationDelta {
  const predecessorKeys = Object.keys(input.predecessor);
  const successorKeys = Object.keys(input.successor);
  for (const key of predecessorKeys) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u.test(key)) {
      throw new LatestAuthorityCutoverError(
        'derivation-key-invalid',
        `Predecessor cache key is not a stable record identity: ${key}`,
      );
    }
  }
  for (const key of successorKeys) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/u.test(key)) {
      throw new LatestAuthorityCutoverError(
        'derivation-key-invalid',
        `Successor cache key is not a stable record identity: ${key}`,
      );
    }
  }
  const allKeys = Array.from(new Set([...predecessorKeys, ...successorKeys])).sort();
  const reused: string[] = [];
  const invalidated: string[] = [];
  const recomputed: string[] = [];
  const forced = new Set(input.forceRecomputeKeys ?? []);
  for (const key of allKeys) {
    const before = input.predecessor[key];
    const after = input.successor[key];
    if (before !== undefined && after !== undefined && before === after && !forced.has(key)) {
      reused.push(key);
    } else {
      invalidated.push(key);
      if (after !== undefined || before !== undefined) {
        recomputed.push(key);
      }
    }
  }
  const reusedHash = projectionDigest(reused);
  const invalidatedHash = projectionDigest(invalidated);
  const recomputedHash = projectionDigest(recomputed);
  const summaryIdentity = projectionDigest({
    reusedHash,
    invalidatedHash,
    recomputedHash,
    reusedCount: reused.length,
    invalidatedCount: invalidated.length,
    recomputedCount: recomputed.length,
  });
  const receipt: DerivationReceipt = {
    contract: 'coordination-derivation-receipt/v1',
    reusedCount: reused.length,
    invalidatedCount: invalidated.length,
    recomputedCount: recomputed.length,
    reusedHash,
    invalidatedHash,
    recomputedHash,
    summaryIdentity,
    receiptId: `derive-${summaryIdentity.slice(0, 24)}`,
  };
  return { reused, invalidated, recomputed, receipt };
}

/**
 * Guard against an unconditional full-library rebuild: when a predecessor
 * exists and the successor preserves a substantial share of identities, a
 * plan that recomputes everything anyway is a defect, not an optimization.
 */
export function assertNotUnconditionalFullRebuild(
  delta: DerivationDelta,
  options: { predecessorRecordCount: number; minimumReuseRatio?: number },
): void {
  const { predecessorRecordCount, minimumReuseRatio = 0.5 } = options;
  if (predecessorRecordCount === 0) return;
  const reuseRatio = delta.reused.length / predecessorRecordCount;
  if (delta.invalidated.length === predecessorRecordCount && reuseRatio < minimumReuseRatio) {
    throw new LatestAuthorityCutoverError(
      'derivation-full-rebuild',
      `The derivation plan rebuilds the full library (reused ${delta.reused.length}/${predecessorRecordCount}) without a dependency reason.`,
    );
  }
}
