import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { getServerAuthSession } from '@/lib/auth';
import { AdminStatesDashboard } from '@/features/admin/states/admin-states-dashboard';

export default async function AdminStatesPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== UserRole.ADMIN) {
    redirect('/');
  }

  return (
    <AdminStatesDashboard
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: 'ADMIN',
      }}
    />
  );
}

