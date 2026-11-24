'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';

interface Transaction {
  transactionId: string;
  authorizeUrl: string;
}

const TOKEN_KEYS = ['access_token', 'refresh_token', 'id_token', 'code'];
const PORTAL_URL = 'https://auth.adapt-learn.online/';
const PORTAL_ERROR = '未能使用认证中心的当前账号进入 ACT。请返回认证中心核对账号和 ACT 使用权限，再重新进入。';

export function PlatformOidcLoginButton({ legacyLogin }: { legacyLogin: ReactNode }) {
  const [mode, setMode] = useState<'loading' | 'unavailable' | 'central' | 'legacy'>('loading');
  const [launchReference, setLaunchReference] = useState<string | null>(null);
  const [reauthenticate, setReauthenticate] = useState(false);
  const [open, setOpen] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('callbackUrl') ?? '/';

  useEffect(() => {
    let active = true;
    const fromPortal = new URLSearchParams(window.location.hash.slice(1)).get('platform-launch');
    fetch('/api/auth/platform/mode')
      .then((response) => {
        if (!response.ok) throw new Error('mode');
        return response.json();
      })
      .then((body: { enabled?: boolean }) => {
        if (!active) return;
        if (fromPortal !== null) {
          window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
          setLaunchReference(fromPortal);
          if (body.enabled === true) setOpen(true);
        }
        setMode(body.enabled === true ? 'central' : 'legacy');
      })
      .catch(() => {
        if (active) setMode('unavailable');
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
      body: JSON.stringify({ launchReference, reauthenticate }),
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
  }, [open, returnTo, launchReference, reauthenticate]);

  useLayoutEffect(() => {
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
        setError(data.outcome === 'account-pending'
          ? '已通过统一身份认证，ACT 账号尚未配置。请联系 ACT 管理员。'
          : launchReference !== null ? PORTAL_ERROR : '统一登录未完成，请核对 ACT 使用权限或重新登录。');
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
          window.location.replace(result.returnTo);
        })
        .catch(() => {
          setBusy(false);
          setError('登录完成事务无效或已消费，请重新打开登录框');
        });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [transaction, launchReference]);

  const cancel = async () => {
    if (busy) return;
    if (!transaction) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/auth/platform/transactions/${transaction.transactionId}/cancel`, { method: 'POST', body: '{}' });
      setBusy(false);
      setOpen(false);
    } catch {
      setBusy(false);
      setError('取消事务失败，请检查网络后重试');
    }
  };

  const openLogin = (switchAccount: boolean) => {
    setBusy(false);
    setError(null);
    setReauthenticate(switchAccount);
    setOpen(true);
  };

  if (mode === 'loading') return <p className="text-sm text-subtle">正在加载登录方式…</p>;
  if (mode === 'unavailable') return <p role="alert" className="text-sm text-destructive">登录服务暂不可用，请刷新页面重试。</p>;
  const portalLink = <a href={PORTAL_URL} className="text-sm underline">返回认证中心</a>;
  if (launchReference !== null && !open) {
    return <div className="space-y-3"><p className="text-sm text-subtle">{PORTAL_ERROR}</p>{portalLink}</div>;
  }
  if (mode === 'legacy') return legacyLogin;

  return (
    <>
      {launchReference === null ? (
        <>
          <button
            type="button"
            onClick={() => openLogin(false)}
            className="block w-full rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            统一身份登录（校园账号）
          </button>
          <button type="button" onClick={() => openLogin(true)} className="mt-3 text-sm text-primary underline">
            更换统一账号
          </button>
          <details className="mt-4 text-sm text-subtle">
            <summary className="cursor-pointer">使用未迁移的 ACT 本地账号</summary>
            <div className="mt-3">{legacyLogin}</div>
          </details>
        </>
      ) : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="统一身份登录">
          <div className="relative h-[80vh] w-full max-w-5xl rounded-lg bg-background p-4 shadow-xl">
            {!busy ? (
              <button type="button" onClick={() => void cancel()} className="absolute right-3 top-3 z-10 rounded px-2 py-1 text-sm text-subtle hover:bg-secondary" aria-label="关闭">
                ×
              </button>
            ) : null}
            <h2 className="mb-3 text-lg font-semibold">统一身份登录</h2>
            {error ? (
              <div role="alert" className="mb-3 space-y-2 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p>{error}</p>
                {launchReference !== null ? portalLink : null}
              </div>
            ) : null}
            {!transaction && !error ? <p className="p-8 text-center text-sm text-subtle">正在建立安全登录事务…</p> : null}
            {transaction && !error ? (
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
