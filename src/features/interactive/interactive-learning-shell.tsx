'use client';

import type { ReactNode } from 'react';

import { AppShell, type AppBreadcrumbItem } from '@/components/platform/app-shell';

export function InteractiveLearningShell({
  activeHref,
  title,
  subtitle,
  breadcrumbs,
  actions,
  children,
}: {
  activeHref: string;
  title: string;
  subtitle: string;
  breadcrumbs?: readonly AppBreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell
      viewerRole="student"
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      actions={actions}
      activeHref={activeHref}
      sidebarMode="collapsible"
      className="surface-page"
    >
      <div data-platform-learning-atlas-shell="student-secondary-route">
        {children}
      </div>
    </AppShell>
  );
}
