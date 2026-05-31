import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLATFORM_ENTRYPOINT_SMOKE_ROUTES, STUDENT_LEARNING_INTENT_GROUPS } from '@/lib/platform-role-navigation';

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
  });

  it('migrates homepage to shared student entries and a 320px mobile menu', () => {
    const source = readSource('src/app/page.tsx');

    expect(source).toContain('getStudentLearningIntentNavigationGroups');
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
    expect(dashboardSource).toContain('quickStartEntryIds.flatMap');
    for (const entryId of STUDENT_LEARNING_INTENT_GROUPS.flatMap((group) => group.entryIds)) {
      expect(dashboardSource).toContain(entryId);
    }
    expect(profileSource).toContain('getPlatformCockpitHref');
    expect(profileSource).toContain('buildLoginRedirectForPath');
  });

  it('keeps login error states tied to the same callback destination contract', () => {
    const loginFormSource = readSource('src/components/shared/credential-login-form.tsx');

    expect(loginFormSource).toContain("setError('账号或密码错误')");
    expect(loginFormSource).toContain('callbackUrl');
    expect(loginFormSource).toContain('resolvePostLoginRedirect');
  });
});
