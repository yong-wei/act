import type { AdmittedLocale } from './contracts';
import { localeDigest } from './digest';

export interface LocaleProfileBinding {
  readonly locale: AdmittedLocale;
  readonly mode: 'historical' | 'complete-locale';
  readonly languageComponentDigest: string | null;
  readonly authorityCatalogVersion: string;
}

export interface LocaleDisplayRecord {
  readonly canonicalId: string;
  readonly locale: AdmittedLocale;
  readonly profileVersion: string;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly description: string | null;
}

export interface TopologyObjectIdentity {
  readonly canonicalId: string;
  readonly canonicalType: string;
}

export type LocaleCacheMergeResult =
  | { readonly status: 'accept'; readonly display: ReadonlyMap<string, LocaleDisplayRecord> }
  | { readonly status: 'reject'; readonly reason: 'stale-locale' | 'cross-locale-merge' | 'identity-mismatch' | 'unknown-locale' };

export function localeProfileVersion(binding: LocaleProfileBinding): string {
  return `alp-${localeDigest({
    locale: binding.locale,
    mode: binding.mode,
    languageComponentDigest: binding.languageComponentDigest,
    authorityCatalogVersion: binding.authorityCatalogVersion,
  })}`;
}

export function localeDisplayCacheKey(
  profileVersion: string,
  surface: string,
  identity: string,
): string {
  return `${profileVersion}:${surface}:${identity}`;
}

export function historicalZhCnLocaleBinding(authorityCatalogVersion: string): LocaleProfileBinding {
  return {
    locale: 'zh-CN',
    mode: 'historical',
    languageComponentDigest: null,
    authorityCatalogVersion,
  };
}

export function mergeLocaleDisplayCache(
  current: ReadonlyMap<string, LocaleDisplayRecord>,
  incoming: readonly LocaleDisplayRecord[],
  selected: { locale: AdmittedLocale; profileVersion: string },
): LocaleCacheMergeResult {
  const next = new Map(current);
  for (const record of incoming) {
    if (record.locale !== selected.locale) {
      return { status: 'reject', reason: 'cross-locale-merge' };
    }
    if (record.profileVersion !== selected.profileVersion) {
      return { status: 'reject', reason: 'stale-locale' };
    }
    const existing = next.get(record.canonicalId);
    if (existing && existing.canonicalId !== record.canonicalId) {
      return { status: 'reject', reason: 'identity-mismatch' };
    }
    next.set(record.canonicalId, record);
  }
  return { status: 'accept', display: next };
}

export function displayRecordsForLocale(
  cache: ReadonlyMap<string, LocaleDisplayRecord>,
  locale: AdmittedLocale,
  profileVersion: string,
): LocaleDisplayRecord[] {
  return [...cache.values()].filter((row) => row.locale === locale && row.profileVersion === profileVersion);
}

export function topologyIdentityKey(object: TopologyObjectIdentity): string {
  return object.canonicalId;
}
