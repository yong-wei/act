/**
 * Cross-namespace reviewed binding gates for Canonical SAR (#1114).
 *
 * Production cross-namespace traversal is limited to reviewed KAQ and resource
 * bindings (OpenSpec multi-domain scenarios). Path/learner participate as
 * source adapters / explicit seeds; cross-namespace path/learner bindings are
 * test-only fixtures, not production projectors.
 */

import {
  assertAcceptedBindingEvidence,
  assertBindingKindMatrix,
  SarBindingCapabilityError,
} from './binding-capability';
import type {
  SarCompositionScope,
  SarCompositionVersionContext,
  SarCrossNamespaceBinding,
  SarSourceNamespace,
  SarTraversalSkipReason,
} from './contracts';

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * True only for ACCEPTED shadow bindings that pass the kind matrix, evidence,
 * aggregate pin, and overlay closure.
 */
export function isReviewedCrossNamespaceBinding(
  binding: SarCrossNamespaceBinding,
  version: SarCompositionVersionContext,
): boolean {
  try {
    assertAcceptedBindingEvidence(binding, version);
    return true;
  } catch (error) {
    if (error instanceof SarBindingCapabilityError) return false;
    throw error;
  }
}

function scopeMatchesBinding(
  binding: SarCrossNamespaceBinding,
  scope: SarCompositionScope,
): boolean {
  if (binding.kind === 'path-canonical') {
    if (scope.courseId !== undefined && scope.courseId !== binding.courseId) {
      return false;
    }
    if (
      scope.learningGoalId !== undefined
      && scope.learningGoalId !== binding.learningGoalId
    ) {
      return false;
    }
    if (!nonEmpty(scope.courseId) || !nonEmpty(scope.learningGoalId)) {
      return false;
    }
    return true;
  }
  if (binding.kind === 'learner-canonical') {
    if (!nonEmpty(scope.courseId) || scope.courseId !== binding.courseId) {
      return false;
    }
    if (
      !nonEmpty(scope.learningGoalId)
      || scope.learningGoalId !== binding.learningGoalId
    ) {
      return false;
    }
    if (!nonEmpty(scope.studentId) || scope.studentId !== binding.studentId) {
      return false;
    }
    if (!nonEmpty(scope.classId) || scope.classId !== binding.classId) {
      return false;
    }
    return true;
  }
  return true;
}

export function evaluateBindingForTraversal(input: {
  binding: SarCrossNamespaceBinding;
  version: SarCompositionVersionContext;
  seed: { namespace: SarSourceNamespace; localId: string };
  admittedCanonicalIds: readonly string[];
  scope: SarCompositionScope;
}): {
  allowed: boolean;
  neighbor: { namespace: SarSourceNamespace; localId: string } | null;
  reason: SarTraversalSkipReason | null;
} {
  const { binding, version, seed, admittedCanonicalIds, scope } = input;

  try {
    assertBindingKindMatrix(binding);
  } catch {
    return { allowed: false, neighbor: null, reason: 'unreviewed-binding' };
  }

  if (binding.sameNameAutoMatch !== false || binding.inheritedFromLegacyId !== null) {
    return { allowed: false, neighbor: null, reason: 'same-name-only' };
  }
  if (binding.reviewState !== 'ACCEPTED') {
    return { allowed: false, neighbor: null, reason: 'unreviewed-binding' };
  }
  if (
    binding.releaseSetId !== version.releaseSetId
    || binding.releaseId !== version.releaseId
  ) {
    return { allowed: false, neighbor: null, reason: 'version-mismatch' };
  }
  if (
    !nonEmpty(binding.objectRevision)
    || !nonEmpty(binding.evidenceDigest)
    || !nonEmpty(binding.reviewIdentity)
  ) {
    return { allowed: false, neighbor: null, reason: 'missing-evidence' };
  }
  if (!isReviewedCrossNamespaceBinding(binding, version)) {
    return { allowed: false, neighbor: null, reason: 'unreviewed-binding' };
  }
  if (!scopeMatchesBinding(binding, scope)) {
    return { allowed: false, neighbor: null, reason: 'outside-scope' };
  }

  const matchesFrom =
    seed.namespace === binding.fromNamespace
    && seed.localId === binding.fromIdentity;
  const matchesTo =
    seed.namespace === binding.toNamespace
    && seed.localId === binding.toIdentity;
  if (!matchesFrom && !matchesTo) {
    return { allowed: false, neighbor: null, reason: 'missing-binding' };
  }

  const neighbor = matchesFrom
    ? { namespace: binding.toNamespace, localId: binding.toIdentity }
    : { namespace: binding.fromNamespace, localId: binding.fromIdentity };

  if (
    neighbor.namespace === 'repository'
    && !admittedCanonicalIds.includes(neighbor.localId)
  ) {
    return { allowed: false, neighbor: null, reason: 'outside-scope' };
  }
  if (
    seed.namespace === 'repository'
    && !admittedCanonicalIds.includes(seed.localId)
  ) {
    return { allowed: false, neighbor: null, reason: 'outside-scope' };
  }

  return { allowed: true, neighbor, reason: null };
}

export function rejectSameNameAsBinding(input: {
  leftId: string;
  rightId: string;
  leftLabel: string;
  rightLabel: string;
}): { left: string; right: string; reason: 'same-name-only' } {
  void input.leftLabel;
  void input.rightLabel;
  return {
    left: input.leftId,
    right: input.rightId,
    reason: 'same-name-only',
  };
}

// Production KAQ/resource projectors live in binding-capability.ts (private seal).
export {
  projectReviewedKaqBindingsToSar,
  projectReviewedResourceBindingsToSar,
} from './binding-capability';
