export type SyncIncidentSeverity = 'low' | 'medium' | 'high';
export type SyncIncidentRecoveryState = 'unresolved' | 'recovered';

export const SYNC_INCIDENT_BURST_WINDOW_MS = 30 * 1000;
export const SYNC_INCIDENT_MINIMUM_CONSECUTIVE_FAILURES = 3;
export const SYNC_RECOVERY_EVENT_NAME = 'interactive-sync-recovered';

export const SYNC_INCIDENT_KEY_FIELDS = [
  'userId',
  'scope',
  'stepId',
  'source',
  'url',
  'method',
  'failureKind',
  'status',
] as const;

export interface SyncIncidentKeyInput {
  payload: Record<string, unknown>;
  userId?: string | null;
  stepId?: string | null;
  scope?: string | null;
}

export interface SyncIncidentTelemetryInput extends Omit<SyncIncidentKeyInput, 'payload'> {
  payload?: Record<string, unknown>;
  telemetry?: Record<string, unknown>;
  consecutiveFailures?: number;
  occurrenceCount?: number;
  firstSeenAt?: number;
  lastSeenAt?: number;
  recovered?: boolean;
  suppressed?: boolean;
  burstWindowMs?: number;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readSeverity(value: unknown): SyncIncidentSeverity | null {
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

function keyPart(value: unknown, fallback = 'unknown') {
  const stringValue = readString(value);
  if (stringValue) return stringValue;
  const numberValue = readNumber(value);
  return numberValue === null ? fallback : String(numberValue);
}

export function resolveSyncIncidentSource(payload: Record<string, unknown>) {
  return readString(payload.source) ?? readString(payload.incidentSource) ?? 'unknown';
}

export function resolveSyncIncidentFailureKind(payload: Record<string, unknown>) {
  const failureKind = readString(payload.failureKind);
  if (failureKind) return failureKind;
  if (payload.errorName === 'HttpError' || readNumber(payload.status) !== null) return 'http';
  return readString(payload.incidentFailureKind) ?? 'unknown';
}

export function resolveSyncIncidentStatus(payload: Record<string, unknown>) {
  return readNumber(payload.status) ?? readNumber(payload.incidentStatus);
}

export function buildSyncIncidentKey({
  payload,
  userId,
  stepId,
  scope,
}: SyncIncidentKeyInput) {
  const status = resolveSyncIncidentStatus(payload);
  return [
    keyPart(userId ?? payload.userId),
    keyPart(scope ?? payload.scope),
    keyPart(stepId ?? payload.stepId, 'unknown_step'),
    keyPart(resolveSyncIncidentSource(payload)),
    keyPart(payload.url),
    keyPart(payload.method),
    keyPart(resolveSyncIncidentFailureKind(payload)),
    status === null ? 'none' : String(status),
  ].join('\u0000');
}

export function classifySyncIncidentSeverity({
  payload,
  consecutiveFailures = 1,
  occurrenceCount = 1,
  recovered = false,
}: {
  payload: Record<string, unknown>;
  consecutiveFailures?: number;
  occurrenceCount?: number;
  recovered?: boolean;
}): SyncIncidentSeverity {
  const explicitSeverity = readSeverity(payload.incidentSeverity);
  if (explicitSeverity) return explicitSeverity;

  const failureKind = resolveSyncIncidentFailureKind(payload);
  const status = resolveSyncIncidentStatus(payload);
  const errorName = readString(payload.errorName);
  const hiddenTab = payload.documentVisibilityState === 'hidden';
  const timedOut = readBoolean(payload.timedOut);
  const sustained = Math.max(consecutiveFailures, occurrenceCount) >= SYNC_INCIDENT_MINIMUM_CONSECUTIVE_FAILURES;

  if (status !== null || errorName === 'HttpError' || failureKind === 'http') {
    return 'high';
  }

  if (failureKind === 'timeout' || timedOut === true) {
    return sustained ? 'high' : 'medium';
  }

  if (recovered && (failureKind === 'network' || failureKind === 'unknown')) {
    return 'low';
  }

  if (failureKind === 'aborted' || hiddenTab) {
    return 'low';
  }

  if (failureKind === 'network') {
    return sustained ? 'medium' : 'low';
  }

  return 'medium';
}

export function buildSyncIncidentTelemetry({
  payload,
  telemetry,
  userId,
  stepId,
  scope,
  consecutiveFailures = 1,
  occurrenceCount = 1,
  firstSeenAt,
  lastSeenAt,
  recovered = false,
  suppressed = false,
  burstWindowMs = SYNC_INCIDENT_BURST_WINDOW_MS,
}: SyncIncidentTelemetryInput): Record<string, unknown> {
  const incidentPayload = payload ?? telemetry ?? {};
  const source = resolveSyncIncidentSource(incidentPayload);
  const failureKind = resolveSyncIncidentFailureKind(incidentPayload);
  const status = resolveSyncIncidentStatus(incidentPayload);
  const incidentSeverity = classifySyncIncidentSeverity({
    payload: incidentPayload,
    consecutiveFailures,
    occurrenceCount,
    recovered,
  });

  return {
    ...incidentPayload,
    source,
    failureKind,
    incidentKey: buildSyncIncidentKey({ payload: incidentPayload, userId, stepId, scope }),
    incidentKeyFields: [...SYNC_INCIDENT_KEY_FIELDS],
    incidentBurstWindowMs: burstWindowMs,
    incidentSource: source,
    incidentFailureKind: failureKind,
    incidentStatus: status,
    incidentSeverity,
    incidentOccurrenceCount: occurrenceCount,
    incidentConsecutiveFailures: consecutiveFailures,
    incidentFirstSeenAt: firstSeenAt ?? null,
    incidentLastSeenAt: lastSeenAt ?? null,
    incidentSuppressed: suppressed,
    recoveryState: recovered ? 'recovered' : 'unresolved',
    rawDiagnostics: { ...incidentPayload },
  };
}

export function isTransientSyncClientNoise(payload: Record<string, unknown>) {
  const failureKind = resolveSyncIncidentFailureKind(payload);
  const severity = classifySyncIncidentSeverity({ payload });
  return (
    failureKind === 'aborted'
    || payload.documentVisibilityState === 'hidden'
    || (payload.recoveryState === 'recovered' && severity === 'low')
  );
}
