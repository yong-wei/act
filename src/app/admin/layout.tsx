import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { ActionStatusPanel } from '@/components/platform/action-status';
import { AppShell } from '@/components/platform/app-shell';
import { RoleWorkspaceShell } from '@/components/platform/role-workspace-shell';
import { getServerAuthSession } from '@/lib/auth';
import { buildPlatformRecoveryState } from '@/lib/platform-recovery-contract';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }
  if (session.user.role !== UserRole.ADMIN) {
    const state = buildPlatformRecoveryState({
      kind: 'permission-boundary',
      sourceRoute: '/admin',
      targetLabel: '管理员控制台',
      recoveryAction: '返回工作台或切换管理员账号',
    });

    return (
      <AppShell
        viewerRole={session.user.role === UserRole.TEACHER ? 'teacher' : 'student'}
        title="管理员后台"
        subtitle="权限边界"
        activeHref="/admin"
        sidebarMode="collapsible"
      >
        <section className="flex min-h-[60vh] items-center justify-center px-6 py-12">
          <div className="w-full max-w-xl rounded-xl border border-platform-border bg-platform-surface p-6 shadow-sm">
            <ActionStatusPanel
              state={state}
              action={(
                <Link href="/dashboard" className="inline-flex rounded-lg border border-platform-border px-3 py-2 text-sm text-platform-fg-primary hover:border-platform-border-strong hover:text-platform-action-primary">
                  返回工作台
                </Link>
              )}
            />
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <RoleWorkspaceShell
      workspaceRole="admin"
      title="管理员后台"
      subtitle="用户、配置、统计和数据治理入口"
      user={session.user}
    >
      {children}
    </RoleWorkspaceShell>
  );
}
