'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  BookOpen,
  Download,
  ExternalLink,
  FileAudio2,
  FileText,
  Loader2,
  LogIn,
  Presentation,
  Users,
  Video,
} from 'lucide-react';

import { downloadLessonHandoutPdf } from '@/features/interactive/shared/download-handout-pdf';
import type { RuntimeLessonEntryBundle, RuntimeLessonMediaResource } from '@/lib/course-runtime';
import {
  UNIT_2_1_COURSE_DESCRIPTION,
  UNIT_2_1_COURSE_TITLE,
  UNIT_2_1_PRESET_KEY,
  UNIT_2_1_ROUTE_SEGMENT,
} from '@/lib/unit-2-1-course';
import {
  LessonEntryHandoutDialog,
  LessonEntryRuntimeSections,
} from '@/features/interactive/shared/lesson-entry-runtime-sections';

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

const RESOURCE_COPY: Record<string, {
  kicker: string;
  title: string;
  summary: string;
  tone: string;
}> = {
  '2-1-course.mp4': {
    kicker: '完整预习',
    title: '完整课程视频',
    summary: '适合在正式进入课堂前先建立全课节奏、概念线索和例题位置，作为课前主资源。',
    tone: 'premium-tone-cyan',
  },
  '2-1-intro-video.mp4': {
    kicker: '课前导入',
    title: '预习导入视频',
    summary: '先用一段短视频快速进入本课情境，抓住对象建模、结构表达和后续分析之间的关系。',
    tone: 'premium-tone-amber',
  },
  '2-1-audio.m4a': {
    kicker: '随听预习',
    title: '课程音频',
    summary: '适合通勤或碎片时间先听主线，把课程的关键词和逻辑链先过一遍。',
    tone: 'premium-tone-rose',
  },
  '2-1-slides.pdf': {
    kicker: '图文提纲',
    title: '课件讲义',
    summary: '适合先看结构图、公式与例题位置，建立本课的提纲式认知框架。',
    tone: 'premium-tone-slate',
  },
};

function getResourceIcon(resource: RuntimeLessonMediaResource) {
  if (resource.kind === 'video') return Video;
  if (resource.kind === 'audio') return FileAudio2;
  if (resource.kind === 'pdf') return FileText;
  return Video;
}

function getResourceCopy(resource: RuntimeLessonMediaResource) {
  return RESOURCE_COPY[resource.filename] ?? {
    kicker: '预习资源',
    title: resource.filename,
    summary: '本课预习资源。',
    tone: 'premium-tone-slate',
  };
}

function isDirectPlayableUrl(url: string, kind: RuntimeLessonMediaResource['kind']) {
  if (!url) return false;
  if (kind === 'video') return /\.(mp4|webm)(?:$|\?)/i.test(url);
  if (kind === 'audio') return /\.(m4a|mp3|wav)(?:$|\?)/i.test(url);
  return false;
}

function InlineMediaPreview({
  resource,
  wrapperClassName,
  innerClassName,
}: {
  resource: RuntimeLessonMediaResource | null;
  wrapperClassName: string;
  innerClassName?: string;
}) {
  const frameClassName = 'block h-full w-full border-0';
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [embedVersion, setEmbedVersion] = useState(0);
  const isDirectVideo = Boolean(resource?.kind === 'video' && resource.url && isDirectPlayableUrl(resource.url, resource.kind));
  const isDirectAudio = Boolean(resource?.kind === 'audio' && resource.url && isDirectPlayableUrl(resource.url, resource.kind));
  const needsResponsiveIframeReload = Boolean(resource?.url && !isDirectVideo && !isDirectAudio);

  useEffect(() => {
    if (!needsResponsiveIframeReload || !wrapperRef.current || typeof ResizeObserver === 'undefined') {
      return;
    }

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastWidth = 0;
    let lastHeight = 0;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (Math.abs(width - lastWidth) < 24 && Math.abs(height - lastHeight) < 24) {
        return;
      }

      lastWidth = width;
      lastHeight = height;

      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }

      resizeTimer = setTimeout(() => {
        setEmbedVersion((current) => current + 1);
      }, 120);
    });

    observer.observe(wrapperRef.current);

    return () => {
      observer.disconnect();
      if (resizeTimer) {
        clearTimeout(resizeTimer);
      }
    };
  }, [needsResponsiveIframeReload]);

  if (!resource || resource.status !== 'ready' || !resource.url) {
    return (
      <div ref={wrapperRef} className={`${wrapperClassName} overflow-hidden rounded-[24px] border border-border/60`}>
        <div className={`flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(148,163,184,0.18),rgba(15,23,42,0.08))] px-4 text-sm text-muted-foreground ${innerClassName ?? ''}`}>
          当前资源暂未就绪。
        </div>
      </div>
    );
  }

  if (resource.kind === 'video' && isDirectPlayableUrl(resource.url, resource.kind)) {
    return (
      <div ref={wrapperRef} className={`${wrapperClassName} overflow-hidden rounded-[24px] border border-border/60 bg-black`}>
        <video
          controls
          preload="metadata"
          playsInline
          src={resource.url}
          className={`${frameClassName} ${innerClassName ?? ''}`}
        />
      </div>
    );
  }

  if (resource.kind === 'audio' && isDirectPlayableUrl(resource.url, resource.kind)) {
    return (
      <div ref={wrapperRef} className={`${wrapperClassName} overflow-hidden rounded-[24px] border border-border/60 bg-[linear-gradient(135deg,rgba(244,114,182,0.14),rgba(15,23,42,0.04))] px-4 sm:px-5`}>
        <div className={`flex h-full w-full items-center justify-center ${innerClassName ?? ''}`}>
          <audio controls preload="none" src={resource.url} className="w-full max-w-full" />
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`${wrapperClassName} overflow-hidden rounded-[24px] border border-border/60 bg-black`}>
      <iframe
        key={`${resource.id}-${embedVersion}`}
        src={resource.url}
        title={resource.title}
        className={`${frameClassName} ${innerClassName ?? ''}`}
        allow="autoplay; fullscreen"
      />
    </div>
  );
}

function ResolvedAudioExperiment({
  resource,
  wrapperClassName,
}: {
  resource: RuntimeLessonMediaResource | null;
  wrapperClassName: string;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!resource || resource.kind !== 'audio' || resource.status !== 'ready' || !resource.url) {
      setResolvedUrl(null);
      setStatus('idle');
      return;
    }

    if (isDirectPlayableUrl(resource.url, resource.kind)) {
      setResolvedUrl(resource.url);
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setResolvedUrl(null);
    setStatus('loading');

    void fetch(`/api/course-runtime/audio-preview-source?previewUrl=${encodeURIComponent(resource.url)}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('resolve-audio-preview-failed');
        }
        return response.json() as Promise<{ sourceUrl?: string }>;
      })
      .then((payload) => {
        if (cancelled || !payload.sourceUrl) {
          if (!cancelled) {
            setStatus('error');
          }
          return;
        }

        setResolvedUrl(payload.sourceUrl);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resource]);

  return (
    <div className={`${wrapperClassName} rounded-[24px] border border-border/60 bg-[linear-gradient(135deg,rgba(244,114,182,0.1),rgba(15,23,42,0.05))] p-4 sm:p-5`}>
      <div className="flex h-full flex-col">
        <div>
          <div className="premium-lesson-kicker">解析实验版</div>
          <p className="premium-lesson-muted mt-2 text-sm">
            临时加入一个备用播放器，用来验证是否能以更直接的页内播放方式稳定承载音频内容。
          </p>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
          {status === 'ready' && resolvedUrl ? (
            <audio controls preload="none" src={resolvedUrl} className="w-full max-w-full" />
          ) : null}
          {status === 'loading' ? (
            <div className="premium-lesson-muted inline-flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在准备播放器
            </div>
          ) : null}
          {status === 'error' ? (
            <div className="premium-lesson-muted text-sm">
              当前实验播放器暂未取到可播放音源。
            </div>
          ) : null}
          {status === 'idle' ? (
            <div className="premium-lesson-muted text-sm">
              当前音频资源暂未就绪。
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function UNIT_2_1CourseEntryPage({
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
  const [isDownloadingHandout, setIsDownloadingHandout] = useState(false);
  const [isHandoutOpen, setIsHandoutOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userRole = useMemo(
    () => normalizeRole(authSession?.user?.role ?? initialRole),
    [authSession?.user?.role, initialRole],
  );
  const canCreateAsTeacher = userRole === 'TEACHER' || userRole === 'ADMIN';
  const canJoinAsStudent = userRole === 'STUDENT';
  const roleResolved = Boolean(userRole);
  const mediaByFilename = useMemo(
    () => new Map(lessonRuntime.mediaResources.map((resource) => [resource.filename, resource])),
    [lessonRuntime.mediaResources],
  );
  const introVideoResource = mediaByFilename.get('2-1-intro-video.mp4') ?? null;
  const courseVideoResource = mediaByFilename.get('2-1-course.mp4') ?? null;
  const audioResource = mediaByFilename.get('2-1-audio.m4a') ?? null;
  const slidesResource = mediaByFilename.get('2-1-slides.pdf') ?? null;

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
        body: JSON.stringify({ presetKey: UNIT_2_1_PRESET_KEY }),
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

      router.push(`/interactive-learning/courses/${UNIT_2_1_ROUTE_SEGMENT}/teacher/${createData.id}`);
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

  const handleHandoutDownload = async () => {
    setError(null);
    setIsDownloadingHandout(true);
    try {
      await downloadLessonHandoutPdf({
        lessonId: lessonRuntime.lesson.lesson_id,
        lessonTitle: UNIT_2_1_COURSE_TITLE,
        handoutPdfPath: lessonRuntime.handoutPdfPath,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '讲义下载失败，请稍后重试');
    } finally {
      setIsDownloadingHandout(false);
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
            <h1 className="premium-lesson-title text-base font-semibold sm:text-lg">{UNIT_2_1_COURSE_TITLE}</h1>
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
                自动克隆 2-1 预置教案，生成课堂码并进入“建模与变换语言”精品课堂。
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
              以演示模式进入学生端，先预览 16 个课堂环节与 runtime 导学内容。
            </p>
            <Link
              href={`/interactive-learning/courses/${UNIT_2_1_ROUTE_SEGMENT}/student/demo`}
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
          <div className="premium-lesson-kicker">2-1 · Modeling Language</div>
          <h2 className="premium-lesson-title mt-2 text-3xl font-semibold sm:text-4xl">{UNIT_2_1_COURSE_TITLE}</h2>
          <p className="premium-lesson-muted mt-3 max-w-3xl sm:text-base">{UNIT_2_1_COURSE_DESCRIPTION}</p>
          <p className="premium-lesson-muted mt-3 max-w-3xl">
            本课是当前正式主线的起点：先把真实对象翻译成统一分析对象，再把对象放进结构与反馈系统，最后为下一课的响应分析准备总体对象。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {['拉氏变换', '零初值传递函数', '典型环节', '结构图', '信号流图', '梅森公式'].map((item) => (
              <span key={item} className="premium-lesson-tone-pill premium-tone-cyan">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="premium-lesson-panel mt-4 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="premium-lesson-kicker">2-1 · Pre-study</div>
              <h2 className="premium-lesson-title mt-2 text-2xl font-semibold sm:text-3xl">课前预习台</h2>
              <p className="premium-lesson-muted mt-3 max-w-3xl">
                先用导入视频进入问题情境，再用完整课程视频建立全课主线；如果时间紧张，可以搭配音频、课件和讲义完成一轮轻量预习。
              </p>
            </div>
            <div className="premium-lesson-tone-block premium-tone-slate max-w-sm text-sm">
              建议顺序：先看导入视频，再看完整课程视频；通勤时可以改听音频，最后结合课件和讲义回看关键图表与公式。
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {[introVideoResource, courseVideoResource].map((resource) => {
              const copy = resource ? getResourceCopy(resource) : null;
              return (
                <section key={resource?.filename ?? copy?.title ?? 'pending-video'} className="premium-lesson-panel-soft rounded-[28px] border border-border/70 p-4 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="premium-lesson-kicker">{copy?.kicker ?? '视频预习'}</div>
                      <h3 className="premium-lesson-title mt-2 text-xl font-semibold sm:text-2xl">
                        {copy?.title ?? '预习视频待补充'}
                      </h3>
                      <p className="premium-lesson-muted mt-3 max-w-3xl text-sm sm:text-base">
                        {copy?.summary ?? '当前视频链接尚未填写。'}
                      </p>
                    </div>
                    <span className={`premium-lesson-tone-pill ${copy?.tone ?? 'premium-tone-slate'}`}>
                      {resource?.status === 'ready' ? '可播放' : '待补充'}
                    </span>
                  </div>
                  <InlineMediaPreview
                    resource={resource}
                    wrapperClassName="aspect-[16/9] min-h-[240px] w-full sm:min-h-[320px] lg:min-h-[420px]"
                  />
                </section>
              );
            })}

            <div className="grid gap-4 lg:grid-cols-3">
              {[audioResource, slidesResource].map((resource) => {
                const copy = resource ? getResourceCopy(resource) : null;
                const Icon = getResourceIcon(resource ?? { kind: 'other' } as RuntimeLessonMediaResource);
                const isAudio = resource?.kind === 'audio';
                return (
                  <section
                    key={resource?.filename ?? copy?.title ?? 'pending-card'}
                    className={`premium-lesson-panel-soft rounded-[24px] border border-border/70 p-4 ${isAudio ? 'lg:col-span-2' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex items-center gap-2">
                        <span className="premium-lesson-control inline-flex items-center justify-center">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="premium-lesson-kicker">{copy?.kicker ?? '预习资源'}</div>
                          <h3 className="premium-lesson-title mt-1 text-lg font-semibold">{copy?.title ?? '资源待补充'}</h3>
                        </div>
                      </div>
                      <span className={`premium-lesson-tone-pill ${copy?.tone ?? 'premium-tone-slate'}`}>
                        {resource?.status === 'ready' ? '可访问' : '待补充'}
                      </span>
                    </div>
                    <p className="premium-lesson-muted mt-3 text-sm">{copy?.summary ?? '当前资源链接尚未填写。'}</p>
                    {isAudio ? (
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <InlineMediaPreview
                          resource={resource}
                          wrapperClassName={resource.kind === 'audio' ? 'h-[188px] sm:h-[220px]' : 'aspect-[16/9] min-h-[240px] sm:min-h-[320px] lg:min-h-[420px]'}
                          innerClassName="mx-auto w-full max-w-[520px]"
                        />
                        <ResolvedAudioExperiment
                          resource={resource}
                          wrapperClassName="h-[188px] sm:h-[220px]"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {resource?.status === 'ready' ? (
                          <a
                            href={resource.url ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="premium-lesson-action-secondary flex"
                          >
                            <ExternalLink className="h-4 w-4" />
                            打开课件
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="premium-lesson-action-secondary flex cursor-not-allowed opacity-50"
                          >
                            链接待补充
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}

              <section className="premium-lesson-panel-soft rounded-[24px] border border-border/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex items-center gap-2">
                    <span className="premium-lesson-control inline-flex items-center justify-center">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="premium-lesson-kicker">课前讲义</div>
                      <h3 className="premium-lesson-title mt-1 text-lg font-semibold">讲义阅读与下载</h3>
                    </div>
                  </div>
                  <span className="premium-lesson-tone-pill premium-tone-cyan">
                    {lessonRuntime.handoutPdfPath ? '已备好' : '在线阅读'}
                  </span>
                </div>
                <p className="premium-lesson-muted mt-3 text-sm">{lessonRuntime.handoutSummary}</p>
                <div className="mt-3 line-clamp-4 text-sm text-muted-foreground">{lessonRuntime.handoutPreview}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIsHandoutOpen(true)}
                    className="premium-lesson-action-secondary flex"
                  >
                    <BookOpen className="h-4 w-4" />
                    在线阅读讲义
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleHandoutDownload()}
                    disabled={!lessonRuntime.handoutPdfPath || isDownloadingHandout}
                    className="premium-lesson-action-secondary flex disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDownloadingHandout ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    下载 PDF 讲义
                  </button>
                </div>
              </section>
            </div>
          </div>
        </section>

        <LessonEntryRuntimeSections runtime={lessonRuntime} hideHandoutEntry />
        <LessonEntryHandoutDialog
          runtime={lessonRuntime}
          open={isHandoutOpen}
          onOpenChange={setIsHandoutOpen}
          isExportingHandout={isDownloadingHandout}
          onHandoutExport={() => void handleHandoutDownload()}
        />

        {error ? <div className="premium-lesson-tone-block premium-tone-rose mt-4">{error}</div> : null}
      </main>
    </div>
  );
}
