import { isSafeAuthorityLabel } from '@/lib/authority-domain-shards/labels';

import {
  ADMITTED_LOCALES,
  EXCLUDED_LOCALE_SOURCES,
  LOCALE_MANIFEST_CONTRACT,
  LOCALE_QUALIFICATION_RECEIPT_CONTRACT,
  LOCALE_RECORD_SOURCE,
  MANDATORY_LOCALE_CATEGORIES,
  type AdmittedEnvelopeIdentity,
  type AdmittedLocale,
  type AuthorityLocaleManifest,
  type LocaleCategoryCoverage,
  type LocaleCategoryDenominator,
  type LocalePresentationRecord,
  type LocaleQualificationFailure,
  type LocaleQualificationReceipt,
  type MandatoryLocaleCategory,
  type ReleaseLocaleQualification,
} from './contracts';
import { localeDigest } from './digest';
import { graphInterfaceCatalogReady } from './graph-interface-catalog';

export class LocaleQualificationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'LocaleQualificationError';
    this.code = code;
  }
}

export function isAdmittedLocale(value: string): value is AdmittedLocale {
  return (ADMITTED_LOCALES as readonly string[]).includes(value);
}

export function denominatorDigestFor(denominators: readonly LocaleCategoryDenominator[]): string {
  return localeDigest(MANDATORY_LOCALE_CATEGORIES.map((category) => {
    const row = denominators.find((item) => item.category === category);
    return {
      category,
      recordIds: [...(row?.recordIds ?? [])].sort(),
      digest: row ? localeDigest([...(row.recordIds)].sort()) : localeDigest([]),
    };
  }));
}

export function contentDigestFor(
  records: readonly Pick<LocalePresentationRecord, 'recordId' | 'category' | 'locale' | 'value' | 'source'>[],
): string {
  const rows = [...records]
    .map((row) => ({
      recordId: row.recordId,
      category: row.category,
      locale: row.locale,
      value: row.value,
      source: row.source,
    }))
    .sort((left, right) => (
      left.locale.localeCompare(right.locale)
      || left.category.localeCompare(right.category)
      || left.recordId.localeCompare(right.recordId)
    ));
  return localeDigest(rows);
}

function fail(
  identity: AuthorityLocaleManifest['identity'],
  locale: AdmittedLocale,
  failures: readonly LocaleQualificationFailure[],
  extras: Partial<LocaleQualificationReceipt> = {},
): LocaleQualificationReceipt {
  return Object.freeze({
    contract: LOCALE_QUALIFICATION_RECEIPT_CONTRACT,
    identity,
    locale,
    status: 'failed',
    chineseReady: false,
    bilingualReady: false,
    failures,
    recomputedDenominatorDigest: extras.recomputedDenominatorDigest ?? '',
    recomputedContentDigest: extras.recomputedContentDigest ?? '',
    categoryCoverage: extras.categoryCoverage ?? [],
    usedExcludedSources: extras.usedExcludedSources ?? false,
  });
}

function identityMatches(
  manifest: AuthorityLocaleManifest,
  envelope: AdmittedEnvelopeIdentity,
): boolean {
  return (
    manifest.identity.compositeReleaseName === envelope.name
    && manifest.identity.authorityReleaseId === envelope.authorityReleaseId
    && manifest.identity.authoritySnapshotId === envelope.authoritySnapshotId
    && manifest.identity.authoritySnapshotHash === envelope.authoritySnapshotHash
  );
}

function coverageFor(
  denominators: readonly LocaleCategoryDenominator[],
  present: ReadonlyMap<string, LocalePresentationRecord>,
): LocaleCategoryCoverage[] {
  return MANDATORY_LOCALE_CATEGORIES.map((category) => {
    const required = denominators.find((row) => row.category === category)?.recordIds ?? [];
    const missingRecordIds = required.filter((recordId) => !present.has(`${category}:${recordId}`));
    return {
      category,
      required: required.length,
      present: required.length - missingRecordIds.length,
      missingRecordIds,
    };
  });
}

function denominatorsMatch(
  expected: readonly LocaleCategoryDenominator[],
  declared: readonly LocaleCategoryDenominator[],
): boolean {
  return MANDATORY_LOCALE_CATEGORIES.every((category) => {
    const left = [...(expected.find((row) => row.category === category)?.recordIds ?? [])].sort();
    const right = [...(declared.find((row) => row.category === category)?.recordIds ?? [])].sort();
    return left.length === right.length && left.every((id, index) => id === right[index]);
  });
}

export function qualifyLocaleManifest(
  manifest: AuthorityLocaleManifest | null | undefined,
  envelope: AdmittedEnvelopeIdentity,
  locale: AdmittedLocale,
  expectedDenominators: readonly LocaleCategoryDenominator[] | null = null,
): LocaleQualificationReceipt {
  const placeholderIdentity = manifest?.identity ?? {
    compositeReleaseName: envelope.name,
    authorityReleaseId: envelope.authorityReleaseId,
    authoritySnapshotId: envelope.authoritySnapshotId,
    authoritySnapshotHash: envelope.authoritySnapshotHash,
    languageComponentId: '',
    languageComponentDigest: '',
    schemaId: LOCALE_MANIFEST_CONTRACT,
  };

  if (!manifest) {
    return fail(placeholderIdentity, locale, [{
      code: 'missing-manifest',
      message: 'locale manifest is absent for the admitted envelope',
    }]);
  }
  if (manifest.contract !== LOCALE_MANIFEST_CONTRACT || manifest.identity.schemaId !== LOCALE_MANIFEST_CONTRACT) {
    return fail(manifest.identity, locale, [{
      code: 'unknown-schema',
      message: 'locale manifest schema is not admitted',
    }]);
  }
  if (
    manifest.identity.compositeReleaseName === 'latest'
    || manifest.identity.compositeReleaseName.endsWith('/latest')
    || envelope.name === 'latest'
  ) {
    return fail(manifest.identity, locale, [{
      code: 'latest-forbidden',
      message: 'locale qualification must not resolve latest',
    }]);
  }
  if (!isAdmittedLocale(locale) || !manifest.locales.includes(locale)) {
    return fail(manifest.identity, locale, [{
      code: 'unknown-locale',
      message: `locale ${locale} is not declared on the admitted manifest`,
    }]);
  }
  if (!identityMatches(manifest, envelope)) {
    return fail(manifest.identity, locale, [{
      code: 'cross-release',
      message: 'locale manifest is not bound to the admitted envelope',
    }]);
  }

  if (!expectedDenominators) {
    return fail(manifest.identity, locale, [{
      code: 'changed-denominator',
      message: 'complete-locale requires an independently computed presentation denominator',
    }]);
  }
  const expectedNormalized = MANDATORY_LOCALE_CATEGORIES.map((category) => {
    const recordIds = [...(expectedDenominators.find((row) => row.category === category)?.recordIds ?? [])].sort();
    return { category, recordIds, digest: localeDigest(recordIds) };
  });
  const declaredNormalized = MANDATORY_LOCALE_CATEGORIES.map((category) => {
    const recordIds = [...(manifest.denominators.find((row) => row.category === category)?.recordIds ?? [])].sort();
    return { category, recordIds, digest: localeDigest(recordIds) };
  });
  const recomputedDenominatorDigest = denominatorDigestFor(expectedNormalized);
  if (
    !denominatorsMatch(expectedNormalized, declaredNormalized)
    || denominatorDigestFor(declaredNormalized) !== manifest.denominatorDigest
    || recomputedDenominatorDigest !== manifest.denominatorDigest
  ) {
    return fail(manifest.identity, locale, [{
      code: 'changed-denominator',
      message: 'locale denominator drifted from the independently computed presentation set',
    }], { recomputedDenominatorDigest });
  }

  const failures: LocaleQualificationFailure[] = [];
  const present = new Map<string, LocalePresentationRecord>();
  let usedExcludedSources = false;

  for (const record of manifest.records) {
    if (record.locale !== locale) continue;
    if ((EXCLUDED_LOCALE_SOURCES as readonly string[]).includes(record.source)) {
      usedExcludedSources = true;
      failures.push({
        code: 'excluded-source',
        message: `complete-locale rejects ${record.source}`,
        recordId: record.recordId,
        category: record.category,
      });
      continue;
    }
    if (record.source !== LOCALE_RECORD_SOURCE) {
      usedExcludedSources = true;
      failures.push({
        code: 'excluded-source',
        message: 'complete-locale accepts only release-declared language-component records',
        recordId: record.recordId,
        category: record.category,
      });
      continue;
    }
    if (record.languageNeutral) {
      const classified = record.trustedFormula === true
        || manifest.languageNeutralRecordIds.includes(record.recordId);
      if (!classified) {
        failures.push({
          code: 'unclassified-language-neutral',
          message: 'language-neutral math requires trusted Formula or manifest classification',
          recordId: record.recordId,
          category: record.category,
        });
        continue;
      }
    }
    if (!isSafeAuthorityLabel(record.value, record.trustedFormula ? 'Formula' : null, record.trustedFormula === true)) {
      failures.push({
        code: 'unsafe',
        message: 'locale value is not a safe learner-facing label',
        recordId: record.recordId,
        category: record.category,
      });
      continue;
    }
    const key = `${record.category}:${record.recordId}`;
    if (present.has(key)) {
      failures.push({
        code: 'duplicate',
        message: 'complete-locale requires exactly one safe value per record',
        recordId: record.recordId,
        category: record.category,
      });
      continue;
    }
    present.set(key, record);
  }

  const categoryCoverage = coverageFor(expectedNormalized, present);
  for (const row of categoryCoverage) {
    for (const recordId of row.missingRecordIds) {
      failures.push({
        code: 'missing',
        message: 'mandatory locale record is absent from the release language component',
        recordId,
        category: row.category,
      });
    }
  }

  const recomputedContentDigest = contentDigestFor(manifest.records);
  if (recomputedContentDigest !== manifest.contentDigest) {
    failures.push({
      code: 'changed-content',
      message: 'locale content digest drifted from the admitted manifest',
    });
  }

  const ready = failures.length === 0;
  return Object.freeze({
    contract: LOCALE_QUALIFICATION_RECEIPT_CONTRACT,
    identity: manifest.identity,
    locale,
    status: ready ? 'ready' : 'failed',
    chineseReady: locale === 'zh-CN' && ready,
    bilingualReady: false,
    failures: Object.freeze(failures),
    recomputedDenominatorDigest,
    recomputedContentDigest,
    categoryCoverage: Object.freeze(categoryCoverage),
    usedExcludedSources,
  });
}

export function qualifyReleaseLocales(
  manifest: AuthorityLocaleManifest | null | undefined,
  envelope: AdmittedEnvelopeIdentity,
  expectedDenominators: readonly LocaleCategoryDenominator[] | null = null,
): ReleaseLocaleQualification {
  const zhCN = qualifyLocaleManifest(manifest, envelope, 'zh-CN', expectedDenominators);
  const en = qualifyLocaleManifest(manifest, envelope, 'en', expectedDenominators);
  const interfaceCatalogReady = graphInterfaceCatalogReady();
  const chineseReady = zhCN.status === 'ready';
  const bilingualReady = chineseReady && en.status === 'ready' && interfaceCatalogReady;
  return Object.freeze({
    envelope,
    zhCN,
    en,
    chineseReady,
    bilingualReady,
    interfaceCatalogReady,
    mutatedSelector: false,
  });
}
