'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/components/providers/theme-provider';
import { cn } from '@/lib/utils';

import type { PlatformNavigationItem, PlatformRole } from './platform-ui-contracts';

export interface AppBreadcrumbItem {
  label: string;
  href?: string;
}

export interface AppShellProps {
  role: PlatformRole;
  navigation: readonly PlatformNavigationItem[];
  breadcrumbs?: readonly AppBreadcrumbItem[];
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  userMenu?: ReactNode;
  activeHref?: string;
  sidebarMode?: 'fixed' | 'collapsible' | 'hidden';
  children: ReactNode;
  className?: string;
}

export interface AppHeaderProps {
  role: PlatformRole;
  title: string;
  subtitle?: string;
  breadcrumbs?: readonly AppBreadcrumbItem[];
  actions?: ReactNode;
  userMenu?: ReactNode;
  className?: string;
}

export interface AppSidebarProps {
  navigation: readonly PlatformNavigationItem[];
  activeHref?: string;
  className?: string;
}

export interface PlatformSurfaceProps {
  children: ReactNode;
  variant?: 'default' | 'raised' | 'overlay' | 'muted';
  className?: string;
}

const roleLabels: Record<PlatformRole, string> = {
  student: '学生',
  teacher: '教师',
  admin: '管理',
  audit: '审计',
};

interface NavigationRenderItem {
  item: PlatformNavigationItem;
  depth: number;
}

function normalizeRoutePath(href: string) {
  const path = href.split(/[?#]/, 1)[0];
  return path || '/';
}

function flattenNavigationItems(
  navigation: readonly PlatformNavigationItem[],
  depth = 0,
): NavigationRenderItem[] {
  return navigation.flatMap((item) => [
    { item, depth },
    ...(item.children ? flattenNavigationItems(item.children, depth + 1) : []),
  ]);
}

function isNavigationMatch(itemHref: string, activeHref?: string) {
  if (!activeHref) return false;
  const itemPath = normalizeRoutePath(itemHref);
  const activePath = normalizeRoutePath(activeHref);
  if (activePath === itemPath) return true;
  if (itemPath === '/') return false;
  return activePath.startsWith(`${itemPath}/`);
}

function getActiveNavigationItemId(navigation: readonly PlatformNavigationItem[], activeHref?: string) {
  return flattenNavigationItems(navigation)
    .map(({ item }) => item)
    .filter((item) => isNavigationMatch(item.href, activeHref))
    .sort((left, right) => normalizeRoutePath(right.href).length - normalizeRoutePath(left.href).length)[0]?.id;
}

function renderNavigationLink(
  item: PlatformNavigationItem,
  activeItemId: string | undefined,
  variant: 'sidebar' | 'mobile',
  depth = 0,
) {
  const active = item.id === activeItemId;
  return (
    <Link
      key={item.id}
      href={item.href}
      className={cn(
        variant === 'sidebar'
          ? 'block rounded-md px-3 py-2 text-sm font-medium transition'
          : 'inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium transition',
        variant === 'sidebar' && depth > 0 && 'ml-3 border-l border-platform-border pl-3',
        active
          ? 'bg-platform-action-subtle text-platform-action-primary'
          : 'text-platform-fg-secondary hover:bg-platform-action-hover hover:text-platform-fg-primary',
      )}
    >
      {item.label}
    </Link>
  );
}

export function PlatformSurface({ children, variant = 'default', className }: PlatformSurfaceProps) {
  return (
    <section
      className={cn(
        'rounded-lg border text-platform-fg-primary',
        variant === 'default' && 'border-platform-border bg-platform-surface',
        variant === 'raised' && 'border-platform-border-strong bg-platform-surface-raised shadow-sm',
        variant === 'overlay' && 'border-platform-border-strong bg-platform-surface-overlay shadow-lg',
        variant === 'muted' && 'border-platform-border bg-platform-canvas-muted',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function AppBreadcrumb({ items = [] }: { items?: readonly AppBreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-xs text-platform-fg-muted">
      {items.map((item, index) => {
        const current = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-2">
            {index > 0 ? <span className="text-platform-border-strong">/</span> : null}
            {item.href && !current ? (
              <Link href={item.href} className="truncate hover:text-platform-action-primary">
                {item.label}
              </Link>
            ) : (
              <span className={cn('truncate', current && 'text-platform-fg-secondary')}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function ThemeSwitcher({ className }: { className?: string }) {
  const { mounted, theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={!mounted}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-md border border-platform-border bg-platform-surface text-platform-fg-secondary transition hover:border-platform-border-strong hover:text-platform-action-primary disabled:opacity-60',
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function AppHeader({
  role,
  title,
  subtitle,
  breadcrumbs,
  actions,
  userMenu,
  className,
}: AppHeaderProps) {
  return (
    <header className={cn('border-b border-platform-border bg-platform-surface-raised', className)}>
      <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="min-w-0 space-y-1">
          <AppBreadcrumb items={breadcrumbs} />
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-md bg-platform-action-subtle px-2 py-1 text-xs font-medium text-platform-action-primary">
              {roleLabels[role]}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-platform-fg-primary">{title}</h1>
              {subtitle ? <p className="truncate text-sm text-platform-fg-secondary">{subtitle}</p> : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <ThemeSwitcher />
          {userMenu}
        </div>
      </div>
    </header>
  );
}

export function AppSidebar({ navigation, activeHref, className }: AppSidebarProps) {
  const activeItemId = getActiveNavigationItemId(navigation, activeHref);
  const renderItems = flattenNavigationItems(navigation);
  return (
    <aside className={cn('border-r border-platform-border bg-platform-canvas-muted px-3 py-4', className)}>
      <nav className="space-y-1">
        {renderItems.map(({ item, depth }) => renderNavigationLink(item, activeItemId, 'sidebar', depth))}
      </nav>
    </aside>
  );
}

export function AppShell({
  role,
  navigation,
  breadcrumbs,
  title = '平台工作台',
  subtitle,
  actions,
  userMenu,
  activeHref,
  sidebarMode = 'fixed',
  children,
  className,
}: AppShellProps) {
  const showSidebar = sidebarMode !== 'hidden';
  const activeItemId = getActiveNavigationItemId(navigation, activeHref);
  const renderItems = flattenNavigationItems(navigation);
  return (
    <main className={cn('min-h-screen bg-platform-canvas text-platform-fg-primary', className)}>
      <div className={cn('grid min-h-screen', showSidebar && 'lg:grid-cols-[248px_1fr]')}>
        {showSidebar ? <AppSidebar navigation={navigation} activeHref={activeHref} className="hidden lg:block" /> : null}
        <div className="min-w-0">
          <AppHeader
            role={role}
            title={title}
            subtitle={subtitle}
            breadcrumbs={breadcrumbs}
            actions={actions}
            userMenu={userMenu}
          />
          {showSidebar && navigation.length > 0 ? (
            <nav aria-label="平台导航" className="border-b border-platform-border bg-platform-surface px-4 py-2 lg:hidden">
              <div className="flex gap-2 overflow-x-auto">
                {renderItems.map(({ item }) => renderNavigationLink(item, activeItemId, 'mobile'))}
              </div>
            </nav>
          ) : null}
          <div className="px-4 py-5 sm:px-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
