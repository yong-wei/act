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
  /**
   * 显式覆盖生产权威拨盘（测试用）。缺省读
   * KONLING_RAG_PRODUCTION_AUTHORITY；未配置时为已授权的 composed 切换。
   */
  productionAuthority?: RagProductionAuthorityDial | null;
}

/** 生产答案检索权威拨盘（#2047 cutover 治理）。 */
export type RagProductionAuthorityDial = 'legacy' | 'canonical-composed';

export const RAG_PRODUCTION_AUTHORITY_ENV = 'KONLING_RAG_PRODUCTION_AUTHORITY';

/**
 * 读取生产权威拨盘：`legacy` 回滚，`canonical-composed` 为 #2047 授权切换
 * 后的缺省。未配置视为 composed；非法值 fail-safe 回 LEGACY。
 */
export function readRagProductionAuthorityDial(
  env: Record<string, string | undefined> = process.env,
): RagProductionAuthorityDial {
  const raw = (env[RAG_PRODUCTION_AUTHORITY_ENV] ?? '').trim();
  if (raw === '' || raw === 'canonical-composed') return 'canonical-composed';
  if (raw === 'legacy') return 'legacy';
  console.warn(
    `Invalid ${RAG_PRODUCTION_AUTHORITY_ENV}=${raw}; falling back to legacy production RAG authority`,
  );
  return 'legacy';
}

/**
 * RAG authority selector.
 *
 * - PRODUCTION_ANSWER → composed（#2047 授权切换，canonical-composed 通道）
 *   或 LEGACY（拨盘回滚），由 KONLING_RAG_PRODUCTION_AUTHORITY 决定
 * - SHADOW_COMPARISON / OFFLINE_EVAL → CANONICAL_SHADOW (non-production)
 * - CUTOVER_ACTIVATION → always throws; no executable local path yields
 *   productionAuthoritative CANONICAL in #1112 (reserved for #1117).
 */
export function selectRagAuthority(
  consumer: RagAuthorityConsumer = 'PRODUCTION_ANSWER',
  options: SelectRagAuthorityOptions = {},
): RagAuthoritySelector {
  if (consumer === 'PRODUCTION_ANSWER') {
    const dial = options.productionAuthority ?? readRagProductionAuthorityDial();
    if (dial === 'canonical-composed') {
      return {
        consumer,
        authority: 'CANONICAL',
        productionAuthoritative: true,
        canonicalExpansionVisible: true,
        allowsLegacyFallback: true,
        productionChannel: 'canonical-composed',
      };
    }
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

/**
 * Production selector invariants (#2047)：选择器必须与配置拨盘一致；
 * legacy 拨盘不得暴露 Canonical expansion；shadow 成功不得越过拨盘激活
 * composed。拨盘本身（环境/显式参数）是唯一切换真源。
 */
export function assertProductionSelectorUnchanged(input: {
  requestedConsumer: RagAuthorityConsumer;
  selected: RagAuthoritySelector;
  shadowSucceeded: boolean;
  productionAuthority?: RagProductionAuthorityDial | null;
}): void {
  if (input.requestedConsumer !== 'PRODUCTION_ANSWER') return;
  const dial = input.productionAuthority ?? readRagProductionAuthorityDial();
  const expectedAuthority = dial === 'canonical-composed' ? 'CANONICAL' : 'LEGACY';
  if (input.selected.authority !== expectedAuthority) {
    throw new Error(
      `RAG authority invariant violated: production answer selector does not match the configured dial (${dial} expected ${expectedAuthority})`,
    );
  }
  if (dial === 'legacy' && input.selected.canonicalExpansionVisible) {
    throw new Error(
      'RAG authority invariant violated: production answer exposed Canonical expansion under the legacy dial',
    );
  }
  if (input.shadowSucceeded && dial === 'legacy' && input.selected.authority !== 'LEGACY') {
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
