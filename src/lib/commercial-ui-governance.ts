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
  secondaryRouteGovernanceMatrix?: readonly CommercialSecondaryRouteGovernanceEntry[];
  secondaryRouteDependencies?: readonly CommercialSecondaryRouteDependency[];
  reportSurfaceInventory?: readonly PlatformReportSurfaceInventoryEntry[];
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
    const expectedMobileState = MOBILE_NAVIGATION_STATE_BY_BEHAVIOR[route.mobileNavigation];
    const missing = [
      !routeEvidence.viewports.some((viewport) => (
        viewport.width === 1440 && viewport.navigationState === 'desktop-expanded'
      )) ? 'width=1440:navigationState=desktop-expanded' : '',
      !routeEvidence.viewports.some((viewport) => (
        viewport.width === 1440 && viewport.navigationState === 'desktop-collapsed'
      )) ? 'width=1440:navigationState=desktop-collapsed' : '',
      !routeEvidence.viewports.some((viewport) => (
        viewport.width === 320 && viewport.navigationState === expectedMobileState
      )) ? `width=320:navigationState=${expectedMobileState}` : '',
    ].filter(Boolean);
    const expandedViewports = routeEvidence.viewports.filter((viewport) => (
      viewport.width === 1440 && viewport.navigationState === 'desktop-expanded'
    ));
    const reusedCollapsedEvidence = routeEvidence.viewports.some((viewport) => (
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
    .filter((viewport) => viewport.width === 320)
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
