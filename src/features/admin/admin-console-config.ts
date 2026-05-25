import type { LucideIcon } from 'lucide-react';
import { BarChart3, Database, Settings, Users } from 'lucide-react';

import { getPlatformNavigationHref } from '@/lib/platform-role-navigation';

const adminHref = (id: string, fallback: string) => getPlatformNavigationHref(id) ?? fallback;

export type AdminConsoleUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: 'ADMIN';
};

export type AdminConsoleEntry = {
  title: string;
  href: string;
  description: string;
  eyebrow: string;
  icon: LucideIcon;
};

export type AdminConsoleSection = {
  title: string;
  href: string;
};

export const ADMIN_CONSOLE_SECTIONS: AdminConsoleSection[] = [
  { title: '管理员后台', href: adminHref('admin-cockpit', '/admin') },
  { title: '用户管理', href: adminHref('admin-users', '/admin/users') },
  { title: '系统使用量统计', href: adminHref('admin-states', '/admin/states') },
  { title: '数据治理', href: adminHref('admin-data-governance', '/admin/data-governance') },
  { title: '系统配置', href: adminHref('admin-config', '/admin/config') },
];

export const ADMIN_CONSOLE_ENTRIES: AdminConsoleEntry[] = [
  {
    title: '用户管理',
    href: adminHref('admin-users', '/admin/users'),
    description: '账号、角色、密码重置与批量导入统一收口。',
    eyebrow: '账号体系',
    icon: Users,
  },
  {
    title: '系统使用量统计',
    href: adminHref('admin-states', '/admin/states'),
    description: '查看真实访问量、互动分布、仿真活跃度与月度趋势。',
    eyebrow: '使用态势',
    icon: BarChart3,
  },
  {
    title: '数据治理',
    href: adminHref('admin-data-governance', '/admin/data-governance'),
    description: '追踪学习事实、快照队列、风险清单与数据新鲜度。',
    eyebrow: '治理链路',
    icon: Database,
  },
  {
    title: '系统配置',
    href: adminHref('admin-config', '/admin/config'),
    description: '管理平台基础参数、AI 供应商、模型目录与响应测试。',
    eyebrow: '平台参数',
    icon: Settings,
  },
];
