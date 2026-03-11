'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2, LogIn, Presentation, Users } from 'lucide-react';

import {
  L2B_COURSE_DESCRIPTION,
  L2B_COURSE_TITLE,
  L2B_PRESET_KEY,
  L2B_ROUTE_SEGMENT,
} from '@/lib/l2b-course';

interface JoinSessionResponse {
  id: string;
  studentHref?: string;
}

type NormalizedRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | null;

function normalizeRole(raw: string | null | undefined): NormalizedRole {
  const value = String(raw ?? '').trim().toUpperCase();
  if (value === 'STUDENT' || value === '学生') return 'STUDENT';
  if (value === 'TEACHER' || value === '教师') return 'TEACHER';
  if (value === 'ADMIN' || value === '管理员') return 'ADMIN';
  return null;
}

export function L2BCourseEntryPage({ initialRole }: { initialRole?: string | null }) {
  const { data: authSession } = useSession();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = useMemo(
    () => normalizeRole(authSession?.user?.role ?? initialRole),
    [authSession?.user?.role, initialRole],
  );
  const canCreateAsTeacher = userRole === 'TEACHER' || userRole === 'ADMIN';
  const canJoinAsStudent = userRole === 'STUDENT';
  const roleResolved = Boolean(userRole);

  const createClassroom = async () => {
    setError(null);
    if (!canCreateAsTeacher) {
      setError('请使用教师账号登录后再创建课堂。');
      return;
    }

    setIsCreating(true);
    try {
      const cloneRes = await fetch('/api/teacher/preset-lessons/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetKey: L2B_PRESET_KEY }),
      });
      const cloneData = await cloneRes.json();
      if (!cloneRes.ok || !cloneData.lessonPlanId) {
        throw new Error(cloneData.error || '预置教案克隆失败');
      }

      const createRes = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: cloneData.lessonPlanId }),
      });
      const createData = (await createRes.json()) as JoinSessionResponse & { error?: string };
      if (!createRes.ok || !createData.id) {
        throw new Error(createData.error || '课堂创建失败');
      }

      router.push(`/interactive-learning/courses/${L2B_ROUTE_SEGMENT}/teacher/${createData.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建失败，请稍后重试');
    } finally {
      setIsCreating(false);
    }
  };

  const joinClassroom = async () => {
    setError(null);
    if (joinCode.length !== 6) {
      setError('请输入 6 位课堂码。');
      return;
    }

    setIsJoining(true);
    try {
      const response = await fetch(`/api/session/join?code=${joinCode}`);
      const data = (await response.json()) as JoinSessionResponse & { error?: string };
      if (!response.ok || !data.id || !data.studentHref) {
        throw new Error(data.error || '课堂码无效');
      }
      router.push(data.studentHref);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加入失败，请稍后重试');
    } finally {
      setIsJoining(false);
    }
  };

  const showTeacherSection = roleResolved ? canCreateAsTeacher : true;
  const showStudentSection = roleResolved ? canJoinAsStudent : true;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#0f766e20,transparent_32%),radial-gradient(circle_at_top_right,#1d4ed81c,transparent_28%),#f7fbff] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/interactive-learning/courses"
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回课程总览
          </Link>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-700/70">Premium Classroom</div>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">{L2B_COURSE_TITLE}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-8">
        <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-700">L-2b · Root-Locus Intuition</div>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">根轨迹、45°射线与双端同步课堂</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{L2B_COURSE_DESCRIPTION}</p>
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {showTeacherSection ? (
            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="mb-3 inline-flex items-center gap-2 text-sm text-cyan-700">
                <Presentation className="h-4 w-4" />
                教师入口
              </div>
              <h3 className="text-xl font-semibold text-slate-900">创建课堂并进入教师端</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">自动克隆 L-2b 预置教案，生成课堂码并进入根轨迹精品课堂。</p>
              <button
                type="button"
                onClick={() => void createClassroom()}
                disabled={isCreating}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                开始上课（教师）
              </button>
            </section>
          ) : null}

          {showStudentSection ? (
            <section className="rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="mb-3 inline-flex items-center gap-2 text-sm text-cyan-700">
                <Users className="h-4 w-4" />
                学生入口
              </div>
              <h3 className="text-xl font-semibold text-slate-900">输入课堂码加入课堂</h3>
              <label className="mt-4 block text-xs text-slate-600">
                课堂码
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="输入 6 位课堂码"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base tracking-[0.24em] text-slate-900 outline-none focus:border-cyan-400"
                />
              </label>
              <button
                type="button"
                onClick={() => void joinClassroom()}
                disabled={isJoining}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-300 px-4 py-2.5 text-sm text-cyan-800 disabled:opacity-60"
              >
                {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                加入课堂
              </button>
            </section>
          ) : null}

          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <h3 className="text-xl font-semibold text-slate-900">自由浏览</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">以演示模式进入学生端，自由浏览全部 17 个环节和根轨迹工作区。</p>
            <Link
              href={`/interactive-learning/courses/${L2B_ROUTE_SEGMENT}/student/demo`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2.5 text-sm text-slate-700"
            >
              进入演示模式
            </Link>
          </section>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
      </main>
    </div>
  );
}
