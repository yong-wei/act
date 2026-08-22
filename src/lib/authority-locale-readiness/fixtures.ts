import {
  LOCALE_MANIFEST_CONTRACT,
  LOCALE_RECORD_SOURCE,
  MANDATORY_LOCALE_CATEGORIES,
  PUBLISHED_LATEST_COMPOSITE_NAME,
  type AdmittedEnvelopeIdentity,
  type AdmittedLocale,
  type AuthorityLocaleManifest,
  type ExcludedLocaleSource,
  type LocalePresentationRecord,
  type MandatoryLocaleCategory,
} from './contracts';
import type { LocalePresentationInventory } from './presentation-denominator';
import { contentDigestFor, denominatorDigestFor } from './qualify';
import { localeDigest } from './digest';

/** Pinned to the published latest qualified composite; never `latest`. */
export const V022_ENVELOPE_IDENTITY: AdmittedEnvelopeIdentity = Object.freeze({
  name: PUBLISHED_LATEST_COMPOSITE_NAME,
  authorityReleaseId: 'ctr:release:control-theory-engineering-v0.22',
  authoritySnapshotId: 'snap-9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151',
  authoritySnapshotHash: '9c4b2c1c2c976b4903bb979889d8b74a8dd306bc718cd4c9d06ac97b14172151',
});

const CATEGORY_SEEDS: Record<MandatoryLocaleCategory, { id: string; zh: string; en: string }> = {
  domains: { id: 'domain:system-modeling', zh: '系统建模', en: 'System modeling' },
  'object-names': { id: 'object:transfer-function', zh: '传递函数', en: 'Transfer function' },
  'object-explanations': { id: 'explain:transfer-function', zh: '用传递函数描述输入输出关系', en: 'A transfer function describes the input-output relation' },
  types: { id: 'type:DomainConcept', zh: '领域概念', en: 'Domain concept' },
  relations: { id: 'relation:applies_to', zh: '适用于', en: 'Applies to' },
  directions: { id: 'direction:source_to_target', zh: '由前者指向后者', en: 'From the former to the latter' },
  'approved-aliases': { id: 'alias:transfer-function', zh: 'TF', en: 'TF' },
  'readable-sources': { id: 'source:textbook-section', zh: '教材第 2 章系统模型', en: 'Textbook chapter 2 system models' },
};

function recordsFor(locales: readonly AdmittedLocale[]): LocalePresentationRecord[] {
  const rows: LocalePresentationRecord[] = [];
  for (const locale of locales) {
    for (const category of MANDATORY_LOCALE_CATEGORIES) {
      const seed = CATEGORY_SEEDS[category];
      rows.push({
        recordId: seed.id,
        category,
        locale,
        value: locale === 'zh-CN' ? seed.zh : seed.en,
        source: LOCALE_RECORD_SOURCE,
      });
    }
  }
  return rows;
}

function denominators() {
  return MANDATORY_LOCALE_CATEGORIES.map((category) => {
    const recordIds = [CATEGORY_SEEDS[category].id];
    return { category, recordIds, digest: localeDigest(recordIds) };
  });
}

function identity(languageComponentId: string) {
  return {
    compositeReleaseName: V022_ENVELOPE_IDENTITY.name,
    authorityReleaseId: V022_ENVELOPE_IDENTITY.authorityReleaseId,
    authoritySnapshotId: V022_ENVELOPE_IDENTITY.authoritySnapshotId,
    authoritySnapshotHash: V022_ENVELOPE_IDENTITY.authoritySnapshotHash,
    languageComponentId,
    languageComponentDigest: localeDigest(languageComponentId),
    schemaId: LOCALE_MANIFEST_CONTRACT,
  } as const;
}

function manifest(
  locales: readonly AdmittedLocale[],
  languageComponentId: string,
  records: LocalePresentationRecord[],
  extras: Partial<AuthorityLocaleManifest> = {},
): AuthorityLocaleManifest {
  const dens = denominators();
  return {
    contract: LOCALE_MANIFEST_CONTRACT,
    identity: identity(languageComponentId),
    locales,
    denominators: dens,
    denominatorDigest: denominatorDigestFor(dens),
    records,
    contentDigest: contentDigestFor(records),
    languageNeutralRecordIds: [],
    optionalMedia: [{ recordId: 'card:transfer-function', availableLocales: ['zh-CN'] }],
    ...extras,
  };
}

export function v022IndependentPresentationInventory(): LocalePresentationInventory {
  return {
    domains: [CATEGORY_SEEDS.domains.id],
    objectNames: [CATEGORY_SEEDS['object-names'].id],
    objectExplanations: [CATEGORY_SEEDS['object-explanations'].id],
    types: [CATEGORY_SEEDS.types.id],
    relations: [CATEGORY_SEEDS.relations.id],
    directions: [CATEGORY_SEEDS.directions.id],
    aliasIds: [CATEGORY_SEEDS['approved-aliases'].id],
    sourceIds: [CATEGORY_SEEDS['readable-sources'].id],
  };
}

export function v022BilingualIndependentPresentationInventory(): LocalePresentationInventory {
  const base = v022IndependentPresentationInventory();
  return {
    ...base,
    objectNames: [...base.objectNames, 'math:characteristic-equation'].sort(),
  };
}

export function completeZhCnLocaleFixture(): AuthorityLocaleManifest {
  return manifest(['zh-CN'], 'lang:v022-fixture-zh', recordsFor(['zh-CN']));
}

export function completeBilingualLocaleFixture(): AuthorityLocaleManifest {
  const records = recordsFor(['zh-CN', 'en']);
  records.push({
    recordId: 'math:characteristic-equation',
    category: 'object-names',
    locale: 'zh-CN',
    value: String.raw`G(s)=\frac{1}{s+1}`,
    source: LOCALE_RECORD_SOURCE,
    languageNeutral: true,
    trustedFormula: true,
  });
  records.push({
    recordId: 'math:characteristic-equation',
    category: 'object-names',
    locale: 'en',
    value: String.raw`G(s)=\frac{1}{s+1}`,
    source: LOCALE_RECORD_SOURCE,
    languageNeutral: true,
    trustedFormula: true,
  });
  const dens = denominators().map((row) => {
    if (row.category !== 'object-names') return row;
    const recordIds = [...row.recordIds, 'math:characteristic-equation'].sort();
    return { ...row, recordIds, digest: localeDigest(recordIds) };
  });
  return {
    ...manifest(['zh-CN', 'en'], 'lang:v022-fixture-bilingual', records, { denominators: dens }),
    denominatorDigest: denominatorDigestFor(dens),
    contentDigest: contentDigestFor(records),
    languageNeutralRecordIds: ['math:characteristic-equation'],
  };
}

export function missingZhCnLocaleFixture(): AuthorityLocaleManifest {
  const records = recordsFor(['zh-CN']).filter((row) => row.category !== 'domains');
  return manifest(['zh-CN'], 'lang:v022-fixture-missing', records);
}

export function duplicateZhCnLocaleFixture(): AuthorityLocaleManifest {
  const records = recordsFor(['zh-CN']);
  records.push({ ...records[0]!, value: '重复领域名' });
  return manifest(['zh-CN'], 'lang:v022-fixture-duplicate', records);
}

export function unsafeZhCnLocaleFixture(): AuthorityLocaleManifest {
  const records = recordsFor(['zh-CN']).map((row) => (
    row.category === 'object-names'
      ? { ...row, value: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
      : row
  ));
  return manifest(['zh-CN'], 'lang:v022-fixture-unsafe', records);
}

export function overlayExcludedLocaleFixture(): AuthorityLocaleManifest {
  const records = recordsFor(['zh-CN']).map((row) => (
    row.category === 'object-names'
      ? { ...row, source: 'act-overlay' as ExcludedLocaleSource }
      : row
  ));
  return manifest(['zh-CN'], 'lang:v022-fixture-overlay', records);
}

export function displayNameExcludedLocaleFixture(): AuthorityLocaleManifest {
  const records = recordsFor(['zh-CN']).map((row) => (
    row.category === 'object-names'
      ? { ...row, source: 'display-name' as ExcludedLocaleSource }
      : row
  ));
  return manifest(['zh-CN'], 'lang:v022-fixture-display-name', records);
}

export function crossReleaseLocaleFixture(): AuthorityLocaleManifest {
  const base = completeZhCnLocaleFixture();
  return {
    ...base,
    identity: {
      ...base.identity,
      authorityReleaseId: 'ctr:release:control-theory-engineering-v0.18',
      authoritySnapshotId: 'snap-1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed',
      authoritySnapshotHash: '1b64a853dda5668d83d0d2f09cadf72937330ced6aa49611f8027a9d5ec008ed',
    },
  };
}

export function changedDenominatorLocaleFixture(): AuthorityLocaleManifest {
  const base = completeZhCnLocaleFixture();
  return { ...base, denominatorDigest: '0'.repeat(64) };
}

export function changedContentLocaleFixture(): AuthorityLocaleManifest {
  const base = completeZhCnLocaleFixture();
  return { ...base, contentDigest: '0'.repeat(64) };
}

export function unknownSchemaLocaleFixture(): AuthorityLocaleManifest {
  const base = completeZhCnLocaleFixture();
  return { ...base, contract: 'act-authority-locale-manifest/v0' as typeof LOCALE_MANIFEST_CONTRACT };
}

export function partialEnglishLocaleFixture(): AuthorityLocaleManifest {
  const records = [
    ...recordsFor(['zh-CN']),
    ...recordsFor(['en']).filter((row) => row.category !== 'object-explanations'),
  ];
  return manifest(['zh-CN', 'en'], 'lang:v022-fixture-partial-en', records);
}

export function unclassifiedMathLocaleFixture(): AuthorityLocaleManifest {
  const records = recordsFor(['zh-CN']);
  records.push({
    recordId: 'object:transfer-function',
    category: 'object-names',
    locale: 'zh-CN',
    value: String.raw`G(s)=\frac{1}{s}`,
    source: LOCALE_RECORD_SOURCE,
    languageNeutral: true,
  });
  return manifest(['zh-CN'], 'lang:v022-fixture-unclassified-math', records);
}

export function englishOnlyPartialDoesNotLeak(): { zh: AuthorityLocaleManifest; mixed: AuthorityLocaleManifest } {
  return {
    zh: completeZhCnLocaleFixture(),
    mixed: partialEnglishLocaleFixture(),
  };
}
