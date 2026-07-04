import { UserRole } from '@prisma/client';

import { RoleWorkspaceShell } from '@/components/platform/role-workspace-shell';
import { getServerAuthSession } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user || session.user.role !== UserRole.ADMIN) {
    return children;
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
