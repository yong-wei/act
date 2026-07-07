import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  loadAllTextbookRuntimeResourceCatalogEntries,
  loadAllTextbookRuntimeSearchDocuments,
} from '@/lib/textbook-runtime-resources';
import type { RuntimeLessonMediaKind } from '@/lib/course-runtime';
import {
  buildResourceFieldCompletionAudit,
  type ResourceEvidenceLineageReadinessItem,
  type ResourceEvidenceLineageReadinessSummary,
  type ResourceFieldCompletionAuditRow,
  type ResourceFieldCompletionCandidate,
  type ResourceFieldMissingCode,
  YANGFAN_FIXTURE_READINESS_SCOPE_POLICY_VERSION,
} from '@/lib/resource-field-completion-audit';
import {
  buildLearningGoalResourceBaselineArtifacts,
} from '@/lib/learning-goal-resource-baseline';
import {
  buildFullResourcePathReadinessGate,
  buildLearningGoalPathGenerationDiagnostics,
  renderFullResourcePathReadinessGateEvidence,
} from '@/lib/full-resource-path-readiness-gate';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '@/lib/adaptive-learning-path-planner';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { buildResourceNodeRegistryFromTeachingResources } from '@/lib/teacher-resource-node-data';
import { buildRuntimeResourceProjectionArtifacts } from '@/lib/runtime-resource-projections';

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
const HUMAN_REVIEW_INTEGRITY_JSON_PATH = path.join(OUTPUT_DIR, 'resource-human-review-integrity-diagnostics.json');
const PROJECTION_JSONL_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projections.jsonl');
const PROJECTION_LIMITATIONS_PATH = path.join(OUTPUT_DIR, 'runtime-resource-projection-limitations.json');
const BASELINE_MATRIX_JSON_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-matrix.json');
const BASELINE_LIMITATIONS_JSON_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-limitations.json');
const BASELINE_REVIEWED_BINDINGS_JSONL_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-reviewed-bindings.jsonl');
const FULL_RESOURCE_PATH_READINESS_GATE_JSON_PATH = path.join(OUTPUT_DIR, 'full-resource-path-readiness-gate-summary.json');
const FULL_RESOURCE_PATH_READINESS_GATE_EVIDENCE_MD_PATH = path.join(OUTPUT_DIR, 'full-resource-path-readiness-gate-evidence.md');
const RUNTIME_LESSONS_DIR = path.join(process.cwd(), 'course-content/runtime/lessons');
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

type ResidualDispositionClassification =
  | 'path-plannable'
  | 'supporting-citation'
  | 'embedded-asset'
  | 'evidence-producing'
  | 'excluded-with-rationale';

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
  const generatedAt = process.env.RESOURCE_FIELD_COMPLETION_GENERATED_AT ?? new Date().toISOString();
  const [runtimeLessons, runtimeTextbooks, textbookDocuments] = await Promise.all([
    collectRuntimeLessonCatalogEntries(),
    loadAllTextbookRuntimeResourceCatalogEntries().catch(() => []),
    loadAllTextbookRuntimeSearchDocuments().catch(() => []),
  ]);
  const registry = buildResourceNodeRegistryFromTeachingResources(
    [],
    getAllRegisteredResourceMetadata(),
    runtimeLessons,
    runtimeTextbooks,
  );
  const { candidates, limitations } = await collectAuditOnlyCandidates(textbookDocuments);
  const result = buildResourceFieldCompletionAudit({
    registry,
    candidates,
    generatedAt,
    sourceWindow: { from: null, to: generatedAt },
    limitations,
  });
  const projectionArtifacts = buildRuntimeResourceProjectionArtifacts({
    auditRows: result.rows,
    generatedAt,
  });
  const baselineArtifacts = buildLearningGoalResourceBaselineArtifacts({
    registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
    auditRows: result.rows,
    generatedAt,
    sourceWindow: { from: null, to: generatedAt },
  });
  const dispositionReviewItems = await buildResidualDispositionReviewItems(result.rows);
  const dispositionReviewSummary = buildResidualDispositionReviewSummary(dispositionReviewItems, result.workqueues);
  const reviewedEvidenceLineage = buildReviewedEvidenceLineageReadiness(
    result.evidenceLineage,
    dispositionReviewItems,
  );
  const workqueueItems = flattenWorkqueueItems(result.workqueues);
  const pathGenerationDiagnostics = buildLearningGoalPathGenerationDiagnostics({
    registeredGoals: ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
    registry,
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

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(
    AUDIT_JSONL_PATH,
    `${result.rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(SUMMARY_JSON_PATH, `${JSON.stringify(result.summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    WORKQUEUE_ITEMS_JSONL_PATH,
    `${workqueueItems.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(
    WORKQUEUE_SUMMARY_JSON_PATH,
    `${JSON.stringify(compactWorkqueueSummary(result.workqueues), null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    WORKQUEUE_MARKDOWN_PATH,
    renderWorkqueueMarkdown(result.workqueues, generatedAt),
    'utf8',
  );
  await fs.writeFile(
    EVIDENCE_LINEAGE_ITEMS_JSONL_PATH,
    `${reviewedEvidenceLineage.items.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(
    EVIDENCE_LINEAGE_SUMMARY_JSON_PATH,
    `${JSON.stringify(reviewedEvidenceLineage.summary, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    EVIDENCE_LINEAGE_EVIDENCE_MD_PATH,
    renderEvidenceLineageReadinessEvidence(reviewedEvidenceLineage.summary),
    'utf8',
  );
  await fs.writeFile(
    DISPOSITION_REVIEW_ITEMS_JSONL_PATH,
    `${dispositionReviewItems.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(
    DISPOSITION_REVIEW_SUMMARY_JSON_PATH,
    `${JSON.stringify(dispositionReviewSummary, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    DISPOSITION_REVIEW_EVIDENCE_MD_PATH,
    renderResidualDispositionReviewEvidence(dispositionReviewSummary),
    'utf8',
  );
  await fs.writeFile(
    HUMAN_REVIEW_INTEGRITY_JSON_PATH,
    `${JSON.stringify(result.integrityDiagnostics, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    PROJECTION_JSONL_PATH,
    `${projectionArtifacts.rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(
    PROJECTION_LIMITATIONS_PATH,
    `${JSON.stringify(projectionArtifacts.limitations, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    BASELINE_MATRIX_JSON_PATH,
    `${JSON.stringify(baselineArtifacts.matrix, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    BASELINE_LIMITATIONS_JSON_PATH,
    `${JSON.stringify(baselineArtifacts.limitations, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    BASELINE_REVIEWED_BINDINGS_JSONL_PATH,
    `${baselineArtifacts.reviewedBindings.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  await fs.writeFile(
    FULL_RESOURCE_PATH_READINESS_GATE_JSON_PATH,
    `${JSON.stringify(fullResourcePathReadinessGate, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(
    FULL_RESOURCE_PATH_READINESS_GATE_EVIDENCE_MD_PATH,
    renderFullResourcePathReadinessGateEvidence(fullResourcePathReadinessGate),
    'utf8',
  );

  console.log(`Resource field completion audit rows: ${result.rows.length}`);
  console.log(`Summary: ${path.relative(process.cwd(), SUMMARY_JSON_PATH)}`);
  console.log(`JSONL: ${path.relative(process.cwd(), AUDIT_JSONL_PATH)}`);
  console.log(`Resource completion workqueue items: ${result.workqueues.primaryQueueItems + result.workqueues.dependentQueueItems}`);
  console.log(`Workqueue summary: ${path.relative(process.cwd(), WORKQUEUE_SUMMARY_JSON_PATH)}`);
  console.log(`Workqueue JSONL: ${path.relative(process.cwd(), WORKQUEUE_ITEMS_JSONL_PATH)}`);
  console.log(`Evidence-lineage blockers: ${reviewedEvidenceLineage.summary.evidenceLineageBlockerCount}`);
  console.log(`Evidence-lineage summary: ${path.relative(process.cwd(), EVIDENCE_LINEAGE_SUMMARY_JSON_PATH)}`);
  console.log(`Evidence-lineage JSONL: ${path.relative(process.cwd(), EVIDENCE_LINEAGE_ITEMS_JSONL_PATH)}`);
  console.log(`Residual disposition review rows: ${dispositionReviewItems.length}`);
  console.log(`Residual disposition summary: ${path.relative(process.cwd(), DISPOSITION_REVIEW_SUMMARY_JSON_PATH)}`);
  console.log(`Human review integrity issues: ${result.integrityDiagnostics.invalidHumanConfirmedRows}`);
  console.log(`Runtime resource projections: ${projectionArtifacts.rows.length}`);
  console.log(`Projection summary: ${path.relative(process.cwd(), PROJECTION_LIMITATIONS_PATH)}`);
  console.log(`Projection JSONL: ${path.relative(process.cwd(), PROJECTION_JSONL_PATH)}`);
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
    queueId: queue.id,
    sourceFamily: queue.sourceFamily,
    learningGoalId: queue.learningGoalId,
    graphDomain: queue.graphDomain,
    missingFieldCode: queue.missingFieldCode,
    followupBucket: queue.followupBucket,
    dependencyState: queue.dependencyState,
    ...item,
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
  return rows.filter((row) => row.missingFieldCodes.length > 0).map((row) => {
    const reviewSource = reviewSources.get(row.resourceId);
    const classification = reviewSource?.classification ?? residualDispositionClassificationFor(row);
    const downstreamBlockers = downstreamBlockersFor(row.missingFieldCodes);
    const unresolvedDispositionBlocker = isDispositionReviewUnresolved(row, reviewSource);
    return {
      artifactVersion: 'resource-disposition-backlog-review.v1',
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
      privacyMinimized: true,
      rawContentIncluded: false,
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
  return sources;
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

async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

async function collectAuditOnlyCandidates(textbookDocuments: Awaited<ReturnType<typeof loadAllTextbookRuntimeSearchDocuments>>) {
  const [
    runtimeManifestCandidates,
    runtimeMediaCandidates,
    knowledgeCardCandidates,
    infographCandidates,
    authoringTextbookCandidates,
  ] = await Promise.all([
    collectRuntimeManifestCandidates(),
    collectRuntimeMediaCandidates(),
    collectKnowledgeCardCandidates(),
    collectInfographCandidates(),
    collectAuthoringTextbookCandidates(),
  ]);
  const textbookDocumentCandidates = textbookDocuments.map<ResourceFieldCompletionCandidate>((document) => ({
    id: `textbook-search-document:${document.id}`,
    title: document.title,
    family: 'textbook-search-document',
    sourcePathOrUrl: document.href,
    sourceRecord: document.metadata.bookId,
    knowledgeNodeIds: document.resourceProjection.knowledgeNodeRefs,
    capabilityTargetIds: document.resourceProjection.capabilityTargetRefs,
    segmentRefs: [document.resourceProjection.segmentRef].filter(Boolean),
    citationTargets: [document.resourceProjection.citationTargetRef ?? document.href].filter((value): value is string => Boolean(value)),
    pathTarget: null,
    evidenceInstrumentation: ['textbook_search_document_retrieved'],
    privacyScope: UNCLASSIFIED_AUDIT_PRIVACY_SCOPE,
    contentHash: document.contentHash,
    versionRef: 'textbook-runtime-search-documents.v1',
    humanConfirmed: false,
  }));

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
            promptOrManifestHash: reviewSourceHash,
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
    for (const absolutePath of files.filter((file) => !file.endsWith('.md'))) {
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
    const handoutPath = lesson.handout_path ?? `/course-runtime/lessons/${lessonKey}/${sourceLessonId}-handout.md`;
    const handoutPdfPath = await fileExists(path.join(lessonDir, `${sourceLessonId}-handout.pdf`))
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
      handoutSourcePath: await fileExists(path.join(process.cwd(), handoutSourcePath))
        ? handoutSourcePath
        : fallbackHandoutSourcePath,
      handoutPdfPath,
      mediaResources,
    });
  }
  return entries.sort((left, right) => left.lesson.lesson_id.localeCompare(right.lesson.lesson_id));
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

async function collectInfographCandidates() {
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
    candidates,
    limitations: candidates.length === 0 ? ['No knowledge infograph manifest items were found.'] : [],
  };
}

async function collectKnowledgeCardCandidates() {
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
    candidates,
    limitations: candidates.length === 0 ? ['No runtime knowledge card markdown files were found.'] : [],
  };
}

async function collectAuthoringTextbookCandidates() {
  const candidates: ResourceFieldCompletionCandidate[] = [];
  const manifestPaths = await collectFiles(AUTHORING_TEXTBOOK_ROOT);
  for (const manifestPath of manifestPaths.filter((file) => file.endsWith('/manifest.json'))) {
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
