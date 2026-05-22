export const COURSE_EVENT_TYPES = {
  LESSON_STEP_VIEW: 'lesson_step_view',
  LESSON_STEP_LEAVE: 'lesson_step_leave',
  LESSON_SUBMIT: 'lesson_submit',
  LESSON_RESUBMIT: 'lesson_resubmit',
  WORKSPACE_PARAM_CHANGE: 'workspace_param_change',
  AI_PANEL_OPEN: 'ai_panel_open',
  AI_QUERY_SUBMIT: 'ai_query_submit',
  SYNC_ERROR: 'sync_error',
  SYNC_RECOVERED: 'sync_recovered',
  SESSION_FINALIZE: 'session_finalize',
  RESOURCE_VIEW: 'resource_view',
  RESOURCE_OPEN: 'resource_open',
  RESOURCE_PLAY: 'resource_play',
  RESOURCE_PROGRESS: 'resource_progress',
  RESOURCE_DOWNLOAD: 'resource_download',
  RESOURCE_COMPLETE: 'resource_complete',
  KNOWLEDGE_GRAPH_NODE_FOCUS: 'knowledge_graph_node_focus',
  EXTERNAL_MODULE_OPEN: 'external_module_open',
} as const;

export type CourseEventType = typeof COURSE_EVENT_TYPES[keyof typeof COURSE_EVENT_TYPES];

export const COURSE_EVENT_TYPE_LIST: CourseEventType[] = Object.values(COURSE_EVENT_TYPES);
