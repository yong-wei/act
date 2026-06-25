'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  ClipboardList,
  Layers3,
  Loader2,
  LogIn,
  Presentation,
  Route,
  Sparkles,
  Users,
} from 'lucide-react';

import {
  AppShell,
  PlatformSurface,
} from '@/components/platform/app-shell';
import { LessonEntryMediaHub } from '@/features/interactive/shared/lesson-entry-media-hub';
import { LessonEntryRuntimeSections } from '@/features/interactive/shared/lesson-entry-runtime-sections';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';

type NormalizedRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | null;
type RuntimeManifestSteps = NonNullable<RuntimeLessonEntryBundle['interactiveManifest']>['steps'];

export interface CourseEntryShellConfig {
  title: string;
  description?: string;
  presetKey: string;
  routeSegment: string;
  overviewKicker?: string;
  overviewNote?: ReactNode;
  overviewTags?: string[];
  estimatedDuration?: string;
  teacherDescription?: string;
  demoDescription?: string;
  mediaCourseLabel?: string;
  showMediaHub?: boolean;
  showRuntimeSections?: boolean;
}

interface JoinSessionResponse {
  id: string;
  studentHref?: string;
  existingSessionId?: string;
  requiresExplicitChoice?: boolean;
  error?: string;
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
  return runtime.graphOverlay.nodes
    .map((node) => node.name)
    .filter(Boolean)
    .slice(0, 6);
}

function buildBopppsRows(steps: RuntimeManifestSteps) {
  const total = steps.length;
  const participateCount = Math.max(total - 5, 0);
  return [
    { phase: 'B', title: 'Bridge-in 引入', summary: steps[0]?.title ?? '建立情境与核心问题', modules: steps[0]?.modules.length ?? 0 },
    { phase: 'O', title: 'Objectives 目标', summary: steps[1]?.title ?? '明确学习目标与边界', modules: steps[1]?.modules.length ?? 0 },
    { phase: 'P', title: 'Pre-assessment 前测', summary: steps[2]?.title ?? '检验先验认知', modules: steps[2]?.modules.length ?? 0 },
    {
      phase: 'P',
      title: 'Participate 参与学习',
      summary: participateCount > 0 ? `${participateCount} 页互动内容` : '课堂互动与讲解活动',
      modules: steps.slice(3, Math.max(total - 2, 3)).reduce((sum, step) => sum + step.modules.length, 0),
    },
    {
      phase: 'P',
      title: 'Post-assessment 后测',
      summary: steps.at(-2)?.title ?? '巩固与检验学习效果',
      modules: steps.at(-2)?.modules.length ?? 0,
    },
    { phase: 'S', title: 'Summary 总结', summary: steps.at(-1)?.title ?? '结构化回顾', modules: steps.at(-1)?.modules.length ?? 0 },
  ];
}

export function CourseEntryShell({
  initialRole,
  lessonRuntime,
  config,
}: {
  initialRole?: string | null;
  lessonRuntime?: RuntimeLessonEntryBundle;
  config: CourseEntryShellConfig;
}) {
  const { data: authSession } = useSession();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeHref = `/interactive-learning/courses/${config.routeSegment}`;
  const userRole = useMemo(
    () => normalizeRole(authSession?.user?.role ?? initialRole),
    [authSession?.user?.role, initialRole],
  );
  const canCreateAsTeacher = userRole === 'TEACHER' || userRole === 'ADMIN';
  const canJoinAsStudent = userRole === 'STUDENT';
  const shellRole = userRole === 'TEACHER' ? 'teacher' : userRole === 'ADMIN' ? 'admin' : 'student';
  const roleResolved = Boolean(userRole);
  const showTeacherSection = canCreateAsTeacher;
  const showTeacherSignInSection = !roleResolved;
  const showStudentSection = roleResolved ? canJoinAsStudent : true;
  const overviewTags = config.overviewTags?.length ? config.overviewTags : getRuntimeTagFallback(lessonRuntime);
  const showMediaHub = config.showMediaHub !== false && Boolean(lessonRuntime);
  const showRuntimeSections = config.showRuntimeSections !== false && Boolean(lessonRuntime);
  const manifestSteps = lessonRuntime?.interactiveManifest?.steps ?? [];
  const manifestModuleCount = manifestSteps.reduce((sum, step) => sum + step.modules.length, 0);
  const routeSteps = manifestSteps.slice(0, 3);
  const bopppsRows = buildBopppsRows(manifestSteps);

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
        body: JSON.stringify({
          planId: cloneData.lessonPlanId,
          launchContext: 'temporary',
          sourcePresetKey: config.presetKey,
        }),
      });
      let createData = (await createRes.json()) as JoinSessionResponse;
      let createOk = createRes.ok;
      if (createRes.status === 409 && createData.existingSessionId && createData.requiresExplicitChoice) {
        const createNew = window.confirm(`${createData.error ?? '该互动课已有进行中的临时课堂。'}\n\n确定新开课堂？取消则进入已有课堂。`);
        if (!createNew) {
          router.push(`/interactive-learning/courses/${config.routeSegment}/teacher/${createData.existingSessionId}/waiting`);
          return;
        }
        const retryRes = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: cloneData.lessonPlanId,
            launchContext: 'temporary',
            sourcePresetKey: config.presetKey,
            duplicateAction: 'new-session',
          }),
        });
        createData = (await retryRes.json()) as JoinSessionResponse;
        createOk = retryRes.ok;
        if (!retryRes.ok || !createData.id) {
          throw new Error(createData.error || '课堂创建失败');
        }
      }
      if (!createOk || !createData.id) {
        throw new Error(createData.error || '课堂创建失败');
      }

      router.push(`/interactive-learning/courses/${config.routeSegment}/teacher/${createData.id}/waiting`);
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
    <AppShell
      viewerRole={shellRole}
      title={config.title}
      subtitle={config.description}
      breadcrumbs={[
        { label: '首页', href: '/dashboard' },
        { label: '互动学习', href: '/interactive-learning' },
        { label: '互动课程', href: '/interactive-learning/courses' },
        { label: config.title },
      ]}
      actions={(
        <Link
          href="/interactive-learning/courses"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-platform-border bg-platform-surface px-3 text-sm font-medium text-platform-fg-secondary transition hover:border-platform-border-strong hover:text-platform-action-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          课程总览
        </Link>
      )}
      activeHref={activeHref}
      sidebarMode="collapsible"
      className="surface-page"
    >
      <div
        className="space-y-5"
        data-course-entry-shell="app-shell"
        data-commercial-workspace="interactive-learning"
        data-commercial-student-entry-route={activeHref}
        data-commercial-entry-intent="learn"
        data-task-workspace-archetype="lesson-entry"
        data-launch-provenance="course-launched"
        data-return-target="/interactive-learning/courses"
      >
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <PlatformSurface variant="raised" className="min-w-0 p-5 sm:p-6" data-course-entry-region="identity">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-platform-fg-muted">
              {config.overviewKicker ?? config.mediaCourseLabel ?? lessonRuntime?.lesson.lesson_id ?? '课程入口'}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-platform-fg-primary sm:text-3xl">
              {config.title}
            </h2>
            {config.description ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-platform-fg-secondary sm:text-base">
                {config.description}
              </p>
            ) : null}
            {config.overviewNote ? (
              <div className="mt-3 max-w-3xl text-sm leading-6 text-platform-fg-secondary">
                {config.overviewNote}
              </div>
            ) : null}
            {overviewTags.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                {overviewTags.map((item) => (
                  <span
                    key={item}
                    className="rounded-md border border-platform-border bg-platform-canvas-muted px-2.5 py-1 font-medium text-platform-fg-secondary"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-6 grid gap-3 sm:grid-cols-3" data-course-entry-region="course-stats">
              {[
                { icon: Clock3, label: '预计时长', value: config.estimatedDuration ?? (manifestSteps.length ? `${manifestSteps.length * 5} 分钟` : '90 分钟') },
                { icon: ClipboardList, label: '互动内容', value: manifestSteps.length ? `${manifestSteps.length} 页` : '课程内容加载中' },
                { icon: Layers3, label: '互动模块', value: manifestModuleCount ? `${manifestModuleCount} 个` : '课程内容加载中' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-md border border-platform-border bg-platform-surface px-3 py-3">
                    <div className="flex items-center gap-2 text-xs text-platform-fg-muted">
                      <Icon className="h-4 w-4 text-platform-action-primary" />
                      {item.label}
                    </div>
                    <div className="mt-2 text-base font-semibold text-platform-fg-primary">{item.value}</div>
                  </div>
                );
              })}
            </div>
          </PlatformSurface>

          <PlatformSurface variant="default" className="p-5" data-course-entry-region="path-context">
            <div className="flex items-center gap-2 text-sm font-semibold text-platform-fg-primary">
              <Route className="h-4 w-4 text-platform-action-primary" />
              进入路径
            </div>
            <div className="mt-4 grid gap-3 text-sm text-platform-fg-secondary">
              <div className="rounded-md border border-platform-border bg-platform-canvas-muted p-3">
                教师创建课堂后先进入课堂等待页，确认扫码加入情况后再开始投影。
              </div>
              <div className="rounded-md border border-platform-border bg-platform-canvas-muted p-3">
                学生使用课堂码加入，访客只进入演示浏览。
              </div>
              <div className="rounded-md border border-platform-border bg-platform-canvas-muted p-3">
                自学资料和知识路径在进入课堂前可先浏览。
              </div>
            </div>
          </PlatformSurface>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)]">
          <PlatformSurface variant="default" className="p-5" data-course-entry-region="unit-route">
            <div className="text-sm font-semibold text-platform-fg-primary">单元路线</div>
            <div className="mt-4 grid gap-3">
              {(routeSteps.length ? routeSteps : [
                { id: 'current', title: config.title, modules: [] },
              ]).map((step, index) => (
                <div key={step.id} className="flex items-start gap-3 rounded-md border border-platform-border bg-platform-canvas-muted p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-platform-action-subtle text-xs font-semibold text-platform-action-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-platform-fg-primary">{step.title}</div>
                    <div className="mt-1 text-xs text-platform-fg-muted">
                      {index === 0 ? '当前入口' : '后续课堂活动'} · {step.modules.length} 个模块
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PlatformSurface>

          <PlatformSurface variant="default" className="p-5" data-course-entry-region="boppps-path">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-platform-fg-primary">BOPPPS 学习路径</div>
              <div className="text-xs text-platform-fg-muted">互动模块 / 阶段</div>
            </div>
            <div className="mt-4 grid gap-2">
              {bopppsRows.map((row) => (
                <div key={`${row.phase}-${row.title}`} className="grid gap-3 rounded-md border border-platform-border bg-platform-surface px-3 py-3 sm:grid-cols-[120px_minmax(0,1fr)_88px]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-platform-fg-primary">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-platform-action-subtle text-xs text-platform-action-primary">
                      {row.phase}
                    </span>
                    {row.title}
                  </div>
                  <div className="min-w-0 text-sm text-platform-fg-secondary">{row.summary}</div>
                  <div className="text-sm font-semibold text-platform-fg-primary sm:text-right">{row.modules} 个</div>
                </div>
              ))}
            </div>
          </PlatformSurface>
        </section>

        <section className="grid gap-4 lg:grid-cols-3" data-commercial-workspace-zone="command-bar">
          {showTeacherSection ? (
            <PlatformSurface variant="default" className="p-5" data-course-entry-role-panel="teacher">
              <div className="flex items-center gap-2 text-sm font-semibold text-platform-fg-primary">
                <Presentation className="h-4 w-4 text-platform-action-primary" />
                教师入口
              </div>
              <h3 className="mt-3 text-lg font-semibold text-platform-fg-primary">创建课堂并进入等待页</h3>
              <p className="mt-2 text-sm leading-6 text-platform-fg-secondary">
                {config.teacherDescription ?? '自动克隆预置教案，生成课堂码，等待学生加入后再开始上课。'}
              </p>
              <button
                type="button"
                onClick={() => void createClassroom()}
                disabled={isCreating}
                className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-platform-action-primary px-4 text-sm font-semibold text-platform-fg-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                data-course-entry-action="teacher-launch"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
                创建课堂
              </button>
            </PlatformSurface>
          ) : null}

          {showTeacherSignInSection ? (
            <PlatformSurface variant="default" className="p-5" data-course-entry-role-panel="teacher-sign-in">
              <div className="flex items-center gap-2 text-sm font-semibold text-platform-fg-primary">
                <Presentation className="h-4 w-4 text-platform-action-primary" />
                教师入口
              </div>
              <h3 className="mt-3 text-lg font-semibold text-platform-fg-primary">教师登录后开课</h3>
              <p className="mt-2 text-sm leading-6 text-platform-fg-secondary">
                登录教师账号后返回本课程入口，再创建课堂与生成课堂码。
              </p>
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(activeHref)}`}
                className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-platform-border bg-platform-surface px-4 text-sm font-semibold text-platform-fg-primary transition hover:border-platform-border-strong hover:text-platform-action-primary"
                data-course-entry-action="teacher-sign-in"
              >
                <LogIn className="h-4 w-4" />
                登录后开课
              </Link>
            </PlatformSurface>
          ) : null}

          {showStudentSection ? (
            <PlatformSurface variant="default" className="p-5" data-course-entry-role-panel="student">
              <div className="flex items-center gap-2 text-sm font-semibold text-platform-fg-primary">
                <Users className="h-4 w-4 text-platform-action-primary" />
                学生入口
              </div>
              <h3 className="mt-3 text-lg font-semibold text-platform-fg-primary">输入课堂码加入课堂</h3>
              <label className="mt-4 block text-xs font-medium text-platform-fg-muted">
                课堂码
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="输入 6 位课堂码"
                  className="mt-2 h-11 w-full rounded-md border border-platform-border bg-platform-surface px-3 text-base tracking-[0.24em] text-platform-fg-primary outline-none transition placeholder:text-platform-fg-muted focus:border-platform-action-primary"
                  data-course-entry-action="join-code"
                />
              </label>
              <button
                type="button"
                onClick={() => void joinClassroom()}
                disabled={isJoining}
                className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-platform-border bg-platform-surface px-4 text-sm font-semibold text-platform-fg-primary transition hover:border-platform-border-strong hover:text-platform-action-primary disabled:cursor-not-allowed disabled:opacity-60"
                data-course-entry-action="join-launch"
              >
                {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                加入课堂
              </button>
            </PlatformSurface>
          ) : null}

          <PlatformSurface variant="default" className="p-5" data-course-entry-role-panel="guest-demo">
            <div className="flex items-center gap-2 text-sm font-semibold text-platform-fg-primary">
              <Sparkles className="h-4 w-4 text-platform-action-primary" />
              访客演示
            </div>
            <h3 className="mt-3 text-lg font-semibold text-platform-fg-primary">自由浏览课程流程</h3>
            <p className="mt-2 text-sm leading-6 text-platform-fg-secondary">
              {config.demoDescription ?? '以演示模式进入学生端，预览课堂环节与导学资料。'}
            </p>
            <Link
              href={`/interactive-learning/courses/${config.routeSegment}/student/demo`}
              className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-platform-border bg-platform-surface px-4 text-sm font-semibold text-platform-fg-primary transition hover:border-platform-border-strong hover:text-platform-action-primary"
              data-course-entry-action="demo-launch"
            >
              <BookOpen className="h-4 w-4" />
              进入演示模式
            </Link>
          </PlatformSurface>
        </section>

        {error ? (
          <div className="rounded-md border border-platform-evidence-unsupported bg-platform-evidence-unsupported/10 px-4 py-3 text-sm text-platform-fg-primary">
            {error}
          </div>
        ) : null}

        {showMediaHub && lessonRuntime ? (
          <section data-commercial-workspace-zone="support-drawer" data-course-entry-region="self-study">
            <LessonEntryMediaHub
              lessonRuntime={lessonRuntime}
              courseLabel={config.mediaCourseLabel ?? lessonRuntime.lesson.lesson_id}
            />
          </section>
        ) : null}
        {showRuntimeSections && lessonRuntime ? (
          <section data-course-entry-region="knowledge-path">
            <LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
