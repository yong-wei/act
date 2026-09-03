import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { NextResponse } from 'next/server';

import { loadCompositeEnvelopeRegistry } from '@/lib/actkg-envelope/composite-envelope-registry';
import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards/identity';
import { shardDigest } from '@/lib/authority-domain-shards/hash';
import {
  defaultShardIo,
  readCurrentShardPointer,
  readJsonViaIo,
  resolveAuthorityDomainShardPaths,
  shardSetDir,
} from '@/lib/authority-domain-shards/store';
import type { AuthorityShardSetManifest } from '@/lib/authority-domain-shards/contracts';

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
import { contentDigestFor, denominatorDigestFor, isAdmittedLocale, qualifyReleaseLocales } from './qualify';
import { historicalLocaleCapability } from './presentation-state';
import {
  LOCALE_MANIFESTS_DIR_RELATIVE,
  readLocaleQualificationPackage,
  verifyLocaleQualificationPackage,
} from './qualification-package';

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

function localeEvidenceFingerprint(
  repoRoot: string,
  snapshotHash: string,
  releaseId: string,
  catalogHash: string,
): string {
  const paths = resolveAuthorityDomainShardPaths(repoRoot);
  const pointer = readCurrentShardPointer(paths);
  if (
    pointer.snapshotHash !== snapshotHash
    || pointer.releaseId !== releaseId
    || pointer.catalogHash !== catalogHash
  ) {
    throw new Error('active shard pointer drifted from the resolved Authority identity');
  }
  const shardManifest = readJsonViaIo<AuthorityShardSetManifest>(
    defaultShardIo,
    join(shardSetDir(paths, pointer.shardSetId), 'manifest.json'),
  );
  const recomputedSetHash = shardDigest({
    envelope: shardManifest.envelope,
    files: shardManifest.files,
  });
  if (
    recomputedSetHash !== pointer.shardSetHash
    || shardManifest.shardSetHash !== pointer.shardSetHash
    || shardManifest.shardSetId !== pointer.shardSetId
  ) {
    throw new Error('active shard-set seal drifted from the current pointer');
  }
  // 证据指纹包含密封资格包的内容 digest：包字节漂移即失效缓存。包目录
  // 按仓库契约只承载有限个 composite 包（当前仅 v0.37）。
  const pkgDir = join(repoRoot, LOCALE_MANIFESTS_DIR_RELATIVE);
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
    snapshotHash,
    releaseId,
    catalogHash,
    recomputedSetHash,
    pointer.shardSetId,
    packageDigest,
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
      console.warn('[locale-qualification] historical fallback: no qualified composite registry match');
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
    // 运行时只读密封资格包并做小体量核验（identity/registry/digest + 内存
    // 重跑 qualify）；不遍历分片闭包、不重建分母（#1741 design 2）。
    const pkg = readLocaleQualificationPackage(repoRoot, match.name);
    if (!pkg) {
      console.warn('[locale-qualification] historical fallback: sealed package missing', match.name);
      const historical = historicalQualification();
      qualificationByEvidence.set(cacheKey, historical);
      return historical;
    }
    const verified = verifyLocaleQualificationPackage({ repoRoot, package: pkg });
    if (!verified.ok) {
      console.warn('[locale-qualification] historical fallback:', verified.reason);
      const historical = historicalQualification();
      qualificationByEvidence.set(cacheKey, historical);
      return historical;
    }
    const qualification = qualifyReleaseLocales(
      verified.manifest,
      verified.envelope,
      verified.manifest.denominators,
    );
    if (!qualification.bilingualReady) {
      const result: ActiveLocaleQualification = {
        capability: historicalLocaleCapability(),
        manifest: verified.manifest,
        envelope,
        expectedDenominators: verified.manifest.denominators,
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
      manifest: verified.manifest,
      envelope,
      expectedDenominators: verified.manifest.denominators,
      qualification,
    };
    qualificationByEvidence.set(cacheKey, ready);
    return ready;
  } catch (error) {
    console.warn(
      '[locale-qualification] historical fallback:',
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
