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
  PLATFORM_ROUTE_COMPATIBILITY_REDIRECTS,
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
import { resolveScopedReturnTarget } from '@/lib/navigation-return-target';

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
    ]);
    expect(entries.every((entry) => entry.group === 'student-core')).toBe(true);
    expect(entries.map((entry) => entry.id)).not.toContain('student-profile');
  });

  it('defines student, teacher, admin, and guest navigation groups', () => {
    expect(getPlatformRoleNavigation('student').map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/dashboard', '/simulations', '/knowledge', '/arena', '/interactive-learning', '/profile']),
    );
    expect(getPlatformRoleNavigation('student').map((entry) => entry.href)).not.toContain('/data-center');
    expect(getPlatformRoleNavigation('student').map((entry) => entry.href)).not.toContain('/virtual-lab');
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
        '/data-center',
      ]),
    );
    expect(getPlatformRoleNavigation('admin').map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/admin', '/admin/users', '/admin/states', '/admin/data-governance', '/admin/config', '/data-center']),
    );
    expect(getPlatformRoleNavigation('guest').map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/', '/login', '/simulations', '/knowledge', '/arena']),
    );
    expect(getPlatformRoleNavigation('guest').map((entry) => entry.href)).not.toContain('/virtual-lab');
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
    expect(intentGroups.find((group) => group.intent === 'experiment')?.entries.map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/simulations', '/interactive-learning/control-workbench']),
    );
    expect(intentGroups.find((group) => group.intent === 'experiment')?.entries.map((entry) => entry.href)).not.toContain(
      '/virtual-lab',
    );
    expect(intentGroups.flatMap((group) => group.compatibilityAliases)).toEqual(
      expect.arrayContaining(['/interactive-learning/control-workbench?mode=explore&preset=classic-four-view']),
    );
    expect(STUDENT_LEARNING_INTENT_GROUPS.flatMap((group) => group.compatibilityAliases)).toEqual(
      expect.arrayContaining(
        getStudentCoreNavigationEntries()
          .flatMap((entry) => entry.aliasHrefs ?? [])
          .filter((href) => href.includes('control-workbench')),
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
      '/interactive-learning/chapter-components',
      '/interactive-learning/chapter-components/[category]',
      '/interactive-learning/resources/[id]',
      '/interactive-learning/cross-domain-exploration',
      '/interactive-learning/courses/[courseId]',
      '/interactive-learning/courses/[courseId]/teacher/[sessionId]/waiting',
      '/interactive-learning/courses/unit-4-1-design-task-expression',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]',
      '/interactive-learning/courses/unit-5-4-data-driven-mpc-transition',
      '/simulations',
      '/simulations/cruise',
      '/simulations/lng',
      '/simulations/destroyer',
      '/simulations/drilling',
      '/simulations/container',
      '/simulations/icebreaker',
      '/simulations/dredger',
      '/arena',
      '/arena/challenges/[taskId]',
      '/assessment/adaptive-practice',
      '/interactive-learning/control-workbench',
      '/dashboard',
      '/profile',
      '/profile/growth',
      '/profile/portfolio',
      '/profile/evidence',
      '/assessment/document-feedback',
      '/data-center',
      '/classroom/student/[sessionId]',
      '/interactive-learning/courses/unit-4-1-design-task-expression/student/[sessionId]',
      '/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]',
      '/interactive-learning/courses/[course]/student/[sessionId]',
      '/interactive-learning/courses/[course]/teacher/[sessionId]',
      '/playlists/[id]/play',
      '/teacher',
      '/teacher/classes',
      '/teacher/classes/new',
      '/teacher/classes/[classId]',
      '/teacher/classes/[classId]/analytics-v2',
      '/teacher/classes/[classId]/students/[studentId]',
      '/teacher/classes/[classId]/students/[studentId]/evidence',
      '/teacher/lesson-plans',
      '/teacher/lesson-plans/new',
      '/teacher/lesson-plans/[id]/edit',
      '/teacher/preset-lessons',
      '/teacher/resources',
      '/teacher/resources/resource-nodes',
      '/teacher/history',
      '/teacher/grading-workbench',
      '/teacher/prep-packs',
      '/teacher/arena',
      '/teacher/arena/publications/[publicationId]',
      '/admin',
      '/admin/users',
      '/admin/states',
      '/admin/config',
      '/admin/lesson-plans',
      '/admin/lesson-plans/new',
      '/admin/lesson-plans/[id]/edit',
      '/admin/data-governance',
      '/ai',
      '/ai/copilot',
      '/knowledge',
      '/graph-center',
    ]);
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.every((route) => route.routeFile.startsWith('src/app/'))).toBe(true);
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.every((route) => existsSync(join(process.cwd(), route.routeFile)))).toBe(true);
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => route.href)).toEqual(
      expect.arrayContaining(['/arena', '/assessment/adaptive-practice', '/data-center', '/admin/data-governance']),
    );
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/login')).toMatchObject({
      frame: 'public-entry',
      authState: 'auth-entry',
      mobileNavigation: 'auth-callback-panel',
      floatingDock: 'hidden',
      aliases: ['/login?callbackUrl=%2Fprofile'],
      legacyFrameAliases: expect.arrayContaining([
        expect.objectContaining({
          alias: 'auth-entry',
          owningChange: 'converge-route-ledger-to-canonical-archetypes',
        }),
      ]),
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/courses')).toMatchObject({
      frame: 'mission-workspace',
      navigationLayers: expect.arrayContaining(['global-product', 'contextual-workspace']),
      floatingDock: 'collapsed',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/courses/unit-4-1-design-task-expression')).toMatchObject({
      frame: 'learning-atlas',
      roleScope: ['guest', 'student', 'teacher'],
      floatingDock: 'collapsed',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/control-workbench')).toMatchObject({
      frame: 'mission-workspace',
      navigationLayers: expect.arrayContaining(['global-product', 'contextual-workspace', 'local-tool']),
      floatingDock: 'enabled',
      visualQaProfile: 'immersive',
      aliases: expect.arrayContaining([
        '/interactive-learning/control-workbench?arenaTask=:taskId',
        '/interactive-learning/control-workbench?arenaTask=:taskId&publicationId=:publicationId',
      ]),
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/simulations/cruise')).toMatchObject({
      frame: 'mission-workspace',
      floatingDock: 'collapsed',
      mobileNavigation: 'workspace-command-surface',
      visualQaProfile: 'immersive',
      owningChange: 'introduce-simulation-shell-mission-workspace',
      aliases: expect.arrayContaining([
        '/simulations/cruise?arenaTask=:taskId',
      ]),
    });
    for (const href of [
      '/simulations/cruise',
      '/simulations/lng',
      '/simulations/destroyer',
      '/simulations/drilling',
      '/simulations/container',
      '/simulations/icebreaker',
      '/simulations/dredger',
    ]) {
      expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === href)).toMatchObject({
        frame: 'mission-workspace',
        floatingDock: 'collapsed',
        mobileNavigation: 'workspace-command-surface',
        dockDisposition: expect.arrayContaining([
          expect.objectContaining({
            component: 'GlobalAIFloatingButton',
            disposition: 'registered-shared-dock',
          }),
        ]),
        owningChange: 'introduce-simulation-shell-mission-workspace',
        contextualReturn: expect.objectContaining({
          sourceContext: 'simulation-descendant',
          fallbackHref: '/simulations',
        }),
      });
    }
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/arena/challenges/[taskId]')).toMatchObject({
      routePattern: '/arena/challenges/:taskId',
      routeFile: 'src/app/arena/challenges/[taskId]/page.tsx',
      frame: 'mission-workspace',
      owningChange: 'unify-arena-workspace-shell',
      unifiedUiMigrationOwner: 'migrate-mission-workspaces-to-unified-shell',
      floatingDock: 'collapsed',
      visualQaProfile: 'immersive',
      screenshotProfile: 'representative-covered',
      legacyShell: expect.objectContaining({
        component: 'ArenaPageShell',
        owningChange: 'converge-route-ledger-to-canonical-archetypes',
      }),
      contextualReturn: {
        sourceContext: 'arena-challenge',
        targetHint: 'Return to the Arena challenge list when leaving a challenge detail.',
        fallbackHref: '/arena',
      },
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/teacher')).toMatchObject({
      frame: 'operations-console',
      owningChange: 'migrate-operations-report-ledger-surfaces',
      roleScope: ['teacher'],
      navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/teacher/grading-workbench')).toMatchObject({
      frame: 'report-ledger',
      owningChange: 'migrate-operations-report-ledger-surfaces',
      roleScope: ['teacher', 'admin'],
      navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
      floatingDock: 'enabled',
      legacyFrameAliases: expect.arrayContaining([expect.objectContaining({ alias: 'teacher-operations' })]),
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/teacher/prep-packs')).toMatchObject({
      frame: 'report-ledger',
      owningChange: 'migrate-operations-report-ledger-surfaces',
      roleScope: ['teacher'],
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/admin')).toMatchObject({
      frame: 'operations-console',
      owningChange: 'migrate-operations-report-ledger-surfaces',
      roleScope: ['admin'],
      navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
      floatingDock: 'enabled',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/admin/data-governance')).toMatchObject({
      frame: 'operations-console',
      roleScope: ['admin'],
      navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
      floatingDock: 'enabled',
    });
  });

  it('uses only canonical route archetypes and records temporary legacy aliases', () => {
    const canonicalArchetypes = new Set([
      'public-entry',
      'learning-atlas',
      'mission-workspace',
      'knowledge-data-map',
      'operations-console',
      'report-ledger',
    ]);
    const invalidFrames = PLATFORM_PRIMARY_ROUTE_INVENTORY
      .filter((route) => !canonicalArchetypes.has(route.frame))
      .map((route) => `${route.href}:${route.frame}`);
    expect(invalidFrames).toEqual([]);

    const missingLegacyAliasRetirement = PLATFORM_PRIMARY_ROUTE_INVENTORY.flatMap((route) => {
      const problems: string[] = [];
      for (const alias of route.legacyFrameAliases ?? []) {
        if (!alias.owningChange) problems.push(`${route.href}:${alias.alias}:owningChange`);
        if (!alias.retirementCondition) problems.push(`${route.href}:${alias.alias}:retirementCondition`);
        if (alias.retirementCondition.includes('undefined')) {
          problems.push(`${route.href}:${alias.alias}:retirementCondition=undefined`);
        }
      }
      return problems;
    });
    expect(missingLegacyAliasRetirement).toEqual([]);

    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning')).toMatchObject({
      frame: 'mission-workspace',
      legacyFrameAliases: expect.arrayContaining([expect.objectContaining({ alias: 'immersive-task-workspace' })]),
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/arena')).toMatchObject({
      frame: 'mission-workspace',
      legacyFrameAliases: expect.arrayContaining([expect.objectContaining({ alias: 'immersive-task-workspace' })]),
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/knowledge')).toMatchObject({
      frame: 'knowledge-data-map',
      legacyFrameAliases: expect.arrayContaining([expect.objectContaining({ alias: 'knowledge-graph' })]),
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/graph-center')).toMatchObject({
      frame: 'knowledge-data-map',
      navigationLayers: expect.arrayContaining(['global-product', 'contextual-workspace', 'local-tool']),
      floatingDock: 'collapsed',
      owningChange: 'build-graph-center-readonly-foundation',
    });
  });

  it('records route alias retirement metadata and a single unified UI migration owner', () => {
    const missingAliasRetirements = PLATFORM_PRIMARY_ROUTE_INVENTORY.flatMap((route) => (
      (route.aliases ?? [])
        .filter((alias) => !route.aliasRetirements?.some((retirement) => (
          retirement.alias === alias
          && retirement.retirementCondition
          && !retirement.retirementCondition.includes('undefined')
        )))
        .map((alias) => `${route.href}:${alias}:aliasRetirements`)
    ));
    expect(missingAliasRetirements).toEqual([]);

    const missingUnifiedOwners = PLATFORM_PRIMARY_ROUTE_INVENTORY
      .filter((route) => !route.unifiedUiMigrationOwner && !route.exception)
      .map((route) => `${route.href}:unifiedUiMigrationOwner`);
    expect(missingUnifiedOwners).toEqual([]);

    const duplicateOwnerClaims = PLATFORM_PRIMARY_ROUTE_INVENTORY.flatMap((route) => {
      const owners = [route.unifiedUiMigrationOwner, route.exception?.owner].filter(Boolean);
      return owners.length > 1 ? [`${route.href}:${owners.join('|')}`] : [];
    });
    expect(duplicateOwnerClaims).toEqual([]);

    const invalidExceptionRetirements = PLATFORM_PRIMARY_ROUTE_INVENTORY.flatMap((route) => {
      if (!route.exception) return [];
      return (route.legacyFrameAliases ?? [])
        .filter((alias) => !alias.retirementCondition.includes(route.exception?.owner ?? ''))
        .map((alias) => `${route.href}:${alias.alias}:missing-exception-owner`);
    });
    expect(invalidExceptionRetirements).toEqual([]);
  });

  it('assigns each primary route to one migration owner with shell retirement metadata', () => {
    const ownerByHref = new Map<string, string>();

    for (const route of PLATFORM_PRIMARY_ROUTE_INVENTORY) {
      expect(route.owningChange).toMatch(/^[a-z0-9-]+$/);
      expect(route.themeSupport.length).toBeGreaterThan(0);
      for (const theme of route.themeSupport) {
        expect(['light', 'dark']).toContain(theme);
      }
      expect(route.authState).toBeTruthy();
      expect(route.mobileNavigation).toBeTruthy();
      expect(route.shellMigrationDisposition).toBeTruthy();
      expect(route.shellRemovalCondition).toBeTruthy();
      expect(route.screenshotProfile).toBeTruthy();
      expect(route.unifiedUiMigrationOwner || route.exception?.owner).toBeTruthy();

      const previousOwner = ownerByHref.get(route.href);
      expect(previousOwner ? `${route.href}:${previousOwner}` : undefined).toBeUndefined();
      ownerByHref.set(route.href, route.owningChange);
    }

    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/data-center')?.owningChange).toBe(
      'restrict-data-center-to-operations-roles',
    );
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/knowledge')?.owningChange).toBe(
      'migrate-knowledge-map-to-unified-shell-panels',
    );
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/admin/data-governance')?.owningChange).toBe(
      'migrate-operations-report-ledger-surfaces',
    );
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/teacher/arena')?.owningChange).toBe(
      'redesign-immersive-learning-workspaces',
    );
  });

  it('keeps public entry routes limited to homepage and auth entry states', () => {
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/')).toMatchObject({
      frame: 'public-entry',
      shellMigrationDisposition: 'adapted',
      mobileNavigation: 'public-entry-menu',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/login')).toMatchObject({
      frame: 'public-entry',
      authState: 'auth-entry',
      mobileNavigation: 'auth-callback-panel',
    });
    const nonPublicEntryRoutes = PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => (
      route.href !== '/' && route.href !== '/login'
    ));
    expect(nonPublicEntryRoutes.every((route) => route.frame !== 'public-entry')).toBe(true);
    expect(nonPublicEntryRoutes.every((route) => route.mobileNavigation !== 'public-entry-menu')).toBe(true);
    expect(nonPublicEntryRoutes.every((route) => route.shellRemovalCondition.includes(route.owningChange) || route.exception)).toBe(true);
  });

  it('resolves auth callback and Arena challenge detail through canonical route metadata', () => {
    expect(resolvePlatformRouteInventory('/login?callbackUrl=%2Fprofile')).toMatchObject({
      href: '/login',
      frame: 'public-entry',
      authState: 'auth-entry',
      aliases: expect.arrayContaining(['/login?callbackUrl=%2Fprofile']),
    });
    expect(resolvePlatformRouteInventory('/arena/challenges/task-second-order-lead-pid')).toMatchObject({
      href: '/arena/challenges/[taskId]',
      routePattern: '/arena/challenges/:taskId',
      frame: 'mission-workspace',
      mobileNavigation: 'drawer',
      contextualReturn: {
        sourceContext: 'arena-challenge',
        fallbackHref: '/arena',
      },
    });
    expect(resolvePlatformRouteInventory('/arena')).toMatchObject({
      href: '/arena',
      frame: 'mission-workspace',
      mobileNavigation: 'drawer',
    });
    expect(resolvePlatformRouteInventory('/interactive-learning/control-workbench')).toMatchObject({
      href: '/interactive-learning/control-workbench',
      frame: 'mission-workspace',
      mobileNavigation: 'drawer',
    });
    expect(resolvePlatformRouteInventory('/interactive-learning/chapter-components/time-domain')).toMatchObject({
      href: '/interactive-learning/chapter-components/[category]',
      frame: 'learning-atlas',
      contextualReturn: {
        fallbackHref: '/interactive-learning/chapter-components',
      },
    });
    expect(resolvePlatformRouteInventory('/interactive-learning/resources/demo-resource?source=chapter-components&category=time-domain')).toMatchObject({
      href: '/interactive-learning/resources/[id]',
      frame: 'learning-atlas',
      contextualReturn: {
        fallbackHref: '/interactive-learning',
      },
    });
  });

  it('does not let public-entry leak into authenticated workspaces', () => {
    const nonHomeRoutes = PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => route.href !== '/' && route.href !== '/login');
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
    expect(resolvePlatformRouteInventory('/interactive-learning/courses/unit-5-4-data-driven-mpc-transition')?.href).toBe(
      '/interactive-learning/courses/unit-5-4-data-driven-mpc-transition',
    );
    expect(resolvePlatformRouteInventory('/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo-session')).toMatchObject({
      href: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]',
      owningChange: 'implement-unit-1-1-see-the-full-picture',
    });
    expect(resolvePlatformRouteInventory('/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/demo-session')).toMatchObject({
      href: '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]',
      owningChange: 'implement-unit-1-1-see-the-full-picture',
    });
    for (const course of [
      'unit-2-1-modeling-language',
      'unit-3-4-root-locus-reading-validation',
      'unit-5-4-data-driven-mpc-transition',
    ]) {
      expect(resolvePlatformRouteInventory(`/interactive-learning/courses/${course}/student/demo-session`)).toMatchObject({
        href: '/interactive-learning/courses/[course]/student/[sessionId]',
        owningChange: 'legacy-interactive-runtime-route-ledger-coverage',
        exception: expect.objectContaining({
          affectedCapability: 'interactive-lesson-runtime-legacy-pages',
        }),
      });
      expect(resolvePlatformRouteInventory(`/interactive-learning/courses/${course}/teacher/demo-session`)).toMatchObject({
        href: '/interactive-learning/courses/[course]/teacher/[sessionId]',
        owningChange: 'legacy-interactive-runtime-route-ledger-coverage',
        authState: 'mixed',
        exception: expect.objectContaining({
          affectedCapability: 'interactive-lesson-runtime-legacy-pages',
        }),
      });
    }
    expect(resolvePlatformRouteInventory('/interactive-learning/courses/unit-4-1-design-task-expression/student/demo')).toMatchObject({
      href: '/interactive-learning/courses/unit-4-1-design-task-expression/student/[sessionId]',
      roleScope: ['guest', 'student'],
      authState: 'mixed',
    });
    expect(resolvePlatformRouteInventory('/interactive-learning/courses/unit-4-1-design-task-expression/teacher/demo')).toMatchObject({
      href: '/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]',
      roleScope: ['teacher', 'admin'],
      authState: 'protected-redirect',
    });
    expect(resolvePlatformRouteInventory('/interactive-learning/chapter-components/modeling-language')?.href).toBe(
      '/interactive-learning/chapter-components/[category]',
    );
    expect(resolvePlatformRouteInventory('/interactive-learning/resources/lesson09-correction-precheck')?.href).toBe(
      '/interactive-learning/resources/[id]',
    );
    expect(resolvePlatformRouteInventory('/simulations/cruise?arenaTask=task-cruise-roll-blackbox-identification')?.href).toBe(
      '/simulations/cruise',
    );
    expect(resolvePlatformRouteInventory('/simulations/lng')?.href).toBe('/simulations/lng');
    expect(resolvePlatformRouteInventory('/simulations/destroyer')?.href).toBe('/simulations/destroyer');
    expect(resolvePlatformRouteInventory('/simulations/drilling')?.href).toBe('/simulations/drilling');
    expect(resolvePlatformRouteInventory('/teacher/lesson-plans/demo-plan/edit')?.href).toBe(
      '/teacher/lesson-plans/[id]/edit',
    );
    expect(resolvePlatformRouteInventory('/admin/lesson-plans/demo-plan/edit')?.href).toBe(
      '/admin/lesson-plans/[id]/edit',
    );
    expect(resolvePlatformRouteInventory('/interactive-learning/control-workbench?arenaTask=task-second-order-lead-pid')?.href).toBe(
      '/interactive-learning/control-workbench',
    );

    const studentKnowledgeNavigation = getPlatformRouteNavigation('/knowledge', 'student').map((entry) => entry.href);
    expect(studentKnowledgeNavigation).toEqual(
      expect.arrayContaining(['/knowledge', '/interactive-learning']),
    );
    expect(studentKnowledgeNavigation).not.toContain('/data-center');
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
    const studentGraphCenterNavigation = getPlatformRouteNavigation('/graph-center', 'student').map((entry) => entry.href);
    expect(studentGraphCenterNavigation).toEqual(
      expect.arrayContaining(['/knowledge', '/interactive-learning']),
    );
    expect(studentGraphCenterNavigation).not.toContain('/data-center');
    expect(adminKnowledgeNavigation).not.toContain('/login');
    expect(getPlatformRouteNavigation('/teacher/classes/demo-class', 'teacher').map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/teacher', '/teacher/classes', '/teacher/lesson-plans']),
    );
    expect(getPlatformRouteNavigation('/classroom/student/demo-session', 'student')).toEqual([]);
    expect(getPlatformRouteNavigation('/interactive-learning/courses/unit-4-1-design-task-expression/student/demo-session', 'student').map((entry) => entry.href)).toEqual(
      expect.arrayContaining(['/interactive-learning']),
    );
  });

  it('resolves every declared route alias through the central inventory', () => {
    const unresolvedAliases = PLATFORM_PRIMARY_ROUTE_INVENTORY.flatMap((route) => (
      (route.aliases ?? [])
        .filter((alias) => !resolvePlatformRouteInventory(alias))
        .map((alias) => `${route.href}:${alias}`)
    ));
    expect(unresolvedAliases).toEqual([]);

    const currentPrimaryHrefs = new Set(PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => route.href));
    const aliasConflicts = PLATFORM_PRIMARY_ROUTE_INVENTORY.flatMap((route) => (
      (route.aliases ?? [])
        .filter((alias) => currentPrimaryHrefs.has(alias))
        .map((alias) => `${route.href}->${alias}`)
    ));
    expect(aliasConflicts).toEqual([]);
  });

  it('separates learner record, evidence review, and platform data-center semantics', () => {
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/profile')).toMatchObject({
      frame: 'report-ledger',
      mobileNavigation: 'role-route-tabs',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/profile/growth')).toMatchObject({
      frame: 'report-ledger',
      mobileNavigation: 'role-route-tabs',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/profile/portfolio')).toMatchObject({
      frame: 'report-ledger',
      mobileNavigation: 'role-route-tabs',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/profile/evidence')).toMatchObject({
      frame: 'report-ledger',
      mobileNavigation: 'role-route-tabs',
      owningChange: 'redesign-learner-data-and-report-surfaces',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/assessment/document-feedback')).toMatchObject({
      frame: 'report-ledger',
      roleScope: ['student'],
      mobileNavigation: 'role-route-tabs',
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/data-center')).toMatchObject({
      frame: 'knowledge-data-map',
      roleScope: ['teacher', 'admin'],
      navigationLayers: expect.arrayContaining(['role-cockpit', 'contextual-workspace']),
      owningChange: 'restrict-data-center-to-operations-roles',
    });
    expect(COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.find((group) => group.intent === 'review')).toMatchObject({
      entryIds: ['student-profile'],
      hrefs: ['/profile/evidence', '/profile/growth', '/profile'],
    });
    expect(COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.find((group) => group.intent === 'review')?.summary).not.toContain('数据中心');
    expect(COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.find((group) => group.intent === 'account-profile')?.summary).toContain('个人中心');
  });

  it('records explicit temporary exceptions for special teaching and AI routes', () => {
    const exceptions = PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => route.exception);
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

    expect(exceptions.map((route) => route.href)).toEqual([
      '/classroom/student/[sessionId]',
      '/interactive-learning/courses/[course]/student/[sessionId]',
      '/interactive-learning/courses/[course]/teacher/[sessionId]',
      '/playlists/[id]/play',
      '/teacher/classes/new',
      '/teacher/lesson-plans/new',
      '/teacher/lesson-plans/[id]/edit',
      '/admin/lesson-plans/new',
      '/admin/lesson-plans/[id]/edit',
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
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]')).toMatchObject({
      routePattern: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/:sessionId',
      frame: 'mission-workspace',
      roleScope: ['guest', 'student'],
      authState: 'mixed',
      floatingDock: 'collapsed',
      mobileNavigation: 'workspace-command-surface',
      navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]')).toMatchObject({
      routePattern: '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/:sessionId',
      frame: 'mission-workspace',
      roleScope: ['teacher', 'admin'],
      floatingDock: 'collapsed',
      mobileNavigation: 'workspace-command-surface',
      navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/courses/unit-4-1-design-task-expression/student/[sessionId]')).toMatchObject({
      routePattern: '/interactive-learning/courses/unit-4-1-design-task-expression/student/:sessionId',
      frame: 'mission-workspace',
      roleScope: ['guest', 'student'],
      authState: 'mixed',
      floatingDock: 'collapsed',
      desktopNavigation: 'collapsible',
      navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    });
    expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === '/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]')).toMatchObject({
      routePattern: '/interactive-learning/courses/unit-4-1-design-task-expression/teacher/:sessionId',
      frame: 'mission-workspace',
      roleScope: ['teacher', 'admin'],
      floatingDock: 'collapsed',
      desktopNavigation: 'collapsible',
      navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    });
  });

  it('records route-level legacy shell and dock dispositions for primary routes that still use adapters', () => {
    const shellRoutes = PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => route.legacyShell);
    expect(shellRoutes.map((route) => [route.href, route.legacyShell?.component])).toEqual(
      expect.arrayContaining([
        ['/arena', 'ArenaPageShell'],
        ['/teacher', 'TeacherLayout'],
        ['/admin', 'AdminConsoleHeader'],
        ['/admin/data-governance', 'AdminConsoleHeader'],
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
      ['teacher-class-analytics-report', 'teacher-report', 'primary-route', '/teacher/classes/[classId]/analytics-v2'],
      ['document-grading-workbench-ledger', 'grading', 'primary-route', '/teacher/grading-workbench'],
      ['teacher-prep-pack-review-slot', 'prep-pack', 'embedded-component', '/teacher'],
      ['teacher-prep-pack-review', 'prep-pack', 'primary-route', '/teacher/prep-packs'],
      ['assistant-effect-report-export', 'assistant-effect', 'export-view', '/teacher'],
      ['governance-data-quality-snapshot', 'governance', 'primary-route', '/admin/data-governance'],
      ['data-center-platform-snapshot', 'data-center', 'primary-route', '/data-center'],
    ]);
    expect(PLATFORM_REPORT_SURFACE_INVENTORY.filter((surface) => (
      ['teacher-report', 'grading', 'prep-pack', 'assistant-effect', 'governance'].includes(surface.category)
    )).every((surface) => surface.owningChange === 'migrate-operations-report-ledger-surfaces')).toBe(true);
    for (const surface of PLATFORM_REPORT_SURFACE_INVENTORY) {
      expect(existsSync(join(process.cwd(), surface.sourceFile))).toBe(true);
      const sourceRoute = PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === surface.ownerRoute);
      if (sourceRoute) {
        expect(surface.sourceShellOwner).toBe(sourceRoute.owningChange);
      } else {
        expect(surface.sourceShellOwner).toBe('redesign-immersive-learning-workspaces');
      }
    }
  });

  it('keeps report surface owner routes resolvable through the primary route inventory', () => {
    const unresolvedOwnerRoutes = PLATFORM_REPORT_SURFACE_INVENTORY
      .filter((surface) => !resolvePlatformRouteInventory(surface.ownerRoute))
      .map((surface) => `${surface.id}:${surface.ownerRoute}`);
    expect(unresolvedOwnerRoutes).toEqual([]);
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
      'unify-arena-workspace-shell',
    );
    expect(COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES.find((route) => route.href === '/simulations')?.firstViewportRequirement).toBe(
      'usable ship imagery, difficulty, course fit, canonical simulation entry, and launch action visible',
    );
    expect(
      COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES.find((route) => route.href === '/simulations')?.firstViewportRequirement,
    ).not.toMatch(/task status|任务状态|deployment|preparing/i);
    expect(COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES.every((route) => route.viewportWidths.join(',') === '1440,320')).toBe(true);
    expect(resolveCommercialEntryHref('account-profile', false)).toBe('/login?callbackUrl=%2Fprofile');
    expect(resolveCommercialEntryHref('account-profile', true)).toBe('/profile');
    expect(resolveCommercialEntryHref('review', true)).toBe('/profile/evidence');
    expect(PLATFORM_ROUTE_COMPATIBILITY_REDIRECTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: '/virtual-lab',
          to: '/simulations',
          owner: 'unify-virtual-simulation-information-architecture',
        }),
      ]),
    );
  });

  it('binds public learning entry route sources to the premium entry map contract', () => {
    const homeSource = readSource('src/app/page.tsx');
    const loginSource = readSource('src/app/(auth)/login/page.tsx');
    const interactiveSource = readSource('src/app/interactive-learning/page.tsx');
    const coursesSource = readSource('src/app/interactive-learning/courses/page.tsx');
    const chapterCategorySource = readSource('src/app/interactive-learning/chapter-components/[category]/page.tsx');
    const crossDomainSource = readSource('src/app/interactive-learning/cross-domain-exploration/page.tsx');
    const resourceSource = readSource('src/app/interactive-learning/resources/[id]/page.tsx');
    const simulationsSource = readSource('src/app/simulations/page.tsx');
    const virtualLabSource = readSource('src/app/virtual-lab/page.tsx');
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
    expect(chapterCategorySource).toContain('source=chapter-components&category=');
    expect(crossDomainSource).toContain('source=cross-domain-exploration');
    expect(resourceSource).toContain('data-route-source={sourceContext.href}');
    expect(resourceSource).toContain('resolveAdaptivePathLaunchReturnContext(searchParams)');
    expect(resourceSource).toContain('buildAdaptivePathCompletionRequest');
    expect(resourceSource).toContain('onComplete={handlePathResourceComplete}');
    expect(resourceSource).toContain("label: '学习路径'");
    expect(resourceSource).toContain('breadcrumbs={[');
    expect(resourceSource).toContain('h-[calc(100vh-12rem)] min-h-[calc(100vh-12rem)]');
    expect(readSource('src/features/interactive/shared/lesson-runtime-shell.tsx')).toContain(
      'const runtimeReturnLabel = pathLaunchContext ?',
    );
    expect(readSource('src/features/interactive/shared/lesson-runtime-shell.tsx')).toContain(
      '{ label: runtimeReturnLabel, href: runtimeReturnHref }',
    );
    expect(coursesSource).toContain('data-learning-entry-map="course-module-progression"');
    expect(coursesSource).toContain('data-entry-current-work-priority="recommended-course"');
    expect(coursesSource).toContain('data-secondary-implementation-links="legacy-source-labels"');
    expect(coursesSource).toContain('data-course-entry-action="launch"');
    expect(simulationsSource).toContain('data-simulation-entry-map="scenario-fleet"');
    expect(simulationsSource).toContain('data-simulation-catalog-source="canonical"');
    expect(simulationsSource).toContain('data-entry-primary-action="recommended-experiment"');
    expect(simulationsSource).toContain('data-simulation-scenario-card={simulation.id}');
    expect(simulationsSource).toContain('data-simulation-scenario-fit={simulation.id}');
    expect(simulationsSource).toContain('data-simulation-canonical-launch={simulation.id}');
    expect(simulationsSource).not.toContain('data-simulation-task-status={simulation.id}');
    expect(simulationsSource).not.toContain('taskStatus');
    expect(simulationsSource).not.toContain('任务状态');
    expect(simulationsSource).not.toContain('任务链开放');
    expect(simulationsSource).not.toContain('已部署');
    expect(simulationsSource).not.toContain('筹备中');
    expect(virtualLabSource).toContain("redirect('/simulations')");
    expect(virtualLabSource).not.toContain('已上架模型');
    expect(virtualLabSource).not.toContain('当前开放');
    expect(virtualLabSource).not.toContain('筹备中');
    expect(virtualLabSource).not.toContain('modelPath');
    expect(virtualLabSource).not.toContain('任务链：');
    expect(readSource('src/features/arena/arena-hall.tsx')).toContain('data-entry-current-work-priority="active-arena-publication"');
    expect(readSource('src/app/assessment/adaptive-practice/page.tsx')).toContain('data-commercial-entry-intent="practice"');
    expect(readSource('src/app/assessment/adaptive-practice/page.tsx')).toContain('data-student-entry-evidence-return="/profile/evidence"');
    for (const simulationRouteFile of [
      'src/app/simulations/cruise/page.tsx',
      'src/app/simulations/lng/page.tsx',
      'src/app/simulations/destroyer/page.tsx',
      'src/app/simulations/drilling/page.tsx',
      'src/app/simulations/container/page.tsx',
      'src/app/simulations/icebreaker/page.tsx',
      'src/app/simulations/dredger/page.tsx',
    ]) {
      const simulationDetailSource = readSource(simulationRouteFile);
      expect(simulationDetailSource).toContain('SimulationShell');
      expect(simulationDetailSource).toContain('localToolTemplate=');
      expect(simulationDetailSource).not.toContain('FeaturePageNav');
    }
    expect(readSource('src/app/simulations/destroyer/page.tsx')).toContain('localToolTemplate="heading-control"');
    expect(readSource('src/app/simulations/lng/page.tsx')).toContain('localToolTemplate="heading-control"');
    expect(readSource('src/app/simulations/container/page.tsx')).toContain('localToolTemplate="heading-control"');
    expect(readSource('src/app/simulations/drilling/page.tsx')).toContain('localToolTemplate="dp-positioning"');
    expect(readSource('src/app/simulations/dredger/page.tsx')).toContain('localToolTemplate="dp-positioning"');
    expect(readSource('src/app/simulations/cruise/page.tsx')).toContain('localToolTemplate="comfort-frequency"');
    expect(readSource('src/app/simulations/icebreaker/page.tsx')).toContain('localToolTemplate="ice-propulsion"');
    expect(unit41EntrySource).toContain('data-commercial-student-entry-route={`/interactive-learning/courses/${config.routeSegment}`}');
    expect(unit41EntrySource).toContain('data-commercial-entry-intent="learn"');
    expect(unit41EntrySource).toContain('data-task-workspace-archetype="lesson-runtime"');
    expect(unit41EntrySource).toContain('data-course-entry-action="teacher-launch"');
    expect(unit41EntrySource).toContain('data-course-entry-action="demo-launch"');
    expect(unit41EntrySource).toContain('data-course-entry-action="join-code"');
  });

  it('preserves source-aware return targets for secondary teacher and admin descendants', () => {
    const teacherNewClassSource = readSource('src/app/teacher/classes/new/page.tsx');
    const teacherClassDetailSource = readSource('src/app/teacher/classes/[classId]/page.tsx');
    const teacherLessonPlansSource = readSource('src/app/teacher/lesson-plans/page.tsx');
    const teacherNewLessonPlanSource = readSource('src/app/teacher/lesson-plans/new/page.tsx');
    const teacherEditLessonPlanSource = readSource('src/app/teacher/lesson-plans/[id]/edit/page.tsx');
    const teacherDashboardSource = readSource('src/features/teacher/teacher-dashboard.tsx');
    const presetLessonsSource = readSource('src/features/teacher/preset-lessons/preset-lesson-list.tsx');
    const adminLessonPlansSource = readSource('src/app/admin/lesson-plans/page.tsx');
    const adminNewLessonPlanSource = readSource('src/app/admin/lesson-plans/new/page.tsx');
    const adminEditLessonPlanSource = readSource('src/app/admin/lesson-plans/[id]/edit/page.tsx');
    const lessonPlanListSource = readSource('src/features/lesson-engine/lesson-plan-list.tsx');

    expect(teacherNewClassSource).toContain('useSearchParams');
    expect(teacherNewClassSource).toContain('resolveScopedReturnTarget(');
    expect(teacherClassDetailSource).toContain('returnTo=${encodeURIComponent(`/teacher/classes/${classId}`)}');
    expect(teacherLessonPlansSource).toContain('/teacher/lesson-plans/new?returnTo=%2Fteacher%2Flesson-plans');
    expect(teacherNewLessonPlanSource).toContain('returnPath={returnTarget}');
    expect(teacherNewLessonPlanSource).toContain('workbenchReturnLabel={getTeacherReturnLabel(returnTarget)}');
    expect(teacherEditLessonPlanSource).toContain('returnPath={returnTarget}');
    expect(teacherDashboardSource).toContain("encodeURIComponent('/teacher')");
    expect(presetLessonsSource).toContain("encodeURIComponent('/teacher/preset-lessons')");
    expect(adminLessonPlansSource).toContain('/admin/lesson-plans/new?returnTo=%2Fadmin%2Flesson-plans');
    expect(adminLessonPlansSource).toContain('session.user.role !== UserRole.ADMIN');
    expect(adminNewLessonPlanSource).toContain('session.user.role !== UserRole.ADMIN');
    expect(adminNewLessonPlanSource).toContain('workbenchReturnLabel="返回教案管理"');
    expect(adminEditLessonPlanSource).toContain('session.user.role !== UserRole.ADMIN');
    expect(adminEditLessonPlanSource).toContain('workbenchReturnLabel="返回教案管理"');
    expect(lessonPlanListSource).toContain('returnTo?: string');
    expect(lessonPlanListSource).toContain('encodeURIComponent(returnTo)');
  });

  it('binds knowledge graph local tools to open, closed, and mobile state contracts', () => {
    const knowledgeGraphSource = readSource('src/features/knowledge/knowledge-graph-system.tsx');

    expect(knowledgeGraphSource).toContain('data-knowledge-desktop-command-system="compact"');
    expect(knowledgeGraphSource).toContain("data-knowledge-local-tool={desktopActiveTool ?? 'closed'}");
    expect(knowledgeGraphSource).toContain("data-state={desktopActiveTool ? 'open' : 'closed'}");
    expect(knowledgeGraphSource).toContain('data-knowledge-command-trigger={item.id}');
    expect(knowledgeGraphSource).toContain('data-knowledge-local-tool-summary="desktop"');
    expect(knowledgeGraphSource).toContain('data-knowledge-local-tool="chapter-directory"');
    expect(knowledgeGraphSource).toContain('data-knowledge-local-tool="relation-filters"');
    expect(knowledgeGraphSource).toContain('data-knowledge-active-filter-summary={activeFilterSummary}');
    expect(knowledgeGraphSource).toContain('data-knowledge-mobile-command-surface="single-tool-panel"');
    expect(knowledgeGraphSource).toContain("data-state={mobileToolPanelOpen ? 'open' : 'closed'}");
    expect(knowledgeGraphSource).toContain('data-knowledge-mobile-panel-toggle="true"');
    expect(knowledgeGraphSource).toContain('{mobileToolPanelOpen && (');
    expect(knowledgeGraphSource).toContain('data-knowledge-mobile-tool-panel={mobileActiveTool}');
    expect(knowledgeGraphSource).toContain('data-knowledge-local-tool="legend"');
    expect(knowledgeGraphSource).toContain('data-knowledge-local-tool="view-layout"');
    expect(knowledgeGraphSource).toContain('data-knowledge-local-panel="view-layout-controls"');
  });

  it('sanitizes scoped secondary route return targets', () => {
    expect(resolveScopedReturnTarget('/teacher/classes/demo', '/teacher/lesson-plans', ['/teacher'])).toBe('/teacher/classes/demo');
    expect(resolveScopedReturnTarget('/teacher/classes/demo?from=list#top', '/teacher/lesson-plans', ['/teacher'])).toBe('/teacher/classes/demo?from=list#top');
    expect(resolveScopedReturnTarget('/admin/lesson-plans', '/admin', ['/admin'])).toBe('/admin/lesson-plans');
    expect(resolveScopedReturnTarget('/admin/lesson-plans', '/teacher', ['/teacher'])).toBe('/teacher');
    expect(resolveScopedReturnTarget('/teacher/../admin', '/teacher', ['/teacher'])).toBe('/teacher');
    expect(resolveScopedReturnTarget('/teacher/%2e%2e/admin', '/teacher', ['/teacher'])).toBe('/teacher');
    expect(resolveScopedReturnTarget('https://example.com', '/teacher', ['/teacher'])).toBe('/teacher');
    expect(resolveScopedReturnTarget('//example.com', '/teacher', ['/teacher'])).toBe('/teacher');
  });
});
