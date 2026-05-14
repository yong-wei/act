'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { UserMenu } from '@/components/shared/user-menu';
import { cn } from '@/lib/utils';
import {
  ADMIN_CONSOLE_SECTIONS,
  type AdminConsoleUser,
} from './admin-console-config';

type AdminConsoleHeaderProps = {
  currentUser: AdminConsoleUser;
  title: string;
  eyebrow: string;
  description: string;
  currentHref: string;
  backHref?: string;
  backLabel?: string;
  chips?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function AdminConsoleHeader({
  currentUser,
  title,
  eyebrow,
  description,
  currentHref,
  backHref,
  backLabel = '返回管理后台',
  chips,
  actions,
  children,
}: AdminConsoleHeaderProps) {
  return (
    <header className="admin-console-topbar">
      <div className="admin-console-container py-8">
        <div className="admin-console-hero">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              {backHref ? (
                <Link href={backHref} className="admin-console-back-link">
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel}
                </Link>
              ) : null}

              <div className="space-y-2">
                <span className="admin-console-kicker">{eyebrow}</span>
                <h1 className="admin-console-title text-3xl font-semibold">{title}</h1>
                <p className="admin-console-muted max-w-3xl text-sm leading-6">
                  {description}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm">
                {chips ?? (
                  <>
                    <span className="admin-console-chip">
                      当前登录：{currentUser.name || currentUser.email || '管理员'}
                    </span>
                    <span className="admin-console-chip">角色：管理员</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {actions}
              <UserMenu user={currentUser} variant="admin" />
            </div>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2">
            {ADMIN_CONSOLE_SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className={cn(
                  'admin-console-nav-item border border-transparent',
                  section.href === currentHref && 'admin-console-nav-item-active'
                )}
              >
                {section.title}
              </Link>
            ))}
          </nav>

          {children ? <div className="mt-6">{children}</div> : null}
        </div>
      </div>
    </header>
  );
}
