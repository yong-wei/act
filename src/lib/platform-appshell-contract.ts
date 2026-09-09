export type UniversalAppShellCoverageKind =
  'home-route' | 'direct-appshell' | 'compatible-wrapper' | 'governed-exception';

export type UniversalAppShellExceptionType =
  'auth-only' | 'print-only' | 'visual-review-only' | 'embed-only' | 'legacy-demo-only' | 'migration-temporary';

export type UniversalAppShellExceptionCategory =
  | 'home-route'
  | 'auth-entry'
  | 'redirect-shim'
  | 'visual-review-surface'
  | 'print-surface'
  | 'embed-surface'
  | 'legacy-interactive-demo'
  | 'legacy-lesson-runtime'
  | 'classroom-runtime'
  | 'operations-utility';

export type AppShellGovernanceAcceptanceId =
  'AC-1' | 'AC-2' | 'AC-3' | 'AC-4' | 'AC-5' | 'AC-6' | 'AC-7';

export type AppShellRepresentativeRouteCategory =
  | 'primary'
  | 'teacher'
  | 'teacher-classes'
  | 'admin'
  | 'graph'
  | 'data-center'
  | 'course'
  | 'course-student-session'
  | 'course-teacher-session'
  | 'classroom'
  | 'ai'
  | 'playlist'
  | 'arena-child'
  | 'simulation-child'
  | 'assessment-child'
  | 'virtual-lab';

export type AppShellRepresentativeViewerRole = 'student' | 'teacher' | 'admin' | 'guest';

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
  requiredDomContracts: readonly ('canonical-navigation' | 'breadcrumb' | 'theme-switch-then-personal-center')[];
  contractTestFiles: readonly string[];
  domContractProofIds: readonly string[];
}

export interface DeepProductAppShellRouteContract {
  routePattern: string;
  sourceFile: string;
  shellEvidence: 'direct-appshell' | 'compatible-wrapper' | 'governed-exception';
  routeFamily: 'course-runtime' | 'classroom' | 'ai' | 'playlist' | 'role-workspace' | 'legacy-interactive';
  acceptanceIds: readonly ('AC1' | 'AC2' | 'AC3' | 'AC4' | 'AC5')[];
}

export interface UniversalAppShellException {
  routePattern: string;
  category: UniversalAppShellExceptionCategory;
  type: UniversalAppShellExceptionType;
  owner: string;
  reason: string;
  violatedShellRules: readonly string[];
  removalCondition: string;
}

export interface AppShellRepresentativeVisualRoute {
  category: AppShellRepresentativeRouteCategory;
  href: string;
  sourceFile: string;
  viewerRole: AppShellRepresentativeViewerRole;
  shellEvidence: UniversalAppShellCoverageKind;
  acceptanceIds: readonly AppShellGovernanceAcceptanceId[];
  requiredWidths: readonly number[];
  visualAuditStatus: 'required';
  routePattern?: string;
}

export const UNIVERSAL_APP_SHELL_CHANGE_ID = 'define-universal-appshell-frame-contract';
export const DEEP_PRODUCT_APP_SHELL_CHANGE_ID = 'migrate-deep-product-routes-appshell-chrome';
export const APP_SHELL_GOVERNANCE_CHANGE_ID = 'enforce-appshell-route-coverage-governance';

export const LEGACY_LESSON_RUNTIME_ROUTE_SLUGS = [] as const;

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

export const UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS = [1440, 1280, 1024, 768, 390, 320] as const;

export const UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_MATRIX = [
  {
    href: '/knowledge',
    label: '知识资源',
    localCommandZone: 'knowledge-canvas-local-panels',
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
  },
  {
    href: '/interactive-learning',
    label: '互动学习',
    localCommandZone: 'interactive-learning-body-actions',
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
  },
  {
    href: '/assessment/adaptive-practice',
    label: '学习路径',
    localCommandZone: 'adaptive-path-local-toolbar',
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
  },
  {
    href: '/arena',
    label: '竞技场',
    localCommandZone: 'arena-page-toolbar',
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
  },
  {
    href: '/simulations',
    label: '虚拟仿真',
    localCommandZone: 'simulation-local-tools',
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
  },
  {
    href: '/interactive-learning/control-workbench',
    label: '控制工作台',
    localCommandZone: 'control-workbench-context-strip',
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
  },
  {
    href: '/evaluation/prompt-assessment',
    label: '提示词复盘',
    localCommandZone: 'prompt-assessment-local-toolbar',
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
  },
  {
    href: '/profile',
    label: '个人中心',
    localCommandZone: 'profile-body-actions',
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
  },
] as const;

export const APP_SHELL_GOVERNANCE_REPRESENTATIVE_ROUTE_MATRIX: readonly AppShellRepresentativeVisualRoute[] = [
  ...UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_MATRIX.map((route) => ({
    category: 'primary' as const,
    href: route.href,
    sourceFile: route.href === '/profile' ? 'src/app/(main)/profile/page.tsx' : `src/app${route.href}/page.tsx`,
    viewerRole: 'student' as const,
    shellEvidence: 'direct-appshell' as const,
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6'] as const,
    requiredWidths: route.requiredWidths,
    visualAuditStatus: 'required' as const,
  })),
  {
    category: 'teacher',
    href: '/teacher',
    sourceFile: 'src/app/teacher/page.tsx',
    viewerRole: 'teacher',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6', 'AC-7'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'teacher-classes',
    href: '/teacher/classes',
    sourceFile: 'src/app/teacher/classes/page.tsx',
    viewerRole: 'teacher',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6', 'AC-7'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'admin',
    href: '/admin/users',
    sourceFile: 'src/app/admin/users/page.tsx',
    viewerRole: 'admin',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6', 'AC-7'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'data-center',
    href: '/data-center',
    sourceFile: 'src/app/data-center/page.tsx',
    viewerRole: 'teacher',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6', 'AC-7'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'course',
    href: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
    sourceFile: 'src/app/interactive-learning/courses/[routeSegment]/page.tsx',
    viewerRole: 'student',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'course-student-session',
    href: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/demo',
    sourceFile: 'src/app/interactive-learning/courses/[routeSegment]/student/[sessionId]/page.tsx',
    routePattern: '/interactive-learning/courses/unit-1-1-see-the-full-picture/student/:sessionId',
    viewerRole: 'student',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'course-teacher-session',
    href: '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/demo',
    sourceFile: 'src/app/interactive-learning/courses/[routeSegment]/teacher/[sessionId]/page.tsx',
    routePattern: '/interactive-learning/courses/unit-1-1-see-the-full-picture/teacher/:sessionId',
    viewerRole: 'teacher',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6', 'AC-7'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'classroom',
    href: '/classroom/join',
    sourceFile: 'src/app/classroom/join/page.tsx',
    viewerRole: 'student',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'ai',
    href: '/ai',
    sourceFile: 'src/app/ai/page.tsx',
    viewerRole: 'student',
    shellEvidence: 'direct-appshell',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'playlist',
    href: '/playlists',
    sourceFile: 'src/app/playlists/page.tsx',
    viewerRole: 'student',
    shellEvidence: 'direct-appshell',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'arena-child',
    href: '/arena/challenges/seeded-shell-governance-task',
    sourceFile: 'src/app/arena/challenges/[taskId]/page.tsx',
    routePattern: '/arena/challenges/:taskId',
    viewerRole: 'student',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'simulation-child',
    href: '/simulations/cruise',
    sourceFile: 'src/app/simulations/cruise/page.tsx',
    viewerRole: 'student',
    shellEvidence: 'compatible-wrapper',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'assessment-child',
    href: '/assessment/document-feedback',
    sourceFile: 'src/app/assessment/document-feedback/page.tsx',
    viewerRole: 'student',
    shellEvidence: 'direct-appshell',
    acceptanceIds: ['AC-3', 'AC-4', 'AC-6'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
  {
    category: 'virtual-lab',
    href: '/virtual-lab',
    sourceFile: 'src/app/virtual-lab/page.tsx',
    viewerRole: 'guest',
    shellEvidence: 'governed-exception',
    acceptanceIds: ['AC-2', 'AC-4', 'AC-6'],
    requiredWidths: UNIVERSAL_APP_SHELL_PRIMARY_ROUTE_RESPONSIVE_WIDTHS,
    visualAuditStatus: 'required',
  },
];

export const DEEP_PRODUCT_APP_SHELL_ROUTE_MATRIX: readonly DeepProductAppShellRouteContract[] = [
  {
    routePattern: '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/student/*',
    sourceFile: 'src/features/interactive/unit-1-2-modeling-from-object-to-system/student-page.tsx',
    shellEvidence: 'compatible-wrapper',
    routeFamily: 'course-runtime',
    acceptanceIds: ['AC1', 'AC2', 'AC5'],
  },
  {
    routePattern: '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/teacher/*',
    sourceFile: 'src/features/interactive/unit-1-2-modeling-from-object-to-system/teacher-page.tsx',
    shellEvidence: 'compatible-wrapper',
    routeFamily: 'course-runtime',
    acceptanceIds: ['AC1', 'AC2', 'AC5'],
  },
  {
    routePattern: '/interactive-learning/courses/unit-4-1-design-task-expression/student/*',
    sourceFile: 'src/features/interactive/unit-4-1-design-task-expression/student-page.tsx',
    shellEvidence: 'compatible-wrapper',
    routeFamily: 'course-runtime',
    acceptanceIds: ['AC1', 'AC2', 'AC5'],
  },
  {
    routePattern: '/interactive-learning/courses/unit-4-1-design-task-expression/teacher/*',
    sourceFile: 'src/features/interactive/unit-4-1-design-task-expression/teacher-page.tsx',
    shellEvidence: 'compatible-wrapper',
    routeFamily: 'course-runtime',
    acceptanceIds: ['AC1', 'AC2', 'AC5'],
  },
  {
    routePattern: '/interactive-learning/courses/{legacy-runtime-slug}/{student|teacher}/*',
    sourceFile: 'src/lib/platform-appshell-contract.ts',
    shellEvidence: 'governed-exception',
    routeFamily: 'course-runtime',
    acceptanceIds: ['AC1', 'AC5'],
  },
  {
    routePattern: '/interactive-learning/courses/*/teacher/*/waiting',
    sourceFile: 'src/features/interactive/shared/teacher-classroom-waiting-route.tsx',
    shellEvidence: 'compatible-wrapper',
    routeFamily: 'course-runtime',
    acceptanceIds: ['AC1', 'AC2', 'AC5'],
  },
  {
    routePattern: '/ai',
    sourceFile: 'src/app/ai/page.tsx',
    shellEvidence: 'direct-appshell',
    routeFamily: 'ai',
    acceptanceIds: ['AC1', 'AC3', 'AC4', 'AC5'],
  },
  {
    routePattern: '/ai/copilot',
    sourceFile: 'src/app/ai/copilot/page.tsx',
    shellEvidence: 'direct-appshell',
    routeFamily: 'ai',
    acceptanceIds: ['AC1', 'AC3', 'AC4', 'AC5'],
  },
  {
    routePattern: '/playlists',
    sourceFile: 'src/app/playlists/page.tsx',
    shellEvidence: 'direct-appshell',
    routeFamily: 'playlist',
    acceptanceIds: ['AC1', 'AC3', 'AC4', 'AC5'],
  },
  {
    routePattern: '/playlists/new',
    sourceFile: 'src/app/playlists/new/page.tsx',
    shellEvidence: 'direct-appshell',
    routeFamily: 'playlist',
    acceptanceIds: ['AC1', 'AC3', 'AC4', 'AC5'],
  },
  {
    routePattern: '/playlists/*/play',
    sourceFile: 'src/app/playlists/[id]/play/page.tsx',
    shellEvidence: 'direct-appshell',
    routeFamily: 'playlist',
    acceptanceIds: ['AC1', 'AC3', 'AC4', 'AC5'],
  },
  {
    routePattern: '/missions',
    sourceFile: 'src/app/(main)/missions/page.tsx',
    shellEvidence: 'direct-appshell',
    routeFamily: 'role-workspace',
    acceptanceIds: ['AC1', 'AC3', 'AC4', 'AC5'],
  },
  {
    routePattern: '/profile/portfolio',
    sourceFile: 'src/app/(main)/profile/portfolio/page.tsx',
    shellEvidence: 'direct-appshell',
    routeFamily: 'role-workspace',
    acceptanceIds: ['AC1', 'AC3', 'AC4', 'AC5'],
  },
  {
    routePattern: '/classroom/join',
    sourceFile: 'src/app/classroom/join/page.tsx',
    shellEvidence: 'direct-appshell',
    routeFamily: 'classroom',
    acceptanceIds: ['AC1', 'AC3', 'AC4', 'AC5'],
  },
  {
    routePattern: '/classroom/student/*',
    sourceFile: 'src/app/classroom/student/[sessionId]/page.tsx',
    shellEvidence: 'governed-exception',
    routeFamily: 'classroom',
    acceptanceIds: ['AC1', 'AC5'],
  },
  {
    routePattern: '/classroom/teacher/*',
    sourceFile: 'src/app/classroom/teacher/[sessionId]/page.tsx',
    shellEvidence: 'governed-exception',
    routeFamily: 'classroom',
    acceptanceIds: ['AC1', 'AC5'],
  },
  {
    routePattern: '/classroom/teacher/*/review',
    sourceFile: 'src/app/classroom/teacher/[sessionId]/review/page.tsx',
    shellEvidence: 'governed-exception',
    routeFamily: 'classroom',
    acceptanceIds: ['AC1', 'AC5'],
  },
  {
    routePattern: '/interactive-learning/control-odyssey',
    sourceFile: 'src/app/interactive-learning/control-odyssey/page.tsx',
    shellEvidence: 'governed-exception',
    routeFamily: 'legacy-interactive',
    acceptanceIds: ['AC1', 'AC5'],
  },
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
    domContractProofIds: ['app-shell-header-action-order', 'route-coverage-scanner'],
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
      '/interactive-learning/multi-representation-linkage',
      '/interactive-learning/resources/*',
    ],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-ui-contracts.test.ts'],
    domContractProofIds: ['interactive-learning-shell-contract'],
  },
  {
    name: 'CourseEntryShell',
    sourceFile: 'src/features/interactive/shared/course-entry-shell.tsx',
    routeFamilies: ['/interactive-learning/courses/*'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
    domContractProofIds: ['course-entry-shell-route-coverage'],
  },
  {
    name: 'LessonRuntimeShell',
    sourceFile: 'src/features/interactive/shared/lesson-runtime-shell.tsx',
    routeFamilies: ['/interactive-learning/courses/*/student/*', '/interactive-learning/courses/*/teacher/*'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
    domContractProofIds: ['lesson-runtime-shell-route-coverage'],
  },
  {
    name: 'ClassroomJoinAppShell',
    sourceFile: 'src/app/classroom/join/page.tsx',
    routeFamilies: ['/classroom/join'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
    domContractProofIds: ['classroom-join-appshell-route-coverage'],
  },
  {
    name: 'SimulationShell',
    sourceFile: 'src/app/simulations/_components/simulation-shell.tsx',
    routeFamilies: ['/simulations/**'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-ui-contracts.test.ts'],
    domContractProofIds: ['simulation-shell-wrapper-contract'],
  },
  {
    name: 'ArenaPageShell',
    sourceFile: 'src/features/arena/arena-page-shell.tsx',
    routeFamilies: ['/arena/**'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/features/arena/__tests__/arena-entry-ui.test.ts'],
    domContractProofIds: ['arena-shell-wrapper-contract'],
  },
  {
    name: 'ControlWorkbenchShell',
    sourceFile: 'src/features/control-workbench/shell/control-workbench-shell.tsx',
    routeFamilies: ['/interactive-learning/control-workbench'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-ui-contracts.test.ts'],
    domContractProofIds: ['control-workbench-shell-contract'],
  },
  {
    name: 'RoleWorkspaceShell',
    sourceFile: 'src/components/platform/role-workspace-shell.tsx',
    routeFamilies: ['/teacher/**', '/admin/**'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-role-navigation.test.ts'],
    domContractProofIds: ['role-workspace-account-targets'],
  },
  {
    name: 'PresentationDataCenter',
    sourceFile: 'src/features/data-center/presentation-data-center.tsx',
    routeFamilies: ['/data-center'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
    domContractProofIds: ['presentation-data-center-route-coverage'],
  },
  {
    name: 'TeacherClassroomWaitingPage',
    sourceFile: 'src/features/interactive/shared/teacher-classroom-waiting-page.tsx',
    routeFamilies: ['/interactive-learning/courses/*/teacher/*/waiting'],
    requiredDomContracts: ['canonical-navigation', 'breadcrumb', 'theme-switch-then-personal-center'],
    contractTestFiles: ['src/lib/__tests__/platform-appshell-contract.test.ts'],
    domContractProofIds: ['teacher-classroom-waiting-route-coverage'],
  },
] as const;

const LEGACY_LESSON_RUNTIME_ROUTE_EXCEPTIONS: readonly UniversalAppShellException[] =
  LEGACY_LESSON_RUNTIME_ROUTE_SLUGS.flatMap((slug) => [
    {
      routePattern: `/interactive-learning/courses/${slug}/student/*`,
      category: 'legacy-lesson-runtime',
      type: 'migration-temporary',
      owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
      reason:
        'This student lesson runtime still renders a legacy course-specific page before LessonRuntimeShell migration.',
      violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
      removalCondition:
        'This student lesson runtime adopts LessonRuntimeShell or another registered lesson AppShell wrapper.',
    },
    {
      routePattern: `/interactive-learning/courses/${slug}/teacher/*`,
      category: 'legacy-lesson-runtime',
      type: 'migration-temporary',
      owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
      reason:
        'This teacher lesson runtime still renders a legacy course-specific page before LessonRuntimeShell migration.',
      violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
      removalCondition:
        'This teacher lesson runtime adopts LessonRuntimeShell or another registered lesson AppShell wrapper.',
    },
  ]);

export const UNIVERSAL_APP_SHELL_ROUTE_EXCEPTIONS: readonly UniversalAppShellException[] = [
  {
    routePattern: '/',
    category: 'home-route',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Homepage is the only normal product route allowed to render outside the universal AppShell frame.',
    violatedShellRules: ['non-home-appshell-frame'],
    removalCondition: 'None. Homepage remains the public entry exception.',
  },
  {
    routePattern: '/login',
    category: 'auth-entry',
    type: 'auth-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Login is an auth-only entry and must preserve callback-safe authentication flow.',
    violatedShellRules: ['global-navigation-frame', 'personal-center-action'],
    removalCondition: 'Login is merged into a governed auth entry shell with callback preservation.',
  },
  {
    routePattern: '/register',
    category: 'auth-entry',
    type: 'auth-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Registration is an auth-only route and must preserve callback-safe account setup flow.',
    violatedShellRules: ['global-navigation-frame', 'personal-center-action'],
    removalCondition: 'Registration is merged into the governed auth entry shell.',
  },
  {
    routePattern: '/dashboard',
    category: 'redirect-shim',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Dashboard is a protected redirect shim that forwards users to the role-aware cockpit.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The compatibility redirect is removed after all callers use role cockpit destinations directly.',
  },
  {
    routePattern: '/review/**',
    category: 'visual-review-surface',
    type: 'visual-review-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Review pages are isolated visual QA surfaces and must not inherit the product shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Review surfaces move to a report-ledger workspace or are retired after QA capture.',
  },
  {
    routePattern: '/simulations/type055-model-candidate',
    category: 'visual-review-surface',
    type: 'visual-review-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Type055 v2 model-package QA acceptance page is a non-production visual capture surface excluded from navigation (#1997).',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The QA acceptance page is retired or moved under a governed review surface when the type055 package leaves candidate QA.',
  },
  {
    routePattern: '/evidence/issue-979',
    category: 'visual-review-surface',
    type: 'visual-review-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Issue 979 media exclusivity evidence is a non-production visual capture surface.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The evidence route is retired after QA capture or moved under /review.',
  },
  {
    routePattern: '/interactive-learning/lessons/*/handout-print',
    category: 'print-surface',
    type: 'print-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Printable handouts intentionally omit navigation and account controls.',
    violatedShellRules: ['global-navigation-frame', 'theme-switch-then-personal-center'],
    removalCondition: 'Print rendering is exposed from a shell-covered lesson route instead of a standalone page.',
  },
  {
    routePattern: '/textbooks/**',
    category: 'embed-surface',
    type: 'embed-only',
    owner: 'build-unified-textbook-reader',
    reason: 'Standalone textbook readers use a dedicated hierarchy, breadcrumb, and reading workspace for direct and shared links.',
    violatedShellRules: ['global-navigation-frame', 'theme-switch-then-personal-center'],
    removalCondition: 'The standalone textbook workspace adopts a registered AppShell-compatible reader wrapper.',
  },
  {
    routePattern: '/@textbookModal/**',
    category: 'embed-surface',
    type: 'embed-only',
    owner: 'build-unified-textbook-reader',
    reason: 'The parallel textbook slot is an intercepted overlay rendered above the originating shell-covered platform page.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The parallel slot is classified by a registered AppShell overlay wrapper.',
  },
  ...LEGACY_LESSON_RUNTIME_ROUTE_EXCEPTIONS,
  {
    routePattern: '/interactive-learning/resources/control-odyssey-v1/ship',
    category: 'embed-surface',
    type: 'embed-only',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'The ship resource is an embed-style legacy visual resource with its own runtime viewport.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The resource renders through the registered resource detail shell or a governed embed adapter.',
  },
  {
    routePattern: '/interactive-learning/argument-principle',
    category: 'legacy-interactive-demo',
    type: 'legacy-demo-only',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/control-map',
    category: 'legacy-interactive-demo',
    type: 'legacy-demo-only',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/control-odyssey',
    category: 'legacy-interactive-demo',
    type: 'legacy-demo-only',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/physics-modeling',
    category: 'legacy-interactive-demo',
    type: 'legacy-demo-only',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/pid-simulator',
    category: 'legacy-interactive-demo',
    type: 'legacy-demo-only',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/interactive-learning/ten-drops',
    category: 'legacy-interactive-demo',
    type: 'legacy-demo-only',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Legacy standalone interactive demo pending migration into the Interactive Learning shell.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The demo is migrated into InteractiveLearningShell or removed from app routes.',
  },
  {
    routePattern: '/virtual-lab',
    category: 'legacy-interactive-demo',
    type: 'legacy-demo-only',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Legacy virtual lab route predates the simulation shell and remains outside primary navigation.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The route redirects to /simulations or adopts SimulationShell.',
  },
  {
    routePattern: '/ethics',
    category: 'operations-utility',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Public ethics page is not yet part of the product route ledger.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The route is registered as public entry content or moved under a shell-covered module.',
  },
  {
    routePattern: '/evaluation/prompt-assessment',
    category: 'operations-utility',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Evaluation utility page is not yet part of the product route ledger.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The route is registered under an operations or report shell.',
  },
  {
    routePattern: '/classroom/student/*',
    category: 'classroom-runtime',
    type: 'migration-temporary',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Live classroom student runtime remains route-local until classroom player shell migration lands.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Student classroom runtime adopts a registered classroom AppShell wrapper.',
  },
  {
    routePattern: '/classroom/teacher/*',
    category: 'classroom-runtime',
    type: 'migration-temporary',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Live classroom teacher runtime remains route-local until classroom player shell migration lands.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Teacher classroom runtime adopts a registered classroom AppShell wrapper.',
  },
  {
    routePattern: '/classroom/teacher/*/review',
    category: 'classroom-runtime',
    type: 'migration-temporary',
    owner: DEEP_PRODUCT_APP_SHELL_CHANGE_ID,
    reason: 'Teacher classroom review route keeps route-local review controls until classroom shell migration lands.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'Classroom review adopts a registered classroom AppShell wrapper.',
  },
  {
    routePattern: '/teacher/students/*/diagnosis',
    category: 'redirect-shim',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason: 'Legacy teacher student diagnosis route is a redirect shim outside the teacher AppShell layout.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The redirect shim is removed after canonical teacher class student routes cover all callers.',
  },
  {
    routePattern: '/teacher/students/*/evidence',
    category: 'redirect-shim',
    type: 'migration-temporary',
    owner: UNIVERSAL_APP_SHELL_CHANGE_ID,
    reason:
      'Legacy teacher student evidence route is a redirect and fallback shim outside the teacher AppShell layout.',
    violatedShellRules: ['global-navigation-frame', 'breadcrumb'],
    removalCondition: 'The redirect shim is removed after canonical teacher class evidence routes cover all callers.',
  },
] as const;
