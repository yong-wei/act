import type { ReactNode } from 'react';
import Link from 'next/link';

import { PlatformBrandLockup } from '@/components/shared/platform-brand-lockup';

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="surface-page" data-commercial-workspace="auth">
      {/* 顶部导航栏 */}
      <nav className="border-b border-slate-200 dark:border-white/10">
        <div className="w-full flex items-center justify-between px-6 py-4">
          <PlatformBrandLockup />
          <div className="hidden items-center gap-6 text-sm text-slate-600 dark:text-white/70 md:flex">
            <Link href="/interactive-learning" className="transition-colors hover:text-amber-500 dark:hover:text-amber-500">
              互动学习
            </Link>
            <Link href="/knowledge" className="transition-colors hover:text-amber-500 dark:hover:text-amber-500">
              知识图谱
            </Link>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      <div className="flex min-h-[calc(100vh-73px)] w-full items-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
