'use client';

import { useEffect, useState } from 'react';
import type { SessionInfo } from './session-contract';

const WATCHDOG_MS = 40_000;

export function useSessionSSE(sessionId: string | null) {
  const [snapshot, setSnapshot] = useState<SessionInfo | null>(null);
  const [connectedSession, setConnectedSession] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    if (!sessionId) return;

    let attempt = 0;
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const disconnect = () => {
      clearTimeout(timer);
      source?.close();
      setConnectedSession(null);
    };

    function failed() {
      disconnect();
      attempt += 1;
      setReconnectAttempt(attempt);
      timer = setTimeout(connect, Math.min(30_000, 1500 * 2 ** attempt) + Math.random() * 2000);
    }

    function resetWatchdog() {
      clearTimeout(timer);
      timer = setTimeout(failed, WATCHDOG_MS);
    }

    function connect() {
      const stream = new EventSource(`/api/session/${sessionId}/stream`);
      source = stream;
      resetWatchdog();
      stream.addEventListener('heartbeat', resetWatchdog);
      stream.onerror = failed;
      stream.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type?: string; data?: SessionInfo };
          if (message.data?.id !== sessionId || !['initial', 'update'].includes(message.type ?? '')) return;
          resetWatchdog();
          attempt = 0;
          setReconnectAttempt(0);
          setConnectedSession(sessionId);
          setSnapshot(message.data);
          if (message.data.status === 'FINISHED') disconnect();
        } catch {
          failed();
        }
      };
    }

    connect();
    return disconnect;
  }, [sessionId]);

  return {
    state: snapshot?.id === sessionId ? snapshot : null,
    isConnected: sessionId !== null && connectedSession === sessionId,
    reconnectAttempt,
  };
}
