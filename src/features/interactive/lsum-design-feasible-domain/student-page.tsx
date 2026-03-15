'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

import { StepKnowledgeDrawer } from '@/features/interactive/shared/step-knowledge-drawer';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  createEmptyLSUMStudentState,
  getLSUMMediaSrc,
  LSUM_LESSON_STEPS,
  type LSUMStudentCourseState,
  type LSUMStepResponse,
  type LSUMTeacherCourseSyncState,
} from '@/lib/lsum-course';
import { LSUMCourseHeader } from './course-header';
import {
  LSUMKnowledgeMapVisual,
  LSUMStepAiAssistant,
  LSUMStepContentPanel,
  LSUMStudentActivityForm,
  LSUMStudentSummaryPanel,
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

function isLSUMStudentState(value: unknown): value is LSUMStudentCourseState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LSUMStudentCourseState>;
  return data.kind === 'lsum_student_state' && data.version === 1;
}

function isTeacherSyncState(value: unknown): value is LSUMTeacherCourseSyncState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LSUMTeacherCourseSyncState>;
  return data.kind === 'teacher_sync_lsum';
}

export function LSUMStudentPage({
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
  const [courseState, setCourseState] = useState<LSUMStudentCourseState>(() =>
    createEmptyLSUMStudentState(authSession?.user?.name?.trim() || '学生'),
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
      const index = data.currentItemId ? LSUM_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId) : -1;
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
      const demoIndex = demoStepId ? LSUM_LESSON_STEPS.findIndex((item) => item.id === demoStepId) : -1;
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
    const record = stateRecords.find((item) => item.user?.id === currentUserId && item.itemId === 'student:lsum:state');
    return record && isLSUMStudentState(record.data) ? record.data : null;
  }, [currentUserId, stateRecords]);

  const teacherSyncRecord = useMemo(() => {
    for (const record of stateRecords) {
      if (record.itemId !== 'teacher:course-sync') {
        continue;
      }
      if (isTeacherSyncState(record.data)) {
        return record.data;
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
    async (nextState: LSUMStudentCourseState) => {
      if (isDemo) {
        return;
      }
      await fetch(`/api/session/${sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: 'student:lsum:state',
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
    async (updater: (prev: LSUMStudentCourseState) => LSUMStudentCourseState) => {
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
    void persistState(createEmptyLSUMStudentState(currentStudentName));
    void syncStates();
  }, [currentStudentName, currentUserId, isDemo, loadingSession, persistState, selfState, syncStates]);

  const step = LSUM_LESSON_STEPS[activeIndex];
  const isOutOfSync = !isDemo && teacherIndex !== activeIndex;
  const savedResponse = courseState.responses[step.id];
  const answerVisible =
    teacherSyncRecord?.activeStepId === step.id ? Boolean(teacherSyncRecord.revealedAnswers?.[step.id]) : false;
  const released =
    isDemo || step.pageType !== 'quiz'
      ? true
      : teacherSyncRecord?.activeStepId === step.id
        ? Boolean(teacherSyncRecord.releasedActivities?.[step.id])
        : false;

  const handleSubmitResponse = (response: LSUMStepResponse) => {
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
      <LSUMCourseHeader
        steps={LSUM_LESSON_STEPS}
        activeIndex={activeIndex}
        onIndexChange={setActiveIndex}
        middleNotice={isOutOfSync ? `当前页面与教师不同步，教师正在第 ${teacherIndex + 1} 页` : step.hint}
        rightSlot={
          <StepKnowledgeDrawer
            lessonRuntime={lessonRuntime}
            currentStepId={step.id}
            orderedStepIds={LSUM_LESSON_STEPS.map((item) => item.id)}
            title="页面知识卡片"
          />
        }
      />

      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-6">
        {isOutOfSync ? (
          <div className="premium-lesson-tone-block premium-tone-amber mb-4 flex flex-wrap items-center justify-between gap-3">
            <span>当前页面与教师不同步，点击可跳转到教师所在环节。</span>
            <button
              type="button"
              onClick={() => setActiveIndex(teacherIndex)}
              className="premium-lesson-action-tone premium-tone-amber"
            >
              跳到教师当前页
            </button>
          </div>
        ) : null}

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mb-4">{error}</div> : null}

        <div className="premium-lesson-panel-soft mb-4 px-4 py-4">
          <div className="premium-lesson-kicker">Student Console</div>
          <div className="premium-lesson-title mt-2 text-lg font-semibold">
            {isDemo ? '演示模式已开启' : `已加入课堂 ${sessionId}`}
          </div>
          <div className="premium-lesson-muted mt-1 text-sm">
            {isDemo ? '演示模式不会写入课堂状态。' : '学生端会随课堂同步步骤，并把个人作答持久化到课堂状态。'}
          </div>
        </div>

        {step.id === 'step-01' ? <LSUMKnowledgeMapVisual /> : null}

        <LSUMStepContentPanel step={step} mediaSrc={getLSUMMediaSrc(step.id)} mediaAlt={step.title} />

        {step.pageType === 'ai' ? (
          <div className="mt-4">
            <LSUMStepAiAssistant step={step} />
          </div>
        ) : null}

        <div className="mt-4">
          <LSUMStudentActivityForm
            step={step}
            savedResponse={savedResponse}
            released={released}
            answerVisible={answerVisible}
            onSubmit={handleSubmitResponse}
          />
        </div>

        {step.pageType === 'summary' ? (
          <div className="mt-4">
            <LSUMStudentSummaryPanel responses={courseState.responses} />
          </div>
        ) : null}
      </main>
    </div>
  );
}
