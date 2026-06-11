import type {
  LearningEvidenceCitationChipPayload,
  LearningEvidenceConfidence,
  LearningEvidenceCorpusSourceType,
} from './learning-evidence-rag-corpus';

export const CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION = 'control-correction-diagnosis-profile.v1';

export type DiagnosisDimensionId =
  | 'time-domain-analysis'
  | 'root-locus-reasoning'
  | 'frequency-domain-margin-analysis'
  | 'method-selection'
  | 'constraint-tradeoff'
  | 'simulation-validation'
  | 'arena-transfer'
  | 'reflection'
  | 'ai-collaboration';

export type DiagnosisSourceFamily =
  | 'learning-fact'
  | 'feature-cache'
  | 'adaptive-assessment'
  | 'simulation-summary'
  | 'arena-summary'
  | 'path-evidence'
  | 'grading-fact'
  | 'reflection'
  | 'ai-collaboration';

export type DiagnosisNormalizationPolicy =
  | { kind: 'ratio'; clamp?: boolean }
  | { kind: 'bounded-numeric'; min: number; max: number }
  | { kind: 'inverse-bounded-numeric'; min: number; max: number }
  | { kind: 'rubric-level'; levels: string[] };

export type DiagnosisPrivacyVisibility = 'student-visible' | 'teacher-scoped' | 'service-only';

export type DiagnosisLimitationReason =
  | 'missing-source'
  | 'partial-source'
  | 'stale-source'
  | 'low-confidence-source'
  | 'preview-only-source'
  | 'insufficient-cohort'
  | 'cold-start'
  | 'unauthorized-scope'
  | 'conflicting-source';

export interface DiagnosisDimensionDefinition {
  id: DiagnosisDimensionId;
  label: string;
  reportReady: boolean;
}

export interface DiagnosisIndicatorDefinition {
  dimensionId: DiagnosisDimensionId;
  indicatorId: string;
  label: string;
  sourceFamilies: DiagnosisSourceFamily[];
  querySpec: {
    selectors: string[];
    windowDays: number;
    requiredFamilies?: DiagnosisSourceFamily[];
  };
  normalizationPolicy: DiagnosisNormalizationPolicy;
  confidencePolicy: {
    minimumEvidenceCount: number;
    staleAfterDays: number;
    sourceTrust: Partial<Record<DiagnosisSourceFamily, number>>;
  };
  privacyVisibility: DiagnosisPrivacyVisibility;
  materializerVersion: typeof CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION;
  fallbackBehavior: {
    missing: 'unavailable';
    stale: 'lower-confidence';
    lowConfidence: 'lower-confidence';
    partial: 'lower-confidence';
  };
}

export interface DiagnosisEvidenceReference {
  chunkId: string;
  sourceType: LearningEvidenceCorpusSourceType;
  title: string;
  href?: string | null;
  capsule?: string | null;
  privacyVisibility?: DiagnosisPrivacyVisibility;
}

export interface DiagnosisEvidenceRecord {
  id: string;
  sourceFamily: DiagnosisSourceFamily;
  indicatorIds?: string[];
  dimensionId?: DiagnosisDimensionId;
  value?: number | string | null;
  numerator?: number | null;
  denominator?: number | null;
  min?: number | null;
  max?: number | null;
  confidence: LearningEvidenceConfidence;
  updatedAt: string;
  previewOnly?: boolean;
  partial?: boolean;
  evidenceRef?: DiagnosisEvidenceReference;
  provenance?: {
    sourceModel?: string;
    official?: boolean;
    classId?: string | null;
    userId?: string | null;
    goalId?: string | null;
    materializerVersion?: string;
    indicatorVersion?: string;
    evaluationRunId?: string | null;
    publicationId?: string | null;
  };
}

export interface DiagnosisCohortIndicatorScore {
  subjectId: string;
  classId: string;
  indicatorId: string;
  indicatorVersion: string;
  materializerVersion: string;
  snapshotAt: string;
  score: number;
}

export interface DiagnosisSnapshotSubject {
  kind: 'student' | 'class';
  userId?: string | null;
  classId: string;
}

export interface DiagnosisLimitation {
  reason: DiagnosisLimitationReason;
  detail: string;
  indicatorId?: string;
  dimensionId?: DiagnosisDimensionId;
}

export interface DiagnosisPercentileSnapshot {
  state: 'available' | 'unavailable';
  percentile: number | null;
  sampleSize: number;
  fallback: 'none' | 'insufficient-cohort' | 'cold-start';
}

export interface DiagnosisIndicatorSnapshot {
  indicatorId: string;
  dimensionId: DiagnosisDimensionId;
  score: number | null;
  confidence: {
    state: LearningEvidenceConfidence;
    score: number;
    evidenceCount: number;
    sourceCompleteness: number;
  };
  percentile: DiagnosisPercentileSnapshot;
  growthPercentile: DiagnosisPercentileSnapshot;
  sourceCoverage: Record<DiagnosisSourceFamily, 'ready' | 'partial' | 'missing' | 'stale' | 'low-confidence'>;
  evidenceCount: number;
  evidenceWindow: {
    generatedAt: string;
    sourceLastUpdatedAt: string | null;
    stale: boolean;
  };
  limitations: DiagnosisLimitation[];
  evidenceRefs: DiagnosisEvidenceReference[];
  materializerVersion: typeof CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION;
}

export interface DiagnosisDimensionSnapshot {
  dimensionId: DiagnosisDimensionId;
  score: number | null;
  judgment: 'needs-attention' | 'developing' | 'stable' | 'insufficient-evidence';
  confidence: LearningEvidenceConfidence;
  indicatorIds: string[];
  percentile: DiagnosisPercentileSnapshot;
  growthPercentile: DiagnosisPercentileSnapshot;
  limitations: DiagnosisLimitation[];
  evidenceRefs: DiagnosisEvidenceReference[];
}

export interface DiagnosisReportSnapshot {
  id: string;
  goalId: string;
  subject: DiagnosisSnapshotSubject;
  generatedAt: string;
  materializerVersion: typeof CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION;
  indicators: DiagnosisIndicatorSnapshot[];
  dimensions: DiagnosisDimensionSnapshot[];
  limitations: DiagnosisLimitation[];
  sourceWindows: Record<string, { sourceLastUpdatedAt: string | null; stale: boolean; evidenceCount: number }>;
}

export interface DiagnosisReportMaterializationInput {
  subject: DiagnosisSnapshotSubject;
  goalId: string;
  generatedAt: Date;
  evidenceRecords?: DiagnosisEvidenceRecord[];
  featureCache?: Record<string, any> | null;
  adaptiveAssessmentRecords?: DiagnosisEvidenceRecord[];
  simulationSummaries?: DiagnosisEvidenceRecord[];
  arenaSummaries?: DiagnosisEvidenceRecord[];
  pathEvidence?: DiagnosisEvidenceRecord[];
  gradingFacts?: DiagnosisEvidenceRecord[];
  cohortIndicatorScores?: DiagnosisCohortIndicatorScore[];
  priorIndicatorScores?: DiagnosisCohortIndicatorScore[];
  definitions?: DiagnosisIndicatorDefinition[];
  now?: Date;
}

export interface DiagnosisReportReadRequest {
  view: 'student' | 'teacher-student' | 'teacher-class' | 'service';
  userId?: string | null;
  targetUserId?: string | null;
  classId?: string | null;
  teacherClassIds?: string[];
  goalId: string;
}

export interface DiagnosisReportSnapshotStore {
  list(): DiagnosisReportSnapshot[];
  add(snapshot: DiagnosisReportSnapshot): void;
}

export interface DiagnosisReportSnapshotPersistenceRow {
  id: string;
  goalId: string;
  subjectKind: string;
  userId: string | null;
  classId: string | null;
  generatedAt: Date;
  materializerVersion: string;
  snapshot: any;
}

export interface DiagnosisReportSnapshotPersistenceDelegate {
  upsert(args: {
    where: { id: string };
    create: DiagnosisReportSnapshotPersistenceRow;
    update: Partial<DiagnosisReportSnapshotPersistenceRow>;
  }): Promise<unknown>;
  findMany(args: {
    where: {
      goalId: string;
      subjectKind?: string;
      userId?: string | null;
      classId?: string | null;
      materializerVersion?: string;
    };
    orderBy?: { generatedAt: 'desc' };
    take?: number;
  }): Promise<DiagnosisReportSnapshotPersistenceRow[]>;
}

export interface DiagnosisReportSnapshotPersistenceStore {
  list(request: DiagnosisReportReadRequest): Promise<DiagnosisReportSnapshot[]>;
  add(snapshot: DiagnosisReportSnapshot): Promise<void>;
}

export interface DiagnosisReportSnapshotTableProbeClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export const CONTROL_CORRECTION_DIAGNOSIS_DIMENSIONS: DiagnosisDimensionDefinition[] = [
  { id: 'time-domain-analysis', label: '时域分析', reportReady: true },
  { id: 'root-locus-reasoning', label: '根轨迹推理', reportReady: true },
  { id: 'frequency-domain-margin-analysis', label: '频域裕度分析', reportReady: true },
  { id: 'method-selection', label: '方法选择', reportReady: true },
  { id: 'constraint-tradeoff', label: '约束权衡', reportReady: true },
  { id: 'simulation-validation', label: '仿真验证', reportReady: true },
  { id: 'arena-transfer', label: '竞技场迁移', reportReady: true },
  { id: 'reflection', label: '反思表达', reportReady: true },
  { id: 'ai-collaboration', label: 'AI 协作', reportReady: true },
];

const INDICATOR_BLUEPRINTS: Record<DiagnosisDimensionId, Array<[string, string, DiagnosisSourceFamily[], DiagnosisNormalizationPolicy]>> = {
  'time-domain-analysis': [
    ['time-response-settling-control', '调节时间与超调控制', ['adaptive-assessment', 'path-evidence'], { kind: 'ratio' }],
    ['time-response-error-reading', '稳态误差判读', ['learning-fact', 'adaptive-assessment'], { kind: 'ratio' }],
    ['time-response-parameter-link', '参数与响应关联', ['feature-cache', 'path-evidence'], { kind: 'ratio' }],
  ],
  'root-locus-reasoning': [
    ['root-locus-rule-application', '根轨迹规则应用', ['adaptive-assessment', 'learning-fact'], { kind: 'ratio' }],
    ['root-locus-design-explanation', '根轨迹设计解释', ['reflection', 'grading-fact'], { kind: 'rubric-level', levels: ['missing', 'basic', 'developing', 'proficient'] }],
    ['root-locus-stability-judgment', '闭环稳定判断', ['path-evidence', 'adaptive-assessment'], { kind: 'ratio' }],
  ],
  'frequency-domain-margin-analysis': [
    ['frequency-margin-reading', '幅相裕度读取', ['adaptive-assessment', 'learning-fact'], { kind: 'ratio' }],
    ['frequency-bode-translation', 'Bode 图语义转换', ['reflection', 'grading-fact'], { kind: 'rubric-level', levels: ['missing', 'basic', 'developing', 'proficient'] }],
    ['frequency-stability-risk', '频域稳定风险判断', ['path-evidence', 'feature-cache'], { kind: 'ratio' }],
  ],
  'method-selection': [
    ['method-controller-fit', '控制器结构匹配', ['adaptive-assessment', 'path-evidence'], { kind: 'ratio' }],
    ['method-parameter-rationale', '参数依据表达', ['grading-fact', 'reflection'], { kind: 'rubric-level', levels: ['missing', 'basic', 'developing', 'proficient'] }],
    ['method-alternative-comparison', '方案比较', ['reflection', 'ai-collaboration'], { kind: 'ratio' }],
  ],
  'constraint-tradeoff': [
    ['constraint-hard-boundary-pass', '硬约束通过', ['arena-summary', 'simulation-summary'], { kind: 'ratio' }],
    ['constraint-energy-tradeoff', '控制能量权衡', ['simulation-summary', 'arena-summary'], { kind: 'inverse-bounded-numeric', min: 0, max: 1 }],
    ['constraint-response-balance', '响应性能平衡', ['path-evidence', 'adaptive-assessment'], { kind: 'ratio' }],
  ],
  'simulation-validation': [
    ['simulation-terminal-validation', '终端仿真验证', ['simulation-summary', 'path-evidence', 'feature-cache'], { kind: 'ratio' }],
    ['simulation-replay-confidence', '复现实验可信度', ['simulation-summary'], { kind: 'ratio' }],
    ['simulation-failure-diagnosis', '失败原因诊断', ['simulation-summary', 'reflection'], { kind: 'ratio' }],
  ],
  'arena-transfer': [
    ['arena-official-transfer', '正式评价迁移', ['arena-summary'], { kind: 'ratio' }],
    ['arena-method-ranking', '方法榜表现', ['arena-summary'], { kind: 'ratio' }],
    ['arena-hidden-boundary-awareness', '隐藏边界意识', ['arena-summary', 'reflection'], { kind: 'ratio' }],
  ],
  reflection: [
    ['reflection-error-correction', '错因修正', ['reflection', 'grading-fact'], { kind: 'rubric-level', levels: ['missing', 'basic', 'developing', 'proficient'] }],
    ['reflection-evidence-citation', '证据引用', ['reflection', 'grading-fact'], { kind: 'ratio' }],
    ['reflection-plan-adjustment', '学习计划调整', ['path-evidence', 'reflection'], { kind: 'ratio' }],
  ],
  'ai-collaboration': [
    ['ai-prompt-grounding', '提示词证据锚定', ['ai-collaboration'], { kind: 'ratio' }],
    ['ai-feedback-uptake', 'AI 反馈采纳', ['ai-collaboration', 'path-evidence'], { kind: 'ratio' }],
    ['ai-privacy-boundary', 'AI 隐私边界', ['ai-collaboration', 'reflection'], { kind: 'ratio' }],
  ],
};

export const CONTROL_CORRECTION_DIAGNOSIS_INDICATORS: DiagnosisIndicatorDefinition[] = Object.entries(INDICATOR_BLUEPRINTS)
  .flatMap(([dimensionId, indicators]) => indicators.map(([indicatorId, label, sourceFamilies, normalizationPolicy]) => ({
    dimensionId: dimensionId as DiagnosisDimensionId,
    indicatorId,
    label,
    sourceFamilies,
    querySpec: {
      selectors: [indicatorId, dimensionId],
      windowDays: 30,
      requiredFamilies: sourceFamilies.slice(0, 1),
    },
    normalizationPolicy,
    confidencePolicy: {
      minimumEvidenceCount: 2,
      staleAfterDays: 45,
      sourceTrust: Object.fromEntries(sourceFamilies.map((family) => [family, sourceTrust(family)])),
    },
    privacyVisibility: 'student-visible' as const,
    materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
    fallbackBehavior: {
      missing: 'unavailable' as const,
      stale: 'lower-confidence' as const,
      lowConfidence: 'lower-confidence' as const,
      partial: 'lower-confidence' as const,
    },
  })));

export function validateDiagnosisIndicatorDefinition(definition: DiagnosisIndicatorDefinition): string[] {
  const errors: string[] = [];
  if (!definition.dimensionId || !CONTROL_CORRECTION_DIAGNOSIS_DIMENSIONS.some((item) => item.id === definition.dimensionId)) errors.push('indicator-invalid-dimension');
  if (!definition.indicatorId) errors.push('indicator-missing-id');
  if (!definition.sourceFamilies.length) errors.push('indicator-missing-source-family');
  if (!definition.querySpec?.selectors?.length || definition.querySpec.windowDays <= 0) errors.push('indicator-missing-query-spec');
  if (!definition.confidencePolicy || definition.confidencePolicy.minimumEvidenceCount < 1) errors.push('indicator-missing-evidence-threshold');
  if (!definition.normalizationPolicy?.kind) errors.push('indicator-missing-normalization');
  if (definition.materializerVersion !== CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION) errors.push('indicator-invalid-materializer-version');
  return Array.from(new Set(errors));
}

export function validateControlCorrectionDiagnosisProfile(
  dimensions = CONTROL_CORRECTION_DIAGNOSIS_DIMENSIONS,
  indicators = CONTROL_CORRECTION_DIAGNOSIS_INDICATORS,
): string[] {
  const errors = indicators.flatMap(validateDiagnosisIndicatorDefinition);
  for (const dimension of dimensions) {
    const count = indicators.filter((indicator) => indicator.dimensionId === dimension.id).length;
    if (dimension.reportReady && count < 3) errors.push(`dimension-${dimension.id}-insufficient-indicators`);
  }
  if (dimensions.length !== 9) errors.push('profile-missing-control-correction-dimensions');
  return Array.from(new Set(errors));
}

export function materializeControlCorrectionDiagnosisReport(input: DiagnosisReportMaterializationInput): DiagnosisReportSnapshot {
  const generatedAt = input.generatedAt.toISOString();
  const definitions = input.definitions ?? CONTROL_CORRECTION_DIAGNOSIS_INDICATORS;
  const records = collectEvidenceRecords(input);
  const indicators = definitions.map((definition) => materializeIndicator(definition, records, input, generatedAt));
  const acceptedRecords = acceptedEvidenceRecords(definitions, records, input);
  const dimensions = CONTROL_CORRECTION_DIAGNOSIS_DIMENSIONS.map((dimension) => materializeDimension(dimension, indicators));
  const limitations = uniqueLimitations([
    ...indicators.flatMap((indicator) => indicator.limitations),
    ...dimensions.flatMap((dimension) => dimension.limitations),
  ]);
  return {
    id: diagnosisReportSnapshotId(input.subject, input.goalId, generatedAt),
    goalId: input.goalId,
    subject: input.subject,
    generatedAt,
    materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
    indicators,
    dimensions,
    limitations,
    sourceWindows: sourceWindows(acceptedRecords, generatedAt),
  };
}

export function createInMemoryDiagnosisReportSnapshotStore(initial: DiagnosisReportSnapshot[] = []): DiagnosisReportSnapshotStore {
  const snapshots = [...initial];
  return {
    list: () => [...snapshots],
    add: (snapshot) => {
      snapshots.push(snapshot);
    },
  };
}

export function readLatestControlCorrectionDiagnosisReportSnapshot(
  store: DiagnosisReportSnapshotStore,
  request: DiagnosisReportReadRequest,
): DiagnosisReportSnapshot | null {
  return store.list()
    .filter((snapshot) => snapshot.goalId === request.goalId)
    .filter((snapshot) => canReadDiagnosisReportSnapshot(snapshot, request))
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))[0] ?? null;
}

export function createPrismaDiagnosisReportSnapshotStore(
  delegate: DiagnosisReportSnapshotPersistenceDelegate,
): DiagnosisReportSnapshotPersistenceStore {
  return {
    add: async (snapshot) => {
      const row = snapshotToPersistenceRow(snapshot);
      await delegate.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    },
    list: async (request) => {
      let rows: DiagnosisReportSnapshotPersistenceRow[];
      try {
        rows = await delegate.findMany({
          where: persistenceWhereFor(request),
          orderBy: { generatedAt: 'desc' },
          take: 25,
        });
      } catch (error) {
        if (isMissingDiagnosisReportSnapshotTableError(error)) {
          return [];
        }
        throw error;
      }
      return rows
        .map((row) => snapshotFromPersistenceRow(row))
        .filter((snapshot): snapshot is DiagnosisReportSnapshot => Boolean(snapshot))
        .filter((snapshot) => canReadDiagnosisReportSnapshot(snapshot, request))
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
    },
  };
}

function isMissingDiagnosisReportSnapshotTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  if (record.code === 'P2021') return true;
  const meta = record.meta;
  if (!meta || typeof meta !== 'object') return false;
  return JSON.stringify(meta).includes('TableDoesNotExist');
}

export async function readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence(
  store: DiagnosisReportSnapshotPersistenceStore,
  request: DiagnosisReportReadRequest,
): Promise<DiagnosisReportSnapshot | null> {
  return (await store.list(request))[0] ?? null;
}

export async function hasDiagnosisReportSnapshotPersistenceTable(
  client: Partial<DiagnosisReportSnapshotTableProbeClient>,
): Promise<boolean> {
  if (typeof client.$queryRaw !== 'function') return false;
  const rows = await client.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'DiagnosisReportSnapshot'
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

export function canReadDiagnosisReportSnapshot(snapshot: DiagnosisReportSnapshot, request: DiagnosisReportReadRequest): boolean {
  if (request.view === 'service') return true;
  if (request.view === 'student') {
    const userId = request.userId ?? null;
    const targetUserId = request.targetUserId ?? userId;
    return snapshot.subject.kind === 'student' &&
      Boolean(userId) &&
      targetUserId === userId &&
      snapshot.subject.userId === userId;
  }
  const allowedClassIds = new Set(request.teacherClassIds ?? []);
  if (!snapshot.subject.classId || !allowedClassIds.has(snapshot.subject.classId)) return false;
  if (request.classId && snapshot.subject.classId !== request.classId) return false;
  if (request.view === 'teacher-class') return snapshot.subject.kind === 'class';
  if (request.view === 'teacher-student') {
    const targetUserId = request.targetUserId ?? null;
    return snapshot.subject.kind === 'student' && Boolean(targetUserId) && snapshot.subject.userId === targetUserId;
  }
  return false;
}

function materializeIndicator(
  definition: DiagnosisIndicatorDefinition,
  records: DiagnosisEvidenceRecord[],
  input: DiagnosisReportMaterializationInput,
  generatedAt: string,
): DiagnosisIndicatorSnapshot {
  const matched = records.filter((record) => recordMatchesDefinition(record, definition, input));
  const normalized = matched
    .map((record) => normalizeRecord(record, definition.normalizationPolicy))
    .filter((value): value is number => value !== null);
  const score = normalized.length ? round(normalized.reduce((sum, value) => sum + value, 0) / normalized.length) : null;
  const percentile = percentileFor(input.subject, definition.indicatorId, score, input.cohortIndicatorScores ?? []);
  const growthPercentile = growthPercentileFor(input.subject, definition.indicatorId, score, input.priorIndicatorScores ?? [], input.cohortIndicatorScores ?? []);
  const limitations = limitationsForIndicator(definition, matched, input.now ?? input.generatedAt, normalized, percentile, growthPercentile, score);
  const confidence = confidenceForIndicator(definition, matched, score, limitations);
  return {
    indicatorId: definition.indicatorId,
    dimensionId: definition.dimensionId,
    score,
    confidence,
    percentile,
    growthPercentile,
    sourceCoverage: sourceCoverageFor(definition, matched, input.now ?? input.generatedAt),
    evidenceCount: matched.length,
    evidenceWindow: {
      generatedAt,
      sourceLastUpdatedAt: latestUpdatedAt(matched),
      stale: limitations.some((item) => item.reason === 'stale-source'),
    },
    limitations,
    evidenceRefs: matched.map((record) => record.evidenceRef).filter((ref): ref is DiagnosisEvidenceReference => Boolean(ref)),
    materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
  };
}

function materializeDimension(
  dimension: DiagnosisDimensionDefinition,
  indicators: DiagnosisIndicatorSnapshot[],
): DiagnosisDimensionSnapshot {
  const scoped = indicators.filter((indicator) => indicator.dimensionId === dimension.id);
  const scores = scoped.map((indicator) => indicator.score).filter((score): score is number => typeof score === 'number');
  const score = scores.length ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
  const limitations = uniqueLimitations(scoped.flatMap((indicator) => indicator.limitations).map((item) => ({ ...item, dimensionId: dimension.id })));
  return {
    dimensionId: dimension.id,
    score,
    judgment: judgmentForScore(score),
    confidence: scoped.reduce((state, indicator) => minConfidence(state, indicator.confidence.state), 'high' as LearningEvidenceConfidence),
    indicatorIds: scoped.map((indicator) => indicator.indicatorId),
    percentile: aggregatePercentile(scoped.map((indicator) => indicator.percentile)),
    growthPercentile: aggregatePercentile(scoped.map((indicator) => indicator.growthPercentile)),
    limitations,
    evidenceRefs: uniqueEvidenceRefs(scoped.flatMap((indicator) => indicator.evidenceRefs)),
  };
}

function collectEvidenceRecords(input: DiagnosisReportMaterializationInput): DiagnosisEvidenceRecord[] {
  return [
    ...(input.evidenceRecords ?? []),
    ...(input.adaptiveAssessmentRecords ?? []),
    ...(input.simulationSummaries ?? []),
    ...(input.arenaSummaries ?? []),
    ...(input.pathEvidence ?? []),
    ...(input.gradingFacts ?? []),
    ...recordsFromFeatureCache(input.featureCache, input.now ?? input.generatedAt, input),
  ];
}

function recordsFromFeatureCache(
  featureCache: Record<string, any> | null | undefined,
  now: Date,
  input: DiagnosisReportMaterializationInput,
): DiagnosisEvidenceRecord[] {
  if (!featureCache) return [];
  if (input.subject.kind === 'student' && featureCache.userId !== input.subject.userId) return [];
  const path = featureCache.features?.pathExecution?.allTime;
  if (!path || typeof path !== 'object') return [];
  const terminal = path.terminalValidation ?? {};
  return [{
    id: `${featureCache.userId ?? 'unknown'}:feature-cache:path-execution`,
    sourceFamily: 'feature-cache',
    indicatorIds: ['simulation-terminal-validation'],
    value: typeof terminal.completedCount === 'number' && typeof path.evidenceCount === 'number' && path.evidenceCount > 0
      ? terminal.completedCount / path.evidenceCount
      : null,
    confidence: isConfidence(path.confidence?.level) ? path.confidence.level : 'medium',
    updatedAt: featureCache.freshness?.sourceLastUpdatedAt ?? now.toISOString(),
    partial: featureCache.freshness?.stale === true,
    provenance: {
      classId: input.subject.classId,
      userId: input.subject.userId ?? null,
      goalId: input.goalId,
      materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
    },
    evidenceRef: {
      chunkId: `${featureCache.userId ?? 'unknown'}:feature-cache`,
      sourceType: 'path-summary',
      title: '学生证据特征缓存',
    },
  }];
}

function recordMatchesDefinition(
  record: DiagnosisEvidenceRecord,
  definition: DiagnosisIndicatorDefinition,
  input: DiagnosisReportMaterializationInput,
): boolean {
  if (!definition.sourceFamilies.includes(record.sourceFamily)) return false;
  if (!record.provenance?.classId || record.provenance.classId !== input.subject.classId) return false;
  if (!record.provenance?.goalId || record.provenance.goalId !== input.goalId) return false;
  if (input.subject.kind === 'student' && (!record.provenance.userId || record.provenance.userId !== input.subject.userId)) return false;
  if (record.sourceFamily === 'arena-summary') {
    if (record.provenance?.sourceModel !== 'ArenaSubmission' || record.provenance.official !== true) return false;
  }
  if (record.indicatorIds?.includes(definition.indicatorId)) return true;
  if (record.dimensionId === definition.dimensionId) return true;
  return definition.querySpec.selectors.some((selector) => record.id.includes(selector));
}

function acceptedEvidenceRecords(
  definitions: DiagnosisIndicatorDefinition[],
  records: DiagnosisEvidenceRecord[],
  input: DiagnosisReportMaterializationInput,
): DiagnosisEvidenceRecord[] {
  const accepted = new Map<string, DiagnosisEvidenceRecord>();
  for (const definition of definitions) {
    for (const record of records) {
      if (recordMatchesDefinition(record, definition, input)) {
        accepted.set(record.id, record);
      }
    }
  }
  return [...accepted.values()];
}

function normalizeRecord(record: DiagnosisEvidenceRecord, policy: DiagnosisNormalizationPolicy): number | null {
  if (policy.kind === 'rubric-level') {
    if (typeof record.value !== 'string') return null;
    const index = policy.levels.indexOf(record.value);
    return index < 0 ? null : round(index / Math.max(1, policy.levels.length - 1));
  }
  const numeric = typeof record.value === 'number'
    ? record.value
    : typeof record.numerator === 'number' && typeof record.denominator === 'number' && record.denominator > 0
      ? record.numerator / record.denominator
      : null;
  if (numeric === null) return null;
  if (policy.kind === 'ratio') return clamp01(numeric);
  const min = typeof record.min === 'number' ? record.min : policy.min;
  const max = typeof record.max === 'number' ? record.max : policy.max;
  const normalized = max === min ? null : (numeric - min) / (max - min);
  if (normalized === null) return null;
  return policy.kind === 'inverse-bounded-numeric' ? round(1 - clamp01(normalized)) : round(clamp01(normalized));
}

function limitationsForIndicator(
  definition: DiagnosisIndicatorDefinition,
  records: DiagnosisEvidenceRecord[],
  now: Date,
  normalized: number[],
  percentile: DiagnosisPercentileSnapshot,
  growthPercentile: DiagnosisPercentileSnapshot,
  score: number | null,
): DiagnosisLimitation[] {
  const limitations: DiagnosisLimitation[] = [];
  if (records.length === 0) {
    limitations.push(limitation('missing-source', 'No governed evidence matched the indicator.', definition.indicatorId, definition.dimensionId));
  }
  if (records.length > 0 && records.length < definition.confidencePolicy.minimumEvidenceCount) {
    limitations.push(limitation('partial-source', 'Evidence count is below the indicator threshold.', definition.indicatorId, definition.dimensionId));
  }
  for (const record of records) {
    if (record.previewOnly) limitations.push(limitation('preview-only-source', 'Preview-only evidence cannot produce high-confidence diagnosis.', definition.indicatorId, definition.dimensionId));
    if (record.partial) limitations.push(limitation('partial-source', 'Partial evidence lowers confidence.', definition.indicatorId, definition.dimensionId));
    if (record.confidence === 'low' || record.confidence === 'none') limitations.push(limitation('low-confidence-source', 'Low-confidence source lowers confidence.', definition.indicatorId, definition.dimensionId));
    if (isStale(record.updatedAt, now, definition.confidencePolicy.staleAfterDays)) {
      limitations.push(limitation('stale-source', 'Source evidence is stale for this indicator window.', definition.indicatorId, definition.dimensionId));
    }
  }
  if (normalized.length >= 2 && Math.max(...normalized) - Math.min(...normalized) >= 0.6) {
    limitations.push(limitation('conflicting-source', 'Matched sources disagree beyond the indicator conflict threshold.', definition.indicatorId, definition.dimensionId));
  }
  if (score !== null && percentile.fallback === 'insufficient-cohort') {
    limitations.push(limitation('insufficient-cohort', 'Class cohort is too small for a stable percentile.', definition.indicatorId, definition.dimensionId));
  }
  if (score !== null && growthPercentile.fallback === 'cold-start') {
    limitations.push(limitation('cold-start', 'No prior governed score exists for growth percentile.', definition.indicatorId, definition.dimensionId));
  } else if (score !== null && growthPercentile.fallback === 'insufficient-cohort') {
    limitations.push(limitation('insufficient-cohort', 'Growth cohort is too small for a stable percentile.', definition.indicatorId, definition.dimensionId));
  }
  return uniqueLimitations(limitations);
}

function confidenceForIndicator(
  definition: DiagnosisIndicatorDefinition,
  records: DiagnosisEvidenceRecord[],
  score: number | null,
  limitations: DiagnosisLimitation[],
): DiagnosisIndicatorSnapshot['confidence'] {
  if (score === null || records.length === 0) {
    return { state: 'none', score: 0, evidenceCount: records.length, sourceCompleteness: 0 };
  }
  let state = records.reduce((current, record) => minConfidence(current, record.confidence), 'high' as LearningEvidenceConfidence);
  if (records.length < definition.confidencePolicy.minimumEvidenceCount) state = minConfidence(state, 'medium');
  if (limitations.some((item) => item.reason === 'stale-source' || item.reason === 'partial-source' || item.reason === 'preview-only-source')) state = minConfidence(state, 'medium');
  if (limitations.some((item) => item.reason === 'conflicting-source')) state = minConfidence(state, 'medium');
  if (limitations.some((item) => item.reason === 'low-confidence-source')) state = minConfidence(state, 'low');
  const trust = records.reduce((sum, record) => sum + (definition.confidencePolicy.sourceTrust[record.sourceFamily] ?? sourceTrust(record.sourceFamily)), 0) / records.length;
  return {
    state,
    score: round(confidenceScore(state) * trust),
    evidenceCount: records.length,
    sourceCompleteness: round(Math.min(1, records.length / definition.confidencePolicy.minimumEvidenceCount)),
  };
}

function sourceCoverageFor(
  definition: DiagnosisIndicatorDefinition,
  records: DiagnosisEvidenceRecord[],
  now: Date,
): DiagnosisIndicatorSnapshot['sourceCoverage'] {
  return Object.fromEntries(definition.sourceFamilies.map((family) => {
    const familyRecords = records.filter((record) => record.sourceFamily === family);
    if (familyRecords.length === 0) return [family, 'missing'];
    if (familyRecords.some((record) => isStale(record.updatedAt, now, definition.confidencePolicy.staleAfterDays))) return [family, 'stale'];
    if (familyRecords.some((record) => record.confidence === 'low' || record.confidence === 'none')) return [family, 'low-confidence'];
    if (familyRecords.some((record) => record.partial || record.previewOnly)) return [family, 'partial'];
    return [family, 'ready'];
  })) as DiagnosisIndicatorSnapshot['sourceCoverage'];
}

function percentileFor(
  subject: DiagnosisSnapshotSubject,
  indicatorId: string,
  score: number | null,
  cohortScores: DiagnosisCohortIndicatorScore[],
): DiagnosisPercentileSnapshot {
  const scores = comparableScores(subject, indicatorId, cohortScores).map((item) => item.score);
  if (score === null || scores.length < 3) return unavailablePercentile(scores.length, scores.length < 3 ? 'insufficient-cohort' : 'cold-start');
  const atOrBelow = scores.filter((item) => item <= score).length;
  return { state: 'available', percentile: round((atOrBelow / scores.length) * 100), sampleSize: scores.length, fallback: 'none' };
}

function growthPercentileFor(
  subject: DiagnosisSnapshotSubject,
  indicatorId: string,
  score: number | null,
  priorScores: DiagnosisCohortIndicatorScore[],
  currentScores: DiagnosisCohortIndicatorScore[],
): DiagnosisPercentileSnapshot {
  if (score === null || subject.kind !== 'student' || !subject.userId) return unavailablePercentile(0, 'cold-start');
  const scopedPriorScores = comparableScores(subject, indicatorId, priorScores);
  const scopedCurrentScores = comparableScores(subject, indicatorId, currentScores);
  const prior = scopedPriorScores.find((item) => item.subjectId === subject.userId);
  if (!prior) return unavailablePercentile(scopedPriorScores.length, 'cold-start');
  const currentSubjectScore = scopedCurrentScores.find((item) => item.subjectId === subject.userId);
  if (!currentSubjectScore || Date.parse(prior.snapshotAt) >= Date.parse(currentSubjectScore.snapshotAt)) {
    return unavailablePercentile(scopedPriorScores.length, 'cold-start');
  }
  const deltas = scopedCurrentScores
    .map((current) => {
      const previous = scopedPriorScores.find((item) => item.subjectId === current.subjectId);
      if (previous && Date.parse(previous.snapshotAt) >= Date.parse(current.snapshotAt)) return null;
      return previous ? current.score - previous.score : null;
    })
    .filter((value): value is number => value !== null);
  if (deltas.length < 3) return unavailablePercentile(deltas.length, 'insufficient-cohort');
  const delta = score - prior.score;
  return { state: 'available', percentile: round((deltas.filter((item) => item <= delta).length / deltas.length) * 100), sampleSize: deltas.length, fallback: 'none' };
}

function comparableScores(
  subject: DiagnosisSnapshotSubject,
  indicatorId: string,
  scores: DiagnosisCohortIndicatorScore[],
): DiagnosisCohortIndicatorScore[] {
  return scores.filter((item) =>
    item.indicatorId === indicatorId &&
    item.classId === subject.classId &&
    item.materializerVersion === CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION &&
    item.indicatorVersion === CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION &&
    Number.isFinite(Date.parse(item.snapshotAt)) &&
    Number.isFinite(item.score)
  );
}

function snapshotToPersistenceRow(snapshot: DiagnosisReportSnapshot): DiagnosisReportSnapshotPersistenceRow {
  return {
    id: snapshot.id,
    goalId: snapshot.goalId,
    subjectKind: snapshot.subject.kind,
    userId: snapshot.subject.userId ?? null,
    classId: snapshot.subject.classId ?? null,
    generatedAt: new Date(snapshot.generatedAt),
    materializerVersion: snapshot.materializerVersion,
    snapshot,
  };
}

function snapshotFromPersistenceRow(row: DiagnosisReportSnapshotPersistenceRow): DiagnosisReportSnapshot | null {
  const value = row.snapshot;
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as DiagnosisReportSnapshot;
  if (snapshot.id !== row.id || snapshot.goalId !== row.goalId) return null;
  if (snapshot.materializerVersion !== CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION) return null;
  return snapshot;
}

function persistenceWhereFor(request: DiagnosisReportReadRequest): Parameters<DiagnosisReportSnapshotPersistenceDelegate['findMany']>[0]['where'] {
  const where: Parameters<DiagnosisReportSnapshotPersistenceDelegate['findMany']>[0]['where'] = {
    goalId: request.goalId,
    materializerVersion: CONTROL_CORRECTION_DIAGNOSIS_MATERIALIZER_VERSION,
  };
  if (request.view === 'student') {
    where.subjectKind = 'student';
    where.userId = request.userId ?? null;
    where.classId = request.classId ?? null;
  } else if (request.view === 'teacher-student') {
    where.subjectKind = 'student';
    where.userId = request.targetUserId ?? null;
    where.classId = request.classId ?? null;
  } else if (request.view === 'teacher-class') {
    where.subjectKind = 'class';
    where.classId = request.classId ?? null;
  }
  return where;
}

function sourceWindows(records: DiagnosisEvidenceRecord[], generatedAt: string): DiagnosisReportSnapshot['sourceWindows'] {
  const windows: DiagnosisReportSnapshot['sourceWindows'] = {};
  for (const family of new Set(records.map((record) => record.sourceFamily))) {
    const scoped = records.filter((record) => record.sourceFamily === family);
    const latest = latestUpdatedAt(scoped);
    windows[family] = {
      sourceLastUpdatedAt: latest,
      stale: latest ? Date.parse(generatedAt) - Date.parse(latest) > 45 * 24 * 60 * 60 * 1000 : true,
      evidenceCount: scoped.length,
    };
  }
  return windows;
}

function diagnosisReportSnapshotId(subject: DiagnosisSnapshotSubject, goalId: string, generatedAt: string): string {
  return `diagnosis-report:${goalId}:${subject.kind}:${subject.userId ?? subject.classId}:${generatedAt}`;
}

function aggregatePercentile(percentiles: DiagnosisPercentileSnapshot[]): DiagnosisPercentileSnapshot {
  const available = percentiles.filter((item) => item.state === 'available' && item.percentile !== null);
  if (!available.length) return unavailablePercentile(0, 'insufficient-cohort');
  return {
    state: 'available',
    percentile: round(available.reduce((sum, item) => sum + (item.percentile ?? 0), 0) / available.length),
    sampleSize: Math.min(...available.map((item) => item.sampleSize)),
    fallback: 'none',
  };
}

function uniqueEvidenceRefs(refs: DiagnosisEvidenceReference[]): DiagnosisEvidenceReference[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.chunkId)) return false;
    seen.add(ref.chunkId);
    return true;
  });
}

function uniqueLimitations(limitations: DiagnosisLimitation[]): DiagnosisLimitation[] {
  const seen = new Set<string>();
  return limitations.filter((item) => {
    const key = `${item.reason}:${item.indicatorId ?? ''}:${item.dimensionId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function latestUpdatedAt(records: DiagnosisEvidenceRecord[]): string | null {
  return records.map((record) => record.updatedAt).filter(Boolean).sort().at(-1) ?? null;
}

function isStale(updatedAt: string, now: Date, staleAfterDays: number): boolean {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return true;
  return now.getTime() - timestamp > staleAfterDays * 24 * 60 * 60 * 1000;
}

function judgmentForScore(score: number | null): DiagnosisDimensionSnapshot['judgment'] {
  if (score === null) return 'insufficient-evidence';
  if (score >= 0.72) return 'stable';
  if (score >= 0.48) return 'developing';
  return 'needs-attention';
}

function unavailablePercentile(sampleSize: number, fallback: 'insufficient-cohort' | 'cold-start'): DiagnosisPercentileSnapshot {
  return { state: 'unavailable', percentile: null, sampleSize, fallback };
}

function limitation(
  reason: DiagnosisLimitationReason,
  detail: string,
  indicatorId?: string,
  dimensionId?: DiagnosisDimensionId,
): DiagnosisLimitation {
  return { reason, detail, ...(indicatorId ? { indicatorId } : {}), ...(dimensionId ? { dimensionId } : {}) };
}

function minConfidence(left: LearningEvidenceConfidence, right: LearningEvidenceConfidence): LearningEvidenceConfidence {
  return confidenceScore(left) <= confidenceScore(right) ? left : right;
}

function confidenceScore(state: LearningEvidenceConfidence): number {
  if (state === 'high') return 0.9;
  if (state === 'medium') return 0.66;
  if (state === 'low') return 0.34;
  return 0;
}

function sourceTrust(family: DiagnosisSourceFamily): number {
  if (family === 'arena-summary' || family === 'simulation-summary' || family === 'grading-fact') return 0.92;
  if (family === 'adaptive-assessment' || family === 'path-evidence' || family === 'feature-cache') return 0.84;
  if (family === 'learning-fact') return 0.78;
  return 0.7;
}

function isConfidence(value: unknown): value is LearningEvidenceConfidence {
  return value === 'none' || value === 'low' || value === 'medium' || value === 'high';
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function diagnosisEvidenceRefToCitationChip(ref: DiagnosisEvidenceReference, confidence: LearningEvidenceConfidence): LearningEvidenceCitationChipPayload {
  return {
    chunkId: ref.chunkId,
    displayTitle: ref.title,
    displayHref: ref.href ?? null,
    sourceType: ref.sourceType,
    authorityLevel: 'verified',
    confidence,
    freshnessBucket: 'current',
    privacyVisibility: 'redacted',
    limitationState: null,
  };
}
