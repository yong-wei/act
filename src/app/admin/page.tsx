import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { getServerAuthSession } from '@/lib/auth';
import { AdminConsoleHome } from '@/features/admin/admin-console-home';

export default async function AdminPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== UserRole.ADMIN) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-6 py-8 text-center">
          <p className="text-lg font-semibold">权限不足</p>
          <p className="mt-2 text-sm text-slate-400">
            该页面仅供管理员使用，请联系系统管理员。
          </p>
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
