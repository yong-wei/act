import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type FeaturePageNavProps = {
  title: string
  backHref: string
  backLabel?: string
  rightSlot?: ReactNode
  className?: string
  floating?: boolean
}

export function FeaturePageNav({
  title,
  backHref,
  backLabel = '返回上一级',
  rightSlot,
  className,
  floating = false,
}: FeaturePageNavProps) {
  if (floating) {
    return (
      <div className={cn('absolute left-4 top-4 z-50', className)}>
        <div className="surface-card-soft inline-flex items-center gap-3 px-3 py-2 shadow-lg">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background/70 px-2.5 py-1.5 text-xs text-subtle transition hover:border-primary/55 hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
          <div className="h-4 w-px bg-border/80" />
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        </div>
      </div>
    )
  }

  return (
    <header className={cn('surface-topbar', className)}>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-background/65 px-2.5 py-1.5 text-xs text-subtle transition hover:border-primary/55 hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Link>
          <div className="h-5 w-px bg-border/80" />
          <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </header>
  )
}
