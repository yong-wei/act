import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileCheck, Home } from 'lucide-react';

import { getServerAuthSession } from '@/lib/auth';
import { UserMenu } from '@/components/shared/user-menu';
import { TeacherOperationsNav } from '@/features/teacher/teacher-operations-nav';

export default async function TeacherReportLedgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div
      className="surface-page"
      data-commercial-operations-workspace="teacher-report-ledger"
      data-commercial-workspace-zone="context-strip"
    >
      <header className="surface-topbar px-6 py-4">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-6">
              <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap text-subtle transition hover:text-foreground">
                <Home className="h-5 w-5" />
                <span className="text-sm">返回首页</span>
              </Link>
              <div className="hidden h-6 w-px bg-border sm:block" />
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-foreground">报告评分工作台</h1>
                  <p className="max-w-[20rem] text-xs leading-5 text-subtle">文档评分、证据复核、审批与回写</p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <UserMenu user={session.user} />
            </div>
          </div>
          {session.user.role === 'TEACHER' ? <TeacherOperationsNav /> : null}
        </div>
      </header>

      {children}
    </div>
  );
}
