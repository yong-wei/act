'use client';

/**
 * 控灵主动陪伴页面信号采集 Hook（批 3）。
 *
 * 页面级接入：上报有效学习操作、停顿候选（两阶段）与直发事件。
 * flag 关闭时 API 返回 404，Hook 自适应静默停用，不引入第二个客户端 flag。
 */

import { useCallback, useEffect, useRef } from 'react';

import { useGlobalAI } from '@/components/providers/global-ai-provider';
import type { CompanionEventType, CompanionPageKind, CompanionPauseSignals, CompanionResourceCardInput } from '@/features/ai/companion/trigger-engine';

const IDLE_PAUSE_MS = 30_000;
const CONFIRMATION_DELAY_MS = 12_000;

export interface UseKonlingCompanionReporterInput {
  enabled: boolean;
  pageKind: CompanionPageKind;
  pageRef: string;
  /** 事件确认后的投递参数；不提供则只上报不投递（不弹气泡）。 */
  delivery?: {
    courseId: string;
    resources?: CompanionResourceCardInput[];
  };
}

/** 随事件携带的服务端上下文提示（错题知识点/答案 ID，供服务端解析治理资源）。 */
export interface CompanionEventHints {
  knowledgePoints?: string[];
  answerId?: string;
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
  delivery,
}: UseKonlingCompanionReporterInput) {
  const watch = useRef<PauseWatch>({ timer: null, lastActionAt: Date.now(), mediaPlaying: false });
  const disabled = useRef(false);
  const pageKey = useRef({ pageKind, pageRef });
  const deliveryRef = useRef(delivery);
  const { presentCompanionBubble } = useGlobalAI();

  useEffect(() => {
    pageKey.current = { pageKind, pageRef };
  }, [pageKind, pageRef]);

  useEffect(() => {
    deliveryRef.current = delivery;
  }, [delivery]);

  /** 事件确认后投递：成功则呈现气泡；flag 关闭或服务端异常时静默降级。 */
  const deliver = useCallback(async (eventId: string, hints?: CompanionEventHints) => {
    if (disabled.current) return;
    const target = deliveryRef.current;
    if (!target) return;
    try {
      const response = await fetch('/api/ai/companion/delivery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventId,
          courseId: target.courseId,
          resources: target.resources ?? [],
          ...(hints && (hints.knowledgePoints?.length || hints.answerId)
            ? {
              contextHints: {
                ...(hints.knowledgePoints?.length ? { knowledgePoints: hints.knowledgePoints } : {}),
                ...(hints.answerId ? { answerId: hints.answerId } : {}),
              },
            }
            : {}),
        }),
      });
      if (response.status === 404) {
        disabled.current = true;
        return;
      }
      if (!response.ok) return;
      const result = await response.json() as { sessionId?: string; message?: string } | null;
      if (result?.sessionId && result?.message) {
        presentCompanionBubble({ eventId, message: result.message, sessionId: result.sessionId });
      }
    } catch {
      // 服务端异常降级：不弹气泡，不影响学习流程。
    }
  }, [presentCompanionBubble]);

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
      const result = await response.json() as { status?: string } | null;
      if (result?.status === 'confirmed') await deliver(eventId);
      return result;
    } catch {
      return null;
    }
  }, [deliver]);

  /** 重新布置停顿检测：清掉旧计时器并按完整空闲窗口重新计时。 */
  const armPause = useCallback(() => {
    const watchRef = watch.current;
    if (watchRef.timer !== null) window.clearTimeout(watchRef.timer);
    watchRef.timer = window.setTimeout(async () => {
      const signals = readSignals(watchRef);
      if (signals.recentActionCount > 0 || !signals.visible || !signals.focused || signals.mediaPlaying) {
        watchRef.timer = null;
        return;
      }
      const created = await post({ eventType: 'pause-candidate', signals });
      watchRef.timer = null;
      if (!created?.eventId || created.status !== 'candidate') return;
      window.setTimeout(() => {
        void confirmCandidate(created.eventId as string);
      }, CONFIRMATION_DELAY_MS);
    }, IDLE_PAUSE_MS);
  }, [post, confirmCandidate]);

  // 两阶段停顿：无操作 + 可见 + 聚焦 + 无媒体 → 候选；短延迟后二次确认。
  useEffect(() => {
    if (!enabled) return;
    const watchRef = watch.current;
    const onVisibility = () => armPause();
    const onFocus = () => {
      watchRef.lastActionAt = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    armPause();
    return () => {
      if (watchRef.timer !== null) {
        window.clearTimeout(watchRef.timer);
        watchRef.timer = null;
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, armPause]);

  /** 有效学习操作：打断停顿计时、按需上报直发事件（确认后直接投递），随后重新布置停顿检测。 */
  const reportActivity = useCallback((
    eventType?: Extract<CompanionEventType, 'wrong-answer' | 'progress-milestone' | 'resource-completed'>,
    hints?: CompanionEventHints,
  ) => {
    watch.current.lastActionAt = Date.now();
    if (watch.current.timer !== null) {
      window.clearTimeout(watch.current.timer);
      watch.current.timer = null;
    }
    if (eventType) {
      void post({ eventType }).then((created) => {
        if (created?.eventId && created.status === 'confirmed') void deliver(created.eventId, hints);
      });
    }
    armPause();
  }, [post, deliver, armPause]);

  /** 粗粒度媒体状态（仅播放/暂停，无逐秒轨迹）；暂停后重新布置停顿检测。 */
  const reportMediaState = useCallback((playing: boolean) => {
    watch.current.mediaPlaying = playing;
    watch.current.lastActionAt = Date.now();
    if (!playing) armPause();
  }, [armPause]);

  return { reportActivity, reportMediaState };
}
