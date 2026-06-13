import {
  createPlatformNavigation,
  filterPlatformNavigation,
  type PlatformNavigationAvailability,
  type PlatformNavigationItem,
  type PlatformRole,
} from '@/components/platform/platform-ui-contracts';
import type { ReportLedgerSurfaceCategory } from '@/lib/report-ledger-contracts';

export type PlatformRoleNavigationAudience = PlatformRole | 'guest';

export type PlatformRoleNavigationGroup =
  | 'public'
  | 'role-cockpit'
  | 'student-core'
  | 'teacher-cockpit'
  | 'admin-cockpit'
  | 'future';

export type PlatformNavigationLayerId = 'global-product' | 'role-cockpit' | 'contextual-workspace' | 'local-tool';
export type PlatformWorkspaceMode =
  | 'arena'
  | 'control-workbench'
  | 'interactive-learning'
  | 'adaptive-learning'
  | 'teacher'
  | 'admin';
export type PlatformPrimaryRouteFrame =
  | 'public-entry'
  | 'learning-atlas'
  | 'mission-workspace'
  | 'knowledge-data-map'
  | 'operations-console'
  | 'report-ledger';
export type PlatformLegacyPrimaryRouteFrame =
  | 'auth-entry'
  | 'learning-map'
  | 'immersive-task-workspace'
  | 'learner-data'
  | 'teacher-operations'
  | 'admin-governance'
  | 'knowledge-graph';
export type PlatformFloatingDockRouteBehavior = 'enabled' | 'collapsed' | 'hidden';
export type PlatformRouteThemeSupport = 'light' | 'dark';
export type PlatformRouteAuthState = 'public' | 'auth-entry' | 'authenticated' | 'protected-redirect' | 'mixed';
export type PlatformShellMigrationDisposition = 'adapted' | 'replace' | 'retained-temporary';
export type PlatformRouteScreenshotProfile = 'direct-capture' | 'representative-covered' | 'temporary-exception';
export type PlatformReportSurfaceType = 'primary-route' | 'embedded-component' | 'export-view' | 'temporary-gap';
export type PlatformLegacyNavigationShell =
  | 'UnifiedTopBar'
  | 'ArenaPageShell'
  | 'TeacherLayout'
  | 'AdminConsoleHeader'
  | 'FeaturePageNav';
export type PlatformLegacyShellDisposition = 'adapted' | 'retained-temporary' | 'scheduled-replacement';
export type PlatformDockDispositionComponent = 'PageFloatingControls' | 'GlobalAIFloatingButton';
export type PlatformMobileNavigationBehavior =
  | 'public-entry-menu'
  | 'auth-callback-panel'
  | 'role-route-tabs'
  | 'workspace-command-surface'
  | 'drawer'
  | 'hidden-immersive';
export type StudentLearningIntent = 'learn' | 'practice' | 'challenge' | 'experiment' | 'review-profile';
export type CommercialStudentEntryIntent =
  | 'learn'
  | 'practice'
  | 'challenge'
  | 'experiment'
  | 'review'
  | 'account-profile';

export type PlatformNavigationIconKey =
  | 'ship'
  | 'knowledge'
  | 'arena'
  | 'workbench'
  | 'adaptive'
  | 'interactive'
  | 'profile'
  | 'teacher'
  | 'classes'
  | 'lesson-plans'
  | 'resources'
  | 'history'
  | 'users'
  | 'analytics'
  | 'database'
  | 'settings'
  | 'login'
  | 'home'
  | 'konling'
  | 'experiments';

export interface PlatformRoleNavigationItem extends PlatformNavigationItem {
  group: PlatformRoleNavigationGroup;
  description: string;
  iconKey: PlatformNavigationIconKey;
  availability?: PlatformNavigationAvailability;
}

export interface PlatformNavigationLayerContract {
  id: PlatformNavigationLayerId;
  label: string;
  purpose: string;
  entryGroups: readonly PlatformRoleNavigationGroup[];
  workspaceModes?: readonly PlatformWorkspaceMode[];
  duplicatesGlobalNavigation: boolean;
}

export interface StudentLearningIntentGroup {
  intent: StudentLearningIntent;
  label: string;
  entryIds: readonly ((typeof STUDENT_CORE_ENTRY_IDS)[number] | 'student-profile')[];
  compatibilityAliases: readonly string[];
}

export interface StudentLearningIntentNavigationGroup extends StudentLearningIntentGroup {
  entries: PlatformRoleNavigationItem[];
}

export interface CommercialStudentEntryIntentGroup {
  intent: CommercialStudentEntryIntent;
  label: string;
  summary: string;
  entryIds: readonly string[];
  hrefs: readonly string[];
}

export interface CommercialStudentEntrySurfaceRoute {
  href: string;
  routeFile: string;
  viewportWidths: readonly [1440, 320];
  currentIntent: CommercialStudentEntryIntent;
  firstViewportRequirement: string;
  stateCoverage: readonly string[];
}

export interface PlatformProfileAndCockpitAction {
  audience: PlatformRoleNavigationAudience;
  profileHref: string;
  cockpitHref: string;
  primaryWorkspaceAction: 'account' | 'cockpit';
  semantics: string;
}

export interface PlatformContextualReturnTargetRule {
  workspaceMode: PlatformWorkspaceMode;
  routePrefix: string;
  sourceContext: 'arena-challenge' | 'arena-publication' | 'interactive-learning' | 'adaptive-learning';
  targetHint: string;
  fallbackHref: string;
}

export interface PlatformAuthRouteContract {
  href: string;
  preservesDestination?: string;
  preservesDestinationOnError?: boolean;
  errorStateIntent?: 'retry-with-same-destination';
  exposesProfileAction: boolean;
  exposesCockpitAction: boolean;
  roleCockpitFallbacks?: typeof PLATFORM_ROLE_COCKPIT_HREFS;
}

export interface PlatformPrimaryRouteException {
  owner: string;
  reason: string;
  affectedCapability: string;
  expiresOn: string;
  removalCondition: string;
}

export interface PlatformRouteLegacyShellDisposition {
  component: PlatformLegacyNavigationShell;
  disposition: PlatformLegacyShellDisposition;
  sourceFile: string;
  owningChange?: string;
  removalCondition: string;
}

export interface PlatformRouteDockDisposition {
  component: PlatformDockDispositionComponent;
  disposition: 'registered-shared-dock' | 'retained-temporary';
  removalCondition: string;
}

export interface PlatformRouteAliasRetirement {
  alias: string;
  owningChange: string;
  retirementCondition: string;
}

export interface PlatformRouteLegacyFrameAlias {
  alias: PlatformLegacyPrimaryRouteFrame;
  owningChange: string;
  retirementCondition: string;
}

export interface PlatformPrimaryRouteInventoryEntry {
  href: string;
  routeFile: string;
  routePattern?: string;
  coveredRouteGlob?: string;
  frame: PlatformPrimaryRouteFrame;
  roleScope: readonly PlatformRoleNavigationAudience[];
  authState: PlatformRouteAuthState;
  themeSupport: readonly PlatformRouteThemeSupport[];
  mobileNavigation: PlatformMobileNavigationBehavior;
  navigationLayers: readonly PlatformNavigationLayerId[];
  floatingDock: PlatformFloatingDockRouteBehavior;
  visualQaProfile: 'representative' | 'auth-callback' | 'immersive';
  screenshotProfile: PlatformRouteScreenshotProfile;
  owningChange: string;
  shellMigrationDisposition: PlatformShellMigrationDisposition;
  shellRemovalCondition: string;
  unifiedUiMigrationOwner?: string;
  unifiedUiMigrationException?: PlatformPrimaryRouteException;
  contextualReturn?: Pick<PlatformContextualReturnTargetRule, 'sourceContext' | 'targetHint' | 'fallbackHref'>;
  legacyShell?: PlatformRouteLegacyShellDisposition;
  dockDisposition?: readonly PlatformRouteDockDisposition[];
  exception?: PlatformPrimaryRouteException;
  aliases?: readonly string[];
  aliasRetirements?: readonly PlatformRouteAliasRetirement[];
  legacyFrameAliases?: readonly PlatformRouteLegacyFrameAlias[];
}

export interface PlatformReportSurfaceInventoryEntry {
  id: string;
  ownerRoute: string;
  sourceFile: string;
  category: ReportLedgerSurfaceCategory;
  surfaceType: PlatformReportSurfaceType;
  owningChange: string;
  sourceShellOwner: string;
  visualQaProfile: PlatformRouteScreenshotProfile;
}

export interface PlatformRoleNavigationOptions {
  enabledFeatureFlags?: readonly string[];
  includeDisabled?: boolean;
  includeHidden?: boolean;
}

type PrimaryRouteInput = Omit<
  PlatformPrimaryRouteInventoryEntry,
  | 'themeSupport'
  | 'mobileNavigation'
  | 'shellMigrationDisposition'
  | 'shellRemovalCondition'
  | 'screenshotProfile'
  | 'exception'
  | 'unifiedUiMigrationOwner'
  | 'unifiedUiMigrationException'
  | 'contextualReturn'
  | 'aliasRetirements'
  | 'legacyFrameAliases'
> & Partial<
  Pick<
    PlatformPrimaryRouteInventoryEntry,
    | 'themeSupport'
    | 'mobileNavigation'
    | 'shellMigrationDisposition'
    | 'shellRemovalCondition'
    | 'screenshotProfile'
    | 'unifiedUiMigrationOwner'
    | 'unifiedUiMigrationException'
    | 'contextualReturn'
    | 'aliasRetirements'
    | 'legacyFrameAliases'
  >
> & {
  exception?: Omit<PlatformPrimaryRouteException, 'removalCondition'> & Partial<Pick<PlatformPrimaryRouteException, 'removalCondition'>>;
};

const ROUTE_LEDGER_CONVERGENCE_CHANGE = 'converge-route-ledger-to-canonical-archetypes';
const APP_SHELL_MIGRATION_CHANGE = 'upgrade-platform-app-shell-to-archetype-shell';
const MISSION_WORKSPACE_MIGRATION_CHANGE = 'migrate-mission-workspaces-to-unified-shell';
const LEARNER_KNOWLEDGE_DATA_MIGRATION_CHANGE = 'migrate-learner-knowledge-data-surfaces';
const KNOWLEDGE_MAP_UNIFIED_SHELL_CHANGE = 'migrate-knowledge-map-to-unified-shell-panels';
const OPERATIONS_REPORT_MIGRATION_CHANGE = 'migrate-operations-report-ledger-surfaces';
const DATA_CENTER_OPERATIONS_ROLE_CHANGE = 'restrict-data-center-to-operations-roles';

function inferUnifiedUiMigrationOwner(input: Pick<PlatformPrimaryRouteInventoryEntry, 'href' | 'frame'>) {
  if (input.frame === 'mission-workspace') return MISSION_WORKSPACE_MIGRATION_CHANGE;
  if (input.frame === 'operations-console') return OPERATIONS_REPORT_MIGRATION_CHANGE;
  if (input.frame === 'knowledge-data-map') return LEARNER_KNOWLEDGE_DATA_MIGRATION_CHANGE;
  if (input.frame === 'report-ledger' && input.href.startsWith('/teacher')) return OPERATIONS_REPORT_MIGRATION_CHANGE;
  if (input.frame === 'report-ledger') return LEARNER_KNOWLEDGE_DATA_MIGRATION_CHANGE;
  return APP_SHELL_MIGRATION_CHANGE;
}

function inferLegacyFrameAlias(input: Pick<PlatformPrimaryRouteInventoryEntry, 'href' | 'frame' | 'authState'>): PlatformLegacyPrimaryRouteFrame | undefined {
  if (input.frame === 'public-entry' && input.authState === 'auth-entry') return 'auth-entry';
  if (input.frame === 'learning-atlas') return 'learning-map';
  if (input.frame === 'mission-workspace') return 'immersive-task-workspace';
  if (input.frame === 'report-ledger') {
    if (input.href.startsWith('/teacher')) return 'teacher-operations';
    if (input.href.startsWith('/admin')) return 'admin-governance';
    return 'learner-data';
  }
  if (input.frame === 'operations-console') return input.href.startsWith('/admin') ? 'admin-governance' : 'teacher-operations';
  if (input.frame === 'knowledge-data-map') {
    if (input.href === '/knowledge' || input.href.startsWith('/ai')) return 'knowledge-graph';
    return 'learner-data';
  }
  return undefined;
}

function primaryRoute(input: PrimaryRouteInput): PlatformPrimaryRouteInventoryEntry {
  const shellRemovalCondition = input.shellRemovalCondition ?? `Route shell is migrated by ${input.owningChange}.`;
  const exception = input.exception
    ? {
        ...input.exception,
        removalCondition: input.exception.removalCondition ?? shellRemovalCondition,
      }
    : undefined;
  const unifiedUiMigrationOwner = input.unifiedUiMigrationOwner ?? (exception ? undefined : inferUnifiedUiMigrationOwner(input));
  const routeMigrationOwner = unifiedUiMigrationOwner ?? exception?.owner ?? input.owningChange;
  const aliasRetirements = input.aliasRetirements ?? input.aliases?.map((alias) => ({
    alias,
    owningChange: ROUTE_LEDGER_CONVERGENCE_CHANGE,
    retirementCondition: `Route alias ${alias} is either promoted into canonical route metadata or retired by ${routeMigrationOwner}.`,
  }));
  const legacyFrameAlias = inferLegacyFrameAlias(input);
  const legacyFrameAliases = input.legacyFrameAliases ?? (legacyFrameAlias
    ? [{
        alias: legacyFrameAlias,
        owningChange: ROUTE_LEDGER_CONVERGENCE_CHANGE,
        retirementCondition: `Legacy frame ${legacyFrameAlias} is retained only as compatibility metadata until ${routeMigrationOwner} completes.`,
      }]
    : undefined);

  return {
    ...input,
    themeSupport: input.themeSupport ?? ['light', 'dark'],
    mobileNavigation: input.mobileNavigation ?? (
      input.frame === 'public-entry'
        ? input.authState === 'auth-entry'
          ? 'auth-callback-panel'
          : 'public-entry-menu'
          : input.floatingDock === 'hidden'
            ? 'hidden-immersive'
            : input.navigationLayers.includes('local-tool')
              ? 'workspace-command-surface'
              : 'role-route-tabs'
    ),
    shellMigrationDisposition: input.shellMigrationDisposition ?? (exception ? 'retained-temporary' : 'adapted'),
    shellRemovalCondition,
    screenshotProfile: input.screenshotProfile ?? (exception ? 'temporary-exception' : 'direct-capture'),
    unifiedUiMigrationOwner,
    aliasRetirements,
    legacyFrameAliases,
    legacyShell: input.legacyShell
      ? {
          ...input.legacyShell,
          owningChange: input.legacyShell.owningChange ?? ROUTE_LEDGER_CONVERGENCE_CHANGE,
        }
      : undefined,
    exception,
  };
}

export const PLATFORM_NAVIGATION_FEATURE_FLAGS = {
  resourceNodes: 'resource-node-management',
  adaptivePath: 'adaptive-learning-paths',
  konling: 'konling-agent-runtime',
  governance: 'platform-governance-workspace',
  experiments: 'adaptive-optimization-experiments',
} as const;

export const PLATFORM_ROLE_COCKPIT_HREFS = {
  student: '/dashboard',
  teacher: '/teacher',
  admin: '/admin',
} as const;

export const STUDENT_CORE_ENTRY_IDS = [
  'student-simulations',
  'student-knowledge',
  'student-arena',
  'student-control-workbench',
  'student-adaptive-learning',
  'student-interactive-learning',
] as const;

export const PLATFORM_ENTRYPOINT_SMOKE_ROUTES = [
  { href: '/', routeFile: 'src/app/page.tsx', viewportWidths: [1440, 320] },
  { href: '/login', routeFile: 'src/app/(auth)/login/page.tsx', viewportWidths: [1440, 320] },
  { href: '/dashboard', routeFile: 'src/app/(main)/dashboard/page.tsx', viewportWidths: [1440, 320] },
  { href: '/profile', routeFile: 'src/app/(main)/profile/page.tsx', viewportWidths: [1440, 320] },
  { href: '/login?callbackUrl=%2Fprofile', routeFile: 'src/app/(auth)/login/page.tsx', viewportWidths: [1440, 320] },
] as const;

export const PLATFORM_NAVIGATION_LAYERS: PlatformNavigationLayerContract[] = [
  {
    id: 'global-product',
    label: '全局产品导航',
    purpose: 'Expose stable public and student product destinations without binding to a role workspace.',
    entryGroups: ['public', 'student-core'],
    duplicatesGlobalNavigation: false,
  },
  {
    id: 'role-cockpit',
    label: '角色驾驶舱导航',
    purpose: 'Route authenticated users to the operational cockpit for their active role.',
    entryGroups: ['role-cockpit', 'teacher-cockpit', 'admin-cockpit'],
    workspaceModes: ['teacher', 'admin'],
    duplicatesGlobalNavigation: false,
  },
  {
    id: 'contextual-workspace',
    label: '上下文工作区导航',
    purpose: 'Expose local breadcrumbs, return targets, and tool actions inside dense workspaces.',
    entryGroups: [],
    workspaceModes: ['arena', 'control-workbench', 'interactive-learning', 'adaptive-learning', 'teacher', 'admin'],
    duplicatesGlobalNavigation: false,
  },
  {
    id: 'local-tool',
    label: '本地工具导航',
    purpose: 'Expose route-owned tabs, inspector modes, graph tools, chart tools, and workspace commands without entering global or role navigation.',
    entryGroups: [],
    workspaceModes: ['arena', 'control-workbench', 'interactive-learning', 'adaptive-learning', 'teacher', 'admin'],
    duplicatesGlobalNavigation: false,
  },
] as const;

export const STUDENT_LEARNING_INTENT_GROUPS: StudentLearningIntentGroup[] = [
  {
    intent: 'learn',
    label: '学习',
    entryIds: ['student-knowledge', 'student-interactive-learning'],
    compatibilityAliases: [],
  },
  {
    intent: 'practice',
    label: '练习',
    entryIds: ['student-adaptive-learning'],
    compatibilityAliases: ['/profile/growth'],
  },
  {
    intent: 'challenge',
    label: '挑战',
    entryIds: ['student-arena'],
    compatibilityAliases: [],
  },
  {
    intent: 'experiment',
    label: '实验',
    entryIds: ['student-simulations', 'student-control-workbench'],
    compatibilityAliases: ['/interactive-learning/control-workbench?mode=explore&preset=classic-four-view'],
  },
  {
    intent: 'review-profile',
    label: '复盘与画像',
    entryIds: ['student-profile'],
    compatibilityAliases: ['/profile/evidence', '/profile/growth', '/profile/portfolio'],
  },
] as const;

export const PLATFORM_PROFILE_AND_COCKPIT_ACTIONS: PlatformProfileAndCockpitAction[] = [
  {
    audience: 'guest',
    profileHref: '/login?callbackUrl=%2Fprofile',
    cockpitHref: '/login',
    primaryWorkspaceAction: 'account',
    semantics: 'Guests authenticate before profile or cockpit access.',
  },
  {
    audience: 'student',
    profileHref: '/profile',
    cockpitHref: PLATFORM_ROLE_COCKPIT_HREFS.student,
    primaryWorkspaceAction: 'cockpit',
    semantics: 'Student cockpit is the operational workspace; profile is account and learning-record review.',
  },
  {
    audience: 'teacher',
    profileHref: '/profile',
    cockpitHref: PLATFORM_ROLE_COCKPIT_HREFS.teacher,
    primaryWorkspaceAction: 'cockpit',
    semantics: 'Teacher cockpit is the operational workspace; profile remains an account action.',
  },
  {
    audience: 'admin',
    profileHref: '/profile',
    cockpitHref: PLATFORM_ROLE_COCKPIT_HREFS.admin,
    primaryWorkspaceAction: 'cockpit',
    semantics: 'Admin cockpit is the operational workspace; profile remains an account action.',
  },
] as const;

export const PLATFORM_CONTEXTUAL_RETURN_TARGET_RULES: PlatformContextualReturnTargetRule[] = [
  {
    workspaceMode: 'control-workbench',
    routePrefix: '/interactive-learning/control-workbench',
    sourceContext: 'arena-challenge',
    targetHint: 'Return to the originating Arena challenge when challenge context is present.',
    fallbackHref: '/interactive-learning',
  },
  {
    workspaceMode: 'control-workbench',
    routePrefix: '/interactive-learning/control-workbench',
    sourceContext: 'arena-publication',
    targetHint: 'Return to the Arena publication or challenge list when publication context is present.',
    fallbackHref: '/arena',
  },
  {
    workspaceMode: 'interactive-learning',
    routePrefix: '/interactive-learning',
    sourceContext: 'interactive-learning',
    targetHint: 'Return to the interactive learning catalog when no narrower lesson context is present.',
    fallbackHref: '/interactive-learning',
  },
  {
    workspaceMode: 'adaptive-learning',
    routePrefix: '/assessment/adaptive-practice',
    sourceContext: 'adaptive-learning',
    targetHint: 'Return to the adaptive practice surface or profile growth context.',
    fallbackHref: '/assessment/adaptive-practice',
  },
] as const;

export const PLATFORM_AUTH_ROUTE_CONTRACTS: PlatformAuthRouteContract[] = [
  {
    href: '/login?callbackUrl=%2Fprofile',
    preservesDestination: '/profile',
    preservesDestinationOnError: true,
    errorStateIntent: 'retry-with-same-destination',
    exposesProfileAction: true,
    exposesCockpitAction: true,
  },
  {
    href: '/login',
    exposesProfileAction: false,
    exposesCockpitAction: true,
    roleCockpitFallbacks: PLATFORM_ROLE_COCKPIT_HREFS,
  },
] as const;

export const PLATFORM_PRIMARY_ROUTE_INVENTORY: PlatformPrimaryRouteInventoryEntry[] = [
  primaryRoute({
    href: '/',
    routeFile: 'src/app/page.tsx',
    frame: 'public-entry',
    roleScope: ['guest', 'student', 'teacher', 'admin'],
    authState: 'public',
    navigationLayers: ['global-product'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    owningChange: 'redesign-public-student-entry-experience',
  }),
  primaryRoute({
    href: '/login',
    routeFile: 'src/app/(auth)/login/page.tsx',
    frame: 'public-entry',
    roleScope: ['guest'],
    authState: 'auth-entry',
    navigationLayers: ['global-product'],
    floatingDock: 'hidden',
    visualQaProfile: 'auth-callback',
    owningChange: 'redesign-public-student-entry-experience',
    aliases: ['/login?callbackUrl=%2Fprofile'],
  }),
  primaryRoute({
    href: '/interactive-learning',
    routeFile: 'src/app/interactive-learning/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['guest', 'student'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    owningChange: 'migrate-student-secondary-routes-to-unified-shell',
  }),
  primaryRoute({
    href: '/interactive-learning/courses',
    routeFile: 'src/app/interactive-learning/courses/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['guest', 'student'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    owningChange: 'migrate-student-secondary-routes-to-unified-shell',
  }),
  primaryRoute({
    href: '/interactive-learning/chapter-components',
    routeFile: 'src/app/interactive-learning/chapter-components/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['guest', 'student'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    owningChange: 'migrate-student-secondary-routes-to-unified-shell',
  }),
  primaryRoute({
    href: '/interactive-learning/cross-domain-exploration',
    routeFile: 'src/app/interactive-learning/cross-domain-exploration/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['guest', 'student'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    owningChange: 'migrate-student-secondary-routes-to-unified-shell',
  }),
  primaryRoute({
    href: '/interactive-learning/courses/unit-4-1-design-task-expression',
    routeFile: 'src/app/interactive-learning/courses/unit-4-1-design-task-expression/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['guest', 'student', 'teacher'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    owningChange: 'redesign-public-student-entry-experience',
  }),
  primaryRoute({
    href: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
    routeFile: 'src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['guest', 'student', 'teacher'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    owningChange: 'implement-unit-1-1-see-the-full-picture',
  }),
  primaryRoute({
    href: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]',
    routeFile: 'src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/student/[sessionId]/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['student'],
    authState: 'mixed',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    mobileNavigation: 'workspace-command-surface',
    owningChange: 'implement-unit-1-1-see-the-full-picture',
    routePattern: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/:sessionId',
  }),
  primaryRoute({
    href: '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]',
    routeFile: 'src/app/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/[sessionId]/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['teacher'],
    authState: 'mixed',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    mobileNavigation: 'workspace-command-surface',
    owningChange: 'implement-unit-1-1-see-the-full-picture',
    routePattern: '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/:sessionId',
  }),
  primaryRoute({
    href: '/interactive-learning/courses/unit-5-4-data-driven-mpc-transition',
    routeFile: 'src/app/interactive-learning/courses/unit-5-4-data-driven-mpc-transition/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['guest', 'student', 'teacher'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    owningChange: 'harden-premium-ui-visual-governance',
  }),
  primaryRoute({
    href: '/simulations',
    routeFile: 'src/app/simulations/page.tsx',
    frame: 'mission-workspace',
    roleScope: ['guest', 'student'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'immersive',
    screenshotProfile: 'representative-covered',
    owningChange: 'redesign-immersive-learning-workspaces',
    legacyShell: {
      component: 'FeaturePageNav',
      disposition: 'scheduled-replacement',
      sourceFile: 'src/app/simulations/page.tsx',
      removalCondition: 'Simulation entry maps local return and title controls into AppShell or the approved immersive workspace shell.',
    },
  }),
  primaryRoute({
    href: '/simulations/cruise',
    routeFile: 'src/app/simulations/cruise/page.tsx',
    frame: 'mission-workspace',
    roleScope: ['guest', 'student', 'teacher'],
    authState: 'mixed',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'hidden',
    visualQaProfile: 'immersive',
    screenshotProfile: 'direct-capture',
    owningChange: 'redesign-immersive-learning-workspaces',
    aliases: [
      '/simulations/cruise?arenaTask=:taskId',
      '/simulations/cruise?arenaTask=:taskId&publicationId=:publicationId',
    ],
    legacyShell: {
      component: 'FeaturePageNav',
      disposition: 'retained-temporary',
      sourceFile: 'src/app/simulations/cruise/page.tsx',
      removalCondition: 'Concrete simulation scenes preserve launch provenance, return target, evidence rail, and local scene controls in the immersive workspace shell.',
    },
  }),
  primaryRoute({
    href: '/arena',
    routeFile: 'src/app/arena/page.tsx',
    frame: 'mission-workspace',
    roleScope: ['guest', 'student', 'teacher'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    mobileNavigation: 'drawer',
    visualQaProfile: 'immersive',
    screenshotProfile: 'representative-covered',
    owningChange: 'unify-arena-workspace-shell',
    legacyShell: {
      component: 'ArenaPageShell',
      disposition: 'adapted',
      sourceFile: 'src/features/arena/arena-hall.tsx',
      removalCondition: 'ArenaPageShell remains the Arena-first approved workspace shell prototype with collapsible navigation, drawer navigation, and centralized visual assets.',
    },
  }),
  primaryRoute({
    href: '/arena/challenges/[taskId]',
    routeFile: 'src/app/arena/challenges/[taskId]/page.tsx',
    routePattern: '/arena/challenges/:taskId',
    coveredRouteGlob: 'src/app/arena/challenges/*/page.tsx',
    frame: 'mission-workspace',
    roleScope: ['guest', 'student', 'teacher'],
    authState: 'mixed',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    mobileNavigation: 'drawer',
    visualQaProfile: 'immersive',
    screenshotProfile: 'representative-covered',
    owningChange: 'unify-arena-workspace-shell',
    unifiedUiMigrationOwner: MISSION_WORKSPACE_MIGRATION_CHANGE,
    contextualReturn: {
      sourceContext: 'arena-challenge',
      targetHint: 'Return to the Arena challenge list when leaving a challenge detail.',
      fallbackHref: '/arena',
    },
    legacyShell: {
      component: 'ArenaPageShell',
      disposition: 'adapted',
      sourceFile: 'src/features/arena/challenge-detail.tsx',
      removalCondition: 'Arena challenge detail remains in the approved Arena workspace shell while challenge-local commands move into central route metadata.',
    },
  }),
  primaryRoute({
    href: '/assessment/adaptive-practice',
    routeFile: 'src/app/assessment/adaptive-practice/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['guest', 'student'],
    authState: 'mixed',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: 'redesign-learner-data-and-report-surfaces',
  }),
  primaryRoute({
    href: '/interactive-learning/control-workbench',
    routeFile: 'src/app/interactive-learning/control-workbench/page.tsx',
    frame: 'mission-workspace',
    roleScope: ['guest', 'student', 'teacher'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    mobileNavigation: 'drawer',
    visualQaProfile: 'immersive',
    screenshotProfile: 'direct-capture',
    owningChange: 'redesign-immersive-learning-workspaces',
    aliases: [
      '/interactive-learning/control-workbench?mode=explore&preset=classic-four-view',
      '/interactive-learning/control-workbench?arenaTask=:taskId',
      '/interactive-learning/control-workbench?arenaTask=:taskId&publicationId=:publicationId',
    ],
  }),
  primaryRoute({
    href: '/dashboard',
    routeFile: 'src/app/(main)/dashboard/page.tsx',
    frame: 'learning-atlas',
    roleScope: ['student'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    mobileNavigation: 'role-route-tabs',
    owningChange: 'redesign-learner-data-and-report-surfaces',
  }),
  primaryRoute({
    href: '/profile',
    routeFile: 'src/app/(main)/profile/page.tsx',
    frame: 'report-ledger',
    roleScope: ['student', 'teacher', 'admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    mobileNavigation: 'role-route-tabs',
    owningChange: 'redesign-learner-data-and-report-surfaces',
  }),
  primaryRoute({
    href: '/profile/growth',
    routeFile: 'src/app/(main)/profile/growth/page.tsx',
    frame: 'report-ledger',
    roleScope: ['student', 'teacher', 'admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    mobileNavigation: 'role-route-tabs',
    themeSupport: ['light'],
    owningChange: 'redesign-learner-data-and-report-surfaces',
  }),
  primaryRoute({
    href: '/profile/portfolio',
    routeFile: 'src/app/(main)/profile/portfolio/page.tsx',
    frame: 'report-ledger',
    roleScope: ['student', 'teacher', 'admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    mobileNavigation: 'role-route-tabs',
    owningChange: 'redesign-learner-data-and-report-surfaces',
  }),
  primaryRoute({
    href: '/profile/evidence',
    routeFile: 'src/app/(main)/profile/evidence/page.tsx',
    frame: 'report-ledger',
    roleScope: ['student', 'teacher', 'admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    mobileNavigation: 'role-route-tabs',
    themeSupport: ['light'],
    owningChange: 'redesign-learner-data-and-report-surfaces',
  }),
  primaryRoute({
    href: '/assessment/document-feedback',
    routeFile: 'src/app/assessment/document-feedback/page.tsx',
    frame: 'report-ledger',
    roleScope: ['student'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    mobileNavigation: 'role-route-tabs',
    themeSupport: ['light'],
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/data-center',
    routeFile: 'src/app/data-center/page.tsx',
    frame: 'knowledge-data-map',
    roleScope: ['teacher', 'admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: DATA_CENTER_OPERATIONS_ROLE_CHANGE,
  }),
  primaryRoute({
    href: '/classroom/student/[sessionId]',
    routeFile: 'src/app/classroom/student/[sessionId]/page.tsx',
    frame: 'mission-workspace',
    roleScope: ['student'],
    authState: 'protected-redirect',
    navigationLayers: ['contextual-workspace', 'local-tool'],
    floatingDock: 'hidden',
    visualQaProfile: 'immersive',
    owningChange: 'redesign-immersive-learning-workspaces',
    shellRemovalCondition: 'Classroom student runtime adopts the immersive workspace shell without losing session controls.',
    exception: {
      owner: 'redesign-immersive-learning-workspaces',
      affectedCapability: 'classroom-student-runtime',
      reason: 'Live classroom session controls remain route-local until the workspace shell migration lands.',
      expiresOn: '2026-08-31',
    },
  }),
  primaryRoute({
    href: '/interactive-learning/courses/[course]/student/[sessionId]',
    routeFile: 'src/app/interactive-learning/courses/unit-4-1-design-task-expression/student/[sessionId]/page.tsx',
    routePattern: '/interactive-learning/courses/:course/student/:sessionId',
    coveredRouteGlob: 'src/app/interactive-learning/courses/*/student/[sessionId]/page.tsx',
    frame: 'mission-workspace',
    roleScope: ['student'],
    authState: 'protected-redirect',
    navigationLayers: ['contextual-workspace', 'local-tool'],
    floatingDock: 'hidden',
    visualQaProfile: 'immersive',
    owningChange: 'redesign-immersive-learning-workspaces',
    shellRemovalCondition: 'Private course student runtimes adopt the standard lesson runtime shell.',
    exception: {
      owner: 'redesign-immersive-learning-workspaces',
      affectedCapability: 'private-course-student-runtime',
      reason: 'Concrete course routes share a pattern and will migrate through the shared lesson runtime.',
      expiresOn: '2026-08-31',
    },
  }),
  primaryRoute({
    href: '/playlists/[id]/play',
    routeFile: 'src/app/playlists/[id]/play/page.tsx',
    frame: 'mission-workspace',
    roleScope: ['student', 'teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['contextual-workspace', 'local-tool'],
    floatingDock: 'hidden',
    visualQaProfile: 'immersive',
    owningChange: 'redesign-immersive-learning-workspaces',
    shellRemovalCondition: 'Playlist player adopts the immersive workspace shell or is retired from primary navigation.',
    exception: {
      owner: 'redesign-immersive-learning-workspaces',
      affectedCapability: 'course-private-player',
      reason: 'Playlist player is a private route and requires runtime-specific migration.',
      expiresOn: '2026-08-31',
    },
  }),
  primaryRoute({
    href: '/teacher',
    routeFile: 'src/app/teacher/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    legacyShell: {
      component: 'TeacherLayout',
      disposition: 'scheduled-replacement',
      sourceFile: 'src/app/teacher/layout.tsx',
      removalCondition: 'Teacher layout delegates header, cockpit navigation, and account actions to AppShell.',
    },
  }),
  primaryRoute({
    href: '/teacher/classes',
    routeFile: 'src/app/teacher/classes/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/classes/[classId]',
    routeFile: 'src/app/teacher/classes/[classId]/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/classes/[classId]/analytics-v2',
    routeFile: 'src/app/teacher/classes/[classId]/analytics-v2/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/classes/[classId]/students/[studentId]',
    routeFile: 'src/app/teacher/classes/[classId]/students/[studentId]/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    themeSupport: ['light'],
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/classes/[classId]/students/[studentId]/evidence',
    routeFile: 'src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/lesson-plans',
    routeFile: 'src/app/teacher/lesson-plans/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/preset-lessons',
    routeFile: 'src/app/teacher/preset-lessons/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/resources',
    routeFile: 'src/app/teacher/resources/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/resources/resource-nodes',
    routeFile: 'src/app/teacher/resources/resource-nodes/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/history',
    routeFile: 'src/app/teacher/history/page.tsx',
    frame: 'operations-console',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/grading-workbench',
    routeFile: 'src/app/(teacher-report-ledger)/teacher/grading-workbench/page.tsx',
    frame: 'report-ledger',
    roleScope: ['teacher', 'admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    themeSupport: ['light'],
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/prep-packs',
    routeFile: 'src/app/teacher/prep-packs/page.tsx',
    frame: 'report-ledger',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    themeSupport: ['light'],
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/teacher/arena',
    routeFile: 'src/app/teacher/arena/page.tsx',
    frame: 'mission-workspace',
    roleScope: ['teacher'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'immersive',
    screenshotProfile: 'representative-covered',
    owningChange: 'redesign-immersive-learning-workspaces',
  }),
  primaryRoute({
    href: '/teacher/arena/publications/[publicationId]',
    routeFile: 'src/app/teacher/arena/publications/[publicationId]/page.tsx',
    routePattern: '/teacher/arena/publications/:publicationId',
    frame: 'mission-workspace',
    roleScope: ['teacher', 'admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'immersive',
    screenshotProfile: 'representative-covered',
    owningChange: 'redesign-immersive-learning-workspaces',
    unifiedUiMigrationOwner: MISSION_WORKSPACE_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/admin',
    routeFile: 'src/app/admin/page.tsx',
    frame: 'operations-console',
    roleScope: ['admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    legacyShell: {
      component: 'AdminConsoleHeader',
      disposition: 'scheduled-replacement',
      sourceFile: 'src/features/admin/admin-console-home.tsx',
      removalCondition: 'Admin console home maps status notes and actions into AppShell AppHeader and PlatformSurface slots.',
    },
  }),
  primaryRoute({
    href: '/admin/users',
    routeFile: 'src/app/admin/users/page.tsx',
    frame: 'operations-console',
    roleScope: ['admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    legacyShell: {
      component: 'AdminConsoleHeader',
      disposition: 'scheduled-replacement',
      sourceFile: 'src/features/admin/admin-dashboard.tsx',
      removalCondition: 'Admin user dashboard maps tabs and actions into AppShell AppHeader and PlatformSurface slots.',
    },
  }),
  primaryRoute({
    href: '/admin/states',
    routeFile: 'src/app/admin/states/page.tsx',
    frame: 'operations-console',
    roleScope: ['admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    legacyShell: {
      component: 'AdminConsoleHeader',
      disposition: 'scheduled-replacement',
      sourceFile: 'src/features/admin/states/admin-states-dashboard.tsx',
      removalCondition: 'Admin states dashboard maps metric header controls into AppShell AppHeader and PlatformSurface slots.',
    },
  }),
  primaryRoute({
    href: '/admin/config',
    routeFile: 'src/app/admin/config/page.tsx',
    frame: 'operations-console',
    roleScope: ['admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    legacyShell: {
      component: 'AdminConsoleHeader',
      disposition: 'scheduled-replacement',
      sourceFile: 'src/features/admin/system-config-dashboard.tsx',
      removalCondition: 'Admin config dashboard maps model and system tabs into AppShell AppHeader and PlatformSurface slots.',
    },
  }),
  primaryRoute({
    href: '/admin/lesson-plans',
    routeFile: 'src/app/admin/lesson-plans/page.tsx',
    frame: 'operations-console',
    roleScope: ['admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
  }),
  primaryRoute({
    href: '/admin/data-governance',
    routeFile: 'src/app/admin/data-governance/page.tsx',
    frame: 'operations-console',
    roleScope: ['admin'],
    authState: 'protected-redirect',
    navigationLayers: ['role-cockpit', 'contextual-workspace', 'local-tool'],
    floatingDock: 'enabled',
    visualQaProfile: 'representative',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    legacyShell: {
      component: 'AdminConsoleHeader',
      disposition: 'scheduled-replacement',
      sourceFile: 'src/features/admin/data-governance-dashboard.tsx',
      removalCondition: 'Data governance dashboard maps governance status and report actions into AppShell AppHeader and PlatformSurface slots.',
    },
  }),
  primaryRoute({
    href: '/ai',
    routeFile: 'src/app/ai/page.tsx',
    frame: 'knowledge-data-map',
    roleScope: ['student', 'teacher', 'admin'],
    authState: 'protected-redirect',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'hidden',
    visualQaProfile: 'representative',
    owningChange: 'rebuild-navigation-frame-system',
    shellRemovalCondition: 'AI landing route is either registered under the platform navigation frame or removed from primary product navigation.',
    legacyShell: {
      component: 'FeaturePageNav',
      disposition: 'retained-temporary',
      sourceFile: 'src/app/ai/page.tsx',
      removalCondition: 'AI landing route maps local return and title controls into AppShell or a registered AI workspace shell.',
    },
    exception: {
      owner: 'rebuild-navigation-frame-system',
      affectedCapability: 'ai-landing-route',
      reason: 'AI route is not part of the commercial UI migration series but remains a primary product route.',
      expiresOn: '2026-08-31',
    },
    dockDisposition: [{
      component: 'GlobalAIFloatingButton',
      disposition: 'registered-shared-dock',
      removalCondition: 'Konling entry registers through PageFloatingControlsProvider instead of rendering an independent fixed button.',
    }],
  }),
  primaryRoute({
    href: '/ai/copilot',
    routeFile: 'src/app/ai/copilot/page.tsx',
    frame: 'knowledge-data-map',
    roleScope: ['student', 'teacher', 'admin'],
    authState: 'protected-redirect',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'hidden',
    visualQaProfile: 'representative',
    owningChange: 'rebuild-navigation-frame-system',
    shellRemovalCondition: 'AI copilot route is either registered under the platform navigation frame or removed from primary product navigation.',
    legacyShell: {
      component: 'FeaturePageNav',
      disposition: 'retained-temporary',
      sourceFile: 'src/app/ai/copilot/page.tsx',
      removalCondition: 'AI copilot route maps local return and title controls into AppShell or a registered AI workspace shell.',
    },
    exception: {
      owner: 'rebuild-navigation-frame-system',
      affectedCapability: 'ai-copilot-route',
      reason: 'Copilot route needs frame ownership before visual migration can claim it.',
      expiresOn: '2026-08-31',
    },
    dockDisposition: [{
      component: 'GlobalAIFloatingButton',
      disposition: 'registered-shared-dock',
      removalCondition: 'Konling copilot entry registers through PageFloatingControlsProvider instead of rendering an independent fixed button.',
    }],
  }),
  primaryRoute({
    href: '/knowledge',
    routeFile: 'src/app/knowledge/page.tsx',
    frame: 'knowledge-data-map',
    roleScope: ['guest', 'student', 'teacher'],
    authState: 'public',
    navigationLayers: ['global-product', 'contextual-workspace', 'local-tool'],
    floatingDock: 'collapsed',
    visualQaProfile: 'representative',
    owningChange: KNOWLEDGE_MAP_UNIFIED_SHELL_CHANGE,
    unifiedUiMigrationOwner: KNOWLEDGE_MAP_UNIFIED_SHELL_CHANGE,
  }),
] as const;

export const PLATFORM_REPORT_SURFACE_INVENTORY: PlatformReportSurfaceInventoryEntry[] = [
  {
    id: 'classroom-session-report',
    ownerRoute: '/classroom/student/[sessionId]',
    sourceFile: 'src/app/classroom/student/[sessionId]/page.tsx',
    category: 'classroom',
    surfaceType: 'primary-route',
    owningChange: 'redesign-report-ledger-and-export-surfaces',
    sourceShellOwner: 'redesign-immersive-learning-workspaces',
    visualQaProfile: 'temporary-exception',
  },
  {
    id: 'arena-challenge-result',
    ownerRoute: '/arena/challenges/[taskId]',
    sourceFile: 'src/features/arena/challenge-detail.tsx',
    category: 'arena',
    surfaceType: 'embedded-component',
    owningChange: 'redesign-report-ledger-and-export-surfaces',
    sourceShellOwner: 'unify-arena-workspace-shell',
    visualQaProfile: 'representative-covered',
  },
  {
    id: 'arena-publication-report',
    ownerRoute: '/teacher/arena/publications/[publicationId]',
    sourceFile: 'src/app/teacher/arena/publications/[publicationId]/page.tsx',
    category: 'arena',
    surfaceType: 'primary-route',
    owningChange: 'redesign-report-ledger-and-export-surfaces',
    sourceShellOwner: 'redesign-immersive-learning-workspaces',
    visualQaProfile: 'representative-covered',
  },
  {
    id: 'learner-growth-report',
    ownerRoute: '/profile/growth',
    sourceFile: 'src/app/(main)/profile/growth/page.tsx',
    category: 'learner',
    surfaceType: 'primary-route',
    owningChange: 'redesign-report-ledger-and-export-surfaces',
    sourceShellOwner: 'redesign-learner-data-and-report-surfaces',
    visualQaProfile: 'direct-capture',
  },
  {
    id: 'learner-evidence-report',
    ownerRoute: '/profile/evidence',
    sourceFile: 'src/app/(main)/profile/evidence/page.tsx',
    category: 'learner',
    surfaceType: 'primary-route',
    owningChange: 'redesign-report-ledger-and-export-surfaces',
    sourceShellOwner: 'redesign-learner-data-and-report-surfaces',
    visualQaProfile: 'direct-capture',
  },
  {
    id: 'teacher-class-analytics-report',
    ownerRoute: '/teacher/classes/[classId]/analytics-v2',
    sourceFile: 'src/app/teacher/classes/[classId]/analytics-v2/page.tsx',
    category: 'teacher-report',
    surfaceType: 'primary-route',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    sourceShellOwner: OPERATIONS_REPORT_MIGRATION_CHANGE,
    visualQaProfile: 'direct-capture',
  },
  {
    id: 'document-grading-workbench-ledger',
    ownerRoute: '/teacher/grading-workbench',
    sourceFile: 'src/features/assessment/document-rubric-grading-ui.tsx',
    category: 'grading',
    surfaceType: 'primary-route',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    sourceShellOwner: OPERATIONS_REPORT_MIGRATION_CHANGE,
    visualQaProfile: 'direct-capture',
  },
  {
    id: 'teacher-prep-pack-review-slot',
    ownerRoute: '/teacher',
    sourceFile: 'src/features/teacher/teacher-dashboard.tsx',
    category: 'prep-pack',
    surfaceType: 'embedded-component',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    sourceShellOwner: OPERATIONS_REPORT_MIGRATION_CHANGE,
    visualQaProfile: 'representative-covered',
  },
  {
    id: 'teacher-prep-pack-review',
    ownerRoute: '/teacher/prep-packs',
    sourceFile: 'src/features/teacher/teacher-prep-pack-review-surface.tsx',
    category: 'prep-pack',
    surfaceType: 'primary-route',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    sourceShellOwner: OPERATIONS_REPORT_MIGRATION_CHANGE,
    visualQaProfile: 'representative-covered',
  },
  {
    id: 'assistant-effect-report-export',
    ownerRoute: '/teacher',
    sourceFile: 'src/app/api/teacher/classes/[classId]/assistant-effect-report/route.ts',
    category: 'assistant-effect',
    surfaceType: 'export-view',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    sourceShellOwner: OPERATIONS_REPORT_MIGRATION_CHANGE,
    visualQaProfile: 'representative-covered',
  },
  {
    id: 'governance-data-quality-snapshot',
    ownerRoute: '/admin/data-governance',
    sourceFile: 'src/app/admin/data-governance/page.tsx',
    category: 'governance',
    surfaceType: 'primary-route',
    owningChange: OPERATIONS_REPORT_MIGRATION_CHANGE,
    sourceShellOwner: OPERATIONS_REPORT_MIGRATION_CHANGE,
    visualQaProfile: 'direct-capture',
  },
  {
    id: 'data-center-platform-snapshot',
    ownerRoute: '/data-center',
    sourceFile: 'src/app/data-center/page.tsx',
    category: 'data-center',
    surfaceType: 'primary-route',
    owningChange: 'redesign-report-ledger-and-export-surfaces',
    sourceShellOwner: DATA_CENTER_OPERATIONS_ROLE_CHANGE,
    visualQaProfile: 'direct-capture',
  },
] as const;

export const COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS: CommercialStudentEntryIntentGroup[] = [
  {
    intent: 'learn',
    label: '学习',
    summary: '课程、知识图谱与互动学习入口。',
    entryIds: ['student-knowledge', 'student-interactive-learning'],
    hrefs: ['/knowledge', '/interactive-learning'],
  },
  {
    intent: 'practice',
    label: '练习',
    summary: '自适应练习、诊断与补强路径。',
    entryIds: ['student-adaptive-learning'],
    hrefs: ['/assessment/adaptive-practice', '/profile/growth'],
  },
  {
    intent: 'challenge',
    label: '挑战',
    summary: '竞技场挑战、榜单与正式评价。',
    entryIds: ['student-arena'],
    hrefs: ['/arena'],
  },
  {
    intent: 'experiment',
    label: '实验',
    summary: '仿真对象、控制工作台与参数探索。',
    entryIds: ['student-simulations', 'student-control-workbench'],
    hrefs: ['/simulations', '/interactive-learning/control-workbench'],
  },
  {
    intent: 'review',
    label: '复盘',
    summary: '个人证据、成长轨迹与学习报告。',
    entryIds: ['student-profile'],
    hrefs: ['/profile/evidence', '/profile/growth', '/profile'],
  },
  {
    intent: 'account-profile',
    label: '账号与画像',
    summary: '登录、账号、个人中心与回调目标。',
    entryIds: ['student-profile'],
    hrefs: ['/login?callbackUrl=%2Fprofile', '/profile'],
  },
] as const;

export const COMMERCIAL_STUDENT_ENTRY_SURFACE_ROUTES: CommercialStudentEntrySurfaceRoute[] = [
  {
    href: '/',
    routeFile: 'src/app/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'experiment',
    firstViewportRequirement: 'usable destinations visible beside the product identity',
    stateCoverage: ['public', 'authenticated', 'mobile-navigation'],
  },
  {
    href: '/login?callbackUrl=%2Fprofile',
    routeFile: 'src/app/(auth)/login/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'account-profile',
    firstViewportRequirement: 'usable login and preserved callback intent visible',
    stateCoverage: ['loading', 'authentication-error', 'callback-preserved'],
  },
  {
    href: '/dashboard',
    routeFile: 'src/app/(main)/dashboard/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'learn',
    firstViewportRequirement: 'usable intent map and quick actions visible',
    stateCoverage: ['authenticated', 'role-redirect'],
  },
  {
    href: '/interactive-learning',
    routeFile: 'src/app/interactive-learning/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'learn',
    firstViewportRequirement: 'usable course, cross-domain, and component paths visible',
    stateCoverage: ['public', 'route-continuity'],
  },
  {
    href: '/interactive-learning/courses',
    routeFile: 'src/app/interactive-learning/courses/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'learn',
    firstViewportRequirement: 'usable module progression, course type, and launch action visible',
    stateCoverage: ['public', 'module-progression', 'route-continuity'],
  },
  {
    href: '/interactive-learning/courses/unit-4-1-design-task-expression',
    routeFile: 'src/app/interactive-learning/courses/unit-4-1-design-task-expression/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'learn',
    firstViewportRequirement: 'usable representative course entry keeps premium entry family and launch actions visible',
    stateCoverage: ['public', 'teacher-entry', 'student-demo', 'join-code'],
  },
  {
    href: '/simulations',
    routeFile: 'src/app/simulations/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'experiment',
    firstViewportRequirement: 'usable ship imagery, difficulty, course fit, task status, and launch action visible',
    stateCoverage: ['public', 'scenario-fleet', 'course-design-dialog'],
  },
  {
    href: '/arena',
    routeFile: 'src/app/arena/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'challenge',
    firstViewportRequirement: 'usable challenge discovery and workbench entry visible',
    stateCoverage: ['public', 'authenticated', 'empty-publications'],
  },
  {
    href: '/assessment/adaptive-practice',
    routeFile: 'src/app/assessment/adaptive-practice/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'practice',
    firstViewportRequirement: 'usable practice, retry, learner-state, and review actions visible',
    stateCoverage: ['loading', 'empty', 'fallback', 'unauthenticated', 'authenticated'],
  },
  {
    href: '/profile',
    routeFile: 'src/app/(main)/profile/page.tsx',
    viewportWidths: [1440, 320],
    currentIntent: 'review',
    firstViewportRequirement: 'usable evidence review and account/profile action visible',
    stateCoverage: ['loading', 'unauthenticated', 'error', 'authenticated'],
  },
] as const;

const PLATFORM_ROLE_NAVIGATION_ITEMS: readonly PlatformRoleNavigationItem[] = [
  {
    id: 'public-home',
    label: '首页',
    href: '/',
    role: 'guest',
    order: 10,
    group: 'public',
    description: '平台首页与角色入口。',
    iconKey: 'home',
    actionPriority: 10,
  },
  {
    id: 'public-login',
    label: '账号登录',
    href: '/login',
    role: 'guest',
    order: 20,
    group: 'public',
    description: '统一账号登录入口。',
    iconKey: 'login',
    actionPriority: 20,
  },
  {
    id: 'student-cockpit',
    label: '学生驾驶舱',
    href: PLATFORM_ROLE_COCKPIT_HREFS.student,
    role: 'student',
    order: 10,
    group: 'role-cockpit',
    description: '学生学习状态、课堂加入和核心模块入口。',
    iconKey: 'home',
    actionLabel: '进入驾驶舱',
    actionPriority: 10,
  },
  {
    id: 'teacher-cockpit',
    label: '教师驾驶舱',
    href: PLATFORM_ROLE_COCKPIT_HREFS.teacher,
    role: 'teacher',
    order: 10,
    group: 'role-cockpit',
    description: '教师班级、教案、课堂和资源管理入口。',
    iconKey: 'teacher',
    actionLabel: '进入教师端',
    actionPriority: 10,
  },
  {
    id: 'admin-cockpit',
    label: '管理员后台',
    href: PLATFORM_ROLE_COCKPIT_HREFS.admin,
    role: 'admin',
    order: 10,
    group: 'role-cockpit',
    description: '管理员用户、配置、统计和治理入口。',
    iconKey: 'settings',
    actionLabel: '进入管理端',
    actionPriority: 10,
  },
  {
    id: 'student-simulations',
    label: '虚拟仿真',
    href: '/simulations',
    role: 'student',
    order: 100,
    group: 'student-core',
    description: '进入船舶与海工对象仿真任务，观察控制响应和指标变化。',
    iconKey: 'ship',
    actionLabel: '开始仿真',
    actionPriority: 20,
  },
  {
    id: 'student-knowledge',
    label: '知识资源',
    href: '/knowledge',
    role: 'student',
    order: 110,
    group: 'student-core',
    description: '查看知识图谱、知识卡片和课程资源关系。',
    iconKey: 'knowledge',
    actionLabel: '查看资源',
    actionPriority: 30,
  },
  {
    id: 'student-arena',
    label: '竞技场',
    href: '/arena',
    role: 'student',
    order: 120,
    group: 'student-core',
    description: '进入挑战详情、公开实验、正式提交和榜单比较。',
    iconKey: 'arena',
    actionLabel: '进入挑战',
    actionPriority: 40,
  },
  {
    id: 'student-control-workbench',
    label: '控制工作台',
    href: '/interactive-learning/control-workbench',
    role: 'student',
    order: 130,
    group: 'student-core',
    description: '在统一工作台中连接对象、模型、控制器和响应图。',
    iconKey: 'workbench',
    actionLabel: '打开工作台',
    actionPriority: 50,
    aliasHrefs: ['/interactive-learning/control-workbench?mode=explore&preset=classic-four-view'],
  },
  {
    id: 'student-adaptive-learning',
    label: '自适应学习',
    href: '/assessment/adaptive-practice',
    role: 'student',
    order: 140,
    group: 'student-core',
    description: '进入个性化练习与能力诊断，连接后续学习建议。',
    iconKey: 'adaptive',
    actionLabel: '继续练习',
    actionPriority: 60,
    aliasHrefs: [
      '/profile/growth',
      '/assessment/adaptive-practice?goal=control-correction&intent=practice',
      '/profile/growth?goal=control-correction&intent=contextual-recommendation',
    ],
  },
  {
    id: 'student-interactive-learning',
    label: '互动学习',
    href: '/interactive-learning',
    role: 'student',
    order: 150,
    group: 'student-core',
    description: '进入跨域探索、互动课程和章节互动组件。',
    iconKey: 'interactive',
    actionLabel: '进入互动',
    actionPriority: 70,
  },
  {
    id: 'student-profile',
    label: '个人中心',
    href: '/profile',
    role: 'student',
    order: 160,
    group: 'role-cockpit',
    description: '查看能力画像、活动轨迹、成长建议和学习档案。',
    iconKey: 'profile',
    actionLabel: '查看画像',
    actionPriority: 80,
    aliasHrefs: ['/profile/growth', '/profile/portfolio'],
  },
  {
    id: 'teacher-data-center',
    label: '数据中心',
    href: '/data-center',
    role: 'teacher',
    order: 155,
    group: 'teacher-cockpit',
    description: '查看平台教学运行聚合指标、学习轨迹和来源质量。',
    iconKey: 'analytics',
    actionLabel: '查看数据中心',
    actionPriority: 75,
  },
  {
    id: 'admin-data-center',
    label: '数据中心',
    href: '/data-center',
    role: 'admin',
    order: 115,
    group: 'admin-cockpit',
    description: '查看平台教学运行聚合指标、学习轨迹和来源质量。',
    iconKey: 'analytics',
    actionLabel: '查看数据中心',
    actionPriority: 75,
  },
  {
    id: 'public-simulations',
    label: '虚拟仿真',
    href: '/simulations',
    role: 'guest',
    order: 100,
    group: 'public',
    description: '公开浏览船舶与海工对象仿真任务。',
    iconKey: 'ship',
    actionPriority: 30,
  },
  {
    id: 'public-knowledge',
    label: '知识资源',
    href: '/knowledge',
    role: 'guest',
    order: 110,
    group: 'public',
    description: '公开浏览知识图谱和课程资源关系。',
    iconKey: 'knowledge',
    actionPriority: 40,
  },
  {
    id: 'public-arena',
    label: '竞技场',
    href: '/arena',
    role: 'guest',
    order: 120,
    group: 'public',
    description: '公开浏览竞技场入口和挑战信息。',
    iconKey: 'arena',
    actionPriority: 50,
  },
  {
    id: 'public-control-workbench',
    label: '控制工作台',
    href: '/interactive-learning/control-workbench',
    role: 'guest',
    order: 130,
    group: 'public',
    description: '公开浏览控制工作台入口。',
    iconKey: 'workbench',
    actionPriority: 60,
  },
  {
    id: 'teacher-classes',
    label: '班级管理',
    href: '/teacher/classes',
    role: 'teacher',
    order: 100,
    group: 'teacher-cockpit',
    description: '管理班级、加入码、学生名单和班级学情。',
    iconKey: 'classes',
    actionPriority: 20,
    aliasHrefs: ['/teacher/classes/new'],
  },
  {
    id: 'teacher-lesson-plans',
    label: '教案设计',
    href: '/teacher/lesson-plans',
    role: 'teacher',
    order: 110,
    group: 'teacher-cockpit',
    description: '创建和维护 BOPPPS 教学设计。',
    iconKey: 'lesson-plans',
    actionPriority: 30,
    aliasHrefs: ['/teacher/lesson-plans/new'],
  },
  {
    id: 'teacher-preset-lessons',
    label: '预置教案',
    href: '/teacher/preset-lessons',
    role: 'teacher',
    order: 120,
    group: 'teacher-cockpit',
    description: '复用系统预置互动课和课堂模板。',
    iconKey: 'lesson-plans',
    actionPriority: 40,
  },
  {
    id: 'teacher-resources',
    label: '教学资源',
    href: '/teacher/resources',
    role: 'teacher',
    order: 130,
    group: 'teacher-cockpit',
    description: '管理互动组件、知识节点和课程资源。',
    iconKey: 'resources',
    actionPriority: 50,
  },
  {
    id: 'teacher-history',
    label: '上课历史',
    href: '/teacher/history',
    role: 'teacher',
    order: 140,
    group: 'teacher-cockpit',
    description: '查看已结束课堂和归档记录。',
    iconKey: 'history',
    actionPriority: 60,
  },
  {
    id: 'teacher-arena',
    label: '竞技场配置',
    href: '/teacher/arena',
    role: 'teacher',
    order: 150,
    group: 'teacher-cockpit',
    description: '配置面向班级的竞技场挑战发布。',
    iconKey: 'arena',
    actionPriority: 70,
  },
  {
    id: 'admin-users',
    label: '用户管理',
    href: '/admin/users',
    role: 'admin',
    order: 100,
    group: 'admin-cockpit',
    description: '账号、角色、密码重置与批量导入统一收口。',
    iconKey: 'users',
    actionPriority: 20,
  },
  {
    id: 'admin-states',
    label: '系统统计',
    href: '/admin/states',
    role: 'admin',
    order: 110,
    group: 'admin-cockpit',
    description: '查看访问量、互动分布、仿真活跃度与趋势。',
    iconKey: 'analytics',
    actionPriority: 30,
  },
  {
    id: 'admin-data-governance',
    label: '数据治理',
    href: '/admin/data-governance',
    role: 'admin',
    order: 120,
    group: 'admin-cockpit',
    description: '追踪学习事实、快照队列、风险清单与数据新鲜度。',
    iconKey: 'database',
    actionPriority: 40,
  },
  {
    id: 'admin-config',
    label: '系统配置',
    href: '/admin/config',
    role: 'admin',
    order: 130,
    group: 'admin-cockpit',
    description: '管理平台基础参数、AI 供应商、模型目录与响应测试。',
    iconKey: 'settings',
    actionPriority: 50,
  },
  {
    id: 'teacher-resource-nodes',
    label: 'ResourceNode 管理',
    href: '/teacher/resources/resource-nodes',
    role: 'teacher',
    order: 135,
    group: 'teacher-cockpit',
    description: '管理资源节点映射、可用性、教师策略、隐私级别和路径资格。',
    iconKey: 'resources',
    actionLabel: '管理节点',
    actionPriority: 55,
  },
  {
    id: 'student-adaptive-path',
    label: '学习路径图',
    href: '/profile/growth?view=path',
    role: 'student',
    order: 310,
    group: 'future',
    description: '未来路径地图、时间线和证据解释入口。',
    iconKey: 'adaptive',
    featureFlag: PLATFORM_NAVIGATION_FEATURE_FLAGS.adaptivePath,
    availability: 'disabled',
    disabledReason: '等待规则图搜索路径规划变更落地。',
  },
  {
    id: 'student-konling',
    label: 'Konling 干预',
    href: '/ai/copilot?mode=konling',
    role: 'student',
    order: 320,
    group: 'future',
    description: '未来基于学习状态和路径上下文的 Konling 干预入口。',
    iconKey: 'konling',
    featureFlag: PLATFORM_NAVIGATION_FEATURE_FLAGS.konling,
    availability: 'disabled',
    disabledReason: '等待 Konling 自适应代理运行时变更落地。',
  },
  {
    id: 'admin-governance-workspace',
    label: '治理工作区',
    href: '/admin/data-governance?workspace=evidence',
    role: 'admin',
    order: 330,
    group: 'future',
    description: '未来证据治理、隐私范围和跨域状态工作区。',
    iconKey: 'database',
    featureFlag: PLATFORM_NAVIGATION_FEATURE_FLAGS.governance,
    availability: 'disabled',
    disabledReason: '等待教师/管理员治理工作区变更落地。',
  },
  {
    id: 'admin-experiments',
    label: '实验运营',
    href: '/admin/experiments',
    role: 'admin',
    order: 340,
    group: 'future',
    description: '未来自适应策略实验、分层分流和报告入口。',
    iconKey: 'experiments',
    featureFlag: PLATFORM_NAVIGATION_FEATURE_FLAGS.experiments,
    availability: 'hidden',
    disabledReason: '等待 Stage 2 自适应优化实验变更落地。',
  },
];

export const PLATFORM_ROLE_NAVIGATION_GROUPS = createPlatformNavigation(PLATFORM_ROLE_NAVIGATION_ITEMS);

export function getPlatformRoleNavigation(
  role: PlatformRoleNavigationAudience,
  options: PlatformRoleNavigationOptions = {},
): PlatformRoleNavigationItem[] {
  return filterPlatformNavigation(PLATFORM_ROLE_NAVIGATION_GROUPS, {
    role,
    enabledFeatureFlags: options.enabledFeatureFlags,
    includeDisabled: options.includeDisabled,
    includeHidden: options.includeHidden,
  }) as PlatformRoleNavigationItem[];
}

function normalizeInventoryHref(href: string) {
  const path = href.split(/[?#]/, 1)[0];
  return path || '/';
}

function routePatternToRegExp(pattern: string) {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\[.+?\\\]/g, '[^/]+')
    .replace(/:[^/]+/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

export function resolvePlatformRouteInventory(href: string): PlatformPrimaryRouteInventoryEntry | undefined {
  const path = normalizeInventoryHref(href);
  const directMatch = PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => {
    if (normalizeInventoryHref(route.href) === path) return true;
    if (route.routePattern && routePatternToRegExp(route.routePattern).test(path)) return true;
    return routePatternToRegExp(route.href).test(path);
  });
  if (directMatch) return directMatch;
  return PLATFORM_PRIMARY_ROUTE_INVENTORY.find((route) => (
    route.aliases?.some((alias) => normalizeInventoryHref(alias) === path)
  ));
}

export function getPlatformRouteNavigation(
  href: string,
  role: PlatformRoleNavigationAudience,
  options: PlatformRoleNavigationOptions = {},
): PlatformRoleNavigationItem[] {
  const route = resolvePlatformRouteInventory(href);
  const navigation = getPlatformRoleNavigation(role, options);
  const enabledFeatureFlags = new Set(options.enabledFeatureFlags ?? []);
  const isAvailable = (entry: PlatformRoleNavigationItem) => {
    if (entry.availability === 'hidden' && !options.includeHidden) return false;
    if (entry.availability === 'disabled' && !options.includeDisabled) return false;
    if (entry.featureFlag && !enabledFeatureFlags.has(entry.featureFlag)) return false;
    return true;
  };
  if (!route) return navigation;
  if (route.navigationLayers.includes('global-product') && route.navigationLayers.includes('role-cockpit')) {
    return navigation;
  }
  if (route.navigationLayers.includes('role-cockpit')) {
    return navigation.filter((entry) => entry.group === 'role-cockpit' || entry.group === 'teacher-cockpit' || entry.group === 'admin-cockpit');
  }
  if (route.navigationLayers.includes('global-product')) {
    const globalEntries = PLATFORM_ROLE_NAVIGATION_GROUPS.filter((entry) => (
      (entry.group === 'public' || entry.group === 'student-core')
      && (
        entry.role === role
        || entry.role === 'all'
        || (entry.role === 'guest' && (role === 'guest' || entry.href !== '/login'))
      )
      && isAvailable(entry as PlatformRoleNavigationItem)
    )) as PlatformRoleNavigationItem[];
    const byHref = new Map<string, PlatformRoleNavigationItem>();
    for (const entry of globalEntries) {
      const existing = byHref.get(entry.href);
      if (!existing || (existing.role !== role && entry.role === role)) {
        byHref.set(entry.href, entry);
      }
    }
    return Array.from(byHref.values());
  }
  return [];
}

export function getStudentCoreNavigationEntries(): PlatformRoleNavigationItem[] {
  const coreIds = new Set<string>(STUDENT_CORE_ENTRY_IDS);
  return getPlatformRoleNavigation('student').filter((entry) => coreIds.has(entry.id));
}

export function getStudentLearningIntentNavigationGroups(): StudentLearningIntentNavigationGroup[] {
  const entriesById = new Map(getPlatformRoleNavigation('student').map((entry) => [entry.id, entry]));
  return STUDENT_LEARNING_INTENT_GROUPS.map((group) => ({
    ...group,
    entries: group.entryIds.flatMap((entryId) => {
      const entry = entriesById.get(entryId);
      return entry ? [entry] : [];
    }),
  }));
}

export function getCommercialStudentEntryIntentGroups(): CommercialStudentEntryIntentGroup[] {
  return COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.map((group) => ({ ...group }));
}

export function resolveCommercialEntryHref(intent: CommercialStudentEntryIntent, authenticated = false): string {
  if (intent === 'account-profile') {
    return authenticated ? '/profile' : '/login?callbackUrl=%2Fprofile';
  }
  if (intent === 'review') {
    return '/profile/evidence';
  }
  return COMMERCIAL_STUDENT_ENTRY_INTENT_GROUPS.find((group) => group.intent === intent)?.hrefs[0] ?? '/dashboard';
}

export function getPlatformNavigationHref(id: string): string | undefined {
  return PLATFORM_ROLE_NAVIGATION_GROUPS.find((entry) => entry.id === id)?.href;
}

export function getPlatformCockpitHref(role?: string | null): string {
  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === 'admin') return PLATFORM_ROLE_COCKPIT_HREFS.admin;
  if (normalizedRole === 'teacher') return PLATFORM_ROLE_COCKPIT_HREFS.teacher;
  return PLATFORM_ROLE_COCKPIT_HREFS.student;
}
