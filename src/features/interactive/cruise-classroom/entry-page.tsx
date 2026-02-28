'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeft, Loader2, LogIn, Presentation, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { CRUISE_COURSE_TITLE, CRUISE_PRESET_KEY } from '@/lib/cruise-course';

interface JoinSessionResponse {
  id: string;
}

type NormalizedRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | null;

function normalizeRole(raw: string | null | undefined): NormalizedRole {
  const value = String(raw ?? '').trim().toUpperCase();
  if (value === 'STUDENT' || value === '学生') return 'STUDENT';
  if (value === 'TEACHER' || value === '教师') return 'TEACHER';
  if (value === 'ADMIN' || value === '管理员') return 'ADMIN';
  return null;
}

export function CruiseCourseEntryPage({ initialRole }: { initialRole?: string | null }) {
  const { data: authSession } = useSession();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = useMemo(
    () => normalizeRole(authSession?.user?.role ?? initialRole),
    [authSession?.user?.role, initialRole]
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
        body: JSON.stringify({ presetKey: CRUISE_PRESET_KEY }),
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

      router.push(`/interactive-learning/courses/cruise-comfort-boppps/teacher/${createData.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '创建失败，请稍后重试');
    } finally {
      setIsCreating(false);
    }
  };

  const joinClassroom = async () => {
    setError(null);
    if (joinCode.length !== 6) {
      setError('请输入6位课堂码。');
      return;
    }
    setIsJoining(true);
    try {
      const response = await fetch(`/api/session/join?code=${joinCode}`);
      const data = (await response.json()) as JoinSessionResponse & { error?: string };
      if (!response.ok || !data.id) {
        throw new Error(data.error || '课堂码无效');
      }
      router.push(`/interactive-learning/courses/cruise-comfort-boppps/student/${data.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加入失败，请稍后重试');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <Link
            href="/interactive-learning/courses"
            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200 hover:border-cyan-300/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Link>
          <h1 className="text-lg font-semibold text-white md:text-xl">{CRUISE_COURSE_TITLE}</h1>
          <div className="w-[64px]" />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-4 px-6 py-8 md:grid-cols-3">
        {showTeacherSection ? (
          <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-5">
          <div className="mb-3 inline-flex items-center gap-2 text-sm text-cyan-100">
            <Presentation className="h-4 w-4" />
            教师入口
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">创建课堂并展示课堂码</h2>
          <p className="text-sm text-slate-300">
            从这里创建本次精品课程课堂，会自动生成课堂码，进入教师独立流程页。
          </p>
          <button
            type="button"
            onClick={() => void createClassroom()}
            disabled={isCreating}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-60"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            开始上课（教师）
          </button>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/15 bg-slate-900/50 p-5 text-sm text-slate-400">
            当前账号为学生角色，教师创建课堂入口已隐藏。
          </section>
        )}

        {showStudentSection ? (
          <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-5">
          <div className="mb-3 inline-flex items-center gap-2 text-sm text-cyan-100">
            <Users className="h-4 w-4" />
            学生入口
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">输入课堂码加入课堂</h2>
          <p className="text-sm text-slate-300">学生加入后进入学生独立流程页，仅显示学生视角内容。</p>
          <label className="mt-4 block text-xs text-slate-300">
            课堂码
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="输入6位课堂码"
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-base tracking-[0.2em] text-white outline-none focus:border-cyan-300/70"
            />
          </label>
          <button
            type="button"
            onClick={() => void joinClassroom()}
            disabled={isJoining}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/70 px-4 py-2 text-sm text-cyan-100 disabled:opacity-60"
          >
            {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            加入课堂
          </button>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/15 bg-slate-900/50 p-5 text-sm text-slate-400">
            当前账号为教师角色，学生加入课堂入口已隐藏。
          </section>
        )}

        <section className="rounded-2xl border border-white/15 bg-slate-900/70 p-5">
          <h2 className="mb-2 text-xl font-semibold text-white">自由浏览</h2>
          <p className="text-sm text-slate-300">
            未加入课堂时可进入学生演示模式，自行浏览全流程页面与仿真联动。
          </p>
          <Link
            href="/interactive-learning/courses/cruise-comfort-boppps/student/demo"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 hover:border-cyan-300/60"
          >
            进入演示模式
          </Link>
        </section>
      </main>

      {error ? (
        <div className="mx-auto max-w-[1200px] px-6 pb-8">
          <div className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
        </div>
      ) : null}
    </div>
  );
}
