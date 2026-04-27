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
}

export interface HttpTelemetryInput extends Omit<FetchTelemetryInput, 'error'> {
  response: Response;
}

export type FetchFailureTelemetry = Record<string, string | number | boolean | null>;

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
  };
}

export function buildFetchFailureTelemetry(input: FetchTelemetryInput): FetchFailureTelemetry {
  const error = input.error instanceof Error ? input.error : null;
  return {
    ...baseTelemetry(input),
    errorName: error?.name ?? typeof input.error,
    errorMessage: error?.message ?? 'Unknown fetch failure',
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
