'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  FileAudio2,
  FileText,
  Loader2,
  Video,
} from 'lucide-react';

import { downloadLessonHandoutPdf } from '@/features/interactive/shared/download-handout-pdf';
import { useResourceInteractionTracking } from '@/features/interactive/hooks/useResourceInteractionTracking';
import { LessonEntryHandoutPanel } from '@/features/interactive/shared/lesson-entry-handout-panel';
import { LessonEntryHandoutDialog } from '@/features/interactive/shared/lesson-entry-runtime-sections';
import type { RuntimeLessonEntryBundle, RuntimeLessonMediaResource } from '@/lib/course-bundle';

type LessonEntryMediaSlot = 'introVideo' | 'courseVideo' | 'audio' | 'slides';
type ReadyLessonEntryResource = RuntimeLessonMediaResource & { status: 'ready'; url: string };
type AudioPreviewState = {
  identity: string;
  resolvedUrl: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
};

interface LessonEntryMediaHubProps {
  lessonRuntime: RuntimeLessonEntryBundle;
  courseLabel: string;
  title?: string;
  description?: string;
  recommendation?: string;
  audioCardTitle?: string;
}

const DEFAULT_TITLE = '课前预习台';
// Temporary accessibility exception: runtime lesson media lacks a caption URL contract today.
// Owner: course runtime. Remove this placeholder when RuntimeLessonMediaResource exposes captions.
const TEMPORARY_CAPTION_TRACK_SRC = 'data:text/vtt;charset=utf-8,WEBVTT%0A%0A00:00:00.000%20--%3E%2000:00:05.000%0A%E6%9A%82%E6%97%A0%E5%8F%AF%E7%94%A8%E5%AD%97%E5%B9%95%EF%BC%9B%E8%AF%B7%E6%95%99%E5%B8%88%E4%B8%BA%E6%AD%A3%E5%BC%8F%E5%AA%92%E4%BD%93%E8%A1%A5%E5%85%85%E5%AD%97%E5%B9%95%E8%B5%84%E4%BA%A7%E3%80%82';
const DEFAULT_RECOMMENDATION =
  '建议先浏览课前讲义，再结合已开放的视频、音频或课件回看关键图表与公式。';
const DEFAULT_AUDIO_CARD_TITLE = '《闲聊自控》播客';
const MEDIA_PROGRESS_THRESHOLDS = [25, 50, 75, 90] as const;

export type NativeMediaCoordinator = {
  register: (element: HTMLMediaElement) => () => void;
  play: (element: HTMLMediaElement) => void;
};

const NativeMediaCoordinatorContext = createContext<NativeMediaCoordinator | null>(null);

export function createNativeMediaCoordinator(): NativeMediaCoordinator {
  const elements = new Set<HTMLMediaElement>();
  return {
    register: (element) => {
      elements.add(element);
      return () => elements.delete(element);
    },
    play: (element) => {
      elements.forEach((other) => {
        if (other !== element && !other.paused) {
          other.pause();
        }
      });
    },
  };
}

function useNativeMediaCoordinator() {
  return useContext(NativeMediaCoordinatorContext);
}
// Sandbox rationale: iframe previews need scripts for hosted slide/video widgets,
// popup links, and presentation/fullscreen affordances.
// Same-origin is intentionally omitted to avoid script + same-origin escape.
const LESSON_MEDIA_PREVIEW_IFRAME_SANDBOX =
  'allow-scripts allow-popups allow-presentation';

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
  audio: '用对话形式回顾本课主线，适合在碎片时间先建立整体印象。',
  slides: '结合结构图、公式和例题位置，快速建立本课提纲。',
};

function buildLessonEntryResourceKey(lessonId: string, targetId: string) {
  return `lesson-entry:${lessonId}:${targetId}`;
}

function getResourceIcon(resource: RuntimeLessonMediaResource) {
  if (resource.kind === 'video') return Video;
  if (resource.kind === 'audio') return FileAudio2;
  if (resource.kind === 'pdf' || resource.kind === 'slides') return FileText;
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

function getReadyLessonEntryResource(resource: RuntimeLessonMediaResource | null): ReadyLessonEntryResource | null {
  if (resource?.status === 'ready' && resource.url) {
    return {
      ...resource,
      status: 'ready',
      url: resource.url,
    };
  }
  return null;
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
  resource: ReadyLessonEntryResource;
  mediaType: 'video' | 'audio';
  src: string;
  className: string;
  onPlay: (resource: RuntimeLessonMediaResource) => void;
  onProgress: (resource: RuntimeLessonMediaResource, progressPercent: number, durationMs: number) => void;
  onComplete: (resource: RuntimeLessonMediaResource, durationMs: number) => void;
}) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const mediaCoordinator = useNativeMediaCoordinator();
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
      if (mediaCoordinator) {
        mediaCoordinator.play(element);
      }
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
    const unregister = mediaCoordinator?.register(element);
    if (mediaCoordinator) element.dataset.mediaCoordinatorReady = 'true';

    return () => {
      unregister?.();
      delete element.dataset.mediaCoordinatorReady;
      element.removeEventListener('play', handlePlay);
      element.removeEventListener('timeupdate', handleTimeUpdate);
      element.removeEventListener('ended', handleEnded);
    };
  }, [mediaCoordinator, onComplete, onPlay, onProgress, resource, src]);

  if (mediaType === 'video') {
    return (
      <video
        aria-label={`${resource.title} 视频`}
        ref={mediaRef as never}
        controls
        preload="metadata"
        playsInline
        src={src}
        className={className}
      >
        <track kind="captions" srcLang="zh-CN" label="中文说明" src={TEMPORARY_CAPTION_TRACK_SRC} />
      </video>
    );
  }

  return (
    <audio
      aria-label={`${resource.title} 音频`}
      ref={mediaRef as never}
      controls
      preload="none"
      src={src}
      className={className}
    >
      <track kind="captions" srcLang="zh-CN" label="中文说明" src={TEMPORARY_CAPTION_TRACK_SRC} />
    </audio>
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
  resource: ReadyLessonEntryResource;
  wrapperClassName: string;
  innerClassName?: string;
  onOpen: (resource: RuntimeLessonMediaResource) => void;
  onPlay: (resource: RuntimeLessonMediaResource) => void;
  onProgress: (resource: RuntimeLessonMediaResource, progressPercent: number, durationMs: number) => void;
  onComplete: (resource: RuntimeLessonMediaResource, durationMs: number) => void;
}) {
  const frameClassName = 'block h-full w-full border-0';
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isDirectVideo = resource.kind === 'video' && isDirectPlayableUrl(resource.url, resource.kind);
  const isDirectAudio = resource.kind === 'audio' && isDirectPlayableUrl(resource.url, resource.kind);

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
        key={resource.id}
        src={resource.url}
        title={resource.title}
        className={`${frameClassName} ${innerClassName ?? ''}`}
        allow="autoplay; fullscreen"
        sandbox={LESSON_MEDIA_PREVIEW_IFRAME_SANDBOX}
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
  resource: ReadyLessonEntryResource | null;
  onPlay: (resource: RuntimeLessonMediaResource) => void;
  onProgress: (resource: RuntimeLessonMediaResource, progressPercent: number, durationMs: number) => void;
  onComplete: (resource: RuntimeLessonMediaResource, durationMs: number) => void;
}) {
  const audioIdentity = resource && resource.kind === 'audio' && resource.status === 'ready' && resource.url
    ? `${resource.id}:${resource.url}`
    : 'idle';
  const directAudioUrl = resource && resource.kind === 'audio' && resource.status === 'ready' && resource.url && isDirectPlayableUrl(resource.url, resource.kind)
    ? resource.url
    : null;
  const buildInitialAudioState = (): AudioPreviewState => ({
    identity: audioIdentity,
    resolvedUrl: directAudioUrl,
    status: directAudioUrl ? 'ready' : audioIdentity === 'idle' ? 'idle' : 'loading',
  });
  const [audioState, setAudioState] = useState(buildInitialAudioState);
  if (audioState.identity !== audioIdentity) {
    setAudioState(buildInitialAudioState());
  }

  useEffect(() => {
    if (!resource || resource.kind !== 'audio' || resource.status !== 'ready' || !resource.url || directAudioUrl) {
      return undefined;
    }

    let cancelled = false;

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
            setAudioState((current) => current.identity === audioIdentity
              ? { identity: audioIdentity, resolvedUrl: null, status: 'error' }
              : current);
          }
          return;
        }

        setAudioState((current) => current.identity === audioIdentity
          ? { identity: audioIdentity, resolvedUrl: payload.sourceUrl ?? null, status: 'ready' }
          : current);
      })
      .catch(() => {
        if (!cancelled) {
          setAudioState((current) => current.identity === audioIdentity
            ? { identity: audioIdentity, resolvedUrl: null, status: 'error' }
            : current);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioIdentity, directAudioUrl, resource]);

  const playableResource = audioState.status === 'ready' && audioState.resolvedUrl && resource
    ? resource
    : null;

  return (
    <div className="rounded-[24px] border border-border/60 bg-[linear-gradient(135deg,rgba(244,114,182,0.1),rgba(15,23,42,0.05))] p-4 sm:p-5">
      <div className="flex flex-col">
        <div className="flex items-center justify-center">
          {playableResource && audioState.resolvedUrl ? (
            <TrackedMediaElement
              resource={playableResource}
              mediaType="audio"
              src={audioState.resolvedUrl}
              className="w-full max-w-full"
              onPlay={onPlay}
              onProgress={onProgress}
              onComplete={onComplete}
            />
          ) : null}
          {audioState.status === 'loading' ? (
            <div className="premium-lesson-muted inline-flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在准备播放器
            </div>
          ) : null}
          {audioState.status === 'error' ? (
            <div className="premium-lesson-muted text-sm">
              当前播放器暂未取到可播放音源。
            </div>
          ) : null}
          {audioState.status === 'idle' ? (
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
  recommendation = DEFAULT_RECOMMENDATION,
  audioCardTitle = DEFAULT_AUDIO_CARD_TITLE,
}: LessonEntryMediaHubProps) {
  const [isDownloadingHandout, setIsDownloadingHandout] = useState(false);
  const [isHandoutOpen, setIsHandoutOpen] = useState(false);
  const nativeMediaCoordinator = useMemo(() => createNativeMediaCoordinator(), []);
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
  const introVideoResource = getReadyLessonEntryResource(mediaByFilename.get(`${lessonId}-intro-video.mp4`) ?? null);
  const courseVideoResource = getReadyLessonEntryResource(mediaByFilename.get(`${lessonId}-course.mp4`) ?? null);
  const audioResource = getReadyLessonEntryResource(mediaByFilename.get(`${lessonId}-audio.m4a`) ?? null);
  const slidesResource = getReadyLessonEntryResource(mediaByFilename.get(`${lessonId}-slides.pdf`) ?? null);
  const primaryMediaItems = [
    introVideoResource ? { resource: introVideoResource, slot: 'introVideo' as const } : null,
    courseVideoResource ? { resource: courseVideoResource, slot: 'courseVideo' as const } : null,
  ].filter((item): item is { resource: ReadyLessonEntryResource; slot: 'introVideo' | 'courseVideo' } => Boolean(item));
  const secondaryMediaItems = [
    audioResource ? { resource: audioResource, slot: 'audio' as const } : null,
    slidesResource ? { resource: slidesResource, slot: 'slides' as const } : null,
  ].filter((item): item is { resource: ReadyLessonEntryResource; slot: 'audio' | 'slides' } => Boolean(item));

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
    <NativeMediaCoordinatorContext.Provider value={nativeMediaCoordinator}>
      <section className="premium-lesson-panel mt-4 px-5 py-5">
        <div>
          <div>
            <div className="premium-lesson-kicker">{courseLabel}</div>
            <h2 className="premium-lesson-title mt-2 text-2xl font-semibold sm:text-3xl">{title}</h2>
          </div>
          <div className="premium-lesson-tone-block premium-tone-slate mt-4 w-full text-sm">
            {recommendation}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {primaryMediaItems.map(({ resource, slot }) => {
            const copy = SLOT_COPY[slot];
            return (
              <section key={resource.filename} className="premium-lesson-panel-soft rounded-[28px] border border-border/70 p-4 sm:p-5">
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
                    可播放
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

          <LessonEntryHandoutPanel
            summary={lessonRuntime.handoutSummary}
            pdfReady={Boolean(lessonRuntime.handoutPdfPath)}
            isDownloading={isDownloadingHandout}
            onOpen={() => {
              resourceTracker.trackResourceOpen({
                resourceKey: buildLessonEntryResourceKey(lessonId, 'handout'),
                targetType: 'handout',
                targetId: 'handout',
                targetLabel: '讲义阅读与下载',
                openMode: 'dialog',
              });
              setIsHandoutOpen(true);
            }}
            onDownload={() => void handleHandoutDownload()}
          />

          {secondaryMediaItems.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {secondaryMediaItems.map(({ resource, slot }) => {
                const isAudio = slot === 'audio';
                const copy = {
                  ...SLOT_COPY[slot],
                  title: isAudio ? audioCardTitle : SLOT_COPY.slides.title,
                };
                const Icon = getResourceIcon(resource);

                return (
                  <section
                    key={resource.filename}
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
                        可访问
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
                        <a
                          href={resource.url}
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
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <LessonEntryHandoutDialog
        runtime={lessonRuntime}
        open={isHandoutOpen}
        onOpenChange={setIsHandoutOpen}
        isExportingHandout={isDownloadingHandout}
        onHandoutExport={() => void handleHandoutDownload()}
      />
    </NativeMediaCoordinatorContext.Provider>
  );
}
