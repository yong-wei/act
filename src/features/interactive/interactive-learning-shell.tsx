'use client';

import type { ReactNode } from 'react';

import { AppShell, type AppBreadcrumbItem } from '@/components/platform/app-shell';
import { AdaptivePathJourneyControlFromRoute } from '@/features/personalization/experience/adaptive-path-journey-control';

const INTERACTIVE_LEARNING_BREADCRUMBS: Record<string, readonly AppBreadcrumbItem[]> = {
  '/interactive-learning': [
    { label: '首页', href: '/' },
    { label: '互动学习' },
  ],
  '/interactive-learning/courses': [
    { label: '首页', href: '/' },
    { label: '互动学习', href: '/interactive-learning' },
    { label: '互动课程' },
  ],
  '/interactive-learning/chapter-components': [
    { label: '首页', href: '/' },
    { label: '互动学习', href: '/interactive-learning' },
    { label: '章节组件' },
  ],
  '/interactive-learning/cross-domain-exploration': [
    { label: '首页', href: '/' },
    { label: '互动学习', href: '/interactive-learning' },
    { label: '跨域探索' },
  ],
  '/interactive-learning/multi-representation-linkage': [
    { label: '首页', href: '/' },
    { label: '互动学习', href: '/interactive-learning' },
    { label: '跨域探索', href: '/interactive-learning/cross-domain-exploration' },
    { label: '多表征联动' },
  ],
};

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
      breadcrumbs={breadcrumbs ?? INTERACTIVE_LEARNING_BREADCRUMBS[activeHref]}
      actions={actions}
      activeHref={activeHref}
      sidebarMode="collapsible"
      journeyControl={<AdaptivePathJourneyControlFromRoute />}
      className="surface-page"
    >
      <div data-platform-learning-atlas-shell="student-secondary-route">
        {children}
      </div>
    </AppShell>
  );
}
