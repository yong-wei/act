import {
  buildKaqArtifactVersionRefs,
  RESOURCE_NODE_REGISTRY_VERSION,
  RESOURCE_SEMANTIC_PROJECTION_VERSION,
  type KaqArtifactVersionRefs,
} from './kaq-artifact-versioning';
import type {
  ResourceFieldCompletionAuditRow,
  ResourceFieldCompletionFamily,
  ResourceFieldMissingCode,
} from './resource-field-completion-audit';
import {
  RESOURCE_NODE_TYPES,
  type ResourceNodeType,
  type ResourceGraphNodeRefs,
  type ResourceNodePrivacyLevel,
  type ResourceNodeSourceKind,
  type RuntimeResourceProjectionResourceType,
  type RuntimeResourceProjectionEvidenceContract,
  type RuntimeResourceProjectionInput,
  type RuntimeResourceProjectionSemanticEvidence,
  type RuntimeResourceProjectionLevel,
  type RuntimeResourceProjectionReviewAudit,
  type RuntimeResourceProjectionReviewStatus,
} from './resource-node-registry';

export const RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION = 'runtime-resource-projections.v1';

export type RuntimeResourceProjectionFamily =
  | 'runtime-lesson-step'
  | 'runtime-lesson-module'
  | 'runtime-lesson-media'
  | 'runtime-handout'
  | 'knowledge-card'
  | 'knowledge-infograph'
  | 'textbook'
  | 'textbook-section'
  | 'textbook-search-document'
  | 'authoring-textbook-chapter'
  | 'authoring-textbook-section'
  | 'authoring-textbook-figure'
  | 'authoring-textbook-caption';

export interface RuntimeResourceProjectionArtifactRow extends RuntimeResourceProjectionInput {
  artifactVersion: typeof RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION;
  family: RuntimeResourceProjectionFamily;
  evidenceContract: RuntimeResourceProjectionEvidenceContract | null;
  reviewAudit: RuntimeResourceProjectionReviewAudit;
  segmentRefs: string[];
  citationTargets: string[];
  lifecycleScope?: 'audit-only';
  retrievalChunk: {
    id: string;
    pathEligible: false;
    reason: 'resource-node-planning-audit-required';
  } | null;
  reviewConcluded?: boolean;
  semanticConfirmed?: boolean;
  pathEligibility: {
    current: boolean;
    afterCompletion: boolean;
    masteryAffecting: boolean;
    blockedBy: ResourceFieldMissingCode[];
  };
  groundingEligibility: ResourceFieldCompletionAuditRow['groundingEligibility'];
  versionRefs: KaqArtifactVersionRefs;
}

export interface RuntimeResourceProjectionLimitations {
  artifactVersion: typeof RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION;
  generatedAt: string;
  versionRefs: KaqArtifactVersionRefs;
  totals: {
    rows: number;
    resourceNodeCandidates: number;
    segmentOnly: number;
    registryPathEligible: number;
    planningUnitEligible: number;
    humanConfirmed: number;
    agentReviewed: number;
    reviewConcluded: number;
    semanticReviewed: number;
    provisional: number;
    stale: number;
  };
  byFamily: Record<RuntimeResourceProjectionFamily, number>;
  byProjectionLevel: Record<RuntimeResourceProjectionLevel, number>;
  blockingCodes: string[];
  limitations: string[];
}

export interface RuntimeResourceProjectionArtifacts {
  rows: RuntimeResourceProjectionArtifactRow[];
  limitations: RuntimeResourceProjectionLimitations;
}

export function buildRuntimeResourceProjectionArtifacts(input: {
  auditRows: readonly ResourceFieldCompletionAuditRow[];
  generatedAt?: string;
  runtimeSemanticEvidenceById?: ReadonlyMap<string, RuntimeResourceProjectionSemanticEvidence>;
}): RuntimeResourceProjectionArtifacts {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const versionRefs = buildKaqArtifactVersionRefs({
    resourceRegistryVersion: RESOURCE_NODE_REGISTRY_VERSION,
    resourceProjectionVersion: RESOURCE_SEMANTIC_PROJECTION_VERSION,
  });
  const rows = input.auditRows
    .filter((row): row is ResourceFieldCompletionAuditRow & { family: RuntimeResourceProjectionFamily } =>
      isRuntimeProjectionFamily(row.family)
    )
    .map((row) => rowToRuntimeProjection(
      row,
      versionRefs,
      input.runtimeSemanticEvidenceById?.get(row.resourceId),
    ))
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    rows,
    limitations: summarizeRuntimeProjectionRows(rows, generatedAt, versionRefs),
  };
}

function rowToRuntimeProjection(
  row: ResourceFieldCompletionAuditRow & { family: RuntimeResourceProjectionFamily },
  versionRefs: KaqArtifactVersionRefs,
  runtimeSemanticEvidence?: RuntimeResourceProjectionSemanticEvidence,
): RuntimeResourceProjectionArtifactRow {
  const projectionLevel = projectionLevelForRow(row);
  const resourceNodeId = resourceNodeIdForRow(row);
  const sourceKind = sourceKindForFamily(row.family);
  const reviewStatus = runtimeReviewStatus(row.reviewStatus);
  const sourceHash = row.sourceHash ?? runtimeSemanticEvidence?.sourceFileHash ?? null;
  const reviewAudit: RuntimeResourceProjectionReviewAudit = {
    ...row.reviewAudit,
    reviewedSourceHash: row.reviewAudit.reviewedSourceHash ?? sourceHash,
    status: reviewStatus,
  };
  const strictLongformAuditOnly = isAuthoringTextbookFamily(row.family) ||
    (reviewStatus === 'agent-reviewed' && isLongformFamily(row.family));
  const evidenceContract: RuntimeResourceProjectionEvidenceContract | null = strictLongformAuditOnly
    ? null
    : row.evidenceContract;

  return {
    artifactVersion: RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION,
    id: row.resourceId,
    resourceNodeId: strictLongformAuditOnly ? null : resourceNodeId,
    title: row.title,
    family: row.family,
    resourceType: resourceTypeForRow(row),
    sourceKind,
    sourceRef: row.sourceRecord ?? row.resourceId,
    sourcePathOrUrl: row.sourcePathOrUrl,
    sourceRecord: row.sourceRecord,
    sourceHash,
    sourceVersionRef: row.sourceVersionRef,
    projectionLevel,
    routeTarget: !strictLongformAuditOnly && (projectionLevel === 'ResourceNode' || projectionLevel === 'PlanningUnit')
      ? row.pathTarget
      : null,
    renderTarget: strictLongformAuditOnly ? null : renderTargetForRow(row),
    graphNodeRefs: strictLongformAuditOnly ? { knowledge: [], capability: [], quality: [] } : normalizeGraphNodeRefs(row.graphNodeRefs),
    estimatedTimeMinutes: strictLongformAuditOnly ? null : row.estimatedTimeMinutes,
    evidenceInstrumentation: strictLongformAuditOnly ? [] : evidenceInstrumentationFromContract(row.evidenceContract, row.family),
    privacyScope: strictLongformAuditOnly ? 'teacher-scoped' : privacyScopeFromContract(row.evidenceContract),
    teacherPolicy: strictLongformAuditOnly ? 'teacher-only' : 'allowed',
    evidenceContract,
    reviewAudit,
    ...(strictLongformAuditOnly ? {
      lifecycleScope: 'audit-only' as const,
      reviewConcluded: row.reviewConcluded,
      semanticConfirmed: row.semanticConfirmed,
    } : {}),
    readiness: strictLongformAuditOnly ? null : row.readiness,
    segmentRefs: segmentRefsForRow(row),
    citationTargets: strictLongformAuditOnly ? [] : row.citationTargets,
    ...(runtimeSemanticEvidence ? { runtimeSemanticEvidence } : {}),
    retrievalChunk: strictLongformAuditOnly ? null : {
      id: `retrieval-chunk:${row.resourceId}:primary`,
      pathEligible: false,
      reason: 'resource-node-planning-audit-required',
    },
    pathEligibility: strictLongformAuditOnly
      ? { current: false, afterCompletion: false, masteryAffecting: false, blockedBy: row.pathEligibility.blockedBy }
      : row.pathEligibility,
    groundingEligibility: strictLongformAuditOnly
      ? { retrievalReady: false, citationReady: false, authoringTriageReady: row.groundingEligibility.authoringTriageReady }
      : row.groundingEligibility,
    versionRefs,
  };
}

function summarizeRuntimeProjectionRows(
  rows: RuntimeResourceProjectionArtifactRow[],
  generatedAt: string,
  versionRefs: KaqArtifactVersionRefs,
): RuntimeResourceProjectionLimitations {
  const byFamily = Object.fromEntries(
    RUNTIME_PROJECTION_FAMILIES.map((family) => [family, rows.filter((row) => row.family === family).length]),
  ) as Record<RuntimeResourceProjectionFamily, number>;
  const byProjectionLevel = Object.fromEntries(
    RUNTIME_PROJECTION_LEVELS.map((level) => [level, rows.filter((row) => row.projectionLevel === level).length]),
  ) as Record<RuntimeResourceProjectionLevel, number>;
  const blockingCodes = uniqueSorted(rows.flatMap((row) => row.pathEligibility.blockedBy));
  const limitations = uniqueSorted(rows
    .filter((row) => row.pathEligibility.blockedBy.length > 0 || !isSemanticReviewFresh(row.reviewAudit.status))
    .slice(0, 25)
    .map((row) => `${row.id}: ${row.pathEligibility.blockedBy.join(', ') || row.reviewAudit.status}`));

  return {
    artifactVersion: RUNTIME_RESOURCE_PROJECTION_ARTIFACT_VERSION,
    generatedAt,
    versionRefs,
    totals: {
      rows: rows.length,
      resourceNodeCandidates: rows.filter((row) =>
        row.projectionLevel === 'ResourceNode' || row.projectionLevel === 'PlanningUnit'
      ).length,
      segmentOnly: rows.filter((row) => row.projectionLevel === 'ResourceSegment').length,
      registryPathEligible: rows.filter((row) => row.pathEligibility.current).length,
      planningUnitEligible: rows.filter((row) => row.projectionLevel === 'PlanningUnit').length,
      humanConfirmed: rows.filter((row) => row.reviewAudit.status === 'human-confirmed').length,
      agentReviewed: rows.filter((row) => row.reviewAudit.status === 'agent-reviewed').length,
      reviewConcluded: rows.filter((row) => row.reviewConcluded).length,
      semanticReviewed: rows.filter((row) => row.semanticConfirmed).length,
      provisional: rows.filter((row) => row.reviewAudit.status.includes('provisional')).length,
      stale: rows.filter((row) => isStaleProjection(row)).length,
    },
    byFamily,
    byProjectionLevel,
    blockingCodes,
    limitations,
  };
}

const RUNTIME_PROJECTION_FAMILIES: RuntimeResourceProjectionFamily[] = [
  'runtime-lesson-step',
  'runtime-lesson-module',
  'runtime-lesson-media',
  'runtime-handout',
  'knowledge-card',
  'knowledge-infograph',
  'textbook',
  'textbook-section',
  'textbook-search-document',
  'authoring-textbook-chapter',
  'authoring-textbook-section',
  'authoring-textbook-figure',
  'authoring-textbook-caption',
];

const RUNTIME_PROJECTION_LEVELS: RuntimeResourceProjectionLevel[] = [
  'ResourceNode',
  'ResourceSegment',
  'CitationTarget',
  'RetrievalChunk',
  'PlanningUnit',
];

function isRuntimeProjectionFamily(family: ResourceFieldCompletionFamily): family is RuntimeResourceProjectionFamily {
  return (RUNTIME_PROJECTION_FAMILIES as string[]).includes(family);
}

function projectionLevelForRow(row: ResourceFieldCompletionAuditRow): RuntimeResourceProjectionLevel {
  if (row.reviewStatus === 'model-cleared') return 'ResourceSegment';
  if (row.pathEligibility.current && row.pathEligibility.masteryAffecting) return 'PlanningUnit';
  if (row.family === 'runtime-lesson-step') return 'ResourceNode';
  if (row.family === 'knowledge-card' && isHumanPathAuthorized(row.reviewStatus)) return 'ResourceNode';
  return 'ResourceSegment';
}

function resourceNodeIdForRow(row: ResourceFieldCompletionAuditRow): string | null {
  if (row.family === 'textbook' || row.family === 'textbook-section') return row.resourceId;
  if (row.family === 'runtime-lesson-step' && row.resourceId.startsWith('runtime-step:')) {
    return row.resourceId.replace(/^runtime-step:/, 'lesson-step:');
  }
  if (row.family === 'runtime-lesson-media' && row.resourceId.startsWith('runtime-media:')) return row.resourceId;
  if (row.family === 'runtime-handout' && row.resourceId.startsWith('runtime-handout:')) return row.resourceId;
  if (row.family === 'knowledge-card' && row.resourceId.startsWith('knowledge-card:')) return row.resourceId;
  return null;
}

function renderTargetForRow(row: ResourceFieldCompletionAuditRow): string | null {
  if (row.family === 'knowledge-infograph') {
    return row.citationTargets.find((target) => target.startsWith('/course-runtime/')) ??
      row.pathTarget ??
      row.sourcePathOrUrl;
  }
  return row.pathTarget ?? row.sourcePathOrUrl;
}

function sourceKindForFamily(family: RuntimeResourceProjectionFamily): ResourceNodeSourceKind {
  if (family === 'runtime-lesson-step' || family === 'runtime-lesson-module') return 'runtime_lesson_step';
  if (family === 'runtime-lesson-media') return 'runtime_lesson_media';
  if (family === 'runtime-handout') return 'runtime_handout';
  if (family === 'textbook') return 'textbook';
  if (family === 'authoring-textbook-figure') return 'media_source_manifest';
  if (family === 'textbook-section' || family === 'textbook-search-document' || family.startsWith('authoring-textbook-')) {
    return 'textbook_section';
  }
  return 'knowledge_graph';
}

function resourceTypeForRow(row: ResourceFieldCompletionAuditRow): RuntimeResourceProjectionResourceType {
  if (isResourceNodeType(row.resourceType)) return row.resourceType;
  if (row.family === 'knowledge-card') return 'knowledge_card';
  if (row.family === 'knowledge-infograph') return 'image';
  if (row.family === 'runtime-lesson-media') return inferRuntimeMediaProjectionType(row);
  if (row.family === 'runtime-handout') return 'handout';
  if (row.family === 'textbook') return 'textbook';
  if (row.family === 'authoring-textbook-figure') return 'image';
  if (row.family === 'textbook-section' || row.family === 'textbook-search-document' || row.family.startsWith('authoring-textbook-')) {
    return 'textbook_section';
  }
  return 'lesson_step';
}

function isResourceNodeType(value: string): value is ResourceNodeType {
  return (RESOURCE_NODE_TYPES as readonly string[]).includes(value);
}

function inferRuntimeMediaProjectionType(row: ResourceFieldCompletionAuditRow): RuntimeResourceProjectionResourceType {
  const value = [
    row.sourcePathOrUrl,
    row.pathTarget,
    ...row.citationTargets,
    row.resourceId,
    row.title,
  ]
    .filter((item): item is string => Boolean(item))
    .join(' ')
    .toLowerCase();
  if (/\.(mp4|webm|mov)(?:[?#\s]|$)/.test(value)) return 'video';
  if (/\.(mp3|wav|m4a)(?:[?#\s]|$)/.test(value)) return 'audio';
  if (/\.(png|jpe?g|gif|svg|webp)(?:[?#\s]|$)/.test(value)) return 'image';
  if (/(^|[-_\s])slides?(?:[-_.\s]|$)/.test(value)) return 'slides';
  if (/\.pdf(?:[?#\s]|$)/.test(value)) return 'handout';
  return 'handout';
}

function segmentRefsForRow(row: ResourceFieldCompletionAuditRow): string[] {
  if (row.family === 'runtime-lesson-module') return [row.resourceId.replace(/^runtime-module:/, '')];
  if (row.family === 'runtime-lesson-media') return [row.resourceId.replace(/^runtime-media:/, '')];
  if (row.family === 'runtime-handout') return [row.resourceId.replace(/^runtime-handout:/, '')];
  if (row.family === 'textbook-search-document') return [row.resourceId.replace(/^textbook-search-document:/, '')];
  if (row.family === 'textbook' || row.family === 'textbook-section' || row.family.startsWith('authoring-textbook-')) {
    return [row.sourceRecord ?? row.resourceId];
  }
  return [row.sourceRecord ?? row.resourceId];
}

function evidenceInstrumentationFromContract(
  contract: RuntimeResourceProjectionEvidenceContract,
  family: RuntimeResourceProjectionFamily,
): string[] {
  if (family === 'textbook' || family === 'textbook-section' || family === 'textbook-search-document' || family.startsWith('authoring-textbook-')) {
    return [];
  }
  if (!contract.eventType) return [];
  if (family === 'knowledge-card') return ['knowledge_card_open'];
  if (family === 'runtime-handout') return ['runtime_handout_open'];
  if (family === 'runtime-lesson-media') return ['runtime_media_view'];
  if (family === 'runtime-lesson-step') return ['lesson_step_view'];
  return ['runtime_resource_view'];
}

function privacyScopeFromContract(
  contract: RuntimeResourceProjectionEvidenceContract,
): ResourceNodePrivacyLevel | null {
  return contract.privacyScope ? 'student-visible' : null;
}

function runtimeReviewStatus(status: ResourceFieldCompletionAuditRow['reviewStatus']): RuntimeResourceProjectionReviewStatus {
  return status;
}

function normalizeGraphNodeRefs(refs: ResourceGraphNodeRefs): ResourceGraphNodeRefs {
  return {
    knowledge: uniqueSorted(refs.knowledge),
    capability: uniqueSorted(refs.capability),
    quality: uniqueSorted(refs.quality),
  };
}

function isStaleProjection(row: RuntimeResourceProjectionArtifactRow): boolean {
  return (isSemanticReviewFresh(row.reviewAudit.status) || row.reviewAudit.status === 'model-cleared') &&
    (!reviewedSourceMatchesProjection(row) ||
      row.reviewAudit.reviewedVersionRef !== row.sourceVersionRef);
}

function isSemanticReviewFresh(status: RuntimeResourceProjectionReviewStatus): boolean {
  return status === 'human-confirmed' || status === 'agent-reviewed';
}

function isHumanPathAuthorized(status: RuntimeResourceProjectionReviewStatus): boolean {
  return status === 'human-confirmed';
}

function isLongformFamily(family: RuntimeResourceProjectionFamily): boolean {
  return family === 'textbook' ||
    family === 'textbook-section' ||
    family === 'textbook-search-document' ||
    family.startsWith('authoring-textbook-');
}

function isAuthoringTextbookFamily(family: RuntimeResourceProjectionFamily): boolean {
  return family.startsWith('authoring-textbook-');
}

function reviewedSourceMatchesProjection(row: RuntimeResourceProjectionArtifactRow): boolean {
  if (row.family === 'knowledge-card' || row.family === 'knowledge-infograph') {
    return row.reviewAudit.reviewedSourceHash === row.sourceHash;
  }
  if (row.reviewAudit.promptOrManifestHash) {
    return row.reviewAudit.reviewedSourceHash === row.reviewAudit.promptOrManifestHash;
  }
  return row.reviewAudit.reviewedSourceHash === row.sourceHash;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}
