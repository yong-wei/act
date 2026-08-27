import {
  HISTORICAL_ENGLISH_UNAVAILABLE_ZH,
  type AdmittedLocale,
  type PublicLocaleCapability,
} from './contracts';
import { graphInterfaceText } from './graph-interface-catalog';

export const LANGUAGE_SWITCH_PRESERVED_FIELDS = [
  'activeDomainId',
  'selectedCanonicalId',
  'enabledFamilies',
  'loadedTopologyKeys',
  'positionsByCanonicalId',
  'pan',
  'zoom',
  'inspectorSection',
  'inspectorScroll',
  'resourceBindings',
] as const;

export interface GraphLanguageState {
  readonly selectedLocale: AdmittedLocale;
  readonly bilingualReady: boolean;
  readonly englishAvailable: boolean;
  readonly englishUnavailableReason: string | null;
  readonly wroteLearnerOrServerState: false;
}

export function createGraphLanguageState(
  capability: PublicLocaleCapability,
): GraphLanguageState {
  return {
    selectedLocale: 'zh-CN',
    bilingualReady: capability.bilingualReady,
    englishAvailable: capability.bilingualReady && capability.availableLocales.includes('en'),
    englishUnavailableReason: capability.bilingualReady
      ? null
      : (capability.englishUnavailableReason ?? HISTORICAL_ENGLISH_UNAVAILABLE_ZH),
    wroteLearnerOrServerState: false,
  };
}

export function selectGraphLanguage(
  state: GraphLanguageState,
  locale: AdmittedLocale,
): GraphLanguageState {
  if (locale === 'zh-CN') {
    return { ...state, selectedLocale: 'zh-CN', wroteLearnerOrServerState: false };
  }
  if (locale === 'en' && state.englishAvailable) {
    return { ...state, selectedLocale: 'en', wroteLearnerOrServerState: false };
  }
  return {
    ...state,
    selectedLocale: 'zh-CN',
    englishUnavailableReason: state.englishUnavailableReason
      ?? graphInterfaceText('language.englishUnavailable', 'zh-CN'),
    wroteLearnerOrServerState: false,
  };
}

export type OptionalBlockProjection =
  | { readonly visibility: 'render' }
  | { readonly visibility: 'omit' }
  | { readonly visibility: 'unavailable'; readonly message: string };

export function projectOptionalContentForLocale(input: {
  availableLocales: readonly AdmittedLocale[];
  bodyLocale?: AdmittedLocale | null;
  selectedLocale: AdmittedLocale;
}): OptionalBlockProjection {
  if (input.bodyLocale && input.bodyLocale !== input.selectedLocale) {
    return {
      visibility: 'unavailable',
      message: graphInterfaceText('inspector.optionalUnavailable', input.selectedLocale),
    };
  }
  if (!input.availableLocales.includes(input.selectedLocale)) {
    return {
      visibility: 'omit',
    };
  }
  return { visibility: 'render' };
}

export function historicalLocaleCapability(): PublicLocaleCapability {
  return {
    availableLocales: ['zh-CN'],
    bilingualReady: false,
    englishUnavailableReason: HISTORICAL_ENGLISH_UNAVAILABLE_ZH,
    mode: 'historical',
    languageComponentDigest: null,
  };
}
