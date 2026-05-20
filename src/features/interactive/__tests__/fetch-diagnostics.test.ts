import { describe, expect, it, vi } from 'vitest';
import {
  buildHttpFailureTelemetry,
  buildFetchFailureTelemetry,
  buildSyncIncidentTelemetry,
  createSyncIncidentTracker,
  shouldSurfaceSyncFailure,
  SYNC_INCIDENT_BURST_WINDOW_MS,
} from '../session-framework/fetch-diagnostics';

describe('buildFetchFailureTelemetry', () => {
  it('records fetch source, URL, elapsed time, and browser connection context', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_776_307_900_500);
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        onLine: false,
        connection: {
          effectiveType: '4g',
          rtt: 120,
          downlink: 8.4,
        },
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: { visibilityState: 'hidden' },
      configurable: true,
    });

    const telemetry = buildFetchFailureTelemetry({
      source: 'student_state_get',
      url: '/api/session/session-001/state?scope=student-view',
      method: 'GET',
      startedAt: 1_776_307_900_000,
      error: new TypeError('Failed to fetch'),
      retryCount: 3,
      pollIntervalMs: 5000,
    });

    expect(telemetry).toMatchObject({
      source: 'student_state_get',
      url: '/api/session/session-001/state?scope=student-view',
      method: 'GET',
      errorName: 'TypeError',
      errorMessage: 'Failed to fetch',
      elapsedMs: 500,
      navigatorOnLine: false,
      documentVisibilityState: 'hidden',
      connectionEffectiveType: '4g',
      connectionRtt: 120,
      connectionDownlink: 8.4,
      retryCount: 3,
      pollIntervalMs: 5000,
      timeoutMs: null,
      timedOut: false,
    });
  });

  it('marks aborted fetches as timeouts when the sync timeout fires', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_776_307_920_000);

    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const telemetry = buildFetchFailureTelemetry({
      source: 'session_progress_get',
      url: '/api/session/session-001',
      method: 'GET',
      startedAt: 1_776_307_900_000,
      error: abortError,
      timeoutMs: 20_000,
    });

    expect(telemetry).toMatchObject({
      source: 'session_progress_get',
      errorName: 'AbortError',
      failureKind: 'timeout',
      timedOut: true,
      elapsedMs: 20_000,
      timeoutMs: 20_000,
    });
  });

  it('classifies short aborted fetches as aborts instead of timeouts', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_776_307_905_000);

    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const telemetry = buildFetchFailureTelemetry({
      source: 'student_state_get',
      url: '/api/session/session-001/state?scope=student-view',
      method: 'GET',
      startedAt: 1_776_307_900_000,
      error: abortError,
      timeoutMs: 20_000,
    });

    expect(telemetry).toMatchObject({
      source: 'student_state_get',
      errorName: 'AbortError',
      failureKind: 'aborted',
      timedOut: false,
      elapsedMs: 5_000,
      timeoutMs: 20_000,
    });
  });

  it('does not surface short aborts or first network blips as classroom sync errors', () => {
    expect(
      shouldSurfaceSyncFailure({
        telemetry: {
          errorName: 'AbortError',
          failureKind: 'aborted',
          timedOut: false,
        },
        consecutiveFailures: 10,
      }),
    ).toBe(false);

    expect(
      shouldSurfaceSyncFailure({
        telemetry: {
          errorName: 'TypeError',
          failureKind: 'network',
          timedOut: false,
        },
        consecutiveFailures: 1,
      }),
    ).toBe(false);

    expect(
      shouldSurfaceSyncFailure({
        telemetry: {
          errorName: 'TypeError',
          failureKind: 'network',
          timedOut: false,
        },
        consecutiveFailures: 3,
      }),
    ).toBe(true);
  });

  it('builds incident telemetry with a stable key, severity, and raw diagnostics', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_776_307_900_250);

    const rawTelemetry = buildHttpFailureTelemetry({
      source: 'session_progress_get',
      url: '/api/session/session-001',
      method: 'GET',
      startedAt: 1_776_307_900_000,
      response: new Response('{}', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/json' },
      }),
    });

    const incidentTelemetry = buildSyncIncidentTelemetry({
      telemetry: rawTelemetry,
      stepId: 'step-03',
      scope: 'teacher-page',
      userId: 'student-1',
      consecutiveFailures: 1,
      occurrenceCount: 1,
      firstSeenAt: 1_776_307_900_250,
      lastSeenAt: 1_776_307_900_250,
    });

    expect(incidentTelemetry).toMatchObject({
      source: 'session_progress_get',
      url: '/api/session/session-001',
      method: 'GET',
      status: 503,
      statusText: 'Service Unavailable',
      failureKind: 'http',
      incidentKey: 'student-1\u0000teacher-page\u0000step-03\u0000session_progress_get\u0000/api/session/session-001\u0000GET\u0000http\u0000503',
      incidentSeverity: 'high',
      incidentBurstWindowMs: SYNC_INCIDENT_BURST_WINDOW_MS,
      incidentOccurrenceCount: 1,
      incidentFirstSeenAt: 1_776_307_900_250,
      incidentLastSeenAt: 1_776_307_900_250,
      recoveryState: 'unresolved',
      rawDiagnostics: rawTelemetry,
    });
  });

  it('suppresses repeated bursts but emits recovery telemetry after a later success', () => {
    const tracker = createSyncIncidentTracker();
    const telemetry = {
      source: 'session_progress_get',
      url: '/api/session/session-001',
      method: 'GET',
      errorName: 'HttpError',
      failureKind: 'http',
      status: 503,
      timedOut: false,
    };

    const firstFailure = tracker.recordFailure({
      telemetry,
      stepId: 'step-03',
      scope: 'student-page',
      userId: 'student-1',
      consecutiveFailures: 1,
      now: 1_776_307_900_000,
    });
    const repeatedFailure = tracker.recordFailure({
      telemetry,
      stepId: 'step-03',
      scope: 'student-page',
      userId: 'student-1',
      consecutiveFailures: 2,
      now: 1_776_307_910_000,
    });

    expect(firstFailure.shouldEmit).toBe(true);
    expect(firstFailure.telemetry).toMatchObject({
      incidentOccurrenceCount: 1,
      incidentSuppressed: false,
      incidentSeverity: 'high',
    });
    expect(repeatedFailure.shouldEmit).toBe(false);
    expect(repeatedFailure.telemetry).toMatchObject({
      incidentOccurrenceCount: 2,
      incidentSuppressed: true,
      incidentSeverity: 'high',
    });

    const recoveryTelemetry = tracker.recordRecovery({
      sessionId: 'session-001',
      stepId: 'step-03',
      now: 1_776_307_920_000,
    });

    expect(recoveryTelemetry).toHaveLength(1);
    expect(recoveryTelemetry[0]).toMatchObject({
      eventType: 'sync_recovered',
      sessionId: 'session-001',
      stepId: 'step-03',
      incidentKey: firstFailure.telemetry.incidentKey,
      recoveredIncidentCount: 1,
      recoveredFailureCount: 2,
      recoveryState: 'recovered',
      incidentSeverity: 'high',
      status: 503,
      rawDiagnostics: telemetry,
    });
  });

  it('only recovers incidents that match the successful sync source', () => {
    const tracker = createSyncIncidentTracker();
    tracker.recordFailure({
      telemetry: {
        source: 'student_state_get',
        url: '/api/session/session-001/state?scope=student-view',
        method: 'GET',
        errorName: 'TypeError',
        failureKind: 'network',
      },
      stepId: 'step-03',
      consecutiveFailures: 3,
      now: 1_776_307_900_000,
    });
    tracker.recordFailure({
      telemetry: {
        source: 'session_state_post',
        url: '/api/session/session-001/state',
        method: 'POST',
        errorName: 'TypeError',
        failureKind: 'network',
      },
      stepId: 'step-03',
      consecutiveFailures: 3,
      now: 1_776_307_900_000,
    });

    const postRecovery = tracker.recordRecovery({
      source: 'session_state_post',
      url: '/api/session/session-001/state',
      method: 'POST',
      now: 1_776_307_910_000,
    });
    const getRecovery = tracker.recordRecovery({
      source: 'student_state_get',
      url: '/api/session/session-001/state?scope=student-view',
      method: 'GET',
      now: 1_776_307_920_000,
    });

    expect(postRecovery).toHaveLength(1);
    expect(postRecovery[0]).toMatchObject({
      source: 'session_state_post',
      method: 'POST',
      recoveryState: 'recovered',
    });
    expect(getRecovery).toHaveLength(1);
    expect(getRecovery[0]).toMatchObject({
      source: 'student_state_get',
      method: 'GET',
      recoveryState: 'recovered',
    });
  });

  it('does not emit recovery telemetry for unsurfaced transient failures', () => {
    const tracker = createSyncIncidentTracker();
    const transientFailure = tracker.recordFailure({
      telemetry: {
        source: 'session_progress_get',
        url: '/api/session/session-001',
        method: 'GET',
        errorName: 'TypeError',
        failureKind: 'network',
      },
      stepId: 'step-03',
      consecutiveFailures: 1,
      now: 1_776_307_900_000,
    });

    const recoveryTelemetry = tracker.recordRecovery({
      source: 'session_progress_get',
      url: '/api/session/session-001',
      method: 'GET',
      now: 1_776_307_910_000,
    });
    const nextRecoveryTelemetry = tracker.recordRecovery({
      source: 'session_progress_get',
      url: '/api/session/session-001',
      method: 'GET',
      now: 1_776_307_920_000,
    });

    expect(transientFailure.shouldEmit).toBe(false);
    expect(recoveryTelemetry).toHaveLength(0);
    expect(nextRecoveryTelemetry).toHaveLength(0);
  });

  it('preserves the failed step when recovery happens after the active step changes', () => {
    const tracker = createSyncIncidentTracker();
    const failure = tracker.recordFailure({
      telemetry: {
        source: 'session_progress_get',
        url: '/api/session/session-001',
        method: 'GET',
        errorName: 'TypeError',
        failureKind: 'network',
      },
      stepId: 'step-03',
      consecutiveFailures: 3,
      now: 1_776_307_900_000,
    });

    const recoveryTelemetry = tracker.recordRecovery({
      sessionId: 'session-001',
      stepId: 'step-04',
      source: 'session_progress_get',
      url: '/api/session/session-001',
      method: 'GET',
      now: 1_776_307_910_000,
    });

    expect(recoveryTelemetry).toHaveLength(1);
    expect(recoveryTelemetry[0]).toMatchObject({
      eventType: 'sync_recovered',
      sessionId: 'session-001',
      stepId: 'step-03',
      incidentKey: failure.telemetry.incidentKey,
      recoveryState: 'recovered',
    });
  });
});
