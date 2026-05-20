'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { COURSE_EVENT_TYPES, type CourseEventType } from '@/lib/classroom-analytics/event-taxonomy';
import {
  buildSyncIncidentTelemetry,
  SYNC_RECOVERY_EVENT_NAME,
} from '@/lib/classroom-analytics/sync-incident-model';
import { buildCourseEvent } from './build-course-event';
import {
  createWorkspaceParameterTelemetryBuffer,
  WORKSPACE_PARAM_IDLE_FLUSH_MS,
  type WorkspaceParameterTelemetryEvent,
  type WorkspaceParamFlushReason,
} from './workspace-parameter-telemetry';

type BaseEmitType = 'view' | 'interact' | 'param_change' | 'submit' | 'ai_query' | 'complete' | 'error';

interface UseCourseEventTrackingOptions {
  resourceKey: string;
  resourceId?: string | null;
  sessionId?: string | null;
  lessonKey?: string | null;
  actorRole?: string | null;
  emit: (type: BaseEmitType, data?: Record<string, unknown>) => void;
}

function mapCourseEventType(type: CourseEventType): BaseEmitType {
  switch (type) {
    case COURSE_EVENT_TYPES.LESSON_STEP_VIEW:
      return 'view';
    case COURSE_EVENT_TYPES.LESSON_SUBMIT:
    case COURSE_EVENT_TYPES.LESSON_RESUBMIT:
      return 'submit';
    case COURSE_EVENT_TYPES.WORKSPACE_PARAM_CHANGE:
      return 'param_change';
    case COURSE_EVENT_TYPES.AI_QUERY_SUBMIT:
      return 'ai_query';
    case COURSE_EVENT_TYPES.SESSION_FINALIZE:
      return 'complete';
    case COURSE_EVENT_TYPES.SYNC_ERROR:
      return 'error';
    case COURSE_EVENT_TYPES.SYNC_RECOVERED:
      return 'interact';
    case COURSE_EVENT_TYPES.LESSON_STEP_LEAVE:
    case COURSE_EVENT_TYPES.AI_PANEL_OPEN:
    default:
      return 'interact';
  }
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function useCourseEventTracking({
  resourceKey,
  resourceId,
  sessionId,
  lessonKey,
  actorRole,
  emit,
}: UseCourseEventTrackingOptions) {
  const trackCourseEvent = useCallback(
    (eventType: CourseEventType, options: {
      stepId?: string | null;
      attemptKey?: string | null;
      clientEventAt?: number | string | null;
      data?: Record<string, unknown>;
    } = {}) => {
      const event = buildCourseEvent({
        eventType,
        resourceKey,
        resourceId,
        sessionId,
        lessonKey,
        actorRole,
        stepId: options.stepId ?? null,
        attemptKey: options.attemptKey ?? null,
        clientEventAt: options.clientEventAt,
        data: options.data,
      });

      emit(mapCourseEventType(eventType), {
        ...event.data,
        eventType,
        resourceKey: event.resourceKey,
        resourceId: event.resourceId,
        sessionId: event.sessionId,
        lessonKey: event.lessonKey,
        stepId: event.stepId,
        actorRole: event.actorRole,
        attemptKey: event.attemptKey,
        clientEventAt: event.clientEventAt,
      });
    },
    [actorRole, emit, lessonKey, resourceId, resourceKey, sessionId],
  );
  const workspaceParamBuffer = useMemo(() => createWorkspaceParameterTelemetryBuffer(), []);
  const workspaceParamFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWorkspaceParamFlushTimer = useCallback(() => {
    if (workspaceParamFlushTimerRef.current) {
      clearTimeout(workspaceParamFlushTimerRef.current);
      workspaceParamFlushTimerRef.current = null;
    }
  }, []);

  const emitWorkspaceParamChanges = useCallback(
    (events: WorkspaceParameterTelemetryEvent[]) => {
      for (const event of events) {
        trackCourseEvent(COURSE_EVENT_TYPES.WORKSPACE_PARAM_CHANGE, {
          stepId: event.stepId,
          clientEventAt: event.clientEventAt,
          data: event.data,
        });
      }
    },
    [trackCourseEvent],
  );

  const collectDueWorkspaceParamChanges = useCallback(() => {
    const events = workspaceParamBuffer.collectDue();
    emitWorkspaceParamChanges(events);
    return events;
  }, [emitWorkspaceParamChanges, workspaceParamBuffer]);

  const scheduleWorkspaceParamFlush = useCallback(() => {
    clearWorkspaceParamFlushTimer();
    workspaceParamFlushTimerRef.current = setTimeout(() => {
      workspaceParamFlushTimerRef.current = null;
      collectDueWorkspaceParamChanges();
    }, WORKSPACE_PARAM_IDLE_FLUSH_MS);
  }, [clearWorkspaceParamFlushTimer, collectDueWorkspaceParamChanges]);

  const flushWorkspaceParamChanges = useCallback(
    (reason: WorkspaceParamFlushReason, stepId?: string | null) => {
      clearWorkspaceParamFlushTimer();
      const events = stepId === undefined
        ? workspaceParamBuffer.flushAll(reason)
        : workspaceParamBuffer.flushStep(stepId, reason);
      emitWorkspaceParamChanges(events);
      return events;
    },
    [clearWorkspaceParamFlushTimer, emitWorkspaceParamChanges, workspaceParamBuffer],
  );

  useEffect(() => () => {
    clearWorkspaceParamFlushTimer();
  }, [clearWorkspaceParamFlushTimer]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleSyncRecovered = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
        return;
      }
      const data = detail as Record<string, unknown>;
      const recoveredSessionId = typeof data.sessionId === 'string' ? data.sessionId : null;
      if (sessionId && recoveredSessionId && recoveredSessionId !== sessionId) {
        return;
      }
      const stepId = typeof data.stepId === 'string' ? data.stepId : null;
      const scope = typeof data.scope === 'string'
        ? data.scope
        : actorRole
          ? `${actorRole}-page`
          : null;
      trackCourseEvent(COURSE_EVENT_TYPES.SYNC_RECOVERED, {
        stepId,
        data: {
          ...buildSyncIncidentTelemetry({
            payload: { ...data, scope },
            stepId,
            scope,
            occurrenceCount: readNumber(data.recoveredFailureCount) ?? readNumber(data.incidentOccurrenceCount) ?? 1,
            firstSeenAt: readNumber(data.incidentFirstSeenAt),
            lastSeenAt: readNumber(data.incidentLastSeenAt),
            recovered: true,
          }),
          eventType: 'sync_recovered',
          recoveredIncidentCount: readNumber(data.recoveredIncidentCount) ?? 1,
          recoveredFailureCount: readNumber(data.recoveredFailureCount) ?? 1,
        },
      });
    };

    window.addEventListener(SYNC_RECOVERY_EVENT_NAME, handleSyncRecovered);
    return () => window.removeEventListener(SYNC_RECOVERY_EVENT_NAME, handleSyncRecovered);
  }, [actorRole, sessionId, trackCourseEvent]);

  const trackStepView = useCallback((stepId: string, data: Record<string, unknown> = {}) => {
    // lesson_step_view
    trackCourseEvent(COURSE_EVENT_TYPES.LESSON_STEP_VIEW, { stepId, data });
  }, [trackCourseEvent]);

  const trackLessonSubmit = useCallback((stepId: string, data: Record<string, unknown> = {}) => {
    // lesson_submit
    flushWorkspaceParamChanges('submit', stepId);
    trackCourseEvent(COURSE_EVENT_TYPES.LESSON_SUBMIT, { stepId, data });
  }, [flushWorkspaceParamChanges, trackCourseEvent]);

  const trackStepLeave = useCallback((stepId: string, data: Record<string, unknown> = {}) => {
    // lesson_step_leave
    flushWorkspaceParamChanges('step_leave', stepId);
    trackCourseEvent(COURSE_EVENT_TYPES.LESSON_STEP_LEAVE, { stepId, data });
  }, [flushWorkspaceParamChanges, trackCourseEvent]);

  const trackLessonResubmit = useCallback((stepId: string, data: Record<string, unknown> = {}) => {
    // lesson_resubmit
    flushWorkspaceParamChanges('submit', stepId);
    trackCourseEvent(COURSE_EVENT_TYPES.LESSON_RESUBMIT, { stepId, data });
  }, [flushWorkspaceParamChanges, trackCourseEvent]);

  const trackWorkspaceParamChange = useCallback((stepId: string | null, data: Record<string, unknown> = {}) => {
    // workspace_param_change
    workspaceParamBuffer.record(stepId, data);
    scheduleWorkspaceParamFlush();
  }, [scheduleWorkspaceParamFlush, workspaceParamBuffer]);

  const trackSyncError = useCallback((stepId: string | null, data: Record<string, unknown> = {}) => {
    // sync_error
    const scope = typeof data.scope === 'string'
      ? data.scope
      : actorRole
        ? `${actorRole}-page`
        : null;
    trackCourseEvent(COURSE_EVENT_TYPES.SYNC_ERROR, {
      stepId,
      data: buildSyncIncidentTelemetry({
        payload: { ...data, scope },
        stepId,
        scope,
        consecutiveFailures: readNumber(data.incidentConsecutiveFailures) ?? 1,
        occurrenceCount: readNumber(data.incidentOccurrenceCount) ?? 1,
        firstSeenAt: readNumber(data.incidentFirstSeenAt),
        lastSeenAt: readNumber(data.incidentLastSeenAt),
      }),
    });
  }, [actorRole, trackCourseEvent]);

  const trackSessionFinalize = useCallback((data: Record<string, unknown> = {}) => {
    // session_finalize
    flushWorkspaceParamChanges('session_finalize');
    trackCourseEvent(COURSE_EVENT_TYPES.SESSION_FINALIZE, { data });
  }, [flushWorkspaceParamChanges, trackCourseEvent]);

  return {
    buildCourseEvent,
    trackCourseEvent,
    trackStepView,
    trackStepLeave,
    trackLessonSubmit,
    trackLessonResubmit,
    trackWorkspaceParamChange,
    collectDueWorkspaceParamChanges,
    flushWorkspaceParamChanges,
    trackSyncError,
    trackSessionFinalize,
  };
}
