'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Moon, Settings, Sun } from 'lucide-react';

import { useTheme } from '@/components/providers/theme-provider';
import { usePageFloatingControls } from '@/components/shared/page-floating-controls';
import {
  getPlatformRouteNavigation,
  resolvePlatformRouteInventory,
  type PlatformFloatingDockRouteBehavior,
  type PlatformMobileNavigationBehavior,
  type PlatformNavigationLayerId,
  type PlatformPrimaryRouteFrame,
  type PlatformPrimaryRouteInventoryEntry,
  type PlatformRouteThemeSupport,
} from '@/lib/platform-role-navigation';
import { cn } from '@/lib/utils';

import type {
  PlatformFloatingActionDockControl,
  PlatformNavigationItem,
  PlatformRole,
} from './platform-ui-contracts';

export interface AppBreadcrumbItem {
  label: string;
  href?: string;
}

export interface AppShellProps {
  role: PlatformRole;
  navigation?: readonly PlatformNavigationItem[];
  breadcrumbs?: readonly AppBreadcrumbItem[];
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  userMenu?: ReactNode;
  activeHref?: string;
  sidebarMode?: 'fixed' | 'collapsible' | 'hidden';
  routeMetadata?: AppShellRouteMetadata;
  workspaceSlots?: AppShellWorkspaceSlots;
  dockControls?: readonly AppShellDockControl[];
  children: ReactNode;
  className?: string;
}

export type AppShellWorkspaceZoneId =
  | 'context-header'
  | 'command-bar'
  | 'instrument-area'
  | 'evidence-rail'
  | 'support-drawer'
  | 'status-rail'
  | 'local-tools';

export interface AppShellWorkspaceSlots {
  contextHeader?: ReactNode;
  commandBar?: ReactNode;
  instrumentArea?: ReactNode;
  evidenceRail?: ReactNode;
  supportDrawer?: ReactNode;
  statusRail?: ReactNode;
  localTools?: ReactNode;
}

export type AppShellRouteMetadata = Pick<
  PlatformPrimaryRouteInventoryEntry,
  | 'frame'
  | 'themeSupport'
  | 'mobileNavigation'
  | 'navigationLayers'
  | 'floatingDock'
  | 'contextualReturn'
>;

export interface AppShellDockControl {
  id: string;
  label: string;
  control: PlatformFloatingActionDockControl;
  href?: string;
  disabled?: boolean;
  icon?: ReactNode;
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

const frameClassNames: Record<PlatformPrimaryRouteFrame, string> = {
  'public-entry': 'bg-platform-canvas',
  'learning-atlas': 'bg-platform-canvas',
  'mission-workspace': 'bg-platform-canvas text-platform-fg-primary',
  'knowledge-data-map': 'bg-platform-canvas-muted',
  'operations-console': 'bg-platform-canvas',
  'report-ledger': 'bg-platform-canvas-muted',
};

const contentFrameClassNames: Record<PlatformPrimaryRouteFrame, string> = {
  'public-entry': 'mx-auto max-w-5xl',
  'learning-atlas': 'mx-auto max-w-7xl',
  'mission-workspace': 'mx-auto max-w-[1600px]',
  'knowledge-data-map': 'mx-auto max-w-[1500px]',
  'operations-console': 'mx-auto max-w-[1440px]',
  'report-ledger': 'mx-auto max-w-[1480px]',
};

const contextualReturnBreadcrumbLabels: Record<string, string> = {
  '/arena': '竞技场',
  '/interactive-learning': '互动学习',
  '/assessment/adaptive-practice': '自适应练习',
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
      aria-current={active ? 'page' : undefined}
      className={cn(
        variant === 'sidebar'
          ? 'block rounded-md px-3 py-2 text-sm font-medium transition'
          : 'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition',
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

function routeDataAttribute(value?: readonly string[]) {
  return value && value.length > 0 ? value.join(' ') : undefined;
}

function getContextualReturnBreadcrumbLabel(contextualReturn: NonNullable<AppShellRouteMetadata['contextualReturn']>) {
  return contextualReturnBreadcrumbLabels[normalizeRoutePath(contextualReturn.fallbackHref)] ?? '返回';
}

function hasWorkspaceSlots(slots?: AppShellWorkspaceSlots) {
  return Boolean(slots && Object.values(slots).some(Boolean));
}

function renderAppShellWorkspaceZone({
  id,
  children,
  className,
}: {
  id: AppShellWorkspaceZoneId;
  children?: ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <section data-app-shell-zone={id} className={cn('min-w-0', className)}>
      {children}
    </section>
  );
}

function AppShellWorkspace({
  slots,
  children,
}: {
  slots?: AppShellWorkspaceSlots;
  children: ReactNode;
}) {
  if (!hasWorkspaceSlots(slots)) return <>{children}</>;
  return (
    <section data-app-shell-workspace="true" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {renderAppShellWorkspaceZone({
          id: 'context-header',
          className: 'rounded-lg border border-platform-border bg-platform-surface-raised p-4',
          children: slots?.contextHeader,
        })}
        {renderAppShellWorkspaceZone({
          id: 'command-bar',
          className: 'rounded-lg border border-platform-border bg-platform-surface px-4 py-3',
          children: slots?.commandBar,
        })}
        {renderAppShellWorkspaceZone({
          id: 'instrument-area',
          children: slots?.instrumentArea ?? children,
        })}
      </div>
      <div className="min-w-0 space-y-4">
        {renderAppShellWorkspaceZone({
          id: 'evidence-rail',
          className: 'rounded-lg border border-platform-border bg-platform-surface p-4',
          children: slots?.evidenceRail,
        })}
        {renderAppShellWorkspaceZone({
          id: 'support-drawer',
          className: 'rounded-lg border border-platform-border bg-platform-surface p-4',
          children: slots?.supportDrawer,
        })}
        {renderAppShellWorkspaceZone({
          id: 'status-rail',
          className: 'rounded-lg border border-platform-border bg-platform-surface p-4',
          children: slots?.statusRail,
        })}
        {renderAppShellWorkspaceZone({
          id: 'local-tools',
          className: 'rounded-lg border border-platform-border bg-platform-canvas-muted p-4',
          children: slots?.localTools,
        })}
      </div>
    </section>
  );
}

function AppShellFloatingDockRegistration({
  controls = [],
  behavior,
}: {
  controls?: readonly AppShellDockControl[];
  behavior: PlatformFloatingDockRouteBehavior;
}) {
  const { registerControl, setRouteDockBehavior } = usePageFloatingControls();
  const controlRegistrationSignature = controls
    .map((control) => [
      control.id,
      control.label,
      control.control,
      control.href ?? '',
      control.disabled ? 'disabled' : 'enabled',
    ].join(':'))
    .join('|');

  useEffect(() => setRouteDockBehavior(behavior), [behavior, setRouteDockBehavior]);

  useEffect(() => {
    if (behavior === 'hidden') return undefined;
    const unregister = controls.map((control, index) => registerControl({
      id: `app-shell:${control.id}`,
      label: control.label,
      ariaLabel: control.label,
      icon: control.icon ?? <Settings className="h-4 w-4 text-muted-foreground" />,
      priority: 20 + index,
      disabled: control.disabled,
      onSelect: () => {
        if (control.disabled) return;
        if (control.href) window.location.assign(control.href);
      },
    }));
    return () => unregister.forEach((cleanup) => cleanup());
  }, [behavior, controlRegistrationSignature, registerControl]);

  if (controls.length === 0) return null;

  return (
    <span
      aria-hidden="true"
      className="sr-only"
      data-platform-floating-dock-registration="true"
      data-platform-floating-dock-behavior={behavior}
      data-platform-floating-dock-controls={controls.map((control) => control.control).join(' ')}
    />
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
  routeMetadata,
  workspaceSlots,
  dockControls = [],
  children,
  className,
}: AppShellProps) {
  const resolvedRouteMetadata = routeMetadata ?? (activeHref ? resolvePlatformRouteInventory(activeHref) : undefined);
  const floatingDockBehavior = resolvedRouteMetadata?.floatingDock ?? 'enabled';
  const effectiveBreadcrumbs = breadcrumbs ?? (resolvedRouteMetadata?.contextualReturn ? [
    {
      label: getContextualReturnBreadcrumbLabel(resolvedRouteMetadata.contextualReturn),
      href: resolvedRouteMetadata.contextualReturn.fallbackHref,
    },
    { label: title },
  ] : undefined);
  const routeNavigation = navigation === undefined && activeHref ? getPlatformRouteNavigation(activeHref, role) : [];
  const effectiveNavigation = navigation ?? routeNavigation;
  const renderItems = flattenNavigationItems(effectiveNavigation);
  const showSidebar = sidebarMode !== 'hidden' && renderItems.length > 0;
  const sidebarBreakpoint = sidebarMode === 'collapsible' ? 'xl' : 'lg';
  const activeItemId = getActiveNavigationItemId(effectiveNavigation, activeHref);
  return (
    <main
      data-platform-route-frame={resolvedRouteMetadata?.frame}
      data-platform-route-theme-support={routeDataAttribute(resolvedRouteMetadata?.themeSupport as readonly PlatformRouteThemeSupport[] | undefined)}
      data-platform-route-navigation-layers={routeDataAttribute(resolvedRouteMetadata?.navigationLayers as readonly PlatformNavigationLayerId[] | undefined)}
      data-platform-mobile-navigation={resolvedRouteMetadata?.mobileNavigation as PlatformMobileNavigationBehavior | undefined}
      data-platform-floating-dock-behavior={floatingDockBehavior}
      className={cn(
        'min-h-screen bg-platform-canvas text-platform-fg-primary',
        resolvedRouteMetadata?.frame && frameClassNames[resolvedRouteMetadata.frame],
        className,
      )}
    >
      <div
        className={cn(
          'grid min-h-screen',
          showSidebar && sidebarBreakpoint === 'lg' && 'lg:grid-cols-[248px_1fr]',
          showSidebar && sidebarBreakpoint === 'xl' && 'xl:grid-cols-[248px_1fr]',
        )}
      >
        {showSidebar ? (
          <AppSidebar
            navigation={effectiveNavigation}
            activeHref={activeHref}
            className={sidebarBreakpoint === 'lg' ? 'hidden lg:block' : 'hidden xl:block'}
          />
        ) : null}
        <div className="min-w-0">
          <AppHeader
            role={role}
            title={title}
            subtitle={subtitle}
            breadcrumbs={effectiveBreadcrumbs}
            actions={actions}
            userMenu={userMenu}
          />
          {showSidebar && effectiveNavigation.length > 0 ? (
            <nav
              aria-label="平台导航"
              className={cn(
                'border-b border-platform-border bg-platform-surface px-4 py-2',
                sidebarBreakpoint === 'lg' ? 'lg:hidden' : 'xl:hidden',
              )}
            >
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {renderItems.map(({ item }) => renderNavigationLink(item, activeItemId, 'mobile'))}
              </div>
            </nav>
          ) : null}
          <div className={cn('px-4 py-5 sm:px-6', resolvedRouteMetadata?.frame && contentFrameClassNames[resolvedRouteMetadata.frame])}>
            {AppShellWorkspace({ slots: workspaceSlots, children })}
          </div>
          <AppShellFloatingDockRegistration
            controls={dockControls}
            behavior={floatingDockBehavior}
          />
        </div>
      </div>
    </main>
  );
}
