'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen,
  Download,
  ExternalLink,
  FileAudio2,
  FileText,
  Loader2,
  Video,
} from 'lucide-react';

import { downloadLessonHandoutPdf } from '@/features/interactive/shared/download-handout-pdf';
import { useResourceInteractionTracking } from '@/features/interactive/hooks/useResourceInteractionTracking';
import { LessonEntryHandoutDialog } from '@/features/interactive/shared/lesson-entry-runtime-sections';
import type { RuntimeLessonEntryBundle, RuntimeLessonMediaResource } from '@/lib/course-runtime';

type LessonEntryMediaSlot = 'introVideo' | 'courseVideo' | 'audio' | 'slides';

interface LessonEntryMediaHubProps {
  lessonRuntime: RuntimeLessonEntryBundle;
  courseLabel: string;
  title?: string;
  description?: string;
  recommendation?: string;
  audioCardTitle?: string;
}

const DEFAULT_TITLE = '课前预习台';
const DEFAULT_DESCRIPTION =
  '先用导入视频进入问题情境，再用完整课程视频建立全课主线；如果时间紧张，可以搭配音频、课件和讲义完成一轮轻量预习。';
const DEFAULT_RECOMMENDATION =
  '建议顺序：先看导入视频，再看完整课程视频；通勤时可以改听音频，最后结合课件和讲义回看关键图表与公式。';
const DEFAULT_AUDIO_CARD_TITLE = '《闲聊自控》播客';
const MEDIA_PROGRESS_THRESHOLDS = [25, 50, 75, 90] as const;

const SLOT_COPY = {
  introVideo: {
    kicker: '课前导入',
    title: '预习导入视频',
    tone: 'premium-tone-amber',
  },
  courseVideo: {
    kicker: '完整预习',
    title: '完整课程视频',
    tone: 'premium-tone-cyan',
  },
  audio: {
    kicker: '随听预习',
    tone: 'premium-tone-rose',
  },
  slides: {
    kicker: '图文提纲',
    title: '课件讲义',
    tone: 'premium-tone-slate',
  },
} as const;

const SLOT_NARRATIVE_FALLBACK: Record<LessonEntryMediaSlot, string> = {
  introVideo: '先用一个短场景抓住本课要解决的问题，再带着问题进入后续内容。',
  courseVideo: '完整梳理本课主线、关键图表、核心公式和分析步骤。',
  audio: '当前音频资源链接尚未填写。',
  slides: '结合结构图、公式和例题位置，快速建立本课提纲。',
};

function buildLessonEntryResourceKey(lessonId: string, targetId: string) {
  return `lesson-entry:${lessonId}:${targetId}`;
}

function getResourceIcon(resource: RuntimeLessonMediaResource) {
  if (resource.kind === 'video') return Video;
  if (resource.kind === 'audio') return FileAudio2;
  if (resource.kind === 'pdf') return FileText;
  return Video;
}

function isDirectPlayableUrl(url: string, kind: RuntimeLessonMediaResource['kind']) {
  if (!url) return false;
  if (kind === 'video') return /\.(mp4|webm)(?:$|\?)/i.test(url);
  if (kind === 'audio') return /\.(m4a|mp3|wav)(?:$|\?)/i.test(url);
  return false;
}

function getResourceNarrative(resource: RuntimeLessonMediaResource | null, slot: LessonEntryMediaSlot) {
  if (!resource) {
    return SLOT_NARRATIVE_FALLBACK[slot];
  }
  if (resource.title && resource.title !== resource.filename) {
    return resource.title;
  }
  return SLOT_NARRATIVE_FALLBACK[slot];
}

function TrackedMediaElement({
  resource,
  mediaType,
  src,
  className,
  onPlay,
  onProgress,
  onComplete,
}: {
  resource: RuntimeLessonMediaResource;
  mediaType: 'video' | 'audio';
  src: string;
  className: string;
  onPlay: (resource: RuntimeLessonMediaResource) => void;
  onProgress: (resource: RuntimeLessonMediaResource, progressPercent: number, durationMs: number) => void;
  onComplete: (resource: RuntimeLessonMediaResource, durationMs: number) => void;
}) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const emittedThresholdsRef = useRef<Set<number>>(new Set());
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    emittedThresholdsRef.current.clear();
    hasCompletedRef.current = false;
  }, [resource.id, src]);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) {
      return;
    }

    const handlePlay = () => {
      onPlay(resource);
    };

    const handleTimeUpdate = () => {
      if (!element.duration || !Number.isFinite(element.duration) || element.duration <= 0) {
        return;
      }

      const progressPercent = Math.min(100, Math.round((element.currentTime / element.duration) * 100));
      const durationMs = Math.round(element.currentTime * 1000);

      for (const threshold of MEDIA_PROGRESS_THRESHOLDS) {
        if (progressPercent >= threshold && !emittedThresholdsRef.current.has(threshold)) {
          emittedThresholdsRef.current.add(threshold);
          onProgress(resource, threshold, durationMs);
        }
      }

      if (
        !hasCompletedRef.current
        && progressPercent >= 90
        && element.currentTime >= 30
      ) {
        hasCompletedRef.current = true;
        onComplete(resource, durationMs);
      }
    };

    const handleEnded = () => {
      if (hasCompletedRef.current) {
        return;
      }
      hasCompletedRef.current = true;
      onComplete(resource, Math.round(element.duration * 1000));
    };

    element.addEventListener('play', handlePlay);
    element.addEventListener('timeupdate', handleTimeUpdate);
    element.addEventListener('ended', handleEnded);

    return () => {
      element.removeEventListener('play', handlePlay);
      element.removeEventListener('timeupdate', handleTimeUpdate);
      element.removeEventListener('ended', handleEnded);
    };
  }, [onComplete, onPlay, onProgress, resource, src]);

  if (mediaType === 'video') {
    return (
      <video
        ref={mediaRef as never}
        controls
        preload="metadata"
        playsInline
        src={src}
        className={className}
      />
    );
  }

  return (
    <audio
      ref={mediaRef as never}
      controls
      preload="none"
      src={src}
      className={className}
    />
  );
}

function InlineMediaPreview({
  resource,
  wrapperClassName,
  innerClassName,
  onOpen,
  onPlay,
  onProgress,
  onComplete,
}: {
  resource: RuntimeLessonMediaResource | null;
  wrapperClassName: string;
  innerClassName?: string;
  onOpen: (resource: RuntimeLessonMediaResource) => void;
  onPlay: (resource: RuntimeLessonMediaResource) => void;
  onProgress: (resource: RuntimeLessonMediaResource, progressPercent: number, durationMs: number) => void;
  onComplete: (resource: RuntimeLessonMediaResource, durationMs: number) => void;
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
        <TrackedMediaElement
          resource={resource}
          mediaType="video"
          src={resource.url}
          className={`${frameClassName} ${innerClassName ?? ''}`}
          onPlay={onPlay}
          onProgress={onProgress}
          onComplete={onComplete}
        />
      </div>
    );
  }

  if (resource.kind === 'audio' && isDirectPlayableUrl(resource.url, resource.kind)) {
    return (
      <div ref={wrapperRef} className={`${wrapperClassName} overflow-hidden rounded-[24px] border border-border/60 bg-[linear-gradient(135deg,rgba(244,114,182,0.14),rgba(15,23,42,0.04))] px-4 sm:px-5`}>
        <div className={`flex h-full w-full items-center justify-center ${innerClassName ?? ''}`}>
          <TrackedMediaElement
            resource={resource}
            mediaType="audio"
            src={resource.url}
            className="w-full max-w-full"
            onPlay={onPlay}
            onProgress={onProgress}
            onComplete={onComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      onPointerDown={() => onOpen(resource)}
      className={`${wrapperClassName} overflow-hidden rounded-[24px] border border-border/60 bg-black`}
    >
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

function ResolvedAudioPlayer({
  resource,
  onPlay,
  onProgress,
  onComplete,
}: {
  resource: RuntimeLessonMediaResource | null;
  onPlay: (resource: RuntimeLessonMediaResource) => void;
  onProgress: (resource: RuntimeLessonMediaResource, progressPercent: number, durationMs: number) => void;
  onComplete: (resource: RuntimeLessonMediaResource, durationMs: number) => void;
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

  const playableResource = status === 'ready' && resolvedUrl && resource
    ? resource
    : null;

  return (
    <div className="rounded-[24px] border border-border/60 bg-[linear-gradient(135deg,rgba(244,114,182,0.1),rgba(15,23,42,0.05))] p-4 sm:p-5">
      <div className="flex flex-col">
        <div className="flex items-center justify-center">
          {playableResource && resolvedUrl ? (
            <TrackedMediaElement
              resource={playableResource}
              mediaType="audio"
              src={resolvedUrl}
              className="w-full max-w-full"
              onPlay={onPlay}
              onProgress={onProgress}
              onComplete={onComplete}
            />
          ) : null}
          {status === 'loading' ? (
            <div className="premium-lesson-muted inline-flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在准备播放器
            </div>
          ) : null}
          {status === 'error' ? (
            <div className="premium-lesson-muted text-sm">
              当前播放器暂未取到可播放音源。
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

export function LessonEntryMediaHub({
  lessonRuntime,
  courseLabel,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  recommendation = DEFAULT_RECOMMENDATION,
  audioCardTitle = DEFAULT_AUDIO_CARD_TITLE,
}: LessonEntryMediaHubProps) {
  const [isDownloadingHandout, setIsDownloadingHandout] = useState(false);
  const [isHandoutOpen, setIsHandoutOpen] = useState(false);
  const handoutCompletionTrackedRef = useRef(false);
  const lessonId = lessonRuntime.lesson.lesson_id;
  const resourceTracker = useResourceInteractionTracking({
    resourceKey: buildLessonEntryResourceKey(lessonId, 'hub'),
    lessonKey: lessonId,
    surface: 'lesson_entry',
    pageType: 'resource',
    targetType: 'lesson_entry',
    targetId: lessonId,
    targetLabel: lessonRuntime.lesson.title,
    moduleId: lessonId,
    provider: 'lesson-entry-media-hub',
  });
  const mediaByFilename = useMemo(
    () => new Map(lessonRuntime.mediaResources.map((resource) => [resource.filename, resource])),
    [lessonRuntime.mediaResources],
  );
  const introVideoResource = mediaByFilename.get(`${lessonId}-intro-video.mp4`) ?? null;
  const courseVideoResource = mediaByFilename.get(`${lessonId}-course.mp4`) ?? null;
  const audioResource = mediaByFilename.get(`${lessonId}-audio.m4a`) ?? null;
  const slidesResource = mediaByFilename.get(`${lessonId}-slides.pdf`) ?? null;

  useEffect(() => {
    resourceTracker.trackResourceView();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isHandoutOpen) {
      handoutCompletionTrackedRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      if (handoutCompletionTrackedRef.current) {
        return;
      }
      handoutCompletionTrackedRef.current = true;
      resourceTracker.trackResourceComplete({
        resourceKey: buildLessonEntryResourceKey(lessonId, 'handout'),
        targetType: 'handout',
        targetId: 'handout',
        targetLabel: '讲义阅读与下载',
        completionMode: 'dialog_dwell',
        durationMs: 45000,
      });
    }, 45000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isHandoutOpen, lessonId, resourceTracker]);

  const trackMediaOpen = (resource: RuntimeLessonMediaResource) => {
    resourceTracker.trackResourceOpen({
      resourceKey: buildLessonEntryResourceKey(lessonId, resource.id),
      targetType: resource.kind,
      targetId: resource.id,
      targetLabel: resource.title,
      openMode: resource.embedMode === 'iframe' ? 'iframe' : 'inline',
      isCrossOrigin: resource.embedMode === 'iframe',
    });
  };

  const trackMediaPlay = (resource: RuntimeLessonMediaResource) => {
    resourceTracker.trackResourcePlay({
      resourceKey: buildLessonEntryResourceKey(lessonId, resource.id),
      targetType: resource.kind,
      targetId: resource.id,
      targetLabel: resource.title,
    });
  };

  const trackMediaProgress = (resource: RuntimeLessonMediaResource, progressPercent: number, durationMs: number) => {
    resourceTracker.trackResourceProgress({
      resourceKey: buildLessonEntryResourceKey(lessonId, resource.id),
      targetType: resource.kind,
      targetId: resource.id,
      targetLabel: resource.title,
      progressPercent,
      durationMs,
    });
  };

  const trackMediaComplete = (resource: RuntimeLessonMediaResource, durationMs: number) => {
    resourceTracker.trackResourceComplete({
      resourceKey: buildLessonEntryResourceKey(lessonId, resource.id),
      targetType: resource.kind,
      targetId: resource.id,
      targetLabel: resource.title,
      durationMs,
      progressPercent: 100,
      completionMode: 'playback',
    });
  };

  const handleHandoutDownload = async () => {
    setIsDownloadingHandout(true);
    try {
      resourceTracker.trackResourceDownload({
        resourceKey: buildLessonEntryResourceKey(lessonId, 'handout'),
        targetType: 'handout',
        targetId: 'handout',
        targetLabel: '讲义阅读与下载',
      });
      await downloadLessonHandoutPdf({
        lessonId: lessonRuntime.lesson.lesson_id,
        lessonTitle: lessonRuntime.lesson.title,
        handoutPdfPath: lessonRuntime.handoutPdfPath,
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '讲义下载失败，请稍后重试。');
    } finally {
      setIsDownloadingHandout(false);
    }
  };

  return (
    <>
      <section className="premium-lesson-panel mt-4 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="premium-lesson-kicker">{courseLabel}</div>
            <h2 className="premium-lesson-title mt-2 text-2xl font-semibold sm:text-3xl">{title}</h2>
            <p className="premium-lesson-muted mt-3 max-w-3xl">
              {description}
            </p>
          </div>
          <div className="premium-lesson-tone-block premium-tone-slate max-w-sm text-sm">
            {recommendation}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {[introVideoResource, courseVideoResource].map((resource, index) => {
            const slot = index === 0 ? 'introVideo' : 'courseVideo';
            const copy = SLOT_COPY[slot];
            return (
              <section key={resource?.filename ?? copy.title} className="premium-lesson-panel-soft rounded-[28px] border border-border/70 p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="premium-lesson-kicker">{copy.kicker}</div>
                    <h3 className="premium-lesson-title mt-2 text-xl font-semibold sm:text-2xl">
                      {copy.title}
                    </h3>
                    <p className="premium-lesson-muted mt-3 max-w-3xl text-sm sm:text-base">
                      {getResourceNarrative(resource, slot)}
                    </p>
                  </div>
                  <span className={`premium-lesson-tone-pill ${copy.tone}`}>
                    {resource?.status === 'ready' ? '可播放' : '待补充'}
                  </span>
                </div>
                <InlineMediaPreview
                  resource={resource}
                  wrapperClassName="aspect-[16/9] min-h-[240px] w-full sm:min-h-[320px] lg:min-h-[420px]"
                  onOpen={trackMediaOpen}
                  onPlay={trackMediaPlay}
                  onProgress={trackMediaProgress}
                  onComplete={trackMediaComplete}
                />
              </section>
            );
          })}

          <div className="grid gap-4 lg:grid-cols-3">
            {[audioResource, slidesResource].map((resource) => {
              const isAudio = resource?.kind === 'audio';
              const slot: LessonEntryMediaSlot = isAudio ? 'audio' : 'slides';
              const copy = {
                ...SLOT_COPY[slot],
                title: isAudio ? audioCardTitle : SLOT_COPY.slides.title,
              };
              const Icon = getResourceIcon(resource ?? { kind: 'other' } as RuntimeLessonMediaResource);

              return (
                <section
                  key={resource?.filename ?? copy.title}
                  className={`premium-lesson-panel-soft rounded-[24px] border border-border/70 p-4 ${isAudio ? 'lg:col-span-2' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex items-center gap-2">
                      <span className="premium-lesson-control inline-flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="premium-lesson-kicker">{copy.kicker}</div>
                        <h3 className="premium-lesson-title mt-1 text-lg font-semibold">{copy.title}</h3>
                      </div>
                    </div>
                    <span className={`premium-lesson-tone-pill ${copy.tone}`}>
                      {resource?.status === 'ready' ? '可访问' : '待补充'}
                    </span>
                  </div>
                  <p className="premium-lesson-muted mt-3 text-sm">
                    {isAudio
                      ? `听主持人洛嘉和思稳带来的新一期节目：${getResourceNarrative(resource, slot)}`
                      : getResourceNarrative(resource, slot)}
                  </p>
                  {isAudio ? (
                    <div className="mt-4">
                      <ResolvedAudioPlayer
                        resource={resource}
                        onPlay={trackMediaPlay}
                        onProgress={trackMediaProgress}
                        onComplete={trackMediaComplete}
                      />
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {resource?.status === 'ready' ? (
                        <a
                          href={resource.url ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => {
                            resourceTracker.trackResourceOpen({
                              resourceKey: buildLessonEntryResourceKey(lessonId, resource.id),
                              targetType: resource.kind,
                              targetId: resource.id,
                              targetLabel: resource.title,
                              openMode: 'new_tab',
                            });
                          }}
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
              <div className="prose prose-sm mt-3 max-w-none text-muted-foreground prose-p:my-0 prose-strong:text-foreground prose-ul:my-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {lessonRuntime.handoutSummary}
                </ReactMarkdown>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resourceTracker.trackResourceOpen({
                      resourceKey: buildLessonEntryResourceKey(lessonId, 'handout'),
                      targetType: 'handout',
                      targetId: 'handout',
                      targetLabel: '讲义阅读与下载',
                      openMode: 'dialog',
                    });
                    setIsHandoutOpen(true);
                  }}
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

      <LessonEntryHandoutDialog
        runtime={lessonRuntime}
        open={isHandoutOpen}
        onOpenChange={setIsHandoutOpen}
        isExportingHandout={isDownloadingHandout}
        onHandoutExport={() => void handleHandoutDownload()}
      />
    </>
  );
}
