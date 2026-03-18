/**
 * Unified Event Protocol for AI-OBE Platform
 *
 * Defines the standard event structure for all learning analytics.
 * All events must conform to this interface.
 */

export type EventPriority = 'core' | 'secondary';

export type UserRole = 'student' | 'teacher' | 'admin';

export type EventSource = 'web' | 'system' | 'ai';

export type PageType =
  | 'theory'
  | 'practice'
  | 'workspace'
  | 'quiz'
  | 'reflection'
  | 'simulation'
  | 'dashboard'
  | 'classroom';

/**
 * Unified Learning Event Structure
 */
export interface LearningEvent {
  // Identity
  eventId: string;
  occurredAt: string; // ISO 8601

  // Actor Context
  userId: string;
  role: UserRole;
  classId?: string;

  // Learning Context
  courseId?: string;
  lessonId?: string;
  sessionId?: string;
  pagePath: string;
  pageType: PageType;

  // Action Context
  moduleId?: string;
  actionType: string;
  targetType?: string;
  targetId?: string;

  // Payload
  payload: Record<string, unknown>;

  // Computed Metrics (added by ingestion layer)
  derivedMetrics?: Record<string, number | string | boolean>;

  // Metadata
  source: EventSource;
  priority: EventPriority;
  clientTimestamp?: number;
}

/**
 * Event with validation status
 */
export interface ValidatedEvent {
  event: LearningEvent;
  isValid: boolean;
  errors?: string[];
}

/**
 * Event batch for bulk processing
 */
export interface EventBatch {
  batchId: string;
  events: LearningEvent[];
  createdAt: string;
  priority: EventPriority;
}

/**
 * Convert client event format to LearningEvent
 */
export function toLearningEvent(
  clientEvent: Record<string, unknown>,
  context: {
    userId: string;
    role: UserRole;
    pagePath: string;
    pageType: PageType;
  }
): LearningEvent {
  const now = new Date().toISOString();

  return {
    eventId: generateEventId(),
    occurredAt: now,
    userId: context.userId,
    role: context.role,
    classId: clientEvent.classId as string | undefined,
    courseId: clientEvent.courseId as string | undefined,
    lessonId: clientEvent.lessonId as string | undefined,
    sessionId: clientEvent.sessionId as string | undefined,
    pagePath: context.pagePath,
    pageType: context.pageType,
    moduleId: clientEvent.moduleId as string | undefined,
    actionType: (clientEvent.actionType as string) || (clientEvent.type as string) || 'unknown',
    targetType: clientEvent.targetType as string | undefined,
    targetId: clientEvent.targetId as string | undefined,
    payload: (clientEvent.payload as Record<string, unknown>) ||
             (clientEvent.data as Record<string, unknown>) ||
             {},
    source: (clientEvent.source as EventSource) || 'web',
    priority: (clientEvent.priority as EventPriority) || 'secondary',
    clientTimestamp: clientEvent.timestamp as number | undefined,
  };
}

/**
 * Generate ULID-like event ID (sortable)
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Validate event structure
 */
export function validateEvent(event: unknown): ValidatedEvent {
  const errors: string[] = [];

  if (!event || typeof event !== 'object') {
    return { event: event as LearningEvent, isValid: false, errors: ['Event must be an object'] };
  }

  const e = event as Record<string, unknown>;

  // Required fields
  if (!e.eventId || typeof e.eventId !== 'string') {
    errors.push('eventId is required and must be a string');
  }

  if (!e.occurredAt || typeof e.occurredAt !== 'string') {
    errors.push('occurredAt is required and must be a string');
  }

  if (!e.userId || typeof e.userId !== 'string') {
    errors.push('userId is required and must be a string');
  }

  if (!e.pagePath || typeof e.pagePath !== 'string') {
    errors.push('pagePath is required and must be a string');
  }

  if (!e.actionType || typeof e.actionType !== 'string') {
    errors.push('actionType is required and must be a string');
  }

  // Validate priority
  const validPriorities: EventPriority[] = ['core', 'secondary'];
  if (!validPriorities.includes(e.priority as EventPriority)) {
    errors.push('priority must be "core" or "secondary"');
  }

  return {
    event: e as unknown as LearningEvent,
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
