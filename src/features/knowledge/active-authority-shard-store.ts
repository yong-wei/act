/**
 * Browser-safe Authority shard cache and merge (Issue 1375).
 *
 * Identity comes from the established root envelope. Canonical objects are
 * stored once; relations are keyed by layer + id. Shard arrival must not
 * remount existing nodes or reset selection, inspector or positions.
 */

import type {
  PublicAuthorityDomainDefaultShard,
  PublicAuthorityNodeDetailShard,
  PublicAuthorityNodeNeighborhoodShard,
  PublicAuthorityRelationFamilyShard,
  PublicAuthorityRootShard,
  AuthorityShardPublicEnvelope,
  AuthorityShardBoundaryRef,
  AuthorityShardObject,
  AuthorityShardRelation,
  EngineeringRelationFamily,
} from '@/lib/authority-domain-shards/contracts';
import { relationCacheKey } from '@/lib/authority-domain-shards/contracts';
import {
  publicEnvelopesShareAuthorityAndCatalog,
  publicEnvelopesShareLocaleProfile,
  publicTeachingIdentityMatches,
} from '@/lib/authority-domain-shards/envelope';
import type { AdmittedLocale, PublicLocaleCapability } from '@/lib/authority-locale-readiness/contracts';
import { historicalLocaleCapability } from '@/lib/authority-locale-readiness/presentation-state';
import type { KnowledgeSurfaceLatestCutover } from '@/lib/knowledge-surface';

export type AuthorityShardKind =
  | 'root'
  | 'domain-default'
  | 'relation-family'
  | 'node-neighborhood'
  | 'node-detail';

export interface AuthorityShardPosition {
  x: number;
  y: number;
}

export interface AuthorityShardWorkspaceState {
  envelope: AuthorityShardPublicEnvelope | null;
  objectsByCanonicalId: Record<string, AuthorityShardObject>;
  relationsByLayerKey: Record<string, AuthorityShardRelation>;
  positionsByCanonicalId: Record<string, AuthorityShardPosition>;
  selectedCanonicalId: string | null;
  inspectorOpen: boolean;
  activeDomainId: string | null;
  activeVisualRole: string | null;
  enabledFamilies: EngineeringRelationFamily[];
  loadedShardKeys: string[];
  loadedDisplayKeys: string[];
  rejectedShardKeys: string[];
  selectedLocale: AdmittedLocale;
  localeCapability: PublicLocaleCapability;
  teachingCoverageByDomain: Record<string, PublicAuthorityDomainDefaultShard['teachingCoverage']>;
  /**
   * Server-bounded level-two overview: the exact object ids of the active
   * domain-default shard, in server order (#1738).
   */
  domainOverviewIds: string[];
  /**
   * Object ids introduced by enabled relation-family shards. Neighborhood
   * disclosure evicts the previous neighborhood while keeping the overview
   * and these domain-scoped family members (#1738 连续导航不形成无界缓存).
   */
  familyObjectKeys: string[];
  root: PublicAuthorityRootShard['root'] | null;
  detailsByCanonicalId: Record<string, PublicAuthorityNodeDetailShard['node']>;
  /** Reviewed cross-domain cues from loaded family and neighborhood shards. */
  boundaryRefsByCanonicalId: Record<string, AuthorityShardBoundaryRef>;
  /** Monotonic domain epoch used to reject responses started before reset. */
  domainRevision: number;
  /**
   * True after a root shard commits a new locale profile while object
   * display caches still hold the previous locale. The next object-bearing
   * shard may replace labels.
   */
  localeRefreshPending: boolean;
  latestCutover: KnowledgeSurfaceLatestCutover | null;
}

export type IncomingAuthorityShard = (
  | PublicAuthorityRootShard
  | PublicAuthorityDomainDefaultShard
  | PublicAuthorityRelationFamilyShard
  | PublicAuthorityNodeNeighborhoodShard
  | PublicAuthorityNodeDetailShard
) & {
  knowledgeSurface?: {
    latestCutover: KnowledgeSurfaceLatestCutover;
  };
};

export function createEmptyAuthorityShardWorkspace(): AuthorityShardWorkspaceState {
  return {
    envelope: null,
    objectsByCanonicalId: {},
    relationsByLayerKey: {},
    positionsByCanonicalId: {},
    selectedCanonicalId: null,
    inspectorOpen: false,
    activeDomainId: null,
    activeVisualRole: null,
    enabledFamilies: [],
    loadedShardKeys: [],
    loadedDisplayKeys: [],
    rejectedShardKeys: [],
    selectedLocale: 'zh-CN',
    localeCapability: historicalLocaleCapability(),
    teachingCoverageByDomain: {},
    domainOverviewIds: [],
    familyObjectKeys: [],
    root: null,
    detailsByCanonicalId: {},
    boundaryRefsByCanonicalId: {},
    domainRevision: 0,
    localeRefreshPending: false,
    latestCutover: null,
  };
}

export function shardRequestKey(shard: IncomingAuthorityShard): string {
  switch (shard.shardClass) {
    case 'root':
      return 'root';
    case 'domain-default':
      return `domain-default:${shard.domainId}`;
    case 'relation-family':
      return `relation-family:${shard.domainId}:${shard.family}`;
    case 'node-neighborhood':
      return `node-neighborhood:${shard.nodeId}`;
    case 'node-detail':
      return `node-detail:${shard.node.id}`;
    default: {
      const _never: never = shard;
      return _never;
    }
  }
}

export function isTeachingBearingShard(shard: IncomingAuthorityShard): boolean {
  // Every shard carries the composite envelope.  A Teaching version can
  // advance while an engineering family, neighborhood, or detail request is
  // in flight, so those responses must participate in Teaching identity
  // validation as well; limiting this to domain-default permits mixed
  // generations to reach the cache.
  return true;
}

export function shardDisplayKey(shard: IncomingAuthorityShard): string {
  return `${shard.envelope.localeProfileVersion}:${shardRequestKey(shard)}`;
}

export function shardIdentityDrift(
  current: AuthorityShardWorkspaceState,
  shard: IncomingAuthorityShard,
): 'authority-catalog' | 'teaching' | 'locale' | null {
  if (!current.envelope) return null;
  if (!publicEnvelopesShareAuthorityAndCatalog(current.envelope, shard.envelope)) {
    return 'authority-catalog';
  }
  if (isTeachingBearingShard(shard) && !publicTeachingIdentityMatches(current.envelope, shard.envelope)) {
    return 'teaching';
  }
  if (!publicEnvelopesShareLocaleProfile(current.envelope, shard.envelope)) {
    return 'locale';
  }
  return null;
}

export function validateIncomingShard(
  current: AuthorityShardWorkspaceState,
  shard: IncomingAuthorityShard,
): 'accept' | 'reject' | 'establish' {
  if (!current.envelope) {
    return shard.shardClass === 'root' ? 'establish' : 'reject';
  }
  if (!publicEnvelopesShareAuthorityAndCatalog(current.envelope, shard.envelope)) {
    return 'reject';
  }
  if (isTeachingBearingShard(shard) && !publicTeachingIdentityMatches(current.envelope, shard.envelope)) {
    return 'reject';
  }
  const localeChanged = !publicEnvelopesShareLocaleProfile(current.envelope, shard.envelope)
    || current.localeRefreshPending;
  const incomingObjects = shard.shardClass === 'domain-default'
    || shard.shardClass === 'relation-family'
    || shard.shardClass === 'node-neighborhood'
    ? shard.objects
    : shard.shardClass === 'node-detail'
      ? [shard.node]
      : [];
  const incomingBoundaries = shard.shardClass === 'relation-family' || shard.shardClass === 'node-neighborhood'
    ? shard.boundaries
    : [];
  const seen = new Map<string, { label: string; aliases: readonly string[] }>();
  const checkPresentation = (id: string, label: string, aliases: readonly string[]): boolean => {
    const prior = seen.get(id);
    if (prior && (prior.label !== label || !sameStringArray(prior.aliases, aliases))) return false;
    seen.set(id, { label, aliases });
    const existing = current.objectsByCanonicalId[id]
      ?? current.detailsByCanonicalId[id]
      ?? current.boundaryRefsByCanonicalId[id];
    if (localeChanged) return true;
    return !existing || (existing.label === label && sameStringArray(existing.aliases ?? [], aliases));
  };
  for (const object of incomingObjects) {
    if (!checkPresentation(object.id, object.label, object.aliases ?? [])) return 'reject';
  }
  for (const boundary of incomingBoundaries) {
    if (!checkPresentation(boundary.canonicalId, boundary.label, boundary.aliases ?? [])) return 'reject';
  }
  if (
    current.activeDomainId
    && (shard.shardClass === 'domain-default' || shard.shardClass === 'relation-family')
    && shard.domainId !== current.activeDomainId
  ) {
    return 'reject';
  }
  return 'accept';
}

function mergeObject(
  current: AuthorityShardObject | undefined,
  incoming: AuthorityShardObject,
  replaceDisplay = false,
): AuthorityShardObject {
  if (!current) return incoming;
  const memberships = [...current.memberships];
  for (const membership of incoming.memberships) {
    if (!memberships.some((item) => item.domainId === membership.domainId)) {
      memberships.push(membership);
    }
  }
  if (replaceDisplay) {
    // Locale refresh replaces the whole display projection including governed
    // math fields — dropping them here would strip formula/rich-text labels
    // after a language switch (#1740).
    return {
      ...current,
      label: incoming.label,
      aliases: incoming.aliases ?? [],
      description: incoming.description,
      typeLabel: incoming.typeLabel ?? null,
      richTitle: incoming.richTitle,
      richDescription: incoming.richDescription,
      searchText: incoming.searchText,
      accessibleName: incoming.accessibleName,
      mathematics: incoming.mathematics,
      memberships,
    };
  }
  return {
    ...current,
    aliases: current.aliases ?? [],
    memberships,
  };
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function mergeAuthorityShard(
  current: AuthorityShardWorkspaceState,
  shard: IncomingAuthorityShard,
): AuthorityShardWorkspaceState {
  const decision = validateIncomingShard(current, shard);
  const key = shardRequestKey(shard);
  if (decision === 'reject') {
    if (current.rejectedShardKeys.includes(key)) return current;
    return {
      ...current,
      rejectedShardKeys: [...current.rejectedShardKeys, key],
    };
  }

  const localeChanged = Boolean(
    current.envelope && (
      !publicEnvelopesShareLocaleProfile(current.envelope, shard.envelope)
      || current.localeRefreshPending
    ),
  );
  const latestCutover = shard.knowledgeSurface?.latestCutover ?? current.latestCutover;
  const envelope = decision === 'establish' || localeChanged ? shard.envelope : current.envelope;
  if (!envelope) return current;

  const objectsByCanonicalId = { ...current.objectsByCanonicalId };
  const relationsByLayerKey = { ...current.relationsByLayerKey };
  const teachingCoverageByDomain = { ...current.teachingCoverageByDomain };
  const detailsByCanonicalId = { ...current.detailsByCanonicalId };
  const boundaryRefsByCanonicalId = { ...current.boundaryRefsByCanonicalId };
  const loadedShardKeys = current.loadedShardKeys.includes(key)
    ? current.loadedShardKeys
    : [...current.loadedShardKeys, key];
  const displayKey = shardDisplayKey(shard);
  const loadedDisplayKeys = current.loadedDisplayKeys.includes(displayKey)
    ? current.loadedDisplayKeys
    : [...current.loadedDisplayKeys, displayKey];

  if (shard.shardClass === 'root') {
    const capability = 'localeCapability' in shard
      ? (shard as IncomingAuthorityShard & { localeCapability?: PublicLocaleCapability }).localeCapability
      : current.localeCapability;
    return {
      ...current,
      envelope,
      root: shard.root,
      loadedShardKeys,
      loadedDisplayKeys,
      localeCapability: capability ?? current.localeCapability,
      localeRefreshPending: localeChanged || current.localeRefreshPending,
      latestCutover,
    };
  }

  if (shard.shardClass === 'domain-default') {
    // Level two is server-owned: entering a domain bounds browser memory to
    // that domain's members. Objects and details from other domains are
    // unreachable from this level and must not accumulate across navigation.
    const memberOfDomain = (object: AuthorityShardObject): boolean => (
      object.memberships.some((membership) => membership.domainId === shard.domainId)
    );
    const boundedObjects = Object.fromEntries(
      Object.entries(objectsByCanonicalId).filter(([, object]) => memberOfDomain(object)),
    );
    for (const object of shard.objects) {
      boundedObjects[object.id] = mergeObject(
        boundedObjects[object.id],
        object,
        localeChanged,
      );
    }
    const boundedDetails = Object.fromEntries(
      Object.entries(detailsByCanonicalId).filter(([id]) => Boolean(boundedObjects[id])),
    );
    for (const relation of shard.teachingRelations) {
      relationsByLayerKey[relationCacheKey(relation)] = relation;
    }
    teachingCoverageByDomain[shard.domainId] = shard.teachingCoverage;
    return {
      ...current,
      envelope,
      objectsByCanonicalId: boundedObjects,
      relationsByLayerKey,
      teachingCoverageByDomain,
      detailsByCanonicalId: boundedDetails,
      domainOverviewIds: shard.objects.map((object) => object.id),
      familyObjectKeys: [],
      activeDomainId: current.activeDomainId ?? shard.domainId,
      activeVisualRole: current.activeVisualRole ?? shard.visualRole,
      loadedShardKeys,
      loadedDisplayKeys,
      selectedCanonicalId: current.selectedCanonicalId,
      inspectorOpen: current.inspectorOpen,
      positionsByCanonicalId: current.positionsByCanonicalId,
      localeRefreshPending: current.localeRefreshPending || localeChanged,
      latestCutover,
    };
  }

  if (shard.shardClass === 'relation-family') {
    for (const object of shard.objects) {
      objectsByCanonicalId[object.id] = mergeObject(
        objectsByCanonicalId[object.id],
        object,
        localeChanged,
      );
    }
    for (const relation of shard.relations) {
      relationsByLayerKey[relationCacheKey(relation)] = relation;
    }
    for (const boundary of shard.boundaries) {
      boundaryRefsByCanonicalId[boundary.canonicalId] = boundary;
    }
    const familyObjectKeys = [
      ...new Set([...current.familyObjectKeys, ...shard.objects.map((object) => object.id)]),
    ];
    return {
      ...current,
      envelope,
      objectsByCanonicalId,
      relationsByLayerKey,
      boundaryRefsByCanonicalId,
      familyObjectKeys,
      loadedShardKeys,
      loadedDisplayKeys,
      selectedCanonicalId: current.selectedCanonicalId,
      inspectorOpen: current.inspectorOpen,
      positionsByCanonicalId: current.positionsByCanonicalId,
      localeRefreshPending: current.localeRefreshPending || localeChanged,
      latestCutover,
    };
  }

  if (shard.shardClass === 'node-neighborhood') {
    // 连续披露不形成无界缓存：保留域概览、已启用关系族成员和本邻域，
    // 淘汰上一个邻域引入的对象/详情/边界/关系及其加载键（#1738）。
    const retainedIds = new Set<string>([
      ...current.domainOverviewIds,
      ...current.familyObjectKeys,
      ...shard.objects.map((object) => object.id),
      ...shard.boundaries.map((boundary) => boundary.canonicalId),
    ]);
    for (const object of shard.objects) {
      objectsByCanonicalId[object.id] = mergeObject(
        objectsByCanonicalId[object.id],
        object,
        localeChanged,
      );
    }
    for (const relation of shard.relations) {
      relationsByLayerKey[relationCacheKey(relation)] = relation;
    }
    for (const boundary of shard.boundaries) {
      boundaryRefsByCanonicalId[boundary.canonicalId] = boundary;
    }
    const boundedObjects = Object.fromEntries(
      Object.entries(objectsByCanonicalId).filter(([id]) => retainedIds.has(id)),
    );
    const boundedRelations = Object.fromEntries(
      Object.entries(relationsByLayerKey).filter(([, relation]) => (
        retainedIds.has(relation.sourceId) && retainedIds.has(relation.targetId)
      )),
    );
    const boundedBoundaries = Object.fromEntries(
      Object.entries(boundaryRefsByCanonicalId).filter(([canonicalId]) => retainedIds.has(canonicalId)),
    );
    const boundedDetails = Object.fromEntries(
      Object.entries(detailsByCanonicalId).filter(([id]) => retainedIds.has(id)),
    );
    // 邻域键只保留当前分片中心：B 的一跳通常仍含 A，若按对象集保留
    // node-neighborhood:A，返回 A 时 loadedDisplayKeys 会跳过重载，
    // 画布停留在 B 的闭包（A→B→A 回归）。
    const currentNeighborhoodKey = `node-neighborhood:${shard.nodeId}`;
    const boundedLoadedKeys = loadedShardKeys.filter((loadedKey) => {
      if (loadedKey.startsWith('node-neighborhood:')) {
        return loadedKey === currentNeighborhoodKey;
      }
      if (loadedKey.startsWith('node-detail:')) {
        return retainedIds.has(loadedKey.slice('node-detail:'.length));
      }
      return true;
    });
    const boundedLoadedDisplayKeys = loadedDisplayKeys.filter((displayKey) => (
      boundedLoadedKeys.some((topologyKey) => displayKey.endsWith(`:${topologyKey}`))
    ));
    return {
      ...current,
      envelope,
      objectsByCanonicalId: boundedObjects,
      relationsByLayerKey: boundedRelations,
      boundaryRefsByCanonicalId: boundedBoundaries,
      detailsByCanonicalId: boundedDetails,
      loadedShardKeys: boundedLoadedKeys,
      loadedDisplayKeys: boundedLoadedDisplayKeys,
      selectedCanonicalId: current.selectedCanonicalId,
      inspectorOpen: current.inspectorOpen,
      positionsByCanonicalId: current.positionsByCanonicalId,
      localeRefreshPending: current.localeRefreshPending || localeChanged,
      latestCutover,
    };
  }

  detailsByCanonicalId[shard.node.id] = shard.node;
  return {
    ...current,
    envelope,
    detailsByCanonicalId,
    loadedShardKeys,
    loadedDisplayKeys,
    selectedCanonicalId: current.selectedCanonicalId,
    inspectorOpen: current.inspectorOpen,
    positionsByCanonicalId: current.positionsByCanonicalId,
    localeRefreshPending: current.localeRefreshPending || localeChanged,
    latestCutover,
  };
}

export function completeAuthorityLocaleRefresh(
  current: AuthorityShardWorkspaceState,
): AuthorityShardWorkspaceState {
  if (!current.localeRefreshPending) return current;
  return { ...current, localeRefreshPending: false };
}

export function rememberAuthorityShardPositions(
  current: AuthorityShardWorkspaceState,
  positions: Record<string, AuthorityShardPosition>,
): AuthorityShardWorkspaceState {
  const next = { ...current.positionsByCanonicalId };
  for (const [id, point] of Object.entries(positions)) {
    if (!next[id]) next[id] = point;
  }
  return { ...current, positionsByCanonicalId: next };
}

export function selectAuthorityShardObject(
  current: AuthorityShardWorkspaceState,
  canonicalId: string | null,
): AuthorityShardWorkspaceState {
  return {
    ...current,
    selectedCanonicalId: canonicalId,
    inspectorOpen: canonicalId !== null,
  };
}

export function enableAuthorityShardFamily(
  current: AuthorityShardWorkspaceState,
  family: EngineeringRelationFamily,
): AuthorityShardWorkspaceState {
  if (current.enabledFamilies.includes(family)) return current;
  return {
    ...current,
    enabledFamilies: [...current.enabledFamilies, family],
  };
}

export function disableAuthorityShardFamily(
  current: AuthorityShardWorkspaceState,
  family: EngineeringRelationFamily,
): AuthorityShardWorkspaceState {
  if (!current.enabledFamilies.includes(family)) return current;
  return {
    ...current,
    enabledFamilies: current.enabledFamilies.filter((row) => row !== family),
  };
}

export function visibleAuthorityShardRelations(
  current: AuthorityShardWorkspaceState,
): AuthorityShardRelation[] {
  const activeDomainId = current.activeDomainId;
  if (!activeDomainId) return [];
  return Object.values(current.relationsByLayerKey).filter((relation) => {
    const relationIsEnabled = relation.layer === 'ACT_TEACHING'
      || (relation.relationFamily !== null
        && current.enabledFamilies.includes(relation.relationFamily as EngineeringRelationFamily));
    if (!relationIsEnabled) return false;
    const source = current.objectsByCanonicalId[relation.sourceId];
    const target = current.objectsByCanonicalId[relation.targetId];
    return Boolean(
      source?.memberships.some((membership) => membership.domainId === activeDomainId)
      || target?.memberships.some((membership) => membership.domainId === activeDomainId),
    );
  });
}

/**
 * Leave the canonical graph shell intact while dropping every domain-scoped
 * cache.  The caller increments its request epoch so a response started in
 * the previous domain cannot repopulate these caches after the reset.
 */
export function resetAuthorityShardDomain(
  current: AuthorityShardWorkspaceState,
): AuthorityShardWorkspaceState {
  return {
    ...current,
    relationsByLayerKey: {},
    boundaryRefsByCanonicalId: {},
    teachingCoverageByDomain: {},
    domainOverviewIds: [],
    familyObjectKeys: [],
    loadedShardKeys: current.loadedShardKeys.filter((key) => key === 'root'),
    loadedDisplayKeys: current.loadedDisplayKeys.filter((key) => key.endsWith(':root')),
    enabledFamilies: [],
    activeDomainId: null,
    activeVisualRole: null,
    domainRevision: current.domainRevision + 1,
    selectedCanonicalId: current.selectedCanonicalId,
    inspectorOpen: current.inspectorOpen,
    positionsByCanonicalId: current.positionsByCanonicalId,
  };
}

export function invalidateTeachingBearingShards(
  current: AuthorityShardWorkspaceState,
  nextEnvelope: AuthorityShardPublicEnvelope,
): AuthorityShardWorkspaceState {
  if (!current.envelope) {
    return { ...current, envelope: nextEnvelope };
  }
  if (!publicEnvelopesShareAuthorityAndCatalog(current.envelope, nextEnvelope)) {
    return {
      ...createEmptyAuthorityShardWorkspace(),
      envelope: nextEnvelope,
    };
  }
  if (publicTeachingIdentityMatches(current.envelope, nextEnvelope)) {
    return { ...current, envelope: nextEnvelope };
  }
  const teachingKeys = current.loadedShardKeys.filter((key) => (
    key.startsWith('domain-default:') || key.startsWith('node-detail:')
  ));
  const relationsByLayerKey = Object.fromEntries(
    Object.entries(current.relationsByLayerKey).filter(([, relation]) => relation.layer !== 'ACT_TEACHING'),
  );
  return {
    ...current,
    envelope: nextEnvelope,
    relationsByLayerKey,
    teachingCoverageByDomain: {},
    loadedShardKeys: current.loadedShardKeys.filter((key) => !teachingKeys.includes(key)),
    loadedDisplayKeys: current.loadedDisplayKeys.filter((key) => (
      !teachingKeys.some((topologyKey) => key.endsWith(`:${topologyKey}`))
    )),
    rejectedShardKeys: [],
    detailsByCanonicalId: {},
    selectedCanonicalId: current.selectedCanonicalId,
    inspectorOpen: current.inspectorOpen,
    positionsByCanonicalId: current.positionsByCanonicalId,
  };
}
