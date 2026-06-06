'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { TEACHER_OPERATIONS_NAVIGATION } from '@/features/admin/teacher-admin-governance-workspaces';
import { cn } from '@/lib/utils';

export function TeacherOperationsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mt-4 flex gap-2 overflow-x-auto pb-1"
      aria-label="教师运营导航"
      data-teacher-operations-continuous-nav
    >
      {TEACHER_OPERATIONS_NAVIGATION.map((entry) => {
        const href = resolveTeacherOperationsNavHref(entry.href, pathname);
        const active = isTeacherOperationsNavActive(pathname, entry.href);
        return (
          <Link
            key={entry.id}
            href={href}
            className={cn(
              'shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-subtle transition hover:border-primary hover:text-foreground',
              active && 'border-primary bg-primary/10 text-primary',
            )}
            data-teacher-operations-current-route={active ? entry.id : undefined}
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function resolveTeacherOperationsNavHref(href: string, pathname: string | null) {
  if (!href.includes('[classId]')) return href;
  const classId = readTeacherClassIdFromPathname(pathname);
  return classId ? href.replace('[classId]', classId) : '/teacher/classes';
}

export function isTeacherOperationsNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/teacher') return pathname === '/teacher';
  if (href.includes('[classId]')) {
    const resolvedHref = resolveTeacherOperationsNavHref(href, pathname);
    return resolvedHref !== '/teacher/classes' && pathname.startsWith(resolvedHref);
  }
  if (href === '/teacher/classes' && pathname.includes('/analytics-v2')) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readTeacherClassIdFromPathname(pathname: string | null) {
  const classId = pathname?.match(/^\/teacher\/classes\/([^/?#]+)/)?.[1] ?? null;
  if (!classId || NON_CLASS_OBJECT_ROUTE_SEGMENTS.has(classId)) return null;
  return classId;
}

const NON_CLASS_OBJECT_ROUTE_SEGMENTS = new Set(['new']);
