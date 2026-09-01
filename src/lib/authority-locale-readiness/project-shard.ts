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

function mapObject(
  object: AuthorityShardObject,
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
): AuthorityShardObject {  const name = firstLocaleValue(manifest, receipt, locale, 'object-names', [object.id]);
  const explanation = firstLocaleValue(
    manifest,
    receipt,
    locale,
    'object-explanations',
    explanationRecordIds(object.id),
  );
  const aliases = firstLocaleValue(
    manifest,
    receipt,
    locale,
    'approved-aliases',
    aliasRecordIds(object.id),
  );
  const typeLabel = firstLocaleValue(
    manifest,
    receipt,
    locale,
    'types',
    typeRecordIds(object.canonicalType),
  );
  return {
    ...object,
    label: name ?? object.label,
    description: explanation ?? object.description,
    aliases: aliases ? Object.freeze([aliases]) : object.aliases,
    typeLabel: typeLabel ?? object.typeLabel ?? null,
  };
}

function mapBoundary(
  boundary: AuthorityShardBoundaryRef,
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
): AuthorityShardBoundaryRef {
  const name = firstLocaleValue(manifest, receipt, locale, 'object-names', [boundary.canonicalId]);
  const aliases = firstLocaleValue(
    manifest,
    receipt,
    locale,
    'approved-aliases',
    aliasRecordIds(boundary.canonicalId),
  );
  const typeLabel = firstLocaleValue(
    manifest,
    receipt,
    locale,
    'types',
    typeRecordIds(boundary.canonicalType),
  );
  return {
    ...boundary,
    label: name ?? boundary.label,
    aliases: aliases ? Object.freeze([aliases]) : boundary.aliases,
    typeLabel: typeLabel ?? boundary.typeLabel ?? null,
  };
}

function mapRelation(
  relation: AuthorityShardRelation,
  manifest: AuthorityLocaleManifest,
  receipt: LocaleQualificationReceipt,
  locale: AdmittedLocale,
): AuthorityShardRelation {
  const predicateLabel = firstLocaleValue(
    manifest,
    receipt,
    locale,
    'relations',
    relationRecordIds(relation.predicate),
  );
  const directionLabel = firstLocaleValue(
    manifest,
    receipt,
    locale,
    'directions',
    directionRecordIds(relation.direction),
  );
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
    const name = firstLocaleValue(manifest, receipt, locale, 'object-names', [hit.id]);
    const alias = firstLocaleValue(manifest, receipt, locale, 'approved-aliases', aliasRecordIds(hit.id));
    const typeLabel = firstLocaleValue(manifest, receipt, locale, 'types', typeRecordIds(hit.canonicalType));
    return {
      ...hit,
      label: name ?? hit.label,
      aliases: alias ? Object.freeze([alias]) : hit.aliases,
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
          const name = firstLocaleValue(manifest, receipt, locale, 'domains', [
            domain.visualRole,
            `domain:${domain.visualRole}`,
          ]);
          return {
            ...domain,
            displayName: name ?? domain.displayName,
          };
        }),
      },
    } as unknown as T;
  }
  if (shard.shardClass === 'domain-default') {
    const next = shard as AuthorityDomainDefaultShard;
    return {
      ...next,
      objects: next.objects.map((object) => mapObject(object, manifest, receipt, locale)),
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
  const name = firstLocaleValue(manifest, receipt, locale, 'object-names', [detail.node.id]);
  const explanation = firstLocaleValue(
    manifest,
    receipt,
    locale,
    'object-explanations',
    explanationRecordIds(detail.node.id),
  );
  const aliases = firstLocaleValue(
    manifest,
    receipt,
    locale,
    'approved-aliases',
    aliasRecordIds(detail.node.id),
  );
  const typeLabel = firstLocaleValue(
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
      label: name ?? detail.node.label,
      description: explanation ?? detail.node.description,
      aliases: aliases ? Object.freeze([aliases]) : detail.node.aliases,
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
