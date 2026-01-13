'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Activity,
  GitBranch,
  Radio,
  Sliders,
  Shuffle,
  Sparkles,
  Ship,
  Clock,
} from 'lucide-react';
import type { InteractiveCategory } from '@prisma/client';

// 资源类型定义
interface InteractiveResource {
  id: string;
  title: string;
  displayName: string | null;
  description: string | null;
  registryId: string | null;
  type: string;
  category: InteractiveCategory | null;
  displayOrder: number;
}

// 分类配置
const CATEGORY_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    description: string;
  }
> = {
  SYSTEM_MODELING: {
    label: '系统建模',
    icon: Boxes,
    color: 'blue',
    description: '学习如何建立物理系统的数学模型',
  },
  TIME_DOMAIN: {
    label: '时域分析',
    icon: Activity,
    color: 'emerald',
    description: '分析系统的时间响应特性',
  },
  ROOT_LOCUS: {
    label: '根轨迹分析',
    icon: GitBranch,
    color: 'violet',
    description: '探索闭环极点与系统稳定性的关系',
  },
  FREQUENCY_DOMAIN: {
    label: '频域分析',
    icon: Radio,
    color: 'cyan',
    description: '通过频率响应分析系统特性',
  },
  SYSTEM_CORRECTION: {
    label: '系统校正',
    icon: Sliders,
    color: 'amber',
    description: '设计控制器改善系统性能',
  },
  NONLINEAR: {
    label: '非线性',
    icon: Shuffle,
    color: 'rose',
    description: '处理非线性系统和伦理决策',
  },
  FUN_EXPLORATION: {
    label: '趣味探索',
    icon: Sparkles,
    color: 'fuchsia',
    description: '以轻量游戏体验控制思维与系统直觉',
  },
};

// 分类顺序
const CATEGORY_ORDER = [
  'SYSTEM_MODELING',
  'TIME_DOMAIN',
  'ROOT_LOCUS',
  'FREQUENCY_DOMAIN',
  'SYSTEM_CORRECTION',
  'NONLINEAR',
  'FUN_EXPLORATION',
];

const FEATURED_LESSONS = [
  {
    id: 'lesson-11',
    title: '参数根轨迹与图形化思考',
    description: '90 分钟线下课程：广义定义、稳定范围与主导极点选择。',
    duration: '90 分钟',
    href: '/interactive-learning/lesson-11',
    badge: 'Lesson 11',
    accent: 'violet',
  },
];

// 颜色类
const colorClasses: Record<string, {
  iconBg: string;
  iconText: string;
  border: string;
  badge: string;
  sectionBorder: string;
}> = {
  blue: {
    iconBg: 'bg-blue-500/20',
    iconText: 'text-blue-400',
    border: 'border-blue-500/30 hover:border-blue-500/60',
    badge: 'bg-blue-500/20 text-blue-400',
    sectionBorder: 'border-l-blue-500',
  },
  emerald: {
    iconBg: 'bg-emerald-500/20',
    iconText: 'text-emerald-400',
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    badge: 'bg-emerald-500/20 text-emerald-400',
    sectionBorder: 'border-l-emerald-500',
  },
  violet: {
    iconBg: 'bg-violet-500/20',
    iconText: 'text-violet-400',
    border: 'border-violet-500/30 hover:border-violet-500/60',
    badge: 'bg-violet-500/20 text-violet-400',
    sectionBorder: 'border-l-violet-500',
  },
  cyan: {
    iconBg: 'bg-cyan-500/20',
    iconText: 'text-cyan-400',
    border: 'border-cyan-500/30 hover:border-cyan-500/60',
    badge: 'bg-cyan-500/20 text-cyan-400',
    sectionBorder: 'border-l-cyan-500',
  },
  amber: {
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-400',
    border: 'border-amber-500/30 hover:border-amber-500/60',
    badge: 'bg-amber-500/20 text-amber-400',
    sectionBorder: 'border-l-amber-500',
  },
  rose: {
    iconBg: 'bg-rose-500/20',
    iconText: 'text-rose-400',
    border: 'border-rose-500/30 hover:border-rose-500/60',
    badge: 'bg-rose-500/20 text-rose-400',
    sectionBorder: 'border-l-rose-500',
  },
  fuchsia: {
    iconBg: 'bg-fuchsia-500/20',
    iconText: 'text-fuchsia-400',
    border: 'border-fuchsia-500/30 hover:border-fuchsia-500/60',
    badge: 'bg-fuchsia-500/20 text-fuchsia-400',
    sectionBorder: 'border-l-fuchsia-500',
  },
};

export default function InteractiveLearningPage() {
  const [resources, setResources] = useState<InteractiveResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await fetch('/api/resources');
        if (res.ok) {
          const data = (await res.json()) as InteractiveResource[];
          // 过滤掉 CLASSROOM 分类
          setResources(data.filter((r) => r.category !== 'CLASSROOM'));
        }
      } catch (error) {
        console.error('Failed to load interactive resources', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, []);

  // 按分类分组
  const groupedResources = useMemo(() => {
    const groups: Record<string, InteractiveResource[]> = {};

    // 初始化所有分类（包括空分类）
    for (const category of CATEGORY_ORDER) {
      groups[category] = [];
    }

    // 分组资源
    for (const resource of resources) {
      const category = resource.category || 'OTHER';
      if (groups[category]) {
        groups[category].push(resource);
      }
    }

    // 按 displayOrder 排序
    for (const category of Object.keys(groups)) {
      groups[category].sort((a, b) => a.displayOrder - b.displayOrder);
    }

    return groups;
  }, [resources]);

  // 统计总数
  const totalCount = resources.length;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* 顶部导航 */}
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-white">
                AI-OBE船舶智控平台
              </div>
              <div className="text-xs text-white/50">Mission Control for Maritime Education</div>
            </div>
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            进入驾驶舱
          </Link>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="mx-auto max-w-[1600px] px-6 py-12">
        {/* 页面标题 */}
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">互动学习</h1>
          <p className="mb-4 text-lg text-slate-400">
            按照控制论主题分类的互动学习资源，支持独立体验与课堂引用
          </p>
          {!isLoading && (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/50 px-4 py-2 text-sm text-slate-400">
              <span className="font-medium text-white">{totalCount}</span> 个互动组件
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-slate-500">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
              正在加载互动资源...
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {FEATURED_LESSONS.length > 0 && (
              <section className="rounded-2xl border border-white/5 bg-slate-900/40 p-6">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">线下课程入口</h2>
                    <p className="text-sm text-slate-400">基于 BOPPPS 的 90 分钟课堂设计</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
                    最新课程
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {FEATURED_LESSONS.map((lesson) => (
                    <Link
                      key={lesson.id}
                      href={lesson.href}
                      className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-5 transition hover:border-violet-500/60"
                    >
                      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
                          {lesson.badge}
                        </span>
                        <span className="text-xs text-slate-400">{lesson.duration}</span>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-white">{lesson.title}</h3>
                      <p className="mt-2 text-sm text-slate-400">{lesson.description}</p>
                      <div className="mt-4 flex items-center text-xs text-violet-300">
                        进入课程
                        <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {CATEGORY_ORDER.map((categoryKey) => {
              const config = CATEGORY_CONFIG[categoryKey];
              const categoryResources = groupedResources[categoryKey] || [];
              const colors = colorClasses[config.color];
              const Icon = config.icon;

              return (
                <section
                  key={categoryKey}
                  className={`rounded-2xl border border-white/5 bg-slate-900/30 p-6 pl-8 border-l-4 ${colors.sectionBorder}`}
                >
                  {/* 分类标题 */}
                  <div className="mb-6 flex items-center gap-4">
                    <div className={`rounded-xl p-3 ${colors.iconBg}`}>
                      <Icon className={`h-6 w-6 ${colors.iconText}`} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">{config.label}</h2>
                      <p className="text-sm text-slate-400">{config.description}</p>
                    </div>
                    <div className="ml-auto">
                      <span className={`rounded-full px-3 py-1 text-xs ${colors.badge}`}>
                        {categoryResources.length} 个组件
                      </span>
                    </div>
                  </div>

                  {/* 资源卡片 */}
                  {categoryResources.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-900/20">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock className="h-4 w-4" />
                        <span>即将推出</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {categoryResources.map((resource) => {
                        const displayTitle = resource.displayName || resource.title;
                        const description =
                          resource.description || '暂无描述，点击查看资源详情';

                        return (
                          <Link
                            key={resource.id}
                            href={`/interactive-learning/resources/${resource.id}`}
                            className={`group relative overflow-hidden rounded-xl border bg-slate-900/60 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${colors.border}`}
                          >
                            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-white/5 to-transparent" />

                            <h3 className="mb-2 text-lg font-medium text-white">{displayTitle}</h3>
                            <p className="mb-4 line-clamp-2 text-sm text-slate-400">
                              {description}
                            </p>

                            <div className="flex items-center text-xs font-medium text-slate-400 transition-colors group-hover:text-white">
                              打开资源
                              <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
