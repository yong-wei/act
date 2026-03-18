'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface UnifiedTopBarProps {
  title: string;
  backHref: string;
  backLabel?: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  className?: string;
  onBackClick?: () => void;
}

function useCockpitHref() {
  const { data: session, status } = useSession();

  return useMemo(() => {
    if (status !== 'authenticated' || !session?.user) {
      return '/login';
    }

    if (session.user.role === 'ADMIN') {
      return '/admin';
    }

    if (session.user.role === 'TEACHER') {
      return '/teacher';
    }

    return '/dashboard';
  }, [session, status]);
}

export function UnifiedTopBar({
  title,
  backHref,
  backLabel = '返回入口',
  subtitle,
  rightSlot,
  className,
  onBackClick,
}: UnifiedTopBarProps) {
  const cockpitHref = useCockpitHref();

  return (
    <header className={cn('mx-auto w-full max-w-[1280px] px-4 pt-4 sm:px-6', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/88 px-3 py-3 shadow-xl shadow-slate-950/10 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          {onBackClick ? (
            <button
              type="button"
              onClick={onBackClick}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/55 hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </button>
          ) : (
            <Link
              href={backHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/55 hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {backLabel}
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{title}</h1>
            {subtitle ? <p className="truncate text-[11px] text-subtle sm:text-xs">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightSlot}
          <Link
            href={cockpitHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/55 hover:text-primary"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            进入驾驶舱
          </Link>
        </div>
      </div>
    </header>
  );
}
