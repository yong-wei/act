'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * 统一身份登录入口（issue-2164 阶段 A）：
 * 客户端查询 next-auth providers，keycloak 存在（env 三变量已配置）才显示；
 * 游客页面不受影响——仅登录页主动入口。
 */
export function PlatformOidcLoginButton() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;
    fetch('/api/auth/providers')
      .then((response) => (response.ok ? response.json() : []))
      .then((providers: Array<{ id: string }>) => {
        if (active) {
          setEnabled(providers.some((provider) => provider.id === 'keycloak'));
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
    <a
      href={`/api/auth/signin/keycloak?callbackUrl=${encodeURIComponent(callbackUrl)}`}
      className="block w-full rounded-md border border-input bg-secondary px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-secondary/80"
    >
      统一身份登录（校园账号）
    </a>
  );
}
