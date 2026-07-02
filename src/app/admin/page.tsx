import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import Link from 'next/link';

import { ActionStatusPanel } from '@/components/platform/action-status';
import { getServerAuthSession } from '@/lib/auth';
import { buildPlatformRecoveryState } from '@/lib/platform-recovery-contract';
import { AdminConsoleHome } from '@/features/admin/admin-console-home';

export default async function AdminPage() {
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900/70 px-6 py-8">
          <ActionStatusPanel
            state={state}
            action={(
              <Link href="/dashboard" className="inline-flex rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100 hover:border-cyan-500 hover:text-cyan-200">
                返回工作台
              </Link>
            )}
          />
        </div>
      </div>
    );
  }

  return (
    <AdminConsoleHome
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: 'ADMIN',
      }}
    />
  );
}
