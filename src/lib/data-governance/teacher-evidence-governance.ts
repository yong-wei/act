import type {
  StudentEvidenceCoverageState,
  StudentEvidenceStatusMarker,
  StudentEvidenceWindow,
} from './student-evidence-feature-cache';

export type TeacherEvidenceState = 'ready' | 'stale' | 'missing';
export type TeacherSessionQualityStatus = 'green' | 'yellow' | 'red' | 'unknown';

export interface TeacherStudentEvidenceStatus {
  state: TeacherEvidenceState;
  refreshedAt: string | null;
  lastEvidenceAt: string | null;
  evidenceWindow: StudentEvidenceWindow;
  sourceCounts: {
    LearningFact: number;
    StudentCompetencySnapshot: number;
    StudentProfileSummary: number;
    byFactType: Record<string, number>;
  };
  sourceCoverage: Record<'LearningFact' | 'StudentCompetencySnapshot' | 'StudentProfileSummary', StudentEvidenceCoverageState>;
  confidence: {
    level: 'none' | 'low' | 'medium' | 'high';
    score: number;
    evidenceCount: number;
    sourceCompleteness: number;
  };
  statusMarkers: StudentEvidenceStatusMarker[];
}

export interface TeacherEvidenceCoverageSummary {
  totalStudents: number;
  readyStudents: number;
  staleStudents: number;
  missingStudents: number;
  lowConfidenceStudents: number;
  cacheCoverageRatio: number;
  sourceCoverage: Record<'LearningFact' | 'StudentCompetencySnapshot' | 'StudentProfileSummary', {
    available: number;
    partial: number;
    missing: number;
  }>;
}

export interface TeacherSessionQualityReportSummary {
  sessionId: string;
  lessonKey: string | null;
  title: string;
  qualityStatus: TeacherSessionQualityStatus;
  qualityReasons: string[];
  updatedAt: string | null;
  startTime: string | null;
  endTime: string | null;
  summary: string | null;
}

export interface TeacherRecentSessionQualitySummary {
  totalReports: number;
  green: number;
  yellow: number;
  red: number;
  unknown: number;
  latestReports: TeacherSessionQualityReportSummary[];
}

export interface TeacherClassScopedEvidenceFactGroup {
  userId: string;
  factType: string;
  _count?: { _all?: number };
  _min?: { startedAt?: Date | string | null };
  _max?: { startedAt?: Date | string | null };
}

export interface TeacherClassScopedEvidenceCacheHealth {
  userId: string;
  refreshedAt?: Date | string | null;
  statusMarkers?: unknown;
}

const DEFAULT_STALE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function buildTeacherStudentEvidenceStatus(
  _userId: string,
  cache: Record<string, unknown> | null,
  options: {
    now?: Date;
    staleAfterDays?: number;
    readState?: TeacherEvidenceState;
  } = {},
): TeacherStudentEvidenceStatus {
  if (!cache) {
    return createMissingStudentEvidenceStatus();
  }

  const sourceCounts = normalizeSourceCounts(cache.sourceCounts);
  const statusMarkers = normalizeStatusMarkers(cache.statusMarkers);
  const confidence = normalizeConfidence(cache.confidenceMarkers);
  const evidenceWindow = normalizeEvidenceWindow(cache.evidenceWindow);
  const state = options.readState ?? resolveEvidenceState(cache, statusMarkers, options);
  const lastEvidenceAt =
    dateToIso(cache.lastSourceFactAt) ??
    evidenceWindow.lastStartedAt ??
    null;

  return {
    state,
    refreshedAt: dateToIso(cache.refreshedAt),
    lastEvidenceAt,
    evidenceWindow,
    sourceCounts: {
      ...sourceCounts,
      LearningFact: Math.max(sourceCounts.LearningFact, numberValue(cache.sourceFactCount)),
    },
    sourceCoverage: normalizeSourceCoverage(cache.sourceCoverage),
    confidence,
    statusMarkers: state === 'stale' && !statusMarkers.includes('stale')
      ? [...statusMarkers, 'stale']
      : statusMarkers,
  };
}

export function buildTeacherStudentEvidenceStatusMap(
  userIds: string[],
  caches: Array<Record<string, unknown>>,
  options: { now?: Date; staleAfterDays?: number } = {},
): Map<string, TeacherStudentEvidenceStatus> {
  const cacheMap = new Map(
    caches
      .map((cache) => [typeof cache.userId === 'string' ? cache.userId : '', cache] as const)
      .filter(([userId]) => userId.length > 0),
  );

  return new Map(
    userIds.map((userId) => [
      userId,
      buildTeacherStudentEvidenceStatus(userId, cacheMap.get(userId) ?? null, options),
    ]),
  );
}

export function buildTeacherClassScopedEvidenceStatusMap(
  userIds: string[],
  factGroups: TeacherClassScopedEvidenceFactGroup[],
  options: {
    now?: Date;
    staleAfterDays?: number;
    cacheHealthByUserId?: Map<string, TeacherClassScopedEvidenceCacheHealth>;
  } = {},
): Map<string, TeacherStudentEvidenceStatus> {
  const aggregates = new Map<string, {
    count: number;
    byFactType: Record<string, number>;
    firstStartedAt: Date | string | null;
    lastStartedAt: Date | string | null;
  }>();

  for (const group of factGroups) {
    const count = numberValue(group._count?._all);
    if (!group.userId || count <= 0) continue;

    const aggregate = aggregates.get(group.userId) ?? {
      count: 0,
      byFactType: {},
      firstStartedAt: null,
      lastStartedAt: null,
    };
    aggregate.count += count;
    aggregate.byFactType[group.factType] = (aggregate.byFactType[group.factType] ?? 0) + count;
    aggregate.firstStartedAt = minDateValue(aggregate.firstStartedAt, group._min?.startedAt);
    aggregate.lastStartedAt = maxDateValue(aggregate.lastStartedAt, group._max?.startedAt);
    aggregates.set(group.userId, aggregate);
  }

  return new Map(
    userIds.map((userId) => {
      const classScopedStatus = buildClassScopedEvidenceStatus(aggregates.get(userId), options);
      return [
        userId,
        applyClassScopedCacheHealth(
          classScopedStatus,
          options.cacheHealthByUserId?.get(userId) ?? null,
          options,
        ),
      ];
    }),
  );
}

export function summarizeTeacherEvidenceCoverage(
  statuses: Iterable<TeacherStudentEvidenceStatus>,
): TeacherEvidenceCoverageSummary {
  const items = Array.from(statuses);
  const totalStudents = items.length;
  const sourceCoverage = {
    LearningFact: createSourceCoverageCounts(),
    StudentCompetencySnapshot: createSourceCoverageCounts(),
    StudentProfileSummary: createSourceCoverageCounts(),
  };

  let readyStudents = 0;
  let staleStudents = 0;
  let missingStudents = 0;
  let lowConfidenceStudents = 0;

  for (const status of items) {
    if (status.state === 'ready') readyStudents += 1;
    if (status.state === 'stale') staleStudents += 1;
    if (status.state === 'missing') missingStudents += 1;
    if (isLowConfidenceEvidence(status)) lowConfidenceStudents += 1;

    sourceCoverage.LearningFact[status.sourceCoverage.LearningFact] += 1;
    sourceCoverage.StudentCompetencySnapshot[status.sourceCoverage.StudentCompetencySnapshot] += 1;
    sourceCoverage.StudentProfileSummary[status.sourceCoverage.StudentProfileSummary] += 1;
  }

  return {
    totalStudents,
    readyStudents,
    staleStudents,
    missingStudents,
    lowConfidenceStudents,
    cacheCoverageRatio: totalStudents > 0
      ? roundTo((readyStudents + staleStudents) / totalStudents, 2)
      : 0,
    sourceCoverage,
  };
}

export function summarizeTeacherSessionQualityReports(
  reports: Array<Record<string, unknown>>,
): TeacherRecentSessionQualitySummary {
  const latestReports = reports.map((report) => {
    const reportData = readObject(report.reportData);
    const qualityStatus = readObject(reportData.qualityStatus);
    const session = readObject(report.session);
    const plan = readObject(session.plan);
    const status = normalizeSessionQualityStatus(qualityStatus.status);

    return {
      sessionId: stringValue(report.sessionId) ?? stringValue(session.id) ?? '',
      lessonKey: stringValue(report.lessonKey),
      title: stringValue(plan.title) ?? '未命名课堂',
      qualityStatus: status,
      qualityReasons: stringArray(qualityStatus.reasons),
      updatedAt: dateToIso(report.updatedAt),
      startTime: dateToIso(session.startTime),
      endTime: dateToIso(session.endTime),
      summary: stringValue(report.summary),
    };
  });

  return {
    totalReports: latestReports.length,
    green: latestReports.filter((item) => item.qualityStatus === 'green').length,
    yellow: latestReports.filter((item) => item.qualityStatus === 'yellow').length,
    red: latestReports.filter((item) => item.qualityStatus === 'red').length,
    unknown: latestReports.filter((item) => item.qualityStatus === 'unknown').length,
    latestReports,
  };
}

function buildClassScopedEvidenceStatus(
  aggregate: {
    count: number;
    byFactType: Record<string, number>;
    firstStartedAt: Date | string | null;
    lastStartedAt: Date | string | null;
  } | undefined,
  options: { now?: Date; staleAfterDays?: number },
): TeacherStudentEvidenceStatus {
  if (!aggregate || aggregate.count <= 0) {
    return createMissingStudentEvidenceStatus();
  }

  const firstStartedAt = dateToIso(aggregate.firstStartedAt);
  const lastStartedAt = dateToIso(aggregate.lastStartedAt);
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const stale = isOlderThanDays(aggregate.lastStartedAt, options.now ?? new Date(), staleAfterDays);
  const lowConfidence = aggregate.count < 3;
  const statusMarkers: StudentEvidenceStatusMarker[] = [
    ...(stale ? ['stale' as const] : []),
    ...(lowConfidence ? ['low-confidence' as const] : []),
  ];

  return {
    state: stale ? 'stale' : 'ready',
    refreshedAt: lastStartedAt,
    lastEvidenceAt: lastStartedAt,
    evidenceWindow: {
      firstStartedAt,
      lastStartedAt,
      daysCovered: calculateDaysCovered(aggregate.firstStartedAt, aggregate.lastStartedAt),
    },
    sourceCounts: {
      LearningFact: aggregate.count,
      StudentCompetencySnapshot: 0,
      StudentProfileSummary: 0,
      byFactType: aggregate.byFactType,
    },
    sourceCoverage: {
      LearningFact: 'available',
      StudentCompetencySnapshot: 'missing',
      StudentProfileSummary: 'missing',
    },
    confidence: {
      level: aggregate.count >= 8 ? 'high' : aggregate.count >= 3 ? 'medium' : 'low',
      score: aggregate.count >= 8 ? 0.91 : aggregate.count >= 3 ? 0.64 : 0.31,
      evidenceCount: aggregate.count,
      sourceCompleteness: 1,
    },
    statusMarkers,
  };
}

function applyClassScopedCacheHealth(
  status: TeacherStudentEvidenceStatus,
  cacheHealth: TeacherClassScopedEvidenceCacheHealth | null,
  options: { now?: Date; staleAfterDays?: number },
): TeacherStudentEvidenceStatus {
  if (!cacheHealth) {
    if (status.state === 'missing') {
      return status;
    }
    return {
      ...status,
      state: 'stale',
      refreshedAt: null,
      statusMarkers: mergeStatusMarkers(status.statusMarkers, ['missing-source', 'stale']),
    };
  }

  const cacheMarkers = normalizeStatusMarkers(cacheHealth.statusMarkers);
  const cacheState = resolveEvidenceState(
    { refreshedAt: cacheHealth.refreshedAt },
    cacheMarkers,
    options,
  );
  const refreshedAt = dateToIso(cacheHealth.refreshedAt);
  const statusMarkers = mergeStatusMarkers(
    status.statusMarkers,
    cacheMarkers,
    cacheState === 'stale' ? ['stale'] : [],
  );

  if (status.state === 'missing') {
    return {
      ...status,
      refreshedAt,
      statusMarkers,
    };
  }

  return {
    ...status,
    state: cacheState === 'stale' ? 'stale' : status.state,
    refreshedAt: refreshedAt ?? status.refreshedAt,
    statusMarkers,
  };
}

function createMissingStudentEvidenceStatus(): TeacherStudentEvidenceStatus {
  return {
    state: 'missing',
    refreshedAt: null,
    lastEvidenceAt: null,
    evidenceWindow: {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    },
    sourceCounts: {
      LearningFact: 0,
      StudentCompetencySnapshot: 0,
      StudentProfileSummary: 0,
      byFactType: {},
    },
    sourceCoverage: {
      LearningFact: 'missing',
      StudentCompetencySnapshot: 'missing',
      StudentProfileSummary: 'missing',
    },
    confidence: {
      level: 'none',
      score: 0,
      evidenceCount: 0,
      sourceCompleteness: 0,
    },
    statusMarkers: ['missing-source'],
  };
}

function mergeStatusMarkers(
  ...groups: Array<readonly StudentEvidenceStatusMarker[]>
): StudentEvidenceStatusMarker[] {
  return Array.from(new Set(groups.flat()));
}

function resolveEvidenceState(
  cache: Record<string, unknown>,
  markers: StudentEvidenceStatusMarker[],
  options: { now?: Date; staleAfterDays?: number },
): TeacherEvidenceState {
  const refreshedAt = cache.refreshedAt instanceof Date ? cache.refreshedAt : null;
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const staleByAge = refreshedAt
    ? (options.now ?? new Date()).getTime() - refreshedAt.getTime() > staleAfterDays * DAY_MS
    : true;

  return staleByAge || markers.includes('stale') ? 'stale' : 'ready';
}

function isLowConfidenceEvidence(status: TeacherStudentEvidenceStatus) {
  if (status.state === 'missing') return false;
  return status.confidence.level === 'none' ||
    status.confidence.level === 'low' ||
    status.statusMarkers.includes('low-confidence');
}

function createSourceCoverageCounts() {
  return {
    available: 0,
    partial: 0,
    missing: 0,
  };
}

function normalizeEvidenceWindow(value: unknown): StudentEvidenceWindow {
  const window = readObject(value);
  return {
    firstStartedAt: stringValue(window.firstStartedAt),
    lastStartedAt: stringValue(window.lastStartedAt),
    daysCovered: numberValue(window.daysCovered),
  };
}

function normalizeSourceCounts(value: unknown): TeacherStudentEvidenceStatus['sourceCounts'] {
  const counts = readObject(value);
  return {
    LearningFact: numberValue(counts.LearningFact),
    StudentCompetencySnapshot: numberValue(counts.StudentCompetencySnapshot),
    StudentProfileSummary: numberValue(counts.StudentProfileSummary),
    byFactType: normalizeFactTypeCounts(counts.byFactType),
  };
}

function normalizeFactTypeCounts(value: unknown): Record<string, number> {
  const counts = readObject(value);
  return Object.fromEntries(
    Object.entries(counts).filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  );
}

function normalizeSourceCoverage(
  value: unknown,
): TeacherStudentEvidenceStatus['sourceCoverage'] {
  const coverage = readObject(value);
  return {
    LearningFact: normalizeCoverageState(coverage.LearningFact),
    StudentCompetencySnapshot: normalizeCoverageState(coverage.StudentCompetencySnapshot),
    StudentProfileSummary: normalizeCoverageState(coverage.StudentProfileSummary),
  };
}

function normalizeCoverageState(value: unknown): StudentEvidenceCoverageState {
  return value === 'available' || value === 'partial' || value === 'missing'
    ? value
    : 'missing';
}

function normalizeConfidence(value: unknown): TeacherStudentEvidenceStatus['confidence'] {
  const confidence = readObject(value);
  const level = confidence.level;
  return {
    level: level === 'none' || level === 'low' || level === 'medium' || level === 'high'
      ? level
      : 'none',
    score: numberValue(confidence.score),
    evidenceCount: numberValue(confidence.evidenceCount),
    sourceCompleteness: numberValue(confidence.sourceCompleteness),
  };
}

function normalizeStatusMarkers(value: unknown): StudentEvidenceStatusMarker[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StudentEvidenceStatusMarker =>
    item === 'stale' ||
    item === 'partial' ||
    item === 'low-confidence' ||
    item === 'missing-source'
  );
}

function normalizeSessionQualityStatus(value: unknown): TeacherSessionQualityStatus {
  return value === 'green' || value === 'yellow' || value === 'red' ? value : 'unknown';
}

function readObject(value: unknown): Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function dateToIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function isOlderThanDays(value: unknown, now: Date, days: number) {
  const timestamp = dateMillis(value);
  if (timestamp === null) return true;
  return now.getTime() - timestamp > days * DAY_MS;
}

function calculateDaysCovered(first: unknown, last: unknown) {
  const firstTimestamp = dateMillis(first);
  const lastTimestamp = dateMillis(last);
  if (firstTimestamp === null || lastTimestamp === null) return 0;
  return Math.max(1, Math.ceil((lastTimestamp - firstTimestamp) / DAY_MS));
}

function minDateValue(
  current: Date | string | null,
  candidate: Date | string | null | undefined,
) {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentMillis = dateMillis(current);
  const candidateMillis = dateMillis(candidate);
  if (currentMillis === null) return candidate;
  if (candidateMillis === null) return current;
  return candidateMillis < currentMillis ? candidate : current;
}

function maxDateValue(
  current: Date | string | null,
  candidate: Date | string | null | undefined,
) {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentMillis = dateMillis(current);
  const candidateMillis = dateMillis(candidate);
  if (currentMillis === null) return candidate;
  if (candidateMillis === null) return current;
  return candidateMillis > currentMillis ? candidate : current;
}

function dateMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== 'string' || value.length === 0) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
