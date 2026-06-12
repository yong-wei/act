'use client';

import type { ReactNode } from 'react';

import { AppShell } from '@/components/platform/app-shell';

export function InteractiveLearningShell({
  activeHref,
  title,
  subtitle,
  children,
}: {
  activeHref: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <AppShell
      viewerRole="student"
      title={title}
      subtitle={subtitle}
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
