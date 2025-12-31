'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Compass, Link2, Puzzle, Ship, Wrench } from 'lucide-react';
import type { TeachingResource } from '@prisma/client';

type InteractiveResource = Pick<
  TeachingResource,
  'id' | 'title' | 'description' | 'registryId' | 'type'
>;

const colorClasses = {
  blue: {
    iconBg: 'bg-blue-500/20',
    iconText: 'text-blue-400',
    border: 'border-blue-500/30 hover:border-blue-500/60',
    badge: 'bg-blue-500/20 text-blue-400',
  },
  amber: {
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-400',
    border: 'border-amber-500/30 hover:border-amber-500/60',
    badge: 'bg-amber-500/20 text-amber-400',
  },
  cyan: {
    iconBg: 'bg-cyan-500/20',
    iconText: 'text-cyan-400',
    border: 'border-cyan-500/30 hover:border-cyan-500/60',
    badge: 'bg-cyan-500/20 text-cyan-400',
  },
  emerald: {
    iconBg: 'bg-emerald-500/20',
    iconText: 'text-emerald-400',
    border: 'border-emerald-500/30 hover:border-emerald-500/60',
    badge: 'bg-emerald-500/20 text-emerald-400',
  },
  violet: {
    iconBg: 'bg-violet-500/20',
    iconText: 'text-violet-400',
    border: 'border-violet-500/30 hover:border-violet-500/60',
    badge: 'bg-violet-500/20 text-violet-400',
  },
};

function getResourceColor(registryId?: string | null) {
  if (!registryId) return 'cyan';
  if (registryId.startsWith('lesson02')) return 'amber';
  if (registryId.startsWith('physics-modeling')) return 'violet';
  if (registryId.startsWith('widget-')) return 'cyan';
  if (registryId.includes('argument')) return 'blue';
  if (registryId.includes('ethics')) return 'emerald';
  return 'blue';
}

function getResourceIcon(registryId?: string | null) {
  if (!registryId) return Puzzle;
  if (registryId.startsWith('lesson02')) return BookOpen;
  if (registryId.startsWith('physics-modeling')) return Wrench;
  if (registryId.includes('analogy')) return Link2;
  if (registryId.includes('argument')) return Compass;
  return Puzzle;
}

export default function InteractiveLearningPage() {
  const [resources, setResources] = useState<InteractiveResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await fetch('/api/resources?type=INTERACTIVE_COMP');
        if (res.ok) {
          const data = (await res.json()) as InteractiveResource[];
          setResources(data);
        }
      } catch (error) {
        console.error('Failed to load interactive resources', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, []);

  const sortedResources = useMemo(
    () => [...resources].sort((a, b) => a.title.localeCompare(b.title)),
    [resources]
  );

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
              <div className="text-sm font-semibold tracking-wide text-white">AI-OBE船舶智控平台</div>
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
          <p className="text-lg text-slate-400">
            汇聚系统内所有单页互动资源（不含虚拟仿真），供快速体验与引用
          </p>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-slate-500">
            正在加载互动资源...
          </div>
        ) : sortedResources.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-slate-500">
            暂无可用的互动资源
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {sortedResources.map((resource) => {
              const colorKey = getResourceColor(resource.registryId) as keyof typeof colorClasses;
              const colors = colorClasses[colorKey];
              const Icon = getResourceIcon(resource.registryId);
              const description = resource.description || '暂无描述，点击查看资源详情';

              return (
                <Link
                  key={resource.id}
                  href={`/interactive-learning/resources/${resource.id}`}
                  className={`group relative overflow-hidden rounded-2xl border bg-slate-900/60 p-8 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${colors.border}`}
                >
                  <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-white/5 to-transparent" />

                  <div className={`mb-6 inline-flex rounded-xl p-4 ${colors.iconBg}`}>
                    <Icon className={`h-8 w-8 ${colors.iconText}`} />
                  </div>

                  <h2 className="mb-2 text-2xl font-semibold text-white">{resource.title}</h2>
                  <p className="mb-6 text-slate-400">{description}</p>

                  <div className="mb-6 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs ${colors.badge}`}>
                      {resource.registryId || 'interactive-resource'}
                    </span>
                  </div>

                  <div className="flex items-center text-sm font-medium text-slate-300 transition-colors group-hover:text-white">
                    打开资源
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
