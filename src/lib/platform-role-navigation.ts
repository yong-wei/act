import {
  createPlatformNavigation,
  filterPlatformNavigation,
  type PlatformNavigationAvailability,
  type PlatformNavigationItem,
  type PlatformRole,
} from '@/components/platform/platform-ui-contracts';

export type PlatformRoleNavigationAudience = PlatformRole | 'guest';

export type PlatformRoleNavigationGroup =
  | 'public'
  | 'role-cockpit'
  | 'student-core'
  | 'teacher-cockpit'
  | 'admin-cockpit'
  | 'future';

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

export interface PlatformRoleNavigationOptions {
  enabledFeatureFlags?: readonly string[];
  includeDisabled?: boolean;
  includeHidden?: boolean;
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
  audit: '/admin/data-governance',
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
    aliasHrefs: ['/profile/growth'],
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

export function getStudentCoreNavigationEntries(): PlatformRoleNavigationItem[] {
  const coreIds = new Set<string>(STUDENT_CORE_ENTRY_IDS);
  return getPlatformRoleNavigation('student').filter((entry) => coreIds.has(entry.id));
}

export function getPlatformNavigationHref(id: string): string | undefined {
  return PLATFORM_ROLE_NAVIGATION_GROUPS.find((entry) => entry.id === id)?.href;
}

export function getPlatformCockpitHref(role?: string | null): string {
  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === 'admin') return PLATFORM_ROLE_COCKPIT_HREFS.admin;
  if (normalizedRole === 'teacher') return PLATFORM_ROLE_COCKPIT_HREFS.teacher;
  if (normalizedRole === 'audit') return PLATFORM_ROLE_COCKPIT_HREFS.audit;
  return PLATFORM_ROLE_COCKPIT_HREFS.student;
}
