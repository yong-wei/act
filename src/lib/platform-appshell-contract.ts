export type UniversalAppShellCoverageKind =
  | 'home-route'
  | 'direct-appshell'
  | 'compatible-wrapper'
  | 'governed-exception';

export type UniversalAppShellExceptionType =
  | 'auth-only'
  | 'print-only'
  | 'visual-review-only'
  | 'embed-only'
  | 'legacy-demo-only'
  | 'migration-temporary';

export interface UniversalAppShellHeaderAction {
  id: 'theme-switch' | 'personal-center';
  label: string;
  owner: 'platform-shell';
  order: number;
}

export interface AppShellCompatibleWrapperContract {
  name: string;
  sourceFile: string;
  routeFamilies: readonly string[];
  requiredDomContracts: readonly (
    | 'canonical-navigation'
    | 'breadcrumb'
    | 'theme-switch-then-personal-center'
  )[];
  contractTestFiles: readonly string[];
}

export interface UniversalAppShellException {
  routePattern: string;
  type: UniversalAppShellExceptionType;
  owner: string;
  reason: string;
  violatedShellRules: readonly string[];
  removalCondition: string;
}

export const UNIVERSAL_APP_SHELL_CHANGE_ID = 'define-universal-appshell-frame-contract';

export const UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_ORDER = [
  '首页',
  '知识资源',
  '互动学习',
  '学习路径',
  '竞技场',
  '虚拟仿真',
  '控制工作台',
  '个人中心',
] as const;

export const UNIVERSAL_APP_SHELL_CANONICAL_NAVIGATION_HREFS = [
  '/',
  '/knowledge',
  '/interactive-learning',
  '/assessment/adaptive-practice',
  '/arena',
  '/simulations',
  '/interactive-learning/control-workbench',
  '/profile',
] as const;

export const UNIVERSAL_APP_SHELL_HEADER_ACTION_ORDER: readonly UniversalAppShellHeaderAction[] = [
  {
    id: 'theme-switch',
    label: '主题切换',
    owner: 'platform-shell',
    order: 1,
  },
  {
    id: 'personal-center',
    label: '个人中心',
    owner: 'platform-shell',
    order: 2,
  },
] as const;

export const APP_SHELL_COMPATIBLE_WRAPPERS: readonly AppShellCompatibleWrapperContract[] = [
  {
    name: 'AppShell',
    sourceFile: 'src/components/platform/app-shell.tsx',
    routeFamilies: ['direct AppShell routes'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
  },
  {
    name: 'InteractiveLearningShell',
    sourceFile: 'src/features/interactive/interactive-learning-shell.tsx',
    routeFamilies: [
      '/interactive-learning',
      '/interactive-learning/courses',
      '/interactive-learning/chapter-components',
      '/interactive-learning/chapter-components/*',
      '/interactive-learning/cross-domain-exploration',
      '/interactive-learning/resources/*',
    ],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-ui-contracts.test.ts'],
  },
  {
    name: 'CourseEntryShell',
    sourceFile: 'src/features/interactive/shared/course-entry-shell.tsx',
    routeFamilies: ['/interactive-learning/courses/*'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
  },
  {
    name: 'LessonRuntimeShell',
    sourceFile: 'src/features/interactive/shared/lesson-runtime-shell.tsx',
    routeFamilies: ['/interactive-learning/courses/*/student/*', '/interactive-learning/courses/*/teacher/*'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
  },
  {
    name: 'SimulationShell',
    sourceFile: 'src/app/simulations/_components/simulation-shell.tsx',
    routeFamilies: ['/simulations/**'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-ui-contracts.test.ts'],
  },
  {
    name: 'ArenaPageShell',
    sourceFile: 'src/features/arena/arena-page-shell.tsx',
    routeFamilies: ['/arena/**'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/features/arena/__tests__/arena-entry-ui.test.ts'],
  },
  {
    name: 'ControlWorkbenchShell',
    sourceFile: 'src/features/control-workbench/shell/control-workbench-shell.tsx',
    routeFamilies: ['/interactive-learning/control-workbench'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-ui-contracts.test.ts'],
  },
  {
    name: 'RoleWorkspaceShell',
    sourceFile: 'src/components/platform/role-workspace-shell.tsx',
    routeFamilies: ['/teacher/**', '/admin/**'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-role-navigation.test.ts'],
  },
  {
    name: 'PresentationDataCenter',
    sourceFile: 'src/features/data-center/presentation-data-center.tsx',
    routeFamilies: ['/data-center'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
  },
  {
    name: 'TeacherClassroomWaitingPage',
    sourceFile: 'src/features/interactive/shared/teacher-classroom-waiting-page.tsx',
    routeFamilies: ['/interactive-learning/courses/*/teacher/*/waiting'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
  },
] as const;

export const UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS: readonly UniversalAppShellException[] = [
  {
    routePattern: '/',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Homepage is the only normal product route allowed to render outside the universal AppShell frame.',
    violatedShellRules: ['non-home-appshell-frame'],
    removalCondition: 'None. Homepage remains the public entry exception.',
  },
  {
    routePattern: '/login',
    type: 'auth-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Login is an auth-only entry and must preserve callback-safe authentication flow.',
    violatedShellRules: ['global-navigation-frame', 'personal-center-action'],
    removalCondition: 'Login is merged into a governed auth entry shell with callback preservation.',
  },
  {
    routePattern: '/register',
    type: 'auth-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Registration is an auth-only route and must preserve callback-safe account setup flow.',
    violatedShellRules: ['global-navigation-frame', 'personal-center-action'],
    removalCondition: 'Registration is merged into the governed auth entry shell.',
  },
  {
    routePattern: '/dashboard',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Dashboard is a protected redirect shim that forwards users to the role-aware cockpit.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The compatibility redirect is removed after all callers use role cockpit destinations directly.',
  },
  {
    routePattern: '/review/**',
    type: 'visual-review-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Review pages are isolated visual QA surfaces and must not inherit the product shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Review surfaces move to a report-ledger workspace or are retired after QA capture.',
  },
  {
    routePattern: '/interactive-learning/lessons/*/handout-print',
    type: 'print-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Printable handouts intentionally omit navigation and account controls.',
    violatedShellRules: ['global-navigation-frame', 'theme-switch-then-personal-center'],
    removalCondition: 'Print rendering is exposed from a shell-covered lesson route instead of a standalone page.',
  },
  {
    routePattern: '/interactive-learning/courses/*/student/*',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Some student lesson runtimes still render legacy course-specific pages before LessonRuntimeShell migration.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Each student lesson runtime adopts LessonRuntimeShell or another registered lesson AppShell wrapper.',
  },
  {
    routePattern: '/interactive-learning/courses/*/teacher/*',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Some teacher lesson runtimes still render legacy course-specific pages before LessonRuntimeShell migration.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Each teacher lesson runtime adopts LessonRuntimeShell or another registered lesson AppShell wrapper.',
  },
  {
    routePattern: '/interactive-learning/resources/control-odyssey-v1/ship',
    type: 'embed-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'The ship resource is an embed-style legacy visual resource with its own runtime viewport.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The resource renders through the registered resource detail shell or a governed embed adapter.',
  },
  {
    routePattern: '/interactive-learning/argument-principle',
    type: 'legacy-demo-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/control-map',
    type: 'legacy-demo-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/control-odyssey',
    type: 'legacy-demo-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/multi-representation-linkage',
    type: 'legacy-demo-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/physics-modeling',
    type: 'legacy-demo-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/pid-simulator',
    type: 'legacy-demo-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/ten-drops',
    type: 'legacy-demo-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/virtual-lab',
    type: 'legacy-demo-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy virtual lab route predates the simulation shell and remains outside primary navigation.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The route redirects to /simulations or adopts SimulationShell.',
  },
  {
    routePattern: '/ethics',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Public ethics page is not yet part of the product route ledger.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The route is registered as public entry content or moved under a shell-covered module.',
  },
  {
    routePattern: '/missions',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Missions is a legacy task hall that has not migrated into the learning-atlas shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Missions adopts AppShell or is replaced by shell-covered assessment and learning-path routes.',
  },
  {
    routePattern: '/evaluation/prompt-assessment',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Evaluation utility page is not yet part of the product route ledger.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The route is registered under an operations or report shell.',
  },
  {
    routePattern: '/playlists',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Playlist management route has not migrated into a governed workspace shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Playlist management adopts AppShell or a registered playlist wrapper.',
  },
  {
    routePattern: '/playlists/new',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Playlist creation route has not migrated into a governed workspace shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Playlist creation adopts AppShell form slots or a registered playlist wrapper.',
  },
  {
    routePattern: '/playlists/*/play',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Playlist playback uses a legacy launcher and recovery surface before playlist shell migration.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Playlist playback adopts a registered playlist AppShell wrapper or moves under lesson runtime shell.',
  },
  {
    routePattern: '/profile/portfolio',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Portfolio still renders a legacy learner record topbar instead of the learner data AppShell frame.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb', 'theme-switch-then-personal-center'],
    removalCondition: 'Portfolio adopts the learner data AppShell route shell used by profile, growth, and evidence pages.',
  },
  {
    routePattern: '/ai',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'AI landing route still owns a local assistant shell pending AI workspace shell migration.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'AI landing adopts AppShell or a registered AI workspace shell.',
  },
  {
    routePattern: '/ai/copilot',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'AI copilot route still owns a local assistant shell pending AI workspace shell migration.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'AI copilot adopts AppShell or a registered AI workspace shell.',
  },
  {
    routePattern: '/classroom/join',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Classroom join flow still owns a route-local session entry shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Classroom join is moved into a registered classroom AppShell wrapper.',
  },
  {
    routePattern: '/classroom/student/*',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Live classroom student runtime remains route-local until classroom player shell migration lands.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Student classroom runtime adopts a registered classroom AppShell wrapper.',
  },
  {
    routePattern: '/classroom/teacher/*',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Live classroom teacher runtime remains route-local until classroom player shell migration lands.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Teacher classroom runtime adopts a registered classroom AppShell wrapper.',
  },
  {
    routePattern: '/classroom/teacher/*/review',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Teacher classroom review route keeps route-local review controls until classroom shell migration lands.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Classroom review adopts a registered classroom AppShell wrapper.',
  },
  {
    routePattern: '/teacher/students/*/diagnosis',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy teacher student diagnosis route is a redirect shim outside the teacher AppShell layout.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The redirect shim is removed after canonical teacher class student routes cover all callers.',
  },
  {
    routePattern: '/teacher/students/*/evidence',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy teacher student evidence route is a redirect and fallback shim outside the teacher AppShell layout.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The redirect shim is removed after canonical teacher class evidence routes cover all callers.',
  },
] as const;
