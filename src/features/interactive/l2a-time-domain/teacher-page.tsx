'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users } from 'lucide-react';

import {
  getL2AStep,
  L2A_LESSON_STEPS,
  L2A_STAGE_MAP,
  type L2AStudentCourseState,
} from '@/lib/l2a-course';
import { L2ACourseHeader } from './course-header';
import { KnowledgeMapVisual as KnowledgeMapPanel, StepContentPanel, TeacherActivitySummary } from './step-panels';
import { L2AWorkspace } from './workspace';

interface TeacherSessionInfo {
  id: string;
  joinCode: string;
  status: 'ACTIVE' | 'PAUSED' | 'FINISHED';
  currentItemId: string | null;
}

interface SessionStateRecord {
  itemId: string | null;
  data: unknown;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export function L2ATeacherPage({ sessionId }: { sessionId: string }) {
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<TeacherSessionInfo | null>(null);
  const [stateRecords, setStateRecords] = useState<SessionStateRecord[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  const step = L2A_LESSON_STEPS[activeIndex];

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}`);
      const data = (await response.json()) as TeacherSessionInfo & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || '课堂不存在');
      }
      setSessionInfo(data);
      const index = data.currentItemId
        ? L2A_LESSON_STEPS.findIndex((item) => item.id === data.currentItemId)
        : -1;
      if (index >= 0) {
        setActiveIndex(index);
      }
      setLoadingSession(false);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : '课堂读取失败');
      setLoadingSession(false);
    }
  }, [sessionId]);

  const fetchStates = useCallback(async () => {
    try {
      const response = await fetch(`/api/session/${sessionId}/state`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { states?: SessionStateRecord[] };
      setStateRecords(data.states ?? []);
    } catch {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchSession();
    void fetchStates();
  }, [fetchSession, fetchStates]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchSession();
      void fetchStates();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [fetchSession, fetchStates]);

  const patchCurrentStep = useCallback(
    async (nextIndex: number) => {
      const nextStep = L2A_LESSON_STEPS[nextIndex];
      setActiveIndex(nextIndex);
      setSyncError(null);
      try {
        const response = await fetch(`/api/session/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentItemId: nextStep.id,
            currentStage: L2A_STAGE_MAP[nextStep.stage],
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || '课堂推进失败');
        }
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : '课堂推进失败');
      }
    },
    [sessionId],
  );

  const studentStates = useMemo(() => {
    return stateRecords
      .map((record) => {
        const data = record.data as Partial<L2AStudentCourseState> | null;
        if (record.itemId !== 'student:l2a:state' || data?.kind !== 'l2a_student_state') {
          return null;
        }

        return {
          studentName: data.studentName || record.user?.name?.trim() || '未命名学生',
          state: data as L2AStudentCourseState,
        };
      })
      .filter(Boolean) as Array<{ studentName: string; state: L2AStudentCourseState }>;
  }, [stateRecords]);

  const joinedStudents = useMemo(() => {
    const names = new Set(studentStates.map((item) => item.studentName));
    return Array.from(names);
  }, [studentStates]);

  const currentResponses = useMemo(() => {
    return studentStates
      .map((item) => {
        const response = item.state.responses[step.id];
        return response ? { studentName: item.studentName, response } : null;
      })
      .filter(Boolean) as Array<{ studentName: string; response: L2AStudentCourseState['responses'][string] }>;
  }, [step.id, studentStates]);

  if (loadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const stepDefinition = getL2AStep(step.id);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#164e6333,transparent_35%),radial-gradient(circle_at_top_right,#082f4922,transparent_38%),#020617] text-slate-100">
      <L2ACourseHeader steps={L2A_LESSON_STEPS} activeIndex={activeIndex} onIndexChange={(index) => void patchCurrentStep(index)} />

      <main className="mx-auto max-w-[1680px] space-y-4 px-4 py-4">
        {syncError ? (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{syncError}</div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <div className="space-y-4">
            <L2AWorkspace role="teacher" sessionId={sessionId} currentStepId={step.id} currentStepTitle={step.title} />
          </div>

          <div className="space-y-4">
            {step.id === 'knowledge-map' ? <KnowledgeMapPanel /> : null}
            <StepContentPanel
              content={stepDefinition.teacher}
              rightSlot={
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  课堂码：{sessionInfo?.joinCode ?? '------'}
                </span>
              }
            />
            <TeacherActivitySummary activity={stepDefinition.teacher.activity ?? stepDefinition.student.activity} responses={currentResponses} />
            <section className="rounded-[28px] border border-white/12 bg-slate-900/80 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
                <Users className="h-4 w-4" />
                当前在线学生
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {joinedStudents.length ? (
                  joinedStudents.map((name) => (
                    <span key={name} className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-50">
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-300">暂无学生提交本课状态。</span>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
