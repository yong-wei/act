'use client';

import type { ReactNode } from 'react';

import { AppShell, type AppShellRouteMetadata } from '@/components/platform/app-shell';
import { getPlatformRouteNavigation } from '@/lib/platform-role-navigation';

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

const projectEntries = getPlatformRouteNavigation('/arena', 'student');

const arenaRouteMetadata: AppShellRouteMetadata = {
  frame: 'mission-workspace',
  themeSupport: ['light', 'dark'],
  desktopNavigation: 'collapsible',
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
