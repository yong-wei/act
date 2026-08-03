/**
 * KAQ authority selector (#1113).
 *
 * Formal diagnosis / recommendation / planning remain LEGACY until the final
 * multi-consumer downtime cutover. Reviewed Canonical bindings and Teaching
 * Projection availability are migration-review data only and cannot locally
 * activate formal consumers.
 */

import type {
  KaqAuthorityConsumer,
  KaqAuthoritySelector,
  KaqCanonicalBinding,
  TeachingProjectionAvailability,
} from './contracts';

export type KaqCutoverVerificationFailure =
  | 'cutover-not-implemented'
  | 'cutover-local-activation-forbidden';

export class KaqCutoverActivationError extends Error {
  readonly code: KaqCutoverVerificationFailure;

  constructor(code: KaqCutoverVerificationFailure, message: string) {
    super(message);
    this.name = 'KaqCutoverActivationError';
    this.code = code;
  }
}

export interface SelectKaqAuthorityOptions {
  /**
   * Accepted only so callers can prove a self-minted receipt cannot activate
   * Canonical production in #1113. Always ignored for activation.
   */
  cutoverReceiptId?: string | null;
}

/**
 * - FORMAL_* → LEGACY (production authoritative)
 * - MIGRATION_REVIEW → CANONICAL_SHADOW (readiness only)
 * - CUTOVER_ACTIVATION → always throws; no executable local path
 */
export function selectKaqAuthority(
  consumer: KaqAuthorityConsumer = 'FORMAL_PLANNING',
  _options: SelectKaqAuthorityOptions = {},
): KaqAuthoritySelector {
  if (
    consumer === 'FORMAL_DIAGNOSIS'
    || consumer === 'FORMAL_RECOMMENDATION'
    || consumer === 'FORMAL_PLANNING'
  ) {
    return {
      consumer,
      authority: 'LEGACY',
      productionAuthoritative: true,
      canonicalBindingsVisible: false,
      teachingProjectionVisible: false,
    };
  }
  if (consumer === 'CUTOVER_ACTIVATION') {
    throw new KaqCutoverActivationError(
      'cutover-not-implemented',
      'CUTOVER_ACTIVATION has no executable implementation in #1113; reserved for final multi-consumer cutover',
    );
  }
  return {
    consumer: 'MIGRATION_REVIEW',
    authority: 'CANONICAL_SHADOW',
    productionAuthoritative: false,
    canonicalBindingsVisible: true,
    teachingProjectionVisible: true,
  };
}

/**
 * Negative-path proof: even complete reviewed bindings + available Teaching
 * Projection + self-minted receipt cannot activate Canonical production.
 */
export function tryActivateKaqCanonicalCutover(_input: {
  cutoverReceiptId?: string | null;
  reviewedBindingsReady: boolean;
  teachingProjection: TeachingProjectionAvailability;
  shadowSucceeded: boolean;
}): never {
  throw new KaqCutoverActivationError(
    'cutover-local-activation-forbidden',
    'Local/self-minted cutover receipts cannot activate Canonical KAQ production authority in #1113',
  );
}

export function formalKaqConsumersUseLegacy(
  selector: KaqAuthoritySelector,
): boolean {
  return (
    (
      selector.consumer === 'FORMAL_DIAGNOSIS'
      || selector.consumer === 'FORMAL_RECOMMENDATION'
      || selector.consumer === 'FORMAL_PLANNING'
    )
    && selector.authority === 'LEGACY'
    && selector.productionAuthoritative === true
    && selector.canonicalBindingsVisible === false
  );
}

export function assertFormalSelectorUnchanged(input: {
  requestedConsumer: KaqAuthorityConsumer;
  selected: KaqAuthoritySelector;
  reviewedBindings: readonly KaqCanonicalBinding[];
  teachingProjection: TeachingProjectionAvailability;
}): void {
  if (
    input.requestedConsumer !== 'FORMAL_DIAGNOSIS'
    && input.requestedConsumer !== 'FORMAL_RECOMMENDATION'
    && input.requestedConsumer !== 'FORMAL_PLANNING'
  ) {
    return;
  }
  if (input.selected.authority !== 'LEGACY') {
    throw new Error(
      'KAQ authority invariant violated: formal consumer left LEGACY',
    );
  }
  if (input.selected.canonicalBindingsVisible) {
    throw new Error(
      'KAQ authority invariant violated: formal consumer exposed Canonical bindings',
    );
  }
  if (input.selected.teachingProjectionVisible) {
    throw new Error(
      'KAQ authority invariant violated: formal consumer exposed Teaching Projection',
    );
  }
  const hasAccepted = input.reviewedBindings.some(
    (binding) => binding.reviewState === 'ACCEPTED' && binding.lifecycleState === 'CURRENT',
  );
  if (hasAccepted && input.selected.authority !== 'LEGACY') {
    throw new Error(
      'KAQ authority invariant violated: reviewed bindings activated production Canonical',
    );
  }
  if (input.teachingProjection.available && input.selected.authority !== 'LEGACY') {
    throw new Error(
      'KAQ authority invariant violated: Teaching Projection availability activated production Canonical',
    );
  }
}

/**
 * Shadow success / reviewed bindings / Teaching Projection must not yield
 * CANONICAL production via CUTOVER_ACTIVATION.
 */
export function assertShadowCannotActivateKaqCutover(input: {
  reviewedBindingsReady: boolean;
  teachingProjection: TeachingProjectionAvailability;
  cutoverReceiptId?: string | null;
  shadowSucceeded?: boolean;
}): void {
  try {
    selectKaqAuthority('CUTOVER_ACTIVATION', {
      cutoverReceiptId: input.cutoverReceiptId,
    });
    throw new Error('cutover selector returned without throwing');
  } catch (error) {
    if (error instanceof KaqCutoverActivationError) {
      // expected
    } else {
      throw error;
    }
  }
  try {
    tryActivateKaqCanonicalCutover({
      cutoverReceiptId: input.cutoverReceiptId,
      reviewedBindingsReady: input.reviewedBindingsReady,
      teachingProjection: input.teachingProjection,
      shadowSucceeded: input.shadowSucceeded ?? input.reviewedBindingsReady,
    });
  } catch (error) {
    if (error instanceof KaqCutoverActivationError) return;
    throw error;
  }
}

/**
 * Migration review may observe Canonical readiness; formal consumers must not.
 */
export function migrationReviewSeesCanonicalReadiness(
  selector: KaqAuthoritySelector,
): boolean {
  return (
    selector.consumer === 'MIGRATION_REVIEW'
    && selector.authority === 'CANONICAL_SHADOW'
    && selector.canonicalBindingsVisible === true
    && selector.productionAuthoritative === false
  );
}

/**
 * #1265: Engineering Authority activation alone never switches KAQ selectors.
 * Until the consumer's own Teaching Projection / binding / readiness gates pass,
 * formal consumers remain on Legacy or an explicit pinned prior combination.
 */
export function evaluateKaqConsumerBoundary(input: {
  engineeringAuthority: 'VALIDATED' | 'ACTIVE' | 'REJECTED_INTEGRITY';
  teachingProjection: TeachingProjectionAvailability | {
    available: boolean;
    state?: 'PUBLISHED' | 'REVIEW_REQUIRED' | 'NOT_PROJECTED';
  };
  localBindingsReady: boolean;
  pinnedPrevious?: boolean;
}): {
  consumerState: 'READY' | 'PINNED_PREVIOUS' | 'BLOCKED_LOCAL_DEPENDENCY';
  authority: 'LEGACY' | 'CANONICAL_SHADOW';
  engineeringAuthoritySwitchesKaq: false;
  globalSelectorAdvanced: false;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (input.engineeringAuthority === 'ACTIVE') {
    reasons.push('engineering-authority-active');
  } else if (input.engineeringAuthority === 'REJECTED_INTEGRITY') {
    reasons.push('engineering-authority-rejected-integrity');
  } else {
    reasons.push('engineering-authority-validated-only');
  }

  const teachingAvailable = Boolean(input.teachingProjection.available);
  if (!teachingAvailable) {
    reasons.push('teaching-projection-absent-or-unresolved');
    return {
      consumerState: input.pinnedPrevious ? 'PINNED_PREVIOUS' : 'BLOCKED_LOCAL_DEPENDENCY',
      authority: 'LEGACY',
      engineeringAuthoritySwitchesKaq: false,
      globalSelectorAdvanced: false,
      reasons,
    };
  }
  if (!input.localBindingsReady) {
    reasons.push('local-kaq-bindings-unresolved');
    return {
      consumerState: input.pinnedPrevious ? 'PINNED_PREVIOUS' : 'BLOCKED_LOCAL_DEPENDENCY',
      authority: 'LEGACY',
      engineeringAuthoritySwitchesKaq: false,
      globalSelectorAdvanced: false,
      reasons,
    };
  }
  if (input.engineeringAuthority !== 'ACTIVE') {
    reasons.push('engineering-authority-not-active');
    return {
      consumerState: input.pinnedPrevious ? 'PINNED_PREVIOUS' : 'BLOCKED_LOCAL_DEPENDENCY',
      authority: 'LEGACY',
      engineeringAuthoritySwitchesKaq: false,
      globalSelectorAdvanced: false,
      reasons,
    };
  }

  // Local readiness may be complete, but this boundary change still does not
  // implement production cutover; keep formal authority on LEGACY.
  reasons.push('local-readiness-complete-cutover-not-implemented');
  return {
    consumerState: input.pinnedPrevious ? 'PINNED_PREVIOUS' : 'BLOCKED_LOCAL_DEPENDENCY',
    authority: 'LEGACY',
    engineeringAuthoritySwitchesKaq: false,
    globalSelectorAdvanced: false,
    reasons,
  };
}
