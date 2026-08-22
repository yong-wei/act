/**
 * Release-bound complete-locale contracts (#1494).
 *
 * Qualification never mutates selectors or active releases. Overlay, pin,
 * display_name, and generated translation are excluded from the numerator.
 */

export const LOCALE_MANIFEST_CONTRACT = 'act-authority-locale-manifest/v1' as const;
export const LOCALE_QUALIFICATION_RECEIPT_CONTRACT =
  'act-authority-locale-qualification-receipt/v1' as const;
export const GRAPH_INTERFACE_CATALOG_CONTRACT = 'act-graph-interface-catalog/v1' as const;

export const ADMITTED_LOCALES = ['zh-CN', 'en'] as const;
export type AdmittedLocale = (typeof ADMITTED_LOCALES)[number];

export const MANDATORY_LOCALE_CATEGORIES = [
  'domains',
  'object-names',
  'object-explanations',
  'types',
  'relations',
  'directions',
  'approved-aliases',
  'readable-sources',
] as const;
export type MandatoryLocaleCategory = (typeof MANDATORY_LOCALE_CATEGORIES)[number];

export const LOCALE_RECORD_SOURCE = 'release-language-component' as const;
export type LocaleRecordSource = typeof LOCALE_RECORD_SOURCE;

export const EXCLUDED_LOCALE_SOURCES = [
  'act-overlay',
  'record-pin',
  'display-name',
  'generated-translation',
  'global-registry',
  'other-release',
] as const;
export type ExcludedLocaleSource = (typeof EXCLUDED_LOCALE_SOURCES)[number];

export const PUBLISHED_LATEST_COMPOSITE_NAME = 'control-theory-engineering-v0.22' as const;

export type LocaleQualificationFailureCode =
  | 'unknown-schema'
  | 'missing-manifest'
  | 'latest-forbidden'
  | 'cross-release'
  | 'changed-denominator'
  | 'changed-content'
  | 'missing'
  | 'duplicate'
  | 'unsafe'
  | 'excluded-source'
  | 'unknown-locale'
  | 'unclassified-language-neutral'
  | 'interface-catalog';

export interface LocaleManifestIdentity {
  readonly compositeReleaseName: string;
  readonly authorityReleaseId: string;
  readonly authoritySnapshotId: string;
  readonly authoritySnapshotHash: string;
  readonly languageComponentId: string;
  readonly languageComponentDigest: string;
  readonly schemaId: typeof LOCALE_MANIFEST_CONTRACT;
}

export interface LocaleCategoryDenominator {
  readonly category: MandatoryLocaleCategory;
  readonly recordIds: readonly string[];
  readonly digest: string;
}

export interface LocalePresentationRecord {
  readonly recordId: string;
  readonly category: MandatoryLocaleCategory;
  readonly locale: AdmittedLocale;
  readonly value: string;
  readonly source: LocaleRecordSource | ExcludedLocaleSource;
  readonly languageNeutral?: boolean;
  readonly trustedFormula?: boolean;
}

export interface OptionalMediaLanguageDeclaration {
  readonly recordId: string;
  readonly availableLocales: readonly AdmittedLocale[];
}

export interface AuthorityLocaleManifest {
  readonly contract: typeof LOCALE_MANIFEST_CONTRACT;
  readonly identity: LocaleManifestIdentity;
  readonly locales: readonly AdmittedLocale[];
  readonly denominators: readonly LocaleCategoryDenominator[];
  readonly denominatorDigest: string;
  readonly records: readonly LocalePresentationRecord[];
  readonly contentDigest: string;
  readonly languageNeutralRecordIds: readonly string[];
  readonly optionalMedia?: readonly OptionalMediaLanguageDeclaration[];
}

export interface LocaleCategoryCoverage {
  readonly category: MandatoryLocaleCategory;
  readonly required: number;
  readonly present: number;
  readonly missingRecordIds: readonly string[];
}

export interface LocaleQualificationFailure {
  readonly code: LocaleQualificationFailureCode;
  readonly message: string;
  readonly recordId?: string;
  readonly category?: MandatoryLocaleCategory;
}

export interface LocaleQualificationReceipt {
  readonly contract: typeof LOCALE_QUALIFICATION_RECEIPT_CONTRACT;
  readonly identity: LocaleManifestIdentity;
  readonly locale: AdmittedLocale;
  readonly status: 'ready' | 'failed';
  readonly chineseReady: boolean;
  readonly bilingualReady: boolean;
  readonly failures: readonly LocaleQualificationFailure[];
  readonly recomputedDenominatorDigest: string;
  readonly recomputedContentDigest: string;
  readonly categoryCoverage: readonly LocaleCategoryCoverage[];
  readonly usedExcludedSources: boolean;
}

export interface AdmittedEnvelopeIdentity {
  readonly name: string;
  readonly authorityReleaseId: string;
  readonly authoritySnapshotId: string;
  readonly authoritySnapshotHash: string;
}

export interface ReleaseLocaleQualification {
  readonly envelope: AdmittedEnvelopeIdentity;
  readonly zhCN: LocaleQualificationReceipt | null;
  readonly en: LocaleQualificationReceipt | null;
  readonly chineseReady: boolean;
  readonly bilingualReady: boolean;
  readonly interfaceCatalogReady: boolean;
  readonly mutatedSelector: false;
}

export interface PublicLocaleCapability {
  readonly availableLocales: readonly AdmittedLocale[];
  readonly bilingualReady: boolean;
  readonly englishUnavailableReason: string | null;
  readonly mode: 'historical' | 'complete-locale';
  readonly languageComponentDigest: string | null;
}

export const HISTORICAL_ENGLISH_UNAVAILABLE_ZH =
  '当前发布尚未通过完整英文资格，暂不能切换到 English。' as const;

export const FUTURE_TRANSLATION_RELEASE_REQUIRES_EXACT_OPENSPEC =
  'Adopting and activating a future graph-project translation release requires a separate exact-version OpenSpec after its immutable locale manifest and coverage evidence exist.' as const;
