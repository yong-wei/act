export const COURSE_EVENT_TYPES = {
  LESSON_STEP_VIEW: 'lesson_step_view',
  LESSON_STEP_LEAVE: 'lesson_step_leave',
  LESSON_SUBMIT: 'lesson_submit',
  LESSON_RESUBMIT: 'lesson_resubmit',
  WORKSPACE_PARAM_CHANGE: 'workspace_param_change',
  AI_PANEL_OPEN: 'ai_panel_open',
  AI_QUERY_SUBMIT: 'ai_query_submit',
  SYNC_ERROR: 'sync_error',
  SESSION_FINALIZE: 'session_finalize',
} as const;

export type CourseEventType = typeof COURSE_EVENT_TYPES[keyof typeof COURSE_EVENT_TYPES];

export const COURSE_EVENT_TYPE_LIST: CourseEventType[] = Object.values(COURSE_EVENT_TYPES);
