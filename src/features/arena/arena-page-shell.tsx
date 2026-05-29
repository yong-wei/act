import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  FlaskConical,
  GraduationCap,
  Home,
  Map,
  Sparkles,
  Trophy,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import {
  getStudentCoreNavigationEntries,
  type PlatformNavigationIconKey,
} from '@/lib/platform-role-navigation';

interface ArenaBreadcrumb {
  label: string;
  href: string;
}

interface ArenaPageShellProps {
  breadcrumbs: ArenaBreadcrumb[];
  activePath: string;
  children: ReactNode;
}

const projectEntries = getStudentCoreNavigationEntries();

const projectEntryIcons: Partial<Record<PlatformNavigationIconKey, LucideIcon>> = {
  adaptive: Sparkles,
  arena: Trophy,
  interactive: GraduationCap,
  knowledge: Map,
  profile: User,
  ship: FlaskConical,
  workbench: Wrench,
};

export function ArenaPageShell({ breadcrumbs, activePath, children }: ArenaPageShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-r border-border/70 bg-card/80 shadow-lg shadow-black/5 backdrop-blur lg:flex lg:flex-col">
          <div className="flex h-[70px] items-center gap-3 border-b border-border/70 px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">竞技场</div>
              <div className="text-xs text-subtle">Arena workspace</div>
            </div>
          </div>
          <nav className="flex-1 space-y-2 px-3 py-5">
            {projectEntries.map((entry) => {
              const Icon = projectEntryIcons[entry.iconKey as PlatformNavigationIconKey] ?? Home;
              const active = activePath === entry.href || (entry.href !== '/arena' && activePath.startsWith(entry.href));
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                    active
                      ? 'border border-primary/30 bg-primary/12 text-primary shadow-sm'
                      : 'border border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{entry.label}</span>
                  {active ? <ChevronRight className="ml-auto h-4 w-4" /> : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-card/88 backdrop-blur">
            <div className="flex h-[70px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
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
              <div className="flex items-center gap-3 text-sm">
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
    </main>
  );
}
