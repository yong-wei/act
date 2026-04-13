'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2, LogIn, Presentation, Users } from 'lucide-react';

import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  UNIT_3_4_COURSE_DESCRIPTION,
  UNIT_3_4_COURSE_TITLE,
  UNIT_3_4_LESSON_STEPS,
  UNIT_3_4_PRESET_KEY,
  UNIT_3_4_ROUTE_SEGMENT,
} from '@/lib/unit-3-4-course';
import { LessonEntryMediaHub } from '@/features/interactive/shared/lesson-entry-media-hub';
import { LessonEntryRuntimeSections } from '@/features/interactive/shared/lesson-entry-runtime-sections';

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

export function UNIT_3_4CourseEntryPage({
  initialRole,
  lessonRuntime,
}: {
  initialRole?: string | null;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
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
        body: JSON.stringify({ presetKey: UNIT_3_4_PRESET_KEY }),
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

      router.push(`/interactive-learning/courses/${UNIT_3_4_ROUTE_SEGMENT}/teacher/${createData.id}`);
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
    <div className="premium-lesson-shell">
      <header className="premium-lesson-topbar">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/interactive-learning/courses"
            className="premium-lesson-nav-button inline-flex items-center gap-1 px-3 py-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回课程总览
          </Link>
          <div className="text-right">
            <div className="premium-lesson-kicker text-[10px] tracking-[0.24em]">Premium Classroom</div>
            <h1 className="premium-lesson-title text-base font-semibold sm:text-lg">{UNIT_3_4_COURSE_TITLE}</h1>
          </div>
        </div>
      </header>

      <main className="premium-lesson-main mx-auto max-w-[1180px] px-3 py-4 sm:px-6 sm:py-8">
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {showTeacherSection ? (
            <section className="premium-lesson-panel p-5">
              <div className="premium-lesson-title mb-3 inline-flex items-center gap-2 text-sm">
                <Presentation className="h-4 w-4" />
                教师入口
              </div>
              <h3 className="premium-lesson-title text-xl font-semibold">创建课堂并进入教师端</h3>
              <p className="premium-lesson-muted mt-2">
                自动克隆 3-4 预置教案，生成课堂码并进入《根轨迹读图与对象化验证》精品课堂。
              </p>
              <button
                type="button"
                onClick={() => void createClassroom()}
                disabled={isCreating}
                className="premium-lesson-action-primary mt-5 flex w-full"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                开始上课（教师）
              </button>
            </section>
          ) : null}

          <section className="premium-lesson-panel p-5">
            <h3 className="premium-lesson-title text-xl font-semibold">自由浏览</h3>
            <p className="premium-lesson-muted mt-2">
              以演示模式进入学生端，先预览 {UNIT_3_4_LESSON_STEPS.length} 个课堂环节与导学资料。
            </p>
            <Link
              href={`/interactive-learning/courses/${UNIT_3_4_ROUTE_SEGMENT}/student/demo`}
              className="premium-lesson-action-secondary mt-5 flex w-full"
            >
              进入演示模式
            </Link>
          </section>

          {showStudentSection ? (
            <section className="premium-lesson-panel p-5">
              <div className="premium-lesson-title mb-3 inline-flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                学生入口
              </div>
              <h3 className="premium-lesson-title text-xl font-semibold">输入课堂码加入课堂</h3>
              <label className="premium-lesson-caption mt-4 block text-xs">
                课堂码
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="输入 6 位课堂码"
                  className="premium-lesson-input mt-2 text-base tracking-[0.24em]"
                />
              </label>
              <button
                type="button"
                onClick={() => void joinClassroom()}
                disabled={isJoining}
                className="premium-lesson-action-secondary mt-4 flex w-full"
              >
                {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                加入课堂
              </button>
            </section>
          ) : null}
        </div>

        <section className="premium-lesson-panel mt-4 px-5 py-5">
          <div className="premium-lesson-kicker">3-4 · Root Locus Reading Validation</div>
          <h2 className="premium-lesson-title mt-2 text-3xl font-semibold sm:text-4xl">{UNIT_3_4_COURSE_TITLE}</h2>
          <p className="premium-lesson-muted mt-3 max-w-3xl sm:text-base">{UNIT_3_4_COURSE_DESCRIPTION}</p>
          <p className="premium-lesson-muted mt-3 max-w-3xl">
            本课承接 <strong>3-3</strong> 已经建立的根轨迹法则，把“为什么会这样迁移”推进成“如何据图判断窗口、换算增益并做三域验证”，
            并为 <strong>3-5</strong> 的结构改变做铺垫。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {['关键节点读图', '稳定窗口', '可接受窗口', '增益换算', '时域回查', '频域验证'].map((item) => (
              <span key={item} className="premium-lesson-tone-pill premium-tone-cyan">
                {item}
              </span>
            ))}
          </div>
        </section>

        <LessonEntryMediaHub lessonRuntime={lessonRuntime} courseLabel="3-4 · Pre-study" />
        <LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mt-4">{error}</div> : null}
      </main>
    </div>
  );
}
