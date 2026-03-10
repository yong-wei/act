import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Home, Ship } from 'lucide-react';

import { getServerAuthSession } from '@/lib/auth';
import { UserMenu } from '@/components/shared/user-menu';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'TEACHER') {
    if (session.user.role === 'ADMIN') {
      redirect('/admin');
    } else {
      redirect('/dashboard');
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-gradient-to-b dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
      {/* 顶部导航栏 */}
      <header className="relative z-20 border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              <Home className="h-5 w-5" />
              <span className="text-sm">返回首页</span>
            </Link>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <Ship className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-white">教师工作台</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">课程编排与班级管理</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <UserMenu user={session.user} />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
