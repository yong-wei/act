import { describe, expect, it } from 'vitest';

import {
  PLATFORM_ENTRYPOINT_SMOKE_ROUTES,
  PLATFORM_NAVIGATION_FEATURE_FLAGS,
  PLATFORM_ROLE_COCKPIT_HREFS,
  STUDENT_CORE_ENTRY_IDS,
  getPlatformCockpitHref,
  getPlatformNavigationHref,
  getPlatformRoleNavigation,
  getStudentCoreNavigationEntries,
} from '@/lib/platform-role-navigation';

describe('platform role navigation', () => {
  it('defines stable student core entries in the report order', () => {
    const entries = getStudentCoreNavigationEntries();

    expect(entries.map((entry) => entry.id)).toEqual(STUDENT_CORE_ENTRY_IDS);
    expect(entries.map((entry) => entry.href)).toEqual([
      '/simulations',
      '/knowledge',
      '/arena',
      '/interactive-learning/control-workbench',
      '/assessment/adaptive-practice',
      '/interactive-learning',
      '/data-center',
    ]);
    expect(entries.every((entry) => entry.group === 'student-core')).toBe(true);
    expect(entries.map((entry) => entry.id)).not.toContain('student-profile');
  });

  it('defines student, teacher, admin, and guest navigation groups', () => {
    expect(getPlatformRoleNavigation('student').map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/dashboard', '/simulations', '/knowledge', '/arena', '/interactive-learning', '/profile']),
    );
    expect(getPlatformRoleNavigation('teacher').map((entry) => entry.href)).toEqual(
      expect.arrayContaining([
        '/teacher',
        '/teacher/classes',
        '/teacher/lesson-plans',
        '/teacher/preset-lessons',
        '/teacher/resources',
        '/teacher/resources/resource-nodes',
        '/teacher/history',
        '/teacher/arena',
      ]),
    );
    expect(getPlatformRoleNavigation('admin').map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/admin', '/admin/users', '/admin/states', '/admin/data-governance', '/admin/config']),
    );
    expect(getPlatformRoleNavigation('guest').map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/', '/login', '/simulations', '/knowledge', '/arena']),
    );
  });

  it('keeps role cockpit destinations compatible with auth roles', () => {
    expect(PLATFORM_ROLE_COCKPIT_HREFS).toEqual({
      student: '/dashboard',
      teacher: '/teacher',
      admin: '/admin',
      audit: '/admin/data-governance',
    });
    expect(getPlatformCockpitHref('STUDENT')).toBe('/dashboard');
    expect(getPlatformCockpitHref('TEACHER')).toBe('/teacher');
    expect(getPlatformCockpitHref('ADMIN')).toBe('/admin');
    expect(getPlatformCockpitHref(null)).toBe('/dashboard');
  });

  it('keeps future destinations explicit without exposing dead links by default', () => {
    const allFutureEntries = [
      ...getPlatformRoleNavigation('student', { includeDisabled: true, includeHidden: true }),
      ...getPlatformRoleNavigation('teacher', { includeDisabled: true, includeHidden: true }),
      ...getPlatformRoleNavigation('admin', { includeDisabled: true, includeHidden: true }),
    ].filter((entry) => entry.featureFlag);

    expect(allFutureEntries.map((entry) => entry.featureFlag)).toEqual(
      expect.arrayContaining([
        PLATFORM_NAVIGATION_FEATURE_FLAGS.adaptivePath,
        PLATFORM_NAVIGATION_FEATURE_FLAGS.konling,
        PLATFORM_NAVIGATION_FEATURE_FLAGS.governance,
        PLATFORM_NAVIGATION_FEATURE_FLAGS.experiments,
      ]),
    );
    expect(allFutureEntries.every((entry) => entry.availability === 'disabled' || entry.availability === 'hidden')).toBe(true);
    expect(getPlatformRoleNavigation('student').every((entry) => !entry.featureFlag)).toBe(true);
  });

  it('does not enable explicitly disabled or hidden future entries when feature flags are present', () => {
    const enabledFlags = Object.values(PLATFORM_NAVIGATION_FEATURE_FLAGS);
    const futureEntries = [
      ...getPlatformRoleNavigation('student', { enabledFeatureFlags: enabledFlags, includeDisabled: true, includeHidden: true }),
      ...getPlatformRoleNavigation('teacher', { enabledFeatureFlags: enabledFlags, includeDisabled: true, includeHidden: true }),
      ...getPlatformRoleNavigation('admin', { enabledFeatureFlags: enabledFlags, includeDisabled: true, includeHidden: true }),
    ].filter((entry) => entry.featureFlag);

    expect(futureEntries.map((entry) => [entry.id, entry.availability])).toEqual(
      expect.arrayContaining([
        ['student-adaptive-path', 'disabled'],
        ['student-konling', 'disabled'],
        ['admin-governance-workspace', 'disabled'],
        ['admin-experiments', 'hidden'],
      ]),
    );
    expect(getPlatformNavigationHref('teacher-resource-nodes')).toBe('/teacher/resources/resource-nodes');
    expect(
      getPlatformRoleNavigation('admin', { enabledFeatureFlags: enabledFlags }).some(
        (entry) => entry.href === '/admin/experiments',
      ),
    ).toBe(false);
  });

  it('resolves shared role navigation hrefs for downstream cockpit configs', () => {
    expect(getPlatformNavigationHref('teacher-classes')).toBe('/teacher/classes');
    expect(getPlatformNavigationHref('teacher-resources')).toBe('/teacher/resources');
    expect(getPlatformNavigationHref('admin-data-governance')).toBe('/admin/data-governance');
  });

  it('declares smoke routes for desktop and 320px mobile entrypoint checks', () => {
    expect(PLATFORM_ENTRYPOINT_SMOKE_ROUTES).toEqual([
      { href: '/', routeFile: 'src/app/page.tsx', viewportWidths: [1440, 320] },
      { href: '/login', routeFile: 'src/app/(auth)/login/page.tsx', viewportWidths: [1440, 320] },
      { href: '/dashboard', routeFile: 'src/app/(main)/dashboard/page.tsx', viewportWidths: [1440, 320] },
      { href: '/profile', routeFile: 'src/app/(main)/profile/page.tsx', viewportWidths: [1440, 320] },
    ]);
  });
});
