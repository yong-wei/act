import { redirect } from 'next/navigation';
import { UserRole } from '@prisma/client';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { AdminStatesDashboard } from '@/features/admin/states/admin-states-dashboard';

export default async function AdminStatesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    action?: string;
    focus?: string;
    format?: string;
  }>;
}) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect(buildLoginRedirectForPath('/admin/states'));
  }

  if (session.user.role !== UserRole.ADMIN) {
    redirect('/');
  }

  const params = await searchParams;

  return (
    <AdminStatesDashboard
      initialExportQuery={params ?? null}
      currentUser={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: 'ADMIN',
      }}
    />
  );
}
