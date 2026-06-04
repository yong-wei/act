import {
  retrieveLearningEvidenceCorpus,
  type LearningEvidenceCitationUseCase,
  type LearningEvidenceConfidence,
  type LearningEvidenceCorpusChunk,
  type LearningEvidenceCorpusPrivacyClass,
  type LearningEvidenceCorpusSourceType,
  type LearningEvidenceRetrievalRole,
} from './learning-evidence-rag-corpus';

export const ROLE_BASED_LEARNING_DIAGNOSIS_VERSION = 'role-based-learning-diagnosis.v1';

export type RoleBasedLearningDiagnosisView = 'student' | 'teacher-class' | 'teacher-student' | 'service';
export type RoleBasedLearningDiagnosisPrivacyClass = LearningEvidenceCorpusPrivacyClass;
export type RoleBasedLearningDiagnosisLimitationReason =
  | 'missing-goal-slice'
  | 'missing-target-student'
  | 'missing-dimension-evidence'
  | 'missing-citation'
  | 'stale-evidence'
  | 'low-confidence'
  | 'no-active-path'
  | 'path-outcome-unavailable'
  | 'teacher-report-unavailable'
  | 'document-grading-workbench-not-present';

export interface RoleBasedLearningDiagnosisInput {
  view: RoleBasedLearningDiagnosisView;
  goalId: string;
  userId?: string | null;
  targetUserId?: string | null;
  classId?: string | null;
  goalSlice?: Record<string, any> | null;
  learnerState?: Record<string, any> | null;
  featureCache?: Record<string, any> | null;
  pathOutcomeSummary?: Record<string, any> | null;
  teacherReport?: Record<string, any> | null;
  gradingSummary?: Record<string, any> | null;
  evidenceCorpus?: LearningEvidenceCorpusChunk[];
  now?: Date;
}

export interface RoleBasedLearningDiagnosisEvidenceRef {
  chunkId: string;
  sourceType: LearningEvidenceCorpusSourceType;
  displayTitle: string;
  displayHref: string | null;
  confidence: LearningEvidenceConfidence;
  capsule: string;
}

export interface RoleBasedLearningDiagnosisLimitation {
  reason: RoleBasedLearningDiagnosisLimitationReason;
  detail: string;
}

export interface RoleBasedLearningDiagnosisNextAction {
  kind: 'learning-path' | 'teacher-intervention' | 'resource-review' | 'grading-review';
  label: string;
  href: string | null;
  unavailableReason?: string;
}

export interface RoleBasedLearningDiagnosisClaim {
  id: string;
  dimensionId: string;
  judgment: 'needs-attention' | 'developing' | 'stable' | 'insufficient-evidence';
  explanation?: string;
  studentExplanation?: string;
  teacherExplanation?: string;
  rootCause: string;
  evidenceRefs: RoleBasedLearningDiagnosisEvidenceRef[];
  sourceCoverage: Record<string, string>;
  confidence: {
    state: LearningEvidenceConfidence;
    score: number;
    evidenceCount: number;
    sourceCompleteness: number;
  };
  evidenceWindow: {
    generatedAt: string;
    sourceLastUpdatedAt: string | null;
    stale: boolean;
  };
  limitations: RoleBasedLearningDiagnosisLimitation[];
  nextActions: RoleBasedLearningDiagnosisNextAction[];
  privacyClass: RoleBasedLearningDiagnosisPrivacyClass;
  materializationVersion: typeof ROLE_BASED_LEARNING_DIAGNOSIS_VERSION;
}

export interface RoleBasedLearningDiagnosisRootCauseCluster {
  id: string;
  dimensionId: string;
  label: string;
  affectedPopulation: number;
  denominator: number;
  confidence: LearningEvidenceConfidence;
  evidenceCoverage: {
    ready: number;
    stale: number;
    missing: number;
    lowConfidence: number;
  };
  interventionPriority: 'low' | 'medium' | 'high';
  drilldownRefs: Array<{ kind: 'student-consultation'; userId: string; href: string }>;
}

export interface RoleBasedLearningDiagnosis {
  version: typeof ROLE_BASED_LEARNING_DIAGNOSIS_VERSION;
  view: RoleBasedLearningDiagnosisView;
  goalId: string;
  generatedAt: string;
  materialization: {
    version: typeof ROLE_BASED_LEARNING_DIAGNOSIS_VERSION;
    inputs: string[];
    refresh: 'on-evidence-change-or-request';
  };
  claims: RoleBasedLearningDiagnosisClaim[];
  limitations: RoleBasedLearningDiagnosisLimitation[];
  rootCauseClusters: RoleBasedLearningDiagnosisRootCauseCluster[];
  drilldownRefs: Array<{ kind: 'student-consultation'; userId: string; href: string }>;
  auditRefs: Array<{
    chunkId: string;
    sourceType: LearningEvidenceCorpusSourceType;
    privacyClass: LearningEvidenceCorpusPrivacyClass;
    hash: string;
  }>;
  redactionPolicy: {
    rawPayloads: 'omitted' | 'service-only';
    ordinaryViews: 'redacted-summaries-only';
  };
}

export function materializeRoleBasedLearningDiagnosis(input: RoleBasedLearningDiagnosisInput): RoleBasedLearningDiagnosis {
  const safeInput = sanitizeInputForView(input);
  const generatedAt = (input.now ?? new Date()).toISOString();
  const dimensions = dimensionsFromGoalSlice(safeInput.goalSlice);
  const evidenceScope = retrievalScopeFor(safeInput);
  const evidence = canRetrieveEvidence(safeInput)
    ? retrieveLearningEvidenceCorpus(safeInput.evidenceCorpus ?? [], evidenceScope, {
      limit: input.view === 'service' ? 16 : 8,
    })
    : [];
  const evidenceRefs = evidence.map(toEvidenceRef);
  const globalLimitations = globalLimitationsFor(input);
  const claims = (dimensions.length > 0 ? dimensions : [fallbackDimension(input.goalId)]).map((dimension) =>
    buildClaim({
      dimension,
      evidence,
      evidenceRefs,
      input: safeInput,
      generatedAt,
    })
  );
  const rootCauseClusters = safeInput.view === 'teacher-class' ? buildTeacherClassClusters(safeInput, claims) : [];
  const drilldownRefs = safeInput.view === 'teacher-class' ? buildTeacherDrilldownRefs(safeInput) : [];
  return {
    version: ROLE_BASED_LEARNING_DIAGNOSIS_VERSION,
    view: safeInput.view,
    goalId: safeInput.goalId,
    generatedAt,
    materialization: {
      version: ROLE_BASED_LEARNING_DIAGNOSIS_VERSION,
      inputs: materializationInputs(safeInput),
      refresh: 'on-evidence-change-or-request',
    },
    claims,
    limitations: uniqueLimitations([...globalLimitations, ...claims.flatMap((claim) => claim.limitations)]),
    rootCauseClusters,
    drilldownRefs,
    auditRefs: safeInput.view === 'service' ? buildAuditRefs(safeInput.evidenceCorpus ?? [], safeInput) : [],
    redactionPolicy: {
      rawPayloads: safeInput.view === 'service' ? 'service-only' : 'omitted',
      ordinaryViews: 'redacted-summaries-only',
    },
  };
}

export function validateRoleBasedLearningDiagnosis(diagnosis: RoleBasedLearningDiagnosis): string[] {
  const errors: string[] = [];
  if (diagnosis.version !== ROLE_BASED_LEARNING_DIAGNOSIS_VERSION) errors.push('invalid-version');
  if (!diagnosis.goalId) errors.push('missing-goal-id');
  if (!diagnosis.generatedAt) errors.push('missing-generated-at');
  if (!Array.isArray(diagnosis.claims) || diagnosis.claims.length === 0) errors.push('missing-claims');
  for (const claim of diagnosis.claims ?? []) {
    if (!claim.id) errors.push('claim-missing-id');
    if (!claim.dimensionId) errors.push('claim-missing-dimension');
    if (!claim.confidence?.state) errors.push('claim-missing-confidence');
    if (!claim.materializationVersion) errors.push('claim-missing-materialization-version');
    if (claim.evidenceRefs.length === 0 && !claim.limitations.some((item) => item.reason === 'missing-citation' || item.reason === 'missing-dimension-evidence')) {
      errors.push('claim-missing-evidence-or-limitation');
    }
    if (claim.nextActions.length === 0 || !claim.nextActions.every((action) => action.href || action.unavailableReason)) {
      errors.push('claim-missing-next-action-metadata');
    }
  }
  if (diagnosis.view !== 'service' && JSON.stringify(diagnosis).match(/raw payload|raw path trace|private memory/i)) {
    errors.push('ordinary-view-contains-raw-payload');
  }
  return Array.from(new Set(errors));
}

function buildClaim(input: {
  dimension: Record<string, any>;
  evidence: LearningEvidenceCorpusChunk[];
  evidenceRefs: RoleBasedLearningDiagnosisEvidenceRef[];
  input: RoleBasedLearningDiagnosisInput;
  generatedAt: string;
}): RoleBasedLearningDiagnosisClaim {
  const confidence = confidenceFor(input.dimension, input.evidence);
  const limitations = limitationsForClaim(input.dimension, input.evidence, input.input, confidence.state);
  const judgment = judgmentFor(input.dimension, limitations);
  const dimensionId = String(input.dimension.id ?? input.input.goalId);
  const explanation = explanationFor(input.input.view, dimensionId, judgment, input.dimension);
  const activePathId = stringOrNull(input.input.pathOutcomeSummary?.pathId) ?? stringOrNull(input.input.goalSlice?.pathContext?.activePathId);
  return {
    id: `${input.input.goalId}:${input.input.view}:${dimensionId}`,
    dimensionId,
    judgment,
    ...(input.input.view === 'student' ? { studentExplanation: explanation } : {}),
    ...(input.input.view === 'teacher-class' || input.input.view === 'teacher-student' ? { teacherExplanation: explanation } : {}),
    ...(input.input.view === 'service' ? { explanation } : {}),
    rootCause: rootCauseFor(input.dimension, input.input),
    evidenceRefs: input.evidenceRefs,
    sourceCoverage: sourceCoverageFor(input.dimension),
    confidence,
    evidenceWindow: {
      generatedAt: input.generatedAt,
      sourceLastUpdatedAt: sourceLastUpdatedAt(input.input, input.evidence),
      stale: hasStaleEvidence(input.input, input.evidence, input.dimension),
    },
    limitations,
    nextActions: nextActionsFor(input.input, activePathId),
    privacyClass: privacyClassFor(input.input.view),
    materializationVersion: ROLE_BASED_LEARNING_DIAGNOSIS_VERSION,
  };
}

function retrievalScopeFor(input: RoleBasedLearningDiagnosisInput) {
  const role: LearningEvidenceRetrievalRole =
    input.view === 'student' ? 'student' :
      input.view === 'service' ? 'service' : 'teacher';
  const targetUserId = input.view === 'student'
    ? input.targetUserId ?? input.userId ?? null
    : input.view === 'service'
      ? input.targetUserId ?? null
    : input.view === 'teacher-student'
      ? input.targetUserId ?? null
      : null;
  return {
    role,
    userId: input.userId ?? null,
    targetUserId,
    classIds: input.classId ? [input.classId] : [],
    goalId: input.goalId,
    useCase: 'diagnosis' as LearningEvidenceCitationUseCase,
    includePrivateText: input.view === 'service',
  };
}

function dimensionsFromGoalSlice(goalSlice: Record<string, any> | null | undefined) {
  return Array.isArray(goalSlice?.dimensions) ? goalSlice.dimensions.filter((item) => item && typeof item === 'object') : [];
}

function fallbackDimension(goalId: string) {
  return {
    id: goalId,
    score: 0,
    evidenceCount: 0,
    freshness: 'missing',
    confidence: { state: 'none', score: 0, evidenceCount: 0, sourceCompleteness: 0 },
    fallbackMarkers: ['missing-goal-slice'],
  };
}

function toEvidenceRef(chunk: LearningEvidenceCorpusChunk): RoleBasedLearningDiagnosisEvidenceRef {
  return {
    chunkId: chunk.id,
    sourceType: chunk.sourceType,
    displayTitle: chunk.display.title,
    displayHref: chunk.display.href,
    confidence: chunk.confidence,
    capsule: chunk.display.capsule,
  };
}

function sourceCoverageFor(dimension: Record<string, any>) {
  const sourceCoverage = dimension.sourceCoverage;
  if (!sourceCoverage || typeof sourceCoverage !== 'object' || Array.isArray(sourceCoverage)) return {};
  return Object.fromEntries(
    Object.entries(sourceCoverage)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, value as string])
  );
}

function confidenceFor(dimension: Record<string, any>, evidence: LearningEvidenceCorpusChunk[]): RoleBasedLearningDiagnosisClaim['confidence'] {
  const dimensionConfidence = readConfidence(dimension.confidence);
  const evidenceConfidence = evidenceConfidenceState(evidence);
  const state = minConfidence(dimensionConfidence.state, evidenceConfidence);
  return {
    state,
    score: Math.min(dimensionConfidence.score, confidenceScore(state)),
    evidenceCount: Math.max(dimensionConfidence.evidenceCount, evidence.length),
    sourceCompleteness: dimensionConfidence.sourceCompleteness,
  };
}

function limitationsForClaim(
  dimension: Record<string, any>,
  evidence: LearningEvidenceCorpusChunk[],
  input: RoleBasedLearningDiagnosisInput,
  confidence: LearningEvidenceConfidence,
): RoleBasedLearningDiagnosisLimitation[] {
  const limitations: RoleBasedLearningDiagnosisLimitation[] = [];
  if (!input.goalSlice) limitations.push(limitation('missing-goal-slice', 'No registered adaptive goal slice was supplied.'));
  if (input.view === 'teacher-student' && !input.targetUserId) limitations.push(limitation('missing-target-student', 'Teacher student diagnosis requires an explicit target student.'));
  if (Number(dimension.evidenceCount ?? 0) === 0) limitations.push(limitation('missing-dimension-evidence', 'The goal dimension has no governed evidence count.'));
  if (evidence.length === 0) limitations.push(limitation('missing-citation', 'No accessible governed citation was found for this diagnosis.'));
  if (hasStaleEvidence(input, evidence, dimension)) limitations.push(limitation('stale-evidence', 'One or more evidence sources are stale.'));
  if (confidence === 'none' || confidence === 'low') limitations.push(limitation('low-confidence', 'The claim is downgraded because confidence is low.'));
  if (!input.pathOutcomeSummary) limitations.push(limitation('no-active-path', 'No active path outcome summary is available.'));
  if (gradingUnavailableReason(input) === 'document-grading-workbench-not-present') {
    limitations.push(limitation('document-grading-workbench-not-present', 'Document grading evidence is not available yet.'));
  }
  return uniqueLimitations(limitations);
}

function globalLimitationsFor(input: RoleBasedLearningDiagnosisInput): RoleBasedLearningDiagnosisLimitation[] {
  const limitations: RoleBasedLearningDiagnosisLimitation[] = [];
  if ((input.view === 'teacher-class' || input.view === 'teacher-student') && !input.teacherReport) {
    limitations.push(limitation('teacher-report-unavailable', 'Teacher report metrics were not supplied.'));
  }
  if (!input.pathOutcomeSummary) limitations.push(limitation('path-outcome-unavailable', 'Path outcome summary was not supplied.'));
  return uniqueLimitations(limitations);
}

function sanitizeInputForView(input: RoleBasedLearningDiagnosisInput): RoleBasedLearningDiagnosisInput {
  if (input.view !== 'teacher-student' || input.targetUserId) return input;
  return {
    view: input.view,
    goalId: input.goalId,
    userId: input.userId ?? null,
    targetUserId: null,
    classId: input.classId ?? null,
    goalSlice: null,
    learnerState: null,
    featureCache: null,
    pathOutcomeSummary: null,
    teacherReport: null,
    gradingSummary: input.gradingSummary ?? null,
    evidenceCorpus: [],
    now: input.now,
  };
}

function canRetrieveEvidence(input: RoleBasedLearningDiagnosisInput) {
  return input.view !== 'teacher-student' || Boolean(input.targetUserId);
}

function nextActionsFor(input: RoleBasedLearningDiagnosisInput, activePathId: string | null): RoleBasedLearningDiagnosisNextAction[] {
  const missingTargetStudent = input.view === 'teacher-student' && !input.targetUserId;
  const actions: RoleBasedLearningDiagnosisNextAction[] = [{
    kind: 'learning-path',
    label: '继续当前学习路径',
    href: null,
    unavailableReason: missingTargetStudent ? 'missing-target-student' : activePathId ? 'path-detail-route-unavailable' : 'no-active-path',
  }];
  if (input.view === 'teacher-class' || input.view === 'teacher-student') {
    actions.push({
      kind: 'teacher-intervention',
      label: '查看干预建议',
      href: !missingTargetStudent && input.classId ? `/teacher/classes/${input.classId}/analytics-v2` : null,
      ...(!missingTargetStudent && input.classId ? {} : { unavailableReason: missingTargetStudent ? 'missing-target-student' : 'missing-class-scope' }),
    });
  }
  if (gradingUnavailableReason(input)) {
    actions.push({
      kind: 'grading-review',
      label: '等待文档评分证据',
      href: null,
      unavailableReason: gradingUnavailableReason(input) ?? undefined,
    });
  }
  return actions;
}

function buildTeacherClassClusters(input: RoleBasedLearningDiagnosisInput, claims: RoleBasedLearningDiagnosisClaim[]): RoleBasedLearningDiagnosisRootCauseCluster[] {
  const report = input.teacherReport ?? {};
  const classInfo = report.classInfo ?? {};
  const metric = report.metrics?.simulationPassRate ?? firstMetric(report.metrics);
  const coverage = metric?.sourceCoverage ?? {};
  const drilldownRefs = buildTeacherDrilldownRefs(input);
  return claims.map((claim) => ({
    id: `cluster:${input.goalId}:${claim.dimensionId}`,
    dimensionId: claim.dimensionId,
    label: claim.rootCause,
    affectedPopulation: numberOr(metric?.sourceCoverage?.readyStudents, drilldownRefs.length),
    denominator: numberOr(classInfo.studentCount, numberOr(metric?.denominator, drilldownRefs.length)),
    confidence: claim.confidence.state,
    evidenceCoverage: {
      ready: numberOr(coverage.readyStudents, 0),
      stale: numberOr(coverage.staleStudents, 0),
      missing: numberOr(coverage.missingStudents, 0),
      lowConfidence: numberOr(coverage.lowConfidenceStudents, 0),
    },
    interventionPriority: priorityFor(metric?.value, claim.confidence.state),
    drilldownRefs,
  }));
}

function buildTeacherDrilldownRefs(input: RoleBasedLearningDiagnosisInput) {
  const rows = Array.isArray(input.teacherReport?.studentDrilldowns) ? input.teacherReport?.studentDrilldowns : [];
  return rows
    .map((row: Record<string, any>) => stringOrNull(row.userId))
    .filter((userId): userId is string => Boolean(userId))
    .map((userId) => ({
      kind: 'student-consultation' as const,
      userId,
      href: `/teacher/classes/${input.classId ?? 'unknown'}/students/${userId}`,
    }));
}

function buildAuditRefs(chunks: LearningEvidenceCorpusChunk[], input: RoleBasedLearningDiagnosisInput) {
  return retrieveLearningEvidenceCorpus(chunks, {
    ...retrievalScopeFor(input),
    role: 'service',
    includePrivateText: true,
  }, { limit: 25 }).map((chunk) => ({
    chunkId: chunk.id,
    sourceType: chunk.sourceType,
    privacyClass: chunk.privacyClass,
    hash: chunk.content.hash,
  }));
}

function materializationInputs(input: RoleBasedLearningDiagnosisInput) {
  return [
    input.goalSlice ? 'adaptive-goal-slice' : null,
    input.featureCache ? 'student-evidence-feature-cache' : null,
    input.learnerState ? 'adaptive-learner-state' : null,
    input.pathOutcomeSummary ? 'path-outcome-summary' : null,
    input.teacherReport ? 'control-correction-teacher-report' : null,
    input.gradingSummary ? 'grading-summary' : null,
    input.evidenceCorpus?.length ? 'learning-evidence-rag-corpus' : null,
  ].filter((item): item is string => Boolean(item));
}

function readConfidence(value: unknown): RoleBasedLearningDiagnosisClaim['confidence'] {
  const record = value && typeof value === 'object' ? value as Record<string, any> : {};
  const state = isConfidence(record.state) ? record.state : 'none';
  return {
    state,
    score: numberOr(record.score, confidenceScore(state)),
    evidenceCount: numberOr(record.evidenceCount, 0),
    sourceCompleteness: numberOr(record.sourceCompleteness, 0),
  };
}

function evidenceConfidenceState(evidence: LearningEvidenceCorpusChunk[]): LearningEvidenceConfidence {
  if (evidence.length === 0) return 'none';
  return evidence.reduce((state, chunk) => minConfidence(state, chunk.confidence), 'high' as LearningEvidenceConfidence);
}

function minConfidence(left: LearningEvidenceConfidence, right: LearningEvidenceConfidence): LearningEvidenceConfidence {
  return confidenceScore(left) <= confidenceScore(right) ? left : right;
}

function confidenceScore(state: LearningEvidenceConfidence) {
  return { none: 0, low: 0.25, medium: 0.66, high: 0.9 }[state];
}

function isConfidence(value: unknown): value is LearningEvidenceConfidence {
  return value === 'none' || value === 'low' || value === 'medium' || value === 'high';
}

function judgmentFor(dimension: Record<string, any>, limitations: RoleBasedLearningDiagnosisLimitation[]): RoleBasedLearningDiagnosisClaim['judgment'] {
  if (limitations.some((item) => item.reason === 'missing-citation' || item.reason === 'missing-dimension-evidence')) return 'insufficient-evidence';
  const score = numberOr(dimension.score, 0);
  if (score < 65) return 'needs-attention';
  if (score < 82) return 'developing';
  return 'stable';
}

function explanationFor(view: RoleBasedLearningDiagnosisView, dimensionId: string, judgment: string, dimension: Record<string, any>) {
  const score = numberOr(dimension.score, 0);
  if (view === 'student') return `当前 ${dimensionId} 维度处于 ${judgment} 状态，建议围绕证据覆盖不足的环节继续练习。`;
  if (view === 'service') return `${dimensionId} diagnosis=${judgment}; score=${score}; evidenceCount=${numberOr(dimension.evidenceCount, 0)}.`;
  return `${dimensionId} 维度需要按证据覆盖、路径终端验证和班级分布判断干预优先级。`;
}

function rootCauseFor(dimension: Record<string, any>, input: RoleBasedLearningDiagnosisInput) {
  if (input.view === 'teacher-student' && !input.targetUserId) return '缺少明确目标学生，未读取个人路径或诊断证据。';
  const markers = Array.isArray(dimension.fallbackMarkers) ? dimension.fallbackMarkers.filter((item) => typeof item === 'string') : [];
  if (markers.length > 0) return `证据限制：${markers.join(', ')}`;
  if (input.pathOutcomeSummary?.terminalValidationState) return `路径终端验证状态：${input.pathOutcomeSummary.terminalValidationState}`;
  return '证据覆盖不足或能力表现尚未稳定。';
}

function sourceLastUpdatedAt(input: RoleBasedLearningDiagnosisInput, evidence: LearningEvidenceCorpusChunk[]) {
  return stringOrNull(input.featureCache?.freshness?.sourceLastUpdatedAt) ??
    stringOrNull(input.learnerState?.generatedAt) ??
    evidence.map((item) => item.freshness.sourceUpdatedAt).find((item): item is string => Boolean(item)) ??
    null;
}

function hasStaleEvidence(input: RoleBasedLearningDiagnosisInput, evidence: LearningEvidenceCorpusChunk[], dimension: Record<string, any>) {
  return evidence.some((item) => item.freshness.stale) ||
    dimension.freshness === 'stale' ||
    input.featureCache?.freshness?.stale === true ||
    input.pathOutcomeSummary?.freshness?.stale === true ||
    input.teacherReport?.freshness?.stale === true;
}

function privacyClassFor(view: RoleBasedLearningDiagnosisView): RoleBasedLearningDiagnosisPrivacyClass {
  if (view === 'service') return 'service-only';
  if (view === 'teacher-class' || view === 'teacher-student') return 'teacher-visible';
  return 'student-visible';
}

function priorityFor(value: unknown, confidence: LearningEvidenceConfidence): 'low' | 'medium' | 'high' {
  if (confidence === 'none' || confidence === 'low') return 'medium';
  const numeric = typeof value === 'number' ? value : null;
  if (numeric !== null && numeric < 0.5) return 'high';
  if (numeric !== null && numeric < 0.75) return 'medium';
  return 'low';
}

function gradingUnavailableReason(input: RoleBasedLearningDiagnosisInput) {
  const status = stringOrNull(input.gradingSummary?.status);
  if (status !== 'unavailable') return null;
  return stringOrNull(input.gradingSummary?.unavailableReason);
}

function firstMetric(metrics: unknown): Record<string, any> | null {
  if (!metrics || typeof metrics !== 'object') return null;
  return Object.values(metrics as Record<string, any>).find((item) => item && typeof item === 'object') ?? null;
}

function limitation(reason: RoleBasedLearningDiagnosisLimitationReason, detail: string): RoleBasedLearningDiagnosisLimitation {
  return { reason, detail };
}

function uniqueLimitations(limitations: RoleBasedLearningDiagnosisLimitation[]) {
  const seen = new Set<string>();
  return limitations.filter((item) => {
    const key = item.reason;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
