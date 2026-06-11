import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS,
  COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES,
  PLATFORM_REPORT_SURFACE_INVENTORY,
  PLATFORM_AUTH_ROUTE_CONTRACTS,
  PLATFORM_CONTEXTUAL_RETURN_TARGET_RULES,
  PLATFORM_ENTRYPOINT_SMOKE_ROUTES,
  PLATFORM_NAVIGATION_LAYERS,
  PLATFORM_NAVIGATION_FEATURE_FLAGS,
  PLATFORM_PRIMARY_ROUTE_INVENTORY,
  PLATFORM_PROFILE_AND_COCKPIT_ACTIONS,
  PLATFORM_ROLE_COCKPIT_HREFS,
  STUDENT_LEARNING_INTENT_GROUPS,
  STUDENT_CORE_ENTRY_IDS,
  getCommercialStudentEntryIntentGroups,
  resolveCommercialEntryHref,
  getPlatformCockpitHref,
  getPlatformNavigationHref,
  getPlatformRouteNavigation,
  getPlatformRoleNavigation,
  getStudentLearningIntentNavigationGroups,
  getStudentCoreNavigationEntries,
  resolvePlatformRouteInventory,
} from '@/lib/platform-role-navigation';

describe('platform role navigation', () => {
  const readSource = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

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
    });
    expect(getPlatformCockpitHref('STUDENT')).toBe('/dashboard');
    expect(getPlatformCockpitHref('TEACHER')).toBe('/teacher');
    expect(getPlatformCockpitHref('ADMIN')).toBe('/admin');
    expect(getPlatformCockpitHref('AUDIT')).toBe('/dashboard');
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
      { href: '/login?callbackUrl=%2Fprofile', routeFile: 'src/app/(auth)/login/page.tsx', viewportWidths: [1440, 320] },
    ]);
  });

  it('defines commercial navigation layers without promoting contextual workspaces to global nav', () => {
    expect(PLATFORM_NAVIGATION_LAYERS.map((layer) => layer.id)).toEqual([
      'global-product',
      'role-cockpit',
      'contextual-workspace',
      'local-tool',
    ]);
    expect(PLATFORM_NAVIGATION_LAYERS.find((layer) => layer.id === 'global-product')?.entryGroups).toEqual([
      'public',
      'student-core',
    ]);
    expect(PLATFORM_NAVIGATION_LAYERS.find((layer) => layer.id === 'contextual-workspace')?.workspaceModes).toEqual([
      'arena',
      'control-workbench',
      'interactive-learning',
      'adaptive-learning',
      'teacher',
      'admin',
    ]);
    expect(
      PLATFORM_NAVIGATION_LAYERS.find((layer) => layer.id === 'contextual-workspace')?.duplicatesGlobalNavigation,
    ).toBe(false);
    expect(PLATFORM_NAVIGATION_LAYERS.find((layer) => layer.id === 'local-tool')).toMatchObject({
      entryGroups: [],
      duplicatesGlobalNavigation: false,
    });
  });

  it('groups student destinations by learning intent and preserves compatibility aliases', () => {
    const intentGroups = getStudentLearningIntentNavigationGroups();

    expect(intentGroups.map((group) => group.intent)).toEqual([
      'learn',
      'practice',
      'challenge',
      'experiment',
      'review-profile',
    ]);
    expect(intentGroups.find((group) => group.intent === 'learn')?.entries.map((entry) => entry.id)).toEqual([
      'student-knowledge',
      'student-interactive-learning',
    ]);
    expect(intentGroups.find((group) => group.intent === 'experiment')?.entries.map((entry) => entry.id)).toEqual([
      'student-simulations',
      'student-control-workbench',
    ]);
    expect(intentGroups.flatMap((group) => group.compatibilityAliases)).toEqual(
      expect.arrayContaining(['/profile/growth', '/interactive-learning/control-workbench?mode=explore&preset=classic-four-view']),
    );
    expect(STUDENT_LEARNING_INTENT_GROUPS.flatMap((group) => group.compatibilityAliases)).toEqual(
      expect.arrayContaining(
        getStudentCoreNavigationEntries()
          .flatMap((entry) => entry.aliasHrefs ?? [])
          .filter((href) => href === '/profile/growth' || href.includes('control-workbench')),
      ),
    );
  });

  it('separates profile/account actions from role cockpit actions', () => {
    expect(PLATFORM_PROFILE_AND_COCKPIT_ACTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          audience: 'student',
          profileHref: '/profile',
          cockpitHref: '/dashboard',
          primaryWorkspaceAction: 'cockpit',
        }),
        expect.objectContaining({
          audience: 'teacher',
          profileHref: '/profile',
          cockpitHref: '/teacher',
          primaryWorkspaceAction: 'cockpit',
        }),
        expect.objectContaining({
          audience: 'guest',
          profileHref: '/login?callbackUrl=%2Fprofile',
          cockpitHref: '/login',
          primaryWorkspaceAction: 'account',
        }),
      ]),
    );
  });

  it('declares route-derived return targets and auth callback route semantics', () => {
    expect(PLATFORM_CONTEXTUAL_RETURN_TARGET_RULES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workspaceMode: 'control-workbench',
          routePrefix: '/interactive-learning/control-workbench',
          sourceContext: 'arena-challenge',
          fallbackHref: '/interactive-learning',
        }),
        expect.objectContaining({
          workspaceMode: 'control-workbench',
          sourceContext: 'arena-publication',
          fallbackHref: '/arena',
        }),
      ]),
    );
    expect(PLATFORM_AUTH_ROUTE_CONTRACTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/login?callbackUrl=%2Fprofile',
          preservesDestination: '/profile',
          preservesDestinationOnError: true,
          errorStateIntent: 'retry-with-same-destination',
          exposesProfileAction: true,
          exposesCockpitAction: true,
        }),
        expect.objectContaining({
          href: '/login',
          roleCockpitFallbacks: PLATFORM_ROLE_COCKPIT_HREFS,
        }),
      ]),
    );
  });

  it('maintains the primary route inventory for shell, navigation, and dock decisions', () => {
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => route.href)).toEqual([
      '/',
      '/login',
      '/interactive-learning',
      '/interactive-learning/courses',
      '/interactive-learning/courses/unit-4-1-design-task-expression',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]',
      '/interactive-learning/courses/unit-5-4-data-driven-mpc-transition',
      '/simulations',
      '/simulations/cruise',
      '/arena',
      '/assessment/adaptive-practice',
      '/interactive-learning/control-workbench',
      '/dashboard',
      '/profile',
      '/profile/growth',
      '/profile/portfolio',
      '/profile/evidence',
      '/data-center',
      '/classroom/student/[sessionId]',
      '/interactive-learning/courses/[course]/student/[sessionId]',
      '/playlists/[id]/play',
      '/teacher',
      '/teacher/classes',
      '/teacher/classes/[classId]',
      '/teacher/classes/[classId]/analytics-v2',
      '/teacher/classes/[classId]/students/[studentId]',
      '/teacher/classes/[classId]/students/[studentId]/evidence',
      '/teacher/lesson-plans',
      '/teacher/preset-lessons',
      '/teacher/resources',
      '/teacher/resources/resource-nodes',
      '/teacher/history',
      '/teacher/arena',
      '/admin',
      '/admin/users',
      '/admin/states',
      '/admin/config',
      '/admin/lesson-plans',
      '/admin/data-governance',
      '/ai',
      '/ai/copilot',
      '/knowledge',
    ]);
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.every((route) => route.routeFile.startsWith('src/app/'))).toBe(true);
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.every((route) => existsSync(join(process.cwd(), route.routeFile)))).toBe(true);
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => route.href)).toEqual(
      expect.arrayContaining(['/arena', '/assessment/adaptive-practice', '/data-center', '/admin/data-governance']),
    );
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/login')).toMatchObject({
      frame: 'auth-entry',
      floatingDock: 'hidden',
      aliases: ['/login?callbackUrl=%2Fprofile'],
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/courses')).toMatchObject({
      frame: 'learning-map',
      navigationLayers: expect.arrayContaining(['global-product', 'contextual-workspace']),
      floatingDock: 'collapsed',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/courses/unit-4-1-design-task-expression')).toMatchObject({
      frame: 'learning-map',
      roleScope: ['guest', 'student', 'teacher'],
      floatingDock: 'collapsed',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/control-workbench')).toMatchObject({
      frame: 'immersive-task-workspace',
      navigationLayers: expect.arrayContaining(['global-product', 'contextual-workspace', 'local-tool']),
      floatingDock: 'enabled',
      visualQaProfile: 'immersive',
      aliases: expect.arrayContaining([
        '/interactive-learning/control-workbench?arenaTask=:taskId',
        '/interactive-learning/control-workbench?arenaTask=:taskId&publicationId=:publicationId',
      ]),
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/simulations/cruise')).toMatchObject({
      frame: 'immersive-task-workspace',
      floatingDock: 'hidden',
      visualQaProfile: 'immersive',
      aliases: expect.arrayContaining([
        '/simulations/cruise?arenaTask=:taskId',
      ]),
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/teacher')).toMatchObject({
      frame: 'teacher-operations',
      roleScope: ['teacher'],
      navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/admin')).toMatchObject({
      frame: 'admin-governance',
      roleScope: ['admin'],
      navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
      floatingDock: 'enabled',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/admin/data-governance')).toMatchObject({
      frame: 'admin-governance',
      roleScope: ['admin'],
      navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
      floatingDock: 'enabled',
    });
  });

  it('assigns each primary route to one migration owner with shell retirement metadata', () => {
    const ownerByHref = new Map<string, string>();

    for (const route of PLATFORM_PRIMARY_ROUTE_INVENTORY) {
      expect(route.owningChange).toMatch(/^[a-z0-9-]+$/);
      expect(route.themeSupport).toEqual(expect.arrayContaining(['light', 'dark']));
      expect(route.authState).toBeTruthy();
      expect(route.mobileNavigation).toBeTruthy();
      expect(route.shellMigrationDisposition).toBeTruthy();
      expect(route.shellRemovalCondition).toBeTruthy();
      expect(route.screenshotProfile).toBeTruthy();

      const previousOwner = ownerByHref.get(route.href);
      expect(previousOwner ? `${route.href}:${previousOwner}` : undefined).toBeUndefined();
      ownerByHref.set(route.href, route.owningChange);
    }

    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/data-center')?.owningChange).toBe(
      'redesign-knowledge-and-data-surfaces',
    );
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/knowledge')?.owningChange).toBe(
      'redesign-knowledge-and-data-surfaces',
    );
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/admin/data-governance')?.owningChange).toBe(
      'redesign-operations-and-report-surfaces',
    );
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/teacher/arena')?.owningChange).toBe(
      'redesign-immersive-learning-workspaces',
    );
  });

  it('keeps homepage as the only public-entry navigation variant', () => {
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/')).toMatchObject({
      frame: 'public-entry',
      shellMigrationDisposition: 'adapted',
      mobileNavigation: 'public-entry-menu',
    });
    const nonHomeRoutes = PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => route.href !== '/');
    expect(nonHomeRoutes.every((route) => route.frame !== 'public-entry')).toBe(true);
    expect(nonHomeRoutes.every((route) => route.mobileNavigation !== 'public-entry-menu')).toBe(true);
    expect(nonHomeRoutes.every((route) => route.shellRemovalCondition.includes(route.owningChange) || route.exception)).toBe(true);
  });

  it('resolves primary routes and derives route-family navigation from inventory layers', () => {
    expect(resolvePlatformRouteInventory('/login?callbackUrl=%2Fprofile')?.href).toBe('/login');
    expect(resolvePlatformRouteInventory('/profile/growth')?.href).toBe('/profile/growth');
    expect(resolvePlatformRouteInventory('/profile/portfolio')?.href).toBe('/profile/portfolio');
    expect(resolvePlatformRouteInventory('/teacher/classes/demo-class/students/demo-student')?.href).toBe(
      '/teacher/classes/[classId]/students/[studentId]',
    );
    expect(resolvePlatformRouteInventory('/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/student/demo-session')?.href).toBe(
      '/interactive-learning/courses/[course]/student/[sessionId]',
    );
    expect(resolvePlatformRouteInventory('/simulations/cruise?arenaTask=task-cruise-roll-blackbox-identification')?.href).toBe(
      '/simulations/cruise',
    );
    expect(resolvePlatformRouteInventory('/interactive-learning/control-workbench?arenaTask=task-second-order-lead-pid')?.href).toBe(
      '/interactive-learning/control-workbench',
    );

    const studentKnowledgeNavigation = getPlatformRouteNavigation('/knowledge', 'student').map((entry) => entry.href);
    expect(studentKnowledgeNavigation).toEqual(
      expect.arrayContaining(['/knowledge', '/interactive-learning', '/data-center']),
    );
    expect(new Set(studentKnowledgeNavigation).size).toBe(studentKnowledgeNavigation.length);
    expect(studentKnowledgeNavigation).not.toContain('/login');

    const teacherKnowledgeNavigation = getPlatformRouteNavigation('/knowledge', 'teacher').map((entry) => entry.href);
    expect(teacherKnowledgeNavigation).toEqual(
      expect.arrayContaining(['/', '/knowledge', '/arena']),
    );
    expect(teacherKnowledgeNavigation).not.toContain('/data-center');
    expect(teacherKnowledgeNavigation).not.toContain('/login');

    const adminKnowledgeNavigation = getPlatformRouteNavigation('/knowledge', 'admin').map((entry) => entry.href);
    expect(adminKnowledgeNavigation).toEqual(
      expect.arrayContaining(['/', '/knowledge', '/arena']),
    );
    expect(adminKnowledgeNavigation).not.toContain('/data-center');
    expect(adminKnowledgeNavigation).not.toContain('/login');
    expect(getPlatformRouteNavigation('/teacher/classes/demo-class', 'teacher').map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/teacher', '/teacher/classes', '/teacher/lesson-plans']),
    );
    expect(getPlatformRouteNavigation('/classroom/student/demo-session', 'student')).toEqual([]);
    expect(getPlatformRouteNavigation('/interactive-learning/courses/unit-4-1-design-task-expression/student/demo-session', 'student')).toEqual([]);
  });

  it('separates learner record, evidence review, and platform data-center semantics', () => {
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/profile')).toMatchObject({
      frame: 'learner-data',
      mobileNavigation: 'role-route-tabs',
      aliases: expect.arrayContaining(['/profile/growth', '/profile/portfolio']),
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/profile/evidence')).toMatchObject({
      frame: 'learner-data',
      owningChange: 'redesign-learner-data-and-report-surfaces',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/data-center')).toMatchObject({
      frame: 'learner-data',
      navigationLayers: expect.arrayContaining(['global-product', 'contextual-workspace']),
      owningChange: 'redesign-knowledge-and-data-surfaces',
    });
    expect(COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.find((group) => group.intent === 'review')?.summary).toContain('数据中心');
    expect(COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.find((group) => group.intent === 'account-profile')?.summary).toContain('个人中心');
  });

  it('records explicit temporary exceptions for special teaching and AI routes', () => {
    const exceptions = PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => route.exception);
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

    expect(exceptions.map((route) => route.href)).toEqual([
      '/classroom/student/[sessionId]',
      '/interactive-learning/courses/[course]/student/[sessionId]',
      '/playlists/[id]/play',
      '/ai',
      '/ai/copilot',
    ]);
    for (const route of exceptions) {
      expect(route.shellMigrationDisposition).toBe('retained-temporary');
      expect(route.exception).toMatchObject({
        owner: route.owningChange,
        affectedCapability: expect.any(String),
        reason: expect.any(String),
        removalCondition: route.shellRemovalCondition,
      });
      expect(route.exception?.expiresOn).toMatch(isoDatePattern);
    }
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/courses/[course]/student/[sessionId]')).toMatchObject({
      routePattern: '/interactive-learning/courses/:course/student/:sessionId',
      coveredRouteGlob: 'src/app/interactive-learning/courses/*/student/[sessionId]/page.tsx',
    });
  });

  it('records route-level legacy shell and dock dispositions for primary routes that still use adapters', () => {
    const shellRoutes = PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => route.legacyShell);
    expect(shellRoutes.map((route) => [route.href, route.legacyShell?.component])).toEqual(
      expect.arrayContaining([
        ['/interactive-learning', 'UnifiedTopBar'],
        ['/interactive-learning/courses', 'UnifiedTopBar'],
        ['/simulations', 'FeaturePageNav'],
        ['/arena', 'ArenaPageShell'],
        ['/teacher', 'TeacherLayout'],
        ['/admin', 'AdminConsoleHeader'],
        ['/admin/data-governance', 'AdminConsoleHeader'],
        ['/knowledge', 'UnifiedTopBar'],
      ]),
    );
    for (const route of shellRoutes) {
      const shell = route.legacyShell;
      if (!shell) throw new Error(`missing legacy shell for ${route.href}`);
      expect(existsSync(join(process.cwd(), shell.sourceFile))).toBe(true);
      expect(readSource(shell.sourceFile)).toContain(shell.component);
      expect(shell.removalCondition).toMatch(/AppShell|workspace shell|shell/i);
    }

    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/ai')?.dockDisposition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: 'GlobalAIFloatingButton', disposition: 'registered-shared-dock' }),
      ]),
    );
  });

  it('fails when inventoried primary routes use known legacy shells without route-level disposition', () => {
    const legacyShellNames = ['UnifiedTopBar', 'ArenaPageShell', 'TeacherLayout', 'AdminConsoleHeader', 'FeaturePageNav'];
    for (const route of PLATFORM_PRIMARY_ROUTE_INVENTORY) {
      const source = readSource(route.legacyShell?.sourceFile ?? route.routeFile);
      const usedLegacyShell = legacyShellNames.find((name) => source.includes(name));
      if (!usedLegacyShell) continue;

      expect(route.legacyShell).toMatchObject({
        component: usedLegacyShell,
        sourceFile: expect.any(String),
        removalCondition: expect.any(String),
      });
    }
  });

  it('identifies report and snapshot surfaces before report visual migration', () => {
    expect(PLATFORM_REPORT_SURFACE_INVENTORY.map((surface) => [surface.id, surface.category, surface.surfaceType, surface.ownerRoute])).toEqual([
      ['classroom-session-report', 'classroom', 'primary-route', '/classroom/student/[sessionId]'],
      ['arena-challenge-result', 'arena', 'embedded-component', '/arena/challenges/[taskId]'],
      ['arena-publication-report', 'arena', 'primary-route', '/teacher/arena/publications/[publicationId]'],
      ['learner-growth-report', 'learner', 'primary-route', '/profile/growth'],
      ['learner-evidence-report', 'learner', 'primary-route', '/profile/evidence'],
      ['governance-data-quality-snapshot', 'governance', 'primary-route', '/admin/data-governance'],
      ['data-center-platform-snapshot', 'data-center', 'primary-route', '/data-center'],
    ]);
    expect(PLATFORM_REPORT_SURFACE_INVENTORY.every((surface) => surface.owningChange === 'redesign-report-ledger-and-export-surfaces')).toBe(true);
    for (const surface of PLATFORM_REPORT_SURFACE_INVENTORY) {
      expect(existsSync(join(process.cwd(), surface.sourceFile))).toBe(true);
      const sourceRoute = PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === surface.ownerRoute);
      if (sourceRoute) {
        expect(surface.sourceShellOwner).toBe(sourceRoute.owningChange);
      } else {
        expect(surface.sourceShellOwner).toBe('redesign-immersive-learning-workspaces');
      }
      expect(surface.sourceShellOwner).not.toBe(surface.owningChange);
    }
  });

  it('defines commercial student entry intents and route acceptance matrix', () => {
    expect(getCommercialStudentEntryIntentGroups().map((group) => group.intent)).toEqual([
      'learn',
      'practice',
      'challenge',
      'experiment',
      'review',
      'account-profile',
    ]);
    expect(COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.find((group) => group.intent === 'account-profile')?.hrefs).toEqual(
      expect.arrayContaining(['/login?callbackUrl=%2Fprofile', '/profile']),
    );
    expect(COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES.map((route) => [route.href, route.currentIntent])).toEqual([
      ['/', 'experiment'],
      ['/login?callbackUrl=%2Fprofile', 'account-profile'],
      ['/dashboard', 'learn'],
      ['/interactive-learning', 'learn'],
      ['/interactive-learning/courses', 'learn'],
      ['/interactive-learning/courses/unit-4-1-design-task-expression', 'learn'],
      ['/simulations', 'experiment'],
      ['/arena', 'challenge'],
      ['/assessment/adaptive-practice', 'practice'],
      ['/profile', 'review'],
    ]);
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/simulations')?.owningChange).toBe(
      'redesign-immersive-learning-workspaces',
    );
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/arena')?.owningChange).toBe(
      'redesign-immersive-learning-workspaces',
    );
    expect(COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES.every((route) => route.viewportWidths.join(',') === '1440,320')).toBe(true);
    expect(resolveCommercialEntryHref('account-profile', false)).toBe('/login?callbackUrl=%2Fprofile');
    expect(resolveCommercialEntryHref('account-profile', true)).toBe('/profile');
    expect(resolveCommercialEntryHref('review', true)).toBe('/profile');
  });

  it('binds public learning entry route sources to the premium entry map contract', () => {
    const homeSource = readSource('src/app/page.tsx');
    const loginSource = readSource('src/app/(auth)/login/page.tsx');
    const interactiveSource = readSource('src/app/interactive-learning/page.tsx');
    const coursesSource = readSource('src/app/interactive-learning/courses/page.tsx');
    const simulationsSource = readSource('src/app/simulations/page.tsx');
    const unit41EntrySource = readSource('src/features/interactive/shared/premium-lesson-entry-page.tsx');

    expect(homeSource).toContain('data-commercial-student-entry-route="/"');
    expect(homeSource).toContain('data-commercial-entry-intent="experiment"');
    expect(homeSource).toContain('data-entry-primary-action="current-experiment"');
    expect(homeSource).toContain('data-entry-secondary-action="student-cockpit"');
    expect(loginSource).toContain('data-auth-callback-target={callbackTarget ??');
    expect(loginSource).toContain('data-auth-route-trace="callback-to-role-cockpit"');
    expect(loginSource).toContain('data-auth-error-state="destination-preserved"');
    expect(loginSource).toContain('decodeURIComponent(callbackUrl)');
    expect(loginSource).toContain('目标路径：');
    expect(loginSource).toContain('data-commercial-entry-intent="account-profile"');
    expect(interactiveSource).toContain('data-learning-entry-map="student-intent"');
    expect(interactiveSource).toContain('data-commercial-entry-intent-map="learn-practice-challenge"');
    expect(interactiveSource).toContain('data-entry-current-work-priority="active-learning-context"');
    expect(interactiveSource).toContain('data-secondary-implementation-links="component-library"');
    expect(coursesSource).toContain('data-learning-entry-map="course-module-progression"');
    expect(coursesSource).toContain('data-entry-current-work-priority="recommended-course"');
    expect(coursesSource).toContain('data-secondary-implementation-links="legacy-source-labels"');
    expect(coursesSource).toContain('data-course-entry-action="launch"');
    expect(simulationsSource).toContain('data-simulation-entry-map="scenario-fleet"');
    expect(simulationsSource).toContain('data-entry-current-work-priority="recommended-experiment"');
    expect(simulationsSource).toContain('data-simulation-scenario-card={simulation.id}');
    expect(simulationsSource).toContain('data-simulation-scenario-fit={simulation.id}');
    expect(simulationsSource).toContain('data-simulation-task-status={simulation.id}');
    expect(readSource('src/features/arena/arena-hall.tsx')).toContain('data-entry-current-work-priority="active-arena-publication"');
    expect(readSource('src/app/assessment/adaptive-practice/page.tsx')).toContain('data-commercial-entry-intent="practice"');
    expect(readSource('src/app/assessment/adaptive-practice/page.tsx')).toContain('data-student-entry-evidence-return="/profile/evidence"');
    expect(unit41EntrySource).toContain('data-commercial-student-entry-route={`/interactive-learning/courses/${config.routeSegment}`}');
    expect(unit41EntrySource).toContain('data-commercial-entry-intent="learn"');
    expect(unit41EntrySource).toContain('data-task-workspace-archetype="lesson-runtime"');
    expect(unit41EntrySource).toContain('data-course-entry-action="teacher-launch"');
    expect(unit41EntrySource).toContain('data-course-entry-action="demo-launch"');
    expect(unit41EntrySource).toContain('data-course-entry-action="join-code"');
  });
});
