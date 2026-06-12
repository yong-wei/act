'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { User } from 'lucide-react';

import { AppShell, type AppShellRouteMetadata } from '@/components/platform/app-shell';
import { getStudentLearningIntentNavigationGroups } from '@/lib/platform-role-navigation';

interface ArenaBreadcrumb {
  label: string;
  href: string;
}

interface ArenaPageShellProps {
  breadcrumbs: ArenaBreadcrumb[];
  activePath: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const projectEntries = getStudentLearningIntentNavigationGroups().flatMap((group) => group.entries);

const arenaRouteMetadata: AppShellRouteMetadata = {
  frame: 'mission-workspace',
  themeSupport: ['light', 'dark'],
  mobileNavigation: 'drawer',
  navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
  floatingDock: 'collapsed',
  contextualReturn: {
    sourceContext: 'arena-challenge',
    targetHint: 'Return to the Arena challenge list when leaving an Arena route.',
    fallbackHref: '/arena',
  },
};

export function ArenaPageShell({
  breadcrumbs,
  activePath,
  title = '竞技场',
  subtitle = 'Arena workspace',
  actions,
  children,
}: ArenaPageShellProps) {
  return (
    <AppShell
      viewerRole="student"
      title={title}
      subtitle={subtitle}
      activeHref={activePath}
      breadcrumbs={breadcrumbs}
      navigation={projectEntries}
      sidebarMode="collapsible"
      routeMetadata={arenaRouteMetadata}
      actions={actions}
      userMenu={(
        <Link
          href="/profile"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-platform-border bg-platform-surface px-3 text-sm font-medium text-platform-fg-primary transition hover:border-platform-border-strong hover:text-platform-action-primary"
        >
          <span className="hidden sm:inline">个人中心</span>
          <User className="h-4 w-4" />
        </Link>
      )}
      className="min-h-screen"
    >
      <div
        data-arena-workspace-shell="true"
        data-mobile-navigation="drawer"
      >
        {children}
      </div>
    </AppShell>
  );
}
