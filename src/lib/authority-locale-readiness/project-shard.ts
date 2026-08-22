import type {
  AuthorityDomainDefaultShard,
  AuthorityLearnerShard,
  AuthorityNodeDetailShard,
  AuthorityNodeNeighborhoodShard,
  AuthorityRelationFamilyShard,
  AuthorityRootShard,
  AuthorityShardObject,
} from '@/lib/authority-domain-shards/contracts';

import type { AdmittedLocale, AuthorityLocaleManifest } from './contracts';
import type { LocaleProfileBinding } from './cache';
import type { PublicLocaleCapability } from './contracts';
import { resolveCompleteLocaleValue } from './resolver';
import type { LocaleQualificationReceipt } from './contracts';

export function localeBindingForCapability(
  locale: AdmittedLocale,
  capability: PublicLocaleCapability,
  authorityCatalogVersion: string,
): LocaleProfileBinding {
  return {
    locale,
    mode: capability.mode,
    languageComponentDigest: capability.languageComponentDigest,
    authorityCatalogVersion,
  };
}

function mapObject(
  object: AuthorityShardObject,
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
): AuthorityShardObject {
  const name = resolveCompleteLocaleValue(manifest, receipt, locale, 'object-names', object.id);
  const explanation = resolveCompleteLocaleValue(manifest, receipt, locale, 'object-explanations', object.id);
  const aliases = resolveCompleteLocaleValue(manifest, receipt, locale, 'approved-aliases', object.id);
  return {
    ...object,
    label: name.status === 'available' && name.value ? name.value : object.label,
    description: explanation.status === 'available' ? explanation.value : object.description,
    aliases: aliases.status === 'available' && aliases.value
      ? Object.freeze([aliases.value])
      : object.aliases,
  };
}

export function applyLocaleToLearnerShard<T extends AuthorityLearnerShard>(
  shard: T,
  locale: AdmittedLocale,
  manifest: AuthorityLocaleManifest | null,
  receipt: LocaleQualificationReceipt | null,
): T {
  if (!manifest || !receipt || receipt.status !== 'ready' || receipt.locale !== locale) {
    return shard;
  }
  if (shard.shardClass === 'root') {
    const root = shard as AuthorityRootShard;
    return {
      ...root,
      root: {
        ...root.root,
        domains: root.root.domains.map((domain) => {
          const name = resolveCompleteLocaleValue(manifest, receipt, locale, 'domains', domain.visualRole);
          return {
            ...domain,
            displayName: name.status === 'available' && name.value ? name.value : domain.displayName,
          };
        }),
      },
    } as unknown as T;
  }
  if (shard.shardClass === 'domain-default') {
    const next = shard as AuthorityDomainDefaultShard;
    return { ...next, objects: next.objects.map((object) => mapObject(object, manifest, receipt, locale)) } as unknown as T;
  }
  if (shard.shardClass === 'relation-family' || shard.shardClass === 'node-neighborhood') {
    const next = shard as AuthorityRelationFamilyShard | AuthorityNodeNeighborhoodShard;
    return { ...next, objects: next.objects.map((object) => mapObject(object, manifest, receipt, locale)) } as unknown as T;
  }
  const detail = shard as AuthorityNodeDetailShard;
  const name = resolveCompleteLocaleValue(manifest, receipt, locale, 'object-names', detail.node.id);
  const explanation = resolveCompleteLocaleValue(manifest, receipt, locale, 'object-explanations', detail.node.id);
  const aliases = resolveCompleteLocaleValue(manifest, receipt, locale, 'approved-aliases', detail.node.id);
  return {
    ...detail,
    node: {
      ...detail.node,
      label: name.status === 'available' && name.value ? name.value : detail.node.label,
      description: explanation.status === 'available' ? explanation.value : detail.node.description,
      aliases: aliases.status === 'available' && aliases.value
        ? Object.freeze([aliases.value])
        : detail.node.aliases,
    },
  } as unknown as T;
}
