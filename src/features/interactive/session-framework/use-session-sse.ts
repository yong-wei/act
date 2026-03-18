'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface SessionState {
  currentItemId?: string | null;
  currentStage?: string | null;
  status?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

interface SSEMessage {
  type: 'initial' | 'update' | 'heartbeat';
  data?: SessionState;
  timestamp: number;
}

interface UseSessionSSEOptions {
  sessionId: string | null;
  onStateChange?: (state: SessionState) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseSessionSSEReturn {
  state: SessionState | null;
  isConnected: boolean;
  error: Error | null;
  reconnectAttempt: number;
  disconnect: () => void;
  reconnect: () => void;
}

/**
 * 课堂状态 SSE Hook
 *
 * 使用 Server-Sent Events 实时接收课堂状态更新
 * - 自动重连
 * - 心跳保活
 * - 版本控制防止回跳
 */
export function useSessionSSE({
  sessionId,
  onStateChange,
  onError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseSessionSSEOptions): UseSessionSSEReturn {
  const [state, setState] = useState<SessionState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastStateRef = useRef<SessionState | null>(null);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;

    // 关闭已有连接
    disconnect();

    try {
      const url = `/api/session/${sessionId}/stream`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
        setReconnectAttempt(0);
      };

      eventSource.onmessage = (event) => {
        // 忽略心跳消息
        if (event.data.startsWith(':heartbeat')) return;

        try {
          const message: SSEMessage = JSON.parse(event.data);

          if (message.type === 'initial' || message.type === 'update') {
            const newState = message.data;
            if (!newState) return;

            // 版本控制：只接受更新的状态
            if (newState.updatedAt) {
              const newTimestamp = newState.updatedAt;
              const lastTimestamp = lastStateRef.current?.updatedAt || 0;

              // 如果新状态比当前状态旧，忽略
              if (newTimestamp < lastTimestamp) {
                console.warn('[SSE] Ignoring stale state:', {
                  new: newTimestamp,
                  current: lastTimestamp,
                });
                return;
              }
            }

            lastStateRef.current = newState;
            setState(newState);
            onStateChange?.(newState);
          }
        } catch (err) {
          console.error('[SSE] Parse error:', err);
        }
      };

      eventSource.onerror = (event) => {
        setIsConnected(false);
        setError(new Error('SSE connection error'));
        onError?.(event);

        // 自动重连
        if (reconnectAttempt < maxReconnectAttempts) {
          const nextAttempt = reconnectAttempt + 1;
          setReconnectAttempt(nextAttempt);

          // 指数退避
          const delay = reconnectInterval * Math.pow(2, nextAttempt - 1);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, Math.min(delay, 30000)); // 最大30秒
        }

        // 关闭连接让浏览器自动重试
        eventSource.close();
      };
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect'));
    }
  }, [
    sessionId,
    disconnect,
    onStateChange,
    onError,
    reconnectAttempt,
    reconnectInterval,
    maxReconnectAttempts,
  ]);

  const reconnect = useCallback(() => {
    setReconnectAttempt(0);
    connect();
  }, [connect]);

  useEffect(() => {
    if (sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  return {
    state,
    isConnected,
    error,
    reconnectAttempt,
    disconnect,
    reconnect,
  };
}

export default useSessionSSE;
