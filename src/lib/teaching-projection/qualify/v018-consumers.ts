/** Real per-consumer shadow reads against the isolated or staged candidate. */



import {
  REGISTERED_PEER_DOMAIN_IDS,
  type AuthorityDomainCatalogRuntime,
} from '@/lib/authority-domain-catalog';
import type {
  AuthorityEngineeringBody,
  AuthoritySnapshotManifest,
} from '@/lib/authoritative-knowledge/authority-snapshot';
import {
  resolveEngineeringGraphAuthority,
  resolveEngineeringRagAuthority,
} from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import {
  applyTeachingResourceRagConsumerActivation,
  runEngineeringRagQuery,
} from '@/lib/canonical-rag/domain-composition';
import type { AuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import {
  ENGINEERING_RELATION_FAMILIES,
  loadDomainDefaultShard,
  loadNodeDetailShard,
  loadNodeNeighborhoodShard,
  loadRelationFamilyShard,
  loadRootShard,
  type AuthorityDomainShardPaths,
  type LoadedAuthorityShardContext,
} from '@/lib/authority-domain-shards';
import {
  createAuthorityLabelResolverContext,
  resolveAuthorityLabel,
} from '@/lib/authority-domain-shards/labels';
import { loadPrerequisitePublication, type PrerequisiteStorePaths } from '../prerequisites/store';
import type { StagedTeachingProjectionFiles } from '../store';
import {
  resolveConsumerActivation,
  resolveCourseRuntimeProductionSelection,
  resolveEngineeringRagProductionSelection,
  resolveKonlingProductionSelection,
  resolveTeachingResourceRagProductionSelection,
  type ConsumerActivationStorePaths,
} from '@/lib/versioned-knowledge-activation';

import { V018_NAMED_CONSUMERS } from './v018-qualify-contract';
import { leakInDisplay } from './v018-shared';

export interface ConsumerShadowRead {
  kind: string;
  ok: boolean;
  identity: Record<string, string | null>;
  leak: boolean;
  detail: string;
}

export interface ConsumerShadowResult {
  consumerId: (typeof V018_NAMED_CONSUMERS)[number];
  status: 'READY' | 'BLOCKED';
  shadowCombination: {
    authorityReleaseId: string;
    authoritySnapshotId: string;
    projectionId: string | null;
  };
  presentationLeak: boolean;
  reads: ConsumerShadowRead[];
}

export interface CandidateConsumerReadInput {
  authorityManifest: AuthoritySnapshotManifest;
  engineering: AuthorityEngineeringBody;
  loadedProjection: StagedTeachingProjectionFiles;
  catalog: AuthorityDomainCatalogRuntime | null;
  shardContext: LoadedAuthorityShardContext | null;
  shardPaths: AuthorityDomainShardPaths | null;
  authorityPaths: AuthorityStorePaths;
  activationPaths: ConsumerActivationStorePaths | null;
  prerequisitePaths: PrerequisiteStorePaths;
  publicationId: string;
  infographCount: number;
}

function pushRead(
  reads: ConsumerShadowRead[],
  kind: string,
  ok: boolean,
  identity: Record<string, string | null>,
  leak: boolean,
  detail: string,
): void {
  reads.push({ kind, ok, identity, leak, detail });
}

function visibleLeak(...values: Array<unknown>): boolean {
  return values.some((value) => typeof value === 'string' && leakInDisplay(value));
}

function boundResource(projection: StagedTeachingProjectionFiles): Record<string, unknown> | null {
  const bound = projection.artifacts.bindings.find((row) => row.resourceId && row.canonicalId);
  if (!bound) return null;
  const resource = projection.artifacts.resources.find((row) => row.resourceId === bound.resourceId);
  return {
    resourceId: bound.resourceId,
    canonicalId: bound.canonicalId,
    role: bound.role,
    scopeId: bound.scopeId,
    title: resource?.title ?? null,
    rationale: bound.rationale ?? null,
  };
}

function runLabelReads(input: CandidateConsumerReadInput): ConsumerShadowRead[] {
  const reads: ConsumerShadowRead[] = [];
  const snapshot = {
    snapshotId: input.authorityManifest.snapshotId,
    snapshotHash: input.authorityManifest.snapshotHash,
    releaseId: input.authorityManifest.releaseId,
  };
  const context = createAuthorityLabelResolverContext({
    snapshot,
    objects: input.engineering.objects,
    v2Evidence: input.engineering.v2Evidence,
  });
  const memberIds = (input.catalog?.memberships ?? []).map((row) => row.canonicalId);
  const sampleIds = memberIds.length > 0
    ? memberIds
    : input.engineering.objects.slice(0, 8).map((row) => row.canonicalId);
  let available = 0;
  let leaks = 0;
  let fallbacks = 0;
  for (const entityId of sampleIds) {
    const resolved = resolveAuthorityLabel(context, entityId);
    if (resolved.status === 'available' && resolved.label) {
      available += 1;
      if (visibleLeak(resolved.label, ...resolved.aliases)) leaks += 1;
    } else {
      fallbacks += 1;
    }
  }
  pushRead(reads, 'zh-cn-label', available > 0 && leaks === 0, {
    authoritySnapshotId: snapshot.snapshotId,
    sampled: String(sampleIds.length),
    available: String(available),
  }, leaks > 0, `available=${available};fallback=${fallbacks};leaks=${leaks}`);
  pushRead(reads, 'label-fallback', true, {
    authoritySnapshotId: snapshot.snapshotId,
    fallbacks: String(fallbacks),
  }, false, `fallback-or-unavailable=${fallbacks}`);
  return reads;
}

function runGraphReads(input: CandidateConsumerReadInput): ConsumerShadowRead[] {
  const reads: ConsumerShadowRead[] = [];
  const resolved = resolveEngineeringGraphAuthority(input.authorityPaths);
  pushRead(reads, 'engineering-graph-authority', resolved.status === 'ready' && resolved.snapshotId === input.authorityManifest.snapshotId, {
    authoritySnapshotId: resolved.snapshotId ?? input.authorityManifest.snapshotId,
    objects: String(resolved.objectCount),
  }, false, resolved.status === 'ready' ? `objects=${resolved.objectCount}` : resolved.reason ?? resolved.status);
  if (!input.shardContext || !input.shardPaths) {
    pushRead(reads, 'engineering-graph', false, {
      authoritySnapshotId: input.authorityManifest.snapshotId,
    }, false, 'isolated-shard-context-missing');
    return reads;
  }
  const options = {
    shardPaths: input.shardPaths,
    identity: input.shardContext.identity,
    io: input.shardContext.io,
  };
  const root = loadRootShard(options);
  const domainId = REGISTERED_PEER_DOMAIN_IDS[0];
  const family = ENGINEERING_RELATION_FAMILIES[0];
  const domain = loadDomainDefaultShard(domainId, options);
  const familyShard = loadRelationFamilyShard(domainId, family, options);
  const nodeId = input.catalog?.memberships[0]?.canonicalId
    ?? domain.objects[0]?.id
    ?? '';
  const neighborhood = nodeId ? loadNodeNeighborhoodShard(nodeId, options) : null;
  const detail = nodeId ? loadNodeDetailShard(nodeId, options) : null;
  const leak = visibleLeak(
    ...domain.objects.map((row) => row.label),
    detail?.node.label,
    ...((detail?.node.aliases ?? []) as string[]),
  );
  const identity = {
    authoritySnapshotId: input.authorityManifest.snapshotId,
    shardSetId: input.shardContext.manifest.shardSetId,
    domainId,
    nodeId: nodeId || null,
  };
  pushRead(reads, 'graph-root', root.shardClass === 'root', identity, visibleLeak(JSON.stringify(root.root)), 'root');
  pushRead(reads, 'graph-domain', domain.domainId === domainId, identity, leak, `objects=${domain.objects.length}`);
  pushRead(reads, 'graph-family', familyShard.family === family, identity, false, `relations=${familyShard.relations.length}`);
  pushRead(reads, 'graph-neighborhood', Boolean(neighborhood && neighborhood.nodeId === nodeId), identity, false, `node=${nodeId}`);
  pushRead(reads, 'graph-detail', Boolean(detail && detail.node.id === nodeId), identity, leak, `detail=${detail?.node.label ?? ''}`);
  return reads;
}

function runEngineeringRagRead(input: CandidateConsumerReadInput): ConsumerShadowRead[] {
  const reads: ConsumerShadowRead[] = [];
  const selection = input.activationPaths
    ? resolveEngineeringRagProductionSelection({ activationPaths: input.activationPaths })
    : null;
  pushRead(reads, 'engineering-rag-selection', Boolean(selection && selection.mode === 'use-combination' && selection.combination?.authoritySnapshotId === input.authorityManifest.snapshotId), {
    authoritySnapshotId: selection?.combination?.authoritySnapshotId ?? input.authorityManifest.snapshotId,
    mode: selection?.mode ?? null,
  }, false, selection ? `mode=${selection.mode}` : 'selection-missing');
  const queryObject = input.engineering.objects.find((row) => row.semanticName)
    ?? input.engineering.objects[0];
  const rag = runEngineeringRagQuery({
    query: {
      domain: 'engineering',
      query: String(queryObject?.semanticName ?? queryObject?.canonicalId ?? 'authority'),
      authorityReleaseId: input.authorityManifest.releaseId,
      mode: 'shadow',
    },
    corpus: queryObject
      ? [{
          canonicalId: queryObject.canonicalId,
          label: queryObject.semanticName ?? null,
          predicates: [],
          relationIds: [],
          authorityReleaseId: input.authorityManifest.releaseId,
        }]
      : [],
    activationSelection: selection ?? undefined,
  });
  pushRead(reads, 'engineering-rag-query', rag.metadata.availability !== 'unavailable' && rag.metadata.authorityReleaseId === input.authorityManifest.releaseId, {
    authoritySnapshotId: input.authorityManifest.snapshotId,
    canonicalId: queryObject?.canonicalId ?? null,
  }, visibleLeak(queryObject?.semanticName), rag.metadata.availability);
  const resolved = resolveEngineeringRagAuthority(input.authorityPaths);
  pushRead(reads, 'engineering-rag', resolved.status === 'ready' && resolved.snapshotId === input.authorityManifest.snapshotId, {
    authoritySnapshotId: resolved.snapshotId ?? input.authorityManifest.snapshotId,
    canonicalId: queryObject?.canonicalId ?? null,
  }, false, resolved.status === 'ready' ? `objects=${resolved.objectCount}` : resolved.reason ?? resolved.status);
  return reads;
}

function runTeachingRagRead(input: CandidateConsumerReadInput): ConsumerShadowRead[] {
  const reads: ConsumerShadowRead[] = [];
  const selection = input.activationPaths
    ? resolveTeachingResourceRagProductionSelection({ activationPaths: input.activationPaths })
    : null;
  const query = applyTeachingResourceRagConsumerActivation({
    domain: 'teaching-resource',
    query: 'course',
    projectionId: input.loadedProjection.projectionId,
    projectionHash: input.loadedProjection.projectionHash,
    authorityReleaseId: input.authorityManifest.releaseId,
    scopeId: input.loadedProjection.artifacts.manifest.scopeId ?? null,
    mode: 'shadow',
  }, { activationSelection: selection ?? undefined });
  pushRead(reads, 'teaching-resource-rag-selection', Boolean(selection && selection.mode === 'use-combination' && selection.combination?.projectionId === input.loadedProjection.projectionId && !query.activationBlocked), {
    projectionId: query.projectionId ?? input.loadedProjection.projectionId,
    mode: selection?.mode ?? null,
  }, false, selection ? `mode=${selection.mode}` : 'selection-missing');
  const bound = boundResource(input.loadedProjection);
  const leak = visibleLeak(bound?.title, bound?.rationale);
  pushRead(reads, 'teaching-resource-rag', Boolean(bound && query.projectionId === input.loadedProjection.projectionId), {
    projectionId: input.loadedProjection.projectionId,
    resourceId: bound ? String(bound.resourceId) : null,
    canonicalId: bound ? String(bound.canonicalId) : null,
  }, leak, bound ? `resource=${String(bound.resourceId)}` : 'no-bound-resource');
  const card = input.loadedProjection.artifacts.cardsIndex.cards[0];
  pushRead(reads, 'card', Boolean(card?.canonicalId && card.active), {
    projectionId: input.loadedProjection.projectionId,
    cardId: card?.cardId ?? null,
    canonicalId: card?.canonicalId ?? null,
  }, visibleLeak(card?.title, card?.cardId), card ? `card=${card.cardId}` : 'no-card');
  pushRead(reads, 'infograph', input.infographCount > 0, {
    projectionId: input.loadedProjection.projectionId,
    infographCount: String(input.infographCount),
  }, false, `infographCount=${input.infographCount}`);
  return reads;
}

function runCourseRead(input: CandidateConsumerReadInput): ConsumerShadowRead[] {
  const reads: ConsumerShadowRead[] = [];
  const selection = input.activationPaths
    ? resolveCourseRuntimeProductionSelection({ activationPaths: input.activationPaths })
    : null;
  pushRead(reads, 'course-runtime-selection', Boolean(selection && selection.mode === 'use-combination' && selection.combination?.projectionId === input.loadedProjection.projectionId), {
    projectionId: selection?.combination?.projectionId ?? input.loadedProjection.projectionId,
    mode: selection?.mode ?? null,
  }, false, selection ? `mode=${selection.mode}` : 'selection-missing');
  const binding = input.loadedProjection.artifacts.bindings.find((row) => (
    String(row.scopeId ?? '').startsWith('course-package:') && Boolean(row.canonicalId)
  ));
  const resource = binding
    ? input.loadedProjection.artifacts.resources.find((row) => row.resourceId === binding.resourceId)
    : input.loadedProjection.artifacts.resources.find((row) => (
      String(row.scopeId ?? '').startsWith('course-package:') && row.bindingStatus === 'BOUND'
    ));
  const leak = visibleLeak(resource?.title, binding?.rationale);
  pushRead(reads, 'course-runtime', Boolean(binding && selection?.combination?.authorityReleaseId === input.authorityManifest.releaseId), {
    projectionId: input.loadedProjection.projectionId,
    resourceId: resource?.resourceId ?? binding?.resourceId ?? null,
    scopeId: resource?.scopeId ?? binding?.scopeId ?? null,
  }, leak, binding ? `scope=${String(binding.scopeId)}` : 'no-course-binding');
  return reads;
}

function runKonlingRead(input: CandidateConsumerReadInput): ConsumerShadowRead[] {
  const reads: ConsumerShadowRead[] = [];
  const selection = input.activationPaths
    ? resolveKonlingProductionSelection({ activationPaths: input.activationPaths })
    : null;
  pushRead(reads, 'konling-selection', Boolean(selection && selection.mode === 'use-combination' && selection.combination?.projectionId === input.loadedProjection.projectionId), {
    projectionId: selection?.combination?.projectionId ?? input.loadedProjection.projectionId,
    mode: selection?.mode ?? null,
  }, false, selection ? `mode=${selection.mode}` : 'selection-missing');
  const card = input.loadedProjection.artifacts.cardsIndex.cards.find((row) => row.active)
    ?? input.loadedProjection.artifacts.cardsIndex.cards[0];
  const binding = card
    ? input.loadedProjection.artifacts.bindings.find((row) => row.canonicalId === card.canonicalId)
    : null;
  const leak = visibleLeak(card?.title, binding?.rationale);
  pushRead(reads, 'konling', Boolean(card && card.canonicalId && selection?.combination?.projectionId === input.loadedProjection.projectionId), {
    projectionId: input.loadedProjection.projectionId,
    cardId: card?.cardId ?? null,
    canonicalId: card?.canonicalId ?? null,
  }, leak, card ? `card=${card.cardId}` : 'no-konling-card');
  return reads;
}

function runPathRead(input: CandidateConsumerReadInput): ConsumerShadowRead[] {
  const reads: ConsumerShadowRead[] = [];
  const publication = loadPrerequisitePublication(input.prerequisitePaths, input.publicationId);
  const edge = publication.edges[0];
  const coreOk = publication.coreNodes.length > 0 && publication.manifest.gatePassed;
  const leak = visibleLeak(edge?.curatorRationale);
  pushRead(reads, 'prerequisite', coreOk, {
    publicationId: publication.manifest.publicationId,
    coreNodes: String(publication.coreNodes.length),
  }, leak, `edges=${publication.edges.length}`);
  pushRead(reads, 'learning-path', Boolean(edge && publication.manifest.authorityReleaseId === input.authorityManifest.releaseId), {
    publicationId: publication.manifest.publicationId,
    from: edge?.sourceNodeId ?? null,
    to: edge?.targetNodeId ?? null,
  }, leak, edge ? 'edge-present' : 'no-path-edge');
  return reads;
}

export function runNamedConsumerShadowReads(
  input: CandidateConsumerReadInput,
): ConsumerShadowResult[] {
  const sharedLabels = runLabelReads(input);
  const byConsumer: Record<(typeof V018_NAMED_CONSUMERS)[number], ConsumerShadowRead[]> = {
    'engineering-graph': [...runGraphReads(input), ...sharedLabels],
    'engineering-rag': [...runEngineeringRagRead(input), ...sharedLabels],
    'teaching-resource-rag': [...runTeachingRagRead(input), ...sharedLabels],
    konling: [...runKonlingRead(input), ...sharedLabels],
    'course-runtime': [...runCourseRead(input), ...sharedLabels],
    'learning-path': [...runPathRead(input), ...sharedLabels],
  };

  return V018_NAMED_CONSUMERS.map((consumerId) => {
    const reads = byConsumer[consumerId];
    const requiresProjection = consumerId !== 'engineering-graph' && consumerId !== 'engineering-rag';
    const combination = {
      authorityReleaseId: input.authorityManifest.releaseId,
      authoritySnapshotId: input.authorityManifest.snapshotId,
      projectionId: requiresProjection ? input.loadedProjection.projectionId : null,
    };
    if (input.activationPaths) {
      const resolved = resolveConsumerActivation(input.activationPaths, consumerId);
      const mixed = resolved.combination
        && (
          resolved.combination.authoritySnapshotId !== combination.authoritySnapshotId
          || (requiresProjection && resolved.combination.projectionId !== combination.projectionId)
        );
      if (mixed) {
        reads.push({
          kind: 'activation-combination',
          ok: false,
          identity: {
            authoritySnapshotId: resolved.combination?.authoritySnapshotId ?? null,
            projectionId: resolved.combination?.projectionId ?? null,
          },
          leak: false,
          detail: 'mixed-consumer-combination',
        });
      }
    }
    const presentationLeak = reads.some((row) => row.leak);
    const status = reads.every((row) => row.ok) && !presentationLeak ? 'READY' : 'BLOCKED';
    return {
      consumerId,
      status,
      shadowCombination: combination,
      presentationLeak,
      reads,
    };
  });
}
