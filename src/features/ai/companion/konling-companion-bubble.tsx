'use client';

/**
 * 控灵主动陪伴气泡（批 3）：非模态、约 12 秒自动收起、同一事件不重复展示、
 * 多标签页 localStorage 租约互斥。点击回调交给调用方（Provider/侧栏）打开会话。
 */

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const AUTO_DISMISS_MS = 12_000;
const LEASE_PREFIX = 'konling-companion-lease:';
const LEASE_TTL_MS = 60_000;
const SEEN_PREFIX = 'konling-companion-seen:';

export interface CompanionBubbleRequest {
  eventId: string;
  message: string;
  /** 点击后要定位的控灵会话（投递返回）。 */
  sessionId: string;
}

function acquireLease(userId: string, eventId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = `${LEASE_PREFIX}${userId}`;
    const now = Date.now();
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const lease = JSON.parse(raw) as { eventId: string; at: number };
      if (lease.eventId !== eventId && now - lease.at < LEASE_TTL_MS) return false;
    }
    window.localStorage.setItem(key, JSON.stringify({ eventId, at: now }));
    return true;
  } catch {
    return false;
  }
}

function markSeen(userId: string, eventId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SEEN_PREFIX}${userId}:${eventId}`, '1');
  } catch {
    // 存储不可用时仅损失跨标签去重，服务端投递唯一约束仍兜底。
  }
}

function isSeen(userId: string, eventId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(`${SEEN_PREFIX}${userId}:${eventId}`) === '1';
  } catch {
    return true;
  }
}

export function KonlingCompanionBubble({
  userId,
  request,
  onOpen,
  onDismissed,
}: {
  userId: string;
  request: CompanionBubbleRequest | null;
  onOpen: (request: CompanionBubbleRequest) => void;
  onDismissed: (request: CompanionBubbleRequest) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    if (!request) return;
    if (isSeen(userId, request.eventId)) return;
    if (!acquireLease(userId, request.eventId)) return;
    setVisible(true);
    markSeen(userId, request.eventId);
    const timer = window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [userId, request]);

  if (!request || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-konling-companion-bubble
      className="fixed bottom-6 right-6 z-50 max-w-xs rounded-xl border border-border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 flex-none text-sky-500 dark:text-sky-300" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm leading-6 text-foreground">{request.message}</p>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              onOpen(request);
            }}
            className="btn-ghost-themed mt-2 rounded-lg px-3 py-1.5 text-sm"
          >
            打开控灵继续
          </button>
        </div>
        <button
          type="button"
          aria-label="关闭控灵陪伴提示"
          onClick={() => {
            setVisible(false);
            onDismissed(request);
          }}
          className="ml-1 rounded-lg p-1 text-subtle transition hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
