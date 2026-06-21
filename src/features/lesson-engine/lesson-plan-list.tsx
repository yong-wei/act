
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Clock, MoreVertical, Play, Edit, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EMPTY_LESSON_PLAN_MESSAGE } from '@/lib/lesson-plan-readiness';

interface LessonPlanListProps {
  plans: any[];
  basePath?: string; // 默认 /admin/lesson-plans
  currentUserId?: string;
  returnTo?: string;
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

export function LessonPlanList({ plans, basePath = '/admin/lesson-plans', currentUserId, returnTo }: LessonPlanListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [visiblePlans, setVisiblePlans] = useState(plans);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setVisiblePlans(plans);
  }, [plans]);

  const startSession = async (planId: string) => {
    setLoadingId(planId);
    try {
      // Create a new session
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start session');
      }

      const session = await res.json();
      // Redirect to Teacher Player
      router.push(`/classroom/teacher/${session.id}`);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : '无法开始上课');
      setLoadingId(null);
    }
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
      setVisiblePlans((prev) => prev.filter((plan) => plan.id !== pendingDelete.id));
      setPendingDelete(null);
      setMenuOpenId(null);
      router.refresh();
      alert('教案已删除');
    } catch (error) {
      console.error(error);
      alert(`删除失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {visiblePlans.map((plan) => {
        const isPreset = Boolean(plan.isPreset);
        const canEdit = !isPreset && (!currentUserId || plan.authorId === currentUserId);
        const editHref = `${basePath}/${plan.id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
        const itemCount = Number(plan._count?.items ?? 0);
        const canStart = itemCount > 0;
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
                    onClick={() => canStart ? startSession(plan.id) : alert(EMPTY_LESSON_PLAN_MESSAGE)}
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
      {visiblePlans.length === 0 && plans.length > 0 && (
        <div className="col-span-full rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center text-slate-500">
          当前没有可显示的教案。
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
    </div>
  );
}
