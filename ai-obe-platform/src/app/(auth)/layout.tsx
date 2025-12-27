import type { ReactNode } from 'react';
import Link from 'next/link';
import { Ship } from 'lucide-react';

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* 顶部导航栏 */}
      <nav className="border-b border-white/10">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">AI-OBE船舶智控平台</div>
              <div className="text-xs text-white/50">Mission Control for Maritime Education</div>
            </div>
          </Link>
          <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <Link href="/interactive-learning" className="transition-colors hover:text-amber-500">
              互动学习
            </Link>
            <Link href="/knowledge" className="transition-colors hover:text-amber-500">
              知识图谱
            </Link>
            <Link href="/ethics" className="transition-colors hover:text-amber-500">
              思政沙盘
            </Link>
            <Link href="/ai" className="transition-colors hover:text-amber-500">
              AI工坊
            </Link>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      <div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md items-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
