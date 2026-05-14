import { describe, expect, it, vi } from 'vitest';
import {
  buildFetchFailureTelemetry,
  shouldSurfaceSyncFailure,
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
});
