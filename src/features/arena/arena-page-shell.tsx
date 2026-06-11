'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  FlaskConical,
  GraduationCap,
  Home,
  Map,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Trophy,
  User,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  getStudentLearningIntentNavigationGroups,
  type PlatformNavigationIconKey,
} from '@/lib/platform-role-navigation';

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

const projectEntryIcons: Partial<Record<PlatformNavigationIconKey, LucideIcon>> = {
  adaptive: Sparkles,
  arena: Trophy,
  interactive: GraduationCap,
  knowledge: Map,
  profile: User,
  ship: FlaskConical,
  workbench: Wrench,
};

function isArenaNavigationActive(entryHref: string, activePath: string) {
  return activePath === entryHref || (entryHref !== '/arena' && activePath.startsWith(entryHref));
}

export function ArenaPageShell({
  breadcrumbs,
  activePath,
  title = '竞技场',
  subtitle = 'Arena workspace',
  actions,
  children,
}: ArenaPageShellProps) {
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const renderProjectEntries = (variant: 'desktop' | 'mobile') => (
    projectEntries.map((entry) => {
      const Icon = projectEntryIcons[entry.iconKey as PlatformNavigationIconKey] ?? Home;
      const active = isArenaNavigationActive(entry.href, activePath);
      const collapsed = variant === 'desktop' && navigationCollapsed;

      return (
        <Link
          key={`${variant}-${entry.href}`}
          href={entry.href}
          aria-current={active ? 'page' : undefined}
          aria-label={collapsed ? entry.label : undefined}
          title={collapsed ? entry.label : undefined}
          onClick={variant === 'mobile' ? () => setMobileNavigationOpen(false) : undefined}
          className={cn(
            'group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
            collapsed && 'justify-center px-2',
            active
              ? 'border-primary/35 bg-primary/12 text-primary shadow-sm'
              : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground',
          )}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className={cn('min-w-0 truncate', collapsed && 'sr-only')}>{entry.label}</span>
          {active && !collapsed ? <ChevronRight className="ml-auto h-4 w-4" /> : null}
        </Link>
      );
    })
  );

  return (
    <main
      className="min-h-screen bg-background text-foreground"
      data-arena-workspace-shell="true"
      data-shell-navigation-state={navigationCollapsed ? 'collapsed' : 'expanded'}
      data-mobile-navigation="drawer"
    >
      <div
        className={cn(
          'grid min-h-screen',
          navigationCollapsed
            ? 'lg:grid-cols-[76px_minmax(0,1fr)]'
            : 'lg:grid-cols-[252px_minmax(0,1fr)]',
        )}
      >
        <aside className="hidden border-r border-border/70 bg-card/86 shadow-lg backdrop-blur lg:flex lg:flex-col">
          <div className={cn('flex h-[70px] items-center gap-3 border-b border-border/70 px-4', navigationCollapsed && 'justify-center px-2')}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
            <div className={cn('min-w-0', navigationCollapsed && 'sr-only')}>
              <div className="truncate text-base font-semibold text-foreground">{title}</div>
              <div className="truncate text-xs text-subtle">{subtitle}</div>
            </div>
          </div>
          <div className="border-b border-border/70 px-3 py-3">
            <button
              type="button"
              aria-label={navigationCollapsed ? '展开竞技场导航' : '收起竞技场导航'}
              aria-expanded={!navigationCollapsed}
              aria-controls="arena-desktop-navigation"
              onClick={() => setNavigationCollapsed((current) => !current)}
              className={cn(
                'inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/70 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary',
                navigationCollapsed && 'w-10',
              )}
            >
              {navigationCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              <span className={cn(navigationCollapsed && 'sr-only')}>{navigationCollapsed ? '展开导航' : '收起导航'}</span>
            </button>
          </div>
          <nav id="arena-desktop-navigation" aria-label="竞技场工作区导航" className="flex-1 space-y-2 px-3 py-5">
            {renderProjectEntries('desktop')}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-card/88 backdrop-blur">
            <div className="flex h-[70px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                aria-label="打开竞技场导航"
                aria-controls="arena-mobile-navigation"
                aria-expanded={mobileNavigationOpen}
                onClick={() => setMobileNavigationOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition hover:border-primary/40 hover:text-primary lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <nav className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                {breadcrumbs.map((item, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <span key={`${item.href}-${index}`} className="flex min-w-0 items-center gap-2">
                      {index > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/70" /> : null}
                      {isLast ? (
                        <span className="truncate font-semibold text-foreground">{item.label}</span>
                      ) : (
                        <Link href={item.href} className="truncate hover:text-primary">
                          {item.label}
                        </Link>
                      )}
                    </span>
                  );
                })}
              </nav>
              <div className="flex shrink-0 items-center gap-3 text-sm">
                {actions}
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-foreground transition hover:bg-accent"
                >
                  <span className="hidden sm:inline">个人中心</span>
                  <User className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </header>
          <div>{children}</div>
        </div>
      </div>
      {mobileNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="竞技场导航" data-arena-mobile-drawer="open">
          <button
            type="button"
            aria-label="关闭竞技场导航背景"
            className="absolute inset-0 bg-background/72 backdrop-blur-sm"
            onClick={() => setMobileNavigationOpen(false)}
          />
          <aside
            id="arena-mobile-navigation"
            className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-border/70 bg-card shadow-2xl"
          >
            <div className="flex h-[70px] items-center justify-between gap-3 border-b border-border/70 px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-foreground">{title}</div>
                  <div className="truncate text-xs text-subtle">{subtitle}</div>
                </div>
              </div>
              <button
                type="button"
                aria-label="关闭竞技场导航"
                onClick={() => setMobileNavigationOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="竞技场移动导航" className="flex-1 space-y-2 overflow-y-auto px-3 py-5">
              {renderProjectEntries('mobile')}
            </nav>
            <div className="border-t border-border/70 px-3 py-3">
              <Link
                href="/profile"
                onClick={() => setMobileNavigationOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-accent hover:text-primary"
              >
                <User className="h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate">个人中心</span>
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
