
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Clock, MoreVertical, Play, Edit, Trash2, Loader2, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { requestClassroomConflictChoice } from '@/features/classroom/classroom-lifecycle-dialog';
import { useTeacherClassroomLauncher } from '@/features/teacher/teacher-classroom-launcher';
import { AuthoringApiTaskStrip } from '@/features/teacher/resources/authoring-api-task-strip';
import { buildLessonPlanAuthoringTasks } from '@/lib/authoring-api-task-consumption';
import { EMPTY_LESSON_PLAN_MESSAGE } from '@/lib/lesson-plan-readiness';

interface LessonPlanListProps {
  plans: any[];
  basePath?: string; // 默认 /admin/lesson-plans
  currentUserId?: string;
  returnTo?: string;
  launchActor?: 'teacher' | 'admin';
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatStableDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
}

export function LessonPlanList({ plans, basePath = '/admin/lesson-plans', currentUserId, returnTo, launchActor = 'admin' }: LessonPlanListProps) {
  const router = useRouter();
  const teacherLauncher = useTeacherClassroomLauncher();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [localPlans, setLocalPlans] = useState(plans);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);

  useEffect(() => {
    setLocalPlans(plans);
  }, [plans]);

  const visiblePlans = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return localPlans;
    return localPlans.filter((plan) => [
      plan.title,
      plan.description,
      plan.author?.name,
      plan.presetKey,
    ].filter(Boolean).join(' ').toLowerCase().includes(keyword));
  }, [localPlans, searchQuery]);

  const startTemporarySession = async (planId: string) => {
    setLoadingId(planId);
    setOperationMessage(null);
    try {
      // Create a new session
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, launchContext: 'temporary' })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 409 && errorData.existingSessionId && errorData.requiresExplicitChoice) {
          setLoadingId(null);
          const choice = await requestClassroomConflictChoice({
            identity: errorData.classroomIdentity,
            message: errorData.error,
          });
          if (choice === 'reuse') {
            router.push(`/classroom/teacher/${errorData.existingSessionId}`);
            return;
          }
          if (choice === 'new-session') {
            setLoadingId(planId);
            const retry = await fetch('/api/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ planId, launchContext: 'temporary', duplicateAction: 'new-session' }),
            });
            const retryPayload = await retry.json().catch(() => ({}));
            if (!retry.ok || !retryPayload.id) {
              throw new Error(retryPayload.error || 'Failed to start session');
            }
            router.push(`/classroom/teacher/${retryPayload.id}`);
            return;
          }
          return;
        }
        throw new Error(errorData.error || 'Failed to start session');
      }

      const session = await res.json();
      // Redirect to Teacher Player
      router.push(`/classroom/teacher/${session.id}`);
    } catch (e) {
      console.error(e);
      setOperationMessage(e instanceof Error ? e.message : '无法开始上课');
      setLoadingId(null);
    }
  };

  const startSession = (planId: string, launchElement: HTMLElement) => {
    if (launchActor === 'teacher') {
      teacherLauncher.launch({
        planId,
        onSessionReady: (sessionId) => router.push(`/classroom/teacher/${sessionId}`),
      }, launchElement);
      return;
    }
    void startTemporarySession(planId);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/lesson-plans/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || res.statusText);
      }
      setLocalPlans((prev) => prev.filter((plan) => plan.id !== pendingDelete.id));
      setPendingDelete(null);
      setMenuOpenId(null);
      router.refresh();
      setOperationMessage('教案已删除。');
    } catch (error) {
      console.error(error);
      setOperationMessage(`删除失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/30 p-3">
        <label className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            aria-label="搜索教案"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索教案标题、描述或作者"
            className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-10 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
              aria-label="清除教案搜索"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
        <div className="text-sm text-slate-400" aria-live="polite">
          显示 {visiblePlans.length} / {localPlans.length} 个教案
        </div>
      </div>
      {operationMessage ? (
        <div className="rounded-lg border border-platform-action-primary bg-platform-surface px-3 py-2 text-sm text-platform-fg-primary" role="status" aria-live="polite">
          {operationMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visiblePlans.map((plan) => {
        const isPreset = Boolean(plan.isPreset);
        const canEdit = !isPreset && (!currentUserId || plan.authorId === currentUserId);
        const editHref = `${basePath}/${plan.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
        const itemCount = Number(plan._count?.items ?? 0);
        const canStart = itemCount > 0;
        const authoringTasks = buildLessonPlanAuthoringTasks({
          id: plan.id,
          itemCount,
          canEdit,
          editHref,
        });
        return (
        <div
          key={plan.id}
          className="group bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-cyan-500/50 transition-all hover:bg-slate-900 hover:shadow-xl hover:shadow-cyan-900/10 flex flex-col"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
               <BookOpen className="h-5 w-5" />
            </div>
            {canEdit && (
              <div className="relative">
                <button type="button"
                  onClick={() => setMenuOpenId(menuOpenId === plan.id ? null : plan.id)}
                  className="text-slate-500 hover:text-white p-1"
                  aria-label="更多操作"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {menuOpenId === plan.id && (
                  <div className="absolute right-0 top-8 z-10 w-32 rounded-lg border border-slate-700 bg-slate-900 shadow-lg">
                    <button type="button"
                      onClick={() => {
                        setPendingDelete(plan);
                        setMenuOpenId(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-slate-800"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除教案
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <h3 className="text-lg font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors mb-2">
            {plan.title}
          </h3>
          {isPreset && (
            <span className="inline-flex w-fit rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase text-amber-400">
              预置公开教案
            </span>
          )}
          <AuthoringApiTaskStrip surface="lesson-plan" tasks={authoringTasks} />

          <div className="flex items-center gap-4 text-xs text-slate-500 mb-6">
            <span className="flex items-center gap-1">
               <Clock className="h-3 w-3" />
               {formatStableDate(plan.updatedAt)}
            </span>
            <span>
               {plan.author.name || '未知教师'}
            </span>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800/50 flex items-center justify-between">
             <div className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">
                {itemCount} 个环节
             </div>
             {!canStart ? (
               <p className="max-w-[12rem] text-xs leading-5 text-amber-300">
                 {EMPTY_LESSON_PLAN_MESSAGE}
               </p>
             ) : null}

             <div className="flex gap-2">
                {canEdit && (
                  <button type="button"
                      onClick={() => router.push(editHref)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors"
                  >
                      <Edit className="h-3 w-3" />
                      编辑
                  </button>
                )}
                <button type="button"
                    onClick={(event) => canStart
                      ? startSession(plan.id, event.currentTarget)
                      : setOperationMessage(EMPTY_LESSON_PLAN_MESSAGE)}
                    disabled={!!loadingId || !canStart}
                    className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1.5 rounded transition-all disabled:opacity-50"
                    title={!canStart ? EMPTY_LESSON_PLAN_MESSAGE : undefined}
                >
                    {loadingId === plan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    开始上课
                </button>
             </div>
          </div>
        </div>
      )})}
      </div>

      {visiblePlans.length === 0 && localPlans.length > 0 && (
        <div className="col-span-full rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center text-slate-500">
          <p>没有匹配“{searchQuery}”的教案。</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-3 text-sm font-medium text-cyan-300 hover:text-cyan-200"
          >
            清除搜索条件
          </button>
        </div>
      )}
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setIsDeleting(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除教案</DialogTitle>
            <DialogDescription>
              确认删除“{pendingDelete?.title}”？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-row justify-end gap-3">
            <button type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
              disabled={isDeleting}
            >
              取消
            </button>
            <button type="button"
              onClick={handleDeleteConfirm}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs text-white disabled:opacity-70"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              确认删除
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {teacherLauncher.dialog}
    </div>
  );
}
