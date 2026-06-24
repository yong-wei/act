import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { AdminDashboard } from '@/features/admin/admin-dashboard';
import { getServerAuthSession } from '@/lib/auth';
import { normalizeAdminUsersQueryContract } from '@/lib/api-ui-contracts';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    search?: string;
    role?: string;
    page?: string;
    pageSize?: string;
    action?: string;
    targetId?: string;
    userId?: string;
  }>;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== UserRole.ADMIN) {
    redirect('/');
  }
  const params = await searchParams;

  return (
    <AdminDashboard
      initialUsersQuery={normalizeAdminUsersQueryContract(params ?? {})}
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: 'ADMIN',
      }}
    />
  );
}
