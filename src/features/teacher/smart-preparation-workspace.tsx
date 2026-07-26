'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, ClipboardList } from 'lucide-react';

import { CourseBasisWorkspace } from './course-basis-workspace';
import { restorePreparationEditorReturnState } from './preparation-document-editor/return-state';
import { SmartLessonPlanWorkspace } from './smart-lesson-plan-workspace';

export function SmartPreparationWorkspace({
  courseBases,
  classDiagnosisOptions,
  initialTasks,
  initialSelectedTaskId,
  initialView = 'tasks',
  initialCourseBasisId,
  initialCourseBasisOffset,
  initialHasMoreCourseBases,
}: {
  courseBases: any[];
  classDiagnosisOptions: Array<{ classId: string; className: string; diagnosisRef: string; generatedAt: string }>;
  initialTasks: Record<string, unknown>[];
  initialSelectedTaskId?: string;
  initialView?: 'tasks' | 'basis';
  initialCourseBasisId?: string;
  initialCourseBasisOffset?: number;
  initialHasMoreCourseBases?: boolean;
}) {
  const [view, setView] = useState<'tasks' | 'basis'>(initialView);
  const scrollPositions = useRef({ tasks: 0, basis: 0 });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: scrollPositions.current[view] }));
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

  useEffect(() => {
    restorePreparationEditorReturnState();
  }, []);

  function changeView(next: 'tasks' | 'basis') {
    scrollPositions.current[view] = window.scrollY;
    setView(next);
  }

  return <main className="space-y-5">
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">智能备课工作台</p>
        <h1 className="mt-1 text-2xl font-semibold">从课程依据到可发布课件</h1>
        <p className="mt-1 text-sm text-muted-foreground">以任务为单位管理备课进度，所有阶段状态均来自已保存的数据。</p>
      </div>
      <nav className="inline-flex rounded-xl bg-muted p-1" aria-label="智能备课一级视图">
        <button type="button" onClick={() => changeView('tasks')} aria-current={view === 'tasks' ? 'page' : undefined} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${view === 'tasks' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'}`}><ClipboardList className="h-4 w-4" />备课任务</button>
        <button type="button" onClick={() => changeView('basis')} aria-current={view === 'basis' ? 'page' : undefined} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${view === 'basis' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground'}`}><BookOpen className="h-4 w-4" />课程依据</button>
      </nav>
    </header>
    <div className={view === 'basis' ? '' : 'hidden'}>
      <CourseBasisWorkspace
        initialCourseBases={courseBases}
        initialSelectedId={initialCourseBasisId}
        initialBaseOffset={initialCourseBasisOffset}
        initialHasMoreBases={initialHasMoreCourseBases}
        onChanged={() => window.dispatchEvent(new Event('course-basis:changed'))}
      />
    </div>
    <div className={view === 'tasks' ? '' : 'hidden'}>
      <SmartLessonPlanWorkspace courseBases={courseBases} classDiagnosisOptions={classDiagnosisOptions} initialTasks={initialTasks} initialSelectedTaskId={initialSelectedTaskId} />
    </div>
  </main>;
}
