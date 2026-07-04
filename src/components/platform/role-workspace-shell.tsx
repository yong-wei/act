'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { UserMenu } from '@/components/shared/user-menu';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

import { AppShell, type AppShellWorkspaceSlots } from './app-shell';

const roleAccountTargets = {
  teacher: { href: '/teacher', label: '教师工作台' },
  admin: { href: '/admin', label: '管理员后台' },
} as const;

type RoleWorkspaceShellProps = {
  workspaceRole: Extract<PlatformRole, 'teacher' | 'admin'>;
  title: string;
  subtitle: string;
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  workspaceSlots?: AppShellWorkspaceSlots;
  children: ReactNode;
};

export function RoleWorkspaceShell({
  workspaceRole,
  title,
  subtitle,
  user,
  workspaceSlots,
  children,
}: RoleWorkspaceShellProps) {
  const pathname = usePathname();
  const accountTarget = roleAccountTargets[workspaceRole];

  return (
    <AppShell
      viewerRole={workspaceRole}
      title={title}
      subtitle={subtitle}
      activeHref={pathname}
      sidebarMode="collapsible"
      workspaceSlots={workspaceSlots}
      userMenu={(
        <UserMenu
          user={user}
          variant={workspaceRole === 'admin' ? 'admin' : 'default'}
          accountHref={accountTarget.href}
          accountLabel={accountTarget.label}
        />
      )}
    >
      {children}
    </AppShell>
  );
}
