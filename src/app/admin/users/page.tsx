import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { AdminDashboard } from '@/features/admin/admin-dashboard';
import { getServerAuthSession } from '@/lib/auth';

export default async function AdminUsersPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== UserRole.ADMIN) {
    redirect('/');
  }

  return (
    <AdminDashboard
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: 'ADMIN',
      }}
    />
  );
}
