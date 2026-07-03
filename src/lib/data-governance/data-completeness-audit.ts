import { createHash } from 'node:crypto';

import {
  auditResourcePathPlanningDisposition,
  buildResourceNodeHighConfidencePlanningAudit,
  buildResourceSemanticProjection,
  isResourcePathPlanningDispositionHumanReviewed,
  type ResourceNode,
  type ResourceNodeRegistry,
} from '@/lib/resource-node-registry';
import type { LearningEvidenceCorpusChunk } from './learning-evidence-rag-corpus';

export type DataCompletenessLayerId =
  | 'graphCore'
  | 'resourceBinding'
  | 'resourceDisposition'
  | 'citationReadiness'
  | 'pathReadiness'
  | 'evidenceLineage'
  | 'learnerFixtureReadiness';

export type DataCompletenessSeverity = 'blocked' | 'partial' | 'advisory';

export interface DataCompletenessFinding {
  id: string;
  severity: DataCompletenessSeverity;
  stableRef: string;
  message: string;
  followupBucket: string;
}

export interface DataCompletenessLayerSummary {
  id: DataCompletenessLayerId;
  label: string;
  severity: DataCompletenessSeverity;
  totals: Record<string, number>;
  findings: DataCompletenessFinding[];
}

export interface DataCompletenessKnowledgeNodeInput {
  id: string;
  name: string;
  description?: string | null;
  tags?: string[];
  resources?: unknown;
  isActive?: boolean | null;
  sourceLinkCount?: number;
  targetLinkCount?: number;
}

export interface DataCompletenessTeachingResourceInput {
  id: string;
  title: string;
  registryId?: string | null;
  description?: string | null;
  knowledgeNodeIds?: string[];
}

export interface DataCompletenessInteractionLogInput {
  id: string;
  userId?: string | null;
  eventType: string;
  clientEventId?: string | null;
  attemptKey?: string | null;
  resourceKey?: string | null;
  sourceLogId?: string | null;
  clientEventAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface DataCompletenessLearningEventBatchInput {
  id: string;
  eventCount: number;
  processedAt?: Date | string | null;
}

export interface DataCompletenessLearningFactInput {
  id: string;
  userId: string;
  factType: string;
  sourceEventId?: string | null;
  sourceLogId?: string | null;
  sessionId?: string | null;
  startedAt?: Date | string | null;
  contextJson?: unknown;
}

export interface DataCompletenessDerivedEvidenceInput {
  userId: string;
}

export interface DataCompletenessFeatureCacheInput {
  userId: string;
  sourceFactCount?: number;
  sourceCoverage?: unknown;
  refreshedAt?: Date | string | null;
  statusMarkers?: string[];
}

export interface DataCompletenessLearnerCandidateInput {
  userId: string;
  name?: string | null;
  email?: string | null;
  studentNumber?: string | null;
  learningFactCount?: number;
  knowledgeProgressCount?: number;
  pathExecutionCount?: number;
  pathExecutionEvidenceRefCount?: number;
  competencySnapshotCount?: number;
  profileSummaryCount?: number;
  featureCache?: {
    sourceFactCount?: number;
    sourceCoverage?: unknown;
    refreshedAt?: Date | string | null;
    statusMarkers?: string[];
  } | null;
  adaptiveAssessmentStateCount?: number;
}

export interface DataCompletenessRuntimeArtifactErrorInput {
  id: string;
  message: string;
}

export type DataCompletenessHistoricalSourceLogInput =
  | string
  | {
      id: string;
      userId?: string | null;
    };

export interface DataCompletenessAuditInput {
  generatedAt?: string;
  knowledgeNodes?: DataCompletenessKnowledgeNodeInput[];
  teachingResources?: DataCompletenessTeachingResourceInput[];
  resourceRegistry?: ResourceNodeRegistry;
  runtimeArtifactErrors?: DataCompletenessRuntimeArtifactErrorInput[];
  evidenceCorpus?: LearningEvidenceCorpusChunk[];
  interactionLogs?: DataCompletenessInteractionLogInput[];
  eventDictionaryTypes?: string[];
  learningEventBatches?: DataCompletenessLearningEventBatchInput[];
  learningFacts?: DataCompletenessLearningFactInput[];
  historicalSourceLogIds?: DataCompletenessHistoricalSourceLogInput[];
  studentCompetencySnapshots?: DataCompletenessDerivedEvidenceInput[];
  studentProfileSummaries?: DataCompletenessDerivedEvidenceInput[];
  studentEvidenceFeatureCaches?: DataCompletenessFeatureCacheInput[];
  learnerCandidates?: DataCompletenessLearnerCandidateInput[];
  canonicalLearner?: {
    displayName: string;
    email?: string | null;
    studentNumber?: string | null;
  };
}

export interface DataCompletenessAuditReport {
  generatedAt: string;
  contractVersion: 'data-completeness-audit.v1';
  privacy: {
    mode: 'minimized';
    identifierHash: 'sha256:12';
    rawPayloadsIncluded: false;
  };
  layers: DataCompletenessLayerSummary[];
  learnerFixture: {
    displayLabel: 'canonical-fixture-account';
    displayNameHash: string | null;
    canonical: MaskedLearnerCandidate | null;
    duplicates: MaskedLearnerCandidate[];
    fixtureGenerationBlocked: boolean;
    blockers: string[];
  };
  followupBuckets: string[];
}

export interface MaskedLearnerCandidate {
  maskedUserId: string;
  displayNameHash: string | null;
  emailHash: string | null;
  studentNumberHash: string | null;
  learningFactCount: number;
  knowledgeProgressCount: number;
  pathExecutionCount: number;
  pathExecutionEvidenceRefCount: number;
  competencySnapshotCount: number;
  profileSummaryCount: number;
  featureCacheSourceFactCount: number;
  featureCacheHasCoverage: boolean;
  adaptiveAssessmentStateCount: number;
}

const LAYER_LABELS: Record<DataCompletenessLayerId, string> = {
  graphCore: 'Graph core',
  resourceBinding: 'Resource binding',
  resourceDisposition: 'Resource disposition',
  citationReadiness: 'Citation readiness',
  pathReadiness: 'Path readiness',
  evidenceLineage: 'Evidence lineage',
  learnerFixtureReadiness: 'Learner fixture readiness',
};

const GOVERNED_HISTORICAL_SOURCE_PREFIXES = [
  'historical:StudentStepResponse:',
  'historical:SimulationLog:',
  'historical:UserAnswer:',
  'historical:AIIntervention:',
  'historical:AbilityAssessment:',
  'historical:PromptAssessment:',
  'historical:DesignSession:',
  'historical:ArenaSubmission:',
  'historical:ArenaEvaluationRun:',
];

interface HistoricalSourceLogIndex {
  ids: Set<string>;
  globalIds: Set<string>;
  idsByUser: Map<string, Set<string>>;
}

const EMPTY_HISTORICAL_SOURCE_LOG_INDEX: HistoricalSourceLogIndex = {
  ids: new Set(),
  globalIds: new Set(),
  idsByUser: new Map(),
};

export function buildDataCompletenessAuditReport(input: DataCompletenessAuditInput): DataCompletenessAuditReport {
  const graphCore = buildGraphCoreLayer(input.knowledgeNodes ?? []);
  const resourceBinding = buildResourceBindingLayer(
    input.teachingResources ?? [],
    input.resourceRegistry,
    input.runtimeArtifactErrors ?? [],
  );
  const resourceDisposition = buildResourceDispositionLayer(input.resourceRegistry, input.evidenceCorpus ?? []);
  const citationReadiness = buildCitationReadinessLayer(input.resourceRegistry, input.evidenceCorpus ?? []);
  const pathReadiness = buildPathReadinessLayer(input.resourceRegistry);
  const evidenceLineage = buildEvidenceLineageLayer(input);
  const learnerFixtureReadiness = buildLearnerFixtureLayer(input, [resourceBinding, pathReadiness], evidenceLineage);
  const layers = [
    graphCore,
    resourceBinding,
    resourceDisposition,
    citationReadiness,
    pathReadiness,
    evidenceLineage,
    learnerFixtureReadiness.layer,
  ];

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    contractVersion: 'data-completeness-audit.v1',
    privacy: {
      mode: 'minimized',
      identifierHash: 'sha256:12',
      rawPayloadsIncluded: false,
    },
    layers,
    learnerFixture: learnerFixtureReadiness.fixture,
    followupBuckets: uniqueSorted(layers.flatMap((layer) => layer.findings.map((finding) => finding.followupBucket))),
  };
}

export function renderDataCompletenessAuditMarkdown(report: DataCompletenessAuditReport): string {
  const lines = [
    `# Data Completeness Audit`,
    '',
    `Generated: ${report.generatedAt}`,
    `Privacy: ${report.privacy.mode}, raw payloads included: ${String(report.privacy.rawPayloadsIncluded)}`,
    '',
  ];

  for (const layer of report.layers) {
    lines.push(`## ${layer.label}`);
    lines.push(`Severity: ${layer.severity}`);
    lines.push(`Totals: ${JSON.stringify(layer.totals)}`);
    if (layer.findings.length === 0) {
      lines.push('Findings: none');
    } else {
      for (const finding of layer.findings.slice(0, 20)) {
        lines.push(`- [${finding.severity}] ${finding.id} ${finding.stableRef}: ${finding.message}`);
      }
      if (layer.findings.length > 20) {
        lines.push(`- truncated ${layer.findings.length - 20} additional findings`);
      }
    }
    lines.push('');
  }

  lines.push('## Learner Fixture');
  lines.push(`Display: ${report.learnerFixture.displayLabel}`);
  lines.push(`Display name hash: ${report.learnerFixture.displayNameHash ?? 'missing'}`);
  lines.push(`Canonical: ${report.learnerFixture.canonical?.maskedUserId ?? 'missing'}`);
  lines.push(`Duplicates: ${report.learnerFixture.duplicates.length}`);
  lines.push(`Fixture generation blocked: ${String(report.learnerFixture.fixtureGenerationBlocked)}`);
  lines.push(`Blockers: ${report.learnerFixture.blockers.join(', ') || 'none'}`);
  return `${lines.join('\n')}\n`;
}

function buildGraphCoreLayer(nodes: DataCompletenessKnowledgeNodeInput[]): DataCompletenessLayerSummary {
  const activeNodes = nodes.filter((node) => node.isActive !== false);
  const findings = activeNodes.flatMap((node): DataCompletenessFinding[] => {
    const resourceCount = Array.isArray(node.resources) ? node.resources.length : 0;
    return [
      !node.description?.trim()
        ? finding('graph-node-description-missing', 'partial', `KnowledgeNode:${node.id}`, `${node.name} lacks a description.`, 'complete-graph-core-fields')
        : null,
      (node.tags ?? []).length === 0
        ? finding('graph-node-tags-missing', 'advisory', `KnowledgeNode:${node.id}`, `${node.name} has no tags.`, 'complete-graph-core-fields')
        : null,
      (node.sourceLinkCount ?? 0) + (node.targetLinkCount ?? 0) === 0
        ? finding('graph-node-edge-isolated', 'partial', `KnowledgeNode:${node.id}`, `${node.name} has no graph edges.`, 'complete-graph-edges')
        : null,
      resourceCount === 0
        ? finding('graph-node-resource-missing', 'partial', `KnowledgeNode:${node.id}`, `${node.name} has no resource refs.`, 'bind-graph-resources')
        : null,
    ].filter(Boolean) as DataCompletenessFinding[];
  });

  return layer('graphCore', {
    activeNodes: activeNodes.length,
    missingDescription: countFindings(findings, 'graph-node-description-missing'),
    missingTags: countFindings(findings, 'graph-node-tags-missing'),
    isolatedNodes: countFindings(findings, 'graph-node-edge-isolated'),
    missingResourceRefs: countFindings(findings, 'graph-node-resource-missing'),
  }, findings);
}

function buildResourceBindingLayer(
  resources: DataCompletenessTeachingResourceInput[],
  registry: ResourceNodeRegistry | undefined,
  runtimeArtifactErrors: DataCompletenessRuntimeArtifactErrorInput[],
): DataCompletenessLayerSummary {
  const registeredResourceIds = collectRegisteredResourceIds(registry);
  const registryFindings = buildPathAuditEntries(registry).flatMap(({ node, audit }) =>
    audit.pathEligible
      ? []
      : audit.issues.map((issue) => (
        finding(issue.code, issue.severity === 'blocking' ? 'blocked' : 'partial', `ResourceNode:${node.id}`, `${node.title} is not path eligible: ${issue.code}.`, 'audit-resource-node-bindings')
      ))
  );
  const resourceFindings = resources.flatMap((resource): DataCompletenessFinding[] => [
    !resource.registryId
      ? finding('teaching-resource-registry-missing', 'partial', `TeachingResource:${resource.id}`, `${resource.title} has no registryId.`, 'bind-teaching-resources')
      : null,
    resource.registryId && registry && !registeredResourceIds.has(resource.registryId)
      ? finding('teaching-resource-registry-unregistered', 'blocked', `TeachingResource:${resource.id}`, `${resource.title} references an unregistered registryId.`, 'bind-teaching-resources')
      : null,
    (resource.knowledgeNodeIds ?? []).length === 0
      ? finding('teaching-resource-knowledge-missing', 'partial', `TeachingResource:${resource.id}`, `${resource.title} has no knowledge-node binding.`, 'bind-teaching-resources')
      : null,
  ].filter(Boolean) as DataCompletenessFinding[]);
  const runtimeArtifactFindings = runtimeArtifactErrors.map((error) => finding(
    'runtime-artifact-unavailable',
    'blocked',
    `RuntimeArtifact:${error.id}`,
    error.message,
    'repair-runtime-artifacts',
  ));
  const findings = [...registryFindings, ...resourceFindings, ...runtimeArtifactFindings];

  return layer('resourceBinding', {
    teachingResources: resources.length,
    resourceNodes: registry?.audit.totalNodes ?? 0,
    pathEligibleNodes: registry?.audit.pathEligibleNodes ?? 0,
    ineligibleNodes: registry?.audit.ineligibleNodes.length ?? 0,
    teachingResourcesMissingRegistry: countFindings(findings, 'teaching-resource-registry-missing'),
    teachingResourcesUnregisteredRegistry: countFindings(findings, 'teaching-resource-registry-unregistered'),
    teachingResourcesMissingKnowledge: countFindings(findings, 'teaching-resource-knowledge-missing'),
    runtimeArtifactErrors: countFindings(findings, 'runtime-artifact-unavailable'),
  }, findings);
}

function buildResourceDispositionLayer(
  registry: ResourceNodeRegistry | undefined,
  evidenceCorpus: LearningEvidenceCorpusChunk[],
): DataCompletenessLayerSummary {
  const nodes = registry?.nodes ?? [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const coveredRefs = collectResourceDispositionCoveredRefs(nodes);
  const registryFindings = nodes.flatMap((node) =>
    auditResourcePathPlanningDisposition(node, { nodesById }).map((issue) => finding(
      issue.code,
      issue.severity === 'blocking' ? 'blocked' : 'partial',
      `ResourceDisposition:${node.sourceKind}:${node.sourceRef}`,
      `${node.title}: ${issue.message}`,
      followupBucketForDispositionIssue(issue.code),
    ))
  );
  const corpusFindings = buildCorpusProjectionDispositionFindings(evidenceCorpus, coveredRefs);
  const findings = [...registryFindings, ...corpusFindings];

  return layer('resourceDisposition', {
    resourceNodes: nodes.length,
    corpusResourceProjections: countCorpusResourceProjections(evidenceCorpus),
    reviewedDispositions: nodes.filter((node) =>
      isResourcePathPlanningDispositionHumanReviewed(node.planningMetadata.pathDisposition)
    ).length,
    missingDisposition: countFindings(findings, 'missing-path-disposition'),
    missingHumanReview: countFindings(findings, 'missing-disposition-review'),
    missingDispositionRationale: countFindings(findings, 'missing-disposition-rationale'),
    missingExclusionRationale: countFindings(findings, 'missing-disposition-rationale'),
    missingParentPlanningUnit: countFindings(findings, 'missing-parent-planning-unit'),
    missingEvidenceInstrumentation: countFindings(findings, 'missing-evidence-instrumentation'),
    invalidPromotion: countFindings(findings, 'invalid-path-disposition-promotion'),
    unmatchedCorpusResourceProjections: corpusFindings.length,
  }, findings);
}

function collectResourceDispositionCoveredRefs(nodes: ResourceNode[]): Set<string> {
  const refs = new Set<string>();
  for (const node of nodes) {
    refs.add(node.id);
    refs.add(`resource:${node.id}`);
    refs.add(node.sourceRef);
    refs.add(`${node.sourceKind}:${node.sourceRef}`);
  }
  return refs;
}

function countCorpusResourceProjections(evidenceCorpus: LearningEvidenceCorpusChunk[]): number {
  return new Set(evidenceCorpus
    .filter((chunk) => Boolean(chunk.resourceProjection))
    .map(corpusProjectionDispositionRef)).size;
}

function buildCorpusProjectionDispositionFindings(
  evidenceCorpus: LearningEvidenceCorpusChunk[],
  coveredRefs: ReadonlySet<string>,
): DataCompletenessFinding[] {
  const findingsByRef = new Map<string, DataCompletenessFinding>();
  for (const chunk of evidenceCorpus) {
    if (!chunk.resourceProjection) continue;
    const projectionRef = corpusProjectionDispositionRef(chunk);
    const hasExplicitProjectionRef = Boolean(chunk.resourceProjection.resourceId);
    if (coveredRefs.has(projectionRef)) {
      continue;
    }
    if (!hasExplicitProjectionRef && (
      coveredRefs.has(chunk.sourceRef.id) || (
        chunk.sourceRef.resourceId && coveredRefs.has(chunk.sourceRef.resourceId)
      )
    )) {
      continue;
    }
    if (findingsByRef.has(projectionRef)) continue;
    findingsByRef.set(projectionRef, finding(
      'missing-path-disposition',
      'partial',
      `ResourceDisposition:corpus:${projectionRef}`,
      `${chunk.display.title} has a corpus resourceProjection but no reviewed path-planning disposition.`,
      'review-resource-path-dispositions',
    ));
  }
  return [...findingsByRef.values()];
}

function corpusProjectionDispositionRef(chunk: LearningEvidenceCorpusChunk): string {
  return chunk.resourceProjection?.resourceId ??
    chunk.sourceRef.resourceId ??
    chunk.sourceRef.id ??
    chunk.id;
}

function followupBucketForDispositionIssue(code: string): string {
  if (code === 'missing-parent-planning-unit') return 'link-embedded-resource-parents';
  if (code === 'missing-disposition-rationale') return 'review-resource-disposition-rationales';
  if (code === 'missing-evidence-instrumentation') return 'instrument-evidence-producing-resources';
  if (code === 'invalid-path-disposition-promotion') return 'audit-path-disposition-promotions';
  return 'review-resource-path-dispositions';
}

function buildCitationReadinessLayer(
  registry: ResourceNodeRegistry | undefined,
  evidenceCorpus: LearningEvidenceCorpusChunk[],
): DataCompletenessLayerSummary {
  const projections = (registry?.nodes ?? [])
    .filter(isCitationAuditCandidate)
    .map(buildResourceSemanticProjection);
  const citationTargets = projections.flatMap((projection) => projection.citationTargets);
  const retrievalChunks = projections.flatMap((projection) => projection.retrievalChunks);
  const chunksMissingCitationAddress = evidenceCorpus.filter((chunk) => !chunk.citationAddress);
  const findings = [
    ...citationTargets
      .filter((target) => target.status !== 'resolvable' || !target.readiness.verified)
      .map((target) => finding(
        target.readiness.status,
        target.status === 'missing-target' ? 'blocked' : 'partial',
        target.id,
        `Citation target is ${target.readiness.status}.`,
        'complete-citation-targets',
      )),
    ...retrievalChunks
      .filter((chunk) => chunk.projectionStatus !== 'mapped')
      .map((chunk) => finding('retrieval-chunk-not-indexed', 'partial', chunk.id, `Retrieval chunk is ${chunk.projectionStatus}.`, 'index-retrieval-corpus')),
    ...chunksMissingCitationAddress
      .map((chunk) => finding(
        'corpus-chunk-citation-address-missing',
        'partial',
        `CorpusChunk:${chunk.id}`,
        'Evidence corpus chunk lacks a citation address.',
        'complete-citation-targets',
      )),
  ];

  return layer('citationReadiness', {
    citationTargets: citationTargets.length,
    resolvableCitationTargets: citationTargets.filter((target) => target.status === 'resolvable').length,
    verifiedCitationTargets: citationTargets.filter((target) => target.readiness.verified).length,
    retrievalChunks: retrievalChunks.length,
    mappedRetrievalChunks: retrievalChunks.filter((chunk) => chunk.projectionStatus === 'mapped').length,
    corpusChunks: evidenceCorpus.length,
    corpusChunksWithCitationAddress: evidenceCorpus.filter((chunk) => Boolean(chunk.citationAddress)).length,
    corpusChunksMissingCitationAddress: countFindings(findings, 'corpus-chunk-citation-address-missing'),
  }, findings);
}

function buildPathReadinessLayer(registry: ResourceNodeRegistry | undefined): DataCompletenessLayerSummary {
  const audits = buildPathAuditEntries(registry);
  const findings = audits.flatMap(({ node, audit, projection }) => {
    const issueFindings = audit.issues.map((issue) => finding(
      issue.code,
      issue.severity === 'blocking' ? 'blocked' : 'partial',
      `ResourceNode:${node.id}`,
      issue.message,
      'audit-path-planning-units',
    ));
    if (!projection.planningUnit) return issueFindings;
    if (!projection.planningUnit.readiness) {
      issueFindings.push(finding('planning-unit-readiness-missing', 'partial', projection.planningUnit.id, 'PlanningUnit lacks readiness metadata.', 'audit-path-planning-units'));
    }
    return issueFindings;
  });

  return layer('pathReadiness', {
    resourceNodes: audits.length,
    planningUnits: audits.filter((entry) => Boolean(entry.projection.planningUnit)).length,
    highConfidencePathEligible: audits.filter((entry) => entry.audit.pathEligible).length,
    blockedPathNodes: audits.filter((entry) => !entry.audit.pathEligible).length,
  }, findings);
}

function collectRegisteredResourceIds(registry: ResourceNodeRegistry | undefined): Set<string> {
  const ids = new Set<string>();
  for (const node of registry?.nodes ?? []) {
    if (node.sourceKind === 'resource_registry') {
      ids.add(node.sourceRef);
    }
  }
  return ids;
}

function buildPathAuditEntries(registry: ResourceNodeRegistry | undefined) {
  return (registry?.nodes ?? [])
    .map((node) => ({
      node,
      audit: buildResourceNodeHighConfidencePlanningAudit(node),
      projection: buildResourceSemanticProjection(node),
    }))
    .filter(({ node, projection }) =>
      projection.planningUnit || (isPathAuditCandidate(node) && isPathDispositionAuditCandidate(node))
    );
}

function isPathAuditCandidate(node: ResourceNode): boolean {
  if (node.sourceKind === 'knowledge_graph') return false;
  if (node.sourceKind === 'textbook') return false;
  if (node.sourceKind === 'runtime_lesson_step') return false;
  if (node.sourceKind === 'runtime_handout') return false;
  return node.type !== 'knowledge_node' && node.type !== 'textbook';
}

function isPathDispositionAuditCandidate(node: ResourceNode): boolean {
  const disposition = node.planningMetadata.pathDisposition;
  return !disposition || disposition.kind === 'path-plannable';
}

function isCitationAuditCandidate(node: ResourceNode): boolean {
  if (node.sourceKind === 'knowledge_graph') return false;
  if (node.sourceKind === 'textbook' && node.type === 'textbook') return false;
  return node.type !== 'knowledge_node' && Boolean(node.renderTarget || node.launchTarget || node.sourceKind !== 'textbook');
}

function buildEvidenceLineageLayer(input: DataCompletenessAuditInput): DataCompletenessLayerSummary {
  const eventTypes = new Set(input.eventDictionaryTypes ?? []);
  const logs = input.interactionLogs ?? [];
  const batches = input.learningEventBatches ?? [];
  const facts = input.learningFacts ?? [];
  const snapshots = input.studentCompetencySnapshots ?? [];
  const summaries = input.studentProfileSummaries ?? [];
  const caches = input.studentEvidenceFeatureCaches ?? [];
  const generatedAt = parseDate(input.generatedAt) ?? new Date();
  const historicalSourceLogIndex = buildHistoricalSourceLogIndex(input.historicalSourceLogIds ?? []);
  const factUsers = uniqueSorted(facts.map((fact) => fact.userId));
  const snapshotUsers = new Set(snapshots.map((snapshot) => snapshot.userId));
  const summaryUsers = new Set(summaries.map((summary) => summary.userId));
  const cacheUsers = new Set(caches.map((cache) => cache.userId));
  const logIds = new Set(logs.map((log) => log.id));
  const clientEventIds = logs
    .map((log) => clientEventDedupeKey(log))
    .filter((value): value is string => Boolean(value));
  const clientEventIdCounts = countValues(clientEventIds);
  const sourceEventIndex = buildValidSourceEventIndex(logs);
  const findings = [
    ...logs.filter((log) => !log.clientEventId).map((log) => finding('interaction-log-client-event-id-missing', 'partial', `InteractionLog:${log.id}`, 'InteractionLog lacks clientEventId.', 'repair-source-event-lineage')),
    ...logs.filter((log) => !log.attemptKey).map((log) => finding('interaction-log-attempt-key-missing', 'advisory', `InteractionLog:${log.id}`, 'InteractionLog lacks attemptKey for dedupe grouping.', 'repair-source-event-lineage')),
    ...logs.filter((log) => !log.clientEventAt && !log.createdAt).map((log) => finding('interaction-log-timestamp-missing', 'blocked', `InteractionLog:${log.id}`, 'InteractionLog lacks clientEventAt and createdAt.', 'repair-source-event-lineage')),
    ...Array.from(clientEventIdCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([clientEventIdKey, count]) => finding('interaction-log-client-event-id-duplicate', 'partial', `clientEventId:${hashIdentifier(clientEventIdKey) ?? 'unknown'}`, `${count} InteractionLog rows share one learner-scoped clientEventId.`, 'repair-source-event-lineage')),
    ...logs.filter((log) => !eventTypes.has(log.eventType)).map((log) => finding('event-dictionary-mapping-missing', 'partial', `InteractionLog:${log.id}`, `${log.eventType} is not in EventDictionary.`, 'repair-event-dictionary')),
    ...batches.filter((batch) => !batch.processedAt).map((batch) => finding('learning-event-batch-unprocessed', 'blocked', `LearningEventBatch:${batch.id}`, `${batch.eventCount} source events are not processed.`, 'process-learning-event-batches')),
    ...facts.filter((fact) => !fact.sourceEventId && !fact.sourceLogId).map((fact) => finding('learning-fact-source-ref-missing', 'partial', `LearningFact:${fact.id}`, `${fact.factType} fact lacks sourceEventId/sourceLogId.`, 'repair-learning-fact-attribution')),
    ...facts
      .filter((fact) => hasDanglingLearningFactSourceLog(fact, logIds, sourceEventIndex, historicalSourceLogIndex))
      .map((fact) => finding('learning-fact-source-log-dangling', 'blocked', `LearningFact:${fact.id}`, `${fact.factType} fact references a missing sourceLogId.`, 'repair-learning-fact-attribution')),
    ...facts
      .filter((fact) => hasDanglingLearningFactSourceEvent(fact, sourceEventIndex))
      .map((fact) => finding('learning-fact-source-event-dangling', 'blocked', `LearningFact:${fact.id}`, `${fact.factType} fact references a missing sourceEventId.`, 'repair-learning-fact-attribution')),
    ...factUsers.filter((userId) => !snapshotUsers.has(userId)).map((userId) => finding('student-competency-snapshot-missing', 'partial', maskStableLearnerRef(userId), 'LearningFact user lacks StudentCompetencySnapshot coverage.', 'refresh-competency-snapshots')),
    ...factUsers.filter((userId) => !summaryUsers.has(userId)).map((userId) => finding('student-profile-summary-missing', 'advisory', maskStableLearnerRef(userId), 'LearningFact user lacks StudentProfileSummary coverage.', 'refresh-profile-summaries')),
    ...factUsers.filter((userId) => !cacheUsers.has(userId)).map((userId) => finding('student-evidence-feature-cache-missing', 'partial', maskStableLearnerRef(userId), 'LearningFact user lacks StudentEvidenceFeatureCache coverage.', 'refresh-student-evidence-feature-cache')),
    ...caches.filter((cache) => (cache.sourceFactCount ?? 0) === 0 || !hasCompleteSourceCoverage(cache.sourceCoverage)).map((cache) => finding('student-evidence-feature-cache-source-coverage-missing', 'partial', maskStableLearnerRef(cache.userId), 'StudentEvidenceFeatureCache lacks source fact coverage.', 'refresh-student-evidence-feature-cache')),
    ...caches.filter((cache) => isStaleFeatureCache(cache, generatedAt)).map((cache) => finding('student-evidence-feature-cache-stale', 'partial', maskStableLearnerRef(cache.userId), 'StudentEvidenceFeatureCache is stale and should be refreshed.', 'refresh-student-evidence-feature-cache')),
  ];

  return layer('evidenceLineage', {
    interactionLogs: logs.length,
    interactionLogsMissingClientEventId: countFindings(findings, 'interaction-log-client-event-id-missing'),
    interactionLogsMissingAttemptKey: countFindings(findings, 'interaction-log-attempt-key-missing'),
    interactionLogsMissingTimestamp: countFindings(findings, 'interaction-log-timestamp-missing'),
    duplicateClientEventIds: countFindings(findings, 'interaction-log-client-event-id-duplicate'),
    eventDictionaryTypes: eventTypes.size,
    eventDictionaryMappingMissing: countFindings(findings, 'event-dictionary-mapping-missing'),
    learningEventBatches: batches.length,
    unprocessedLearningEventBatches: countFindings(findings, 'learning-event-batch-unprocessed'),
    learningFacts: facts.length,
    unattributedLearningFacts: countFindings(findings, 'learning-fact-source-ref-missing'),
    danglingLearningFactSourceLogs: countFindings(findings, 'learning-fact-source-log-dangling'),
    danglingLearningFactSourceEvents: countFindings(findings, 'learning-fact-source-event-dangling'),
    learningFactUsers: factUsers.length,
    studentCompetencySnapshots: snapshots.length,
    usersMissingCompetencySnapshots: countFindings(findings, 'student-competency-snapshot-missing'),
    studentProfileSummaries: summaries.length,
    usersMissingProfileSummaries: countFindings(findings, 'student-profile-summary-missing'),
    studentEvidenceFeatureCaches: caches.length,
    usersMissingFeatureCaches: countFindings(findings, 'student-evidence-feature-cache-missing'),
    featureCachesMissingSourceCoverage: countFindings(findings, 'student-evidence-feature-cache-source-coverage-missing'),
    staleFeatureCaches: countFindings(findings, 'student-evidence-feature-cache-stale'),
  }, findings);
}

function buildLearnerFixtureLayer(
  input: DataCompletenessAuditInput,
  blockingDependencyLayers: DataCompletenessLayerSummary[],
  evidenceLineage: DataCompletenessLayerSummary,
) {
  const canonicalSpec = input.canonicalLearner ?? { displayName: 'Yang Fan', studentNumber: '20230010102605' };
  const candidates = input.learnerCandidates ?? [];
  const canonical = candidates.find((candidate) => (
    Boolean(canonicalSpec.email && candidate.email === canonicalSpec.email) ||
    Boolean(canonicalSpec.studentNumber && candidate.studentNumber === canonicalSpec.studentNumber)
  )) ?? null;
  const duplicates = candidates.filter((candidate) => candidate.userId !== canonical?.userId);
  const candidateForChecks = canonical ?? candidates[0] ?? null;
  const findings = [
    !canonical
      ? finding('canonical-learner-missing', 'blocked', 'FixtureLearner:canonical', 'Canonical fixture account was not resolved.', 'resolve-canonical-fixture-account')
      : null,
    duplicates.length > 0
      ? finding('canonical-learner-duplicates-present', 'partial', 'FixtureLearner:duplicates', `${duplicates.length} duplicate candidate account(s) found.`, 'review-fixture-account-duplicates')
      : null,
    candidateForChecks && (candidateForChecks.learningFactCount ?? 0) === 0
      ? finding('fixture-learning-facts-missing', 'blocked', maskStableLearnerRef(candidateForChecks.userId), 'Canonical fixture has no LearningFact rows.', 'materialize-fixture-learning-evidence')
      : null,
    candidateForChecks && (candidateForChecks.knowledgeProgressCount ?? 0) === 0
      ? finding('fixture-knowledge-progress-missing', 'partial', maskStableLearnerRef(candidateForChecks.userId), 'Canonical fixture has no KnowledgeProgress coverage.', 'materialize-fixture-learning-evidence')
      : null,
    candidateForChecks && (candidateForChecks.featureCache?.sourceFactCount ?? 0) === 0
      ? finding('fixture-feature-cache-missing', 'partial', maskStableLearnerRef(candidateForChecks.userId), 'Canonical fixture has no StudentEvidenceFeatureCache source facts.', 'refresh-student-evidence-feature-cache')
      : null,
    candidateForChecks && (candidateForChecks.pathExecutionEvidenceRefCount ?? 0) === 0
      ? finding('fixture-path-evidence-missing', 'partial', maskStableLearnerRef(candidateForChecks.userId), 'Canonical fixture has no path execution evidence refs.', 'materialize-fixture-path-evidence')
      : null,
    candidateForChecks && (candidateForChecks.competencySnapshotCount ?? 0) === 0
      ? finding('fixture-competency-snapshot-missing', 'partial', maskStableLearnerRef(candidateForChecks.userId), 'Canonical fixture has no StudentCompetencySnapshot coverage.', 'refresh-competency-snapshots')
      : null,
    candidateForChecks && (candidateForChecks.profileSummaryCount ?? 0) === 0
      ? finding('fixture-profile-summary-missing', 'advisory', maskStableLearnerRef(candidateForChecks.userId), 'Canonical fixture has no StudentProfileSummary coverage.', 'refresh-profile-summaries')
      : null,
    candidateForChecks && (candidateForChecks.adaptiveAssessmentStateCount ?? 0) === 0
      ? finding('fixture-adaptive-assessment-state-missing', 'partial', maskStableLearnerRef(candidateForChecks.userId), 'Canonical fixture has no adaptive assessment state.', 'materialize-fixture-adaptive-assessment-state')
      : null,
  ].filter(Boolean) as DataCompletenessFinding[];
  const blockers = uniqueSorted([
    ...findings.filter((item) => item.severity === 'blocked').map((item) => item.id),
    ...blockingDependencyLayers.flatMap((dependencyLayer) =>
      dependencyLayer.findings
        .filter((item) => item.severity === 'blocked')
        .map((item) => `${dependencyLayer.id}:${item.id}`)
    ),
    ...buildCanonicalEvidenceLineageBlockers(input, candidateForChecks, evidenceLineage),
  ]);

  return {
    layer: layer('learnerFixtureReadiness', {
      candidateAccounts: candidates.length,
      duplicateCandidates: duplicates.length,
      canonicalResolved: canonical ? 1 : 0,
      learningFacts: candidateForChecks?.learningFactCount ?? 0,
      knowledgeProgress: candidateForChecks?.knowledgeProgressCount ?? 0,
      pathExecutions: candidateForChecks?.pathExecutionCount ?? 0,
      pathExecutionEvidenceRefs: candidateForChecks?.pathExecutionEvidenceRefCount ?? 0,
      competencySnapshots: candidateForChecks?.competencySnapshotCount ?? 0,
      profileSummaries: candidateForChecks?.profileSummaryCount ?? 0,
      featureCacheSourceFacts: candidateForChecks?.featureCache?.sourceFactCount ?? 0,
      adaptiveAssessmentState: candidateForChecks?.adaptiveAssessmentStateCount ?? 0,
    }, findings),
    fixture: {
      displayLabel: 'canonical-fixture-account' as const,
      displayNameHash: hashIdentifier(canonicalSpec.displayName),
      canonical: canonical ? maskLearnerCandidate(canonical) : null,
      duplicates: duplicates.map(maskLearnerCandidate),
      fixtureGenerationBlocked: blockers.length > 0,
      blockers,
    },
  };
}

function buildCanonicalEvidenceLineageBlockers(
  input: DataCompletenessAuditInput,
  candidate: DataCompletenessLearnerCandidateInput | null,
  evidenceLineage: DataCompletenessLayerSummary,
): string[] {
  const canonicalUserId = candidate?.userId ?? null;
  const canonicalLearningFactIds = new Set((input.learningFacts ?? [])
    .filter((fact) => canonicalUserId && fact.userId === canonicalUserId)
    .map((fact) => fact.id));
  const canonicalInteractionLogIds = new Set((input.interactionLogs ?? [])
    .filter((log) => canonicalUserId && log.userId === canonicalUserId)
    .map((log) => log.id));
  const canonicalMaskedRef = canonicalUserId ? maskStableLearnerRef(canonicalUserId) : null;

  return evidenceLineage.findings
    .filter((item) => item.severity === 'blocked')
    .filter((item) => {
      if (item.id === 'learning-event-batch-unprocessed') return true;
      if (canonicalMaskedRef && item.stableRef === canonicalMaskedRef) return true;
      const learningFactId = item.stableRef.startsWith('LearningFact:')
        ? item.stableRef.slice('LearningFact:'.length)
        : null;
      if (learningFactId && canonicalLearningFactIds.has(learningFactId)) return true;
      const interactionLogId = item.stableRef.startsWith('InteractionLog:')
        ? item.stableRef.slice('InteractionLog:'.length)
        : null;
      return Boolean(interactionLogId && canonicalInteractionLogIds.has(interactionLogId));
    })
    .map((item) => `evidenceLineage:${item.id}`);
}

function layer(id: DataCompletenessLayerId, totals: Record<string, number>, findings: DataCompletenessFinding[]): DataCompletenessLayerSummary {
  return {
    id,
    label: LAYER_LABELS[id],
    severity: summarizeSeverity(findings),
    totals,
    findings,
  };
}

function finding(id: string, severity: DataCompletenessSeverity, stableRef: string, message: string, followupBucket: string): DataCompletenessFinding {
  return { id, severity, stableRef, message, followupBucket };
}

function summarizeSeverity(findings: DataCompletenessFinding[]): DataCompletenessSeverity {
  if (findings.some((finding) => finding.severity === 'blocked')) return 'blocked';
  if (findings.some((finding) => finding.severity === 'partial')) return 'partial';
  return 'advisory';
}

function countFindings(findings: DataCompletenessFinding[], id: string): number {
  return findings.filter((finding) => finding.id === id).length;
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function clientEventDedupeKey(log: DataCompletenessInteractionLogInput): string | null {
  const userId = normalizeKey(log.userId);
  const clientEventId = normalizeKey(log.clientEventId);
  if (!userId || !clientEventId) return null;
  return `${userId}:${clientEventId}`;
}

function buildValidSourceEventIndex(logs: DataCompletenessInteractionLogInput[]): {
  logDerivedIds: Set<string>;
  logIdsByUser: Map<string, Set<string>>;
  clientEventIdsByUser: Map<string, Set<string>>;
} {
  const logDerivedIds = new Set<string>();
  const logIdsByUser = new Map<string, Set<string>>();
  const clientEventIdsByUser = new Map<string, Set<string>>();
  for (const log of logs) {
    const id = normalizeKey(log.id);
    const userId = normalizeKey(log.userId);
    if (id) {
      logDerivedIds.add(id);
      logDerivedIds.add(`interaction-log:${id}`);
      logDerivedIds.add(`historical:InteractionLog:${id}`);
      if (log.eventType) {
        logDerivedIds.add(`historical:InteractionLog:${id}:${log.eventType}`);
      }
      if (userId) {
        const ids = logIdsByUser.get(userId) ?? new Set<string>();
        ids.add(id);
        ids.add(`interaction-log:${id}`);
        ids.add(`historical:InteractionLog:${id}`);
        if (log.eventType) {
          ids.add(`historical:InteractionLog:${id}:${log.eventType}`);
        }
        logIdsByUser.set(userId, ids);
      }
    }
    const clientEventId = normalizeKey(log.clientEventId);
    if (clientEventId && userId) {
      const ids = clientEventIdsByUser.get(userId) ?? new Set<string>();
      ids.add(clientEventId);
      clientEventIdsByUser.set(userId, ids);
    }
  }
  return { logDerivedIds, logIdsByUser, clientEventIdsByUser };
}

function buildHistoricalSourceLogIndex(logs: DataCompletenessHistoricalSourceLogInput[]): HistoricalSourceLogIndex {
  const ids = new Set<string>();
  const globalIds = new Set<string>();
  const idsByUser = new Map<string, Set<string>>();
  for (const log of logs) {
    const id = normalizeHistoricalSourceLogId(log);
    if (!id) continue;
    ids.add(id);
    if (typeof log === 'string') {
      globalIds.add(id);
      continue;
    }
    const userId = normalizeKey(log.userId);
    if (!userId) {
      globalIds.add(id);
      continue;
    }
    const userIds = idsByUser.get(userId) ?? new Set<string>();
    userIds.add(id);
    idsByUser.set(userId, userIds);
  }
  return { ids, globalIds, idsByUser };
}

function normalizeHistoricalSourceLogId(log: DataCompletenessHistoricalSourceLogInput): string | null {
  return typeof log === 'string' ? normalizeKey(log) : normalizeKey(log.id);
}

function hasDanglingLearningFactSourceLog(
  fact: DataCompletenessLearningFactInput,
  logIds: Set<string>,
  sourceEventIndex: ReturnType<typeof buildValidSourceEventIndex>,
  historicalSourceLogIndex: HistoricalSourceLogIndex,
): boolean {
  const sourceLogId = normalizeKey(fact.sourceLogId);
  if (!sourceLogId) return false;
  const factUserId = normalizeKey(fact.userId);
  if (factUserId && sourceEventIndex.logIdsByUser.get(factUserId)?.has(sourceLogId)) return false;
  if (!factUserId && logIds.has(sourceLogId)) return false;
  if (logIds.has(sourceLogId) || sourceEventIndex.logDerivedIds.has(sourceLogId)) return true;
  return classifyLearningFactSource(fact, sourceEventIndex, historicalSourceLogIndex) !== 'governed-external';
}

function hasDanglingLearningFactSourceEvent(
  fact: DataCompletenessLearningFactInput,
  sourceEventIndex: ReturnType<typeof buildValidSourceEventIndex>,
): boolean {
  const sourceEventId = normalizeKey(fact.sourceEventId);
  if (!sourceEventId) return false;
  const factUserId = normalizeKey(fact.userId);
  if (factUserId && sourceEventIndex.logIdsByUser.get(factUserId)?.has(sourceEventId)) return false;
  if (!factUserId && sourceEventIndex.logDerivedIds.has(sourceEventId)) return false;
  if (factUserId && sourceEventIndex.clientEventIdsByUser.get(factUserId)?.has(sourceEventId)) return false;
  if (sourceEventIndex.logDerivedIds.has(sourceEventId) || isInteractionLogSourceEventId(sourceEventId)) return true;
  return classifyLearningFactSource(fact, sourceEventIndex, EMPTY_HISTORICAL_SOURCE_LOG_INDEX) !== 'governed-external';
}

function classifyLearningFactSource(
  fact: DataCompletenessLearningFactInput,
  sourceEventIndex: ReturnType<typeof buildValidSourceEventIndex>,
  historicalSourceLogIndex: HistoricalSourceLogIndex,
): 'interaction-log' | 'governed-external' | 'unknown' {
  const sourceEventId = normalizeKey(fact.sourceEventId);
  const sourceLogId = normalizeKey(fact.sourceLogId);
  if (!sourceEventId) {
    return isKnownHistoricalSourceLog(fact, sourceLogId ?? '', historicalSourceLogIndex)
      ? 'governed-external'
      : 'unknown';
  }
  const factUserId = normalizeKey(fact.userId);
  if (factUserId && sourceEventIndex.logIdsByUser.get(factUserId)?.has(sourceEventId)) return 'interaction-log';
  if (!factUserId && sourceEventIndex.logDerivedIds.has(sourceEventId)) return 'interaction-log';
  if (factUserId && sourceEventIndex.clientEventIdsByUser.get(factUserId)?.has(sourceEventId)) return 'interaction-log';
  if (isInteractionLogSourceEventId(sourceEventId)) {
    return 'interaction-log';
  }
  if (
    sourceEventId.startsWith('arena-official:') ||
    sourceEventId.startsWith('simulation-agent-evidence:') ||
    sourceEventId.startsWith('adaptive-assessment:') ||
    GOVERNED_HISTORICAL_SOURCE_PREFIXES.some((prefix) => sourceEventId.startsWith(prefix)) ||
    sourceEventId.startsWith('control-correction-path:') ||
    sourceEventId.startsWith('learning-path:')
  ) {
    return 'governed-external';
  }
  if (isArenaPreviewLearningFact(fact, sourceEventId)) return 'governed-external';
  return 'unknown';
}

function isKnownHistoricalSourceLog(
  fact: DataCompletenessLearningFactInput,
  sourceLogId: string,
  historicalSourceLogIndex: HistoricalSourceLogIndex,
): boolean {
  if (!sourceLogId) return false;
  if (GOVERNED_HISTORICAL_SOURCE_PREFIXES.some((prefix) => sourceLogId.startsWith(prefix))) return true;
  if (historicalSourceLogIndex.ids.has(sourceLogId)) {
    const ownedIds = Array.from(historicalSourceLogIndex.idsByUser.values());
    const hasKnownOwner = ownedIds.some((ids) => ids.has(sourceLogId));
    if (!hasKnownOwner && historicalSourceLogIndex.globalIds.has(sourceLogId)) return true;
    const factUserId = normalizeKey(fact.userId);
    if (!factUserId) return true;
    const knownOwnerIds = historicalSourceLogIndex.idsByUser.get(factUserId);
    return knownOwnerIds ? knownOwnerIds.has(sourceLogId) : historicalSourceLogIndex.idsByUser.size === 0;
  }
  const context = readRecord(fact.contextJson);
  const materialization = readRecord(context.historicalMaterialization);
  const sourceId = normalizeUnknownString(materialization.sourceId);
  const sourceRecordId = normalizeUnknownString(materialization.sourceRecordId);
  return Boolean(sourceId && sourceRecordId === sourceLogId);
}

function isInteractionLogSourceEventId(sourceEventId: string): boolean {
  return sourceEventId.startsWith('interaction-log:')
    || sourceEventId.startsWith('historical:InteractionLog:');
}

function isArenaPreviewLearningFact(fact: DataCompletenessLearningFactInput, sourceEventId: string): boolean {
  const context = readRecord(fact.contextJson);
  const arena = readRecord(context.arena);
  return fact.factType === 'arena_preview' ||
    sourceEventId.includes('arena_simulation_run') ||
    sourceEventId.includes('arena_virtual_simulation_import') ||
    Object.keys(arena).length > 0;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeKey(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeUnknownString(value: unknown): string | null {
  return typeof value === 'string' ? normalizeKey(value) : null;
}

function maskLearnerCandidate(candidate: DataCompletenessLearnerCandidateInput): MaskedLearnerCandidate {
  return {
    maskedUserId: maskStableLearnerRef(candidate.userId),
    displayNameHash: hashIdentifier(candidate.name),
    emailHash: hashIdentifier(candidate.email),
    studentNumberHash: hashIdentifier(candidate.studentNumber),
    learningFactCount: candidate.learningFactCount ?? 0,
    knowledgeProgressCount: candidate.knowledgeProgressCount ?? 0,
    pathExecutionCount: candidate.pathExecutionCount ?? 0,
    pathExecutionEvidenceRefCount: candidate.pathExecutionEvidenceRefCount ?? 0,
    competencySnapshotCount: candidate.competencySnapshotCount ?? 0,
    profileSummaryCount: candidate.profileSummaryCount ?? 0,
    featureCacheSourceFactCount: candidate.featureCache?.sourceFactCount ?? 0,
    featureCacheHasCoverage: hasCompleteSourceCoverage(candidate.featureCache?.sourceCoverage),
    adaptiveAssessmentStateCount: candidate.adaptiveAssessmentStateCount ?? 0,
  };
}

function maskStableLearnerRef(value: string): string {
  return `Learner:${hashIdentifier(value) ?? 'unknown'}`;
}

function hashIdentifier(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return `sha256:${createHash('sha256').update(normalized).digest('hex').slice(0, 12)}`;
}

function hasObjectKeys(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
}

function hasCompleteSourceCoverage(value: unknown): boolean {
  if (!hasObjectKeys(value)) return false;
  return Object.values(value as Record<string, unknown>).every((status) => status === 'available');
}

const FEATURE_CACHE_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function isStaleFeatureCache(cache: DataCompletenessFeatureCacheInput, generatedAt: Date): boolean {
  if (cache.statusMarkers?.includes('stale')) return true;
  const refreshedAt = parseDate(cache.refreshedAt);
  if (!refreshedAt) return true;
  return generatedAt.getTime() - refreshedAt.getTime() > FEATURE_CACHE_STALE_AFTER_MS;
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}
