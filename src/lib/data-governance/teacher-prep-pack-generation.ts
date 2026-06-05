import type { ResourceNode } from '@/lib/resource-node-registry';

import type {
  ControlCorrectionTeacherReport,
  ControlCorrectionReportMetric,
} from './control-correction-teacher-report';
import type {
  LearningEvidenceConfidence,
  LearningEvidenceCorpusChunk,
  LearningEvidenceCorpusSourceType,
} from './learning-evidence-rag-corpus';
import type {
  RoleBasedLearningDiagnosis,
  RoleBasedLearningDiagnosisRootCauseCluster,
} from './role-based-learning-diagnosis';

export const TEACHER_PREP_PACK_GENERATION_VERSION = 'teacher-prep-pack-generation.v1';

export type TeacherPrepPackCandidateType =
  | 'interactive-question'
  | 'knowledge-card'
  | 'micro-simulation'
  | 'arena-task'
  | 'reflection-prompt'
  | 'konling-prompt'
  | 'teacher-note';

export type TeacherPrepPackReviewState = 'draft' | 'edited' | 'approved' | 'rejected' | 'exported';

export type TeacherPrepPackTargetType =
  | 'lesson-stage'
  | 'lesson-step'
  | 'resource-node'
  | 'class-session'
  | 'teacher-export'
  | 'draft-resource-request';

export interface TeacherPrepPackEvidenceBasis {
  sourceType: LearningEvidenceCorpusSourceType | 'role-diagnosis' | 'teacher-report' | 'path-outcome' | 'grading-summary';
  sourceId: string;
  displayTitle: string;
  capsule: string;
  confidence: LearningEvidenceConfidence;
  privacy: 'aggregate' | 'scoped-summary' | 'stable-reference' | 'redacted-capsule';
}

export interface TeacherPrepPackAffectedGroup {
  kind: 'class' | 'cluster' | 'subset';
  label: string;
  count: number;
  denominator: number;
  dimensionId?: string;
}

export interface TeacherPrepPackInsertionTarget {
  type: TeacherPrepPackTargetType;
  lessonId?: string;
  lessonStage?: 'bridge-in' | 'objective' | 'pre-assessment' | 'participatory-learning' | 'post-assessment' | 'summary';
  lessonStepId?: string;
  resourceNodeId?: string;
  draftRequestReason?: string;
}

export interface TeacherPrepPackCandidateItem {
  id: string;
  itemType: TeacherPrepPackCandidateType;
  title: string;
  rationale: string;
  affectedGroup: TeacherPrepPackAffectedGroup;
  evidenceBasis: TeacherPrepPackEvidenceBasis[];
  insertionTarget: TeacherPrepPackInsertionTarget;
  estimatedTimeMinutes: number;
  confidence: {
    state: LearningEvidenceConfidence;
    score: number;
    limitations: string[];
  };
  methodologyNotes: string[];
  review: {
    state: TeacherPrepPackReviewState;
    reviewerId: string | null;
    reviewedAt: string | null;
    notes: string | null;
  };
  linkedResource?: {
    nodeId: string;
    title: string;
    type: ResourceNode['type'];
    launchTarget: string | null;
  };
  draftResourceRequest?: {
    reason: string;
    requiredReview: true;
  };
  privacyMetadata: {
    rawStudentData: 'omitted';
    privateKonlingMemory: 'omitted';
    hiddenArenaInternals: 'omitted';
    rawTraces: 'omitted';
  };
}

export interface TeacherPrepPack {
  version: typeof TEACHER_PREP_PACK_GENERATION_VERSION;
  id: string;
  teacherId: string;
  classId: string;
  goalId: string;
  nextLesson: {
    lessonId: string;
    title: string;
    plannedAt: string | null;
  };
  generatedAt: string;
  status: 'draft' | 'partially-approved' | 'approved' | 'exported';
  candidates: TeacherPrepPackCandidateItem[];
  methodology: {
    inputs: string[];
    candidatePolicy: 'resource-linked-or-draft-request';
    teacherReviewRequired: true;
  };
  privacyPolicy: {
    ordinaryPayload: 'aggregate-and-redacted-only';
    forbiddenContent: string[];
  };
}

export interface TeacherPrepPackInput {
  teacherId: string;
  classId: string;
  goalId: string;
  nextLesson: TeacherPrepPack['nextLesson'] & {
    stages?: Array<{ id: string; stage: TeacherPrepPackInsertionTarget['lessonStage']; title: string }>;
  };
  diagnosis?: RoleBasedLearningDiagnosis | null;
  teacherReport?: ControlCorrectionTeacherReport | null;
  pathOutcomes?: Array<Record<string, unknown>>;
  gradingSummaries?: Array<Record<string, unknown>>;
  resourceNodes?: ResourceNode[];
  evidenceCorpus?: LearningEvidenceCorpusChunk[];
  now?: Date;
}

export interface TeacherPrepPackExportPayload {
  prepPackId: string;
  classId: string;
  goalId: string;
  exportedAt: string;
  items: Array<{
    id: string;
    itemType: TeacherPrepPackCandidateType;
    title: string;
    insertionTarget: TeacherPrepPackInsertionTarget;
    estimatedTimeMinutes: number;
    evidenceBasis: TeacherPrepPackEvidenceBasis[];
  }>;
  redactionPolicy: TeacherPrepPack['privacyPolicy'];
}

export interface TeacherPrepPackInsertionPayload {
  prepPackId: string;
  classId: string;
  goalId: string;
  generatedAt: string;
  items: Array<{
    id: string;
    itemType: TeacherPrepPackCandidateType;
    title: string;
    insertionTarget: TeacherPrepPackInsertionTarget;
    linkedResource: NonNullable<TeacherPrepPackCandidateItem['linkedResource']>;
    estimatedTimeMinutes: number;
  }>;
}

export function generateTeacherPrepPack(input: TeacherPrepPackInput): TeacherPrepPack {
  const now = input.now ?? new Date();
  const candidates = [
    ...candidatesFromDiagnosis(input),
    ...candidatesFromTeacherNotes(input),
    ...candidatesFromTeacherReport(input),
    ...candidatesFromPathOutcomes(input),
    ...candidatesFromGradingSummaries(input),
  ];
  const deduped = dedupeCandidates(candidates)
    .map((item, index) => ({ ...item, id: `${input.goalId}:prep:${index + 1}:${item.itemType}` }));

  return {
    version: TEACHER_PREP_PACK_GENERATION_VERSION,
    id: `prep-pack:${input.classId}:${input.goalId}:${dateKey(now)}`,
    teacherId: input.teacherId,
    classId: input.classId,
    goalId: input.goalId,
    nextLesson: {
      lessonId: input.nextLesson.lessonId,
      title: input.nextLesson.title,
      plannedAt: input.nextLesson.plannedAt,
    },
    generatedAt: now.toISOString(),
    status: 'draft',
    candidates: deduped,
    methodology: {
      inputs: materializationInputs(input),
      candidatePolicy: 'resource-linked-or-draft-request',
      teacherReviewRequired: true,
    },
    privacyPolicy: {
      ordinaryPayload: 'aggregate-and-redacted-only',
      forbiddenContent: [
        'raw-answer-body',
        'private-konling-memory',
        'hidden-arena-internals',
        'raw-high-frequency-trace',
        'secret',
      ],
    },
  };
}

export function reviewTeacherPrepPackItem(input: {
  item: TeacherPrepPackCandidateItem;
  reviewerId: string;
  teacherId: string;
  authorizedReviewerIds?: string[];
  decision: 'approve' | 'reject' | 'edit';
  notes?: string;
  patch?: Partial<Pick<TeacherPrepPackCandidateItem, 'title' | 'rationale' | 'estimatedTimeMinutes' | 'insertionTarget'>>;
  now?: Date;
}): TeacherPrepPackCandidateItem {
  const reviewedAt = (input.now ?? new Date()).toISOString();
  const reviewerId = sanitizeReviewerId(input.reviewerId);
  const patched = applyCandidatePatch(input.item, input.patch);
  const authorizedReviewerIds = input.authorizedReviewerIds ?? [input.teacherId];
  const canReview = Boolean(reviewerId) && authorizedReviewerIds.includes(reviewerId);
  const canApprove = input.decision === 'approve' && canReview && validateTeacherPrepPackItem({
    ...patched,
    review: {
      state: 'approved',
      reviewerId,
      reviewedAt,
      notes: input.notes ?? null,
    },
  }).length === 0;
  const state: TeacherPrepPackReviewState =
    canApprove ? 'approved' :
      input.decision === 'reject' ? 'rejected' : 'edited';
  return {
    ...patched,
    review: {
      state,
      reviewerId,
      reviewedAt,
      notes: input.notes ?? null,
    },
  };
}

export function buildTeacherPrepPackExportPayload(input: {
  pack: TeacherPrepPack;
  authorizedReviewerIds?: string[];
  now?: Date;
}): TeacherPrepPackExportPayload {
  const approved = input.pack.candidates.filter((item) =>
    isTeacherPrepPackItemApprovedByAuthorizedReviewer(item, input.pack, input.authorizedReviewerIds)
  );
  return {
    prepPackId: input.pack.id,
    classId: input.pack.classId,
    goalId: input.pack.goalId,
    exportedAt: (input.now ?? new Date()).toISOString(),
    items: approved.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      title: item.title,
      insertionTarget: item.insertionTarget,
      estimatedTimeMinutes: item.estimatedTimeMinutes,
      evidenceBasis: item.evidenceBasis,
    })),
    redactionPolicy: input.pack.privacyPolicy,
  };
}

export function buildTeacherPrepPackInsertionPayload(input: {
  pack: TeacherPrepPack;
  authorizedReviewerIds?: string[];
  now?: Date;
}): TeacherPrepPackInsertionPayload {
  const insertable = input.pack.candidates.filter((item) =>
    isTeacherPrepPackInsertionEligible(item, input.pack, input.authorizedReviewerIds)
  );
  return {
    prepPackId: input.pack.id,
    classId: input.pack.classId,
    goalId: input.pack.goalId,
    generatedAt: (input.now ?? new Date()).toISOString(),
    items: insertable.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      title: item.title,
      insertionTarget: item.insertionTarget,
      linkedResource: item.linkedResource!,
      estimatedTimeMinutes: item.estimatedTimeMinutes,
    })),
  };
}

export function isTeacherPrepPackInsertionEligible(
  item: TeacherPrepPackCandidateItem,
  pack: Pick<TeacherPrepPack, 'teacherId'>,
  authorizedReviewerIds?: string[],
): boolean {
  return isTeacherPrepPackItemApprovedByAuthorizedReviewer(item, pack, authorizedReviewerIds) &&
    Boolean(item.linkedResource) &&
    item.insertionTarget.type !== 'draft-resource-request';
}

export function validateTeacherPrepPack(pack: TeacherPrepPack): string[] {
  const errors: string[] = [];
  if (pack.version !== TEACHER_PREP_PACK_GENERATION_VERSION) errors.push('invalid-version');
  if (!pack.teacherId) errors.push('missing-teacher-id');
  if (!pack.classId) errors.push('missing-class-id');
  if (!pack.goalId) errors.push('missing-goal-id');
  if (!pack.nextLesson.lessonId) errors.push('missing-next-lesson');
  for (const item of pack.candidates) {
    errors.push(...validateTeacherPrepPackItem(item));
  }
  if (containsForbiddenPayload(pack.candidates)) errors.push('ordinary-payload-contains-private-content');
  return Array.from(new Set(errors));
}

export function validateTeacherPrepPackItem(item: TeacherPrepPackCandidateItem): string[] {
  const errors: string[] = [];
  if (!item.id) errors.push('item-missing-id');
  if (!item.title) errors.push('item-missing-title');
  if (!item.itemType) errors.push('item-missing-type');
  if (!item.rationale) errors.push('item-missing-rationale');
  if (!item.affectedGroup || item.affectedGroup.denominator <= 0) errors.push('item-missing-affected-group');
  if (item.affectedGroup && (item.affectedGroup.count < 0 || item.affectedGroup.count > item.affectedGroup.denominator)) {
    errors.push('item-invalid-affected-group');
  }
  if (!Array.isArray(item.evidenceBasis) || item.evidenceBasis.length === 0) errors.push('item-missing-evidence');
  if (!item.insertionTarget?.type) errors.push('item-missing-insertion-target');
  if (item.estimatedTimeMinutes <= 0) errors.push('item-missing-estimated-time');
  if (!item.confidence?.state) errors.push('item-missing-confidence');
  if (item.confidence && (item.confidence.score < 0 || item.confidence.score > 1)) errors.push('item-invalid-confidence-score');
  if (!Array.isArray(item.methodologyNotes) || item.methodologyNotes.length === 0) errors.push('item-missing-methodology');
  if (!item.review?.state) errors.push('item-missing-review-state');
  if (item.review?.state === 'approved' && (!item.review.reviewerId || !item.review.reviewedAt)) {
    errors.push('approved-item-missing-reviewer');
  }
  if (!item.linkedResource && item.insertionTarget.type !== 'draft-resource-request') {
    errors.push('item-without-source-support');
  }
  if (item.insertionTarget.type === 'draft-resource-request' && !item.draftResourceRequest?.requiredReview) {
    errors.push('draft-request-missing-review');
  }
  if (containsForbiddenPayload(item)) errors.push('item-contains-private-content');
  return errors;
}

function candidatesFromDiagnosis(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const diagnosis = input.diagnosis;
  if (!diagnosis || diagnosis.view !== 'teacher-class') return [];
  return diagnosis.rootCauseClusters
    .filter((cluster) => cluster.interventionPriority !== 'low')
    .map((cluster) => {
      const resource = matchResource(input, cluster.dimensionId, ['quiz', 'knowledge_card', 'lesson_step']);
      return candidate({
        input,
        itemType: resource?.type === 'knowledge_card' ? 'knowledge-card' : 'interactive-question',
        title: `${cluster.label} 针对性课堂补强`,
        rationale: `${cluster.affectedPopulation}/${cluster.denominator} 名学生在 ${cluster.label} 上需要关注。`,
        affectedGroup: affectedGroupFromCluster(cluster),
        evidenceBasis: [
          evidenceFromDiagnosisCluster(cluster),
          ...evidenceFromDiagnosisRefs(diagnosis).slice(0, 2),
        ],
        resource,
        target: targetForResource(resource, input, 'participatory-learning'),
        estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 8,
        confidence: confidenceScore(cluster.confidence, cluster.affectedPopulation, cluster.denominator),
        methodologyNotes: [
          'Generated from teacher-class diagnosis root-cause clusters.',
          'Candidate remains draft until teacher approval.',
        ],
      });
    });
}

function candidatesFromTeacherNotes(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const diagnosis = input.diagnosis;
  if (!diagnosis || diagnosis.view !== 'teacher-class') return [];
  const clusters = diagnosis.rootCauseClusters.filter((cluster) => cluster.interventionPriority !== 'low');
  if (clusters.length === 0) return [];
  const topCluster = clusters[0];
  const resource = matchResource(input, `${topCluster.dimensionId} teacher note`, ['lesson_step', 'handout', 'knowledge_card']);
  return [candidate({
    input,
    itemType: 'teacher-note',
    title: `${input.nextLesson.title} 教师备课提示`,
    rationale: `下一课需要优先关注 ${topCluster.label}，并保留课堂观察记录。`,
    affectedGroup: {
      kind: 'class',
      label: '下一课教师备课关注点',
      count: Math.max(...clusters.map((cluster) => cluster.affectedPopulation)),
      denominator: Math.max(...clusters.map((cluster) => cluster.denominator)),
      dimensionId: topCluster.dimensionId,
    },
    evidenceBasis: clusters.slice(0, 3).map(evidenceFromDiagnosisCluster),
    resource,
    target: targetForResource(resource, input, 'bridge-in'),
    estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 4,
    confidence: confidenceScore(topCluster.confidence, topCluster.affectedPopulation, topCluster.denominator),
    methodologyNotes: [
      'Generated as a teacher-facing prep note from class diagnosis clusters.',
      'Teacher note is not automatically inserted unless a governed resource is linked and approved.',
    ],
  })];
}

function candidatesFromTeacherReport(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const report = input.teacherReport;
  if (!report) return [];
  const items: TeacherPrepPackCandidateItem[] = [];
  const simulationMetric = report.metrics.simulationPassRate;
  if (isWeakMetric(simulationMetric)) {
    const resource = matchResource(input, 'simulation', ['simulation']);
    items.push(candidate({
      input,
      itemType: 'micro-simulation',
      title: '终端仿真验证微实验',
      rationale: `${simulationMetric.label} 偏低，下一课需要用短时仿真复核校正效果。`,
      affectedGroup: affectedGroupFromMetric(simulationMetric),
      evidenceBasis: [evidenceFromMetric(simulationMetric)],
      resource,
      target: targetForResource(resource, input, 'participatory-learning'),
      estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 12,
      confidence: confidenceScore(simulationMetric.confidence, simulationMetric.includedPopulation, simulationMetric.denominator),
      methodologyNotes: ['Generated from governed teacher report metrics.'],
    }));
  }
  const arenaMetric = report.metrics.arenaValidSubmissionRate;
  if (isWeakMetric(arenaMetric)) {
    const resource = matchResource(input, 'arena', ['arena_task']);
    items.push(candidate({
      input,
      itemType: 'arena-task',
      title: 'Arena 有效提交复盘任务',
      rationale: `${arenaMetric.label} 偏低，安排一个可控范围内的提交复盘。`,
      affectedGroup: affectedGroupFromMetric(arenaMetric),
      evidenceBasis: [evidenceFromMetric(arenaMetric)],
      resource,
      target: targetForResource(resource, input, 'post-assessment'),
      estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 10,
      confidence: confidenceScore(arenaMetric.confidence, arenaMetric.includedPopulation, arenaMetric.denominator),
      methodologyNotes: ['Generated from Arena-valid submission metric with explicit denominator.'],
    }));
  }
  return items;
}

function candidatesFromPathOutcomes(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const deviations = input.pathOutcomes?.filter((path) => numberValue(path.deviationCount) > 0) ?? [];
  if (deviations.length === 0) return [];
  const resource = matchResource(input, 'reflection', ['reflection']);
  return [candidate({
    input,
    itemType: 'reflection-prompt',
    title: '学习路径偏离反思提示',
    rationale: `${deviations.length} 条路径存在偏离，需要课堂内短反思明确下一步。`,
    affectedGroup: {
      kind: 'subset',
      label: '路径偏离学生',
      count: deviations.length,
      denominator: Math.max(input.pathOutcomes?.length ?? deviations.length, deviations.length),
    },
    evidenceBasis: [{
      sourceType: 'path-outcome',
      sourceId: 'path-outcome-summary',
      displayTitle: '路径偏离摘要',
      capsule: `${deviations.length} 条路径存在偏离。`,
      confidence: 'medium',
      privacy: 'aggregate',
    }],
    resource,
    target: targetForResource(resource, input, 'summary'),
    estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 5,
    confidence: confidenceScore('medium', deviations.length, Math.max(input.pathOutcomes?.length ?? deviations.length, deviations.length)),
    methodologyNotes: ['Generated from aggregate path outcome counts.'],
  })];
}

function candidatesFromGradingSummaries(input: TeacherPrepPackInput): TeacherPrepPackCandidateItem[] {
  const weak = input.gradingSummaries?.filter((summary) => numberValue(summary.averageScore) < numberValue(summary.maxScore, 1) * 0.7) ?? [];
  if (weak.length === 0) return [];
  const resource = matchResource(input, 'konling', ['ai_intervention']);
  return [candidate({
    input,
    itemType: 'konling-prompt',
    title: '批改反馈后的控灵追问',
    rationale: '文档评分显示部分量规项需要下一课前的追问与澄清。',
    affectedGroup: {
      kind: 'subset',
      label: '批改低分学生',
      count: weak.length,
      denominator: Math.max(input.gradingSummaries?.length ?? weak.length, weak.length),
    },
    evidenceBasis: weak.slice(0, 3).map((summary, index) => ({
      sourceType: 'grading-summary' as const,
      sourceId: stringValue(summary.id) ?? `grading-summary-${index + 1}`,
      displayTitle: stringValue(summary.title) ?? '文档批改摘要',
      capsule: stringValue(summary.redactedSummary) ?? '量规项存在待改进表现。',
      confidence: confidenceValue(summary.confidence) ?? 'medium',
      privacy: 'redacted-capsule' as const,
    })),
    resource,
    target: targetForResource(resource, input, 'bridge-in'),
    estimatedTimeMinutes: resource?.planningMetadata.estimatedTimeMinutes ?? 6,
    confidence: confidenceScore('medium', weak.length, Math.max(input.gradingSummaries?.length ?? weak.length, weak.length)),
    methodologyNotes: ['Generated from redacted document grading summaries.'],
  })];
}

function candidate(input: {
  input: TeacherPrepPackInput;
  itemType: TeacherPrepPackCandidateType;
  title: string;
  rationale: string;
  affectedGroup: TeacherPrepPackAffectedGroup;
  evidenceBasis: TeacherPrepPackEvidenceBasis[];
  resource: ResourceNode | null;
  target: TeacherPrepPackInsertionTarget;
  estimatedTimeMinutes: number;
  confidence: TeacherPrepPackCandidateItem['confidence'];
  methodologyNotes: string[];
}): TeacherPrepPackCandidateItem {
  const draftRequest = input.resource ? undefined : {
    reason: 'No governed ResourceNode matched this candidate; teacher review is required before creating a draft resource.',
    requiredReview: true as const,
  };
  return {
    id: 'pending',
    itemType: input.itemType,
    title: sanitizeText(input.title),
    rationale: sanitizeText(input.rationale),
    affectedGroup: input.affectedGroup,
    evidenceBasis: input.evidenceBasis.map(sanitizeEvidence),
    insertionTarget: input.resource ? input.target : {
      type: 'draft-resource-request',
      lessonId: input.input.nextLesson.lessonId,
      lessonStage: input.target.lessonStage,
      draftRequestReason: draftRequest!.reason,
    },
    estimatedTimeMinutes: input.estimatedTimeMinutes,
    confidence: input.confidence,
    methodologyNotes: input.methodologyNotes,
    review: {
      state: 'draft',
      reviewerId: null,
      reviewedAt: null,
      notes: null,
    },
    ...(input.resource ? {
      linkedResource: {
        nodeId: input.resource.id,
        title: input.resource.title,
        type: input.resource.type,
        launchTarget: input.resource.launchTarget,
      },
    } : {}),
    ...(draftRequest ? { draftResourceRequest: draftRequest } : {}),
    privacyMetadata: {
      rawStudentData: 'omitted',
      privateKonlingMemory: 'omitted',
      hiddenArenaInternals: 'omitted',
      rawTraces: 'omitted',
    },
  };
}

function matchResource(input: TeacherPrepPackInput, dimensionOrNeedle: string, preferredTypes: Array<ResourceNode['type']>): ResourceNode | null {
  const normalizedNeedle = dimensionOrNeedle.toLowerCase();
  return (input.resourceNodes ?? []).find((node) =>
    preferredTypes.includes(node.type) &&
    (node.courseModule === null || node.courseModule === input.goalId) &&
    node.planningMetadata.availability === 'available' &&
    node.planningMetadata.teacherPolicy !== 'blocked' &&
    node.planningMetadata.privacyLevel !== 'admin-scoped' &&
    node.eligibility.pathEligible &&
    !node.eligibility.auditIssues.some((issue) => issue.severity === 'blocking') &&
    (node.planningMetadata.knowledgeCoverage.some((item) => item.toLowerCase().includes(normalizedNeedle)) ||
      node.title.toLowerCase().includes(normalizedNeedle) ||
      Object.keys(node.planningMetadata.abilityImpact).some((key) => key.toLowerCase().includes(normalizedNeedle)))
  ) ?? null;
}

function targetForResource(
  resource: ResourceNode | null,
  input: TeacherPrepPackInput,
  lessonStage: TeacherPrepPackInsertionTarget['lessonStage'],
): TeacherPrepPackInsertionTarget {
  if (!resource) {
    return { type: 'draft-resource-request', lessonId: input.nextLesson.lessonId, lessonStage };
  }
  return {
    type: resource.type === 'lesson_step' ? 'lesson-step' : 'resource-node',
    lessonId: input.nextLesson.lessonId,
    lessonStage,
    resourceNodeId: resource.id,
    lessonStepId: resource.type === 'lesson_step' ? resource.sourceRef : undefined,
  };
}

function affectedGroupFromCluster(cluster: RoleBasedLearningDiagnosisRootCauseCluster): TeacherPrepPackAffectedGroup {
  return {
    kind: 'cluster',
    label: sanitizeText(cluster.label),
    count: cluster.affectedPopulation,
    denominator: cluster.denominator,
    dimensionId: cluster.dimensionId,
  };
}

function affectedGroupFromMetric(metric: ControlCorrectionReportMetric): TeacherPrepPackAffectedGroup {
  return {
    kind: 'class',
    label: sanitizeText(metric.label),
    count: metric.denominator - metric.includedPopulation,
    denominator: metric.denominator,
  };
}

function evidenceFromDiagnosisCluster(cluster: RoleBasedLearningDiagnosisRootCauseCluster): TeacherPrepPackEvidenceBasis {
  return {
    sourceType: 'role-diagnosis',
    sourceId: cluster.id,
    displayTitle: sanitizeText(cluster.label),
    capsule: `${cluster.affectedPopulation}/${cluster.denominator} learners affected; confidence ${cluster.confidence}.`,
    confidence: cluster.confidence,
    privacy: 'aggregate',
  };
}

function evidenceFromDiagnosisRefs(diagnosis: RoleBasedLearningDiagnosis): TeacherPrepPackEvidenceBasis[] {
  return diagnosis.claims.flatMap((claim) => claim.evidenceRefs.map((ref) => ({
    sourceType: ref.sourceType,
    sourceId: ref.chunkId,
    displayTitle: sanitizeText(ref.displayTitle),
    capsule: sanitizeText(ref.capsule),
    confidence: ref.confidence,
    privacy: 'redacted-capsule' as const,
  })));
}

function evidenceFromMetric(metric: ControlCorrectionReportMetric): TeacherPrepPackEvidenceBasis {
  return {
    sourceType: 'teacher-report',
    sourceId: metric.id,
    displayTitle: sanitizeText(metric.label),
    capsule: `${metric.label}: ${metric.value ?? 'n/a'} over ${metric.denominator}; confidence ${metric.confidence}.`,
    confidence: metric.confidence,
    privacy: 'aggregate',
  };
}

function isWeakMetric(metric?: ControlCorrectionReportMetric): metric is ControlCorrectionReportMetric {
  return Boolean(metric && metric.denominator > 0 && typeof metric.value === 'number' && metric.value < 0.7);
}

function applyCandidatePatch(
  item: TeacherPrepPackCandidateItem,
  patch?: Partial<Pick<TeacherPrepPackCandidateItem, 'title' | 'rationale' | 'estimatedTimeMinutes' | 'insertionTarget'>>,
): TeacherPrepPackCandidateItem {
  if (!patch) return item;
  return {
    ...item,
    ...(patch.title !== undefined ? { title: sanitizeText(patch.title) } : {}),
    ...(patch.rationale !== undefined ? { rationale: sanitizeText(patch.rationale) } : {}),
    ...(patch.estimatedTimeMinutes !== undefined ? { estimatedTimeMinutes: patch.estimatedTimeMinutes } : {}),
    ...(patch.insertionTarget !== undefined ? { insertionTarget: patch.insertionTarget } : {}),
  };
}

function isTeacherPrepPackItemApprovedByAuthorizedReviewer(
  item: TeacherPrepPackCandidateItem,
  pack: Pick<TeacherPrepPack, 'teacherId'>,
  authorizedReviewerIds?: string[],
): boolean {
  const reviewerId = item.review.reviewerId;
  const allowed = authorizedReviewerIds ?? [pack.teacherId];
  return item.review.state === 'approved' &&
    Boolean(reviewerId) &&
    allowed.includes(reviewerId!) &&
    validateTeacherPrepPackItem(item).length === 0;
}

function sanitizeReviewerId(value: string): string {
  return sanitizeText(value).trim();
}

function confidenceScore(confidence: LearningEvidenceConfidence, count: number, denominator: number): TeacherPrepPackCandidateItem['confidence'] {
  const base = confidence === 'high' ? 0.85 : confidence === 'medium' ? 0.68 : confidence === 'low' ? 0.42 : 0.2;
  const coverage = denominator > 0 ? Math.min(1, count / denominator) : 0;
  return {
    state: confidence,
    score: round((base + coverage) / 2),
    limitations: confidence === 'low' || confidence === 'none' ? ['low-confidence-evidence'] : [],
  };
}

function materializationInputs(input: TeacherPrepPackInput): string[] {
  return [
    input.diagnosis ? 'role-based-learning-diagnosis' : null,
    input.teacherReport ? 'control-correction-teacher-report' : null,
    input.pathOutcomes?.length ? 'path-outcomes' : null,
    input.gradingSummaries?.length ? 'document-grading-summaries' : null,
    input.resourceNodes?.length ? 'resource-nodes' : null,
    input.evidenceCorpus?.length ? 'learning-evidence-corpus' : null,
    'next-lesson-context',
  ].filter((item): item is string => Boolean(item));
}

function dedupeCandidates(items: TeacherPrepPackCandidateItem[]): TeacherPrepPackCandidateItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.itemType}:${item.title}:${item.insertionTarget.type}:${item.linkedResource?.nodeId ?? 'draft'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeEvidence(evidence: TeacherPrepPackEvidenceBasis): TeacherPrepPackEvidenceBasis {
  return {
    ...evidence,
    displayTitle: sanitizeText(evidence.displayTitle),
    capsule: sanitizeText(evidence.capsule),
  };
}

function sanitizeText(value: string): string {
  return value
    .replace(/raw[-\s]+answer[-\s]+body/gi, '[redacted]')
    .replace(/raw[-\s]+answer[^.;\n]*/gi, '[redacted]')
    .replace(/private[-\s]+konling[-\s]+memory/gi, '[redacted]')
    .replace(/private[-\s]+konling[-\s]+memory[^.;\n]*/gi, '[redacted]')
    .replace(/hidden[-\s]+arena[-\s]+internals/gi, '[redacted]')
    .replace(/hidden[-\s]+arena[^.;\n]*/gi, '[redacted]')
    .replace(/raw[-\s]+high[-\s]+frequency[-\s]+trace/gi, '[redacted]')
    .replace(/raw[-\s]+trace[^.;\n]*/gi, '[redacted]')
    .replace(/secret[:=][^\s,;]+/gi, 'secret=[redacted]')
    .trim();
}

function containsForbiddenPayload(value: unknown): boolean {
  return /raw[-\s]+answer[-\s]+body|private[-\s]+konling[-\s]+memory|hidden[-\s]+arena[-\s]+internals|raw[-\s]+high[-\s]+frequency[-\s]+trace|secret[:=](?!\[redacted\])[^\s,;]+/i
    .test(JSON.stringify(value));
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function confidenceValue(value: unknown): LearningEvidenceConfidence | null {
  return value === 'none' || value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
