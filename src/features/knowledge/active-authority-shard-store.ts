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
  publicTeachingIdentityMatches,
} from '@/lib/authority-domain-shards/envelope';

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
  rejectedShardKeys: string[];
  teachingCoverageByDomain: Record<string, PublicAuthorityDomainDefaultShard['teachingCoverage']>;
  root: PublicAuthorityRootShard['root'] | null;
  detailsByCanonicalId: Record<string, PublicAuthorityNodeDetailShard['node']>;
  /** Reviewed cross-domain cues from loaded family and neighborhood shards. */
  boundaryRefsByCanonicalId: Record<string, AuthorityShardBoundaryRef>;
  /** Monotonic domain epoch used to reject responses started before reset. */
  domainRevision: number;
}

export type IncomingAuthorityShard =
  | PublicAuthorityRootShard
  | PublicAuthorityDomainDefaultShard
  | PublicAuthorityRelationFamilyShard
  | PublicAuthorityNodeNeighborhoodShard
  | PublicAuthorityNodeDetailShard;

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
    rejectedShardKeys: [],
    teachingCoverageByDomain: {},
    root: null,
    detailsByCanonicalId: {},
    boundaryRefsByCanonicalId: {},
    domainRevision: 0,
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

export function shardIdentityDrift(
  current: AuthorityShardWorkspaceState,
  shard: IncomingAuthorityShard,
): 'authority-catalog' | 'teaching' | null {
  if (!current.envelope) return null;
  if (!publicEnvelopesShareAuthorityAndCatalog(current.envelope, shard.envelope)) {
    return 'authority-catalog';
  }
  if (isTeachingBearingShard(shard) && !publicTeachingIdentityMatches(current.envelope, shard.envelope)) {
    return 'teaching';
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
): AuthorityShardObject {
  if (!current) return incoming;
  const memberships = [...current.memberships];
  for (const membership of incoming.memberships) {
    if (!memberships.some((item) => item.domainId === membership.domainId)) {
      memberships.push(membership);
    }
  }
  return {
    ...current,
    memberships,
  };
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

  const envelope = decision === 'establish' ? shard.envelope : current.envelope;
  if (!envelope) return current;

  const objectsByCanonicalId = { ...current.objectsByCanonicalId };
  const relationsByLayerKey = { ...current.relationsByLayerKey };
  const teachingCoverageByDomain = { ...current.teachingCoverageByDomain };
  const detailsByCanonicalId = { ...current.detailsByCanonicalId };
  const boundaryRefsByCanonicalId = { ...current.boundaryRefsByCanonicalId };
  const loadedShardKeys = current.loadedShardKeys.includes(key)
    ? current.loadedShardKeys
    : [...current.loadedShardKeys, key];

  if (shard.shardClass === 'root') {
    return {
      ...current,
      envelope,
      root: shard.root,
      loadedShardKeys,
    };
  }

  if (shard.shardClass === 'domain-default') {
    for (const object of shard.objects) {
      objectsByCanonicalId[object.id] = mergeObject(objectsByCanonicalId[object.id], object);
    }
    for (const relation of shard.teachingRelations) {
      relationsByLayerKey[relationCacheKey(relation)] = relation;
    }
    teachingCoverageByDomain[shard.domainId] = shard.teachingCoverage;
    return {
      ...current,
      envelope,
      objectsByCanonicalId,
      relationsByLayerKey,
      teachingCoverageByDomain,
      activeDomainId: current.activeDomainId ?? shard.domainId,
      activeVisualRole: current.activeVisualRole ?? shard.visualRole,
      loadedShardKeys,
      selectedCanonicalId: current.selectedCanonicalId,
      inspectorOpen: current.inspectorOpen,
      positionsByCanonicalId: current.positionsByCanonicalId,
    };
  }

  if (shard.shardClass === 'relation-family' || shard.shardClass === 'node-neighborhood') {
    for (const object of shard.objects) {
      objectsByCanonicalId[object.id] = mergeObject(objectsByCanonicalId[object.id], object);
    }
    for (const relation of shard.relations) {
      relationsByLayerKey[relationCacheKey(relation)] = relation;
    }
    for (const boundary of shard.boundaries) {
      boundaryRefsByCanonicalId[boundary.canonicalId] = boundary;
    }
    return {
      ...current,
      envelope,
      objectsByCanonicalId,
      relationsByLayerKey,
      boundaryRefsByCanonicalId,
      loadedShardKeys,
      selectedCanonicalId: current.selectedCanonicalId,
      inspectorOpen: current.inspectorOpen,
      positionsByCanonicalId: current.positionsByCanonicalId,
    };
  }

  detailsByCanonicalId[shard.node.id] = shard.node;
  return {
    ...current,
    envelope,
    detailsByCanonicalId,
    loadedShardKeys,
    selectedCanonicalId: current.selectedCanonicalId,
    inspectorOpen: current.inspectorOpen,
    positionsByCanonicalId: current.positionsByCanonicalId,
  };
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
    loadedShardKeys: current.loadedShardKeys.filter((key) => key === 'root'),
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
    rejectedShardKeys: [],
    detailsByCanonicalId: {},
    selectedCanonicalId: current.selectedCanonicalId,
    inspectorOpen: current.inspectorOpen,
    positionsByCanonicalId: current.positionsByCanonicalId,
  };
}
