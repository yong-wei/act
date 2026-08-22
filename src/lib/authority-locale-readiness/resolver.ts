import {
  type AdmittedLocale,
  type AuthorityLocaleManifest,
  type LocaleQualificationReceipt,
  type MandatoryLocaleCategory,
} from './contracts';

export interface CompleteLocaleResolution {
  readonly status: 'available' | 'unavailable';
  readonly value: string | null;
  readonly locale: AdmittedLocale;
  readonly recordId: string;
  readonly category: MandatoryLocaleCategory;
}

export function resolveCompleteLocaleValue(
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
  category: MandatoryLocaleCategory,
  recordId: string,
): CompleteLocaleResolution {
  if (receipt.status !== 'ready' || receipt.locale !== locale) {
    return { status: 'unavailable', value: null, locale, recordId, category };
  }
  const matches = manifest.records.filter((row) => (
    row.locale === locale
    && row.category === category
    && row.recordId === recordId
    && row.source === 'release-language-component'
  ));
  if (matches.length !== 1) {
    return { status: 'unavailable', value: null, locale, recordId, category };
  }
  return {
    status: 'available',
    value: matches[0]!.value,
    locale,
    recordId,
    category,
  };
}

export function resolveLanguageNeutralMath(
  manifest: AuthorityLocaleManifest,
  locale: AdmittedLocale,
  recordId: string,
): CompleteLocaleResolution {
  const classified = manifest.languageNeutralRecordIds.includes(recordId);
  const matches = manifest.records.filter((row) => (
    row.recordId === recordId
    && row.languageNeutral === true
    && (row.trustedFormula === true || classified)
    && row.source === 'release-language-component'
  ));
  const forLocale = matches.filter((row) => row.locale === locale);
  if (!classified && matches.length === 0) {
    return { status: 'unavailable', value: null, locale, recordId, category: 'object-names' };
  }
  const value = forLocale[0]?.value ?? matches[0]?.value ?? null;
  if (!value) return { status: 'unavailable', value: null, locale, recordId, category: 'object-names' };
  return {
    status: 'available',
    value,
    locale,
    recordId,
    category: 'object-names',
  };
}

export function rejectCrossLocaleFallback(
  requested: AdmittedLocale,
  candidateLocale: AdmittedLocale | null | undefined,
): boolean {
  return candidateLocale != null && candidateLocale !== requested;
}
