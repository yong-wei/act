import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import {
  COMMERCIAL_ROUTE_INVENTORY_VISUAL_ACCEPTANCE_ROUTES,
  DEFAULT_SECONDARY_NAVIGATION_DEPENDENCIES,
  DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX,
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
import { buildSecondaryRouteGovernanceMatrixFromEvidence } from '../../../scripts/tests/test-commercial-ui-governance';

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
            gridTemplateColumns: navigationState === 'desktop-collapsed' ? '72px 1368px' : '248px 1192px',
            sidebarWidth: navigationState === 'desktop-collapsed' ? 72 : 248,
            contentWidth: navigationState === 'desktop-collapsed' ? 1368 : 1192,
            activeLinkAriaLabel: navigationState === 'desktop-collapsed' ? '控制工作台' : null,
            activeLinkTitle: navigationState === 'desktop-collapsed' ? '控制工作台' : null,
            activeLinkText: navigationState === 'desktop-collapsed' ? '' : '控制工作台',
            horizontalOverflow: false,
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
            gridTemplateColumns: navigationState === 'desktop-collapsed' ? '72px 1368px' : '248px 1192px',
            sidebarWidth: navigationState === 'desktop-collapsed' ? 72 : 248,
            contentWidth: navigationState === 'desktop-collapsed' ? 1368 : 1192,
            activeLinkAriaLabel: navigationState === 'desktop-collapsed' ? '控制工作台' : null,
            activeLinkTitle: navigationState === 'desktop-collapsed' ? '控制工作台' : null,
            activeLinkText: navigationState === 'desktop-collapsed' ? '' : '控制工作台',
            horizontalOverflow: false,
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
      '/data-center',
      '/teacher',
      '/teacher/classes/[classId]/analytics-v2',
      '/admin',
      '/admin/data-governance',
    ]);
    expect(PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.filter((route) => route.href === '/data-center').map((route) => route.role)).toEqual([
      'teacher',
      'admin',
    ]);
    expect(DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES.map((route) => route.href)).toEqual(
      expect.arrayContaining(PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX.map((route) => route.href)),
    );
  });

  it('defines a secondary navigation governance matrix for migrated route families and data-center role states', () => {
    expect(DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => `${entry.href}::${entry.role}`)).toEqual([
      '/arena::student',
      '/arena/challenges/[taskId]::guest',
      '/interactive-learning/control-workbench::student',
      '/interactive-learning::student',
      '/interactive-learning/courses::student',
      '/interactive-learning/chapter-components::student',
      '/interactive-learning/cross-domain-exploration::student',
      '/assessment/adaptive-practice::student',
      '/knowledge::student',
      '/data-center::teacher',
      '/data-center::admin',
    ]);
    expect(DEFAULT_SECONDARY_NAVIGATION_DEPENDENCIES.every((dependency) => dependency.status === 'complete')).toBe(true);
    expect(DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.find((entry) => entry.href === '/knowledge')?.localPanels).toEqual(
      expect.arrayContaining([
        { id: 'chapter-directory', disposition: 'local-tool' },
        { id: 'graph-filters', disposition: 'local-tool' },
        { id: 'graph-legend', disposition: 'local-tool' },
        { id: 'node-resource-panel', disposition: 'local-tool' },
      ]),
    );
    expect(DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.filter((entry) => entry.role === 'student').every((entry) => (
      entry.forbiddenEntries?.includes('/data-center')
    ))).toBe(true);
  });

  it('does not synthesize secondary governance entries from viewport evidence alone', () => {
    const matrix = buildSecondaryRouteGovernanceMatrixFromEvidence([{
      href: '/interactive-learning',
      viewports: [{
        width: 1440,
        role: 'student',
        requestedRoute: '/interactive-learning',
        result: 'passed',
        routeFile: 'src/app/interactive-learning/page.tsx',
        routeArchetype: 'learning-atlas',
        theme: 'light',
        mobileNavigation: 'workspace-command-surface',
        localPanelEvidence: {
          workspaceCommandSurface: true,
        },
      }],
    }]);

    expect(matrix).toEqual([]);
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteGovernanceMatrix: matrix,
    }));
    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.incomplete-route-matrix',
          path: '/interactive-learning',
          evidence: expect.arrayContaining(['routeRole=/interactive-learning::student']),
        }),
      ]),
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

  it('fails when shared shell navigation evidence omits a required theme', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports
          .map((viewport) => ({ ...viewport, appShellNavigationContract: 'collapsed-icon-rail' as const }))
          .filter((viewport) => viewport.theme !== 'dark'),
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
          evidence: expect.arrayContaining([
            'theme=dark:width=1440:navigationState=desktop-expanded',
            'theme=dark:width=1440:navigationState=desktop-collapsed',
            'theme=dark:width=320:navigationState=mobile-drawer',
          ]),
        }),
      ]),
    );
  });

  it('fails when desktop collapsed shell evidence omits icon rail geometry or labels', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => (
          viewport.width === 1440
            && viewport.theme === 'light'
            && viewport.navigationState === 'desktop-collapsed'
            ? {
                ...viewport,
                appShellNavigationContract: 'collapsed-icon-rail' as const,
                sidebarWidth: 76,
                contentWidth: 1000,
                activeLinkAriaLabel: undefined,
                activeLinkTitle: undefined,
                activeLinkText: '控制工作台控',
                horizontalOverflow: true,
              }
            : { ...viewport, appShellNavigationContract: 'collapsed-icon-rail' as const }
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
          evidence: expect.arrayContaining([
            'theme=light:desktop-collapsed:sidebarWidth=72',
            'theme=light:desktop-collapsed:contentWidth>expandedContentWidth',
            'theme=light:desktop-collapsed:activeLinkAriaLabel',
            'theme=light:desktop-collapsed:activeLinkTitle',
            'theme=light:desktop-collapsed:activeLinkText=empty',
            'theme=light:desktop-collapsed:noHorizontalOverflow',
          ]),
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
    expect(packageJson.scripts['test:react-doctor:owned-errors']).toBe(
      'node ./scripts/tests/react-doctor-owned-surface-gate.mjs --mode=errors',
    );
    expect(packageJson.scripts['test:react-doctor:owned-security']).toBe(
      'node ./scripts/tests/react-doctor-owned-surface-gate.mjs --mode=security',
    );
    expect(packageJson.scripts['react-doctor:owned-warnings']).toBe(
      'node ./scripts/tests/react-doctor-owned-surface-gate.mjs --mode=warnings',
    );
    expect(packageJson.scripts.test).not.toContain('react-doctor');
    for (const workflowSource of workflowSources) {
      expect(workflowSource).not.toContain('react-doctor');
      expect(workflowSource).not.toContain('test:react-doctor:ui-errors');
      expect(workflowSource).not.toContain('test:react-doctor:owned-errors');
      expect(workflowSource).not.toContain('test:react-doctor:owned-security');
    }
  });

  it('documents owned-surface React Doctor scope and advisory warning behavior', () => {
    const docs = readFileSync(join(process.cwd(), 'docs/react-doctor-local-ui-gate.md'), 'utf8');
    const scriptSource = readFileSync(join(process.cwd(), 'scripts/tests/react-doctor-owned-surface-gate.mjs'), 'utf8');
    const doctorConfig = JSON.parse(readFileSync(join(process.cwd(), 'doctor.config.json'), 'utf8')) as { ignore: { files: string[] } };
    const scriptExcludedRoots = scriptSource.match(/const EXCLUDED_ROOTS = \[([\s\S]*?)\];/)?.[1]
      .split('\n')
      .map((line) => line.trim().match(/^'(.+)',?$/)?.[1])
      .filter((root): root is string => Boolean(root)) ?? [];
    const scriptIncludedRoots = scriptSource.match(/const INCLUDED_ROOTS = \[([\s\S]*?)\];/)?.[1]
      .split('\n')
      .map((line) => line.trim().match(/^'(.+)',?$/)?.[1])
      .filter((root): root is string => Boolean(root)) ?? [];
    const configExcludedRoots = doctorConfig.ignore.files.map((pattern) => pattern.replace(/\/\*\*$/, '/'));

    expect(docs).toContain('rtk npm run test:react-doctor:owned-errors');
    expect(docs).toContain('rtk npm run test:react-doctor:owned-security');
    expect(docs).toContain('rtk npm run react-doctor:owned-warnings');
    expect(docs).toContain('`doctor.config.json` excludes');
    expect(docs).toContain('`evaluate/`, generated build outputs');
    expect(scriptSource).toContain("const REACT_DOCTOR_VERSION = '0.5.1'");
    expect(scriptSource).toContain("'evaluate/'");
    expect(scriptSource).toContain("process.exitCode = mode === 'warnings' || diagnostics.length === 0 ? 0 : 1");
    expect(scriptIncludedRoots).toEqual(expect.arrayContaining([
      'doctor.config',
      'eslint.config',
      'playwright.config',
      'prisma.config',
    ]));
    expect(doctorConfig.ignore.files).toEqual(expect.arrayContaining([
      'evaluate/**',
      'artifacts/**',
      'node_modules/**',
      '.next/**',
    ]));
    expect(configExcludedRoots).toEqual(scriptExcludedRoots);
  });

  it('filters React Doctor owned-surface diagnostics and keeps large JSON stdout parseable', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'react-doctor-owned-gate-'));
    const fakeNpx = join(tmp, 'npx');
    const diagnostics = [
      { filePath: 'src/app/page.tsx', severity: 'error', category: 'Bugs', rule: 'bug-rule', title: 'Owned app error', line: 1, column: 1 },
      { filePath: join(process.cwd(), 'src/app/absolute-page.tsx'), severity: 'error', category: 'Bugs', rule: 'absolute-bug-rule', title: 'Owned absolute app error', line: 1, column: 1 },
      { filePath: 'src/resources/demo.tsx', severity: 'warning', category: 'Performance', rule: 'resource-warning', title: 'Owned resource warning', line: 2, column: 1 },
      { filePath: 'src/hooks/use-demo.ts', severity: 'warning', category: 'Maintainability', rule: 'hook-warning', title: 'Owned hook warning', line: 3, column: 1 },
      { filePath: 'docs/security.md', severity: 'warning', category: 'Security', rule: 'security-warning', title: 'Owned security warning', line: 4, column: 1 },
      { filePath: 'eslint.config.mjs', severity: 'error', category: 'Bugs', rule: 'root-config-error', title: 'Owned root config error', line: 5, column: 1 },
      { filePath: 'prisma.config.ts', severity: 'warning', category: 'Security', rule: 'root-config-security', title: 'Owned root config security', line: 6, column: 1 },
      { filePath: 'evaluate/test_repos/sample.tsx', severity: 'error', category: 'Bugs', rule: 'fixture-error', title: 'Fixture error', line: 5, column: 1 },
      { filePath: 'artifacts/sample.tsx', severity: 'warning', category: 'Security', rule: 'artifact-security', title: 'Artifact security', line: 6, column: 1 },
      ...Array.from({ length: 1800 }, (_, index) => ({
        filePath: `src/app/generated-error-${index}.tsx`,
        severity: 'error',
        category: 'Bugs',
        rule: 'large-error-output',
        title: `Large error ${index}`,
        line: index + 7,
        column: 1,
      })),
      ...Array.from({ length: 1800 }, (_, index) => ({
        filePath: `src/hooks/generated-${index}.tsx`,
        severity: 'warning',
        category: 'Bugs',
        rule: 'large-warning-output',
        title: `Large warning ${index}`,
        line: index + 1807,
        column: 1,
      })),
    ];
    writeFileSync(fakeNpx, `#!/usr/bin/env node\nconsole.log(JSON.stringify({ schemaVersion: 1, diagnostics: ${JSON.stringify(diagnostics)} }));\n`, { mode: 0o755 });

    const runGate = (mode: 'errors' | 'security' | 'warnings') => {
      const result = spawnSync(process.execPath, [
        join(process.cwd(), 'scripts/tests/react-doctor-owned-surface-gate.mjs'),
        `--mode=${mode}`,
      ], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, PATH: `${tmp}:${process.env.PATH ?? ''}` },
        maxBuffer: 8 * 1024 * 1024,
      });
      return { result, report: JSON.parse(result.stdout) as { totals: { selectedDiagnostics: number; fixtureNoiseDiagnostics: number }; summary: { byOwnedSurface: Record<string, number>; byCategory: Record<string, number> } } };
    };

    const errors = runGate('errors');
    const security = runGate('security');
    const warnings = runGate('warnings');

    expect(errors.result.status).toBe(1);
    expect(errors.report.totals.selectedDiagnostics).toBe(1803);
    expect(errors.result.stdout.length).toBeGreaterThan(65_536);
    expect(security.result.status).toBe(1);
    expect(security.report.totals.selectedDiagnostics).toBe(2);
    expect(warnings.result.status).toBe(0);
    expect(warnings.report.totals.selectedDiagnostics).toBe(1804);
    expect(warnings.report.totals.fixtureNoiseDiagnostics).toBe(2);
    expect(warnings.report.summary.byOwnedSurface).toMatchObject({
      docs: 1,
      hooks: 1801,
      resources: 1,
    });
    expect(warnings.report.summary.byCategory.Security).toBe(2);
    expect(warnings.result.stdout.length).toBeGreaterThan(65_536);
  });

  it('fails React Doctor owned-surface gates when the scanner returns an error report', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'react-doctor-owned-failure-'));
    const fakeNpx = join(tmp, 'npx');
    writeFileSync(fakeNpx, `#!/usr/bin/env node\nconsole.log(JSON.stringify({ schemaVersion: 1, ok: false, error: 'scanner failed before diagnostics' }));\nprocess.exit(2);\n`, { mode: 0o755 });

    const result = spawnSync(process.execPath, [
      join(process.cwd(), 'scripts/tests/react-doctor-owned-surface-gate.mjs'),
      '--mode=errors',
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${tmp}:${process.env.PATH ?? ''}` },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('scanner failed before diagnostics');
    expect(result.stdout).toBe('');
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

  it('fails when student navigation or secondary route evidence exposes data center', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      navigationCoverage: {
        ...fullNavigationCoverage,
        hrefs: [...fullNavigationCoverage.hrefs, '/data-center'],
      },
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/interactive-learning'
          ? {
              ...entry,
              observedNavigationHrefs: [...(entry.observedNavigationHrefs ?? []), '/data-center'],
            }
          : entry
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.student-data-center-exposure',
          path: 'src/lib/platform-role-navigation.ts',
          evidence: expect.arrayContaining(['/data-center']),
        }),
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.student-data-center-exposure',
          path: '/interactive-learning',
          evidence: expect.arrayContaining(['role=student', '/data-center']),
        }),
      ]),
    );
  });

  it('fails when the secondary route matrix omits a required route role state', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.filter((entry) => (
        !(entry.href === '/data-center' && entry.role === 'admin')
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.incomplete-route-matrix',
          path: '/data-center',
          evidence: expect.arrayContaining(['routeRole=/data-center::admin']),
        }),
      ]),
    );
  });

  it('fails when a migrated first-hop destination falls back to a legacy topbar', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/interactive-learning'
          ? {
              ...entry,
              primaryNextAction: {
                href: '/interactive-learning/chapter-components',
                shellType: 'legacy-topbar' as const,
                migrationState: 'migrated' as const,
                usesLegacyTopbar: true,
              },
            }
          : entry
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.incomplete-route-matrix',
          path: '/interactive-learning',
          evidence: expect.arrayContaining([
            'role=student',
            'next=/interactive-learning/chapter-components',
            'firstHop.exceptionOwner',
            'firstHop.removalCondition',
          ]),
        }),
      ]),
    );
  });

  it('fails when knowledge graph local panels are registered as platform navigation', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/knowledge'
          ? {
              ...entry,
              localPanels: [
                { id: 'chapter-directory', disposition: 'platform-navigation' as const },
                { id: 'graph-filters', disposition: 'local-tool' as const },
                { id: 'graph-legend', disposition: 'local-tool' as const },
              ],
            }
          : entry
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.local-tool-boundary',
          path: '/knowledge',
          evidence: expect.arrayContaining([
            'role=student',
            'localTool=node-resource-panel',
            'chapter-directory:platform-navigation',
          ]),
        }),
      ]),
    );
  });

  it('keeps secondary route drift advisory until upstream migration dependencies complete', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteDependencies: DEFAULT_SECONDARY_NAVIGATION_DEPENDENCIES.map((dependency) => (
        dependency.change === 'migrate-knowledge-map-to-unified-shell-panels'
          ? { ...dependency, status: 'active' as const }
          : dependency
      )),
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/knowledge'
          ? {
              ...entry,
              localPanels: [{ id: 'chapter-directory', disposition: 'platform-navigation' as const }],
            }
          : entry
      )),
    }));

    expect(result.passed).toBe(true);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.local-tool-boundary',
          path: '/knowledge',
          enforcement: 'advisory',
        }),
      ]),
    );
    expect(result.blockingViolations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          path: '/knowledge',
        }),
      ]),
    );
  });

  it('keeps migrated routes blocking when an unrelated upstream dependency is active', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteDependencies: DEFAULT_SECONDARY_NAVIGATION_DEPENDENCIES.map((dependency) => (
        dependency.change === 'migrate-knowledge-map-to-unified-shell-panels'
          ? { ...dependency, status: 'active' as const }
          : dependency
      )),
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/interactive-learning'
          ? {
              ...entry,
              observedNavigationHrefs: ['/data-center'],
            }
          : entry
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.student-data-center-exposure',
          path: '/interactive-learning',
          enforcement: 'blocking',
        }),
      ]),
    );
  });

  it('keeps missing migrated route role states blocking when an unrelated dependency is active', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteDependencies: DEFAULT_SECONDARY_NAVIGATION_DEPENDENCIES.map((dependency) => (
        dependency.change === 'migrate-knowledge-map-to-unified-shell-panels'
          ? { ...dependency, status: 'active' as const }
          : dependency
      )),
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.filter((entry) => (
        !(entry.href === '/interactive-learning' && entry.role === 'student')
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.incomplete-route-matrix',
          path: '/interactive-learning',
          enforcement: 'blocking',
          evidence: expect.arrayContaining(['routeRole=/interactive-learning::student']),
        }),
      ]),
    );
  });

  it('blocks stale blocked-by-upstream routes once their dependencies are complete', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/interactive-learning'
          ? {
              ...entry,
              migrationState: 'blocked-by-upstream' as const,
              observedNavigationHrefs: ['/data-center'],
            }
          : entry
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.student-data-center-exposure',
          path: '/interactive-learning',
          enforcement: 'blocking',
        }),
      ]),
    );
  });

  it('fails active secondary route exceptions without owner, expiry, and removal condition', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/interactive-learning'
          ? {
              ...entry,
              migrationState: 'active-exception' as const,
            }
          : entry
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.incomplete-route-matrix',
          path: '/interactive-learning',
          evidence: expect.arrayContaining(['exceptionOwner', 'exceptionExpiresOn', 'exceptionRemovalCondition']),
          enforcement: 'blocking',
        }),
      ]),
    );
  });

  it('fails expired active secondary route exceptions', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/interactive-learning'
          ? {
              ...entry,
              migrationState: 'active-exception' as const,
              exceptionOwner: 'platform-ui',
              exceptionExpiresOn: '2020-01-01',
              exceptionRemovalCondition: 'Interactive Learning returns to unified shell evidence.',
            }
          : entry
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.incomplete-route-matrix',
          path: '/interactive-learning',
          evidence: expect.arrayContaining(['exceptionExpiresOn=expired']),
          enforcement: 'blocking',
        }),
      ]),
    );
  });

  it('fails legacy first-hop exceptions without a removal condition', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/interactive-learning'
          ? {
              ...entry,
              primaryNextAction: {
                href: '/interactive-learning/chapter-components',
                shellType: 'legacy-topbar' as const,
                migrationState: 'migrated' as const,
                usesLegacyTopbar: true,
                exceptionOwner: 'platform-ui',
              },
            }
          : entry
      )),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          rule: 'secondary-navigation.incomplete-route-matrix',
          path: '/interactive-learning',
          evidence: expect.arrayContaining(['firstHop.removalCondition']),
          enforcement: 'blocking',
        }),
      ]),
    );
  });

  it('accepts removal-bound legacy first-hop exceptions', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      secondaryRouteGovernanceMatrix: DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX.map((entry) => (
        entry.href === '/interactive-learning'
          ? {
              ...entry,
              primaryNextAction: {
                href: '/interactive-learning/chapter-components',
                shellType: 'legacy-topbar' as const,
                migrationState: 'migrated' as const,
                usesLegacyTopbar: true,
                exceptionOwner: 'platform-ui',
                removalCondition: 'Chapter components first-hop enters the unified shell.',
              },
            }
          : entry
      )),
    }));

    expect(result.blockingViolations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'secondary-navigation',
          path: '/interactive-learning',
        }),
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
