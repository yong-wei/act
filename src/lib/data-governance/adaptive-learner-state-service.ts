import {
  COMPETENCY_DIMENSIONS,
  createEmptyCompetencyVector,
  type CompetencyDimension,
  type CompetencyVector,
} from './competency-model';
import {
  readStudentEvidenceFeatures,
  type StudentEvidenceCoverageState,
  type StudentEvidenceFeatureReadResult,
  type StudentEvidenceStatusMarker,
  type StudentEvidenceWindow,
} from './student-evidence-feature-cache';

export const ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION = 'adaptive-learner-state.v1';
export const ADAPTIVE_LEARNER_STATE_FEATURE_FLAG = 'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED';
export const ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION = 'adaptive-learner-state.v1';

export type AdaptiveLearnerStateRole = 'student' | 'teacher' | 'admin' | 'system';
export type AdaptiveLearnerStatePrivacyScope =
  | 'student-visible'
  | 'teacher-scoped'
  | 'admin-scoped'
  | 'audit-only'
  | 'system-internal';

export type AdaptiveLearnerStateFieldFamily =
  | 'primaryCompetencies'
  | 'secondaryDimensions'
  | 'knowledgeMastery'
  | 'resourcePreference'
  | 'mediaAbsorption'
  | 'pathContext'
  | 'riskState'
  | 'prerequisiteFeatureGroups';

export type AdaptiveLearnerSecondaryDimension =
  | 'conceptMastery'
  | 'timeFrequencyTransfer'
  | 'modelingReliability'
  | 'tuningEfficiency'
  | 'constrainedOptimization'
  | 'solutionStability'
  | 'crossModalTransfer'
  | 'scenarioGeneralization'
  | 'riskRecognition'
  | 'constraintCompliance'
  | 'explanationQuality'
  | 'aiUseStrategy'
  | 'reflectionDepth'
  | 'pathExecution'
  | 'persistence'
  | 'remedialInitiative';

export interface AdaptiveLearnerStateFieldContract {
  valueRange: string;
  sourceFamilies: string[];
  algorithmVersion: string;
  evidenceThreshold: string;
  confidencePolicy: string;
  fallbackReason: string;
  privacyScope: AdaptiveLearnerStatePrivacyScope;
}

export const ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS: Record<AdaptiveLearnerStateFieldFamily, AdaptiveLearnerStateFieldContract> = {
  primaryCompetencies: {
    valueRange: '0-100 per primary competency',
    sourceFamilies: ['StudentCompetencySnapshot', 'StudentEvidenceFeatureCache'],
    algorithmVersion: 'competency-snapshot-versioned',
    evidenceThreshold: 'latest approved snapshot or fallback empty vector',
    confidencePolicy: 'snapshot-confidence-per-dimension',
    fallbackReason: 'missing-competency-snapshot',
    privacyScope: 'student-visible',
  },
  secondaryDimensions: {
    valueRange: '0-100 derived second-level dimension score',
    sourceFamilies: ['StudentCompetencySnapshot', 'LearningFact', 'StudentEvidenceFeatureCache'],
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    evidenceThreshold: 'primary dimension evidence plus matching governed facts where present',
    confidencePolicy: 'inherits-primary-confidence-capped-by-evidence',
    fallbackReason: 'missing-second-level-evidence',
    privacyScope: 'student-visible',
  },
  knowledgeMastery: {
    valueRange: '0-1 posterior mastery per knowledge tag',
    sourceFamilies: ['AdaptiveMasteryUpdate', 'AdaptiveAssessmentAnswer', 'LearningFact'],
    algorithmVersion: 'adaptive-assessment-bkt-v1',
    evidenceThreshold: 'at least one assessment-backed mastery update',
    confidencePolicy: 'assessment-backed-mastery',
    fallbackReason: 'missing-assessment-backed-mastery',
    privacyScope: 'student-visible',
  },
  resourcePreference: {
    valueRange: 'ranked modality list derived from governed evidence counts',
    sourceFamilies: ['LearningFact', 'StudentEvidenceFeatureCache'],
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    evidenceThreshold: 'at least one governed resource or activity fact',
    confidencePolicy: 'count-and-recency-weighted-context',
    fallbackReason: 'missing-resource-activity-evidence',
    privacyScope: 'student-visible',
  },
  mediaAbsorption: {
    valueRange: '0-1 average media completion proxy',
    sourceFamilies: ['LearningFact', 'StudentEvidenceFeatureCache'],
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    evidenceThreshold: 'at least one governed media fact',
    confidencePolicy: 'media-progress-context-never-high-alone',
    fallbackReason: 'missing-media-evidence',
    privacyScope: 'student-visible',
  },
  pathContext: {
    valueRange: 'active/bookmarked/recent path counts and references',
    sourceFamilies: ['LearningPath', 'future AdaptiveLearningPath'],
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    evidenceThreshold: 'at least one path record or empty explicit path context',
    confidencePolicy: 'path-context-is-contextual',
    fallbackReason: 'path-planning-not-started',
    privacyScope: 'student-visible',
  },
  riskState: {
    valueRange: 'none/low/medium/high plus redacted active flags',
    sourceFamilies: ['StudentRiskFlag', 'StudentProfileSummary'],
    algorithmVersion: 'risk-detector-versioned',
    evidenceThreshold: 'active unresolved risk flags or profile summary risk level',
    confidencePolicy: 'risk-signals-are-actionable-not-mastery',
    fallbackReason: 'no-active-risk-record',
    privacyScope: 'teacher-scoped',
  },
  prerequisiteFeatureGroups: {
    valueRange: 'compact simulation/Arena feature groups with confidence markers',
    sourceFamilies: ['StudentEvidenceFeatureCache'],
    algorithmVersion: 'student-evidence-features.v3',
    evidenceThreshold: 'materialized simulation/Arena feature group from prerequisite change',
    confidencePolicy: 'consume-prerequisite-confidence-without-redefinition',
    fallbackReason: 'missing-prerequisite-feature-cache',
    privacyScope: 'student-visible',
  },
};

export interface AdaptiveLearnerStateInput {
  userId: string;
  role: AdaptiveLearnerStateRole;
  classId?: string | null;
  now?: Date;
  clientHints?: Record<string, unknown>;
}

export interface AdaptiveLearnerState {
  userId: string;
  payloadVersion: string;
  generatedAt: string;
  authority: 'server-owned';
  roleScope: {
    role: AdaptiveLearnerStateRole;
    classId: string | null;
    privacyScopes: AdaptiveLearnerStatePrivacyScope[];
  };
  featureFlag: {
    name: typeof ADAPTIVE_LEARNER_STATE_FEATURE_FLAG;
    enabled: boolean;
    fallback: string;
  };
  clientHints: {
    received: boolean;
    authoritative: false;
    reason: 'client-hints-non-authoritative';
  };
  primaryCompetencies: {
    source: 'latest-snapshot' | 'feature-cache' | 'fallback-empty';
    vector: CompetencyVector;
  };
  secondaryDimensions: Record<AdaptiveLearnerSecondaryDimension, {
    primaryDimension: CompetencyDimension;
    value: number;
    confidence: number;
    evidenceCount: number;
    source: string;
  }>;
  knowledgeMastery: {
    coverage: StudentEvidenceCoverageState;
    tags: Record<string, {
      posteriorMastery: number;
      confidence: number;
      evidenceCount: number;
      source: 'adaptive-assessment';
      algorithmVersion: string;
      lastUpdatedAt: string;
    }>;
  };
  resourcePreference: {
    preferredModalities: string[];
    sourceCounts: Record<string, number>;
    confidence: 'none' | 'low' | 'medium';
  };
  mediaAbsorption: {
    mediaFactCount: number;
    averageCompletion: number | null;
    confidence: 'none' | 'low' | 'medium';
  };
  pathContext: {
    activePathCount: number;
    bookmarkedPathCount: number;
    recentPathIds: string[];
    statusMarkers: Array<'missing' | 'available'>;
  };
  risks: {
    riskLevel: string;
    activeFlags: Array<{
      type: string;
      severity: string;
      description: string;
      triggeredAt: string;
    }>;
  };
  assessmentState: {
    latestAbilityEstimate: {
      theta: number;
      confidenceInterval: [number, number];
      algorithmVersion: string;
      estimatedAt: string;
    } | null;
  };
  evidence: {
    readState: StudentEvidenceFeatureReadResult['state'];
    evidenceWindow: StudentEvidenceWindow;
    sourceCounts: Record<string, unknown>;
    sourceCoverage: Record<string, StudentEvidenceCoverageState>;
    confidence: {
      level: 'none' | 'low' | 'medium' | 'high';
      score: number;
      evidenceCount: number;
      sourceCompleteness: number;
    };
    statusMarkers: StudentEvidenceStatusMarker[];
  };
  prerequisiteFeatureGroups: {
    simulationArena: Record<string, unknown> | null;
  };
  fieldContracts: typeof ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS;
  missingEvidence: string[];
}

interface AdaptiveLearnerStateDb {
  studentEvidenceFeatureCache?: {
    findUnique?: (args: any) => Promise<any | null>;
  };
  studentCompetencySnapshot?: {
    findFirst?: (args: any) => Promise<any | null>;
  };
  studentProfileSummary?: {
    findUnique?: (args: any) => Promise<any | null>;
  };
  learningFact?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
  adaptiveMasteryUpdate?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
  adaptiveAssessmentAbilityEstimate?: {
    findFirst?: (args: any) => Promise<any | null>;
  };
  studentRiskFlag?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
  learningPath?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
}

const SECONDARY_DIMENSION_PRIMARY: Record<AdaptiveLearnerSecondaryDimension, CompetencyDimension> = {
  conceptMastery: 'controlModeling',
  timeFrequencyTransfer: 'crossDomainTransfer',
  modelingReliability: 'controlModeling',
  tuningEfficiency: 'parameterDesign',
  constrainedOptimization: 'parameterDesign',
  solutionStability: 'engineeringDecision',
  crossModalTransfer: 'crossDomainTransfer',
  scenarioGeneralization: 'crossDomainTransfer',
  riskRecognition: 'engineeringDecision',
  constraintCompliance: 'engineeringDecision',
  explanationQuality: 'inquiryReflection',
  aiUseStrategy: 'inquiryReflection',
  reflectionDepth: 'inquiryReflection',
  pathExecution: 'selfDirectedLearning',
  persistence: 'selfDirectedLearning',
  remedialInitiative: 'selfDirectedLearning',
};

const DEFAULT_EVIDENCE_WINDOW: StudentEvidenceWindow = {
  firstStartedAt: null,
  lastStartedAt: null,
  daysCovered: 0,
};

export function isAdaptiveLearnerStateServiceEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED === 'true';
}

export async function readAdaptiveLearnerState(
  db: AdaptiveLearnerStateDb,
  input: AdaptiveLearnerStateInput,
): Promise<AdaptiveLearnerState> {
  const now = input.now ?? new Date();
  const featureRead = await readFeatureCache(db, input.userId, now);
  const featureCache = asRecord(featureRead.cache);
  const featureSnapshot = getObject(getObject(getObject(featureCache.features).approvedAggregates).latestSnapshot);
  const featureSimulationArena = getObject(getObject(featureCache.features).simulationArena);

  const [
    latestSnapshot,
    profileSummary,
    facts,
    masteryUpdates,
    latestAbility,
    riskFlags,
    paths,
  ] = await Promise.all([
    db.studentCompetencySnapshot?.findFirst?.({
      where: { userId: input.userId },
      orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }],
    }) ?? Promise.resolve(null),
    db.studentProfileSummary?.findUnique?.({
      where: { userId: input.userId },
    }) ?? Promise.resolve(null),
    db.learningFact?.findMany?.({
      where: { userId: input.userId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    }) ?? Promise.resolve([]),
    db.adaptiveMasteryUpdate?.findMany?.({
      where: { userId: input.userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    }) ?? Promise.resolve([]),
    db.adaptiveAssessmentAbilityEstimate?.findFirst?.({
      where: { userId: input.userId },
      orderBy: [{ estimatedAt: 'desc' }, { id: 'desc' }],
    }) ?? Promise.resolve(null),
    db.studentRiskFlag?.findMany?.({
      where: { userId: input.userId, isResolved: false },
      orderBy: { triggeredAt: 'desc' },
      take: 20,
    }) ?? Promise.resolve([]),
    db.learningPath?.findMany?.({
      where: { userId: input.userId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }) ?? Promise.resolve([]),
  ]);

  const { vector, source } = resolvePrimaryCompetencyVector(latestSnapshot, featureSnapshot);
  const knowledgeMastery = buildKnowledgeMastery(masteryUpdates);
  const evidence = buildEvidenceSummary(featureRead, featureCache);
  const missingEvidence = buildMissingEvidence({
    latestSnapshot,
    profileSummary,
    featureRead,
    masteryUpdates,
  });

  return {
    userId: input.userId,
    payloadVersion: ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
    generatedAt: now.toISOString(),
    authority: 'server-owned',
    roleScope: {
      role: input.role,
      classId: input.classId ?? null,
      privacyScopes: privacyScopesForRole(input.role),
    },
    featureFlag: {
      name: ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
      enabled: isAdaptiveLearnerStateServiceEnabled(),
      fallback: 'legacy-profile-summary-and-recommendation-consumers',
    },
    clientHints: {
      received: Boolean(input.clientHints && Object.keys(input.clientHints).length > 0),
      authoritative: false,
      reason: 'client-hints-non-authoritative',
    },
    primaryCompetencies: {
      source,
      vector,
    },
    secondaryDimensions: buildSecondaryDimensions(vector),
    knowledgeMastery,
    resourcePreference: buildResourcePreference(facts),
    mediaAbsorption: buildMediaAbsorption(facts),
    pathContext: buildPathContext(paths),
    risks: buildRiskState(profileSummary, riskFlags, input.role),
    assessmentState: {
      latestAbilityEstimate: buildAbilityEstimate(latestAbility),
    },
    evidence,
    prerequisiteFeatureGroups: {
      simulationArena: Object.keys(featureSimulationArena).length > 0
        ? getObject(featureSimulationArena.allTime)
        : null,
    },
    fieldContracts: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
    missingEvidence,
  };
}

export async function readPathPlannerLearnerState(
  db: AdaptiveLearnerStateDb,
  userId: string,
): Promise<AdaptiveLearnerState> {
  return readAdaptiveLearnerState(db, {
    userId,
    role: 'system',
  });
}

async function readFeatureCache(
  db: AdaptiveLearnerStateDb,
  userId: string,
  now: Date,
): Promise<StudentEvidenceFeatureReadResult> {
  if (!db.studentEvidenceFeatureCache?.findUnique) {
    return {
      state: 'missing',
      cache: null,
      rawReadExceptions: ['audit', 'debug', 'drilldown', 'migration'],
    };
  }
  return readStudentEvidenceFeatures(db as Parameters<typeof readStudentEvidenceFeatures>[0], userId, { now });
}

function resolvePrimaryCompetencyVector(
  latestSnapshot: Record<string, unknown> | null,
  featureSnapshot: Record<string, unknown>,
): { vector: CompetencyVector; source: AdaptiveLearnerState['primaryCompetencies']['source'] } {
  const snapshotVector = latestSnapshot ? toCompetencyVector(latestSnapshot.competencyVector) : null;
  if (snapshotVector) {
    return { vector: snapshotVector, source: 'latest-snapshot' };
  }
  const cachedVector = toCompetencyVector(featureSnapshot.competencyVector);
  if (cachedVector) {
    return { vector: cachedVector, source: 'feature-cache' };
  }
  return { vector: createEmptyCompetencyVector(), source: 'fallback-empty' };
}

function buildSecondaryDimensions(vector: CompetencyVector): AdaptiveLearnerState['secondaryDimensions'] {
  return Object.fromEntries(
    Object.entries(SECONDARY_DIMENSION_PRIMARY).map(([dimension, primaryDimension]) => {
      const primary = vector[primaryDimension];
      return [dimension, {
        primaryDimension,
        value: round(primary.score),
        confidence: round(primary.confidence, 2),
        evidenceCount: primary.evidenceCount,
        source: 'primary-competency-derived',
      }];
    }),
  ) as AdaptiveLearnerState['secondaryDimensions'];
}

function buildKnowledgeMastery(rows: Array<Record<string, unknown>>): AdaptiveLearnerState['knowledgeMastery'] {
  const tags: AdaptiveLearnerState['knowledgeMastery']['tags'] = {};
  for (const row of rows) {
    const knowledgeTag = readString(row.knowledgeTag);
    if (!knowledgeTag || tags[knowledgeTag]) {
      continue;
    }
    tags[knowledgeTag] = {
      posteriorMastery: round(numberValue(row.posteriorMastery), 2),
      confidence: round(numberValue(row.confidence), 2),
      evidenceCount: 1,
      source: 'adaptive-assessment',
      algorithmVersion: readString(row.algorithmVersion) ?? 'unknown',
      lastUpdatedAt: dateToIso(row.createdAt),
    };
  }
  return {
    coverage: Object.keys(tags).length > 0 ? 'available' : 'missing',
    tags,
  };
}

function buildResourcePreference(facts: Array<Record<string, unknown>>): AdaptiveLearnerState['resourcePreference'] {
  const sourceCounts: Record<string, number> = {};
  for (const fact of facts) {
    const modality = factTypeToModality(readString(fact.factType));
    if (!modality) continue;
    sourceCounts[modality] = (sourceCounts[modality] ?? 0) + 1;
  }
  const preferredModalities = Object.entries(sourceCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([modality]) => modality);
  return {
    preferredModalities,
    sourceCounts,
    confidence: preferredModalities.length >= 5 ? 'medium' : preferredModalities.length > 0 ? 'low' : 'none',
  };
}

function buildMediaAbsorption(facts: Array<Record<string, unknown>>): AdaptiveLearnerState['mediaAbsorption'] {
  const mediaProgress = facts
    .filter((fact) => factTypeToModality(readString(fact.factType)) === 'media')
    .map((fact) => {
      const context = getObject(fact.contextJson);
      const media = getObject(context.media);
      return finiteNumber(media.progress) ?? scoreToProgress(fact.score);
    })
    .filter((value): value is number => value !== null);
  return {
    mediaFactCount: mediaProgress.length,
    averageCompletion: mediaProgress.length
      ? round(mediaProgress.reduce((sum, value) => sum + value, 0) / mediaProgress.length, 2)
      : null,
    confidence: mediaProgress.length >= 3 ? 'medium' : mediaProgress.length > 0 ? 'low' : 'none',
  };
}

function buildPathContext(paths: Array<Record<string, unknown>>): AdaptiveLearnerState['pathContext'] {
  return {
    activePathCount: paths.length,
    bookmarkedPathCount: paths.filter((path) => path.isBookmarked === true).length,
    recentPathIds: paths.map((path) => readString(path.id)).filter((id): id is string => Boolean(id)),
    statusMarkers: paths.length > 0 ? ['available'] : ['missing'],
  };
}

function buildRiskState(
  profileSummary: Record<string, unknown> | null,
  riskFlags: Array<Record<string, unknown>>,
  role: AdaptiveLearnerStateRole,
): AdaptiveLearnerState['risks'] {
  if (!privacyScopesForRole(role).includes('teacher-scoped')) {
    return {
      riskLevel: 'redacted',
      activeFlags: [],
    };
  }

  return {
    riskLevel: readString(profileSummary?.riskLevel) ?? (riskFlags.length > 0 ? 'medium' : 'none'),
    activeFlags: riskFlags.map((flag) => ({
      type: readString(flag.flagType) ?? 'unknown',
      severity: readString(flag.severity) ?? 'unknown',
      description: readString(flag.description) ?? '',
      triggeredAt: dateToIso(flag.triggeredAt),
    })),
  };
}

function buildAbilityEstimate(value: Record<string, unknown> | null): AdaptiveLearnerState['assessmentState']['latestAbilityEstimate'] {
  if (!value) {
    return null;
  }
  return {
    theta: round(numberValue(value.theta), 2),
    confidenceInterval: [
      round(numberValue(value.confidenceLow), 2),
      round(numberValue(value.confidenceHigh), 2),
    ],
    algorithmVersion: readString(value.algorithmVersion) ?? 'unknown',
    estimatedAt: dateToIso(value.estimatedAt),
  };
}

function buildEvidenceSummary(
  featureRead: StudentEvidenceFeatureReadResult,
  featureCache: Record<string, unknown>,
): AdaptiveLearnerState['evidence'] {
  const sourceCounts = getObject(featureCache.sourceCounts);
  const sourceCoverage = normalizeCoverageRecord(featureCache.sourceCoverage);
  const confidence = normalizeConfidence(featureCache.confidenceMarkers);
  const statusMarkers = normalizeStatusMarkers(featureCache.statusMarkers);
  if (!featureRead.cache) {
    statusMarkers.push('missing-source', 'low-confidence');
  }
  return {
    readState: featureRead.state,
    evidenceWindow: normalizeEvidenceWindow(featureCache.evidenceWindow),
    sourceCounts,
    sourceCoverage,
    confidence,
    statusMarkers: unique(statusMarkers),
  };
}

function buildMissingEvidence(input: {
  latestSnapshot: Record<string, unknown> | null;
  profileSummary: Record<string, unknown> | null;
  featureRead: StudentEvidenceFeatureReadResult;
  masteryUpdates: Array<Record<string, unknown>>;
}): string[] {
  const missing: string[] = [];
  if (!input.latestSnapshot) missing.push('StudentCompetencySnapshot');
  if (!input.profileSummary) missing.push('StudentProfileSummary');
  if (!input.featureRead.cache) missing.push('StudentEvidenceFeatureCache');
  if (input.masteryUpdates.length === 0) missing.push('AdaptiveMasteryUpdate');
  return missing;
}

function privacyScopesForRole(role: AdaptiveLearnerStateRole): AdaptiveLearnerStatePrivacyScope[] {
  if (role === 'admin') {
    return ['student-visible', 'teacher-scoped', 'admin-scoped'];
  }
  if (role === 'teacher') {
    return ['student-visible', 'teacher-scoped'];
  }
  if (role === 'system') {
    return ['student-visible', 'teacher-scoped', 'admin-scoped', 'audit-only', 'system-internal'];
  }
  return ['student-visible'];
}

function factTypeToModality(factType: string | null): string | null {
  if (!factType) return null;
  if (factType === 'question' || factType === 'assessment') return 'assessment';
  if (factType === 'media' || factType === 'video' || factType === 'audio') return 'media';
  if (factType === 'simulation' || factType === 'design') return 'simulation';
  if (factType === 'reflection') return 'reflection';
  if (factType === 'resource') return 'resource';
  return factType;
}

function toCompetencyVector(value: unknown): CompetencyVector | null {
  if (!isObject(value)) {
    return null;
  }
  if (!COMPETENCY_DIMENSIONS.every((dimension) => isObject(value[dimension]) && Number.isFinite(value[dimension].score))) {
    return null;
  }
  return value as unknown as CompetencyVector;
}

function normalizeEvidenceWindow(value: unknown): StudentEvidenceWindow {
  const window = getObject(value);
  return {
    firstStartedAt: readString(window.firstStartedAt),
    lastStartedAt: readString(window.lastStartedAt),
    daysCovered: numberValue(window.daysCovered),
  };
}

function normalizeCoverageRecord(value: unknown): Record<string, StudentEvidenceCoverageState> {
  const sourceCoverage = getObject(value);
  return Object.fromEntries(
    Object.entries(sourceCoverage).map(([key, entry]) => [key, normalizeCoverageState(entry)]),
  );
}

function normalizeCoverageState(value: unknown): StudentEvidenceCoverageState {
  return value === 'available' || value === 'partial' || value === 'missing' ? value : 'missing';
}

function normalizeConfidence(value: unknown): AdaptiveLearnerState['evidence']['confidence'] {
  const confidence = getObject(value);
  const level = confidence.level;
  return {
    level: level === 'none' || level === 'low' || level === 'medium' || level === 'high' ? level : 'none',
    score: numberValue(confidence.score),
    evidenceCount: numberValue(confidence.evidenceCount),
    sourceCompleteness: numberValue(confidence.sourceCompleteness),
  };
}

function normalizeStatusMarkers(value: unknown): StudentEvidenceStatusMarker[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is StudentEvidenceStatusMarker =>
    item === 'stale' ||
    item === 'partial' ||
    item === 'low-confidence' ||
    item === 'missing-source'
  );
}

function scoreToProgress(value: unknown): number | null {
  const score = finiteNumber(value);
  if (score === null) return null;
  return score > 1 ? round(score / 100, 2) : round(score, 2);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function getObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function dateToIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(0).toISOString();
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
