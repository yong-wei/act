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
  '/interactive-learning/pid-simulator': [
    { label: '首页', href: '/' },
    { label: '互动学习', href: '/interactive-learning' },
    { label: '跨域探索', href: '/interactive-learning/cross-domain-exploration' },
    { label: 'PID 控制仿真器' },
  ],
  '/interactive-learning/control-map': [
    { label: '首页', href: '/' },
    { label: '互动学习', href: '/interactive-learning' },
    { label: '跨域探索', href: '/interactive-learning/cross-domain-exploration' },
    { label: '控制理论地图' },
  ],
};

export function InteractiveLearningShell({
  activeHref,
  title,
  subtitle,
  breadcrumbs,
  actions,
  fillViewport = false,
  children,
}: {
  activeHref: string;
  title: string;
  subtitle: string;
  breadcrumbs?: readonly AppBreadcrumbItem[];
  actions?: ReactNode;
  /** 全高画布页面（如控制理论地图）占满外壳内容区，不随页面滚动。 */
  fillViewport?: boolean;
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
      fillViewport={fillViewport}
      className="surface-page"
    >
      <div
        data-platform-learning-atlas-shell="student-secondary-route"
        className={fillViewport ? 'flex min-h-0 flex-1 flex-col' : undefined}
      >
        {children}
      </div>
    </AppShell>
  );
}
