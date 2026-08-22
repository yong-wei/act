import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { envelopeByName } from '@/lib/actkg-envelope/composite-envelope-registry';
import {
  GRAPH_INTERFACE_KEYS,
  changedContentLocaleFixture,
  changedDenominatorLocaleFixture,
  completeBilingualLocaleFixture,
  completeZhCnLocaleFixture,
  contentDigestFor,
  createGraphLanguageState,
  crossReleaseLocaleFixture,
  displayNameExcludedLocaleFixture,
  displayRecordsForLocale,
  duplicateZhCnLocaleFixture,
  graphInterfaceCatalogReady,
  graphInterfaceText,
  historicalLocaleCapability,
  localeDisplayCacheKey,
  localeProfileVersion,
  mergeLocaleDisplayCache,
  missingZhCnLocaleFixture,
  overlayExcludedLocaleFixture,
  partialEnglishLocaleFixture,
  projectOptionalContentForLocale,
  PUBLISHED_LATEST_COMPOSITE_NAME,
  qualifyLocaleManifest,
  qualifyReleaseLocales,
  rejectCrossLocaleFallback,
  resolveCompleteLocaleValue,
  resolveLanguageNeutralMath,
  selectGraphLanguage,
  unclassifiedMathLocaleFixture,
  unknownSchemaLocaleFixture,
  unsafeZhCnLocaleFixture,
  validateGraphInterfaceCatalog,
  GRAPH_INTERFACE_CATALOG,
  V022_ENVELOPE_IDENTITY,
  FUTURE_TRANSLATION_RELEASE_REQUIRES_EXACT_OPENSPEC,
} from '@/lib/authority-locale-readiness';
import { FUTURE_RELEASE_BOUNDARY, qualifyPublishedLatestComposite } from '@/lib/authority-locale-readiness/published';
import { resolveActiveLocaleRequest } from '@/lib/authority-locale-readiness/request';

const PRODUCTION_SELECTORS = [
  'course-content/runtime/knowledge/authority-domain-shards/current.json',
  'course-content/runtime/knowledge/authority-domain-catalog/current.json',
  'course-content/runtime/knowledge/consumer-activation/current.json',
  'course-content/runtime/knowledge/prerequisites/current.json',
  'course-content/runtime/knowledge/projection/current.json',
  'course-content/authoring/knowledge/authority/current.json',
];

describe('complete-locale qualification', () => {
  it('pins fixtures to the published v0.22 envelope and never latest', () => {
    const published = envelopeByName(PUBLISHED_LATEST_COMPOSITE_NAME);
    expect(V022_ENVELOPE_IDENTITY.authorityReleaseId).toBe(published.authorityReleaseId);
    expect(V022_ENVELOPE_IDENTITY.authoritySnapshotHash).toBe(published.authoritySnapshotHash);
    expect(completeZhCnLocaleFixture().identity.compositeReleaseName).toBe(PUBLISHED_LATEST_COMPOSITE_NAME);
    expect(completeZhCnLocaleFixture().identity.compositeReleaseName).not.toBe('latest');
  });

  it('accepts complete Chinese from the release language component', () => {
    const receipt = qualifyLocaleManifest(completeZhCnLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN');
    expect(receipt.status).toBe('ready');
    expect(receipt.chineseReady).toBe(true);
    expect(receipt.usedExcludedSources).toBe(false);
  });

  it('fails missing, duplicate, unsafe, overlay, display_name, cross-release, denominator, content, and unknown schema', () => {
    expect(qualifyLocaleManifest(missingZhCnLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN').failures.map((row) => row.code)).toContain('missing');
    expect(qualifyLocaleManifest(duplicateZhCnLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN').failures.map((row) => row.code)).toContain('duplicate');
    expect(qualifyLocaleManifest(unsafeZhCnLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN').failures.map((row) => row.code)).toContain('unsafe');
    expect(qualifyLocaleManifest(overlayExcludedLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN').usedExcludedSources).toBe(true);
    expect(qualifyLocaleManifest(displayNameExcludedLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN').failures.map((row) => row.code)).toContain('excluded-source');
    expect(qualifyLocaleManifest(crossReleaseLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN').failures.map((row) => row.code)).toContain('cross-release');
    expect(qualifyLocaleManifest(changedDenominatorLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN').failures.map((row) => row.code)).toContain('changed-denominator');
    expect(qualifyLocaleManifest(changedContentLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN').failures.map((row) => row.code)).toContain('changed-content');
    expect(qualifyLocaleManifest(unknownSchemaLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN').failures.map((row) => row.code)).toContain('unknown-schema');
  });

  it('does not let partial English invalidate complete Chinese or enable product English', () => {
    const result = qualifyReleaseLocales(partialEnglishLocaleFixture(), V022_ENVELOPE_IDENTITY);
    expect(result.chineseReady).toBe(true);
    expect(result.en?.status).toBe('failed');
    expect(result.bilingualReady).toBe(false);
    expect(result.mutatedSelector).toBe(false);
  });

  it('marks bilingual-ready only when both locales and the interface catalog pass', () => {
    const result = qualifyReleaseLocales(completeBilingualLocaleFixture(), V022_ENVELOPE_IDENTITY);
    expect(result.chineseReady).toBe(true);
    expect(result.en?.status).toBe('ready');
    expect(result.interfaceCatalogReady).toBe(true);
    expect(result.bilingualReady).toBe(true);
  });

  it('rejects unclassified TeX-like language-neutral claims', () => {
    const receipt = qualifyLocaleManifest(unclassifiedMathLocaleFixture(), V022_ENVELOPE_IDENTITY, 'zh-CN');
    expect(receipt.failures.map((row) => row.code)).toContain('unclassified-language-neutral');
  });

  it('does not mutate selectors while qualifying the published latest composite', () => {
    const before = PRODUCTION_SELECTORS.map((file) => readFileSync(file));
    const published = qualifyPublishedLatestComposite();
    expect(published.envelope.name).toBe(PUBLISHED_LATEST_COMPOSITE_NAME);
    expect(published.chineseReady).toBe(false);
    expect(published.bilingualReady).toBe(false);
    expect(published.zhCN?.failures.some((row) => row.code === 'missing-manifest')).toBe(true);
    expect(published.mutatedSelector).toBe(false);
    PRODUCTION_SELECTORS.forEach((file, index) => {
      expect(readFileSync(file).equals(before[index]!)).toBe(true);
    });
  });
});

describe('complete-locale resolver and cache', () => {
  it('never falls back across languages or display_name', () => {
    const manifest = completeBilingualLocaleFixture();
    const zh = qualifyLocaleManifest(manifest, V022_ENVELOPE_IDENTITY, 'zh-CN');
    const missing = resolveCompleteLocaleValue(manifest, zh, 'zh-CN', 'object-names', 'object:missing');
    expect(missing.status).toBe('unavailable');
    expect(missing.value).toBeNull();
    expect(rejectCrossLocaleFallback('zh-CN', 'en')).toBe(true);
    expect(rejectCrossLocaleFallback('zh-CN', 'zh-CN')).toBe(false);
  });

  it('shares trusted Formula math while keeping names locale-specific', () => {
    const manifest = completeBilingualLocaleFixture();
    const zhMath = resolveLanguageNeutralMath(manifest, 'zh-CN', 'math:characteristic-equation');
    const enMath = resolveLanguageNeutralMath(manifest, 'en', 'math:characteristic-equation');
    expect(zhMath.status).toBe('available');
    expect(enMath.value).toBe(zhMath.value);
    const zhName = resolveCompleteLocaleValue(
      manifest,
      qualifyLocaleManifest(manifest, V022_ENVELOPE_IDENTITY, 'zh-CN'),
      'zh-CN',
      'object-names',
      'object:transfer-function',
    );
    const enName = resolveCompleteLocaleValue(
      manifest,
      qualifyLocaleManifest(manifest, V022_ENVELOPE_IDENTITY, 'en'),
      'en',
      'object-names',
      'object:transfer-function',
    );
    expect(zhName.value).toBe('传递函数');
    expect(enName.value).toBe('Transfer function');
  });

  it('rejects stale and cross-locale display merges while preserving identity', () => {
    const zhProfile = localeProfileVersion({
      locale: 'zh-CN',
      mode: 'complete-locale',
      languageComponentDigest: 'a'.repeat(64),
      authorityCatalogVersion: 'acv-test',
    });
    const enProfile = localeProfileVersion({
      locale: 'en',
      mode: 'complete-locale',
      languageComponentDigest: 'a'.repeat(64),
      authorityCatalogVersion: 'acv-test',
    });
    expect(zhProfile).not.toBe(enProfile);
    expect(localeDisplayCacheKey(zhProfile, 'detail', 'object:transfer-function')).toContain(zhProfile);
    const accepted = mergeLocaleDisplayCache(new Map(), [{
      canonicalId: 'object:transfer-function',
      locale: 'zh-CN',
      profileVersion: zhProfile,
      label: '传递函数',
      aliases: ['TF'],
      description: '说明',
    }], { locale: 'zh-CN', profileVersion: zhProfile });
    expect(accepted.status).toBe('accept');
    if (accepted.status !== 'accept') return;
    expect(displayRecordsForLocale(accepted.display, 'zh-CN', zhProfile)).toHaveLength(1);
    const cross = mergeLocaleDisplayCache(accepted.display, [{
      canonicalId: 'object:transfer-function',
      locale: 'en',
      profileVersion: enProfile,
      label: 'Transfer function',
      aliases: ['TF'],
      description: 'Explanation',
    }], { locale: 'zh-CN', profileVersion: zhProfile });
    expect(cross.status).toBe('reject');
    if (cross.status === 'reject') expect(cross.reason).toBe('cross-locale-merge');
    const stale = mergeLocaleDisplayCache(accepted.display, [{
      canonicalId: 'object:transfer-function',
      locale: 'zh-CN',
      profileVersion: enProfile,
      label: '传递函数',
      aliases: ['TF'],
      description: '说明',
    }], { locale: 'zh-CN', profileVersion: zhProfile });
    expect(stale.status).toBe('reject');
    if (stale.status === 'reject') expect(stale.reason).toBe('stale-locale');
  });

  it('keeps English unavailable as local presentation state', () => {
    const state = createGraphLanguageState(historicalLocaleCapability());
    expect(state.selectedLocale).toBe('zh-CN');
    expect(state.englishAvailable).toBe(false);
    expect(selectGraphLanguage(state, 'en').selectedLocale).toBe('zh-CN');
    expect(selectGraphLanguage(state, 'en').wroteLearnerOrServerState).toBe(false);
    expect(selectGraphLanguage(state, 'en').englishUnavailableReason).toContain('English');
  });

  it('omits other-language optional content instead of mixing it', () => {
    expect(projectOptionalContentForLocale({
      availableLocales: ['zh-CN'],
      bodyLocale: 'zh-CN',
      selectedLocale: 'en',
    }).visibility).toBe('unavailable');
    expect(projectOptionalContentForLocale({
      availableLocales: ['zh-CN'],
      selectedLocale: 'en',
    }).visibility).toBe('omit');
    expect(projectOptionalContentForLocale({
      availableLocales: ['zh-CN', 'en'],
      bodyLocale: 'en',
      selectedLocale: 'en',
    }).visibility).toBe('render');
  });
});

describe('ACT graph-interface catalog', () => {
  it('has complete Chinese and English values and rejects Authority overrides', () => {
    expect(graphInterfaceCatalogReady()).toBe(true);
    validateGraphInterfaceCatalog(GRAPH_INTERFACE_CATALOG);
    expect(GRAPH_INTERFACE_KEYS.length).toBeGreaterThan(40);
    expect(graphInterfaceText('language.zh', 'zh-CN')).toBe('中文');
    expect(graphInterfaceText('language.en', 'en')).toBe('English');
    expect(() => graphInterfaceText('authority.domain' as typeof GRAPH_INTERFACE_KEYS[number], 'zh-CN')).toThrow();
  });
});

describe('locale request gate', () => {
  it('rejects unknown locales and English when not bilingual-ready', async () => {
    const unknown = resolveActiveLocaleRequest(new Request('http://localhost/api/knowledge/shards/active?locale=fr'));
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.response.status).toBe(400);
    const english = resolveActiveLocaleRequest(new Request('http://localhost/api/knowledge/shards/active?locale=en'));
    expect(english.ok).toBe(false);
    if (english.ok) return;
    expect(english.response.status).toBe(409);
    const body = await english.response.json() as { error: string };
    expect(body.error).toContain('English');
    const chinese = resolveActiveLocaleRequest(new Request('http://localhost/api/knowledge/shards/active'));
    expect(chinese.ok).toBe(true);
  });
});

describe('production selector byte identity', () => {
  it('keeps current production selectors byte-identical to HEAD', () => {
    for (const relative of PRODUCTION_SELECTORS) {
      const actual = readFileSync(path.join(process.cwd(), relative));
      const head = execFileSync('git', ['show', `HEAD:${relative}`]);
      expect(actual.equals(head)).toBe(true);
      expect(createHash('sha256').update(actual).digest('hex')).toHaveLength(64);
    }
    const shards = JSON.parse(readFileSync(PRODUCTION_SELECTORS[0]!, 'utf8')) as { releaseId: string };
    expect(shards.releaseId).toBe('ctr:release:control-theory-engineering-v0.9');
    expect(FUTURE_RELEASE_BOUNDARY).toBe(FUTURE_TRANSLATION_RELEASE_REQUIRES_EXACT_OPENSPEC);
  });
});

describe('content digest stability', () => {
  it('recomputes the same digest for the same records', () => {
    const records = completeZhCnLocaleFixture().records;
    expect(contentDigestFor(records)).toBe(contentDigestFor([...records].reverse()));
  });
});
