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
  unitRank,
  type PlannedTeachingOrderEdge,
} from './adopt-engineering-prerequisites';
import { buildDomainTeachingFragment } from './builder';
import { composeDomainTeachingProjection } from './compose';
import {
  DOMAIN_TEACHING_CURRENT_CONTRACT,
  LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
  LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
  LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION,
  LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH,
  type DomainTeachingAuthorityEnvelope,
  type DomainTeachingFragment,
  type DomainTeachingFragmentAuthoring,
} from './contracts';
import { createDomainTeachingAuthorityEnvelope } from './validate';

const COURSE_PROJECTION_CURRENT_RELATIVE =
  'course-content/runtime/knowledge/projection/current.json' as const;
const COURSE_PREREQUISITE_CURRENT_RELATIVE =
  'course-content/runtime/knowledge/prerequisites/current.json' as const;
const UNIT_PATTERN = /(\d+-\d+)/g;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function earliestUnit(texts: readonly string[]): string | null {
  let best: string | null = null;
  for (const text of texts) {
    UNIT_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = UNIT_PATTERN.exec(text))) {
      const unit = match[1]!;
      if (!best || unitRank(unit) < unitRank(best)) best = unit;
    }
  }
  return best;
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

export interface CourseTeachingContent {
  contentNodeIds: string[];
  nodeUnits: Map<string, string>;
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
}

export function readCourseTeachingContent(repoRoot: string): CourseTeachingContent {
  const projectionPointer = readJson<{ projectionId: string }>(
    join(repoRoot, COURSE_PROJECTION_CURRENT_RELATIVE),
  );
  const projectionDir = join(
    repoRoot,
    'course-content/runtime/knowledge/projection/releases',
    projectionPointer.projectionId,
  );
  const resources = new Map<string, { sourcePath?: string; resourceId: string }>();
  for (const line of readFileSync(join(projectionDir, 'resources.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as { resourceId: string; sourcePath?: string };
    resources.set(row.resourceId, row);
  }
  const nodeUnits = new Map<string, string>();
  const content = new Set<string>();
  for (const line of readFileSync(join(projectionDir, 'bindings.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as {
      canonicalId: string;
      resourceId: string;
      sourcePath?: string;
    };
    content.add(row.canonicalId);
    const resource = resources.get(row.resourceId);
    const unit = earliestUnit([
      row.sourcePath ?? '',
      row.resourceId,
      resource?.sourcePath ?? '',
      resource?.resourceId ?? '',
    ]);
    if (!unit) continue;
    const current = nodeUnits.get(row.canonicalId);
    if (!current || unitRank(unit) < unitRank(current)) nodeUnits.set(row.canonicalId, unit);
  }

  const prereqPointer = readJson<{ publicationId: string }>(
    join(repoRoot, COURSE_PREREQUISITE_CURRENT_RELATIVE),
  );
  const prereqDir = join(
    repoRoot,
    'course-content/runtime/knowledge/prerequisites/releases',
    prereqPointer.publicationId,
  );
  const cores = readJson<Array<{ canonicalId: string; sourceEvidence?: string[] }>>(
    join(prereqDir, 'core-nodes.json'),
  );
  for (const core of cores) {
    content.add(core.canonicalId);
    const unit = earliestUnit(core.sourceEvidence ?? []);
    if (!unit) continue;
    const current = nodeUnits.get(core.canonicalId);
    if (!current || unitRank(unit) < unitRank(current)) nodeUnits.set(core.canonicalId, unit);
  }
  const edges = readJson<Array<{
    sourceNodeId: string;
    targetNodeId: string;
    relationType?: string;
    strength?: PlannedTeachingOrderEdge['strength'];
    evidenceRefs?: string[];
    curatorId?: string | null;
    curatorRationale?: string | null;
    authorDecisionId?: string | null;
  }>>(join(prereqDir, 'edges.json'));
  const existingTeaching: CourseTeachingContent['existingTeaching'] = [];
  for (const edge of edges) {
    content.add(edge.sourceNodeId);
    content.add(edge.targetNodeId);
    const unit = earliestUnit(edge.evidenceRefs ?? []);
    if (unit) {
      for (const nodeId of [edge.sourceNodeId, edge.targetNodeId]) {
        const current = nodeUnits.get(nodeId);
        if (!current || unitRank(unit) < unitRank(current)) nodeUnits.set(nodeId, unit);
      }
    }
    existingTeaching.push({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      relationType: edge.relationType ?? 'PREREQUISITE',
      strength: edge.strength,
      evidenceRefs: edge.evidenceRefs,
      curatorId: edge.curatorId,
      curatorRationale: edge.curatorRationale,
      authorDecisionId: edge.authorDecisionId,
    });
  }
  return {
    contentNodeIds: [...content],
    nodeUnits,
    existingTeaching,
  };
}

export function authorOverviewTeachingOrderFragment(input: {
  overviews: Array<{ domainId: RegisteredPeerDomainId; nodeIds: readonly string[] }>;
  contentNodeIds: readonly string[];
  nodeUnits?: ReadonlyMap<string, string>;
  existingTeaching: CourseTeachingContent['existingTeaching'];
  envelope: DomainTeachingAuthorityEnvelope;
}): { authoring: DomainTeachingFragmentAuthoring; plan: ReturnType<typeof planOverviewTeachingOrder> } {
  const overviewIds = new Set(input.overviews.flatMap((overview) => overview.nodeIds));
  const contentNodeIds = input.contentNodeIds.filter((id) => overviewIds.has(id));
  const plan = planOverviewTeachingOrder({
    overviews: input.overviews,
    contentNodeIds,
    nodeUnits: input.nodeUnits,
    existingTeaching: input.existingTeaching,
  });
  const planned = [...plan.adopted, ...plan.extensions];
  const published: Array<PlannedTeachingOrderEdge & {
    evidenceRefs?: string[];
    curatorId?: string | null;
    curatorRationale?: string | null;
    authorDecisionId?: string | null;
  }> = [...planned];
  for (const edge of input.existingTeaching) {
    if (edge.relationType !== 'PREREQUISITE' || edge.sourceNodeId === edge.targetNodeId) continue;
    if (published.some((row) => row.sourceNodeId === edge.sourceNodeId && row.targetNodeId === edge.targetNodeId)) {
      continue;
    }
    const domainKeys = edge.domainKeys && edge.domainKeys.length > 0
      ? edge.domainKeys
      : input.overviews
        .filter((overview) => overview.nodeIds.includes(edge.sourceNodeId) || overview.nodeIds.includes(edge.targetNodeId))
        .map((overview) => overview.domainId);
    if (domainKeys.length === 0) continue;
    published.push({
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      relationType: 'PREREQUISITE',
      strength: edge.strength === 'REQUIRED' ? 'REQUIRED' : 'RECOMMENDED',
      domainKeys,
      provenance: 'course-prerequisite',
      engineeringRelationId: null,
      evidenceRefs: edge.evidenceRefs,
      curatorId: edge.curatorId,
      curatorRationale: edge.curatorRationale,
      authorDecisionId: edge.authorDecisionId,
    });
  }
  const coreIds = new Set(contentNodeIds);
  for (const edge of published) {
    coreIds.add(edge.sourceNodeId);
    coreIds.add(edge.targetNodeId);
  }
  const domainByNode = new Map<string, Set<RegisteredPeerDomainId>>();
  for (const overview of input.overviews) {
    for (const nodeId of overview.nodeIds) {
      if (!coreIds.has(nodeId)) continue;
      const domains = domainByNode.get(nodeId) ?? new Set();
      domains.add(overview.domainId);
      domainByNode.set(nodeId, domains);
    }
  }
  const domainKeys = [...new Set(
    input.overviews
      .filter((overview) => overview.nodeIds.some((id) => coreIds.has(id)))
      .map((overview) => overview.domainId),
  )].sort() as RegisteredPeerDomainId[];
  const authoring: DomainTeachingFragmentAuthoring = {
    contract: 'act-domain-teaching-fragment/v1',
    fragmentKey: 'overview-teaching-order-v1',
    fragmentVersion: '2',
    domainKeys,
    authorityBinding: input.envelope.binding,
    authoritySelection: {
      authorityBinding: input.envelope.binding,
      sourceDatasetHash: input.envelope.sourceDatasetHash,
      captureRevision: input.envelope.captureRevision,
      nodeIndexDigest: input.envelope.nodeIndexDigest,
    },
    authoringRevision: input.envelope.authoringRevision,
    evidenceRefs: [
      'openspec/changes/adopt-engineering-prerequisites-into-domain-teaching/proposal.md',
      COURSE_PREREQUISITE_CURRENT_RELATIVE,
      COURSE_PROJECTION_CURRENT_RELATIVE,
    ],
    coreNodes: [...coreIds].sort().map((canonicalId) => {
      const fromOverview = domainByNode.get(canonicalId);
      const fromEdges = published
        .filter((edge) => edge.sourceNodeId === canonicalId || edge.targetNodeId === canonicalId)
        .flatMap((edge) => edge.domainKeys);
      const keys = [...new Set([...(fromOverview ?? []), ...fromEdges])].sort() as RegisteredPeerDomainId[];
      return {
        canonicalId,
        domainKeys: keys.length > 0 ? keys : domainKeys,
        pathEligible: true,
        cardPolicy: 'OPTIONAL' as const,
        moduleId: null,
        rationale: 'Course-content-related DomainConcept teaching-order coverage',
        sourceKind: 'PREREQUISITE_ENDPOINT' as const,
        sourceEvidence: ['course-teaching-content'],
      };
    }),
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
  const rationale = edge.curatorRationale
    ?? (edge.provenance === 'course-prerequisite'
      ? 'Ingested published course teaching prerequisite'
      : edge.provenance === 'engineering-post-requisite'
        ? 'Adopted from engineering post-requisite knowledge order'
        : 'Extension edge that follows syllabus unit order');
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
    curatorRationale: rationale,
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
  }>(join(releaseDir, 'composed-manifest.json'));
  const priorFragments: DomainTeachingFragment[] = manifest.fragments
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((ref) => readJson<DomainTeachingFragment>(
      join(releaseDir, 'fragments', `${ref.fragmentId}.json`),
    ));
  const course = readCourseTeachingContent(repoRoot);
  const priorTeaching = priorFragments.flatMap((fragment) => fragment.relations.map((relation) => ({
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
  const overviewIds = new Set(overviews.flatMap((overview) => overview.nodeIds));
  const contentNodeIds = [...new Set([
    ...course.contentNodeIds,
    ...priorFragments.flatMap((fragment) => fragment.coreNodes.map((node) => node.canonicalId)),
  ])].filter((id) => overviewIds.has(id));
  const envelopeNodes = [...new Set([
    ...contentNodeIds,
    ...course.existingTeaching.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]),
    ...priorTeaching.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]),
  ])].sort().map((canonicalId) => ({
    canonicalId,
    lifecycleStatus: 'active',
  }));
  const envelope = createDomainTeachingAuthorityEnvelope({
    binding: LIVE_AUTHORITY_DOMAIN_TEACHING_BINDING,
    sourceDatasetHash: LIVE_AUTHORITY_DOMAIN_TEACHING_SOURCE_DATASET_HASH,
    captureRevision: LIVE_AUTHORITY_DOMAIN_TEACHING_CAPTURE_REVISION,
    authoringRevision: LIVE_AUTHORITY_DOMAIN_TEACHING_AUTHORING_REVISION,
    nodes: envelopeNodes,
  });
  const { authoring } = authorOverviewTeachingOrderFragment({
    overviews,
    contentNodeIds,
    nodeUnits: course.nodeUnits,
    existingTeaching: [...course.existingTeaching, ...priorTeaching],
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
