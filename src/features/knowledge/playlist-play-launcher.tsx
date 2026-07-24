'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Play, ArrowLeft, Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTeacherClassroomLauncher } from '@/features/teacher/teacher-classroom-launcher';

interface PlaylistPlayLauncherProps {
  planId: string;
  title: string;
  description: string | null;
  itemCount: number;
  intent?: string | null;
  editHref?: string | null;
  canStartClass?: boolean;
  launchActor?: 'teacher' | 'admin';
}

export function PlaylistPlayLauncher({
  planId,
  title,
  description,
  itemCount,
  intent,
  editHref,
  canStartClass = false,
  launchActor = 'admin',
}: PlaylistPlayLauncherProps) {
  const router = useRouter();
  const teacherLauncher = useTeacherClassroomLauncher();
  const [status, setStatus] = useState<'idle' | 'starting' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const startTemporaryClass = async () => {
    setStatus('starting');
    setMessage(null);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.id) {
        setStatus('error');
        setMessage(payload?.error ?? '课程流启动失败');
        return;
      }
      router.push(`/classroom/teacher/${payload.id}`);
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('课程流启动失败，请检查网络后重试');
    }
  };

  const startClass = () => {
    if (launchActor === 'teacher') {
      teacherLauncher.launch({
        planId,
        onSessionReady: (sessionId) => {
          router.push(`/classroom/teacher/${sessionId}`);
          router.refresh();
        },
      });
      return;
    }
    void startTemporaryClass();
  };

  return (
    <section className="w-full text-platform-fg-primary">
      <div className="mb-6">
        <Link href="/playlists" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-blue-300">
          <ArrowLeft className="h-4 w-4" />
          返回课程流列表
        </Link>
      </div>
      <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-300">
              {intent === 'start-class' ? '准备开始课堂' : '课程流播放'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{description || '该课程流尚未填写描述。'}</p>
            <div className="mt-4 inline-flex rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
              {itemCount} 个知识节点环节
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {editHref ? (
              <Link
                href={editHref}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-blue-500 hover:text-blue-200"
              >
                <Edit className="h-4 w-4" />
                编辑编排
              </Link>
            ) : null}
            {canStartClass ? (
              <button
                type="button"
                onClick={startClass}
                disabled={status === 'starting' || itemCount === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'starting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                开始上课
              </button>
            ) : null}
          </div>
        </div>
        {!canStartClass ? (
          <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-slate-300">
            教师或管理员登录后可以启动课堂。
          </div>
        ) : null}
        {itemCount === 0 ? (
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            该课程流还没有可启动环节，请先编辑编排并加入知识节点。
          </div>
        ) : null}
        {status === 'error' && message ? (
          <div
            className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
            role="alert"
          >
            {message}
          </div>
        ) : null}
      </section>
      {teacherLauncher.dialog}
    </section>
  );
}
