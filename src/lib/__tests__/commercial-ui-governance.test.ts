import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

import {
  COMMERCIAL_ROUTE_INVENTORY_VISUAL_ACCEPTANCE_ROUTES,
  DEFAULT_SECONDARY_NAVIGATION_DEPENDENCIES,
  DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX,
  DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES,
  PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX,
  SIMULATION_FULL_MATRIX_VISUAL_QA_DETAIL_ROUTES,
  SIMULATION_VISUAL_QA_ROUTE_MATRIX,
  evaluateCommercialUiGovernance,
  type CommercialAccessibilityTextFitEvidence,
  type CommercialAdaptivePathProductQaEvidence,
  type CommercialInteractiveVisualAcceptanceArtifact,
  type CommercialInteractiveLearningProductQaEvidence,
  type CommercialNavigationCoverageInput,
  type CommercialSimulationVisualQaEvidence,
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
import {
  buildSecondaryRouteGovernanceMatrixFromEvidence,
  hydrateInteractiveLearningProductQaEvidence,
  interactiveLearningReviewHasNoUnresolvedBlocks,
} from '../../../scripts/tests/test-commercial-ui-governance';
import {
  resolveSimulationSceneThemeMode,
  SIMULATION_SCENE_THEMES,
} from '@/resources/simulations/components/simulation-theme';

const today = '2026-05-31';
const commandDeckGeometryWidths = [1440, 1024, 320] as const;

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

function simulationNavigationStatesForWidth(
  width: 1440 | 320,
  states: readonly CommercialVisualQaNavigationState[],
): CommercialVisualQaNavigationState[] {
  return states.filter((state) => (
    width === 1440 ? state.startsWith('desktop-') : !state.startsWith('desktop-')
  ));
}

function runTempGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function initTempGitRepo(prefix: string) {
  const repo = mkdtempSync(join(tmpdir(), prefix));
  runTempGit(repo, ['init']);
  runTempGit(repo, ['branch', '-M', 'main']);
  runTempGit(repo, ['config', 'user.name', 'Commercial UI Governance Test']);
  runTempGit(repo, ['config', 'user.email', 'commercial-ui-governance@example.invalid']);
  return repo;
}

function commitTempFile(repo: string, file: string, content: string, message: string) {
  const absolutePath = join(repo, file);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
  runTempGit(repo, ['add', file]);
  runTempGit(repo, ['commit', '-m', message]);
  return runTempGit(repo, ['rev-parse', 'HEAD']);
}

function isTempGitAncestor(repo: string, ancestor: string, descendant: string) {
  return spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
    cwd: repo,
    stdio: ['ignore', 'ignore', 'ignore'],
  }).status === 0;
}

function tempGitLines(repo: string, args: string[]) {
  return runTempGit(repo, args).split('\n').map((line) => line.trim()).filter(Boolean);
}

function tempChangedFiles(repo: string) {
  const files = new Set<string>();
  for (const args of [['diff', '--name-only'], ['diff', '--name-only', '--cached']]) {
    for (const file of tempGitLines(repo, args)) files.add(file);
  }
  for (const file of tempGitLines(repo, ['ls-files', '--others', '--exclude-standard'])) files.add(file);
  return Array.from(files);
}

function tempHasUncommittedPathChange(repo: string, file: string) {
  return tempGitLines(repo, ['diff', '--name-only', '--', file]).includes(file)
    || tempGitLines(repo, ['diff', '--name-only', '--cached', '--', file]).includes(file)
    || tempGitLines(repo, ['ls-files', '--others', '--exclude-standard', '--', file]).includes(file);
}

function tempInteractiveLearningProductQaEvidenceCoversSource(
  repo: string,
  files: readonly string[],
  evidencePath: string,
  sourcePrefixes: readonly string[],
) {
  const sourceFiles = files.filter((file) => sourcePrefixes.some((prefix) => file.startsWith(prefix)));
  if (sourceFiles.some((file) => tempHasUncommittedPathChange(repo, file))) {
    return tempHasUncommittedPathChange(repo, evidencePath);
  }
  const sourceCommits = Array.from(new Set(files
    .filter((file) => sourcePrefixes.some((prefix) => file.startsWith(prefix)))
    .map((file) => runTempGit(repo, ['log', '-1', '--format=%H', '--', file]))
    .filter(Boolean)));
  const evidenceCommit = runTempGit(repo, ['log', '-1', '--format=%H', '--', evidencePath]);
  return Boolean(evidenceCommit) && sourceCommits.every((sourceCommit) => (
    isTempGitAncestor(repo, sourceCommit, evidenceCommit)
  ));
}

const handoffRoot = 'artifacts/product-design-audits/virtual-simulation-2026-06-13';
const handoffConcepts = {
  catalog: `${handoffRoot}/concepts/concept-1-platform-continuity.png`,
  commandDeck: `${handoffRoot}/concepts/concept-2-command-deck-shell.png`,
  missionStudio: `${handoffRoot}/concepts/concept-3-learning-mission-studio.png`,
} as const;

function simulationHandoffBaselineFor(href: string) {
  const routeReference = {
    '/simulations': {
      handoffSection: 'Virtual simulation catalog',
      conceptImage: handoffConcepts.catalog,
      implementationScreenshot: `${handoffRoot}/implementation-screenshots/simulations-dark-1440.png`,
      evidenceHook: 'data-product-design-concept-reference="concept-1-platform-continuity"',
    },
    '/virtual-lab': {
      handoffSection: 'Canonical entry hierarchy',
      conceptImage: handoffConcepts.catalog,
      implementationScreenshot: `${handoffRoot}/implementation-screenshots/virtual-lab-redirect-dark-1440.png`,
      evidenceHook: 'data-virtual-lab-compatibility-role="redirect-to-simulations"',
      compatibilityRole: 'redirect-to-simulations',
    },
    '/simulations/destroyer': {
      handoffSection: 'Command-deck shell',
      conceptImage: handoffConcepts.commandDeck,
      implementationScreenshot:
        'artifacts/commercial-ui/simulation-internal-theme-534/simulations-destroyer-dark-1440-desktop-expanded-collapsed-collapsed.png',
      evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
    },
    '/simulations/lng': {
      handoffSection: 'Command-deck shell',
      conceptImage: handoffConcepts.commandDeck,
      implementationScreenshot:
        'artifacts/commercial-ui/simulation-internal-theme-534/simulations-lng-dark-1440-desktop-expanded-collapsed-collapsed.png',
      evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
    },
    '/simulations/container': {
      handoffSection: 'Command-deck shell',
      conceptImage: handoffConcepts.commandDeck,
      implementationScreenshot:
        'artifacts/commercial-ui/simulation-internal-theme-534/simulations-container-dark-1440-desktop-expanded-collapsed-collapsed.png',
      evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
    },
    '/simulations/drilling': {
      handoffSection: 'Command-deck shell',
      conceptImage: handoffConcepts.commandDeck,
      implementationScreenshot:
        'artifacts/commercial-ui/simulation-internal-theme-534/simulations-drilling-dark-1440-desktop-expanded-collapsed-collapsed.png',
      evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
    },
    '/simulations/cruise': {
      handoffSection: 'Command-deck shell',
      conceptImage: handoffConcepts.commandDeck,
      implementationScreenshot:
        'artifacts/commercial-ui/simulation-internal-theme-534/simulations-cruise-dark-1440-desktop-expanded-collapsed-collapsed.png',
      evidenceHook: 'data-simulation-panel-restore-handle',
    },
    '/simulations/icebreaker': {
      handoffSection: 'Command-deck shell',
      conceptImage: handoffConcepts.commandDeck,
      implementationScreenshot:
        'artifacts/commercial-ui/simulation-internal-theme-534/simulations-icebreaker-dark-1440-desktop-expanded-collapsed-collapsed.png',
      evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
    },
    '/simulations/dredger': {
      handoffSection: 'Command-deck shell',
      conceptImage: handoffConcepts.commandDeck,
      implementationScreenshot:
        'artifacts/commercial-ui/simulation-internal-theme-534/simulations-dredger-dark-1440-desktop-expanded-collapsed-collapsed.png',
      evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
    },
    '/interactive-learning/control-workbench': {
      handoffSection: 'Learning mission semantics',
      conceptImage: handoffConcepts.missionStudio,
      implementationScreenshot: `${handoffRoot}/implementation-screenshots/workbench-dark-1440.png`,
      evidenceHook: 'data-learning-mission-semantics="objective-task-chain-evidence-next-action"',
    },
  } as const;
  const reference = routeReference[href as keyof typeof routeReference];
  if (!reference) throw new Error(`Missing handoff baseline for ${href}`);
  return {
    change: 'align-virtual-simulation-product-design-handoff',
    archivePath: 'openspec/changes/archive/2026-06-14-align-virtual-simulation-product-design-handoff',
    designHandoff: `${handoffRoot}/design-handoff.md`,
    designHandoffSha256: 'design-handoff-content',
    implementationMatrix: `${handoffRoot}/implementation-matrix.md`,
    implementationMatrixSha256: 'implementation-matrix-content',
    route: href,
    independentReviewStatus: 'passed' as const,
    conceptImageSha256: 'concept-image-content',
    implementationScreenshotSha256: 'implementation-screenshot-content',
    ...reference,
  };
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

function simulationVisualQaFor(href: string): CommercialSimulationVisualQaEvidence {
  const scenario = SIMULATION_VISUAL_QA_ROUTE_MATRIX.find((entry) => entry.href === href);
  if (!scenario) throw new Error(`Missing simulation visual QA scenario for ${href}`);
  const commandDeckGeometry = scenario.requiresNonblankScene
    ? {
        change: 'normalize-simulation-command-deck-layout' as const,
        generatedAt: '2026-06-15T00:00:00.000Z',
        sourceSha256: Object.fromEntries([
          scenario.routeFile,
          'src/app/simulations/_components/simulation-shell.tsx',
          'src/resources/simulations/components/simulation-ui.tsx',
          'src/resources/simulations/components/camera-view-switcher.tsx',
          'scripts/tests/capture-simulation-command-deck-qa.ts',
        ].map((sourcePath) => [sourcePath, `${sourcePath}:sha256`])),
        currentSourceSha256: Object.fromEntries([
          scenario.routeFile,
          'src/app/simulations/_components/simulation-shell.tsx',
          'src/resources/simulations/components/simulation-ui.tsx',
          'src/resources/simulations/components/camera-view-switcher.tsx',
          'scripts/tests/capture-simulation-command-deck-qa.ts',
        ].map((sourcePath) => [sourcePath, `${sourcePath}:sha256`])),
        viewports: scenario.requiredThemes.flatMap((theme) => commandDeckGeometryWidths.map((width) => {
          const sceneRect = width === 320
            ? { left: 16, top: 295, right: 304, bottom: 855, width: 288, height: 560 }
            : { left: width === 1440 ? 96 : 17, top: 110, right: width === 1440 ? 1416 : 1007, bottom: 850, width: width === 1440 ? 1320 : 990, height: 740 };
          return {
            width,
            theme,
            screenshot: `artifacts/commercial-ui/simulation-command-deck-535/${href.replace(/[^a-z0-9]+/gi, '-')}-${theme}-${width}.png`,
            screenshotSha256: `${href}:command-deck:${theme}:${width}`,
            screenshotWidth: width,
            screenshotHeight: width === 320 ? 900 : 900,
            themeApplied: true,
            htmlClassName: theme,
            bodyBackground: theme === 'dark' ? 'rgb(2, 8, 23)' : 'rgb(248, 250, 252)',
            sceneChromeRemoved: true,
            inSceneBackControlCount: 0,
            inSceneAbbreviationCount: 0,
            collapseButtonCount: width === 1440 ? 2 : 0,
            restoreHandleCount: width === 1440 ? 0 : 2,
            panelsTopAligned: true,
            bottomToolsUnobscured: true,
            bottomToolsWithinViewport: true,
            bottomToolSegmentRoles: ['view-switcher', 'grid-toggle', 'speed-controls'],
            konlingDockCollisionFree: true,
            restoreHandlesKeyboardReachable: true,
            primarySceneNonblank: true,
            structuredSurfacesBelowScene: scenario.href === '/simulations/cruise' ? true : undefined,
            sceneRect,
            statusPanelRect: width === 1440
              ? { left: 112, top: 126, right: 432, bottom: 754, width: 320, height: 628 }
              : undefined,
            controlPanelRect: width === 1440
              ? { left: 1048, top: 126, right: 1400, bottom: 754, width: 352, height: 628 }
              : undefined,
          };
        })),
        cruiseComparison: scenario.href === '/simulations/cruise'
          ? {
              comparedRoutes: ['/simulations/destroyer', '/simulations/lng'],
              desktopSceneWidthRatioToMedian: 0.98,
              desktopSceneHeightRatioToMedian: 1.03,
              contextPlacement: 'below-primary-scene' as const,
              mobileSceneFirst: true,
            }
          : undefined,
      }
    : undefined;
  return {
    archetype: scenario.archetype,
    availabilityConsistentWith: scenario.href === '/virtual-lab' ? '/simulations' : undefined,
    virtualLabFinalBehavior: scenario.href === '/virtual-lab' ? 'redirects-to-simulations' : undefined,
    handoffBaseline: simulationHandoffBaselineFor(scenario.href),
    hidesInternalModelStatus: true,
    duplicateAssistantEntries: 0,
    unmanagedRightBottomControls: 0,
    localControlCollisionFree: true,
    routeInventoryCompatible: true,
    modelLibraryCompatible: true,
    resourceInternalTheme: {
      sharedPrimitives: true,
      panelThemeParity: true,
      localControlsThemeParity: true,
      restoreHandlesThemeParity: true,
      hardCodedPaletteFindings: 0,
    },
    sceneThemeParameters: {
      lightTemplate: true,
      darkTemplate: true,
      skyWaterGridFogThemeAware: true,
      labelHudContrastChecked: true,
      unchangedLightSceneInDarkTheme: false,
    },
    commandDeckGeometry,
    reactDoctorErrorCheck: {
      localOnly: true,
      ciRequired: false,
      command: 'rtk npm run test:react-doctor:owned-errors',
      status: 'passed',
      report: 'artifacts/commercial-ui/simulation-experience-visual-qa/react-doctor-owned-errors.json',
      reportSha256: 'react-doctor-report-content',
      ownedDiagnostics: 0,
      selectedDiagnostics: 0,
    },
    runtimeNoise: {
      captureCommand: 'rtk npm run test:simulation-runtime-noise',
      report: 'artifacts/commercial-ui/simulation-runtime-noise-536/runtime-noise.json',
      reportSha256: 'runtime-noise-report-content',
      routesChecked: 7,
      pageErrors: [],
      trackedConsoleWarnings: [],
    },
    viewports: scenario.requiredThemes.flatMap((theme) => scenario.requiredWidths.flatMap((width) => (
      simulationNavigationStatesForWidth(width, scenario.requiredNavigationStates).flatMap((navigationState) => (
        scenario.requiredDockStates.flatMap((dockState) => (
          scenario.requiredLocalToolStates.map((localToolState) => ({
            width,
            theme,
            requestedRoute: scenario.href,
            finalUrl: scenario.finalBehavior === 'redirects-to-simulations'
              ? 'http://localhost:3000/simulations'
              : `http://localhost:3000${scenario.href}`,
            role: scenario.role,
            authState: scenario.acceptedAuthState,
            routeFile: scenario.routeFile,
            navigationState,
            dockState,
            localToolState,
            firstViewportTaskVisible: true,
            primarySceneNonblank: scenario.requiresNonblankScene || undefined,
            instrumentAreaNonblank: scenario.requiresNonblankScene || undefined,
            result: 'passed' as const,
            screenshot: `artifacts/commercial-ui/simulation-experience-visual-qa/${href.replace(/[^a-z0-9]+/gi, '-')}-${theme}-${width}-${navigationState}-${dockState}-${localToolState}.png`,
            screenshotSha256: `${href}:${theme}:${width}:${navigationState}:${dockState}:${localToolState}`,
            screenshotWidth: width,
            screenshotHeight: width === 320 ? 900 : 900,
          }))
        ))
      ))
    ))),
  };
}

function simulationFullMatrixVisualQa() {
  const entries = SIMULATION_FULL_MATRIX_VISUAL_QA_DETAIL_ROUTES.flatMap((route) => {
    const geometry = simulationVisualQaFor(route.href).commandDeckGeometry;
    if (!geometry) return [];
    return geometry.viewports
      .filter((viewport) => viewport.width === 1440 || viewport.width === 320)
      .map((viewport) => ({
        requestedRoute: route.href,
        finalUrl: `http://localhost:3000${route.href}`,
        theme: viewport.theme,
        viewport: {
          width: viewport.width as 1440 | 320,
          height: viewport.screenshotHeight,
        },
        role: route.role,
        authState: route.acceptedAuthState,
        screenshot: viewport.screenshot,
        screenshotSha256: viewport.screenshotSha256,
        screenshotWidth: viewport.screenshotWidth,
        screenshotHeight: viewport.screenshotHeight,
        runtimeErrors: [],
        trackedWarnings: [],
        checklist: {
          sceneFirstGeometry: true,
          themeParity: true,
          panelsTopAligned: true,
          duplicateSceneChromeAbsent: true,
          mobileReachability: true,
          dockNonOverlap: true,
          contrastChecked: true,
          runtimeNoiseClear: true,
          inSceneBackControlAbsent: true,
          inSceneAbbreviationAbsent: true,
        },
      }));
  });
  return {
    change: 'govern-simulation-full-matrix-visual-qa' as const,
    generatedAt: '2026-06-15T00:00:00.000Z',
    activeRouteSource: 'SIMULATION_VISUAL_QA_ROUTE_MATRIX.requiresNonblankScene' as const,
    routeCount: 7 as const,
    requiredThemes: ['light', 'dark'] as const,
    requiredWidths: [1440, 320] as const,
    entries,
    cruiseComparison: simulationVisualQaFor('/simulations/cruise').commandDeckGeometry?.cruiseComparison,
    independentReview: {
      status: 'passed' as const,
      reviewer: 'ui-flow-reviewer',
      reviewedAt: '2026-06-15T00:00:00.000Z',
      report: 'artifacts/commercial-ui/simulation-full-matrix-qa-537/independent-review.md',
      reportSha256: 'simulation-full-matrix-review',
      currentReportSha256: 'simulation-full-matrix-review',
      currentStatus: 'passed' as const,
      currentUnresolvedBlockers: 0,
      unresolvedBlockers: 0,
      inputs: {
        designHandoff: 'artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md',
        audit: 'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/audit.md',
        conceptImages: [
          'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
        ],
        contactSheets: [
          'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/contact-light-desktop.jpg',
          'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/contact-dark-desktop.jpg',
          'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/contact-light-mobile.jpg',
          'artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/contact-dark-mobile.jpg',
        ],
        implementationScreenshots: entries.map((entry) => entry.screenshot),
      },
    },
  };
}

function completeSimulationVisualEvidence(): CommercialVisualAcceptanceEvidence[] {
  return SIMULATION_VISUAL_QA_ROUTE_MATRIX.map((route) => ({
    href: route.href,
    viewports: route.href === '/virtual-lab' ? [] : route.requiredThemes.flatMap((theme) => (
      route.requiredWidths.flatMap((width) => (
        navigationStatesForWidth(width, findInventoryRoute(route.href)).map((navigationState) => {
          const inventoryRoute = findInventoryRoute(route.href);
          return {
            width,
            theme,
            role: route.role,
            requestedRoute: route.href,
            finalUrl: `http://localhost:3000${route.href}`,
            authState: route.acceptedAuthState,
            routeFile: route.routeFile,
            routeArchetype: inventoryRoute?.frame,
            dockState: inventoryRoute?.floatingDock === 'enabled' ? 'required' : inventoryRoute?.floatingDock,
            navigationState,
            result: 'passed' as const,
            screenshot: `artifacts/commercial-ui/simulation-experience-visual-qa/${route.href.replace(/[^a-z0-9]+/gi, '-')}-${theme}-${width}-${navigationState}.png`,
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
          };
        })
      ))
    )),
    simulationVisualQa: simulationVisualQaFor(route.href),
    simulationFullMatrixVisualQa: route.href === '/simulations'
      ? simulationFullMatrixVisualQa()
      : undefined,
  }));
}

function completeVisualEvidenceWithSimulationQa(): CommercialVisualAcceptanceEvidence[] {
  const routes = new Map<string, CommercialVisualAcceptanceEvidence>();
  for (const evidence of completeVisualEvidence()) routes.set(evidence.href, evidence);
  for (const evidence of completeSimulationVisualEvidence()) {
    const existing = routes.get(evidence.href);
    routes.set(evidence.href, existing
      ? {
          ...existing,
          simulationVisualQa: evidence.simulationVisualQa,
          simulationFullMatrixVisualQa: evidence.simulationFullMatrixVisualQa,
        }
      : evidence);
  }
  return [...routes.values()];
}

function baseInput(overrides: Partial<CommercialUiGovernanceInput> = {}): CommercialUiGovernanceInput {
  return {
    mode: 'blocking',
    today,
    navigationCoverage: fullNavigationCoverage,
    visualEvidence: completeVisualEvidenceWithSimulationQa(),
    accessibilityEvidence: completeAccessibilityEvidence(),
    ...overrides,
  };
}

function completeInteractiveVisualAcceptanceArtifact(
  overrides: Partial<CommercialInteractiveVisualAcceptanceArtifact> = {},
): CommercialInteractiveVisualAcceptanceArtifact {
  const componentId = overrides.componentId ?? 'derivation-stage-fixture';
  const route = overrides.route ?? '/interactive-learning/courses/unit-2-1-modeling-language/student/session-fixture';
  const componentKind = overrides.componentKind ?? 'visual.derivationStage';
  const screenshot = (
    role: 'student' | 'teacher',
    theme: 'light' | 'dark',
    viewport: 'mobile' | 'desktop' | 'projection',
    state: string,
  ) => ({
    componentId,
    route,
    role,
    theme,
    viewport,
    state,
    path: `artifacts/interactive-learning/visual-gates/${componentId}-${role}-${theme}-${viewport}-${state}.png`,
    sha256: `${role}-${theme}-${viewport}-${state}-sha`,
    horizontalOverflow: false,
    teacherControlsCoverPrimaryStage: false,
    keyboardReachable: true,
    visibleFocus: true,
    teachingSemanticLabels: true,
  });

  const artifact: CommercialInteractiveVisualAcceptanceArtifact = {
    componentId,
    componentKind,
    route,
    designContractPath: 'artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/design-contract.md',
    visualSourcePath: 'artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/concepts/derivation-stage.png',
    manifestAuditPath: 'artifacts/interactive-learning/visual-gates/manifest-audit.json',
    testResultPath: 'artifacts/interactive-learning/visual-gates/test-result.json',
    browserAuditPath: 'artifacts/interactive-learning/visual-gates/browser-audit.json',
    evidenceSamplePath: 'artifacts/interactive-learning/visual-gates/evidence-sample.json',
    reviewerEvidencePath: 'artifacts/interactive-learning/visual-gates/product-design-review.md',
    artifactPaths: [
      { path: 'artifacts/interactive-learning/visual-gates/browser-audit.json', exists: true, current: true, componentId },
    ],
    teachingMapping: {
      lessonId: 'unit-2-1',
      stepId: 'step-03',
      learningGoalId: 'lg-derive-transfer-function',
      handoutAnchor: 'handout-derive-transfer-function',
      bopppsPhase: 'participatory-learning',
      interactiveContractStepId: 'contract-step-03',
    },
    screenshots: [
      screenshot('student', 'light', 'desktop', 'student-unreleased'),
      screenshot('student', 'dark', 'mobile', 'student-released'),
      screenshot('student', 'light', 'projection', 'student-submitted'),
      screenshot('teacher', 'dark', 'desktop', 'teacher-reveal'),
      screenshot('teacher', 'light', 'desktop', 'teacher-answer-reveal'),
      screenshot('teacher', 'dark', 'projection', 'teacher-diagnostics'),
    ],
    browserAudit: {
      path: 'artifacts/interactive-learning/visual-gates/browser-audit.json',
      roles: ['student', 'teacher'],
      routes: [route],
      themes: ['light', 'dark'],
      viewports: ['mobile', 'desktop', 'projection'],
      states: [
        'student-unreleased',
        'student-released',
        'student-submitted',
        'teacher-reveal',
        'teacher-answer-reveal',
        'teacher-diagnostics',
      ],
      noHorizontalOverflow: true,
      teacherControlsClearPrimaryStage: true,
    },
    evidenceSample: {
      path: 'artifacts/interactive-learning/visual-gates/evidence-sample.json',
      eventType: 'visual_reveal',
      clientEventId: 'client-visual-stage-001',
      attemptKey: 'step-03:attempt-1',
      sourceLogId: 'trusted-interaction-log-id',
      lessonKey: 'unit-2-1',
      stepId: 'step-03',
      moduleId: componentId,
      componentKind,
      componentId,
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      theme: 'light',
      viewport: 'desktop',
      schemaVersion: 'interactive-visual-component-evidence-v1',
      serverRecordedAt: '2026-06-18T00:00:01.000Z',
      payload: { revealIndex: 2, formulaBlockId: 'block-a' },
      classification: ['InteractionLog', 'StudentStepResponse', 'LearningFact'],
      affectsTeacherDiagnostics: true,
      affectsAbilitySnapshots: false,
      affectsRecommendationInputs: false,
    },
    diagnosticPolicy: {
      denominator: 'released-participants',
      dedupeKey: 'lessonKey:stepId:moduleId:attemptKey:clientEventId',
      attemptPolicy: 'latest-submission-and-all-reveals',
      resubmissionDisplay: 'latest-with-history-count',
      unreleasedStudentInclusion: 'exclude-from-coverage-denominator',
      freeTextRedaction: 'redact-by-default',
      access: 'teacher-admin-only',
      labelsUseTeachingSemantics: true,
    },
    visibleTextSamples: ['拉普拉斯变换步骤', '教师可查看推导进度分布'],
    teacherDiagnostics: true,
    stateRecoverability: {
      studentVisualState: true,
      submittedState: true,
      teacherRevealState: true,
      answerRevealState: true,
      diagnosticsAggregationState: true,
    },
    ...overrides,
  };
  return artifact;
}

const interactiveLearningProductQaMatrixIds = [
  'atlas-desktop-light',
  'course-catalog-mobile-dark',
  'chapter-components-desktop-light',
  'cross-domain-list-mobile-light',
  'course-entry-desktop-light',
  'teacher-waiting-desktop-light',
  'student-runtime-desktop-light',
  'guest-runtime-mobile-dark',
  'teacher-projection-desktop-dark',
  'invalid-session-desktop-light',
  'module-chrome-student-choice-mobile',
  'konling-dock-collapsed-desktop',
  'focus-management-keyboard',
] as const;

const interactiveLearningProductQaConceptImages = [
  'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/01-learning-atlas-course-catalog.png',
  'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/02-course-entry-shell.png',
  'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/01-course-catalog-theory-practice.png',
  'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/02-teacher-classroom-qr-waiting.png',
  'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/03-student-guest-runtime.png',
  'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/06-teacher-projection-runtime-compact-navigation.png',
] as const;

const interactiveLearningProductQaMatrixMetadata = {
  'atlas-desktop-light': {
    route: '/interactive-learning',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/01-learning-atlas-course-catalog.png',
  },
  'course-catalog-mobile-dark': {
    route: '/interactive-learning/courses',
    role: 'student',
    theme: 'dark',
    viewport: 'mobile',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/01-course-catalog-theory-practice.png',
  },
  'chapter-components-desktop-light': {
    route: '/interactive-learning/chapter-components',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/01-learning-atlas-course-catalog.png',
  },
  'cross-domain-list-mobile-light': {
    route: '/interactive-learning/cross-domain-exploration',
    role: 'student',
    theme: 'light',
    viewport: 'mobile',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/01-learning-atlas-course-catalog.png',
  },
  'course-entry-desktop-light': {
    route: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/02-course-entry-shell.png',
  },
  'teacher-waiting-desktop-light': {
    route: '/interactive-learning/courses/[courseId]/teacher/[sessionId]/waiting',
    role: 'teacher',
    theme: 'light',
    viewport: 'desktop',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/02-teacher-classroom-qr-waiting.png',
  },
  'student-runtime-desktop-light': {
    route: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/03-student-guest-runtime.png',
  },
  'guest-runtime-mobile-dark': {
    route: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo',
    role: 'guest',
    theme: 'dark',
    viewport: 'mobile',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/03-student-guest-runtime.png',
  },
  'teacher-projection-desktop-dark': {
    route: '/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]',
    role: 'teacher',
    theme: 'dark',
    viewport: 'desktop',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/06-teacher-projection-runtime-compact-navigation.png',
  },
  'invalid-session-desktop-light': {
    route: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/03-student-guest-runtime.png',
  },
  'module-chrome-student-choice-mobile': {
    route: '/interactive-learning/courses/unit-4-1-design-task-expression/student/[sessionId]',
    role: 'student',
    theme: 'light',
    viewport: 'mobile',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/03-student-guest-runtime.png',
  },
  'konling-dock-collapsed-desktop': {
    route: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/03-student-guest-runtime.png',
  },
  'focus-management-keyboard': {
    route: '/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]',
    role: 'teacher',
    theme: 'light',
    viewport: 'desktop',
    sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/06-teacher-projection-runtime-compact-navigation.png',
  },
} as const;

function completeInteractiveLearningProductQaEvidence(
  overrides: Partial<CommercialInteractiveLearningProductQaEvidence> = {},
): CommercialInteractiveLearningProductQaEvidence {
  const reportSha256 = 'report-sha';
  return {
    change: 'govern-interactive-learning-product-qa',
    generatedAt: '2026-06-15T10:00:00+08:00',
    sourceCommit: '16f779a1f',
    designHandoff: 'artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md',
    designHandoffSha256: 'handoff-sha',
    currentDesignHandoffSha256: 'handoff-sha',
    handoffMatrix: 'artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/govern-interactive-learning-product-qa/handoff-to-implementation-matrix.md',
    handoffMatrixSha256: 'matrix-sha',
    currentHandoffMatrixSha256: 'matrix-sha',
    conceptImages: interactiveLearningProductQaConceptImages,
    conceptImageSha256: Object.fromEntries(interactiveLearningProductQaConceptImages.map((conceptImage) => [
      conceptImage,
      'concept-sha',
    ])),
    currentConceptImageSha256: Object.fromEntries(interactiveLearningProductQaConceptImages.map((conceptImage) => [
      conceptImage,
      'concept-sha',
    ])),
    childDesignQaReports: [
      'unify-interactive-learning-atlas-shell',
      'migrate-interactive-course-entry-shell',
      'standardize-interactive-classroom-entry',
      'standardize-lesson-runtime-shell',
      'define-interactive-module-visual-standards',
    ].map((change) => ({
      change,
      report: `artifacts/${change}/design-qa.md`,
      reportSha256,
      currentReportSha256: reportSha256,
      finalResult: 'passed',
      reportFinalResult: 'passed',
    })),
    routeMatrix: interactiveLearningProductQaMatrixIds.map((id) => ({
      id,
      ...interactiveLearningProductQaMatrixMetadata[id],
      navigationState: 'desktop-collapsed',
      dockState: 'collapsed',
      pageState: 'covered',
      moduleState: 'covered',
      result: 'passed',
    })),
    independentVisualReview: {
      status: 'passed',
      reviewer: 'ui-flow-reviewer',
      report: 'artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/govern-interactive-learning-product-qa/independent-visual-review.md',
      reportSha256,
      currentReportSha256: reportSha256,
      reportHasPassVerdict: true,
      reportHasNoUnresolvedBlocks: true,
    },
    regressionChecks: {
      sharedShellNavigationDock: true,
      teacherNoStudentInputs: true,
      teacherNoPermanentRightDrawer: true,
      teacherNoTopDuplicateNext: true,
      teacherBottomNavHasPageJump: true,
      konlingRightBottomOnly: true,
      studentGuestNoTeacherStats: true,
      courseShellNoPrimaryPremiumLessonShell: true,
      standardModuleChromeRegistered: true,
    },
    temporaryExceptions: [],
    ...overrides,
  };
}

const adaptivePathProductQaConceptImages = [
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png',
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png',
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/03-active-path-execution.png',
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/04-history-evidence-record.png',
] as const;

const adaptivePathProductQaMatrixMetadata = {
  'generation-main-desktop-light': ['light', 'desktop', 'desktop-collapsed', 'collapsed', adaptivePathProductQaConceptImages[0], 'frequency-response-foundations'],
  'generation-main-mobile-dark': ['dark', 'mobile', 'workspace-command-surface', 'collapsed', adaptivePathProductQaConceptImages[0], 'frequency-response-foundations'],
  'konling-parameter-panel-desktop-dark': ['dark', 'desktop', 'desktop-collapsed', 'expanded', adaptivePathProductQaConceptImages[0], 'frequency-response-foundations'],
  'cold-start-starter-paths-mobile-light': ['light', 'mobile', 'workspace-command-surface', 'collapsed', adaptivePathProductQaConceptImages[0], 'frequency-response-foundations'],
  'path-comparison-desktop-light': ['light', 'desktop', 'desktop-collapsed', 'collapsed', adaptivePathProductQaConceptImages[1], 'control-correction'],
  'path-comparison-mobile-dark': ['dark', 'mobile', 'workspace-command-surface', 'collapsed', adaptivePathProductQaConceptImages[1], 'control-correction'],
  'active-path-execution-desktop-light': ['light', 'desktop', 'desktop-collapsed', 'collapsed', adaptivePathProductQaConceptImages[2], 'control-correction'],
  'active-path-execution-mobile-dark': ['dark', 'mobile', 'workspace-command-surface', 'collapsed', adaptivePathProductQaConceptImages[2], 'control-correction'],
  'node-detail-desktop-light': ['light', 'desktop', 'desktop-collapsed', 'collapsed', adaptivePathProductQaConceptImages[2], 'control-correction'],
  'skip-warning-desktop-light': ['light', 'desktop', 'desktop-collapsed', 'collapsed', adaptivePathProductQaConceptImages[2], 'control-correction'],
  'history-evidence-desktop-light': ['light', 'desktop', 'desktop-collapsed', 'collapsed', adaptivePathProductQaConceptImages[3], 'control-correction'],
  'history-evidence-mobile-dark': ['dark', 'mobile', 'workspace-command-surface', 'collapsed', adaptivePathProductQaConceptImages[3], 'control-correction'],
  'app-shell-expanded-dock-desktop-dark': ['dark', 'desktop', 'desktop-expanded', 'expanded', adaptivePathProductQaConceptImages[2], 'control-correction'],
} as const;

const adaptivePathFunctionalGates = [
  'coldStartGeneratesSelectablePaths',
  'generationSupportsGenericGoals',
  'governedResourceNodes',
  'atLeastOneCheckpoint',
  'forbiddenStudentVisibleStringsAbsent',
  'generationSelectionRejectionSwitchRecorded',
  'startCompletionReviewContinuedInteractionRecorded',
  'skipReturnDeviationCheckpointRecorded',
  'konlingAdjustmentRecorded',
  'externalResourceAccessGoverned',
  'noCompletedNodeDoubleCount',
  'desktopFluidWorkspace',
  'mobileTaskFirstPanels',
  'comparisonNotMarketingCards',
  'appShellBreadcrumbsAccountControls',
  'rightBottomKonlingDock',
] as const;

function completeAdaptivePathProductQaEvidence(
  overrides: Partial<CommercialAdaptivePathProductQaEvidence> = {},
): CommercialAdaptivePathProductQaEvidence {
  const reportSha256 = 'adaptive-report-sha';
  return {
    change: 'govern-adaptive-path-product-qa',
    generatedAt: '2026-06-16T10:00:00+08:00',
    sourceCommit: 'c2702c206',
    designHandoff: 'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md',
    designHandoffSha256: 'adaptive-handoff-sha',
    currentDesignHandoffSha256: 'adaptive-handoff-sha',
    handoffMatrix: 'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/evidence/govern-adaptive-path-product-qa/handoff-to-implementation-matrix.md',
    handoffMatrixSha256: 'adaptive-matrix-sha',
    currentHandoffMatrixSha256: 'adaptive-matrix-sha',
    captureManifest: 'artifacts/commercial-ui/adaptive-path-product-qa-516/capture-manifest.json',
    captureManifestSha256: 'adaptive-capture-manifest-sha',
    currentCaptureManifestSha256: 'adaptive-capture-manifest-sha',
    visualSignals: 'artifacts/commercial-ui/adaptive-path-product-qa-516/visual-signals.json',
    visualSignalsSha256: 'adaptive-visual-signals-sha',
    currentVisualSignalsSha256: 'adaptive-visual-signals-sha',
    conceptImages: adaptivePathProductQaConceptImages,
    conceptImageSha256: Object.fromEntries(adaptivePathProductQaConceptImages.map((conceptImage) => [
      conceptImage,
      'adaptive-concept-sha',
    ])),
    currentConceptImageSha256: Object.fromEntries(adaptivePathProductQaConceptImages.map((conceptImage) => [
      conceptImage,
      'adaptive-concept-sha',
    ])),
    childChangeValidations: [
      'generalize-adaptive-learning-path-generation',
      'govern-adaptive-path-resource-nodes',
      'add-konling-path-generation-tools',
      'redesign-adaptive-path-generation-selection-ui',
      'build-adaptive-path-execution-history-ui',
    ].map((change) => ({
      change,
      validationCommand: `rtk openspec validate ${change} --strict`,
      result: 'passed',
      archivedTasksComplete: true,
    })),
    routeMatrix: Object.entries(adaptivePathProductQaMatrixMetadata).map(([
      id,
      [theme, viewport, navigationState, dockState, sourceConcept, goal],
    ]) => ({
      id,
      route: '/assessment/adaptive-practice',
      goal,
      role: 'student',
      theme,
      viewport,
      authState: 'authenticated',
      navigationState,
      dockState,
      pageState: 'covered',
      sourceConcept,
      screenshot: `artifacts/commercial-ui/adaptive-path-product-qa/${id}.png`,
      screenshotSha256: 'screenshot-sha',
      result: 'passed',
    })),
    captureStates: Object.entries(adaptivePathProductQaMatrixMetadata).map(([
      id,
      [theme, viewport, , , , goal],
    ]) => ({
      id,
      goal,
      theme,
      viewport,
      screenshot: `artifacts/commercial-ui/adaptive-path-product-qa/${id}.png`,
      screenshotSha256: 'screenshot-sha',
    })),
    independentVisualReview: {
      status: 'passed',
      reviewer: 'ui-flow-reviewer',
      report: 'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/evidence/govern-adaptive-path-product-qa/independent-visual-review.md',
      reportSha256,
      currentReportSha256: reportSha256,
      reportHasPassVerdict: true,
      reportHasNoUnresolvedBlocks: true,
    },
    functionalGates: Object.fromEntries(adaptivePathFunctionalGates.map((gate) => [gate, true])),
    temporaryExceptions: [],
    ...overrides,
  };
}

describe('commercial UI governance', () => {
  it('does not require final interactive learning product QA evidence outside the scoped change', () => {
    const result = evaluateCommercialUiGovernance(baseInput());

    expect(result.blockingViolations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
        }),
      ]),
    );
  });

  it('requires final interactive learning product QA evidence when the scoped change is under review', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          rule: 'interactive-learning-product-qa.missing-evidence',
        }),
      ]),
    );
  });

  it('requires final adaptive path product QA evidence when the scoped change is under review', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      adaptivePathProductQaRequired: true,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'adaptive-path-product-qa',
          rule: 'adaptive-path-product-qa.missing-evidence',
        }),
      ]),
    );
  });

  it('requires compact spacing inventory and viewport evidence when the scoped change is under review', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      compactSpacingRequired: true,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'compact-spacing',
          rule: 'compact-spacing.missing-inventory',
        }),
        expect.objectContaining({
          category: 'compact-spacing',
          rule: 'compact-spacing.incomplete-visual-evidence',
        }),
      ]),
    );
  });

  const compactSpacingFamilies = [
    'knowledge-map',
    'interactive-course-entry',
    'student-runtime',
    'teacher-runtime',
    'adaptive-practice',
    'simulation-workspace',
    'teacher-operations',
    'form-first',
    'text-first',
    'report-evidence',
  ];
  const compactSpacingWidths = [1024, 1100, 1279, 1440, 1920, 2560, 768, 320];
  const completeCompactSpacingVisualEvidence = () => compactSpacingFamilies.flatMap((family) => (
    compactSpacingWidths.map((width, index) => ({
      href: `/${family}`,
      family,
      edgeMode: family === 'form-first' ? 'intrinsic' as const : 'page-edge' as const,
      finalUrl: `/${family}`,
      finalUrlMatches: true,
      width,
      viewportWidth: width,
      navigationState: family === 'form-first'
        ? 'auth-callback-panel' as const
        : ['student-runtime', 'teacher-runtime'].includes(family)
          ? 'hidden-immersive' as const
          : width >= 1440
            ? (index % 2 === 0 ? 'desktop-expanded' as const : 'desktop-collapsed' as const)
            : 'workspace-command-surface' as const,
      primaryContentLeft: width >= 1024 ? 24 : 12,
      primaryContentRight: width - (width >= 1024 ? 24 : 12),
      navigationBoundaryRight: 0,
      compactEdgeMaxPx: width >= 1024 ? 32 : 16,
      horizontalOverflow: false,
      auxiliaryCollisionFree: true,
      hydrationReady: true,
      pageLevelCenteredWrapperCount: 0,
      pageLevelCenteredWrappers: [],
      screenshot: `artifacts/commercial-ui/compact-spacing-685/${family}-${width}.png`,
      screenshotSha256: `${family}-${width}-sha`,
      screenshotExists: true,
      screenshotSha256Matches: true,
    }))
  ));

  it('passes compact spacing governance with closed inventory and complete viewport evidence', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      compactSpacingRequired: true,
      compactSpacingInventory: [
        {
          path: 'src/components/platform/app-shell.tsx',
          owner: 'standardize-sitewide-compact-spacing',
          scope: 'AppShell route frame content wrapper',
          classification: 'migrated',
          reason: 'Primary route frames now use compact fixed page edges.',
          removalCondition: 'Permanent sitewide shell contract.',
        },
      ],
      compactSpacingVisualEvidence: completeCompactSpacingVisualEvidence(),
    }));

    expect(result.blockingViolations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'compact-spacing',
        }),
      ]),
    );
  });

  it('fails compact spacing governance when a required route family is missing', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      compactSpacingRequired: true,
      compactSpacingInventory: [{
        path: 'src/components/platform/app-shell.tsx',
        owner: 'standardize-sitewide-compact-spacing',
        scope: 'AppShell route frame content wrapper',
        classification: 'migrated',
        reason: 'Primary route frames now use compact fixed page edges.',
        removalCondition: 'Permanent sitewide shell contract.',
      }],
      compactSpacingVisualEvidence: completeCompactSpacingVisualEvidence().filter((entry) => entry.family !== 'teacher-runtime'),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'compact-spacing',
          rule: 'compact-spacing.incomplete-visual-evidence',
        }),
      ]),
    );
  });

  it('fails compact spacing governance when screenshots are stale or missing', () => {
    const evidence = completeCompactSpacingVisualEvidence();
    evidence[0] = {
      ...evidence[0],
      screenshotExists: true,
      screenshotSha256Matches: false,
    };
    const result = evaluateCommercialUiGovernance(baseInput({
      compactSpacingRequired: true,
      compactSpacingInventory: [{
        path: 'src/components/platform/app-shell.tsx',
        owner: 'standardize-sitewide-compact-spacing',
        scope: 'AppShell route frame content wrapper',
        classification: 'migrated',
        reason: 'Primary route frames now use compact fixed page edges.',
        removalCondition: 'Permanent sitewide shell contract.',
      }],
      compactSpacingVisualEvidence: evidence,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'compact-spacing',
          rule: 'compact-spacing.incomplete-visual-evidence',
        }),
      ]),
    );
  });

  it('measures expanded desktop content edge relative to the navigation boundary', () => {
    const evidence = completeCompactSpacingVisualEvidence();
    const expandedIndex = evidence.findIndex((entry) => (
      entry.family === 'knowledge-map'
      && entry.width === 1440
    ));
    evidence[expandedIndex] = {
      ...evidence[expandedIndex],
      navigationState: 'desktop-expanded',
      primaryContentLeft: 248,
      navigationBoundaryRight: 248,
    };
    const result = evaluateCommercialUiGovernance(baseInput({
      compactSpacingRequired: true,
      compactSpacingInventory: [{
        path: 'src/components/platform/app-shell.tsx',
        owner: 'standardize-sitewide-compact-spacing',
        scope: 'AppShell route frame content wrapper',
        classification: 'migrated',
        reason: 'Primary route frames now use compact fixed page edges.',
        removalCondition: 'Permanent sitewide shell contract.',
      }],
      compactSpacingVisualEvidence: evidence,
    }));

    expect(result.blockingViolations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'compact-spacing',
          rule: 'compact-spacing.incomplete-visual-evidence',
        }),
      ]),
    );
  });

  it('fails hidden or auth compact spacing states when a navigation boundary is visible', () => {
    const evidence = completeCompactSpacingVisualEvidence();
    const hiddenIndex = evidence.findIndex((entry) => (
      entry.navigationState === 'hidden-immersive'
      && entry.width === 1440
    ));
    const authIndex = evidence.findIndex((entry) => (
      entry.navigationState === 'auth-callback-panel'
      && entry.width === 1440
    ));
    evidence[hiddenIndex] = {
      ...evidence[hiddenIndex],
      navigationBoundaryRight: 72,
      primaryContentLeft: 72,
    };
    evidence[authIndex] = {
      ...evidence[authIndex],
      navigationBoundaryRight: 72,
      primaryContentLeft: 72,
    };
    const result = evaluateCommercialUiGovernance(baseInput({
      compactSpacingRequired: true,
      compactSpacingInventory: [{
        path: 'src/components/platform/app-shell.tsx',
        owner: 'standardize-sitewide-compact-spacing',
        scope: 'AppShell route frame content wrapper',
        classification: 'migrated',
        reason: 'Primary route frames now use compact fixed page edges.',
        removalCondition: 'Permanent sitewide shell contract.',
      }],
      compactSpacingVisualEvidence: evidence,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'compact-spacing',
          rule: 'compact-spacing.incomplete-visual-evidence',
          evidence: expect.arrayContaining([
            expect.stringContaining('navigationState=hidden-immersive exposes navigationBoundaryRight=72'),
            expect.stringContaining('navigationState=auth-callback-panel exposes navigationBoundaryRight=72'),
          ]),
        }),
      ]),
    );
  });

  it('fails unregistered page-level centered max-width wrappers', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      sourceViolations: [{
        path: 'src/app/teacher/classes/page.tsx',
        rule: 'compact-spacing.unregistered-page-wrapper',
        message: 'Page-level centered maximum-width wrapper is not registered in the compact spacing inventory.',
        evidence: ['L50:className="mx-auto max-w-[1600px] px-6 py-8"'],
      }],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'compact-spacing',
          rule: 'compact-spacing.unregistered-page-wrapper',
          path: 'src/app/teacher/classes/page.tsx',
        }),
      ]),
    );
  });

  it('passes final adaptive path product QA evidence when the integrated matrix is complete', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      adaptivePathProductQaRequired: true,
      adaptivePathProductQa: completeAdaptivePathProductQaEvidence(),
    }));

    expect(result.blockingViolations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'adaptive-path-product-qa',
        }),
      ]),
    );
  });

  it('fails final adaptive path product QA evidence when source changes do not refresh final evidence', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      adaptivePathProductQaRequired: true,
      adaptivePathProductQaSourceRefreshRequired: true,
      adaptivePathProductQaEvidenceRefreshed: false,
      adaptivePathProductQa: completeAdaptivePathProductQaEvidence(),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'adaptive-path-product-qa',
          rule: 'adaptive-path-product-qa.incomplete-evidence',
          evidence: expect.arrayContaining(['sourceCommit=refreshed-for-current-source-change']),
        }),
      ]),
    );
  });

  it('fails final adaptive path product QA evidence when visual review or functional gates are incomplete', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      adaptivePathProductQaRequired: true,
      adaptivePathProductQa: completeAdaptivePathProductQaEvidence({
        independentVisualReview: {
          ...completeAdaptivePathProductQaEvidence().independentVisualReview,
          status: 'blocked',
          reportSha256: 'old-review-sha',
          currentReportSha256: 'new-review-sha',
          reportHasNoUnresolvedBlocks: false,
        },
        functionalGates: {
          ...completeAdaptivePathProductQaEvidence().functionalGates,
          comparisonNotMarketingCards: false,
        },
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'adaptive-path-product-qa',
          evidence: expect.arrayContaining([
            'independentVisualReview.status=passed',
            'independentVisualReview.reportSha256=current',
            'independentVisualReview.reportHasNoUnresolvedBlocks=true',
            'functionalGates.comparisonNotMarketingCards=true',
          ]),
        }),
      ]),
    );
  });

  it('fails final adaptive path product QA evidence when route matrix and capture manifest states diverge', () => {
    const completeEvidence = completeAdaptivePathProductQaEvidence();
    const result = evaluateCommercialUiGovernance(baseInput({
      adaptivePathProductQaRequired: true,
      adaptivePathProductQa: completeAdaptivePathProductQaEvidence({
        routeMatrix: completeEvidence.routeMatrix.map((entry) => (
          entry.id === 'cold-start-starter-paths-mobile-light'
            ? { ...entry, goal: 'starter-path' }
            : entry
        )),
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'adaptive-path-product-qa',
          evidence: expect.arrayContaining([
            'routeMatrix.cold-start-starter-paths-mobile-light.goal=frequency-response-foundations',
            'captureStates.cold-start-starter-paths-mobile-light.goal=routeMatrix.goal',
          ]),
        }),
      ]),
    );
  });

  it('fails final adaptive path product QA evidence when capture evidence hashes are stale', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      adaptivePathProductQaRequired: true,
      adaptivePathProductQa: completeAdaptivePathProductQaEvidence({
        captureManifestSha256: 'old-capture-manifest-sha',
        currentCaptureManifestSha256: 'new-capture-manifest-sha',
        visualSignalsSha256: 'old-visual-signals-sha',
        currentVisualSignalsSha256: 'new-visual-signals-sha',
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'adaptive-path-product-qa',
          evidence: expect.arrayContaining([
            'captureManifestSha256=current',
            'visualSignalsSha256=current',
          ]),
        }),
      ]),
    );
  });

  it('fails final adaptive path product QA evidence when a required state or child validation is missing', () => {
    const completeEvidence = completeAdaptivePathProductQaEvidence();
    const result = evaluateCommercialUiGovernance(baseInput({
      adaptivePathProductQaRequired: true,
      adaptivePathProductQa: completeAdaptivePathProductQaEvidence({
        childChangeValidations: completeEvidence.childChangeValidations.slice(1),
        routeMatrix: completeEvidence.routeMatrix.filter((entry) => entry.id !== 'path-comparison-desktop-light'),
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'adaptive-path-product-qa',
          evidence: expect.arrayContaining([
            'childChangeValidations.generalize-adaptive-learning-path-generation',
            'routeMatrix.path-comparison-desktop-light',
          ]),
        }),
      ]),
    );
  });

  it('fails stale final interactive learning product QA evidence when persisted hashes drift', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: completeInteractiveLearningProductQaEvidence({
        handoffMatrixSha256: 'old-matrix-sha',
        currentHandoffMatrixSha256: 'new-matrix-sha',
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          rule: 'interactive-learning-product-qa.incomplete-evidence',
          evidence: expect.arrayContaining(['handoffMatrixSha256=current']),
        }),
      ]),
    );
  });

  it('fails final interactive learning product QA evidence with incomplete route matrix metadata', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: completeInteractiveLearningProductQaEvidence({
        routeMatrix: completeInteractiveLearningProductQaEvidence().routeMatrix.map((entry, index) => (
          index === 0 ? { ...entry, role: undefined as never, navigationState: undefined as never } : entry
        )),
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining([
            'routeMatrix.atlas-desktop-light.role',
            'routeMatrix.atlas-desktop-light.navigationState',
          ]),
        }),
      ]),
    );
  });

  it('fails final interactive learning product QA evidence without throwing on malformed runtime schema', () => {
    expect(() => evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: {
        ...completeInteractiveLearningProductQaEvidence({
          parseError: 'Unexpected token',
        }),
        childDesignQaReports: [null],
        routeMatrix: [null],
        temporaryExceptions: [null],
      } as unknown as CommercialInteractiveLearningProductQaEvidence,
    }))).not.toThrow();

    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: {
        ...completeInteractiveLearningProductQaEvidence({
          parseError: 'Unexpected token',
        }),
        childDesignQaReports: [null],
        routeMatrix: [null],
        temporaryExceptions: [null],
      } as unknown as CommercialInteractiveLearningProductQaEvidence,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining([
            'parseError=Unexpected token',
            'childDesignQaReports.entry=object',
            'routeMatrix.entry=object',
            'temporaryExceptions.entry=object',
          ]),
        }),
      ]),
    );
  });

  it('keeps malformed final interactive learning product QA script input as governance evidence', () => {
    const hydrated = hydrateInteractiveLearningProductQaEvidence({
      ...completeInteractiveLearningProductQaEvidence(),
      childDesignQaReports: [null],
      routeMatrix: [null],
      temporaryExceptions: [null],
    });

    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: hydrated,
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining([
            'childDesignQaReports.entry=object',
            'routeMatrix.entry=object',
            'temporaryExceptions.entry=object',
          ]),
        }),
      ]),
    );
  });

  it('keeps malformed independent visual review script input as governance evidence', () => {
    for (const independentVisualReview of [null, []]) {
      expect(() => hydrateInteractiveLearningProductQaEvidence({
        ...completeInteractiveLearningProductQaEvidence(),
        independentVisualReview,
      })).not.toThrow();

      const result = evaluateCommercialUiGovernance(baseInput({
        interactiveLearningProductQaRequired: true,
        interactiveLearningProductQa: hydrateInteractiveLearningProductQaEvidence({
          ...completeInteractiveLearningProductQaEvidence(),
          independentVisualReview,
        }),
      }));

      expect(result.passed).toBe(false);
      expect(result.blockingViolations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'interactive-learning-product-qa',
            evidence: expect.arrayContaining(['independentVisualReview=object']),
          }),
        ]),
      );
    }
  });

  it('fails final interactive learning product QA evidence with invalid route matrix enum values', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: completeInteractiveLearningProductQaEvidence({
        routeMatrix: completeInteractiveLearningProductQaEvidence().routeMatrix.map((entry, index) => (
          index === 0
            ? {
                ...entry,
                role: 'learner' as never,
                theme: 'contrast' as never,
                viewport: 'tablet' as never,
                navigationState: 'sidecar' as never,
                dockState: 'floating' as never,
              }
            : entry
        )),
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining([
            'routeMatrix.atlas-desktop-light.role=valid',
            'routeMatrix.atlas-desktop-light.theme=valid',
            'routeMatrix.atlas-desktop-light.viewport=valid',
            'routeMatrix.atlas-desktop-light.navigationState=valid',
            'routeMatrix.atlas-desktop-light.dockState=valid',
          ]),
        }),
      ]),
    );
  });

  it('fails final interactive learning product QA evidence when source changes do not refresh final evidence', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQaSourceRefreshRequired: true,
      interactiveLearningProductQaEvidenceRefreshed: false,
      interactiveLearningProductQa: completeInteractiveLearningProductQaEvidence(),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining(['sourceCommit=refreshed-for-current-source-change']),
        }),
      ]),
    );
  });

  it('fails final interactive learning product QA evidence when a route matrix id carries the wrong fixed metadata', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: completeInteractiveLearningProductQaEvidence({
        routeMatrix: completeInteractiveLearningProductQaEvidence().routeMatrix.map((entry, index) => (
          index === 0
            ? {
                ...entry,
                route: '/interactive-learning/courses',
                role: 'teacher',
                theme: 'dark',
                viewport: 'mobile',
                sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/revised/03-student-guest-runtime.png',
              }
            : entry
        )),
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining([
            'routeMatrix.atlas-desktop-light.route=/interactive-learning',
            'routeMatrix.atlas-desktop-light.role=student',
            'routeMatrix.atlas-desktop-light.theme=light',
            'routeMatrix.atlas-desktop-light.viewport=desktop',
            'routeMatrix.atlas-desktop-light.sourceConcept=artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/01-learning-atlas-course-catalog.png',
          ]),
        }),
      ]),
    );
  });

  it('fails final interactive learning product QA evidence when route matrix cites an unaccepted source concept', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: completeInteractiveLearningProductQaEvidence({
        routeMatrix: completeInteractiveLearningProductQaEvidence().routeMatrix.map((entry, index) => (
          index === 0
            ? {
                ...entry,
                sourceConcept: 'artifacts/product-design-audits/interactive-learning-2026-06-14/concepts/unaccepted.png',
              }
            : entry
        )),
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining([
            'routeMatrix.atlas-desktop-light.sourceConcept=accepted-concept-image',
            'routeMatrix.atlas-desktop-light.sourceConceptSha256',
          ]),
        }),
      ]),
    );
  });

  it('fails final interactive learning product QA evidence when route matrix source concept hash drifts', () => {
    const evidence = completeInteractiveLearningProductQaEvidence();
    const sourceConcept = evidence.conceptImages[0];
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: {
        ...evidence,
        routeMatrix: evidence.routeMatrix.map((entry, index) => (
          index === 0 ? { ...entry, sourceConcept } : entry
        )),
        currentConceptImageSha256: {
          ...evidence.currentConceptImageSha256,
          [sourceConcept]: 'stale-concept-sha',
        },
      },
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining([
            `conceptImageSha256.${sourceConcept}=current`,
            'routeMatrix.atlas-desktop-light.sourceConceptSha256=current',
          ]),
        }),
      ]),
    );
  });

  it('fails final interactive learning product QA evidence when child design QA report gates drift', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: completeInteractiveLearningProductQaEvidence({
        childDesignQaReports: completeInteractiveLearningProductQaEvidence().childDesignQaReports.map((entry, index) => (
          index === 0
            ? {
                ...entry,
                finalResult: 'blocked',
                reportFinalResult: 'missing',
                reportSha256: 'expected-report-sha',
                currentReportSha256: 'current-report-sha',
              }
            : entry
        )),
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining([
            'childDesignQaReports.unify-interactive-learning-atlas-shell.finalResult=passed',
            'childDesignQaReports.unify-interactive-learning-atlas-shell.reportFinalResult=passed',
            'childDesignQaReports.unify-interactive-learning-atlas-shell.reportSha256=current',
          ]),
        }),
      ]),
    );
  });

  it('fails final interactive learning product QA evidence without an explicit clean independent review report', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveLearningProductQaRequired: true,
      interactiveLearningProductQa: completeInteractiveLearningProductQaEvidence({
        independentVisualReview: {
          ...completeInteractiveLearningProductQaEvidence().independentVisualReview,
          reportSha256: 'expected-review-sha',
          currentReportSha256: 'current-review-sha',
          reportHasPassVerdict: false,
          reportHasNoUnresolvedBlocks: false,
        },
      }),
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-learning-product-qa',
          evidence: expect.arrayContaining([
            'independentVisualReview.reportSha256=current',
            'independentVisualReview.reportHasPassVerdict=true',
            'independentVisualReview.reportHasNoUnresolvedBlocks=true',
          ]),
        }),
      ]),
    );
  });

  it('parses independent visual review text with a negative unresolved BLOCK guard', () => {
    expect(interactiveLearningReviewHasNoUnresolvedBlocks([
      'Final verdict: PASS',
      'No unresolved BLOCK findings remain.',
    ].join('\n'))).toBe(true);
    expect(interactiveLearningReviewHasNoUnresolvedBlocks([
      'Final verdict: PASS',
      'No unresolved BLOCK findings remain.',
      'Unresolved BLOCK: stale route matrix still exists.',
    ].join('\n'))).toBe(false);
  });

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

  it('defines simulation visual QA route matrix for redirect, catalog, scenes, dock, and workbench regression', () => {
    expect(SIMULATION_VISUAL_QA_ROUTE_MATRIX.map((route) => route.href)).toEqual([
      '/simulations',
      '/virtual-lab',
      '/simulations/destroyer',
      '/simulations/lng',
      '/simulations/container',
      '/simulations/drilling',
      '/simulations/cruise',
      '/simulations/icebreaker',
      '/simulations/dredger',
      '/interactive-learning/control-workbench',
    ]);
    expect(SIMULATION_VISUAL_QA_ROUTE_MATRIX.find((route) => route.href === '/virtual-lab')).toMatchObject({
      archetype: 'legacy-redirect',
      finalBehavior: 'redirects-to-simulations',
    });
    for (const route of SIMULATION_VISUAL_QA_ROUTE_MATRIX) {
      expect(route.requiredThemes).toEqual(['light', 'dark']);
      expect(route.requiredWidths).toEqual([1440, 320]);
      expect(route.requiredNavigationStates).toEqual(expect.arrayContaining(['desktop-expanded', 'desktop-collapsed']));
      expect(route.reactDoctorCommand).toBe('rtk npm run test:react-doctor:owned-errors');
    }
    const nonblankSimulationRoutes = SIMULATION_VISUAL_QA_ROUTE_MATRIX
      .filter((route) => route.requiresNonblankScene)
      .map((route) => route.href);
    expect(nonblankSimulationRoutes).toEqual(expect.arrayContaining([
      '/simulations/destroyer',
      '/simulations/lng',
      '/simulations/container',
      '/simulations/cruise',
      '/simulations/drilling',
      '/simulations/icebreaker',
      '/simulations/dredger',
    ]));
    expect(nonblankSimulationRoutes).toHaveLength(7);
    expect(SIMULATION_VISUAL_QA_ROUTE_MATRIX.find((route) => route.href === '/simulations/destroyer')?.requiredDockStates).toEqual([
      'collapsed',
      'expanded',
    ]);
  });

  it('keeps simulation scene theme fallback stable before theme hydration', () => {
    expect(resolveSimulationSceneThemeMode('light', false)).toBe('dark');
    expect(resolveSimulationSceneThemeMode('dark', false)).toBe('dark');
    expect(resolveSimulationSceneThemeMode('light', true)).toBe('light');
    expect(SIMULATION_SCENE_THEMES[resolveSimulationSceneThemeMode('light', false)].mode).toBe('dark');
  });

  it('keeps shared simulation assessment panels on theme primitives instead of local light palettes', () => {
    const source = readFileSync(join(process.cwd(), 'src/resources/simulations/components/simulation-ui.tsx'), 'utf8');

    expect(source).not.toContain('border border-slate-300 bg-white');
    expect(source).not.toContain('bg-sky-700');
    expect(source).toContain('useSimulationSceneTheme');
    expect(source).toContain('sceneTheme.labelSurface');
    expect(source).toContain('sceneTheme.hudOverlay');
  });

  it('keeps simulation command-deck geometry scene-first without resource-local chrome', () => {
    const shellSource = readFileSync(join(process.cwd(), 'src/app/simulations/_components/simulation-shell.tsx'), 'utf8');
    const localToolsSource = readFileSync(join(process.cwd(), 'src/app/simulations/_components/simulation-local-tools.tsx'), 'utf8');
    const resourceUiSource = readFileSync(join(process.cwd(), 'src/resources/simulations/components/simulation-ui.tsx'), 'utf8');

    expect(shellSource).toContain('data-simulation-shell-structured-surfaces="below-primary-scene"');
    expect(shellSource).toContain('data-command-deck-context-placement="below-primary-scene"');
    expect(shellSource).toContain('panelLayout="side-rails"');
    expect(shellSource).not.toContain('workspaceSlots={hasStructuredSlots');
    expect(localToolsSource).toContain('data-command-deck-scene-primacy="true"');
    expect(resourceUiSource).toContain('data-simulation-scene-local-chrome="removed"');
    expect(resourceUiSource).toContain('data-command-deck-panel-anchor="top-command-area"');
    expect(resourceUiSource).not.toContain('返回上一层');
    expect(resourceUiSource).not.toContain('<Link');
  });

  it('accepts complete simulation visual QA evidence for required routes', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: completeVisualEvidenceWithSimulationQa(),
    }));

    expect(result.passed).toBe(true);
  });

  it('fails when command-deck simulation evidence keeps scene chrome or loses top-aligned panels', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa?.commandDeckGeometry) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          commandDeckGeometry: {
            ...entry.simulationVisualQa.commandDeckGeometry,
            viewports: entry.simulationVisualQa.commandDeckGeometry.viewports.map((viewport) => (
              viewport.theme === 'dark' && viewport.width === 1440
                ? {
                    ...viewport,
                    sceneChromeRemoved: false,
                    inSceneBackControlCount: 1,
                    inSceneAbbreviationCount: 1,
                    panelsTopAligned: false,
                    controlPanelRect: { left: 1048, top: 126, right: 1400, bottom: 946, width: 352, height: 820 },
                    bottomToolsWithinViewport: false,
                  }
                : viewport
            )),
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.violations.flatMap((violation) => violation.evidence)).toEqual(expect.arrayContaining([
      'commandDeckGeometry:theme=dark:width=1440:sceneChromeRemoved',
      'commandDeckGeometry:theme=dark:width=1440:inSceneBackControlCount=0',
      'commandDeckGeometry:theme=dark:width=1440:inSceneAbbreviationCount=0',
      'commandDeckGeometry:theme=dark:width=1440:panelsTopAligned',
      'commandDeckGeometry:theme=dark:width=1440:controlPanelRectWithinViewport',
      'commandDeckGeometry:theme=dark:width=1440:controlPanelRectWithinScene',
      'commandDeckGeometry:theme=dark:width=1440:bottomToolsWithinViewport',
    ]));
  });

  it('fails when command-deck screenshot proof is missing, stale, or dimensionally invalid', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa?.commandDeckGeometry) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          commandDeckGeometry: {
            ...entry.simulationVisualQa.commandDeckGeometry,
            viewports: entry.simulationVisualQa.commandDeckGeometry.viewports.map((viewport) => (
              viewport.theme === 'dark' && viewport.width === 1440
                ? {
                    ...viewport,
                    screenshotSha256: undefined,
                    screenshotWidth: 1024,
                    screenshotHeight: 500,
                  }
                : viewport
            )),
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.violations.flatMap((violation) => violation.evidence)).toEqual(expect.arrayContaining([
      'commandDeckGeometry:theme=dark:width=1440:screenshotSha256',
      'commandDeckGeometry:theme=dark:width=1440:screenshotWidth=1440',
      'commandDeckGeometry:theme=dark:width=1440:screenshotHeight>=640',
    ]));
  });

  it('fails when command-deck source hashes are missing or stale', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa?.commandDeckGeometry) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          commandDeckGeometry: {
            ...entry.simulationVisualQa.commandDeckGeometry,
            sourceSha256: {
              ...entry.simulationVisualQa.commandDeckGeometry.sourceSha256,
              'src/app/simulations/_components/simulation-shell.tsx': 'stale-shell-source',
            },
            currentSourceSha256: {
              ...entry.simulationVisualQa.commandDeckGeometry.currentSourceSha256,
              'scripts/tests/capture-simulation-command-deck-qa.ts': undefined as never,
            },
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.violations.flatMap((violation) => violation.evidence)).toEqual(expect.arrayContaining([
      'commandDeckGeometry.sourceSha256.src/app/simulations/_components/simulation-shell.tsx=current',
      'commandDeckGeometry.currentSourceSha256.scripts/tests/capture-simulation-command-deck-qa.ts',
    ]));
  });

  it('fails when command-deck collapse or restore controls are absent from evidence', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa?.commandDeckGeometry) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          commandDeckGeometry: {
            ...entry.simulationVisualQa.commandDeckGeometry,
            viewports: entry.simulationVisualQa.commandDeckGeometry.viewports.map((viewport) => {
              if (viewport.theme !== 'dark') return viewport;
              return viewport.width === 1440
                ? { ...viewport, collapseButtonCount: 0 }
                : { ...viewport, restoreHandleCount: 0 };
            }),
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.violations.flatMap((violation) => violation.evidence)).toEqual(expect.arrayContaining([
      'commandDeckGeometry:theme=dark:width=1440:collapseButtonCount>=2',
      'commandDeckGeometry:theme=dark:width=1024:restoreHandleCount>=2',
      'commandDeckGeometry:theme=dark:width=320:restoreHandleCount>=2',
    ]));
  });

  it('fails when command-deck evidence does not cover all bottom tool segments', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa?.commandDeckGeometry) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          commandDeckGeometry: {
            ...entry.simulationVisualQa.commandDeckGeometry,
            viewports: entry.simulationVisualQa.commandDeckGeometry.viewports.map((viewport) => (
              viewport.theme === 'dark' && viewport.width === 320
                ? { ...viewport, bottomToolSegmentRoles: ['view-switcher', 'grid-toggle'] }
                : viewport
            )),
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.violations.flatMap((violation) => violation.evidence)).toEqual(expect.arrayContaining([
      'commandDeckGeometry:theme=dark:width=320:bottomToolSegmentRoles.speed-controls',
    ]));
  });

  it('fails when cruise command-deck evidence does not compare scene-first geometry', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/cruise' || !entry.simulationVisualQa?.commandDeckGeometry) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          commandDeckGeometry: {
            ...entry.simulationVisualQa.commandDeckGeometry,
            cruiseComparison: {
              comparedRoutes: ['/simulations/destroyer'],
              desktopSceneWidthRatioToMedian: 0.72,
              desktopSceneHeightRatioToMedian: 1.42,
              contextPlacement: 'below-primary-scene' as const,
              mobileSceneFirst: false,
            },
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.violations.flatMap((violation) => violation.evidence)).toEqual(expect.arrayContaining([
      'commandDeckGeometry.cruiseComparison.comparedRoutes.lng',
      'commandDeckGeometry.cruiseComparison.desktopSceneWidthRatioToMedian>=0.9',
      'commandDeckGeometry.cruiseComparison.desktopSceneHeightRatioToMedian<=1.25',
      'commandDeckGeometry.cruiseComparison.mobileSceneFirst',
    ]));
  });

  it('fails when simulation visual QA evidence omits route, scene, dock, or React Doctor proof', () => {
    const completeSimulationEvidence = SIMULATION_VISUAL_QA_ROUTE_MATRIX.map((route) => ({
      href: route.href,
      viewports: [],
      simulationVisualQa: simulationVisualQaFor(route.href),
    }));
    const brokenDestroyer = completeSimulationEvidence.map((entry) => entry.href === '/simulations/destroyer'
      ? {
          ...entry,
            simulationVisualQa: {
              ...entry.simulationVisualQa,
              duplicateAssistantEntries: 1,
              handoffBaseline: {
                ...simulationHandoffBaselineFor(entry.href),
                independentReviewStatus: 'not-run' as const,
              },
              localControlCollisionFree: false,
              reactDoctorErrorCheck: { ...entry.simulationVisualQa.reactDoctorErrorCheck, status: 'not-run' as const },
              viewports: entry.simulationVisualQa.viewports.filter((viewport) => (
              viewport.dockState !== 'expanded' || viewport.primarySceneNonblank !== true
            )),
          },
        }
      : entry);
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: brokenDestroyer.filter((entry) => entry.href !== '/virtual-lab') as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.missing-route-evidence',
        path: '/virtual-lab',
      }),
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining([
          'duplicateAssistantEntries=0',
          'handoffBaseline.independentReviewStatus=passed',
          'localControlCollisionFree',
          'reactDoctorErrorCheck=passed',
          'theme=light:width=1440:navigationState=desktop-expanded:dockState=expanded:localToolState=collapsed',
        ]),
      }),
    ]));
  });

  it('fails when final simulation QA omits the handoff-alignment baseline', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      const { handoffBaseline: _handoffBaseline, ...simulationVisualQa } = entry.simulationVisualQa;
      return {
        ...entry,
        simulationVisualQa,
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining(['handoffBaseline']),
      }),
    ]));
  });

  it('fails when final simulation full-matrix QA evidence is missing', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations') return entry;
      const { simulationFullMatrixVisualQa: _simulationFullMatrixVisualQa, ...rest } = entry;
      return rest;
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining(['simulationFullMatrixVisualQa']),
      }),
    ]));
  });

  it('fails when final simulation full-matrix QA has unresolved review blockers', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationFullMatrixVisualQa) return entry;
      return {
        ...entry,
        simulationFullMatrixVisualQa: {
          ...entry.simulationFullMatrixVisualQa,
          independentReview: {
            ...entry.simulationFullMatrixVisualQa.independentReview,
            status: 'failed' as const,
            unresolvedBlockers: 1,
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'simulationFullMatrixVisualQa.independentReview.status=passed',
          'simulationFullMatrixVisualQa.independentReview.unresolvedBlockers=0',
        ]),
      }),
    ]));
  });

  it('fails when final simulation full-matrix QA report text no longer matches the stored review status', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationFullMatrixVisualQa) return entry;
      return {
        ...entry,
        simulationFullMatrixVisualQa: {
          ...entry.simulationFullMatrixVisualQa,
          independentReview: {
            ...entry.simulationFullMatrixVisualQa.independentReview,
            currentStatus: 'failed' as const,
            currentUnresolvedBlockers: 1,
            currentReportSha256: 'changed-failed-report',
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'simulationFullMatrixVisualQa.independentReview.reportSha256=current',
          'simulationFullMatrixVisualQa.independentReview.currentStatus=passed',
          'simulationFullMatrixVisualQa.independentReview.status=current',
          'simulationFullMatrixVisualQa.independentReview.currentUnresolvedBlockers=0',
          'simulationFullMatrixVisualQa.independentReview.unresolvedBlockers=current',
        ]),
      }),
    ]));
  });

  it('fails when final simulation full-matrix QA current review report evidence is missing', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationFullMatrixVisualQa) return entry;
      const {
        currentReportSha256: _currentReportSha256,
        currentStatus: _currentStatus,
        currentUnresolvedBlockers: _currentUnresolvedBlockers,
        ...independentReview
      } = entry.simulationFullMatrixVisualQa.independentReview;
      return {
        ...entry,
        simulationFullMatrixVisualQa: {
          ...entry.simulationFullMatrixVisualQa,
          independentReview,
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'simulationFullMatrixVisualQa.independentReview.currentReportSha256',
          'simulationFullMatrixVisualQa.independentReview.currentStatus=passed',
          'simulationFullMatrixVisualQa.independentReview.status=current',
          'simulationFullMatrixVisualQa.independentReview.currentUnresolvedBlockers=0',
          'simulationFullMatrixVisualQa.independentReview.unresolvedBlockers=current',
        ]),
      }),
    ]));
  });

  it('fails when final simulation full-matrix QA review screenshots do not match current matrix', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationFullMatrixVisualQa) return entry;
      const staleScreenshots = entry.simulationFullMatrixVisualQa.independentReview.inputs.implementationScreenshots.map((
        screenshot,
        index,
      ) => (index === 0 ? 'artifacts/commercial-ui/old-simulation-matrix.png' : screenshot));
      return {
        ...entry,
        simulationFullMatrixVisualQa: {
          ...entry.simulationFullMatrixVisualQa,
          independentReview: {
            ...entry.simulationFullMatrixVisualQa.independentReview,
            inputs: {
              ...entry.simulationFullMatrixVisualQa.independentReview.inputs,
              implementationScreenshots: staleScreenshots,
            },
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'simulationFullMatrixVisualQa.independentReview.inputs.implementationScreenshots=full-detail-matrix',
        ]),
      }),
    ]));
  });

  it('fails when final simulation full-matrix QA includes extra non-detail routes', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationFullMatrixVisualQa) return entry;
      return {
        ...entry,
        simulationFullMatrixVisualQa: {
          ...entry.simulationFullMatrixVisualQa,
          entries: [
            ...entry.simulationFullMatrixVisualQa.entries,
            {
              ...entry.simulationFullMatrixVisualQa.entries[0],
              requestedRoute: '/virtual-lab',
              finalUrl: 'http://localhost:3000/virtual-lab',
            },
          ],
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'simulationFullMatrixVisualQa.entries=28',
          'simulationFullMatrixVisualQa.unexpectedRoute=/virtual-lab',
        ]),
      }),
    ]));
  });

  it('fails when final simulation full-matrix QA misses mobile scene or dock checks', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationFullMatrixVisualQa) return entry;
      return {
        ...entry,
        simulationFullMatrixVisualQa: {
          ...entry.simulationFullMatrixVisualQa,
          entries: entry.simulationFullMatrixVisualQa.entries.map((matrixEntry) => (
            matrixEntry.requestedRoute === '/simulations/cruise'
              && matrixEntry.theme === 'dark'
              && matrixEntry.viewport.width === 320
              ? {
                  ...matrixEntry,
                  runtimeErrors: ['runtime page error'],
                  checklist: {
                    ...matrixEntry.checklist,
                    sceneFirstGeometry: false,
                    mobileReachability: false,
                    dockNonOverlap: false,
                    inSceneBackControlAbsent: false,
                  },
                }
              : matrixEntry
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'simulationFullMatrixVisualQa:/simulations/cruise:theme=dark:width=320:runtimeErrors=0',
          'simulationFullMatrixVisualQa:/simulations/cruise:theme=dark:width=320:checklist.sceneFirstGeometry',
          'simulationFullMatrixVisualQa:/simulations/cruise:theme=dark:width=320:checklist.mobileReachability',
          'simulationFullMatrixVisualQa:/simulations/cruise:theme=dark:width=320:checklist.dockNonOverlap',
          'simulationFullMatrixVisualQa:/simulations/cruise:theme=dark:width=320:checklist.inSceneBackControlAbsent',
        ]),
      }),
    ]));
  });

  it('fails when final simulation full-matrix QA omits a required checklist key', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationFullMatrixVisualQa) return entry;
      return {
        ...entry,
        simulationFullMatrixVisualQa: {
          ...entry.simulationFullMatrixVisualQa,
          entries: entry.simulationFullMatrixVisualQa.entries.map((matrixEntry) => (
            matrixEntry.requestedRoute === '/simulations/destroyer'
              && matrixEntry.theme === 'light'
              && matrixEntry.viewport.width === 1440
              ? {
                  ...matrixEntry,
                  checklist: Object.fromEntries(
                    Object.entries(matrixEntry.checklist).filter(([key]) => key !== 'contrastChecked'),
                  ) as typeof matrixEntry.checklist,
                }
              : matrixEntry
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'simulationFullMatrixVisualQa:/simulations/destroyer:theme=light:width=1440:checklist.contrastChecked',
        ]),
      }),
    ]));
  });

  it('fails when simulation React Doctor proof omits the report artifact hash', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          reactDoctorErrorCheck: {
            ...entry.simulationVisualQa.reactDoctorErrorCheck,
            reportSha256: undefined,
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining(['reactDoctorErrorCheck.reportSha256']),
      }),
    ]));
  });

  it('fails when simulation React Doctor report still contains owned diagnostics', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          reactDoctorErrorCheck: {
            ...entry.simulationVisualQa.reactDoctorErrorCheck,
            ownedDiagnostics: 1,
            selectedDiagnostics: 1,
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining([
          'reactDoctorErrorCheck.ownedDiagnostics=0',
          'reactDoctorErrorCheck.selectedDiagnostics=0',
        ]),
      }),
    ]));
  });

  it('fails when simulation runtime-noise evidence contains page errors or tracked Three warnings', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          runtimeNoise: {
            captureCommand: 'rtk npm run test:simulation-runtime-noise',
            report: 'artifacts/commercial-ui/simulation-runtime-noise-536/runtime-noise.json',
            reportSha256: 'runtime-noise-report-content',
            routesChecked: 7,
            pageErrors: [
              "Cannot read properties of null (reading 'classList')",
            ],
            trackedConsoleWarnings: [
              'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
              'THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead.',
            ],
          },
        } as CommercialSimulationVisualQaEvidence & Record<string, unknown>,
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining([
          'runtimeNoise.pageErrors=0',
          'runtimeNoise.trackedConsoleWarnings=0',
        ]),
      }),
    ]));
  });

  it('fails instead of throwing when simulation runtime-noise arrays are missing', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          runtimeNoise: {
            captureCommand: 'rtk npm run test:simulation-runtime-noise',
            report: 'artifacts/commercial-ui/simulation-runtime-noise-536/runtime-noise.json',
            reportSha256: 'runtime-noise-report-content',
            routesChecked: 7,
          },
        } as CommercialSimulationVisualQaEvidence & Record<string, unknown>,
      };
    });

    expect(() => evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }))).not.toThrow();

    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));
    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining([
          'runtimeNoise.pageErrors=0',
          'runtimeNoise.trackedConsoleWarnings=0',
        ]),
      }),
    ]));
  });

  it('fails when simulation QA does not prove resource-internal theme and scene parameter parity', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          resourceInternalTheme: {
            sharedPrimitives: false,
            panelThemeParity: false,
            localControlsThemeParity: true,
            restoreHandlesThemeParity: true,
            hardCodedPaletteFindings: 2,
          },
          sceneThemeParameters: {
            lightTemplate: true,
            darkTemplate: false,
            skyWaterGridFogThemeAware: false,
            labelHudContrastChecked: true,
            unchangedLightSceneInDarkTheme: true,
          },
        } as CommercialSimulationVisualQaEvidence & Record<string, unknown>,
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({
      visualEvidence: visualEvidence as CommercialVisualAcceptanceEvidence[],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining([
          'resourceInternalTheme.sharedPrimitives',
          'resourceInternalTheme.panelThemeParity',
          'resourceInternalTheme.hardCodedPaletteFindings=0',
          'sceneThemeParameters.darkTemplate',
          'sceneThemeParameters.skyWaterGridFogThemeAware',
          'sceneThemeParameters.unchangedLightSceneInDarkTheme=false',
        ]),
      }),
    ]));
  });

  it('fails when simulation handoff baseline omits source file hashes', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          handoffBaseline: {
            ...simulationHandoffBaselineFor(entry.href),
            designHandoffSha256: undefined,
            implementationMatrixSha256: undefined,
            conceptImageSha256: undefined,
            implementationScreenshotSha256: undefined,
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining([
          'handoffBaseline.designHandoffSha256',
          'handoffBaseline.implementationMatrixSha256',
          'handoffBaseline.conceptImageSha256',
          'handoffBaseline.implementationScreenshotSha256',
        ]),
      }),
    ]));
  });

  it('fails when simulation handoff baseline points a route at the wrong concept source', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          handoffBaseline: {
            ...simulationHandoffBaselineFor(entry.href),
            handoffSection: 'Learning mission semantics',
            conceptImage: handoffConcepts.missionStudio,
            evidenceHook: 'data-learning-mission-semantics="objective-task-chain-evidence-next-action"',
          },
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining([
          'handoffBaseline.handoffSection=Command-deck shell',
          `handoffBaseline.conceptImage=${handoffConcepts.commandDeck}`,
          'handoffBaseline.evidenceHook=data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
        ]),
      }),
    ]));
  });

  it('fails when simulation state evidence reuses the same artifact for different dock or local-tool states', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      const reusedScreenshot = 'artifacts/commercial-ui/simulation-experience-visual-qa/reused-destroyer-state.png';
      const reusedScreenshotSha256 = 'reused-destroyer-state-content';
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          viewports: entry.simulationVisualQa.viewports.map((viewport) => (
            viewport.theme === 'light'
            && viewport.width === 1440
            && viewport.navigationState === 'desktop-expanded'
              ? { ...viewport, screenshot: reusedScreenshot, screenshotSha256: reusedScreenshotSha256 }
              : viewport
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining([
          'theme=light:width=1440:stateArtifactUnique=desktop-expanded/collapsed/collapsed->desktop-expanded/collapsed/expanded',
        ]),
      }),
    ]));
  });

  it('fails when simulation navigation states reuse the same visual artifact', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationVisualQa) return entry;
      const expanded = entry.simulationVisualQa.viewports.find((viewport) => (
        viewport.theme === 'light'
        && viewport.width === 1440
        && viewport.navigationState === 'desktop-expanded'
      ));
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          viewports: entry.simulationVisualQa.viewports.map((viewport) => (
            viewport.theme === 'light'
            && viewport.width === 1440
            && viewport.navigationState === 'desktop-collapsed'
              ? {
                  ...viewport,
                  screenshot: expanded?.screenshot,
                  screenshotSha256: expanded?.screenshotSha256,
                }
              : viewport
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'theme=light:width=1440:stateArtifactUnique=desktop-expanded/collapsed/not-applicable->desktop-collapsed/collapsed/not-applicable',
        ]),
      }),
    ]));
  });

  it('fails when light and dark simulation evidence reuse the same visual artifact for the same state', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationVisualQa) return entry;
      const lightExpanded = entry.simulationVisualQa.viewports.find((viewport) => (
        viewport.theme === 'light'
        && viewport.width === 1440
        && viewport.navigationState === 'desktop-expanded'
      ));
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          viewports: entry.simulationVisualQa.viewports.map((viewport) => (
            viewport.theme === 'dark'
            && viewport.width === 1440
            && viewport.navigationState === 'desktop-expanded'
              ? {
                  ...viewport,
                  screenshot: lightExpanded?.screenshot,
                  screenshotSha256: lightExpanded?.screenshotSha256,
                }
              : viewport
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'width=1440:navigationState=desktop-expanded:dockState=collapsed:localToolState=not-applicable:themeArtifactUnique=light->dark',
        ]),
      }),
    ]));
  });

  it('fails when simulation evidence reuses a visual artifact across theme and navigation state', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/virtual-lab' || !entry.simulationVisualQa) return entry;
      const lightExpanded = entry.simulationVisualQa.viewports.find((viewport) => (
        viewport.theme === 'light'
        && viewport.width === 1440
        && viewport.navigationState === 'desktop-expanded'
      ));
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          viewports: entry.simulationVisualQa.viewports.map((viewport) => (
            viewport.theme === 'dark'
            && viewport.width === 1440
            && viewport.navigationState === 'desktop-collapsed'
              ? {
                  ...viewport,
                  screenshot: lightExpanded?.screenshot,
                  screenshotSha256: lightExpanded?.screenshotSha256,
                }
              : viewport
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/virtual-lab',
        evidence: expect.arrayContaining([
          'width=1440:visualArtifactUnique=light/desktop-expanded/collapsed/not-applicable->dark/desktop-collapsed/collapsed/not-applicable',
        ]),
      }),
    ]));
  });

  it('fails when simulation visual QA only provides a state artifact without a screenshot', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations/destroyer' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          viewports: entry.simulationVisualQa.viewports.map((viewport, index) => (
            index === 0
              ? {
                  ...viewport,
                  screenshot: undefined,
                  screenshotSha256: undefined,
                  artifact: 'artifacts/commercial-ui/simulation-experience-visual-qa/state-artifacts/artifact-only.json',
                  artifactSha256: 'artifact-only-state',
                }
              : viewport
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations/destroyer',
        evidence: expect.arrayContaining([
          'theme=light:width=1440:navigationState=desktop-expanded:dockState=collapsed:localToolState=collapsed:screenshot',
          'theme=light:width=1440:navigationState=desktop-expanded:dockState=collapsed:localToolState=collapsed:screenshotSha256',
        ]),
      }),
    ]));
  });

  it('fails when simulation screenshot dimensions do not match the viewport width', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          viewports: entry.simulationVisualQa.viewports.map((viewport) => (
            viewport.theme === 'dark'
            && viewport.width === 320
              ? {
                  ...viewport,
                  screenshotWidth: 390,
                  screenshotHeight: 900,
                }
              : viewport
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'theme=dark:width=320:navigationState=workspace-command-surface:dockState=collapsed:localToolState=not-applicable:screenshotWidth=320',
        ]),
      }),
    ]));
  });

  it('fails when simulation screenshot width cannot be parsed from the screenshot file', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          viewports: entry.simulationVisualQa.viewports.map((viewport) => (
            viewport.theme === 'light'
            && viewport.width === 320
              ? {
                  ...viewport,
                  screenshot: 'artifacts/commercial-ui/simulation-experience-visual-qa/non-png-placeholder.json',
                  screenshotSha256: 'non-png-placeholder',
                  screenshotWidth: undefined,
                  screenshotHeight: undefined,
                }
              : viewport
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'theme=light:width=320:navigationState=workspace-command-surface:dockState=collapsed:localToolState=not-applicable:screenshotWidth=320',
        ]),
      }),
    ]));
  });

  it('fails when simulation screenshot height is too small to prove first viewport coverage', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/simulations' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          viewports: entry.simulationVisualQa.viewports.map((viewport) => (
            viewport.theme === 'dark'
            && viewport.width === 320
              ? {
                  ...viewport,
                  screenshotWidth: 320,
                  screenshotHeight: 100,
                }
              : viewport
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/simulations',
        evidence: expect.arrayContaining([
          'theme=dark:width=320:navigationState=workspace-command-surface:dockState=collapsed:localToolState=not-applicable:screenshotHeight>=640',
        ]),
      }),
    ]));
  });

  it('fails when simulation viewport metadata does not match the route matrix', () => {
    const visualEvidence = completeVisualEvidenceWithSimulationQa().map((entry) => {
      if (entry.href !== '/virtual-lab' || !entry.simulationVisualQa) return entry;
      return {
        ...entry,
        simulationVisualQa: {
          ...entry.simulationVisualQa,
          viewports: entry.simulationVisualQa.viewports.map((viewport, index) => (
            index === 0
              ? {
                  ...viewport,
                  requestedRoute: '/simulations',
                  finalUrl: 'http://localhost:3000/virtual-lab',
                  role: 'teacher' as const,
                  authState: 'authenticated' as const,
                  routeFile: 'src/app/simulations/page.tsx',
                }
              : viewport
          )),
        },
      };
    });
    const result = evaluateCommercialUiGovernance(baseInput({ visualEvidence }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'simulation-visual-qa',
        rule: 'simulation-visual-qa.incomplete-evidence',
        path: '/virtual-lab',
        evidence: expect.arrayContaining([
          'theme=light:width=1440:navigationState=desktop-expanded:dockState=collapsed:localToolState=not-applicable:requestedRoute=/virtual-lab',
          'theme=light:width=1440:navigationState=desktop-expanded:dockState=collapsed:localToolState=not-applicable:finalUrl=/simulations',
          'theme=light:width=1440:navigationState=desktop-expanded:dockState=collapsed:localToolState=not-applicable:role=student',
          'theme=light:width=1440:navigationState=desktop-expanded:dockState=collapsed:localToolState=not-applicable:authState=public',
          'theme=light:width=1440:navigationState=desktop-expanded:dockState=collapsed:localToolState=not-applicable:routeFile=src/app/virtual-lab/page.tsx',
        ]),
      }),
    ]));
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

  it('accepts a complete interactive visual component acceptance artifact', () => {
    const artifact = completeInteractiveVisualAcceptanceArtifact();
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveVisualComponentArtifactsRequired: true,
      interactiveVisualComponentArtifacts: [artifact],
    }));

    expect(result.blockingViolations.filter((violation) => (
      violation.category === 'interactive-visual-component'
    ))).toEqual([]);
  });

  it('fails when interactive visual component changes require an acceptance artifact but none is provided', () => {
    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveVisualComponentArtifactsRequired: true,
      interactiveVisualComponentArtifacts: [],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-visual-component',
          rule: 'interactive-visual-component.missing-acceptance-artifact',
          path: 'interactive-visual-components',
          evidence: expect.arrayContaining(['interactiveVisualComponentArtifacts']),
        }),
      ]),
    );
  });

  it('fails complete-looking interactive visual artifacts when referenced paths are missing or stale', () => {
    const artifact = completeInteractiveVisualAcceptanceArtifact({
      artifactPaths: [
        {
          path: 'artifacts/interactive-learning/visual-gates/missing-browser-audit.json',
          exists: false,
          current: true,
          componentId: 'derivation-stage-fixture',
        },
        {
          path: 'artifacts/interactive-learning/visual-gates/stale-evidence-sample.json',
          exists: true,
          current: false,
          componentId: 'derivation-stage-fixture',
        },
      ],
    });

    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveVisualComponentArtifacts: [artifact],
    }));

    expect(result.passed).toBe(false);
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-visual-component',
          rule: 'interactive-visual-component.incomplete-acceptance-artifact',
          evidence: expect.arrayContaining([
            'artifacts/interactive-learning/visual-gates/missing-browser-audit.json:missing',
            'artifacts/interactive-learning/visual-gates/stale-evidence-sample.json:stale',
          ]),
        }),
      ]),
    );
  });

  it('fails incomplete interactive visual component state, role, theme, viewport, and evidence matrices', () => {
    const artifact = completeInteractiveVisualAcceptanceArtifact({
      browserAuditPath: undefined,
      teachingMapping: {
        lessonId: 'unit-2-1',
        stepId: 'step-03',
        learningGoalId: '',
        bopppsPhase: 'participatory-learning',
        interactiveContractStepId: 'contract-step-03',
      },
      screenshots: [
        {
          componentId: 'derivation-stage-fixture',
          route: '/interactive-learning/courses/unit-2-1-modeling-language/student/session-fixture',
          role: 'student',
          theme: 'light',
          viewport: 'desktop',
          state: 'student-released',
          path: 'artifacts/interactive-learning/visual-gates/derivation-stage-fixture-student-light-desktop-student-released.png',
          horizontalOverflow: false,
          teacherControlsCoverPrimaryStage: false,
          keyboardReachable: false,
          visibleFocus: true,
          teachingSemanticLabels: true,
        },
      ],
      browserAudit: {
        path: 'artifacts/interactive-learning/visual-gates/browser-audit.json',
        roles: ['student'],
        routes: ['/interactive-learning/courses/unit-2-1-modeling-language/student/session-fixture'],
        themes: ['light'],
        viewports: ['desktop'],
        noHorizontalOverflow: true,
        teacherControlsClearPrimaryStage: true,
      },
      evidenceSample: {
        eventType: 'visual_reveal',
        clientEventId: 'client-visual-stage-001',
        attemptKey: 'step-03:attempt-1',
        lessonKey: 'unit-2-1',
        stepId: 'step-03',
        moduleId: 'derivation-stage-fixture',
        componentKind: 'visual.derivationStage',
        componentId: 'derivation-stage-fixture',
        actorRole: 'student',
        clientEventAt: '2026-06-18T00:00:00.000Z',
        schemaVersion: 'interactive-visual-component-evidence-v1',
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
        payload: { revealIndex: 2 },
      },
    });

    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveVisualComponentArtifacts: [artifact],
    }));
    const interactiveEvidence = result.blockingViolations
      .filter((violation) => violation.category === 'interactive-visual-component')
      .flatMap((violation) => violation.evidence ?? []);

    expect(result.passed).toBe(false);
    expect(result.blockingViolations.map((violation) => violation.rule)).toContain(
      'interactive-visual-component.incomplete-acceptance-artifact',
    );
    expect(interactiveEvidence).toEqual(expect.arrayContaining([
      'component=derivation-stage-fixture',
      'browserAuditPath',
      'teachingMapping.learningGoalId',
      'teachingMapping.handoutAnchor|evidenceUnitId',
      'screenshot[0].keyboardReachable',
      'role=teacher',
      'theme=dark',
      'viewport=mobile',
      'viewport=projection',
      'state=student-unreleased',
      'state=student-submitted',
      'state=teacher-answer-reveal',
      'state=teacher-diagnostics',
      'state=teacher-reveal|teacher-derivation-in-progress',
      'browserAudit.role=teacher',
      'browserAudit.theme=dark',
      'browserAudit.viewport=mobile',
      'browserAudit.viewport=projection',
      'browserAudit.state=student-unreleased',
      'browserAudit.state=student-submitted',
      'browserAudit.state=teacher-answer-reveal',
      'browserAudit.state=teacher-diagnostics',
      'browserAudit.state=teacher-reveal|teacher-derivation-in-progress',
      'evidenceSample.sourceLogId',
      'evidenceSample.theme',
      'evidenceSample.viewport',
      'evidenceSample.classification',
      'evidenceSample.affectsTeacherDiagnostics',
      'evidenceSample.affectsAbilitySnapshots',
      'evidenceSample.affectsRecommendationInputs',
    ]));
  });

  it('fails component-specific states, duplicate screenshots, stale artifact paths, semantic leaks, and diagnostics exposure', () => {
    const sharedPath = 'artifacts/interactive-learning/visual-gates/reused.png';
    const artifact = completeInteractiveVisualAcceptanceArtifact({
      componentKind: 'visual.blockDiagram',
      artifactPaths: [
        { path: 'artifacts/interactive-learning/visual-gates/browser-audit.json', exists: false, current: false, componentId: 'other-component' },
      ],
      screenshots: completeInteractiveVisualAcceptanceArtifact().screenshots?.map((screenshot, index) => ({
        ...screenshot,
        path: index < 2 ? sharedPath : screenshot.path,
      })),
      diagnosticPolicy: {
        denominator: 'released-participants',
        dedupeKey: 'lessonKey:stepId:moduleId:attemptKey:clientEventId',
        attemptPolicy: 'latest-submission-and-all-reveals',
        resubmissionDisplay: 'latest-with-history-count',
        unreleasedStudentInclusion: 'exclude-from-coverage-denominator',
        freeTextRedaction: 'show-raw-free-text',
        access: 'student',
        labelsUseTeachingSemantics: false,
      },
      evidenceSample: {
        ...completeInteractiveVisualAcceptanceArtifact().evidenceSample,
        classification: ['RawLayer' as never],
        clientEventAt: '2026-06-18T00:00:02.000Z',
        serverRecordedAt: '2026-06-18T00:00:01.000Z',
      },
      visibleTextSamples: ['visual.blockDiagram renderer payload debug label', 'sourceLogId raw answerText'],
      blockingFindings: ['derivation-card-list-fallback'],
      stateRecoverability: {
        studentVisualState: true,
        submittedState: true,
        teacherRevealState: false,
        answerRevealState: true,
        diagnosticsAggregationState: true,
      },
    });

    const result = evaluateCommercialUiGovernance(baseInput({
      interactiveVisualComponentArtifacts: [artifact],
    }));
    const interactiveEvidence = result.blockingViolations
      .filter((violation) => violation.category === 'interactive-visual-component')
      .flatMap((violation) => violation.evidence ?? []);

    expect(result.passed).toBe(false);
    expect(interactiveEvidence).toEqual(expect.arrayContaining([
      'artifacts/interactive-learning/visual-gates/browser-audit.json:missing',
      'artifacts/interactive-learning/visual-gates/browser-audit.json:stale',
      'artifacts/interactive-learning/visual-gates/browser-audit.json:componentId',
      `${sharedPath}:duplicate`,
      'state=graph-constructed',
      'diagnosticPolicy.labelsUseTeachingSemantics',
      'diagnosticPolicy.freeTextRedaction=redact-by-default',
      'evidenceSample.classification=RawLayer',
      'evidenceSample.serverRecordedAt>=clientEventAt',
      'stateRecoverability.teacherRevealState',
    ]));
    expect(result.blockingViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'interactive-visual-component',
          rule: 'interactive-visual-component.diagnostics-exposure',
          evidence: expect.arrayContaining(['diagnosticPolicy.access=student']),
        }),
        expect.objectContaining({
          category: 'interactive-visual-component',
          rule: 'interactive-visual-component.semantic-leak',
          evidence: expect.arrayContaining(['visibleTextSamples[0]', 'visibleTextSamples[1]']),
        }),
        expect.objectContaining({
          category: 'interactive-visual-component',
          rule: 'interactive-visual-component.blocking-finding',
          evidence: expect.arrayContaining(['derivation-card-list-fallback']),
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
          ? { ...route, owningChange: '', navigationLayers: [], themeSupport: [] as never, frame: 'legacy-dashboard' as never }
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
          evidence: expect.arrayContaining(['owningChange', 'themeSupport=light', 'navigationLayers']),
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
          evidence: expect.arrayContaining(['width=320|390:navigationState=role-route-tabs']),
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
          evidence: expect.arrayContaining(['width=320|390:navigationState=mobile-drawer']),
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
          evidence: expect.arrayContaining(['width=320|390:navigationState=auth-callback-panel']),
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

  it('fails when visual QA manifest uses an unknown auth state', () => {
    const visualEvidence = completeVisualEvidence().map((entry) => {
      if (entry.href !== '/interactive-learning/control-workbench') return entry;
      return {
        ...entry,
        viewports: entry.viewports.map((viewport) => (
          viewport.width === 1440
            ? { ...viewport, authState: 'protected-redirect' as never }
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
          evidence: expect.arrayContaining(['authState']),
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
    expect(docs).toContain('`advisoryBaseline`');
    expect(docs).toContain('product-risk');
    expect(docs).toContain('mechanical-cleanup');
    expect(docs).toContain('tool-noise');
    expect(docs).toContain('deferred');
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

  it('keeps simulation QA matrix scoped and verifies nested visual artifacts in the governance script', () => {
    const scriptSource = readFileSync(join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');
    const governanceSource = readFileSync(join(process.cwd(), 'src/lib/commercial-ui-governance.ts'), 'utf8');
    const simulationCaptureScriptSource = readFileSync(
      join(process.cwd(), 'scripts/tests/capture-simulation-command-deck-qa.ts'),
      'utf8',
    );

    expect(scriptSource).toContain('SIMULATION_VISUAL_QA_ROUTE_MATRIX.filter');
    expect(scriptSource).toContain('simulationSharedDetailRouteAffected(route.href, files)');
    expect(scriptSource).toContain('requiresFullSimulationVisualQaMatrix(requiredVisualRoutes, files, visualEvidence)');
    expect(scriptSource).toContain('function simulationVisualQaEvidenceArtifactPaths');
    expect(scriptSource).toContain('referencedSimulationArtifacts.has(file)');
    expect(scriptSource).toContain("route.href.startsWith('/simulations/')");
    expect(scriptSource).toContain("route.href === '/interactive-learning/control-workbench'");
    expect(scriptSource).toContain("file === 'src/lib/platform-role-navigation.ts'");
    expect(scriptSource).toContain("file.startsWith('artifacts/commercial-ui/simulation-experience-visual-qa/')");
    expect(scriptSource).toContain("file.startsWith('artifacts/commercial-ui/simulation-command-deck-535/')");
    expect(scriptSource).toContain("file.startsWith('artifacts/commercial-ui/simulation-full-matrix-qa-537/')");
    expect(scriptSource).toContain('/^src\\/app\\/simulations\\/[^/]+\\/page\\.tsx$/.test(file)');
    expect(scriptSource).toContain('? SIMULATION_VISUAL_QA_ROUTE_MATRIX');
    expect(scriptSource).not.toContain('visualEvidence.some((entry) => entry.href === route.href && entry.simulationVisualQa)');
    expect(scriptSource).toContain('route.simulationFullMatrixVisualQa.entries.map');
    expect(scriptSource).toContain('route.simulationFullMatrixVisualQa.independentReview.report');
    expect(scriptSource).toContain('function simulationFullMatrixReviewReport');
    expect(scriptSource).toContain('Final result:\\s*PASS');
    expect(scriptSource).toContain('Unresolved blockers:\\s*(\\d+)');
    expect(scriptSource).toContain('currentStatus:');
    expect(scriptSource).toContain('currentUnresolvedBlockers:');
    expect(scriptSource).toContain("currentStatus: reviewReport?.status ?? 'failed'");
    expect(scriptSource).toContain('currentUnresolvedBlockers: reviewReport?.unresolvedBlockers ?? 1');
    expect(scriptSource).toContain('const reviewReport = simulationFullMatrixReviewReport');
    expect(scriptSource).not.toContain('reportSha256:\n\t              simulationFullMatrixReviewReport');
    expect(scriptSource).toContain('paths.add(fullMatrixVisualQa.independentReview.inputs.designHandoff)');
    expect(governanceSource).toContain('SIMULATION_FULL_MATRIX_VISUAL_QA_DETAIL_ROUTES');
    expect(governanceSource).toContain('SIMULATION_FULL_MATRIX_REQUIRED_CHECKLIST_KEYS');
    expect(governanceSource).toContain('for (const check of SIMULATION_FULL_MATRIX_REQUIRED_CHECKLIST_KEYS)');
    expect(governanceSource).toContain('simulationFullMatrixVisualQa.independentReview.status=passed');
    expect(governanceSource).toContain('simulationFullMatrixVisualQa.independentReview.status=current');
    expect(governanceSource).toContain('reviewImplementationScreenshotsMatch');
    expect(governanceSource).toContain('simulationFullMatrixVisualQa.entries=28');
    expect(governanceSource).toContain('simulationFullMatrixVisualQa.unexpectedRoute=');
    expect(governanceSource).toContain('simulationFullMatrixVisualQa.cruiseComparison.comparedRoutes.destroyer');
    expect(governanceSource).toContain('inSceneBackControlAbsent');
    expect(scriptSource).toContain('route.simulationVisualQa.viewports.map');
    expect(scriptSource).toContain('const screenshot = simulationViewportArtifact(viewport.screenshot)');
    expect(scriptSource).toContain('screenshot: viewport.screenshot');
    expect(scriptSource).toContain('screenshotSha256: screenshot?.sha256');
    expect(scriptSource).toContain('screenshotWidth: screenshot?.width');
    expect(scriptSource).toContain('route.simulationVisualQa.commandDeckGeometry.viewports.map');
    expect(scriptSource).toContain('currentSourceSha256: commandDeckGeometryCurrentSourceSha256(simulationRoute?.routeFile ?? \'\')');
    expect(scriptSource).toContain('function commandDeckGeometrySourcePaths(routeFile: string)');
    expect(scriptSource).toContain("'src/app/simulations/_components/simulation-shell.tsx'");
    expect(scriptSource).toContain("'src/resources/simulations/components/simulation-ui.tsx'");
    expect(scriptSource).toContain("'src/resources/simulations/components/camera-view-switcher.tsx'");
    expect(scriptSource).toContain("'scripts/tests/capture-simulation-command-deck-qa.ts'");
    expect(governanceSource).toContain('bottomToolsWithinViewport');
    expect(governanceSource).toContain('themeApplied');
    expect(governanceSource).toContain('bottomToolSegmentRoles');
    expect(governanceSource).toContain("['view-switcher', 'grid-toggle', 'speed-controls']");
    expect(governanceSource).toContain('bottomToolSegmentRoles.${role}');
    expect(simulationCaptureScriptSource).toContain('[data-simulation-local-bottom-tool-segment]');
    expect(simulationCaptureScriptSource).toContain('bottomToolSegmentRoles');
    expect(simulationCaptureScriptSource).toContain('waitForThemeApplied');
    expect(simulationCaptureScriptSource).toContain('inspectCommandDeck(page, theme)');
    expect(simulationCaptureScriptSource).toContain('root.classList.contains(expectedTheme) && root.style.colorScheme === expectedTheme');
    expect(simulationCaptureScriptSource).toContain('themeApplied: metrics.themeApplied');
    expect(simulationCaptureScriptSource).toContain('finalUrl: page.url()');
    expect(simulationCaptureScriptSource).toContain('finalUrl: viewport.finalUrl');
    expect(simulationCaptureScriptSource).toContain('function buildSimulationFullMatrixVisualQa');
    expect(simulationCaptureScriptSource).toContain('fullMatrixReviewReport');
    expect(simulationCaptureScriptSource).toContain('Final result: PASS');
    expect(simulationCaptureScriptSource).toContain('Unresolved blockers: 0');
    expect(simulationCaptureScriptSource).not.toContain('[data-simulation-local-bottom-toolbar], [data-simulation-local-hint-strip]');
    expect(scriptSource).toContain('simulationVisualQa.commandDeckGeometry?.viewports');
    expect(scriptSource).toContain('function simulationReactDoctorReport');
    expect(scriptSource).toContain('reportSha256: reactDoctorReport?.sha256');
    expect(scriptSource).toContain('ownedDiagnostics: reactDoctorReport?.ownedDiagnostics');
    expect(scriptSource).toContain('selectedDiagnostics: reactDoctorReport?.selectedDiagnostics');
    expect(scriptSource).toContain('function simulationRuntimeNoiseReport');
    expect(scriptSource).toContain('const runtimeNoiseReport = simulationRuntimeNoiseReport');
    expect(scriptSource).toContain('reportSha256: runtimeNoiseReport?.sha256');
    expect(scriptSource).toContain('if (!Array.isArray(entries)) return undefined;');
    expect(scriptSource).toContain('pageErrors: runtimeNoiseReport');
    expect(scriptSource).toContain('? runtimeNoiseReport.pageErrors');
    expect(scriptSource).toContain('trackedConsoleWarnings:');
    expect(scriptSource).toContain('? runtimeNoiseReport.trackedConsoleWarnings');
    expect(scriptSource).toContain('designHandoffSha256:');
    expect(scriptSource).toContain('route.simulationVisualQa.handoffBaseline.designHandoff');
    expect(scriptSource).toContain('implementationMatrixSha256:');
    expect(scriptSource).toContain('conceptImageSha256:');
    expect(scriptSource).toContain('route.simulationVisualQa.handoffBaseline.conceptImage');
    expect(scriptSource).toContain('implementationScreenshotSha256:');
    expect(scriptSource).toContain('paths.add(simulationVisualQa.handoffBaseline.designHandoff)');
    expect(scriptSource).toContain('paths.add(simulationVisualQa.handoffBaseline.implementationMatrix)');
  });

  it('keeps knowledge workspace product QA local-tool and mobile overlap checks viewport-specific', () => {
    const scriptSource = readFileSync(join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');
    const captureScriptSource = readFileSync(
      join(process.cwd(), 'scripts/tests/capture-knowledge-workspace-product-qa.ts'),
      'utf8',
    );
    const globalAiButtonSource = readFileSync(
      join(process.cwd(), 'src/components/ai/global-ai-button.tsx'),
      'utf8',
    );
    const globalAiSidebarSource = readFileSync(
      join(process.cwd(), 'src/components/ai/global-ai-sidebar.tsx'),
      'utf8',
    );
    const globalsSource = readFileSync(
      join(process.cwd(), 'src/app/globals.css'),
      'utf8',
    );

    expect(scriptSource).toContain('const viewportWidth = numberFromEvidence(viewport.width);');
    expect(scriptSource).toContain('const isMobileViewport = viewportWidth === 320;');
    expect(scriptSource).toContain('const isTabletBreakpointViewport = [1024, 1100, 1279].includes(viewportWidth ?? 0);');
    expect(scriptSource).toContain('`${name}:invalid-tablet-screenshot-width`');
    expect(scriptSource).toContain('const activeLocalToolMarker = isMobileViewport ? markers.mobileActiveTool : markers.desktopActiveTool;');
    expect(scriptSource).toContain('const visibleLocalToolPanelState = isMobileViewport ? markers.mobileToolState : markers.desktopToolState;');
    expect(scriptSource).toContain("visibleLocalToolPanelState === 'closed' || (name.includes('konling') && visibleLocalToolPanelState === null)");
    expect(scriptSource).toContain("activeLocalToolMarker === state.localToolState && visibleLocalToolPanelState === 'open'");
    expect(scriptSource).not.toContain("markers.desktopToolState === 'open'");
    expect(scriptSource).not.toContain("markers.mobileToolState === 'open'");
    expect(scriptSource).toContain("method ?? '') === 'pointer-drag'");
    expect(scriptSource).not.toContain('pinControl).pinned === true');
    expect(captureScriptSource).toContain('__knowledgeGraphProductQaSelectedNodeDragPoints');
    expect(captureScriptSource).toContain('selectedNodeHoverDragPointCandidates');
    expect(captureScriptSource).toContain('hoverText.includes(expectedLabel)');
    expect(captureScriptSource).not.toContain('hoveredCanvasNodeDragPointCandidates');
    expect(captureScriptSource).toContain('async function dragCanvasNodeUntilPinned(page: Page, expectedNodeId: string)');
    expect(captureScriptSource).toContain('pinnedLayoutSignature.includes(expectedNodeId)');
    expect(captureScriptSource).toContain("const selectedNodeId = process.env.KNOWLEDGE_QA_SELECTED_NODE_ID ?? '积分环节_2_11005';");
    expect(captureScriptSource).toContain("const dragNodeId = process.env.KNOWLEDGE_QA_DRAG_NODE_ID ?? 'z反变换_7_7959c077';");
    expect(captureScriptSource).toContain('dragCanvasNodeUntilPinned(page, dragNodeId)');
    expect(scriptSource).toContain('objectRecord(objectRecord(state.interactionEvidence).drag).selectedNodeId === state.selectedNode');
    expect(scriptSource).toContain("pinnedLayoutSignature).includes(String(state.selectedNode ?? ''))");
    expect(captureScriptSource).toContain("document.querySelector('[data-knowledge-local-panel=\"node-hover-preview\"]')");
    expect(captureScriptSource).not.toContain('__knowledgeGraphProductQaDragSelectedNode');
    expect(captureScriptSource).not.toContain("method: 'drag-end-handler'");
    expect(scriptSource).toContain('expandedDockOverlapsMobileTools');
    expect(scriptSource).toContain('`${name}:expanded-dock-overlaps-mobile-tools`');
    expect(scriptSource).toContain('overlaps.dockOverlapsInspector');
    expect(scriptSource).toContain('`${name}:dock-overlaps-inspector`');
    expect(captureScriptSource).toContain('async function captureFocusEvidence(browser: Browser)');
    expect(captureScriptSource).toContain('const focusEvidence = await captureFocusEvidence(browser);');
    expect(captureScriptSource).toContain('focusEvidence,');
    expect(captureScriptSource).toContain("'src/features/knowledge/graph/knowledge-graph-2d.tsx'");
    expect(captureScriptSource).toContain("'src/app/knowledge/page.tsx'");
    expect(captureScriptSource).toContain("'src/features/knowledge/graph/visual-config.ts'");
    expect(captureScriptSource).toContain("'src/components/ai/global-ai-button.tsx'");
    expect(captureScriptSource).toContain("'src/components/ai/global-ai-sidebar.tsx'");
    expect(captureScriptSource).toContain("'src/components/shared/page-floating-controls.tsx'");
    expect(captureScriptSource).toContain("'src/app/globals.css'");
    expect(captureScriptSource).toContain('__ACT_KNOWLEDGE_PRODUCT_QA__');
    expect(globalAiButtonSource).toContain("process.env.NODE_ENV !== 'production'");
    expect(globalAiButtonSource).toContain('(window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__ === true');
    expect(globalAiButtonSource).toContain("window.localStorage.getItem('act:knowledge-product-qa') === 'true'");
    expect(globalAiButtonSource).toContain("new URLSearchParams(window.location.search).get('qa') === 'knowledge-product'");
    expect(globalAiSidebarSource).toContain('openerElementRef');
    expect(globalAiSidebarSource).toContain('wasOpenRef');
    expect(globalAiSidebarSource).toContain('opener.focus();');
    expect(globalAiSidebarSource).toContain('[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]');
    expect(globalAiSidebarSource).toContain('knowledgeInspectorAvoidanceActive');
    expect(globalAiSidebarSource).toContain('data-konling-inspector-avoidance');
    expect(globalAiSidebarSource).toContain('data-knowledge-mobile-inspector-policy');
    expect(globalAiSidebarSource).toContain('当前选中的知识节点已进入控灵上下文。');
    expect(globalAiSidebarSource).toContain('请求的知识节点暂不可用，控灵将仅使用当前筛选与视图状态。');
    expect(globalAiSidebarSource).not.toContain('当前节点: ${nodeId}');
    expect(globalAiSidebarSource).not.toContain('请求节点 ${nodeId} 暂不可用。');
    expect(globalAiSidebarSource).toContain("document.querySelector('[data-knowledge-inspector=\"floating-right-edge\"]')");
    expect(globalAiSidebarSource).toContain("right: 'calc(1.5rem + clamp(22.5rem, 30vw, 28.75rem))'");
    expect(globalsSource).toContain('[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]');
    expect(globalsSource).toContain('height: calc(100vh - 8rem) !important;');
    expect(globalsSource).toContain('[data-knowledge-mobile-inspector-policy="suspend"]');
    expect(globalsSource).toContain('display: none !important;');
    expect(captureScriptSource).toContain("'desktop-local-tools-directory-dark'");
    expect(captureScriptSource).toContain("'desktop-local-tools-filter-dark'");
    expect(captureScriptSource).toContain("'desktop-local-tools-view-dark'");
    expect(scriptSource).toContain("'desktop-local-tools-legend-dark'");
    expect(scriptSource).toContain("'desktop-local-tools-directory-dark'");
    expect(scriptSource).toContain("'desktop-local-tools-filter-dark'");
    expect(scriptSource).toContain("'desktop-local-tools-view-dark'");
    expect(captureScriptSource).toContain("'desktop-wide-default-dark'");
    expect(captureScriptSource).toContain("'desktop-wide-inspector-tools-dark'");
    expect(captureScriptSource).toContain("'desktop-selected-page-tools-menu-dark'");
    expect(captureScriptSource).toContain('async function openPageToolMenu(page: Page)');
    expect(captureScriptSource).toContain("'tablet-1100-default-dark'");
    expect(captureScriptSource).toContain("'tablet-1100-local-tools-filter-dark'");
    expect(captureScriptSource).toContain("'tablet-1100-selected-inspector-dark'");
    expect(captureScriptSource).toContain("'tablet-1024-inspector-tools-konling-dark'");
    expect(captureScriptSource).toContain("'tablet-1100-inspector-tools-konling-dark'");
    expect(captureScriptSource).toContain("'tablet-1279-inspector-tools-konling-dark'");
    expect(scriptSource).toContain("if (name.startsWith('tablet-')) return 'tablet-1100-default-dark';");
    expect(scriptSource).toContain("'tablet-1100-local-tools-filter-dark'");
    expect(scriptSource).toContain("'tablet-1100-selected-inspector-dark'");
    expect(scriptSource).toContain("'tablet-1024-inspector-tools-konling-dark'");
    expect(scriptSource).toContain("'tablet-1100-inspector-tools-konling-dark'");
    expect(scriptSource).toContain("'tablet-1279-inspector-tools-konling-dark'");
    expect(captureScriptSource).toContain('const canvasRect = rectFor(canvas);');
    expect(captureScriptSource).toContain('canvas: canvasRect');
    expect(captureScriptSource).toContain("openDesktopTool(page, 'chapter-directory')");
    expect(captureScriptSource).toContain('button[aria-label="呼出控灵 AI助手"]');
    expect(captureScriptSource).toContain('[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]');
    expect(captureScriptSource).toContain('konlingAssistantSurface');
    expect(captureScriptSource).toContain('konlingInspectorAvoidance');
    expect(captureScriptSource).toContain('konlingMobileInspectorPolicy');
    expect(captureScriptSource).toContain('dockInspectorAvoidance');
    expect(captureScriptSource).toContain('data-konling-knowledge-context');
    expect(captureScriptSource).toContain("await page.waitForSelector('[data-knowledge-inspector=\"floating-right-edge\"]'");
    expect(captureScriptSource).not.toMatch(
      /name: 'desktop-stress-expanded-tool-inspector-konling-dark'[\s\S]*?await closeInspectorIfPresent\(page\);[\s\S]*?name: 'mobile-320-local-tools-dark'/,
    );
    expect(scriptSource).toContain('expectedKonlingContext');
    expect(scriptSource).toContain('markers.konlingKnowledgeContext === expectedKonlingContext');
    expect(scriptSource).toContain('`${name}:inspector-rect-missing`');
    expect(scriptSource).toContain('`${name}:inspector-overlaps-app-shell-header`');
    expect(scriptSource).toContain('inspectorTop >= 88');
    expect(scriptSource).toContain('`${name}:inspector-overlaps-tablet-mobile-navigation`');
    expect(scriptSource).toContain('inspectorTop >= 314');
    expect(scriptSource).toContain('`${name}:konling-inspector-avoidance-missing`');
    expect(scriptSource).toContain('`${name}:tablet-local-tool-panel-not-suspended-while-konling-open`');
    expect(scriptSource).toContain('`${name}:expanded-dock-overlaps-tools`');
    expect(scriptSource).toContain("'desktop-selected-page-tools-menu-dark'");
    expect(scriptSource).toContain('`${name}:dock-inspector-avoidance-missing`');
    expect(scriptSource).toContain('`${name}:dock-overlaps-inspector`');
    expect(globalsSource).toContain('@media (min-width: 1024px) and (max-width: 1279px)');
    expect(globalsSource).toContain('body:has([data-knowledge-inspector="floating-right-edge"]) [data-page-floating-controls]');
    expect(globalsSource).toContain('[data-knowledge-desktop-command-system] {\n      display: none !important;');
    expect(readFileSync(join(process.cwd(), 'src/components/shared/page-floating-controls.tsx'), 'utf8')).toContain('knowledgeInspectorAvoidanceActive');
    expect(scriptSource).toContain("konlingRuntimeSource.includes(\"const contextNodeId = hint?.status === 'degraded'\")");
    expect(scriptSource).toContain('const productQaSourcePaths = [');
    expect(scriptSource).toContain('globalAiButtonSourcePath');
    expect(scriptSource).toContain('globalAiSidebarSourcePath');
    expect(scriptSource).toContain('globalAiProviderSourcePath');
    expect(scriptSource).toContain('graph2dSourcePath');
    expect(scriptSource).toContain('floatingControlsSourcePath');
    expect(scriptSource).toContain('captureScriptSourcePath');
    expect(scriptSource).toContain('governanceScriptSourcePath');
    expect(scriptSource).toContain('stringRecordsEqual(visualReviewSourceSha256, currentSourceSha256)');
    expect(scriptSource).toContain('`${sourcePath}:sha-missing`');
    expect(scriptSource).toContain('Object.entries(sourceHashes).map');
    expect(captureScriptSource).toContain("'scripts/tests/capture-knowledge-workspace-product-qa.ts'");
    expect(captureScriptSource).toContain("'scripts/tests/test-commercial-ui-governance.ts'");
    expect(captureScriptSource).toContain("'src/components/providers/global-ai-provider.tsx'");
    expect(scriptSource).toContain("['desktop-local-tools-directory-dark', 'dark', 1440, 'collapsed', 'collapsed']");
    expect(scriptSource).toContain("['mobile-320-inspector-konling-stress-dark', 'dark', 320, 'mobile', 'expanded']");
    expect(scriptSource).toContain("markers.konlingAssistantSurface === 'global-sidebar'");
    expect(scriptSource).toContain('mobile-inspector-not-suspended');
    expect(scriptSource).toContain('mobile-inspector-policy-missing');
    expect(captureScriptSource).toContain('openedFocusManaged');
    expect(captureScriptSource).toContain('keyboardReachable');
    expect(captureScriptSource).toContain('panelClosed && await activeElementWithin(page, returnSelector)');
    expect(captureScriptSource).toContain("'[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]'");
    expect(captureScriptSource).not.toContain('returnSelector?: string');
    expect(captureScriptSource).not.toContain(': panelClosed;');
    expect(captureScriptSource).toContain("'[data-knowledge-canvas-primary=\"true\"]'");
    expect(captureScriptSource).not.toContain("{ target: 'desktop-local-tools', openedFocusManaged: true");
    expect(captureScriptSource).toContain('function readExistingIndependentVisualReview');
    expect(captureScriptSource).toContain("record.finalResult !== 'passed'");
    expect(captureScriptSource).toContain('blockingFindings.length !== 0');
    expect(captureScriptSource).toContain('stringRecordsMatch(reviewedStateSha256, currentStateSha256)');
    expect(captureScriptSource).toContain('stringRecordsMatch(reviewedSourceSha256, currentSourceSha256)');
    expect(captureScriptSource).toContain('readExistingIndependentVisualReview(stateMatrix, currentSourceSha256)');
    expect(captureScriptSource).not.toContain('parsed.stateMatrix');
    expect(captureScriptSource).not.toContain('parsed.currentSourceSha256');
    expect(scriptSource).toContain('visual-review:stale-screenshot-review');
    expect(scriptSource).toContain('visual-review:stale-source-review');
    expect(scriptSource).toContain("'tabletBreakpoint'");
    expect(scriptSource).toContain("'canvasGeometry'");
  });

  it('keeps general commercial source palette governance limited to added lines', () => {
    const scriptSource = readFileSync(join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');
    const scanSource = scriptSource.slice(
      scriptSource.indexOf('function buildSourceViolations'),
      scriptSource.indexOf('function buildSimulationResourcePaletteViolations'),
    );

    expect(scanSource).toContain("lineEvidence(source, /#[0-9a-fA-F]{3,8}\\b/g, 'raw-color', file)");
    expect(scanSource).toContain("lineEvidence(source, /\\brgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,/g, 'raw-rgba', file)");
    expect(scanSource).toContain("'tailwind-color-family',\n      file");
  });

  it('keeps the adaptive path center default student branch free of internal status strings', () => {
    const pageSource = readFileSync(join(process.cwd(), 'src/app/assessment/adaptive-practice/page.tsx'), 'utf8');
    const captureScriptSource = readFileSync(join(process.cwd(), 'scripts/tests/capture-adaptive-path-product-qa.ts'), 'utf8');

    expect(pageSource).toContain('自适应学习路径中心');
    expect(pageSource).toContain('生成学习路径');
    expect(pageSource).toContain('告诉控灵你想达成什么');
    expect(pageSource).toContain('data-adaptive-path-comparison-state="information-grid"');
    expect(pageSource).toContain('data-learning-path-options-layout="route-modules"');
    expect(captureScriptSource).toContain('assertPathComparisonSignals');
    expect(captureScriptSource).toContain('routeModulesAttached=false');
    expect(captureScriptSource).toMatch(/name: 'path-comparison-desktop-light',[\s\S]*?query: '\?demo=1&goal=control-correction&intent=path-selection'/);
    expect(captureScriptSource).toMatch(/name: 'path-comparison-mobile-dark',[\s\S]*?query: '\?demo=1&goal=control-correction&intent=path-selection'/);
    expect(pageSource).toContain("label: '控灵助手'");
    expect(pageSource).toContain("label: '路径管理'");
    const studentVisibleSource = pageSource.replaceAll('data-learner-record-missing-source', '');
    expect(studentVisibleSource).not.toMatch(/自适应跨域题库|Control Correction Center|Readiness Gate|missing-[a-z-]+|terminal-validation-unavailable|strategy unavailable|no-path|low-evidence/);
  });

  it('keeps simulation resource palette governance on full-file scan after migration', () => {
    const scriptSource = readFileSync(join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');
    const scanSource = scriptSource.slice(
      scriptSource.indexOf('function buildSimulationResourcePaletteViolations'),
      scriptSource.indexOf('function buildShellInventory'),
    );

    expect(scriptSource).toContain("file !== 'src/resources/simulations/components/simulation-theme.ts'");
    expect(scriptSource).toContain("src/resources/simulations/components/camera-view-switcher.tsx");
    expect(scriptSource).toContain("src/resources/simulations/components/model-loading-placeholder.tsx");
    expect(scriptSource).toContain("/^src\\/resources\\/simulations\\/simulations\\/[^/]+-simulation\\.tsx$/.test(file)");
    expect(scanSource).toContain("lineEvidence(source, /#[0-9a-fA-F]{3,8}\\b/g, 'raw-color')");
    expect(scanSource).toContain("lineEvidence(source, /\\brgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,/g, 'raw-rgba')");
    expect(scanSource).toMatch(/'tailwind-color-family',\s*\);/);
    expect(scanSource).not.toContain("'raw-color', file");
    expect(scanSource).not.toContain("'raw-rgba', file");
    expect(scanSource).not.toContain("'tailwind-color-family',\n      file");
  });

  it('keeps migrated simulation resources free of local palette literals outside the theme contract', () => {
    const migratedFiles = [
      'src/resources/simulations/components/camera-view-switcher.tsx',
      'src/resources/simulations/components/model-loading-placeholder.tsx',
      'src/resources/simulations/components/simulation-ui.tsx',
      'src/resources/simulations/environment/maritime-environment.tsx',
      'src/resources/simulations/simulations/lng-simulation.tsx',
      'src/resources/simulations/simulations/container-simulation.tsx',
      'src/resources/simulations/simulations/cruise-simulation.tsx',
      'src/resources/simulations/simulations/destroyer-simulation.tsx',
      'src/resources/simulations/simulations/dredger-simulation.tsx',
      'src/resources/simulations/simulations/drilling-simulation.tsx',
      'src/resources/simulations/simulations/icebreaker-simulation.tsx',
    ];
    const forbiddenPalette = /#[0-9a-fA-F]{3,8}\b|\brgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,|\b(?:bg|text|border|shadow|ring|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d{2,3})?(?:\/\d{1,3})?\b/;

    for (const file of migratedFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(forbiddenPalette);
    }

    const themeContract = readFileSync(
      join(process.cwd(), 'src/resources/simulations/components/simulation-theme.ts'),
      'utf8',
    );
    expect(themeContract).toContain('simulationScenePalette');
    expect(themeContract).toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('requires final interactive learning product QA when referenced evidence artifacts change', () => {
    const scriptSource = readFileSync(join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');

    expect(scriptSource).toContain('function interactiveLearningProductQaEvidenceArtifactPaths');
    expect(scriptSource).toContain('INTERACTIVE_LEARNING_PRODUCT_QA_EVIDENCE_PATH');
    expect(scriptSource).toContain('addPath(evidence.designHandoff)');
    expect(scriptSource).toContain('addPath(evidence.handoffMatrix)');
    expect(scriptSource).toContain('for (const conceptImage of evidence.conceptImages) addPath(conceptImage)');
    expect(scriptSource).toContain('if (isPlainObject(route)) addPath(route.sourceConcept)');
    expect(scriptSource).toContain('if (isPlainObject(report)) addPath(report.report)');
    expect(scriptSource).toContain('addPath(evidence.independentVisualReview.report)');
    expect(scriptSource).toContain('referencedProductQaArtifacts.has(file)');
    expect(scriptSource).toContain('INTERACTIVE_LEARNING_PRODUCT_QA_SOURCE_PREFIXES');
    expect(scriptSource).toContain("'src/app/interactive-learning/'");
    expect(scriptSource).toContain("'src/features/interactive/'");
    expect(scriptSource).toContain("'src/features/lesson-engine/'");
    expect(scriptSource).toContain('INTERACTIVE_LEARNING_PRODUCT_QA_SOURCE_PREFIXES.some((prefix) => file.startsWith(prefix))');
    expect(scriptSource).toContain('function latestInteractiveLearningProductQaSourceCommits');
    expect(scriptSource).toContain("git(['log', '-1', '--format=%H', '--', file])");
    expect(scriptSource).toContain('latestCommitForPath(INTERACTIVE_LEARNING_PRODUCT_QA_EVIDENCE_PATH)');
    expect(scriptSource).toContain("execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant]");
    expect(scriptSource).toContain('latestSourceCommits.every((sourceCommit)');
    expect(scriptSource).toContain('interactiveLearningProductQaEvidenceCoversLatestSource(files)');
  });

  it('keeps interactive visual acceptance script triggers and real artifact path checks wired', () => {
    const scriptSource = readFileSync(join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');

    expect(scriptSource).toContain('activity-renderers');
    expect(scriptSource).toContain('static-surface-3d.*');
    expect(scriptSource).toContain('layout-renderer');
    expect(scriptSource).toContain('.*evidence.*');
    expect(scriptSource).toContain('interactiveVisualArtifactPathChecks');
    expect(scriptSource).toContain('existsSync(path.join(repoRoot, artifactPath))');
  });

  it('rejects stale final interactive learning product QA evidence across source commit topology', () => {
    const evidencePath = 'artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/govern-interactive-learning-product-qa/final-product-qa.json';
    const sourceA = 'src/features/interactive/source-a.ts';
    const sourceB = 'src/features/lesson-engine/source-b.ts';
    const sourceC = 'src/app/interactive-learning/source-c.ts';
    const sourcePrefixes = ['src/features/interactive/', 'src/features/lesson-engine/'];

    const linearRepo = initTempGitRepo('interactive-product-qa-linear-');
    commitTempFile(linearRepo, sourceA, 'export const sourceA = 1;\n', 'source a initial');
    commitTempFile(linearRepo, evidencePath, '{"sourceCommit":"after-source-a"}\n', 'qa after source a');
    commitTempFile(linearRepo, sourceA, 'export const sourceA = 2;\n', 'source a after qa');

    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      linearRepo,
      [sourceA, evidencePath],
      evidencePath,
      sourcePrefixes,
    )).toBe(false);

    commitTempFile(linearRepo, evidencePath, '{"sourceCommit":"after-source-a-refresh"}\n', 'qa after source a refresh');
    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      linearRepo,
      [sourceA, evidencePath],
      evidencePath,
      sourcePrefixes,
    )).toBe(true);

    const nonlinearRepo = initTempGitRepo('interactive-product-qa-nonlinear-');
    const sourceABase = commitTempFile(nonlinearRepo, sourceA, 'export const sourceA = 1;\n', 'source a initial');
    commitTempFile(nonlinearRepo, evidencePath, '{"sourceCommit":"after-source-a"}\n', 'qa after source a');
    runTempGit(nonlinearRepo, ['checkout', '-b', 'source-b-side', sourceABase]);
    commitTempFile(nonlinearRepo, sourceB, 'export const sourceB = 1;\n', 'source b side');
    runTempGit(nonlinearRepo, ['checkout', 'main']);
    runTempGit(nonlinearRepo, ['merge', '--no-ff', 'source-b-side', '-m', 'merge source b side']);

    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      nonlinearRepo,
      [sourceA, sourceB, evidencePath],
      evidencePath,
      sourcePrefixes,
    )).toBe(false);

    commitTempFile(nonlinearRepo, evidencePath, '{"sourceCommit":"after-merge-refresh"}\n', 'qa after merge refresh');
    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      nonlinearRepo,
      [sourceA, sourceB, evidencePath],
      evidencePath,
      sourcePrefixes,
    )).toBe(true);

    const dirtyRepo = initTempGitRepo('interactive-product-qa-dirty-');
    commitTempFile(dirtyRepo, sourceA, 'export const sourceA = 1;\n', 'source a initial');
    commitTempFile(dirtyRepo, evidencePath, '{"sourceCommit":"after-source-a"}\n', 'qa after source a');
    writeFileSync(join(dirtyRepo, sourceA), 'export const sourceA = 2;\n');
    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      dirtyRepo,
      tempChangedFiles(dirtyRepo),
      evidencePath,
      sourcePrefixes,
    )).toBe(false);
    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      dirtyRepo,
      [sourceA, evidencePath],
      evidencePath,
      sourcePrefixes,
    )).toBe(false);

    runTempGit(dirtyRepo, ['add', sourceA]);
    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      dirtyRepo,
      tempChangedFiles(dirtyRepo),
      evidencePath,
      sourcePrefixes,
    )).toBe(false);

    writeFileSync(join(dirtyRepo, evidencePath), '{"sourceCommit":"dirty-source-a-refresh"}\n');
    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      dirtyRepo,
      tempChangedFiles(dirtyRepo),
      evidencePath,
      sourcePrefixes,
    )).toBe(true);

    runTempGit(dirtyRepo, ['add', sourceA, evidencePath]);
    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      dirtyRepo,
      tempChangedFiles(dirtyRepo),
      evidencePath,
      sourcePrefixes,
    )).toBe(true);
    runTempGit(dirtyRepo, ['commit', '-m', 'qa after dirty source refresh']);

    const untrackedPath = join(dirtyRepo, sourceC);
    mkdirSync(dirname(untrackedPath), { recursive: true });
    writeFileSync(untrackedPath, 'export const sourceC = 1;\n');
    expect(tempInteractiveLearningProductQaEvidenceCoversSource(
      dirtyRepo,
      tempChangedFiles(dirtyRepo),
      evidencePath,
      [...sourcePrefixes, 'src/app/interactive-learning/'],
    )).toBe(false);
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
      { filePath: 'src/app/form-action.tsx', severity: 'warning', category: 'Accessibility', rule: 'button-has-type', title: 'Button type missing', line: 7, column: 1 },
      { filePath: 'src/components/unused-card.tsx', severity: 'warning', category: 'Maintainability', rule: 'unused-export', title: 'Unused export', line: 8, column: 1 },
      { filePath: 'src/resources/simulations/ship-scene.tsx', severity: 'warning', category: 'Compatibility', rule: 'no-unknown-property', title: 'R3F prop', line: 9, column: 1 },
      { filePath: 'src/app/raw-dom.tsx', severity: 'warning', category: 'Compatibility', rule: 'no-unknown-property', title: 'DOM prop', line: 10, column: 1 },
      { filePath: 'src/app/SceneCard.tsx', severity: 'warning', category: 'Compatibility', rule: 'no-unknown-property', title: 'DOM scene card prop', line: 11, column: 1 },
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
      return {
        result,
        report: JSON.parse(result.stdout) as {
          totals: { selectedDiagnostics: number; fixtureNoiseDiagnostics: number };
          summary: {
            byOwnedSurface: Record<string, number>;
            byCategory: Record<string, number>;
            byFile: Record<string, number>;
          };
          advisoryBaseline?: {
            buckets: Record<string, { total: number; rules: Record<string, number> }>;
            ruleClassifications: Record<string, string>;
            r3fThreeNoUnknownProperty: {
              toolNoiseCandidateFiles: string[];
              domRiskFiles: string[];
            };
          };
        },
      };
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
    expect(warnings.report.totals.selectedDiagnostics).toBe(1809);
    expect(warnings.report.totals.fixtureNoiseDiagnostics).toBe(2);
    expect(warnings.report.summary.byOwnedSurface).toMatchObject({
      app: 3,
      components: 1,
      docs: 1,
      hooks: 1801,
      resources: 2,
    });
    expect(warnings.report.summary.byCategory.Security).toBe(2);
    expect(warnings.report.summary.byFile['src/app/form-action.tsx']).toBe(1);
    expect(warnings.report.advisoryBaseline?.ruleClassifications['button-has-type']).toBe('product-risk');
    expect(warnings.report.advisoryBaseline?.ruleClassifications['unused-export']).toBe('mechanical-cleanup');
    expect(warnings.report.advisoryBaseline?.ruleClassifications['no-unknown-property']).toBe('tool-noise');
    expect(warnings.report.advisoryBaseline?.buckets['product-risk'].rules['button-has-type']).toBe(1);
    expect(warnings.report.advisoryBaseline?.buckets['mechanical-cleanup'].rules['unused-export']).toBe(1);
    expect(warnings.report.advisoryBaseline?.buckets['tool-noise'].rules['no-unknown-property']).toBe(1);
    expect(warnings.report.advisoryBaseline?.buckets.deferred.rules['no-unknown-property']).toBe(2);
    expect(warnings.report.advisoryBaseline?.r3fThreeNoUnknownProperty.toolNoiseCandidateFiles).toEqual([
      'src/resources/simulations/ship-scene.tsx',
    ]);
    expect(warnings.report.advisoryBaseline?.r3fThreeNoUnknownProperty.domRiskFiles).toEqual([
      'src/app/SceneCard.tsx',
      'src/app/raw-dom.tsx',
    ]);
    expect(warnings.result.stdout.length).toBeGreaterThan(65_536);
  });

  it('records owned accessibility and DOM warning remediation evidence for issue 492', () => {
    const targetRules = [
      'button-has-type',
      'control-has-associated-label',
      'label-has-associated-control',
      'media-has-caption',
      'click-events-have-key-events',
      'no-static-element-interactions',
    ];
    const readReport = (artifact: string) => JSON.parse(readFileSync(join(
      process.cwd(),
      'artifacts/react-doctor/fix-owned-surface-a11y-dom-warnings-492',
      artifact,
    ), 'utf8')) as { summary: { byRule: Record<string, number> } };

    const before = readReport('before-owned-warnings.json');
    const after = readReport('after-review-fix-owned-warnings.json');
    const governanceScript = readFileSync(join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'), 'utf8');
    const mediaSources = [
      'src/components/classroom/VideoComponent.tsx',
      'src/features/interactive/shared/lesson-entry-media-hub.tsx',
      'src/features/lesson-engine/resource-renderer.tsx',
    ].map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n');
    const classroomAccessibilitySources = [
      'src/components/classroom/VideoComponent.tsx',
      'src/components/classroom/AIDynamicReport.tsx',
      'src/components/classroom/PollComponent.tsx',
      'src/components/classroom/AssessmentProbe.tsx',
      'src/components/classroom/EthicalTrigger.tsx',
      'src/components/classroom/ObjectiveCard.tsx',
      'src/app/teacher/classes/[classId]/page.tsx',
    ].map((file) => readFileSync(join(process.cwd(), file), 'utf8')).join('\n');
    const nestedInteractionSource = readFileSync(
      join(process.cwd(), 'src/resources/widgets/argument-principle.tsx'),
      'utf8',
    );
    const archiveTasks = readFileSync(
      join(process.cwd(), 'openspec/changes/archive/2026-06-14-fix-owned-surface-a11y-dom-warnings/tasks.md'),
      'utf8',
    );

    expect(Object.fromEntries(targetRules.map((rule) => [rule, before.summary.byRule[rule]]))).toEqual({
      'button-has-type': 547,
      'control-has-associated-label': 171,
      'label-has-associated-control': 63,
      'media-has-caption': 4,
      'click-events-have-key-events': 11,
      'no-static-element-interactions': 12,
    });
    for (const rule of targetRules) {
      expect(after.summary.byRule[rule] ?? 0).toBe(0);
    }
    expect(mediaSources).not.toContain('data:text/vtt,WEBVTT%0A%0A');
    expect(mediaSources).toContain('Temporary accessibility exception');
    expect(classroomAccessibilitySources).not.toMatch(/field \d+/);
    expect(classroomAccessibilitySources).not.toMatch(/(?:id|htmlFor)="(?:ethicaltrigger|objectivecard)-control-\d+"/);
    expect(classroomAccessibilitySources).not.toContain('id="enableVoice"');
    expect(classroomAccessibilitySources).toContain('useId');
    expect(classroomAccessibilitySources).toContain('htmlFor={');
    expect(classroomAccessibilitySources).toContain('id={');
    expect(nestedInteractionSource).toContain('event.target !== event.currentTarget');
    expect(archiveTasks).toContain('rtk openspec validate owned-surface-accessibility-semantics --strict');
    expect(archiveTasks).toContain('rtk openspec validate --changes --strict');
    expect(governanceScript).toContain('usesReusableAccessibilityIdScope');
    expect(governanceScript).toContain('type="[^"]*"');
    expect(governanceScript).toContain('(?:htmlFor|id|aria-label|aria-labelledby|title)=\\{');
    expect(governanceScript).not.toContain('role|title');
    expect(governanceScript).not.toContain('tabIndex|disabled');
    expect(governanceScript).not.toContain('onKeyDown');
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

  it('rejects profile and cockpit hrefs with wrong Personal Center target', () => {
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
