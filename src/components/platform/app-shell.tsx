'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  Database,
  FlaskConical,
  GraduationCap,
  History,
  Home,
  LogIn,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShipWheel,
  Sun,
  Trophy,
  UserCircle,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

import { useOptionalTheme } from '@/components/providers/theme-provider';
import { useOptionalPageFloatingControls } from '@/components/shared/page-floating-controls';
import {
  getPlatformCockpitHref,
  getPlatformRouteNavigation,
  resolvePlatformRouteInventory,
  type PlatformFloatingDockRouteBehavior,
  type PlatformMobileNavigationBehavior,
  type PlatformNavigationLayerId,
  type PlatformPrimaryRouteFrame,
  type PlatformPrimaryRouteInventoryEntry,
  type PlatformRouteThemeSupport,
} from '@/lib/platform-role-navigation';
import { UNIVERSAL_APP_SHELL_HEADER_ACTION_ORDER } from '@/lib/platform-appshell-contract';
import { cn } from '@/lib/utils';

import type { PlatformFloatingActionDockControl, PlatformNavigationItem, PlatformRole } from './platform-ui-contracts';

export interface AppBreadcrumbItem {
  label: string;
  href?: string;
}

export interface AppShellProps {
  viewerRole: PlatformRole;
  navigation?: readonly PlatformNavigationItem[];
  breadcrumbs?: readonly AppBreadcrumbItem[];
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  userMenu?: ReactNode;
  accountHref?: string;
  activeHref?: string;
  activeNavigationHref?: string;
  sidebarMode?: 'fixed' | 'collapsible' | 'hidden';
  routeMetadata?: AppShellRouteMetadata;
  workspaceSlots?: AppShellWorkspaceSlots;
  journeyControl?: ReactNode;
  dockControls?: readonly AppShellDockControl[];
  children: ReactNode;
  className?: string;
  /** 页头以下剩余视口由子页面铺满，不再按固定 dvh 余量截短。 */
  fillViewport?: boolean;
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
  'frame' | 'themeSupport' | 'mobileNavigation' | 'navigationLayers' | 'floatingDock' | 'contextualReturn'
> &
  Partial<Pick<PlatformPrimaryRouteInventoryEntry, 'desktopNavigation'>>;

export interface AppShellDockControl {
  id: string;
  label: string;
  control: PlatformFloatingActionDockControl;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface AppHeaderProps {
  viewerRole: PlatformRole;
  title: string;
  subtitle?: string;
  breadcrumbs?: readonly AppBreadcrumbItem[];
  actions?: ReactNode;
  userMenu?: ReactNode;
  accountHref?: string;
  className?: string;
}

export interface AppSidebarProps {
  navigation: readonly PlatformNavigationItem[];
  activeHref?: string;
  collapsed?: boolean;
  className?: string;
}

export interface PlatformSurfaceProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: 'default' | 'raised' | 'overlay' | 'muted';
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

export const APP_SHELL_COMPACT_PAGE_EDGE_CLASS = [
  'w-full',
  'px-[var(--platform-page-edge-x-mobile)]',
  'py-5',
  'sm:px-[var(--platform-page-edge-x-tablet)]',
  'lg:px-[var(--platform-page-edge-x-desktop)]',
].join(' ');

const contentFrameClassNames: Record<PlatformPrimaryRouteFrame, string> = {
  'public-entry': APP_SHELL_COMPACT_PAGE_EDGE_CLASS,
  'learning-atlas': APP_SHELL_COMPACT_PAGE_EDGE_CLASS,
  'mission-workspace': APP_SHELL_COMPACT_PAGE_EDGE_CLASS,
  'knowledge-data-map': APP_SHELL_COMPACT_PAGE_EDGE_CLASS,
  'operations-console': APP_SHELL_COMPACT_PAGE_EDGE_CLASS,
  'report-ledger': APP_SHELL_COMPACT_PAGE_EDGE_CLASS,
};

const contextualReturnBreadcrumbLabels: Record<string, string> = {
  '/arena': '竞技场',
  '/interactive-learning': '互动学习',
  '/assessment/adaptive-practice': '自适应学习路径中心',
};
const navigationIconComponents: Record<string, LucideIcon> = {
  adaptive: BrainCircuit,
  analytics: BarChart3,
  arena: Trophy,
  classes: Users,
  database: Database,
  experiments: FlaskConical,
  history: History,
  home: Home,
  interactive: GraduationCap,
  knowledge: BookOpen,
  konling: BrainCircuit,
  'lesson-plans': BookOpen,
  login: LogIn,
  profile: UserCircle,
  resources: BookOpen,
  settings: Settings,
  ship: ShipWheel,
  teacher: GraduationCap,
  users: Users,
  workbench: Wrench,
};
const mobileDrawerFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const APP_SHELL_NAVIGATION_PREFERENCE_STORAGE_KEY = 'act:app-shell:navigation-preference';

export type AppShellNavigationPreference = 'collapsed' | 'expanded';

type AppShellNavigationPreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function resolveAppShellNavigationPreference(value?: string | null): AppShellNavigationPreference {
  return value === 'expanded' ? 'expanded' : 'collapsed';
}

export function readAppShellNavigationPreference(
  storage?: Pick<AppShellNavigationPreferenceStorage, 'getItem'> | null,
): AppShellNavigationPreference {
  if (!storage) return 'collapsed';
  try {
    return resolveAppShellNavigationPreference(storage.getItem(APP_SHELL_NAVIGATION_PREFERENCE_STORAGE_KEY));
  } catch {
    return 'collapsed';
  }
}

export function writeAppShellNavigationPreference(
  preference: AppShellNavigationPreference,
  storage?: Pick<AppShellNavigationPreferenceStorage, 'setItem'> | null,
) {
  if (!storage) return;
  try {
    storage.setItem(APP_SHELL_NAVIGATION_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // Ignore unavailable or blocked browser storage; the collapsed default remains safe.
  }
}

export function getBrowserNavigationPreferenceStorage() {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

interface NavigationRenderItem {
  item: PlatformNavigationItem;
  depth: number;
}

function normalizeRoutePath(href: string) {
  const path = href.split(/[?#]/, 1)[0];
  return path || '/';
}

function flattenNavigationItems(navigation: readonly PlatformNavigationItem[], depth = 0): NavigationRenderItem[] {
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

export function getAppShellDesktopGridClassName({
  showSidebar,
  sidebarBreakpoint,
  navigationCollapsed = false,
  fillViewport = false,
}: {
  showSidebar: boolean;
  sidebarBreakpoint: 'lg' | 'xl';
  navigationCollapsed?: boolean;
  fillViewport?: boolean;
}) {
  return cn(
    'grid',
    fillViewport ? 'h-dvh min-h-0 overflow-hidden' : 'min-h-screen',
    showSidebar &&
      sidebarBreakpoint === 'lg' &&
      (navigationCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[248px_minmax(0,1fr)]'),
    showSidebar &&
      sidebarBreakpoint === 'xl' &&
      (navigationCollapsed ? 'xl:grid-cols-[72px_minmax(0,1fr)]' : 'xl:grid-cols-[248px_minmax(0,1fr)]'),
  );
}

function renderNavigationIcon(item: PlatformNavigationItem, className?: string) {
  const Icon = item.iconKey ? navigationIconComponents[item.iconKey] : undefined;
  const ResolvedIcon = Icon ?? Settings;
  return (
    <ResolvedIcon
      aria-hidden="true"
      data-platform-navigation-icon={item.iconKey ?? 'fallback'}
      className={cn('h-4 w-4 shrink-0', className)}
    />
  );
}

function renderNavigationLink(
  item: PlatformNavigationItem,
  activeItemId: string | undefined,
  variant: 'sidebar' | 'mobile',
  depth = 0,
  collapsed = false,
  onNavigate?: () => void,
) {
  const active = item.id === activeItemId;
  return (
    <Link
      key={item.id}
      href={item.href}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      data-app-shell-nav-link-label={item.label}
      data-app-shell-nav-link-href={item.href}
      className={cn(
        variant === 'sidebar'
          ? 'flex min-h-10 items-center rounded-md px-3 py-2 text-sm font-medium transition'
          : 'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition',
        variant === 'sidebar' && depth > 0 && 'ml-3 border-l border-platform-border pl-3',
        variant === 'sidebar' && collapsed && 'justify-center px-2',
        active
          ? 'bg-platform-action-subtle text-platform-action-primary'
          : 'text-platform-fg-secondary hover:bg-platform-action-hover hover:text-platform-fg-primary',
      )}
    >
      {collapsed ? renderNavigationIcon(item) : <span>{item.label}</span>}
    </Link>
  );
}

export function PlatformSurface({ children, variant = 'default', className, ...props }: PlatformSurfaceProps) {
  return (
    <section
      {...props}
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
  const themeAction = UNIVERSAL_APP_SHELL_HEADER_ACTION_ORDER.find((action) => action.id === 'theme-switch');
  const themeContext = useOptionalTheme();
  const mounted = themeContext?.mounted ?? false;
  const theme = themeContext?.theme ?? 'light';
  const toggleTheme = themeContext?.toggleTheme ?? (() => {});
  const isDark = mounted ? theme === 'dark' : true;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={!mounted}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      data-app-shell-header-action={themeAction?.id}
      data-app-shell-header-action-owner={themeAction?.owner}
      data-app-shell-header-action-order={themeAction?.order}
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
  viewerRole,
  title,
  subtitle,
  breadcrumbs,
  actions,
  userMenu,
  accountHref,
  className,
}: AppHeaderProps) {
  const personalCenterAction = UNIVERSAL_APP_SHELL_HEADER_ACTION_ORDER.find(
    (action) => action.id === 'personal-center',
  );
  const personalCenter = userMenu ?? (
    <Link
      href={accountHref ?? getPlatformCockpitHref(viewerRole)}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-platform-border bg-platform-surface px-3 text-sm font-medium text-platform-fg-primary transition hover:border-platform-border-strong hover:text-platform-action-primary"
    >
      个人中心
    </Link>
  );
  return (
    <header className={cn('border-b border-platform-border bg-platform-surface-raised print:hidden', className)}>
      <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="min-w-0 space-y-1">
          <AppBreadcrumb items={breadcrumbs} />
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-md bg-platform-action-subtle px-2 py-1 text-xs font-medium text-platform-action-primary">
              {roleLabels[viewerRole]}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-platform-fg-primary">{title}</h1>
              {subtitle ? <p className="truncate text-sm text-platform-fg-secondary">{subtitle}</p> : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions ? (
            <div className="flex items-center gap-2" data-app-shell-route-local-actions="true">
              {actions}
            </div>
          ) : null}
          <div className="flex items-center gap-2" data-app-shell-header-action-pair="theme-switch personal-center">
            <ThemeSwitcher />
            <div
              data-app-shell-header-action={personalCenterAction?.id}
              data-app-shell-header-action-owner={personalCenterAction?.owner}
              data-app-shell-header-action-order={personalCenterAction?.order}
            >
              {personalCenter}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function AppShellHeaderDockActions({ controls }: { controls: readonly AppShellDockControl[] }) {
  if (controls.length === 0) return null;

  return (
    <>
      {controls.map((control) => {
        const icon = control.icon ?? <Settings className="h-4 w-4" />;
        const className =
          'inline-flex h-9 items-center justify-center gap-2 rounded-md border border-platform-border bg-platform-surface px-3 text-xs font-medium text-platform-fg-secondary transition hover:border-platform-border-strong hover:text-platform-action-primary disabled:cursor-not-allowed disabled:opacity-60';
        const content = (
          <>
            {icon}
            <span className="hidden sm:inline">{control.label}</span>
          </>
        );

        if (control.href && !control.disabled && !control.onSelect) {
          return (
            <Link
              key={control.id}
              href={control.href}
              aria-label={control.label}
              className={className}
              data-platform-shell-dock-action={control.control}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={control.id}
            type="button"
            disabled={control.disabled}
            onClick={control.onSelect}
            aria-label={control.label}
            className={className}
            data-platform-shell-dock-action={control.control}
          >
            {content}
          </button>
        );
      })}
    </>
  );
}

export function AppSidebar({ navigation, activeHref, collapsed = false, className }: AppSidebarProps) {
  const activeItemId = getActiveNavigationItemId(navigation, activeHref);
  const renderItems = flattenNavigationItems(navigation);
  return (
    <aside
      data-shell-navigation-state={collapsed ? 'collapsed' : 'expanded'}
      className={cn(
        'border-r border-platform-border bg-platform-canvas-muted px-3 py-4 print:hidden',
        collapsed && 'px-2',
        className,
      )}
    >
      <nav className="space-y-1">
        {renderItems.map(({ item, depth }) => renderNavigationLink(item, activeItemId, 'sidebar', depth, collapsed))}
      </nav>
    </aside>
  );
}

function CollapsibleAppSidebar({
  navigation,
  activeHref,
  navigationCollapsed,
  onNavigationCollapsedChange,
  className,
}: {
  navigation: readonly PlatformNavigationItem[];
  activeHref?: string;
  navigationCollapsed: boolean;
  onNavigationCollapsedChange: (collapsed: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn('border-r border-platform-border bg-platform-canvas-muted print:hidden', className)}
      data-shell-navigation-state={navigationCollapsed ? 'collapsed' : 'expanded'}
    >
      <div className="border-b border-platform-border px-3 py-3">
        <button
          type="button"
          aria-label={navigationCollapsed ? '展开平台导航' : '收起平台导航'}
          aria-expanded={!navigationCollapsed}
          onClick={() => onNavigationCollapsedChange(!navigationCollapsed)}
          className={cn(
            'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-platform-border bg-platform-surface text-sm font-medium text-platform-fg-secondary transition hover:border-platform-border-strong hover:text-platform-action-primary',
            navigationCollapsed && 'w-10',
          )}
        >
          {navigationCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          <span className={cn(navigationCollapsed && 'sr-only')}>{navigationCollapsed ? '展开导航' : '收起导航'}</span>
        </button>
      </div>
      <AppSidebar navigation={navigation} activeHref={activeHref} collapsed={navigationCollapsed} />
    </div>
  );
}

function AppShellDesktopLayout({
  showSidebar,
  allowSidebarCollapse,
  sidebarBreakpoint,
  effectiveNavigation,
  activeHref,
  activeItemId,
  resolvedRouteMetadata,
  viewerRole,
  title,
  subtitle,
  actions,
  userMenu,
  accountHref,
  effectiveBreadcrumbs,
  workspaceSlots,
  journeyControl,
  dockControls,
  floatingDockBehavior,
  fillViewport = false,
  children,
}: {
  showSidebar: boolean;
  allowSidebarCollapse: boolean;
  sidebarBreakpoint: 'lg' | 'xl';
  effectiveNavigation: readonly PlatformNavigationItem[];
  activeHref?: string;
  activeItemId?: string;
  resolvedRouteMetadata?: AppShellRouteMetadata;
  viewerRole: PlatformRole;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  userMenu?: ReactNode;
  accountHref?: string;
  effectiveBreadcrumbs?: readonly AppBreadcrumbItem[];
  workspaceSlots?: AppShellWorkspaceSlots;
  journeyControl?: ReactNode;
  dockControls: readonly AppShellDockControl[];
  floatingDockBehavior: PlatformFloatingDockRouteBehavior;
  fillViewport?: boolean;
  children: ReactNode;
}) {
  const [navigationPreference, setNavigationPreference] = useState<AppShellNavigationPreference>('collapsed');
  const renderItems = flattenNavigationItems(effectiveNavigation);
  const floatingDockControls = dockControls.filter((control) => control.control === 'konling');
  const headerDockControls = dockControls.filter((control) => control.control !== 'konling');
  const renderMobileNavigation =
    showSidebar && effectiveNavigation.length > 0 && resolvedRouteMetadata?.mobileNavigation !== 'hidden-immersive';
  const navigationCollapsed = allowSidebarCollapse ? navigationPreference === 'collapsed' : false;
  const headerActions =
    actions || headerDockControls.length > 0 ? (
      <>
        {actions}
        <AppShellHeaderDockActions controls={headerDockControls} />
      </>
    ) : undefined;

  useEffect(() => {
    setNavigationPreference(readAppShellNavigationPreference(getBrowserNavigationPreferenceStorage()));
  }, []);

  const handleNavigationCollapsedChange = useCallback((collapsed: boolean) => {
    const nextPreference = collapsed ? 'collapsed' : 'expanded';
    setNavigationPreference(nextPreference);
    writeAppShellNavigationPreference(nextPreference, getBrowserNavigationPreferenceStorage());
  }, []);

  return (
    <div
      className={cn(
        getAppShellDesktopGridClassName({ showSidebar, sidebarBreakpoint, navigationCollapsed, fillViewport }),
        // 打印媒体可能达到桌面断点（如 A4 横向），收起双栏网格避免空侧栏列挤压正文。
        'print:block',
      )}
      data-app-shell-layout={allowSidebarCollapse ? 'collapsible' : undefined}
      data-app-shell-navigation-state={
        allowSidebarCollapse ? (navigationCollapsed ? 'collapsed' : 'expanded') : undefined
      }
      data-app-shell-navigation-preference={allowSidebarCollapse ? navigationPreference : undefined}
    >
      {showSidebar ? (
        allowSidebarCollapse ? (
          <CollapsibleAppSidebar
            navigation={effectiveNavigation}
            activeHref={activeHref}
            navigationCollapsed={navigationCollapsed}
            onNavigationCollapsedChange={handleNavigationCollapsedChange}
            className={sidebarBreakpoint === 'lg' ? 'hidden lg:block' : 'hidden xl:block'}
          />
        ) : (
          <AppSidebar
            navigation={effectiveNavigation}
            activeHref={activeHref}
            className={sidebarBreakpoint === 'lg' ? 'hidden lg:block' : 'hidden xl:block'}
          />
        )
      ) : null}
      <div className={cn('min-w-0', fillViewport && 'flex h-full min-h-0 flex-col')}>
        <AppHeader
          viewerRole={viewerRole}
          title={title}
          subtitle={subtitle}
          breadcrumbs={effectiveBreadcrumbs}
          actions={headerActions}
          userMenu={userMenu}
          accountHref={accountHref}
        />
        {renderMobileNavigation ? (
          resolvedRouteMetadata?.mobileNavigation === 'drawer' ? (
            <AppMobileNavigation
              navigation={renderItems}
              activeItemId={activeItemId}
              sidebarBreakpoint={sidebarBreakpoint}
              behavior={resolvedRouteMetadata?.mobileNavigation as PlatformMobileNavigationBehavior | undefined}
            />
          ) : (
            <nav
              aria-label="平台导航"
              className={cn(
                'border-b border-platform-border bg-platform-surface px-4 py-2 print:hidden',
                sidebarBreakpoint === 'lg' ? 'lg:hidden' : 'xl:hidden',
              )}
            >
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {renderItems.map(({ item }) => renderNavigationLink(item, activeItemId, 'mobile'))}
              </div>
            </nav>
          )
        ) : null}
        <div
          className={cn(
            fillViewport
              ? 'flex min-h-0 flex-1 flex-col overflow-auto'
              : resolvedRouteMetadata?.frame
                ? contentFrameClassNames[resolvedRouteMetadata.frame]
                : APP_SHELL_COMPACT_PAGE_EDGE_CLASS,
          )}
          data-platform-compact-page-edge="true"
          data-app-shell-fill-viewport={fillViewport ? 'true' : undefined}
        >
          {journeyControl}
          {AppShellWorkspace({ slots: workspaceSlots, children })}
        </div>
        <AppShellFloatingDockRegistration controls={floatingDockControls} behavior={floatingDockBehavior} />
      </div>
    </div>
  );
}

function AppMobileNavigation({
  navigation,
  activeItemId,
  sidebarBreakpoint,
  behavior,
}: {
  navigation: readonly NavigationRenderItem[];
  activeItemId?: string;
  sidebarBreakpoint: 'lg' | 'xl';
  behavior?: PlatformMobileNavigationBehavior;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerDialogRef = useRef<HTMLDivElement>(null);
  const drawerOverlayRef = useRef<HTMLDivElement>(null);
  const hiddenAtBreakpoint = sidebarBreakpoint === 'lg' ? 'lg:hidden' : 'xl:hidden';
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia(`(min-width: ${sidebarBreakpoint === 'lg' ? 1024 : 1280}px)`);

    const handleDesktopBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setDrawerOpen(false);
      }
    };

    desktopMediaQuery.addEventListener('change', handleDesktopBreakpoint);
    return () => desktopMediaQuery.removeEventListener('change', handleDesktopBreakpoint);
  }, [sidebarBreakpoint]);

  useEffect(() => {
    if (!drawerOpen) return undefined;

    const overlay = drawerOverlayRef.current;
    const parent = overlay?.parentElement;
    const inertSiblings = Array.from(parent?.children ?? []).filter((element) => element !== overlay);
    const previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const openButton = openButtonRef.current;

    inertSiblings.forEach((element) => {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    });
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      inertSiblings.forEach((element) => {
        element.removeAttribute('inert');
        element.removeAttribute('aria-hidden');
      });
      window.requestAnimationFrame(() => {
        const restoreTarget = openButton?.isConnected
          ? openButton
          : previouslyFocusedElement?.isConnected
            ? previouslyFocusedElement
            : null;
        restoreTarget?.focus();
      });
    };
  }, [drawerOpen]);

  const getDrawerFocusableElements = () =>
    Array.from(drawerDialogRef.current?.querySelectorAll<HTMLElement>(mobileDrawerFocusableSelector) ?? []).filter(
      (element) =>
        element.tabIndex >= 0 && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0,
    );

  const handleDrawerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = getDrawerFocusableElements();
    if (focusableElements.length === 0) {
      event.preventDefault();
      drawerDialogRef.current?.focus();
      return;
    }

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && (activeElement === firstFocusable || !drawerDialogRef.current?.contains(activeElement))) {
      event.preventDefault();
      lastFocusable?.focus();
      return;
    }

    if (!event.shiftKey && activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable?.focus();
    }
  };

  if (behavior !== 'drawer') {
    return (
      <nav
        aria-label="平台导航"
        className={cn('border-b border-platform-border bg-platform-surface px-4 py-2 print:hidden', hiddenAtBreakpoint)}
      >
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {navigation.map(({ item }) => renderNavigationLink(item, activeItemId, 'mobile'))}
        </div>
      </nav>
    );
  }

  return (
    <>
      <div className={cn('border-b border-platform-border bg-platform-surface px-4 py-2 print:hidden', hiddenAtBreakpoint)}>
        <button
          ref={openButtonRef}
          type="button"
          aria-label="打开平台导航"
          aria-controls="app-shell-mobile-navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-platform-border bg-platform-surface-raised px-3 text-sm font-medium text-platform-fg-primary transition hover:border-platform-border-strong hover:text-platform-action-primary"
        >
          <Menu className="h-4 w-4" />
          导航
        </button>
      </div>
      {drawerOpen ? (
        <div
          ref={drawerOverlayRef}
          className={cn('fixed inset-0 z-50 print:hidden', hiddenAtBreakpoint)}
          role="dialog"
          aria-modal="true"
          aria-label="平台导航"
          data-app-shell-mobile-drawer="open"
          tabIndex={-1}
          onKeyDown={handleDrawerKeyDown}
        >
          <button
            type="button"
            aria-label="关闭平台导航背景"
            className="absolute inset-0 bg-platform-canvas/72 backdrop-blur-sm"
            onClick={closeDrawer}
          />
          <aside
            ref={drawerDialogRef}
            id="app-shell-mobile-navigation"
            className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-platform-border bg-platform-surface-raised shadow-2xl"
          >
            <div className="flex min-h-[64px] items-center justify-between border-b border-platform-border px-4">
              <span className="text-sm font-semibold text-platform-fg-primary">导航</span>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="关闭平台导航"
                onClick={closeDrawer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-platform-border bg-platform-surface text-platform-fg-secondary transition hover:border-platform-border-strong hover:text-platform-action-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav aria-label="平台移动抽屉导航" className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
              {navigation.map(({ item }) => renderNavigationLink(item, activeItemId, 'mobile', 0, false, closeDrawer))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
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

function hasRightRailWorkspaceSlots(slots?: AppShellWorkspaceSlots) {
  return Boolean(slots?.evidenceRail || slots?.supportDrawer || slots?.statusRail || slots?.localTools);
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

function AppShellWorkspace({ slots, children }: { slots?: AppShellWorkspaceSlots; children: ReactNode }) {
  if (!hasWorkspaceSlots(slots)) return <>{children}</>;
  const hasRightRail = hasRightRailWorkspaceSlots(slots);
  return (
    <section
      data-app-shell-workspace="true"
      data-app-shell-workspace-right-rail={hasRightRail ? 'present' : 'absent'}
      className={cn('grid gap-4', hasRightRail && 'xl:grid-cols-[minmax(0,1fr)_320px]')}
    >
      <div className="min-w-0 space-y-4">
        {renderAppShellWorkspaceZone({
          id: 'context-header',
          className: 'rounded-lg border border-platform-border bg-platform-surface-raised p-4',
          children: slots?.contextHeader,
        })}
        {renderAppShellWorkspaceZone({
          id: 'command-bar',
          className: 'rounded-lg border border-platform-border bg-platform-surface px-4 py-3 print:hidden',
          children: slots?.commandBar,
        })}
        {renderAppShellWorkspaceZone({
          id: 'instrument-area',
          children: slots?.instrumentArea ?? children,
        })}
      </div>
      {hasRightRail ? (
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
      ) : null}
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
  const floatingControls = useOptionalPageFloatingControls();
  const registerControl = floatingControls?.registerControl;
  const setRouteDockBehavior = floatingControls?.setRouteDockBehavior;
  const controlRegistrationSignature = controls
    .map((control) =>
      [
        control.id,
        control.label,
        control.control,
        control.href ?? '',
        control.onSelect ? 'handler' : '',
        control.disabled ? 'disabled' : 'enabled',
      ].join(':'),
    )
    .join('|');

  useEffect(() => {
    if (!setRouteDockBehavior) return undefined;
    return setRouteDockBehavior(behavior);
  }, [behavior, setRouteDockBehavior]);

  useEffect(() => {
    if (!registerControl) return undefined;
    if (behavior === 'hidden') return undefined;
    const unregister = controls.map((control, index) =>
      registerControl({
        id: `app-shell:${control.id}`,
        label: control.label,
        ariaLabel: control.label,
        icon: control.icon ?? <Settings className="h-4 w-4 text-muted-foreground" />,
        priority: 20 + index,
        disabled: control.disabled,
        onSelect: () => {
          if (control.disabled) return;
          if (control.onSelect) {
            control.onSelect();
            return;
          }
          if (control.href) window.location.assign(control.href);
        },
      }),
    );
    return () => unregister.forEach((cleanup) => cleanup());
  }, [behavior, controlRegistrationSignature, controls, registerControl]);

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
  viewerRole,
  navigation,
  breadcrumbs,
  title = '平台工作台',
  subtitle,
  actions,
  userMenu,
  accountHref,
  activeHref,
  activeNavigationHref,
  sidebarMode,
  routeMetadata,
  workspaceSlots,
  journeyControl,
  dockControls = [],
  children,
  className,
  fillViewport = false,
}: AppShellProps) {
  const role = viewerRole;
  const resolvedRouteMetadata = routeMetadata ?? (activeHref ? resolvePlatformRouteInventory(activeHref) : undefined);
  const floatingDockBehavior = resolvedRouteMetadata?.floatingDock ?? 'enabled';
  const effectiveBreadcrumbs =
    breadcrumbs ??
    (resolvedRouteMetadata?.contextualReturn
      ? [
          {
            label: getContextualReturnBreadcrumbLabel(resolvedRouteMetadata.contextualReturn),
            href: resolvedRouteMetadata.contextualReturn.fallbackHref,
          },
          { label: title },
        ]
      : undefined);
  const routeNavigation =
    navigation === undefined && activeHref ? getPlatformRouteNavigation(activeHref, viewerRole) : [];
  const effectiveNavigation = navigation ?? routeNavigation;
  const renderItems = flattenNavigationItems(effectiveNavigation);
  const resolvedSidebarMode = sidebarMode ?? resolvedRouteMetadata?.desktopNavigation ?? 'fixed';
  const showSidebar = resolvedSidebarMode !== 'hidden' && renderItems.length > 0;
  const sidebarBreakpoint = resolvedSidebarMode === 'collapsible' ? 'xl' : 'lg';
  const allowSidebarCollapse = resolvedSidebarMode === 'collapsible';
  const navigationActiveHref = activeNavigationHref ?? activeHref;
  const activeItemId = getActiveNavigationItemId(effectiveNavigation, navigationActiveHref);
  return (
    <main
      data-platform-route-frame={resolvedRouteMetadata?.frame}
      data-platform-route-theme-support={routeDataAttribute(
        resolvedRouteMetadata?.themeSupport as readonly PlatformRouteThemeSupport[] | undefined,
      )}
      data-platform-desktop-navigation={resolvedRouteMetadata?.desktopNavigation}
      data-platform-route-navigation-layers={routeDataAttribute(
        resolvedRouteMetadata?.navigationLayers as readonly PlatformNavigationLayerId[] | undefined,
      )}
      data-platform-mobile-navigation={
        resolvedRouteMetadata?.mobileNavigation as PlatformMobileNavigationBehavior | undefined
      }
      data-platform-floating-dock-behavior={floatingDockBehavior}
      data-platform-floating-dock-collision-policy={
        floatingDockBehavior === 'hidden' ? undefined : 'safe-area-primary-controls'
      }
      data-platform-floating-dock-mobile-behavior={
        floatingDockBehavior === 'hidden' ? 'hidden' : 'sheet-after-local-tools'
      }
      className={cn(
        'min-h-screen bg-platform-canvas text-platform-fg-primary',
        fillViewport && 'h-dvh overflow-hidden',
        resolvedRouteMetadata?.frame && frameClassNames[resolvedRouteMetadata.frame],
        className,
      )}
    >
      <AppShellDesktopLayout
        showSidebar={showSidebar}
        allowSidebarCollapse={allowSidebarCollapse}
        sidebarBreakpoint={sidebarBreakpoint}
        effectiveNavigation={effectiveNavigation}
        activeHref={navigationActiveHref}
        activeItemId={activeItemId}
        resolvedRouteMetadata={resolvedRouteMetadata}
        viewerRole={viewerRole}
        title={title}
        subtitle={subtitle}
        actions={actions}
        userMenu={userMenu}
        accountHref={accountHref}
        effectiveBreadcrumbs={effectiveBreadcrumbs}
        workspaceSlots={workspaceSlots}
        journeyControl={journeyControl}
        dockControls={dockControls}
        floatingDockBehavior={floatingDockBehavior}
        fillViewport={fillViewport}
      >
        {children}
      </AppShellDesktopLayout>
    </main>
  );
}
