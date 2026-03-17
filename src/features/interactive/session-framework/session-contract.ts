'use client';

export interface SessionUserLite {
  id: string;
  name: string | null;
  email?: string | null;
}

export interface SessionStateRecord<TData = unknown> {
  itemId: string | null;
  stateKey?: string | null;
  lessonKey?: string | null;
  submittedAt?: string | Date | null;
  data: TData;
  user?: SessionUserLite;
}

export interface SessionSummary {
  totalStudents: number;
  latestUpdate: string | Date | null;
}

export interface SessionInfo {
  id: string;
  joinCode?: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  classId?: string | null;
  currentItemId: string | null;
  currentStage?: string | null;
  planTitle?: string;
}

export interface TeacherViewStatePayload {
  states: SessionStateRecord[];
  courseStates: SessionStateRecord[];
  teacherStates: SessionStateRecord[];
  summary: SessionSummary;
}

export interface StudentViewStatePayload {
  states: SessionStateRecord[];
  courseStates: SessionStateRecord[];
  teacherStates: SessionStateRecord[];
  summary: SessionSummary;
}

export interface SelfViewStatePayload {
  states: SessionStateRecord[];
  courseStates: SessionStateRecord[];
  teacherStates: SessionStateRecord[];
  summary: SessionSummary;
}

export interface LessonStepLite {
  id: string;
}

export interface LessonSessionAdapter<
  StudentState,
  TeacherSyncState,
  TeacherSyncInput extends Record<string, unknown> = Record<string, unknown>,
> {
  lessonKey: string;
  studentItemId: string;
  teacherItemId: string;
  studentStateKey: string;
  teacherStateKey: string;
  createEmptyStudentState(studentName: string): StudentState;
  isStudentState(value: unknown): value is StudentState;
  isTeacherSyncState(value: unknown): value is TeacherSyncState;
  buildTeacherSyncPayload(input: TeacherSyncInput): TeacherSyncState;
}

export interface StudentLessonSessionResult<StudentState, TeacherSyncState> {
  sessionInfo: SessionInfo | null;
  stateRecords: SessionStateRecord[];
  courseStates: SessionStateRecord[];
  teacherStates: SessionStateRecord[];
  activeIndex: number;
  teacherIndex: number;
  isOutOfSync: boolean;
  loadingSession: boolean;
  error: string | null;
  courseState: StudentState;
  selfState: StudentState | null;
  teacherSyncState: TeacherSyncState | null;
  saveCourseState: (updater: (prev: StudentState) => StudentState) => Promise<void>;
  syncSession: () => Promise<void>;
  syncStates: () => Promise<void>;
}

export interface TeacherLessonSessionResult<
  TeacherSyncState,
  TeacherSyncInput extends Record<string, unknown>,
> {
  sessionInfo: SessionInfo | null;
  stateRecords: SessionStateRecord[];
  courseStates: SessionStateRecord[];
  teacherStates: SessionStateRecord[];
  activeIndex: number;
  teacherIndex: number;
  isOutOfSync: boolean;
  loadingSession: boolean;
  error: string | null;
  teacherViewHydrated: boolean;
  patchCurrentStep: (nextIndex: number, patch: Record<string, unknown>) => Promise<void>;
  postTeacherSyncState: (payload: TeacherSyncState) => Promise<void>;
  postTeacherSyncInput: (input: TeacherSyncInput) => Promise<void>;
  syncSession: () => Promise<void>;
  syncStates: () => Promise<void>;
  finishSession: () => Promise<void>;
}
