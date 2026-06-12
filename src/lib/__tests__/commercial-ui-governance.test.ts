import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  COMMERCIAL_ROUTE_INVENTORY_VISUAL_ACCEPTANCE_ROUTES,
  DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES,
  PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX,
  evaluateCommercialUiGovernance,
  type CommercialAccessibilityTextFitEvidence,
  type CommercialNavigationCoverageInput,
  type CommercialUiGovernanceInput,
  type CommercialVisualQaNavigationState,
  type CommercialVisualAcceptanceEvidence,
} from '@/lib/commercial-ui-governance';
import {
  COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS,
  PLATFORM_PROFILE_AND_COCKPIT_ACTIONS,
  PLATFORM_PRIMARY_ROUTE_INVENTORY,
  PLATFORM_REPORT_SURFACE_INVENTORY,
  resolvePlatformRouteInventory,
  STUDENT_CORE_ENTRY_IDS,
  STUDENT_LEARNING_INTENT_GROUPS,
} from '@/lib/platform-role-navigation';

const today = '2026-05-31';

const fullNavigationCoverage: CommercialNavigationCoverageInput = {
  intents: COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.map((group) => group.intent),
  coreEntryIds: STUDENT_CORE_ENTRY_IDS,
  hrefs: COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.flatMap((group) => group.hrefs),
  aliases: STUDENT_LEARNING_INTENT_GROUPS.flatMap((group) => group.compatibilityAliases),
  profileHref: PLATFORM_PROFILE_AND_COCKPIT_ACTIONS.find((action) => action.audience === 'student')?.profileHref,
  cockpitHref: PLATFORM_PROFILE_AND_COCKPIT_ACTIONS.find((action) => action.audience === 'student')?.cockpitHref,
};

const mobileNavigationStateByBehavior = {
  'public-entry-menu': 'public-entry-menu',
  'auth-callback-panel': 'auth-callback-panel',
  'role-route-tabs': 'role-route-tabs',
  'workspace-command-surface': 'workspace-command-surface',
  drawer: 'mobile-drawer',
  'hidden-immersive': 'hidden-immersive',
} as const satisfies Record<
  NonNullable<(typeof PLATFORM_PRIMARY_ROUTE_INVENTORY)[number]['mobileNavigation']>,
  CommercialVisualQaNavigationState
>;

function findInventoryRoute(href: string) {
  return resolvePlatformRouteInventory(href);
}

function navigationStatesForWidth(
  width: number,
  inventoryRoute?: (typeof PLATFORM_PRIMARY_ROUTE_INVENTORY)[number],
): CommercialVisualQaNavigationState[] {
  if (width === 1440) return ['desktop-expanded', 'desktop-collapsed'];
  if (
    inventoryRoute?.frame === 'mission-workspace'
    && inventoryRoute.floatingDock !== 'hidden'
    && inventoryRoute.shellMigrationDisposition === 'adapted'
    && inventoryRoute.legacyShell?.disposition !== 'scheduled-replacement'
    && inventoryRoute.legacyShell?.disposition !== 'retained-temporary'
    && !inventoryRoute.exception
  ) {
    return ['mobile-drawer'];
  }
  return [mobileNavigationStateByBehavior[inventoryRoute?.mobileNavigation ?? 'drawer']];
}

function completeVisualEvidence(): CommercialVisualAcceptanceEvidence[] {
  return DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES.map((route) => {
    const inventoryRoute = findInventoryRoute(route.href);
    const reportEvidence = PLATFORM_REPORT_SURFACE_INVENTORY
      .filter((surface) => surface.ownerRoute === route.href && surface.visualQaProfile !== 'temporary-exception')
      .map((surface) => ({
        surfaceId: surface.id,
        watermarkChecked: true,
        privacyScopeChecked: true,
        sourceQualityVisible: true,
        statusLegendReadable: true,
        exportSafeSnapshotChecked: surface.surfaceType !== 'temporary-gap',
      }));
    const premiumRoutes = PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.filter((entry) => entry.href === route.href);
    const viewports = premiumRoutes.length > 0
      ? premiumRoutes.flatMap((premiumRoute) => premiumRoute.requiredThemes.flatMap((theme) => (
          premiumRoute.requiredWidths.flatMap((width) => navigationStatesForWidth(width, inventoryRoute).map((navigationState) => ({
            width,
            theme,
            role: premiumRoute.role,
            requestedRoute: route.href,
            finalUrl: premiumRoute.acceptedAuthState === 'unauth-redirect-fallback'
              ? 'http://localhost:3000/login'
              : `http://localhost:3000${route.href}`,
            authState: premiumRoute.acceptedAuthState,
            routeFile: premiumRoute.routeFile,
            routeArchetype: inventoryRoute?.frame,
            dockState: premiumRoute.floatingDock,
            navigationState,
            result: 'passed' as const,
            screenshot: `artifacts/commercial-ui/${route.href.replace(/[^a-z0-9]+/gi, '-')}-${premiumRoute.acceptedAuthState}-${theme}-${width}-${navigationState}.png`,
            firstViewportUseful: true,
            firstViewportTaskVisible: true,
            navigationReachable: true,
            noTextOverlap: true,
            stablePanelGeometry: true,
            coherentBrandApplication: true,
            taskControlsVisible: true,
            dockPlacementChecked: premiumRoute.floatingDock !== 'hidden',
            noDockCollision: premiumRoute.floatingDock !== 'hidden',
            dockFocusReachable: premiumRoute.floatingDock !== 'hidden',
            mobileCanvasFirst: width === 320 ? true : undefined,
            noPersistentMobileSidebar: width === 320 ? true : undefined,
            noPersistentMobileFilter: width === 320 ? true : undefined,
            noPersistentWorkbenchPanels: width === 320 ? true : undefined,
            noPersistentKnowledgeGraphDrawer: width === 320 ? true : undefined,
            reportEvidence,
          })))
        )))
      : (['light', 'dark'] as const).flatMap((theme) => route.requiredWidths.flatMap((width) => (
          navigationStatesForWidth(width, inventoryRoute).map((navigationState) => ({
            width,
            theme,
            role: 'student' as const,
            requestedRoute: route.href,
            finalUrl: `http://localhost:3000${route.href}`,
            authState: 'public' as const,
            routeFile: inventoryRoute?.routeFile,
            routeArchetype: inventoryRoute?.frame,
            dockState: inventoryRoute?.floatingDock === 'enabled' ? 'required' as const : inventoryRoute?.floatingDock,
            navigationState,
            result: 'passed' as const,
            screenshot: `artifacts/commercial-ui/${route.href.replace(/[^a-z0-9]+/gi, '-')}-${theme}-${width}-${navigationState}.png`,
            firstViewportUseful: true,
            firstViewportTaskVisible: true,
            navigationReachable: true,
            noTextOverlap: true,
            stablePanelGeometry: true,
            coherentBrandApplication: true,
            taskControlsVisible: true,
            dockPlacementChecked: true,
            noDockCollision: true,
            dockFocusReachable: true,
            mobileCanvasFirst: width === 320 ? true : undefined,
            noPersistentMobileSidebar: width === 320 ? true : undefined,
            noPersistentMobileFilter: width === 320 ? true : undefined,
            noPersistentWorkbenchPanels: width === 320 ? true : undefined,
            noPersistentKnowledgeGraphDrawer: width === 320 ? true : undefined,
            reportEvidence,
          }))
        )));
    return {
      href: route.href,
      viewports,
    };
  });
}

function completeAccessibilityEvidence(): CommercialAccessibilityTextFitEvidence[] {
  return DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES.map((route) => ({
    href: route.href,
    viewports: route.requiredWidths.map((width) => ({
      width,
      contrastChecked: true,
      visibleFocus: true,
      keyboardReachable: true,
      reducedMotionChecked: true,
      buttonTextFits: true,
      noMobileTextOverlap: true,
    })),
  }));
}

function baseInput(overrides: Partial<CommercialUiGovernanceInput> = {}): CommercialUiGovernanceInput {
  return {
    mode: 'blocking',
    today,
    navigationCoverage: fullNavigationCoverage,
    visualEvidence: completeVisualEvidence(),
    accessibilityEvidence: completeAccessibilityEvidence(),
    ...overrides,
  };
}

describe('commercial UI governance', () => {
  it('defines premium platform visual QA routes for light, dark, desktop, mobile, and dock placement', () => {
    expect(PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.map((route) => route.href)).toEqual([
      '/',
      '/login',
      '/interactive-learning',
      '/interactive-learning/courses',
      '/interactive-learning/courses/unit-4-1-design-task-expression',
      '/interactive-learning/courses/unit-5-4-data-driven-mpc-transition',
      '/simulations',
      '/interactive-learning/control-workbench',
      '/assessment/adaptive-practice',
      '/dashboard',
      '/dashboard',
      '/profile',
      '/data-center',
      '/teacher',
      '/teacher',
      '/teacher/classes/[classId]/analytics-v2',
      '/admin',
      '/admin',
      '/admin/data-governance',
      '/knowledge',
    ]);
    for (const route of PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX) {
      expect(route.requiredThemes).toEqual(['light', 'dark']);
      expect(route.requiredWidths).toEqual([1440, 320]);
      expect(route.routeFile).toContain('src/app/');
      expect(existsSync(join(process.cwd(), route.routeFile))).toBe(true);
      expect(route.artifactDirectory).toBe('artifacts/commercial-ui/premium-foundation');
    }
    expect(PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.filter((route) => route.floatingDock === 'required').map((route) => route.href)).toEqual([
      '/interactive-learning/control-workbench',
      '/assessment/adaptive-practice',
      '/dashboard',
      '/profile',
      '/data-center',
      '/teacher',
      '/teacher/classes/[classId]/analytics-v2',
      '/admin',
      '/admin/data-governance',
    ]);
    expect(PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.filter((route) => route.acceptedAuthState === 'unauth-redirect-fallback').map((route) => route.href)).toEqual([
      '/dashboard',
      '/teacher',
      '/admin',
    ]);
    expect(PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.filter((route) => route.acceptedAuthState === 'authenticated').map((route) => route.href)).toEqual([
      '/assessment/adaptive-practice',
      '/dashboard',
      '/profile',
      '/data-center',
      '/teacher',
      '/teacher/classes/[classId]/analytics-v2',
      '/admin',
      '/admin/data-governance',
    ]);
    expect(DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES.map((route) => route.href)).toEqual(
      expect.arrayContaining(PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.map((route) => route.href)),
    );
  });

  it('fails when premium visual QA loses dark theme evidence', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports.filter((viewport) => viewport.theme !== 'dark'),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-premium-theme-evidence',
          path: '/interactive-learning/control-workbench',
          evidence: expect.arrayContaining(['theme=dark']),
        }),
      ]),
    );
  });

  it('fails when required floating dock evidence is missing', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => ({
          ...viewport,
          dockPlacementChecked: false,
          noDockCollision: false,
          dockFocusReachable: false,
        })),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-premium-theme-evidence',
          path: '/interactive-learning/control-workbench',
          evidence: expect.arrayContaining(['dockPlacementChecked', 'noDockCollision', 'dockFocusReachable']),
        }),
      ]),
    );
  });

  it('fails when protected premium route evidence uses the wrong auth outcome', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/admin') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => ({
          ...viewport,
          finalUrl: 'http://localhost:3000/admin',
          authState: 'authenticated' as const,
        })),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-premium-theme-evidence',
          path: '/admin',
          evidence: expect.arrayContaining(['finalUrl=/login', 'authState=unauth-redirect-fallback']),
        }),
      ]),
    );
  });

  it('reports allowlisted legacy debt in advisory mode without failing the gate', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      mode: 'advisory',
      sourceViolations: [{
        path: 'src/app/legacy-student-entry/page.tsx',
        rule: 'token.page-local-palette',
        message: 'Legacy entry page still uses a local amber palette.',
      }],
      allowlist: [{
        id: 'legacy-student-entry-palette',
        path: 'src/app/legacy-student-entry/page.tsx',
        rule: 'token.page-local-palette',
        owner: 'platform-commercial-ui',
        owningIssue: '#228',
        owningChange: 'redesign-public-student-entry-experience',
        expiresOn: '2026-07-01',
        removalCondition: 'Legacy student entry palette is replaced by platform tokens.',
      }],
    }));

    expect(result.passed).toBe(true);
    expect(result.allowlistedViolations).toHaveLength(1);
    expect(result.allowlistedViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: 'token.page-local-palette',
          allowedBy: 'legacy-student-entry-palette',
        }),
      ]),
    );
  });

  it('rejects new palette, unregistered shell, and private module chrome in blocking mode', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      sourceViolations: [{
        path: 'src/app/interactive-learning/new-surface/page.tsx',
        rule: 'token.page-local-palette',
        message: 'New surface introduced raw teal and purple page-local tokens.',
        evidence: ['#14b8a6', 'from-purple-500'],
      }],
      shellInventory: [{
        path: 'src/app/interactive-learning/new-surface/page.tsx',
        route: '/interactive-learning/new-surface',
        usesRegisteredShell: false,
        shellName: 'NewSurfaceHeader',
      }],
      statusInventory: [{
        path: 'src/app/interactive-learning/new-surface/page.tsx',
        statusTerm: 'readyish',
        registeredStatusColor: false,
        duplicatesPlatformVocabulary: true,
      }],
      moduleChromeInventory: [{
        path: 'course-content/runtime/lessons/4-9/lesson.json',
        lessonId: '4-9',
        stepId: 'step-03',
        moduleId: 'private-card-sort',
        moduleKind: 'private-card-sort',
        registeredKind: false,
        usesCommercialChrome: false,
        privateChromeComponent: 'LessonPrivateCardSortChrome',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining([
        'token.page-local-palette',
        'shell.unregistered-route-frame',
        'token.unregistered-status-color',
        'status.duplicate-vocabulary',
        'module-chrome.unregistered-kind',
        'module-chrome.private-chrome',
      ]),
    );
  });

  it('fails when a required route lacks visual acceptance evidence', () => {
    const missingArenaEvidence = completeVisualEvidence().filter((evidence) => evidence.href !== '/arena');
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: missingArenaEvidence,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.missing-route-evidence',
          path: '/arena',
        }),
      ]),
    );
  });

  it('detects drift between primary route inventory and visual QA route inputs', () => {
    const driftSentinels = ['/arena', '/assessment/adaptive-practice', '/profile', '/data-center'];

    expect(COMMERCIAL_ROUTE_INVENTORY_VISUAL_ACCEPTANCE_ROUTES.map((route) => route.href)).toEqual(
      expect.arrayContaining(driftSentinels),
    );
    expect(DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES.map((route) => route.href)).toEqual(
      expect.arrayContaining(driftSentinels),
    );
    for (const href of driftSentinels) {
      expect(PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => route.href === href)).toMatchObject({
        screenshotProfile: expect.not.stringContaining('temporary-exception'),
      });
    }

    const sentinelRequiredRoutes = COMMERCIAL_ROUTE_INVENTORY_VISUAL_ACCEPTANCE_ROUTES.filter((route) => (
      driftSentinels.includes(route.href)
    ));
    const result = evaluateCommercialUiGovernance(baseInput({
      requiredVisualRoutes: sentinelRequiredRoutes,
      visualEvidence: completeVisualEvidence().filter((evidence) => evidence.href !== '/data-center'),
      accessibilityEvidence: completeAccessibilityEvidence().filter((evidence) => evidence.href !== '/data-center'),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.missing-route-evidence',
          path: '/data-center',
        }),
        expect.objectContaining({
          category: 'accessibility-text-fit',
          rule: 'accessibility-text-fit.missing-route-evidence',
          path: '/data-center',
        }),
      ]),
    );
  });

  it('fails when route ledger metadata and visual QA matrix drift apart', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      routeInventory: PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => (
        route.href === '/data-center'
          ? { ...route, owningChange: '', navigationLayers: [], themeSupport: ['light'] as const, frame: 'legacy-dashboard' as never }
          : route
      )),
      premiumVisualQaMatrix: PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.filter((route) => route.href !== '/data-center'),
      requiredVisualRoutes: DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES.filter((route) => route.href !== '/data-center'),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'route-ledger',
          rule: 'route-ledger.incomplete-primary-route',
          path: '/data-center',
          evidence: expect.arrayContaining(['owningChange', 'themeSupport=dark', 'navigationLayers']),
        }),
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.route-inventory-drift',
          path: '/data-center',
        }),
        expect.objectContaining({
          category: 'route-ledger',
          rule: 'route-ledger.outdated-archetype',
          path: '/data-center',
          evidence: expect.arrayContaining(['legacy-dashboard']),
        }),
      ]),
    );
  });

  it('fails when route ledger uses a retired real archetype alias', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      routeInventory: PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => (
        route.href === '/knowledge'
          ? { ...route, frame: 'knowledge-graph' as never }
          : route
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'route-ledger',
          rule: 'route-ledger.outdated-archetype',
          path: '/knowledge',
          evidence: expect.arrayContaining(['knowledge-graph']),
        }),
      ]),
    );
  });

  it('fails when a route has both unified migration owner and temporary exception owner', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      routeInventory: PLATFORM_PRIMARY_ROUTE_INVENTORY.map((route) => (
        route.href === '/ai'
          ? { ...route, unifiedUiMigrationOwner: 'migrate-learner-knowledge-data-surfaces' }
          : route
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'route-ledger',
          rule: 'route-ledger.incomplete-primary-route',
          path: '/ai',
          evidence: expect.arrayContaining(['unifiedUiMigrationOwner+exception.owner']),
        }),
      ]),
    );
  });

  it('fails when structured visual QA manifest omits route metadata or mobile structure evidence', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => (
          viewport.width === 320
            ? {
                ...viewport,
                routeFile: undefined,
                routeArchetype: 'legacy-dashboard',
                navigationState: undefined,
                result: undefined,
                firstViewportTaskVisible: false,
                mobileCanvasFirst: false,
                noPersistentMobileSidebar: false,
                noPersistentMobileFilter: false,
                noPersistentWorkbenchPanels: false,
                noPersistentKnowledgeGraphDrawer: false,
              }
            : viewport
        )),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-manifest-metadata',
          path: '/interactive-learning/control-workbench',
          evidence: expect.arrayContaining(['routeFile', 'routeArchetype', 'navigationState', 'result=passed', 'firstViewportTaskVisible']),
        }),
        expect.objectContaining({
          category: 'mobile-structure',
          rule: 'mobile-structure.desktop-panel-persistence',
          path: '/interactive-learning/control-workbench',
          evidence: expect.arrayContaining([
            'mobileCanvasFirst',
            'noPersistentMobileSidebar',
            'noPersistentMobileFilter',
            'noPersistentWorkbenchPanels',
            'noPersistentKnowledgeGraphDrawer',
          ]),
        }),
      ]),
    );
  });

  it('fails when shared shell visual evidence omits desktop collapsed navigation state', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports.filter((viewport) => viewport.navigationState !== 'desktop-collapsed'),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-navigation-state-evidence',
          path: '/interactive-learning/control-workbench',
          evidence: expect.arrayContaining(['width=1440:navigationState=desktop-collapsed']),
        }),
      ]),
    );
  });

  it('fails when mobile navigation state is supplied by the wrong viewport width', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/dashboard') return entry;
      const desktopRoleTabsViewport = entry.viewports.find((viewport) => (
        viewport.width === 1440 && viewport.navigationState === 'desktop-expanded'
      ));
      return {
        ...entry,
        viewports: [
          ...entry.viewports.map((viewport) => (
            viewport.width === 320 ? { ...viewport, navigationState: 'mobile-drawer' as const } : viewport
          )),
          ...(desktopRoleTabsViewport
            ? [{ ...desktopRoleTabsViewport, navigationState: 'role-route-tabs' as const }]
            : []),
        ],
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-navigation-state-evidence',
          path: '/dashboard',
          evidence: expect.arrayContaining(['width=320:navigationState=role-route-tabs']),
        }),
      ]),
    );
  });

  it('requires mobile drawer evidence for adapted mission workspace shells', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => (
          viewport.width === 320
            ? { ...viewport, navigationState: 'workspace-command-surface' as const }
            : viewport
        )),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-navigation-state-evidence',
          path: '/interactive-learning/control-workbench',
          evidence: expect.arrayContaining(['width=320:navigationState=mobile-drawer']),
        }),
      ]),
    );
  });

  it('uses route aliases when validating mobile navigation state evidence', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/login?callbackUrl=%2Fprofile') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => (
          viewport.width === 320
            ? { ...viewport, navigationState: 'mobile-drawer' as const }
            : viewport
        )),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-navigation-state-evidence',
          path: '/login?callbackUrl=%2Fprofile',
          evidence: expect.arrayContaining(['width=320:navigationState=auth-callback-panel']),
        }),
      ]),
    );
  });

  it('fails when desktop collapsed evidence reuses desktop expanded visual artifact', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      const expanded = entry.viewports.find((viewport) => (
        viewport.width === 1440
        && viewport.theme === 'light'
        && viewport.navigationState === 'desktop-expanded'
      ));
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => (
          viewport.width === 1440
            && viewport.theme === 'light'
            && viewport.navigationState === 'desktop-collapsed'
            ? { ...viewport, screenshot: expanded?.screenshot, artifact: expanded?.artifact }
            : viewport
        )),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-navigation-state-evidence',
          path: '/interactive-learning/control-workbench',
          evidence: expect.arrayContaining(['desktop-collapsed evidence reuses desktop-expanded artifact']),
        }),
      ]),
    );
  });

  it('fails when visual QA manifest uses an unknown navigation state', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => (
          viewport.width === 1440
            ? { ...viewport, navigationState: 'desktop-expaneded' as never }
            : viewport
        )),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-manifest-metadata',
          path: '/interactive-learning/control-workbench',
          evidence: expect.arrayContaining(['navigationState']),
        }),
      ]),
    );
  });

  it('fails when visual QA dock state drifts from the route ledger', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => ({
          ...viewport,
          dockState: 'hidden' as const,
        })),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-manifest-metadata',
          path: '/interactive-learning/control-workbench',
          evidence: expect.arrayContaining(['dockState']),
        }),
      ]),
    );
  });

  it('keeps React Doctor error checks local and out of GitHub Actions', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const workflowSources = readdirSync(join(process.cwd(), '.github/workflows'))
      .filter((filename) => filename.endsWith('.yml') || filename.endsWith('.yaml'))
      .map((filename) => readFileSync(join(process.cwd(), '.github/workflows', filename), 'utf8'));

    expect(packageJson.scripts['test:react-doctor:ui-errors']).toBe(
      'npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .',
    );
    expect(packageJson.scripts.test).not.toContain('react-doctor');
    for (const workflowSource of workflowSources) {
      expect(workflowSource).not.toContain('react-doctor');
      expect(workflowSource).not.toContain('test:react-doctor:ui-errors');
    }
  });

  it('accepts hidden dock evidence for login redirect fallback viewports without falling back to protected route dock state', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      premiumVisualQaMatrix: PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.filter((route) => (
        !(route.href === '/dashboard' && route.acceptedAuthState === 'unauth-redirect-fallback')
      )),
    }));

    expect(result.blockingViolations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'visual-acceptance',
          rule: 'visual-acceptance.incomplete-manifest-metadata',
          path: '/dashboard',
          evidence: expect.arrayContaining(['dockState']),
        }),
      ]),
    );
  });

  it('fails when report-ledger visual evidence omits watermark, privacy, source, or export checks', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/data-center') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => ({
          ...viewport,
          reportEvidence: [{
            surfaceId: 'data-center-platform-snapshot',
            watermarkChecked: false,
            privacyScopeChecked: false,
            sourceQualityVisible: false,
            statusLegendReadable: false,
            exportSafeSnapshotChecked: false,
          }],
        })),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'report-export',
          rule: 'report-export.incomplete-visual-evidence',
          path: '/data-center',
          evidence: expect.arrayContaining([
            'surface=data-center-platform-snapshot',
            'watermarkChecked',
            'privacyScopeChecked',
            'sourceQualityVisible',
            'statusLegendReadable',
            'exportSafeSnapshotChecked',
          ]),
        }),
      ]),
    );
  });

  it('fails when report-ledger surface evidence is absent from an otherwise captured route', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/admin/data-governance') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => ({
          ...viewport,
          reportEvidence: [],
        })),
      };
    });

    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'report-export',
          rule: 'report-export.incomplete-visual-evidence',
          path: '/admin/data-governance',
          evidence: expect.arrayContaining(['surface=governance-data-quality-snapshot']),
        }),
      ]),
    );
  });

  it('fails when accessibility and 320px text-fit evidence are incomplete', () => {
    const accessibilityEvidence = completeAccessibilityEvidence().map((entry) => {
      if (entry.href !== '/profile') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => (
          viewport.width === 320
            ? { ...viewport, buttonTextFits: false, noMobileTextOverlap: false }
            : viewport
        )),
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      accessibilityEvidence,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'accessibility-text-fit',
          rule: 'accessibility-text-fit.incomplete-evidence',
          path: '/profile',
          evidence: expect.arrayContaining(['width=320', 'buttonTextFits', 'noMobileTextOverlap']),
        }),
      ]),
    );
  });

  it('fails when student navigation coverage loses an intent, core destination, or alias', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      navigationCoverage: {
        ...fullNavigationCoverage,
        intents: fullNavigationCoverage.intents.filter((intent) => intent !== 'experiment'),
        coreEntryIds: fullNavigationCoverage.coreEntryIds.filter((id) => id !== 'student-control-workbench'),
        hrefs: fullNavigationCoverage.hrefs.filter((href) => href !== '/interactive-learning/control-workbench'),
        aliases: fullNavigationCoverage.aliases.filter((href) => !href.includes('control-workbench')),
      },
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations.map((violation) => violation.rule)).toEqual(
      expect.arrayContaining([
        'navigation.intent-coverage',
        'navigation.core-destination-coverage',
        'navigation.alias-coverage',
      ]),
    );
  });

  it('treats incomplete allowlist entries as governance violations', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      mode: 'advisory',
      allowlist: [{
        path: 'src/app/legacy/page.tsx',
        rule: 'token.raw-decorative-gradient',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'allowlist',
          rule: 'allowlist.invalid-entry',
          evidence: expect.arrayContaining(['missing owner', 'missing owningChange', 'missing expiresOn', 'missing removalCondition']),
        }),
      ]),
    );
  });

  it('rejects expired allowlist entries instead of masking blocking violations', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      sourceViolations: [{
        path: 'src/app/legacy-student-entry/page.tsx',
        rule: 'token.page-local-palette',
        message: 'Legacy entry page still uses a local palette.',
      }],
      allowlist: [{
        id: 'expired-legacy-palette',
        path: 'src/app/legacy-student-entry/page.tsx',
        rule: 'token.page-local-palette',
        owner: 'platform-commercial-ui',
        owningIssue: '#228',
        owningChange: 'redesign-public-student-entry-experience',
        expiresOn: '2026-01-01',
        removalCondition: 'Legacy student entry palette is replaced by platform tokens.',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.allowlistedViolations).toHaveLength(0);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'allowlist',
          rule: 'allowlist.invalid-entry',
          evidence: expect.arrayContaining(['expired expiresOn']),
        }),
        expect.objectContaining({
          rule: 'token.page-local-palette',
          path: 'src/app/legacy-student-entry/page.tsx',
        }),
      ]),
    );
  });

  it('rejects allowlist entries with non-ISO expiration dates', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      mode: 'advisory',
      allowlist: [{
        id: 'bad-date',
        path: 'src/app/legacy/page.tsx',
        rule: 'token.raw-decorative-gradient',
        owner: 'platform-commercial-ui',
        owningIssue: '#228',
        owningChange: 'redesign-public-student-entry-experience',
        expiresOn: 'July 1 2026',
        removalCondition: 'Legacy decorative gradient is replaced by approved primitives.',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'allowlist',
          rule: 'allowlist.invalid-entry',
          evidence: expect.arrayContaining(['invalid expiresOn']),
        }),
      ]),
    );
  });

  it('rejects allowlist entries with impossible calendar dates', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      mode: 'advisory',
      allowlist: [{
        id: 'bad-calendar-date',
        path: 'src/app/legacy/page.tsx',
        rule: 'token.raw-decorative-gradient',
        owner: 'platform-commercial-ui',
        owningIssue: '#228',
        owningChange: 'redesign-public-student-entry-experience',
        expiresOn: '2026-02-31',
        removalCondition: 'Legacy decorative gradient is replaced by approved primitives.',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'allowlist',
          rule: 'allowlist.invalid-entry',
          evidence: expect.arrayContaining(['invalid expiresOn']),
        }),
      ]),
    );
  });

  it('rejects profile and cockpit hrefs with wrong or collapsed semantics', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      navigationCoverage: {
        ...fullNavigationCoverage,
        profileHref: '/wrong',
        cockpitHref: '/wrong',
      },
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'navigation',
          rule: 'navigation.profile-cockpit-semantics',
          evidence: expect.arrayContaining([
            'profileHref=/wrong',
            'cockpitHref=/wrong',
            'profileHref equals cockpitHref',
          ]),
        }),
      ]),
    );
  });

  it('requires scoped allowlist entries to name owner, owning change, expiry, and removal condition', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      mode: 'advisory',
      allowlist: [{
        id: 'incomplete-scope',
        path: 'src/app/legacy/page.tsx',
        rule: 'token.raw-decorative-gradient',
        owningIssue: '#228',
        expiresOn: '2026-07-01',
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'allowlist',
          rule: 'allowlist.invalid-entry',
          evidence: expect.arrayContaining(['missing owner', 'missing owningChange', 'missing removalCondition']),
        }),
      ]),
    );
  });
});
