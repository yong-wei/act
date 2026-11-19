'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { clearIlabOriginSessionStorage, stripIlabUrlParams } from '@/features/ilab/client-grant';

let browserId: string | undefined;
function getBrowserId() {
  if (browserId) return browserId;
  try {
    const key = 'act-simulation-entry-browser';
    const stored = localStorage.getItem(key);
    browserId = stored && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(stored)
      ? stored : crypto.randomUUID();
    localStorage.setItem(key, browserId);
  } catch {
    browserId ??= crypto.randomUUID();
  }
  return browserId;
}

const exchanges = new Map<string, Promise<void>>();
function holdIlabGrant(ticket: string) {
  let exchange = exchanges.get(ticket);
  if (!exchange) {
    exchange = fetch('/api/ilab/grant', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket }),
    }).then(async response => {
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? '实验空间票据暂时无法确认。');
      }
    }).finally(() => exchanges.delete(ticket));
    exchanges.set(ticket, exchange);
  }
  return exchange;
}

export function ClassroomEntry({ children, ticket }: { children: (useGrant: boolean) => ReactNode; ticket?: string }) {
  const [admitted, setAdmitted] = useState(false);
  const [useGrant, setUseGrant] = useState(false);
  const [message, setMessage] = useState('正在确认入场顺序。');
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let ticketHeld = false;
    async function requestEntry() {
      let delay = 5000;
      try {
        const response = await fetch('/api/simulations/network/classroom-entry', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ browserId: getBrowserId() }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        const state = await response.json() as { admitted?: boolean; retryAfterMs?: number };
        if (controller.signal.aborted) return;
        if (state.admitted) { setAdmitted(true); return; }
        if (ticket && !ticketHeld) {
          try { await holdIlabGrant(ticket); }
          catch (error) {
            if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '实验空间票据暂时无法确认。');
            return;
          }
          if (controller.signal.aborted) return;
          clearIlabOriginSessionStorage();
          window.history.replaceState(null, '', stripIlabUrlParams(location.pathname, location.search));
          ticketHeld = true;
          setUseGrant(true);
        }
        delay = Math.max(750, state.retryAfterMs ?? delay);
        setMessage(response.ok ? '正在分批入场，轮到时会自动打开实验。' : '入场连接暂未就绪，正在重试。');
      } catch {
        if (controller.signal.aborted) return;
        setMessage('入场连接暂未就绪，正在重试。');
      }
      timer = setTimeout(() => void requestEntry(), delay + Math.random() * 400);
    }
    void requestEntry();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [ticket]);
  if (admitted) return children(useGrant);
  return <div role="status" aria-live="polite" className="flex min-h-56 items-center justify-center">{message}</div>;
}
