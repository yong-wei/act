'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  createEmptyL2CStudentState,
  getL2CMediaSrc,
  L2C_LESSON_STEPS,
  type L2CStudentCourseState,
  type L2CStepResponse,
} from '@/lib/l2c-course';
import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import { L2CCourseHeader } from './course-header';
import {
  L2CKnowledgeMapVisual,
  L2CStepAiAssistant,
  L2CStepContentPanel,
  L2CStudentActivityForm,
  L2CStudentSummaryPanel,
} from './step-panels';

interface StudentSessionInfo {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  currentItemId: string | null;
}

interface SessionStateRecord {
  itemId: string | null;
  data: unknown;
  user?: {
    id: string;
    name: string | null;
  };
}

interface TeacherCourseSyncState {
  kind: 'teacher_sync_l2c';
  activeStepId: string;
  revealedAnswers: Record<string, boolean>;
  updatedAt: number;
}

function isL2CStudentState(value: unknown): value is L2CStudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<L2CStudentCourseState>;
  return data.kind === 'l2c_student_state' && data.version === 1;
}

export function L2CStudentPage({
  sessionId,
  lessonRuntime,
}: {
  sessionId: string;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  const isDemo = sessionId === 'demo';
  const searchParams = useSearchParams();
  const demoStepId = searchParams.get('step');
  const { data: authSession } = useSession();

  const [sessionInfo, setSessionInfo] = useState<StudentSessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(!isDemo);
  const [activeIndex, setActiveIndex] = useState(0);
  const [teacherIndex, setTeacherIndex] = useState(0);
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [courseState, setCourseState] = useState<L2CStudentCourseState>(() =>
    createEmptyL2CStudentState(authSession?.user?.name?.trim() || '学生'),
  );
  const [error, setError] = useState<string | null>(null);
  const initialTeacherSyncRef = useRef(isDemo);
  const initialPresenceSyncedRef = useRef(false);

  const currentStudentName = authSession?.user?.name?.trim() || '学生';
  const currentUserId = authSession?.user?.id;

  const syncSession = useCallback(async () => {
    if (isDemo) return;
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as StudentSessionInfo & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '课堂读取失败');
      }
      setSessionInfo(data);
      const index = data.currentItemId ? L2C_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId) : -1;
      if (index >= 0) {
        setTeacherIndex(index);
        if (!initialTeacherSyncRef.current) {
          setActiveIndex(index);
          initialTeacherSyncRef.current = true;
        }
      } else if (!initialTeacherSyncRef.current) {
        initialTeacherSyncRef.current = true;
      }
      setLoadingSession(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '课堂同步失败');
      setLoadingSession(false);
    }
  }, [isDemo, sessionId]);

  const syncStates = useCallback(async () => {
    if (isDemo) return;
    try {
      const response = await fetch(`/api/session/${sessionId}/state?scope=student-view`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { states?: SessionStateRecord[] };
      setStateRecords(data.states ?? []);
    } catch {
      // ignore
    }
  }, [isDemo, sessionId]);

  useEffect(() => {
    if (isDemo) {
      setLoadingSession(false);
      const demoIndex = demoStepId ? L2C_LESSON_STEPS.findIndex((item) => item.id === demoStepId) : -1;
      const nextIndex = demoIndex >= 0 ? demoIndex : 0;
      setActiveIndex(nextIndex);
      setTeacherIndex(nextIndex);
      initialTeacherSyncRef.current = true;
      return;
    }
    void syncSession();
    void syncStates();
  }, [demoStepId, isDemo, syncSession, syncStates]);

  useEffect(() => {
    if (isDemo) return;
    const timer = window.setInterval(() => {
      void syncSession();
      void syncStates();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isDemo, syncSession, syncStates]);

  useEffect(() => {
    setCourseState((prev) => ({
      ...prev,
      studentName: currentStudentName,
    }));
  }, [currentStudentName]);

  const selfState = useMemo(() => {
    if (!currentUserId) {
      return null;
    }
    const record = stateRecords.find((item) => item.user?.id === currentUserId && item.itemId === 'student:l2c:state');
    return record && isL2CStudentState(record.data) ? record.data : null;
  }, [currentUserId, stateRecords]);

  const teacherSyncRecord = useMemo(() => {
    for (const record of stateRecords) {
      if (record.itemId !== 'teacher:course-sync') {
        continue;
      }
      const payload = record.data as Partial<TeacherCourseSyncState> | null;
      if (payload?.kind === 'teacher_sync_l2c') {
        return payload as TeacherCourseSyncState;
      }
    }
    return null;
  }, [stateRecords]);

  useEffect(() => {
    if (selfState) {
      initialPresenceSyncedRef.current = true;
      setCourseState(selfState);
    }
  }, [selfState]);

  const persistState = useCallback(
    async (nextState: L2CStudentCourseState) => {
      if (isDemo) {
        return;
      }
      await fetch(`/api/session/${sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'student:l2c:state',
          data: {
            ...nextState,
            updatedAt: Date.now(),
          },
        }),
      });
    },
    [isDemo, sessionId],
  );

  const saveCourseState = useCallback(
    async (updater: (prev: L2CStudentCourseState) => L2CStudentCourseState) => {
      setCourseState((prev) => {
        const nextState = updater(prev);
        void persistState(nextState);
        return nextState;
      });
    },
    [persistState],
  );

  useEffect(() => {
    if (isDemo || loadingSession || !currentUserId || selfState || initialPresenceSyncedRef.current) {
      return;
    }

    initialPresenceSyncedRef.current = true;
    void persistState(createEmptyL2CStudentState(currentStudentName));
    void syncStates();
  }, [currentStudentName, currentUserId, isDemo, loadingSession, persistState, selfState, syncStates]);

  const step = L2C_LESSON_STEPS[activeIndex];
  const isOutOfSync = !isDemo && teacherIndex !== activeIndex;
  const savedResponse = courseState.responses[step.id];
  const answerVisible = teacherSyncRecord?.activeStepId === step.id ? Boolean(teacherSyncRecord.revealedAnswers?.[step.id]) : false;

  const handleSubmitResponse = (response: L2CStepResponse) => {
    void saveCourseState((prev) => ({
      ...prev,
      studentName: currentStudentName,
      updatedAt: Date.now(),
      responses: {
        ...prev.responses,
        [step.id]: response,
      },
    }));
  };

  if (loadingSession) {
    return (
      <div className="premium-lesson-shell flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isDemo && sessionInfo?.status === 'FINISHED') {
    return (
      <div className="premium-lesson-shell flex items-center justify-center px-3">
        <div className="premium-lesson-panel max-w-xl text-center">
          <p className="premium-lesson-title text-lg font-semibold">课堂已结束</p>
          <p className="premium-lesson-muted mt-2">教师已结束课堂，本页面保留你的学习记录。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-lesson-shell">
      <L2CCourseHeader
        steps={L2C_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={setActiveIndex}
        middleNotice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={L2C_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-6">
        {isOutOfSync ? (
          <div className="premium-lesson-tone-block premium-tone-amber mb-4 flex flex-wrap items-center justify-between gap-3">
            <span>当前页面与教师不同步，点击可跳转到教师所在环节。</span>
            <button type="button" onClick={() => setActiveIndex(teacherIndex)} className="premium-lesson-action-tone premium-tone-amber">
              跳到教师当前页
            </button>
          </div>
        ) : null}

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        {step.id === 'step-01' ? <L2CKnowledgeMapVisual /> : null}

        <L2CStepContentPanel
          content={step.student}
          mediaSrc={getL2CMediaSrc(step.mediaKey)}
          mediaAlt={step.title}
        />

        {step.aiPrompts?.length ? <div className="mt-4"><L2CStepAiAssistant step={step} /></div> : null}

        <div className="mt-4">
          <L2CStudentActivityForm
            step={step}
            savedResponse={savedResponse}
            courseState={courseState}
            answerVisible={answerVisible}
            onSubmit={handleSubmitResponse}
          />
        </div>

        {step.pageType === 'summary' ? (
          <div className="mt-4">
            <L2CStudentSummaryPanel courseState={courseState} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
