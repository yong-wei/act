export type TeacherDashboardStatKey =
  | 'totalClasses'
  | 'totalStudents'
  | 'totalPlans'
  | 'activeSessions'
  | 'finishedSessions';

export type TeacherDashboardIconKey =
  | 'users'
  | 'graduation-cap'
  | 'book-open'
  | 'radio'
  | 'history'
  | 'plus'
  | 'file-text'
  | 'library';

export interface TeacherDashboardPrimaryStat {
  key: TeacherDashboardStatKey;
  label: string;
  href?: string;
  icon: TeacherDashboardIconKey;
  tone: 'sky' | 'emerald' | 'amber' | 'rose' | 'violet';
}

export interface TeacherDashboardQuickAction {
  title: string;
  description: string;
  href: string;
  icon: TeacherDashboardIconKey;
  tone: 'sky' | 'amber' | 'cyan' | 'violet' | 'emerald';
}

export const TEACHER_DASHBOARD_PRIMARY_STATS: TeacherDashboardPrimaryStat[] = [
  {
    key: 'totalClasses',
    label: '我的班级',
    href: '/teacher/classes',
    icon: 'users',
    tone: 'sky',
  },
  {
    key: 'totalStudents',
    label: '班级学生',
    icon: 'graduation-cap',
    tone: 'emerald',
  },
  {
    key: 'totalPlans',
    label: '教案数量',
    icon: 'book-open',
    tone: 'amber',
  },
  {
    key: 'activeSessions',
    label: '进行中课堂',
    icon: 'radio',
    tone: 'rose',
  },
  {
    key: 'finishedSessions',
    label: '上课历史',
    href: '/teacher/history',
    icon: 'history',
    tone: 'violet',
  },
];

export const TEACHER_DASHBOARD_QUICK_ACTIONS: TeacherDashboardQuickAction[] = [
  {
    title: '新建班级',
    description: '创建班级并生成加入码',
    href: '/teacher/classes/new',
    icon: 'plus',
    tone: 'sky',
  },
  {
    title: '新建教案',
    description: '创建 BOPPPS 教学设计',
    href: '/teacher/lesson-plans/new',
    icon: 'book-open',
    tone: 'amber',
  },
  {
    title: '预置教案',
    description: '浏览系统预置的教学模板',
    href: '/teacher/preset-lessons',
    icon: 'file-text',
    tone: 'cyan',
  },
  {
    title: '教学资源管理',
    description: '管理互动组件与知识卡片',
    href: '/teacher/resources',
    icon: 'library',
    tone: 'violet',
  },
  {
    title: '上课历史',
    description: '查看全部已结束课堂并归档到班级',
    href: '/teacher/history',
    icon: 'history',
    tone: 'emerald',
  },
];
