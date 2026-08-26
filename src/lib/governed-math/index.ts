export {
  createGovernedKatexOptions,
  createGovernedRehypeKatexOptions,
  GOVERNED_MACRO_PROFILES,
} from './katex-config';
export {
  governedKatexCallCount,
  renderGovernedKatexHtml,
  resetGovernedKatexCache,
  tryRenderGovernedKatex,
} from './render-cache';
export {
  governedSearchHaystack,
  matchesGovernedSearch,
  stripLatexCommandNoise,
} from './search-text';
export type {
  GovernedFormulaProjection,
  GovernedMathLocale,
  GovernedRichTextProjection,
} from './types';
export {
  GOVERNED_KATEX_MACRO_PROFILE_HASH,
  GOVERNED_KATEX_MACRO_PROFILE_ID,
  GOVERNED_RICH_TEXT_TITLE_FIELD,
  titleIsProductHidden,
} from './types';
