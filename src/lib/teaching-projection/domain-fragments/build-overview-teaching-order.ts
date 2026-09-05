import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { RegisteredPeerDomainId } from '@/lib/authority-domain-catalog/contracts';
import {
  DEFAULT_AUTHORITY_DOMAIN_SHARD_RUNTIME_RELATIVE,
} from '@/lib/authority-domain-shards/contracts';
import {
  writeDomainTeachingRuntime,
} from '@/lib/authority-domain-shards/stage-domain-teaching-runtime';
import {
  DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
  resolveDomainTeachingRuntimePaths,
} from '@/lib/authority-domain-shards/teaching';
import { teachingCacheFamilyFor } from './activation';
import {
  planOverviewTeachingOrder,
  type PlannedTeachingOrderEdge,
} from './adopt-engineering-prerequisites';
import { buildDomainTeachingFragment } from './builder';
import { composeDomainTeachingProjection } from './compose';
import {
  DOMAIN_TEACHING_CURRENT_CONTRACT,
  LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
  LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
  LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION,
  LIVE_AUTHORITY_DOMAIN_TEACHING_ENGINEERING_RELATIVE,
  LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH,
  type DomainTeachingAuthorityEnvelope,
  type DomainTeachingFragment,
  type DomainTeachingFragmentAuthoring,
} from './contracts';
import { createDomainTeachingAuthorityEnvelope } from './validate';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function readDomainOverviews(repoRoot: string): Array<{
  domainId: RegisteredPeerDomainId;
  nodeIds: string[];
}> {
  const pointer = readJson<{ shardSetId: string }>(
    join(repoRoot, DEFAULT_AUTHORITY_DOMAIN_SHARD_RUNTIME_RELATIVE, 'current.json'),
  );
  const domainsDir = join(
    repoRoot,
    DEFAULT_AUTHORITY_DOMAIN_SHARD_RUNTIME_RELATIVE,
    'sets',
    pointer.shardSetId,
    'domains',
  );
  const overviews: Array<{ domainId: RegisteredPeerDomainId; nodeIds: string[] }> = [];
  for (const domainId of readdirSync(domainsDir).sort()) {
    const defaultPath = join(domainsDir, domainId, 'default.json');
    const shard = readJson<{ objects?: Array<{ id: string }> }>(defaultPath);
    overviews.push({
      domainId: domainId as RegisteredPeerDomainId,
      nodeIds: (shard.objects ?? []).map((object) => object.id),
    });
  }
  return overviews;
}

export function readEngineeringRelationsFromAuthoritySnapshot(repoRoot: string): Array<{
  id: string;
  predicate: string;
  sourceId: string;
  targetId: string;
}> {
  const snapshot = readJson<{
    relations?: Array<{
      relationId: string;
      relationType: string;
      sourceId: string;
      targetId: string;
    }>;
  }>(join(repoRoot, LIVE_AUTHORITY_DOMAIN_TEACHING_ENGINEERING_RELATIVE));
  return (snapshot.relations ?? []).map((relation) => ({
    id: relation.relationId,
    predicate: relation.relationType,
    sourceId: relation.sourceId,
    targetId: relation.targetId,
  }));
}

export function authorOverviewTeachingOrderFragment(input: {
  overviews: Array<{ domainId: RegisteredPeerDomainId; nodeIds: readonly string[] }>;
  engineeringRelations: Array<{ id: string; predicate: string; sourceId: string; targetId: string }>;
  existingTeaching: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    relationType: string;
    strength?: PlannedTeachingOrderEdge['strength'];
    domainKeys?: RegisteredPeerDomainId[];
    evidenceRefs?: string[];
    curatorId?: string | null;
    curatorRationale?: string | null;
    authorDecisionId?: string | null;
  }>;
  envelope: DomainTeachingAuthorityEnvelope;
}): { authoring: DomainTeachingFragmentAuthoring; plan: ReturnType<typeof planOverviewTeachingOrder> } {
  const plan = planOverviewTeachingOrder({
    overviews: input.overviews,
    engineeringRelations: input.engineeringRelations,
    existingTeaching: input.existingTeaching,
  });
  const planned = [...plan.adopted, ...plan.extensions];
  const published: Array<PlannedTeachingOrderEdge & { evidenceRefs?: string[]; curatorId?: string | null; curatorRationale?: string | null; authorDecisionId?: string | null }> = [...planned];
  for (const edge of input.existingTeaching) {
    if (edge.relationType !== 'PREREQUISITE' || edge.sourceNodeId === edge.targetNodeId) continue;
    if (published.some((row) => row.sourceNodeId === edge.sourceNodeId && row.targetNodeId === edge.targetNodeId)) {
      continue;
    }
    published.push({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      relationType: 'PREREQUISITE',
      strength: edge.strength === 'RECOMMENDED' ? 'RECOMMENDED' : 'REQUIRED',
      domainKeys: edge.domainKeys && edge.domainKeys.length > 0
        ? edge.domainKeys
        : input.overviews
          .filter((overview) => overview.nodeIds.includes(edge.sourceNodeId) || overview.nodeIds.includes(edge.targetNodeId))
          .map((overview) => overview.domainId),
      provenance: 'teaching-extension',
      engineeringRelationId: null,
      evidenceRefs: edge.evidenceRefs,
      curatorId: edge.curatorId,
      curatorRationale: edge.curatorRationale,
      authorDecisionId: edge.authorDecisionId,
    });
  }
  const coreIds = new Set<string>();
  const domainByNode = new Map<string, Set<RegisteredPeerDomainId>>();
  for (const overview of input.overviews) {
    for (const nodeId of overview.nodeIds) {
      const domains = domainByNode.get(nodeId) ?? new Set();
      domains.add(overview.domainId);
      domainByNode.set(nodeId, domains);
      coreIds.add(nodeId);
    }
  }
  for (const edge of published) {
    coreIds.add(edge.sourceNodeId);
    coreIds.add(edge.targetNodeId);
  }

  const domainKeys = [...new Set(input.overviews.map((overview) => overview.domainId))].sort() as RegisteredPeerDomainId[];
  const authoring: DomainTeachingFragmentAuthoring = {
    contract: 'act-domain-teaching-fragment/v1',
    fragmentKey: 'overview-teaching-order-v1',
    fragmentVersion: '1',
    domainKeys,
    authorityBinding: input.envelope.binding,
    authoritySelection: {
      authorityBinding: input.envelope.binding,
      sourceDatasetHash: input.envelope.sourceDatasetHash,
      captureRevision: input.envelope.captureRevision,
      nodeIndexDigest: input.envelope.nodeIndexDigest,
    },
    authoringRevision: input.envelope.authoringRevision,
    evidenceRefs: ['openspec/specs/domain-teaching-order-coverage/spec.md'],
    coreNodes: [...coreIds].sort().map((canonicalId) => ({
      canonicalId,
      domainKeys: [...(domainByNode.get(canonicalId) ?? domainKeys)].sort() as RegisteredPeerDomainId[],
      pathEligible: true,
      cardPolicy: 'OPTIONAL' as const,
      moduleId: null,
      rationale: 'Domain-default overview teaching-order coverage',
      sourceKind: 'PREREQUISITE_ENDPOINT' as const,
      sourceEvidence: ['domain-default-overview'],
    })),
    relations: published.map((edge) => relationAuthoring(edge)),
  };
  return { authoring, plan };
}

function relationAuthoring(
  edge: PlannedTeachingOrderEdge & {
    evidenceRefs?: string[];
    curatorId?: string | null;
    curatorRationale?: string | null;
    authorDecisionId?: string | null;
  },
) {
  return {
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    relationType: edge.relationType,
    strength: edge.strength,
    domainKeys: edge.domainKeys,
    evidenceRefs: edge.engineeringRelationId
      ? [edge.engineeringRelationId]
      : [...(edge.evidenceRefs ?? [])],
    curatorId: edge.curatorId ?? 'overview-teaching-order',
    curatorRationale: edge.curatorRationale ?? (
      edge.provenance === 'engineering-post-requisite'
        ? 'Adopted from engineering post-requisite knowledge order'
        : 'Extension edge that weakly connects the domain-default overview'
    ),
    authorDecisionId: edge.authorDecisionId
      ?? edge.engineeringRelationId
      ?? `extension:${edge.sourceNodeId}->${edge.targetNodeId}`,
  };
}

export function stageOverviewTeachingOrder(repoRoot: string): {
  projectionId: string;
  relationCount: number;
  files: string[];
} {
  const teachingPaths = resolveDomainTeachingRuntimePaths(
    repoRoot,
    DEFAULT_DOMAIN_TEACHING_RUNTIME_RELATIVE,
  );
  const pointer = readJson<{ projectionId: string }>(teachingPaths.currentPath);
  const releaseDir = join(teachingPaths.releasesDir, pointer.projectionId);
  const manifest = readJson<{
    fragments: Array<{ fragmentId: string; order: number }>;
    authoringRevision: string;
    authorityBinding: typeof LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING;
    authoritySelection: {
      sourceDatasetHash: string;
      captureRevision: string;
      nodeIndexDigest: string;
      authorityBinding: typeof LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING;
    };
  }>(join(releaseDir, 'composed-manifest.json'));
  const priorFragments: DomainTeachingFragment[] = manifest.fragments
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((ref) => readJson<DomainTeachingFragment>(
      join(releaseDir, 'fragments', `${ref.fragmentId}.json`),
    ));
  const existingTeaching = priorFragments.flatMap((fragment) => fragment.relations.map((relation) => ({
    sourceNodeId: relation.sourceNodeId,
    targetNodeId: relation.targetNodeId,
    relationType: relation.relationType,
    strength: relation.strength,
    domainKeys: relation.domainKeys,
    evidenceRefs: relation.evidenceRefs,
    curatorId: relation.curatorId,
    curatorRationale: relation.curatorRationale,
    authorDecisionId: relation.authorDecisionId,
  })));
  const overviews = readDomainOverviews(repoRoot);
  const envelopeNodes = [...new Set([
    ...priorFragments.flatMap((fragment) => fragment.coreNodes.map((node) => node.canonicalId)),
    ...overviews.flatMap((overview) => overview.nodeIds),
  ])].sort().map((canonicalId) => ({ canonicalId, lifecycleStatus: 'active' }));
  const envelope = createDomainTeachingAuthorityEnvelope({
    binding: LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
    sourceDatasetHash: LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH,
    captureRevision: LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION,
    authoringRevision: LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
    nodes: envelopeNodes,
  });
  const { authoring } = authorOverviewTeachingOrderFragment({
    overviews,
    engineeringRelations: readEngineeringRelationsFromAuthoritySnapshot(repoRoot),
    existingTeaching,
    envelope,
  });
  const fragment = buildDomainTeachingFragment(authoring, envelope);
  const composed = composeDomainTeachingProjection({
    fragments: [fragment],
    authoringRevision: LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
    authority: envelope,
  });
  const { files } = writeDomainTeachingRuntime({
    repoRoot,
    pointer: {
      contract: DOMAIN_TEACHING_CURRENT_CONTRACT,
      projectionId: composed.manifest.projectionId,
      projectionHash: composed.manifest.projectionHash,
      authorityReleaseId: composed.manifest.authorityBinding.releaseId,
      authorityDigest: composed.manifest.authorityDigest,
      teachingCacheFamily: teachingCacheFamilyFor(composed.manifest),
      activatedAt: new Date().toISOString(),
    },
    artifacts: composed,
  });
  return {
    projectionId: composed.manifest.projectionId,
    relationCount: composed.manifest.relationCount,
    files,
  };
}
