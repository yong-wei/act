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

export interface ClassroomIdentityPayloadLite {
  kind: 'class-bound' | 'temporary';
  label: string;
  summaryLabel: string;
  lessonTitle: string;
  classId: string | null;
  className: string | null;
  sessionId?: string;
  joinCode?: string;
}

export interface SessionInfo {
  id: string;
  joinCode?: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  classId?: string | null;
  class?: { name?: string | null } | null;
  classroomIdentity?: ClassroomIdentityPayloadLite | null;
  currentItemId: string | null;
  currentStage?: string | null;
  planTitle?: string;
  updatedAt?: string | Date; // 版本控制时间戳，用于防止页面回跳
}

export interface TeacherViewStatePayload {
  states: SessionStateRecord[];
  courseStates: SessionStateRecord[];
  teacherStates: SessionStateRecord[];
  summary: SessionSummary;
  classroom?: {
    identity: ClassroomIdentityPayloadLite | null;
    currentStepId: string | null;
    currentStage: string | null;
    status: string | null;
  };
  presence?: {
    roster: Array<SessionUserLite & { online: boolean; submitted: boolean }>;
    onlineCount: number;
    expectedCount: number;
    latestUpdate: string | Date | null;
  };
  delivery?: {
    releasedStepId: string | null;
    submittedCount: number;
    inProgressCount: number;
    notStartedCount: number;
    notSubmitted: SessionUserLite[];
    latestUpdate: string | Date | null;
  };
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

export interface SessionSSEStatus {
  isConnected: boolean;
  reconnectAttempt: number;
  isFallbackActive: boolean;
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
  errorTelemetry?: Record<string, unknown> | null;
  courseState: StudentState;
  selfState: StudentState | null;
  teacherSyncState: TeacherSyncState | null;
  saveCourseState: (updater: (prev: StudentState) => StudentState) => Promise<void>;
  syncSession: () => Promise<void>;
  syncStates: () => Promise<void>;
  /**
   * 设置当前活动步骤索引（用于学生自主导航）
   */
  setActiveIndex: (index: number) => void;
  /**
   * SSE 连接状态（用于调试和 UI 显示）
   */
  sseStatus?: SessionSSEStatus;
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
  errorTelemetry?: Record<string, unknown> | null;
  teacherViewHydrated: boolean;
  patchCurrentStep: (nextIndex: number, patch: Record<string, unknown>) => Promise<void>;
  postTeacherSyncState: (payload: TeacherSyncState) => Promise<void>;
  postTeacherSyncInput: (input: TeacherSyncInput) => Promise<void>;
  syncSession: () => Promise<void>;
  syncStates: () => Promise<void>;
  finishSession: () => Promise<void>;
}
