import {
  buildControlCorrectionSarDemoFixture,
} from './sar-diagnostics';
import {
  createSarPersistenceRepository,
  type SarPersistenceRepository,
} from './sar-persistence';
import type {
  SarRetrievalResult,
  SarValidationIssue,
} from './structured-associative-retrieval';
import {
  projectGovernedSummaryToSar,
} from './structured-associative-retrieval';

export type SarRefreshSourceFamily =
  | 'kaq-graph'
  | 'learning-goal'
  | 'resource-node'
  | 'learning-evidence'
  | 'learning-fact-summary'
  | 'simulation-summary'
  | 'arena-official'
  | 'path-summary';

export type SarRefreshHealthStatus = 'fresh' | 'stale' | 'degraded' | 'failed';
export type SarRefreshRetryState = 'not-needed' | 'retry-scheduled' | 'retrying' | 'blocked';

export type SarArenaOfficialSource = 'ArenaSubmission' | 'ArenaEvaluationRun';
export type SarArenaAuxiliarySource = 'LearningFact' | 'SARTrace' | 'KAQWriteback' | 'LearnerEvidenceProjection';

export interface SarArenaAuthorityInput {
  scoreSource: SarArenaOfficialSource | SarArenaAuxiliarySource;
  validitySource: SarArenaOfficialSource | SarArenaAuxiliarySource;
  rankingSource: SarArenaOfficialSource | SarArenaAuxiliarySource;
  attemptPolicySource: SarArenaOfficialSource | SarArenaAuxiliarySource;
  evaluationMetricsSource: SarArenaOfficialSource | SarArenaAuxiliarySource;
  auxiliarySources?: readonly SarArenaAuxiliarySource[];
  officialRecords?: {
    submissionCount: number;
    evaluationRunCount: number;
    latestSubmissionAt?: string | null;
    latestEvaluationCompletedAt?: string | null;
    scoreRefs: readonly string[];
    validityRefs: readonly string[];
    rankingRefs: readonly string[];
    attemptPolicyRefs: readonly string[];
    evaluationMetricRefs: readonly string[];
  };
}

export interface SarRefreshSourceInput {
  family: SarRefreshSourceFamily;
  sourceVersion?: string;
  highWaterMark?: string;
  lastSuccessfulAt?: string | null;
  staleCount?: number;
  failureCount?: number;
  retryState?: SarRefreshRetryState;
  limitations?: readonly string[];
  result?: SarRetrievalResult;
  arenaAuthority?: SarArenaAuthorityInput;
}

export interface SarRefreshSourceHealthRecord {
  family: SarRefreshSourceFamily;
  status: SarRefreshHealthStatus;
  sourceVersion: string | null;
  highWaterMark: string | null;
  lastAttemptedAt: string;
  lastSuccessfulAt: string | null;
  projectedEventCount: number;
  projectedEntityCount: number;
  projectedRelationCount: number;
  staleCount: number;
  failureCount: number;
  retryState: SarRefreshRetryState;
  limitations: string[];
  arenaAuthority?: {
    officialSources: SarArenaOfficialSource[];
    auxiliarySources: SarArenaAuxiliarySource[];
    officialRecordSummary: {
      submissionCount: number;
      evaluationRunCount: number;
      latestSubmissionAt: string | null;
      latestEvaluationCompletedAt: string | null;
    };
  };
}

export interface SarRefreshHealth {
  generatedAt: string;
  status: SarRefreshHealthStatus;
  lastAttemptedAt: string;
  lastSuccessfulAt: string | null;
  totals: {
    sourceFamilyCount: number;
    projectedEventCount: number;
    projectedEntityCount: number;
    projectedRelationCount: number;
    staleSourceCount: number;
    failureCount: number;
  };
  sources: SarRefreshSourceHealthRecord[];
  limitations: string[];
  operationEvidence?: {
    operationId: string;
    idempotencyKey: string;
  };
}

export interface SarProjectionRefreshResult {
  repository: SarPersistenceRepository;
  health: SarRefreshHealth;
  writes: Array<{
    family: SarRefreshSourceFamily;
    persisted: boolean;
    issues: SarValidationIssue[];
  }>;
}

const OFFICIAL_ARENA_SOURCES = new Set<SarArenaOfficialSource>([
  'ArenaSubmission',
  'ArenaEvaluationRun',
]);

const FORBIDDEN_HEALTH_TEXT = [
  /\braw[_ -]?(answer|answers|evidence|submission|submissions|trace|traces|payload)\b/i,
  /\braw(?:Learner|Student)?(?:Answer|Answers|Evidence|Submission|Submissions|Trace|Traces|Payload)\w*\b/i,
  /\bhidden(?:Arena|ArenaEvaluation|Evaluation)?Internals?\w*\b/i,
  /\bhidden\b.*\b(arena|evaluation|internals)\b/i,
  /\bprivate[_ -]?konling[_ -]?memory\b/i,
  /\baudit[_ -]?only[_ -]?trace\b/i,
];

export function runSarProjectionRefresh(input: {
  sources: readonly SarRefreshSourceInput[];
  repository?: SarPersistenceRepository;
  now?: string;
  persist?: boolean;
  operationEvidence?: SarRefreshHealth['operationEvidence'];
}): SarProjectionRefreshResult {
  const now = input.now ?? new Date().toISOString();
  const repository = input.repository ?? createSarPersistenceRepository({ now: () => now });
  const persistedSnapshot = input.persist === false ? repository.getSnapshot() : null;
  const writes: SarProjectionRefreshResult['writes'] = [];
  const sourceRecords: SarRefreshSourceHealthRecord[] = [];

  for (const source of input.sources) {
    const arenaAuthority = source.family === 'arena-official'
      ? evaluateArenaAuthority(source.arenaAuthority)
      : null;
    const sourceLimitations = uniqueSorted([
      ...sanitizeLimitations(source.limitations ?? []),
      ...(arenaAuthority?.limitations ?? []),
    ]);
    let persisted = true;
    let writeIssues: SarValidationIssue[] = [];
    const persistenceResult = source.result ? persistenceSafeSarResult(source.result) : null;
    const persistedLastSuccessfulAt = persistedSourceLastSuccessfulAt(
      persistedSnapshot,
      source,
      persistenceResult,
    );
    if (source.result && input.persist !== false) {
      const writeResult = repository.upsertResult(persistenceResult ?? source.result, { now });
      persisted = writeResult.persisted;
      writeIssues = writeResult.issues;
      writes.push({
        family: source.family,
        persisted,
        issues: writeIssues,
      });
    }
    const failureCount = Math.max(
      source.failureCount ?? 0,
      persisted ? 0 : Math.max(1, writeIssues.length),
      arenaAuthority?.valid === false ? 1 : 0,
    );
    const staleCount = Math.max(0, source.staleCount ?? 0);
    const projectionLimitations = source.result
      ? sourceLimitations
      : uniqueSorted([...sourceLimitations, 'sar-projection-builder-unavailable']);
    sourceRecords.push({
      family: source.family,
      status: sourceStatus({
        staleCount,
        failureCount,
        limitations: projectionLimitations,
      }),
      sourceVersion: source.sourceVersion ?? null,
      highWaterMark: source.highWaterMark ?? null,
      lastAttemptedAt: now,
      lastSuccessfulAt: failureCount > 0
        ? source.lastSuccessfulAt ?? persistedLastSuccessfulAt
        : source.result && input.persist !== false
          ? now
          : source.lastSuccessfulAt ?? persistedLastSuccessfulAt,
      projectedEventCount: persistenceResult?.events.length ?? 0,
      projectedEntityCount: persistenceResult?.entities.length ?? 0,
      projectedRelationCount: persistenceResult?.relations.length ?? 0,
      staleCount,
      failureCount,
      retryState: source.retryState ?? (failureCount > 0 ? 'retry-scheduled' : 'not-needed'),
      limitations: projectionLimitations,
      arenaAuthority: arenaAuthority?.summary,
    });
  }

  const health: SarRefreshHealth = {
    generatedAt: now,
    status: aggregateStatus(sourceRecords),
    lastAttemptedAt: now,
    lastSuccessfulAt: latestSuccessfulAt(sourceRecords),
    totals: {
      sourceFamilyCount: new Set(sourceRecords.map((record) => record.family)).size,
      projectedEventCount: sourceRecords.reduce((total, record) => total + record.projectedEventCount, 0),
      projectedEntityCount: sourceRecords.reduce((total, record) => total + record.projectedEntityCount, 0),
      projectedRelationCount: sourceRecords.reduce((total, record) => total + record.projectedRelationCount, 0),
      staleSourceCount: sourceRecords.filter((record) => record.staleCount > 0 || record.status === 'stale').length,
      failureCount: sourceRecords.reduce((total, record) => total + record.failureCount, 0),
    },
    sources: sourceRecords,
    limitations: uniqueSorted(sourceRecords.flatMap((record) => record.limitations)),
    operationEvidence: input.operationEvidence,
  };

  return { repository, health, writes };
}

export function buildControlCorrectionSarRefreshSources(
  generatedAt = new Date().toISOString(),
  input: {
    coverageSources?: readonly {
      sourceId: string;
      totalRows: number;
      eligibleRows: number;
      excludedRows: number;
      unsupportedRows: number;
      lastObservedAt: string | null;
      materializationReadiness: string;
      readinessGapCounts?: Record<string, number>;
    }[];
    arenaAuthority?: SarArenaAuthorityInput;
  } = {},
): SarRefreshSourceInput[] {
  const fixture = buildControlCorrectionSarDemoFixture(generatedAt);
  const coverageByFamily = summarizeCoverageByFamily(input.coverageSources ?? []);
  const arenaCoverage = input.arenaAuthority?.officialRecords
    && input.arenaAuthority.officialRecords.submissionCount > 0
    && input.arenaAuthority.officialRecords.evaluationRunCount > 0
    ? normalizeOfficialArenaCoverage(coverageByFamily.get('arena-official'))
    : coverageByFamily.get('arena-official');
  return [
    source('kaq-graph', generatedAt, coverageByFamily.get('kaq-graph')),
    source('learning-goal', generatedAt, coverageByFamily.get('learning-goal')),
    source('resource-node', generatedAt, coverageByFamily.get('resource-node')),
    source('learning-evidence', generatedAt, coverageByFamily.get('learning-evidence')),
    source('learning-fact-summary', generatedAt, coverageByFamily.get('learning-fact-summary')),
    source('simulation-summary', generatedAt, coverageByFamily.get('simulation-summary')),
    {
      ...source('arena-official', generatedAt, arenaCoverage),
      arenaAuthority: input.arenaAuthority ?? {
        scoreSource: 'ArenaEvaluationRun',
        validitySource: 'ArenaEvaluationRun',
        rankingSource: 'ArenaSubmission',
        attemptPolicySource: 'ArenaSubmission',
        evaluationMetricsSource: 'ArenaEvaluationRun',
        auxiliarySources: ['LearningFact', 'SARTrace', 'KAQWriteback'],
      },
      limitations: ['arena-auxiliary-evidence-context-only'],
    },
    {
      ...source('path-summary', generatedAt, coverageByFamily.get('path-summary')),
      result: fixture.result,
      limitations: ['control-correction-demo-fixture-projection'],
    },
  ];
}

function normalizeOfficialArenaCoverage(coverage?: {
  highWaterMark: string | null;
  staleCount: number;
  failureCount: number;
  limitations: string[];
}) {
  if (!coverage) return coverage;
  return {
    ...coverage,
    failureCount: 0,
    limitations: coverage.limitations.filter((limitation) => limitation !== 'source-rows-unsupported'),
  };
}

function source(
  family: SarRefreshSourceFamily,
  generatedAt: string,
  coverage?: {
    highWaterMark: string | null;
    staleCount: number;
    failureCount: number;
    limitations: string[];
  },
): SarRefreshSourceInput {
  return {
    family,
    sourceVersion: 'control-correction-sar-refresh.v1',
    highWaterMark: coverage?.highWaterMark ?? undefined,
    staleCount: coverage?.staleCount,
    failureCount: coverage?.failureCount,
    limitations: coverage?.limitations,
    result: family === 'path-summary'
      ? undefined
      : buildSourceFamilySarResult(family, generatedAt, coverage),
  };
}

function buildSourceFamilySarResult(
  family: Exclude<SarRefreshSourceFamily, 'path-summary'>,
  generatedAt: string,
  coverage?: {
    highWaterMark: string | null;
    staleCount: number;
    failureCount: number;
    limitations: string[];
  },
): SarRetrievalResult {
  const titles: Record<Exclude<SarRefreshSourceFamily, 'path-summary'>, string> = {
    'kaq-graph': 'K/A/Q graph projection health',
    'learning-goal': 'Learning goal projection health',
    'resource-node': 'Resource node projection health',
    'learning-evidence': 'Learning evidence projection health',
    'learning-fact-summary': 'Learning fact projection health',
    'simulation-summary': 'Simulation summary projection health',
    'arena-official': 'Arena official projection health',
  };
  const eventTypes: Record<Exclude<SarRefreshSourceFamily, 'path-summary'>, Parameters<typeof projectGovernedSummaryToSar>[0]['eventType']> = {
    'kaq-graph': 'graph-node',
    'learning-goal': 'path-summary',
    'resource-node': 'resource-node',
    'learning-evidence': 'corpus-chunk-summary',
    'learning-fact-summary': 'learning-fact-summary',
    'simulation-summary': 'simulation-summary',
    'arena-official': 'arena-summary',
  };
  const entityTypes: Record<Exclude<SarRefreshSourceFamily, 'path-summary'>, Parameters<typeof projectGovernedSummaryToSar>[0]['entityRefs'] extends readonly (infer T)[] ? T extends { entityType: infer E } ? E : never : never> = {
    'kaq-graph': 'graph-node',
    'learning-goal': 'learning-goal',
    'resource-node': 'resource-node',
    'learning-evidence': 'learning-fact',
    'learning-fact-summary': 'learning-fact',
    'simulation-summary': 'path-node',
    'arena-official': 'path-node',
  };
  const highWaterMark = coverage?.highWaterMark ?? generatedAt;
  const staleCount = coverage?.staleCount ?? 0;
  const failureCount = coverage?.failureCount ?? 0;
  return projectGovernedSummaryToSar({
    id: `sar-refresh:${family}`,
    title: titles[family],
    summary: `${titles[family]} at ${highWaterMark}: stale=${staleCount}, failures=${failureCount}.`,
    sourceOwner: family,
    sourceRefId: `sar-refresh:${family}`,
    eventType: eventTypes[family],
    privacyScope: 'admin-scoped',
    authorityLevel: 'metadata-projected',
    freshness: highWaterMark,
    entityRefs: [{
      entityType: entityTypes[family],
      canonicalRef: `sar-refresh:${family}`,
      label: titles[family],
      privacyScope: 'admin-scoped',
    }],
    limitations: coverage?.limitations,
    versionRefs: ['control-correction-sar-refresh.v1'],
  });
}

function persistedSourceLastSuccessfulAt(
  snapshot: ReturnType<SarPersistenceRepository['getSnapshot']> | null,
  source: SarRefreshSourceInput,
  result: SarRetrievalResult | null,
): string | null {
  if (!snapshot || !result) return null;
  const owners = new Set([
    source.family,
    ...result.events.map((event) => event.sourceRef.owner),
  ]);
  const hasPersistedSource = Object.values(snapshot.events)
    .some((event) => owners.has(event.sourceRef.owner));
  return hasPersistedSource ? snapshot.generatedAt : null;
}

function summarizeCoverageByFamily(sources: readonly {
  sourceId: string;
  totalRows: number;
  eligibleRows: number;
  excludedRows: number;
  unsupportedRows: number;
  lastObservedAt: string | null;
  materializationReadiness: string;
  readinessGapCounts?: Record<string, number>;
}[]): Map<SarRefreshSourceFamily, {
  highWaterMark: string | null;
  staleCount: number;
  failureCount: number;
  limitations: string[];
}> {
  const buckets = new Map<SarRefreshSourceFamily, {
    timestamps: string[];
    staleCount: number;
    failureCount: number;
    limitations: string[];
  }>();
  for (const sourceItem of sources) {
    const family = familyForEvidenceSource(sourceItem.sourceId);
    if (!family) continue;
    const bucket = buckets.get(family) ?? {
      timestamps: [],
      staleCount: 0,
      failureCount: 0,
      limitations: [],
    };
    if (sourceItem.lastObservedAt) bucket.timestamps.push(sourceItem.lastObservedAt);
    if (sourceItem.totalRows === 0) bucket.staleCount += 1;
    bucket.failureCount += sourceItem.unsupportedRows;
    if (sourceItem.excludedRows > 0) bucket.limitations.push('source-rows-excluded');
    if (sourceItem.unsupportedRows > 0) bucket.limitations.push('source-rows-unsupported');
    for (const gap of Object.keys(sourceItem.readinessGapCounts ?? {})) {
      bucket.limitations.push(`readiness-gap:${gap}`);
    }
    if (sourceItem.materializationReadiness === 'future') {
      bucket.limitations.push('source-materialization-future');
    }
    buckets.set(family, bucket);
  }
  return new Map([...buckets.entries()].map(([family, bucket]) => [
    family,
    {
      highWaterMark: bucket.timestamps.sort().at(-1) ?? null,
      staleCount: bucket.staleCount,
      failureCount: bucket.failureCount,
      limitations: uniqueSorted(bucket.limitations),
    },
  ]));
}

function familyForEvidenceSource(sourceId: string): SarRefreshSourceFamily | null {
  if (
    sourceId === 'InteractionLog' ||
    sourceId === 'StudentStepResponse' ||
    sourceId === 'UserAnswer' ||
    sourceId === 'AbilityAssessment' ||
    sourceId === 'PromptAssessment' ||
    sourceId === 'DesignSession'
  ) {
    return 'learning-evidence';
  }
  if (sourceId === 'LearningFact') return 'learning-fact-summary';
  if (sourceId === 'SimulationSession' || sourceId === 'SimulationLog') return 'simulation-summary';
  if (sourceId === 'ArenaSubmission' || sourceId === 'ArenaEvaluationRun') return 'arena-official';
  if (sourceId === 'ArenaBlackBoxExperiment' || sourceId === 'ArenaVirtualSimulationRun') return 'path-summary';
  return null;
}

function persistenceSafeSarResult(result: SarRetrievalResult): SarRetrievalResult {
  const allowedRefs = new Set([
    ...result.events.map((event) => event.id),
    ...result.entities.map((entity) => entity.id),
    ...result.citationTargetRefs,
    ...result.retrievalChunkRefs,
  ]);
  return {
    ...result,
    events: result.events.map((event) => ({
      ...event,
      metadata: sanitizeMetadata(event.metadata),
    })),
    trace: {
      ...result.trace,
      selectedRefs: result.trace.selectedRefs.filter((ref) => allowedRefs.has(ref)),
      versionRefs: sanitizeLimitations(result.trace.versionRefs),
      limitations: sanitizeLimitations(result.trace.limitations),
    },
    limitations: sanitizeLimitations(result.limitations),
  };
}

function sanitizeMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (isRestrictedHealthText(key)) continue;
    if (typeof item === 'string') {
      next[key] = isRestrictedHealthText(item) ? '[redacted]' : item;
      continue;
    }
    if (Array.isArray(item)) {
      next[key] = item.map((entry) => (
        typeof entry === 'string' && isRestrictedHealthText(entry) ? '[redacted]' : entry
      ));
      continue;
    }
    if (item && typeof item === 'object') {
      next[key] = sanitizeMetadata(item as Record<string, unknown>);
      continue;
    }
    next[key] = item;
  }
  return next;
}

function evaluateArenaAuthority(input?: SarArenaAuthorityInput | null): {
  valid: boolean;
  limitations: string[];
  summary: SarRefreshSourceHealthRecord['arenaAuthority'];
} {
  if (!input) {
    return {
      valid: false,
      limitations: ['arena-official-source-authority-missing'],
      summary: { officialSources: [], auxiliarySources: [] },
    };
  }
  const officialCandidates = [
    input.scoreSource,
    input.validitySource,
    input.rankingSource,
    input.attemptPolicySource,
    input.evaluationMetricsSource,
  ];
  const invalidOfficialSources = officialCandidates.filter((candidate) => (
    !OFFICIAL_ARENA_SOURCES.has(candidate as SarArenaOfficialSource)
  ));
  const officialSources = officialCandidates.filter((candidate): candidate is SarArenaOfficialSource => (
    OFFICIAL_ARENA_SOURCES.has(candidate as SarArenaOfficialSource)
  ));
  const records = input.officialRecords;
  const missingOfficialRecords = !records
    || records.submissionCount === 0
    || records.evaluationRunCount === 0
    || records.scoreRefs.length === 0
    || records.validityRefs.length === 0
    || records.rankingRefs.length === 0
    || records.attemptPolicyRefs.length === 0
    || records.evaluationMetricRefs.length === 0;
  const auxiliarySources = uniqueSorted([
    ...(input.auxiliarySources ?? []),
    ...(invalidOfficialSources as SarArenaAuxiliarySource[]),
  ]) as SarArenaAuxiliarySource[];
  return {
    valid: invalidOfficialSources.length === 0 && !missingOfficialRecords,
    limitations: uniqueSorted([
      ...(invalidOfficialSources.length > 0 ? ['arena-official-source-authority-invalid'] : []),
      ...(missingOfficialRecords ? ['arena-official-records-missing'] : []),
      ...(input.auxiliarySources?.length || invalidOfficialSources.length > 0 ? ['arena-auxiliary-evidence-context-only'] : []),
    ]),
    summary: {
      officialSources: uniqueSorted(officialSources) as SarArenaOfficialSource[],
      auxiliarySources,
      officialRecordSummary: {
        submissionCount: records?.submissionCount ?? 0,
        evaluationRunCount: records?.evaluationRunCount ?? 0,
        latestSubmissionAt: records?.latestSubmissionAt ?? null,
        latestEvaluationCompletedAt: records?.latestEvaluationCompletedAt ?? null,
      },
    },
  };
}

function sourceStatus(input: {
  staleCount: number;
  failureCount: number;
  limitations: readonly string[];
}): SarRefreshHealthStatus {
  if (input.failureCount > 0) return 'failed';
  if (input.staleCount > 0) return 'stale';
  if (input.limitations.length > 0) return 'degraded';
  return 'fresh';
}

function aggregateStatus(records: readonly SarRefreshSourceHealthRecord[]): SarRefreshHealthStatus {
  if (records.some((record) => record.status === 'failed')) return 'failed';
  if (records.some((record) => record.status === 'degraded')) return 'degraded';
  if (records.some((record) => record.status === 'stale')) return 'stale';
  return 'fresh';
}

function latestSuccessfulAt(records: readonly SarRefreshSourceHealthRecord[]): string | null {
  return records
    .map((record) => record.lastSuccessfulAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function sanitizeLimitations(values: readonly string[]): string[] {
  return uniqueSorted(values.map((value) => (
    isRestrictedHealthText(value) ? 'restricted-health-detail-redacted' : value
  )));
}

function isRestrictedHealthText(value: string): boolean {
  return FORBIDDEN_HEALTH_TEXT.some((pattern) => pattern.test(value));
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
