import { buildKaqArtifactVersionRefs, type KaqArtifactVersionRefs } from './kaq-artifact-versioning';
import {
  CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH,
  coreResourcePathReadinessReviewRef,
  isCoreResourcePathReadinessReviewedNode,
} from './resource-node-path-readiness-review-batch';
import {
  resolveArenaPathTargetIntegrity,
  type CanonicalArenaPathTarget,
} from './arena-path-target-integrity';

export const RESOURCE_NODE_TYPES = [
  'lesson_step',
  'knowledge_node',
  'knowledge_card',
  'textbook',
  'textbook_section',
  'video',
  'audio',
  'slides',
  'handout',
  'quiz',
  'exercise',
  'adaptive_quiz',
  'control_workbench',
  'simulation',
  'arena_task',
  'external_resource',
  'reflection',
  'checkpoint',
  'ai_intervention',
  'konling',
  'project',
] as const;

export type ResourceNodeType = typeof RESOURCE_NODE_TYPES[number];

export const GOVERNED_PATH_NODE_TYPES = [
  'interactive_lesson',
  'knowledge_card',
  'textbook_section',
  'slides',
  'adaptive_quiz',
  'control_workbench',
  'simulation',
  'arena_task',
  'external_resource',
  'reflection',
  'checkpoint',
  'konling',
] as const;

export type GovernedPathNodeType = typeof GOVERNED_PATH_NODE_TYPES[number];
export type PathNodeShapeHint = 'card' | 'task' | 'lab' | 'challenge' | 'link' | 'journal' | 'gate' | 'assistant';
export type PathNodeEvidenceBehavior =
  | 'interaction'
  | 'view'
  | 'assessment'
  | 'simulation_trace'
  | 'simulation_run'
  | 'judged_submission'
  | 'explicit_access'
  | 'reflection'
  | 'assessment_gate'
  | 'assistant_interaction';

export interface ResourceNodePathSemantics {
  type: GovernedPathNodeType;
  displayName: string;
  iconKey: string;
  shapeHint: PathNodeShapeHint;
  evidenceBehavior: PathNodeEvidenceBehavior;
}

export const PATH_NODE_SEMANTICS: Record<GovernedPathNodeType, ResourceNodePathSemantics> = {
  interactive_lesson: {
    type: 'interactive_lesson',
    displayName: '互动课程',
    iconKey: 'interactive-lesson',
    shapeHint: 'card',
    evidenceBehavior: 'interaction',
  },
  knowledge_card: {
    type: 'knowledge_card',
    displayName: '知识卡',
    iconKey: 'knowledge-card',
    shapeHint: 'card',
    evidenceBehavior: 'view',
  },
  textbook_section: {
    type: 'textbook_section',
    displayName: '教材节',
    iconKey: 'textbook-section',
    shapeHint: 'card',
    evidenceBehavior: 'explicit_access',
  },
  slides: {
    type: 'slides',
    displayName: '课件',
    iconKey: 'slides',
    shapeHint: 'card',
    evidenceBehavior: 'explicit_access',
  },
  adaptive_quiz: {
    type: 'adaptive_quiz',
    displayName: '自适应练习',
    iconKey: 'adaptive-quiz',
    shapeHint: 'task',
    evidenceBehavior: 'assessment',
  },
  control_workbench: {
    type: 'control_workbench',
    displayName: '控制工作台',
    iconKey: 'control-workbench',
    shapeHint: 'lab',
    evidenceBehavior: 'simulation_trace',
  },
  simulation: {
    type: 'simulation',
    displayName: '仿真实验',
    iconKey: 'simulation',
    shapeHint: 'lab',
    evidenceBehavior: 'simulation_run',
  },
  arena_task: {
    type: 'arena_task',
    displayName: 'Arena 挑战',
    iconKey: 'arena',
    shapeHint: 'challenge',
    evidenceBehavior: 'judged_submission',
  },
  external_resource: {
    type: 'external_resource',
    displayName: '外部资料',
    iconKey: 'external-link',
    shapeHint: 'link',
    evidenceBehavior: 'explicit_access',
  },
  reflection: {
    type: 'reflection',
    displayName: '反思记录',
    iconKey: 'reflection',
    shapeHint: 'journal',
    evidenceBehavior: 'reflection',
  },
  checkpoint: {
    type: 'checkpoint',
    displayName: '阶段检查',
    iconKey: 'checkpoint',
    shapeHint: 'gate',
    evidenceBehavior: 'assessment_gate',
  },
  konling: {
    type: 'konling',
    displayName: '控灵伴学',
    iconKey: 'konling',
    shapeHint: 'assistant',
    evidenceBehavior: 'assistant_interaction',
  },
};

export type ResourceNodeSourceKind =
  | 'media_source_manifest'
  | 'teaching_resource'
  | 'resource_registry'
  | 'knowledge_graph'
  | 'textbook'
  | 'textbook_section'
  | 'runtime_lesson_step'
  | 'runtime_lesson_media'
  | 'runtime_handout'
  | 'simulation_resource'
  | 'arena_task'
  | 'external_resource'
  | 'control_workbench'
  | 'checkpoint'
  | 'reflection_prompt'
  | 'ai_intervention'
  | 'konling'
  | 'project'
  | 'exercise';

export type ResourceNodeEdgeKind =
  | 'prerequisite'
  | 'remedial'
  | 'extension'
  | 'alternative'
  | 'related';

export type ResourceNodeAvailability = 'available' | 'draft' | 'archived' | 'teacher_only';
export type ResourceNodePrivacyLevel = 'student-visible' | 'teacher-scoped' | 'admin-scoped';
export type ResourceNodeTeacherPolicy = 'allowed' | 'teacher-assigned' | 'teacher-only' | 'blocked';
export type ResourceNodeCognitiveLoad = 'low' | 'medium' | 'high';
export type ResourceNodeSourceOwner =
  | 'media_source_manifest'
  | 'TeachingResource'
  | 'runtime_lesson_media'
  | 'resource_registry'
  | 'knowledge_graph'
  | 'textbook'
  | 'simulation'
  | 'arena'
  | 'external_resource'
  | 'checkpoint'
  | 'ResourceNode';

export interface ResourceNodeSourceReference {
  kind: ResourceNodeSourceKind;
  ref: string;
}

export interface ResourceNodePlanningMetadata {
  prerequisites: string[];
  estimatedTimeMinutes: number | null;
  cognitiveLoad: ResourceNodeCognitiveLoad;
  knowledgeCoverage: string[];
  abilityImpact: Record<string, number>;
  cost: {
    effort: 'low' | 'medium' | 'high';
    requiresTeacherReview: boolean;
  };
  availability: ResourceNodeAvailability;
  teacherPolicy: ResourceNodeTeacherPolicy;
  privacyLevel: ResourceNodePrivacyLevel;
  terminalConstraints: string[];
  evidenceInstrumentation: string[];
  readiness: ResourceNodeReadinessMetadata | null;
  pathDisposition?: ResourcePathPlanningDisposition | null;
}

export interface ResourceNodeReadinessMetadata {
  minimumCompetency: Record<string, number>;
  minimumEvidenceCount: number;
  requiredCompletedNodeIds: string[];
  requiredOutcomeRefs: string[];
  unlockMessage: string;
  fallbackNodeIds: string[];
}

export type ResourcePathPlanningDispositionKind =
  | 'path-plannable'
  | 'supporting-citation'
  | 'embedded-asset'
  | 'evidence-producing'
  | 'excluded-with-rationale';

export type ResourcePathPlanningDispositionReviewStatus =
  | 'not-reviewed'
  | 'generated-provisional'
  | 'agent-reviewed'
  | 'human-confirmed';

export interface ResourcePathPlanningDisposition {
  kind: ResourcePathPlanningDispositionKind;
  reviewStatus: ResourcePathPlanningDispositionReviewStatus;
  rationale: string | null;
  sourceFamily: string;
  stableSourceRef: string;
  sourceVersionRef: string | null;
  reviewBatchId?: string | null;
  parentResourceNodeId: string | null;
  reviewedAt: string | null;
  reviewerId: string | null;
}

export interface ResourceNodeAuditIssue {
  code:
    | 'missing-render-or-launch-target'
    | 'missing-knowledge-mapping'
    | 'missing-capability-mapping'
    | 'invalid-prerequisite'
    | 'unavailable-resource'
    | 'teacher-policy-blocked'
    | 'missing-privacy-policy'
    | 'missing-evidence-instrumentation'
    | 'missing-external-source'
    | 'unsafe-external-url'
    | 'missing-external-estimated-time'
    | 'missing-external-applicable-goal'
    | 'missing-external-evidence-use-status'
    | 'external-resource-reference-only'
    | 'missing-external-privacy-policy'
    | 'missing-checkpoint-assessment-purpose'
    | 'missing-checkpoint-criteria'
    | 'missing-checkpoint-required-evidence'
    | 'missing-checkpoint-remediation'
    | 'missing-readiness-metadata'
    | 'missing-path-disposition'
    | 'missing-disposition-review'
    | 'missing-disposition-rationale'
    | 'missing-parent-planning-unit'
    | 'invalid-path-disposition-promotion'
    | 'textbook-container-not-path-node'
    | 'missing-runtime-projection-sidecar'
    | 'runtime-projection-not-path-resource'
    | 'missing-runtime-projection-source-hash'
    | 'missing-runtime-projection-source-version'
    | 'missing-runtime-projection-route-target'
    | 'missing-runtime-projection-evidence-contract'
    | 'missing-runtime-projection-review-audit'
    | 'provisional-runtime-projection'
    | 'stale-runtime-projection'
    | 'generic-arena-target'
    | 'knowledge-placeholder-identity'
    | 'arena-node-id-mismatch'
    | 'arena-source-kind-mismatch'
    | 'arena-source-ref-mismatch'
    | 'arena-route-mismatch'
    | 'unknown-arena-task';
  message: string;
  severity: 'blocking' | 'warning';
}

export interface ResourceNodeEligibility {
  pathEligible: boolean;
  reasons: string[];
  auditIssues: ResourceNodeAuditIssue[];
}

export interface ResourceNodeSourceOfRecord {
  content: ResourceNodeSourceOwner;
  catalogMetadata: ResourceNodeSourceOwner;
  planningMetadata: 'ResourceNode';
}

export type ResourceSemanticSourceOwner = ResourceNodeSourceOwner | 'grading';
export type ResourceSemanticSourceKind = ResourceNodeSourceKind | 'grading_artifact';
export type ResourceSemanticProjectionStatus = 'mapped' | 'blocked' | 'not-indexed';
export type RuntimeResourceProjectionLevel =
  | 'ResourceNode'
  | 'ResourceSegment'
  | 'CitationTarget'
  | 'RetrievalChunk'
  | 'PlanningUnit';
export type RuntimeResourceProjectionReviewStatus =
  | 'not-reviewed'
  | 'generated-provisional'
  | 'model-assisted-provisional'
  | 'external-tool-provisional'
  | 'model-cleared'
  | 'agent-reviewed'
  | 'human-confirmed'
  | 'blocked'
  | 'stale';
export type RuntimeResourceProjectionResourceType = ResourceNodeType | 'image';

export interface ResourceSemanticSourceReference {
  kind: ResourceSemanticSourceKind;
  ref: string;
}

export interface RuntimeResourceProjectionEvidenceContract {
  eventSource: boolean;
  eventType: boolean;
  clientEventIdPolicy: boolean;
  attemptKey: boolean;
  sourceLogId: boolean;
  dedupeKey: boolean;
  timestamps: boolean;
  learningFactPolicy: boolean;
  learningFactMaterializationPolicy?: 'materialized-learning-fact' | 'path-execution-evidence-only' | 'not-applicable' | 'missing';
  confidencePolicy: boolean;
  privacyScope: boolean;
  complete?: boolean;
  missingFields?: string[];
}

export interface RuntimeResourceProjectionReviewAudit {
  status: RuntimeResourceProjectionReviewStatus;
  reviewerId: string | null;
  reviewerRole: string | null;
  reviewedAt: string | null;
  reviewBatchId: string | null;
  reviewedSourceHash: string | null;
  reviewedVersionRef: string | null;
  generationToolOrModel: string | null;
  promptOrManifestHash: string | null;
  reviewerVisibleRationale?: string | null;
  independentEvidenceRef?: string | null;
  confidence: number | null;
  staleInvalidationRule: string;
  reviewArtifactVersion?: string | null;
  reviewSourceSha256?: string | null;
  reviewRowHash?: string | null;
}

export type RuntimeResourceProjectionAssetStatus =
  | 'not-applicable'
  | 'tracked-local-runtime-asset'
  | 'missing-local-runtime-asset'
  | 'external-http-runtime-asset';

export type RuntimeResourceProjectionAssetAvailability =
  | 'not-applicable'
  | 'tracked-in-git-index'
  | 'not-tracked-in-git-index'
  | 'external-media-index-url';

export interface RuntimeResourceProjectionSemanticEvidence {
  schemaVersion: 'runtime-lesson-semantic-evidence.v1';
  sourceFilePath: string;
  sourceFileKind: string;
  sourceFileHash: string | null;
  evidenceFilePath: string;
  evidenceFileHash: string;
  evidenceSelector: string;
  assetStatus: RuntimeResourceProjectionAssetStatus;
  assetAvailability: RuntimeResourceProjectionAssetAvailability;
  externalIdentitySha256: string | null;
}

export interface RuntimeResourceProjectionInput {
  id: string;
  resourceNodeId?: string | null;
  title: string;
  resourceType: RuntimeResourceProjectionResourceType;
  sourceKind: ResourceNodeSourceKind;
  sourceRef: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string | null;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  projectionLevel: RuntimeResourceProjectionLevel;
  lifecycleScope?: 'runtime' | 'audit-only';
  routeTarget?: string | null;
  renderTarget?: string | null;
  graphNodeRefs?: Partial<ResourceGraphNodeRefs>;
  estimatedTimeMinutes?: number | null;
  evidenceInstrumentation?: string[];
  privacyScope?: ResourceNodePrivacyLevel | null;
  teacherPolicy?: ResourceNodeTeacherPolicy | null;
  evidenceContract?: RuntimeResourceProjectionEvidenceContract | null;
  reviewAudit?: RuntimeResourceProjectionReviewAudit | null;
  reviewConcluded?: boolean;
  semanticConfirmed?: boolean;
  readiness?: ResourceNodeReadinessMetadata | null;
  citationTargets?: string[];
  groundingEligibility?: {
    retrievalReady: boolean;
    citationReady: boolean;
    authoringTriageReady: boolean;
  };
  runtimeSemanticEvidence?: RuntimeResourceProjectionSemanticEvidence;
  retrievalChunk?: {
    id: string;
    pathEligible: boolean;
    reason: string;
  } | null;
  pathEligibility?: {
    current: boolean;
    afterCompletion: boolean;
    masteryAffecting: boolean;
    blockedBy: string[];
  };
}

export interface RuntimeResourceProjectionMetadata {
  id: string;
  projectionLevel: RuntimeResourceProjectionLevel;
  sourceKind?: ResourceNodeSourceKind;
  sourcePathOrUrl: string | null;
  sourceRecord: string | null;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  graphNodeRefs: ResourceGraphNodeRefs;
  evidenceContract: RuntimeResourceProjectionEvidenceContract | null;
  reviewAudit: RuntimeResourceProjectionReviewAudit | null;
  groundingEligibility?: RuntimeResourceProjectionInput['groundingEligibility'] | null;
  runtimeSemanticEvidence?: RuntimeResourceProjectionSemanticEvidence | null;
}

export interface ResourceSemanticSourceOfRecord {
  content: ResourceSemanticSourceOwner;
  catalogMetadata: ResourceSemanticSourceOwner;
  planningMetadata: 'ResourceNode';
}

export interface ResourceSemanticSourceOwnership {
  contentOwner: ResourceSemanticSourceOwner;
  catalogMetadataOwner: ResourceSemanticSourceOwner;
  rawSubmissionOwner?: ResourceSemanticSourceOwner;
  semanticLayerStores: readonly string[];
  forbiddenProjectionFields: readonly string[];
}

export const RESOURCE_SEMANTIC_SOURCE_OWNERSHIP: Record<
  ResourceSemanticSourceKind,
  ResourceSemanticSourceOwnership
> = {
  media_source_manifest: {
    contentOwner: 'media_source_manifest',
    catalogMetadataOwner: 'media_source_manifest',
    semanticLayerStores: ['identity', 'sourceRefs', 'contentHash', 'citationRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'rawMedia', 'mediaBytes', 'transcript', 'descriptionBody', 'teacherEditableCatalogMetadata'],
  },
  teaching_resource: {
    contentOwner: 'TeachingResource',
    catalogMetadataOwner: 'TeachingResource',
    semanticLayerStores: ['identity', 'sourceRefs', 'contentHash', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'renderablePayload', 'teacherEditableCatalogMetadata', 'config'],
  },
  resource_registry: {
    contentOwner: 'resource_registry',
    catalogMetadataOwner: 'resource_registry',
    semanticLayerStores: ['identity', 'sourceRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'renderablePayload', 'defaultConfig'],
  },
  knowledge_graph: {
    contentOwner: 'knowledge_graph',
    catalogMetadataOwner: 'knowledge_graph',
    semanticLayerStores: ['identity', 'sourceRefs', 'knowledgeMapping', 'projectionStatus'],
    forbiddenProjectionFields: ['rawContent', 'cardMarkdown', 'renderablePayload'],
  },
  textbook: {
    contentOwner: 'textbook',
    catalogMetadataOwner: 'textbook',
    semanticLayerStores: ['identity', 'sourceRefs', 'knowledgeMapping', 'citationRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'markdownBody', 'figureAssetBytes', 'teacherEditableCatalogMetadata'],
  },
  textbook_section: {
    contentOwner: 'textbook',
    catalogMetadataOwner: 'textbook',
    semanticLayerStores: ['identity', 'sourceRefs', 'contentHash', 'knowledgeMapping', 'citationRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'markdownBody', 'chunkText', 'figureAssetBytes', 'teacherEditableCatalogMetadata'],
  },
  runtime_lesson_step: {
    contentOwner: 'runtime_lesson_media',
    catalogMetadataOwner: 'runtime_lesson_media',
    semanticLayerStores: ['identity', 'sourceRefs', 'knowledgeMapping', 'citationRefs', 'projectionStatus'],
    forbiddenProjectionFields: ['rawContent', 'renderablePayload', 'scriptBody'],
  },
  runtime_lesson_media: {
    contentOwner: 'runtime_lesson_media',
    catalogMetadataOwner: 'runtime_lesson_media',
    semanticLayerStores: ['identity', 'sourceRefs', 'contentHash', 'citationRefs', 'projectionStatus'],
    forbiddenProjectionFields: ['rawContent', 'renderablePayload', 'transcript', 'teacherEditableCatalogMetadata'],
  },
  runtime_handout: {
    contentOwner: 'runtime_lesson_media',
    catalogMetadataOwner: 'runtime_lesson_media',
    semanticLayerStores: ['identity', 'sourceRefs', 'contentHash', 'citationRefs', 'projectionStatus'],
    forbiddenProjectionFields: ['rawContent', 'renderablePayload', 'markdownBody', 'pdfBytes'],
  },
  simulation_resource: {
    contentOwner: 'simulation',
    catalogMetadataOwner: 'simulation',
    semanticLayerStores: ['identity', 'sourceRefs', 'knowledgeMapping', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'simulationInternals', 'hiddenState'],
  },
  arena_task: {
    contentOwner: 'arena',
    catalogMetadataOwner: 'arena',
    semanticLayerStores: ['identity', 'sourceRefs', 'knowledgeMapping', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'hiddenEvaluationInternals', 'officialAnswer'],
  },
  external_resource: {
    contentOwner: 'external_resource',
    catalogMetadataOwner: 'external_resource',
    semanticLayerStores: ['identity', 'sourceRefs', 'citationRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'scrapedPageBody', 'teacherEditableCatalogMetadata'],
  },
  control_workbench: {
    contentOwner: 'ResourceNode',
    catalogMetadataOwner: 'ResourceNode',
    semanticLayerStores: ['identity', 'sourceRefs', 'knowledgeMapping', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'workspaceState'],
  },
  checkpoint: {
    contentOwner: 'checkpoint',
    catalogMetadataOwner: 'checkpoint',
    semanticLayerStores: ['identity', 'sourceRefs', 'assessmentRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'rawSubmission', 'teacherEditableCatalogMetadata'],
  },
  reflection_prompt: {
    contentOwner: 'ResourceNode',
    catalogMetadataOwner: 'ResourceNode',
    semanticLayerStores: ['identity', 'sourceRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'rawSubmission'],
  },
  ai_intervention: {
    contentOwner: 'ResourceNode',
    catalogMetadataOwner: 'ResourceNode',
    semanticLayerStores: ['identity', 'sourceRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'assistantNarrative'],
  },
  konling: {
    contentOwner: 'ResourceNode',
    catalogMetadataOwner: 'ResourceNode',
    semanticLayerStores: ['identity', 'sourceRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'assistantNarrative'],
  },
  project: {
    contentOwner: 'ResourceNode',
    catalogMetadataOwner: 'ResourceNode',
    semanticLayerStores: ['identity', 'sourceRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'rawSubmission'],
  },
  exercise: {
    contentOwner: 'ResourceNode',
    catalogMetadataOwner: 'ResourceNode',
    semanticLayerStores: ['identity', 'sourceRefs', 'knowledgeMapping', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'rawSubmission', 'officialAnswer'],
  },
  grading_artifact: {
    contentOwner: 'grading',
    catalogMetadataOwner: 'grading',
    rawSubmissionOwner: 'grading',
    semanticLayerStores: ['identity', 'sourceRefs', 'citationRefs', 'projectionStatus', 'governance'],
    forbiddenProjectionFields: ['rawContent', 'rawSubmission', 'rubricPrivateNotes', 'teacherEditableCatalogMetadata'],
  },
};

export interface Resource {
  id: string;
  resourceNodeId: string;
  title: string;
  type: ResourceNodeType;
  sourceKind: ResourceSemanticSourceKind;
  sourceRefs: ResourceSemanticSourceReference[];
  contentHash: string | null;
  knowledgeNodeIds: string[];
  capabilityTargetIds: string[];
  graphProfile: ResourceNodeGraphProfile;
  sourceOfRecord: ResourceSemanticSourceOfRecord;
  projectionStatus: {
    retrieval: ResourceSemanticProjectionStatus;
    planning: ResourceSemanticProjectionStatus;
  };
  governance: {
    availability: ResourceNodeAvailability;
    teacherPolicy: ResourceNodeTeacherPolicy;
    privacyLevel: ResourceNodePrivacyLevel;
    pathDisposition: ResourcePathPlanningDisposition | null;
    auditIssueCodes: string[];
  };
}

export const RESOURCE_SEGMENT_SCENES = [
  'path',
  'konling',
  'diagnosis',
  'grading',
  'prep-pack',
  'report',
] as const;

export type ResourceSegmentScene = typeof RESOURCE_SEGMENT_SCENES[number];
export type ResourceSegmentKind =
  | 'primary'
  | 'step'
  | 'media'
  | 'checkpoint'
  | 'textbook_section'
  | 'handout'
  | 'video'
  | 'audio'
  | 'image'
  | 'slides'
  | 'exercise'
  | 'simulation'
  | 'arena';

export interface ResourceGraphNodeRefs {
  knowledge: string[];
  capability: string[];
  quality: string[];
}

export interface ResourceSceneAvailability {
  allowed: boolean;
  reason: string | null;
}

export type ResourceSceneAvailabilityMap = Record<ResourceSegmentScene, ResourceSceneAvailability>;

export interface ResourceCitationReadiness {
  status: 'verified' | 'resolvable' | 'unverified-anchor' | 'missing-target' | 'missing-transcript-or-anchor';
  verified: boolean;
  limitations: string[];
}

export interface ResourceEvidenceCapability {
  instrumentationRefs: string[];
  terminalValidationRole: 'terminal' | 'supporting' | 'none';
}

export interface ResourceGovernanceLimitation {
  code: string;
  message: string;
  scenes: ResourceSegmentScene[];
}

export interface ResourceSegmentAnchor {
  kind: 'resource' | 'step' | 'media' | 'page' | 'image' | 'exercise' | 'simulation-task' | 'arena-task';
  ref: string;
  startSeconds?: number | null;
  endSeconds?: number | null;
  page?: number | null;
}

export interface ResourceNodeGraphProfile {
  versionRefs: KaqArtifactVersionRefs;
  graphNodeRefs: ResourceGraphNodeRefs;
  sceneAvailability: ResourceSceneAvailabilityMap;
  stableSegmentRefs: string[];
  citationReadiness: ResourceCitationReadiness;
  evidenceCapability: ResourceEvidenceCapability;
  pathProfile: {
    estimatedTimeMinutes: number;
    cognitiveLoad: ResourceNodeCognitiveLoad;
    effort: ResourceNodePlanningMetadata['cost']['effort'];
    readiness: ResourceNodeReadinessMetadata | null;
  };
  governanceLimitations: ResourceGovernanceLimitation[];
}

export interface ResourceMediaManifestSegment {
  id: string;
  anchorRef?: string | null;
  startSeconds?: number | null;
  endSeconds?: number | null;
  page?: number | null;
  textRef?: string | null;
  imageDescriptionRef?: string | null;
  graphNodeRefs: ResourceGraphNodeRefs;
  sceneAvailability: Partial<ResourceSceneAvailabilityMap>;
  citationPolicy?: 'verified-citation-required' | 'source-reference-only' | null;
  aiUsePermission?: 'allowed' | 'restricted' | 'blocked' | null;
  privacyScope?: ResourceNodePrivacyLevel | null;
  evidenceInstrumentationRefs?: string[];
}

export interface ResourceMediaSourceManifest {
  sourceId: string;
  sourcePath: string;
  title?: string | null;
  sourceRepo?: string | null;
  sourceVersionRef?: string | null;
  freshnessRef?: string | null;
  contentHash?: string | null;
  license?: string | null;
  owner?: string | null;
  privacyScope?: ResourceNodePrivacyLevel | null;
  mediaType: 'video' | 'audio' | 'image' | 'slides';
  transcriptRef?: string | null;
  chapterRef?: string | null;
  descriptionRef?: string | null;
  segments: ResourceMediaManifestSegment[];
}

export interface ResourceMediaSourceManifestValidation {
  verifiedCitationReady: boolean;
  issues: string[];
}

export interface ResourceSegment {
  id: string;
  resourceId: string;
  sourceRef: ResourceSemanticSourceReference;
  kind: ResourceSegmentKind;
  anchor: ResourceSegmentAnchor;
  privacyScope: ResourceNodePrivacyLevel;
  graphNodeRefs: ResourceGraphNodeRefs;
  sceneAvailability: ResourceSceneAvailabilityMap;
  citationReadiness: ResourceCitationReadiness;
  evidenceCapability: ResourceEvidenceCapability;
  governanceLimitations: ResourceGovernanceLimitation[];
  contentHash: string | null;
}

export interface CitationTarget {
  id: string;
  resourceId: string;
  resourceSegmentId: string;
  sourceRef: ResourceSemanticSourceReference;
  target: string | null;
  privacyScope: ResourceNodePrivacyLevel;
  status: 'resolvable' | 'missing-target';
  readiness: ResourceCitationReadiness;
}

export interface RetrievalChunk {
  id: string;
  resourceId: string;
  resourceSegmentId: string;
  citationTargetId: string | null;
  textHash: string | null;
  privacyScope: ResourceNodePrivacyLevel;
  projectionStatus: ResourceSemanticProjectionStatus;
  graphNodeRefs: ResourceGraphNodeRefs;
  sceneAvailability: ResourceSceneAvailabilityMap;
  citationReadiness: ResourceCitationReadiness;
  pathEligibility: {
    eligible: false;
    reason: 'resource-node-planning-audit-required';
  };
}

export interface PlanningUnit {
  id: string;
  resourceId: string;
  resourceNodeId: string;
  title: string;
  target: string;
  pathEligible: true;
  pathSemantics: ResourceNodePathSemantics;
  prerequisites: string[];
  knowledgeCoverage: string[];
  abilityImpact: Record<string, number>;
  estimatedTimeMinutes: number;
  cognitiveLoad: ResourceNodeCognitiveLoad;
  effort: ResourceNodePlanningMetadata['cost']['effort'];
  evidenceInstrumentation: string[];
  launchBinding: {
    kind: 'resource-node' | 'checkpoint-contract';
    target: string;
    sourceRef: ResourceNodeSourceReference;
  };
  privacyLevel: ResourceNodePrivacyLevel;
  teacherPolicy: ResourceNodeTeacherPolicy;
  readiness: ResourceNodeReadinessMetadata | null;
  graphNodeRefs: ResourceGraphNodeRefs;
  sceneAvailability: ResourceSceneAvailabilityMap;
  citationReadiness: ResourceCitationReadiness;
  evidenceCapability: ResourceEvidenceCapability;
  pathProfile: ResourceNodeGraphProfile['pathProfile'];
  governanceLimitations: ResourceGovernanceLimitation[];
}

export interface ResourceSemanticProjection {
  resource: Resource;
  segments: ResourceSegment[];
  citationTargets: CitationTarget[];
  retrievalChunks: RetrievalChunk[];
  planningUnit: PlanningUnit | null;
}

export type ExternalResourceEvidenceUseStatus = 'explicit-access-required' | 'reference-only';
export type CheckpointReviewState = 'pending' | 'passed' | 'failed' | 'review';

export interface ResourceNodeExternalResourceMetadata {
  source: string | null;
  url: string | null;
  estimatedTimeMinutes: number | null;
  knowledgeCoverage: string[];
  applicableGoalId: string | null;
  evidenceUseStatus: ExternalResourceEvidenceUseStatus | null;
  privacyPolicy: ResourceNodePrivacyLevel | null;
}

export interface ResourceNodeCheckpointMetadata {
  assessmentPurpose: string | null;
  criteria: string[];
  requiredEvidenceRefs: string[];
  remediationBehavior: string | null;
  reviewState: CheckpointReviewState;
}

export interface ResourceNode {
  id: string;
  title: string;
  description: string | null;
  type: ResourceNodeType;
  courseModule: string | null;
  sourceKind: ResourceNodeSourceKind;
  sourceRef: string;
  sourceRefs: ResourceNodeSourceReference[];
  renderTarget: string | null;
  launchTarget: string | null;
  pathSemantics: ResourceNodePathSemantics;
  externalResource: ResourceNodeExternalResourceMetadata | null;
  checkpoint: ResourceNodeCheckpointMetadata | null;
  planningMetadata: ResourceNodePlanningMetadata;
  sourceOfRecord: ResourceNodeSourceOfRecord;
  runtimeProjection?: RuntimeResourceProjectionMetadata | null;
  eligibility: ResourceNodeEligibility;
}

export interface ResourceNodeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  kind: ResourceNodeEdgeKind;
  source: 'declared-prerequisite' | 'knowledge-link' | 'manual';
}

export interface ResourceNodeRegistry {
  nodes: ResourceNode[];
  edges: ResourceNodeEdge[];
  supportedTypes: readonly ResourceNodeType[];
  audit: {
    totalNodes: number;
    pathEligibleNodes: number;
    ineligibleNodes: Array<Pick<ResourceNode, 'id' | 'title' | 'type'> & { reasons: string[] }>;
  };
}

export interface ResourceNodeAuditOptions {
  strictEvidenceInstrumentation?: boolean;
}

export interface TeachingResourceNodeInput {
  id: string;
  title: string;
  displayName?: string | null;
  description?: string | null;
  type: string;
  registryId?: string | null;
  content?: string | null;
  category?: string | null;
  teacherOnly?: boolean | null;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  config?: Record<string, unknown> | null;
}

export type ResourceNodePlanningOverride = Partial<Pick<
  ResourceNodePlanningMetadata,
  | 'prerequisites'
  | 'estimatedTimeMinutes'
  | 'cognitiveLoad'
  | 'knowledgeCoverage'
  | 'abilityImpact'
  | 'cost'
  | 'availability'
  | 'teacherPolicy'
  | 'privacyLevel'
  | 'terminalConstraints'
  | 'evidenceInstrumentation'
  | 'readiness'
  | 'pathDisposition'
>>;

export interface RegisteredResourceNodeInput {
  id: string;
  label: string;
  type: 'INTERACTIVE_COMP' | 'SIMULATION_APP' | string;
  renderTarget?: string | null;
  launchTarget?: string | null;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  planningOverride?: ResourceNodePlanningOverride;
  defaultConfig?: Record<string, unknown>;
}

export interface KnowledgeNodeResourceInput {
  id: string;
  name: string;
  resources?: unknown[];
  tags?: string[];
}

export interface KnowledgeCardResourceNodeInput extends LightweightResourceNodeInput {
  sourceRef: string;
}

export interface RuntimeLessonNodeInput {
  lessonId: string;
  title: string;
  knowledgeNodeIds?: string[];
  steps?: Array<{
    id: string;
    title: string;
    knowledgeNodeIds?: string[];
    prerequisiteNodeIds?: string[];
    renderTarget?: string | null;
  }>;
  mediaResources?: Array<{
    id: string;
    title: string;
    kind: 'video' | 'audio' | 'slides' | 'pdf' | 'other' | string;
    url?: string | null;
    filename?: string | null;
    teachingResourceId?: string | null;
  }>;
  handoutPath?: string | null;
  handoutPdfPath?: string | null;
  handoutSourcePath?: string | null;
  handoutSourceHash?: string | null;
  handoutSourceVersionRef?: string | null;
}

export interface TextbookResourceNodeInput {
  bookId: string;
  title: string;
  sourceHref?: string | null;
  sourceHash?: string | null;
  sourceVersionRef?: string | null;
  knowledgeNodeIds?: string[];
  planningOverride?: ResourceNodePlanningOverride;
}

export interface TextbookSectionResourceNodeInput {
  bookId: string;
  sectionId: string;
  title: string;
  citationHref: string;
  sourceHash?: string | null;
  sourceVersionRef?: string | null;
  knowledgeNodeIds?: string[];
  capabilityTargetIds?: string[];
  prerequisiteNodeIds?: string[];
  estimatedTimeMinutes?: number | null;
  planningOverride?: ResourceNodePlanningOverride;
}

export interface SimulationResourceNodeInput {
  id: string;
  title: string;
  launchTarget: string;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  planningOverride?: ResourceNodePlanningOverride;
}

export interface ArenaTaskResourceNodeInput {
  id: string;
  title: string;
  launchTarget: string;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  official?: boolean;
  planningOverride?: ResourceNodePlanningOverride;
}

export interface ExternalResourceNodeInput {
  id: string;
  title: string;
  source?: string | null;
  url?: string | null;
  estimatedTimeMinutes?: number | null;
  knowledgeNodeIds?: string[];
  applicableGoalId?: string | null;
  evidenceUseStatus?: ExternalResourceEvidenceUseStatus | null;
  privacyPolicy?: ResourceNodePrivacyLevel | null;
  prerequisiteNodeIds?: string[];
  planningOverride?: ResourceNodePlanningOverride;
}

export interface CheckpointResourceNodeInput {
  id: string;
  title: string;
  assessmentPurpose?: string | null;
  criteria?: string[];
  requiredEvidenceRefs?: string[];
  remediationBehavior?: string | null;
  reviewState?: CheckpointReviewState;
  launchTarget?: string | null;
  renderTarget?: string | null;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  planningOverride?: ResourceNodePlanningOverride;
}

export interface LightweightResourceNodeInput {
  id: string;
  title: string;
  sourceRef?: string;
  knowledgeNodeIds?: string[];
  prerequisiteNodeIds?: string[];
  launchTarget?: string | null;
  renderTarget?: string | null;
  teacherOnly?: boolean;
  planningOverride?: ResourceNodePlanningOverride;
}

export interface ResourceNodeRegistryInput {
  auditOptions?: ResourceNodeAuditOptions;
  teachingResources?: TeachingResourceNodeInput[];
  registeredResources?: RegisteredResourceNodeInput[];
  knowledgeNodes?: KnowledgeNodeResourceInput[];
  knowledgeCards?: KnowledgeCardResourceNodeInput[];
  runtimeLessons?: RuntimeLessonNodeInput[];
  runtimeResourceProjections?: RuntimeResourceProjectionInput[];
  textbooks?: TextbookResourceNodeInput[];
  textbookSections?: TextbookSectionResourceNodeInput[];
  simulations?: SimulationResourceNodeInput[];
  arenaTasks?: ArenaTaskResourceNodeInput[];
  externalResources?: ExternalResourceNodeInput[];
  controlWorkbenchTasks?: LightweightResourceNodeInput[];
  reflectionPrompts?: LightweightResourceNodeInput[];
  checkpoints?: CheckpointResourceNodeInput[];
  aiInterventions?: LightweightResourceNodeInput[];
  konlingSupports?: LightweightResourceNodeInput[];
  projects?: LightweightResourceNodeInput[];
  exercises?: LightweightResourceNodeInput[];
}

export function buildResourceNodeRegistry(input: ResourceNodeRegistryInput): ResourceNodeRegistry {
  const nodeCandidates = [
    ...buildTeachingResourceNodes(input.teachingResources ?? []),
    ...buildRegisteredResourceNodes(input.registeredResources ?? []),
    ...buildKnowledgeResourceNodes(input.knowledgeNodes ?? []),
    ...buildKnowledgeCardNodes(input.knowledgeCards ?? []),
    ...buildRuntimeLessonNodes(input.runtimeLessons ?? []),
    ...buildRuntimeProjectionResourceNodes(input.runtimeResourceProjections ?? []),
    ...buildTextbookNodes(input.textbooks ?? []),
    ...buildTextbookSectionNodes(input.textbookSections ?? []),
    ...buildLightweightNodes(input.controlWorkbenchTasks ?? [], 'control_workbench', 'control_workbench'),
    ...buildSimulationNodes(input.simulations ?? []),
    ...buildArenaTaskNodes(input.arenaTasks ?? []),
    ...buildExternalResourceNodes(input.externalResources ?? []),
    ...buildLightweightNodes(input.reflectionPrompts ?? [], 'reflection', 'reflection_prompt'),
    ...buildCheckpointNodes(input.checkpoints ?? []),
    ...buildLightweightNodes(input.aiInterventions ?? [], 'ai_intervention', 'ai_intervention'),
    ...buildLightweightNodes(input.konlingSupports ?? [], 'konling', 'konling'),
    ...buildLightweightNodes(input.projects ?? [], 'project', 'project'),
    ...buildExerciseNodes(input.exercises ?? []),
  ];
  const nodesById = mergeOverlappingSources(nodeCandidates);
  const edges = buildResourceNodeEdges(nodesById);
  const auditedNodes = Array.from(nodesById.values())
    .map((node) => ({ ...node, eligibility: auditResourceNode(node, nodesById, input.auditOptions) }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const highConfidenceAudits = new Map(auditedNodes.map((node) => [
    node.id,
    buildResourceNodeHighConfidencePlanningAudit(node),
  ]));

  return {
    nodes: auditedNodes,
    edges,
    supportedTypes: RESOURCE_NODE_TYPES,
    audit: buildResourceNodeRegistryAudit(auditedNodes, highConfidenceAudits),
  };
}

export function applyCoreResourcePathReadinessDispositions(registry: ResourceNodeRegistry): ResourceNodeRegistry {
  const normalizedNodesById = new Map(
    registry.nodes.map((node) => [node.id, withCoreResourcePathReadinessDisposition(node)]),
  );
  const auditedNodes = Array.from(normalizedNodesById.values())
    .map((node) => ({ ...node, eligibility: auditResourceNode(node, normalizedNodesById) }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const highConfidenceAudits = new Map(auditedNodes.map((node) => [
    node.id,
    buildResourceNodeHighConfidencePlanningAudit(node),
  ]));

  return {
    ...registry,
    nodes: auditedNodes,
    edges: buildResourceNodeEdges(new Map(auditedNodes.map((node) => [node.id, node]))),
    audit: buildResourceNodeRegistryAudit(auditedNodes, highConfidenceAudits),
  };
}

function buildResourceNodeRegistryAudit(
  auditedNodes: ResourceNode[],
  highConfidenceAudits: ReadonlyMap<string, ReturnType<typeof buildResourceNodeHighConfidencePlanningAudit>>,
): ResourceNodeRegistry['audit'] {
  return {
    totalNodes: auditedNodes.length,
    pathEligibleNodes: auditedNodes
      .filter((node) => highConfidenceAudits.get(node.id)?.pathEligible)
      .length,
    ineligibleNodes: auditedNodes
      .filter((node) => !highConfidenceAudits.get(node.id)?.pathEligible)
      .map((node) => ({
        id: node.id,
        title: node.title,
        type: node.type,
        reasons: uniqueSorted(highConfidenceAudits.get(node.id)?.issues.map((issue) => issue.code) ?? []),
      })),
  };
}

function withCoreResourcePathReadinessDisposition(node: ResourceNode): ResourceNode {
  if (node.planningMetadata.pathDisposition) return node;
  if (!isCoreResourcePathReadinessReviewedNode(node)) {
    return {
      ...node,
      planningMetadata: {
        ...node.planningMetadata,
        pathDisposition: {
          kind: 'excluded-with-rationale',
          reviewStatus: 'generated-provisional',
          rationale: `Resource source ${coreResourcePathReadinessReviewRef(node)} is outside ${CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.id}.`,
          sourceFamily: node.sourceKind,
          stableSourceRef: node.sourceRef,
          sourceVersionRef: node.runtimeProjection?.sourceVersionRef ??
            CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.defaultSourceVersionRef,
          parentResourceNodeId: null,
          reviewedAt: null,
          reviewerId: null,
        },
      },
    };
  }

  const baseAudit = buildResourceNodeHighConfidencePlanningAuditInternal(node, {
    includeDispositionPromotion: false,
  });
  const pathPlannable = baseAudit.pathEligible;
  const sourceVersionRef = node.runtimeProjection?.sourceVersionRef ?? 'resource-node-registry.v1';
  const disposition: ResourcePathPlanningDisposition = pathPlannable
    ? {
      kind: 'path-plannable',
      reviewStatus: 'human-confirmed',
      rationale: 'Core resource has reviewed route, semantic, evidence, privacy, and readiness metadata for path planning.',
      sourceFamily: node.sourceKind,
      stableSourceRef: node.sourceRef,
      sourceVersionRef,
      parentResourceNodeId: null,
      reviewedAt: CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.reviewedAt,
      reviewerId: CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.reviewerId,
    }
    : {
      kind: 'excluded-with-rationale',
      reviewStatus: 'human-confirmed',
      rationale: `Core resource is not an independent path-planning unit until these blockers are resolved: ${uniqueSorted(baseAudit.issues.map((issue) => issue.code)).join(', ') || 'not-path-ready'}.`,
      sourceFamily: node.sourceKind,
      stableSourceRef: node.sourceRef,
      sourceVersionRef,
      parentResourceNodeId: null,
      reviewedAt: CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.reviewedAt,
      reviewerId: CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.reviewerId,
    };

  return {
    ...node,
    planningMetadata: {
      ...node.planningMetadata,
      readiness: pathPlannable
        ? node.planningMetadata.readiness ?? buildDefaultCoreResourceReadiness(node)
        : node.planningMetadata.readiness,
      pathDisposition: disposition,
    },
  };
}

function buildDefaultCoreResourceReadiness(node: ResourceNode): ResourceNodeReadinessMetadata {
  return {
    minimumCompetency: {},
    minimumEvidenceCount: 0,
    requiredCompletedNodeIds: [],
    requiredOutcomeRefs: [],
    unlockMessage: '完成必要的前置学习证据后进入该资源。',
    fallbackNodeIds: [],
  };
}

export function auditResourceNode(
  node: ResourceNode,
  nodesById: Map<string, ResourceNode> = new Map([[node.id, node]]),
  options: ResourceNodeAuditOptions = {},
): ResourceNodeEligibility {
  const issues: ResourceNodeAuditIssue[] = [];
  if (node.type === 'textbook') {
    issues.push({
      code: 'textbook-container-not-path-node',
      severity: 'blocking',
      message: 'Textbook containers are catalog resources; path planning uses audited textbook sections.',
    });
  }
  if (!node.renderTarget && !node.launchTarget) {
    issues.push({
      code: 'missing-render-or-launch-target',
      severity: 'blocking',
      message: 'ResourceNode lacks a render target or launch target.',
    });
  }
  if (node.planningMetadata.knowledgeCoverage.length === 0) {
    issues.push({
      code: 'missing-knowledge-mapping',
      severity: 'blocking',
      message: 'ResourceNode has no knowledge mapping for path planning.',
    });
  }
  const invalidPrerequisites = node.planningMetadata.prerequisites.filter((id) => !nodesById.has(id));
  if (invalidPrerequisites.length > 0) {
    issues.push({
      code: 'invalid-prerequisite',
      severity: 'blocking',
      message: `ResourceNode references missing prerequisites: ${invalidPrerequisites.join(', ')}`,
    });
  }
  if (node.planningMetadata.availability !== 'available') {
    issues.push({
      code: 'unavailable-resource',
      severity: 'blocking',
      message: `ResourceNode availability is ${node.planningMetadata.availability}.`,
    });
  }
  if (node.planningMetadata.teacherPolicy === 'blocked') {
    issues.push({
      code: 'teacher-policy-blocked',
      severity: 'blocking',
      message: 'ResourceNode is excluded by teacher policy.',
    });
  }
  if (!node.planningMetadata.privacyLevel) {
    issues.push({
      code: 'missing-privacy-policy',
      severity: 'blocking',
      message: 'ResourceNode has no privacy policy.',
    });
  }
  if (node.planningMetadata.evidenceInstrumentation.length === 0) {
    issues.push({
      code: 'missing-evidence-instrumentation',
      severity: options.strictEvidenceInstrumentation ? 'blocking' : 'warning',
      message: 'ResourceNode has no evidence instrumentation mapping.',
    });
  }
  if (
    !issues.some((issue) => issue.severity === 'blocking') &&
    requiresReadinessMetadata(node) &&
    !node.planningMetadata.readiness
  ) {
    issues.push({
      code: 'missing-readiness-metadata',
      severity: 'warning',
      message: 'High-complexity path node lacks readiness metadata for immediate execution gating.',
    });
  }
  issues.push(...auditExternalResourceNode(node));
  issues.push(...auditArenaTaskNode(node));
  issues.push(...auditCheckpointNode(node));
  issues.push(...auditRuntimeProjectionPlanning(node));
  issues.push(...auditPathDispositionPlanningEligibility(node));

  const blockingIssues = issues.filter((issue) => issue.severity === 'blocking');
  return {
    pathEligible: blockingIssues.length === 0,
    reasons: issues.map((issue) => issue.code),
    auditIssues: issues,
  };
}

function auditArenaTaskNode(node: ResourceNode): ResourceNodeAuditIssue[] {
  const explicitlyPathPlannable = node.planningMetadata.pathDisposition?.kind === 'path-plannable';
  const executableTerminal = node.planningMetadata.terminalConstraints.some((constraint) =>
    constraint === 'terminal-node' || constraint === 'terminal-validation'
  );
  if (
    node.type !== 'arena_task' ||
    (node.sourceKind !== 'arena_task' && !explicitlyPathPlannable && !executableTerminal)
  ) return [];
  const integrity = resolveArenaPathTargetIntegrity({
    nodeId: node.id,
    type: node.type,
    sourceKind: node.sourceKind,
    sourceRef: node.sourceRef,
    target: node.launchTarget,
  });
  if (integrity.status !== 'blocked') return [];
  return [{
    code: integrity.reason,
    severity: 'blocking',
    message: `Arena ResourceNode target integrity failed: ${integrity.reason}.`,
  }];
}

export interface ResourcePathPlanningDispositionAuditContext {
  nodesById?: ReadonlyMap<string, ResourceNode>;
}

export function auditResourcePathPlanningDisposition(
  node: ResourceNode,
  context: ResourcePathPlanningDispositionAuditContext = {},
): ResourceNodeAuditIssue[] {
  const disposition = node.planningMetadata.pathDisposition;
  if (!disposition) {
    return [{
      code: 'missing-path-disposition',
      severity: 'warning',
      message: 'ResourceNode has no reviewed path-planning disposition.',
    }];
  }

  const issues: ResourceNodeAuditIssue[] = [];
  const reviewEvidenceComplete = isResourcePathPlanningDispositionReviewConfirmed(disposition);
  if (!reviewEvidenceComplete) {
    issues.push({
      code: 'missing-disposition-review',
      severity: 'warning',
      message: 'Resource path-planning disposition requires confirmed review status, reviewer, review time, and source version.',
    });
  }
  if (!disposition.rationale) {
    issues.push({
      code: 'missing-disposition-rationale',
      severity: 'warning',
      message: 'Resource path-planning dispositions require reviewer-visible rationale.',
    });
  }
  if (disposition.kind === 'embedded-asset') {
    const parentResourceNodeId = disposition.parentResourceNodeId;
    if (!parentResourceNodeId) {
      issues.push({
        code: 'missing-parent-planning-unit',
        severity: 'warning',
        message: 'Embedded assets require a parent ResourceNode or PlanningUnit link.',
      });
    } else if (context.nodesById) {
      const parent = context.nodesById.get(parentResourceNodeId);
      if (!parent || !buildResourceSemanticProjection(parent).planningUnit) {
        issues.push({
          code: 'missing-parent-planning-unit',
          severity: 'warning',
          message: 'Embedded assets require parentResourceNodeId to reference an existing path-plannable ResourceNode.',
        });
      }
    }
  }
  if (disposition.kind === 'evidence-producing' && node.planningMetadata.evidenceInstrumentation.length === 0) {
    issues.push({
      code: 'missing-evidence-instrumentation',
      severity: 'warning',
      message: 'Evidence-producing resources require learner evidence instrumentation.',
    });
  }
  if (disposition.kind === 'path-plannable') {
    const highConfidenceAudit = buildResourceNodeHighConfidencePlanningAuditInternal(node, {
      includeDispositionPromotion: false,
    });
    if (
      !isResourcePathPlanningDispositionHumanReviewed(disposition) ||
      !highConfidenceAudit.pathEligible ||
      !node.planningMetadata.readiness
    ) {
      issues.push({
        code: 'invalid-path-disposition-promotion',
        severity: 'blocking',
        message: 'Path-plannable disposition requires human-confirmed review, path audit clearance, and readiness metadata.',
      });
    }
  }

  return issues;
}

export function isResourcePathPlanningDispositionHumanReviewed(
  disposition: ResourcePathPlanningDisposition | null | undefined,
): disposition is ResourcePathPlanningDisposition {
  return Boolean(
    disposition &&
    disposition.reviewStatus === 'human-confirmed' &&
    disposition.reviewerId &&
    disposition.reviewedAt &&
    disposition.sourceVersionRef,
  );
}

export function isResourcePathPlanningDispositionReviewConfirmed(
  disposition: ResourcePathPlanningDisposition | null | undefined,
): disposition is ResourcePathPlanningDisposition {
  return Boolean(
    disposition &&
    (disposition.reviewStatus === 'human-confirmed' || disposition.reviewStatus === 'agent-reviewed') &&
    disposition.reviewerId &&
    disposition.reviewedAt &&
    disposition.sourceVersionRef,
  );
}

export function buildResourceSemanticProjection(node: ResourceNode): ResourceSemanticProjection {
  const resourceId = `resource:${node.id}`;
  const primarySourceRef = { kind: node.sourceKind, ref: node.sourceRef };
  const segmentId = `resource-segment:${node.id}:primary`;
  const target = node.launchTarget ?? node.renderTarget;
  const citationTargetId = `citation-target:${node.id}:primary`;
  const auditIssueCodes = buildProjectionAuditIssueCodes(node);
  const graphNodeRefs = buildResourceGraphNodeRefs(node);
  const sceneAvailability = buildResourceSceneAvailability(node, target);
  const citationReadiness = buildCitationReadiness(node, target);
  const evidenceCapability = buildEvidenceCapability(node);
  const governanceLimitations = buildGovernanceLimitations(node, target, auditIssueCodes, sceneAvailability);
  const pathProfile = buildResourcePathProfile(node);
  const resource: Resource = {
    id: resourceId,
    resourceNodeId: node.id,
    title: node.title,
    type: node.type,
    sourceKind: node.sourceKind,
    sourceRefs: node.sourceRefs,
    contentHash: node.runtimeProjection?.sourceHash ?? null,
    knowledgeNodeIds: node.planningMetadata.knowledgeCoverage,
    capabilityTargetIds: Object.keys(node.planningMetadata.abilityImpact).sort((left, right) => left.localeCompare(right)),
    graphProfile: {
      versionRefs: buildKaqArtifactVersionRefs(),
      graphNodeRefs,
      sceneAvailability,
      stableSegmentRefs: [segmentId],
      citationReadiness,
      evidenceCapability,
      pathProfile,
      governanceLimitations,
    },
    sourceOfRecord: node.sourceOfRecord,
    projectionStatus: {
      retrieval: target ? 'mapped' : 'blocked',
      planning: isPlanningUnitEligible(node, target) ? 'mapped' : 'blocked',
    },
    governance: {
      availability: node.planningMetadata.availability,
      teacherPolicy: node.planningMetadata.teacherPolicy,
      privacyLevel: node.planningMetadata.privacyLevel,
      pathDisposition: node.planningMetadata.pathDisposition ?? null,
      auditIssueCodes,
    },
  };
  const segments: ResourceSegment[] = [{
    id: segmentId,
    resourceId,
    sourceRef: primarySourceRef,
    kind: segmentKindForNode(node),
    anchor: buildSegmentAnchor(node, target),
    privacyScope: node.planningMetadata.privacyLevel,
    graphNodeRefs,
    sceneAvailability,
    citationReadiness,
    evidenceCapability,
    governanceLimitations,
    contentHash: node.runtimeProjection?.sourceHash ?? null,
  }];
  const citationTargets: CitationTarget[] = [{
    id: citationTargetId,
    resourceId,
    resourceSegmentId: segmentId,
    sourceRef: primarySourceRef,
    target,
    privacyScope: node.planningMetadata.privacyLevel,
    status: target ? 'resolvable' : 'missing-target',
    readiness: citationReadiness,
  }];
  const retrievalChunks: RetrievalChunk[] = [{
    id: `retrieval-chunk:${node.id}:primary`,
    resourceId,
    resourceSegmentId: segmentId,
    citationTargetId,
    textHash: null,
    privacyScope: node.planningMetadata.privacyLevel,
    projectionStatus: target ? 'not-indexed' : 'blocked',
    graphNodeRefs,
    sceneAvailability,
    citationReadiness,
    pathEligibility: {
      eligible: false,
      reason: 'resource-node-planning-audit-required',
    },
  }];
  return {
    resource,
    segments,
    citationTargets,
    retrievalChunks,
    planningUnit: buildPlanningUnit(node, resourceId, target),
  };
}

export function validateResourceMediaSourceManifest(
  manifest: ResourceMediaSourceManifest,
): ResourceMediaSourceManifestValidation {
  const issues: string[] = [];
  if (!manifest.sourceId) issues.push('missing-source-id');
  const sourcePath = typeof manifest.sourcePath === 'string' ? manifest.sourcePath : '';
  if (!sourcePath.trim()) issues.push('missing-source-path');
  if (sourcePath && !isSafeMediaSourcePath(sourcePath)) issues.push('unsafe-source-path');
  if (!isNonEmptyString(manifest.sourceVersionRef) && !isNonEmptyString(manifest.freshnessRef)) {
    issues.push('missing-source-version-or-freshness');
  }
  if (!isMediaSourceManifestType(manifest.mediaType)) issues.push('invalid-media-type');
  if (!Array.isArray(manifest.segments) || manifest.segments.length === 0) {
    issues.push('missing-segments');
    return { verifiedCitationReady: false, issues };
  }
  const manifestPrivacyScopeValid = isResourceNodePrivacyLevel(manifest.privacyScope);
  if (isDeclaredValue(manifest.privacyScope) && !manifestPrivacyScopeValid) issues.push('invalid-privacy-scope');
  if (
    !manifestPrivacyScopeValid &&
    !manifest.segments.some((segment) => (
      isMediaManifestSegmentRecord(segment) &&
      isResourceNodePrivacyLevel(segment.privacyScope)
    ))
  ) {
    issues.push('missing-privacy-scope');
  }

  const segmentIdCounts = new Map<string, number>();
  manifest.segments.forEach((segment) => {
    if (!isMediaManifestSegmentRecord(segment) || !isNonEmptyString(segment.id)) return;
    segmentIdCounts.set(segment.id, (segmentIdCounts.get(segment.id) ?? 0) + 1);
  });

  manifest.segments.forEach((segment, index) => {
    const prefix = `segments.${index}`;
    if (!isMediaManifestSegmentRecord(segment)) {
      issues.push(`${prefix}.invalid-segment`);
      return;
    }
    if (!isNonEmptyString(segment.id)) issues.push(`${prefix}.missing-id`);
    if (isNonEmptyString(segment.id) && (segmentIdCounts.get(segment.id) ?? 0) > 1) issues.push(`${prefix}.duplicate-id`);
    if (!hasMediaSegmentAnchor(manifest.mediaType, segment)) issues.push(`${prefix}.missing-anchor`);
    if (!hasAnyGraphRef(segment.graphNodeRefs)) issues.push(`${prefix}.missing-graph-bindings`);
    if (!hasAnySceneAvailability(segment.sceneAvailability)) issues.push(`${prefix}.missing-scene-availability`);
    if (!segment.citationPolicy) issues.push(`${prefix}.missing-citation-policy`);
    if (segment.citationPolicy && !isMediaCitationPolicy(segment.citationPolicy)) issues.push(`${prefix}.invalid-citation-policy`);
    if (!segment.aiUsePermission) issues.push(`${prefix}.missing-ai-use-permission`);
    if (segment.aiUsePermission && !isMediaAiUsePermission(segment.aiUsePermission)) issues.push(`${prefix}.invalid-ai-use-permission`);
    if (segment.aiUsePermission === 'blocked') issues.push(`${prefix}.blocked-ai-use`);
    if (isDeclaredValue(segment.privacyScope) && !isResourceNodePrivacyLevel(segment.privacyScope)) issues.push(`${prefix}.invalid-privacy-scope`);
    if (!isResourceNodePrivacyLevel(segment.privacyScope) && !manifestPrivacyScopeValid) {
      issues.push(`${prefix}.missing-privacy-scope`);
    }
    if (
      (manifest.mediaType === 'video' || manifest.mediaType === 'audio') &&
      segment.citationPolicy === 'verified-citation-required' &&
      !manifest.transcriptRef &&
      !manifest.chapterRef
    ) {
      issues.push(`${prefix}.missing-transcript`);
    }
    if (
      (manifest.mediaType === 'video' || manifest.mediaType === 'audio') &&
      !manifest.transcriptRef &&
      !manifest.chapterRef &&
      !hasFiniteMediaTimecode(segment)
    ) {
      issues.push(`${prefix}.missing-transcript-or-timecode-anchor`);
    }
    if (
      manifest.mediaType === 'slides' &&
      segment.citationPolicy === 'verified-citation-required' &&
      !segment.textRef &&
      !manifest.descriptionRef
    ) {
      issues.push(`${prefix}.missing-description`);
    }
    if (
      manifest.mediaType === 'image' &&
      segment.citationPolicy === 'verified-citation-required' &&
      !segment.imageDescriptionRef &&
      !manifest.descriptionRef
    ) {
      issues.push(`${prefix}.missing-description`);
    }
  });

  return {
    verifiedCitationReady: issues.length === 0,
    issues,
  };
}

export function buildMediaSourceManifestSemanticProjection(
  manifest: ResourceMediaSourceManifest,
): ResourceSemanticProjection {
  const validation = validateResourceMediaSourceManifest(manifest);
  const resourceId = `media-source:${manifest.sourceId || 'unknown'}`;
  const mediaType = normalizedMediaManifestType(manifest.mediaType);
  const sourceRef: ResourceSemanticSourceReference = {
    kind: 'media_source_manifest',
    ref: manifest.sourceId,
  };
  const sourceRefs = buildMediaManifestSourceRefs(manifest, sourceRef);
  const manifestSegments = Array.isArray(manifest.segments)
    ? manifest.segments.map(normalizeMediaManifestSegment)
    : [];
  const segmentKeys = allocateMediaSegmentKeys(manifestSegments, validation.issues);
  const segments = manifestSegments.map((segment, index): ResourceSegment => {
    const segmentIssues = issuesForMediaSegment(validation.issues, index);
    const segmentId = mediaSegmentId(manifest, segmentKeys[index]);
    const privacyScope = mediaSegmentPrivacyScope(manifest, segment);
    const citationReadiness = buildMediaSegmentCitationReadiness(segment, segmentIssues);
    const sceneAvailability = buildMediaSegmentSceneAvailability(segment, segmentIssues, privacyScope);
    return {
      id: segmentId,
      resourceId,
      sourceRef,
      kind: resourceSegmentKindForMediaManifest(mediaType),
      anchor: buildMediaSegmentAnchor(manifest, segment),
      privacyScope,
      graphNodeRefs: normalizeResourceGraphNodeRefs(segment.graphNodeRefs),
      sceneAvailability,
      citationReadiness,
      evidenceCapability: {
        instrumentationRefs: segment.evidenceInstrumentationRefs ?? [],
        terminalValidationRole: segment.evidenceInstrumentationRefs?.length ? 'supporting' : 'none',
      },
      governanceLimitations: buildMediaSegmentGovernanceLimitations(segmentIssues, sceneAvailability),
      contentHash: manifest.contentHash ?? null,
    };
  });
  const citationTargets = segments.map((segment, index): CitationTarget => {
    const ready = segment.citationReadiness.verified || segment.citationReadiness.status === 'resolvable';
    const key = mediaSegmentKeyFromProjectedId(manifest, segment.id);
    return {
      id: `media-citation-target:${manifest.sourceId || 'unknown'}:${key}`,
      resourceId,
      resourceSegmentId: segment.id,
      sourceRef,
      target: ready ? segment.anchor.ref : null,
      privacyScope: segment.privacyScope,
      status: ready ? 'resolvable' : 'missing-target',
      readiness: segment.citationReadiness,
    };
  });
  const retrievalChunks = segments.map((segment, index): RetrievalChunk => {
    const citationTarget = citationTargets[index];
    const key = mediaSegmentKeyFromProjectedId(manifest, segment.id);
    return {
      id: `media-retrieval-chunk:${manifest.sourceId || 'unknown'}:${key}`,
      resourceId,
      resourceSegmentId: segment.id,
      citationTargetId: citationTarget.status === 'resolvable' ? citationTarget.id : null,
      textHash: null,
      privacyScope: segment.privacyScope,
      projectionStatus: citationTarget.status === 'resolvable' ? 'mapped' : 'blocked',
      graphNodeRefs: segment.graphNodeRefs,
      sceneAvailability: segment.sceneAvailability,
      citationReadiness: segment.citationReadiness,
      pathEligibility: {
        eligible: false,
        reason: 'resource-node-planning-audit-required',
      },
    };
  });
  const graphNodeRefs = mergeResourceGraphNodeRefs(segments.map((segment) => segment.graphNodeRefs));
  const citationReadiness = buildMediaManifestCitationReadiness(validation.issues, segments);
  const privacyLevel = mostRestrictivePrivacyScope([
    manifest.privacyScope,
    ...segments.map((segment) => segment.privacyScope),
  ]);
  const resource: Resource = {
    id: resourceId,
    resourceNodeId: resourceId,
    title: manifest.title ?? manifest.sourceId,
    type: resourceNodeTypeForMediaManifest(mediaType),
    sourceKind: 'media_source_manifest',
    sourceRefs,
    contentHash: manifest.contentHash ?? null,
    knowledgeNodeIds: graphNodeRefs.knowledge,
    capabilityTargetIds: graphNodeRefs.capability,
    graphProfile: {
      versionRefs: buildKaqArtifactVersionRefs(),
      graphNodeRefs,
      sceneAvailability: mergeMediaSceneAvailability(segments),
      stableSegmentRefs: segments.map((segment) => segment.id),
      citationReadiness,
      evidenceCapability: mergeMediaEvidenceCapability(segments),
      pathProfile: {
        estimatedTimeMinutes: estimateMediaManifestMinutes(manifest),
        cognitiveLoad: 'medium',
        effort: 'medium',
        readiness: null,
      },
      governanceLimitations: buildMediaSegmentGovernanceLimitations(validation.issues, mergeMediaSceneAvailability(segments)),
    },
    sourceOfRecord: {
      content: 'media_source_manifest',
      catalogMetadata: 'media_source_manifest',
      planningMetadata: 'ResourceNode',
    },
    projectionStatus: {
      retrieval: retrievalChunks.some((chunk) => chunk.projectionStatus === 'mapped') ? 'mapped' : 'blocked',
      planning: 'blocked',
    },
    governance: {
      availability: 'available',
      teacherPolicy: 'allowed',
      privacyLevel,
      pathDisposition: null,
      auditIssueCodes: validation.issues,
    },
  };
  return {
    resource,
    segments,
    citationTargets,
    retrievalChunks,
    planningUnit: null,
  };
}

export function validateResourceSemanticProjection(value: Record<string, unknown>): string[] {
  const forbiddenFields = new Set([
    'rawContent',
    'renderablePayload',
    'teacherEditableCatalogMetadata',
    'rawSubmission',
    'hiddenEvaluationInternals',
    'officialAnswer',
    'transcript',
    'config',
  ]);
  for (const sourceKind of collectProjectionSourceKinds(value)) {
    const ownership = semanticOwnershipForSourceKind(sourceKind);
    if (!ownership) continue;
    for (const field of ownership.forbiddenProjectionFields) {
      forbiddenFields.add(field);
    }
  }
  return collectForbiddenProjectionFields(value, forbiddenFields);
}

function auditExternalResourceNode(node: ResourceNode): ResourceNodeAuditIssue[] {
  if (node.type !== 'external_resource') return [];
  const external = node.externalResource;
  const issues: ResourceNodeAuditIssue[] = [];
  if (!external?.source?.trim()) {
    issues.push({
      code: 'missing-external-source',
      severity: 'blocking',
      message: 'External resource lacks a source label.',
    });
  }
  if (!external?.url || node.launchTarget !== external.url) {
    issues.push({
      code: 'unsafe-external-url',
      severity: 'blocking',
      message: 'External resource URL is missing or does not satisfy the safe URL policy.',
    });
  }
  if (!Number.isFinite(external?.estimatedTimeMinutes) || (external?.estimatedTimeMinutes ?? 0) <= 0) {
    issues.push({
      code: 'missing-external-estimated-time',
      severity: 'blocking',
      message: 'External resource lacks an estimated time.',
    });
  }
  if (!external?.applicableGoalId?.trim()) {
    issues.push({
      code: 'missing-external-applicable-goal',
      severity: 'blocking',
      message: 'External resource lacks an applicable learning goal.',
    });
  }
  if (!external?.evidenceUseStatus) {
    issues.push({
      code: 'missing-external-evidence-use-status',
      severity: 'blocking',
      message: 'External resource lacks an evidence-use status.',
    });
  } else if (external.evidenceUseStatus === 'reference-only') {
    issues.push({
      code: 'external-resource-reference-only',
      severity: 'blocking',
      message: 'Reference-only external resources cannot affect adaptive path recommendations.',
    });
  }
  if (!external?.privacyPolicy) {
    issues.push({
      code: 'missing-external-privacy-policy',
      severity: 'blocking',
      message: 'External resource lacks a privacy policy.',
    });
  }
  return issues;
}

function auditCheckpointNode(node: ResourceNode): ResourceNodeAuditIssue[] {
  if (node.type !== 'checkpoint') return [];
  const checkpoint = node.checkpoint;
  const issues: ResourceNodeAuditIssue[] = [];
  if (!checkpoint?.assessmentPurpose?.trim()) {
    issues.push({
      code: 'missing-checkpoint-assessment-purpose',
      severity: 'blocking',
      message: 'Checkpoint lacks an assessment purpose.',
    });
  }
  if (!checkpoint?.criteria.length) {
    issues.push({
      code: 'missing-checkpoint-criteria',
      severity: 'blocking',
      message: 'Checkpoint lacks passing criteria.',
    });
  }
  if (!checkpoint?.requiredEvidenceRefs.length) {
    issues.push({
      code: 'missing-checkpoint-required-evidence',
      severity: 'blocking',
      message: 'Checkpoint lacks required evidence references.',
    });
  }
  if (!checkpoint?.remediationBehavior?.trim()) {
    issues.push({
      code: 'missing-checkpoint-remediation',
      severity: 'blocking',
      message: 'Checkpoint lacks remediation behavior.',
    });
  }
  return issues;
}

function buildTeachingResourceNodes(resources: TeachingResourceNodeInput[]): ResourceNode[] {
  return resources.map((resource) => {
    const planningOverride = parsePlanningOverride(resource.config);
    const registryLaunch = resource.registryId ? `/interactive-learning/resources/${resource.id}` : null;
    const contentRender = resource.content ? `/interactive-learning/resources/${resource.id}` : null;
    const nodeType = resource.type === 'STATIC_MEDIA'
      ? inferMediaNodeType(resource.content ?? resource.title)
      : resource.type === 'SIMULATION_APP'
        ? 'simulation'
        : resource.type === 'INTERACTIVE_COMP'
          ? inferRegisteredNodeType(resource.registryId ?? resource.title)
          : 'lesson_step';
    return createNode({
      id: `teaching-resource:${resource.id}`,
      title: resource.displayName ?? resource.title,
      description: resource.description ?? null,
      type: nodeType,
      courseModule: resource.category ?? null,
      sourceKind: 'teaching_resource',
      sourceRef: resource.id,
      sourceRefs: [
        { kind: 'teaching_resource', ref: resource.id },
        ...(resource.registryId ? [{ kind: 'resource_registry' as const, ref: resource.registryId }] : []),
      ],
      renderTarget: contentRender,
      launchTarget: registryLaunch,
      knowledgeCoverage: resource.knowledgeNodeIds ?? [],
      sourceOfRecord: {
        content: 'TeachingResource',
        catalogMetadata: 'TeachingResource',
        planningMetadata: 'ResourceNode',
      },
      teacherOnly: Boolean(resource.teacherOnly),
      prerequisites: resource.prerequisiteNodeIds ?? [],
      evidenceInstrumentation: ['TeachingResource.interactionLogs'],
      planningOverride,
    });
  });
}

function buildRegisteredResourceNodes(resources: RegisteredResourceNodeInput[]): ResourceNode[] {
  const arenaTargets = new Map(resources.flatMap((resource) => {
    const target = resolveRegisteredArenaTaskTarget(resource);
    return target ? [[resource.id, target] as const] : [];
  }));
  const nodeIdAliases = new Map(Array.from(arenaTargets, ([resourceId, target]) => [
    `registry:${resourceId}`,
    target.nodeId,
  ]));

  return resources.map((resource) => {
    const arenaTarget = arenaTargets.get(resource.id);
    const planningOverride = remapRegisteredPlanningOverride(resource.planningOverride, nodeIdAliases);
    const type = arenaTarget
      ? 'arena_task'
      : resource.type === 'SIMULATION_APP'
        ? 'simulation'
        : resource.type === 'ADAPTIVE_QUIZ'
          ? 'adaptive_quiz'
          : inferRegisteredNodeType(resource.id);
    return createNode({
      id: arenaTarget?.nodeId ?? `registry:${resource.id}`,
      title: resource.label,
      type,
      sourceKind: arenaTarget ? 'arena_task' : 'resource_registry',
      sourceRef: arenaTarget?.sourceRef ?? resource.id,
      sourceRefs: arenaTarget
        ? [
            { kind: 'arena_task', ref: arenaTarget.sourceRef },
            { kind: 'resource_registry', ref: resource.id },
          ]
        : undefined,
      renderTarget: resource.renderTarget ?? null,
      launchTarget: arenaTarget?.target ?? resource.launchTarget ?? null,
      knowledgeCoverage: resource.knowledgeNodeIds ?? [],
      sourceOfRecord: {
        content: 'resource_registry',
        catalogMetadata: 'resource_registry',
        planningMetadata: 'ResourceNode',
      },
      prerequisites: remapRegisteredNodeIds(resource.prerequisiteNodeIds, nodeIdAliases),
      evidenceInstrumentation: ['InteractionLog'],
      planningOverride,
      runtimeProjection: arenaTarget
        ? buildRegisteredArenaRuntimeProjection(resource, arenaTarget, planningOverride)
        : null,
    });
  });
}

function buildRegisteredArenaRuntimeProjection(
  resource: RegisteredResourceNodeInput,
  arenaTarget: CanonicalArenaPathTarget,
  planningOverride: ResourceNodePlanningOverride | undefined,
): RuntimeResourceProjectionMetadata {
  const config = resource.defaultConfig ?? {};
  const sourcePathOrUrl = normalizeOptionalString(config.sourcePathOrUrl);
  const sourceHash = normalizeOptionalString(config.sourceHash);
  const sourceVersionRef = normalizeOptionalString(config.sourceVersionRef);
  const disposition = planningOverride?.pathDisposition;
  const evidenceInstrumentation = planningOverride?.evidenceInstrumentation ?? [];
  const evidenceContract: RuntimeResourceProjectionEvidenceContract = {
    eventSource: true,
    eventType: evidenceInstrumentation.length > 0,
    clientEventIdPolicy: true,
    attemptKey: true,
    sourceLogId: true,
    dedupeKey: true,
    timestamps: true,
    learningFactPolicy: true,
    learningFactMaterializationPolicy: 'materialized-learning-fact',
    confidencePolicy: true,
    privacyScope: true,
    complete: true,
    missingFields: [],
  };
  return {
    id: `runtime-projection:${arenaTarget.nodeId}`,
    projectionLevel: 'ResourceNode',
    sourceKind: 'arena_task',
    sourcePathOrUrl,
    sourceRecord: arenaTarget.sourceRef,
    sourceHash,
    sourceVersionRef,
    graphNodeRefs: {
      knowledge: [...(resource.knowledgeNodeIds ?? [])],
      capability: Object.keys(planningOverride?.abilityImpact ?? {}),
      quality: [],
    },
    evidenceContract,
    reviewAudit: {
      status: disposition?.reviewStatus ?? 'not-reviewed',
      reviewerId: disposition?.reviewerId ?? null,
      reviewerRole: 'resource-governance-reviewer',
      reviewedAt: disposition?.reviewedAt ?? null,
      reviewBatchId: disposition?.reviewBatchId ?? null,
      reviewedSourceHash: sourceHash,
      reviewedVersionRef: disposition?.sourceVersionRef ?? null,
      generationToolOrModel: null,
      promptOrManifestHash: null,
      reviewerVisibleRationale: disposition?.rationale ?? null,
      independentEvidenceRef: sourcePathOrUrl ? `${sourcePathOrUrl}#${arenaTarget.sourceRef}` : null,
      confidence: 1,
      staleInvalidationRule: 'invalidate when canonical arena integrity source hash changes',
    },
    groundingEligibility: {
      retrievalReady: false,
      citationReady: Boolean(arenaTarget.target),
      authoringTriageReady: false,
    },
    runtimeSemanticEvidence: null,
  };
}

function resolveRegisteredArenaTaskTarget(
  resource: RegisteredResourceNodeInput,
): CanonicalArenaPathTarget | null {
  const config = resource.defaultConfig && typeof resource.defaultConfig === 'object' && !Array.isArray(resource.defaultConfig)
    ? resource.defaultConfig
    : {};
  if (resource.type !== 'SIMULATION_APP' || config.resourceKind !== 'arena-workbench') return null;
  const taskId = normalizeOptionalString(config.arenaTaskId);
  if (!taskId) return null;
  const integrity = resolveArenaPathTargetIntegrity({
    nodeId: `arena-task:${taskId}`,
    type: 'arena_task',
    sourceKind: 'arena_task',
    sourceRef: taskId,
    target: resource.launchTarget,
  });
  return integrity.status === 'valid' ? integrity.target : null;
}

function remapRegisteredPlanningOverride(
  planningOverride: ResourceNodePlanningOverride | undefined,
  aliases: ReadonlyMap<string, string>,
): ResourceNodePlanningOverride | undefined {
  if (!planningOverride) return undefined;
  const readiness = planningOverride.readiness;
  const pathDisposition = planningOverride.pathDisposition;
  return {
    ...planningOverride,
    ...(planningOverride.prerequisites ? {
      prerequisites: remapRegisteredNodeIds(planningOverride.prerequisites, aliases),
    } : {}),
    readiness: readiness ? {
      ...readiness,
      requiredCompletedNodeIds: remapRegisteredNodeIds(readiness.requiredCompletedNodeIds, aliases),
      fallbackNodeIds: remapRegisteredNodeIds(readiness.fallbackNodeIds, aliases),
    } : readiness,
    pathDisposition: pathDisposition ? {
      ...pathDisposition,
      parentResourceNodeId: pathDisposition.parentResourceNodeId
        ? aliases.get(pathDisposition.parentResourceNodeId) ?? pathDisposition.parentResourceNodeId
        : null,
    } : pathDisposition,
  };
}

function remapRegisteredNodeIds(
  nodeIds: string[] | undefined,
  aliases: ReadonlyMap<string, string>,
): string[] {
  return (nodeIds ?? []).map((nodeId) => aliases.get(nodeId) ?? nodeId);
}

function buildKnowledgeResourceNodes(nodes: KnowledgeNodeResourceInput[]): ResourceNode[] {
  return nodes.flatMap((node) => [
    createNode({
      id: `knowledge-node:${node.id}`,
      title: node.name,
      courseModule: node.tags?.[0] ?? null,
      type: 'knowledge_node',
      sourceKind: 'knowledge_graph',
      sourceRef: node.id,
      renderTarget: null,
      knowledgeCoverage: [node.id],
      sourceOfRecord: {
        content: 'knowledge_graph',
        catalogMetadata: 'knowledge_graph',
        planningMetadata: 'ResourceNode',
      },
      evidenceInstrumentation: ['knowledge_graph_node_focus'],
    }),
    createNode({
      id: `knowledge-card:${node.id}`,
      title: `${node.name}知识卡`,
      courseModule: node.tags?.[0] ?? null,
      type: 'knowledge_card',
      sourceKind: 'knowledge_graph',
      sourceRef: `${node.id}:card`,
      renderTarget: null,
      knowledgeCoverage: [node.id],
      sourceOfRecord: {
        content: 'knowledge_graph',
        catalogMetadata: 'knowledge_graph',
        planningMetadata: 'ResourceNode',
      },
      evidenceInstrumentation: ['knowledge_card_open'],
    }),
  ]);
}

function buildKnowledgeCardNodes(cards: KnowledgeCardResourceNodeInput[]): ResourceNode[] {
  return cards.map((card) => createNode({
    id: `knowledge-card:${card.id}`,
    title: card.title,
    type: 'knowledge_card',
    sourceKind: 'knowledge_graph',
    sourceRef: card.sourceRef,
    renderTarget: card.renderTarget ?? null,
    launchTarget: card.launchTarget ?? null,
    knowledgeCoverage: card.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'knowledge_graph',
      catalogMetadata: 'ResourceNode',
      planningMetadata: 'ResourceNode',
    },
    teacherOnly: Boolean(card.teacherOnly),
    prerequisites: card.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: ['knowledge_card_open'],
    planningOverride: card.planningOverride,
  }));
}

function buildRuntimeLessonNodes(lessons: RuntimeLessonNodeInput[]): ResourceNode[] {
  return lessons.flatMap((lesson) => {
    const nodes: ResourceNode[] = [];
    for (const step of lesson.steps ?? []) {
      nodes.push(createNode({
        id: `lesson-step:${lesson.lessonId}:${step.id}`,
        title: step.title,
        courseModule: lesson.lessonId,
        type: 'lesson_step',
        sourceKind: 'runtime_lesson_step',
        sourceRef: `${lesson.lessonId}:${step.id}`,
        renderTarget: step.renderTarget ?? null,
        knowledgeCoverage: step.knowledgeNodeIds ?? [],
        sourceOfRecord: {
          content: 'runtime_lesson_media',
          catalogMetadata: 'ResourceNode',
        planningMetadata: 'ResourceNode',
      },
      prerequisites: step.prerequisiteNodeIds ?? [],
      evidenceInstrumentation: ['lesson_submit', 'lesson_step_view'],
    }));
    }
    if (lesson.handoutPath || lesson.handoutPdfPath) {
      nodes.push(createNode({
        id: `runtime-handout:${lesson.lessonId}`,
        title: `${lesson.title}讲义`,
        courseModule: lesson.lessonId,
        type: 'handout',
        sourceKind: 'runtime_handout',
        sourceRef: lesson.lessonId,
        renderTarget: lesson.handoutPdfPath ?? lesson.handoutPath,
        knowledgeCoverage: collectLessonKnowledgeCoverage(lesson),
        sourceOfRecord: {
          content: 'runtime_lesson_media',
          catalogMetadata: 'runtime_lesson_media',
          planningMetadata: 'ResourceNode',
        },
        evidenceInstrumentation: ['runtime_handout_open'],
        runtimeProjection: lesson.handoutSourcePath && lesson.handoutSourceHash && lesson.handoutSourceVersionRef
          ? {
              id: `runtime-handout:${lesson.lessonId}`,
              projectionLevel: 'ResourceNode',
              sourceKind: 'runtime_handout',
              sourcePathOrUrl: lesson.handoutSourcePath,
              sourceRecord: lesson.lessonId,
              sourceHash: lesson.handoutSourceHash ?? null,
              sourceVersionRef: lesson.handoutSourceVersionRef ?? null,
              graphNodeRefs: {
                knowledge: collectLessonKnowledgeCoverage(lesson),
                capability: [],
                quality: [],
              },
              evidenceContract: null,
              reviewAudit: null,
            }
          : null,
      }));
    }
    for (const media of lesson.mediaResources ?? []) {
      const sourceRefs: ResourceNodeSourceReference[] = [
        { kind: 'runtime_lesson_media', ref: `${lesson.lessonId}:${media.id}` },
      ];
      if (media.teachingResourceId) {
        sourceRefs.push({ kind: 'teaching_resource', ref: media.teachingResourceId });
      }
      nodes.push(createNode({
        id: `runtime-media:${lesson.lessonId}:${media.id}`,
        title: media.title,
        courseModule: lesson.lessonId,
        type: media.kind === 'video' || media.kind === 'audio' || media.kind === 'slides'
          ? media.kind
          : 'handout',
        sourceKind: 'runtime_lesson_media',
        sourceRef: `${lesson.lessonId}:${media.id}`,
        sourceRefs,
        renderTarget: media.url,
        knowledgeCoverage: collectLessonKnowledgeCoverage(lesson),
        sourceOfRecord: {
          content: 'runtime_lesson_media',
          catalogMetadata: media.teachingResourceId ? 'TeachingResource' : 'runtime_lesson_media',
          planningMetadata: 'ResourceNode',
        },
        evidenceInstrumentation: [`runtime_media_${media.kind}`],
      }));
    }
    return nodes;
  });
}

function buildRuntimeProjectionResourceNodes(projections: RuntimeResourceProjectionInput[]): ResourceNode[] {
  return projections
    .filter(isRuntimeResourceProjectionResourceNodeCandidate)
    .map((projection) => {
      const ownership = RESOURCE_SEMANTIC_SOURCE_OWNERSHIP[projection.sourceKind];
      const routeTarget = projection.routeTarget ?? null;
      const citationUnavailable = projection.groundingEligibility?.citationReady === false
        || projection.runtimeSemanticEvidence?.assetStatus === 'missing-local-runtime-asset';
      const capabilityTargets = uniqueSorted(projection.graphNodeRefs?.capability ?? []);
      const resourceType = runtimeProjectionResourceNodeType(projection.resourceType);
      const renderTarget = citationUnavailable
        ? null
        : projection.projectionLevel === 'ResourceNode' || projection.projectionLevel === 'PlanningUnit'
          ? routeTarget
          : projection.renderTarget ?? routeTarget;

      return createNode({
        id: projection.resourceNodeId ?? projection.id,
        title: projection.title,
        type: resourceType,
        sourceKind: projection.sourceKind,
        sourceRef: projection.sourceRecord ?? projection.sourceRef,
        sourceRefs: [{ kind: projection.sourceKind, ref: projection.sourceRef }],
        renderTarget,
        launchTarget: citationUnavailable ? null : routeTarget,
        knowledgeCoverage: projection.graphNodeRefs?.knowledge ?? [],
        sourceOfRecord: {
          content: ownership.contentOwner as ResourceNodeSourceOwner,
          catalogMetadata: ownership.catalogMetadataOwner as ResourceNodeSourceOwner,
          planningMetadata: 'ResourceNode',
        },
        evidenceInstrumentation: projection.evidenceInstrumentation ?? [],
        planningOverride: {
          availability: citationUnavailable ? 'draft' : undefined,
          estimatedTimeMinutes: projection.estimatedTimeMinutes ?? undefined,
          abilityImpact: Object.fromEntries(capabilityTargets.map((target) => [target, 0.25])),
          privacyLevel: projection.privacyScope ?? undefined,
          teacherPolicy: projection.teacherPolicy ?? undefined,
          readiness: projection.readiness ?? undefined,
        },
        runtimeProjection: normalizeRuntimeProjectionMetadata(projection),
      });
    });
}

function isRuntimeResourceProjectionResourceNodeCandidate(
  projection: RuntimeResourceProjectionInput,
): boolean {
  return projection.lifecycleScope !== 'audit-only' &&
    (isResourceNodeType(projection.resourceType) || projection.resourceType === 'image');
}

function runtimeProjectionResourceNodeType(
  resourceType: RuntimeResourceProjectionResourceType,
): ResourceNodeType {
  if (isResourceNodeType(resourceType)) return resourceType;
  return 'handout';
}

function buildTextbookNodes(textbooks: TextbookResourceNodeInput[]): ResourceNode[] {
  return textbooks.map((textbook) => createNode({
    id: `textbook:${textbook.bookId}`,
    title: textbook.title,
    type: 'textbook',
    courseModule: textbook.bookId,
    sourceKind: 'textbook',
    sourceRef: textbook.bookId,
    renderTarget: textbook.sourceHref ?? null,
    knowledgeCoverage: textbook.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'textbook',
      catalogMetadata: 'textbook',
      planningMetadata: 'ResourceNode',
    },
    evidenceInstrumentation: [],
    runtimeProjection: textbook.sourceHash && textbook.sourceVersionRef
      ? {
          id: `textbook:${textbook.bookId}`,
          projectionLevel: 'ResourceSegment',
          sourceKind: 'textbook',
          sourcePathOrUrl: textbook.sourceHref ?? null,
          sourceRecord: textbook.bookId,
          sourceHash: textbook.sourceHash,
          sourceVersionRef: textbook.sourceVersionRef,
          graphNodeRefs: { knowledge: textbook.knowledgeNodeIds ?? [], capability: [], quality: [] },
          evidenceContract: null,
          reviewAudit: null,
        }
      : null,
    planningOverride: {
      ...textbook.planningOverride,
      teacherPolicy: 'blocked',
      terminalConstraints: uniqueSorted([
        'container-resource',
        ...(textbook.planningOverride?.terminalConstraints ?? []),
      ]),
    },
  }));
}

function buildTextbookSectionNodes(sections: TextbookSectionResourceNodeInput[]): ResourceNode[] {
  return sections.map((section) => createNode({
    id: `textbook-section:${section.bookId}:${section.sectionId}`,
    title: section.title,
    type: 'textbook_section',
    courseModule: section.bookId,
    sourceKind: 'textbook_section',
    sourceRef: `${section.bookId}:${section.sectionId}`,
    sourceRefs: [
      { kind: 'textbook', ref: section.bookId },
      { kind: 'textbook_section', ref: `${section.bookId}:${section.sectionId}` },
    ],
    renderTarget: section.citationHref,
    knowledgeCoverage: section.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'textbook',
      catalogMetadata: 'textbook',
      planningMetadata: 'ResourceNode',
    },
    prerequisites: section.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: ['textbook_section_open'],
    runtimeProjection: section.sourceHash && section.sourceVersionRef
      ? {
          id: `textbook-section:${section.bookId}:${section.sectionId}`,
          projectionLevel: 'ResourceSegment',
          sourceKind: 'textbook_section',
          sourcePathOrUrl: section.citationHref,
          sourceRecord: `${section.bookId}:${section.sectionId}`,
          sourceHash: section.sourceHash,
          sourceVersionRef: section.sourceVersionRef,
          graphNodeRefs: {
            knowledge: section.knowledgeNodeIds ?? [],
            capability: section.capabilityTargetIds ?? [],
            quality: [],
          },
          evidenceContract: null,
          reviewAudit: null,
        }
      : null,
    planningOverride: {
      ...section.planningOverride,
      estimatedTimeMinutes: section.estimatedTimeMinutes ?? section.planningOverride?.estimatedTimeMinutes,
      abilityImpact: section.planningOverride?.abilityImpact ?? abilityImpactFromTargets(section.capabilityTargetIds ?? []),
    },
  }));
}

function buildSimulationNodes(simulations: SimulationResourceNodeInput[]): ResourceNode[] {
  return simulations.map((simulation) => createNode({
    id: `simulation:${simulation.id}`,
    title: simulation.title,
    courseModule: null,
    type: 'simulation',
    sourceKind: 'simulation_resource',
    sourceRef: simulation.id,
    launchTarget: simulation.launchTarget,
    knowledgeCoverage: simulation.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'simulation',
      catalogMetadata: 'simulation',
      planningMetadata: 'ResourceNode',
    },
    prerequisites: simulation.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: ['simulation_run'],
    planningOverride: simulation.planningOverride,
  }));
}

function buildArenaTaskNodes(tasks: ArenaTaskResourceNodeInput[]): ResourceNode[] {
  return tasks.map((task) => createNode({
    id: `arena-task:${task.id}`,
    title: task.title,
    courseModule: null,
    type: 'arena_task',
    sourceKind: 'arena_task',
    sourceRef: task.id,
    launchTarget: task.launchTarget,
    knowledgeCoverage: task.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'arena',
      catalogMetadata: 'arena',
      planningMetadata: 'ResourceNode',
    },
    prerequisites: task.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: [task.official ? 'arena_evaluation_complete' : 'arena_simulation_run'],
    planningOverride: task.planningOverride,
  }));
}

function buildExternalResourceNodes(resources: ExternalResourceNodeInput[]): ResourceNode[] {
  return resources.map((resource) => {
    const safeUrl = safeExternalUrl(resource.url);
    const privacyPolicy = isResourceNodePrivacyLevel(resource.privacyPolicy) ? resource.privacyPolicy : null;
    const effectiveKnowledgeCoverage = uniqueSorted(
      resource.planningOverride?.knowledgeCoverage ?? resource.knowledgeNodeIds ?? [],
    );
    return createNode({
      id: `external-resource:${resource.id}`,
      title: resource.title,
      courseModule: null,
      type: 'external_resource',
      sourceKind: 'external_resource',
      sourceRef: resource.id,
      launchTarget: safeUrl,
      knowledgeCoverage: resource.knowledgeNodeIds ?? [],
      sourceOfRecord: {
        content: 'external_resource',
        catalogMetadata: 'external_resource',
        planningMetadata: 'ResourceNode',
      },
      prerequisites: resource.prerequisiteNodeIds ?? [],
      evidenceInstrumentation: resource.evidenceUseStatus === 'explicit-access-required'
        ? ['external_resource_access']
        : [],
      planningOverride: {
        ...resource.planningOverride,
        estimatedTimeMinutes: resource.estimatedTimeMinutes ?? resource.planningOverride?.estimatedTimeMinutes,
        privacyLevel: privacyPolicy ?? resource.planningOverride?.privacyLevel,
      },
      externalResource: {
        source: normalizeOptionalString(resource.source),
        url: safeUrl,
        estimatedTimeMinutes: typeof resource.estimatedTimeMinutes === 'number' &&
          Number.isFinite(resource.estimatedTimeMinutes) &&
          resource.estimatedTimeMinutes > 0
          ? resource.estimatedTimeMinutes
          : null,
        knowledgeCoverage: effectiveKnowledgeCoverage,
        applicableGoalId: normalizeOptionalString(resource.applicableGoalId),
        evidenceUseStatus: resource.evidenceUseStatus === 'explicit-access-required' || resource.evidenceUseStatus === 'reference-only'
          ? resource.evidenceUseStatus
          : null,
        privacyPolicy,
      },
    });
  });
}

function buildCheckpointNodes(checkpoints: CheckpointResourceNodeInput[]): ResourceNode[] {
  return checkpoints.map((checkpoint) => createNode({
    id: `checkpoint:${checkpoint.id}`,
    title: checkpoint.title,
    courseModule: null,
    type: 'checkpoint',
    sourceKind: 'checkpoint',
    sourceRef: checkpoint.id,
    renderTarget: checkpoint.renderTarget ?? null,
    launchTarget: checkpoint.launchTarget ?? null,
    knowledgeCoverage: checkpoint.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'checkpoint',
      catalogMetadata: 'checkpoint',
      planningMetadata: 'ResourceNode',
    },
    prerequisites: checkpoint.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: checkpoint.requiredEvidenceRefs?.length
      ? checkpoint.requiredEvidenceRefs
      : ['checkpoint_review'],
    planningOverride: {
      ...checkpoint.planningOverride,
      terminalConstraints: uniqueSorted(['checkpoint', ...(checkpoint.planningOverride?.terminalConstraints ?? [])]),
    },
    checkpoint: {
      assessmentPurpose: normalizeOptionalString(checkpoint.assessmentPurpose),
      criteria: uniqueStableStrings(checkpoint.criteria ?? []),
      requiredEvidenceRefs: uniqueStableStrings(checkpoint.requiredEvidenceRefs ?? []),
      remediationBehavior: normalizeOptionalString(checkpoint.remediationBehavior),
      reviewState: checkpoint.reviewState ?? 'pending',
    },
  }));
}

function buildExerciseNodes(entries: LightweightResourceNodeInput[]): ResourceNode[] {
  return entries.map((entry) => createNode({
    id: `exercise:${entry.id}`,
    title: entry.title,
    type: 'exercise',
    sourceKind: 'exercise',
    sourceRef: entry.sourceRef ?? entry.id,
    renderTarget: entry.renderTarget ?? null,
    launchTarget: entry.launchTarget ?? null,
    knowledgeCoverage: entry.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'ResourceNode',
      catalogMetadata: 'ResourceNode',
      planningMetadata: 'ResourceNode',
    },
    teacherOnly: Boolean(entry.teacherOnly),
    prerequisites: entry.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: ['exercise_complete'],
    planningOverride: entry.planningOverride,
  }));
}

function buildLightweightNodes(
  entries: LightweightResourceNodeInput[],
  type: Extract<ResourceNodeType, 'control_workbench' | 'reflection' | 'ai_intervention' | 'konling' | 'project'>,
  sourceKind: Extract<ResourceNodeSourceKind, 'control_workbench' | 'reflection_prompt' | 'ai_intervention' | 'konling' | 'project'>,
): ResourceNode[] {
  return entries.map((entry) => createNode({
    id: `${sourceKind}:${entry.id}`,
    title: entry.title,
    courseModule: null,
    type,
    sourceKind,
    sourceRef: entry.sourceRef ?? entry.id,
    renderTarget: entry.renderTarget ?? null,
    launchTarget: entry.launchTarget ?? null,
    knowledgeCoverage: entry.knowledgeNodeIds ?? [],
    sourceOfRecord: {
      content: 'ResourceNode',
      catalogMetadata: 'ResourceNode',
      planningMetadata: 'ResourceNode',
    },
    teacherOnly: Boolean(entry.teacherOnly),
    prerequisites: entry.prerequisiteNodeIds ?? [],
    evidenceInstrumentation: [`${sourceKind}_complete`],
    planningOverride: entry.planningOverride,
  }));
}

function createNode(input: {
  id: string;
  title: string;
  description?: string | null;
  type: ResourceNodeType;
  courseModule?: string | null;
  sourceKind: ResourceNodeSourceKind;
  sourceRef: string;
  sourceRefs?: ResourceNodeSourceReference[];
  renderTarget?: string | null;
  launchTarget?: string | null;
  pathSemantics?: ResourceNodePathSemantics;
  externalResource?: ResourceNodeExternalResourceMetadata | null;
  checkpoint?: ResourceNodeCheckpointMetadata | null;
  knowledgeCoverage: string[];
  sourceOfRecord: ResourceNodeSourceOfRecord;
  teacherOnly?: boolean;
  prerequisites?: string[];
  evidenceInstrumentation: string[];
  planningOverride?: ResourceNodePlanningOverride;
  runtimeProjection?: RuntimeResourceProjectionMetadata | null;
}): ResourceNode {
  const privacyLevel: ResourceNodePrivacyLevel = input.teacherOnly ? 'teacher-scoped' : 'student-visible';
  const planningOverride = input.planningOverride ?? {};
  return {
    id: input.id,
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    courseModule: input.courseModule ?? null,
    sourceKind: input.sourceKind,
    sourceRef: input.sourceRef,
    sourceRefs: uniqueSourceRefs(input.sourceRefs ?? [{ kind: input.sourceKind, ref: input.sourceRef }]),
    renderTarget: input.renderTarget ?? null,
    launchTarget: input.launchTarget ?? null,
    pathSemantics: input.pathSemantics ?? pathSemanticsForResourceType(input.type),
    externalResource: input.externalResource ?? null,
    checkpoint: input.checkpoint ?? null,
    planningMetadata: {
      prerequisites: uniqueSorted(planningOverride.prerequisites ?? input.prerequisites ?? []),
      estimatedTimeMinutes: planningOverride.estimatedTimeMinutes ?? defaultEstimatedTime(input.type),
      cognitiveLoad: planningOverride.cognitiveLoad ?? defaultCognitiveLoad(input.type),
      knowledgeCoverage: uniqueSorted(planningOverride.knowledgeCoverage ?? input.knowledgeCoverage),
      abilityImpact: planningOverride.abilityImpact ?? defaultAbilityImpact(input.type),
      cost: planningOverride.cost ?? {
        effort: input.type === 'project' || input.type === 'arena_task' ? 'high' : 'medium',
        requiresTeacherReview: input.teacherOnly === true || input.type === 'project',
      },
      availability: planningOverride.availability ?? (input.teacherOnly ? 'teacher_only' : 'available'),
      teacherPolicy: planningOverride.teacherPolicy ?? (input.teacherOnly ? 'teacher-only' : 'allowed'),
      privacyLevel: planningOverride.privacyLevel ?? privacyLevel,
      terminalConstraints: uniqueSorted(planningOverride.terminalConstraints ?? (input.type === 'project' ? ['terminal-node'] : [])),
      evidenceInstrumentation: uniqueSorted(planningOverride.evidenceInstrumentation ?? input.evidenceInstrumentation),
      readiness: normalizeReadinessMetadata(planningOverride.readiness),
      pathDisposition: normalizePathPlanningDisposition(
        planningOverride.pathDisposition,
        input.sourceKind,
        input.sourceRef,
        input.id,
      ),
    },
    sourceOfRecord: input.sourceOfRecord,
    runtimeProjection: input.runtimeProjection ?? null,
    eligibility: {
      pathEligible: false,
      reasons: [],
      auditIssues: [],
    },
  };
}

function normalizeRuntimeProjectionMetadata(
  projection: RuntimeResourceProjectionInput,
): RuntimeResourceProjectionMetadata {
  return {
    id: projection.id,
    projectionLevel: projection.projectionLevel,
    sourceKind: projection.sourceKind,
    sourcePathOrUrl: projection.sourcePathOrUrl,
    sourceRecord: projection.sourceRecord,
    sourceHash: projection.sourceHash,
    sourceVersionRef: projection.sourceVersionRef,
    graphNodeRefs: {
      knowledge: uniqueSorted(projection.graphNodeRefs?.knowledge ?? []),
      capability: uniqueSorted(projection.graphNodeRefs?.capability ?? []),
      quality: uniqueSorted(projection.graphNodeRefs?.quality ?? []),
    },
    evidenceContract: projection.evidenceContract
      ? normalizeRuntimeProjectionEvidenceContract(projection.evidenceContract)
      : null,
    reviewAudit: projection.reviewAudit ?? null,
    groundingEligibility: projection.groundingEligibility ?? null,
    runtimeSemanticEvidence: projection.runtimeSemanticEvidence ?? null,
  };
}

function normalizeRuntimeProjectionEvidenceContract(
  contract: RuntimeResourceProjectionEvidenceContract,
): RuntimeResourceProjectionEvidenceContract {
  const missingFields = [
    ['eventSource', contract.eventSource],
    ['eventType', contract.eventType],
    ['clientEventIdPolicy', contract.clientEventIdPolicy],
    ['attemptKey', contract.attemptKey],
    ['sourceLogId', contract.sourceLogId],
    ['dedupeKey', contract.dedupeKey],
    ['timestamps', contract.timestamps],
    ['learningFactPolicy', isRuntimeProjectionLearningFactPolicySatisfied(contract)],
    ['learningFactMaterializationPolicy', isRuntimeProjectionLearningFactMaterializationPolicySatisfied(contract)],
    ['confidencePolicy', contract.confidencePolicy],
    ['privacyScope', contract.privacyScope],
  ]
    .filter(([, value]) => !value)
    .map(([field]) => field as string);
  return {
    ...contract,
    complete: missingFields.length === 0,
    missingFields,
  };
}

function parsePlanningOverride(config?: Record<string, unknown> | null): ResourceNodePlanningOverride | undefined {
  const value = config?.resourceNodePlanning;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const override: ResourceNodePlanningOverride = {};
  if (Array.isArray(raw.prerequisites)) {
    override.prerequisites = raw.prerequisites.filter((item): item is string => typeof item === 'string');
  }
  if (Array.isArray(raw.knowledgeCoverage)) {
    override.knowledgeCoverage = raw.knowledgeCoverage.filter((item): item is string => typeof item === 'string');
  }
  if (Array.isArray(raw.terminalConstraints)) {
    override.terminalConstraints = raw.terminalConstraints.filter((item): item is string => typeof item === 'string');
  }
  if (Array.isArray(raw.evidenceInstrumentation)) {
    override.evidenceInstrumentation = raw.evidenceInstrumentation.filter((item): item is string => typeof item === 'string');
  }
  if (raw.abilityImpact && typeof raw.abilityImpact === 'object' && !Array.isArray(raw.abilityImpact)) {
    override.abilityImpact = Object.fromEntries(
      Object.entries(raw.abilityImpact).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)),
    );
  }
  if (typeof raw.estimatedTimeMinutes === 'number' || raw.estimatedTimeMinutes === null) {
    override.estimatedTimeMinutes = raw.estimatedTimeMinutes;
  }
  if (raw.cognitiveLoad === 'low' || raw.cognitiveLoad === 'medium' || raw.cognitiveLoad === 'high') {
    override.cognitiveLoad = raw.cognitiveLoad;
  }
  if (
    raw.availability === 'available' ||
    raw.availability === 'draft' ||
    raw.availability === 'archived' ||
    raw.availability === 'teacher_only'
  ) {
    override.availability = raw.availability;
  }
  if (
    raw.teacherPolicy === 'allowed' ||
    raw.teacherPolicy === 'teacher-assigned' ||
    raw.teacherPolicy === 'teacher-only' ||
    raw.teacherPolicy === 'blocked'
  ) {
    override.teacherPolicy = raw.teacherPolicy;
  }
  if (
    raw.privacyLevel === 'student-visible' ||
    raw.privacyLevel === 'teacher-scoped' ||
    raw.privacyLevel === 'admin-scoped'
  ) {
    override.privacyLevel = raw.privacyLevel;
  }
  const readiness = normalizeReadinessMetadata(raw.readiness);
  if (readiness) {
    override.readiness = readiness;
  }
  const pathDisposition = normalizePathPlanningDisposition(raw.pathDisposition);
  if (pathDisposition) {
    override.pathDisposition = pathDisposition;
  }

  return Object.keys(override).length > 0 ? override : undefined;
}

function mergeOverlappingSources(nodes: ResourceNode[]): Map<string, ResourceNode> {
  const result = new Map<string, ResourceNode>();
  for (const node of nodes.sort((left, right) => left.id.localeCompare(right.id))) {
    const existing = result.get(node.id);
    if (!existing) {
      result.set(node.id, node);
      continue;
    }
    const identity = admissionIdentitySource(existing, node);
    result.set(node.id, {
      ...existing,
      title: node.runtimeProjection ? node.title : existing.title,
      sourceKind: identity.sourceKind,
      sourceRef: identity.sourceRef,
      sourceRefs: uniqueSourceRefs([...existing.sourceRefs, ...node.sourceRefs]),
      renderTarget: identity.renderTarget ?? existing.renderTarget ?? node.renderTarget,
      launchTarget: identity.launchTarget ?? existing.launchTarget ?? node.launchTarget,
      planningMetadata: {
        ...existing.planningMetadata,
        estimatedTimeMinutes: node.runtimeProjection
          ? node.planningMetadata.estimatedTimeMinutes
          : existing.planningMetadata.estimatedTimeMinutes,
        cognitiveLoad: node.runtimeProjection
          ? node.planningMetadata.cognitiveLoad
          : existing.planningMetadata.cognitiveLoad,
        knowledgeCoverage: uniqueSorted([
          ...existing.planningMetadata.knowledgeCoverage,
          ...node.planningMetadata.knowledgeCoverage,
        ]),
        abilityImpact: node.runtimeProjection
          ? node.planningMetadata.abilityImpact
          : {
              ...existing.planningMetadata.abilityImpact,
              ...node.planningMetadata.abilityImpact,
            },
        cost: node.runtimeProjection ? node.planningMetadata.cost : existing.planningMetadata.cost,
        availability: node.runtimeProjection
          ? node.planningMetadata.availability
          : existing.planningMetadata.availability,
        teacherPolicy: node.runtimeProjection
          ? node.planningMetadata.teacherPolicy
          : existing.planningMetadata.teacherPolicy,
        privacyLevel: node.runtimeProjection
          ? node.planningMetadata.privacyLevel
          : existing.planningMetadata.privacyLevel,
        terminalConstraints: uniqueSorted([
          ...existing.planningMetadata.terminalConstraints,
          ...node.planningMetadata.terminalConstraints,
        ]),
        evidenceInstrumentation: uniqueSorted([
          ...existing.planningMetadata.evidenceInstrumentation,
          ...node.planningMetadata.evidenceInstrumentation,
        ]),
        readiness: existing.planningMetadata.readiness ?? node.planningMetadata.readiness,
        pathDisposition: existing.planningMetadata.pathDisposition ?? node.planningMetadata.pathDisposition,
      },
      sourceOfRecord: {
        content: identity.sourceOfRecord.content,
        catalogMetadata: existing.sourceRefs.some((source) => source.kind === 'teaching_resource') ||
          node.sourceRefs.some((source) => source.kind === 'teaching_resource')
          ? 'TeachingResource'
          : identity.sourceOfRecord.catalogMetadata,
        planningMetadata: 'ResourceNode',
      },
      runtimeProjection: existing.runtimeProjection ?? node.runtimeProjection,
    });
  }
  return result;
}

function admissionIdentitySource(existing: ResourceNode, incoming: ResourceNode): ResourceNode {
  if (existing.runtimeProjection && !incoming.runtimeProjection) return existing;
  if (incoming.runtimeProjection && !existing.runtimeProjection) return incoming;
  return existing;
}

function buildResourceNodeEdges(nodesById: Map<string, ResourceNode>): ResourceNodeEdge[] {
  const edges: ResourceNodeEdge[] = [];
  for (const node of Array.from(nodesById.values())) {
    for (const prerequisite of node.planningMetadata.prerequisites) {
      if (!nodesById.has(prerequisite)) {
        continue;
      }
      edges.push({
        id: `${prerequisite}->${node.id}:prerequisite`,
        fromNodeId: prerequisite,
        toNodeId: node.id,
        kind: 'prerequisite',
        source: 'declared-prerequisite',
      });
    }
  }
  return edges.sort((left, right) => left.id.localeCompare(right.id));
}

function inferMediaNodeType(value: string): ResourceNodeType {
  const lower = value.toLowerCase();
  if (/\.(mp4|webm|mov)$/.test(lower)) return 'video';
  if (/\.(mp3|wav|m4a)$/.test(lower)) return 'audio';
  if (/(^|[-_])slides(?:[-_.]|$)/.test(lower)) return 'slides';
  if (/\.(pdf|md|markdown)$/.test(lower)) return 'handout';
  return 'lesson_step';
}

function isResourceNodeType(value: string): value is ResourceNodeType {
  return (RESOURCE_NODE_TYPES as readonly string[]).includes(value);
}

function inferRegisteredNodeType(value: string): ResourceNodeType {
  const lower = value.toLowerCase();
  if (lower.includes('arena')) return 'arena_task';
  if (lower.includes('slides') || lower.includes('slide-deck') || lower.includes('courseware')) return 'slides';
  if (lower.includes('knowledge-deck') || lower.includes('knowledge-card') || lower.includes('summary-card')) {
    return 'knowledge_card';
  }
  if (lower.includes('quiz') || lower.includes('precheck') || lower.includes('posttest') || lower.includes('assessment')) {
    return 'quiz';
  }
  if (lower.includes('workbench') || lower.includes('control-lab')) return 'control_workbench';
  if (lower.includes('reflection')) {
    return 'reflection';
  }
  return 'lesson_step';
}

function pathSemanticsForResourceType(type: ResourceNodeType): ResourceNodePathSemantics {
  if (type === 'knowledge_card' || type === 'knowledge_node') return PATH_NODE_SEMANTICS.knowledge_card;
  if (type === 'textbook_section') return PATH_NODE_SEMANTICS.textbook_section;
  if (type === 'slides') return PATH_NODE_SEMANTICS.slides;
  if (type === 'quiz' || type === 'adaptive_quiz' || type === 'exercise') return PATH_NODE_SEMANTICS.adaptive_quiz;
  if (type === 'control_workbench') return PATH_NODE_SEMANTICS.control_workbench;
  if (type === 'simulation') return PATH_NODE_SEMANTICS.simulation;
  if (type === 'arena_task') return PATH_NODE_SEMANTICS.arena_task;
  if (type === 'external_resource') return PATH_NODE_SEMANTICS.external_resource;
  if (type === 'reflection') return PATH_NODE_SEMANTICS.reflection;
  if (type === 'checkpoint') return PATH_NODE_SEMANTICS.checkpoint;
  if (type === 'ai_intervention' || type === 'konling') return PATH_NODE_SEMANTICS.konling;
  return PATH_NODE_SEMANTICS.interactive_lesson;
}

export function getPathNodeSemanticsForResourceType(type: ResourceNodeType): ResourceNodePathSemantics {
  return pathSemanticsForResourceType(type);
}

function segmentKindForNode(node: ResourceNode): ResourceSegmentKind {
  if (node.sourceKind === 'runtime_lesson_step') return 'step';
  if (node.type === 'video') return 'video';
  if (node.type === 'audio') return 'audio';
  if (node.type === 'slides') return 'slides';
  if (node.type === 'handout') return 'handout';
  if (node.type === 'textbook_section' || node.sourceKind === 'textbook_section') return 'textbook_section';
  if (node.type === 'quiz' || node.type === 'adaptive_quiz' || node.type === 'exercise') return 'exercise';
  if (node.type === 'simulation') return 'simulation';
  if (node.type === 'arena_task') return 'arena';
  if (node.sourceKind === 'runtime_lesson_media') return 'media';
  if (node.type === 'checkpoint') return 'checkpoint';
  return 'primary';
}

export function buildResourceNodeHighConfidencePlanningAudit(node: ResourceNode): {
  pathEligible: boolean;
  issues: ResourceNodeAuditIssue[];
  hasBlockingIssue: boolean;
} {
  return buildResourceNodeHighConfidencePlanningAuditInternal(node, {
    includeDispositionPromotion: true,
  });
}

function buildResourceNodeHighConfidencePlanningAuditInternal(
  node: ResourceNode,
  options: { includeDispositionPromotion: boolean },
): {
  pathEligible: boolean;
  issues: ResourceNodeAuditIssue[];
  hasBlockingIssue: boolean;
} {
  const hasCapabilityMapping = Object.keys(node.planningMetadata.abilityImpact).length > 0;
  const hasEvidenceInstrumentation = node.planningMetadata.evidenceInstrumentation.length > 0;
  const issues = node.eligibility.auditIssues.map((issue) => (
    !hasEvidenceInstrumentation && issue.code === 'missing-evidence-instrumentation'
      ? { ...issue, severity: 'blocking' as const }
      : issue
  ));
  for (const issue of auditRuntimeProjectionPlanning(node)) {
    if (!issues.some((existing) => existing.code === issue.code)) {
      issues.push(issue);
    }
  }

  if (!hasCapabilityMapping && !issues.some((issue) => issue.code === 'missing-capability-mapping')) {
    issues.push({
      code: 'missing-capability-mapping',
      message: 'ResourceNode has no capability target mapping for high-confidence path planning.',
      severity: 'blocking',
    });
  }
  if (!hasEvidenceInstrumentation && !issues.some((issue) => issue.code === 'missing-evidence-instrumentation')) {
    issues.push({
      code: 'missing-evidence-instrumentation',
      message: 'ResourceNode has no evidence instrumentation mapping.',
      severity: 'blocking',
    });
  }
  if (options.includeDispositionPromotion) {
    for (const issue of auditPathDispositionPlanningEligibility(node)) {
      if (!issues.some((existing) => existing.code === issue.code)) {
        issues.push(issue);
      }
    }
  }

  return {
    pathEligible: node.eligibility.pathEligible &&
      hasCapabilityMapping &&
      hasEvidenceInstrumentation &&
      !issues.some((issue) => issue.severity === 'blocking'),
    issues,
    hasBlockingIssue: issues.some((issue) => issue.severity === 'blocking'),
  };
}

function auditPathDispositionPlanningEligibility(node: ResourceNode): ResourceNodeAuditIssue[] {
  const disposition = node.planningMetadata.pathDisposition;
  if (!disposition) return [];
  if (disposition.kind !== 'path-plannable') {
    return [{
      code: 'invalid-path-disposition-promotion',
      message: `Resource disposition ${disposition.kind} cannot directly create a PlanningUnit.`,
      severity: 'blocking',
    }];
  }
  if (!isResourcePathPlanningDispositionHumanReviewed(disposition) || !node.planningMetadata.readiness) {
    return [{
      code: 'invalid-path-disposition-promotion',
      message: 'Path-plannable disposition requires human-confirmed review evidence and readiness metadata.',
      severity: 'blocking',
    }];
  }
  return [];
}

function auditRuntimeProjectionPlanning(node: ResourceNode): ResourceNodeAuditIssue[] {
  if (!requiresRuntimeProjectionAudit(node)) return [];
  const projection = node.runtimeProjection;
  if (!projection) {
    return [{
      code: 'missing-runtime-projection-sidecar',
      message: 'Runtime resource has no projection sidecar for path planning.',
      severity: 'blocking',
    }];
  }

  const issues: ResourceNodeAuditIssue[] = [];
  if (projection.projectionLevel !== 'ResourceNode' && projection.projectionLevel !== 'PlanningUnit') {
    issues.push({
      code: 'runtime-projection-not-path-resource',
      message: `Runtime projection level ${projection.projectionLevel} cannot create a PlanningUnit.`,
      severity: 'blocking',
    });
  }
  if (!node.launchTarget) {
    issues.push({
      code: 'missing-runtime-projection-route-target',
      message: 'Runtime path projection lacks a verified route target.',
      severity: 'blocking',
    });
  }
  if (projection.graphNodeRefs.capability.length === 0) {
    issues.push({
      code: 'missing-capability-mapping',
      message: 'Runtime projection lacks sidecar capability target mappings.',
      severity: 'blocking',
    });
  }
  if (!projection.sourceHash) {
    issues.push({
      code: 'missing-runtime-projection-source-hash',
      message: 'Runtime projection lacks a reviewed source hash.',
      severity: 'blocking',
    });
  }
  if (!projection.sourceVersionRef) {
    issues.push({
      code: 'missing-runtime-projection-source-version',
      message: 'Runtime projection lacks a reviewed source version ref.',
      severity: 'blocking',
    });
  }
  if (!isRuntimeProjectionEvidenceContractComplete(projection.evidenceContract)) {
    issues.push({
      code: 'missing-runtime-projection-evidence-contract',
      message: 'Runtime projection lacks a complete evidence contract.',
      severity: 'blocking',
    });
  }
  if (!isRuntimeProjectionReviewHumanConfirmed(projection.reviewAudit)) {
    issues.push({
      code: projection.reviewAudit ? 'provisional-runtime-projection' : 'missing-runtime-projection-review-audit',
      message: 'Runtime projection has not received human-confirmed path authorization.',
      severity: 'blocking',
    });
  } else if (isRuntimeProjectionReviewStale(projection)) {
    issues.push({
      code: 'stale-runtime-projection',
      message: 'Runtime projection review is stale for the current source hash or version ref.',
      severity: 'blocking',
    });
  }
  return issues;
}

function isRuntimeProjectionReviewStale(projection: RuntimeResourceProjectionMetadata): boolean {
  return !runtimeProjectionReviewSourceMatches(projection) ||
    projection.reviewAudit?.reviewedVersionRef !== projection.sourceVersionRef;
}

function runtimeProjectionReviewSourceMatches(projection: {
  reviewAudit?: RuntimeResourceProjectionReviewAudit | null;
  sourceHash: string | null;
  sourceKind?: ResourceNodeSourceKind;
}): boolean {
  if (projection.sourceKind === 'knowledge_graph') {
    return projection.reviewAudit?.reviewedSourceHash === projection.sourceHash;
  }
  if (projection.reviewAudit?.promptOrManifestHash) {
    return projection.reviewAudit.reviewedSourceHash === projection.reviewAudit.promptOrManifestHash;
  }
  return projection.reviewAudit?.reviewedSourceHash === projection.sourceHash;
}

function requiresRuntimeProjectionAudit(node: ResourceNode): boolean {
  return Boolean(node.runtimeProjection);
}

function isRuntimeProjectionEvidenceContractComplete(
  contract: RuntimeResourceProjectionEvidenceContract | null,
): boolean {
  if (!contract) return false;
  if (contract.complete === false) return false;
  return contract.eventSource &&
    contract.eventType &&
    contract.clientEventIdPolicy &&
    contract.attemptKey &&
    contract.sourceLogId &&
    contract.dedupeKey &&
    contract.timestamps &&
    isRuntimeProjectionLearningFactPolicySatisfied(contract) &&
    isRuntimeProjectionLearningFactMaterializationPolicySatisfied(contract) &&
    contract.confidencePolicy &&
    contract.privacyScope;
}

function isRuntimeProjectionLearningFactPolicySatisfied(
  contract: RuntimeResourceProjectionEvidenceContract,
): boolean {
  return contract.learningFactPolicy ||
    contract.learningFactMaterializationPolicy === 'path-execution-evidence-only' ||
    contract.learningFactMaterializationPolicy === 'not-applicable';
}

function isRuntimeProjectionLearningFactMaterializationPolicySatisfied(
  contract: RuntimeResourceProjectionEvidenceContract,
): boolean {
  return contract.learningFactMaterializationPolicy === 'materialized-learning-fact' ||
    contract.learningFactMaterializationPolicy === 'path-execution-evidence-only' ||
    contract.learningFactMaterializationPolicy === 'not-applicable';
}

function isRuntimeProjectionReviewHumanConfirmed(
  review: RuntimeResourceProjectionReviewAudit | null,
): review is RuntimeResourceProjectionReviewAudit {
  return Boolean(
    review &&
    review.status === 'human-confirmed' &&
    review.reviewerId &&
    review.reviewerRole &&
    review.reviewedAt &&
    review.reviewBatchId &&
    review.reviewedSourceHash &&
    review.reviewedVersionRef &&
    review.staleInvalidationRule,
  );
}

function buildProjectionAuditIssueCodes(node: ResourceNode): string[] {
  return uniqueSorted(buildResourceNodeHighConfidencePlanningAudit(node).issues.map((issue) => issue.code));
}

function buildPlanningUnit(node: ResourceNode, resourceId: string, target: string | null): PlanningUnit | null {
  if (!isPlanningUnitEligible(node, target)) return null;
  const graphNodeRefs = buildResourceGraphNodeRefs(node);
  const sceneAvailability = buildResourceSceneAvailability(node, target);
  const citationReadiness = buildCitationReadiness(node, target);
  const evidenceCapability = buildEvidenceCapability(node);
  const governanceLimitations = buildGovernanceLimitations(
    node,
    target,
    buildProjectionAuditIssueCodes(node),
    sceneAvailability,
  );
  const pathProfile = buildResourcePathProfile(node);
  return {
    id: `planning-unit:${node.id}`,
    resourceId,
    resourceNodeId: node.id,
    title: node.title,
    target,
    pathEligible: true,
    pathSemantics: node.pathSemantics,
    prerequisites: node.planningMetadata.prerequisites,
    knowledgeCoverage: node.planningMetadata.knowledgeCoverage,
    abilityImpact: node.planningMetadata.abilityImpact,
    estimatedTimeMinutes: node.planningMetadata.estimatedTimeMinutes ?? defaultEstimatedTime(node.type),
    cognitiveLoad: node.planningMetadata.cognitiveLoad,
    effort: node.planningMetadata.cost.effort,
    evidenceInstrumentation: node.planningMetadata.evidenceInstrumentation,
    launchBinding: {
      kind: node.type === 'checkpoint' || node.sourceKind === 'checkpoint' ? 'checkpoint-contract' : 'resource-node',
      target,
      sourceRef: { kind: node.sourceKind, ref: node.sourceRef },
    },
    privacyLevel: node.planningMetadata.privacyLevel,
    teacherPolicy: node.planningMetadata.teacherPolicy,
    readiness: node.planningMetadata.readiness,
    graphNodeRefs,
    sceneAvailability,
    citationReadiness,
    evidenceCapability,
    pathProfile,
    governanceLimitations,
  };
}

function isPlanningUnitEligible(node: ResourceNode, target: string | null): target is string {
  if (!target || !buildResourceNodeHighConfidencePlanningAudit(node).pathEligible) return false;
  return true;
}

function buildResourceGraphNodeRefs(node: ResourceNode): ResourceGraphNodeRefs {
  return {
    knowledge: node.planningMetadata.knowledgeCoverage,
    capability: Object.keys(node.planningMetadata.abilityImpact).sort((left, right) => left.localeCompare(right)),
    quality: [],
  };
}

function buildResourcePathProfile(node: ResourceNode): ResourceNodeGraphProfile['pathProfile'] {
  return {
    estimatedTimeMinutes: node.planningMetadata.estimatedTimeMinutes ?? defaultEstimatedTime(node.type),
    cognitiveLoad: node.planningMetadata.cognitiveLoad,
    effort: node.planningMetadata.cost.effort,
    readiness: node.planningMetadata.readiness,
  };
}

function buildResourceSceneAvailability(node: ResourceNode, target: string | null): ResourceSceneAvailabilityMap {
  const hasTarget = Boolean(target);
  const pathEligible = isPlanningUnitEligible(node, target);
  const notAdminScoped = node.planningMetadata.privacyLevel !== 'admin-scoped';
  const konlingAllowed = hasTarget && notAdminScoped;
  const diagnosisAllowed = hasTarget && notAdminScoped;
  const gradingAllowed = hasTarget && notAdminScoped && isGradingSceneResource(node);
  const prepPackAllowed = hasTarget && notAdminScoped && node.planningMetadata.teacherPolicy !== 'blocked';
  const reportAllowed = hasTarget && notAdminScoped;
  return {
    path: {
      allowed: pathEligible,
      reason: pathEligible ? null : hasTarget ? 'not-path-audited' : 'missing-target',
    },
    konling: {
      allowed: konlingAllowed,
      reason: konlingAllowed ? null : hasTarget ? 'admin-scoped-resource' : 'missing-target',
    },
    diagnosis: {
      allowed: diagnosisAllowed,
      reason: diagnosisAllowed ? null : hasTarget ? 'admin-scoped-resource' : 'missing-target',
    },
    grading: {
      allowed: gradingAllowed,
      reason: gradingAllowed
        ? null
        : hasTarget
          ? notAdminScoped ? 'not-assessment-segment' : 'admin-scoped-resource'
          : 'missing-target',
    },
    'prep-pack': {
      allowed: prepPackAllowed,
      reason: prepPackAllowed
        ? null
        : hasTarget
          ? notAdminScoped ? 'teacher-policy-blocked' : 'admin-scoped-resource'
          : 'missing-target',
    },
    report: {
      allowed: reportAllowed,
      reason: reportAllowed ? null : hasTarget ? 'admin-scoped-resource' : 'missing-target',
    },
  };
}

function isGradingSceneResource(node: ResourceNode): boolean {
  return node.type === 'quiz' ||
    node.type === 'adaptive_quiz' ||
    node.type === 'checkpoint' ||
    node.type === 'arena_task' ||
    node.sourceKind === 'checkpoint';
}

function buildCitationReadiness(node: ResourceNode, target: string | null): ResourceCitationReadiness {
  if (!target) {
    return {
      status: 'missing-target',
      verified: false,
      limitations: ['missing-target'],
    };
  }
  if (node.type === 'video' || node.type === 'audio') {
    return {
      status: 'missing-transcript-or-anchor',
      verified: false,
      limitations: ['transcript-or-timecode-anchor-required-for-verified-citation'],
    };
  }
  return {
    status: 'resolvable',
    verified: false,
    limitations: ['citation-target-not-verified'],
  };
}

function buildEvidenceCapability(node: ResourceNode): ResourceEvidenceCapability {
  const instrumentationRefs = node.planningMetadata.evidenceInstrumentation;
  const hasTerminalValidationConstraint = node.planningMetadata.terminalConstraints.some((constraint) =>
    constraint === 'terminal-node' || constraint === 'terminal-validation'
  );
  return {
    instrumentationRefs,
    terminalValidationRole: hasTerminalValidationConstraint
      ? 'terminal'
      : instrumentationRefs.length > 0
        ? 'supporting'
        : 'none',
  };
}

function buildGovernanceLimitations(
  node: ResourceNode,
  target: string | null,
  auditIssueCodes: string[],
  sceneAvailability: ResourceSceneAvailabilityMap,
): ResourceGovernanceLimitation[] {
  const limitations = auditIssueCodes.map((code) => ({
    code,
    message: `ResourceNode audit issue: ${code}.`,
    scenes: ['path'] as ResourceSegmentScene[],
  }));
  if (!target) {
    limitations.push({
      code: 'missing-target',
      message: 'Segment has no render or launch target for retrieval, citation, or path use.',
      scenes: [...RESOURCE_SEGMENT_SCENES],
    });
  }
  for (const scene of RESOURCE_SEGMENT_SCENES) {
    const availability = sceneAvailability[scene];
    if (!availability.allowed && availability.reason) {
      limitations.push({
        code: `scene:${scene}:${availability.reason}`,
        message: `Segment is not available for ${scene}: ${availability.reason}.`,
        scenes: [scene],
      });
    }
  }
  return limitations;
}

function buildSegmentAnchor(node: ResourceNode, target: string | null): ResourceSegmentAnchor {
  const ref = target ?? node.sourceRef;
  if (node.type === 'arena_task') return { kind: 'arena-task', ref };
  if (node.type === 'simulation') return { kind: 'simulation-task', ref };
  if (node.type === 'quiz' || node.type === 'adaptive_quiz') return { kind: 'exercise', ref };
  if (node.sourceKind === 'runtime_lesson_step') return { kind: 'step', ref };
  if (node.type === 'video' || node.type === 'audio') return { kind: 'media', ref };
  if (node.type === 'slides' || node.type === 'textbook_section') return { kind: 'page', ref, page: null };
  return { kind: 'resource', ref };
}

function isSafeMediaSourcePath(sourcePath: string): boolean {
  const normalized = sourcePath.replaceAll('\\', '/');
  return normalized === sourcePath &&
    !normalized.startsWith('/') &&
    !normalized.startsWith('//') &&
    !normalized.startsWith('~') &&
    !/^[A-Za-z]:\//.test(normalized) &&
    !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) &&
    !normalized.includes('\0') &&
    normalized.split('/').every((part) => part !== '..');
}

function buildMediaManifestSourceRefs(
  manifest: ResourceMediaSourceManifest,
  primary: ResourceSemanticSourceReference,
): ResourceSemanticSourceReference[] {
  const refs = [primary];
  if (isNonEmptyString(manifest.sourceRepo)) refs.push({ kind: 'media_source_manifest', ref: `repo:${manifest.sourceRepo}` });
  if (isNonEmptyString(manifest.sourceVersionRef)) refs.push({ kind: 'media_source_manifest', ref: `version:${manifest.sourceVersionRef}` });
  if (isNonEmptyString(manifest.freshnessRef)) refs.push({ kind: 'media_source_manifest', ref: `freshness:${manifest.freshnessRef}` });
  if (isNonEmptyString(manifest.transcriptRef)) refs.push({ kind: 'media_source_manifest', ref: `transcript:${manifest.transcriptRef}` });
  if (isNonEmptyString(manifest.chapterRef)) refs.push({ kind: 'media_source_manifest', ref: `chapter:${manifest.chapterRef}` });
  if (isNonEmptyString(manifest.descriptionRef)) refs.push({ kind: 'media_source_manifest', ref: `description:${manifest.descriptionRef}` });
  return refs;
}

function mediaSegmentPrivacyScope(
  manifest: ResourceMediaSourceManifest,
  segment: ResourceMediaManifestSegment,
): ResourceNodePrivacyLevel {
  const manifestScope = isResourceNodePrivacyLevel(manifest.privacyScope) ? manifest.privacyScope : undefined;
  if (isDeclaredValue(segment.privacyScope) && !isResourceNodePrivacyLevel(segment.privacyScope)) {
    return mostRestrictivePrivacyScope([manifestScope, 'teacher-scoped']);
  }
  return mostRestrictivePrivacyScope([
    manifestScope,
    isResourceNodePrivacyLevel(segment.privacyScope) ? segment.privacyScope : undefined,
  ]);
}

function normalizeMediaManifestSegment(segment: unknown): ResourceMediaManifestSegment {
  return isMediaManifestSegmentRecord(segment) ? segment : ({} as ResourceMediaManifestSegment);
}

function isMediaManifestSegmentRecord(segment: unknown): segment is ResourceMediaManifestSegment {
  return typeof segment === 'object' && segment !== null && !Array.isArray(segment);
}

function mostRestrictivePrivacyScope(scopes: Array<ResourceNodePrivacyLevel | null | undefined>): ResourceNodePrivacyLevel {
  if (scopes.includes('admin-scoped')) return 'admin-scoped';
  if (scopes.includes('teacher-scoped')) return 'teacher-scoped';
  if (scopes.includes('student-visible')) return 'student-visible';
  return 'teacher-scoped';
}

function allocateMediaSegmentKeys(
  segments: ResourceMediaManifestSegment[],
  issues: string[],
): string[] {
  const segmentIdCounts = new Map<string, number>();
  for (const segment of segments) {
    if (!isNonEmptyString(segment.id)) continue;
    segmentIdCounts.set(segment.id, (segmentIdCounts.get(segment.id) ?? 0) + 1);
  }
  const reservedDeclaredKeys = new Set(
    Array.from(segmentIdCounts.entries())
      .filter(([, count]) => count === 1)
      .map(([id]) => id),
  );
  const used = new Set<string>();
  const duplicateIndexes = new Set(
    issues
      .map((issue) => issue.match(/^segments\.(\d+)\.duplicate-id$/)?.[1])
      .filter((index): index is string => Boolean(index))
      .map(Number),
  );
  return segments.map((segment, index) => {
    const declaredKey = isNonEmptyString(segment.id) ? segment.id : null;
    if (declaredKey && !duplicateIndexes.has(index) && !used.has(declaredKey)) {
      used.add(declaredKey);
      return declaredKey;
    }
    const baseKey = declaredKey ? `${declaredKey}#duplicate` : 'segment';
    let candidate = `${baseKey}:${index}`;
    let suffix = 1;
    while (used.has(candidate) || reservedDeclaredKeys.has(candidate)) {
      candidate = `${baseKey}:${index}:${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  });
}

function mediaSegmentId(manifest: ResourceMediaSourceManifest, key: string): string {
  return `media-segment:${manifest.sourceId || 'unknown'}:${key}`;
}

function mediaSegmentKeyFromProjectedId(manifest: ResourceMediaSourceManifest, segmentId: string): string {
  const prefix = `media-segment:${manifest.sourceId || 'unknown'}:`;
  return segmentId.startsWith(prefix) ? segmentId.slice(prefix.length) : segmentId;
}

function issuesForMediaSegment(issues: string[], index: number): string[] {
  const prefix = `segments.${index}.`;
  return issues
    .filter((issue) => !issue.startsWith('segments.') || issue.startsWith(prefix))
    .map((issue) => issue.startsWith(prefix) ? issue.slice(prefix.length) : issue);
}

function hasMediaSegmentAnchor(
  mediaType: ResourceMediaSourceManifest['mediaType'],
  segment: ResourceMediaManifestSegment,
): boolean {
  if (isNonEmptyString(segment.anchorRef)) return true;
  if (mediaType === 'video' || mediaType === 'audio') return hasFiniteMediaTimecode(segment);
  if (mediaType === 'slides') return Number.isFinite(segment.page);
  return false;
}

function hasFiniteMediaTimecode(segment: ResourceMediaManifestSegment): boolean {
  return Number.isFinite(segment.startSeconds);
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDeclaredValue(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function resourceNodeTypeForMediaManifest(
  mediaType: ResourceMediaSourceManifest['mediaType'],
): ResourceNodeType {
  return mediaType === 'image' ? 'external_resource' : mediaType;
}

function isMediaCitationPolicy(value: unknown): value is NonNullable<ResourceMediaManifestSegment['citationPolicy']> {
  return value === 'verified-citation-required' || value === 'source-reference-only';
}

function isMediaAiUsePermission(value: unknown): value is NonNullable<ResourceMediaManifestSegment['aiUsePermission']> {
  return value === 'allowed' || value === 'restricted' || value === 'blocked';
}

function isMediaSourceManifestType(value: unknown): value is ResourceMediaSourceManifest['mediaType'] {
  return value === 'video' || value === 'audio' || value === 'image' || value === 'slides';
}

function normalizedMediaManifestType(value: unknown): ResourceMediaSourceManifest['mediaType'] {
  return isMediaSourceManifestType(value) ? value : 'image';
}

function resourceSegmentKindForMediaManifest(mediaType: ResourceMediaSourceManifest['mediaType']): ResourceSegmentKind {
  return mediaType;
}

function buildMediaSegmentAnchor(
  manifest: ResourceMediaSourceManifest,
  segment: ResourceMediaManifestSegment,
): ResourceSegmentAnchor {
  const ref = segment.anchorRef ?? `${manifest.sourceId}:${segment.id}`;
  if (manifest.mediaType === 'slides') {
    return { kind: 'page', ref, page: segment.page ?? null };
  }
  if (manifest.mediaType === 'image') {
    return { kind: 'image', ref };
  }
  return {
    kind: 'media',
    ref,
    startSeconds: segment.startSeconds ?? null,
    endSeconds: segment.endSeconds ?? null,
  };
}

function normalizeResourceGraphNodeRefs(refs: ResourceGraphNodeRefs | undefined): ResourceGraphNodeRefs {
  return {
    knowledge: uniqueSorted(safeGraphRefValues(refs, 'knowledge')),
    capability: uniqueSorted(safeGraphRefValues(refs, 'capability')),
    quality: uniqueSorted(safeGraphRefValues(refs, 'quality')),
  };
}

function mergeResourceGraphNodeRefs(refs: ResourceGraphNodeRefs[]): ResourceGraphNodeRefs {
  return {
    knowledge: uniqueSorted(refs.flatMap((ref) => ref.knowledge)),
    capability: uniqueSorted(refs.flatMap((ref) => ref.capability)),
    quality: uniqueSorted(refs.flatMap((ref) => ref.quality)),
  };
}

function buildMediaSegmentSceneAvailability(
  segment: ResourceMediaManifestSegment,
  issues: string[],
  privacyScope: ResourceNodePrivacyLevel,
): ResourceSceneAvailabilityMap {
  const blocked = issues.includes('blocked-ai-use');
  const missingAiUse = issues.includes('missing-ai-use-permission');
  const invalidAiUse = issues.includes('invalid-ai-use-permission');
  const invalidPrivacyScope = issues.includes('invalid-privacy-scope');
  const structuralBlock = issues.some((issue) => [
    'invalid-media-type',
    'invalid-segment',
    'missing-id',
    'duplicate-id',
    'missing-anchor',
  ].includes(issue));
  const declaredSceneAvailability = safeSceneAvailabilityMap(segment.sceneAvailability);
  return Object.fromEntries(RESOURCE_SEGMENT_SCENES.map((scene) => {
    if (scene === 'path') {
      return [scene, { allowed: false, reason: 'resource-node-planning-audit-required' }];
    }
    if (privacyScope === 'admin-scoped') return [scene, { allowed: false, reason: 'admin-scoped-resource' }];
    if (structuralBlock) return [scene, { allowed: false, reason: 'invalid-segment-contract' }];
    if (blocked) return [scene, { allowed: false, reason: 'blocked-ai-use' }];
    if (missingAiUse) return [scene, { allowed: false, reason: 'missing-ai-use-permission' }];
    if (invalidAiUse) return [scene, { allowed: false, reason: 'invalid-ai-use-permission' }];
    if (invalidPrivacyScope) return [scene, { allowed: false, reason: 'invalid-privacy-scope' }];
    const declared = declaredSceneAvailability[scene];
    return [
      scene,
      declared ?? { allowed: false, reason: 'not-declared' },
    ];
  })) as ResourceSceneAvailabilityMap;
}

function mergeMediaSceneAvailability(segments: ResourceSegment[]): ResourceSceneAvailabilityMap {
  return Object.fromEntries(RESOURCE_SEGMENT_SCENES.map((scene) => {
    if (scene === 'path') {
      return [scene, { allowed: false, reason: 'resource-node-planning-audit-required' }];
    }
    const anyAllowed = segments.some((segment) => segment.sceneAvailability[scene].allowed);
    return [
      scene,
      {
        allowed: anyAllowed,
        reason: anyAllowed ? null : 'no-segment-available',
      },
    ];
  })) as ResourceSceneAvailabilityMap;
}

function buildMediaSegmentCitationReadiness(
  segment: ResourceMediaManifestSegment,
  issues: string[],
): ResourceCitationReadiness {
  if (issues.length === 0 && segment.citationPolicy === 'verified-citation-required') {
    return { status: 'verified', verified: true, limitations: [] };
  }
  if (!issues.some(isMediaCitationBlockingIssue)) {
    return {
      status: 'resolvable',
      verified: false,
      limitations: segment.citationPolicy === 'source-reference-only' ? ['source-reference-only'] : ['citation-target-not-verified'],
    };
  }
  return {
    status: 'missing-transcript-or-anchor',
    verified: false,
    limitations: issues,
  };
}

function isMediaCitationBlockingIssue(issue: string): boolean {
  return [
    'missing-source-id',
    'missing-source-path',
    'unsafe-source-path',
    'missing-source-version-or-freshness',
    'missing-privacy-scope',
    'invalid-privacy-scope',
    'invalid-media-type',
    'missing-segments',
    'invalid-segment',
    'duplicate-id',
    'missing-id',
    'missing-anchor',
    'missing-graph-bindings',
    'missing-scene-availability',
    'missing-citation-policy',
    'invalid-citation-policy',
    'missing-ai-use-permission',
    'invalid-ai-use-permission',
    'blocked-ai-use',
    'missing-description',
    'missing-transcript',
    'missing-transcript-or-timecode-anchor',
  ].includes(issue);
}

function buildMediaManifestCitationReadiness(
  issues: string[],
  segments: ResourceSegment[],
): ResourceCitationReadiness {
  if (issues.length === 0 && segments.every((segment) => segment.citationReadiness.verified)) {
    return { status: 'verified', verified: true, limitations: [] };
  }
  if (segments.some((segment) => segment.citationReadiness.status === 'resolvable' || segment.citationReadiness.verified)) {
    return {
      status: 'resolvable',
      verified: false,
      limitations: uniqueSorted(segments.flatMap((segment) => segment.citationReadiness.limitations)),
    };
  }
  return {
    status: 'missing-transcript-or-anchor',
    verified: false,
    limitations: issues,
  };
}

function buildMediaSegmentGovernanceLimitations(
  issues: string[],
  sceneAvailability: ResourceSceneAvailabilityMap,
): ResourceGovernanceLimitation[] {
  const limitations = issues.map((code) => ({
    code,
    message: `Media manifest limitation: ${code}.`,
    scenes: [...RESOURCE_SEGMENT_SCENES],
  }));
  for (const scene of RESOURCE_SEGMENT_SCENES) {
    const availability = sceneAvailability[scene];
    if (!availability.allowed && availability.reason) {
      limitations.push({
        code: `scene:${scene}:${availability.reason}`,
        message: `Media segment is not available for ${scene}: ${availability.reason}.`,
        scenes: [scene],
      });
    }
  }
  return limitations;
}

function mergeMediaEvidenceCapability(segments: ResourceSegment[]): ResourceEvidenceCapability {
  const instrumentationRefs = uniqueSorted(segments.flatMap((segment) => segment.evidenceCapability.instrumentationRefs));
  return {
    instrumentationRefs,
    terminalValidationRole: instrumentationRefs.length ? 'supporting' : 'none',
  };
}

function estimateMediaManifestMinutes(manifest: ResourceMediaSourceManifest): number {
  const segments = Array.isArray(manifest.segments)
    ? manifest.segments.filter(isMediaManifestSegmentRecord)
    : [];
  const durationSeconds = segments.reduce((total, segment) => {
    if (segment.startSeconds === undefined || segment.endSeconds === undefined) return total;
    return total + Math.max(0, (segment.endSeconds ?? 0) - (segment.startSeconds ?? 0));
  }, 0);
  if (durationSeconds > 0) return Math.max(1, Math.ceil(durationSeconds / 60));
  return Math.max(1, segments.length * 2);
}

function hasAnyGraphRef(refs: ResourceGraphNodeRefs | undefined): boolean {
  return Boolean(
    safeGraphRefValues(refs, 'knowledge').length ||
    safeGraphRefValues(refs, 'capability').length ||
    safeGraphRefValues(refs, 'quality').length
  );
}

function hasAnySceneAvailability(sceneAvailability: Partial<ResourceSceneAvailabilityMap> | undefined): boolean {
  const scenes = safeSceneAvailabilityMap(sceneAvailability);
  return RESOURCE_SEGMENT_SCENES.some((scene) => scenes[scene]?.allowed !== undefined);
}

function safeGraphRefValues(refs: ResourceGraphNodeRefs | undefined, key: keyof ResourceGraphNodeRefs): string[] {
  const values = refs?.[key];
  return Array.isArray(values)
    ? values.flatMap((value) => (isNonEmptyString(value) ? [value.trim()] : []))
    : [];
}

function safeSceneAvailabilityMap(
  sceneAvailability: Partial<ResourceSceneAvailabilityMap> | undefined,
): Partial<ResourceSceneAvailabilityMap> {
  if (!sceneAvailability || typeof sceneAvailability !== 'object' || Array.isArray(sceneAvailability)) return {};
  return Object.fromEntries(RESOURCE_SEGMENT_SCENES.flatMap((scene) => {
    const availability = sceneAvailability[scene];
    if (
      availability &&
      typeof availability === 'object' &&
      !Array.isArray(availability) &&
      typeof availability.allowed === 'boolean' &&
      (availability.reason === null || typeof availability.reason === 'string')
    ) {
      return [[scene, availability]];
    }
    return [];
  })) as Partial<ResourceSceneAvailabilityMap>;
}

function collectForbiddenProjectionFields(value: unknown, forbiddenFields: Set<string>, path = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>);
  const findings: string[] = [];
  for (const [key, child] of entries) {
    const childPath = path ? `${path}.${key}` : key;
    if (forbiddenFields.has(key)) {
      findings.push(childPath);
    }
    findings.push(...collectForbiddenProjectionFields(child, forbiddenFields, childPath));
  }
  return findings;
}

function collectProjectionSourceKinds(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') return [];
  const sourceKinds: unknown[] = [];
  if (!Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    sourceKinds.push(
      record.sourceKind,
      extractSourceRefKind(record.sourceRef),
      ...extractSourceRefKinds(record.sourceRefs),
    );
  }
  const children = Array.isArray(value)
    ? value
    : Object.values(value as Record<string, unknown>);
  for (const child of children) {
    sourceKinds.push(...collectProjectionSourceKinds(child));
  }
  return sourceKinds;
}

function extractSourceRefKind(sourceRef: unknown): unknown {
  if (!sourceRef || typeof sourceRef !== 'object') return null;
  return (sourceRef as Record<string, unknown>).kind;
}

function extractSourceRefKinds(sourceRefs: unknown): unknown[] {
  if (!Array.isArray(sourceRefs)) return [];
  return sourceRefs.map((sourceRef) => extractSourceRefKind(sourceRef));
}

function semanticOwnershipForSourceKind(sourceKind: unknown): ResourceSemanticSourceOwnership | null {
  if (
    typeof sourceKind !== 'string' ||
    !Object.prototype.hasOwnProperty.call(RESOURCE_SEMANTIC_SOURCE_OWNERSHIP, sourceKind)
  ) {
    return null;
  }
  return RESOURCE_SEMANTIC_SOURCE_OWNERSHIP[sourceKind as ResourceSemanticSourceKind];
}

function requiresReadinessMetadata(node: ResourceNode): boolean {
  if (node.planningMetadata.cognitiveLoad !== 'high') return false;
  return node.type === 'simulation' ||
    node.type === 'arena_task' ||
    node.type === 'control_workbench' ||
    node.type === 'checkpoint' ||
    node.planningMetadata.terminalConstraints.length > 0;
}

function normalizeReadinessMetadata(value: unknown): ResourceNodeReadinessMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const minimumCompetency = normalizeNumericRecord(raw.minimumCompetency);
  const minimumEvidenceCount = typeof raw.minimumEvidenceCount === 'number' && Number.isFinite(raw.minimumEvidenceCount)
    ? Math.max(0, raw.minimumEvidenceCount)
    : 0;
  const requiredCompletedNodeIds = uniqueStableStrings(readStringArray(raw.requiredCompletedNodeIds));
  const requiredOutcomeRefs = uniqueStableStrings(readStringArray(raw.requiredOutcomeRefs));
  const fallbackNodeIds = uniqueStableStrings(readStringArray(raw.fallbackNodeIds));
  const hasReadinessGate = Object.keys(minimumCompetency).length > 0 ||
    minimumEvidenceCount > 0 ||
    requiredCompletedNodeIds.length > 0 ||
    requiredOutcomeRefs.length > 0;
  if (!hasReadinessGate) return null;
  const unlockMessage = typeof raw.unlockMessage === 'string' && raw.unlockMessage.trim().length > 0
    ? raw.unlockMessage.trim()
    : '完成准备节点后会自动解锁。';
  return {
    minimumCompetency,
    minimumEvidenceCount,
    requiredCompletedNodeIds,
    requiredOutcomeRefs,
    unlockMessage,
    fallbackNodeIds,
  };
}

function normalizePathPlanningDisposition(
  value: unknown,
  fallbackSourceFamily?: string,
  fallbackSourceRef?: string,
  fallbackNodeId?: string,
): ResourcePathPlanningDisposition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!isResourcePathPlanningDispositionKind(raw.kind)) return null;
  const sourceFamily = normalizeOptionalString(raw.sourceFamily) ?? fallbackSourceFamily ?? 'resource-node';
  const stableSourceRef = normalizeOptionalString(raw.stableSourceRef) ?? fallbackSourceRef ?? fallbackNodeId ?? '';
  if (!stableSourceRef) return null;

  return {
    kind: raw.kind,
    reviewStatus: isResourcePathPlanningDispositionReviewStatus(raw.reviewStatus)
      ? raw.reviewStatus
      : 'not-reviewed',
    rationale: normalizeOptionalString(raw.rationale),
    sourceFamily,
    stableSourceRef,
    sourceVersionRef: normalizeOptionalString(raw.sourceVersionRef),
    reviewBatchId: normalizeOptionalString(raw.reviewBatchId),
    parentResourceNodeId: normalizeOptionalString(raw.parentResourceNodeId),
    reviewedAt: normalizeOptionalString(raw.reviewedAt),
    reviewerId: normalizeOptionalString(raw.reviewerId),
  };
}

function isResourcePathPlanningDispositionKind(value: unknown): value is ResourcePathPlanningDispositionKind {
  return value === 'path-plannable' ||
    value === 'supporting-citation' ||
    value === 'embedded-asset' ||
    value === 'evidence-producing' ||
    value === 'excluded-with-rationale';
}

function isResourcePathPlanningDispositionReviewStatus(
  value: unknown,
): value is ResourcePathPlanningDispositionReviewStatus {
  return value === 'not-reviewed' ||
    value === 'generated-provisional' ||
    value === 'agent-reviewed' ||
    value === 'human-confirmed';
}

function normalizeNumericRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
      .map(([key, score]) => [key, Math.max(0, Math.min(1, score))]),
  );
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function safeExternalUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function isResourceNodePrivacyLevel(value: unknown): value is ResourceNodePrivacyLevel {
  return value === 'student-visible' || value === 'teacher-scoped' || value === 'admin-scoped';
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function collectLessonKnowledgeCoverage(lesson: RuntimeLessonNodeInput): string[] {
  return uniqueSorted([
    ...(lesson.knowledgeNodeIds ?? []),
    ...(lesson.steps ?? []).flatMap((step) => step.knowledgeNodeIds ?? []),
  ]);
}

function defaultEstimatedTime(type: ResourceNodeType): number {
  if (type === 'video' || type === 'audio') return 8;
  if (type === 'slides' || type === 'handout' || type === 'knowledge_card' || type === 'textbook_section') return 10;
  if (type === 'quiz' || type === 'adaptive_quiz' || type === 'exercise' || type === 'reflection' || type === 'checkpoint') return 12;
  if (type === 'simulation' || type === 'arena_task' || type === 'control_workbench') return 25;
  if (type === 'external_resource') return 15;
  if (type === 'konling' || type === 'ai_intervention') return 6;
  if (type === 'project') return 60;
  return 15;
}

function defaultCognitiveLoad(type: ResourceNodeType): ResourceNodeCognitiveLoad {
  if (type === 'project' || type === 'arena_task' || type === 'simulation' || type === 'control_workbench') return 'high';
  if (
    type === 'video' ||
    type === 'audio' ||
    type === 'slides' ||
    type === 'textbook_section' ||
    type === 'knowledge_card' ||
    type === 'external_resource' ||
    type === 'konling'
  ) return 'low';
  return 'medium';
}

function defaultAbilityImpact(type: ResourceNodeType): Record<string, number> {
  if (type === 'simulation' || type === 'arena_task' || type === 'project' || type === 'control_workbench') {
    return { parameterDesign: 0.3, engineeringDecision: 0.3, crossDomainTransfer: 0.2 };
  }
  if (type === 'reflection' || type === 'ai_intervention' || type === 'konling') {
    return { inquiryReflection: 0.3, selfDirectedLearning: 0.2 };
  }
  if (type === 'adaptive_quiz' || type === 'checkpoint') {
    return { diagnosticAssessment: 0.25 };
  }
  return { controlModeling: 0.2 };
}

function abilityImpactFromTargets(targets: string[]): Record<string, number> {
  const uniqueTargets = uniqueSorted(targets);
  if (uniqueTargets.length === 0) return defaultAbilityImpact('textbook_section');
  return Object.fromEntries(uniqueTargets.map((target) => [target, 0.25]));
}

function uniqueSourceRefs(refs: ResourceNodeSourceReference[]): ResourceNodeSourceReference[] {
  const seen = new Set<string>();
  return refs
    .filter((ref) => {
      const key = `${ref.kind}:${ref.ref}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => `${left.kind}:${left.ref}`.localeCompare(`${right.kind}:${right.ref}`));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function uniqueStableStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}
