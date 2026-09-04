'use client';

/**
 * 控灵主动陪伴页面信号采集 Hook（批 3）。
 *
 * 页面级接入：上报有效学习操作、停顿候选（两阶段）与直发事件。
 * flag 关闭时 API 返回 404，Hook 自适应静默停用，不引入第二个客户端 flag。
 */

import { useCallback, useEffect, useRef } from 'react';

import type { CompanionEventType, CompanionPageKind, CompanionPauseSignals } from '@/features/ai/companion/trigger-engine';

const IDLE_PAUSE_MS = 30_000;
const CONFIRMATION_DELAY_MS = 12_000;

export interface UseKonlingCompanionReporterInput {
  enabled: boolean;
  pageKind: CompanionPageKind;
  pageRef: string;
}

interface PauseWatch {
  timer: number | null;
  lastActionAt: number;
  mediaPlaying: boolean;
}

function readSignals(watch: PauseWatch): CompanionPauseSignals {
  return {
    visible: typeof document === 'undefined' ? false : document.visibilityState === 'visible',
    focused: typeof document === 'undefined' ? false : document.hasFocus(),
    mediaPlaying: watch.mediaPlaying,
    recentActionCount: Date.now() - watch.lastActionAt < IDLE_PAUSE_MS ? 1 : 0,
  };
}

export function useKonlingCompanionReporter({
  enabled,
  pageKind,
  pageRef,
}: UseKonlingCompanionReporterInput) {
  const watch = useRef<PauseWatch>({ timer: null, lastActionAt: Date.now(), mediaPlaying: false });
  const disabled = useRef(false);
  const pageKey = useRef({ pageKind, pageRef });

  useEffect(() => {
    pageKey.current = { pageKind, pageRef };
  }, [pageKind, pageRef]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    if (disabled.current) return null;
    try {
      const response = await fetch('/api/ai/companion/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, ...pageKey.current }),
      });
      if (response.status === 404) {
        // 陪伴未启用：本页生命周期内静默停用，后续不再请求。
        disabled.current = true;
        return null;
      }
      if (!response.ok) return null;
      return await response.json() as { eventId?: string; status?: string } | null;
    } catch {
      return null;
    }
  }, []);

  const confirmCandidate = useCallback(async (eventId: string) => {
    try {
      const response = await fetch('/api/ai/companion/events', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId, signals: readSignals(watch.current) }),
      });
      if (!response.ok) return null;
      return await response.json() as { status?: string } | null;
    } catch {
      return null;
    }
  }, []);

  // 两阶段停顿：无操作 + 可见 + 聚焦 + 无媒体 → 候选；短延迟后二次确认。
  useEffect(() => {
    if (!enabled) return;
    const watchRef = watch.current;
    const armPause = () => {
      if (watchRef.timer !== null) window.clearTimeout(watchRef.timer);
      watchRef.timer = window.setTimeout(async () => {
        const signals = readSignals(watchRef);
        if (signals.recentActionCount > 0 || !signals.visible || !signals.focused || signals.mediaPlaying) return;
        const created = await post({ eventType: 'pause-candidate', signals });
        if (!created?.eventId || created.status !== 'candidate') return;
        window.setTimeout(() => {
          void confirmCandidate(created.eventId as string);
        }, CONFIRMATION_DELAY_MS);
      }, IDLE_PAUSE_MS);
    };
    const onVisibility = () => armPause();
    const onFocus = () => {
      watchRef.lastActionAt = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    armPause();
    return () => {
      if (watchRef.timer !== null) window.clearTimeout(watchRef.timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, post, confirmCandidate]);

  /** 有效学习操作：打断停顿计时并按需上报直发事件。 */
  const reportActivity = useCallback((eventType?: Extract<CompanionEventType, 'wrong-answer' | 'progress-milestone' | 'resource-completed'>) => {
    watch.current.lastActionAt = Date.now();
    if (watch.current.timer !== null) {
      window.clearTimeout(watch.current.timer);
      watch.current.timer = null;
    }
    if (eventType) void post({ eventType });
  }, [post]);

  /** 粗粒度媒体状态（仅播放/暂停，无逐秒轨迹）。 */
  const reportMediaState = useCallback((playing: boolean) => {
    watch.current.mediaPlaying = playing;
    watch.current.lastActionAt = Date.now();
  }, []);

  return { reportActivity, reportMediaState };
}
