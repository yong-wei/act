import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import {
  loadAllTextbookRuntimeResourceCatalogEntries,
  loadAllTextbookRuntimeSearchDocuments,
} from '@/lib/textbook-runtime-resources';
import type { RuntimeLessonMediaKind } from '@/lib/course-runtime';
import {
  buildResourceFieldCompletionAudit,
  buildResourceFieldCompletionAuditFromRows,
  applyResourceFieldCompletionReviewOverlays,
  type ResourceEvidenceLineageReadinessItem,
  type ResourceEvidenceLineageReadinessSummary,
  type ResourceFieldCompletionAuditRow,
  type ResourceFieldCompletionAuditSummary,
  type ResourceFieldCompletionCandidate,
  type ResourceFieldCompletionFamily,
  type ResourceFieldCompletionReviewOverlay,
  type ResourceFieldMissingCode,
  RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
  YANGFAN_FIXTURE_READINESS_SCOPE_POLICY_VERSION,
} from '@/lib/resource-field-completion-audit';
import {
  buildLearningGoalResourceBaselineArtifacts,
  type LearningGoalResourceBaselineReviewedBinding,
} from '@/lib/learning-goal-resource-baseline';
import {
  FULL_RESOURCE_PATH_READINESS_GATE_VERSION,
  buildFullResourcePathReadinessGate,
  buildLearningGoalPathGenerationDiagnostics,
  renderFullResourcePathReadinessGateEvidence,
  type FullResourcePathReadinessGateReport,
  type LearningGoalPathGenerationDiagnostic,
} from '@/lib/full-resource-path-readiness-gate';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '@/lib/adaptive-learning-path-planner';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import {
  buildRuntimeResourceProjectionArtifacts,
} from '@/lib/runtime-resource-projections';
import type { RuntimeResourceProjectionSemanticEvidence } from '@/lib/resource-node-registry';
import {
  assertRuntimeLessonSemanticReviewEvidence,
  assertRuntimeSemanticEvidenceReference,
  type RuntimeLessonSemanticDecisionFacts,
  type RuntimeLessonSemanticReviewEvidence,
} from './runtime-lesson-semantic-evidence';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const AUDIT_JSONL_PATH = path.join(OUTPUT_DIR, 'resource-field-completion-audit.jsonl');
const SUMMARY_JSON_PATH = path.join(OUTPUT_DIR, 'resource-field-completion-summary.json');
const WORKQUEUE_ITEMS_JSONL_PATH = path.join(OUTPUT_DIR, 'resource-completion-workqueue-items.jsonl');
const WORKQUEUE_SUMMARY_JSON_PATH = path.join(OUTPUT_DIR, 'resource-completion-workqueue-summary.json');
const WORKQUEUE_MARKDOWN_PATH = path.join(OUTPUT_DIR, 'resource-completion-workqueues.md');
const EVIDENCE_LINEAGE_ITEMS_JSONL_PATH = path.join(OUTPUT_DIR, 'resource-evidence-lineage-readiness-items.jsonl');
const EVIDENCE_LINEAGE_SUMMARY_JSON_PATH = path.join(OUTPUT_DIR, 'resource-evidence-lineage-readiness-summary.json');
const EVIDENCE_LINEAGE_EVIDENCE_MD_PATH = path.join(OUTPUT_DIR, 'resource-evidence-lineage-readiness-evidence.md');
const DISPOSITION_REVIEW_ITEMS_JSONL_PATH = path.join(OUTPUT_DIR, 'resource-disposition-backlog-review-items.jsonl');
const DISPOSITION_REVIEW_SUMMARY_JSON_PATH = path.join(OUTPUT_DIR, 'resource-disposition-backlog-review-summary.json');
const DISPOSITION_REVIEW_EVIDENCE_MD_PATH = path.join(OUTPUT_DIR, 'resource-disposition-backlog-review-evidence.md');
const KNOWLEDGE_VISUAL_SEMANTIC_REVIEW_ITEMS_JSONL_PATH = path.join(OUTPUT_DIR, 'knowledge-visual-semantic-shard-review-items.jsonl');
const KNOWLEDGE_VISUAL_SEMANTIC_REVIEW_SUMMARY_JSON_PATH = path.join(OUTPUT_DIR, 'knowledge-visual-semantic-shard-summary.json');
const KNOWLEDGE_VISUAL_SEMANTIC_REVIEW_EVIDENCE_MD_PATH = path.join(OUTPUT_DIR, 'knowledge-visual-semantic-shard-evidence.md');
const CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_WORKQUEUE_JSONL_PATH = path.join(OUTPUT_DIR, 'core-registered-knowledge-resource-semantic-workqueue-items.jsonl');
const CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_JSONL_PATH = path.join(OUTPUT_DIR, 'core-registered-knowledge-resource-semantic-review-items.jsonl');
const CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_SOURCE_JSONL_PATH = path.join(OUTPUT_DIR, 'core-registered-knowledge-resource-semantic-review-source.jsonl');
const CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_SUMMARY_JSON_PATH = path.join(OUTPUT_DIR, 'core-registered-knowledge-resource-semantic-summary.json');
const CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_EVIDENCE_MD_PATH = path.join(OUTPUT_DIR, 'core-registered-knowledge-resource-semantic-evidence.md');
const CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_MATERIALIZATION_MANIFEST_PATH = path.join(OUTPUT_DIR, 'core-registered-knowledge-resource-semantic-materialization-manifest.json');
const TEXTBOOK_SEARCH_DOCUMENT_CITATION_REVIEW_ITEMS_JSONL_PATH = path.join(OUTPUT_DIR, 'textbook-search-document-citation-shard-review-items.jsonl');
const HUMAN_REVIEW_INTEGRITY_JSON_PATH = path.join(OUTPUT_DIR, 'resource-human-review-integrity-diagnostics.json');
const PROJECTION_JSONL_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projections.jsonl');
const RUNTIME_LESSON_MEDIA_SEMANTIC_REVIEW_SOURCE_JSONL_PATH = path.join(OUTPUT_DIR, 'runtime-lesson-media-resource-semantics-review-source.jsonl');
const PROJECTION_LIMITATIONS_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projection-limitations.json');
const BASELINE_MATRIX_JSON_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-matrix.json');
const BASELINE_LIMITATIONS_JSON_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-limitations.json');
const BASELINE_REVIEWED_BINDINGS_JSONL_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-reviewed-bindings.jsonl');
const FULL_RESOURCE_PATH_READINESS_GATE_JSON_PATH = path.join(OUTPUT_DIR, 'full-resource-path-readiness-gate-summary.json');
const FULL_RESOURCE_PATH_READINESS_GATE_EVIDENCE_MD_PATH = path.join(OUTPUT_DIR, 'full-resource-path-readiness-gate-evidence.md');
const RUNTIME_LESSONS_DIR = path.join(process.cwd(), 'course-content/runtime/lessons');
const COURSE_CONTENT_CLEARANCE_LESSON_IDS = new Set(['1-3', '1-4', '1-5']);
const RUNTIME_KNOWLEDGE_CARDS_DIR = path.join(process.cwd(), 'course-content/runtime/knowledge/cards/nodes');
const INFOGRAPH_MANIFEST_PATH = path.join(process.cwd(), 'course-content/runtime/knowledge/infographs/manifest.json');
const AUTHORING_TEXTBOOK_ROOT = path.join(process.cwd(), 'course-content/authoring/resources/textbooks');
const STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE = 'student-visible' satisfies ResourceFieldCompletionCandidate['privacyScope'];
const UNCLASSIFIED_AUDIT_PRIVACY_SCOPE = null satisfies ResourceFieldCompletionCandidate['privacyScope'];
const FOUNDATION_GRAPH_RESOURCE_BATCH_ID = 'foundation-graph-resource-bindings-2026-07-04';
const ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID = 'analysis-design-graph-resource-bindings-2026-07-04';
const SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID = 'simulation-transfer-graph-resource-bindings-2026-07-04';
const REVIEWED_GRAPH_RESOURCE_REVIEWED_AT = '2026-07-04T00:00:00.000Z';
const REVIEWED_GRAPH_RESOURCE_REVIEWER = {
  reviewerId: 'graph-resource-governance-review',
  reviewerRole: 'curriculum-data-governance',
};
const RESIDUAL_DISPOSITION_REVIEW_BATCH_ID = 'residual-resource-disposition-review-2026-07-05' as const;
const RESIDUAL_DISPOSITION_REVIEWER_ID = 'residual-resource-disposition-implementing-agent' as const;
const RESIDUAL_DISPOSITION_REVIEWED_AT = '2026-07-05T17:45:00.000Z' as const;
const CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_BATCH_ID = 'core-registered-knowledge-resource-semantics-2026-07-09' as const;
const CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEWER_ID = 'core-registered-knowledge-resource-implementing-agent' as const;
const CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEWED_AT = '2026-07-09T16:30:00.000Z' as const;
const MATERIALIZE_CORE_SEMANTIC_REVIEW_FLAG = '--materialize-core-semantic-review' as const;

export function parseResourceFieldCompletionAuditCliArgs(args: readonly string[]) {
  if (args.length === 0) return { materializeCoreSemanticReview: false } as const;
  if (args.length === 1 && args[0] === MATERIALIZE_CORE_SEMANTIC_REVIEW_FLAG) {
    return { materializeCoreSemanticReview: true } as const;
  }
  throw new Error(
    `Unsupported arguments: ${args.join(' ') || '(none)'}. Expected no arguments or ${MATERIALIZE_CORE_SEMANTIC_REVIEW_FLAG}.`,
  );
}

export interface AtomicWriteFile {
  path: string;
  content: string;
}

export async function atomicWriteFileBatch(
  files: readonly AtomicWriteFile[],
  options: { beforeRename?: (from: string, to: string) => void | Promise<void> } = {},
) {
  const targetPaths = new Set<string>();
  for (const file of files) {
    if (targetPaths.has(file.path)) throw new Error(`Duplicate atomic output path: ${file.path}`);
    targetPaths.add(file.path);
  }
  const token = `${process.pid}-${randomUUID()}`;
  const staged = files.map((file) => ({
    ...file,
    tempPath: `${file.path}.tmp-${token}`,
    backupPath: `${file.path}.backup-${token}`,
    hadOriginal: false,
    backedUp: false,
    committed: false,
  }));
  const cleanup = async () => {
    await Promise.all(staged.flatMap((file) => [
      fs.rm(file.tempPath, { force: true }),
      fs.rm(file.backupPath, { force: true }),
    ]));
  };

  try {
    for (const file of staged) await fs.writeFile(file.tempPath, file.content, 'utf8');
    for (const file of staged) {
      try {
        await fs.access(file.path);
        file.hadOriginal = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (file.hadOriginal) {
        await options.beforeRename?.(file.path, file.backupPath);
        await fs.rename(file.path, file.backupPath);
        file.backedUp = true;
      }
      await options.beforeRename?.(file.tempPath, file.path);
      await fs.rename(file.tempPath, file.path);
      file.committed = true;
    }
    await cleanup();
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const file of [...staged].reverse()) {
      try {
        if (file.committed) await fs.rm(file.path, { force: true });
        if (file.backedUp) await fs.rename(file.backupPath, file.path);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    try {
      await cleanup();
    } catch (cleanupError) {
      rollbackErrors.push(cleanupError);
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], 'Atomic output batch failed and rollback was incomplete');
    }
    throw error;
  }
}

const CORE_SCOPE_FAMILIES = new Set<ResourceFieldCompletionFamily>([
  'registered-resource',
  'knowledge-card',
  'knowledge-infograph',
]);
const CORE_REVIEW_ONLY_BLOCKER_CODES = new Set<ResourceFieldMissingCode>([
  'missing-human-review',
  'provisional-metadata',
  'stale-review',
]);
const RUNTIME_LESSON_MEDIA_SEMANTIC_SCOPE_FAMILIES = new Set<ResourceFieldCompletionFamily>([
  'runtime-lesson-step',
  'runtime-lesson-module',
  'runtime-lesson-media',
  'runtime-handout',
]);

type ResidualDispositionClassification =
  | 'path-plannable'
  | 'supporting-citation'
  | 'embedded-asset'
  | 'evidence-producing'
  | 'excluded-with-rationale';

type TextbookSearchDocumentCitationClassification =
  | 'parent-section-evidence-support'
  | 'supporting-citation'
  | 'embedded-asset'
  | 'excluded-with-rationale';

interface TextbookSearchDocumentCitationReviewItem {
  resourceId: string;
  documentId: string;
  classification: TextbookSearchDocumentCitationClassification;
  reviewerVisibleRationale: string;
  reviewerId: string;
  reviewedAt: string;
  reviewBatchId: string;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  privacyScope: ResourceFieldCompletionCandidate['privacyScope'];
  pathEligible: false;
  promotedAsPathNode: false;
  rawContentIncluded: false;
  citationTargetId?: string;
  citationAddress?: {
    href?: string;
    contentHash?: string;
    locator?: string;
  };
  graphNodeRefs: {
    knowledge: string[];
    capability: string[];
    quality: string[];
  };
  parentReviewRef?: string;
  limitationState?: string[];
}

interface ResidualDispositionReviewItem {
  artifactVersion: 'resource-disposition-backlog-review.v1';
  reviewBatchId: string;
  reviewerId: string;
  reviewedAt: string;
  resourceId: string;
  sourceFamily: string;
  title: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string | null;
  stableSourceRef: string;
  classification: ResidualDispositionClassification;
  reviewerVisibleRationale: string;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  originalMissingFieldCodes: ResourceFieldMissingCode[];
  reviewedLimitationState: string[];
  downstreamBlockers: Array<{
    bucket: 'evidence-lineage' | 'runtime-identity' | 'path-readiness' | 'dependency' | 'none';
    codes: ResourceFieldMissingCode[];
  }>;
  currentPathEligible: boolean;
  privacyMinimized: true;
  rawContentIncluded: false;
}

interface ResidualDispositionReviewSource {
  classification: ResidualDispositionClassification;
  reviewerVisibleRationale: string;
  reviewerId: string;
  reviewedAt: string;
  reviewBatchId: string;
  sourceHash: string | null;
  sourceVersionRef: string | null;
}

interface KnowledgeVisualSemanticReviewItem {
  artifactVersion: 'knowledge-visual-semantic-shard-review.v1';
  reviewBatchId: string;
  reviewerId: string;
  reviewerRole: string;
  reviewedAt: string;
  selectedOrder: number;
  resourceId: string;
  sourceFamily: 'knowledge-card' | 'knowledge-infograph';
  title: string;
  sourcePathOrUrl: string;
  sourceRecord: string;
  sourceHash: string;
  sourceVersionRef: string;
  originalBlockerCodes: ResourceFieldMissingCode[];
  selectionReason: string;
  graphNodeIds: string[];
  learningGoalIds: string[];
  knowledgeObjectiveIds: string[];
  capabilityObjectiveIds: string[];
  qualityObjectiveIds: string[];
  kaqContribution: {
    knowledge: string;
    capability: string;
    quality: string;
  };
  disposition: ResidualDispositionClassification;
  pathStageOrSupportRole: string;
  routeTarget: string | null;
  citationTargets: string[];
  citationContract: 'server-owned-runtime-knowledge-card' | 'server-owned-infograph-manifest';
  authorityLevel: 'runtime-reviewed-source';
  evidenceBehavior: 'path-execution-evidence-only' | 'citation-display-only';
  privacyScope: ResourceFieldCompletionCandidate['privacyScope'];
  limitationState: string[];
  estimatedTimeMinutes: number | null;
  segmentRefs: string[];
  evidenceInstrumentation: string[];
  currentPathEligible: boolean;
  reviewerVisibleRationale: string;
  independentEvidenceRef: string;
  rawContentIncluded: false;
  privacyMinimized: true;
}

interface KnowledgeVisualSemanticReviewSummary {
  artifactVersion: 'knowledge-visual-semantic-shard-review.v1';
  reviewBatchId: string;
  selectedCount: number;
  selectedResourceIds: string[];
  selectedBlockerCodes: ResourceFieldMissingCode[];
  remainingSelectedSemanticReview: number;
  residualUnselectedCounts: Record<'knowledge-card' | 'knowledge-infograph', number>;
  byDisposition: Record<string, number>;
  evidence: {
    reviewItemsPath: string;
    auditJsonlPath: string;
    workqueueItemsPath: string;
  };
}

type CoreRegisteredKnowledgeResourceFamily =
  | 'registered-resource'
  | 'knowledge-card'
  | 'knowledge-infograph';

export interface CoreRegisteredKnowledgeResourceSemanticWorkqueueItem {
  artifactVersion: 'core-registered-knowledge-resource-semantics.v1';
  reviewBatchId: string;
  selectedOrder: number;
  resourceId: string;
  sourceFamily: CoreRegisteredKnowledgeResourceFamily;
  title: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string | null;
  startingBlockerCodes: ResourceFieldMissingCode[];
  startingBlockerCount: number;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  privacyMinimized: true;
  rawContentIncluded: false;
}

export interface CoreRegisteredKnowledgeResourceSemanticReviewItem extends CoreRegisteredKnowledgeResourceSemanticWorkqueueItem {
  reviewerId: string;
  reviewerRole: string;
  reviewedAt: string;
  reviewSourceKind: 'implementing-agent-item-review';
  disposition: ResidualDispositionClassification;
  graphNodeIds: string[];
  learningGoalIds: string[];
  knowledgeObjectiveIds: string[];
  capabilityObjectiveIds: string[];
  qualityObjectiveIds: string[];
  objectiveMappingRationale: string;
  pathStageOrSupportRole: string;
  routeTarget: string | null;
  citationTargets: string[];
  evidenceBehavior: 'path-execution-evidence-only' | 'citation-display-only' | 'route-only-source-identity-limited';
  privacyScope: ResourceFieldCompletionCandidate['privacyScope'];
  residualLimitationState: string[];
  currentPathEligible: boolean;
  reviewerVisibleRationale: string;
  independentEvidenceRef: string;
}

export interface CoreRegisteredKnowledgeResourceSemanticReviewSource {
  artifactVersion: 'core-registered-knowledge-resource-semantics.review-source.v1';
  reviewBatchId: string;
  reviewerId: string;
  reviewerRole: string;
  reviewedAt: string;
  reviewSourceKind: 'implementing-agent-item-review';
  resourceId: string;
  disposition: ResidualDispositionClassification;
  graphNodeIds: string[];
  learningGoalIds: string[];
  knowledgeObjectiveIds: string[];
  capabilityObjectiveIds: string[];
  qualityObjectiveIds: string[];
  objectiveMappingRationale: string;
  pathStageOrSupportRole: string;
  routeTarget: string | null;
  citationTargets: string[];
  evidenceBehavior: CoreRegisteredKnowledgeResourceSemanticReviewItem['evidenceBehavior'];
  privacyScope: ResourceFieldCompletionCandidate['privacyScope'];
  residualLimitationState: string[];
  currentPathEligible: boolean;
  reviewerVisibleRationale: string;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  privacyMinimized: true;
  rawContentIncluded: false;
}

interface RuntimeLessonMediaSemanticReviewSource {
  artifactVersion: 'runtime-lesson-media-resource-semantics.review-source.v1';
  reviewSourceKind: 'explicit-item-review';
  reviewBatchId: string;
  reviewerId: string;
  reviewerRole: string;
  reviewedAt: string;
  reviewState?: 'human-confirmed' | 'pending-rereview';
  staleReason?: string;
  reviewedSourceHash?: string | null;
  currentSourceHash?: string | null;
  reviewedManifestHash?: string | null;
  currentManifestHash?: string | null;
  reviewedEvidenceHash?: string | null;
  currentEvidenceHash?: string | null;
  reviewedSourceSemanticDigest?: string | null;
  currentSourceSemanticDigest?: string | null;
  reviewedManifestSemanticDigest?: string | null;
  currentManifestSemanticDigest?: string | null;
  reviewedEvidenceSemanticDigest?: string | null;
  currentEvidenceSemanticDigest?: string | null;
  resourceId: string;
  sourceFamily: ResourceFieldCompletionFamily;
  expectedSourceHash: string | null;
  expectedSourceVersionRef: string | null;
  sourceEvidenceHash: string | null;
  disposition: ResidualDispositionClassification | 'planning-unit';
  promotedAsPlanningUnit: boolean;
  currentPathEligible: boolean;
  pathTarget: string | null;
  parentLessonRef: string;
  parentResourceRef: string | null;
  parentPlanningUnitRef: string | null;
  graphNodeRefs: ResourceFieldCompletionAuditRow['graphNodeRefs'];
  learningGoalIds: string[];
  knowledgeObjectiveIds: string[];
  capabilityObjectiveIds: string[];
  qualityObjectiveIds: string[];
  evidenceDecision: 'independent-path-evidence' | 'parent-evidence' | 'citation-only' | 'embedded' | 'excluded';
  evidenceContractComplete: boolean;
  evidenceMissingFields: string[];
  evidenceInstrumentation: string[];
  independentEvidenceRef: string;
  reviewerVisibleRationale: string;
  confidence: number | null;
  readinessPresent: boolean;
  estimatedTimeMinutes: number | null;
  citationTargets: string[];
  rawContentIncluded: false;
  privacyMinimized: true;
  reasonCodes: string[];
  decisionFacts: RuntimeLessonSemanticDecisionFacts;
  runtimeEvidence: RuntimeLessonSemanticReviewEvidence;
}

function assertRuntimeLessonMediaSemanticEvidenceReference(source: RuntimeLessonMediaSemanticReviewSource) {
  assertRuntimeSemanticEvidenceReference(source.independentEvidenceRef);
}

export interface CoreRegisteredKnowledgeResourceSemanticSummary {
  artifactVersion: 'core-registered-knowledge-resource-semantics.v1';
  reviewBatchId: string;
  reviewerId: string;
  reviewedAt: string;
  totals: {
    scopedResources: number;
    workqueueItems: number;
    reviewedResources: number;
    remainingSemanticReviewBlockers: number;
    unexplainedRemainingItems: number;
    rawContentIncluded: boolean;
    privacyMinimized: boolean;
  };
  bySourceFamily: Record<string, number>;
  byDisposition: Record<string, number>;
  residualLimitations: Record<string, number>;
  startingBlockers: Record<string, number>;
  evidence: {
    workqueueItemsPath: string;
    reviewSourcePath: string;
    reviewItemsPath: string;
    sourceAuditPath: string;
  };
}

export interface CoreRegisteredKnowledgeResourceSemanticMaterializationManifest {
  artifactVersion: 'core-registered-knowledge-resource-semantic-materialization-manifest.v1';
  legacyAuditSha256: string;
  legacySummaryMetadataSha256: string;
  nonScopeRowsCanonicalSha256: string;
  scopeRowsInvariantCanonicalSha256: string;
  runtimeScopeRowsInvariantCanonicalSha256: string;
  reviewSourceFileSha256: string;
  denominator: number;
  scopeRows: number;
  runtimeScopeRows: number;
  nonScopeRows: number;
}

export interface CourseContentClearanceReviewedResource {
  resourceId: string;
  sourcePath: string;
  sourceHash: string;
  sourceVersionRef: string;
  graphNodeRefs: {
    knowledge: string[];
    capability: string[];
    quality: string[];
  };
  pathTarget: string | null;
  currentPathEligible: boolean;
  rationale: string;
}

export interface CourseContentClearanceRecord {
  lesson_id: string;
  reviewer: string;
  batch: string;
  time: string;
  model: string;
  status: 'cleared';
  review_status: 'model-cleared';
  independent_evidence_ref: string;
  reviewed_resources: CourseContentClearanceReviewedResource[];
}

export type CoreSemanticMaterializationPhase = 'legacy' | 'materialized';

export interface ReviewedRuntimeStepCompletion {
  capabilityTargetIds: string[];
  estimatedTimeMinutes: number;
  reviewBatchId?: string;
  reviewedSourceHash: string;
  reviewerVisibleRationale: string;
  independentEvidenceRef: string;
}

const REVIEWED_LESSON_1_1_REVIEW_SOURCE_HASH =
  'sha256:e1fa4be79241e2738135a6d95a8c22c56e8d2cbe74bb2bd185d712c3823fa6f5';
const REVIEWED_LESSON_1_2_REVIEW_SOURCE_HASH =
  'sha256:5842fbd155ef3ef56e01eed3c284a37825457d8087a9af5faca23639af2b0788';
const REVIEWED_LESSON_2_2_REVIEW_SOURCE_HASH =
  'sha256:9499fd054ae57805d1056ebf604f5e13d7933957dea7af31b8ec38852446482f';
const REVIEWED_LESSON_2_4_REVIEW_SOURCE_HASH =
  'sha256:53322e0e3b207b48117343f95ec7e7919d71d4a80ee156e1b0ca7b9f21e32070';
const REVIEWED_LESSON_3_5_REVIEW_SOURCE_HASH =
  'sha256:a3827b5503e9adb36dbf9fcaabf84d2186484ded5bd8d22c496c2455859cfd5e';
const REVIEWED_LESSON_3_6_REVIEW_SOURCE_HASH =
  'sha256:5f54231e92c3ce4c95102acb6dcbdfdab6fa76af1825ef8a4fbc25a37abf1d60';
const REVIEWED_LESSON_3_8_REVIEW_SOURCE_HASH =
  'sha256:7cf64cf020db032173c7202c147b99b7e3d8abc38bf68dc9faf6c018187ce2ef';
const REVIEWED_LESSON_3_9_REVIEW_SOURCE_HASH =
  'sha256:edfd6ac618883d835047cac79004a61e6d966dcec010e3e8d1ce93a02c919caf';
const REVIEWED_LESSON_4_1_REVIEW_SOURCE_HASH =
  'sha256:8140ae0105d644dec15be1bfbdaae8a6818e278ddf781c86b81d5e930d2849ad';
const REVIEWED_LESSON_4_2_REVIEW_SOURCE_HASH =
  'sha256:04885db9a749ef79821f6a4bc76f1e6af2f8a24dc19874f00b3893b673a72b48';
const REVIEWED_LESSON_4_7_REVIEW_SOURCE_HASH =
  'sha256:c36221b3d2ded7abc806ee55dede17dd429abe5002a0bfe6eca19b890972fdae';
const REVIEWED_LESSON_5_3_REVIEW_SOURCE_HASH =
  'sha256:1b25b729775916efb71173af03a7fc9b733691a62acefeb3fe02806025ae4027';

function reviewedRuntimeStepCompletion(input: ReviewedRuntimeStepCompletion): ReviewedRuntimeStepCompletion {
  return input;
}

const REVIEWED_RUNTIME_STEP_COMPLETIONS = new Map<string, ReviewedRuntimeStepCompletion>([
  ['1-1:step-09', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewedSourceHash: REVIEWED_LESSON_1_1_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 09 explicitly covers feedback, open loop, closed loop, error, controller, and correction nodes for feedback-loop foundations.',
    independentEvidenceRef: 'course-content/runtime/lessons/1-1/graph-overlay.json#group:反馈与开闭环',
  })],
  ['1-1:step-10', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewedSourceHash: REVIEWED_LESSON_1_1_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 10 compares the three domains and diagnostic loop, extending the feedback-loop concept coverage to system-level reasoning.',
    independentEvidenceRef: 'course-content/runtime/lessons/1-1/graph-overlay.json#group:反馈与开闭环',
  })],
  ['1-2:step-04', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewedSourceHash: REVIEWED_LESSON_1_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 04 distinguishes mechanism modeling and data-driven modeling, matching the transfer-function modeling foundation boundary through 建模_1_2.',
    independentEvidenceRef: 'course-content/runtime/lessons/1-2/graph-overlay.json#group:建模路径与微分方程',
  })],
  ['1-2:step-05', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewedSourceHash: REVIEWED_LESSON_1_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 05 translates physical objects into differential equations and is a concept-level precursor for transfer-function modeling.',
    independentEvidenceRef: 'course-content/runtime/lessons/1-2/graph-overlay.json#group:建模路径与微分方程',
  })],
  ['2-2:step-09', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 7,
    reviewedSourceHash: REVIEWED_LESSON_2_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 09 directly covers the dynamic performance indicator node used by the time-domain-response-analysis goal.',
    independentEvidenceRef: 'course-content/runtime/lessons/2-2/graph-overlay.json#group:动态性能指标精讲',
  })],
  ['2-2:step-10', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 7,
    reviewedSourceHash: REVIEWED_LESSON_2_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 10 reviews rise-time definition and derivation as a path-eligible concept resource for time-domain performance analysis.',
    independentEvidenceRef: 'course-content/runtime/lessons/2-2/graph-overlay.json#group:动态性能指标精讲',
  })],
  ['2-2:step-11', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 7,
    reviewedSourceHash: REVIEWED_LESSON_2_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 11 covers peak time and overshoot, preserving citation/path distinction as a concept step rather than assessment evidence.',
    independentEvidenceRef: 'course-content/runtime/lessons/2-2/graph-overlay.json#group:动态性能指标精讲',
  })],
  ['2-2:step-12', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 7,
    reviewedSourceHash: REVIEWED_LESSON_2_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 12 covers settling-time error bands and is reviewed as concept/path material for time-domain response analysis.',
    independentEvidenceRef: 'course-content/runtime/lessons/2-2/graph-overlay.json#group:动态性能指标精讲',
  })],
  ['2-2:step-13', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewedSourceHash: REVIEWED_LESSON_2_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 13 applies time-domain indicator calculations in a worked example, improving concept practice support without counting as checkpoint evidence.',
    independentEvidenceRef: 'course-content/runtime/lessons/2-2/graph-overlay.json#group:动态性能指标精讲',
  })],
  ['2-4:step-09', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_2_4_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 09 introduces cutoff frequency, crossover frequency, phase margin, gain margin, and bandwidth as frequency-domain reading targets for margin foundations.',
    independentEvidenceRef: 'course-content/runtime/lessons/2-4/graph-overlay.json#group:频域指标入口',
  })],
  ['2-4:step-10', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_2_4_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 10 compares Bode and Nyquist locations for the same indicators, supporting citation-ready frequency-response interpretation without promoting assessment status.',
    independentEvidenceRef: 'course-content/runtime/lessons/2-4/graph-overlay.json#group:频域指标入口',
  })],
  ['2-4:step-11', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_2_4_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 11 reviews Bode baseline, breakpoints, and slope drawing as frequency-response foundation material.',
    independentEvidenceRef: 'course-content/runtime/lessons/2-4/graph-overlay.json#group:手工绘图与最小反识别',
  })],
  ['2-4:step-12', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_2_4_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 12 reviews Nyquist endpoints, crossings, and asymptotes as paired graph-reading support for frequency response foundations.',
    independentEvidenceRef: 'course-content/runtime/lessons/2-4/graph-overlay.json#group:手工绘图与最小反识别',
  })],
  ['3-5:step-01', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_5_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 01 transitions from reading along a root locus to changing the controller structure, directly matching root-locus analysis foundations.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-5/graph-overlay.json#group:从 3-4 的边界进入结构改变',
  })],
  ['3-5:step-02', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_5_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 02 reviews the unified object and observation frame for root-locus, response, and structural-change comparisons.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-5/graph-overlay.json#group:从 3-4 的边界进入结构改变',
  })],
  ['3-5:step-04', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_5_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 04 reviews how adding a zero changes root-locus branch behavior, matching root-locus analysis and design-preparation nodes.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-5/graph-overlay.json#group:左半平面零点与轨迹重排',
  })],
  ['3-5:step-05', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_5_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 05 extends zero-introduction review to third-order root-locus reshaping and dominant-branch interpretation.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-5/graph-overlay.json#group:左半平面零点与轨迹重排',
  })],
  ['3-5:step-10', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_5_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 10 reviews PD frequency-domain fingerprints and their cost, useful for margin and controller-design concept coverage.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-5/graph-overlay.json#group:PD 与超前的频域整形',
  })],
  ['3-5:step-11', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_5_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 11 reviews lead compensation phase peak and action band, directly supporting phase-margin and correction-design concepts.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-5/graph-overlay.json#group:PD 与超前的频域整形',
  })],
  ['3-5:step-12', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_5_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 12 compares PD and lead compensation in frequency-domain design decisions while remaining concept material rather than terminal validation.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-5/graph-overlay.json#group:PD 与超前的频域整形',
  })],
  ['3-6:step-06', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_6_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 06 converts time-domain targets into a design feasible region, bridging stability, transient targets, and root-locus design.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-6/graph-overlay.json#group:从 3-5 机理切到目标翻译',
  })],
  ['3-6:step-10', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_6_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 10 shows how frequency-domain targets enter lead-compensator design, matching margin and correction-design graph nodes.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-6/graph-overlay.json#group:任务 C / D：频域目标驱动设计',
  })],
  ['3-6:step-11', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_6_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 11 covers lead frequency design as reviewed concept/path material without approving it as checkpoint evidence.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-6/graph-overlay.json#group:任务 C / D：频域目标驱动设计',
  })],
  ['3-6:step-12', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_6_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 12 explains why the same frequency-domain indicator can lead to a separate PD design pass, preserving design-role distinction.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-6/graph-overlay.json#group:任务 C / D：频域目标驱动设计',
  })],
  ['3-6:step-13', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_6_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 13 reviews PD frequency design and side-by-side comparison for correction-design concept coverage.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-6/graph-overlay.json#group:任务 C / D：频域目标驱动设计',
  })],
  ['3-8:step-06', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_8_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 06 reviews how left-half-plane zeros reshape middle-frequency behavior, adding frequency-response concept support.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-8/graph-overlay.json#group:Nyquist 与 Bode 统一判稳链',
  })],
  ['3-8:step-07', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_8_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 07 links added poles and integrators to accuracy and margin tightening, covering steady-state and stability-margin concepts.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-8/graph-overlay.json#group:Nyquist 与 Bode 统一判稳链',
  })],
  ['3-8:step-09', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_8_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 09 guides structural-change judgment by frequency band, supporting frequency response and margin interpretation.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-8/graph-overlay.json#group:三频段分工与工程案例读回',
  })],
  ['3-8:step-10', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_8_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 10 explains the Nyquist stability chain from the argument principle, keeping margin concepts separate from assessment approval.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-8/graph-overlay.json#group:三频段分工与工程案例读回',
  })],
  ['3-9:step-01', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_9_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 01 reviews three improvement demands for the same ship, connecting root-locus, frequency-domain, steady-state, and design labels.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-9/graph-overlay.json#group:统一对象与多版本映射入口',
  })],
  ['3-9:step-08', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_3_9_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 08 reviews mid-frequency phase cleanup after integral compensation, preserving steady-state versus margin distinction.',
    independentEvidenceRef: 'course-content/runtime/lessons/3-9/graph-overlay.json#group:综合映射与模块4入口',
  })],
  ['4-1:step-01', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_1_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 01 turns cross-domain evidence into a design task, connecting margins and design constraints for control-correction coverage.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-1/graph-overlay.json#group:入口回收与指标重组',
  })],
  ['4-1:step-05', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_1_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 05 reviews why platform stability keeps speed as a design priority, matching stability feasible-region concepts.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-1/graph-overlay.json#group:任务分类与区域分层',
  })],
  ['4-1:step-07', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_1_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 07 reorganizes time-domain, frequency-domain, and integral-error indicators into design roles.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-1/graph-overlay.json#group:主场景联读',
  })],
  ['4-1:step-10', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_1_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 10 distinguishes feasible, satisfactory, and optimal regions for controller design boundary reasoning.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-1/graph-overlay.json#group:任务表达与收束',
  })],
  ['4-2:step-11', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 11 reviews frequency-domain PI parameter calculation and keeps it as concept/design material.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-2/graph-overlay.json#group:分结构整定例题',
  })],
  ['4-2:step-12', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 12 reviews frequency-domain lead compensation parameter calculation for correction-design concepts.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-2/graph-overlay.json#group:分结构整定例题',
  })],
  ['4-2:step-13', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['controlModeling'],
    estimatedTimeMinutes: 8,
    reviewBatchId: ANALYSIS_DESIGN_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_2_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 13 reviews lag-compensation parameter calculation and preserves it as concept/path support.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-2/graph-overlay.json#group:分结构整定例题',
  })],
  ['4-7:step-03', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['parameterDesign', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_7_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 03 frames the real-track task and segmented identified model as simulation-validation context without claiming official Arena authority.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-7/graph-overlay.json#group:指标翻译与传统设计',
  })],
  ['4-7:step-04', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['parameterDesign', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_7_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 04 translates track, rudder, and margin indicators into a cost-function judgment, reviewed as simulation-validation concept support only.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-7/graph-overlay.json#group:指标翻译与传统设计',
  })],
  ['4-7:step-05', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['parameterDesign', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_7_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 05 connects four-plot diagnosis to candidate controller structure selection and is reviewed as design-validation path support.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-7/graph-overlay.json#group:优化设计与跨模型验证',
  })],
  ['4-7:step-06', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['parameterDesign', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_7_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 06 turns nominal verification into reproducible controller formulas while keeping terminal validation unapproved.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-7/graph-overlay.json#group:优化设计与跨模型验证',
  })],
  ['4-7:step-07', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['parameterDesign', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_7_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 07 reviews optimization encoding and decoding as simulation-design transfer support, not as an official evaluator result.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-7/graph-overlay.json#group:优化设计与跨模型验证',
  })],
  ['4-7:step-08', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['parameterDesign', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_7_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 08 compares nominal and high-fidelity model outcomes, providing reviewed simulation-validation concept evidence while preserving official scoring boundaries.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-7/graph-overlay.json#group:扰动噪声与设计边界',
  })],
  ['4-7:step-09', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['parameterDesign', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_7_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 09 reviews disturbance-boundary reasoning and keeps the resource as concept/practice path support rather than terminal validation.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-7/graph-overlay.json#group:扰动噪声与设计边界',
  })],
  ['4-7:step-10', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['parameterDesign', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_4_7_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 10 reviews sensor-noise boundary handling as simulation-validation concept support with no official Arena claim.',
    independentEvidenceRef: 'course-content/runtime/lessons/4-7/graph-overlay.json#group:扰动噪声与设计边界',
  })],
  ['5-3:step-09', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['crossDomainTransfer', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_5_3_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 09 reviews responsibility-diagnosis order for MASS transfer applications and remains concept/path support.',
    independentEvidenceRef: 'course-content/runtime/lessons/5-3/graph-overlay.json#group:责任诊断与工程收束',
  })],
  ['5-3:step-10', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['crossDomainTransfer', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_5_3_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 10 links autonomous-avoidance deviation propagation to transfer reasoning while avoiding official Arena authority.',
    independentEvidenceRef: 'course-content/runtime/lessons/5-3/graph-overlay.json#group:信息、规划与执行边界',
  })],
  ['5-3:step-11', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['crossDomainTransfer', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_5_3_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 11 reviews turning-radius and rudder feasibility as ship-ocean transfer concept evidence, not as a scored validation.',
    independentEvidenceRef: 'course-content/runtime/lessons/5-3/graph-overlay.json#group:责任诊断与工程收束',
  })],
  ['5-3:step-12', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['crossDomainTransfer', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_5_3_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 12 reviews MASS automation level and responsibility boundaries as transfer-application concept support.',
    independentEvidenceRef: 'course-content/runtime/lessons/5-3/graph-overlay.json#group:责任诊断与工程收束',
  })],
  ['5-3:step-13', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['crossDomainTransfer', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_5_3_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 13 provides a minimal method for reading MASS links and is reviewed as transfer-application path support.',
    independentEvidenceRef: 'course-content/runtime/lessons/5-3/graph-overlay.json#group:责任诊断与工程收束',
  })],
  ['5-3:step-15', reviewedRuntimeStepCompletion({
    capabilityTargetIds: ['crossDomainTransfer', 'engineeringDecision'],
    estimatedTimeMinutes: 8,
    reviewBatchId: SIMULATION_TRANSFER_GRAPH_RESOURCE_BATCH_ID,
    reviewedSourceHash: REVIEWED_LESSON_5_3_REVIEW_SOURCE_HASH,
    reviewerVisibleRationale: 'Step 15 summarizes MASS link responsibility boundaries as concept/citation support and does not promote the preceding post-test to checkpoint evidence.',
    independentEvidenceRef: 'course-content/runtime/lessons/5-3/graph-overlay.json#group:责任诊断与工程收束',
  })],
]);

function reviewedRuntimeStepReadiness(completion: ReviewedRuntimeStepCompletion) {
  return {
    minimumCompetency: Object.fromEntries(
      completion.capabilityTargetIds.map((targetId) => [targetId, 0.2]),
    ),
    minimumEvidenceCount: 1,
    requiredCompletedNodeIds: [],
    requiredOutcomeRefs: [],
    unlockMessage: '完成本单元前序学习证据后进入该步骤。',
    fallbackNodeIds: [],
  };
}

export function reviewedRuntimeStepCompletionForSource(
  completion: ReviewedRuntimeStepCompletion | undefined,
  sourceHash: string | null,
): ReviewedRuntimeStepCompletion | null {
  return completion && completion.reviewedSourceHash === sourceHash ? completion : null;
}

export function runtimeLessonReviewSourceHash(
  manifestHash: string | null,
  graphOverlayHash: string | null,
): string | null {
  if (!manifestHash || !graphOverlayHash) return null;
  return `sha256:${sha256(`${manifestHash}\n${graphOverlayHash}`)}`;
}

interface RuntimeInteractiveManifest {
  lesson_id?: string;
  course_title?: string;
  course_route_segment?: string;
  preview_mode?: {
    student_demo_base_path?: string;
  };
  steps?: Record<string, {
    title?: string;
    duration_minutes?: number | null;
    modules?: RuntimeInteractiveModule[];
    telemetry_spec?: unknown;
    ai_context_spec?: unknown;
    acceptance_checks?: unknown;
    preview_contract?: {
      demo_path?: string;
    };
    preview?: {
      student?: string;
    };
  }>;
}

interface RuntimeInteractiveModule {
  id?: string;
  kind?: string;
  payload?: {
    src?: string;
    caption?: string;
    title?: string;
  };
}

interface RuntimeLessonCatalogEntry {
  lesson: {
    lesson_id: string;
    title: string;
  };
  graphOverlay: {
    lesson_id: string;
    focus_node_ids: string[];
    entry_nodes?: string[];
    summary_nodes?: string[];
    card_order: string[];
    groups: Array<{ step_ids: string[]; node_ids: string[] }>;
    nodes: Array<{ id: string; name: string }>;
  };
  handoutPath: string;
  handoutSourcePath: string;
  handoutSourceHash: string | null;
  handoutSourceVersionRef: string | null;
  handoutPdfPath: string | null;
  mediaResources: Array<{
    id: string;
    title: string;
    kind: RuntimeLessonMediaKind;
    url: string | null;
    filename: string;
    accessMode: 'dialog';
    embedMode: 'iframe' | 'none';
    status: 'ready';
    featured: boolean;
  }>;
}

interface RuntimeLessonJson {
  lesson_id?: string;
  title?: string;
  handout_path?: string;
  handout_pdf_path?: string | null;
  card_order?: string[];
  sequence?: {
    groups?: Array<{ step_ids: string[]; node_ids: string[] }>;
  };
}

interface RuntimeGraphOverlay {
  lesson_id?: string;
  focus_node_ids?: string[];
  entry_nodes?: string[];
  summary_nodes?: string[];
  card_order?: string[];
  groups?: Array<{ step_ids: string[]; node_ids: string[] }>;
  nodes?: Array<{ id: string; name: string }>;
}

interface RuntimeLessonDir {
  lessonKey: string;
  lessonDir: string;
}

interface InteractiveCourseRouteIndex {
  baseSegments: ReadonlySet<string>;
  studentSegments: ReadonlySet<string>;
  teacherSegments: ReadonlySet<string>;
}

interface InfographManifest {
  items?: Array<{
    path?: string;
    url?: string;
    title?: string;
    nodeId?: string;
    sourceNodeId?: string;
  }>;
}

interface AuthoringTextbookChapterManifest {
  id?: string;
  number?: number;
  title?: string;
  pipeline?: string;
  textbookPath?: string;
  sourceMarkdown?: string;
  sourcePageStart?: number;
  sourcePageEnd?: number;
  markdownSha256?: string;
  images?: Array<{
    index?: number;
    sourcePath?: string;
    exportPath?: string;
    caption?: string;
    sourcePdfPage?: number;
    sha256?: string;
  }>;
}

async function main() {
  const { materializeCoreSemanticReview } = parseResourceFieldCompletionAuditCliArgs(process.argv.slice(2));
  const materializationManifest = materializeCoreSemanticReview
    ? await loadCoreSemanticMaterializationManifest()
    : null;
  const frozenInput = materializeCoreSemanticReview
    ? await loadFrozenResourceFieldCompletionAudit()
    : null;
  const generatedAt = frozenInput?.summary.generatedAt
    ?? process.env.RESOURCE_FIELD_COMPLETION_GENERATED_AT
    ?? new Date().toISOString();
  const rawCoreSemanticReviewSourceText = materializeCoreSemanticReview
    ? await fs.readFile(CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_SOURCE_JSONL_PATH, 'utf8')
    : null;
  const coreSemanticReviewSources = await loadCoreRegisteredKnowledgeResourceSemanticReviewMap(
    rawCoreSemanticReviewSourceText ?? undefined,
  );
  const runtimeLessonMediaSemanticReviewSources = await loadRuntimeLessonMediaSemanticReviewMap();
  const materializationPhase = frozenInput && materializationManifest && rawCoreSemanticReviewSourceText
    ? assertCoreSemanticMaterializationManifest({
        manifest: materializationManifest,
        rawAuditText: frozenInput.rawAuditText,
        rows: frozenInput.rows,
        summary: frozenInput.summary,
        rawReviewSourceText: rawCoreSemanticReviewSourceText,
      })
    : null;
  let registry: ReturnType<typeof buildResourceNodeRegistryFromTeachingResources> | null = null;
  let result;
  if (frozenInput) {
    const frozenResourceIds = new Set(frozenInput.rows.map((row) => row.resourceId));
    const frozenCourseContentOverlays = buildCourseContentClearanceReviewOverlays(
      (await loadCourseContentClearanceRecords()).map((record) => ({
        ...record,
        reviewed_resources: record.reviewed_resources.filter((reviewed) => (
          frozenResourceIds.has(reviewed.resourceId)
        )),
      })),
      frozenInput.rows,
    );
    result = buildResourceFieldCompletionAuditFromRows({
      sourceRows: frozenInput.rows,
      reviewOverlays: [
        ...coreSemanticFormalReviewOverlaysForRows(frozenInput.rows, coreSemanticReviewSources),
        ...runtimeLessonMediaSemanticFormalReviewOverlaysForRows(
          frozenInput.rows,
          runtimeLessonMediaSemanticReviewSources,
        ),
        ...frozenCourseContentOverlays,
      ],
      requiredReviewResourceIds: uniqueSorted([
        ...frozenInput.rows
          .filter((row) => CORE_SCOPE_FAMILIES.has(row.family))
          .map((row) => row.resourceId),
        ...runtimeLessonMediaSemanticReviewSources.keys(),
        ...frozenCourseContentOverlays.map((overlay) => overlay.resourceId),
      ]),
        generatedAt: frozenInput.summary.generatedAt,
        sourceWindow: frozenInput.summary.sourceWindow,
        versionRefs: frozenInput.summary.versionRefs,
        limitations: frozenInput.summary.limitations,
      });
  } else {
    const [runtimeLessons, runtimeTextbooks, textbookDocuments] = await Promise.all([
      collectRuntimeLessonCatalogEntries(),
      loadAllTextbookRuntimeResourceCatalogEntries().catch(() => []),
      loadAllTextbookRuntimeSearchDocuments().catch(() => []),
    ]);
    registry = buildResourceNodeRegistryFromTeachingResources(
      [],
      getAllRegisteredResourceMetadata(),
      runtimeLessons,
      runtimeTextbooks,
    );
    result = await buildFullResourceFieldCompletionAudit(
      registry,
      textbookDocuments,
      coreSemanticReviewSources,
      runtimeLessonMediaSemanticReviewSources,
      generatedAt,
    );
  }
  const knowledgeVisualSemanticReviewItems = materializeCoreSemanticReview
    ? []
    : Array.from((await loadKnowledgeVisualSemanticReviewMap()).values())
        .sort((left, right) => left.selectedOrder - right.selectedOrder);
  const knowledgeVisualSemanticReviewSummary = materializeCoreSemanticReview
    ? JSON.parse(
        await fs.readFile(KNOWLEDGE_VISUAL_SEMANTIC_REVIEW_SUMMARY_JSON_PATH, 'utf8'),
      ) as KnowledgeVisualSemanticReviewSummary
    : buildKnowledgeVisualSemanticReviewSummary(knowledgeVisualSemanticReviewItems, result.rows);
  const resultRowById = new Map(result.rows.map((row) => [row.resourceId, row]));
  const runtimeSemanticEvidenceById = new Map<string, RuntimeResourceProjectionSemanticEvidence>(
    Array.from(runtimeLessonMediaSemanticReviewSources.values()).map((source) => {
      const row = resultRowById.get(source.resourceId);
      if (!row) throw new Error(`Runtime semantic source has no derived audit row: ${source.resourceId}`);
      let facts = source.runtimeEvidence;
      if (source.reviewState !== 'pending-rereview') {
        try {
          facts = assertRuntimeLessonSemanticReviewEvidence(row, source);
        } catch {
          // The review overlay below marks changed facts stale; retain reviewed evidence only for audit lineage.
        }
      }
      return [source.resourceId, {
        schemaVersion: facts.schemaVersion,
        sourceFilePath: facts.sourceFilePath,
        sourceFileKind: facts.sourceFileKind,
        sourceFileHash: facts.sourceFileHash,
        evidenceFilePath: facts.evidenceFilePath,
        evidenceFileHash: facts.evidenceFileHash,
        evidenceSelector: facts.evidenceSelector,
        assetStatus: facts.assetStatus,
        assetAvailability: facts.assetAvailability,
        externalIdentitySha256: facts.externalIdentitySha256,
      }] as const;
    }),
  );
  const projectionArtifacts = buildRuntimeResourceProjectionArtifacts({
    auditRows: result.rows,
    generatedAt,
    runtimeSemanticEvidenceById,
  });
  const baselineArtifacts = buildLearningGoalResourceBaselineArtifacts({
    registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
    auditRows: result.rows,
    generatedAt,
    sourceWindow: { from: null, to: generatedAt },
  });
  const coreRegisteredKnowledgeResourceSemanticArtifacts = materializeCoreSemanticReview
    ? await loadFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
        frozenRows: frozenInput!.rows,
        reviewSources: coreSemanticReviewSources,
        materializationPhase: materializationPhase!,
      })
    : await buildCoreRegisteredKnowledgeResourceSemanticArtifacts(result.sourceRows);
  const dispositionReviewItems = await buildResidualDispositionReviewItems(result.rows);
  const dispositionReviewSummary = buildResidualDispositionReviewSummary(dispositionReviewItems, result.workqueues);
  const reviewedEvidenceLineage = buildReviewedEvidenceLineageReadiness(
    result.evidenceLineage,
    dispositionReviewItems,
  );
  const workqueueItems = flattenWorkqueueItems(result.workqueues);
  const pathGenerationDiagnostics = materializeCoreSemanticReview
    ? refreshFrozenPathGenerationDiagnostics(
        (await loadFrozenFullResourcePathReadinessGate({
          generatedAt,
          learningGoalIds: baselineArtifacts.matrix.registeredLearningGoalIds,
        })).learningGoalDiagnostics.pathGenerationDiagnostics,
        result.rows,
        baselineArtifacts.reviewedBindings,
      )
    : buildLearningGoalPathGenerationDiagnostics({
        registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
        registry: registry!,
        learningGoalBaselineMatrix: baselineArtifacts.matrix,
        auditRows: result.rows,
        reviewedBindings: baselineArtifacts.reviewedBindings,
        now: new Date(generatedAt),
      });
  const fullResourcePathReadinessGate = buildFullResourcePathReadinessGate({
    generatedAt,
    resourceSummary: result.summary,
    auditRows: result.rows,
    workqueueItems,
    dispositionReviewSummary,
    evidenceLineageSummary: reviewedEvidenceLineage.summary,
    learningGoalBaselineMatrix: baselineArtifacts.matrix,
    reviewedBindings: baselineArtifacts.reviewedBindings,
    pathGenerationDiagnostics,
  });

  const outputFiles: AtomicWriteFile[] = [
    { path: AUDIT_JSONL_PATH, content: `${result.rows.map((row) => JSON.stringify(row)).join('\n')}\n` },
    { path: SUMMARY_JSON_PATH, content: `${JSON.stringify(result.summary, null, 2)}\n` },
    { path: WORKQUEUE_ITEMS_JSONL_PATH, content: `${workqueueItems.map((row) => JSON.stringify(row)).join('\n')}\n` },
    { path: WORKQUEUE_SUMMARY_JSON_PATH, content: `${JSON.stringify(compactWorkqueueSummary(result.workqueues), null, 2)}\n` },
    { path: WORKQUEUE_MARKDOWN_PATH, content: renderWorkqueueMarkdown(result.workqueues, generatedAt) },
    { path: EVIDENCE_LINEAGE_ITEMS_JSONL_PATH, content: `${reviewedEvidenceLineage.items.map((row) => JSON.stringify(row)).join('\n')}\n` },
    { path: EVIDENCE_LINEAGE_SUMMARY_JSON_PATH, content: `${JSON.stringify(reviewedEvidenceLineage.summary, null, 2)}\n` },
    { path: EVIDENCE_LINEAGE_EVIDENCE_MD_PATH, content: renderEvidenceLineageReadinessEvidence(reviewedEvidenceLineage.summary) },
    { path: DISPOSITION_REVIEW_ITEMS_JSONL_PATH, content: `${dispositionReviewItems.map((row) => JSON.stringify(row)).join('\n')}\n` },
    { path: DISPOSITION_REVIEW_SUMMARY_JSON_PATH, content: `${JSON.stringify(dispositionReviewSummary, null, 2)}\n` },
    { path: DISPOSITION_REVIEW_EVIDENCE_MD_PATH, content: renderResidualDispositionReviewEvidence(dispositionReviewSummary) },
    { path: CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_EVIDENCE_MD_PATH, content: renderCoreRegisteredKnowledgeResourceSemanticEvidence(coreRegisteredKnowledgeResourceSemanticArtifacts.summary) },
    { path: HUMAN_REVIEW_INTEGRITY_JSON_PATH, content: `${JSON.stringify(result.integrityDiagnostics, null, 2)}\n` },
    { path: PROJECTION_JSONL_PATH, content: `${projectionArtifacts.rows.map((row) => JSON.stringify(row)).join('\n')}\n` },
    { path: PROJECTION_LIMITATIONS_PATH, content: `${JSON.stringify(projectionArtifacts.limitations, null, 2)}\n` },
    { path: BASELINE_MATRIX_JSON_PATH, content: `${JSON.stringify(baselineArtifacts.matrix, null, 2)}\n` },
    { path: BASELINE_LIMITATIONS_JSON_PATH, content: `${JSON.stringify(baselineArtifacts.limitations, null, 2)}\n` },
    { path: BASELINE_REVIEWED_BINDINGS_JSONL_PATH, content: `${baselineArtifacts.reviewedBindings.map((row) => JSON.stringify(row)).join('\n')}\n` },
    { path: FULL_RESOURCE_PATH_READINESS_GATE_JSON_PATH, content: `${JSON.stringify(fullResourcePathReadinessGate, null, 2)}\n` },
    { path: FULL_RESOURCE_PATH_READINESS_GATE_EVIDENCE_MD_PATH, content: renderFullResourcePathReadinessGateEvidence(fullResourcePathReadinessGate) },
  ];
  if (!materializeCoreSemanticReview) {
    outputFiles.push(
      { path: KNOWLEDGE_VISUAL_SEMANTIC_REVIEW_SUMMARY_JSON_PATH, content: `${JSON.stringify(knowledgeVisualSemanticReviewSummary, null, 2)}\n` },
      { path: KNOWLEDGE_VISUAL_SEMANTIC_REVIEW_EVIDENCE_MD_PATH, content: renderKnowledgeVisualSemanticReviewEvidence(knowledgeVisualSemanticReviewSummary) },
      { path: CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_WORKQUEUE_JSONL_PATH, content: `${coreRegisteredKnowledgeResourceSemanticArtifacts.workqueueItems.map((row) => JSON.stringify(row)).join('\n')}\n` },
      { path: CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_JSONL_PATH, content: `${coreRegisteredKnowledgeResourceSemanticArtifacts.reviewItems.map((row) => JSON.stringify(row)).join('\n')}\n` },
      { path: CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_SUMMARY_JSON_PATH, content: `${JSON.stringify(coreRegisteredKnowledgeResourceSemanticArtifacts.summary, null, 2)}\n` },
    );
  }
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  if (materializeCoreSemanticReview) await atomicWriteFileBatch(outputFiles);
  else for (const file of outputFiles) await fs.writeFile(file.path, file.content, 'utf8');

  console.log(`Resource field completion audit rows: ${result.rows.length}`);
  console.log(`Summary: ${path.relative(process.cwd(), SUMMARY_JSON_PATH)}`);
  console.log(`Resource completion workqueue items: ${result.workqueues.primaryQueueItems + result.workqueues.dependentQueueItems}`);
  console.log(`Workqueue summary: ${path.relative(process.cwd(), WORKQUEUE_SUMMARY_JSON_PATH)}`);
  console.log(`Evidence-lineage blockers: ${reviewedEvidenceLineage.summary.evidenceLineageBlockerCount}`);
  console.log(`Evidence-lineage summary: ${path.relative(process.cwd(), EVIDENCE_LINEAGE_SUMMARY_JSON_PATH)}`);
  console.log(`Residual disposition review rows: ${dispositionReviewItems.length}`);
  console.log(`Knowledge visual semantic shard remaining: ${knowledgeVisualSemanticReviewSummary.remainingSelectedSemanticReview}`);
  console.log(`Knowledge visual semantic shard summary: ${path.relative(process.cwd(), KNOWLEDGE_VISUAL_SEMANTIC_REVIEW_SUMMARY_JSON_PATH)}`);
  console.log(`Core registered/knowledge semantic review rows: ${coreRegisteredKnowledgeResourceSemanticArtifacts.reviewItems.length}`);
  console.log(`Core registered/knowledge semantic summary: ${path.relative(process.cwd(), CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_SUMMARY_JSON_PATH)}`);
  console.log(`Residual disposition summary: ${path.relative(process.cwd(), DISPOSITION_REVIEW_SUMMARY_JSON_PATH)}`);
  console.log(`Human review integrity issues: ${result.integrityDiagnostics.invalidHumanConfirmedRows}`);
  console.log(`Runtime resource projections: ${projectionArtifacts.rows.length}`);
  console.log(`Projection summary: ${path.relative(process.cwd(), PROJECTION_LIMITATIONS_PATH)}`);
  console.log(`LearningGoal baseline matrix: ${path.relative(process.cwd(), BASELINE_MATRIX_JSON_PATH)}`);
  console.log(`LearningGoal baseline limitations: ${path.relative(process.cwd(), BASELINE_LIMITATIONS_JSON_PATH)}`);
  console.log(`LearningGoal baseline reviewed bindings: ${baselineArtifacts.reviewedBindings.length}`);
  console.log(`Full resource path readiness gate: ${fullResourcePathReadinessGate.status}`);
  console.log(`Full resource path readiness summary: ${path.relative(process.cwd(), FULL_RESOURCE_PATH_READINESS_GATE_JSON_PATH)}`);
  if (fullResourcePathReadinessGate.status === 'failed') {
    console.error('Full resource path readiness gate failed; see generated summary and evidence artifacts for blocking findings.');
    process.exitCode = 1;
  }
}

function flattenWorkqueueItems(workqueues: ReturnType<typeof buildResourceFieldCompletionAudit>['workqueues']) {
  return workqueues.queues.flatMap((queue) => queue.items.map((item) => ({
    ...item,
    queueId: queue.id,
    sourceFamily: queue.sourceFamily,
    learningGoalId: queue.learningGoalId,
    graphDomain: queue.graphDomain,
    missingFieldCode: queue.missingFieldCode,
    followupBucket: queue.followupBucket,
    dependencyState: queue.dependencyState,
  })));
}

function compactWorkqueueSummary(workqueues: ReturnType<typeof buildResourceFieldCompletionAudit>['workqueues']) {
  return {
    ...workqueues,
    queues: workqueues.queues.map(({ items, ...queue }) => ({
      ...queue,
      total: items.length,
      itemJsonlPath: path.relative(process.cwd(), WORKQUEUE_ITEMS_JSONL_PATH),
    })),
  };
}

function renderWorkqueueMarkdown(
  workqueues: ReturnType<typeof buildResourceFieldCompletionAudit>['workqueues'],
  generatedAt: string,
): string {
  const lines = [
    '# Resource Completion Workqueues',
    '',
    `Generated at: ${generatedAt}`,
    '',
    `Queued resources: ${workqueues.queuedResources}`,
    `Primary queue items: ${workqueues.primaryQueueItems}`,
    `Dependent queue items: ${workqueues.dependentQueueItems}`,
    '',
    '| Queue | Family | LearningGoal | Graph domain | Missing field | Follow-up bucket | Dependency | Items |',
    '| --- | --- | --- | --- | --- | --- | --- | ---: |',
    ...workqueues.queues.map((queue) => `| ${[
      queue.id,
      queue.sourceFamily,
      queue.learningGoalId,
      queue.graphDomain,
      queue.missingFieldCode,
      queue.followupBucket,
      queue.dependencyState,
      String(queue.total),
    ].join(' | ')} |`),
    '',
    'Item-level rows are stored in `resource-completion-workqueue-items.jsonl` without raw resource content.',
  ];
  return `${lines.join('\n')}\n`;
}

async function buildResidualDispositionReviewItems(rows: ResourceFieldCompletionAuditRow[]): Promise<ResidualDispositionReviewItem[]> {
  const reviewSources = await loadResidualDispositionReviewSources();
  return rows.filter((row) => row.missingFieldCodes.length > 0).map<ResidualDispositionReviewItem>((row) => {
    const reviewSource = reviewSources.get(row.resourceId);
    const classification = reviewSource?.classification ?? residualDispositionClassificationFor(row);
    const downstreamBlockers = downstreamBlockersFor(row.missingFieldCodes);
    const unresolvedDispositionBlocker = isDispositionReviewUnresolved(row, reviewSource);
    return {
      artifactVersion: 'resource-disposition-backlog-review.v1' as const,
      reviewBatchId: reviewSource?.reviewBatchId ?? RESIDUAL_DISPOSITION_REVIEW_BATCH_ID,
      reviewerId: reviewSource?.reviewerId ?? RESIDUAL_DISPOSITION_REVIEWER_ID,
      reviewedAt: reviewSource?.reviewedAt ?? RESIDUAL_DISPOSITION_REVIEWED_AT,
      resourceId: row.resourceId,
      sourceFamily: row.family,
      title: safeDispositionTitle(row.title, row.resourceId),
      sourcePathOrUrl: safeDispositionSourceRef(row.sourcePathOrUrl),
      sourceRecord: row.sourceRecord,
      stableSourceRef: stableSourceRefFor(row),
      classification,
      reviewerVisibleRationale: reviewSource?.reviewerVisibleRationale ??
        residualDispositionRationale(row, classification, downstreamBlockers, unresolvedDispositionBlocker),
      sourceHash: reviewSource?.sourceHash ?? row.sourceHash,
      sourceVersionRef: reviewSource?.sourceVersionRef ?? row.sourceVersionRef,
      originalMissingFieldCodes: row.missingFieldCodes,
      reviewedLimitationState: residualReviewedLimitationState(row, downstreamBlockers, unresolvedDispositionBlocker),
      downstreamBlockers,
      currentPathEligible: classification === 'path-plannable' && row.pathEligibility.current,
      privacyMinimized: true as const,
      rawContentIncluded: false as const,
    };
  }).sort((left, right) => left.resourceId.localeCompare(right.resourceId));
}

async function loadResidualDispositionReviewSources(): Promise<Map<string, ResidualDispositionReviewSource>> {
  const [
    runtimePlanning,
    runtimeMedia,
    coreTextbook,
    referenceTextbook,
    residualTextbookOverview,
    residualAuthoringTextbook,
    residualRuntimeHandout,
    residualKnowledgeInfograph,
    residualKnowledgeCard,
    residualAuthoringTextbookFigure,
    residualAuthoringTextbookCaption,
    residualRuntimeLessonStep,
    residualRuntimeLessonModule,
    residualRuntimeLessonMedia,
    residualRegisteredResource,
    textbookSearchDocumentCitation,
  ] = await Promise.all([
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'runtime-lesson-planning-unit-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'runtime-media-handout-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'core-textbook-section-path-role-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'reference-section-path-role-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-textbook-overview-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-authoring-textbook-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-runtime-handout-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-knowledge-infograph-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-knowledge-card-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-authoring-textbook-figure-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-authoring-textbook-caption-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-runtime-lesson-step-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-runtime-lesson-module-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-runtime-lesson-media-disposition-review-items.jsonl')),
    readJsonlFile<any>(path.join(OUTPUT_DIR, 'residual-registered-resource-disposition-review-items.jsonl')),
    loadTextbookSearchDocumentCitationReviews(),
  ]);
  const sources = new Map<string, ResidualDispositionReviewSource>();
  for (const item of runtimePlanning) {
    sources.set(item.resourceId, {
      classification: item.promotedAsPlanningUnit ? 'path-plannable' : 'supporting-citation',
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? item.runtimeFileHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of runtimeMedia) {
    sources.set(item.resourceId, {
      classification: item.disposition === 'embedded-asset' ? 'embedded-asset' : 'supporting-citation',
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of coreTextbook) {
    sources.set(item.resourceId, {
      classification: item.promotedAsPathNode ? 'path-plannable' : 'supporting-citation',
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? item.citationAddress?.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of referenceTextbook) {
    sources.set(item.resourceId, {
      classification: 'supporting-citation',
      reviewerVisibleRationale: item.reviewerVisibleRationale ?? item.exclusionRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? item.citationAddress?.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualTextbookOverview) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualAuthoringTextbook) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualRuntimeHandout) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualKnowledgeInfograph) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualKnowledgeCard) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualAuthoringTextbookFigure) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualAuthoringTextbookCaption) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualRuntimeLessonStep) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualRuntimeLessonModule) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualRuntimeLessonMedia) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of residualRegisteredResource) {
    sources.set(item.resourceId, {
      classification: item.classification,
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  for (const item of textbookSearchDocumentCitation.values()) {
    sources.set(item.resourceId, {
      classification: residualClassificationForTextbookSearchDocumentCitation(item.classification),
      reviewerVisibleRationale: item.reviewerVisibleRationale,
      reviewerId: item.reviewerId,
      reviewedAt: item.reviewedAt,
      reviewBatchId: item.reviewBatchId,
      sourceHash: item.sourceHash ?? item.citationAddress?.contentHash ?? null,
      sourceVersionRef: item.sourceVersionRef ?? null,
    });
  }
  return sources;
}

async function loadTextbookSearchDocumentCitationReviews(): Promise<Map<string, TextbookSearchDocumentCitationReviewItem>> {
  const rows = await readJsonlFile<TextbookSearchDocumentCitationReviewItem>(
    TEXTBOOK_SEARCH_DOCUMENT_CITATION_REVIEW_ITEMS_JSONL_PATH,
  );
  return new Map(rows.map((row) => [row.resourceId, row]));
}

function residualClassificationForTextbookSearchDocumentCitation(
  classification: TextbookSearchDocumentCitationClassification,
): ResidualDispositionClassification {
  if (classification === 'embedded-asset') return 'embedded-asset';
  if (classification === 'excluded-with-rationale') return 'excluded-with-rationale';
  return 'supporting-citation';
}

function residualDispositionClassificationFor(row: ResourceFieldCompletionAuditRow): ResidualDispositionClassification {
  if (row.pathEligibility.current) return 'path-plannable';
  if (row.family === 'runtime-lesson-media' || row.family === 'authoring-textbook-figure') return 'embedded-asset';
  if (row.family === 'checkpoint' || row.evidenceContract.complete) return 'evidence-producing';
  if (row.groundingEligibility.citationReady) return 'supporting-citation';
  return 'excluded-with-rationale';
}

function downstreamBlockersFor(codes: ResourceFieldMissingCode[]): ResidualDispositionReviewItem['downstreamBlockers'] {
  const buckets: ResidualDispositionReviewItem['downstreamBlockers'] = [];
  const evidenceLineage = codes.filter((code) => (
    code === 'missing-evidence-contract' ||
    code === 'missing-evidence-instrumentation'
  ));
  const runtimeIdentity = codes.filter((code) => (
    code === 'missing-stable-id' ||
    code === 'missing-source-path-or-url' ||
    code === 'missing-content-hash' ||
    code === 'missing-version-ref' ||
    code === 'missing-citation-target' ||
    code === 'missing-segment-ref' ||
    code === 'missing-ai-use-permission'
  ));
  const pathReadiness = codes.filter((code) => (
    code === 'missing-knowledge-binding' ||
    code === 'missing-capability-target' ||
    code === 'missing-quality-target' ||
    code === 'missing-path-target' ||
    code === 'missing-path-profile' ||
    code === 'missing-readiness-gating'
  ));
  const dependency = codes.filter((code) => code === 'blocked-by-dependency');

  if (evidenceLineage.length) buckets.push({ bucket: 'evidence-lineage', codes: uniqueMissingCodes(evidenceLineage) });
  if (runtimeIdentity.length) buckets.push({ bucket: 'runtime-identity', codes: uniqueMissingCodes(runtimeIdentity) });
  if (pathReadiness.length) buckets.push({ bucket: 'path-readiness', codes: uniqueMissingCodes(pathReadiness) });
  if (dependency.length) buckets.push({ bucket: 'dependency', codes: uniqueMissingCodes(dependency) });
  return buckets.length ? buckets : [{ bucket: 'none', codes: [] }];
}

function residualReviewedLimitationState(
  row: ResourceFieldCompletionAuditRow,
  downstreamBlockers: ResidualDispositionReviewItem['downstreamBlockers'],
  unresolvedDispositionBlocker: boolean,
) {
  const states = [
    unresolvedDispositionBlocker ? 'unresolved-residual-disposition-review' : 'residual-disposition-reviewed',
    !unresolvedDispositionBlocker && row.missingFieldCodes.includes('missing-human-review') ? 'semantic-review-closed-by-residual-batch' : '',
    !unresolvedDispositionBlocker && row.missingFieldCodes.includes('provisional-metadata') ? 'provisional-metadata-closed-by-residual-batch' : '',
    ...downstreamBlockers
      .filter((blocker) => blocker.bucket !== 'none')
      .map((blocker) => `downstream-${blocker.bucket}-blocker`),
  ];
  return uniqueSorted(states);
}

function residualDispositionRationale(
  row: ResourceFieldCompletionAuditRow,
  classification: ResidualDispositionClassification,
  downstreamBlockers: ResidualDispositionReviewItem['downstreamBlockers'],
  unresolvedDispositionBlocker: boolean,
) {
  const blockerText = downstreamBlockers
    .filter((blocker) => blocker.bucket !== 'none')
    .map((blocker) => `${blocker.bucket}: ${blocker.codes.join(', ')}`)
    .join('; ') || 'no downstream blocker';
  const sourceRef = row.sourceRecord ?? safeDispositionSourceRef(row.sourcePathOrUrl) ?? row.resourceId;
  if (unresolvedDispositionBlocker) {
    return `${row.resourceId} remains in the residual disposition queue from ${sourceRef}; no independent reviewed disposition source is available yet. Remaining checks are ${blockerText}.`;
  }
  if (classification === 'path-plannable') {
    return `${row.resourceId} is already governed as path-plannable from ${sourceRef}; remaining checks are ${blockerText}.`;
  }
  if (classification === 'embedded-asset') {
    return `${row.resourceId} is an embedded asset under ${sourceRef}; it should remain attached to its parent resource instead of becoming an independent PathNode. Remaining checks are ${blockerText}.`;
  }
  if (classification === 'evidence-producing') {
    return `${row.resourceId} is reviewed as evidence-producing support from ${sourceRef}; remaining checks are ${blockerText}.`;
  }
  if (classification === 'supporting-citation') {
    return `${row.resourceId} is reviewed as supporting citation material from ${sourceRef}; it is accountable for citation or context coverage, not independent path promotion. Remaining checks are ${blockerText}.`;
  }
  return `${row.resourceId} is excluded from direct path promotion with rationale from ${sourceRef}; remaining checks are ${blockerText}.`;
}

function buildResidualDispositionReviewSummary(
  items: ResidualDispositionReviewItem[],
  workqueues: ReturnType<typeof buildResourceFieldCompletionAudit>['workqueues'],
) {
  const downstreamEntries = items.flatMap((item) => item.downstreamBlockers
    .filter((blocker) => blocker.bucket !== 'none')
    .map((blocker) => [blocker.bucket, blocker.codes.length] as const));
  return {
    artifactVersion: 'resource-disposition-backlog-review.v1',
    reviewBatchId: RESIDUAL_DISPOSITION_REVIEW_BATCH_ID,
    reviewerId: RESIDUAL_DISPOSITION_REVIEWER_ID,
    reviewedAt: RESIDUAL_DISPOSITION_REVIEWED_AT,
    totals: {
      reviewedResources: items.length,
      unresolvedDispositionBlockers: countUnresolvedDispositionBlockers(items),
      rawContentIncluded: items.some((item) => item.rawContentIncluded),
      privacyMinimized: items.every((item) => item.privacyMinimized),
    },
    byClassification: countBy(items, (item) => item.classification),
    bySourceFamily: countBy(items, (item) => item.sourceFamily),
    downstreamBlockers: Object.fromEntries(
      Array.from(new Set(downstreamEntries.map(([bucket]) => bucket))).sort()
        .map((bucket) => [bucket, downstreamEntries
          .filter(([entryBucket]) => entryBucket === bucket)
          .reduce((total, [, count]) => total + count, 0)]),
    ),
    evidence: {
      beforeResidualDispositionReview: {
        queuedResources: workqueues.queuedResources,
        primaryQueueItems: workqueues.primaryQueueItems,
        dependentQueueItems: workqueues.dependentQueueItems,
      },
      afterResidualDispositionReview: {
        reviewedResources: items.length,
        unresolvedDispositionBlockers: countUnresolvedDispositionBlockers(items),
      },
      itemJsonlPath: path.relative(process.cwd(), DISPOSITION_REVIEW_ITEMS_JSONL_PATH),
      sourceAuditPath: path.relative(process.cwd(), AUDIT_JSONL_PATH),
      workqueueSummaryPath: path.relative(process.cwd(), WORKQUEUE_SUMMARY_JSON_PATH),
    },
  };
}

function buildReviewedEvidenceLineageReadiness(
  evidenceLineage: ReturnType<typeof buildResourceFieldCompletionAudit>['evidenceLineage'],
  dispositionItems: ResidualDispositionReviewItem[],
): {
  items: ResourceEvidenceLineageReadinessItem[];
  summary: ResourceEvidenceLineageReadinessSummary;
} {
  const dispositionById = new Map(dispositionItems.map((item) => [item.resourceId, item]));
  const items = evidenceLineage.items.map((item) => {
    const disposition = dispositionById.get(item.resourceId);
    if (!disposition || !isReviewedEvidenceLineageLimitation(disposition)) return item;
    const fixtureScope = item.yangFanFixtureScope;
    return {
      ...item,
      evidenceEffectState: 'reviewed-limitation' as const,
      blocksYangFanFixture: fixtureScope === 'fixture-owned',
      yangFanFixtureScope: fixtureScope,
      reviewerVisibleRationale: fixtureScope === 'fixture-owned'
        ? `${item.resourceId} is in the Yang Fan fixture-owned readiness subset and still lacks fixture-required lineage; fixture generation remains blocked until lineage is complete.`
        : `${item.resourceId} has reviewed disposition ${disposition.classification}; evidence effects remain disabled for this resource class, so missing event lineage is recorded as a global resource-backlog limitation rather than a Yang Fan fixture blocker.`,
    };
  });
  return {
    items,
    summary: summarizeReviewedEvidenceLineageReadiness(evidenceLineage.summary, items),
  };
}

function isReviewedEvidenceLineageLimitation(item: ResidualDispositionReviewItem): boolean {
  return (
    item.classification === 'supporting-citation' ||
    item.classification === 'embedded-asset' ||
    item.classification === 'excluded-with-rationale'
  ) &&
    !item.reviewedLimitationState.includes('unresolved-residual-disposition-review') &&
    item.reviewBatchId.length > 0 &&
    item.reviewerId.length > 0 &&
    item.reviewedAt.length > 0 &&
    item.reviewerVisibleRationale.length > 0;
}

function summarizeReviewedEvidenceLineageReadiness(
  baseSummary: ResourceEvidenceLineageReadinessSummary,
  items: ResourceEvidenceLineageReadinessItem[],
): ResourceEvidenceLineageReadinessSummary {
  const blockerItems = items.filter((item) => item.evidenceEffectState === 'blocked');
  const reviewedLimitationItems = items.filter((item) => item.evidenceEffectState === 'reviewed-limitation');
  const yangFanFixtureBlockers = items.filter((item) => item.blocksYangFanFixture);
  const globalYangFanLimitations = items.filter((item) => !item.blocksYangFanFixture);
  return {
    ...baseSummary,
    layerTotals: {
      ...baseSummary.layerTotals,
      evidenceLineageBlockers: blockerItems.length,
      reviewedLimitations: reviewedLimitationItems.length,
    },
    findingCounts: countBy(items.flatMap((item) => item.missingFieldCodes), (code) => code),
    contractFieldGaps: countBy(items.flatMap((item) => item.missingContractFields), (field) => field),
    followupBuckets: countBy(items, (item) => item.followupBucket),
    evidenceLineageBlockerCount: blockerItems.length,
    yangFanFixtureBlockers: {
      blocked: yangFanFixtureBlockers.length > 0,
      blockerCount: yangFanFixtureBlockers.length,
      scopedBlockerCount: yangFanFixtureBlockers.length,
      globalLimitationCount: globalYangFanLimitations.length,
      blockerFamilies: countBy(yangFanFixtureBlockers, (item) => item.sourceFamily),
      reason: yangFanFixtureBlockers.length > 0
        ? 'Canonical learner fixture generation remains blocked until fixture-owned evidence lineage gaps are resolved.'
        : globalYangFanLimitations.length > 0
          ? 'Canonical learner fixture generation has scoped resource readiness; unrelated global resource backlog remains a limited-coverage diagnostic.'
          : 'Canonical learner fixture generation has no remaining resource evidence-lineage blockers from the helper layer.',
      scopePolicy: YANGFAN_FIXTURE_READINESS_SCOPE_POLICY_VERSION,
    },
  };
}

function renderResidualDispositionReviewEvidence(summary: ReturnType<typeof buildResidualDispositionReviewSummary>) {
  const lines = [
    '# Residual Resource Disposition Review Evidence',
    '',
    `Review batch: ${summary.reviewBatchId}`,
    `Reviewer: ${summary.reviewerId}`,
    `Reviewed at: ${summary.reviewedAt}`,
    '',
    `Reviewed resources: ${summary.totals.reviewedResources}`,
    `Unresolved disposition blockers: ${summary.totals.unresolvedDispositionBlockers}`,
    `Privacy minimized: ${summary.totals.privacyMinimized}`,
    `Raw content included: ${summary.totals.rawContentIncluded}`,
    '',
    '## Before / After Helper Output',
    '',
    `Before queued resources: ${summary.evidence.beforeResidualDispositionReview.queuedResources}`,
    `Before primary queue items: ${summary.evidence.beforeResidualDispositionReview.primaryQueueItems}`,
    `Before dependent queue items: ${summary.evidence.beforeResidualDispositionReview.dependentQueueItems}`,
    `After reviewed resources: ${summary.evidence.afterResidualDispositionReview.reviewedResources}`,
    `After unresolved disposition blockers: ${summary.evidence.afterResidualDispositionReview.unresolvedDispositionBlockers}`,
    '',
    '## Classifications',
    '',
    ...Object.entries(summary.byClassification)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([classification, count]) => `- ${classification}: ${count}`),
    '',
    '## Downstream Blockers',
    '',
    ...Object.entries(summary.downstreamBlockers)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bucket, count]) => `- ${bucket}: ${count}`),
    '',
    'The residual disposition batch records reviewed classifications where an independent review source exists and preserves unresolved residual disposition rows where that source is still missing. Remaining non-disposition blockers are retained as downstream evidence-lineage, runtime-identity, path-readiness, or dependency work.',
  ];
  return `${lines.join('\n')}\n`;
}

function renderEvidenceLineageReadinessEvidence(summary: ResourceEvidenceLineageReadinessSummary) {
  const lines = [
    '# Resource Evidence-Lineage Readiness Evidence',
    '',
    `Artifact version: ${summary.artifactVersion}`,
    `Source audit rows: ${summary.layerTotals.auditRows}`,
    `Path-relevant rows: ${summary.layerTotals.pathRelevantRows}`,
    `Evidence-producing rows: ${summary.layerTotals.evidenceProducingRows}`,
    `Evidence-lineage blockers: ${summary.evidenceLineageBlockerCount}`,
    `Reviewed limitations: ${summary.layerTotals.reviewedLimitations}`,
    `Ready rows: ${summary.layerTotals.readyRows}`,
    '',
    '## Finding Counts',
    '',
    ...Object.entries(summary.findingCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `- ${code}: ${count}`),
    '',
    '## Contract Field Gaps',
    '',
    ...Object.entries(summary.contractFieldGaps)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([field, count]) => `- ${field}: ${count}`),
    '',
    '## Follow-up Buckets',
    '',
    ...Object.entries(summary.followupBuckets)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bucket, count]) => `- ${bucket}: ${count}`),
    '',
    '## Yang Fan Fixture Precondition',
    '',
    `Blocked: ${summary.yangFanFixtureBlockers.blocked}`,
    `Blocker count: ${summary.yangFanFixtureBlockers.blockerCount}`,
    `Scoped blocker count: ${summary.yangFanFixtureBlockers.scopedBlockerCount}`,
    `Global limitation count: ${summary.yangFanFixtureBlockers.globalLimitationCount}`,
    `Scope policy: ${summary.yangFanFixtureBlockers.scopePolicy}`,
    `Reason: ${summary.yangFanFixtureBlockers.reason}`,
    '',
    '## Evidence Files',
    '',
    `Source audit: ${summary.evidence.sourceAuditPath}`,
    `Item JSONL: ${summary.evidence.itemJsonlPath}`,
    '',
    'This evidence layer is privacy-minimized and records only lineage readiness, follow-up grouping, and fixture precondition blockers. Raw learner payloads and raw resource bodies are not included.',
  ];
  return `${lines.join('\n')}\n`;
}

function safeDispositionTitle(title: string, fallback: string) {
  const normalized = String(title || fallback).replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120 && !/Image description/i.test(normalized)) return normalized;
  return fallback;
}

function isDispositionReviewUnresolved(
  row: ResourceFieldCompletionAuditRow,
  reviewSource: ResidualDispositionReviewSource | undefined,
) {
  if (
    reviewSource?.reviewBatchId &&
    reviewSource.reviewerId &&
    reviewSource.reviewedAt &&
    reviewSource.reviewerVisibleRationale
  ) {
    return false;
  }
  return row.reviewStatus !== 'human-confirmed' ||
    row.missingFieldCodes.some((code) => code === 'missing-human-review' || code === 'provisional-metadata') ||
    row.pathEligibility.blockedBy.some((code) => code === 'missing-human-review' || code === 'provisional-metadata');
}

function countUnresolvedDispositionBlockers(items: ResidualDispositionReviewItem[]) {
  return items.filter((item) => (
    !item.classification ||
    !item.reviewerVisibleRationale ||
    !item.stableSourceRef ||
    !item.reviewBatchId ||
    !item.reviewerId ||
    !item.reviewedAt ||
    item.reviewedLimitationState.includes('unresolved-residual-disposition-review')
  )).length;
}

function stableSourceRefFor(row: ResourceFieldCompletionAuditRow) {
  return [
    row.family,
    safeDispositionSourceRef(row.sourcePathOrUrl) ?? 'no-source-path',
    row.sourceRecord ?? 'no-source-record',
    row.resourceId,
    row.sourceHash ?? 'no-source-hash',
  ].join('|');
}

function safeDispositionSourceRef(sourcePathOrUrl: string | null) {
  if (!sourcePathOrUrl) return sourcePathOrUrl;
  if (!/^https?:\/\//i.test(sourcePathOrUrl)) return sourcePathOrUrl;
  try {
    const url = new URL(sourcePathOrUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '[external-url-redacted]';
  }
}

function uniqueMissingCodes(codes: ResourceFieldMissingCode[]) {
  return Array.from(new Set(codes)).sort((left, right) => left.localeCompare(right));
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function countBy<T>(values: T[], keyFor: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

async function loadKnowledgeVisualSemanticReviewMap(): Promise<Map<string, KnowledgeVisualSemanticReviewItem>> {
  const items = await readJsonlFile<KnowledgeVisualSemanticReviewItem>(KNOWLEDGE_VISUAL_SEMANTIC_REVIEW_ITEMS_JSONL_PATH);
  return new Map(items.map((item) => [item.resourceId, item]));
}

function knowledgeVisualReviewPacketHash(item: KnowledgeVisualSemanticReviewItem) {
  return `sha256:${sha256(JSON.stringify({
    resourceId: item.resourceId,
    sourceHash: item.sourceHash,
    graphNodeIds: item.graphNodeIds,
    learningGoalIds: item.learningGoalIds,
    knowledgeObjectiveIds: item.knowledgeObjectiveIds,
    capabilityObjectiveIds: item.capabilityObjectiveIds,
    qualityObjectiveIds: item.qualityObjectiveIds,
    disposition: item.disposition,
    citationTargets: item.citationTargets,
    limitationState: item.limitationState,
    rationale: item.reviewerVisibleRationale,
  }))}`;
}

function applyKnowledgeVisualSemanticReview(
  candidate: ResourceFieldCompletionCandidate,
  reviewItem: KnowledgeVisualSemanticReviewItem | undefined,
): ResourceFieldCompletionCandidate {
  if (!reviewItem) return candidate;
  return {
    ...candidate,
    sourcePathOrUrl: reviewItem.sourcePathOrUrl,
    sourceRecord: reviewItem.sourceRecord,
    knowledgeNodeIds: reviewItem.graphNodeIds,
    capabilityTargetIds: reviewItem.capabilityObjectiveIds,
    qualityTargetIds: reviewItem.qualityObjectiveIds,
    segmentRefs: reviewItem.segmentRefs,
    citationTargets: reviewItem.citationTargets,
    pathTarget: reviewItem.routeTarget,
    estimatedTimeMinutes: reviewItem.estimatedTimeMinutes,
    evidenceInstrumentation: reviewItem.evidenceInstrumentation,
    privacyScope: reviewItem.privacyScope,
    humanConfirmed: true,
    currentPathEligible: reviewItem.currentPathEligible,
    contentHash: candidate.contentHash,
    versionRef: candidate.versionRef,
    reviewEvidence: {
      reviewerId: reviewItem.reviewerId,
      reviewerRole: reviewItem.reviewerRole,
      reviewedAt: reviewItem.reviewedAt,
      reviewBatchId: reviewItem.reviewBatchId,
      reviewerVisibleRationale: reviewItem.reviewerVisibleRationale,
      independentEvidenceRef: reviewItem.independentEvidenceRef,
      reviewedSourceHash: reviewItem.sourceHash,
      reviewedVersionRef: reviewItem.sourceVersionRef,
      promptOrManifestHash: knowledgeVisualReviewPacketHash(reviewItem),
      confidence: 0.92,
    },
  };
}

function buildKnowledgeVisualSemanticReviewSummary(
  reviewItems: KnowledgeVisualSemanticReviewItem[],
  auditRows: ResourceFieldCompletionAuditRow[],
): KnowledgeVisualSemanticReviewSummary {
  const selectedIds = new Set(reviewItems.map((item) => item.resourceId));
  const selectedRows = auditRows.filter((row) => selectedIds.has(row.resourceId));
  const remainingSelectedSemanticReview = selectedRows.filter((row) => (
    row.reviewStatus !== 'human-confirmed' ||
    row.missingFieldCodes.includes('missing-human-review') ||
    row.missingFieldCodes.includes('provisional-metadata') ||
    row.missingFieldCodes.includes('stale-review')
  )).length;
  const residualUnselectedCounts = {
    'knowledge-card': auditRows.filter((row) => (
      row.family === 'knowledge-card' &&
      !selectedIds.has(row.resourceId) &&
      (row.missingFieldCodes.includes('missing-human-review') || row.missingFieldCodes.includes('provisional-metadata'))
    )).length,
    'knowledge-infograph': auditRows.filter((row) => (
      row.family === 'knowledge-infograph' &&
      !selectedIds.has(row.resourceId) &&
      (row.missingFieldCodes.includes('missing-human-review') || row.missingFieldCodes.includes('provisional-metadata'))
    )).length,
  };

  return {
    artifactVersion: 'knowledge-visual-semantic-shard-review.v1',
    reviewBatchId: reviewItems[0]?.reviewBatchId ?? 'knowledge-visual-semantic-shard-review-unknown',
    selectedCount: reviewItems.length,
    selectedResourceIds: reviewItems
      .slice()
      .sort((left, right) => left.selectedOrder - right.selectedOrder)
      .map((item) => item.resourceId),
    selectedBlockerCodes: uniqueMissingCodes(reviewItems.flatMap((item) => item.originalBlockerCodes)),
    remainingSelectedSemanticReview,
    residualUnselectedCounts,
    byDisposition: countBy(reviewItems, (item) => item.disposition),
    evidence: {
      reviewItemsPath: path.relative(process.cwd(), KNOWLEDGE_VISUAL_SEMANTIC_REVIEW_ITEMS_JSONL_PATH),
      auditJsonlPath: path.relative(process.cwd(), AUDIT_JSONL_PATH),
      workqueueItemsPath: path.relative(process.cwd(), WORKQUEUE_ITEMS_JSONL_PATH),
    },
  };
}

function renderKnowledgeVisualSemanticReviewEvidence(summary: KnowledgeVisualSemanticReviewSummary) {
  const lines = [
    '# Knowledge Visual Semantic Shard Review',
    '',
    `Review batch: ${summary.reviewBatchId}`,
    `Selected resources: ${summary.selectedCount}`,
    `Remaining selected semantic review blockers: ${summary.remainingSelectedSemanticReview}`,
    '',
    '## Selected Resources',
    '',
    ...summary.selectedResourceIds.map((resourceId) => `- ${resourceId}`),
    '',
    '## Residual Unselected Counts',
    '',
    `- knowledge-card: ${summary.residualUnselectedCounts['knowledge-card']}`,
    `- knowledge-infograph: ${summary.residualUnselectedCounts['knowledge-infograph']}`,
    '',
    '## Evidence Files',
    '',
    `Review items: ${summary.evidence.reviewItemsPath}`,
    `Audit JSONL: ${summary.evidence.auditJsonlPath}`,
    `Workqueue JSONL: ${summary.evidence.workqueueItemsPath}`,
    '',
    'The selected shard is bounded. Remaining unselected rows are reported as residual backlog and are not completion blockers for this change.',
  ];
  return `${lines.join('\n')}\n`;
}

async function loadFrozenResourceFieldCompletionAudit(): Promise<{
  rawAuditText: string;
  rows: ResourceFieldCompletionAuditRow[];
  summary: ResourceFieldCompletionAuditSummary;
}> {
  const [rawAuditText, summaryText] = await Promise.all([
    fs.readFile(AUDIT_JSONL_PATH, 'utf8'),
    fs.readFile(SUMMARY_JSON_PATH, 'utf8'),
  ]);
  const rows = rawAuditText.split(/\r?\n/).filter(Boolean).map((line) => (
    JSON.parse(line) as ResourceFieldCompletionAuditRow
  ));
  const summary = JSON.parse(summaryText) as ResourceFieldCompletionAuditSummary;
  if (summary.artifactVersion !== RESOURCE_FIELD_COMPLETION_AUDIT_VERSION) {
    throw new Error(`Frozen resource field completion summary version mismatch: ${summary.artifactVersion}`);
  }
  if (summary.totals.denominator !== rows.length) {
    throw new Error(
      `Frozen resource field completion denominator mismatch: summary=${summary.totals.denominator}, rows=${rows.length}`,
    );
  }
  if (summary.sourceWindow.to !== summary.generatedAt) {
    throw new Error('Frozen resource field completion summary source window does not match generatedAt');
  }
  return { rawAuditText, rows, summary };
}

function coreSemanticSummaryMetadataSha256(summary: ResourceFieldCompletionAuditSummary) {
  return `sha256:${sha256(JSON.stringify({
    generatedAt: summary.generatedAt,
    sourceWindow: summary.sourceWindow,
    versionRefs: summary.versionRefs,
    limitations: summary.limitations,
  }))}`;
}

function coreSemanticNonScopeRowsCanonicalSha256(rows: readonly ResourceFieldCompletionAuditRow[]) {
  const nonScopeRows = rows
    .filter((row) => !CORE_SCOPE_FAMILIES.has(row.family) && !RUNTIME_LESSON_MEDIA_SEMANTIC_SCOPE_FAMILIES.has(row.family))
    .slice()
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  return `sha256:${sha256(JSON.stringify(nonScopeRows))}`;
}

function semanticScopeRowsInvariantCanonicalSha256(
  rows: readonly ResourceFieldCompletionAuditRow[],
  scopeFamilies: ReadonlySet<ResourceFieldCompletionFamily>,
) {
  const invariantRows = rows
    .filter((row) => scopeFamilies.has(row.family))
    .slice()
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId))
    .map(({
      missingFieldCodes,
      reviewStatus: _reviewStatus,
      reviewAudit: _reviewAudit,
      pathTarget: _pathTarget,
      pathEligibility: _pathEligibility,
      coverage,
      ...invariant
    }) => ({
      ...invariant,
      missingFieldCodes: missingFieldCodes
        .filter((code) => !CORE_REVIEW_ONLY_BLOCKER_CODES.has(code))
        .slice()
        .sort((left, right) => left.localeCompare(right)),
      coverage: {
        denominatorKey: coverage.denominatorKey,
        sourceWindow: coverage.sourceWindow,
        artifactVersion: coverage.artifactVersion,
      },
    }));
  return `sha256:${sha256(JSON.stringify(invariantRows))}`;
}

function coreSemanticScopeRowsInvariantCanonicalSha256(rows: readonly ResourceFieldCompletionAuditRow[]) {
  return semanticScopeRowsInvariantCanonicalSha256(rows, CORE_SCOPE_FAMILIES);
}

export function runtimeSemanticScopeRowsInvariantCanonicalSha256(rows: readonly ResourceFieldCompletionAuditRow[]) {
  return semanticScopeRowsInvariantCanonicalSha256(rows, RUNTIME_LESSON_MEDIA_SEMANTIC_SCOPE_FAMILIES);
}

export function buildCoreSemanticMaterializationManifest(input: {
  legacyAuditSha256: string;
  rawAuditText: string;
  rows: readonly ResourceFieldCompletionAuditRow[];
  summary: ResourceFieldCompletionAuditSummary;
  rawReviewSourceText: string;
}): CoreRegisteredKnowledgeResourceSemanticMaterializationManifest {
  const scopeRows = input.rows.filter((row) => CORE_SCOPE_FAMILIES.has(row.family)).length;
  const runtimeScopeRows = input.rows.filter((row) => RUNTIME_LESSON_MEDIA_SEMANTIC_SCOPE_FAMILIES.has(row.family)).length;
  return {
    artifactVersion: 'core-registered-knowledge-resource-semantic-materialization-manifest.v1',
    legacyAuditSha256: input.legacyAuditSha256,
    legacySummaryMetadataSha256: coreSemanticSummaryMetadataSha256(input.summary),
    nonScopeRowsCanonicalSha256: coreSemanticNonScopeRowsCanonicalSha256(input.rows),
    scopeRowsInvariantCanonicalSha256: coreSemanticScopeRowsInvariantCanonicalSha256(input.rows),
    runtimeScopeRowsInvariantCanonicalSha256: runtimeSemanticScopeRowsInvariantCanonicalSha256(input.rows),
    reviewSourceFileSha256: `sha256:${sha256(input.rawReviewSourceText)}`,
    denominator: input.rows.length,
    scopeRows,
    runtimeScopeRows,
    nonScopeRows: input.rows.length - scopeRows - runtimeScopeRows,
  };
}

export function assertCoreSemanticMaterializationManifest(input: {
  manifest: CoreRegisteredKnowledgeResourceSemanticMaterializationManifest;
  rawAuditText: string;
  rows: readonly ResourceFieldCompletionAuditRow[];
  summary: ResourceFieldCompletionAuditSummary;
  rawReviewSourceText: string;
}): CoreSemanticMaterializationPhase {
  const { manifest } = input;
  if (
    manifest.artifactVersion !== 'core-registered-knowledge-resource-semantic-materialization-manifest.v1' ||
    manifest.denominator !== 5559 ||
    manifest.scopeRows !== 624 ||
    manifest.nonScopeRows !== 2135 ||
    manifest.runtimeScopeRows !== 2800
  ) {
    throw new Error('Invalid core semantic materialization manifest contract');
  }
  const scopeRows = input.rows.filter((row) => CORE_SCOPE_FAMILIES.has(row.family)).length;
  const runtimeScopeRows = input.rows.filter((row) => RUNTIME_LESSON_MEDIA_SEMANTIC_SCOPE_FAMILIES.has(row.family)).length;
  if (
    input.rows.length !== manifest.denominator ||
    scopeRows !== manifest.scopeRows ||
    runtimeScopeRows !== manifest.runtimeScopeRows ||
    input.rows.length - scopeRows - runtimeScopeRows !== manifest.nonScopeRows
  ) {
    throw new Error('Core semantic materialization manifest denominator mismatch');
  }
  if (coreSemanticSummaryMetadataSha256(input.summary) !== manifest.legacySummaryMetadataSha256) {
    throw new Error('Core semantic materialization stable summary metadata mismatch');
  }
  if (coreSemanticNonScopeRowsCanonicalSha256(input.rows) !== manifest.nonScopeRowsCanonicalSha256) {
    throw new Error('Core semantic materialization non-scope rows mismatch');
  }
  if (coreSemanticScopeRowsInvariantCanonicalSha256(input.rows) !== manifest.scopeRowsInvariantCanonicalSha256) {
    throw new Error('Core semantic materialization scope invariant rows mismatch');
  }
  if (runtimeSemanticScopeRowsInvariantCanonicalSha256(input.rows) !== manifest.runtimeScopeRowsInvariantCanonicalSha256) {
    throw new Error('Runtime semantic materialization scope invariant rows mismatch');
  }
  if (`sha256:${sha256(input.rawReviewSourceText)}` !== manifest.reviewSourceFileSha256) {
    throw new Error('Core semantic materialization review source hash mismatch');
  }
  return `sha256:${sha256(input.rawAuditText)}` === manifest.legacyAuditSha256
    ? 'legacy'
    : 'materialized';
}

async function loadCoreSemanticMaterializationManifest() {
  return JSON.parse(
    await fs.readFile(CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_MATERIALIZATION_MANIFEST_PATH, 'utf8'),
  ) as CoreRegisteredKnowledgeResourceSemanticMaterializationManifest;
}

async function loadFrozenFullResourcePathReadinessGate(input: {
  generatedAt: string;
  learningGoalIds: readonly string[];
}): Promise<FullResourcePathReadinessGateReport> {
  const report = JSON.parse(
    await fs.readFile(FULL_RESOURCE_PATH_READINESS_GATE_JSON_PATH, 'utf8'),
  ) as FullResourcePathReadinessGateReport;
  if (report.artifactVersion !== FULL_RESOURCE_PATH_READINESS_GATE_VERSION) {
    throw new Error(`Frozen full resource path readiness gate version mismatch: ${report.artifactVersion}`);
  }
  if (report.generatedAt !== input.generatedAt) {
    throw new Error(
      `Frozen full resource path readiness gate generatedAt mismatch: gate=${report.generatedAt}, audit=${input.generatedAt}`,
    );
  }
  const diagnosticIds = report.learningGoalDiagnostics.pathGenerationDiagnostics
    .map((diagnostic) => diagnostic.learningGoalId);
  const expectedIds = uniqueSorted([...input.learningGoalIds]);
  if (
    diagnosticIds.length !== new Set(diagnosticIds).size ||
    !arraysEqual(uniqueSorted(diagnosticIds), expectedIds)
  ) {
    throw new Error('Frozen full resource path readiness gate LearningGoal diagnostic set mismatch');
  }
  return report;
}

export function refreshFrozenPathGenerationDiagnostics(
  diagnostics: readonly LearningGoalPathGenerationDiagnostic[],
  auditRows: readonly ResourceFieldCompletionAuditRow[],
  reviewedBindings: readonly Pick<
    LearningGoalResourceBaselineReviewedBinding,
    'resourceId' | 'sourcePathOrUrl' | 'sourceHash' | 'sourceVersionRef'
  >[],
): LearningGoalPathGenerationDiagnostic[] {
  const reviewedAuditById = new Map(auditRows
    .filter((row) => (
      row.reviewStatus === 'human-confirmed' &&
      row.pathEligibility.afterCompletion &&
      row.pathEligibility.blockedBy.length === 0
    ))
    .map((row) => [row.resourceId, row]));
  const reviewedBindingById = new Map(reviewedBindings.map((binding) => [binding.resourceId, binding]));
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    unreviewedSelectedResourceIds: diagnostic.selectedResourceIds.filter((resourceId) => (
      !reviewedAuditById.has(resourceId) && !reviewedBindingById.has(resourceId)
    )),
    missingCitationMetadataResourceIds: diagnostic.selectedResourceIds.filter((resourceId) => {
      const row = reviewedAuditById.get(resourceId);
      if (row) return !row.sourcePathOrUrl || !row.sourceHash || !row.sourceVersionRef;
      const binding = reviewedBindingById.get(resourceId);
      return !binding?.sourcePathOrUrl || !binding.sourceHash || !binding.sourceVersionRef;
    }),
  }));
}

async function buildFullResourceFieldCompletionAudit(
  registry: Parameters<typeof buildResourceFieldCompletionAudit>[0]['registry'],
  textbookDocuments: Awaited<ReturnType<typeof loadAllTextbookRuntimeSearchDocuments>>,
  coreSemanticReviewSources: Map<string, CoreRegisteredKnowledgeResourceSemanticReviewSource>,
  runtimeLessonMediaSemanticReviewSources: Map<string, RuntimeLessonMediaSemanticReviewSource>,
  generatedAt: string,
) {
  const { candidates, limitations } = await collectAuditOnlyCandidates(textbookDocuments);
  const sourceResult = buildResourceFieldCompletionAudit({
    registry,
    candidates,
    generatedAt,
    sourceWindow: { from: null, to: generatedAt },
    limitations,
  });
  const courseContentClearanceRecords = await loadCourseContentClearanceRecords();
  const contentClearanceResourceIds = new Set(courseContentClearanceRecords.flatMap((record) => (
    record.reviewed_resources.map((reviewed) => reviewed.resourceId)
  )));
  const contentClearedLessonIds = new Set(courseContentClearanceRecords.map((record) => record.lesson_id));
  const sourceRows = sourceResult.sourceRows.filter((row) => {
    if (!RUNTIME_LESSON_MEDIA_SEMANTIC_SCOPE_FAMILIES.has(row.family)) return true;
    if (runtimeLessonMediaSemanticReviewSources.has(row.resourceId)) return true;
    if (contentClearanceResourceIds.has(row.resourceId)) return true;
    const lessonId = row.resourceId.split(':')[1];
    return (
      (row.family === 'runtime-lesson-step' || row.family === 'runtime-lesson-module')
      && contentClearedLessonIds.has(lessonId)
    );
  });
  const coreOverlays = sourceRows
    .filter((row) => CORE_SCOPE_FAMILIES.has(row.family) && coreSemanticReviewSources.has(row.resourceId))
    .map((row) => coreSemanticFormalReviewOverlayFromSource(coreSemanticReviewSources.get(row.resourceId)!));
  const runtimeOverlays = runtimeLessonMediaSemanticFormalReviewOverlaysForRows(
    sourceRows,
    runtimeLessonMediaSemanticReviewSources,
  );
  const courseOverlays = buildCourseContentClearanceReviewOverlays(
    courseContentClearanceRecords,
    sourceRows,
  );
  const versionRefs = sourceRows[0]?.versionRefs;
  if (!versionRefs) throw new Error('Runtime resource semantic source audit produced no version refs');
  return buildResourceFieldCompletionAuditFromRows({
    sourceRows,
    reviewOverlays: [...coreOverlays, ...runtimeOverlays, ...courseOverlays],
    requiredReviewResourceIds: [
      ...coreOverlays.map((overlay) => overlay.resourceId),
      ...runtimeLessonMediaSemanticReviewSources.keys(),
      ...courseOverlays.map((overlay) => overlay.resourceId),
    ],
    generatedAt,
    sourceWindow: { from: null, to: generatedAt },
    versionRefs,
    limitations,
  });
}

async function loadFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts(input: {
  frozenRows: readonly ResourceFieldCompletionAuditRow[];
  reviewSources: ReadonlyMap<string, CoreRegisteredKnowledgeResourceSemanticReviewSource>;
  materializationPhase: CoreSemanticMaterializationPhase;
}): Promise<{
  workqueueItems: CoreRegisteredKnowledgeResourceSemanticWorkqueueItem[];
  reviewItems: CoreRegisteredKnowledgeResourceSemanticReviewItem[];
  summary: CoreRegisteredKnowledgeResourceSemanticSummary;
}> {
  const [workqueueItems, reviewItems, summaryText] = await Promise.all([
    readJsonlFile<CoreRegisteredKnowledgeResourceSemanticWorkqueueItem>(
      CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_WORKQUEUE_JSONL_PATH,
    ),
    readJsonlFile<CoreRegisteredKnowledgeResourceSemanticReviewItem>(
      CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_JSONL_PATH,
    ),
    fs.readFile(CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_SUMMARY_JSON_PATH, 'utf8'),
  ]);
  const artifacts = {
    workqueueItems,
    reviewItems,
    summary: JSON.parse(summaryText) as CoreRegisteredKnowledgeResourceSemanticSummary,
  };
  assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts({
    ...input,
    ...artifacts,
  });
  return artifacts;
}

export function assertFrozenCoreRegisteredKnowledgeResourceSemanticArtifacts(input: {
  frozenRows: readonly ResourceFieldCompletionAuditRow[];
  reviewSources: ReadonlyMap<string, CoreRegisteredKnowledgeResourceSemanticReviewSource>;
  materializationPhase: CoreSemanticMaterializationPhase;
  workqueueItems: readonly CoreRegisteredKnowledgeResourceSemanticWorkqueueItem[];
  reviewItems: readonly CoreRegisteredKnowledgeResourceSemanticReviewItem[];
  summary: CoreRegisteredKnowledgeResourceSemanticSummary;
}) {
  const scopedRows = input.frozenRows.filter((row) => CORE_SCOPE_FAMILIES.has(row.family));
  const reviewedScopedRows = scopedRows.filter((row) => input.reviewSources.has(row.resourceId));
  const expectedScopeCount = 624;
  const counts = {
    frozenScope: scopedRows.length,
    workqueueItems: input.workqueueItems.length,
    summaryScope: input.summary.totals.scopedResources,
    summaryWorkqueue: input.summary.totals.workqueueItems,
  };
  for (const [name, count] of Object.entries(counts)) {
    if (count !== expectedScopeCount) {
      throw new Error(`Frozen core semantic ${name} must contain ${expectedScopeCount} rows, found ${count}`);
    }
  }
  if (
    input.reviewItems.length !== reviewedScopedRows.length ||
    input.summary.totals.reviewedResources !== reviewedScopedRows.length
  ) {
    throw new Error(`Frozen core semantic reviewed subset must contain ${reviewedScopedRows.length} rows`);
  }

  const indexUnique = <T extends { resourceId: string }>(rows: readonly T[], label: string) => {
    const byId = new Map<string, T>();
    for (const row of rows) {
      if (byId.has(row.resourceId)) throw new Error(`Duplicate frozen core semantic ${label}: ${row.resourceId}`);
      byId.set(row.resourceId, row);
    }
    return byId;
  };
  const frozenById = indexUnique(scopedRows, 'audit row');
  const workqueueById = indexUnique(input.workqueueItems, 'workqueue item');
  const reviewById = indexUnique(input.reviewItems, 'review item');
  const expectedIds = [...frozenById.keys()].sort((left, right) => left.localeCompare(right));
  if (!arraysEqual(expectedIds, [...workqueueById.keys()].sort((left, right) => left.localeCompare(right)))) {
    throw new Error('Frozen core semantic workqueue id set mismatch');
  }
  const expectedReviewedIds = reviewedScopedRows.map((row) => row.resourceId)
    .sort((left, right) => left.localeCompare(right));
  if (!arraysEqual(expectedReviewedIds, [...reviewById.keys()].sort((left, right) => left.localeCompare(right)))) {
    throw new Error('Frozen core semantic review item id set mismatch');
  }

  const expectedWorkqueueItems: CoreRegisteredKnowledgeResourceSemanticWorkqueueItem[] = [];
  const expectedReviewItems: CoreRegisteredKnowledgeResourceSemanticReviewItem[] = [];
  for (const [index, resourceId] of expectedIds.entries()) {
    const row = frozenById.get(resourceId)!;
    const source = input.reviewSources.get(resourceId);
    const workqueue = workqueueById.get(resourceId)!;
    if (source) assertCoreSemanticReviewSourceMatchesRow(row, source);
    if (input.materializationPhase === 'materialized' && source) {
      const expectedFormalBlockers = workqueue.startingBlockerCodes.filter((code) => (
        !CORE_REVIEW_ONLY_BLOCKER_CODES.has(code)
      ));
      if (!arraysEqual(row.missingFieldCodes, expectedFormalBlockers)) {
        throw new Error(`Frozen core semantic formal blocker projection mismatch for ${resourceId}`);
      }
      const expectedOverlay = coreSemanticFormalReviewOverlayFromSource(source);
      const expectedFormalRow = applyResourceFieldCompletionReviewOverlays(
        [{ ...row, missingFieldCodes: [...workqueue.startingBlockerCodes] }],
        [expectedOverlay],
      )[0];
      if (!isDeepStrictEqual(row, expectedFormalRow)) {
        throw new Error(`Frozen core semantic formal row mismatch for ${resourceId}`);
      }
    }
    const expectedWorkqueue = coreSemanticWorkqueueItemFromRow(
      row,
      index + 1,
      workqueue.startingBlockerCodes,
    );
    expectedWorkqueueItems.push(expectedWorkqueue);
    if (source) {
      expectedReviewItems.push(coreSemanticReviewItemFromSource(
        { ...row, missingFieldCodes: [...workqueue.startingBlockerCodes] },
        index + 1,
        source,
      ));
    }
  }
  if (!isDeepStrictEqual(input.workqueueItems, expectedWorkqueueItems)) {
    throw new Error('Frozen core semantic workqueue mismatch');
  }
  if (!isDeepStrictEqual(input.reviewItems, expectedReviewItems)) {
    throw new Error('Frozen core semantic review item mismatch');
  }
  const expectedSummary = buildCoreRegisteredKnowledgeResourceSemanticSummary(
    expectedWorkqueueItems,
    expectedReviewItems,
  );
  if (!isDeepStrictEqual(input.summary, expectedSummary)) {
    throw new Error('Frozen core semantic summary mismatch');
  }
}

function coreSemanticWorkqueueItemFromRow(
  row: ResourceFieldCompletionAuditRow,
  selectedOrder: number,
  startingBlockerCodes: readonly ResourceFieldMissingCode[],
): CoreRegisteredKnowledgeResourceSemanticWorkqueueItem {
  return {
    artifactVersion: 'core-registered-knowledge-resource-semantics.v1',
    reviewBatchId: CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_BATCH_ID,
    selectedOrder,
    resourceId: row.resourceId,
    sourceFamily: row.family as CoreRegisteredKnowledgeResourceFamily,
    title: row.title,
    sourcePathOrUrl: row.sourcePathOrUrl,
    sourceRecord: row.sourceRecord,
    startingBlockerCodes: [...startingBlockerCodes],
    startingBlockerCount: startingBlockerCodes.length,
    sourceHash: row.sourceHash,
    sourceVersionRef: row.sourceVersionRef,
    privacyMinimized: true,
    rawContentIncluded: false,
  };
}

async function buildCoreRegisteredKnowledgeResourceSemanticArtifacts(
  auditRows: ResourceFieldCompletionAuditRow[],
): Promise<{
  workqueueItems: CoreRegisteredKnowledgeResourceSemanticWorkqueueItem[];
  reviewItems: CoreRegisteredKnowledgeResourceSemanticReviewItem[];
  summary: CoreRegisteredKnowledgeResourceSemanticSummary;
}> {
  const reviewSources = await loadCoreRegisteredKnowledgeResourceSemanticReviewMap();
  const scopedRows = auditRows
    .filter((row) => CORE_SCOPE_FAMILIES.has(row.family))
    .sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  const workqueueItems = scopedRows.map((row, index) => (
    coreSemanticWorkqueueItemFromRow(row, index + 1, row.missingFieldCodes)
  ));
  const reviewItems = scopedRows.flatMap((row, index) => {
    const source = reviewSources.get(row.resourceId);
    return source ? [coreSemanticReviewItemFromSource(row, index + 1, source)] : [];
  });
  const summary = buildCoreRegisteredKnowledgeResourceSemanticSummary(workqueueItems, reviewItems);
  return { workqueueItems, reviewItems, summary };
}

async function loadCoreRegisteredKnowledgeResourceSemanticReviewMap(
  rawText?: string,
): Promise<Map<string, CoreRegisteredKnowledgeResourceSemanticReviewSource>> {
  const sourceText = rawText ?? await fs.readFile(
    CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_SOURCE_JSONL_PATH,
    'utf8',
  );
  const sources = sourceText.split(/\r?\n/).filter(Boolean).map((line) => (
    JSON.parse(line) as CoreRegisteredKnowledgeResourceSemanticReviewSource
  ));
  if (sources.length === 0) {
    throw new Error(`Core registered/knowledge semantic review source is empty or missing: ${projectPath(CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_SOURCE_JSONL_PATH)}`);
  }
  const map = new Map<string, CoreRegisteredKnowledgeResourceSemanticReviewSource>();
  for (const source of sources) {
    if (map.has(source.resourceId)) {
      throw new Error(`Duplicate core registered/knowledge semantic review source for ${source.resourceId}`);
    }
    map.set(source.resourceId, source);
  }
  return map;
}

export async function loadRuntimeLessonMediaSemanticReviewMap(): Promise<Map<string, RuntimeLessonMediaSemanticReviewSource>> {
  const sources = await readJsonlFile<RuntimeLessonMediaSemanticReviewSource>(
    RUNTIME_LESSON_MEDIA_SEMANTIC_REVIEW_SOURCE_JSONL_PATH,
  );
  if (sources.length === 0) {
    throw new Error(`Runtime lesson/media semantic review source is empty or missing: ${projectPath(RUNTIME_LESSON_MEDIA_SEMANTIC_REVIEW_SOURCE_JSONL_PATH)}`);
  }
  const map = new Map<string, RuntimeLessonMediaSemanticReviewSource>();
  for (const source of sources) {
    if (source.artifactVersion !== 'runtime-lesson-media-resource-semantics.review-source.v1') {
      throw new Error(`Invalid runtime lesson/media semantic review source version: ${source.resourceId}`);
    }
    if (source.reviewSourceKind !== 'explicit-item-review') {
      throw new Error(`Runtime lesson/media semantic review source is not an explicit item review: ${source.resourceId}`);
    }
    if (!RUNTIME_LESSON_MEDIA_SEMANTIC_SCOPE_FAMILIES.has(source.sourceFamily)) {
      throw new Error(`Out-of-scope runtime lesson/media semantic review source: ${source.resourceId}`);
    }
    if (map.has(source.resourceId)) {
      throw new Error(`Duplicate runtime lesson/media semantic review source: ${source.resourceId}`);
    }
    if (source.rawContentIncluded || !source.privacyMinimized) {
      throw new Error(`Runtime lesson/media semantic review source violates privacy minimization: ${source.resourceId}`);
    }
    if (!source.reviewerId || !source.reviewerRole || !source.reviewBatchId || !source.reviewedAt) {
      throw new Error(`Runtime lesson/media semantic review source lacks per-item review metadata: ${source.resourceId}`);
    }
    if (source.reviewState === 'pending-rereview') {
      if (!source.staleReason?.trim()) {
        throw new Error(`Stale runtime lesson/media semantic review source lacks reason: ${source.resourceId}`);
      }
    } else if (source.reviewState !== 'human-confirmed') {
      throw new Error(`Invalid runtime lesson/media semantic review state: ${source.resourceId}`);
    }
    if (!source.reviewerVisibleRationale || source.reviewerVisibleRationale.trim().length < 20) {
      throw new Error(`Runtime lesson/media semantic review source lacks item rationale: ${source.resourceId}`);
    }
    if (!source.independentEvidenceRef || /runtime-lesson-media-resource-semantics-(?:review|workqueue|summary|evidence)/i.test(source.independentEvidenceRef)) {
      throw new Error(`Runtime lesson/media semantic review source has non-independent evidence: ${source.resourceId}`);
    }
    if (source.reviewState === 'human-confirmed' && !source.currentEvidenceSemanticDigest) {
      assertRuntimeLessonMediaSemanticEvidenceReference(source);
    }
    if (!Array.isArray(source.learningGoalIds) || !Array.isArray(source.knowledgeObjectiveIds) ||
        !Array.isArray(source.capabilityObjectiveIds) || !Array.isArray(source.qualityObjectiveIds) ||
        !Array.isArray(source.evidenceInstrumentation)) {
      throw new Error(`Runtime lesson/media semantic review source lacks explicit decision fields: ${source.resourceId}`);
    }
    if (source.parentPlanningUnitRef?.startsWith('runtime-lesson:')) {
      throw new Error(`Runtime lesson/media semantic review source uses a lesson placeholder as parent PlanningUnit: ${source.resourceId}`);
    }
    if (!source.runtimeEvidence || typeof source.runtimeEvidence !== 'object') {
      throw new Error(`Runtime lesson/media semantic review source lacks runtime evidence facts: ${source.resourceId}`);
    }
    map.set(source.resourceId, source);
  }
  return map;
}

export async function loadCourseContentClearanceRecords(
  runtimeLessonsDir = RUNTIME_LESSONS_DIR,
): Promise<CourseContentClearanceRecord[]> {
  const clearancePaths = (await collectFiles(runtimeLessonsDir))
    .filter((filePath) => filePath.endsWith(`${path.sep}review${path.sep}content-clearance.json`))
    .filter((filePath) => COURSE_CONTENT_CLEARANCE_LESSON_IDS.has(
      path.relative(runtimeLessonsDir, filePath).split(path.sep)[0],
    ));
  const records: CourseContentClearanceRecord[] = [];
  const lessonIds = new Set<string>();
  for (const clearancePath of clearancePaths) {
    const relativeLessonDir = path.relative(
      runtimeLessonsDir,
      path.dirname(path.dirname(clearancePath)),
    ).split(path.sep).join('/');
    let raw: unknown;
    try {
      raw = JSON.parse(await fs.readFile(clearancePath, 'utf8')) as unknown;
    } catch (error) {
      throw new Error(`Invalid lesson content clearance JSON: ${clearancePath}`, { cause: error });
    }
    const record = parseCourseContentClearanceRecord(raw, clearancePath);
    if (record.lesson_id !== relativeLessonDir) {
      throw new Error(
        `Lesson content clearance lesson_id mismatch: ${record.lesson_id} is stored under ${relativeLessonDir}`,
      );
    }
    if (lessonIds.has(record.lesson_id)) {
      throw new Error(`Duplicate lesson content clearance record: ${record.lesson_id}`);
    }
    const expectedEvidenceRef = `course-content/runtime/lessons/${record.lesson_id}/review/review-report.md`;
    if (record.independent_evidence_ref !== expectedEvidenceRef) {
      throw new Error(`Invalid lesson content clearance independent evidence ref: ${clearancePath}`);
    }
    if (!await fileExists(path.join(path.dirname(clearancePath), 'review-report.md'))) {
      throw new Error(`Missing lesson content clearance independent evidence: ${expectedEvidenceRef}`);
    }
    lessonIds.add(record.lesson_id);
    records.push(record);
  }
  return records.sort((left, right) => left.lesson_id.localeCompare(right.lesson_id));
}

export function buildCourseContentClearanceReviewOverlays(
  records: readonly CourseContentClearanceRecord[],
  sourceRows: readonly ResourceFieldCompletionAuditRow[],
): ResourceFieldCompletionReviewOverlay[] {
  const sourceRowById = new Map<string, ResourceFieldCompletionAuditRow>();
  for (const row of sourceRows) {
    if (sourceRowById.has(row.resourceId)) {
      throw new Error(`Duplicate resource field completion source row: ${row.resourceId}`);
    }
    sourceRowById.set(row.resourceId, row);
  }

  const lessonIds = new Set<string>();
  const reviewedResourceIds = new Set<string>();
  const overlays: ResourceFieldCompletionReviewOverlay[] = [];
  for (const record of records) {
    if (lessonIds.has(record.lesson_id)) {
      throw new Error(`Duplicate lesson content clearance record: ${record.lesson_id}`);
    }
    lessonIds.add(record.lesson_id);
    const lessonSourcePrefix = `course-content/runtime/lessons/${record.lesson_id}/`;
    const reviewedInLesson = new Set<string>();
    for (const reviewed of record.reviewed_resources) {
      if (reviewedResourceIds.has(reviewed.resourceId)) {
        throw new Error(`Duplicate lesson content clearance resource: ${reviewed.resourceId}`);
      }
      reviewedResourceIds.add(reviewed.resourceId);
      reviewedInLesson.add(reviewed.resourceId);
      const sourceRow = sourceRowById.get(reviewed.resourceId);
      if (!sourceRow) {
        throw new Error(`Lesson content clearance resource has no audit source row: ${reviewed.resourceId}`);
      }
      const staleReasons = courseContentClearanceStaleReasons(
        record,
        reviewed,
        sourceRow,
        lessonSourcePrefix,
      );
      const targetMigration = staleReasons.some((reason) => (
        reason === 'source-identity-changed' || reason === 'path-target-changed'
      ));
      overlays.push({
        resourceId: reviewed.resourceId,
        reviewStatus: staleReasons.length > 0 ? 'stale' : record.review_status,
        expectedSourceHash: reviewed.sourceHash,
        expectedSourceVersionRef: reviewed.sourceVersionRef,
        graphNodeRefs: reviewed.graphNodeRefs,
        pathTarget: staleReasons.length > 0 ? null : reviewed.pathTarget,
        currentPathEligible: staleReasons.length === 0 && reviewed.currentPathEligible,
        reviewAudit: {
          reviewerId: record.reviewer,
          reviewerRole: 'course-content-reviewer',
          reviewedAt: record.time,
          reviewBatchId: record.batch,
          reviewedSourceHash: reviewed.sourceHash,
          reviewedVersionRef: reviewed.sourceVersionRef,
          generationToolOrModel: record.model,
          promptOrManifestHash: reviewed.sourceHash,
          reviewerVisibleRationale: reviewed.rationale,
          independentEvidenceRef: record.independent_evidence_ref,
          confidence: 1,
          staleInvalidationRule: staleReasons.length === 0
            ? 'stale when source hash, version ref, graph binding, path target, or path eligibility changes'
            : `${targetMigration ? 'pending-target-migration' : 'pending-decision-change'}:${staleReasons.join(',')}`,
        },
      });
    }
    for (const row of sourceRows) {
      if (
        (row.family === 'runtime-handout' || row.family === 'runtime-lesson-media') &&
        row.sourcePathOrUrl?.startsWith(lessonSourcePrefix) &&
        !reviewedInLesson.has(row.resourceId)
      ) {
        throw new Error(`Missing lesson content clearance resource: ${row.resourceId}`);
      }
    }
  }
  return overlays.sort((left, right) => left.resourceId.localeCompare(right.resourceId));
}

function parseCourseContentClearanceRecord(
  raw: unknown,
  sourcePath: string,
): CourseContentClearanceRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid lesson content clearance record: ${sourcePath}`);
  }
  const value = raw as Record<string, unknown>;
  const lessonId = requiredString(value.lesson_id, 'lesson_id', sourcePath);
  const reviewer = requiredString(value.reviewer, 'reviewer', sourcePath);
  const batch = requiredString(value.batch, 'batch', sourcePath);
  const time = requiredString(value.time, 'time', sourcePath);
  const model = requiredString(value.model, 'model', sourcePath);
  if (model !== 'gpt-5.6-sol') {
    throw new Error(`Invalid lesson content clearance model: ${sourcePath}`);
  }
  if (!Number.isFinite(Date.parse(time))) {
    throw new Error(`Invalid lesson content clearance time: ${sourcePath}`);
  }
  if (value.status !== 'cleared') {
    throw new Error(`Invalid lesson content clearance status: ${sourcePath}`);
  }
  if (value.review_status !== 'model-cleared') {
    throw new Error(`Invalid lesson content clearance review_status: ${sourcePath}`);
  }
  const independentEvidenceRef = requiredString(
    value.independent_evidence_ref,
    'independent_evidence_ref',
    sourcePath,
  );
  if (independentEvidenceRef.includes('content-clearance.json')) {
    throw new Error(`Lesson content clearance evidence must not self-reference: ${sourcePath}`);
  }
  if (!Array.isArray(value.reviewed_resources)) {
    throw new Error(`Invalid lesson content clearance reviewed_resources: ${sourcePath}`);
  }
  const reviewedResources = value.reviewed_resources.map((item, index) => (
    parseCourseContentClearanceReviewedResource(item, `${sourcePath}#reviewed_resources[${index}]`)
  ));
  return {
    lesson_id: lessonId,
    reviewer,
    batch,
    time,
    model,
    status: 'cleared',
    review_status: 'model-cleared',
    independent_evidence_ref: independentEvidenceRef,
    reviewed_resources: reviewedResources,
  };
}

function parseCourseContentClearanceReviewedResource(
  raw: unknown,
  sourcePath: string,
): CourseContentClearanceReviewedResource {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid lesson content clearance reviewed resource: ${sourcePath}`);
  }
  const value = raw as Record<string, unknown>;
  if (!value.graphNodeRefs || typeof value.graphNodeRefs !== 'object' || Array.isArray(value.graphNodeRefs)) {
    throw new Error(`Invalid lesson content clearance graphNodeRefs: ${sourcePath}`);
  }
  const graphNodeRefs = value.graphNodeRefs as Record<string, unknown>;
  if (value.pathTarget !== null && typeof value.pathTarget !== 'string') {
    throw new Error(`Invalid lesson content clearance pathTarget: ${sourcePath}`);
  }
  if (typeof value.currentPathEligible !== 'boolean') {
    throw new Error(`Invalid lesson content clearance currentPathEligible: ${sourcePath}`);
  }
  return {
    resourceId: requiredString(value.resourceId, 'resourceId', sourcePath),
    sourcePath: requiredString(value.sourcePath, 'sourcePath', sourcePath),
    sourceHash: requiredString(value.sourceHash, 'sourceHash', sourcePath),
    sourceVersionRef: requiredString(value.sourceVersionRef, 'sourceVersionRef', sourcePath),
    graphNodeRefs: {
      knowledge: requiredStringArray(graphNodeRefs.knowledge, 'graphNodeRefs.knowledge', sourcePath),
      capability: requiredStringArray(graphNodeRefs.capability, 'graphNodeRefs.capability', sourcePath),
      quality: requiredStringArray(graphNodeRefs.quality, 'graphNodeRefs.quality', sourcePath),
    },
    pathTarget: value.pathTarget,
    currentPathEligible: value.currentPathEligible,
    rationale: requiredString(value.rationale, 'rationale', sourcePath),
  };
}

function courseContentClearanceStaleReasons(
  record: CourseContentClearanceRecord,
  reviewed: CourseContentClearanceReviewedResource,
  sourceRow: ResourceFieldCompletionAuditRow,
  lessonSourcePrefix: string,
) {
  const lessonCardSuffix = `_${record.lesson_id.replace('-', '_')}`;
  const isLessonKnowledgeCard = sourceRow.family === 'knowledge-card' &&
    reviewed.sourcePath.startsWith('course-content/runtime/knowledge/cards/nodes/') &&
    sourceRow.sourceRecord?.endsWith(lessonCardSuffix);
  if (!reviewed.sourcePath.startsWith(lessonSourcePrefix) && !isLessonKnowledgeCard) {
    throw new Error(`Lesson content clearance source path is outside lesson ${record.lesson_id}: ${reviewed.resourceId}`);
  }
  return [
    sourceRow.sourcePathOrUrl !== reviewed.sourcePath ? 'source-identity-changed' : null,
    sourceRow.sourceHash !== reviewed.sourceHash ? 'source-body-changed' : null,
    sourceRow.sourceVersionRef !== reviewed.sourceVersionRef ? 'source-version-changed' : null,
    reviewed.pathTarget !== null && sourceRow.pathTarget !== reviewed.pathTarget ? 'path-target-changed' : null,
    sourceRow.pathEligibility.current !== reviewed.currentPathEligible ? 'path-eligibility-changed' : null,
  ].filter((reason): reason is string => reason !== null);
}

function requiredString(value: unknown, field: string, sourcePath: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid lesson content clearance ${field}: ${sourcePath}`);
  }
  return value;
}

function requiredStringArray(value: unknown, field: string, sourcePath: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`Invalid lesson content clearance ${field}: ${sourcePath}`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`Duplicate lesson content clearance ${field}: ${sourcePath}`);
  }
  return value as string[];
}

function coreSemanticFormalReviewOverlayFromSource(
  source: CoreRegisteredKnowledgeResourceSemanticReviewSource,
): ResourceFieldCompletionReviewOverlay {
  return {
    resourceId: source.resourceId,
    expectedSourceHash: source.sourceHash,
    expectedSourceVersionRef: source.sourceVersionRef,
    pathTarget: source.routeTarget,
    currentPathEligible: source.currentPathEligible,
    reviewAudit: {
      reviewerId: source.reviewerId,
      reviewerRole: source.reviewerRole,
      reviewedAt: source.reviewedAt,
      reviewBatchId: source.reviewBatchId,
      reviewedSourceHash: source.sourceHash,
      reviewedVersionRef: source.sourceVersionRef,
      generationToolOrModel: null,
      promptOrManifestHash: null,
      reviewerVisibleRationale: source.reviewerVisibleRationale,
      independentEvidenceRef: `${projectPath(CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_SOURCE_JSONL_PATH)}#${source.resourceId}`,
      confidence: 1,
      staleInvalidationRule: 'stale when source hash, version ref, prompt hash, or generation tool version changes',
    },
  };
}

export function runtimeLessonMediaSemanticFormalReviewOverlaysForRows(
  rows: readonly ResourceFieldCompletionAuditRow[],
  reviewSources: ReadonlyMap<string, RuntimeLessonMediaSemanticReviewSource>,
): ResourceFieldCompletionReviewOverlay[] {
  const scopedRows = rows.filter((row) => reviewSources.has(row.resourceId));
  if (scopedRows.length === 0) throw new Error('Runtime lesson/media semantic frozen scope is empty');
  const scopedIds = new Set(scopedRows.map((row) => row.resourceId));
  for (const [resourceId, source] of reviewSources) {
    if (!scopedIds.has(resourceId)) {
      if (source.reviewState !== 'pending-rereview') {
        throw new Error(`Current runtime lesson/media semantic review source has no audit row: ${resourceId}`);
      }
    }
  }
  const promotedIds = new Set<string>();
  const staleReasons = new Map<string, string>();
  for (const row of scopedRows) {
    const source = reviewSources.get(row.resourceId);
    if (!source) throw new Error(`Missing runtime lesson/media semantic review source: ${row.resourceId}`);
    if (source.sourceFamily !== row.family) {
      throw new Error(`Runtime lesson/media semantic source family mismatch: ${row.resourceId}`);
    }
    const pendingRereview = source.reviewState === 'pending-rereview';
    if (pendingRereview) staleReasons.set(row.resourceId, source.staleReason ?? 'review-source-pending-rereview');
    if (source.expectedSourceVersionRef !== row.sourceVersionRef) {
      throw new Error(`Runtime lesson/media semantic source version mismatch: ${row.resourceId}`);
    }
    const lessonKey = row.resourceId.split(':')[1] ?? 'unknown';
    if (source.parentLessonRef !== `runtime-lesson:${lessonKey}`) {
      throw new Error(`Runtime lesson/media semantic parent lesson mismatch: ${row.resourceId}`);
    }
    if (source.promotedAsPlanningUnit !== (source.disposition === 'planning-unit')) {
      throw new Error(`Runtime lesson/media semantic promotion/disposition mismatch: ${row.resourceId}`);
    }
    if (!pendingRereview && !source.currentEvidenceSemanticDigest) {
      assertRuntimeLessonMediaSemanticEvidenceReference(source);
    }
    if (!pendingRereview && !source.currentEvidenceSemanticDigest) {
      try {
        assertRuntimeLessonSemanticReviewEvidence(row, source);
      } catch (error) {
        staleReasons.set(
          row.resourceId,
          `audit-facts-changed:${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (!pendingRereview && source.parentResourceRef) {
      if (source.parentResourceRef.startsWith('runtime-lesson:') || !scopedIds.has(source.parentResourceRef)) {
        throw new Error(`Runtime lesson/media semantic source has an unresolved resource parent: ${row.resourceId}`);
      }
      if (!source.runtimeEvidence.parent.resourceCandidates.includes(source.parentResourceRef)) {
        throw new Error(`Runtime lesson/media semantic source parent is not present in the runtime manifest relationship: ${row.resourceId}`);
      }
    }
    if (!pendingRereview && !staleReasons.has(row.resourceId) && source.promotedAsPlanningUnit) {
      promotedIds.add(row.resourceId);
    }
  }
  return scopedRows.map((row) => {
    const source = reviewSources.get(row.resourceId);
    if (!source) throw new Error(`Missing runtime lesson/media semantic review source: ${row.resourceId}`);
    const staleReason = staleReasons.get(row.resourceId);
    if (staleReason) {
      return {
        resourceId: row.resourceId,
        reviewStatus: 'stale',
        expectedSourceHash: row.sourceHash,
        expectedSourceVersionRef: row.sourceVersionRef,
        pathTarget: null,
        currentPathEligible: false,
        reviewAudit: {
          reviewerId: source.reviewerId,
          reviewerRole: source.reviewerRole,
          reviewedAt: source.reviewedAt,
          reviewBatchId: source.reviewBatchId,
          reviewedSourceHash: source.reviewedSourceHash ?? source.expectedSourceHash,
          reviewedVersionRef: source.expectedSourceVersionRef,
          generationToolOrModel: null,
          promptOrManifestHash: source.reviewedManifestHash ?? null,
          reviewerVisibleRationale: source.reviewerVisibleRationale,
          independentEvidenceRef: source.independentEvidenceRef,
          confidence: source.confidence,
          staleInvalidationRule: `pending-rereview:${staleReason}`,
        },
      };
    }
    const parentPlanningSource = source.parentPlanningUnitRef
      ? reviewSources.get(source.parentPlanningUnitRef)
      : null;
    if (
      source.parentPlanningUnitRef
      && !promotedIds.has(source.parentPlanningUnitRef)
      && parentPlanningSource?.reviewState !== 'pending-rereview'
    ) {
      throw new Error(`Runtime lesson/media semantic parent PlanningUnit is not promoted: ${row.resourceId}`);
    }
    if (JSON.stringify(source.graphNodeRefs) !== JSON.stringify(row.graphNodeRefs)) {
      throw new Error(`Runtime lesson/media semantic graph decision mismatch: ${row.resourceId}`);
    }
    if (source.estimatedTimeMinutes !== row.estimatedTimeMinutes) {
      throw new Error(`Runtime lesson/media semantic time decision mismatch: ${row.resourceId}`);
    }
    if (source.readinessPresent !== (row.readiness !== null)) {
      throw new Error(`Runtime lesson/media semantic readiness decision mismatch: ${row.resourceId}`);
    }
    if (source.evidenceContractComplete !== row.evidenceContract.complete ||
        JSON.stringify(source.evidenceMissingFields) !== JSON.stringify(row.evidenceContract.missingFields)) {
      throw new Error(`Runtime lesson/media semantic evidence decision mismatch: ${row.resourceId}`);
    }
    const citationTargets = row.citationTargets.filter((target) => !/^https?:\/\//i.test(target)).sort();
    if (JSON.stringify(source.citationTargets) !== JSON.stringify(citationTargets)) {
      throw new Error(`Runtime lesson/media semantic citation decision mismatch: ${row.resourceId}`);
    }
    if (source.promotedAsPlanningUnit && (
      row.family !== 'runtime-lesson-step' ||
      !source.currentPathEligible ||
      !source.pathTarget ||
      source.pathTarget !== row.pathTarget ||
      row.missingFieldCodes.length > 0 ||
      !row.pathEligibility.current ||
      !row.pathEligibility.afterCompletion ||
      row.pathEligibility.blockedBy.length > 0 ||
      !row.evidenceContract.complete ||
      !row.readiness ||
      !source.readinessPresent ||
      source.estimatedTimeMinutes === null ||
      source.estimatedTimeMinutes <= 0 ||
      source.citationTargets.length === 0 ||
      row.graphNodeRefs.knowledge.length === 0 ||
      source.graphNodeRefs.knowledge.length === 0 ||
      source.evidenceDecision !== 'independent-path-evidence' ||
      source.evidenceInstrumentation.length === 0 ||
      !source.evidenceContractComplete ||
      source.evidenceMissingFields.length > 0 ||
      source.learningGoalIds.length === 0 ||
      source.knowledgeObjectiveIds.length === 0 ||
      source.capabilityObjectiveIds.length === 0 ||
      source.qualityObjectiveIds.length === 0
    )) {
      throw new Error(`Runtime lesson/media semantic promotion violates independent PlanningUnit scope: ${row.resourceId}`);
    }
    if (!source.promotedAsPlanningUnit && (source.currentPathEligible || source.pathTarget)) {
      throw new Error(`Runtime lesson/media semantic supporting row exposes path eligibility: ${row.resourceId}`);
    }
    const selectedGoals = source.learningGoalIds.map((learningGoalId) => {
      const definition = ADAPTIVE_LEARNING_GOAL_DEFINITIONS[learningGoalId];
      if (!definition?.learningGoal) {
        throw new Error(`Runtime lesson/media semantic source has unknown LearningGoal: ${row.resourceId}:${learningGoalId}`);
      }
      return definition.learningGoal;
    });
    const objectiveSets = {
      knowledge: new Set(selectedGoals.flatMap((goal) => goal.knowledgeObjectiveIds)),
      capability: new Set(selectedGoals.flatMap((goal) => goal.capabilityObjectiveIds)),
      quality: new Set(selectedGoals.flatMap((goal) => goal.qualityObjectiveIds)),
    };
    for (const [domain, objectiveIds] of Object.entries({
      knowledge: source.knowledgeObjectiveIds,
      capability: source.capabilityObjectiveIds,
      quality: source.qualityObjectiveIds,
    }) as Array<[keyof typeof objectiveSets, string[]]>) {
      if (objectiveIds.some((objectiveId) => !objectiveSets[domain].has(objectiveId))) {
        throw new Error(`Runtime lesson/media semantic source has an objective outside its LearningGoal boundary: ${row.resourceId}:${domain}`);
      }
    }
    return {
      resourceId: row.resourceId,
      canonicalSemanticMatch: true,
      expectedSourceHash: row.sourceHash,
      expectedSourceVersionRef: row.sourceVersionRef,
      pathTarget: source.pathTarget,
      currentPathEligible: source.currentPathEligible,
      reviewAudit: {
        reviewerId: source.reviewerId,
        reviewerRole: source.reviewerRole,
        reviewedAt: source.reviewedAt,
        reviewBatchId: source.reviewBatchId,
        reviewedSourceHash: source.reviewedSourceHash ?? source.expectedSourceHash,
        reviewedVersionRef: source.expectedSourceVersionRef,
        generationToolOrModel: null,
        promptOrManifestHash: source.reviewedManifestSemanticDigest ?? (
          source.runtimeEvidence?.assetStatus === 'missing-local-runtime-asset'
            ? source.reviewedManifestHash ?? null
            : null
        ),
        reviewerVisibleRationale: source.reviewerVisibleRationale,
        independentEvidenceRef: source.independentEvidenceRef,
        confidence: source.confidence,
        staleInvalidationRule: 'stale when the canonical source, JSON Pointer value, evidence locator, or governed decision contract changes',
      },
    };
  });
}

function coreSemanticFormalReviewOverlaysForRows(
  rows: ResourceFieldCompletionAuditRow[],
  reviewSources: Map<string, CoreRegisteredKnowledgeResourceSemanticReviewSource>,
): ResourceFieldCompletionReviewOverlay[] {
  const scopedRows = rows.filter((row) => CORE_SCOPE_FAMILIES.has(row.family));
  if (scopedRows.length !== 624) {
    throw new Error(`Core registered/knowledge frozen scope must contain 624 rows, found ${scopedRows.length}`);
  }
  return scopedRows.flatMap((row) => {
    const source = reviewSources.get(row.resourceId);
    if (!source) return [];
    assertCoreSemanticReviewSourceMatchesRow(row, source);
    return [coreSemanticFormalReviewOverlayFromSource(source)];
  });
}

function coreSemanticReviewItemFromSource(
  row: ResourceFieldCompletionAuditRow,
  selectedOrder: number,
  source: CoreRegisteredKnowledgeResourceSemanticReviewSource,
): CoreRegisteredKnowledgeResourceSemanticReviewItem {
  assertCoreSemanticReviewSourceMatchesRow(row, source);
  return {
    artifactVersion: 'core-registered-knowledge-resource-semantics.v1',
    reviewBatchId: source.reviewBatchId,
    reviewerId: source.reviewerId,
    reviewerRole: source.reviewerRole,
    reviewedAt: source.reviewedAt,
    reviewSourceKind: source.reviewSourceKind,
    selectedOrder,
    resourceId: row.resourceId,
    sourceFamily: row.family as CoreRegisteredKnowledgeResourceFamily,
    title: row.title,
    sourcePathOrUrl: row.sourcePathOrUrl,
    sourceRecord: row.sourceRecord,
    startingBlockerCodes: row.missingFieldCodes,
    startingBlockerCount: row.missingFieldCodes.length,
    sourceHash: row.sourceHash,
    sourceVersionRef: row.sourceVersionRef,
    disposition: source.disposition,
    graphNodeIds: uniqueSorted(source.graphNodeIds),
    learningGoalIds: uniqueSorted(source.learningGoalIds),
    knowledgeObjectiveIds: uniqueSorted(source.knowledgeObjectiveIds),
    capabilityObjectiveIds: uniqueSorted(source.capabilityObjectiveIds),
    qualityObjectiveIds: uniqueSorted(source.qualityObjectiveIds),
    objectiveMappingRationale: source.objectiveMappingRationale,
    pathStageOrSupportRole: source.pathStageOrSupportRole,
    routeTarget: source.routeTarget,
    citationTargets: uniqueSorted(source.citationTargets),
    evidenceBehavior: source.evidenceBehavior,
    privacyScope: source.privacyScope,
    residualLimitationState: uniqueSorted(source.residualLimitationState),
    currentPathEligible: source.currentPathEligible,
    reviewerVisibleRationale: source.reviewerVisibleRationale,
    independentEvidenceRef: `${projectPath(CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_JSONL_PATH)}#${row.resourceId}`,
    privacyMinimized: true,
    rawContentIncluded: false,
  };
}

function assertCoreSemanticReviewSourceMatchesRow(
  row: ResourceFieldCompletionAuditRow,
  source: CoreRegisteredKnowledgeResourceSemanticReviewSource,
) {
  if (source.artifactVersion !== 'core-registered-knowledge-resource-semantics.review-source.v1') {
    throw new Error(`Invalid core semantic review source artifact version for ${source.resourceId}`);
  }
  if (source.reviewSourceKind !== 'implementing-agent-item-review') {
    throw new Error(`Invalid core semantic review source kind for ${source.resourceId}`);
  }
  if (source.reviewerId !== CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEWER_ID) {
    throw new Error(`Unexpected core semantic reviewer for ${source.resourceId}`);
  }
  if (source.reviewBatchId !== CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_BATCH_ID) {
    throw new Error(`Unexpected core semantic review batch for ${source.resourceId}`);
  }
  if (source.reviewedAt !== CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEWED_AT) {
    throw new Error(`Unexpected core semantic reviewedAt for ${source.resourceId}`);
  }
  if (!CORE_SCOPE_FAMILIES.has(row.family)) {
    throw new Error(`Out-of-scope core semantic audit row: ${row.resourceId}`);
  }
  if (source.sourceHash !== row.sourceHash) {
    throw new Error(`Core semantic review source hash mismatch for ${row.resourceId}`);
  }
  if (source.sourceVersionRef !== row.sourceVersionRef) {
    throw new Error(`Core semantic review source version mismatch for ${row.resourceId}`);
  }
  if (!source.privacyScope) {
    throw new Error(`Core semantic review source missing privacyScope for ${row.resourceId}`);
  }
  if (source.rawContentIncluded || !source.privacyMinimized) {
    throw new Error(`Core semantic review source violates privacy minimization for ${row.resourceId}`);
  }
  if (source.reviewerVisibleRationale.length < 60 || source.objectiveMappingRationale.length < 60) {
    throw new Error(`Core semantic review source rationale is too thin for ${row.resourceId}`);
  }
  if (source.disposition === 'path-plannable') {
    if (!row.sourceHash || !source.sourceHash) {
      throw new Error(`Core semantic path-plannable resource lacks source hash: ${row.resourceId}`);
    }
    if (!row.pathEligibility.current || !source.currentPathEligible) {
      throw new Error(`Core semantic path-plannable resource is not currently path eligible: ${row.resourceId}`);
    }
    if (!source.routeTarget || source.routeTarget !== row.pathTarget) {
      throw new Error(`Core semantic path-plannable route mismatch for ${row.resourceId}`);
    }
    if (source.evidenceBehavior !== 'path-execution-evidence-only') {
      throw new Error(`Core semantic path-plannable evidence behavior mismatch for ${row.resourceId}`);
    }
    if (source.learningGoalIds.length === 0 || source.knowledgeObjectiveIds.length === 0 || source.capabilityObjectiveIds.length === 0 || source.qualityObjectiveIds.length === 0) {
      throw new Error(`Core semantic path-plannable resource lacks K/A/Q mapping: ${row.resourceId}`);
    }
  } else if (source.currentPathEligible || source.routeTarget) {
    throw new Error(`Core semantic non-path resource exposes path eligibility or route: ${row.resourceId}`);
  }
  if (row.family === 'knowledge-infograph' && source.disposition !== 'embedded-asset') {
    throw new Error(`Core semantic infograph must remain embedded: ${row.resourceId}`);
  }
  if (row.family === 'registered-resource' && !row.sourceHash && source.disposition === 'path-plannable') {
    throw new Error(`Core semantic registered resource without source hash cannot be path-plannable: ${row.resourceId}`);
  }
  if (!arraysEqual(uniqueSorted(source.citationTargets), uniqueSorted(row.citationTargets))) {
    throw new Error(`Core semantic citation target mismatch for ${row.resourceId}`);
  }
  if (source.residualLimitationState.length === 0 && row.missingFieldCodes.length > 0 && source.disposition !== 'path-plannable') {
    throw new Error(`Core semantic source leaves blockers unexplained for ${row.resourceId}`);
  }
}

function buildCoreRegisteredKnowledgeResourceSemanticSummary(
  workqueueItems: CoreRegisteredKnowledgeResourceSemanticWorkqueueItem[],
  reviewItems: CoreRegisteredKnowledgeResourceSemanticReviewItem[],
): CoreRegisteredKnowledgeResourceSemanticSummary {
  return {
    artifactVersion: 'core-registered-knowledge-resource-semantics.v1',
    reviewBatchId: CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_BATCH_ID,
    reviewerId: CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEWER_ID,
    reviewedAt: CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEWED_AT,
    totals: {
      scopedResources: new Set(workqueueItems.map((item) => item.resourceId)).size,
      workqueueItems: workqueueItems.length,
      reviewedResources: reviewItems.length,
      remainingSemanticReviewBlockers: workqueueItems.filter((item) => item.startingBlockerCount > 0).length,
      unexplainedRemainingItems: reviewItems.filter((item) => (
        item.residualLimitationState.length === 0 &&
        item.startingBlockerCount > 0 &&
        item.disposition !== 'path-plannable'
      )).length,
      rawContentIncluded: reviewItems.some((item) => item.rawContentIncluded),
      privacyMinimized: reviewItems.every((item) => item.privacyMinimized),
    },
    bySourceFamily: countBy(reviewItems, (item) => item.sourceFamily),
    byDisposition: countBy(reviewItems, (item) => item.disposition),
    residualLimitations: countBy(reviewItems.flatMap((item) => item.residualLimitationState), (item) => item),
      startingBlockers: countBy(workqueueItems.flatMap((item) => item.startingBlockerCodes), (item) => item),
      evidence: {
        workqueueItemsPath: path.relative(process.cwd(), CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_WORKQUEUE_JSONL_PATH),
        reviewSourcePath: path.relative(process.cwd(), CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_SOURCE_JSONL_PATH),
        reviewItemsPath: path.relative(process.cwd(), CORE_REGISTERED_KNOWLEDGE_RESOURCE_SEMANTIC_REVIEW_JSONL_PATH),
        sourceAuditPath: path.relative(process.cwd(), AUDIT_JSONL_PATH),
      },
  };
}

function renderCoreRegisteredKnowledgeResourceSemanticEvidence(
  summary: CoreRegisteredKnowledgeResourceSemanticSummary,
) {
  const lines = [
    '# Core Registered And Knowledge Resource Semantic Review',
    '',
    `Review batch: ${summary.reviewBatchId}`,
    `Reviewer: ${summary.reviewerId}`,
    `Reviewed at: ${summary.reviewedAt}`,
    '',
    '## Scope',
    '',
    `Scoped resources: ${summary.totals.scopedResources}`,
    `Workqueue items: ${summary.totals.workqueueItems}`,
    `Reviewed resources: ${summary.totals.reviewedResources}`,
    `Starting rows with blockers: ${summary.totals.remainingSemanticReviewBlockers}`,
    `Unexplained remaining items: ${summary.totals.unexplainedRemainingItems}`,
    `Privacy minimized: ${summary.totals.privacyMinimized}`,
    `Raw content included: ${summary.totals.rawContentIncluded}`,
    '',
    '## Families',
    '',
    ...Object.entries(summary.bySourceFamily)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([family, count]) => `- ${family}: ${count}`),
    '',
    '## Dispositions',
    '',
    ...Object.entries(summary.byDisposition)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([disposition, count]) => `- ${disposition}: ${count}`),
    '',
    '## Residual Limitations',
    '',
    ...Object.entries(summary.residualLimitations)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([limitation, count]) => `- ${limitation}: ${count}`),
    '',
    '## Evidence Files',
    '',
    `Workqueue items: ${summary.evidence.workqueueItemsPath}`,
    `Review source: ${summary.evidence.reviewSourcePath}`,
    `Review items: ${summary.evidence.reviewItemsPath}`,
    `Source audit: ${summary.evidence.sourceAuditPath}`,
    '',
    'The tracked review source is applied to formal audit rows before summary, workqueue, projection, baseline, and path-readiness artifacts are derived. The sidecar workqueue preserves the original row blockers as before-state; concrete source identity, dependency, evidence-contract, readiness, and non-path limitations remain visible after semantic review.',
  ];
  return `${lines.join('\n')}\n`;
}

async function collectAuditOnlyCandidates(textbookDocuments: Awaited<ReturnType<typeof loadAllTextbookRuntimeSearchDocuments>>) {
  const knowledgeVisualReviewMap = await loadKnowledgeVisualSemanticReviewMap();
  const [
    runtimeManifestCandidates,
    runtimeMediaCandidates,
    knowledgeCardCandidates,
    infographCandidates,
    authoringTextbookCandidates,
    textbookSearchDocumentReviews,
  ] = await Promise.all([
    collectRuntimeManifestCandidates(),
    collectRuntimeMediaCandidates(),
    collectKnowledgeCardCandidates(knowledgeVisualReviewMap),
    collectInfographCandidates(knowledgeVisualReviewMap),
    collectAuthoringTextbookCandidates(),
    loadTextbookSearchDocumentCitationReviews(),
  ]);
  const reviewedTextbookDocuments = filterTextbookSearchDocumentsForCitationReviewScope(
    textbookDocuments,
    textbookSearchDocumentReviews,
  );
  const textbookDocumentCandidates = reviewedTextbookDocuments.map<ResourceFieldCompletionCandidate>((document) => {
    const resourceId = `textbook-search-document:${document.id}`;
    const review = textbookSearchDocumentReviews.get(resourceId);
    if (review) assertTextbookSearchDocumentCitationReviewIsFresh(review, document.contentHash);
    return {
      id: resourceId,
      title: document.title,
      family: 'textbook-search-document',
      sourcePathOrUrl: document.href,
      sourceRecord: document.metadata.bookId,
      knowledgeNodeIds: review?.graphNodeRefs.knowledge ?? document.resourceProjection.knowledgeNodeRefs,
      capabilityTargetIds: review?.graphNodeRefs.capability ?? document.resourceProjection.capabilityTargetRefs,
      qualityTargetIds: review?.graphNodeRefs.quality,
      segmentRefs: [document.resourceProjection.segmentRef].filter(Boolean),
      citationTargets: [review?.citationTargetId ?? document.resourceProjection.citationTargetRef ?? document.href]
        .filter((value): value is string => Boolean(value)),
      pathTarget: null,
      evidenceInstrumentation: ['textbook_search_document_retrieved'],
      privacyScope: review ? STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE : UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
      contentHash: document.contentHash,
      versionRef: 'textbook-runtime-search-documents.v1',
      humanConfirmed: Boolean(review),
      currentPathEligible: false,
      reviewEvidence: review
        ? {
          reviewerId: review.reviewerId,
          reviewerRole: 'curriculum-data-governance',
          reviewedAt: review.reviewedAt,
          reviewBatchId: review.reviewBatchId,
          reviewerVisibleRationale: review.reviewerVisibleRationale,
          independentEvidenceRef: `${projectPath(TEXTBOOK_SEARCH_DOCUMENT_CITATION_REVIEW_ITEMS_JSONL_PATH)}#${resourceId}`,
          reviewedSourceHash: review.sourceHash ?? document.contentHash ?? undefined,
          confidence: 0.91,
        }
        : undefined,
    };
  });

  const limitations = [
    ...runtimeManifestCandidates.limitations,
    ...runtimeMediaCandidates.limitations,
    ...knowledgeCardCandidates.limitations,
    ...infographCandidates.limitations,
    ...authoringTextbookCandidates.limitations,
  ];
  if (textbookDocumentCandidates.length === 0) {
    limitations.push('No textbook runtime search documents were available for authoring textbook section audit.');
  }
  limitations.push('No separate quiz/generated-question/checkpoint runtime source files were found; existing ResourceNode registry rows cover registered quiz, simulation, Arena, and checkpoint records where present.');

  return {
    candidates: [
      ...runtimeManifestCandidates.candidates,
      ...runtimeMediaCandidates.candidates,
      ...knowledgeCardCandidates.candidates,
      ...infographCandidates.candidates,
      ...authoringTextbookCandidates.candidates,
      ...textbookDocumentCandidates,
    ],
    limitations,
  };
}

export function filterTextbookSearchDocumentsForCitationReviewScope<
  T extends { id: string; metadata: { bookId: string } },
>(
  documents: readonly T[],
  reviews: ReadonlyMap<string, TextbookSearchDocumentCitationReviewItem>,
): T[] {
  const reviewedBookIds = new Set(Array.from(reviews.values()).flatMap((review) => {
    const match = review.citationAddress?.href?.match(/\/textbooks\/([^/]+)\//);
    return match?.[1] ? [match[1]] : [];
  }));
  if (reviewedBookIds.size === 0) return [];
  return documents.filter((document) => (
    reviewedBookIds.has(document.metadata.bookId) &&
    reviews.has(`textbook-search-document:${document.id}`)
  ));
}

function assertTextbookSearchDocumentCitationReviewIsFresh(
  review: TextbookSearchDocumentCitationReviewItem,
  documentContentHash: string | null,
) {
  if (!hashesMatch(review.sourceHash, documentContentHash)) {
    throw new Error(`Stale textbook search-document citation review for ${review.resourceId}: review hash ${review.sourceHash ?? 'missing'} does not match current document hash ${documentContentHash ?? 'missing'}`);
  }
}

function hashesMatch(left: string | null | undefined, right: string | null | undefined) {
  return normalizeHash(left) !== null && normalizeHash(left) === normalizeHash(right);
}

function normalizeHash(value: string | null | undefined) {
  if (!value) return null;
  return value.replace(/^sha256:/, '');
}

async function collectRuntimeManifestCandidates() {
  const candidates: ResourceFieldCompletionCandidate[] = [];
  const lessonDirs = await discoverRuntimeLessonDirs();
  const routeIndex = await collectInteractiveCourseRouteIndex();
  for (const { lessonDir, lessonKey } of lessonDirs) {
    const manifestPath = path.join(lessonDir, 'interactive-manifest.json');
    const graphOverlayPath = path.join(lessonDir, 'graph-overlay.json');
    const [manifest, graphOverlay, lesson, manifestHash, graphOverlayHash] = await Promise.all([
      readJson<RuntimeInteractiveManifest>(manifestPath),
      readJson<RuntimeGraphOverlay>(graphOverlayPath),
      readJson<RuntimeLessonJson>(path.join(lessonDir, 'lesson.json')),
      readLocalFileHash(manifestPath),
      readLocalFileHash(graphOverlayPath),
    ]);
    if (!manifest?.steps) continue;
    const lessonId = manifest.lesson_id ?? lesson?.lesson_id ?? lessonKey;
    const reviewSourceHash = runtimeLessonReviewSourceHash(manifestHash, graphOverlayHash);
    const stepKnowledgeNodeIds = buildRuntimeStepKnowledgeNodeMap(
      graphOverlay?.groups ?? lesson?.sequence?.groups ?? [],
    );
    for (const [stepId, step] of Object.entries(manifest.steps)) {
      const verifiedStepPath = resolveVerifiedRuntimeStepPath({
        manifest,
        lessonId,
        stepId,
        routeIndex,
      });
      const reviewedCompletionCurrent = reviewedRuntimeStepCompletionForSource(
        REVIEWED_RUNTIME_STEP_COMPLETIONS.get(`${lessonId}:${stepId}`),
        reviewSourceHash,
      );
      const manifestCitationTarget = `${projectPath(manifestPath)}#${stepId}`;
      const evidenceInstrumentation = reviewedCompletionCurrent
        ? ['interactive_step_event', 'lesson_step_view']
        : step.telemetry_spec ? ['interactive_step_event'] : [];
      candidates.push({
        id: `runtime-step:${lessonId}:${stepId}`,
        title: step.title ?? stepId,
        family: 'runtime-lesson-step',
        sourcePathOrUrl: projectPath(manifestPath),
        sourceRecord: `${lessonId}:${stepId}`,
        knowledgeNodeIds: stepKnowledgeNodeIds.get(stepId) ?? [],
        capabilityTargetIds: reviewedCompletionCurrent?.capabilityTargetIds ?? [],
        segmentRefs: [stepId],
        citationTargets: reviewedCompletionCurrent ? [manifestCitationTarget] : [],
        pathTarget: verifiedStepPath,
        estimatedTimeMinutes: reviewedCompletionCurrent?.estimatedTimeMinutes ?? normalizeEstimatedTimeMinutes(step.duration_minutes),
        evidenceInstrumentation,
        privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
        generatedBy: step.ai_context_spec ? 'template' : null,
        humanConfirmed: Boolean(reviewedCompletionCurrent),
        currentPathEligible: Boolean(reviewedCompletionCurrent),
        readiness: reviewedCompletionCurrent ? reviewedRuntimeStepReadiness(reviewedCompletionCurrent) : null,
        reviewEvidence: reviewedCompletionCurrent
          ? {
            ...REVIEWED_GRAPH_RESOURCE_REVIEWER,
            reviewedAt: REVIEWED_GRAPH_RESOURCE_REVIEWED_AT,
            reviewBatchId: reviewedCompletionCurrent.reviewBatchId ?? FOUNDATION_GRAPH_RESOURCE_BATCH_ID,
            reviewerVisibleRationale: reviewedCompletionCurrent.reviewerVisibleRationale,
            independentEvidenceRef: reviewedCompletionCurrent.independentEvidenceRef,
            reviewedSourceHash: reviewSourceHash ?? undefined,
            promptOrManifestHash: reviewSourceHash ?? undefined,
            confidence: 0.91,
          }
          : undefined,
        contentHash: manifestHash,
        versionRef: 'interactive-manifest.v2',
      });
      for (const moduleEntry of step.modules ?? []) {
        const moduleId = moduleEntry.id ?? `${stepId}:${moduleEntry.kind ?? 'module'}`;
        const modulePath = moduleEntry.payload?.src
          ? await resolveCitationTarget(lessonDir, moduleEntry.payload.src)
          : null;
        candidates.push({
          id: `runtime-module:${lessonId}:${stepId}:${moduleId}`,
          title: moduleEntry.payload?.title ?? moduleEntry.kind ?? moduleId,
          family: 'runtime-lesson-module',
          sourcePathOrUrl: projectPath(manifestPath),
          sourceRecord: `${lessonId}:${stepId}:${moduleId}`,
          knowledgeNodeIds: [],
          capabilityTargetIds: [],
          segmentRefs: [stepId, moduleId],
          citationTargets: modulePath ? [modulePath] : [],
          pathTarget: null,
          evidenceInstrumentation: moduleEntry.kind?.startsWith('interaction.') ? ['interactive_module_event'] : [],
          privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
          generatedBy: 'template',
          humanConfirmed: false,
          contentHash: manifestHash,
          versionRef: 'interactive-manifest.v2',
        });
      }
    }
  }
  return {
    candidates,
    limitations: candidates.length === 0 ? ['No runtime interactive lesson steps were found.'] : [],
  };
}

async function collectInteractiveCourseRouteIndex(): Promise<InteractiveCourseRouteIndex> {
  const routesDir = path.join(process.cwd(), 'src/app/interactive-learning/courses');
  const entries = await safeReadDir(routesDir);
  const baseSegments: string[] = [];
  const studentSegments: string[] = [];
  const teacherSegments: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const courseDir = path.join(routesDir, entry.name);
    if (await fileExists(path.join(courseDir, 'page.tsx'))) baseSegments.push(entry.name);
    if (await fileExists(path.join(courseDir, 'student/[sessionId]/page.tsx'))) studentSegments.push(entry.name);
    if (await fileExists(path.join(courseDir, 'teacher/[sessionId]/page.tsx'))) teacherSegments.push(entry.name);
  }
  return {
    baseSegments: sortedSet(baseSegments),
    studentSegments: sortedSet(studentSegments),
    teacherSegments: sortedSet(teacherSegments),
  };
}

function resolveVerifiedRuntimeStepPath(input: {
  manifest: RuntimeInteractiveManifest;
  lessonId: string;
  stepId: string;
  routeIndex: InteractiveCourseRouteIndex;
}) {
  const candidates = [
    input.manifest.steps?.[input.stepId]?.preview_contract?.demo_path,
    input.manifest.preview_mode?.student_demo_base_path
      ? `${input.manifest.preview_mode.student_demo_base_path}?step=${encodeURIComponent(input.stepId)}`
      : null,
    input.manifest.course_route_segment
      ? `/interactive-learning/courses/${input.manifest.course_route_segment}/student/demo?step=${encodeURIComponent(input.stepId)}`
      : null,
    inferRouteSegmentFromLessonId(input.lessonId, input.routeIndex.baseSegments)
      ? `/interactive-learning/courses/${inferRouteSegmentFromLessonId(input.lessonId, input.routeIndex.baseSegments)}/student/demo?step=${encodeURIComponent(input.stepId)}`
      : null,
  ];
  return candidates.find((candidate) => isVerifiedInteractiveCoursePath(candidate, input.routeIndex)) ?? null;
}

function inferRouteSegmentFromLessonId(lessonId: string, routeSegments: ReadonlySet<string>) {
  const normalized = lessonId.startsWith('unit-') ? lessonId : `unit-${lessonId}`;
  const matches = Array.from(routeSegments).filter((segment) => segment === lessonId || segment.startsWith(`${normalized}-`));
  return matches.length === 1 ? matches[0] : null;
}

function normalizeEstimatedTimeMinutes(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function isVerifiedInteractiveCoursePath(pathTarget: string | null | undefined, routeIndex: InteractiveCourseRouteIndex) {
  if (!pathTarget) return false;
  const match = pathTarget.match(/^\/interactive-learning\/courses\/([^/?#]+)(?:\/([^?#]*))?(?:[?#].*)?$/);
  if (!match?.[1]) return false;
  const [, segment, subpath = ''] = match;
  if (!subpath) return routeIndex.baseSegments.has(segment);
  const parts = subpath.split('/').filter(Boolean);
  if (parts.length === 2 && parts[0] === 'student') return routeIndex.studentSegments.has(segment);
  if (parts.length === 2 && parts[0] === 'teacher') return routeIndex.teacherSegments.has(segment);
  return false;
}

function sortedSet(values: string[]) {
  return new Set(values.sort((left, right) => left.localeCompare(right)));
}

async function collectRuntimeMediaCandidates() {
  const candidates: ResourceFieldCompletionCandidate[] = [];
  const lessonDirs = await discoverRuntimeLessonDirs();
  for (const { lessonDir, lessonKey } of lessonDirs) {
    const mediaDir = path.join(lessonDir, 'media');
    const files = await collectFiles(mediaDir);
    for (const absolutePath of files.filter(isRuntimeLessonMediaSourceFile)) {
      const relativePath = projectPath(absolutePath);
      const basename = path.basename(absolutePath);
      const mediaRelativePath = path.relative(mediaDir, absolutePath).split(path.sep).join('/');
      const contentHash = `sha256:${sha256(await fs.readFile(absolutePath))}`;
      candidates.push({
        id: `runtime-media:${lessonKey}:${mediaRelativePath}`,
        title: basename,
        family: 'runtime-lesson-media',
        sourcePathOrUrl: relativePath,
        sourceRecord: `${lessonKey}:${mediaRelativePath}`,
        knowledgeNodeIds: [],
        capabilityTargetIds: [],
        segmentRefs: [mediaRelativePath],
        citationTargets: [relativePath],
        pathTarget: `/course-runtime/lessons/${lessonKey}/media/${mediaRelativePath}`,
        evidenceInstrumentation: [],
        privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
        generatedBy: 'external-tool',
        humanConfirmed: false,
        contentHash,
        versionRef: 'runtime-lesson-media.v1',
      });
    }
  }
  return {
    candidates,
    limitations: candidates.length === 0 ? ['No runtime lesson media files were found.'] : [],
  };
}

export function isRuntimeLessonMediaSourceFile(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return extension !== '.md' && extension !== '.pdf';
}

async function collectRuntimeLessonCatalogEntries(): Promise<RuntimeLessonCatalogEntry[]> {
  const entries: RuntimeLessonCatalogEntry[] = [];
  const lessonDirs = await discoverRuntimeLessonDirs();
  for (const { lessonDir, lessonKey } of lessonDirs) {
    const [lesson, graphOverlay, mediaResources] = await Promise.all([
      readJson<RuntimeLessonJson>(path.join(lessonDir, 'lesson.json')),
      readJson<RuntimeGraphOverlay>(path.join(lessonDir, 'graph-overlay.json')),
      collectRuntimeLessonMediaResources(lessonKey, lessonDir),
    ]);
    if (!lesson || !graphOverlay) continue;
    const sourceLessonId = lesson.lesson_id ?? graphOverlay.lesson_id ?? lessonKey;
    const registryLessonId = lessonKey.includes('/') ? lessonKey : sourceLessonId;
    const handoutSourcePath = path.join('course-content/runtime/lessons', lessonKey, `${sourceLessonId}-handout.md`);
    const fallbackHandoutSourcePath = path.join('course-content/runtime/lessons', lessonKey, 'handout.md');
    const resolvedHandoutSourcePath = await fileExists(path.join(process.cwd(), handoutSourcePath))
      ? handoutSourcePath
      : fallbackHandoutSourcePath;
    const hasContentClearance = await fileExists(path.join(lessonDir, 'review', 'content-clearance.json'));
    const handoutPath = lesson.handout_path ?? `/course-runtime/lessons/${lessonKey}/${sourceLessonId}-handout.md`;
    const handoutPdfSourcePath = path.join('course-content/runtime/lessons', lessonKey, `${sourceLessonId}-handout.pdf`);
    const handoutPdfPath = await fileExists(path.join(process.cwd(), handoutPdfSourcePath)) && isGitTrackedFile(handoutPdfSourcePath)
      ? lesson.handout_pdf_path ?? `/course-runtime/lessons/${lessonKey}/${sourceLessonId}-handout.pdf`
      : null;
    entries.push({
      lesson: {
        lesson_id: registryLessonId,
        title: lesson.title ?? sourceLessonId,
      },
      graphOverlay: {
        lesson_id: registryLessonId,
        focus_node_ids: graphOverlay.focus_node_ids ?? [],
        entry_nodes: graphOverlay.entry_nodes ?? [],
        summary_nodes: graphOverlay.summary_nodes ?? [],
        card_order: graphOverlay.card_order ?? lesson.card_order ?? [],
        groups: graphOverlay.groups ?? lesson.sequence?.groups ?? [],
        nodes: graphOverlay.nodes ?? [],
      },
      handoutPath,
      handoutSourcePath: resolvedHandoutSourcePath,
      handoutSourceHash: hasContentClearance ? await readLocalFileHash(resolvedHandoutSourcePath) : null,
      handoutSourceVersionRef: hasContentClearance ? 'runtime-handout.v1' : null,
      handoutPdfPath,
      mediaResources,
    });
  }
  return entries.sort((left, right) => left.lesson.lesson_id.localeCompare(right.lesson.lesson_id));
}

function isGitTrackedFile(relativePath: string) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', relativePath], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

async function collectRuntimeLessonMediaResources(lessonDirName: string, lessonDir: string): Promise<RuntimeLessonCatalogEntry['mediaResources']> {
  const mediaDir = path.join(lessonDir, 'media');
  const mediaIndexFiles = (await safeReadDir(mediaDir))
    .filter((entry) => entry.isFile() && entry.name.endsWith('-media.md'))
    .map((entry) => path.join(mediaDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
  const resources: RuntimeLessonCatalogEntry['mediaResources'] = [];

  for (const mediaIndexPath of mediaIndexFiles) {
    const markdown = await readText(mediaIndexPath);
    if (!markdown) continue;
    resources.push(...parseRuntimeLessonMediaResources(markdown, lessonDirName));
  }

  return resources;
}

function parseRuntimeLessonMediaResources(markdown: string, lessonDirName: string): RuntimeLessonCatalogEntry['mediaResources'] {
  const resources: RuntimeLessonCatalogEntry['mediaResources'] = [];
  const lines = markdown.split(/\r?\n/);
  let currentFilename: string | null = null;
  let currentTitle: string | null = null;
  let currentUrl: string | null = null;

  const flushCurrent = () => {
    if (!currentFilename) return;
    if (!isRuntimeHandoutMarkdownFilename(currentFilename)) {
      const kind = inferRuntimeMediaKind(currentFilename);
      resources.push({
        id: normalizeRuntimeMediaId(currentFilename),
        title: currentTitle ?? currentFilename,
        kind,
        url: currentUrl,
        filename: currentFilename,
        accessMode: 'dialog',
        embedMode: kind === 'video' || kind === 'audio' ? 'none' : 'iframe',
        status: 'ready',
        featured: false,
      });
    }
    currentFilename = null;
    currentTitle = null;
    currentUrl = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const filename = headingMatch[1].trim();
      flushCurrent();
      if (!isRuntimeMediaIndexFilename(filename)) continue;
      currentFilename = filename;
      continue;
    }
    if (currentFilename && !currentTitle && line.startsWith('- ')) {
      currentTitle = line.slice(2).trim();
      continue;
    }
    if (currentFilename && !currentUrl && /^https?:\/\//i.test(line)) {
      currentUrl = line;
      continue;
    }
  }

  flushCurrent();
  return resources.map((resource) => ({
    ...resource,
    url: resource.url ?? `/course-runtime/lessons/${lessonDirName}/media/${resource.filename}`,
  }));
}

function buildRuntimeStepKnowledgeNodeMap(
  groups: Array<{ step_ids: string[]; node_ids: string[] }>,
): Map<string, string[]> {
  const result = new Map<string, Set<string>>();
  for (const group of groups) {
    for (const stepId of group.step_ids ?? []) {
      if (!result.has(stepId)) result.set(stepId, new Set());
      for (const nodeId of group.node_ids ?? []) {
        if (nodeId) result.get(stepId)?.add(nodeId);
      }
    }
  }
  return new Map(Array.from(result.entries()).map(([stepId, nodeIds]) => [
    stepId,
    Array.from(nodeIds).sort((left, right) => left.localeCompare(right)),
  ]));
}

async function collectInfographCandidates(
  knowledgeVisualReviewMap: Map<string, KnowledgeVisualSemanticReviewItem>,
) {
  const manifest = await readJson<InfographManifest>(INFOGRAPH_MANIFEST_PATH);
  const candidates = await Promise.all((manifest?.items ?? []).map(async (item): Promise<ResourceFieldCompletionCandidate> => ({
    id: `infograph:${item.nodeId ?? item.path ?? item.title}`,
    title: item.title ?? item.nodeId ?? 'Untitled infograph',
    family: 'knowledge-infograph',
    sourcePathOrUrl: item.path ?? item.url ?? null,
    sourceRecord: item.sourceNodeId ?? item.nodeId ?? null,
    knowledgeNodeIds: [item.nodeId ?? item.sourceNodeId].filter((value): value is string => Boolean(value)),
    capabilityTargetIds: [],
    segmentRefs: [],
    citationTargets: [item.url].filter((value): value is string => Boolean(value)),
    pathTarget: item.url ?? null,
    evidenceInstrumentation: [],
    privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
    generatedBy: 'external-tool',
    humanConfirmed: false,
    contentHash: item.path ? await readLocalFileHash(item.path) : null,
    versionRef: 'knowledge-infograph-manifest.v1',
  })));
  return {
    candidates: candidates.map((candidate) => applyKnowledgeVisualSemanticReview(
      candidate,
      knowledgeVisualReviewMap.get(candidate.id),
    )),
    limitations: candidates.length === 0 ? ['No knowledge infograph manifest items were found.'] : [],
  };
}

async function collectKnowledgeCardCandidates(
  knowledgeVisualReviewMap: Map<string, KnowledgeVisualSemanticReviewItem>,
) {
  const files = await collectFiles(RUNTIME_KNOWLEDGE_CARDS_DIR);
  const candidates: ResourceFieldCompletionCandidate[] = [];
  for (const filePath of files.filter((file) => file.endsWith('.md'))) {
    const markdown = await readText(filePath);
    const sourcePath = projectPath(filePath);
    const nodeId = path.basename(filePath, '.md');
    candidates.push({
      id: `knowledge-card:${nodeId}`,
      title: extractMarkdownTitle(markdown) ?? nodeId,
      family: 'knowledge-card',
      sourcePathOrUrl: sourcePath,
      sourceRecord: nodeId,
      knowledgeNodeIds: [nodeId],
      capabilityTargetIds: [],
      segmentRefs: [nodeId],
      citationTargets: [sourcePath],
      pathTarget: `/knowledge?node=${encodeURIComponent(nodeId)}`,
      evidenceInstrumentation: ['knowledge_card_open'],
      privacyScope: STUDENT_VISIBLE_AUDIT_PRIVACY_SCOPE,
      generatedBy: 'template',
      humanConfirmed: false,
      contentHash: markdown ? `sha256:${sha256(markdown)}` : null,
      versionRef: 'runtime-knowledge-card.v1',
    });
  }
  return {
    candidates: candidates.map((candidate) => applyKnowledgeVisualSemanticReview(
      candidate,
      knowledgeVisualReviewMap.get(candidate.id),
    )),
    limitations: candidates.length === 0 ? ['No runtime knowledge card markdown files were found.'] : [],
  };
}

export function listIndexedAuthoringTextbookManifestPaths(input: {
  authoringRoot?: string;
  repoRoot?: string;
} = {}): string[] {
  const repoRoot = input.repoRoot ?? process.cwd();
  const authoringRoot = input.authoringRoot ?? path.join(repoRoot, 'course-content/authoring/resources/textbooks');
  const relativeRoot = path.relative(repoRoot, authoringRoot).split(path.sep).join('/');
  const indexedPaths = execFileSync('git', ['ls-files', '--cached', '-z', '--', relativeRoot], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return indexedPaths
    .split('\0')
    .filter((filePath) => filePath.endsWith('/manifest.json'))
    .map((filePath) => path.resolve(repoRoot, filePath))
    .sort((left, right) => left.localeCompare(right));
}

async function collectAuthoringTextbookCandidates() {
  const candidates: ResourceFieldCompletionCandidate[] = [];
  const manifestPaths = listIndexedAuthoringTextbookManifestPaths();
  for (const manifestPath of manifestPaths) {
    const manifest = await readJson<AuthoringTextbookChapterManifest>(manifestPath);
    if (!manifest?.id) continue;
    const chapterSource = projectPath(manifestPath);
    const chapterDir = path.dirname(manifestPath);
    const bookId = path.basename(path.dirname(path.dirname(manifestPath)));
    const chapterId = `${bookId}:${manifest.id}`;
    const manifestHash = await readLocalFileHash(manifestPath);
    const chapterCitationTargets = await resolveCitationTargets(chapterDir, [
      manifest.sourceMarkdown,
      manifest.textbookPath,
    ]);
    candidates.push({
      id: `authoring-textbook-chapter:${chapterId}`,
      title: manifest.title ?? manifest.id,
      family: 'authoring-textbook-chapter',
      sourcePathOrUrl: chapterSource,
      sourceRecord: chapterId,
      knowledgeNodeIds: [],
      capabilityTargetIds: [],
      segmentRefs: [manifest.id],
      citationTargets: chapterCitationTargets,
      pathTarget: null,
      evidenceInstrumentation: [],
      privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
      generatedBy: manifest.pipeline ? 'external-tool' : null,
      humanConfirmed: false,
      contentHash: manifestHash,
      versionRef: 'authoring-textbook-manifest.v1',
    });
    const sectionCandidates = await collectAuthoringTextbookSectionCandidates({
      bookId,
      chapterId,
      chapterDir,
      manifest,
    });
    candidates.push(...sectionCandidates);
    for (const image of manifest.images ?? []) {
      const imageId = `${chapterId}:figure-${image.index ?? image.exportPath ?? 'unknown'}`;
      const exportPath = image.exportPath
        ? path.join(path.dirname(chapterSource), image.exportPath)
        : null;
      candidates.push({
        id: `authoring-textbook-figure:${imageId}`,
        title: `Figure ${image.index ?? image.exportPath ?? 'unknown'}`,
        family: 'authoring-textbook-figure',
        sourcePathOrUrl: exportPath,
        sourceRecord: image.sourcePath ?? chapterId,
        knowledgeNodeIds: [],
        capabilityTargetIds: [],
        segmentRefs: [manifest.id, String(image.index ?? '')].filter(Boolean),
        citationTargets: exportPath ? [exportPath] : [],
        pathTarget: null,
        evidenceInstrumentation: [],
        privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
        generatedBy: manifest.pipeline ? 'external-tool' : null,
        humanConfirmed: false,
        contentHash: image.sha256 ?? null,
        versionRef: 'authoring-textbook-manifest.v1',
      });
      candidates.push({
        id: `authoring-textbook-caption:${imageId}`,
        title: `Caption ${image.index ?? image.exportPath ?? 'unknown'}`,
        family: 'authoring-textbook-caption',
        sourcePathOrUrl: chapterSource,
        sourceRecord: image.caption ? `caption:${image.index ?? image.exportPath}` : null,
        knowledgeNodeIds: [],
        capabilityTargetIds: [],
        segmentRefs: [manifest.id, String(image.index ?? '')].filter(Boolean),
        citationTargets: exportPath ? [exportPath] : [],
        pathTarget: null,
        evidenceInstrumentation: [],
        privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
        generatedBy: manifest.pipeline ? 'external-tool' : null,
        humanConfirmed: false,
        contentHash: image.caption ? `sha256:${sha256(image.caption)}` : manifest.markdownSha256 ?? null,
        versionRef: 'authoring-textbook-manifest.v1',
      });
    }
  }
  return {
    candidates,
    limitations: candidates.length === 0 ? ['No authoring textbook chapter, figure, or caption manifests were found.'] : [],
  };
}

async function collectAuthoringTextbookSectionCandidates(input: {
  bookId: string;
  chapterId: string;
  chapterDir: string;
  manifest: AuthoringTextbookChapterManifest;
}): Promise<ResourceFieldCompletionCandidate[]> {
  if (!input.manifest.textbookPath) return [];
  const textbookPath = path.join(input.chapterDir, input.manifest.textbookPath);
  const markdown = await readText(textbookPath);
  if (!markdown) return [];
  const sourcePath = projectPath(textbookPath);
  return markdown
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => /^##\s+\S/.test(line))
    .map(({ line, lineNumber }, index): ResourceFieldCompletionCandidate => {
      const title = line.replace(/^##\s+/, '').trim();
      const sectionId = slugifyAuthoringSection(title, lineNumber, index);
      return {
        id: `authoring-textbook-section:${input.chapterId}:${sectionId}`,
        title,
        family: 'authoring-textbook-section',
        sourcePathOrUrl: sourcePath,
        sourceRecord: `${input.chapterId}:L${lineNumber}`,
        knowledgeNodeIds: [],
        capabilityTargetIds: [],
        segmentRefs: [input.manifest.id ?? input.chapterId, sectionId],
        citationTargets: [`${sourcePath}#L${lineNumber}`],
        pathTarget: null,
        evidenceInstrumentation: [],
        privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
        generatedBy: input.manifest.pipeline ? 'external-tool' : null,
        humanConfirmed: false,
        contentHash: input.manifest.markdownSha256 ?? null,
        versionRef: 'authoring-textbook-manifest.v1',
      };
    });
}

async function safeReadDir(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await safeReadDir(root);
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectFiles(absolutePath);
    if (entry.isFile()) return [absolutePath];
    return [];
  }));
  return nested.flat().sort((left, right) => left.localeCompare(right));
}

async function discoverRuntimeLessonDirs(): Promise<RuntimeLessonDir[]> {
  const lessons: RuntimeLessonDir[] = [];

  async function visit(dir: string) {
    const entries = await safeReadDir(dir);
    const hasLessonJson = entries.some((entry) => entry.isFile() && entry.name === 'lesson.json');
    if (hasLessonJson) {
      lessons.push({
        lessonKey: path.relative(RUNTIME_LESSONS_DIR, dir).split(path.sep).join('/'),
        lessonDir: dir,
      });
      return;
    }

    await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => visit(path.join(dir, entry.name))));
  }

  await visit(RUNTIME_LESSONS_DIR);
  return lessons.sort((left, right) => left.lessonKey.localeCompare(right.lessonKey));
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readLocalFileHash(sourcePath: string) {
  if (/^https?:\/\//i.test(sourcePath)) return null;
  try {
    const absolutePath = path.isAbsolute(sourcePath)
      ? sourcePath
      : path.join(process.cwd(), sourcePath);
    return `sha256:${sha256(await fs.readFile(absolutePath))}`;
  } catch {
    return null;
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

function projectPath(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath);
}

async function resolveCitationTargets(baseDir: string, sources: Array<string | null | undefined>) {
  const resolved = await Promise.all(sources.map((source) => resolveCitationTarget(baseDir, source)));
  return resolved.filter((value): value is string => Boolean(value));
}

async function resolveCitationTarget(baseDir: string, source: string | null | undefined) {
  if (!source) return null;
  if (/^https?:\/\//i.test(source) || source.startsWith('/')) return source;
  const absolutePath = path.isAbsolute(source)
    ? source
    : path.resolve(baseDir, source);
  try {
    await fs.access(absolutePath);
    return projectPath(absolutePath);
  } catch {
    return null;
  }
}

function inferRuntimeMediaKind(filename: string): RuntimeLessonMediaKind {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.mp4' || ext === '.webm') return 'video';
  if (ext === '.m4a' || ext === '.mp3' || ext === '.wav') return 'audio';
  if (ext === '.pdf' && /(^|[-_])slides(?:[-_.]|$)/i.test(path.basename(filename))) return 'slides';
  if (ext === '.pdf') return 'pdf';
  return 'other';
}

function normalizeRuntimeMediaId(filename: string) {
  return filename.replace(/\.[^.]+$/, '');
}

function isRuntimeHandoutMarkdownFilename(filename: string) {
  return filename === 'handout.md' || /-handout\.md$/i.test(filename);
}

function isRuntimeMediaIndexFilename(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (!ext) return false;
  if (isRuntimeHandoutMarkdownFilename(filename)) return true;
  return ['.mp4', '.webm', '.m4a', '.mp3', '.wav', '.pdf'].includes(ext);
}

function slugifyAuthoringSection(title: string, lineNumber: number, index: number) {
  const compact = title
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${String(index + 1).padStart(3, '0')}-${compact || `line-${lineNumber}`}`;
}

function extractMarkdownTitle(markdown: string | null) {
  if (!markdown) return null;
  const titleLine = markdown.split(/\r?\n/).find((line) => /^#\s+\S/.test(line));
  return titleLine?.replace(/^#\s+/, '').trim() ?? null;
}

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function isResourceFieldCompletionAuditCliEntrypoint(
  moduleUrl = import.meta.url,
  mainFilename = createRequire(moduleUrl).main?.filename,
) {
  return mainFilename !== undefined && fileURLToPath(moduleUrl) === mainFilename;
}

if (isResourceFieldCompletionAuditCliEntrypoint()) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
