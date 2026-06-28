import { buildKaqArtifactVersionRefs, type KaqArtifactVersionRefs } from '../kaq-artifact-versioning';
import {
  buildResourceSemanticProjection,
  type ResourceNode,
  type ResourceSemanticProjection,
} from '../resource-node-registry';
import type { LearningGoalDefinition } from '../adaptive-learning-path-planner';
import type { KaqGraphNode } from './kaq-graph-schema';
import type {
  KaqObjective,
  PortraitV2DimensionDefinition,
} from './kaq-objective-taxonomy';
import type {
  LearningEvidenceAuthorityLevel,
  LearningEvidenceCorpusChunk,
  LearningEvidenceCorpusPrivacyClass,
} from './learning-evidence-rag-corpus';
import type { ExpandedGoalSubgraph } from '../graphs/goal-subgraph-expansion-service';
import type {
  SarAuthorityLevel,
  SarEntityType,
  SarEventType,
  SarPrivacyScope,
  SarRelationRole,
  SarRetrievalEntity,
  SarRetrievalEvent,
  SarRetrievalEventEntity,
  SarRetrievalResult,
  SarRetrievalTrace,
} from './structured-associative-retrieval';
import {
  chunkMatchesGraphCoverageRefs,
  resourceMatchesGraphCoverageRefs,
} from './resource-coverage-matching';

export interface SarProjection {
  events: SarRetrievalEvent[];
  entities: SarRetrievalEntity[];
  relations: SarRetrievalEventEntity[];
  citationTargetRefs: string[];
  retrievalChunkRefs: string[];
  limitations: string[];
  versionRefs: string[];
}

export interface KaqGraphNodeSarProjectionInput {
  node: KaqGraphNode;
  objectives?: readonly KaqObjective[];
  portraitDimensions?: readonly PortraitV2DimensionDefinition[];
  coverageRefs?: readonly string[];
  versionRefs?: Partial<KaqArtifactVersionRefs>;
}

export interface LearningGoalSarProjectionInput {
  goal: LearningGoalDefinition;
  graphNodes?: readonly KaqGraphNode[];
  objectives?: readonly KaqObjective[];
  expandedSubgraph?: ExpandedGoalSubgraph;
  versionRefs?: Partial<KaqArtifactVersionRefs>;
}

export interface ResourceNodeSarProjectionInput {
  node: ResourceNode;
  projection?: ResourceSemanticProjection;
  coverageRefs?: readonly string[];
}

export interface LearningEvidenceChunkSarProjectionInput {
  chunk: LearningEvidenceCorpusChunk;
  privacyScope?: SarPrivacyScope;
  coverageRefs?: readonly string[];
  linkedResources?: readonly ResourceNode[];
}

export interface GovernedSummarySarProjectionInput {
  id: string;
  title: string;
  summary: string;
  sourceOwner: string;
  sourceRefId: string;
  eventType?: SarEventType;
  privacyScope?: SarPrivacyScope;
  authorityLevel?: SarAuthorityLevel;
  freshness?: string;
  contentHash?: string;
  entityRefs?: readonly GovernedSummaryEntityRef[];
  citationTargetRefs?: readonly string[];
  retrievalChunkRefs?: readonly string[];
  limitations?: readonly string[];
  versionRefs?: readonly string[];
}

export interface GovernedSummaryEntityRef {
  entityType: SarEntityType;
  canonicalRef: string;
  label: string;
  role?: SarRelationRole;
  privacyScope?: SarPrivacyScope;
  aliases?: readonly string[];
}

export function projectKaqGraphNodeToSar(input: KaqGraphNodeSarProjectionInput): SarRetrievalResult {
  const { node } = input;
  const sarEventId = makeEventId('graph-node', node.id);
  const graphEntity = entity('graph-node', node.id, node.title, {
    aliases: graphNodeAliases(node),
  });
  const objectiveById = new Map((input.objectives ?? []).map((objective) => [objective.id, objective]));
  const objectiveEntities = node.objectiveIds.map((objectiveId) => {
    const objective = objectiveById.get(objectiveId);
    return entity('kaq-objective', objectiveId, objective?.title ?? objectiveId, {
      aliases: objective ? uniqueSorted([objective.id, objective.domain, objective.level]) : [objectiveId],
    });
  });
  const dimensionById = new Map((input.portraitDimensions ?? []).map((dimension) => [dimension.id, dimension]));
  const dimensionEntities = node.portraitDimensions.map((dimensionId) => {
    const dimension = dimensionById.get(dimensionId);
    return entity('portrait-dimension', dimensionId, dimension?.label ?? dimensionId, {
      aliases: dimension ? [dimension.id] : [dimensionId],
    });
  });
  return assembleSarResult({
    id: `sar:result:graph-node:${node.id}`,
    events: [{
      id: sarEventId,
      eventType: 'graph-node',
      title: node.title,
      safeSummary: safeText(node.description, `Governed ${node.domain} graph node ${node.id}.`),
      sourceRef: {
        id: node.id,
        owner: 'kaq-graph',
        authorityLevel: 'platform-verified',
        freshness: versionRefs(input.versionRefs).join('|'),
      },
      privacyScope: 'student-visible',
      metadata: {
        domain: node.domain,
        status: node.status,
        objectiveIds: node.objectiveIds,
        portraitDimensions: node.portraitDimensions,
        coverageRefs: uniqueSorted(input.coverageRefs ?? []),
      },
    }],
    entities: [graphEntity, ...objectiveEntities, ...dimensionEntities],
    relations: [
      relation(sarEventId, graphEntity.id, 'about', 'graph-node-stable-id'),
      ...objectiveEntities.map((objectiveEntity) => relation(sarEventId, objectiveEntity.id, 'supports', 'kaq-objective-id')),
      ...dimensionEntities.map((dimensionEntity) => relation(sarEventId, dimensionEntity.id, 'supports', 'portrait-dimension-id')),
    ],
    versionRefs: versionRefs(input.versionRefs),
  });
}

export function projectLearningGoalToSar(input: LearningGoalSarProjectionInput): SarRetrievalResult {
  const { goal } = input;
  const sarEventId = makeEventId('learning-goal', goal.id);
  const goalEntity = entity('learning-goal', goal.id, goal.title, { aliases: [goal.id] });
  const graphNodeById = new Map((input.graphNodes ?? []).map((node) => [node.id, node]));
  const graphEntities = goal.targetGraphNodeIds.map((nodeId) => {
    const node = graphNodeById.get(nodeId);
    return entity('graph-node', nodeId, node?.title ?? nodeId, {
      aliases: node ? [node.id, node.domain] : [nodeId],
    });
  });
  const objectiveIds = uniqueSorted([
    ...goal.knowledgeObjectiveIds,
    ...goal.capabilityObjectiveIds,
    ...goal.qualityObjectiveIds,
  ]);
  const objectiveById = new Map((input.objectives ?? []).map((objective) => [objective.id, objective]));
  const objectiveEntities = objectiveIds.map((objectiveId) => {
    const objective = objectiveById.get(objectiveId);
    return entity('kaq-objective', objectiveId, objective?.title ?? objectiveId, {
      aliases: objective ? [objective.id, objective.domain, objective.level] : [objectiveId],
    });
  });
  const expandedSubgraph = input.expandedSubgraph?.learningGoalId === goal.id
    && input.expandedSubgraph.learningGoalVersion === goal.version
    ? input.expandedSubgraph
    : null;
  const subgraphMismatchLimitation = input.expandedSubgraph && !expandedSubgraph
    ? goalSubgraphMismatchLimitations(input.expandedSubgraph, goal)
    : [];
  const subgraphGraphBoundaries: Array<{
    nodeId: string;
    role: SarRelationRole;
    source: string;
  }> = expandedSubgraph ? [
      ...expandedSubgraph.prerequisitePolicy.flatMap((entry) => [
        {
          nodeId: entry.sourceNodeId,
          role: 'requires' as const,
          source: `expanded-goal-subgraph-prerequisite:${entry.semantics}`,
        },
        {
          nodeId: entry.targetNodeId,
          role: 'requires' as const,
          source: `expanded-goal-subgraph-prerequisite-target:${entry.semantics}`,
        },
      ]),
      ...expandedSubgraph.remediationCandidates.map((nodeId) => ({
        nodeId,
        role: 'candidate-for' as const,
        source: 'expanded-goal-subgraph-remediation-candidate',
      })),
      ...expandedSubgraph.extensionCandidates.map((nodeId) => ({
        nodeId,
        role: 'candidate-for' as const,
        source: 'expanded-goal-subgraph-extension-candidate',
      })),
      ...expandedSubgraph.transferCandidates.map((nodeId) => ({
        nodeId,
        role: 'candidate-for' as const,
        source: 'expanded-goal-subgraph-transfer-candidate',
      })),
    ]
    : [];
  const subgraphGraphEntities = uniqueSorted(subgraphGraphBoundaries.map((boundary) => boundary.nodeId)).map((nodeId) => {
    const node = graphNodeById.get(nodeId);
    return entity('graph-node', nodeId, node?.title ?? nodeId, {
      aliases: node ? graphNodeAliases(node) : [nodeId],
    });
  });
  const checkpointEntities = (expandedSubgraph?.checkpointSuggestions ?? []).map((checkpoint) => entity(
    'path-node',
    checkpoint.id,
    `Checkpoint ${checkpoint.graphNodeId}`,
    { aliases: uniqueSorted([checkpoint.id, checkpoint.graphNodeId, ...checkpoint.evidenceTypes]) },
  ));
  const terminalValidationEntities = (expandedSubgraph?.terminalValidationCandidates ?? []).map((candidate) => entity(
    'path-node',
    candidate.id,
    `Terminal validation ${candidate.graphNodeId}`,
    { aliases: uniqueSorted([candidate.id, candidate.graphNodeId, ...candidate.acceptedEvidenceTypes]) },
  ));
  return assembleSarResult({
    id: `sar:result:learning-goal:${goal.id}`,
    events: [{
      id: sarEventId,
      eventType: 'path-summary',
      title: goal.title,
      safeSummary: safeText(goal.description, goal.completionMeaning),
      sourceRef: {
        id: goal.id,
        owner: 'learning-goal',
        authorityLevel: 'platform-verified',
        freshness: goal.version,
      },
      privacyScope: 'student-visible',
      metadata: {
        intentType: goal.intentType,
        recommendedPhase: goal.recommendedPhase,
        status: goal.status,
        goalSliceId: goal.goalSliceId,
        targetGraphNodeIds: goal.targetGraphNodeIds,
        expandedSubgraph: expandedSubgraph ? {
          status: expandedSubgraph.status,
          graphVersion: expandedSubgraph.graphVersion,
          prerequisiteEdgeIds: expandedSubgraph.prerequisitePolicy.map((entry) => entry.edgeId),
          remediationCandidates: expandedSubgraph.remediationCandidates,
          extensionCandidates: expandedSubgraph.extensionCandidates,
          transferCandidates: expandedSubgraph.transferCandidates,
          checkpointSuggestionIds: expandedSubgraph.checkpointSuggestions.map((checkpoint) => checkpoint.id),
          terminalValidationCandidateIds: expandedSubgraph.terminalValidationCandidates.map((candidate) => candidate.id),
        } : null,
      },
    }],
    entities: [
      goalEntity,
      ...graphEntities,
      ...objectiveEntities,
      ...subgraphGraphEntities,
      ...checkpointEntities,
      ...terminalValidationEntities,
    ],
    relations: [
      relation(sarEventId, goalEntity.id, 'about', 'learning-goal-stable-id'),
      ...graphEntities.map((graphEntity) => relation(sarEventId, graphEntity.id, 'supports', 'learning-goal-target-graph-node')),
      ...objectiveEntities.map((objectiveEntity) => relation(sarEventId, objectiveEntity.id, 'requires', 'learning-goal-objective-boundary')),
      ...subgraphGraphBoundaries.map((boundary) => relation(
        sarEventId,
        entityId('graph-node', boundary.nodeId),
        boundary.role,
        boundary.source,
      )),
      ...checkpointEntities.map((checkpointEntity) => relation(sarEventId, checkpointEntity.id, 'candidate-for', 'expanded-goal-subgraph-checkpoint')),
      ...terminalValidationEntities.map((terminalEntity) => relation(sarEventId, terminalEntity.id, 'candidate-for', 'expanded-goal-subgraph-terminal-validation')),
    ],
    limitations: [
      ...goal.limitations,
      ...(expandedSubgraph?.limitations.map((limitation) => `goal-subgraph:${limitation.code}:${limitation.message}`) ?? []),
      ...subgraphMismatchLimitation,
    ],
    versionRefs: versionRefs({
      ...input.versionRefs,
      learningGoalPackageVersion: input.versionRefs?.learningGoalPackageVersion ?? goal.version,
      graphCatalogVersion: expandedSubgraph?.graphVersion ?? input.versionRefs?.graphCatalogVersion,
    }),
  });
}

export function projectResourceNodeToSar(input: ResourceNodeSarProjectionInput): SarRetrievalResult {
  const projection = input.projection ?? buildResourceSemanticProjection(input.node);
  const resource = projection.resource;
  const sarEventId = makeEventId('resource-node', input.node.id);
  const resourceEntity = entity('resource-node', resource.id, resource.title, {
    canonicalRef: input.node.id,
    privacyScope: resource.governance.privacyLevel,
    aliases: uniqueSorted([resource.id, input.node.sourceRef, ...input.node.sourceRefs.map((ref) => ref.ref)]),
  });
  const graphEntities = uniqueSorted([
    ...resource.knowledgeNodeIds,
    ...resource.capabilityTargetIds,
    ...resource.graphProfile.graphNodeRefs.quality,
  ]).map((ref) => entity('graph-node', ref, ref, { privacyScope: resource.governance.privacyLevel }));
  const citationEntities = projection.citationTargets.map((target) => entity('citation-target', target.id, target.id, {
    privacyScope: target.privacyScope,
  }));
  const planningEntity = projection.planningUnit
    ? entity('planning-unit', projection.planningUnit.id, projection.planningUnit.title, {
      privacyScope: projection.planningUnit.privacyLevel,
      aliases: [projection.planningUnit.resourceNodeId],
    })
    : null;
  return assembleSarResult({
    id: `sar:result:resource-node:${input.node.id}`,
    events: [{
      id: sarEventId,
      eventType: 'resource-node',
      title: resource.title,
      safeSummary: safeText(input.node.description, `Governed resource node ${input.node.id}.`),
      sourceRef: {
        id: input.node.sourceRef,
        owner: input.node.sourceOfRecord.catalogMetadata,
        authorityLevel: 'metadata-projected',
        freshness: resource.graphProfile.versionRefs.resourceProjectionVersion ?? 'resource-semantic-projection',
        contentHash: resource.contentHash ?? undefined,
      },
      privacyScope: resource.governance.privacyLevel,
      metadata: {
        resourceNodeId: input.node.id,
        resourceId: resource.id,
        resourceType: resource.type,
        sourceKind: resource.sourceKind,
        projectionStatus: resource.projectionStatus,
        governance: resource.governance,
        pathEligible: Boolean(projection.planningUnit),
        graphCoverageMatched: input.coverageRefs
          ? resourceMatchesGraphCoverageRefs(input.node, input.coverageRefs)
          : null,
        graphCoverageRefs: uniqueSorted(input.coverageRefs ?? []),
        citationTargetIds: projection.citationTargets.map((target) => target.id),
        retrievalChunkIds: projection.retrievalChunks.map((chunk) => chunk.id),
      },
    }],
    entities: [
      resourceEntity,
      ...graphEntities,
      ...citationEntities,
      ...(planningEntity ? [planningEntity] : []),
    ],
    relations: [
      relation(sarEventId, resourceEntity.id, 'about', 'resource-node-stable-id'),
      ...graphEntities.map((graphEntity) => relation(sarEventId, graphEntity.id, 'supports', 'resource-graph-profile')),
      ...citationEntities.map((citationEntity) => relation(sarEventId, citationEntity.id, 'generated-from', 'resource-citation-target')),
      ...(planningEntity ? [relation(sarEventId, planningEntity.id, 'candidate-for', 'resource-planning-unit')] : []),
    ],
    citationTargetRefs: projection.citationTargets.map((target) => target.id),
    retrievalChunkRefs: projection.retrievalChunks.map((chunk) => chunk.id),
    limitations: [
      ...projectionStatusLimitations(input.node.id, resource.projectionStatus),
      ...resource.graphProfile.governanceLimitations.map((limitation) => `${limitation.code}: ${limitation.message}`),
      ...projection.citationTargets
        .filter((target) => target.status === 'missing-target')
        .map((target) => `missing-citation-target:${target.id}`),
      ...projection.retrievalChunks
        .filter((chunk) => !chunk.pathEligibility.eligible)
        .map((chunk) => `${chunk.id}: ${chunk.pathEligibility.reason}`),
    ],
    versionRefs: versionRefs(resource.graphProfile.versionRefs),
  });
}

export function projectLearningEvidenceChunkToSar(input: LearningEvidenceChunkSarProjectionInput): SarRetrievalResult {
  const { chunk } = input;
  const privacyScope = strictestPrivacyScope(evidencePrivacyScope(chunk.privacyClass), input.privacyScope);
  const sarEventId = makeEventId('corpus-chunk-summary', chunk.id);
  const sourceEntity = entity('resource-node', chunk.sourceRef.resourceId ?? chunk.sourceRef.id, chunk.display.title, {
    privacyScope,
  });
  const graphEntities = uniqueSorted([
    ...(chunk.resourceProjection?.knowledgeNodeRefs ?? []),
    ...(chunk.resourceProjection?.capabilityTargetRefs ?? []),
  ]).map((ref) => entity('graph-node', ref, ref, { privacyScope }));
  const citationTargetRef = chunk.resourceProjection?.citationTargetRef ?? null;
  const citationEntities = citationTargetRef
    ? [entity('citation-target', citationTargetRef, citationTargetRef, { privacyScope })]
    : [];
  const safeSummary = safeEvidenceSummary(chunk);
  return assembleSarResult({
    id: `sar:result:corpus-chunk:${chunk.id}`,
    events: [{
      id: sarEventId,
      eventType: 'corpus-chunk-summary',
      title: chunk.display.title,
      safeSummary,
      sourceRef: {
        id: chunk.sourceRef.id,
        owner: chunk.sourceType,
        authorityLevel: evidenceAuthority(chunk.authority.level),
        freshness: chunk.freshness.indexedAt,
        contentHash: chunk.content.hash,
      },
      privacyScope,
      metadata: {
        chunkId: chunk.id,
        sourceType: chunk.sourceType,
        family: chunk.family,
        spanKind: chunk.spanRef.kind,
        confidence: chunk.confidence,
        freshnessBucket: chunk.authority.freshnessBucket,
        resourceId: chunk.sourceRef.resourceId ?? chunk.resourceProjection?.resourceId ?? null,
        segmentRef: chunk.resourceProjection?.segmentRef ?? null,
        citationTargetId: citationTargetRef,
        pathEligibility: chunk.resourceProjection?.pathEligibility ?? null,
        graphCoverageMatched: input.coverageRefs
          ? chunkMatchesGraphCoverageRefs(chunk, input.coverageRefs, input.linkedResources ?? [])
          : null,
        graphCoverageRefs: uniqueSorted(input.coverageRefs ?? []),
      },
    }],
    entities: [sourceEntity, ...graphEntities, ...citationEntities],
    relations: [
      relation(sarEventId, sourceEntity.id, 'generated-from', 'learning-evidence-source-ref'),
      ...graphEntities.map((graphEntity) => relation(sarEventId, graphEntity.id, 'evidence-for', 'learning-evidence-graph-ref')),
      ...citationEntities.map((citationEntity) => relation(sarEventId, citationEntity.id, 'generated-from', 'learning-evidence-citation-target')),
    ],
    citationTargetRefs: citationTargetRef ? [citationTargetRef] : [],
    retrievalChunkRefs: [chunk.id],
    limitations: evidenceLimitations(chunk),
    versionRefs: versionRefs(chunk.resourceProjection?.versionRefs),
  });
}

export function projectGovernedSummaryToSar(input: GovernedSummarySarProjectionInput): SarRetrievalResult {
  const sarEventId = makeEventId(input.eventType ?? 'learning-fact-summary', input.id);
  const privacyScope = input.privacyScope ?? 'teacher-scoped';
  const limitations = [
    ...(privacyScope === 'student-visible' ? [] : [`privacy-scope-withheld:${privacyScope}`]),
    ...(input.limitations ?? []),
  ];
  const entities = (input.entityRefs ?? []).map((ref) => entity(ref.entityType, ref.canonicalRef, ref.label, {
    aliases: ref.aliases ?? [ref.canonicalRef],
    privacyScope: ref.privacyScope ?? privacyScope,
  }));
  return assembleSarResult({
    id: `sar:result:governed-summary:${input.id}`,
    events: [{
      id: sarEventId,
      eventType: input.eventType ?? 'learning-fact-summary',
      title: input.title,
      safeSummary: safeText(input.summary, input.title),
      sourceRef: {
        id: input.sourceRefId,
        owner: input.sourceOwner,
        authorityLevel: input.authorityLevel ?? 'metadata-projected',
        freshness: input.freshness ?? 'governed-summary',
        contentHash: input.contentHash,
      },
      privacyScope,
      metadata: {
        summaryId: input.id,
      },
    }],
    entities,
    relations: entities.map((summaryEntity, index) => relation(
      sarEventId,
      summaryEntity.id,
      input.entityRefs?.[index]?.role ?? 'about',
      'governed-summary-ref',
    )),
    citationTargetRefs: [...(input.citationTargetRefs ?? [])],
    retrievalChunkRefs: [...(input.retrievalChunkRefs ?? [])],
    limitations,
    versionRefs: [...(input.versionRefs ?? ['sar-projection.v1'])],
  });
}

function assembleSarResult(input: {
  id: string;
  events: SarRetrievalEvent[];
  entities: SarRetrievalEntity[];
  relations: SarRetrievalEventEntity[];
  citationTargetRefs?: string[];
  retrievalChunkRefs?: string[];
  limitations?: string[];
  versionRefs?: string[];
}): SarRetrievalResult {
  const events = uniqueById(input.events);
  const entities = uniqueById(input.entities);
  const entityIds = new Set(entities.map((item) => item.id));
  const relations = uniqueRelations(input.relations.filter((item) => entityIds.has(item.entityId)));
  const seedEntityIds = entities.length > 0 ? [entities[0].id] : [];
  const citationTargetRefs = input.citationTargetRefs ?? [];
  const retrievalChunkRefs = input.retrievalChunkRefs ?? [];
  const limitations = input.limitations ?? [];
  const versionRefValues = input.versionRefs ?? ['sar-projection.v1'];
  const selectedRefs = uniqueSorted([
    ...events.map((event) => event.id),
    ...entities.map((item) => item.id),
    ...citationTargetRefs,
    ...retrievalChunkRefs,
  ]);
  const diagnosticLimitations = [
    ...limitations,
    ...(entities.length === 0 ? events.map((event) => `unbound-event:${event.id}`) : []),
  ];
  const trace: SarRetrievalTrace = {
    id: input.id.replace('sar:result:', 'sar:trace:'),
    seedEntityIds,
    expansionHops: seedEntityIds.length === 0
      ? []
      : relations.map((item) => ({
        fromEntityId: seedEntityIds[0],
        toEntityId: item.entityId,
        viaEventId: item.eventId,
        relationRole: item.role,
        confidence: item.confidence,
      })),
    selectedRefs,
    rejectedRefs: [],
    limitations: uniqueSorted(diagnosticLimitations),
    versionRefs: uniqueSorted(versionRefValues),
  };
  return {
    id: input.id,
    trace,
    events,
    entities,
    relations,
    citationTargetRefs: uniqueSorted(citationTargetRefs),
    retrievalChunkRefs: uniqueSorted(retrievalChunkRefs),
    limitations: uniqueSorted(diagnosticLimitations),
  };
}

function entity(
  entityType: SarEntityType,
  ref: string,
  label: string,
  options: {
    canonicalRef?: string;
    aliases?: readonly string[];
    privacyScope?: SarPrivacyScope;
  } = {},
): SarRetrievalEntity {
  return {
    id: entityId(entityType, options.canonicalRef ?? ref),
    entityType,
    canonicalRef: options.canonicalRef ?? ref,
    label: safeText(label, ref),
    aliases: uniqueSorted(options.aliases ?? [ref]),
    privacyScope: options.privacyScope ?? 'student-visible',
    extraction: 'platform-stable-id',
  };
}

function relation(
  eventIdValue: string,
  entityIdValue: string,
  role: SarRelationRole,
  source: string,
): SarRetrievalEventEntity {
  return {
    eventId: eventIdValue,
    entityId: entityIdValue,
    role,
    confidence: 1,
    provenance: 'deterministic-id',
    source,
  };
}

function makeEventId(type: string, ref: string): string {
  return `sar:event:${type}:${ref}`;
}

function entityId(type: string, ref: string): string {
  return `sar:entity:${type}:${ref}`;
}

function safeText(value: string | null | undefined, fallback: string): string {
  const text = (value ?? '').trim();
  return text.length > 0 ? text : fallback;
}

function graphNodeAliases(node: KaqGraphNode): string[] {
  if (node.domain === 'knowledge') return uniqueSorted([node.id, ...node.knowledgeRefs]);
  if (node.domain === 'capability') return uniqueSorted([node.id, ...node.knowledgeNodeIds, node.bloomLevel]);
  return uniqueSorted([node.id, node.scenario]);
}

function goalSubgraphMismatchLimitations(
  expandedSubgraph: ExpandedGoalSubgraph,
  goal: LearningGoalDefinition,
): string[] {
  const limitations: string[] = [];
  if (expandedSubgraph.learningGoalId !== goal.id) {
    limitations.push(`goal-subgraph-mismatch:learningGoalId:${expandedSubgraph.learningGoalId}`);
  }
  if (expandedSubgraph.learningGoalVersion !== goal.version) {
    limitations.push(`goal-subgraph-mismatch:learningGoalVersion:${expandedSubgraph.learningGoalVersion}`);
  }
  return limitations;
}

function safeEvidenceSummary(chunk: LearningEvidenceCorpusChunk): string {
  if (chunk.privacyClass === 'public' && chunk.content.redactedSummary) return chunk.content.redactedSummary;
  return safeText(chunk.content.redactedSummary ?? chunk.display.capsule, chunk.display.title);
}

function evidenceLimitations(chunk: LearningEvidenceCorpusChunk): string[] {
  const limitations: string[] = [];
  if (chunk.privacyClass !== 'public') limitations.push(`privacy-scope-withheld:${chunk.privacyClass}`);
  if (!chunk.resourceProjection?.citationTargetRef) limitations.push(`missing-citation-target:${chunk.id}`);
  if (chunk.resourceProjection?.citationReadiness) {
    limitations.push(...chunk.resourceProjection.citationReadiness.limitations);
  }
  if (chunk.resourceProjection?.pathEligibility && !chunk.resourceProjection.pathEligibility.eligible) {
    limitations.push(`path-omitted:${chunk.resourceProjection.pathEligibility.reason ?? chunk.id}`);
  }
  return limitations;
}

function projectionStatusLimitations(
  resourceNodeId: string,
  status: ResourceSemanticProjection['resource']['projectionStatus'],
): string[] {
  return Object.entries(status)
    .filter(([, value]) => value !== 'mapped')
    .map(([key, value]) => `provisional-metadata:${resourceNodeId}:${key}:${value}`);
}

function evidencePrivacyScope(privacyClass: LearningEvidenceCorpusPrivacyClass): SarPrivacyScope {
  switch (privacyClass) {
    case 'public':
    case 'student-visible':
      return 'student-visible';
    case 'teacher-visible':
      return 'teacher-scoped';
    case 'admin-only':
      return 'admin-scoped';
    case 'service-only':
      return 'system-internal';
  }
}

function strictestPrivacyScope(defaultScope: SarPrivacyScope, requestedScope?: SarPrivacyScope): SarPrivacyScope {
  if (!requestedScope) return defaultScope;
  return privacyScopeRank(requestedScope) > privacyScopeRank(defaultScope) ? requestedScope : defaultScope;
}

function privacyScopeRank(scope: SarPrivacyScope): number {
  switch (scope) {
    case 'student-visible':
      return 0;
    case 'teacher-scoped':
      return 1;
    case 'admin-scoped':
      return 2;
    case 'audit-only':
      return 3;
    case 'system-internal':
      return 4;
  }
}

function evidenceAuthority(level: LearningEvidenceAuthorityLevel): SarAuthorityLevel {
  switch (level) {
    case 'canonical':
    case 'verified':
      return 'platform-verified';
    case 'teacher-authored':
      return 'teacher-approved';
    case 'contextual':
    case 'learner-evidence':
    case 'service-internal':
      return 'metadata-projected';
  }
}

function versionRefs(refs?: Partial<KaqArtifactVersionRefs> | null): string[] {
  return Object.values(buildKaqArtifactVersionRefs(refs ?? {}))
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function uniqueRelations(items: readonly SarRetrievalEventEntity[]): SarRetrievalEventEntity[] {
  const seen = new Set<string>();
  const result: SarRetrievalEventEntity[] = [];
  for (const item of items) {
    const key = `${item.eventId}|${item.entityId}|${item.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
    .sort((left, right) => left.localeCompare(right));
}
