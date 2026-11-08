'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

/**
 * 统一身份登录入口（issue-2164 阶段 A）：
 * 客户端查询 next-auth providers，keycloak 存在（env 三变量已配置）才显示；
 * 仅登录页主动入口，游客页面不受影响。经 signIn() 发起带 CSRF 的 POST
 * （pages.signIn 自定义时 GET 分支只回登录页，不会发起授权）。
 */
export function PlatformOidcLoginButton() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;
    fetch('/api/auth/providers')
      .then((response) => (response.ok ? response.json() : {}))
      .then((providers: Record<string, unknown>) => {
        // NextAuth 返回以 provider ID 为键的对象（非数组）。
        if (active) {
          setEnabled('keycloak' in providers);
        }
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (enabled !== true) return null;

  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signIn('keycloak', { callbackUrl });
      }}
      className="block w-full rounded-md border border-input bg-secondary px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-secondary/80 disabled:opacity-60"
    >
      {busy ? '正在跳转统一身份…' : '统一身份登录（校园账号）'}
    </button>
  );
}
