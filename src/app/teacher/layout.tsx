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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* 顶部导航栏 */}
      <header className="border-b border-slate-800 bg-slate-950/80 px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 text-slate-400 transition hover:text-white">
              <Home className="h-5 w-5" />
              <span className="text-sm">返回首页</span>
            </Link>
            <div className="h-6 w-px bg-slate-700" />
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                <Ship className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">教师工作台</h1>
                <p className="text-xs text-slate-400">课程编排与班级管理</p>
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
