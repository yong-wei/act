'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2, LogIn, Presentation, Users } from 'lucide-react';

import {
  L2A_COURSE_DESCRIPTION,
  L2A_COURSE_TITLE,
  L2A_PRESET_KEY,
  L2A_ROUTE_SEGMENT,
} from '@/lib/l2a-course';

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

export function L2ACourseEntryPage({ initialRole }: { initialRole?: string | null }) {
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

  const showTeacherSection = roleResolved ? canCreateAsTeacher : true;
  const showStudentSection = roleResolved ? canJoinAsStudent : true;

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
        body: JSON.stringify({ presetKey: L2A_PRESET_KEY }),
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

      router.push(`/interactive-learning/courses/${L2A_ROUTE_SEGMENT}/teacher/${createData.id}`);
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#164e6330,transparent_35%),radial-gradient(circle_at_top_right,#082f4928,transparent_35%),#020617] text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-4">
          <Link
            href="/interactive-learning/courses"
            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200 hover:border-cyan-300/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回课程总览
          </Link>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-300/80">Premium Classroom</div>
            <h1 className="text-lg font-semibold text-white md:text-xl">{L2A_COURSE_TITLE}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-6 py-10">
        <section className="rounded-[32px] border border-white/12 bg-slate-900/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-200">L-2a · Time Domain Intuition</div>
            <h2 className="mt-2 text-4xl font-semibold text-white">双端同步 + 按需互动工作区的时域精品课堂</h2>
            <p className="mt-4 text-lg leading-8 text-slate-200">{L2A_COURSE_DESCRIPTION}</p>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {showTeacherSection ? (
            <section className="rounded-[28px] border border-white/12 bg-slate-900/70 p-5">
              <div className="mb-3 inline-flex items-center gap-2 text-sm text-cyan-100">
                <Presentation className="h-4 w-4" />
                教师入口
              </div>
              <h3 className="text-xl font-semibold text-white">创建课堂并进入教师端</h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                自动克隆 L-2a 预置教案，生成课堂码后进入教师端同步流程页。
              </p>
              <button
                type="button"
                onClick={() => void createClassroom()}
                disabled={isCreating}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-300 px-4 py-2.5 text-sm font-medium text-slate-950 disabled:opacity-60"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                开始上课（教师）
              </button>
            </section>
          ) : (
            <section className="rounded-[28px] border border-white/12 bg-slate-900/55 p-5 text-sm text-slate-400">
              当前账号为学生角色，教师创建入口已隐藏。
            </section>
          )}

          {showStudentSection ? (
            <section className="rounded-[28px] border border-white/12 bg-slate-900/70 p-5">
              <div className="mb-3 inline-flex items-center gap-2 text-sm text-cyan-100">
                <Users className="h-4 w-4" />
                学生入口
              </div>
              <h3 className="text-xl font-semibold text-white">输入课堂码加入课堂</h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">教师控制环节节奏，你保留自己的工作区与学习记录。</p>
              <label className="mt-4 block text-xs text-slate-300">
                课堂码
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="输入 6 位课堂码"
                  className="mt-2 w-full rounded-2xl border border-white/12 bg-slate-950 px-4 py-3 text-base tracking-[0.24em] text-white outline-none focus:border-cyan-300/60"
                />
              </label>
              <button
                type="button"
                onClick={() => void joinClassroom()}
                disabled={isJoining}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-300/50 px-4 py-2.5 text-sm text-cyan-100 disabled:opacity-60"
              >
                {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                加入课堂
              </button>
            </section>
          ) : (
            <section className="rounded-[28px] border border-white/12 bg-slate-900/55 p-5 text-sm text-slate-400">
              当前账号为教师角色，学生加入入口已隐藏。
            </section>
          )}

          <section className="rounded-[28px] border border-white/12 bg-slate-900/70 p-5">
            <h3 className="text-xl font-semibold text-white">自由浏览</h3>
            <p className="mt-2 text-sm leading-7 text-slate-300">以演示模式进入学生端，不受课堂码约束，自行浏览 18 个环节。</p>
            <Link
              href={`/interactive-learning/courses/${L2A_ROUTE_SEGMENT}/student/demo`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-white/20 px-4 py-2.5 text-sm text-slate-200 hover:border-cyan-300/50"
            >
              进入演示模式
            </Link>
          </section>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        ) : null}
      </main>
    </div>
  );
}
