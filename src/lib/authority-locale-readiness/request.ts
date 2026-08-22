import { NextResponse } from 'next/server';

import { loadCompositeEnvelopeRegistry } from '@/lib/actkg-envelope/composite-envelope-registry';
import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards/identity';
import {
  readCurrentShardPointer,
  resolveAuthorityDomainShardPaths,
} from '@/lib/authority-domain-shards/store';

import {
  HISTORICAL_ENGLISH_UNAVAILABLE_ZH,
  type AdmittedEnvelopeIdentity,
  type AdmittedLocale,
  type AuthorityLocaleManifest,
  type LocaleCategoryDenominator,
  type PublicLocaleCapability,
  type ReleaseLocaleQualification,
} from './contracts';
import { isAdmittedLocale, qualifyReleaseLocales } from './qualify';
import { historicalLocaleCapability } from './presentation-state';
import { loadActivePresentationInventory } from './active-presentation-inventory';
import { expectedDenominatorsFromInventory } from './presentation-denominator';
import { readPublishedLocaleManifest } from './published';

export interface LocaleRequestResolution {
  readonly ok: true;
  readonly locale: AdmittedLocale;
  readonly capability: PublicLocaleCapability;
}

export interface LocaleRequestRejection {
  readonly ok: false;
  readonly response: NextResponse;
}

export interface ActiveLocaleQualification {
  readonly capability: PublicLocaleCapability;
  readonly manifest: AuthorityLocaleManifest | null;
  readonly envelope: AdmittedEnvelopeIdentity | null;
  readonly expectedDenominators: readonly LocaleCategoryDenominator[] | null;
  readonly qualification: ReleaseLocaleQualification | null;
}

function historicalQualification(): ActiveLocaleQualification {
  return {
    capability: historicalLocaleCapability(),
    manifest: null,
    envelope: null,
    expectedDenominators: null,
    qualification: null,
  };
}

const qualificationByEvidence = new Map<string, ActiveLocaleQualification>();

function localeEvidenceFingerprint(
  repoRoot: string,
  snapshotHash: string,
  releaseId: string,
  catalogHash: string,
): string {
  const pointer = readCurrentShardPointer(resolveAuthorityDomainShardPaths(repoRoot));
  const manifest = readPublishedLocaleManifest(repoRoot);
  return [
    snapshotHash,
    releaseId,
    catalogHash,
    pointer.shardSetHash,
    pointer.shardSetId,
    manifest?.identity.compositeReleaseName ?? 'missing',
    manifest?.contentDigest ?? 'missing',
    manifest?.denominatorDigest ?? 'missing',
  ].join(':');
}

export function resolveActiveLocaleQualification(
  repoRoot = process.cwd(),
): ActiveLocaleQualification {
  try {
    const active = resolveActiveShardIdentity({ repoRoot });
    const cacheKey = localeEvidenceFingerprint(
      repoRoot,
      active.envelope.authority.snapshotHash,
      active.envelope.authority.releaseId,
      active.envelope.catalog.catalogHash,
    );
    const cached = qualificationByEvidence.get(cacheKey);
    if (cached) return cached;
    const match = loadCompositeEnvelopeRegistry(repoRoot).find((row) => (
      row.authorityReleaseId === active.envelope.authority.releaseId
      && row.authoritySnapshotId === active.envelope.authority.snapshotId
      && row.authoritySnapshotHash === active.envelope.authority.snapshotHash
    ));
    if (!match) {
      const historical = historicalQualification();
      qualificationByEvidence.set(cacheKey, historical);
      return historical;
    }
    const envelope: AdmittedEnvelopeIdentity = {
      name: match.name,
      authorityReleaseId: match.authorityReleaseId,
      authoritySnapshotId: match.authoritySnapshotId,
      authoritySnapshotHash: match.authoritySnapshotHash,
    };
    const manifest = readPublishedLocaleManifest(repoRoot);
    if (!manifest || manifest.identity.compositeReleaseName !== match.name) {
      const historical = historicalQualification();
      qualificationByEvidence.set(cacheKey, historical);
      return historical;
    }
    const expectedDenominators = expectedDenominatorsFromInventory(
      loadActivePresentationInventory(repoRoot, active),
    );
    const qualification = qualifyReleaseLocales(manifest, envelope, expectedDenominators);
    if (!qualification.bilingualReady) {
      const result: ActiveLocaleQualification = {
        capability: historicalLocaleCapability(),
        manifest,
        envelope,
        expectedDenominators,
        qualification,
      };
      qualificationByEvidence.set(cacheKey, result);
      return result;
    }
    const ready: ActiveLocaleQualification = {
      capability: {
        availableLocales: ['zh-CN', 'en'],
        bilingualReady: true,
        englishUnavailableReason: null,
        mode: 'complete-locale',
        languageComponentDigest: qualification.zhCN?.identity.languageComponentDigest ?? null,
      },
      manifest,
      envelope,
      expectedDenominators,
      qualification,
    };
    qualificationByEvidence.set(cacheKey, ready);
    return ready;
  } catch {
    return historicalQualification();
  }
}

export function activeLocaleCapability(repoRoot = process.cwd()): PublicLocaleCapability {
  return resolveActiveLocaleQualification(repoRoot).capability;
}

export function resolveActiveLocaleRequest(
  request: Request,
  capability: PublicLocaleCapability = historicalLocaleCapability(),
): LocaleRequestResolution | LocaleRequestRejection {
  const url = new URL(request.url);
  const raw = url.searchParams.get('locale');
  const locale = raw == null || raw.length === 0 ? 'zh-CN' : raw;
  if (!isAdmittedLocale(locale)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: '未知显示语言，已停止投影。',
          code: 'ACTIVE_GRAPH_LOCALE_UNKNOWN',
        },
        { status: 400 },
      ),
    };
  }
  if (locale === 'en' && !capability.bilingualReady) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: capability.englishUnavailableReason ?? HISTORICAL_ENGLISH_UNAVAILABLE_ZH,
          code: 'ACTIVE_GRAPH_LOCALE_ENGLISH_UNAVAILABLE',
        },
        { status: 409 },
      ),
    };
  }
  return { ok: true, locale, capability };
}

export function localeQuery(locale: AdmittedLocale): string {
  return `locale=${encodeURIComponent(locale)}`;
}
