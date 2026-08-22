import { NextResponse } from 'next/server';

import { loadCompositeEnvelopeRegistry } from '@/lib/actkg-envelope/composite-envelope-registry';
import { resolveActiveShardIdentity } from '@/lib/authority-domain-shards/identity';

import {
  HISTORICAL_ENGLISH_UNAVAILABLE_ZH,
  type AdmittedLocale,
  type PublicLocaleCapability,
} from './contracts';
import { isAdmittedLocale, qualifyReleaseLocales } from './qualify';
import { historicalLocaleCapability } from './presentation-state';
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

export function activeLocaleCapability(repoRoot = process.cwd()): PublicLocaleCapability {
  try {
    const active = resolveActiveShardIdentity({ repoRoot });
    const match = loadCompositeEnvelopeRegistry(repoRoot).find((row) => (
      row.authorityReleaseId === active.envelope.authority.releaseId
      && row.authoritySnapshotId === active.envelope.authority.snapshotId
      && row.authoritySnapshotHash === active.envelope.authority.snapshotHash
    ));
    if (!match) return historicalLocaleCapability();
    const manifest = readPublishedLocaleManifest(repoRoot);
    if (manifest && manifest.identity.compositeReleaseName !== match.name) {
      return historicalLocaleCapability();
    }
    const qualified = qualifyReleaseLocales(manifest, {
      name: match.name,
      authorityReleaseId: match.authorityReleaseId,
      authoritySnapshotId: match.authoritySnapshotId,
      authoritySnapshotHash: match.authoritySnapshotHash,
    }, null);
    if (!qualified.bilingualReady) return historicalLocaleCapability();
    return {
      availableLocales: ['zh-CN', 'en'],
      bilingualReady: true,
      englishUnavailableReason: null,
      mode: 'complete-locale',
      languageComponentDigest: qualified.zhCN?.identity.languageComponentDigest ?? null,
    };
  } catch {
    return historicalLocaleCapability();
  }
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
