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

export type FetchFailureTelemetry = Record<string, string | number | boolean | null>;

export const DEFAULT_SYNC_FETCH_TIMEOUT_MS = 20_000;

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
