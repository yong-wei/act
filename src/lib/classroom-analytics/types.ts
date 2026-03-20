export interface ClassroomInteractionEventInput {
  resourceId?: string | null;
  resourceKey: string;
  sessionId?: string | null;
  lessonKey?: string | null;
  stepId?: string | null;
  actorRole?: string | null;
  attemptKey?: string | null;
  type: string;
  timestamp: number;
  clientEventAt?: number | string | null;
  data?: Record<string, unknown>;
}

export interface ClassroomStateMutationInput {
  itemId?: string | null;
  stateKey?: string | null;
  lessonKey?: string | null;
  clientEventAt?: number | string | null;
  data: unknown;
}

export interface ClassSessionReportPayload {
  sessionId: string;
  lessonKey?: string | null;
  reportType: string;
  status: string;
  summary?: string | null;
  reportData: Record<string, unknown>;
  aiSummary?: string | null;
}

export interface StudentSessionReportPayload extends ClassSessionReportPayload {
  userId: string;
}
