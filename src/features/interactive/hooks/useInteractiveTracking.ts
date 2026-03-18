'use client';

import { useCallback, useRef, useEffect } from 'react';
import type { InteractiveEvent, InteractiveEventType, InteractiveTrackingContextValue } from '../types';

const STORAGE_KEY_PREFIX = 'interactive_events_';
const SYNC_INTERVAL = 30000; // 30 秒同步一次
const DEBOUNCE_DELAY = 1000; // 1 秒防抖

interface UseInteractiveTrackingOptions {
  resourceId: string;
  resourceKey?: string;
  userId?: string;
  sessionId?: string;
  syncInterval?: number;
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
  const { resourceId, resourceKey, userId, sessionId, syncInterval = SYNC_INTERVAL, onSync } = options;

  type TrackingEvent = InteractiveEvent & {
    resourceKey: string;
    lessonKey?: string | null;
    stepId?: string | null;
    actorRole?: string | null;
    attemptKey?: string | null;
    clientEventAt?: number | string | null;
  };

  const eventsRef = useRef<TrackingEvent[]>([]);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resolvedResourceKey = resourceKey ?? resourceId;
  const storageKey = `${STORAGE_KEY_PREFIX}${resolvedResourceKey}:${sessionId ?? 'no-session'}:${userId ?? 'no-user'}`;

  // 从 localStorage 恢复事件
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          eventsRef.current = parsed as TrackingEvent[];
        }
      }
    } catch (e) {
      console.warn('[InteractiveTracking] Failed to restore events:', e);
    }
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
  const syncEvents = useCallback(async () => {
    const events = eventsRef.current;
    if (events.length === 0) return;

    // Skip server sync in demo mode (no sessionId)
    if (!sessionId) {
      // Just clear events from memory after saving to storage
      saveToStorage();
      return;
    }

    if (onSync) {
      try {
        await onSync(events);
        eventsRef.current = [];
        saveToStorage();
      } catch (e) {
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
          eventsRef.current = [];
          saveToStorage();
        }
      } catch (e) {
        console.error('[InteractiveTracking] API sync failed:', e);
      }
    }
  }, [onSync, saveToStorage, sessionId]);

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
    const event: TrackingEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      resourceId,
      resourceKey: resourceKey ?? resourceId,
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

    // 防抖保存到 localStorage
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(saveToStorage, DEBOUNCE_DELAY);

    // 关键事件立即同步
    if (type === 'complete' || type === 'submit' || type === 'error') {
      syncEvents();
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
