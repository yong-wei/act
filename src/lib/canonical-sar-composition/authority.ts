/**
 * SAR authority selector (#1114).
 *
 * Production retrieval remains LEGACY until the final multi-consumer downtime
 * cutover (#1117). Canonical composition readiness, shadow evidence, and
 * pipeline readiness MUST NOT locally replace production SAR.
 */

import type {
  SarAuthorityConsumer,
  SarAuthoritySelector,
  SarCandidateProjection,
  SarCutoverAuthorityReceipt,
} from './contracts';

export type SarCutoverVerificationFailure =
  | 'cutover-not-implemented'
  | 'cutover-local-activation-forbidden';

export class SarCutoverActivationError extends Error {
  readonly code: SarCutoverVerificationFailure;

  constructor(code: SarCutoverVerificationFailure, message: string) {
    super(message);
    this.name = 'SarCutoverActivationError';
    this.code = code;
  }
}

export interface SelectSarAuthorityOptions {
  /**
   * Accepted only so callers can prove a self-minted receipt cannot activate
   * Canonical production in #1114. Always ignored for activation.
   */
  cutoverReceipt?: SarCutoverAuthorityReceipt | null;
}

/**
 * - PRODUCTION_RETRIEVAL → LEGACY
 * - SHADOW_COMPARISON / OFFLINE_EVAL / PIPELINE_READINESS → CANONICAL_SHADOW
 * - CUTOVER_ACTIVATION → always throws; no executable local path (#1117 only)
 */
export function selectSarAuthority(
  consumer: SarAuthorityConsumer = 'PRODUCTION_RETRIEVAL',
  _options: SelectSarAuthorityOptions = {},
): SarAuthoritySelector {
  if (consumer === 'PRODUCTION_RETRIEVAL') {
    return {
      consumer,
      authority: 'LEGACY',
      productionAuthoritative: true,
      canonicalCompositionVisible: false,
      allowsLegacyFallback: true,
    };
  }
  if (consumer === 'CUTOVER_ACTIVATION') {
    throw new SarCutoverActivationError(
      'cutover-not-implemented',
      'CUTOVER_ACTIVATION has no executable implementation in #1114; reserved for #1117 control-plane cutover',
    );
  }
  return {
    consumer,
    authority: 'CANONICAL_SHADOW',
    productionAuthoritative: false,
    canonicalCompositionVisible: true,
    allowsLegacyFallback: false,
  };
}

/**
 * Negative-path proof: even a well-shaped self-minted receipt + complete
 * Canonical projection cannot activate production Canonical SAR.
 */
export function tryActivateCanonicalSarCutover(_input: {
  cutoverReceipt: SarCutoverAuthorityReceipt | null | undefined;
  projectionReady: boolean;
  pipelineReady: boolean;
  shadowSucceeded: boolean;
}): never {
  throw new SarCutoverActivationError(
    'cutover-local-activation-forbidden',
    'Local/self-minted cutover receipts cannot activate Canonical SAR production authority in #1114',
  );
}

export function productionRetrievalUsesLegacy(
  selector: SarAuthoritySelector,
): boolean {
  return (
    selector.consumer === 'PRODUCTION_RETRIEVAL'
    && selector.authority === 'LEGACY'
    && selector.productionAuthoritative === true
    && selector.canonicalCompositionVisible === false
  );
}

export function canonicalCompositionEnabled(
  selector: SarAuthoritySelector,
): boolean {
  return selector.canonicalCompositionVisible;
}

export function assertProductionSelectorUnchanged(input: {
  requestedConsumer: SarAuthorityConsumer;
  selected: SarAuthoritySelector;
  shadowSucceeded: boolean;
  projection: SarCandidateProjection | null;
}): void {
  if (input.requestedConsumer !== 'PRODUCTION_RETRIEVAL') return;
  if (input.selected.authority !== 'LEGACY') {
    throw new Error(
      'SAR authority invariant violated: production retrieval left LEGACY',
    );
  }
  if (input.selected.canonicalCompositionVisible) {
    throw new Error(
      'SAR authority invariant violated: production retrieval exposed Canonical composition',
    );
  }
  if (input.shadowSucceeded && input.selected.authority !== 'LEGACY') {
    throw new Error(
      'SAR authority invariant violated: shadow success activated production Canonical',
    );
  }
  if (input.projection && input.selected.authority !== 'LEGACY') {
    throw new Error(
      'SAR authority invariant violated: projection readiness activated production Canonical',
    );
  }
}

/**
 * Pipeline readiness / shadow success must not yield CANONICAL production.
 */
export function assertPipelineReadinessCannotReplaceProduction(input: {
  pipelineReady: boolean;
  projectionReady: boolean;
  shadowSucceeded: boolean;
  cutoverReceipt?: SarCutoverAuthorityReceipt | null;
}): void {
  // Production selector must stay LEGACY regardless of readiness signals.
  const production = selectSarAuthority('PRODUCTION_RETRIEVAL', {
    cutoverReceipt: input.cutoverReceipt,
  });
  if (production.authority !== 'LEGACY' || production.canonicalCompositionVisible) {
    throw new Error(
      'SAR authority invariant violated: production selector not LEGACY under readiness',
    );
  }

  // PIPELINE_READINESS is shadow-only.
  const readiness = selectSarAuthority('PIPELINE_READINESS', {
    cutoverReceipt: input.cutoverReceipt,
  });
  if (readiness.productionAuthoritative || readiness.authority !== 'CANONICAL_SHADOW') {
    throw new Error(
      'SAR authority invariant violated: pipeline readiness became production-authoritative',
    );
  }

  if (
    !input.pipelineReady
    && !input.projectionReady
    && !input.shadowSucceeded
    && !input.cutoverReceipt
  ) {
    return;
  }

  try {
    selectSarAuthority('CUTOVER_ACTIVATION', {
      cutoverReceipt: input.cutoverReceipt,
    });
    throw new Error('cutover selector returned without throwing');
  } catch (error) {
    if (!(error instanceof SarCutoverActivationError)) throw error;
  }

  try {
    tryActivateCanonicalSarCutover({
      cutoverReceipt: input.cutoverReceipt,
      projectionReady: input.projectionReady,
      pipelineReady: input.pipelineReady,
      shadowSucceeded: input.shadowSucceeded,
    });
  } catch (error) {
    if (error instanceof SarCutoverActivationError) return;
    throw error;
  }
}

export function assertShadowCannotActivateSarCutover(input: {
  shadowSucceeded: boolean;
  cutoverReceipt: SarCutoverAuthorityReceipt | null | undefined;
  pipelineReady?: boolean;
  projectionReady?: boolean;
}): void {
  assertPipelineReadinessCannotReplaceProduction({
    pipelineReady: input.pipelineReady ?? false,
    projectionReady: input.projectionReady ?? false,
    shadowSucceeded: input.shadowSucceeded,
    cutoverReceipt: input.cutoverReceipt,
  });
}

export function resolveSarAuthorityMode(
  selector: SarAuthoritySelector,
): SarAuthoritySelector['authority'] {
  return selector.authority;
}
