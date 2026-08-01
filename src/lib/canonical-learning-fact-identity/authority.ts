/**
 * LearningFact knowledge-authority selector (#1116).
 *
 * Returns WeakSet-registered capability instances only. Structural clones and
 * self-minted CANONICAL selectors never pass writer asserts.
 */

import {
  assertRegisteredLearningFactSelector,
  mintFormalLegacyLearningFactSelector,
  mintShadowLearningFactSelector,
  type RegisteredLearningFactAuthoritySelector,
} from './capability';
import type {
  LearningFactAuthorityConsumer,
  LearningFactWriteResult,
} from './contracts';

export type LearningFactCutoverVerificationFailure =
  | 'cutover-not-implemented'
  | 'cutover-local-activation-forbidden';

export class LearningFactCutoverActivationError extends Error {
  readonly code: LearningFactCutoverVerificationFailure;

  constructor(code: LearningFactCutoverVerificationFailure, message: string) {
    super(message);
    this.name = 'LearningFactCutoverActivationError';
    this.code = code;
  }
}

export interface SelectLearningFactAuthorityOptions {
  /**
   * Accepted only so callers can prove a self-minted receipt cannot activate
   * Canonical production in #1116. Always ignored for activation.
   */
  cutoverReceiptId?: string | null;
}

/**
 * - FORMAL_PRODUCTION → registered LEGACY selector
 * - SHADOW_VALIDATION → registered CANONICAL_SHADOW selector
 * - CUTOVER_ACTIVATION → always throws; no executable local path (#1117 only)
 */
export function selectLearningFactAuthority(
  consumer: LearningFactAuthorityConsumer = 'FORMAL_PRODUCTION',
  _options: SelectLearningFactAuthorityOptions = {},
): RegisteredLearningFactAuthoritySelector {
  if (consumer === 'FORMAL_PRODUCTION') {
    return mintFormalLegacyLearningFactSelector();
  }
  if (consumer === 'CUTOVER_ACTIVATION') {
    throw new LearningFactCutoverActivationError(
      'cutover-not-implemented',
      'CUTOVER_ACTIVATION has no executable implementation in #1116; reserved for #1117 multi-consumer cutover',
    );
  }
  return mintShadowLearningFactSelector();
}

export function tryActivateCanonicalLearningFactCutover(_input: {
  cutoverReceiptId?: string | null;
  shadowSucceeded: boolean;
  admissionReady: boolean;
  identityComplete: boolean;
}): never {
  throw new LearningFactCutoverActivationError(
    'cutover-local-activation-forbidden',
    'Local/self-minted cutover receipts cannot activate Canonical LearningFact production authority in #1116',
  );
}

export function formalLearningFactProductionUsesLegacy(
  selector: RegisteredLearningFactAuthoritySelector,
): boolean {
  assertRegisteredLearningFactSelector(selector);
  return (
    selector.consumer === 'FORMAL_PRODUCTION'
    && selector.authority === 'LEGACY'
    && selector.productionAuthoritative === true
    && selector.canonicalWriterEnabled === false
  );
}

export function assertFormalLearningFactSelectorUnchanged(input: {
  requestedConsumer: LearningFactAuthorityConsumer;
  selected: RegisteredLearningFactAuthoritySelector;
  shadowSucceeded: boolean;
  admissionReady: boolean;
}): void {
  if (input.requestedConsumer !== 'FORMAL_PRODUCTION') return;
  assertRegisteredLearningFactSelector(input.selected);
  if (input.selected.authority !== 'LEGACY') {
    throw new Error(
      'LearningFact authority invariant violated: formal production left LEGACY',
    );
  }
  if (input.selected.canonicalWriterEnabled) {
    throw new Error(
      'LearningFact authority invariant violated: formal production enabled Canonical writer',
    );
  }
  if (input.shadowSucceeded && input.selected.authority !== 'LEGACY') {
    throw new Error(
      'LearningFact authority invariant violated: shadow success activated production Canonical',
    );
  }
  if (input.admissionReady && input.selected.authority !== 'LEGACY') {
    throw new Error(
      'LearningFact authority invariant violated: admission readiness activated production Canonical',
    );
  }
}

export function assertShadowCannotActivateLearningFactCutover(input: {
  shadowSucceeded: boolean;
  cutoverReceiptId?: string | null;
  admissionReady?: boolean;
  identityComplete?: boolean;
}): void {
  const production = selectLearningFactAuthority('FORMAL_PRODUCTION', {
    cutoverReceiptId: input.cutoverReceiptId,
  });
  if (production.authority !== 'LEGACY' || production.canonicalWriterEnabled) {
    throw new Error(
      'LearningFact authority invariant violated: production selector not LEGACY under readiness',
    );
  }

  const shadow = selectLearningFactAuthority('SHADOW_VALIDATION', {
    cutoverReceiptId: input.cutoverReceiptId,
  });
  if (shadow.productionAuthoritative || shadow.canonicalWriterEnabled) {
    throw new Error(
      'LearningFact authority invariant violated: shadow became production-authoritative',
    );
  }

  try {
    selectLearningFactAuthority('CUTOVER_ACTIVATION', {
      cutoverReceiptId: input.cutoverReceiptId,
    });
    throw new Error('cutover selector returned without throwing');
  } catch (error) {
    if (!(error instanceof LearningFactCutoverActivationError)) throw error;
  }

  try {
    tryActivateCanonicalLearningFactCutover({
      cutoverReceiptId: input.cutoverReceiptId,
      shadowSucceeded: input.shadowSucceeded,
      admissionReady: input.admissionReady ?? false,
      identityComplete: input.identityComplete ?? false,
    });
  } catch (error) {
    if (error instanceof LearningFactCutoverActivationError) return;
    throw error;
  }
}

export function assertShadowWriteResultHasZeroSink(
  result: LearningFactWriteResult,
): void {
  if (result.authority !== 'CANONICAL_SHADOW') {
    throw new Error(
      `LearningFact shadow invariant violated: expected CANONICAL_SHADOW, got ${result.authority}`,
    );
  }
  if (result.sinkInvoked || result.written > 0) {
    throw new Error(
      'LearningFact shadow invariant violated: shadow validation invoked LearningFact sink',
    );
  }
  if (!result.shadowValidated) {
    throw new Error(
      'LearningFact shadow invariant violated: shadowValidated flag not set',
    );
  }
}
