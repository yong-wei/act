import { UserRole } from '@prisma/client';
import { getServerAuthSession } from '@/lib/auth';

export async function requireAdminSession() {
  const session = await getServerAuthSession();

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return null;
  }

  return session;
}
