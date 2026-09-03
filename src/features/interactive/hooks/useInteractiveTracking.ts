'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { InteractiveEvent, InteractiveEventType, InteractiveTrackingContextValue } from '../types';
import { resolveTrackingResourceIdentity } from './resource-identity';

const STORAGE_KEY_PREFIX = 'interactive_events_';
const SYNC_INTERVAL = 30000; // 30 秒同步一次
const DEBOUNCE_DELAY = 1000; // 1 秒防抖

interface UseInteractiveTrackingOptions {
  resourceId?: string;
  resourceKey?: string;
  userId?: string;
  sessionId?: string;
  syncInterval?: number;
  persistWithoutSession?: boolean;
  onSync?: (events: InteractiveEvent[]) => Promise<void>;
}

/**
 * 互动追踪钩子
 *
 * 提供事件追踪功能，支持本地缓存和批量同步
 */
export function useInteractiveTracking(
  options: UseInteractiveTrackingOptions
): InteractiveTrackingContextValue {
  const {
    resourceId,
    resourceKey,
    userId,
    sessionId,
    syncInterval = SYNC_INTERVAL,
    persistWithoutSession = false,
    onSync,
  } = options;

  type TrackingEvent = InteractiveEvent & {
    resourceKey: string;
    lessonKey?: string | null;
    stepId?: string | null;
    actorRole?: string | null;
    attemptKey?: string | null;
    clientEventAt?: number | string | null;
  };

  const eventsRef = useRef<TrackingEvent[]>([]);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const configuredResourceIdentity = resolveTrackingResourceIdentity({
    configuredResourceId: resourceId,
    configuredResourceKey: resourceKey,
  });
  const resolvedResourceKey = configuredResourceIdentity.resourceKey;
  const isDemoSession = sessionId === 'demo';
  const storageKey = `${STORAGE_KEY_PREFIX}${resolvedResourceKey}:${sessionId ?? 'no-session'}:${userId ?? 'no-user'}`;
  const storageKeyRef = useRef(storageKey);
  useEffect(() => {
    storageKeyRef.current = storageKey;
  }, [storageKey]);

  // 从 localStorage 恢复事件：身份键变化时先把当前队列落盘到原身份键
  // （防抖可能尚未触发，不得丢失），清掉跨身份的防抖定时器，再整队重置
  // 为新键的存储态；新键无已存数据时清空，防止访客或前一个用户的事件
  // 被新身份的同步通道提交（Issue #1913）。同身份刷新仍完整恢复。
  const previousStorageKeyRef = useRef(storageKey);
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (previousStorageKeyRef.current !== storageKey) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      try {
        localStorage.setItem(previousStorageKeyRef.current, JSON.stringify(eventsRef.current));
      } catch (e) {
        console.warn('[InteractiveTracking] Failed to flush events before identity switch:', e);
      }
    }
    previousStorageKeyRef.current = storageKey;

    let restored: TrackingEvent[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          restored = parsed as TrackingEvent[];
        }
      }
    } catch (e) {
      console.warn('[InteractiveTracking] Failed to restore events:', e);
    }
    eventsRef.current = restored;
  }, [storageKey]);

  // 保存事件到 localStorage
  const saveToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(eventsRef.current));
    } catch (e) {
      console.warn('[InteractiveTracking] Failed to save events:', e);
    }
  }, [storageKey]);

  // 同步事件到服务器
  const syncEvents = useCallback(() => {
    // 身份键在入队时捕获（闭包身份）：排队中的任务执行时身份可能已切换，
    // 执行时读当前键会把新身份误判为自己的快照（Codex R1 review，#1913）。
    const enqueueStorageKey = storageKey;
    const run = syncQueueRef.current.then(async () => {
      const events = [...eventsRef.current];
      if (events.length === 0) return;
      // 同步在途时身份键已切换：快照过期，不得回写任何存储键或队列，
      // 防止新身份数组写入旧身份键、旧身份未同步事件被误清。
      const snapshotIsStale = () => storageKeyRef.current !== enqueueStorageKey;

      // Skip server sync in demo mode (no sessionId)
      if (isDemoSession || (!sessionId && (!persistWithoutSession || !userId))) {
        if (!snapshotIsStale()) saveToStorage();
        return;
      }

      const removeSyncedSnapshot = () => {
        if (snapshotIsStale()) return;
        const syncedIds = new Set(events.map((event) => event.id));
        eventsRef.current = eventsRef.current.filter((event) => !syncedIds.has(event.id));
        saveToStorage();
      };

      if (onSync) {
        try {
          await onSync(events);
          removeSyncedSnapshot();
        } catch (e) {
          if (!snapshotIsStale()) saveToStorage();
          console.error('[InteractiveTracking] Sync failed:', e);
        }
      } else {
        // 默认同步到 API
        try {
          const response = await fetch('/api/interactive/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events }),
          });

          if (response.ok) {
            removeSyncedSnapshot();
          } else if (!snapshotIsStale()) {
            saveToStorage();
          }
        } catch (e) {
          if (!snapshotIsStale()) saveToStorage();
          console.error('[InteractiveTracking] API sync failed:', e);
        }
      }
    });
    syncQueueRef.current = run.catch(() => undefined);
    return run;
  }, [isDemoSession, onSync, persistWithoutSession, saveToStorage, sessionId, storageKey, userId]);

  // 设置定时同步
  useEffect(() => {
    syncTimerRef.current = setInterval(syncEvents, syncInterval);

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      // 组件卸载时同步剩余事件
      syncEvents();
    };
  }, [syncEvents, syncInterval]);

  // 发送事件
  const emit = useCallback((
    type: InteractiveEventType,
    data: Record<string, unknown> = {}
  ) => {
    const resourceIdentity = resolveTrackingResourceIdentity({
      configuredResourceId: resourceId,
      configuredResourceKey: resourceKey,
      eventResourceId: data.resourceId,
      eventResourceKey: data.resourceKey,
    });

    const event: TrackingEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      resourceId: resourceIdentity.resourceId,
      resourceKey: resourceIdentity.resourceKey,
      userId,
      sessionId,
      timestamp: Date.now(),
      data,
      lessonKey: typeof data.lessonKey === 'string' ? data.lessonKey : null,
      stepId: typeof data.stepId === 'string' ? data.stepId : null,
      actorRole: typeof data.actorRole === 'string' ? data.actorRole : null,
      attemptKey: typeof data.attemptKey === 'string' ? data.attemptKey : null,
      clientEventAt:
        typeof data.clientEventAt === 'number' || typeof data.clientEventAt === 'string'
          ? data.clientEventAt
          : Date.now(),
    };

    eventsRef.current.push(event);

    const isCriticalEvent = type === 'complete' || type === 'submit' || type === 'error';
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (isCriticalEvent) {
      saveToStorage();
      void syncEvents();
    } else {
      debounceTimerRef.current = setTimeout(saveToStorage, DEBOUNCE_DELAY);
    }
  }, [resourceId, resourceKey, userId, sessionId, saveToStorage, syncEvents]);

  // 获取历史事件
  const getHistory = useCallback((): InteractiveEvent[] => {
    return [...eventsRef.current] as InteractiveEvent[];
  }, []);

  // 清除历史
  const clearHistory = useCallback(() => {
    eventsRef.current = [];
    saveToStorage();
  }, [saveToStorage]);

  return {
    emit,
    getHistory,
    clearHistory,
  };
}
