import type {
  AuthorityDomainDefaultShard,
  AuthorityDomainSearchHit,
  AuthorityLearnerShard,
  AuthorityNodeDetailShard,
  AuthorityNodeNeighborhoodShard,
  AuthorityRelationFamilyShard,
  AuthorityRootShard,
  AuthorityShardBoundaryRef,
  AuthorityShardObject,
  AuthorityShardRelation,
} from '@/lib/authority-domain-shards/contracts';

import type { AdmittedLocale, AuthorityLocaleManifest } from './contracts';
import type { LocaleProfileBinding } from './cache';
import type { PublicLocaleCapability } from './contracts';
import { resolveCompleteLocaleValue } from './resolver';
import { graphInterfaceText, type GraphInterfaceKey } from './graph-interface-catalog';
import type { LocaleQualificationReceipt, MandatoryLocaleCategory } from './contracts';

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

function firstLocaleValue(
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
  category: MandatoryLocaleCategory,
  recordIds: readonly string[],
): string | null {
  for (const recordId of recordIds) {
    if (!recordId) continue;
    const resolved = resolveCompleteLocaleValue(manifest, receipt, locale, category, recordId);
    if (resolved.status === 'available' && resolved.value) return resolved.value;
  }
  return null;
}

/**
 * Request-path record index (#1741): the sealed manifest carries ~10k records
 * and the linear scan in `resolveCompleteLocaleValue` is reserved for
 * qualification; shard projection resolves through this per-manifest index.
 * Duplicate (category, recordId, locale) keys stay ambiguous → unavailable,
 * matching the resolver's exactly-one contract.
 */
const recordIndexByManifest = new WeakMap<AuthorityLocaleManifest, Map<string, string | null>>();
const AMBIGUOUS_RECORD = null;

function recordIndexFor(manifest: AuthorityLocaleManifest): Map<string, string | null> {
  const cached = recordIndexByManifest.get(manifest);
  if (cached) return cached;
  const index = new Map<string, string | null>();
  for (const record of manifest.records) {
    if (record.source !== 'release-language-component') continue;
    const key = `${record.category}:${record.recordId}:${record.locale}`;
    if (index.has(key)) index.set(key, AMBIGUOUS_RECORD);
    else index.set(key, record.value);
  }
  recordIndexByManifest.set(manifest, index);
  return index;
}

function indexedLocaleValue(
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
  category: MandatoryLocaleCategory,
  recordIds: readonly string[],
): string | null {
  if (receipt.status !== 'ready' || receipt.locale !== locale) return null;
  const index = recordIndexFor(manifest);
  for (const recordId of recordIds) {
    if (!recordId) continue;
    const value = index.get(`${category}:${recordId}:${locale}`);
    if (value) return value;
  }
  return null;
}

/** Locale-projected object label used for search matching (#1741). */
export function localeProjectedObjectLabel(
  objectId: string,
  locale: AdmittedLocale,
  manifest: AuthorityLocaleManifest | null,
): string | null {
  if (!manifest) return null;
  return recordIndexFor(manifest).get(`object-names:${objectId}:${locale}`) ?? null;
}

function typeRecordIds(canonicalType: string): string[] {
  return [`type:${canonicalType}`, canonicalType];
}

function relationRecordIds(predicate: string): string[] {
  return [`relation:${predicate}`, predicate];
}

function directionRecordIds(direction: string | null): string[] {
  if (!direction) return [];
  return [`direction:${direction}`, direction];
}

function explanationRecordIds(objectId: string): string[] {
  const stripped = objectId.replace(/^object:/u, '');
  return [objectId, `explain:${objectId}`, `explain:${stripped}`];
}

function aliasRecordIds(objectId: string): string[] {
  const stripped = objectId.replace(/^object:/u, '');
  return [objectId, `alias:${objectId}`, `alias:${stripped}`];
}

function sourceRecordIds(source: { sourceEditionId: string; sectionId: string }): string[] {
  const joined = `${source.sourceEditionId}::${source.sectionId}`;
  return [
    `source:${joined}`,
    joined,
    `source:${source.sourceEditionId}`,
    source.sourceEditionId,
  ];
}

/**
 * Uncovered presentation dispositions (#1741): objects without an approved
 * upstream bilingual row keep their zh frame untouched; the en frame fails
 * closed — the name becomes the product-hidden marker (filtered from the
 * model) and the description drops to null instead of leaking Chinese.
 */
function uncoveredNameLabel(locale: AdmittedLocale, fallback: string): string {
  return locale === 'en' ? '名称暂不可用' : fallback;
}

function uncoveredDescription(locale: AdmittedLocale, fallback: string | null): string | null {
  return locale === 'en' ? null : fallback;
}

function uncoveredAliases(locale: AdmittedLocale, fallback: readonly string[]): readonly string[] {
  return locale === 'en' ? Object.freeze([]) : fallback;
}

function mapObject(
  object: AuthorityShardObject,
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
): AuthorityShardObject {  const name = indexedLocaleValue(manifest, receipt, locale, 'object-names', [object.id]);
  const explanation = indexedLocaleValue(
    manifest,
    receipt,
    locale,
    'object-explanations',
    explanationRecordIds(object.id),
  );
  const aliases = indexedLocaleValue(
    manifest,
    receipt,
    locale,
    'approved-aliases',
    aliasRecordIds(object.id),
  );
  const typeLabel = indexedLocaleValue(
    manifest,
    receipt,
    locale,
    'types',
    typeRecordIds(object.canonicalType),
  );
  return {
    ...object,
    label: name ?? uncoveredNameLabel(locale, object.label),
    description: locale === 'en' && !name ? null : explanation ?? uncoveredDescription(locale, object.description),
    aliases: aliases ? Object.freeze([aliases]) : uncoveredAliases(locale, object.aliases ?? []),
    typeLabel: typeLabel ?? object.typeLabel ?? null,
  };
}

function mapBoundary(
  boundary: AuthorityShardBoundaryRef,
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
): AuthorityShardBoundaryRef {
  const name = indexedLocaleValue(manifest, receipt, locale, 'object-names', [boundary.canonicalId]);
  const aliases = indexedLocaleValue(
    manifest,
    receipt,
    locale,
    'approved-aliases',
    aliasRecordIds(boundary.canonicalId),
  );
  const typeLabel = indexedLocaleValue(
    manifest,
    receipt,
    locale,
    'types',
    typeRecordIds(boundary.canonicalType),
  );
  return {
    ...boundary,
    label: name ?? uncoveredNameLabel(locale, boundary.label),
    aliases: aliases ? Object.freeze([aliases]) : uncoveredAliases(locale, boundary.aliases ?? []),
    typeLabel: typeLabel ?? boundary.typeLabel ?? null,
  };
}

/** Interface-catalog lookup that degrades to null instead of throwing. */
function interfaceCatalogText(key: string, locale: AdmittedLocale): string | null {
  try {
    return graphInterfaceText(key as GraphInterfaceKey, locale);
  } catch {
    return null;
  }
}

function mapRelation(
  relation: AuthorityShardRelation,
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
): AuthorityShardRelation {
  // 工程谓词来自 release 语言组件；教学谓词与方向枚举是 ACT 呈现层
  // 词汇，从 interface catalog 取（#1741）。
  const manifestPredicateLabel = relation.layer === 'ENGINEERING'
    ? indexedLocaleValue(manifest, receipt, locale, 'relations', relationRecordIds(relation.predicate))
    : null;
  const teachingPredicateLabel = relation.layer === 'ACT_TEACHING'
    ? interfaceCatalogText(`teachingRelation.${relation.predicate}`, locale)
    : null;
  const predicateLabel = manifestPredicateLabel ?? teachingPredicateLabel;
  const directionLabel = relation.direction
    ? interfaceCatalogText(`relationDirection.${relation.direction}`, locale)
    : null;
  return {
    ...relation,
    predicateLabel: predicateLabel ?? relation.predicateLabel ?? null,
    directionLabel: directionLabel ?? relation.directionLabel ?? null,
  };
}

/**
 * Locale-project bounded search hits with the same complete-locale records
 * used by learner shards; identity, type and memberships stay untouched.
 */
export function applyLocaleToSearchHits(
  hits: readonly AuthorityDomainSearchHit[],
  locale: AdmittedLocale,
  manifest: AuthorityLocaleManifest | null,
  receipt: LocaleQualificationReceipt | null,
): AuthorityDomainSearchHit[] {
  if (!manifest || !receipt || receipt.status !== 'ready' || receipt.locale !== locale) {
    return hits.map((hit) => ({ ...hit, typeLabel: hit.typeLabel ?? null }));
  }
  return hits.map((hit) => {
    const name = indexedLocaleValue(manifest, receipt, locale, 'object-names', [hit.id]);
    const alias = indexedLocaleValue(manifest, receipt, locale, 'approved-aliases', aliasRecordIds(hit.id));
    const typeLabel = indexedLocaleValue(manifest, receipt, locale, 'types', typeRecordIds(hit.canonicalType));
    return {
      ...hit,
      label: name ?? uncoveredNameLabel(locale, hit.label),
      aliases: alias ? Object.freeze([alias]) : uncoveredAliases(locale, hit.aliases),
      typeLabel: typeLabel ?? hit.typeLabel ?? null,
    };
  });
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
          // 域名是 ACT 呈现层词汇：interface catalog 承载双语（#1741），
          // release 语言组件不携带 domain 记录。
          const name = interfaceCatalogText(`graphDomain.${domain.visualRole}`, locale);
          return {
            ...domain,
            displayName: name ?? domain.displayName,
          };
        }),
        aggregate: {
          ...root.root.aggregate,
          displayName: interfaceCatalogText('graphDomain.aggregate', locale)
            ?? root.root.aggregate.displayName,
        },
      },
    } as unknown as T;
  }
  if (shard.shardClass === 'domain-default') {
    const next = shard as AuthorityDomainDefaultShard;
    return {
      ...next,
      objects: next.objects.map((object) => mapObject(object, manifest, receipt, locale)),
      teachingBoundaryObjects: next.teachingBoundaryObjects?.map((object) => mapObject(object, manifest, receipt, locale)),
      teachingBoundaries: next.teachingBoundaries?.map((boundary) => mapBoundary(boundary, manifest, receipt, locale)),
      teachingRelations: next.teachingRelations.map((relation) => (
        mapRelation(relation, manifest, receipt, locale)
      )),
    } as unknown as T;
  }
  if (shard.shardClass === 'relation-family' || shard.shardClass === 'node-neighborhood') {
    const next = shard as AuthorityRelationFamilyShard | AuthorityNodeNeighborhoodShard;
    return {
      ...next,
      objects: next.objects.map((object) => mapObject(object, manifest, receipt, locale)),
      relations: next.relations.map((relation) => mapRelation(relation, manifest, receipt, locale)),
      boundaries: next.boundaries.map((boundary) => mapBoundary(boundary, manifest, receipt, locale)),
    } as unknown as T;
  }
  const detail = shard as AuthorityNodeDetailShard;
  const name = indexedLocaleValue(manifest, receipt, locale, 'object-names', [detail.node.id]);
  const explanation = indexedLocaleValue(
    manifest,
    receipt,
    locale,
    'object-explanations',
    explanationRecordIds(detail.node.id),
  );
  const aliases = indexedLocaleValue(
    manifest,
    receipt,
    locale,
    'approved-aliases',
    aliasRecordIds(detail.node.id),
  );
  const typeLabel = indexedLocaleValue(
    manifest,
    receipt,
    locale,
    'types',
    typeRecordIds(detail.node.canonicalType),
  );
  return {
    ...detail,
    node: {
      ...detail.node,
      label: name ?? uncoveredNameLabel(locale, detail.node.label),
      description: locale === 'en' && !name ? null : explanation ?? uncoveredDescription(locale, detail.node.description),
      aliases: aliases ? Object.freeze([aliases]) : uncoveredAliases(locale, detail.node.aliases ?? []),
      typeLabel: typeLabel ?? detail.node.typeLabel ?? null,
      sources: detail.node.sources.map((source) => ({
        ...source,
        label: firstLocaleValue(
          manifest,
          receipt,
          locale,
          'readable-sources',
          sourceRecordIds(source),
        ) ?? source.label ?? null,
      })),
    },
  } as unknown as T;
}
