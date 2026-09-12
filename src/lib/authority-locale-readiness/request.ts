import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { NextResponse } from 'next/server';

import { compositeEnvelopeDirectory, loadCompositeEnvelopeRegistry } from '@/lib/actkg-envelope/composite-envelope-registry';

import {
  HISTORICAL_ENGLISH_UNAVAILABLE_ZH,
  type AdmittedEnvelopeIdentity,
  type AdmittedLocale,
  type AuthorityLocaleManifest,
  type LocaleCategoryDenominator,
  type PublicLocaleCapability,
  type ReleaseLocaleQualification,
} from './contracts';
import { localeDigest } from './digest';
import { contentDigestFor, denominatorDigestFor, isAdmittedLocale } from './qualify';
import { historicalLocaleCapability } from './presentation-state';
import { readLocaleQualificationPackage } from './qualification-package';

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

export function localeManifestQualificationDigest(
  manifest: AuthorityLocaleManifest,
): string {
  const contentDigest = contentDigestFor(manifest.records);
  const denominatorDigest = denominatorDigestFor(manifest.denominators);
  if (
    contentDigest !== manifest.contentDigest
    || denominatorDigest !== manifest.denominatorDigest
  ) {
    throw new Error('locale manifest digest drifted from the on-disk records');
  }
  return localeDigest({
    contract: manifest.contract,
    identity: manifest.identity,
    locales: manifest.locales,
    languageNeutralRecordIds: manifest.languageNeutralRecordIds,
    contentDigest,
    denominatorDigest,
    records: manifest.records,
    denominators: manifest.denominators,
  });
}

function localePackageFingerprint(repoRoot: string): string {
  const pkgDir = join(compositeEnvelopeDirectory(repoRoot), 'locale-manifests');
  let packageDigest = 'missing';
  if (existsSync(pkgDir)) {
    const names = readdirSync(pkgDir).filter((file) => file.endsWith('.json')).sort();
    const perFile = names.map((file) => {
      const bytes = readFileSync(join(pkgDir, file));
      return `${file}:${createHash('sha256').update(bytes).digest('hex')}`;
    });
    packageDigest = localeDigest(perFile);
  }
  return [
    repoRoot,
    packageDigest,
    localeDigest(loadCompositeEnvelopeRegistry(repoRoot)),
  ].join(':');
}

export function resolveActiveLocaleQualification(
  repoRoot = process.cwd(),
): ActiveLocaleQualification {
  try {
    const cacheKey = localePackageFingerprint(repoRoot);
    const cached = qualificationByEvidence.get(cacheKey);
    if (cached) return cached;
    const match = [...loadCompositeEnvelopeRegistry(repoRoot)]
      .reverse()
      .find((row) => {
        const candidate = readLocaleQualificationPackage(repoRoot, row.name);
        return Boolean(candidate?.qualification.bilingualReady);
      });
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
    const pkg = readLocaleQualificationPackage(repoRoot, match.name);
    if (!pkg || !pkg.qualification.bilingualReady) {
      const historical = historicalQualification();
      qualificationByEvidence.set(cacheKey, historical);
      return historical;
    }
    const ready: ActiveLocaleQualification = {
      capability: {
        availableLocales: ['zh-CN', 'en'],
        bilingualReady: true,
        englishUnavailableReason: null,
        mode: 'complete-locale',
        languageComponentDigest: pkg.qualification.zhCN?.identity.languageComponentDigest ?? null,
      },
      manifest: pkg.manifest,
      envelope,
      expectedDenominators: pkg.manifest.denominators,
      qualification: pkg.qualification,
    };
    qualificationByEvidence.set(cacheKey, ready);
    return ready;
  } catch (error) {
    console.warn(
      '[locale-qualification] admitted package unavailable:',
      error instanceof Error ? error.message : error,
    );
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
