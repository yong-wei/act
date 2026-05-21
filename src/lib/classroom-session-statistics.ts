export interface SessionGovernanceSummary {
  qualityStatus: {
    status: 'green' | 'yellow' | 'red';
    reasons: string[];
    metrics: Record<string, unknown>;
  } | null;
  sessionParticipants: number | null;
  loggedParticipants: number | null;
  factParticipants: number | null;
  submittedParticipants: number | null;
  snapshotUpdatedParticipants: number | null;
  syncErrorUsers: number | null;
}

export interface ClassroomSessionStatistics {
  studentCount: number;
  durationMinutes: number | null;
  governanceSummary: SessionGovernanceSummary | null;
  hasGovernanceSummary: boolean;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
  }
  return null;
}

function parseQualityStatus(value: unknown): SessionGovernanceSummary['qualityStatus'] {
  const qualityStatus = asObject(value);
  const status = qualityStatus.status;
  if (status !== 'green' && status !== 'yellow' && status !== 'red') {
    return null;
  }
  return {
    status,
    reasons: Array.isArray(qualityStatus.reasons)
      ? qualityStatus.reasons.filter((reason): reason is string => typeof reason === 'string')
      : [],
    metrics: asObject(qualityStatus.metrics),
  };
}

export function formatClassroomSessionDate(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(value);
}

export function parseSessionGovernanceSummary(reportData: unknown): SessionGovernanceSummary | null {
  const report = asObject(reportData);
  const summary = asObject(report.sessionGovernanceSummary);
  if (Object.keys(summary).length === 0) {
    return null;
  }

  const parsed: SessionGovernanceSummary = {
    qualityStatus: parseQualityStatus(summary.qualityStatus),
    sessionParticipants: toCount(summary.sessionParticipants),
    loggedParticipants: toCount(summary.loggedParticipants),
    factParticipants: toCount(summary.factParticipants),
    submittedParticipants: toCount(summary.submittedParticipants),
    snapshotUpdatedParticipants: toCount(summary.snapshotUpdatedParticipants),
    syncErrorUsers: toCount(summary.syncErrorUsers),
  };

  return Object.values(parsed).some((value) => value !== null) ? parsed : null;
}

export function buildClassroomSessionStatistics(input: {
  startTime: Date;
  endTime: Date | null;
  studentStateCount: number;
  reportData?: unknown;
}): ClassroomSessionStatistics {
  const governanceSummary = parseSessionGovernanceSummary(input.reportData);
  const studentCount = governanceSummary?.sessionParticipants ?? Math.max(0, input.studentStateCount);

  return {
    studentCount,
    durationMinutes: input.endTime
      ? Math.max(Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60000), 1)
      : null,
    governanceSummary,
    hasGovernanceSummary: Boolean(governanceSummary),
  };
}
