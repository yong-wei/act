import type {
  RagAuthorityConsumer,
  RagAuthorityMode,
  RagAuthoritySelector,
  RagCutoverAuthorityReceipt,
} from './contracts';

export type CutoverVerificationFailure =
  | 'cutover-not-implemented'
  | 'cutover-local-activation-forbidden';

export class RagCutoverActivationError extends Error {
  readonly code: CutoverVerificationFailure;

  constructor(code: CutoverVerificationFailure, message: string) {
    super(message);
    this.name = 'RagCutoverActivationError';
    this.code = code;
  }
}

export interface SelectRagAuthorityOptions {
  /**
   * Accepted only so callers can prove that a self-minted receipt cannot
   * activate Canonical production in #1112. Always ignored for activation.
   */
  cutoverReceipt?: RagCutoverAuthorityReceipt | null;
}

/**
 * RAG authority selector.
 *
 * - PRODUCTION_ANSWER → LEGACY
 * - SHADOW_COMPARISON / OFFLINE_EVAL → CANONICAL_SHADOW (non-production)
 * - CUTOVER_ACTIVATION → always throws; no executable local path yields
 *   productionAuthoritative CANONICAL in #1112 (reserved for #1117).
 */
export function selectRagAuthority(
  consumer: RagAuthorityConsumer = 'PRODUCTION_ANSWER',
  _options: SelectRagAuthorityOptions = {},
): RagAuthoritySelector {
  if (consumer === 'PRODUCTION_ANSWER') {
    return {
      consumer,
      authority: 'LEGACY',
      productionAuthoritative: true,
      canonicalExpansionVisible: false,
      allowsLegacyFallback: true,
    };
  }
  if (consumer === 'CUTOVER_ACTIVATION') {
    throw new RagCutoverActivationError(
      'cutover-not-implemented',
      'CUTOVER_ACTIVATION has no executable implementation in #1112; reserved for #1117 control-plane cutover',
    );
  }
  return {
    consumer,
    authority: 'CANONICAL_SHADOW',
    productionAuthoritative: false,
    canonicalExpansionVisible: true,
    allowsLegacyFallback: false,
  };
}

/**
 * Negative-path proof: even a well-shaped self-minted receipt cannot activate
 * Canonical production. Always fails closed.
 */
export function tryActivateCanonicalCutover(_input: {
  cutoverReceipt: RagCutoverAuthorityReceipt | null | undefined;
  shadowSucceeded: boolean;
}): never {
  throw new RagCutoverActivationError(
    'cutover-local-activation-forbidden',
    'Local/self-minted cutover receipts cannot activate Canonical production authority in #1112',
  );
}

export function canonicalExpansionEnabled(selector: RagAuthoritySelector): boolean {
  return selector.canonicalExpansionVisible;
}

export function productionAnswerUsesLegacy(selector: RagAuthoritySelector): boolean {
  return selector.consumer === 'PRODUCTION_ANSWER' && selector.authority === 'LEGACY';
}

export function assertProductionSelectorUnchanged(input: {
  requestedConsumer: RagAuthorityConsumer;
  selected: RagAuthoritySelector;
  shadowSucceeded: boolean;
}): void {
  if (input.requestedConsumer !== 'PRODUCTION_ANSWER') return;
  if (input.selected.authority !== 'LEGACY') {
    throw new Error(
      'RAG authority invariant violated: production answer selector left LEGACY',
    );
  }
  if (input.selected.canonicalExpansionVisible) {
    throw new Error(
      'RAG authority invariant violated: production answer exposed Canonical expansion',
    );
  }
  if (input.shadowSucceeded && input.selected.authority !== 'LEGACY') {
    throw new Error(
      'RAG authority invariant violated: shadow success activated production Canonical',
    );
  }
}

/**
 * Shadow success + any receipt must not yield CANONICAL production.
 */
export function assertShadowCannotActivateCutover(input: {
  shadowSucceeded: boolean;
  cutoverReceipt: RagCutoverAuthorityReceipt | null | undefined;
}): void {
  if (!input.shadowSucceeded && !input.cutoverReceipt) return;
  try {
    selectRagAuthority('CUTOVER_ACTIVATION', {
      cutoverReceipt: input.cutoverReceipt,
    });
    throw new Error('cutover selector returned without throwing');
  } catch (error) {
    if (error instanceof RagCutoverActivationError) return;
    throw error;
  }
  try {
    tryActivateCanonicalCutover({
      cutoverReceipt: input.cutoverReceipt,
      shadowSucceeded: input.shadowSucceeded,
    });
  } catch (error) {
    if (error instanceof RagCutoverActivationError) return;
    throw error;
  }
}

export function resolveRagAuthorityMode(selector: RagAuthoritySelector): RagAuthorityMode {
  return selector.authority;
}

export function legacyFallbackPermitted(selector: RagAuthoritySelector): boolean {
  return selector.allowsLegacyFallback;
}
