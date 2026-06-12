import {
  PLATFORM_PRIMARY_ROUTE_INVENTORY,
  PLATFORM_REPORT_SURFACE_INVENTORY,
  type PlatformFloatingDockRouteBehavior,
  type PlatformPrimaryRouteFrame,
  type PlatformPrimaryRouteInventoryEntry,
  type PlatformReportSurfaceInventoryEntry,
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
  | 'visual-acceptance.route-inventory-drift'
  | 'route-ledger.incomplete-primary-route'
  | 'route-ledger.outdated-archetype'
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
export type CommercialVisualQaRole = 'guest' | 'student' | 'teacher' | 'admin';
export type CommercialVisualQaAuthState = 'public' | 'auth-entry' | 'authenticated' | 'unauth-redirect-fallback';

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
  mobileCanvasFirst?: boolean;
  noPersistentMobileSidebar?: boolean;
  noPersistentMobileFilter?: boolean;
  noPersistentWorkbenchPanels?: boolean;
  noPersistentKnowledgeGraphDrawer?: boolean;
  reportEvidence?: readonly CommercialReportExportVisualEvidence[];
}

export interface CommercialVisualAcceptanceEvidence {
  href: string;
  viewports: readonly CommercialViewportVisualEvidence[];
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
  { href: '/assessment/adaptive-practice', requiredWidths: [1440, 320] },
  { href: '/profile', requiredWidths: [1440, 320] },
  { href: '/interactive-learning/control-workbench', requiredWidths: [1440, 320] },
  { href: '/interactive-learning/courses/unit-5-4-data-driven-mpc-transition', requiredWidths: [1440, 320] },
  { href: '/teacher', requiredWidths: [1440, 320] },
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
    role: 'student',
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
  'platform-data-center',
];
const REQUIRED_STUDENT_DESTINATION_HREFS = [
  '/simulations',
  '/knowledge',
  '/arena',
  '/interactive-learning/control-workbench',
  '/assessment/adaptive-practice',
  '/interactive-learning',
  '/data-center',
];
const REQUIRED_NAVIGATION_ALIASES = ['/interactive-learning/control-workbench?mode=explore&preset=classic-four-view'];
const REQUIRED_STUDENT_PROFILE_HREF = '/profile';
const REQUIRED_STUDENT_COCKPIT_HREF = '/dashboard';

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
      !route.themeSupport.includes('dark') ? 'themeSupport=dark' : '',
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
    const route = routeInventory.find((entry) => entry.href === routeEvidence.href);
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
        !viewport.theme ? 'theme' : '',
        !viewport.role ? 'role' : '',
        !viewport.authState ? 'authState' : '',
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
  const rawViolations = [
    ...(input.sourceViolations ?? []).map(withCategory),
    ...buildRouteLedgerViolations(routeInventory),
    ...buildShellViolations(input.shellInventory),
    ...buildModuleChromeViolations(input.moduleChromeInventory),
    ...buildStatusViolations(input.statusInventory),
    ...buildNavigationViolations(input.navigationCoverage),
    ...buildVisualMatrixDriftViolations(visualRouteInventory, requiredVisualRoutes),
    ...buildVisualViolations(requiredVisualRoutes, input.visualEvidence),
    ...buildPremiumVisualQaViolations(premiumVisualQaMatrix, input.visualEvidence),
    ...buildVisualManifestMetadataViolations(visualRouteInventory, premiumVisualQaMatrix, input.visualEvidence),
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
    ...violations.filter((violation) => input.mode === 'blocking' && !violation.allowedBy),
  ];

  return {
    passed: blockingViolations.length === 0,
    violations,
    blockingViolations,
    allowlistedViolations,
  };
}
