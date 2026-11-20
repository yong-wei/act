'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface Transaction {
  transactionId: string;
  authorizeUrl: string;
}

const TOKEN_KEYS = ['access_token', 'refresh_token', 'id_token', 'code'];

export function PlatformOidcLoginButton() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('callbackUrl') ?? '/';

  useEffect(() => {
    let active = true;
    fetch('/api/auth/platform/mode')
      .then((response) => response.ok ? response.json() : { enabled: false })
      .then((body: { enabled?: boolean }) => {
        if (active) setEnabled(body.enabled === true);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    setError(null);
    setTransaction(null);
    fetch(`/api/auth/platform/transactions?return_to=${encodeURIComponent(returnTo)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('transaction');
        return response.json() as Promise<Transaction>;
      })
      .then((created) => {
        if (disposed) {
          void fetch(`/api/auth/platform/transactions/${created.transactionId}/cancel`, { method: 'POST', body: '{}' });
          return;
        }
        setTransaction(created);
      })
      .catch(() => {
        if (!disposed) setError('无法创建统一登录事务，请稍后重试');
      });
    return () => {
      disposed = true;
    };
  }, [open, returnTo]);

  useEffect(() => {
    if (!transaction) return;
    const onMessage = (event: MessageEvent) => {
      const data = (event.data ?? {}) as Record<string, unknown>;
      if (
        event.origin !== window.location.origin
        || event.source !== frameRef.current?.contentWindow
        || data.transactionId !== transaction.transactionId
        || TOKEN_KEYS.some((key) => Object.hasOwn(data, key))
      ) return;
      if (data.type === 'act-login-error') {
        setError('统一登录已取消或失败，请重新打开登录框');
        return;
      }
      if (data.type !== 'act-login-complete' || data.outcome !== 'complete') return;
      setBusy(true);
      fetch('/api/auth/platform/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionId: transaction.transactionId }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('completion');
          return response.json() as Promise<{ returnTo: string }>;
        })
        .then((result) => {
          sessionStorage.removeItem('act_oidc_logout_hold');
          window.location.assign(result.returnTo);
        })
        .catch(() => {
          setBusy(false);
          setError('登录完成事务无效或已消费，请重新打开登录框');
        });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [transaction]);

  const cancel = async () => {
    if (busy) return;
    if (!transaction) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/auth/platform/transactions/${transaction.transactionId}/cancel`, { method: 'POST', body: '{}' });
      setOpen(false);
    } catch {
      setBusy(false);
      setError('取消事务失败，请检查网络后重试');
    }
  };

  if (enabled !== true) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-md border border-input bg-secondary px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-secondary/80"
      >
        统一身份登录（校园账号）
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="统一身份登录">
          <div className="relative h-[80vh] w-full max-w-5xl rounded-lg bg-background p-4 shadow-xl">
            {!busy ? (
              <button type="button" onClick={() => void cancel()} className="absolute right-3 top-3 z-10 rounded px-2 py-1 text-sm text-subtle hover:bg-secondary" aria-label="关闭">
                ×
              </button>
            ) : null}
            <h2 className="mb-3 text-lg font-semibold">统一身份登录</h2>
            {error ? <p className="mb-3 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
            {!transaction && !error ? <p className="p-8 text-center text-sm text-subtle">正在建立安全登录事务…</p> : null}
            {transaction ? (
              <iframe
                ref={frameRef}
                title="统一身份认证"
                src={transaction.authorizeUrl}
                className="h-[calc(80vh-5rem)] w-full border-0"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
