import {
  buildSyncIncidentKey,
  buildSyncIncidentTelemetry,
  SYNC_INCIDENT_BURST_WINDOW_MS,
  SYNC_INCIDENT_MINIMUM_CONSECUTIVE_FAILURES,
  SYNC_RECOVERY_EVENT_NAME,
  type SyncIncidentSeverity,
} from '@/lib/classroom-analytics/sync-incident-model';

export type FetchTelemetrySource =
  | 'session_progress_get'
  | 'session_progress_patch'
  | 'session_state_self_get'
  | 'student_state_get'
  | 'teacher_state_get'
  | 'session_state_post';

export interface FetchTelemetryInput {
  source: FetchTelemetrySource;
  url: string;
  method: string;
  startedAt: number;
  error: unknown;
  retryCount?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface HttpTelemetryInput extends Omit<FetchTelemetryInput, 'error'> {
  response: Response;
}

export type FetchFailureTelemetry = Record<string, unknown>;

export const DEFAULT_SYNC_FETCH_TIMEOUT_MS = 20_000;
export {
  buildSyncIncidentKey,
  buildSyncIncidentTelemetry,
  SYNC_INCIDENT_BURST_WINDOW_MS,
  SYNC_INCIDENT_MINIMUM_CONSECUTIVE_FAILURES,
  SYNC_RECOVERY_EVENT_NAME,
  type SyncIncidentSeverity,
};

export class FetchTelemetryError extends Error {
  telemetry: FetchFailureTelemetry;

  constructor(message: string, telemetry: FetchFailureTelemetry) {
    super(message);
    this.name = 'FetchTelemetryError';
    this.telemetry = telemetry;
  }
}

function getConnection() {
  const connection = (globalThis.navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      rtt?: number;
      downlink?: number;
    };
  } | undefined)?.connection;
  return connection ?? {};
}

function baseTelemetry(input: Omit<FetchTelemetryInput, 'error'>): FetchFailureTelemetry {
  const connection = getConnection();
  return {
    source: input.source,
    url: input.url,
    method: input.method,
    elapsedMs: Math.max(0, Date.now() - input.startedAt),
    navigatorOnLine: typeof navigator !== 'undefined' ? navigator.onLine : null,
    documentVisibilityState: typeof document !== 'undefined' ? document.visibilityState : null,
    connectionEffectiveType: connection.effectiveType ?? null,
    connectionRtt: connection.rtt ?? null,
    connectionDownlink: connection.downlink ?? null,
    retryCount: input.retryCount ?? null,
    pollIntervalMs: input.pollIntervalMs ?? null,
    timeoutMs: input.timeoutMs ?? null,
  };
}

export function resolveFetchFailureKind({
  errorName,
  elapsedMs,
  timeoutMs,
}: {
  errorName: string | null;
  elapsedMs: number;
  timeoutMs?: number | null;
}) {
  if (errorName === 'TimeoutError') {
    return 'timeout';
  }
  if (errorName === 'AbortError') {
    return timeoutMs && elapsedMs >= timeoutMs - 100 ? 'timeout' : 'aborted';
  }
  if (errorName === 'TypeError') {
    return 'network';
  }
  return 'unknown';
}

export function buildFetchFailureTelemetry(input: FetchTelemetryInput): FetchFailureTelemetry {
  const error = input.error instanceof Error ? input.error : null;
  const telemetry = baseTelemetry(input);
  const elapsedMs = typeof telemetry.elapsedMs === 'number' ? telemetry.elapsedMs : 0;
  const failureKind = resolveFetchFailureKind({
    errorName: error?.name ?? null,
    elapsedMs,
    timeoutMs: input.timeoutMs ?? null,
  });
  return {
    ...telemetry,
    errorName: error?.name ?? typeof input.error,
    errorMessage: error?.message ?? 'Unknown fetch failure',
    failureKind,
    timedOut: failureKind === 'timeout',
  };
}

export function buildHttpFailureTelemetry(input: HttpTelemetryInput): FetchFailureTelemetry {
  return {
    ...baseTelemetry(input),
    errorName: 'HttpError',
    errorMessage: `HTTP ${input.response.status}`,
    failureKind: 'http',
    timedOut: false,
    status: input.response.status,
    statusText: input.response.statusText,
    responseContentType: input.response.headers.get('content-type') ?? null,
  };
}

export function getFetchFailureTelemetry(error: unknown): FetchFailureTelemetry | null {
  return error instanceof FetchTelemetryError ? error.telemetry : null;
}

export function toFetchTelemetryError(message: string, telemetry: FetchFailureTelemetry) {
  return new FetchTelemetryError(message, telemetry);
}

export function shouldSurfaceSyncFailure({
  telemetry,
  consecutiveFailures,
  minimumConsecutiveFailures = SYNC_INCIDENT_MINIMUM_CONSECUTIVE_FAILURES,
}: {
  telemetry: FetchFailureTelemetry | null | undefined;
  consecutiveFailures: number;
  minimumConsecutiveFailures?: number;
}) {
  if (!telemetry) {
    return true;
  }

  if (telemetry.errorName === 'HttpError') {
    return true;
  }

  if (telemetry.failureKind === 'aborted' && telemetry.timedOut !== true) {
    return false;
  }

  return consecutiveFailures >= minimumConsecutiveFailures;
}

interface SyncIncidentTrackerRecord {
  key: string;
  stepId: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  occurrenceCount: number;
  emitted: boolean;
  latestTelemetry: FetchFailureTelemetry;
}

export interface SyncIncidentFailureInput {
  telemetry: FetchFailureTelemetry;
  stepId?: string | null;
  scope?: string | null;
  userId?: string | null;
  consecutiveFailures: number;
  now?: number;
}

export interface SyncIncidentRecoveryInput {
  sessionId?: string | null;
  stepId?: string | null;
  source?: string | null;
  url?: string | null;
  method?: string | null;
  now?: number;
}

export function createSyncIncidentTracker({
  burstWindowMs = SYNC_INCIDENT_BURST_WINDOW_MS,
  minimumConsecutiveFailures = SYNC_INCIDENT_MINIMUM_CONSECUTIVE_FAILURES,
}: {
  burstWindowMs?: number;
  minimumConsecutiveFailures?: number;
} = {}) {
  const records = new Map<string, SyncIncidentTrackerRecord>();

  return {
    recordFailure({
      telemetry,
      stepId = null,
      scope = null,
      userId = null,
      consecutiveFailures,
      now = Date.now(),
    }: SyncIncidentFailureInput) {
      const key = buildSyncIncidentKey({ payload: telemetry, userId, stepId, scope });
      const previous = records.get(key);
      const isSameBurst = previous ? now - previous.lastSeenAt <= burstWindowMs : false;
      const record: SyncIncidentTrackerRecord = isSameBurst && previous
        ? {
          ...previous,
          lastSeenAt: now,
          occurrenceCount: previous.occurrenceCount + 1,
          latestTelemetry: telemetry,
          stepId: stepId ?? previous.stepId,
        }
        : {
          key,
          stepId,
          firstSeenAt: now,
          lastSeenAt: now,
          occurrenceCount: 1,
          emitted: false,
          latestTelemetry: telemetry,
        };

      const shouldSurface = shouldSurfaceSyncFailure({
        telemetry,
        consecutiveFailures,
        minimumConsecutiveFailures,
      });
      const shouldEmit = shouldSurface && !record.emitted;
      const incidentTelemetry = buildSyncIncidentTelemetry({
        payload: telemetry,
        userId,
        stepId: record.stepId,
        scope,
        consecutiveFailures,
        occurrenceCount: record.occurrenceCount,
        firstSeenAt: record.firstSeenAt,
        lastSeenAt: record.lastSeenAt,
        suppressed: !shouldEmit,
        burstWindowMs,
      });

      record.emitted = record.emitted || shouldEmit;
      records.set(key, record);

      return {
        key,
        shouldSurface,
        shouldEmit,
        telemetry: incidentTelemetry,
      };
    },
    recordRecovery({
      sessionId = null,
      stepId = null,
      source = null,
      url = null,
      method = null,
      now = Date.now(),
    }: SyncIncidentRecoveryInput = {}) {
      const matchesRecoveryScope = (record: SyncIncidentTrackerRecord) => (
        (source === null || record.latestTelemetry.source === source)
        && (url === null || record.latestTelemetry.url === url)
        && (method === null || record.latestTelemetry.method === method)
      );
      const recoveredRecords = Array.from(records.values()).filter(matchesRecoveryScope);
      const recoveryTelemetry = recoveredRecords.map((record) => {
        const recoveryStepId = record.stepId ?? stepId;
        return {
          eventType: 'sync_recovered',
          sessionId,
          stepId: recoveryStepId,
          incidentKey: record.key,
          incidentSeverity: buildSyncIncidentTelemetry({
            payload: record.latestTelemetry,
            stepId: recoveryStepId,
            occurrenceCount: record.occurrenceCount,
            firstSeenAt: record.firstSeenAt,
            lastSeenAt: record.lastSeenAt,
            recovered: true,
            burstWindowMs,
          }).incidentSeverity,
          source: record.latestTelemetry.source ?? null,
          url: record.latestTelemetry.url ?? null,
          method: record.latestTelemetry.method ?? null,
          failureKind: record.latestTelemetry.failureKind ?? null,
          incidentFirstSeenAt: record.firstSeenAt,
          incidentLastSeenAt: record.lastSeenAt,
          recoveredAt: now,
          recoveredIncidentCount: 1,
          recoveredFailureCount: record.occurrenceCount,
          recoveryState: 'recovered',
          rawDiagnostics: { ...record.latestTelemetry },
        };
      });
      for (const record of recoveredRecords) {
        records.delete(record.key);
      }
      return recoveryTelemetry;
    },
    clear() {
      records.clear();
    },
  };
}

export function dispatchSyncRecoveryTelemetry(telemetry: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(SYNC_RECOVERY_EVENT_NAME, { detail: telemetry }));
}

export function createFetchTimeout(timeoutMs = DEFAULT_SYNC_FETCH_TIMEOUT_MS) {
  if (typeof AbortController === 'undefined') {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}
