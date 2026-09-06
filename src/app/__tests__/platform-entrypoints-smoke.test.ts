import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES,
  PLATFORM_ENTRYPOINT_SMOKE_ROUTES,
  getStudentLearningIntentNavigationGroups,
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
    const homepageEntryLabels = getStudentLearningIntentNavigationGroups()
      .flatMap((group) => group.entries)
      .map((entry) => entry.label);

    expect(source).toContain('getStudentLearningIntentNavigationGroups');
    expect(source).toContain('resolveCommercialEntryHref');
    expect(source).toContain('showMobileNavigation');
    expect(source).toContain('aria-label={');
    expect(source).toContain('打开平台入口菜单');
    expect(source).toContain('aria-label="移动平台入口菜单"');
    expect(source).toContain('lg:hidden');
    expect(source).toContain('PlatformBrandLockup');
    expect(source).toContain('data-homepage-theme-switch');
    expect(source).toContain('data-entry-secondary-action="account-profile"');
    expect(source).toContain('homepageStudentEntries.map((entry)');
    expect(source).not.toContain('进入驾驶舱');
    expect(source).not.toContain('homepageEntryIntentGroups');
    expect(source).not.toContain('intentGroup.entryIds.includes');
    expect(source).not.toContain('const moduleLinks = [');
    expect(homepageEntryLabels).toEqual(['知识资源', '互动学习', '学习路径', '竞技场', '虚拟仿真', '控制工作台']);
    expect(homepageEntryLabels).not.toContain('个人中心');
    // 提示词复盘入口收敛到个人中心学习入口地图（用户裁决 2026-09-05），不再出现在首页。
    expect(homepageEntryLabels).not.toContain('提示词复盘');
  });

  it('keeps Deep Blue brand assets behind the shared lockup contract', () => {
    const lockupSource = readSource('src/components/shared/platform-brand-lockup.tsx');
    const layoutSource = readSource('src/app/layout.tsx');
    const metadataPath = path.join(rootDir, 'public/assets/platform-brand/deepblue-smart-control-logo-meta.json');
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as {
      brand?: string;
      asset?: string;
      darkAsset?: string;
      originalAsset?: string;
      originalDarkAsset?: string;
      sourceAsset?: string;
      generator?: string;
      modelFamily?: string;
      owningChange?: string;
      lightDarkTreatment?: { light?: string; dark?: string };
      fallbackBehavior?: { textAlternative?: string; componentFallback?: string };
    };

    expect(existsSync(path.join(rootDir, 'public/assets/platform-brand/deepblue-smart-control-logo.png'))).toBe(true);
    expect(existsSync(path.join(rootDir, 'public/assets/platform-brand/deepblue-smart-control-logo-dark.png'))).toBe(true);
    expect(existsSync(path.join(rootDir, 'public/assets/platform-brand/deepblue-smart-control-logo-small.png'))).toBe(true);
    expect(existsSync(path.join(rootDir, 'public/assets/platform-brand/deepblue-smart-control-logo-dark-small.png'))).toBe(true);
    expect(existsSync(path.join(rootDir, 'public/assets/platform-brand/deepblue-smart-control-logo-source.png'))).toBe(true);
    expect(lockupSource).toContain('DEEPBLUE_SMART_CONTROL_LOGO_PATH');
    expect(lockupSource).toContain('DEEPBLUE_SMART_CONTROL_LOGO_DARK_PATH');
    expect(lockupSource).toContain('DEEPBLUE_SMART_CONTROL_LOGO_SMALL_PATH');
    expect(lockupSource).toContain('DEEPBLUE_SMART_CONTROL_LOGO_DARK_SMALL_PATH');
    expect(lockupSource).toContain('data-platform-brand-dark-asset');
    expect(lockupSource).toContain('data-platform-brand-original-asset');
    expect(lockupSource).toContain('data-platform-brand-lockup="deepblue-smart-control"');
    expect(lockupSource).toContain('alt="智控深蓝"');
    expect(lockupSource).toContain('基于学科垂类大模型的船舶智控教学平台');
    expect(layoutSource).toContain("title: '智控深蓝'");
    expect(layoutSource).toContain("description: '智控深蓝：基于学科垂类大模型的船舶智控教学平台'");
    expect(layoutSource).not.toContain('AI-OBE船舶控制平台');
    expect(layoutSource).not.toContain('AI-OBE船舶智控平台');
    expect(metadata).toMatchObject({
      brand: '智控深蓝',
      asset: '/assets/platform-brand/deepblue-smart-control-logo-small.png',
      darkAsset: '/assets/platform-brand/deepblue-smart-control-logo-dark-small.png',
      originalAsset: '/assets/platform-brand/deepblue-smart-control-logo.png',
      originalDarkAsset: '/assets/platform-brand/deepblue-smart-control-logo-dark.png',
      sourceAsset: '/assets/platform-brand/deepblue-smart-control-logo-source.png',
      generator: 'image2 via Codex image_gen',
      modelFamily: 'image2',
      owningChange: 'correct-platform-brand-name',
    });
    expect(metadata.lightDarkTreatment?.light).toContain('light');
    expect(metadata.lightDarkTreatment?.dark).toContain('dark');
    expect(metadata.fallbackBehavior?.textAlternative).toBe('智控深蓝');
    expect(metadata.fallbackBehavior?.componentFallback).toContain('visible Chinese platform description');
  });

  it('unifies login and homepage public brand copy to 智控深蓝', () => {
    const authLayoutSource = readSource('src/app/(auth)/layout.tsx');
    const homepageSource = readSource('src/app/page.tsx');
    const layoutSource = readSource('src/app/layout.tsx');
    const publicSurfaces = [
      authLayoutSource,
      homepageSource,
      layoutSource,
      readSource('src/components/shared/platform-brand-lockup.tsx'),
      readSource('src/app/simulations/dredger/page.tsx'),
      readSource('src/app/simulations/icebreaker/page.tsx'),
    ];

    expect(authLayoutSource).toContain('PlatformBrandLockup');
    expect(homepageSource).toContain('PlatformBrandLockup');
    expect(layoutSource).toContain("title: '智控深蓝'");
    expect(layoutSource).toContain('智控深蓝：基于学科垂类大模型的船舶智控教学平台');
    for (const source of publicSurfaces) {
      expect(source).not.toContain('AI-OBE船舶智控平台');
      expect(source).not.toContain('Mission Control for Maritime Education');
    }
  });

  it('reuses one credential login form for page and embedded login', () => {
    expect(readSource('src/app/(auth)/login/page.tsx')).toContain('CredentialLoginForm');
    expect(readSource('src/components/shared/login-modal.tsx')).toContain('CredentialLoginForm');
  });

  it('keeps dashboard compatibility and profile tied to shared navigation contracts', () => {
    const dashboardSource = readSource('src/app/(main)/dashboard/page.tsx');
    const profileSource = readSource('src/app/(main)/profile/page.tsx');
    const profileApiSource = readSource('src/app/api/user/profile/route.ts');

    expect(dashboardSource).toContain("redirect('/profile')");
    expect(dashboardSource).toContain('getPlatformCockpitHref');
    expect(dashboardSource).not.toContain('<AppShell');
    expect(profileSource).toContain('getPlatformCockpitHref');
    expect(profileSource).toContain('getCommercialStudentEntryIntentGroups');
    expect(profileSource).toContain('buildLoginRedirectForPath');
    expect(profileSource).toContain('学习入口地图');
    expect(profileSource).toContain('PersonalCenterEntryCard');
    expect(profileSource).toContain('getPlatformRoleNavigation');
    expect(profileSource).toContain('.flatMap((intent)');
    expect(profileSource).toContain('intent.hrefs.map((href)');
    expect(profileSource).toContain('studentEntryByHref.get(href)');
    expect(profileSource).toContain("prefetch={href.startsWith('/simulations') ? false : undefined}");
    expect(profileApiSource).toContain('ensureUserProfile');
    expect(profileApiSource).toContain('initializeUserProgress');
    expect(profileApiSource).toContain('await Promise.all([');
    expect(profileApiSource.indexOf('ensureUserProfile(userId)')).toBeLessThan(profileApiSource.indexOf('prisma.studentProfile.findUnique'));
  });

  it('keeps login error states tied to the same callback destination contract', () => {
    const loginSource = readSource('src/app/(auth)/login/page.tsx');
    const loginFormSource = readSource('src/components/shared/credential-login-form.tsx');
    const nextConfigSource = readSource('next.config.js');

    expect(loginSource).toContain('getCommercialStudentEntryIntentGroups');
    expect(loginSource).toContain('callbackUrl=%2Fprofile');
    expect(loginSource).toContain('保留目标');
    expect(loginSource).toContain('LoginCommercialFallback');
    expect(loginSource).toContain('data-auth-callback-target="pending-callback"');
    expect(loginFormSource).toContain("setError('账号或密码错误')");
    expect(loginFormSource).toContain('callbackUrl');
    expect(loginFormSource).toContain('resolvePostLoginRedirect');
    expect(loginFormSource).toContain('action="/login"');
    expect(loginFormSource).toContain('method="post"');
    expect(nextConfigSource).toContain("allowedDevOrigins: ['127.0.0.1']");
  });

  it('keeps product entry routes on the commercial entry-surface contract', () => {
    const routeSources = [
      readSource('src/app/interactive-learning/page.tsx'),
      readSource('src/features/arena/arena-hall.tsx'),
      readSource('src/app/assessment/adaptive-practice/page.tsx'),
    ];
    const courseCatalogSource = readSource('src/app/interactive-learning/courses/page.tsx');
    const arenaShellSource = readSource('src/features/arena/arena-page-shell.tsx');

    for (const source of routeSources) {
      expect(source).toContain('getCommercialStudentEntryIntentGroups');
      expect(source).toContain('data-commercial-student-entry-route');
      expect(source).toContain('data-commercial-entry-intent');
    }
    expect(arenaShellSource).toContain("getPlatformRouteNavigation('/arena', 'student')");
    expect(arenaShellSource).not.toContain('getStudentLearningIntentNavigationGroups().flatMap');
    expect(routeSources[2]).toContain('resolveControlCorrectionIntent');
    expect(routeSources[2]).toContain("routeIntent === 'contextual-recommendation'");
    expect(routeSources[2]).toContain('data-learner-record-surface={learnerDataShell.archetype}');
    expect(courseCatalogSource).toContain('data-learning-entry-map="course-module-progression"');
    expect(courseCatalogSource).toContain('data-course-entry-action="launch"');
  });
});
