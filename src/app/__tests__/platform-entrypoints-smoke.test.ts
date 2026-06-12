import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES,
  PLATFORM_ENTRYPOINT_SMOKE_ROUTES,
  STUDENT_LEARNING_INTENT_GROUPS,
} from '@/lib/platform-role-navigation';

const rootDir = path.resolve(__dirname, '../../..');

function readSource(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('platform entrypoint smoke contracts', () => {
  it('keeps desktop and 320px smoke route files present', () => {
    for (const route of PLATFORM_ENTRYPOINT_SMOKE_ROUTES) {
      expect(route.viewportWidths).toEqual([1440, 320]);
      expect(existsSync(path.join(rootDir, route.routeFile))).toBe(true);
    }
    expect(COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES.map((route) => route.href)).toEqual([
      '/',
      '/login?callbackUrl=%2Fprofile',
      '/dashboard',
      '/interactive-learning',
      '/interactive-learning/courses',
      '/interactive-learning/courses/unit-4-1-design-task-expression',
      '/simulations',
      '/arena',
      '/assessment/adaptive-practice',
      '/profile',
    ]);
    for (const route of COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES) {
      expect(route.viewportWidths).toEqual([1440, 320]);
      expect(existsSync(path.join(rootDir, route.routeFile))).toBe(true);
      expect(route.firstViewportRequirement).toContain('usable');
    }
  });

  it('migrates homepage to shared student entries and a 320px mobile menu', () => {
    const source = readSource('src/app/page.tsx');

    expect(source).toContain('getStudentLearningIntentNavigationGroups');
    expect(source).toContain('getCommercialStudentEntryIntentGroups');
    expect(source).toContain('resolveCommercialEntryHref');
    expect(source).toContain('showMobileNavigation');
    expect(source).toContain('aria-label={');
    expect(source).toContain('打开平台入口菜单');
    expect(source).toContain('aria-label="移动平台入口菜单"');
    expect(source).toContain('md:hidden');
    expect(source).not.toContain('const moduleLinks = [');
  });

  it('reuses one credential login form for page and embedded login', () => {
    expect(readSource('src/app/(auth)/login/page.tsx')).toContain('CredentialLoginForm');
    expect(readSource('src/components/shared/login-modal.tsx')).toContain('CredentialLoginForm');
  });

  it('keeps dashboard and profile tied to shared navigation contracts', () => {
    const dashboardSource = readSource('src/app/(main)/dashboard/page.tsx');
    const profileSource = readSource('src/app/(main)/profile/page.tsx');

    expect(dashboardSource).toContain('getStudentLearningIntentNavigationGroups');
    expect(dashboardSource).toContain('getCommercialStudentEntryIntentGroups');
    expect(dashboardSource).toContain('resolveCommercialEntryHref');
    expect(dashboardSource).toContain('account-profile');
    expect(dashboardSource).toContain('/profile');
    expect(dashboardSource).toContain('dashboardCommercialEntries');
    expect(dashboardSource).toContain('intentGroup.entryIds.flatMap');
    expect(dashboardSource).toContain('quickStartEntryIds.flatMap');
    expect(dashboardSource).not.toContain('intentGroup.entryIds.includes(candidate.id)');
    for (const entryId of STUDENT_LEARNING_INTENT_GROUPS.flatMap((group) => group.entryIds)) {
      expect(dashboardSource).toContain(entryId);
    }
    expect(profileSource).toContain('getPlatformCockpitHref');
    expect(profileSource).toContain('getCommercialStudentEntryIntentGroups');
    expect(profileSource).toContain('buildLoginRedirectForPath');
  });

  it('keeps login error states tied to the same callback destination contract', () => {
    const loginSource = readSource('src/app/(auth)/login/page.tsx');
    const loginFormSource = readSource('src/components/shared/credential-login-form.tsx');

    expect(loginSource).toContain('getCommercialStudentEntryIntentGroups');
    expect(loginSource).toContain('callbackUrl=%2Fprofile');
    expect(loginSource).toContain('保留目标');
    expect(loginSource).toContain('LoginCommercialFallback');
    expect(loginSource).toContain('data-auth-callback-target="pending-callback"');
    expect(loginFormSource).toContain("setError('账号或密码错误')");
    expect(loginFormSource).toContain('callbackUrl');
    expect(loginFormSource).toContain('resolvePostLoginRedirect');
  });

  it('keeps product entry routes on the commercial entry-surface contract', () => {
    const routeSources = [
      readSource('src/app/interactive-learning/page.tsx'),
      readSource('src/features/arena/arena-hall.tsx'),
      readSource('src/app/assessment/adaptive-practice/page.tsx'),
    ];
    const courseCatalogSource = readSource('src/app/interactive-learning/courses/page.tsx');

    for (const source of routeSources) {
      expect(source).toContain('getCommercialStudentEntryIntentGroups');
      expect(source).toContain('data-commercial-student-entry-route');
      expect(source).toContain('data-commercial-entry-intent');
    }
    expect(routeSources[2]).toContain("['practice', 'learn', 'challenge', 'review']");
    expect(routeSources[2]).toContain('返回竞技场');
    expect(courseCatalogSource).toContain('data-learning-entry-map="course-module-progression"');
    expect(courseCatalogSource).toContain('data-course-entry-action="launch"');
  });
});
