'use client';

import { useCallback } from 'react';

import { COURSE_EVENT_TYPES, type CourseEventType } from '@/lib/classroom-analytics/event-taxonomy';
import { buildCourseEvent } from './build-course-event';

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
    case COURSE_EVENT_TYPES.LESSON_STEP_LEAVE:
    case COURSE_EVENT_TYPES.AI_PANEL_OPEN:
    default:
      return 'interact';
  }
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

  const trackStepView = useCallback((stepId: string, data: Record<string, unknown> = {}) => {
    // lesson_step_view
    trackCourseEvent(COURSE_EVENT_TYPES.LESSON_STEP_VIEW, { stepId, data });
  }, [trackCourseEvent]);

  const trackLessonSubmit = useCallback((stepId: string, data: Record<string, unknown> = {}) => {
    // lesson_submit
    trackCourseEvent(COURSE_EVENT_TYPES.LESSON_SUBMIT, { stepId, data });
  }, [trackCourseEvent]);

  const trackStepLeave = useCallback((stepId: string, data: Record<string, unknown> = {}) => {
    // lesson_step_leave
    trackCourseEvent(COURSE_EVENT_TYPES.LESSON_STEP_LEAVE, { stepId, data });
  }, [trackCourseEvent]);

  const trackLessonResubmit = useCallback((stepId: string, data: Record<string, unknown> = {}) => {
    // lesson_resubmit
    trackCourseEvent(COURSE_EVENT_TYPES.LESSON_RESUBMIT, { stepId, data });
  }, [trackCourseEvent]);

  const trackWorkspaceParamChange = useCallback((stepId: string | null, data: Record<string, unknown> = {}) => {
    // workspace_param_change
    trackCourseEvent(COURSE_EVENT_TYPES.WORKSPACE_PARAM_CHANGE, { stepId, data });
  }, [trackCourseEvent]);

  const trackSyncError = useCallback((stepId: string | null, data: Record<string, unknown> = {}) => {
    // sync_error
    trackCourseEvent(COURSE_EVENT_TYPES.SYNC_ERROR, { stepId, data });
  }, [trackCourseEvent]);

  const trackSessionFinalize = useCallback((data: Record<string, unknown> = {}) => {
    // session_finalize
    trackCourseEvent(COURSE_EVENT_TYPES.SESSION_FINALIZE, { data });
  }, [trackCourseEvent]);

  return {
    buildCourseEvent,
    trackCourseEvent,
    trackStepView,
    trackStepLeave,
    trackLessonSubmit,
    trackLessonResubmit,
    trackWorkspaceParamChange,
    trackSyncError,
    trackSessionFinalize,
  };
}
