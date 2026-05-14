import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';

import { DataGovernanceDashboard } from '@/features/admin/data-governance-dashboard';
import { getServerAuthSession } from '@/lib/auth';

export default async function AdminDataGovernancePage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== UserRole.ADMIN) {
    redirect('/');
  }

  return (
    <DataGovernanceDashboard
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: 'ADMIN',
      }}
    />
  );
}
