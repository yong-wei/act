export const GOVERNED_MATH_LOCALES = ['zh-CN', 'en'] as const;
export type GovernedMathLocale = (typeof GOVERNED_MATH_LOCALES)[number];

export const GOVERNED_KATEX_MACRO_PROFILE_ID = 'ctmacro:katex-default-v1' as const;
export const GOVERNED_KATEX_MACRO_PROFILE_HASH =
  '9da48a920152b4ea1ca7eacd8b5d8f94aeb54ca3218b47ec08923611a3942b74' as const;
export const GOVERNED_KATEX_ENGINE_CONTRACT = 'katex-strict-v1' as const;

export const GOVERNED_RICH_TEXT_TITLE_FIELD = 'statement_text' as const;
export const GOVERNED_RICH_TEXT_DESCRIPTION_FIELDS = ['meaning', 'description'] as const;

export type GovernedMathDisplayMode = 'inline' | 'block';

export type GovernedRichTextSpan =
  | { kind: 'text'; text: string }
  | GovernedMathSpan;

export interface GovernedMathSpan {
  kind: 'math';
  display: GovernedMathDisplayMode;
  latex: string;
  macroProfileId: string;
  macroProfileHash: string;
  accessibleLabel: string;
  copyLatex: string;
  renderKey: string;
}

export interface GovernedRichTextBlock {
  kind: 'paragraph' | 'math-block';
  spans: readonly GovernedRichTextSpan[];
}

export type GovernedRichTextProjection =
  | {
    state: 'available';
    locale: GovernedMathLocale;
    contentHash: string;
    renderKey: string;
    accessibleName: string;
    copyText: string;
    searchText: string;
    blocks: readonly GovernedRichTextBlock[];
  }
  | {
    state: 'registered-unavailable';
    locale: GovernedMathLocale;
    reasonCode: string;
    fallbackText: string;
    accessibleName: string;
  }
  | {
    state: 'missing';
  };

export function titleIsProductHidden(projection: GovernedRichTextProjection): boolean {
  return projection.state === 'registered-unavailable';
}

export type GovernedFormulaProjection =
  | {
    state: 'available';
    display: GovernedMathDisplayMode;
    latex: string;
    macroProfileId: string;
    macroProfileHash: string;
    accessibleLabel: string;
    copyLatex: string;
    renderKey: string;
  }
  | {
    state: 'registered-unavailable';
    reasonCode: string;
    fallbackText: string;
    accessibleName: string;
  }
  | {
    state: 'missing';
  };

export type GovernedMathDispositionStatus = 'RENDERABLE' | 'REGISTERED_UNAVAILABLE';

export interface GovernedMathUnavailableRecord {
  readonly identityKey: string;
  readonly releaseId: string;
  readonly releaseHash: string;
  readonly targetId: string;
  readonly fieldPath: string;
  readonly locale: GovernedMathLocale;
  readonly documentId: string;
  readonly mathAssetId: string;
  readonly contentHash: string;
  readonly reasonCode: string;
  readonly fallbackText: string;
  readonly surfaces: readonly string[];
  readonly reviewedBy: string;
  readonly reviewedAt: string;
  readonly upstreamStatus: 'open' | 'fixed';
}

export interface GovernedMathDispositionLedger {
  readonly contract: 'act-governed-math-disposition/v1';
  readonly releaseId: string;
  readonly releaseHash: string;
  readonly denominator: {
    readonly documentCount: number;
    readonly mathSpanCount: number;
    readonly fragmentCount: number;
    readonly formulaCount: number;
  };
  readonly renderableDigest: string;
  readonly registeredUnavailable: readonly GovernedMathUnavailableRecord[];
}

export interface GovernedMathReviewRecord {
  readonly contract: 'act-governed-math-review/v1';
  readonly releaseId: string;
  readonly releaseHash: string;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
  readonly unavailableCount: number;
  readonly decision: 'approved';
}

export interface GovernedMathUpstreamRepairItem {
  readonly identityKey: string;
  readonly releaseId: string;
  readonly releaseHash: string;
  readonly documentId: string;
  readonly fieldPath: string;
  readonly locale: GovernedMathLocale;
  readonly mathAssetId: string;
  readonly contentHash: string;
  readonly reasonCode: string;
  readonly trustedLatex?: string;
}

export interface GovernedMathUpstreamRepairPackage {
  readonly contract: 'act-governed-math-upstream-repair/v1';
  readonly releaseId: string;
  readonly releaseHash: string;
  readonly items: readonly GovernedMathUpstreamRepairItem[];
}
