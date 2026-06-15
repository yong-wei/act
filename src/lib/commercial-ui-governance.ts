import {
  PLATFORM_PRIMARY_ROUTE_INVENTORY,
  PLATFORM_REPORT_SURFACE_INVENTORY,
  type PlatformFloatingDockRouteBehavior,
  type PlatformMobileNavigationBehavior,
  type PlatformPrimaryRouteFrame,
  type PlatformPrimaryRouteInventoryEntry,
  type PlatformReportSurfaceInventoryEntry,
  type PlatformRoleNavigationAudience,
  resolvePlatformRouteInventory,
} from '@/lib/platform-role-navigation';

export type CommercialUiGovernanceMode = 'advisory' | 'blocking';

export type CommercialUiGovernanceRule =
  | 'token.page-local-palette'
  | 'token.raw-decorative-gradient'
  | 'token.unregistered-status-color'
  | 'shell.unregistered-route-frame'
  | 'navigation.intent-coverage'
  | 'navigation.core-destination-coverage'
  | 'navigation.alias-coverage'
  | 'navigation.profile-cockpit-semantics'
  | 'status.duplicate-vocabulary'
  | 'module-chrome.unregistered-kind'
  | 'module-chrome.private-chrome'
  | 'visual-acceptance.missing-route-evidence'
  | 'visual-acceptance.incomplete-evidence'
  | 'visual-acceptance.incomplete-premium-theme-evidence'
  | 'visual-acceptance.incomplete-manifest-metadata'
  | 'visual-acceptance.incomplete-navigation-state-evidence'
  | 'visual-acceptance.route-inventory-drift'
  | 'route-ledger.incomplete-primary-route'
  | 'route-ledger.outdated-archetype'
  | 'secondary-navigation.incomplete-route-matrix'
  | 'secondary-navigation.legacy-local-navigation'
  | 'secondary-navigation.student-data-center-exposure'
  | 'secondary-navigation.legacy-first-hop'
  | 'secondary-navigation.local-tool-boundary'
  | 'mobile-structure.desktop-panel-persistence'
  | 'report-export.incomplete-visual-evidence'
  | 'accessibility-text-fit.missing-route-evidence'
  | 'accessibility-text-fit.incomplete-evidence'
  | 'simulation-visual-qa.missing-route-evidence'
  | 'simulation-visual-qa.incomplete-evidence'
  | 'interactive-learning-product-qa.missing-evidence'
  | 'interactive-learning-product-qa.incomplete-evidence'
  | 'adaptive-path-product-qa.missing-evidence'
  | 'adaptive-path-product-qa.incomplete-evidence'
  | 'allowlist.invalid-entry';

export type CommercialUiGovernanceCategory =
  | 'token'
  | 'shell'
  | 'navigation'
  | 'status'
  | 'module-chrome'
  | 'visual-acceptance'
  | 'route-ledger'
  | 'secondary-navigation'
  | 'mobile-structure'
  | 'report-export'
  | 'accessibility-text-fit'
  | 'simulation-visual-qa'
  | 'interactive-learning-product-qa'
  | 'adaptive-path-product-qa'
  | 'allowlist';

export interface CommercialUiGovernanceViolation {
  category?: CommercialUiGovernanceCategory;
  path: string;
  rule: CommercialUiGovernanceRule;
  message: string;
  evidence?: readonly string[];
  allowedBy?: string;
  enforcement?: CommercialUiGovernanceMode;
}

export interface CommercialUiGovernanceAllowlistEntry {
  id?: string;
  path: string;
  rule: CommercialUiGovernanceRule;
  evidence?: readonly string[];
  owner?: string;
  owningIssue?: string;
  owningChange?: string;
  expiresOn?: string;
  removalCondition?: string;
}

export interface CommercialShellInventoryEntry {
  path: string;
  route: string;
  usesRegisteredShell: boolean;
  shellName?: string;
}

export interface CommercialModuleChromeInventoryEntry {
  path: string;
  lessonId: string;
  stepId: string;
  moduleId: string;
  moduleKind: string;
  registeredKind: boolean;
  usesCommercialChrome: boolean;
  privateChromeComponent?: string;
}

export interface CommercialStatusVocabularyInventoryEntry {
  path: string;
  statusTerm: string;
  registeredStatusColor: boolean;
  duplicatesPlatformVocabulary?: boolean;
}

export interface CommercialNavigationCoverageInput {
  intents: readonly string[];
  coreEntryIds: readonly string[];
  hrefs: readonly string[];
  aliases: readonly string[];
  profileHref?: string;
  cockpitHref?: string;
}

export interface CommercialVisualAcceptanceRoute {
  href: string;
  requiredWidths: readonly [1440, 320];
}

export type CommercialVisualQaTheme = 'light' | 'dark';
const COMMERCIAL_VISUAL_QA_REQUIRED_THEMES: readonly CommercialVisualQaTheme[] = ['light', 'dark'];
export type CommercialVisualQaRole = 'guest' | 'student' | 'teacher' | 'admin';
const COMMERCIAL_VISUAL_QA_ROLES: readonly CommercialVisualQaRole[] = ['guest', 'student', 'teacher', 'admin'];
export type CommercialVisualQaAuthState = 'public' | 'auth-entry' | 'authenticated' | 'unauth-redirect-fallback';
const COMMERCIAL_VISUAL_QA_AUTH_STATES: readonly CommercialVisualQaAuthState[] = [
  'public',
  'auth-entry',
  'authenticated',
  'unauth-redirect-fallback',
];
export type CommercialVisualQaNavigationState =
  | 'desktop-expanded'
  | 'desktop-collapsed'
  | 'mobile-drawer'
  | 'mobile-hidden'
  | 'auth-callback-panel'
  | 'public-entry-menu'
  | 'role-route-tabs'
  | 'workspace-command-surface'
  | 'hidden-immersive';

const COMMERCIAL_VISUAL_QA_NAVIGATION_STATES: readonly CommercialVisualQaNavigationState[] = [
  'desktop-expanded',
  'desktop-collapsed',
  'mobile-drawer',
  'mobile-hidden',
  'auth-callback-panel',
  'public-entry-menu',
  'role-route-tabs',
  'workspace-command-surface',
  'hidden-immersive',
];
const COMMERCIAL_VISUAL_QA_MOBILE_WIDTHS = [320, 390] as const;

const COMMERCIAL_SIMULATION_MIN_SCREENSHOT_HEIGHT = 640;

export type CommercialSimulationVisualQaArchetype =
  | 'catalog'
  | 'legacy-redirect'
  | 'heading-control'
  | 'dp-positioning'
  | 'course-keeping'
  | 'cruise-roll'
  | 'ice-propulsion'
  | 'dredging-positioning'
  | 'control-workbench-regression';
export type CommercialSimulationVisualQaDockState = 'collapsed' | 'expanded' | 'hidden' | 'required';
export type CommercialSimulationVisualQaLocalToolState = 'collapsed' | 'expanded' | 'not-applicable';
export type CommercialSimulationVirtualLabFinalBehavior = 'redirects-to-simulations';
export type CommercialSimulationReactDoctorStatus = 'passed' | 'documented' | 'not-run';

export interface CommercialSimulationVisualQaRoute {
  href: string;
  routeFile: string;
  archetype: CommercialSimulationVisualQaArchetype;
  requiredThemes: readonly CommercialVisualQaTheme[];
  requiredWidths: readonly [1440, 320];
  requiredNavigationStates: readonly CommercialVisualQaNavigationState[];
  requiredDockStates: readonly CommercialSimulationVisualQaDockState[];
  requiredLocalToolStates: readonly CommercialSimulationVisualQaLocalToolState[];
  role: CommercialVisualQaRole;
  acceptedAuthState: CommercialVisualQaAuthState;
  finalBehavior?: CommercialSimulationVirtualLabFinalBehavior;
  requiresNonblankScene?: boolean;
  reactDoctorCommand: string;
}

type CommercialSimulationExpectedHandoffBaseline = Pick<
  CommercialSimulationHandoffBaselineEvidence,
  'handoffSection' | 'conceptImage' | 'implementationScreenshot' | 'evidenceHook' | 'compatibilityRole'
>;

export interface CommercialSimulationViewportEvidence {
  width: number;
  theme: CommercialVisualQaTheme;
  requestedRoute?: string;
  finalUrl?: string;
  role?: CommercialVisualQaRole;
  authState?: CommercialVisualQaAuthState;
  routeFile?: string;
  navigationState: CommercialVisualQaNavigationState;
  dockState: CommercialSimulationVisualQaDockState;
  localToolState: CommercialSimulationVisualQaLocalToolState;
  firstViewportTaskVisible?: boolean;
  primarySceneNonblank?: boolean;
  instrumentAreaNonblank?: boolean;
  result?: 'passed' | 'failed';
  screenshot?: string;
  screenshotSha256?: string;
  screenshotWidth?: number;
  screenshotHeight?: number;
  artifact?: string;
  artifactSha256?: string;
}

export interface CommercialRectEvidence {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface CommercialSimulationCommandDeckViewportEvidence {
  width: number;
  theme: CommercialVisualQaTheme;
  screenshot: string;
  screenshotSha256?: string;
  screenshotWidth?: number;
  screenshotHeight?: number;
  sceneChromeRemoved: boolean;
  inSceneBackControlCount: number;
  inSceneAbbreviationCount: number;
  collapseButtonCount?: number;
  restoreHandleCount?: number;
  panelsTopAligned: boolean;
  bottomToolsUnobscured: boolean;
  bottomToolsWithinViewport?: boolean;
  bottomToolSegmentRoles?: readonly string[];
  konlingDockCollisionFree: boolean;
  restoreHandlesKeyboardReachable: boolean;
  primarySceneNonblank: boolean;
  structuredSurfacesBelowScene?: boolean;
  sceneRect?: CommercialRectEvidence;
  statusPanelRect?: CommercialRectEvidence;
  controlPanelRect?: CommercialRectEvidence;
}

export interface CommercialSimulationCommandDeckCruiseComparisonEvidence {
  comparedRoutes: readonly string[];
  desktopSceneWidthRatioToMedian: number;
  desktopSceneHeightRatioToMedian: number;
  contextPlacement: 'below-primary-scene';
  mobileSceneFirst: boolean;
}

export interface CommercialSimulationCommandDeckGeometryEvidence {
  change: 'normalize-simulation-command-deck-layout';
  generatedAt?: string;
  sourceSha256?: Record<string, string>;
  currentSourceSha256?: Record<string, string>;
  viewports: readonly CommercialSimulationCommandDeckViewportEvidence[];
  cruiseComparison?: CommercialSimulationCommandDeckCruiseComparisonEvidence;
}

export interface CommercialSimulationReactDoctorEvidence {
  localOnly: boolean;
  ciRequired: boolean;
  command: string;
  status: CommercialSimulationReactDoctorStatus;
  report?: string;
  reportSha256?: string;
  ownedDiagnostics?: number;
  selectedDiagnostics?: number;
}

export interface CommercialSimulationResourceThemeEvidence {
  sharedPrimitives: boolean;
  panelThemeParity: boolean;
  localControlsThemeParity: boolean;
  restoreHandlesThemeParity: boolean;
  hardCodedPaletteFindings: number;
}

export interface CommercialSimulationSceneThemeEvidence {
  lightTemplate: boolean;
  darkTemplate: boolean;
  skyWaterGridFogThemeAware: boolean;
  labelHudContrastChecked: boolean;
  unchangedLightSceneInDarkTheme: boolean;
}

export type CommercialSimulationHandoffReviewStatus = 'passed' | 'failed' | 'not-run';

export interface CommercialSimulationHandoffBaselineEvidence {
  change: string;
  archivePath: string;
  designHandoff: string;
  designHandoffSha256?: string;
  implementationMatrix: string;
  implementationMatrixSha256?: string;
  route: string;
  handoffSection: string;
  conceptImage: string;
  conceptImageSha256?: string;
  implementationScreenshot: string;
  implementationScreenshotSha256?: string;
  evidenceHook?: string;
  independentReviewStatus: CommercialSimulationHandoffReviewStatus;
  compatibilityRole?: 'redirect-to-simulations';
}

export interface CommercialSimulationVisualQaEvidence {
  archetype: CommercialSimulationVisualQaArchetype;
  availabilityConsistentWith?: string;
  virtualLabFinalBehavior?: CommercialSimulationVirtualLabFinalBehavior;
  handoffBaseline?: CommercialSimulationHandoffBaselineEvidence;
  hidesInternalModelStatus?: boolean;
  duplicateAssistantEntries?: number;
  unmanagedRightBottomControls?: number;
  localControlCollisionFree?: boolean;
  routeInventoryCompatible?: boolean;
  modelLibraryCompatible?: boolean;
  resourceInternalTheme?: CommercialSimulationResourceThemeEvidence;
  sceneThemeParameters?: CommercialSimulationSceneThemeEvidence;
  commandDeckGeometry?: CommercialSimulationCommandDeckGeometryEvidence;
  reactDoctorErrorCheck?: CommercialSimulationReactDoctorEvidence;
  viewports: readonly CommercialSimulationViewportEvidence[];
}

const MOBILE_NAVIGATION_STATE_BY_BEHAVIOR: Record<PlatformMobileNavigationBehavior, CommercialVisualQaNavigationState> = {
  'public-entry-menu': 'public-entry-menu',
  'auth-callback-panel': 'auth-callback-panel',
  'role-route-tabs': 'role-route-tabs',
  'workspace-command-surface': 'workspace-command-surface',
  drawer: 'mobile-drawer',
  'hidden-immersive': 'hidden-immersive',
};

export interface CommercialPremiumVisualQaRoute {
  href: string;
  routeFile: string;
  requiredThemes: readonly CommercialVisualQaTheme[];
  requiredWidths: readonly [1440, 320];
  role: CommercialVisualQaRole;
  floatingDock: 'required' | 'collapsed' | 'hidden';
  acceptedAuthState: CommercialVisualQaAuthState;
  artifactDirectory: string;
}

export interface CommercialViewportVisualEvidence {
  width: number;
  theme?: CommercialVisualQaTheme;
  role?: CommercialVisualQaRole;
  requestedRoute?: string;
  finalUrl?: string;
  authState?: CommercialVisualQaAuthState;
  routeFile?: string;
  routeArchetype?: PlatformPrimaryRouteFrame | string;
  dockState?: CommercialPremiumVisualQaRoute['floatingDock'] | PlatformFloatingDockRouteBehavior;
  navigationState?: CommercialVisualQaNavigationState;
  mobileNavigation?: PlatformMobileNavigationBehavior | string;
  appShellNavigationContract?: 'collapsed-icon-rail';
  result?: 'passed' | 'failed';
  screenshot?: string;
  artifact?: string;
  firstViewportUseful?: boolean;
  firstViewportTaskVisible?: boolean;
  navigationReachable?: boolean;
  noTextOverlap?: boolean;
  stablePanelGeometry?: boolean;
  coherentBrandApplication?: boolean;
  taskControlsVisible?: boolean;
  dockPlacementChecked?: boolean;
  noDockCollision?: boolean;
  dockFocusReachable?: boolean;
  gridTemplateColumns?: string;
  sidebarWidth?: number;
  contentWidth?: number;
  activeLinkAriaLabel?: string | null;
  activeLinkTitle?: string | null;
  activeLinkText?: string;
  horizontalOverflow?: boolean;
  mobileCanvasFirst?: boolean;
  noPersistentMobileSidebar?: boolean;
  noPersistentMobileFilter?: boolean;
  noPersistentWorkbenchPanels?: boolean;
  noPersistentKnowledgeGraphDrawer?: boolean;
  observedNavigationHrefs?: readonly string[];
  expectedNavigationEntries?: readonly string[];
  forbiddenNavigationEntries?: readonly string[];
  localPanelEvidence?: Record<string, unknown>;
  reportEvidence?: readonly CommercialReportExportVisualEvidence[];
}

export interface CommercialVisualAcceptanceEvidence {
  href: string;
  viewports: readonly CommercialViewportVisualEvidence[];
  simulationVisualQa?: CommercialSimulationVisualQaEvidence;
  secondaryRouteGovernance?: readonly CommercialSecondaryRouteGovernanceEntry[];
}

export type CommercialSecondaryRouteShellType =
  | 'app-shell'
  | 'approved-workspace-shell'
  | 'legacy-topbar'
  | 'temporary-adapter';
export type CommercialSecondaryRouteMigrationState = 'migrated' | 'blocked-by-upstream' | 'active-exception';
export type CommercialSecondaryLocalToolDisposition = 'local-tool' | 'platform-navigation';

export interface CommercialSecondaryRouteDependency {
  change: string;
  status: 'complete' | 'active';
}

export interface CommercialSecondaryRouteLocalToolEvidence {
  id: string;
  disposition: CommercialSecondaryLocalToolDisposition;
}

export interface CommercialSecondaryRouteNextActionEvidence {
  href: string;
  shellType: CommercialSecondaryRouteShellType;
  migrationState: CommercialSecondaryRouteMigrationState;
  usesLegacyTopbar?: boolean;
  exceptionOwner?: string;
  removalCondition?: string;
}

export interface CommercialSecondaryRouteGovernanceEntry {
  href: string;
  role: Exclude<CommercialVisualQaRole, 'guest'> | 'guest';
  routeFile?: string;
  shellType?: CommercialSecondaryRouteShellType;
  routeArchetype?: PlatformPrimaryRouteFrame | string;
  roleScope?: readonly PlatformRoleNavigationAudience[];
  navigationLayers?: readonly string[];
  collapseBehavior?: string;
  localPanels?: readonly CommercialSecondaryRouteLocalToolEvidence[];
  themeSupport?: readonly CommercialVisualQaTheme[];
  mobileBehavior?: PlatformMobileNavigationBehavior | string;
  owningMigrationChange?: string;
  migrationState?: CommercialSecondaryRouteMigrationState;
  upstreamDependencies?: readonly string[];
  exceptionOwner?: string;
  exceptionExpiresOn?: string;
  exceptionRemovalCondition?: string;
  expectedEntries?: readonly string[];
  forbiddenEntries?: readonly string[];
  observedNavigationHrefs?: readonly string[];
  primaryNextAction?: CommercialSecondaryRouteNextActionEvidence;
}

export interface CommercialReportExportVisualEvidence {
  surfaceId: string;
  watermarkChecked?: boolean;
  privacyScopeChecked?: boolean;
  sourceQualityVisible?: boolean;
  statusLegendReadable?: boolean;
  exportSafeSnapshotChecked?: boolean;
}

export interface CommercialViewportAccessibilityEvidence {
  width: number;
  contrastChecked?: boolean;
  visibleFocus?: boolean;
  keyboardReachable?: boolean;
  reducedMotionChecked?: boolean;
  buttonTextFits?: boolean;
  noMobileTextOverlap?: boolean;
}

export interface CommercialAccessibilityTextFitEvidence {
  href: string;
  viewports: readonly CommercialViewportAccessibilityEvidence[];
}

export type CommercialInteractiveLearningProductQaResult = 'passed' | 'blocked' | 'missing';

export interface CommercialInteractiveLearningDesignQaReportEvidence {
  change: string;
  report: string;
  reportSha256?: string;
  currentReportSha256?: string;
  finalResult: CommercialInteractiveLearningProductQaResult;
  reportFinalResult?: CommercialInteractiveLearningProductQaResult;
}

export interface CommercialInteractiveLearningProductQaMatrixEntry {
  id: string;
  route: string;
  role: CommercialVisualQaRole;
  theme: CommercialVisualQaTheme;
  viewport: 'desktop' | 'mobile';
  navigationState: CommercialVisualQaNavigationState;
  dockState: 'collapsed' | 'expanded' | 'hidden';
  pageState: string;
  moduleState: string;
  sourceConcept: string;
  result: CommercialInteractiveLearningProductQaResult;
}

export interface CommercialInteractiveLearningProductQaReviewEvidence {
  status: 'passed' | 'blocked' | 'not-run';
  reviewer: string;
  report: string;
  reportSha256?: string;
  currentReportSha256?: string;
  reportHasPassVerdict?: boolean;
  reportHasNoUnresolvedBlocks?: boolean;
}

export interface CommercialInteractiveLearningProductQaEvidence {
  change: 'govern-interactive-learning-product-qa';
  parseError?: string;
  generatedAt?: string;
  sourceCommit?: string;
  designHandoff: string;
  designHandoffSha256?: string;
  currentDesignHandoffSha256?: string;
  handoffMatrix: string;
  handoffMatrixSha256?: string;
  currentHandoffMatrixSha256?: string;
  conceptImages: readonly string[];
  conceptImageSha256?: Record<string, string>;
  currentConceptImageSha256?: Record<string, string>;
  childDesignQaReports: readonly CommercialInteractiveLearningDesignQaReportEvidence[];
  routeMatrix: readonly CommercialInteractiveLearningProductQaMatrixEntry[];
  independentVisualReview: CommercialInteractiveLearningProductQaReviewEvidence;
  regressionChecks: Record<string, boolean>;
  temporaryExceptions: readonly {
    id: string;
    owner: string;
    removalCondition: string;
  }[];
}

export type CommercialAdaptivePathProductQaResult = 'passed' | 'blocked' | 'missing';

export interface CommercialAdaptivePathProductQaChildValidationEvidence {
  change: string;
  validationCommand: string;
  result: CommercialAdaptivePathProductQaResult;
  archivedTasksComplete: boolean;
}

export interface CommercialAdaptivePathProductQaMatrixEntry {
  id: string;
  route: string;
  goal: string;
  role: CommercialVisualQaRole;
  theme: CommercialVisualQaTheme;
  viewport: 'desktop' | 'mobile';
  authState: CommercialVisualQaAuthState;
  navigationState: CommercialVisualQaNavigationState;
  dockState: 'collapsed' | 'expanded' | 'hidden';
  pageState: string;
  selectedPath?: string;
  selectedNode?: string;
  sourceConcept: string;
  screenshot?: string;
  screenshotSha256?: string;
  result: CommercialAdaptivePathProductQaResult;
}

export interface CommercialAdaptivePathProductQaReviewEvidence {
  status: 'passed' | 'blocked' | 'not-run';
  reviewer: string;
  report: string;
  reportSha256?: string;
  currentReportSha256?: string;
  reportHasPassVerdict?: boolean;
  reportHasNoUnresolvedBlocks?: boolean;
}

export interface CommercialAdaptivePathProductQaCaptureStateEvidence {
  id: string;
  goal: string;
  theme: CommercialVisualQaTheme;
  viewport: 'desktop' | 'mobile';
  screenshot: string;
  screenshotSha256: string;
}

export interface CommercialAdaptivePathProductQaEvidence {
  change: 'govern-adaptive-path-product-qa';
  parseError?: string;
  generatedAt?: string;
  sourceCommit?: string;
  designHandoff: string;
  designHandoffSha256?: string;
  currentDesignHandoffSha256?: string;
  handoffMatrix: string;
  handoffMatrixSha256?: string;
  currentHandoffMatrixSha256?: string;
  captureManifest: string;
  captureManifestSha256?: string;
  currentCaptureManifestSha256?: string;
  visualSignals: string;
  visualSignalsSha256?: string;
  currentVisualSignalsSha256?: string;
  conceptImages: readonly string[];
  conceptImageSha256?: Record<string, string>;
  currentConceptImageSha256?: Record<string, string>;
  childChangeValidations: readonly CommercialAdaptivePathProductQaChildValidationEvidence[];
  routeMatrix: readonly CommercialAdaptivePathProductQaMatrixEntry[];
  captureStates: readonly CommercialAdaptivePathProductQaCaptureStateEvidence[];
  independentVisualReview: CommercialAdaptivePathProductQaReviewEvidence;
  functionalGates: Record<string, boolean>;
  temporaryExceptions: readonly {
    id: string;
    owner: string;
    removalCondition: string;
  }[];
}

export interface CommercialUiGovernanceInput {
  mode: CommercialUiGovernanceMode;
  today?: string;
  sourceViolations?: readonly CommercialUiGovernanceViolation[];
  shellInventory?: readonly CommercialShellInventoryEntry[];
  moduleChromeInventory?: readonly CommercialModuleChromeInventoryEntry[];
  statusInventory?: readonly CommercialStatusVocabularyInventoryEntry[];
  allowlist?: readonly CommercialUiGovernanceAllowlistEntry[];
  navigationCoverage: CommercialNavigationCoverageInput;
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[];
  accessibilityEvidence: readonly CommercialAccessibilityTextFitEvidence[];
  requiredVisualRoutes?: readonly CommercialVisualAcceptanceRoute[];
  routeInventory?: readonly PlatformPrimaryRouteInventoryEntry[];
  visualRouteInventory?: readonly PlatformPrimaryRouteInventoryEntry[];
  premiumVisualQaMatrix?: readonly CommercialPremiumVisualQaRoute[];
  simulationVisualQaMatrix?: readonly CommercialSimulationVisualQaRoute[];
  secondaryRouteGovernanceMatrix?: readonly CommercialSecondaryRouteGovernanceEntry[];
  secondaryRouteDependencies?: readonly CommercialSecondaryRouteDependency[];
  reportSurfaceInventory?: readonly PlatformReportSurfaceInventoryEntry[];
  interactiveLearningProductQaRequired?: boolean;
  interactiveLearningProductQa?: CommercialInteractiveLearningProductQaEvidence;
  interactiveLearningProductQaSourceRefreshRequired?: boolean;
  interactiveLearningProductQaEvidenceRefreshed?: boolean;
  adaptivePathProductQaRequired?: boolean;
  adaptivePathProductQa?: CommercialAdaptivePathProductQaEvidence;
  adaptivePathProductQaSourceRefreshRequired?: boolean;
  adaptivePathProductQaEvidenceRefreshed?: boolean;
}

export interface CommercialUiGovernanceResult {
  passed: boolean;
  violations: CommercialUiGovernanceViolation[];
  blockingViolations: CommercialUiGovernanceViolation[];
  allowlistedViolations: CommercialUiGovernanceViolation[];
}

export const DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES: CommercialVisualAcceptanceRoute[] = [
  { href: '/', requiredWidths: [1440, 320] },
  { href: '/login', requiredWidths: [1440, 320] },
  { href: '/login?callbackUrl=%2Fprofile', requiredWidths: [1440, 320] },
  { href: '/dashboard', requiredWidths: [1440, 320] },
  { href: '/data-center', requiredWidths: [1440, 320] },
  { href: '/interactive-learning', requiredWidths: [1440, 320] },
  { href: '/interactive-learning/courses', requiredWidths: [1440, 320] },
  { href: '/interactive-learning/courses/unit-4-1-design-task-expression', requiredWidths: [1440, 320] },
  { href: '/simulations', requiredWidths: [1440, 320] },
  { href: '/arena', requiredWidths: [1440, 320] },
  { href: '/assessment/document-feedback', requiredWidths: [1440, 320] },
  { href: '/assessment/adaptive-practice', requiredWidths: [1440, 320] },
  { href: '/profile', requiredWidths: [1440, 320] },
  { href: '/profile/evidence', requiredWidths: [1440, 320] },
  { href: '/interactive-learning/control-workbench', requiredWidths: [1440, 320] },
  { href: '/interactive-learning/courses/unit-5-4-data-driven-mpc-transition', requiredWidths: [1440, 320] },
  { href: '/teacher', requiredWidths: [1440, 320] },
  { href: '/teacher/grading-workbench', requiredWidths: [1440, 320] },
  { href: '/teacher/prep-packs', requiredWidths: [1440, 320] },
  { href: '/teacher/classes/[classId]/analytics-v2', requiredWidths: [1440, 320] },
  { href: '/admin', requiredWidths: [1440, 320] },
  { href: '/admin/data-governance', requiredWidths: [1440, 320] },
  { href: '/knowledge', requiredWidths: [1440, 320] },
];

export const COMMERCIAL_ROUTE_INVENTORY_VISUAL_ACCEPTANCE_ROUTES: CommercialVisualAcceptanceRoute[] = PLATFORM_PRIMARY_ROUTE_INVENTORY
  .filter((route) => route.screenshotProfile !== 'temporary-exception')
  .map((route) => ({
    href: route.href,
    requiredWidths: [1440, 320],
  }));

export const PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX: CommercialPremiumVisualQaRoute[] = [
  {
    href: '/',
    routeFile: 'src/app/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'guest',
    floatingDock: 'collapsed',
    acceptedAuthState: 'public',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/login',
    routeFile: 'src/app/(auth)/login/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'guest',
    floatingDock: 'hidden',
    acceptedAuthState: 'auth-entry',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/interactive-learning',
    routeFile: 'src/app/interactive-learning/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'collapsed',
    acceptedAuthState: 'public',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/interactive-learning/courses',
    routeFile: 'src/app/interactive-learning/courses/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'collapsed',
    acceptedAuthState: 'public',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/interactive-learning/courses/unit-4-1-design-task-expression',
    routeFile: 'src/app/interactive-learning/courses/unit-4-1-design-task-expression/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'collapsed',
    acceptedAuthState: 'public',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/interactive-learning/courses/unit-5-4-data-driven-mpc-transition',
    routeFile: 'src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'collapsed',
    acceptedAuthState: 'public',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/simulations',
    routeFile: 'src/app/simulations/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'collapsed',
    acceptedAuthState: 'public',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/interactive-learning/control-workbench',
    routeFile: 'src/app/interactive-learning/control-workbench/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'required',
    acceptedAuthState: 'public',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/assessment/adaptive-practice',
    routeFile: 'src/app/assessment/adaptive-practice/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'required',
    acceptedAuthState: 'authenticated',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/dashboard',
    routeFile: 'src/app/(main)/dashboard/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'hidden',
    acceptedAuthState: 'unauth-redirect-fallback',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/dashboard',
    routeFile: 'src/app/(main)/dashboard/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'required',
    acceptedAuthState: 'authenticated',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/profile',
    routeFile: 'src/app/(main)/profile/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'required',
    acceptedAuthState: 'authenticated',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/data-center',
    routeFile: 'src/app/data-center/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'teacher',
    floatingDock: 'required',
    acceptedAuthState: 'authenticated',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/data-center',
    routeFile: 'src/app/data-center/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'admin',
    floatingDock: 'required',
    acceptedAuthState: 'authenticated',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/teacher',
    routeFile: 'src/app/teacher/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'teacher',
    floatingDock: 'hidden',
    acceptedAuthState: 'unauth-redirect-fallback',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/teacher',
    routeFile: 'src/app/teacher/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'teacher',
    floatingDock: 'required',
    acceptedAuthState: 'authenticated',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/teacher/classes/[classId]/analytics-v2',
    routeFile: 'src/app/teacher/classes/[classId]/analytics-v2/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'teacher',
    floatingDock: 'required',
    acceptedAuthState: 'authenticated',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/admin',
    routeFile: 'src/app/admin/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'admin',
    floatingDock: 'hidden',
    acceptedAuthState: 'unauth-redirect-fallback',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/admin',
    routeFile: 'src/app/admin/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'admin',
    floatingDock: 'required',
    acceptedAuthState: 'authenticated',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/admin/data-governance',
    routeFile: 'src/app/admin/data-governance/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'admin',
    floatingDock: 'required',
    acceptedAuthState: 'authenticated',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
  {
    href: '/knowledge',
    routeFile: 'src/app/knowledge/page.tsx',
    requiredThemes: ['light', 'dark'],
    requiredWidths: [1440, 320],
    role: 'student',
    floatingDock: 'collapsed',
    acceptedAuthState: 'public',
    artifactDirectory: 'artifacts/commercial-ui/premium-foundation',
  },
] as const;

const SIMULATION_VISUAL_QA_REQUIRED_THEMES: readonly CommercialVisualQaTheme[] = ['light', 'dark'];
const SIMULATION_VISUAL_QA_REQUIRED_WIDTHS: readonly [1440, 320] = [1440, 320];
const SIMULATION_REACT_DOCTOR_COMMAND = 'rtk npm run test:react-doctor:owned-errors';
const SIMULATION_PRODUCT_DESIGN_HANDOFF_CHANGE = 'align-virtual-simulation-product-design-handoff';
const SIMULATION_PRODUCT_DESIGN_HANDOFF_ARCHIVE =
  'openspec/changes/archive/2026-06-14-align-virtual-simulation-product-design-handoff';
const SIMULATION_PRODUCT_DESIGN_HANDOFF_SOURCE =
  'artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md';
const SIMULATION_PRODUCT_DESIGN_HANDOFF_MATRIX =
  'artifacts/product-design-audits/virtual-simulation-2026-06-13/implementation-matrix.md';
const SIMULATION_PRODUCT_DESIGN_CONCEPT_IMAGES = new Set([
  'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-1-platform-continuity.png',
  'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
  'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-3-learning-mission-studio.png',
]);
const SIMULATION_PRODUCT_DESIGN_HANDOFF_BASELINE_BY_ROUTE: Record<string, CommercialSimulationExpectedHandoffBaseline> = {
  '/simulations': {
    handoffSection: 'Virtual simulation catalog',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-1-platform-continuity.png',
    implementationScreenshot:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/implementation-screenshots/simulations-dark-1440.png',
    evidenceHook: 'data-product-design-concept-reference="concept-1-platform-continuity"',
  },
  '/virtual-lab': {
    handoffSection: 'Canonical entry hierarchy',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-1-platform-continuity.png',
    implementationScreenshot:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/implementation-screenshots/virtual-lab-redirect-dark-1440.png',
    evidenceHook: 'data-virtual-lab-compatibility-role="redirect-to-simulations"',
    compatibilityRole: 'redirect-to-simulations',
  },
  '/simulations/destroyer': {
    handoffSection: 'Command-deck shell',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
    implementationScreenshot:
      'artifacts/commercial-ui/simulation-internal-theme-534/simulations-destroyer-dark-1440-desktop-expanded-collapsed-collapsed.png',
    evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
  },
  '/simulations/lng': {
    handoffSection: 'Command-deck shell',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
    implementationScreenshot:
      'artifacts/commercial-ui/simulation-internal-theme-534/simulations-lng-dark-1440-desktop-expanded-collapsed-collapsed.png',
    evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
  },
  '/simulations/container': {
    handoffSection: 'Command-deck shell',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
    implementationScreenshot:
      'artifacts/commercial-ui/simulation-internal-theme-534/simulations-container-dark-1440-desktop-expanded-collapsed-collapsed.png',
    evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
  },
  '/simulations/drilling': {
    handoffSection: 'Command-deck shell',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
    implementationScreenshot:
      'artifacts/commercial-ui/simulation-internal-theme-534/simulations-drilling-dark-1440-desktop-expanded-collapsed-collapsed.png',
    evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
  },
  '/simulations/icebreaker': {
    handoffSection: 'Command-deck shell',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
    implementationScreenshot:
      'artifacts/commercial-ui/simulation-internal-theme-534/simulations-icebreaker-dark-1440-desktop-expanded-collapsed-collapsed.png',
    evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
  },
  '/simulations/dredger': {
    handoffSection: 'Command-deck shell',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
    implementationScreenshot:
      'artifacts/commercial-ui/simulation-internal-theme-534/simulations-dredger-dark-1440-desktop-expanded-collapsed-collapsed.png',
    evidenceHook: 'data-command-deck-composition="scene-primary-glass-panels-bottom-tools"',
  },
  '/simulations/cruise': {
    handoffSection: 'Command-deck shell',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-2-command-deck-shell.png',
    implementationScreenshot:
      'artifacts/commercial-ui/simulation-internal-theme-534/simulations-cruise-dark-1440-desktop-expanded-collapsed-collapsed.png',
    evidenceHook: 'data-simulation-panel-restore-handle',
  },
  '/interactive-learning/control-workbench': {
    handoffSection: 'Learning mission semantics',
    conceptImage:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/concepts/concept-3-learning-mission-studio.png',
    implementationScreenshot:
      'artifacts/product-design-audits/virtual-simulation-2026-06-13/implementation-screenshots/workbench-dark-1440.png',
    evidenceHook: 'data-learning-mission-semantics="objective-task-chain-evidence-next-action"',
  },
};
const SIMULATION_APP_SHELL_NAVIGATION_STATES: readonly CommercialVisualQaNavigationState[] = [
  'desktop-expanded',
  'desktop-collapsed',
  'workspace-command-surface',
];
const SIMULATION_SCENE_DOCK_STATES: readonly CommercialSimulationVisualQaDockState[] = ['collapsed', 'expanded'];
const SIMULATION_SCENE_LOCAL_TOOL_STATES: readonly CommercialSimulationVisualQaLocalToolState[] = ['collapsed', 'expanded'];

export const SIMULATION_VISUAL_QA_ROUTE_MATRIX: CommercialSimulationVisualQaRoute[] = [
  {
    href: '/simulations',
    routeFile: 'src/app/simulations/page.tsx',
    archetype: 'catalog',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: SIMULATION_APP_SHELL_NAVIGATION_STATES,
    requiredDockStates: ['collapsed'],
    requiredLocalToolStates: ['not-applicable'],
    role: 'student',
    acceptedAuthState: 'public',
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
  {
    href: '/virtual-lab',
    routeFile: 'src/app/virtual-lab/page.tsx',
    archetype: 'legacy-redirect',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: SIMULATION_APP_SHELL_NAVIGATION_STATES,
    requiredDockStates: ['collapsed'],
    requiredLocalToolStates: ['not-applicable'],
    role: 'student',
    acceptedAuthState: 'public',
    finalBehavior: 'redirects-to-simulations',
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
  {
    href: '/simulations/destroyer',
    routeFile: 'src/app/simulations/destroyer/page.tsx',
    archetype: 'heading-control',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: SIMULATION_APP_SHELL_NAVIGATION_STATES,
    requiredDockStates: SIMULATION_SCENE_DOCK_STATES,
    requiredLocalToolStates: SIMULATION_SCENE_LOCAL_TOOL_STATES,
    role: 'student',
    acceptedAuthState: 'public',
    requiresNonblankScene: true,
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
  {
    href: '/simulations/lng',
    routeFile: 'src/app/simulations/lng/page.tsx',
    archetype: 'course-keeping',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: SIMULATION_APP_SHELL_NAVIGATION_STATES,
    requiredDockStates: SIMULATION_SCENE_DOCK_STATES,
    requiredLocalToolStates: SIMULATION_SCENE_LOCAL_TOOL_STATES,
    role: 'student',
    acceptedAuthState: 'public',
    requiresNonblankScene: true,
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
  {
    href: '/simulations/container',
    routeFile: 'src/app/simulations/container/page.tsx',
    archetype: 'course-keeping',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: SIMULATION_APP_SHELL_NAVIGATION_STATES,
    requiredDockStates: SIMULATION_SCENE_DOCK_STATES,
    requiredLocalToolStates: SIMULATION_SCENE_LOCAL_TOOL_STATES,
    role: 'student',
    acceptedAuthState: 'public',
    requiresNonblankScene: true,
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
  {
    href: '/simulations/drilling',
    routeFile: 'src/app/simulations/drilling/page.tsx',
    archetype: 'dp-positioning',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: SIMULATION_APP_SHELL_NAVIGATION_STATES,
    requiredDockStates: SIMULATION_SCENE_DOCK_STATES,
    requiredLocalToolStates: SIMULATION_SCENE_LOCAL_TOOL_STATES,
    role: 'student',
    acceptedAuthState: 'public',
    requiresNonblankScene: true,
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
  {
    href: '/simulations/cruise',
    routeFile: 'src/app/simulations/cruise/page.tsx',
    archetype: 'cruise-roll',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: SIMULATION_APP_SHELL_NAVIGATION_STATES,
    requiredDockStates: SIMULATION_SCENE_DOCK_STATES,
    requiredLocalToolStates: SIMULATION_SCENE_LOCAL_TOOL_STATES,
    role: 'student',
    acceptedAuthState: 'public',
    requiresNonblankScene: true,
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
  {
    href: '/simulations/icebreaker',
    routeFile: 'src/app/simulations/icebreaker/page.tsx',
    archetype: 'ice-propulsion',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: SIMULATION_APP_SHELL_NAVIGATION_STATES,
    requiredDockStates: SIMULATION_SCENE_DOCK_STATES,
    requiredLocalToolStates: SIMULATION_SCENE_LOCAL_TOOL_STATES,
    role: 'student',
    acceptedAuthState: 'public',
    requiresNonblankScene: true,
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
  {
    href: '/simulations/dredger',
    routeFile: 'src/app/simulations/dredger/page.tsx',
    archetype: 'dredging-positioning',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: SIMULATION_APP_SHELL_NAVIGATION_STATES,
    requiredDockStates: SIMULATION_SCENE_DOCK_STATES,
    requiredLocalToolStates: SIMULATION_SCENE_LOCAL_TOOL_STATES,
    role: 'student',
    acceptedAuthState: 'public',
    requiresNonblankScene: true,
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
  {
    href: '/interactive-learning/control-workbench',
    routeFile: 'src/app/interactive-learning/control-workbench/page.tsx',
    archetype: 'control-workbench-regression',
    requiredThemes: SIMULATION_VISUAL_QA_REQUIRED_THEMES,
    requiredWidths: SIMULATION_VISUAL_QA_REQUIRED_WIDTHS,
    requiredNavigationStates: ['desktop-expanded', 'desktop-collapsed', 'mobile-drawer'],
    requiredDockStates: ['required'],
    requiredLocalToolStates: ['not-applicable'],
    role: 'student',
    acceptedAuthState: 'public',
    reactDoctorCommand: SIMULATION_REACT_DOCTOR_COMMAND,
  },
] as const;

const REQUIRED_COMMERCIAL_STUDENT_INTENTS = ['learn', 'practice', 'challenge', 'experiment', 'review', 'account-profile'];
const REQUIRED_STUDENT_CORE_ENTRY_IDS = [
  'student-simulations',
  'student-knowledge',
  'student-arena',
  'student-control-workbench',
  'student-adaptive-learning',
  'student-interactive-learning',
];
const REQUIRED_STUDENT_DESTINATION_HREFS = [
  '/simulations',
  '/knowledge',
  '/arena',
  '/interactive-learning/control-workbench',
  '/assessment/adaptive-practice',
  '/interactive-learning',
  '/profile/evidence',
];
const REQUIRED_NAVIGATION_ALIASES = ['/interactive-learning/control-workbench?mode=explore&preset=classic-four-view'];
const REQUIRED_STUDENT_PROFILE_HREF = '/profile';
const REQUIRED_STUDENT_COCKPIT_HREF = '/dashboard';
const FORBIDDEN_STUDENT_DESTINATION_HREFS = ['/data-center'];
const SECONDARY_NAVIGATION_DEPENDENCY_CHANGES = [
  'fix-app-shell-collapsed-navigation-contract',
  'migrate-student-secondary-routes-to-unified-shell',
  'migrate-knowledge-map-to-unified-shell-panels',
  'restrict-data-center-to-operations-roles',
] as const;
const KNOWLEDGE_LOCAL_TOOL_IDS = [
  'chapter-directory',
  'graph-filters',
  'graph-legend',
  'node-resource-panel',
] as const;
const DATA_CENTER_LOCAL_TOOL_IDS = ['source-selector', 'report-export'] as const;

export const DEFAULT_SECONDARY_NAVIGATION_DEPENDENCIES: CommercialSecondaryRouteDependency[] =
  SECONDARY_NAVIGATION_DEPENDENCY_CHANGES.map((change) => ({ change, status: 'complete' }));

export const DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX: CommercialSecondaryRouteGovernanceEntry[] = [
  secondaryRouteGovernanceEntry('/arena', 'student', {
    shellType: 'approved-workspace-shell',
    collapseBehavior: 'collapsible-left-rail',
    upstreamDependencies: ['fix-app-shell-collapsed-navigation-contract'],
  }),
  secondaryRouteGovernanceEntry('/arena/challenges/[taskId]', 'guest', {
    shellType: 'approved-workspace-shell',
    collapseBehavior: 'collapsible-left-rail',
    upstreamDependencies: ['fix-app-shell-collapsed-navigation-contract'],
  }),
  secondaryRouteGovernanceEntry('/interactive-learning/control-workbench', 'student', {
    collapseBehavior: 'collapsible-left-rail',
    upstreamDependencies: ['fix-app-shell-collapsed-navigation-contract'],
  }),
  secondaryRouteGovernanceEntry('/interactive-learning', 'student', {
    upstreamDependencies: ['migrate-student-secondary-routes-to-unified-shell'],
    primaryNextAction: {
      href: '/interactive-learning/chapter-components',
      shellType: 'app-shell',
      migrationState: 'migrated',
    },
  }),
  secondaryRouteGovernanceEntry('/interactive-learning/courses', 'student', {
    upstreamDependencies: ['migrate-student-secondary-routes-to-unified-shell'],
    primaryNextAction: {
      href: '/interactive-learning/courses/unit-4-1-design-task-expression',
      shellType: 'app-shell',
      migrationState: 'migrated',
    },
  }),
  secondaryRouteGovernanceEntry('/interactive-learning/chapter-components', 'student', {
    upstreamDependencies: ['migrate-student-secondary-routes-to-unified-shell'],
  }),
  secondaryRouteGovernanceEntry('/interactive-learning/cross-domain-exploration', 'student', {
    upstreamDependencies: ['migrate-student-secondary-routes-to-unified-shell'],
  }),
  secondaryRouteGovernanceEntry('/assessment/adaptive-practice', 'student', {
    upstreamDependencies: ['migrate-student-secondary-routes-to-unified-shell'],
  }),
  secondaryRouteGovernanceEntry('/knowledge', 'student', {
    upstreamDependencies: ['migrate-knowledge-map-to-unified-shell-panels'],
    localPanels: KNOWLEDGE_LOCAL_TOOL_IDS.map((id) => ({ id, disposition: 'local-tool' })),
  }),
  secondaryRouteGovernanceEntry('/data-center', 'teacher', {
    upstreamDependencies: ['restrict-data-center-to-operations-roles'],
    localPanels: DATA_CENTER_LOCAL_TOOL_IDS.map((id) => ({ id, disposition: 'local-tool' })),
  }),
  secondaryRouteGovernanceEntry('/data-center', 'admin', {
    upstreamDependencies: ['restrict-data-center-to-operations-roles'],
    localPanels: DATA_CENTER_LOCAL_TOOL_IDS.map((id) => ({ id, disposition: 'local-tool' })),
  }),
];

function categoryFromRule(rule: CommercialUiGovernanceRule): CommercialUiGovernanceCategory {
  return rule.split('.')[0] as CommercialUiGovernanceCategory;
}

function withCategory(violation: CommercialUiGovernanceViolation): CommercialUiGovernanceViolation {
  return {
    ...violation,
    category: violation.category ?? categoryFromRule(violation.rule),
  };
}

function allowlistMatches(violation: CommercialUiGovernanceViolation, entry: CommercialUiGovernanceAllowlistEntry) {
  const pathMatches = entry.path === violation.path || violation.path.startsWith(`${entry.path}/`);
  const evidenceMatches = !entry.evidence || (
    violation.evidence?.length === entry.evidence.length
    && entry.evidence.every((evidence) => violation.evidence?.includes(evidence))
  );
  return entry.rule === violation.rule && pathMatches && evidenceMatches;
}

function isValidIsoCalendarDate(raw: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function allowlistEntryMissingFields(entry: CommercialUiGovernanceAllowlistEntry, today?: string) {
  const missing: string[] = [];
  if (!entry.id) missing.push('missing id');
  if (!entry.owner) missing.push('missing owner');
  if (!entry.owningChange) missing.push('missing owningChange');
  if (!entry.expiresOn) missing.push('missing expiresOn');
  if (!entry.removalCondition) missing.push('missing removalCondition');
  if (entry.expiresOn && !isValidIsoCalendarDate(entry.expiresOn)) missing.push('invalid expiresOn');
  if (entry.expiresOn && today && isValidIsoCalendarDate(entry.expiresOn) && entry.expiresOn < today) {
    missing.push('expired expiresOn');
  }
  return missing;
}

function buildAllowlistViolations(allowlist: readonly CommercialUiGovernanceAllowlistEntry[], today?: string) {
  return allowlist.flatMap((entry) => {
    const missing = allowlistEntryMissingFields(entry, today);
    return missing.length > 0
      ? [{
          category: 'allowlist' as const,
          path: entry.path,
          rule: 'allowlist.invalid-entry' as const,
          message: 'Commercial UI allowlist entries must be explicit, temporary, and migration-owned.',
          evidence: missing,
        }]
      : [];
  });
}

function buildShellViolations(shellInventory: readonly CommercialShellInventoryEntry[] = []) {
  return shellInventory
    .filter((entry) => !entry.usesRegisteredShell)
    .map((entry) => withCategory({
      path: entry.path,
      rule: 'shell.unregistered-route-frame',
      message: `Route ${entry.route} uses an unregistered route frame.`,
      evidence: [entry.shellName ?? entry.route],
    }));
}

function buildModuleChromeViolations(moduleChromeInventory: readonly CommercialModuleChromeInventoryEntry[] = []) {
  return moduleChromeInventory.flatMap((entry) => {
    const violations: CommercialUiGovernanceViolation[] = [];
    if (!entry.registeredKind) {
      violations.push(withCategory({
        path: entry.path,
        rule: 'module-chrome.unregistered-kind',
        message: `Interactive module ${entry.moduleId} uses unregistered kind ${entry.moduleKind}.`,
        evidence: [entry.lessonId, entry.stepId, entry.moduleKind],
      }));
    }
    if (!entry.usesCommercialChrome) {
      violations.push(withCategory({
        path: entry.path,
        rule: 'module-chrome.private-chrome',
        message: `Interactive module ${entry.moduleId} does not use commercial module chrome.`,
        evidence: [entry.privateChromeComponent ?? entry.moduleId],
      }));
    }
    return violations;
  });
}

function buildStatusViolations(statusInventory: readonly CommercialStatusVocabularyInventoryEntry[] = []) {
  return statusInventory.flatMap((entry) => {
    const violations: CommercialUiGovernanceViolation[] = [];
    if (!entry.registeredStatusColor) {
      violations.push(withCategory({
        path: entry.path,
        rule: 'token.unregistered-status-color',
        message: `Commercial status term ${entry.statusTerm} uses an unregistered status color.`,
        evidence: [entry.statusTerm],
      }));
    }
    if (entry.duplicatesPlatformVocabulary) {
      violations.push(withCategory({
        path: entry.path,
        rule: 'status.duplicate-vocabulary',
        message: `Commercial status term ${entry.statusTerm} duplicates platform status vocabulary.`,
        evidence: [entry.statusTerm],
      }));
    }
    return violations;
  });
}

function buildNavigationViolations(input: CommercialNavigationCoverageInput) {
  const missingIntents = REQUIRED_COMMERCIAL_STUDENT_INTENTS.filter((intent) => !input.intents.includes(intent));
  const missingCoreEntries = REQUIRED_STUDENT_CORE_ENTRY_IDS.filter((entryId) => !input.coreEntryIds.includes(entryId));
  const missingHrefs = REQUIRED_STUDENT_DESTINATION_HREFS.filter((href) => !input.hrefs.includes(href));
  const missingAliases = REQUIRED_NAVIGATION_ALIASES.filter((href) => !input.aliases.includes(href));
  const forbiddenHrefs = FORBIDDEN_STUDENT_DESTINATION_HREFS.filter((href) => input.hrefs.includes(href));
  const violations: CommercialUiGovernanceViolation[] = [];

  if (missingIntents.length > 0) {
    violations.push(withCategory({
      path: 'src/lib/platform-role-navigation.ts',
      rule: 'navigation.intent-coverage',
      message: 'Commercial student navigation lost required learning intent coverage.',
      evidence: missingIntents,
    }));
  }
  if (missingCoreEntries.length > 0 || missingHrefs.length > 0) {
    violations.push(withCategory({
      path: 'src/lib/platform-role-navigation.ts',
      rule: 'navigation.core-destination-coverage',
      message: 'Commercial student navigation lost required core destination coverage.',
      evidence: [...missingCoreEntries, ...missingHrefs],
    }));
  }
  if (missingAliases.length > 0) {
    violations.push(withCategory({
      path: 'src/lib/platform-role-navigation.ts',
      rule: 'navigation.alias-coverage',
      message: 'Commercial student navigation lost required route alias coverage.',
      evidence: missingAliases,
    }));
  }
  if (forbiddenHrefs.length > 0) {
    violations.push(withCategory({
      path: 'src/lib/platform-role-navigation.ts',
      rule: 'secondary-navigation.student-data-center-exposure',
      message: 'Student navigation coverage must not expose operations-only Data Center destinations.',
      evidence: forbiddenHrefs,
    }));
  }
  const profileAndCockpitProblems = [
    !input.profileHref ? 'profileHref' : '',
    !input.cockpitHref ? 'cockpitHref' : '',
    input.profileHref && input.profileHref !== REQUIRED_STUDENT_PROFILE_HREF
      ? `profileHref=${input.profileHref}`
      : '',
    input.cockpitHref && input.cockpitHref !== REQUIRED_STUDENT_COCKPIT_HREF
      ? `cockpitHref=${input.cockpitHref}`
      : '',
    input.profileHref && input.cockpitHref && input.profileHref === input.cockpitHref
      ? 'profileHref equals cockpitHref'
      : '',
  ].filter(Boolean);

  if (profileAndCockpitProblems.length > 0) {
    violations.push(withCategory({
      path: 'src/lib/platform-role-navigation.ts',
      rule: 'navigation.profile-cockpit-semantics',
      message: 'Commercial navigation must keep profile and cockpit semantics separate and reachable.',
      evidence: profileAndCockpitProblems,
    }));
  }

  return violations;
}

function secondaryRouteGovernanceEntry(
  href: string,
  role: CommercialSecondaryRouteGovernanceEntry['role'],
  overrides: Partial<CommercialSecondaryRouteGovernanceEntry> = {},
): CommercialSecondaryRouteGovernanceEntry {
  const route = resolvePlatformRouteInventory(href);
  const shellType = overrides.shellType
    ?? (route?.legacyShell?.disposition === 'retained-temporary' ? 'temporary-adapter' : 'app-shell');
  return {
    href,
    role,
    routeFile: route?.routeFile,
    shellType,
    routeArchetype: route?.frame,
    roleScope: route?.roleScope,
    navigationLayers: route?.navigationLayers,
    collapseBehavior: route?.floatingDock === 'hidden' ? 'hidden-immersive' : 'collapsible-left-rail',
    localPanels: [],
    themeSupport: route?.themeSupport,
    mobileBehavior: route?.mobileNavigation,
    owningMigrationChange: route?.unifiedUiMigrationOwner ?? route?.owningChange,
    migrationState: route?.exception ? 'active-exception' : 'migrated',
    upstreamDependencies: SECONDARY_NAVIGATION_DEPENDENCY_CHANGES,
    expectedEntries: [],
    forbiddenEntries: role === 'student' ? FORBIDDEN_STUDENT_DESTINATION_HREFS : [],
    observedNavigationHrefs: [],
    ...overrides,
  };
}

function secondaryRouteKey(entry: Pick<CommercialSecondaryRouteGovernanceEntry, 'href' | 'role'>) {
  return `${entry.href}::${entry.role}`;
}

function secondaryNavigationBlockingEnabled(dependencies: readonly CommercialSecondaryRouteDependency[]) {
  return SECONDARY_NAVIGATION_DEPENDENCY_CHANGES.every((change) => (
    dependencies.some((dependency) => dependency.change === change && dependency.status === 'complete')
  ));
}

function secondaryRouteDependenciesComplete(
  entry: CommercialSecondaryRouteGovernanceEntry,
  dependencies: readonly CommercialSecondaryRouteDependency[],
) {
  const requiredDependencies = entry.upstreamDependencies?.length
    ? entry.upstreamDependencies
    : SECONDARY_NAVIGATION_DEPENDENCY_CHANGES;
  return requiredDependencies.every((change) => (
    dependencies.some((dependency) => dependency.change === change && dependency.status === 'complete')
  ));
}

function activeExceptionProblems(entry: CommercialSecondaryRouteGovernanceEntry, today?: string) {
  if (entry.migrationState !== 'active-exception') return [];
  return [
    !entry.exceptionOwner ? 'exceptionOwner' : '',
    !entry.exceptionExpiresOn ? 'exceptionExpiresOn' : '',
    entry.exceptionExpiresOn && !isValidIsoCalendarDate(entry.exceptionExpiresOn) ? 'exceptionExpiresOn=invalid' : '',
    entry.exceptionExpiresOn && today && isValidIsoCalendarDate(entry.exceptionExpiresOn) && entry.exceptionExpiresOn < today
      ? 'exceptionExpiresOn=expired'
      : '',
    !entry.exceptionRemovalCondition ? 'exceptionRemovalCondition' : '',
  ].filter(Boolean);
}

function firstHopExceptionProblems(firstHop: CommercialSecondaryRouteNextActionEvidence) {
  return [
    !firstHop.exceptionOwner ? 'firstHop.exceptionOwner' : '',
    !firstHop.removalCondition ? 'firstHop.removalCondition' : '',
  ].filter(Boolean);
}

function secondaryNavigationViolation(
  violation: CommercialUiGovernanceViolation,
  dependencies: readonly CommercialSecondaryRouteDependency[],
  entry?: CommercialSecondaryRouteGovernanceEntry,
) {
  const routeBlockingEnabled = !entry || secondaryRouteDependenciesComplete(entry, dependencies);
  const migrated = !entry
    || entry.migrationState === 'migrated'
    || (entry.migrationState === 'blocked-by-upstream' && routeBlockingEnabled);
  return withCategory({
    ...violation,
    enforcement: routeBlockingEnabled && migrated ? 'blocking' : 'advisory',
  });
}

function buildSecondaryNavigationGovernanceViolations(
  matrix: readonly CommercialSecondaryRouteGovernanceEntry[],
  dependencies: readonly CommercialSecondaryRouteDependency[],
  today?: string,
) {
  const matrixKeys = new Set(matrix.map(secondaryRouteKey));
  const missingRouteViolations = DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX
    .filter((expected) => !matrixKeys.has(secondaryRouteKey(expected)))
    .map((expected) => withCategory({
      path: expected.href,
      rule: 'secondary-navigation.incomplete-route-matrix',
      message: 'Secondary route governance matrix is missing a required route and role state.',
      evidence: [`routeRole=${secondaryRouteKey(expected)}`],
      enforcement: secondaryRouteDependenciesComplete(expected, dependencies) ? 'blocking' : 'advisory',
    }));

  const entryViolations = matrix.flatMap((entry) => {
    const violations: CommercialUiGovernanceViolation[] = [];
    const missing = [
      !entry.routeFile ? 'routeFile' : '',
      !entry.shellType ? 'shellType' : '',
      !entry.routeArchetype ? 'routeArchetype' : '',
      !entry.roleScope?.length ? 'roleScope' : '',
      !entry.navigationLayers?.length ? 'navigationLayers' : '',
      !entry.collapseBehavior ? 'collapseBehavior' : '',
      !entry.themeSupport?.includes('light') ? 'themeSupport=light' : '',
      !entry.themeSupport?.includes('dark') ? 'themeSupport=dark' : '',
      !entry.mobileBehavior ? 'mobileBehavior' : '',
      !entry.owningMigrationChange ? 'owningMigrationChange' : '',
      !entry.migrationState ? 'migrationState' : '',
      !entry.upstreamDependencies?.length ? 'upstreamDependencies' : '',
      entry.role === 'student' && !entry.forbiddenEntries?.includes('/data-center') ? 'forbiddenEntries=/data-center' : '',
    ].filter(Boolean);
    const exceptionMissing = activeExceptionProblems(entry, today);
    if (missing.length > 0) {
      violations.push(secondaryNavigationViolation({
        path: entry.href,
        rule: 'secondary-navigation.incomplete-route-matrix',
        message: 'Secondary route governance evidence is missing shell, role, navigation, or migration metadata.',
        evidence: [`role=${entry.role}`, ...missing],
      }, dependencies, entry));
    }
    if (exceptionMissing.length > 0) {
      violations.push(withCategory({
        path: entry.href,
        rule: 'secondary-navigation.incomplete-route-matrix',
        message: 'Active secondary route exceptions must be narrow, owned, dated, and removal-bound.',
        evidence: [`role=${entry.role}`, ...exceptionMissing],
        enforcement: 'blocking',
      }));
    }

    if (entry.migrationState === 'migrated' && entry.shellType === 'legacy-topbar') {
      violations.push(secondaryNavigationViolation({
        path: entry.href,
        rule: 'secondary-navigation.legacy-local-navigation',
        message: 'Migrated secondary routes must not keep unregistered page-local topbar or sidebar shells.',
        evidence: [`role=${entry.role}`, `shellType=${entry.shellType}`],
      }, dependencies, entry));
    }

    const studentNavigationHrefs = [
      ...(entry.expectedEntries ?? []),
      ...(entry.observedNavigationHrefs ?? []),
    ];
    const exposedForbiddenStudentHrefs = entry.role === 'student'
      ? FORBIDDEN_STUDENT_DESTINATION_HREFS.filter((href) => studentNavigationHrefs.includes(href))
      : [];
    if (exposedForbiddenStudentHrefs.length > 0) {
      violations.push(secondaryNavigationViolation({
        path: entry.href,
        rule: 'secondary-navigation.student-data-center-exposure',
        message: 'Student secondary route evidence exposes operations-only Data Center navigation.',
        evidence: [`role=${entry.role}`, ...exposedForbiddenStudentHrefs],
      }, dependencies, entry));
    }

    const firstHop = entry.primaryNextAction;
    if (
      entry.migrationState === 'migrated'
      && firstHop
      && (firstHop.usesLegacyTopbar || firstHop.shellType === 'legacy-topbar')
    ) {
      const firstHopMissing = firstHopExceptionProblems(firstHop);
      if (firstHopMissing.length > 0) {
        violations.push(withCategory({
          path: entry.href,
          rule: 'secondary-navigation.incomplete-route-matrix',
          message: 'Legacy first-hop exceptions must be owned and removal-bound.',
          evidence: [`role=${entry.role}`, `next=${firstHop.href}`, ...firstHopMissing],
          enforcement: 'blocking',
        }));
      }
    }

    const requiredLocalTools = entry.href === '/knowledge'
      ? KNOWLEDGE_LOCAL_TOOL_IDS
      : entry.href === '/data-center'
        ? DATA_CENTER_LOCAL_TOOL_IDS
        : [];
    const localToolProblems = [
      ...requiredLocalTools
        .filter((id) => !entry.localPanels?.some((panel) => panel.id === id && panel.disposition === 'local-tool'))
        .map((id) => `localTool=${id}`),
      ...(entry.localPanels ?? [])
        .filter((panel) => panel.disposition !== 'local-tool')
        .map((panel) => `${panel.id}:${panel.disposition}`),
    ];
    if (localToolProblems.length > 0) {
      violations.push(secondaryNavigationViolation({
        path: entry.href,
        rule: 'secondary-navigation.local-tool-boundary',
        message: 'Workspace filters, legends, directories, selectors, and panels must remain local tools, not platform navigation.',
        evidence: [`role=${entry.role}`, ...localToolProblems],
      }, dependencies, entry));
    }

    return violations;
  });

  return [...missingRouteViolations, ...entryViolations];
}

function findViewport<TViewport extends { width: number }>(viewports: readonly TViewport[], width: number) {
  return viewports.find((viewport) => viewport.width === width);
}

function buildVisualViolations(
  requiredRoutes: readonly CommercialVisualAcceptanceRoute[],
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[],
) {
  return requiredRoutes.flatMap((route) => {
    const routeEvidence = visualEvidence.find((entry) => entry.href === route.href);
    if (!routeEvidence) {
      return [withCategory({
        path: route.href,
        rule: 'visual-acceptance.missing-route-evidence',
        message: 'Commercial UI route is missing visual acceptance evidence.',
        evidence: route.requiredWidths.map((width) => `width=${width}`),
      })];
    }
    return route.requiredWidths.flatMap((width) => {
      const viewport = findViewport(routeEvidence.viewports, width);
      const missing = [
        !viewport?.screenshot && !viewport?.artifact ? 'screenshot or artifact' : '',
        !viewport?.firstViewportUseful ? 'firstViewportUseful' : '',
        !viewport?.navigationReachable ? 'navigationReachable' : '',
        !viewport?.noTextOverlap ? 'noTextOverlap' : '',
        !viewport?.stablePanelGeometry ? 'stablePanelGeometry' : '',
        !viewport?.coherentBrandApplication ? 'coherentBrandApplication' : '',
        !viewport?.taskControlsVisible ? 'taskControlsVisible' : '',
      ].filter(Boolean);
      return missing.length > 0
        ? [withCategory({
            path: route.href,
            rule: 'visual-acceptance.incomplete-evidence',
            message: 'Commercial UI route has incomplete visual acceptance evidence.',
            evidence: [`width=${width}`, ...missing],
          })]
        : [];
    });
  });
}

function findPremiumViewport(
  viewports: readonly CommercialViewportVisualEvidence[],
  width: number,
  theme: CommercialVisualQaTheme,
  route: CommercialPremiumVisualQaRoute,
) {
  const expectedFinalUrl = route.acceptedAuthState === 'unauth-redirect-fallback' ? '/login' : route.href;
  return viewports.find((viewport) => (
    viewport.width === width
    && viewport.theme === theme
    && viewport.authState === route.acceptedAuthState
    && viewport.role === route.role
    && viewport.finalUrl?.endsWith(expectedFinalUrl)
  ));
}

function normalizeVisualDockState(
  dockState?: CommercialViewportVisualEvidence['dockState'],
): CommercialPremiumVisualQaRoute['floatingDock'] | undefined {
  if (!dockState) return undefined;
  return dockState === 'enabled' ? 'required' : dockState;
}

function isLoginRedirectViewport(viewport: CommercialViewportVisualEvidence) {
  if (viewport.authState !== 'unauth-redirect-fallback' || !viewport.finalUrl) return false;
  try {
    return new URL(viewport.finalUrl).pathname === '/login';
  } catch {
    return viewport.finalUrl.endsWith('/login');
  }
}

function buildPremiumVisualQaViolations(
  requiredRoutes: readonly CommercialPremiumVisualQaRoute[],
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[],
) {
  return requiredRoutes.flatMap((route) => {
    const routeEvidence = visualEvidence.find((entry) => entry.href === route.href);
    if (!routeEvidence) {
      return [withCategory({
        path: route.href,
        rule: 'visual-acceptance.missing-route-evidence',
        message: 'Premium platform route is missing structured visual QA evidence.',
        evidence: route.requiredThemes.flatMap((theme) => route.requiredWidths.map((width) => `${theme}:${width}`)),
      })];
    }
    return route.requiredThemes.flatMap((theme) => route.requiredWidths.flatMap((width) => {
      const viewport = findPremiumViewport(routeEvidence.viewports, width, theme, route);
      const expectedFinalUrl = route.acceptedAuthState === 'unauth-redirect-fallback' ? '/login' : route.href;
      const dockFieldsRequired = route.floatingDock !== 'hidden';
      const missing = [
        !viewport?.screenshot && !viewport?.artifact ? 'screenshot or artifact' : '',
        viewport?.requestedRoute !== route.href ? 'requestedRoute' : '',
        !viewport?.finalUrl?.endsWith(expectedFinalUrl) ? `finalUrl=${expectedFinalUrl}` : '',
        viewport?.authState !== route.acceptedAuthState ? `authState=${route.acceptedAuthState}` : '',
        viewport?.role !== route.role ? `role=${route.role}` : '',
        normalizeVisualDockState(viewport?.dockState) !== route.floatingDock ? `dockState=${route.floatingDock}` : '',
        dockFieldsRequired && !viewport?.dockPlacementChecked ? 'dockPlacementChecked' : '',
        dockFieldsRequired && !viewport?.noDockCollision ? 'noDockCollision' : '',
        dockFieldsRequired && !viewport?.dockFocusReachable ? 'dockFocusReachable' : '',
      ].filter(Boolean);
      return missing.length > 0
        ? [withCategory({
            path: route.href,
            rule: 'visual-acceptance.incomplete-premium-theme-evidence',
            message: 'Premium platform route has incomplete theme, auth, or dock evidence.',
            evidence: [`theme=${theme}`, `width=${width}`, ...missing],
          })]
        : [];
    }));
  });
}

const ALLOWED_PRIMARY_ROUTE_ARCHETYPES: readonly PlatformPrimaryRouteFrame[] = [
  'public-entry',
  'learning-atlas',
  'mission-workspace',
  'knowledge-data-map',
  'operations-console',
  'report-ledger',
];

function buildRouteLedgerViolations(routeInventory: readonly PlatformPrimaryRouteInventoryEntry[]) {
  return routeInventory.flatMap((route) => {
    const missing = [
      !route.owningChange ? 'owningChange' : '',
      !route.routeFile ? 'routeFile' : '',
      !route.themeSupport.includes('light') ? 'themeSupport=light' : '',
      route.navigationLayers.length === 0 ? 'navigationLayers' : '',
      !route.mobileNavigation ? 'mobileNavigation' : '',
      !route.shellMigrationDisposition ? 'shellMigrationDisposition' : '',
      !route.shellRemovalCondition ? 'shellRemovalCondition' : '',
      !route.unifiedUiMigrationOwner && !route.exception ? 'unifiedUiMigrationOwner' : '',
      route.unifiedUiMigrationOwner && route.exception ? 'unifiedUiMigrationOwner+exception.owner' : '',
      route.legacyShell && !route.legacyShell.removalCondition ? 'legacyShell.removalCondition' : '',
      route.exception && (!route.exception.owner || !route.exception.expiresOn || !route.exception.removalCondition)
        ? 'exception.owner/expiresOn/removalCondition'
        : '',
      ...(route.aliases ?? [])
        .filter((alias) => !route.aliasRetirements?.some((retirement) => retirement.alias === alias))
        .map((alias) => `aliasRetirements:${alias}`),
      ...(route.legacyFrameAliases ?? [])
        .filter((alias) => !alias.owningChange || !alias.retirementCondition)
        .map((alias) => `legacyFrameAliases:${alias.alias}`),
    ].filter(Boolean);
    const violations: CommercialUiGovernanceViolation[] = missing.length > 0
      ? [withCategory({
          path: route.href,
          rule: 'route-ledger.incomplete-primary-route',
          message: 'Primary route inventory entry is missing route ledger metadata required by commercial UI governance.',
          evidence: missing,
        })]
      : [];
    if (!ALLOWED_PRIMARY_ROUTE_ARCHETYPES.includes(route.frame)) {
      violations.push(withCategory({
        path: route.href,
        rule: 'route-ledger.outdated-archetype',
        message: 'Primary route inventory entry uses an outdated or unregistered route archetype.',
        evidence: [String(route.frame)],
      }));
    }
    return violations;
  });
}

function buildVisualMatrixDriftViolations(
  routeInventory: readonly PlatformPrimaryRouteInventoryEntry[],
  requiredVisualRoutes: readonly CommercialVisualAcceptanceRoute[],
) {
  const requiredVisualHrefs = new Set(requiredVisualRoutes.map((route) => route.href));
  return routeInventory.flatMap((route) => {
    if (route.screenshotProfile === 'temporary-exception') return [];
    const missing = [
      !requiredVisualHrefs.has(route.href) ? 'requiredVisualRoutes' : '',
    ].filter(Boolean);
    return missing.length > 0
      ? [withCategory({
          path: route.href,
          rule: 'visual-acceptance.route-inventory-drift',
          message: 'Primary route inventory and visual QA route matrix drifted apart.',
          evidence: missing,
        })]
      : [];
  });
}

function buildVisualManifestMetadataViolations(
  routeInventory: readonly PlatformPrimaryRouteInventoryEntry[],
  premiumVisualQaMatrix: readonly CommercialPremiumVisualQaRoute[],
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[],
) {
  return visualEvidence.flatMap((routeEvidence) => {
    const route = findVisualRouteInventoryEntry(routeInventory, routeEvidence.href);
    return routeEvidence.viewports.flatMap((viewport) => {
      const premiumScenario = premiumVisualQaMatrix.find((entry) => (
        entry.href === routeEvidence.href
        && entry.role === viewport.role
        && entry.acceptedAuthState === viewport.authState
        && viewport.theme
        && entry.requiredThemes.includes(viewport.theme)
        && entry.requiredWidths.includes(viewport.width as 1440 | 320)
      ));
      const expectedDockState = normalizeVisualDockState(
        premiumScenario?.floatingDock ?? (isLoginRedirectViewport(viewport) ? 'hidden' : route?.floatingDock),
      );
      const missing = [
        viewport.requestedRoute !== routeEvidence.href ? 'requestedRoute' : '',
        !viewport.routeFile || (route && viewport.routeFile !== route.routeFile) ? 'routeFile' : '',
        !viewport.routeArchetype || (route && viewport.routeArchetype !== route.frame) ? 'routeArchetype' : '',
        !viewport.dockState || (expectedDockState && normalizeVisualDockState(viewport.dockState) !== expectedDockState) ? 'dockState' : '',
        !viewport.navigationState || !COMMERCIAL_VISUAL_QA_NAVIGATION_STATES.includes(viewport.navigationState)
          ? 'navigationState'
          : '',
        !viewport.theme ? 'theme' : '',
        !viewport.role ? 'role' : '',
        !viewport.authState || !COMMERCIAL_VISUAL_QA_AUTH_STATES.includes(viewport.authState) ? 'authState' : '',
        !viewport.finalUrl ? 'finalUrl' : '',
        viewport.result !== 'passed' ? 'result=passed' : '',
        !viewport.firstViewportTaskVisible ? 'firstViewportTaskVisible' : '',
      ].filter(Boolean);
      return missing.length > 0
        ? [withCategory({
            path: routeEvidence.href,
            rule: 'visual-acceptance.incomplete-manifest-metadata',
            message: 'Visual QA artifact manifest is missing structured route metadata.',
            evidence: [`width=${viewport.width}`, ...missing],
          })]
        : [];
    });
  });
}

function findVisualRouteInventoryEntry(
  routeInventory: readonly PlatformPrimaryRouteInventoryEntry[],
  href: string,
) {
  const resolvedRoute = resolvePlatformRouteInventory(href);
  return routeInventory.find((route) => route.href === resolvedRoute?.href)
    ?? resolvedRoute
    ?? routeInventory.find((route) => route.href === href || route.aliases?.includes(href));
}

function visualEvidenceFingerprint(viewport: CommercialViewportVisualEvidence) {
  return `${viewport.screenshot ?? ''}|${viewport.artifact ?? ''}`;
}

function comparableDesktopNavigationScenario(
  a: CommercialViewportVisualEvidence,
  b: CommercialViewportVisualEvidence,
) {
  return (
    a.width === b.width
    && a.theme === b.theme
    && a.role === b.role
    && a.authState === b.authState
    && a.requestedRoute === b.requestedRoute
  );
}

function buildNavigationStateViolations(
  routeInventory: readonly PlatformPrimaryRouteInventoryEntry[],
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[],
) {
  return visualEvidence.flatMap((routeEvidence) => {
    const route = findVisualRouteInventoryEntry(routeInventory, routeEvidence.href);
    if (!route) return [];
    const routeViewports = visualEvidence
      .filter((entry) => entry.href === routeEvidence.href)
      .flatMap((entry) => entry.viewports);
    const expectedMobileState = MOBILE_NAVIGATION_STATE_BY_BEHAVIOR[route.mobileNavigation];
    const missing = [
      !routeViewports.some((viewport) => (
        viewport.width === 1440 && viewport.navigationState === 'desktop-expanded'
      )) ? 'width=1440:navigationState=desktop-expanded' : '',
      !routeViewports.some((viewport) => (
        viewport.width === 1440 && viewport.navigationState === 'desktop-collapsed'
      )) ? 'width=1440:navigationState=desktop-collapsed' : '',
      !routeViewports.some((viewport) => (
        COMMERCIAL_VISUAL_QA_MOBILE_WIDTHS.some((width) => viewport.width === width)
        && viewport.navigationState === expectedMobileState
      )) ? `width=320|390:navigationState=${expectedMobileState}` : '',
    ].filter(Boolean);
    const expandedViewports = routeViewports.filter((viewport) => (
      viewport.width === 1440 && viewport.navigationState === 'desktop-expanded'
    ));
    const reusedCollapsedEvidence = routeViewports.some((viewport) => (
      viewport.width === 1440
      && viewport.navigationState === 'desktop-collapsed'
      && visualEvidenceFingerprint(viewport) !== '|'
      && expandedViewports.some((expanded) => (
        comparableDesktopNavigationScenario(expanded, viewport)
        && visualEvidenceFingerprint(expanded) === visualEvidenceFingerprint(viewport)
      ))
    ));
    if (reusedCollapsedEvidence) {
      missing.push('desktop-collapsed evidence reuses desktop-expanded artifact');
    }
    const appShellContractViewports = routeEvidence.viewports.filter((viewport) => (
      viewport.appShellNavigationContract === 'collapsed-icon-rail'
    ));
    if (appShellContractViewports.length > 0) {
      COMMERCIAL_VISUAL_QA_REQUIRED_THEMES.forEach((theme) => {
        const themedExpanded = appShellContractViewports.find((viewport) => (
          viewport.theme === theme
          && viewport.width === 1440
          && viewport.navigationState === 'desktop-expanded'
        ));
        const themedCollapsed = appShellContractViewports.find((viewport) => (
          viewport.theme === theme
          && viewport.width === 1440
          && viewport.navigationState === 'desktop-collapsed'
        ));
        const themedMobile = appShellContractViewports.find((viewport) => (
          viewport.theme === theme
          && viewport.width === 320
          && viewport.navigationState === expectedMobileState
        ));
        if (!themedExpanded) {
          missing.push(`theme=${theme}:width=1440:navigationState=desktop-expanded`);
        }
        if (!themedCollapsed) {
          missing.push(`theme=${theme}:width=1440:navigationState=desktop-collapsed`);
        }
        if (!themedMobile) {
          missing.push(`theme=${theme}:width=320:navigationState=${expectedMobileState}`);
        }
        if (!themedCollapsed) return;
        if (themedCollapsed.sidebarWidth !== 72) {
          missing.push(`theme=${theme}:desktop-collapsed:sidebarWidth=72`);
        }
        if (
          typeof themedCollapsed.contentWidth !== 'number'
          || typeof themedExpanded?.contentWidth !== 'number'
          || themedCollapsed.contentWidth <= themedExpanded.contentWidth
        ) {
          missing.push(`theme=${theme}:desktop-collapsed:contentWidth>expandedContentWidth`);
        }
        if (!themedCollapsed.activeLinkAriaLabel) {
          missing.push(`theme=${theme}:desktop-collapsed:activeLinkAriaLabel`);
        }
        if (!themedCollapsed.activeLinkTitle) {
          missing.push(`theme=${theme}:desktop-collapsed:activeLinkTitle`);
        }
        if (themedCollapsed.activeLinkText !== '') {
          missing.push(`theme=${theme}:desktop-collapsed:activeLinkText=empty`);
        }
        if (themedCollapsed.horizontalOverflow !== false) {
          missing.push(`theme=${theme}:desktop-collapsed:noHorizontalOverflow`);
        }
      });
    }
    return missing.length > 0
      ? [withCategory({
          path: routeEvidence.href,
          rule: 'visual-acceptance.incomplete-navigation-state-evidence',
          message: 'Visual QA evidence is missing required desktop or mobile navigation state coverage.',
          evidence: missing,
        })]
      : [];
  });
}

function buildMobileStructureViolations(visualEvidence: readonly CommercialVisualAcceptanceEvidence[]) {
  return visualEvidence.flatMap((routeEvidence) => routeEvidence.viewports
    .filter((viewport) => COMMERCIAL_VISUAL_QA_MOBILE_WIDTHS.some((width) => viewport.width === width))
    .flatMap((viewport) => {
      const missing = [
        !viewport.mobileCanvasFirst ? 'mobileCanvasFirst' : '',
        !viewport.noPersistentMobileSidebar ? 'noPersistentMobileSidebar' : '',
        !viewport.noPersistentMobileFilter ? 'noPersistentMobileFilter' : '',
        !viewport.noPersistentWorkbenchPanels ? 'noPersistentWorkbenchPanels' : '',
        !viewport.noPersistentKnowledgeGraphDrawer ? 'noPersistentKnowledgeGraphDrawer' : '',
      ].filter(Boolean);
      return missing.length > 0
        ? [withCategory({
            path: routeEvidence.href,
            rule: 'mobile-structure.desktop-panel-persistence',
            message: 'Mobile evidence must prove desktop sidebars, filters, workbench panels, and graph drawers do not persist as squeezed panels.',
            evidence: [`width=${viewport.width}`, ...missing],
          })]
        : [];
	    }));
}

function commandDeckGeometrySourcePaths(routeFile: string) {
  return [
    routeFile,
    'src/app/simulations/_components/simulation-shell.tsx',
    'src/resources/simulations/components/simulation-ui.tsx',
    'scripts/tests/capture-simulation-command-deck-qa.ts',
  ] as const;
}

function rectWithinViewport(
  rect: CommercialRectEvidence,
  width: number,
  height: number | undefined,
) {
  if (height === undefined) return false;
  return rect.left >= 0 && rect.top >= 0 && rect.right <= width && rect.bottom <= height;
}

function rectWithinRect(rect: CommercialRectEvidence, container: CommercialRectEvidence) {
  return (
    rect.left >= container.left
    && rect.top >= container.top
    && rect.right <= container.right
    && rect.bottom <= container.bottom
  );
}

function buildSimulationVisualQaViolations(
  requiredRoutes: readonly CommercialSimulationVisualQaRoute[],
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[],
) {
  const navigationStatesForSimulationWidth = (
    route: CommercialSimulationVisualQaRoute,
    width: 1440 | 320,
  ) => route.requiredNavigationStates.filter((state) => (
    width === 1440 ? state.startsWith('desktop-') : !state.startsWith('desktop-')
  ));
  const artifactFingerprint = (viewport: CommercialSimulationViewportEvidence) => (
    viewport.screenshotSha256
    ?? viewport.artifactSha256
    ?? ''
  );
  const finalUrlPath = (finalUrl: string | undefined) => {
    if (!finalUrl) return '';
    try {
      return new URL(finalUrl).pathname;
    } catch {
      return finalUrl;
    }
  };

  return requiredRoutes.flatMap((route) => {
    const routeEvidence = visualEvidence.find((entry) => entry.href === route.href);
    const simulationEvidence = routeEvidence?.simulationVisualQa;
    if (!routeEvidence || !simulationEvidence) {
      return [withCategory({
        path: route.href,
        rule: 'simulation-visual-qa.missing-route-evidence',
        message: 'Simulation route is missing structured visual QA evidence.',
        evidence: [
          `archetype=${route.archetype}`,
          ...route.requiredWidths.map((width) => `width=${width}`),
        ],
      })];
    }

    const missing = [
      simulationEvidence.archetype !== route.archetype ? `archetype=${route.archetype}` : '',
      route.finalBehavior && simulationEvidence.virtualLabFinalBehavior !== route.finalBehavior
        ? `virtualLabFinalBehavior=${route.finalBehavior}`
        : '',
      route.href === '/virtual-lab' && simulationEvidence.availabilityConsistentWith !== '/simulations'
        ? 'availabilityConsistentWith=/simulations'
        : '',
      simulationEvidence.hidesInternalModelStatus !== true ? 'hidesInternalModelStatus' : '',
      simulationEvidence.duplicateAssistantEntries !== 0 ? 'duplicateAssistantEntries=0' : '',
      simulationEvidence.unmanagedRightBottomControls !== 0 ? 'unmanagedRightBottomControls=0' : '',
      simulationEvidence.localControlCollisionFree !== true ? 'localControlCollisionFree' : '',
      simulationEvidence.routeInventoryCompatible !== true ? 'routeInventoryCompatible' : '',
      simulationEvidence.modelLibraryCompatible !== true ? 'modelLibraryCompatible' : '',
      route.requiresNonblankScene && simulationEvidence.resourceInternalTheme?.sharedPrimitives !== true
        ? 'resourceInternalTheme.sharedPrimitives'
        : '',
      route.requiresNonblankScene && simulationEvidence.resourceInternalTheme?.panelThemeParity !== true
        ? 'resourceInternalTheme.panelThemeParity'
        : '',
      route.requiresNonblankScene && simulationEvidence.resourceInternalTheme?.localControlsThemeParity !== true
        ? 'resourceInternalTheme.localControlsThemeParity'
        : '',
      route.requiresNonblankScene && simulationEvidence.resourceInternalTheme?.restoreHandlesThemeParity !== true
        ? 'resourceInternalTheme.restoreHandlesThemeParity'
        : '',
      route.requiresNonblankScene && simulationEvidence.resourceInternalTheme?.hardCodedPaletteFindings !== 0
        ? 'resourceInternalTheme.hardCodedPaletteFindings=0'
        : '',
      route.requiresNonblankScene && simulationEvidence.sceneThemeParameters?.lightTemplate !== true
        ? 'sceneThemeParameters.lightTemplate'
        : '',
      route.requiresNonblankScene && simulationEvidence.sceneThemeParameters?.darkTemplate !== true
        ? 'sceneThemeParameters.darkTemplate'
        : '',
      route.requiresNonblankScene && simulationEvidence.sceneThemeParameters?.skyWaterGridFogThemeAware !== true
        ? 'sceneThemeParameters.skyWaterGridFogThemeAware'
        : '',
      route.requiresNonblankScene && simulationEvidence.sceneThemeParameters?.labelHudContrastChecked !== true
        ? 'sceneThemeParameters.labelHudContrastChecked'
        : '',
      route.requiresNonblankScene && simulationEvidence.sceneThemeParameters?.unchangedLightSceneInDarkTheme !== false
        ? 'sceneThemeParameters.unchangedLightSceneInDarkTheme=false'
        : '',
      simulationEvidence.reactDoctorErrorCheck?.localOnly !== true ? 'reactDoctorErrorCheck.localOnly' : '',
      simulationEvidence.reactDoctorErrorCheck?.ciRequired !== false ? 'reactDoctorErrorCheck.ciRequired=false' : '',
      simulationEvidence.reactDoctorErrorCheck?.command !== route.reactDoctorCommand
        ? `reactDoctorCommand=${route.reactDoctorCommand}`
        : '',
      simulationEvidence.reactDoctorErrorCheck?.status !== 'passed' ? 'reactDoctorErrorCheck=passed' : '',
      !simulationEvidence.reactDoctorErrorCheck?.report ? 'reactDoctorErrorCheck.report' : '',
      !simulationEvidence.reactDoctorErrorCheck?.reportSha256 ? 'reactDoctorErrorCheck.reportSha256' : '',
      simulationEvidence.reactDoctorErrorCheck?.ownedDiagnostics !== 0
        ? 'reactDoctorErrorCheck.ownedDiagnostics=0'
        : '',
      simulationEvidence.reactDoctorErrorCheck?.selectedDiagnostics !== 0
        ? 'reactDoctorErrorCheck.selectedDiagnostics=0'
        : '',
    ].filter(Boolean);
    const handoffBaseline = simulationEvidence.handoffBaseline;
    const expectedHandoffBaseline = SIMULATION_PRODUCT_DESIGN_HANDOFF_BASELINE_BY_ROUTE[route.href];
    if (!handoffBaseline) {
      missing.push('handoffBaseline');
    } else if (!expectedHandoffBaseline) {
      missing.push(`handoffBaseline.expectedRoute=${route.href}`);
    } else {
      if (handoffBaseline.change !== SIMULATION_PRODUCT_DESIGN_HANDOFF_CHANGE) {
        missing.push(`handoffBaseline.change=${SIMULATION_PRODUCT_DESIGN_HANDOFF_CHANGE}`);
      }
      if (handoffBaseline.archivePath !== SIMULATION_PRODUCT_DESIGN_HANDOFF_ARCHIVE) {
        missing.push(`handoffBaseline.archivePath=${SIMULATION_PRODUCT_DESIGN_HANDOFF_ARCHIVE}`);
      }
      if (handoffBaseline.designHandoff !== SIMULATION_PRODUCT_DESIGN_HANDOFF_SOURCE) {
        missing.push(`handoffBaseline.designHandoff=${SIMULATION_PRODUCT_DESIGN_HANDOFF_SOURCE}`);
      }
      if (!handoffBaseline.designHandoffSha256) {
        missing.push('handoffBaseline.designHandoffSha256');
      }
      if (handoffBaseline.implementationMatrix !== SIMULATION_PRODUCT_DESIGN_HANDOFF_MATRIX) {
        missing.push(`handoffBaseline.implementationMatrix=${SIMULATION_PRODUCT_DESIGN_HANDOFF_MATRIX}`);
      }
      if (!handoffBaseline.implementationMatrixSha256) {
        missing.push('handoffBaseline.implementationMatrixSha256');
      }
      if (handoffBaseline.route !== route.href) {
        missing.push(`handoffBaseline.route=${route.href}`);
      }
      if (handoffBaseline.handoffSection !== expectedHandoffBaseline.handoffSection) {
        missing.push(`handoffBaseline.handoffSection=${expectedHandoffBaseline.handoffSection}`);
      }
      if (
        !SIMULATION_PRODUCT_DESIGN_CONCEPT_IMAGES.has(handoffBaseline.conceptImage)
        || handoffBaseline.conceptImage !== expectedHandoffBaseline.conceptImage
      ) {
        missing.push(`handoffBaseline.conceptImage=${expectedHandoffBaseline.conceptImage}`);
      }
      if (!handoffBaseline.conceptImageSha256) {
        missing.push('handoffBaseline.conceptImageSha256');
      }
      if (handoffBaseline.implementationScreenshot !== expectedHandoffBaseline.implementationScreenshot) {
        missing.push(`handoffBaseline.implementationScreenshot=${expectedHandoffBaseline.implementationScreenshot}`);
      }
      if (!handoffBaseline.implementationScreenshotSha256) {
        missing.push('handoffBaseline.implementationScreenshotSha256');
      }
      if (handoffBaseline.evidenceHook !== expectedHandoffBaseline.evidenceHook) {
        missing.push(`handoffBaseline.evidenceHook=${expectedHandoffBaseline.evidenceHook}`);
      }
      if (handoffBaseline.independentReviewStatus !== 'passed') {
        missing.push('handoffBaseline.independentReviewStatus=passed');
      }
      if (handoffBaseline.compatibilityRole !== expectedHandoffBaseline.compatibilityRole) {
        missing.push(`handoffBaseline.compatibilityRole=${expectedHandoffBaseline.compatibilityRole ?? 'none'}`);
      }
    }

    const themeArtifactFingerprintsByState = new Map<string, Map<CommercialVisualQaTheme, string>>();
    const artifactFingerprintsByWidth = new Map<number, Map<string, string>>();
    const commandDeckGeometry = simulationEvidence.commandDeckGeometry;

    for (const theme of route.requiredThemes) {
      for (const width of route.requiredWidths) {
        const stateArtifactFingerprints = new Map<string, string>();
        for (const navigationState of navigationStatesForSimulationWidth(route, width)) {
          for (const dockState of route.requiredDockStates) {
            for (const localToolState of route.requiredLocalToolStates) {
              const viewport = simulationEvidence.viewports.find((entry) => (
                entry.theme === theme
                && entry.width === width
                && entry.navigationState === navigationState
                && entry.dockState === dockState
                && entry.localToolState === localToolState
              ));
              const key = `theme=${theme}:width=${width}:navigationState=${navigationState}:dockState=${dockState}:localToolState=${localToolState}`;
              if (!viewport) {
                missing.push(key);
                continue;
              }
              if (!viewport.screenshot) missing.push(`${key}:screenshot`);
              if (!viewport.screenshotSha256) missing.push(`${key}:screenshotSha256`);
              if (viewport.screenshotWidth !== width) {
                missing.push(`${key}:screenshotWidth=${width}`);
              }
              if (
                viewport.screenshotHeight === undefined
                || viewport.screenshotHeight < COMMERCIAL_SIMULATION_MIN_SCREENSHOT_HEIGHT
              ) {
                missing.push(`${key}:screenshotHeight>=${COMMERCIAL_SIMULATION_MIN_SCREENSHOT_HEIGHT}`);
              }
              if (viewport.artifact && !viewport.artifactSha256) missing.push(`${key}:artifactSha256`);
              if (viewport.result !== 'passed') missing.push(`${key}:result=passed`);
              if (viewport.firstViewportTaskVisible !== true) missing.push(`${key}:firstViewportTaskVisible`);
              if (viewport.requestedRoute !== route.href) missing.push(`${key}:requestedRoute=${route.href}`);
              const expectedFinalPath = route.finalBehavior === 'redirects-to-simulations' ? '/simulations' : route.href;
              if (finalUrlPath(viewport.finalUrl) !== expectedFinalPath) {
                missing.push(`${key}:finalUrl=${expectedFinalPath}`);
              }
              if (viewport.role !== route.role) missing.push(`${key}:role=${route.role}`);
              if (viewport.authState !== route.acceptedAuthState) {
                missing.push(`${key}:authState=${route.acceptedAuthState}`);
              }
              if (viewport.routeFile !== route.routeFile) missing.push(`${key}:routeFile=${route.routeFile}`);
              if (route.requiresNonblankScene && viewport.primarySceneNonblank !== true) {
                missing.push(`${key}:primarySceneNonblank`);
              }
              if (route.requiresNonblankScene && viewport.instrumentAreaNonblank !== true) {
                missing.push(`${key}:instrumentAreaNonblank`);
              }
              const fingerprint = artifactFingerprint(viewport);
              if (fingerprint) {
                const stateKey = `${navigationState}/${dockState}/${localToolState}`;
                const routeStateKey = `${theme}/${stateKey}`;
                const themedStateKey = `width=${width}:navigationState=${navigationState}:dockState=${dockState}:localToolState=${localToolState}`;
                const widthFingerprints = artifactFingerprintsByWidth.get(width) ?? new Map();
                const previousRouteStateKey = widthFingerprints.get(fingerprint);
                if (previousRouteStateKey && previousRouteStateKey !== routeStateKey) {
                  missing.push(`width=${width}:visualArtifactUnique=${previousRouteStateKey}->${routeStateKey}`);
                }
                widthFingerprints.set(fingerprint, routeStateKey);
                artifactFingerprintsByWidth.set(width, widthFingerprints);
                stateArtifactFingerprints.set(stateKey, fingerprint);
                const themedFingerprints = themeArtifactFingerprintsByState.get(themedStateKey) ?? new Map();
                themedFingerprints.set(theme, fingerprint);
                themeArtifactFingerprintsByState.set(themedStateKey, themedFingerprints);
              }
            }
          }
        }
        if (
          route.requiredNavigationStates.length > 1
          || route.requiredDockStates.length > 1
          || route.requiredLocalToolStates.length > 1
        ) {
          const seen = new Map<string, string>();
          for (const [stateKey, fingerprint] of stateArtifactFingerprints) {
            const previousStateKey = seen.get(fingerprint);
            if (previousStateKey && previousStateKey !== stateKey) {
              missing.push(
                `theme=${theme}:width=${width}:stateArtifactUnique=${previousStateKey}->${stateKey}`,
              );
            }
            seen.set(fingerprint, stateKey);
          }
        }
      }
    }

    if (route.requiresNonblankScene) {
      if (!commandDeckGeometry) {
        missing.push('commandDeckGeometry');
      } else {
        if (commandDeckGeometry.change !== 'normalize-simulation-command-deck-layout') {
          missing.push('commandDeckGeometry.change=normalize-simulation-command-deck-layout');
        }
        for (const sourcePath of commandDeckGeometrySourcePaths(route.routeFile)) {
          if (!commandDeckGeometry.sourceSha256?.[sourcePath]) {
            missing.push(`commandDeckGeometry.sourceSha256.${sourcePath}`);
            continue;
          }
          if (!commandDeckGeometry.currentSourceSha256?.[sourcePath]) {
            missing.push(`commandDeckGeometry.currentSourceSha256.${sourcePath}`);
            continue;
          }
          if (commandDeckGeometry.sourceSha256[sourcePath] !== commandDeckGeometry.currentSourceSha256[sourcePath]) {
            missing.push(`commandDeckGeometry.sourceSha256.${sourcePath}=current`);
          }
        }
        for (const theme of route.requiredThemes) {
          for (const width of route.requiredWidths) {
            const viewport = commandDeckGeometry.viewports.find((entry) => (
              entry.theme === theme && entry.width === width
            ));
            const key = `commandDeckGeometry:theme=${theme}:width=${width}`;
            if (!viewport) {
              missing.push(key);
              continue;
            }
            if (!viewport.screenshot) missing.push(`${key}:screenshot`);
            if (!viewport.screenshotSha256) missing.push(`${key}:screenshotSha256`);
            if (viewport.screenshotWidth !== width) missing.push(`${key}:screenshotWidth=${width}`);
            if (
              viewport.screenshotHeight === undefined
              || viewport.screenshotHeight < COMMERCIAL_SIMULATION_MIN_SCREENSHOT_HEIGHT
            ) {
              missing.push(`${key}:screenshotHeight>=${COMMERCIAL_SIMULATION_MIN_SCREENSHOT_HEIGHT}`);
            }
            if (viewport.sceneChromeRemoved !== true) missing.push(`${key}:sceneChromeRemoved`);
            if (viewport.inSceneBackControlCount !== 0) missing.push(`${key}:inSceneBackControlCount=0`);
            if (viewport.inSceneAbbreviationCount !== 0) missing.push(`${key}:inSceneAbbreviationCount=0`);
            if (width === 1440 && (viewport.collapseButtonCount ?? 0) < 2) {
              missing.push(`${key}:collapseButtonCount>=2`);
            }
            if (width === 320 && (viewport.restoreHandleCount ?? 0) < 2) {
              missing.push(`${key}:restoreHandleCount>=2`);
            }
            if (viewport.panelsTopAligned !== true) missing.push(`${key}:panelsTopAligned`);
            if (width === 1440) {
              for (const [rectKey, panelRect] of [
                ['statusPanelRect', viewport.statusPanelRect],
                ['controlPanelRect', viewport.controlPanelRect],
              ] as const) {
                if (!panelRect) {
                  missing.push(`${key}:${rectKey}`);
                  continue;
                }
                if (!rectWithinViewport(panelRect, width, viewport.screenshotHeight)) {
                  missing.push(`${key}:${rectKey}WithinViewport`);
                }
                if (!viewport.sceneRect || !rectWithinRect(panelRect, viewport.sceneRect)) {
                  missing.push(`${key}:${rectKey}WithinScene`);
                }
              }
            }
            if (viewport.bottomToolsUnobscured !== true) missing.push(`${key}:bottomToolsUnobscured`);
            if (viewport.bottomToolsWithinViewport !== true) missing.push(`${key}:bottomToolsWithinViewport`);
            for (const role of ['view-switcher', 'grid-toggle', 'speed-controls']) {
              if (!viewport.bottomToolSegmentRoles?.includes(role)) {
                missing.push(`${key}:bottomToolSegmentRoles.${role}`);
              }
            }
            if (viewport.konlingDockCollisionFree !== true) missing.push(`${key}:konlingDockCollisionFree`);
            if (viewport.restoreHandlesKeyboardReachable !== true) {
              missing.push(`${key}:restoreHandlesKeyboardReachable`);
            }
            if (viewport.primarySceneNonblank !== true) missing.push(`${key}:primarySceneNonblank`);
          }
        }
        if (route.href === '/simulations/cruise') {
          const comparison = commandDeckGeometry.cruiseComparison;
          if (!comparison) {
            missing.push('commandDeckGeometry.cruiseComparison');
          } else {
            if (!comparison.comparedRoutes.includes('/simulations/destroyer')) {
              missing.push('commandDeckGeometry.cruiseComparison.comparedRoutes.destroyer');
            }
            if (!comparison.comparedRoutes.includes('/simulations/lng')) {
              missing.push('commandDeckGeometry.cruiseComparison.comparedRoutes.lng');
            }
            if (comparison.desktopSceneWidthRatioToMedian < 0.9) {
              missing.push('commandDeckGeometry.cruiseComparison.desktopSceneWidthRatioToMedian>=0.9');
            }
            if (comparison.desktopSceneHeightRatioToMedian > 1.25) {
              missing.push('commandDeckGeometry.cruiseComparison.desktopSceneHeightRatioToMedian<=1.25');
            }
            if (comparison.contextPlacement !== 'below-primary-scene') {
              missing.push('commandDeckGeometry.cruiseComparison.contextPlacement=below-primary-scene');
            }
            if (comparison.mobileSceneFirst !== true) {
              missing.push('commandDeckGeometry.cruiseComparison.mobileSceneFirst');
            }
          }
        }
      }
    }

    for (const [stateKey, themedFingerprints] of themeArtifactFingerprintsByState) {
      const seen = new Map<string, CommercialVisualQaTheme>();
      for (const theme of route.requiredThemes) {
        const fingerprint = themedFingerprints.get(theme);
        if (!fingerprint) continue;
        const previousTheme = seen.get(fingerprint);
        if (previousTheme && previousTheme !== theme) {
          missing.push(`${stateKey}:themeArtifactUnique=${previousTheme}->${theme}`);
        }
        seen.set(fingerprint, theme);
      }
    }

    return missing.length > 0
      ? [withCategory({
          path: route.href,
          rule: 'simulation-visual-qa.incomplete-evidence',
          message: 'Simulation route visual QA evidence is incomplete or conflicts with the route matrix.',
          evidence: missing,
        })]
      : [];
  });
}

const INTERACTIVE_LEARNING_PRODUCT_QA_HANDOFF =
  'artifacts/product-design-audits/interactive-learning-2026-06-14/design-handoff.md';
const INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX =
  'artifacts/product-design-audits/interactive-learning-2026-06-14/evidence/govern-interactive-learning-product-qa/handoff-to-implementation-matrix.md';
const ADAPTIVE_PATH_PRODUCT_QA_HANDOFF =
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/design-handoff.md';
const ADAPTIVE_PATH_PRODUCT_QA_MATRIX =
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/evidence/govern-adaptive-path-product-qa/handoff-to-implementation-matrix.md';
const ADAPTIVE_PATH_PRODUCT_QA_CAPTURE_MANIFEST =
  'artifacts/commercial-ui/adaptive-path-product-qa-516/capture-manifest.json';
const ADAPTIVE_PATH_PRODUCT_QA_VISUAL_SIGNALS =
  'artifacts/commercial-ui/adaptive-path-product-qa-516/visual-signals.json';

const REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_CHILD_CHANGES = [
  'unify-interactive-learning-atlas-shell',
  'migrate-interactive-course-entry-shell',
  'standardize-interactive-classroom-entry',
  'standardize-lesson-runtime-shell',
  'define-interactive-module-visual-standards',
] as const;
const REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CHILD_CHANGES = [
  'generalize-adaptive-learning-path-generation',
  'govern-adaptive-path-resource-nodes',
  'add-konling-path-generation-tools',
  'redesign-adaptive-path-generation-selection-ui',
  'build-adaptive-path-execution-history-ui',
] as const;

const REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES = [
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/01-path-generation-main.png',
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/02-path-selection-comparison.png',
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/03-active-path-execution.png',
  'artifacts/product-design-audits/adaptive-learning-path-2026-06-14/concepts/04-history-evidence-record.png',
] as const;

const REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_IDS = [
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
const REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_MATRIX_IDS = [
  'generation-main-desktop-light',
  'generation-main-mobile-dark',
  'konling-parameter-panel-desktop-dark',
  'cold-start-starter-paths-mobile-light',
  'path-comparison-desktop-light',
  'path-comparison-mobile-dark',
  'active-path-execution-desktop-light',
  'active-path-execution-mobile-dark',
  'node-detail-desktop-light',
  'skip-warning-desktop-light',
  'history-evidence-desktop-light',
  'history-evidence-mobile-dark',
  'app-shell-expanded-dock-desktop-dark',
] as const;

const REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA = {
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
} as const satisfies Record<
  typeof REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_IDS[number],
  Pick<CommercialInteractiveLearningProductQaMatrixEntry, 'route' | 'role' | 'theme' | 'viewport' | 'sourceConcept'>
>;
const REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_MATRIX_METADATA = {
  'generation-main-desktop-light': {
    route: '/assessment/adaptive-practice',
    goal: 'frequency-response-foundations',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    authState: 'authenticated',
    navigationState: 'desktop-collapsed',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[0],
  },
  'generation-main-mobile-dark': {
    route: '/assessment/adaptive-practice',
    goal: 'frequency-response-foundations',
    role: 'student',
    theme: 'dark',
    viewport: 'mobile',
    authState: 'authenticated',
    navigationState: 'workspace-command-surface',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[0],
  },
  'konling-parameter-panel-desktop-dark': {
    route: '/assessment/adaptive-practice',
    goal: 'frequency-response-foundations',
    role: 'student',
    theme: 'dark',
    viewport: 'desktop',
    authState: 'authenticated',
    navigationState: 'desktop-collapsed',
    dockState: 'expanded',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[0],
  },
  'cold-start-starter-paths-mobile-light': {
    route: '/assessment/adaptive-practice',
    goal: 'frequency-response-foundations',
    role: 'student',
    theme: 'light',
    viewport: 'mobile',
    authState: 'authenticated',
    navigationState: 'workspace-command-surface',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[0],
  },
  'path-comparison-desktop-light': {
    route: '/assessment/adaptive-practice',
    goal: 'frequency-response-foundations',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    authState: 'authenticated',
    navigationState: 'desktop-collapsed',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[1],
  },
  'path-comparison-mobile-dark': {
    route: '/assessment/adaptive-practice',
    goal: 'frequency-response-foundations',
    role: 'student',
    theme: 'dark',
    viewport: 'mobile',
    authState: 'authenticated',
    navigationState: 'workspace-command-surface',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[1],
  },
  'active-path-execution-desktop-light': {
    route: '/assessment/adaptive-practice',
    goal: 'control-correction',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    authState: 'authenticated',
    navigationState: 'desktop-collapsed',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[2],
  },
  'active-path-execution-mobile-dark': {
    route: '/assessment/adaptive-practice',
    goal: 'control-correction',
    role: 'student',
    theme: 'dark',
    viewport: 'mobile',
    authState: 'authenticated',
    navigationState: 'workspace-command-surface',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[2],
  },
  'node-detail-desktop-light': {
    route: '/assessment/adaptive-practice',
    goal: 'control-correction',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    authState: 'authenticated',
    navigationState: 'desktop-collapsed',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[2],
  },
  'skip-warning-desktop-light': {
    route: '/assessment/adaptive-practice',
    goal: 'control-correction',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    authState: 'authenticated',
    navigationState: 'desktop-collapsed',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[2],
  },
  'history-evidence-desktop-light': {
    route: '/assessment/adaptive-practice',
    goal: 'control-correction',
    role: 'student',
    theme: 'light',
    viewport: 'desktop',
    authState: 'authenticated',
    navigationState: 'desktop-collapsed',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[3],
  },
  'history-evidence-mobile-dark': {
    route: '/assessment/adaptive-practice',
    goal: 'control-correction',
    role: 'student',
    theme: 'dark',
    viewport: 'mobile',
    authState: 'authenticated',
    navigationState: 'workspace-command-surface',
    dockState: 'collapsed',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[3],
  },
  'app-shell-expanded-dock-desktop-dark': {
    route: '/assessment/adaptive-practice',
    goal: 'control-correction',
    role: 'student',
    theme: 'dark',
    viewport: 'desktop',
    authState: 'authenticated',
    navigationState: 'desktop-expanded',
    dockState: 'expanded',
    sourceConcept: REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES[2],
  },
} as const satisfies Record<
  typeof REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_MATRIX_IDS[number],
  Pick<
    CommercialAdaptivePathProductQaMatrixEntry,
    'route' | 'goal' | 'role' | 'theme' | 'viewport' | 'authState' | 'navigationState' | 'dockState' | 'sourceConcept'
  >
>;

const REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_REGRESSION_CHECKS = [
  'sharedShellNavigationDock',
  'teacherNoStudentInputs',
  'teacherNoPermanentRightDrawer',
  'teacherNoTopDuplicateNext',
  'teacherBottomNavHasPageJump',
  'konlingRightBottomOnly',
  'studentGuestNoTeacherStats',
  'courseShellNoPrimaryPremiumLessonShell',
  'standardModuleChromeRegistered',
] as const;
const REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_FUNCTIONAL_GATES = [
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildInteractiveLearningProductQaViolations(
  evidence: CommercialInteractiveLearningProductQaEvidence | undefined,
  required = false,
  sourceRefreshRequired = false,
  evidenceRefreshed = false,
) {
  if (!evidence) {
    return required ? [withCategory({
      path: INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX,
      rule: 'interactive-learning-product-qa.missing-evidence' as const,
      message: 'Interactive learning product QA evidence is missing.',
      evidence: ['govern-interactive-learning-product-qa'],
    })] : [];
  }

  const rawConceptImages = Array.isArray(evidence.conceptImages) ? evidence.conceptImages : [];
  const conceptImages = rawConceptImages.filter((entry): entry is string => typeof entry === 'string');
  const rawChildDesignQaReports = Array.isArray(evidence.childDesignQaReports) ? evidence.childDesignQaReports : [];
  const childDesignQaReports = rawChildDesignQaReports.filter(isRecord) as Partial<CommercialInteractiveLearningDesignQaReportEvidence>[];
  const rawRouteMatrix = Array.isArray(evidence.routeMatrix) ? evidence.routeMatrix : [];
  const routeMatrix = rawRouteMatrix.filter(isRecord) as Partial<CommercialInteractiveLearningProductQaMatrixEntry>[];
  const rawTemporaryExceptions = Array.isArray(evidence.temporaryExceptions) ? evidence.temporaryExceptions : [];
  const temporaryExceptions = rawTemporaryExceptions.filter(isRecord) as Array<Partial<{ owner: string; removalCondition: string }>>;
  const independentVisualReview = isRecord(evidence.independentVisualReview) ? evidence.independentVisualReview : {
    status: 'not-run',
    reviewer: '',
    report: '',
  } as Partial<CommercialInteractiveLearningProductQaReviewEvidence>;
  const missing = [
    evidence.parseError ? `parseError=${evidence.parseError}` : '',
    evidence.change !== 'govern-interactive-learning-product-qa' ? 'change=govern-interactive-learning-product-qa' : '',
    !evidence.generatedAt ? 'generatedAt' : '',
    !evidence.sourceCommit ? 'sourceCommit' : '',
    sourceRefreshRequired && !evidenceRefreshed ? 'sourceCommit=refreshed-for-current-source-change' : '',
    evidence.designHandoff !== INTERACTIVE_LEARNING_PRODUCT_QA_HANDOFF
      ? `designHandoff=${INTERACTIVE_LEARNING_PRODUCT_QA_HANDOFF}`
      : '',
    !evidence.designHandoffSha256 ? 'designHandoffSha256' : '',
    evidence.designHandoffSha256 && evidence.designHandoffSha256 !== evidence.currentDesignHandoffSha256
      ? 'designHandoffSha256=current'
      : '',
    evidence.handoffMatrix !== INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX
      ? `handoffMatrix=${INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX}`
      : '',
    !evidence.handoffMatrixSha256 ? 'handoffMatrixSha256' : '',
    evidence.handoffMatrixSha256 && evidence.handoffMatrixSha256 !== evidence.currentHandoffMatrixSha256
      ? 'handoffMatrixSha256=current'
      : '',
    independentVisualReview.status !== 'passed' ? 'independentVisualReview.status=passed' : '',
    independentVisualReview.reviewer !== 'ui-flow-reviewer' ? 'independentVisualReview.reviewer=ui-flow-reviewer' : '',
    !independentVisualReview.report ? 'independentVisualReview.report' : '',
    !independentVisualReview.reportSha256 ? 'independentVisualReview.reportSha256' : '',
    independentVisualReview.reportSha256
      && independentVisualReview.reportSha256 !== independentVisualReview.currentReportSha256
      ? 'independentVisualReview.reportSha256=current'
      : '',
    independentVisualReview.reportHasPassVerdict !== true
      ? 'independentVisualReview.reportHasPassVerdict=true'
      : '',
    independentVisualReview.reportHasNoUnresolvedBlocks !== true
      ? 'independentVisualReview.reportHasNoUnresolvedBlocks=true'
      : '',
    temporaryExceptions.length > 0
      && temporaryExceptions.some((entry) => !entry.owner || !entry.removalCondition)
      ? 'temporaryExceptions.owner/removalCondition'
      : '',
    !Array.isArray(evidence.conceptImages) ? 'conceptImages=array' : '',
    !Array.isArray(evidence.childDesignQaReports) ? 'childDesignQaReports=array' : '',
    !Array.isArray(evidence.routeMatrix) ? 'routeMatrix=array' : '',
    !Array.isArray(evidence.temporaryExceptions) ? 'temporaryExceptions=array' : '',
    rawConceptImages.length !== conceptImages.length ? 'conceptImages.entry=string' : '',
    rawChildDesignQaReports.length !== childDesignQaReports.length ? 'childDesignQaReports.entry=object' : '',
    rawRouteMatrix.length !== routeMatrix.length ? 'routeMatrix.entry=object' : '',
    rawTemporaryExceptions.length !== temporaryExceptions.length ? 'temporaryExceptions.entry=object' : '',
    !isRecord(evidence.independentVisualReview) ? 'independentVisualReview=object' : '',
  ].filter(Boolean);

  for (const change of REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_CHILD_CHANGES) {
    const report = childDesignQaReports.find((entry) => entry.change === change);
    if (!report) {
      missing.push(`childDesignQaReports.${change}`);
      continue;
    }
    if (report.finalResult !== 'passed') missing.push(`childDesignQaReports.${change}.finalResult=passed`);
    if (report.reportFinalResult !== 'passed') missing.push(`childDesignQaReports.${change}.reportFinalResult=passed`);
    if (!report.report) missing.push(`childDesignQaReports.${change}.report`);
    if (!report.reportSha256) missing.push(`childDesignQaReports.${change}.reportSha256`);
    if (report.reportSha256 && report.reportSha256 !== report.currentReportSha256) {
      missing.push(`childDesignQaReports.${change}.reportSha256=current`);
    }
  }

  for (const conceptImage of conceptImages) {
    if (!evidence.conceptImageSha256?.[conceptImage]) {
      missing.push(`conceptImageSha256.${conceptImage}`);
    }
    if (
      evidence.conceptImageSha256?.[conceptImage]
      && evidence.conceptImageSha256[conceptImage] !== evidence.currentConceptImageSha256?.[conceptImage]
    ) {
      missing.push(`conceptImageSha256.${conceptImage}=current`);
    }
  }
  const acceptedConceptImages = new Set(conceptImages);

  for (const id of REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_IDS) {
    const entry = routeMatrix.find((item) => item.id === id);
    if (!entry) {
      missing.push(`routeMatrix.${id}`);
      continue;
    }
    if (entry.result !== 'passed') missing.push(`routeMatrix.${id}.result=passed`);
    if (!entry.route) missing.push(`routeMatrix.${id}.route`);
    if (entry.route && entry.route !== REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].route) {
      missing.push(`routeMatrix.${id}.route=${REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].route}`);
    }
    if (!entry.role) missing.push(`routeMatrix.${id}.role`);
    if (entry.role && !COMMERCIAL_VISUAL_QA_ROLES.includes(entry.role)) missing.push(`routeMatrix.${id}.role=valid`);
    if (entry.role && entry.role !== REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].role) {
      missing.push(`routeMatrix.${id}.role=${REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].role}`);
    }
    if (!entry.theme) missing.push(`routeMatrix.${id}.theme`);
    if (entry.theme && !COMMERCIAL_VISUAL_QA_REQUIRED_THEMES.includes(entry.theme)) missing.push(`routeMatrix.${id}.theme=valid`);
    if (entry.theme && entry.theme !== REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].theme) {
      missing.push(`routeMatrix.${id}.theme=${REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].theme}`);
    }
    if (!entry.viewport) missing.push(`routeMatrix.${id}.viewport`);
    if (entry.viewport && !['desktop', 'mobile'].includes(entry.viewport)) missing.push(`routeMatrix.${id}.viewport=valid`);
    if (entry.viewport && entry.viewport !== REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].viewport) {
      missing.push(`routeMatrix.${id}.viewport=${REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].viewport}`);
    }
    if (!entry.navigationState) missing.push(`routeMatrix.${id}.navigationState`);
    if (
      entry.navigationState
      && !COMMERCIAL_VISUAL_QA_NAVIGATION_STATES.includes(entry.navigationState)
    ) {
      missing.push(`routeMatrix.${id}.navigationState=valid`);
    }
    if (!entry.dockState) missing.push(`routeMatrix.${id}.dockState`);
    if (entry.dockState && !['collapsed', 'expanded', 'hidden'].includes(entry.dockState)) {
      missing.push(`routeMatrix.${id}.dockState=valid`);
    }
    if (!entry.pageState) missing.push(`routeMatrix.${id}.pageState`);
    if (!entry.moduleState) missing.push(`routeMatrix.${id}.moduleState`);
    if (!entry.sourceConcept) missing.push(`routeMatrix.${id}.sourceConcept`);
    if (
      entry.sourceConcept
      && entry.sourceConcept !== REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].sourceConcept
    ) {
      missing.push(`routeMatrix.${id}.sourceConcept=${REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX_METADATA[id].sourceConcept}`);
    }
    if (entry.sourceConcept && !acceptedConceptImages.has(entry.sourceConcept)) {
      missing.push(`routeMatrix.${id}.sourceConcept=accepted-concept-image`);
    }
    if (entry.sourceConcept && !evidence.conceptImageSha256?.[entry.sourceConcept]) {
      missing.push(`routeMatrix.${id}.sourceConceptSha256`);
    }
    if (
      entry.sourceConcept
      && evidence.conceptImageSha256?.[entry.sourceConcept]
      && evidence.conceptImageSha256[entry.sourceConcept] !== evidence.currentConceptImageSha256?.[entry.sourceConcept]
    ) {
      missing.push(`routeMatrix.${id}.sourceConceptSha256=current`);
    }
  }

  for (const check of REQUIRED_INTERACTIVE_LEARNING_PRODUCT_QA_REGRESSION_CHECKS) {
    if (evidence.regressionChecks[check] !== true) {
      missing.push(`regressionChecks.${check}=true`);
    }
  }

  return missing.length > 0
    ? [withCategory({
        path: evidence.handoffMatrix || INTERACTIVE_LEARNING_PRODUCT_QA_MATRIX,
        rule: 'interactive-learning-product-qa.incomplete-evidence' as const,
        message: 'Interactive learning product QA evidence is incomplete or blocked.',
        evidence: missing,
      })]
    : [];
}

function buildAdaptivePathProductQaViolations(
  evidence: CommercialAdaptivePathProductQaEvidence | undefined,
  required = false,
  sourceRefreshRequired = false,
  evidenceRefreshed = false,
) {
  if (!evidence) {
    return required ? [withCategory({
      path: ADAPTIVE_PATH_PRODUCT_QA_MATRIX,
      rule: 'adaptive-path-product-qa.missing-evidence' as const,
      message: 'Adaptive path product QA evidence is missing.',
      evidence: ['govern-adaptive-path-product-qa'],
    })] : [];
  }

  const rawConceptImages = Array.isArray(evidence.conceptImages) ? evidence.conceptImages : [];
  const conceptImages = rawConceptImages.filter((entry): entry is string => typeof entry === 'string');
  const rawChildChangeValidations = Array.isArray(evidence.childChangeValidations) ? evidence.childChangeValidations : [];
  const childChangeValidations = rawChildChangeValidations.filter(isRecord) as Partial<CommercialAdaptivePathProductQaChildValidationEvidence>[];
  const rawRouteMatrix = Array.isArray(evidence.routeMatrix) ? evidence.routeMatrix : [];
  const routeMatrix = rawRouteMatrix.filter(isRecord) as Partial<CommercialAdaptivePathProductQaMatrixEntry>[];
  const rawCaptureStates = Array.isArray(evidence.captureStates) ? evidence.captureStates : [];
  const captureStates = rawCaptureStates.filter(isRecord) as Partial<CommercialAdaptivePathProductQaCaptureStateEvidence>[];
  const rawTemporaryExceptions = Array.isArray(evidence.temporaryExceptions) ? evidence.temporaryExceptions : [];
  const temporaryExceptions = rawTemporaryExceptions.filter(isRecord) as Array<Partial<{ owner: string; removalCondition: string }>>;
  const independentVisualReview = isRecord(evidence.independentVisualReview) ? evidence.independentVisualReview : {
    status: 'not-run',
    reviewer: '',
    report: '',
  } as Partial<CommercialAdaptivePathProductQaReviewEvidence>;
  const acceptedConceptImages = new Set(conceptImages);
  const missing = [
    evidence.parseError ? `parseError=${evidence.parseError}` : '',
    evidence.change !== 'govern-adaptive-path-product-qa' ? 'change=govern-adaptive-path-product-qa' : '',
    !evidence.generatedAt ? 'generatedAt' : '',
    !evidence.sourceCommit ? 'sourceCommit' : '',
    sourceRefreshRequired && !evidenceRefreshed ? 'sourceCommit=refreshed-for-current-source-change' : '',
    evidence.designHandoff !== ADAPTIVE_PATH_PRODUCT_QA_HANDOFF
      ? `designHandoff=${ADAPTIVE_PATH_PRODUCT_QA_HANDOFF}`
      : '',
    !evidence.designHandoffSha256 ? 'designHandoffSha256' : '',
    evidence.designHandoffSha256 && evidence.designHandoffSha256 !== evidence.currentDesignHandoffSha256
      ? 'designHandoffSha256=current'
      : '',
    evidence.handoffMatrix !== ADAPTIVE_PATH_PRODUCT_QA_MATRIX
      ? `handoffMatrix=${ADAPTIVE_PATH_PRODUCT_QA_MATRIX}`
      : '',
    !evidence.handoffMatrixSha256 ? 'handoffMatrixSha256' : '',
    evidence.handoffMatrixSha256 && evidence.handoffMatrixSha256 !== evidence.currentHandoffMatrixSha256
      ? 'handoffMatrixSha256=current'
      : '',
    evidence.captureManifest !== ADAPTIVE_PATH_PRODUCT_QA_CAPTURE_MANIFEST
      ? `captureManifest=${ADAPTIVE_PATH_PRODUCT_QA_CAPTURE_MANIFEST}`
      : '',
    !evidence.captureManifestSha256 ? 'captureManifestSha256' : '',
    evidence.captureManifestSha256 && evidence.captureManifestSha256 !== evidence.currentCaptureManifestSha256
      ? 'captureManifestSha256=current'
      : '',
    evidence.visualSignals !== ADAPTIVE_PATH_PRODUCT_QA_VISUAL_SIGNALS
      ? `visualSignals=${ADAPTIVE_PATH_PRODUCT_QA_VISUAL_SIGNALS}`
      : '',
    !evidence.visualSignalsSha256 ? 'visualSignalsSha256' : '',
    evidence.visualSignalsSha256 && evidence.visualSignalsSha256 !== evidence.currentVisualSignalsSha256
      ? 'visualSignalsSha256=current'
      : '',
    independentVisualReview.status !== 'passed' ? 'independentVisualReview.status=passed' : '',
    independentVisualReview.reviewer !== 'ui-flow-reviewer' ? 'independentVisualReview.reviewer=ui-flow-reviewer' : '',
    !independentVisualReview.report ? 'independentVisualReview.report' : '',
    !independentVisualReview.reportSha256 ? 'independentVisualReview.reportSha256' : '',
    independentVisualReview.reportSha256
      && independentVisualReview.reportSha256 !== independentVisualReview.currentReportSha256
      ? 'independentVisualReview.reportSha256=current'
      : '',
    independentVisualReview.reportHasPassVerdict !== true
      ? 'independentVisualReview.reportHasPassVerdict=true'
      : '',
    independentVisualReview.reportHasNoUnresolvedBlocks !== true
      ? 'independentVisualReview.reportHasNoUnresolvedBlocks=true'
      : '',
    temporaryExceptions.length > 0
      && temporaryExceptions.some((entry) => !entry.owner || !entry.removalCondition)
      ? 'temporaryExceptions.owner/removalCondition'
      : '',
    !Array.isArray(evidence.conceptImages) ? 'conceptImages=array' : '',
    !Array.isArray(evidence.childChangeValidations) ? 'childChangeValidations=array' : '',
    !Array.isArray(evidence.routeMatrix) ? 'routeMatrix=array' : '',
    !Array.isArray(evidence.captureStates) ? 'captureStates=array' : '',
    !Array.isArray(evidence.temporaryExceptions) ? 'temporaryExceptions=array' : '',
    rawConceptImages.length !== conceptImages.length ? 'conceptImages.entry=string' : '',
    rawChildChangeValidations.length !== childChangeValidations.length ? 'childChangeValidations.entry=object' : '',
    rawRouteMatrix.length !== routeMatrix.length ? 'routeMatrix.entry=object' : '',
    rawCaptureStates.length !== captureStates.length ? 'captureStates.entry=object' : '',
    rawTemporaryExceptions.length !== temporaryExceptions.length ? 'temporaryExceptions.entry=object' : '',
    !isRecord(evidence.independentVisualReview) ? 'independentVisualReview=object' : '',
  ].filter(Boolean);

  for (const conceptImage of REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CONCEPT_IMAGES) {
    if (!acceptedConceptImages.has(conceptImage)) missing.push(`conceptImages.${conceptImage}`);
  }
  for (const conceptImage of conceptImages) {
    if (!evidence.conceptImageSha256?.[conceptImage]) {
      missing.push(`conceptImageSha256.${conceptImage}`);
    }
    if (
      evidence.conceptImageSha256?.[conceptImage]
      && evidence.conceptImageSha256[conceptImage] !== evidence.currentConceptImageSha256?.[conceptImage]
    ) {
      missing.push(`conceptImageSha256.${conceptImage}=current`);
    }
  }

  for (const change of REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_CHILD_CHANGES) {
    const validation = childChangeValidations.find((entry) => entry.change === change);
    if (!validation) {
      missing.push(`childChangeValidations.${change}`);
      continue;
    }
    if (validation.result !== 'passed') missing.push(`childChangeValidations.${change}.result=passed`);
    if (!validation.validationCommand) missing.push(`childChangeValidations.${change}.validationCommand`);
    if (validation.archivedTasksComplete !== true) {
      missing.push(`childChangeValidations.${change}.archivedTasksComplete=true`);
    }
  }

  for (const id of REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_MATRIX_IDS) {
    const entry = routeMatrix.find((item) => item.id === id);
    const expected = REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_MATRIX_METADATA[id];
    if (!entry) {
      missing.push(`routeMatrix.${id}`);
      continue;
    }
    if (entry.result !== 'passed') missing.push(`routeMatrix.${id}.result=passed`);
    if (entry.route !== expected.route) missing.push(`routeMatrix.${id}.route=${expected.route}`);
    if (entry.goal !== expected.goal) missing.push(`routeMatrix.${id}.goal=${expected.goal}`);
    if (entry.role !== expected.role) missing.push(`routeMatrix.${id}.role=${expected.role}`);
    if (entry.theme !== expected.theme) missing.push(`routeMatrix.${id}.theme=${expected.theme}`);
    if (entry.viewport !== expected.viewport) missing.push(`routeMatrix.${id}.viewport=${expected.viewport}`);
    if (entry.authState !== expected.authState) missing.push(`routeMatrix.${id}.authState=${expected.authState}`);
    if (entry.navigationState !== expected.navigationState) {
      missing.push(`routeMatrix.${id}.navigationState=${expected.navigationState}`);
    }
    if (entry.dockState !== expected.dockState) missing.push(`routeMatrix.${id}.dockState=${expected.dockState}`);
    if (!entry.pageState) missing.push(`routeMatrix.${id}.pageState`);
    if (entry.sourceConcept !== expected.sourceConcept) missing.push(`routeMatrix.${id}.sourceConcept=${expected.sourceConcept}`);
    if (entry.sourceConcept && !acceptedConceptImages.has(entry.sourceConcept)) {
      missing.push(`routeMatrix.${id}.sourceConcept=accepted-concept-image`);
    }
    if (entry.sourceConcept && !evidence.conceptImageSha256?.[entry.sourceConcept]) {
      missing.push(`routeMatrix.${id}.sourceConceptSha256`);
    }
    if (
      entry.sourceConcept
      && evidence.conceptImageSha256?.[entry.sourceConcept]
      && evidence.conceptImageSha256[entry.sourceConcept] !== evidence.currentConceptImageSha256?.[entry.sourceConcept]
    ) {
      missing.push(`routeMatrix.${id}.sourceConceptSha256=current`);
    }
    if (!entry.screenshot) missing.push(`routeMatrix.${id}.screenshot`);
    if (!entry.screenshotSha256) missing.push(`routeMatrix.${id}.screenshotSha256`);

    const captureState = captureStates.find((item) => item.id === id);
    if (!captureState) {
      missing.push(`captureStates.${id}`);
      continue;
    }
    if (captureState.goal !== entry.goal) missing.push(`captureStates.${id}.goal=routeMatrix.goal`);
    if (captureState.theme !== entry.theme) missing.push(`captureStates.${id}.theme=routeMatrix.theme`);
    if (captureState.viewport !== entry.viewport) missing.push(`captureStates.${id}.viewport=routeMatrix.viewport`);
    if (captureState.screenshot !== entry.screenshot) {
      missing.push(`captureStates.${id}.screenshot=routeMatrix.screenshot`);
    }
    if (captureState.screenshotSha256 !== entry.screenshotSha256) {
      missing.push(`captureStates.${id}.screenshotSha256=routeMatrix.screenshotSha256`);
    }
  }

  for (const gate of REQUIRED_ADAPTIVE_PATH_PRODUCT_QA_FUNCTIONAL_GATES) {
    if (evidence.functionalGates[gate] !== true) {
      missing.push(`functionalGates.${gate}=true`);
    }
  }

  return missing.length > 0
    ? [withCategory({
        path: evidence.handoffMatrix || ADAPTIVE_PATH_PRODUCT_QA_MATRIX,
        rule: 'adaptive-path-product-qa.incomplete-evidence' as const,
        message: 'Adaptive path product QA evidence is incomplete or blocked.',
        evidence: missing,
      })]
    : [];
}

function buildReportExportViolations(
  reportSurfaceInventory: readonly PlatformReportSurfaceInventoryEntry[],
  visualEvidence: readonly CommercialVisualAcceptanceEvidence[],
) {
  return reportSurfaceInventory
    .filter((surface) => surface.visualQaProfile !== 'temporary-exception')
    .flatMap((surface) => {
      const routeEvidence = visualEvidence.find((entry) => entry.href === surface.ownerRoute);
      if (!routeEvidence) {
        return [withCategory({
          path: surface.ownerRoute,
          rule: 'report-export.incomplete-visual-evidence',
          message: 'Report-ledger surface is missing visual evidence for watermark, privacy, source, and export readiness.',
          evidence: [`surface=${surface.id}`, 'routeEvidence'],
        })];
      }
      return routeEvidence.viewports.flatMap((viewport) => {
        const evidence = viewport.reportEvidence?.find((entry) => entry.surfaceId === surface.id);
        const missing = [
          `surface=${surface.id}`,
          !evidence?.watermarkChecked ? 'watermarkChecked' : '',
          !evidence?.privacyScopeChecked ? 'privacyScopeChecked' : '',
          !evidence?.sourceQualityVisible ? 'sourceQualityVisible' : '',
          !evidence?.statusLegendReadable ? 'statusLegendReadable' : '',
          surface.surfaceType !== 'temporary-gap' && !evidence?.exportSafeSnapshotChecked ? 'exportSafeSnapshotChecked' : '',
        ].filter(Boolean);
        return missing.length > 1
          ? [withCategory({
              path: surface.ownerRoute,
              rule: 'report-export.incomplete-visual-evidence',
              message: 'Report-ledger visual evidence is missing watermark, privacy, source, readability, or export checks.',
              evidence: [`width=${viewport.width}`, ...missing],
            })]
          : [];
      });
    });
}

function buildAccessibilityViolations(
  requiredRoutes: readonly CommercialVisualAcceptanceRoute[],
  accessibilityEvidence: readonly CommercialAccessibilityTextFitEvidence[],
) {
  return requiredRoutes.flatMap((route) => {
    const routeEvidence = accessibilityEvidence.find((entry) => entry.href === route.href);
    if (!routeEvidence) {
      return [withCategory({
        path: route.href,
        rule: 'accessibility-text-fit.missing-route-evidence',
        message: 'Commercial UI route is missing accessibility and text-fit evidence.',
        evidence: route.requiredWidths.map((width) => `width=${width}`),
      })];
    }
    return route.requiredWidths.flatMap((width) => {
      const viewport = findViewport(routeEvidence.viewports, width);
      const missing = [
        !viewport?.contrastChecked ? 'contrastChecked' : '',
        !viewport?.visibleFocus ? 'visibleFocus' : '',
        !viewport?.keyboardReachable ? 'keyboardReachable' : '',
        !viewport?.reducedMotionChecked ? 'reducedMotionChecked' : '',
        !viewport?.buttonTextFits ? 'buttonTextFits' : '',
        !viewport?.noMobileTextOverlap ? 'noMobileTextOverlap' : '',
      ].filter(Boolean);
      return missing.length > 0
        ? [withCategory({
            path: route.href,
            rule: 'accessibility-text-fit.incomplete-evidence',
            message: 'Commercial UI route has incomplete accessibility or text-fit evidence.',
            evidence: [`width=${width}`, ...missing],
          })]
        : [];
    });
  });
}

export function evaluateCommercialUiGovernance(input: CommercialUiGovernanceInput): CommercialUiGovernanceResult {
  const allowlist = input.allowlist ?? [];
  const allowlistViolations = buildAllowlistViolations(allowlist, input.today);
  const requiredVisualRoutes = input.requiredVisualRoutes ?? DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES;
  const premiumVisualQaMatrix = input.premiumVisualQaMatrix ?? PREMIUM_PLATFORM_VISUAL_QA_ROUTE_MATRIX;
  const simulationVisualQaMatrix = input.simulationVisualQaMatrix ?? SIMULATION_VISUAL_QA_ROUTE_MATRIX;
  const defaultRouteHrefs = new Set([
    ...requiredVisualRoutes.map((route) => route.href),
    ...premiumVisualQaMatrix.map((route) => route.href),
  ]);
  const routeInventory = input.routeInventory ?? PLATFORM_PRIMARY_ROUTE_INVENTORY.filter((route) => (
    defaultRouteHrefs.has(route.href)
  ));
  const visualRouteInventory = input.visualRouteInventory ?? routeInventory;
  const routeInventoryHrefs = new Set(visualRouteInventory.map((route) => route.href));
  const reportSurfaceInventory = input.reportSurfaceInventory ?? PLATFORM_REPORT_SURFACE_INVENTORY.filter((surface) => (
    routeInventoryHrefs.has(surface.ownerRoute)
  ));
  const secondaryRouteGovernanceMatrix = input.secondaryRouteGovernanceMatrix
    ?? DEFAULT_SECONDARY_NAVIGATION_ROUTE_GOVERNANCE_MATRIX;
  const secondaryRouteDependencies = input.secondaryRouteDependencies
    ?? DEFAULT_SECONDARY_NAVIGATION_DEPENDENCIES;
  const rawViolations = [
    ...(input.sourceViolations ?? []).map(withCategory),
    ...buildRouteLedgerViolations(routeInventory),
    ...buildShellViolations(input.shellInventory),
    ...buildModuleChromeViolations(input.moduleChromeInventory),
    ...buildStatusViolations(input.statusInventory),
    ...buildNavigationViolations(input.navigationCoverage),
    ...buildSecondaryNavigationGovernanceViolations(
      secondaryRouteGovernanceMatrix,
      secondaryRouteDependencies,
      input.today,
    ),
    ...buildVisualMatrixDriftViolations(visualRouteInventory, requiredVisualRoutes),
    ...buildVisualViolations(requiredVisualRoutes, input.visualEvidence),
    ...buildPremiumVisualQaViolations(premiumVisualQaMatrix, input.visualEvidence),
    ...buildVisualManifestMetadataViolations(visualRouteInventory, premiumVisualQaMatrix, input.visualEvidence),
    ...buildNavigationStateViolations(visualRouteInventory, input.visualEvidence),
    ...buildMobileStructureViolations(input.visualEvidence),
    ...buildSimulationVisualQaViolations(simulationVisualQaMatrix, input.visualEvidence),
    ...buildInteractiveLearningProductQaViolations(
      input.interactiveLearningProductQa,
      input.interactiveLearningProductQaRequired,
      input.interactiveLearningProductQaSourceRefreshRequired,
      input.interactiveLearningProductQaEvidenceRefreshed,
    ),
    ...buildAdaptivePathProductQaViolations(
      input.adaptivePathProductQa,
      input.adaptivePathProductQaRequired,
      input.adaptivePathProductQaSourceRefreshRequired,
      input.adaptivePathProductQaEvidenceRefreshed,
    ),
    ...buildReportExportViolations(reportSurfaceInventory, input.visualEvidence),
    ...buildAccessibilityViolations(
      requiredVisualRoutes,
      input.accessibilityEvidence,
    ),
  ];
  const violations = rawViolations.map((violation) => {
    const matchedAllowlist = allowlist.find((entry) => allowlistMatches(violation, entry));
    const allowlisted = matchedAllowlist && allowlistEntryMissingFields(matchedAllowlist, input.today).length === 0;
    return allowlisted
      ? { ...violation, allowedBy: matchedAllowlist.id }
      : violation;
  });
  const allowlistedViolations = violations.filter((violation) => violation.allowedBy);
  const blockingViolations = [
    ...allowlistViolations,
    ...violations.filter((violation) => (
      input.mode === 'blocking'
      && violation.enforcement !== 'advisory'
      && !violation.allowedBy
    )),
  ];

  return {
    passed: blockingViolations.length === 0,
    violations,
    blockingViolations,
    allowlistedViolations,
  };
}
