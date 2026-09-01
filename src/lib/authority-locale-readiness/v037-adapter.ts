/**
 * Versioned adapter from the exact upstream v0.37 bilingual presentation
 * bundle to ACT's complete-locale manifest (#1741).
 *
 * Upstream evidence (ctkg contracts) is converted, never trusted directly:
 * every declared upstream hash is verified against the bundle manifest and
 * every ACT presentation denominator member must be covered by an upstream
 * row or the adapter fails closed. No mutable `latest` pointer is followed
 * and no ACT overlay value is mixed in.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ADMITTED_LOCALES,
  LOCALE_MANIFEST_CONTRACT,
  LOCALE_RECORD_SOURCE,
  type AdmittedLocale,
  type AuthorityLocaleManifest,
  type LocaleCategoryDenominator,
  type LocalePresentationRecord,
  type MandatoryLocaleCategory,
} from './contracts';
import { localeDigest } from './digest';
import { contentDigestFor, denominatorDigestFor } from './qualify';
import type { LocalePresentationInventory } from './presentation-denominator';

/** The exact admitted upstream bilingual bundle; never resolves `latest`. */
export const V037_BILINGUAL_BUNDLE_RELATIVE =
  'course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r3' as const;


const UPSTREAM_LOCALE_MANIFEST_CONTRACT = 'ctkg-locale-manifest/1';
const UPSTREAM_LOCALIZED_CONTENT_CONTRACT = 'ctkg-localized-content/1';
const UPSTREAM_ENTITY_TYPE_LEXICON_CONTRACT = 'ctkg-entity-type-locale-lexicon/1';
const UPSTREAM_RELATION_LEXICON_CONTRACT = 'ctkg-relation-locale-lexicon/1';

export class V037AdapterError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'V037AdapterError';
    this.code = code;
  }
}

interface UpstreamLocalizedContentRow {
  contract: string;
  locale: AdmittedLocale;
  target_id: string;
  field_path: string;
  value: string;
  review_status: string;
}

interface UpstreamTypeTermRow {
  contract: string;
  term_id: string;
  locale: AdmittedLocale;
  label: string;
  review_status: string;
}

interface UpstreamRelationTermRow {
  contract: string;
  predicate_id: string;
  locale: AdmittedLocale;
  forward_label: string;
  review_status: string;
}

interface UpstreamLocaleManifest {
  contract: string;
  release: { id: string; hash: string; version: string };
  capabilities: { bilingual_ready: boolean; zh_cn_ready: boolean; en_ready: boolean };
  locale_components: Record<string, { id: string; content_digest: string; hash: string }>;
}

export interface V037EnvelopeIdentityInput {
  compositeReleaseName: string;
  authorityReleaseId: string;
  authoritySnapshotId: string;
  authoritySnapshotHash: string;
}

function sha256File(repoRoot: string, relative: string): string {
  return createHash('sha256').update(readFileSync(join(repoRoot, relative))).digest('hex');
}

function readJsonl<T>(repoRoot: string, relative: string): T[] {
  const rows: T[] = [];
  for (const line of readFileSync(join(repoRoot, relative), 'utf8').split('\n')) {
    if (line.trim().length === 0) continue;
    rows.push(JSON.parse(line) as T);
  }
  return rows;
}

function verifyBundleSeal(repoRoot: string): { localeManifest: UpstreamLocaleManifest } {
  const bundleManifest = JSON.parse(
    readFileSync(join(repoRoot, V037_BILINGUAL_BUNDLE_RELATIVE, 'bundle-manifest.json'), 'utf8'),
  ) as { bundle_contract_version?: string; artifacts?: Array<{ path: string; sha256: string }> };
  if (bundleManifest.bundle_contract_version !== 'actkg-public-bundle/3') {
    throw new V037AdapterError('bundle-contract', 'upstream bundle contract is not admitted');
  }
  const localeManifest = JSON.parse(
    readFileSync(join(repoRoot, V037_BILINGUAL_BUNDLE_RELATIVE, 'locale-manifest.json'), 'utf8'),
  ) as UpstreamLocaleManifest;
  if (localeManifest.contract !== UPSTREAM_LOCALE_MANIFEST_CONTRACT) {
    throw new V037AdapterError('locale-manifest-contract', 'upstream locale manifest contract is not admitted');
  }
  if (
    !localeManifest.capabilities.bilingual_ready
    || !localeManifest.capabilities.zh_cn_ready
    || !localeManifest.capabilities.en_ready
  ) {
    throw new V037AdapterError('not-bilingual-ready', 'upstream bundle does not declare bilingual readiness');
  }
  // Declared artifact hashes are verified against the bytes on disk; any
  // drift fails closed before conversion.
  const declared = new Map((bundleManifest.artifacts ?? []).map((row) => [row.path, row.sha256]));
  for (const file of [
    'locale-manifest.json',
    'localized-content-index.jsonl',
    'entity-type-locale-lexicon.jsonl',
    'relation-locale-lexicon.jsonl',
  ] as const) {
    const relative = `${V037_BILINGUAL_BUNDLE_RELATIVE}/${file}`;
    const digest = sha256File(repoRoot, relative);
    const expected = declared.get(file);
    if (!expected) {
      throw new V037AdapterError('bundle-file-undeclared', `upstream bundle omits ${file}`);
    }
    if (expected !== digest) {
      throw new V037AdapterError('bundle-hash-drift', `upstream ${file} drifted from the bundle manifest`);
    }
  }
  return { localeManifest };
}

/**
 * Convert the exact upstream bilingual bundle into ACT's complete-locale
 * manifest bound to the active composite identity. Every presentation
 * denominator member must be covered by an approved upstream row.
 */
export function adaptV037LocaleManifest(input: {
  repoRoot: string;
  envelope: V037EnvelopeIdentityInput;
  inventory: LocalePresentationInventory;
}): AuthorityLocaleManifest {
  const { localeManifest } = verifyBundleSeal(input.repoRoot);

  const contentRows = readJsonl<UpstreamLocalizedContentRow>(
    input.repoRoot,
    `${V037_BILINGUAL_BUNDLE_RELATIVE}/localized-content-index.jsonl`,
  ).filter((row) => row.review_status === 'approved' && row.value.length > 0);
  const typeRows = readJsonl<UpstreamTypeTermRow>(
    input.repoRoot,
    `${V037_BILINGUAL_BUNDLE_RELATIVE}/entity-type-locale-lexicon.jsonl`,
  ).filter((row) => row.review_status === 'approved');
  const relationRows = readJsonl<UpstreamRelationTermRow>(
    input.repoRoot,
    `${V037_BILINGUAL_BUNDLE_RELATIVE}/relation-locale-lexicon.jsonl`,
  ).filter((row) => row.review_status === 'approved');

  const upstreamByName = new Map<string, Map<AdmittedLocale, string>>();
  const upstreamByMeaning = new Map<string, Map<AdmittedLocale, string>>();
  for (const row of contentRows) {
    if (row.locale !== 'zh-CN' && row.locale !== 'en') continue;
    if (row.field_path === 'name') {
      const slot = upstreamByName.get(row.target_id) ?? new Map<AdmittedLocale, string>();
      slot.set(row.locale, row.value);
      upstreamByName.set(row.target_id, slot);
    } else if (row.field_path === 'meaning') {
      const slot = upstreamByMeaning.get(row.target_id) ?? new Map<AdmittedLocale, string>();
      slot.set(row.locale, row.value);
      upstreamByMeaning.set(row.target_id, slot);
    }
  }
  const upstreamTypes = new Map<string, Map<AdmittedLocale, string>>();
  for (const row of typeRows) {
    const slot = upstreamTypes.get(row.term_id) ?? new Map<AdmittedLocale, string>();
    slot.set(row.locale, row.label);
    upstreamTypes.set(row.term_id, slot);
  }
  const upstreamRelations = new Map<string, Map<AdmittedLocale, string>>();
  for (const row of relationRows) {
    const slot = upstreamRelations.get(row.predicate_id) ?? new Map<AdmittedLocale, string>();
    slot.set(row.locale, row.forward_label);
    upstreamRelations.set(row.predicate_id, slot);
  }

  const records: LocalePresentationRecord[] = [];
  const languageNeutralRecordIds: string[] = [];

  const emit = (
    category: MandatoryLocaleCategory,
    expectedIds: readonly string[],
    source: Map<string, Map<AdmittedLocale, string>>,
    options: { trustedFormulaIdPattern?: RegExp } = {},
  ): void => {
    for (const id of expectedIds) {
      const slot = source.get(id);
      const zh = slot?.get('zh-CN');
      const en = slot?.get('en');
      if (!zh || !en) {
        throw new V037AdapterError(
          'upstream-coverage-gap',
          `${category} ${id} lacks an approved upstream bilingual value`,
        );
      }
      const trustedFormula = options.trustedFormulaIdPattern?.test(id) === true;
      const languageNeutral = zh === en;
      for (const locale of ADMITTED_LOCALES) {
        records.push({
          recordId: id,
          category,
          locale,
          value: locale === 'zh-CN' ? zh : en,
          source: LOCALE_RECORD_SOURCE,
          ...(languageNeutral ? { languageNeutral: true, trustedFormula } : {}),
        });
      }
      if (languageNeutral && trustedFormula) languageNeutralRecordIds.push(id);
    }
  };

  emit('object-names', input.inventory.objectNames, upstreamByName, {
    trustedFormulaIdPattern: /^ctf:/u,
  });
  emit('object-explanations', input.inventory.objectExplanations, upstreamByMeaning);
  emit('types', input.inventory.types, upstreamTypes);
  emit('relations', input.inventory.relations, upstreamRelations);

  const emptyCategories: MandatoryLocaleCategory[] = [
    'domains',
    'directions',
    'approved-aliases',
    'readable-sources',
  ];
  const denominators: LocaleCategoryDenominator[] = [
    ...([
      ['object-names', input.inventory.objectNames],
      ['object-explanations', input.inventory.objectExplanations],
      ['types', input.inventory.types],
      ['relations', input.inventory.relations],
      ['approved-aliases', input.inventory.aliasIds],
      ['readable-sources', input.inventory.sourceIds],
    ] as Array<[MandatoryLocaleCategory, readonly string[]]>).map(([category, ids]) => ({
      category,
      recordIds: [...ids].sort(),
      digest: localeDigest([...ids].sort()),
    })),
    ...emptyCategories.map((category) => ({ category, recordIds: [], digest: localeDigest([]) })),
  ];

  const zhComponent = localeManifest.locale_components['zh-CN'];
  const enComponent = localeManifest.locale_components['en'];
  if (!zhComponent || !enComponent || zhComponent.hash !== enComponent.hash) {
    throw new V037AdapterError('language-component-identity', 'upstream language components are not co-sealed');
  }

  const manifest: AuthorityLocaleManifest = {
    contract: LOCALE_MANIFEST_CONTRACT,
    identity: {
      compositeReleaseName: input.envelope.compositeReleaseName,
      authorityReleaseId: input.envelope.authorityReleaseId,
      authoritySnapshotId: input.envelope.authoritySnapshotId,
      authoritySnapshotHash: input.envelope.authoritySnapshotHash,
      languageComponentId: zhComponent.id,
      languageComponentDigest: zhComponent.content_digest,
      schemaId: LOCALE_MANIFEST_CONTRACT,
    },
    locales: [...ADMITTED_LOCALES],
    denominators,
    denominatorDigest: denominatorDigestFor(denominators),
    records,
    contentDigest: contentDigestFor(records),
    languageNeutralRecordIds,
  };
  return manifest;
}
