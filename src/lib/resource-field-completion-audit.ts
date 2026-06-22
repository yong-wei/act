import {
  buildKaqArtifactVersionRefs,
  RESOURCE_NODE_REGISTRY_VERSION,
  RESOURCE_SEMANTIC_PROJECTION_VERSION,
  type KaqArtifactVersionRefs,
} from './kaq-artifact-versioning';
import {
  buildResourceNodeHighConfidencePlanningAudit,
  buildResourceSemanticProjection,
  type ResourceNode,
  type ResourceGraphNodeRefs,
  type ResourceNodeRegistry,
  type ResourceNodePrivacyLevel,
} from './resource-node-registry';

export const RESOURCE_FIELD_COMPLETION_AUDIT_VERSION = 'resource-field-completion-audit.v1';

export type ResourceFieldCompletionFamily =
  | 'registered-resource'
  | 'resource-node'
  | 'runtime-lesson-step'
  | 'runtime-lesson-module'
  | 'runtime-lesson-media'
  | 'runtime-handout'
  | 'knowledge-card'
  | 'knowledge-infograph'
  | 'textbook'
  | 'textbook-section'
  | 'textbook-search-document'
  | 'quiz'
  | 'simulation'
  | 'arena'
  | 'checkpoint'
  | 'external-resource'
  | 'authoring-textbook-chapter'
  | 'authoring-textbook-section'
  | 'authoring-textbook-figure'
  | 'authoring-textbook-caption'
  | 'authoring-candidate';

export type ResourceFieldCompletionMethod =
  | 'manual'
  | 'local-model-assisted'
  | 'external-tool-assisted'
  | 'generated-provisional'
  | 'already-governed'
  | 'blocked';

export type ResourceFieldReviewStatus =
  | 'not-reviewed'
  | 'generated-provisional'
  | 'model-assisted-provisional'
  | 'external-tool-provisional'
  | 'human-confirmed'
  | 'blocked'
  | 'stale';

export type ResourceFieldMissingCode =
  | 'missing-stable-id'
  | 'missing-source-path-or-url'
  | 'missing-content-hash'
  | 'missing-version-ref'
  | 'missing-knowledge-binding'
  | 'missing-capability-target'
  | 'missing-quality-target'
  | 'missing-path-target'
  | 'missing-path-profile'
  | 'missing-readiness-gating'
  | 'missing-evidence-instrumentation'
  | 'missing-evidence-contract'
  | 'missing-citation-target'
  | 'missing-segment-ref'
  | 'missing-ai-use-permission'
  | 'missing-human-review'
  | 'provisional-metadata'
  | 'stale-review'
  | 'blocked-by-dependency';

export interface ResourceFieldCompletionCandidate {
  id: string;
  title: string;
  family: ResourceFieldCompletionFamily;
  sourcePathOrUrl: string | null;
  sourceRecord?: string | null;
  knowledgeNodeIds?: string[];
  capabilityTargetIds?: string[];
  qualityTargetIds?: string[];
  segmentRefs?: string[];
  citationTargets?: string[];
  pathTarget?: string | null;
  estimatedTimeMinutes?: number | null;
  evidenceInstrumentation?: string[];
  privacyScope?: ResourceNodePrivacyLevel | null;
  generatedBy?: 'local-model' | 'external-tool' | 'template' | null;
  humanConfirmed?: boolean;
  contentHash?: string | null;
  versionRef?: string | null;
  blockingDependency?: string | null;
  sourceWindow?: ResourceFieldSourceWindow;
}

export interface ResourceEvidenceContractCompleteness {
  eventSource: boolean;
  eventType: boolean;
  clientEventIdPolicy: boolean;
  attemptKey: boolean;
  sourceLogId: boolean;
  dedupeKey: boolean;
  timestamps: boolean;
  learningFactPolicy: boolean;
  confidencePolicy: boolean;
  privacyScope: boolean;
  complete: boolean;
  missingFields: string[];
}

export interface ResourceFieldReviewAudit {
  reviewerId: string | null;
  reviewerRole: string | null;
  reviewedAt: string | null;
  reviewBatchId: string | null;
  reviewedSourceHash: string | null;
  reviewedVersionRef: string | null;
  generationToolOrModel: string | null;
  promptOrManifestHash: string | null;
  confidence: number | null;
  staleInvalidationRule: string;
}

export interface ResourceFieldSourceWindow {
  from: string | null;
  to: string | null;
}

export interface ResourceFieldCompletionAuditRow {
  resourceId: string;
  resourceType: string;
  family: ResourceFieldCompletionFamily;
  title: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string | null;
  pathTarget: string | null;
  estimatedTimeMinutes: number | null;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  citationTargets: string[];
  graphNodeRefs: ResourceGraphNodeRefs;
  missingFieldCodes: ResourceFieldMissingCode[];
  completionMethod: ResourceFieldCompletionMethod;
  reviewStatus: ResourceFieldReviewStatus;
  reviewAudit: ResourceFieldReviewAudit;
  evidenceContract: ResourceEvidenceContractCompleteness;
  pathEligibility: {
    current: boolean;
    afterCompletion: boolean;
    masteryAffecting: boolean;
    blockedBy: ResourceFieldMissingCode[];
  };
  groundingEligibility: {
    retrievalReady: boolean;
    citationReady: boolean;
    authoringTriageReady: boolean;
  };
  coverage: {
    denominatorKey: string;
    sourceWindow: ResourceFieldSourceWindow;
    artifactVersion: typeof RESOURCE_FIELD_COMPLETION_AUDIT_VERSION;
    limitationReason: string | null;
  };
  versionRefs: KaqArtifactVersionRefs;
}

export interface ResourceFieldCompletionCoverageSummary {
  complete: number;
  missingField: number;
  provisional: number;
  humanConfirmed: number;
  citationReady: number;
  pathEligible: number;
  blocked: number;
  denominator: number;
  sourceWindow: ResourceFieldSourceWindow;
  missingFieldCodes: ResourceFieldMissingCode[];
  limitationReasons: string[];
  sampleLimitations: string[];
  artifactVersion: typeof RESOURCE_FIELD_COMPLETION_AUDIT_VERSION;
}

export interface ResourceFieldCompletionAuditSummary {
  artifactVersion: typeof RESOURCE_FIELD_COMPLETION_AUDIT_VERSION;
  generatedAt: string;
  sourceWindow: ResourceFieldSourceWindow;
  versionRefs: KaqArtifactVersionRefs;
  totals: ResourceFieldCompletionCoverageSummary;
  byFamily: Record<string, ResourceFieldCompletionCoverageSummary>;
  byCompletionMethod: Record<ResourceFieldCompletionMethod, number>;
  byReviewStatus: Record<ResourceFieldReviewStatus, number>;
  graphCoverageDiagnostics: Record<string, ResourceFieldCompletionCoverageSummary>;
  limitations: string[];
  roleSafeSummary: {
    student: {
      exposeInternalDiagnostics: false;
      message: string;
    };
    teacherAdmin: {
      exposeInternalDiagnostics: true;
      diagnosticFields: string[];
    };
  };
}

export interface ResourceFieldCompletionAuditResult {
  rows: ResourceFieldCompletionAuditRow[];
  summary: ResourceFieldCompletionAuditSummary;
}

export interface ResourceFieldCompletionAuditInput {
  registry: ResourceNodeRegistry;
  candidates?: ResourceFieldCompletionCandidate[];
  generatedAt?: string;
  sourceWindow?: ResourceFieldSourceWindow;
  limitations?: string[];
}

const EMPTY_COUNTS: Record<ResourceFieldCompletionMethod, number> = {
  manual: 0,
  'local-model-assisted': 0,
  'external-tool-assisted': 0,
  'generated-provisional': 0,
  'already-governed': 0,
  blocked: 0,
};

const EMPTY_REVIEW_COUNTS: Record<ResourceFieldReviewStatus, number> = {
  'not-reviewed': 0,
  'generated-provisional': 0,
  'model-assisted-provisional': 0,
  'external-tool-provisional': 0,
  'human-confirmed': 0,
  blocked: 0,
  stale: 0,
};

export function buildResourceFieldCompletionAudit(
  input: ResourceFieldCompletionAuditInput,
): ResourceFieldCompletionAuditResult {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const sourceWindow = input.sourceWindow ?? { from: null, to: generatedAt };
  const versionRefs = buildKaqArtifactVersionRefs({
    resourceRegistryVersion: RESOURCE_NODE_REGISTRY_VERSION,
    resourceProjectionVersion: RESOURCE_SEMANTIC_PROJECTION_VERSION,
  });
  const rows = [
    ...input.registry.nodes.map((node) => rowFromResourceNode(node, sourceWindow, versionRefs, generatedAt)),
    ...(input.candidates ?? []).map((candidate) => rowFromCandidate(candidate, sourceWindow, versionRefs)),
  ].sort((left, right) => left.resourceId.localeCompare(right.resourceId));

  return {
    rows,
    summary: buildResourceFieldCompletionSummary(rows, {
      generatedAt,
      sourceWindow,
      versionRefs,
      limitations: input.limitations ?? [],
    }),
  };
}

export function summarizeResourceFieldCompletionForCoverage(
  resourceNodes: ResourceNode[],
): ResourceFieldCompletionCoverageSummary {
  const sourceWindow = { from: null, to: null };
  const generatedAt = new Date().toISOString();
  const rows = resourceNodes.map((node) => rowFromResourceNode(
    node,
    sourceWindow,
    buildKaqArtifactVersionRefs(),
    generatedAt,
  ));
  return summarizeRows(rows);
}

export function summarizeResourceFieldCompletionCoverageSummaries(
  summaries: ResourceFieldCompletionCoverageSummary[],
): ResourceFieldCompletionCoverageSummary {
  if (summaries.length === 0) {
    return summarizeRows([]);
  }

  return {
    complete: sumSummaryField(summaries, 'complete'),
    missingField: sumSummaryField(summaries, 'missingField'),
    provisional: sumSummaryField(summaries, 'provisional'),
    humanConfirmed: sumSummaryField(summaries, 'humanConfirmed'),
    citationReady: sumSummaryField(summaries, 'citationReady'),
    pathEligible: sumSummaryField(summaries, 'pathEligible'),
    blocked: sumSummaryField(summaries, 'blocked'),
    denominator: sumSummaryField(summaries, 'denominator'),
    sourceWindow: mergeSourceWindows(summaries.map((summary) => summary.sourceWindow)),
    missingFieldCodes: uniqueCodes(summaries.flatMap((summary) => summary.missingFieldCodes)),
    limitationReasons: uniqueSorted(summaries.flatMap((summary) => summary.limitationReasons)),
    sampleLimitations: uniqueSorted(summaries.flatMap((summary) => summary.sampleLimitations)).slice(0, 5),
    artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
  };
}

function rowFromResourceNode(
  node: ResourceNode,
  sourceWindow: ResourceFieldSourceWindow,
  versionRefs: KaqArtifactVersionRefs,
  generatedAt: string,
): ResourceFieldCompletionAuditRow {
  const projection = buildResourceSemanticProjection(node);
  const highConfidenceAudit = buildResourceNodeHighConfidencePlanningAudit(node);
  const sourceHash = projection.resource.contentHash ?? null;
  const evidenceContract = buildEvidenceContract({
    eventSource: Boolean(node.sourceKind),
    eventType: node.planningMetadata.evidenceInstrumentation.length > 0,
    clientEventIdPolicy: node.planningMetadata.evidenceInstrumentation.length > 0,
    attemptKey: Boolean(node.id),
    sourceLogId: node.planningMetadata.evidenceInstrumentation.length > 0,
    dedupeKey: Boolean(node.sourceRef),
    timestamps: node.planningMetadata.evidenceInstrumentation.length > 0,
    learningFactPolicy: node.planningMetadata.evidenceInstrumentation.length > 0,
    confidencePolicy: Object.keys(node.planningMetadata.abilityImpact).length > 0,
    privacyScope: Boolean(node.planningMetadata.privacyLevel),
  });
  const missingFieldCodes = uniqueCodes([
    ...highConfidenceAudit.issues.map((issue) => mapAuditIssueCode(issue.code)),
    ...(!node.sourceRef ? ['missing-source-path-or-url' as const] : []),
    ...(!node.id ? ['missing-stable-id' as const] : []),
    ...(!sourceHash ? ['missing-content-hash' as const] : []),
    ...(!node.launchTarget && !node.renderTarget ? ['missing-path-target' as const] : []),
    ...(node.planningMetadata.knowledgeCoverage.length === 0 ? ['missing-knowledge-binding' as const] : []),
    ...(Object.keys(node.planningMetadata.abilityImpact).length === 0 ? ['missing-capability-target' as const] : []),
    ...(!node.planningMetadata.estimatedTimeMinutes ? ['missing-path-profile' as const] : []),
    ...(!node.planningMetadata.readiness && requiresReadiness(node.type) ? ['missing-readiness-gating' as const] : []),
    ...(!evidenceContract.complete ? ['missing-evidence-contract' as const] : []),
    ...(projection.citationTargets.some((target) => target.status === 'missing-target') ? ['missing-citation-target' as const] : []),
  ]);
  const humanConfirmed = highConfidenceAudit.pathEligible && evidenceContract.complete && Boolean(sourceHash);

  return buildRow({
    resourceId: node.id,
    resourceType: node.type,
    family: familyForResourceNode(node),
    title: node.title,
    sourcePathOrUrl: node.launchTarget ?? node.renderTarget ?? node.sourceRef,
    sourceRecord: node.sourceRef,
    missingFieldCodes,
    evidenceContract,
    completionMethod: humanConfirmed ? 'already-governed' : 'manual',
    reviewStatus: humanConfirmed ? 'human-confirmed' : 'not-reviewed',
    reviewAudit: humanConfirmed
      ? confirmedReviewAudit({
        sourceHash,
        versionRef: RESOURCE_NODE_REGISTRY_VERSION,
        reviewBatchId: RESOURCE_NODE_REGISTRY_VERSION,
        generationToolOrModel: null,
        reviewedAt: generatedAt,
      })
      : emptyReviewAudit(),
    currentPathEligible: highConfidenceAudit.pathEligible,
    versionRefs,
    sourceHash,
    sourceVersionRef: RESOURCE_NODE_REGISTRY_VERSION,
    pathTarget: node.launchTarget ?? node.renderTarget,
    estimatedTimeMinutes: node.planningMetadata.estimatedTimeMinutes,
    citationTargets: projection.citationTargets.map((target) => target.target).filter((value): value is string => Boolean(value)),
    graphNodeRefs: {
      knowledge: node.planningMetadata.knowledgeCoverage,
      capability: Object.keys(node.planningMetadata.abilityImpact).sort((left, right) => left.localeCompare(right)),
      quality: [],
    },
    sourceWindow,
    coverageKeys: [
      node.id,
      ...node.planningMetadata.knowledgeCoverage,
      ...Object.keys(node.planningMetadata.abilityImpact),
    ],
  });
}

function rowFromCandidate(
  candidate: ResourceFieldCompletionCandidate,
  defaultSourceWindow: ResourceFieldSourceWindow,
  versionRefs: KaqArtifactVersionRefs,
): ResourceFieldCompletionAuditRow {
  const evidenceInstrumentation = candidate.evidenceInstrumentation ?? [];
  const evidenceContract = buildEvidenceContract({
    eventSource: Boolean(candidate.family),
    eventType: evidenceInstrumentation.length > 0,
    clientEventIdPolicy: evidenceInstrumentation.length > 0,
    attemptKey: evidenceInstrumentation.length > 0,
    sourceLogId: evidenceInstrumentation.length > 0,
    dedupeKey: Boolean(candidate.id && candidate.sourcePathOrUrl),
    timestamps: evidenceInstrumentation.length > 0,
    learningFactPolicy: evidenceInstrumentation.length > 0,
    confidencePolicy: Boolean(candidate.capabilityTargetIds?.length),
    privacyScope: Boolean(candidate.privacyScope),
  });
  const missingFieldCodes = uniqueCodes([
    ...(!candidate.id ? ['missing-stable-id' as const] : []),
    ...(!candidate.sourcePathOrUrl ? ['missing-source-path-or-url' as const] : []),
    ...(!candidate.contentHash ? ['missing-content-hash' as const] : []),
    ...(!candidate.versionRef ? ['missing-version-ref' as const] : []),
    ...(!candidate.knowledgeNodeIds?.length ? ['missing-knowledge-binding' as const] : []),
    ...(!candidate.capabilityTargetIds?.length ? ['missing-capability-target' as const] : []),
    ...(!candidate.pathTarget ? ['missing-path-target' as const] : []),
    ...(!candidate.estimatedTimeMinutes ? ['missing-path-profile' as const] : []),
    ...(!candidate.evidenceInstrumentation?.length ? ['missing-evidence-instrumentation' as const] : []),
    ...(!evidenceContract.complete ? ['missing-evidence-contract' as const] : []),
    ...(!candidate.segmentRefs?.length ? ['missing-segment-ref' as const] : []),
    ...(!candidate.citationTargets?.length ? ['missing-citation-target' as const] : []),
    ...(!candidate.humanConfirmed ? ['missing-human-review' as const] : []),
    ...(candidate.generatedBy && !candidate.humanConfirmed ? ['provisional-metadata' as const] : []),
    ...(candidate.blockingDependency ? ['blocked-by-dependency' as const] : []),
  ]);
  const reviewStatus = reviewStatusForCandidate(candidate);

  return buildRow({
    resourceId: candidate.id,
    resourceType: candidate.family,
    family: candidate.family,
    title: candidate.title,
    sourcePathOrUrl: candidate.sourcePathOrUrl,
    sourceRecord: candidate.sourceRecord ?? null,
    missingFieldCodes,
    evidenceContract,
    completionMethod: completionMethodForCandidate(candidate, missingFieldCodes),
    reviewStatus,
    reviewAudit: candidate.humanConfirmed
      ? confirmedReviewAudit({
        sourceHash: candidate.contentHash ?? null,
        versionRef: candidate.versionRef ?? null,
        reviewBatchId: candidate.versionRef ?? null,
        generationToolOrModel: candidate.generatedBy,
        reviewedAt: defaultSourceWindow.to,
      })
      : emptyReviewAudit(candidate),
    currentPathEligible: false,
    versionRefs,
    sourceHash: candidate.contentHash ?? null,
    sourceVersionRef: candidate.versionRef ?? null,
    pathTarget: candidate.pathTarget ?? null,
    estimatedTimeMinutes: candidate.estimatedTimeMinutes ?? null,
    citationTargets: candidate.citationTargets ?? [],
    graphNodeRefs: {
      knowledge: candidate.knowledgeNodeIds ?? [],
      capability: candidate.capabilityTargetIds ?? [],
      quality: candidate.qualityTargetIds ?? [],
    },
    sourceWindow: candidate.sourceWindow ?? defaultSourceWindow,
    coverageKeys: [
      candidate.id,
      ...(candidate.knowledgeNodeIds ?? []),
      ...(candidate.capabilityTargetIds ?? []),
      ...(candidate.qualityTargetIds ?? []),
    ],
  });
}

function buildRow(input: {
  resourceId: string;
  resourceType: string;
  family: ResourceFieldCompletionFamily;
  title: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string | null;
  missingFieldCodes: ResourceFieldMissingCode[];
  completionMethod: ResourceFieldCompletionMethod;
  reviewStatus: ResourceFieldReviewStatus;
  reviewAudit: ResourceFieldReviewAudit;
  evidenceContract: ResourceEvidenceContractCompleteness;
  currentPathEligible: boolean;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  pathTarget: string | null;
  estimatedTimeMinutes: number | null;
  citationTargets: string[];
  graphNodeRefs: ResourceGraphNodeRefs;
  sourceWindow: ResourceFieldSourceWindow;
  versionRefs: KaqArtifactVersionRefs;
  coverageKeys: string[];
}): ResourceFieldCompletionAuditRow {
  const blockedBy = uniqueCodes([
    ...input.missingFieldCodes.filter((code) => (
      code !== 'missing-quality-target'
    )),
    ...(!isHumanConfirmed(input.reviewStatus) ? ['missing-human-review' as const] : []),
  ]);
  const afterCompletion = blockedBy.length === 0 && input.evidenceContract.complete;
  const citationReady = !input.missingFieldCodes.includes('missing-citation-target') &&
    !input.missingFieldCodes.includes('missing-segment-ref');
  const denominatorKey = uniqueSorted(input.coverageKeys).join('|') || input.resourceId;

  return {
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    family: input.family,
    title: input.title,
    sourcePathOrUrl: input.sourcePathOrUrl,
    sourceRecord: input.sourceRecord,
    pathTarget: input.pathTarget,
    estimatedTimeMinutes: input.estimatedTimeMinutes,
    sourceHash: input.sourceHash,
    sourceVersionRef: input.sourceVersionRef,
    citationTargets: uniqueSorted(input.citationTargets),
    graphNodeRefs: {
      knowledge: uniqueSorted(input.graphNodeRefs.knowledge),
      capability: uniqueSorted(input.graphNodeRefs.capability),
      quality: uniqueSorted(input.graphNodeRefs.quality),
    },
    missingFieldCodes: input.missingFieldCodes,
    completionMethod: input.completionMethod,
    reviewStatus: input.reviewStatus,
    reviewAudit: input.reviewAudit,
    evidenceContract: input.evidenceContract,
    pathEligibility: {
      current: input.currentPathEligible,
      afterCompletion,
      masteryAffecting: afterCompletion && input.evidenceContract.complete && isHumanConfirmed(input.reviewStatus),
      blockedBy,
    },
    groundingEligibility: {
      retrievalReady: Boolean(input.sourcePathOrUrl),
      citationReady,
      authoringTriageReady: Boolean(input.resourceId && input.title && input.sourcePathOrUrl),
    },
    coverage: {
      denominatorKey,
      sourceWindow: input.sourceWindow,
      artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
      limitationReason: limitationReasonFor(input.missingFieldCodes, input.reviewStatus),
    },
    versionRefs: input.versionRefs,
  };
}

function buildResourceFieldCompletionSummary(
  rows: ResourceFieldCompletionAuditRow[],
  input: {
    generatedAt: string;
    sourceWindow: ResourceFieldSourceWindow;
    versionRefs: KaqArtifactVersionRefs;
    limitations: string[];
  },
): ResourceFieldCompletionAuditSummary {
  const byFamily: Record<string, ResourceFieldCompletionCoverageSummary> = {};
  for (const family of uniqueSorted(rows.map((row) => row.family))) {
    byFamily[family] = summarizeRows(rows.filter((row) => row.family === family));
  }

  const byCompletionMethod = { ...EMPTY_COUNTS };
  const byReviewStatus = { ...EMPTY_REVIEW_COUNTS };
  for (const row of rows) {
    byCompletionMethod[row.completionMethod] += 1;
    byReviewStatus[row.reviewStatus] += 1;
  }

  const graphCoverageDiagnostics: Record<string, ResourceFieldCompletionCoverageSummary> = {};
  const denominatorKeys = uniqueSorted(rows.map((row) => row.coverage.denominatorKey));
  for (const key of denominatorKeys) {
    graphCoverageDiagnostics[key] = summarizeRows(rows.filter((row) => row.coverage.denominatorKey === key));
  }

  return {
    artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
    generatedAt: input.generatedAt,
    sourceWindow: input.sourceWindow,
    versionRefs: input.versionRefs,
    totals: summarizeRows(rows),
    byFamily,
    byCompletionMethod,
    byReviewStatus,
    graphCoverageDiagnostics,
    limitations: uniqueSorted(input.limitations),
    roleSafeSummary: {
      student: {
        exposeInternalDiagnostics: false,
        message: 'Resource governance diagnostics are withheld from student-facing payloads.',
      },
      teacherAdmin: {
        exposeInternalDiagnostics: true,
        diagnosticFields: [
          'missingFieldCodes',
          'completionMethod',
          'reviewStatus',
          'evidenceContract',
          'coverage.limitationReason',
        ],
      },
    },
  };
}

function summarizeRows(rows: ResourceFieldCompletionAuditRow[]): ResourceFieldCompletionCoverageSummary {
  return {
    complete: rows.filter((row) => row.missingFieldCodes.length === 0 && row.reviewStatus === 'human-confirmed').length,
    missingField: rows.filter((row) => row.missingFieldCodes.length > 0).length,
    provisional: rows.filter((row) => isProvisional(row.reviewStatus)).length,
    humanConfirmed: rows.filter((row) => row.reviewStatus === 'human-confirmed').length,
    citationReady: rows.filter((row) => row.groundingEligibility.citationReady).length,
    pathEligible: rows.filter((row) => row.pathEligibility.current).length,
    blocked: rows.filter((row) => row.pathEligibility.blockedBy.length > 0).length,
    denominator: rows.length,
    sourceWindow: mergeSourceWindows(rows.map((row) => row.coverage.sourceWindow)),
    missingFieldCodes: uniqueCodes(rows.flatMap((row) => row.missingFieldCodes)),
    limitationReasons: uniqueSorted(rows.map((row) => row.coverage.limitationReason).filter((value): value is string => Boolean(value))),
    sampleLimitations: uniqueSorted(rows
      .filter((row) => row.coverage.limitationReason)
      .slice(0, 5)
      .map((row) => `${row.resourceId}: ${row.coverage.limitationReason}`)),
    artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
  };
}

function sumSummaryField(
  summaries: ResourceFieldCompletionCoverageSummary[],
  field: keyof Pick<
    ResourceFieldCompletionCoverageSummary,
    | 'complete'
    | 'missingField'
    | 'provisional'
    | 'humanConfirmed'
    | 'citationReady'
    | 'pathEligible'
    | 'blocked'
    | 'denominator'
  >,
): number {
  return summaries.reduce((sum, summary) => sum + summary[field], 0);
}

function buildEvidenceContract(fields: Omit<ResourceEvidenceContractCompleteness, 'complete' | 'missingFields'>): ResourceEvidenceContractCompleteness {
  const missingFields = Object.entries(fields)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return {
    ...fields,
    complete: missingFields.length === 0,
    missingFields,
  };
}

function mapAuditIssueCode(code: string): ResourceFieldMissingCode {
  if (code === 'missing-render-or-launch-target') return 'missing-path-target';
  if (code === 'missing-knowledge-mapping') return 'missing-knowledge-binding';
  if (code === 'missing-evidence-instrumentation') return 'missing-evidence-instrumentation';
  if (code === 'missing-capability-mapping') return 'missing-capability-target';
  if (code === 'missing-readiness-metadata') return 'missing-readiness-gating';
  if (code === 'missing-privacy-policy') return 'missing-evidence-contract';
  if (code === 'textbook-container-not-path-node') return 'blocked-by-dependency';
  return 'blocked-by-dependency';
}

function familyForResourceNode(node: ResourceNode): ResourceFieldCompletionFamily {
  if (node.sourceKind === 'resource_registry') return 'registered-resource';
  if (node.sourceKind === 'runtime_lesson_step') return 'runtime-lesson-step';
  if (node.sourceKind === 'runtime_lesson_media') return 'runtime-lesson-media';
  if (node.sourceKind === 'runtime_handout') return 'runtime-handout';
  if (node.type === 'knowledge_card') return 'knowledge-card';
  if (node.type === 'textbook') return 'textbook';
  if (node.type === 'textbook_section') return 'textbook-section';
  if (node.type === 'quiz' || node.type === 'adaptive_quiz') return 'quiz';
  if (node.type === 'simulation') return 'simulation';
  if (node.type === 'arena_task') return 'arena';
  if (node.type === 'checkpoint') return 'checkpoint';
  if (node.type === 'external_resource') return 'external-resource';
  return 'resource-node';
}

function completionMethodForCandidate(
  candidate: ResourceFieldCompletionCandidate,
  missingFieldCodes: ResourceFieldMissingCode[],
): ResourceFieldCompletionMethod {
  if (candidate.blockingDependency) return 'blocked';
  if (missingFieldCodes.length === 0 && candidate.humanConfirmed) return 'already-governed';
  if (candidate.generatedBy === 'local-model') return 'local-model-assisted';
  if (candidate.generatedBy === 'external-tool') return 'external-tool-assisted';
  if (candidate.generatedBy) return 'generated-provisional';
  return 'manual';
}

function reviewStatusForCandidate(candidate: ResourceFieldCompletionCandidate): ResourceFieldReviewStatus {
  if (candidate.blockingDependency) return 'blocked';
  if (candidate.humanConfirmed) return 'human-confirmed';
  if (candidate.generatedBy === 'local-model') return 'model-assisted-provisional';
  if (candidate.generatedBy === 'external-tool') return 'external-tool-provisional';
  if (candidate.generatedBy) return 'generated-provisional';
  return 'not-reviewed';
}

function confirmedReviewAudit(input: {
  sourceHash: string | null;
  versionRef: string | null;
  reviewBatchId: string | null;
  generationToolOrModel?: ResourceFieldCompletionCandidate['generatedBy'];
  reviewedAt: string | null;
}): ResourceFieldReviewAudit {
  return {
    reviewerId: 'system-governed',
    reviewerRole: 'governance-policy',
    reviewedAt: input.reviewedAt,
    reviewBatchId: input.reviewBatchId,
    reviewedSourceHash: input.sourceHash,
    reviewedVersionRef: input.versionRef,
    generationToolOrModel: input.generationToolOrModel ?? null,
    promptOrManifestHash: null,
    confidence: 0.9,
    staleInvalidationRule: 'stale when source hash, version ref, prompt hash, or generation tool version changes',
  };
}

function emptyReviewAudit(candidate?: ResourceFieldCompletionCandidate): ResourceFieldReviewAudit {
  return {
    reviewerId: null,
    reviewerRole: null,
    reviewedAt: null,
    reviewBatchId: null,
    reviewedSourceHash: null,
    reviewedVersionRef: candidate?.versionRef ?? null,
    generationToolOrModel: candidate?.generatedBy ?? null,
    promptOrManifestHash: null,
    confidence: null,
    staleInvalidationRule: 'requires human review before path eligibility or mastery effect',
  };
}

function limitationReasonFor(
  codes: ResourceFieldMissingCode[],
  reviewStatus: ResourceFieldReviewStatus,
): string | null {
  if (reviewStatus === 'blocked') return 'blocked by dependency';
  if (reviewStatus === 'stale') return 'review is stale';
  if (isProvisional(reviewStatus)) return 'metadata is provisional';
  if (codes.length > 0) return `missing fields: ${codes.join(', ')}`;
  return null;
}

function requiresReadiness(type: string): boolean {
  return ['simulation', 'arena_task', 'checkpoint', 'control_workbench', 'adaptive_quiz'].includes(type);
}

function isHumanConfirmed(status: ResourceFieldReviewStatus): boolean {
  return status === 'human-confirmed';
}

function isProvisional(status: ResourceFieldReviewStatus): boolean {
  return status === 'generated-provisional' ||
    status === 'model-assisted-provisional' ||
    status === 'external-tool-provisional';
}

function uniqueCodes(values: ResourceFieldMissingCode[]): ResourceFieldMissingCode[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function mergeSourceWindows(windows: ResourceFieldSourceWindow[]): ResourceFieldSourceWindow {
  const from = windows
    .map((window) => window.from)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;
  const toValues = windows
    .map((window) => window.to)
    .filter((value): value is string => Boolean(value))
    .sort();
  return {
    from,
    to: toValues.at(-1) ?? null,
  };
}
