'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { UserMenu } from '@/components/shared/user-menu';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

import { AppShell, type AppShellWorkspaceSlots } from './app-shell';

const roleAccountTargets = {
  teacher: { href: '/teacher', label: '个人中心' },
  admin: { href: '/admin', label: '个人中心' },
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
      breadcrumbs={[{ label: '首页', href: '/' }, { label: title }]}
      workspaceSlots={workspaceSlots}
      userMenu={(
        <UserMenu
          user={user}
          accountHref={accountTarget.href}
          accountLabel={accountTarget.label}
        />
      )}
    >
      {children}
    </AppShell>
  );
}
