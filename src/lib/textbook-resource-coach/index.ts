export {
  TEXTBOOK_COACH_SELECTION_HINT_MAX_LENGTH,
  boundSelectionHint,
  canonicalizeTextbookCoachIdentity,
  declaredTextbookCoachKind,
  hashTextbookMarkdown,
  identitiesEqual,
  identityHintRecord,
  isUnsupportedTextbookCoachKind,
  type TextbookCoachUnavailableReason,
} from './identity';
export {
  loadTextbookCoachContext,
  type LoadTextbookCoachContextInput,
  type TextbookCoachFailure,
  type TextbookCoachLoadResult,
} from './loader';
export {
  STRUCTURED_TEXTBOOK_UNIT_KIND,
  type TextbookCoachContext,
  type StructuredTextbookUnitIdentity,
} from './types';
export { extractVersionBoundHandle } from './href';
export {
  issueTextbookVersionBoundHandle,
  issueTextbookVersionBoundHref,
  verifyTextbookVersionBoundHandle,
} from './navigation-handle';
export {
  hydrateTextbookCoachCitation,
  resolveTextbookCitationClick,
  sourcePackCitationFromTextbook,
  type HydratedTextbookCoachCitation,
  type TextbookCitationLimitation,
} from './citations';
export {
  PINNED_TEXTBOOK_IDENTITY_METADATA_KEY,
  findLatestPinnedTextbookIdentity,
  pinTextbookCoachIdentity,
} from './session';
