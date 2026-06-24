'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2, LogIn, Presentation, Users } from 'lucide-react';

import { LessonEntryMediaHub } from '@/features/interactive/shared/lesson-entry-media-hub';
import { LessonEntryRuntimeSections } from '@/features/interactive/shared/lesson-entry-runtime-sections';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';

type NormalizedRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | null;

export interface PremiumLessonEntryPageConfig {
  title: string;
  description?: string;
  presetKey: string;
  routeSegment: string;
  overviewKicker?: string;
  overviewNote?: ReactNode;
  overviewTags?: string[];
  teacherDescription?: string;
  demoDescription?: string;
  mediaCourseLabel?: string;
  showMediaHub?: boolean;
  showRuntimeSections?: boolean;
}

interface JoinSessionResponse {
  id: string;
  studentHref?: string;
}

function normalizeRole(raw: string | null | undefined): NormalizedRole {
  const value = String(raw ?? '').trim().toUpperCase();
  if (value === 'STUDENT' || value === '学生') return 'STUDENT';
  if (value === 'TEACHER' || value === '教师') return 'TEACHER';
  if (value === 'ADMIN' || value === '管理员') return 'ADMIN';
  return null;
}

function getRuntimeTagFallback(runtime: RuntimeLessonEntryBundle | undefined) {
  if (!runtime) return [];
  const tags = runtime.graphOverlay.nodes
    .map((node) => node.name)
    .filter(Boolean)
    .slice(0, 6);
  return tags;
}

export function PremiumLessonEntryPage({
  initialRole,
  lessonRuntime,
  config,
}: {
  initialRole?: string | null;
  lessonRuntime?: RuntimeLessonEntryBundle;
  config: PremiumLessonEntryPageConfig;
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
  const showTeacherSection = roleResolved ? canCreateAsTeacher : true;
  const showStudentSection = roleResolved ? canJoinAsStudent : true;
  const overviewTags = config.overviewTags?.length ? config.overviewTags : getRuntimeTagFallback(lessonRuntime);
  const showMediaHub = config.showMediaHub !== false && Boolean(lessonRuntime);
  const showRuntimeSections = config.showRuntimeSections !== false && Boolean(lessonRuntime);

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
        body: JSON.stringify({ presetKey: config.presetKey }),
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

      router.push(`/interactive-learning/courses/${config.routeSegment}/teacher/${createData.id}`);
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
    <div
      className="premium-lesson-shell"
      data-commercial-workspace="interactive-learning"
      data-commercial-student-entry-route={`/interactive-learning/courses/${config.routeSegment}`}
      data-commercial-entry-intent="learn"
      data-task-workspace-archetype="lesson-runtime"
      data-launch-provenance="course-launched"
      data-return-target="/interactive-learning/courses"
    >
      <header className="premium-lesson-topbar" data-commercial-workspace-zone="context-strip">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/interactive-learning/courses"
            className="premium-lesson-nav-button inline-flex items-center gap-1 px-3 py-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回课程总览
          </Link>
          <div className="text-right">
            <div className="premium-lesson-kicker text-[10px] tracking-[0.24em]">Premium Classroom</div>
            <h1 className="premium-lesson-title text-base font-semibold sm:text-lg">{config.title}</h1>
          </div>
        </div>
      </header>

      <main className="premium-lesson-main py-4 sm:py-8">
        <div className="mt-4 grid gap-4 md:grid-cols-3" data-commercial-workspace-zone="command-bar">
          {showTeacherSection ? (
            <section className="premium-lesson-panel p-5">
              <div className="premium-lesson-title mb-3 inline-flex items-center gap-2 text-sm">
                <Presentation className="h-4 w-4" />
                教师入口
              </div>
              <h3 className="premium-lesson-title text-xl font-semibold">创建课堂并进入教师端</h3>
              <p className="premium-lesson-muted mt-2">
                {config.teacherDescription ?? '自动克隆预置教案，生成课堂码并进入精品课堂。'}
              </p>
              <button
                type="button"
                onClick={() => void createClassroom()}
                disabled={isCreating}
                className="premium-lesson-action-primary mt-5 flex w-full"
                data-course-entry-action="teacher-launch"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                开始上课（教师）
              </button>
            </section>
          ) : null}

          <section className="premium-lesson-panel p-5">
            <h3 className="premium-lesson-title text-xl font-semibold">自由浏览</h3>
            <p className="premium-lesson-muted mt-2">
              {config.demoDescription ?? '以演示模式进入学生端，预览课堂环节与导学资料。'}
            </p>
            <Link
              href={`/interactive-learning/courses/${config.routeSegment}/student/demo`}
              className="premium-lesson-action-secondary mt-5 flex w-full"
              data-course-entry-action="demo-launch"
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
                  data-course-entry-action="join-code"
                />
              </label>
              <button
                type="button"
                onClick={() => void joinClassroom()}
                disabled={isJoining}
                className="premium-lesson-action-secondary mt-4 flex w-full"
                data-course-entry-action="join-launch"
              >
                {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                加入课堂
              </button>
            </section>
          ) : null}
        </div>

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mt-4">{error}</div> : null}

        <section className="premium-lesson-panel mt-4 px-5 py-5" data-commercial-workspace-zone="instrument-area">
          <div className="premium-lesson-kicker">{config.overviewKicker ?? config.mediaCourseLabel ?? lessonRuntime?.lesson.lesson_id ?? 'Course Entry'}</div>
          <h2 className="premium-lesson-title mt-2 text-3xl font-semibold sm:text-4xl">{config.title}</h2>
          {config.description ? (
            <p className="premium-lesson-muted mt-3 max-w-3xl sm:text-base">{config.description}</p>
          ) : null}
          {config.overviewNote ? (
            <div className="premium-lesson-muted mt-3 max-w-3xl">{config.overviewNote}</div>
          ) : null}
          {overviewTags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {overviewTags.map((item) => (
                <span key={item} className="premium-lesson-tone-pill premium-tone-cyan">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {showMediaHub && lessonRuntime ? (
          <section data-commercial-workspace-zone="support-drawer">
            <LessonEntryMediaHub
              lessonRuntime={lessonRuntime}
              courseLabel={config.mediaCourseLabel ?? lessonRuntime.lesson.lesson_id}
            />
          </section>
        ) : null}
        {showRuntimeSections && lessonRuntime ? (
          <LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />
        ) : null}
      </main>
    </div>
  );
}
