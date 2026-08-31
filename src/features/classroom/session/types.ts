import type { ClassroomSessionAccessUser } from './access-policy';

export const SESSION_STATUSES = ['ACTIVE', 'PAUSED', 'FINISHED'] as const;
export type ClassroomSessionStatus = (typeof SESSION_STATUSES)[number];

export const BOPPPS_STAGES = [
  'BRIDGE_IN',
  'OBJECTIVE',
  'PRE_ASSESSMENT',
  'PARTICIPATORY',
  'POST_ASSESSMENT',
  'SUMMARY',
] as const;
export type ClassroomBopppsStage = (typeof BOPPPS_STAGES)[number];

export interface ClassroomSessionActor extends ClassroomSessionAccessUser {
  id: string;
  role?: unknown;
}

export interface CreateClassroomSessionInput {
  actor: ClassroomSessionActor;
  planId?: string;
  coursewarePublicationRevisionId?: string;
  classId?: string;
  duplicateAction?: string;
  sourcePresetKey?: string;
}

export interface JoinClassroomSessionInput {
  actor: ClassroomSessionActor;
  joinCode: string;
}

export interface ReadClassroomSessionInput {
  actor: ClassroomSessionActor;
  sessionId: string;
}

export interface AdvanceClassroomSessionInput {
  actor: ClassroomSessionActor;
  sessionId: string;
  currentItemId?: string;
  currentStage?: string | null;
  status?: string;
  classroomEvent?: unknown;
}

export interface EndClassroomSessionInput {
  actor: ClassroomSessionActor;
  sessionId: string;
  classroomEvent?: unknown;
}

export interface StreamClassroomSessionInput {
  actor: ClassroomSessionActor;
  sessionId: string;
}
