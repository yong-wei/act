'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Ship } from 'lucide-react';

import {
  CATEGORY_CONFIG,
  CHAPTER_COMPONENT_CATEGORIES,
  type InteractiveResource,
} from '@/features/interactive/learning-catalog';

export default function ChapterComponentsPage() {
  const [resources, setResources] = useState<InteractiveResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/resources');
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as InteractiveResource[];
        setResources(data.filter((resource) => resource.category !== 'CLASSROOM'));
      } catch (error) {
        console.error('Failed to load chapter resources', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const category of CHAPTER_COMPONENT_CATEGORIES) {
      result[category] = 0;
    }
    for (const resource of resources) {
      if (resource.category && result[resource.category] !== undefined) {
        result[resource.category] += 1;
      }
    }
    return result;
  }, [resources]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <Link href="/interactive-learning" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">互动学习</div>
              <div className="text-xs text-white/50">Chapter Components</div>
            </div>
          </Link>
          <Link
            href="/interactive-learning"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            返回入口
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <header className="mb-8 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <h1 className="text-3xl font-semibold">各章节互动组件</h1>
          <p className="mt-2 text-sm text-slate-300">先选择章节分类，再进入对应组件列表页。</p>
        </header>

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 px-6 py-12 text-center text-sm text-slate-400">
            正在加载章节组件入口...
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CHAPTER_COMPONENT_CATEGORIES.map((categoryKey) => {
              const config = CATEGORY_CONFIG[categoryKey];
              const Icon = config.icon;
              return (
                <Link
                  key={categoryKey}
                  href={`/interactive-learning/chapter-components/${config.routeSlug}`}
                  className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-0.5 hover:border-amber-400/45"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-white">{config.label}</h2>
                  <p className="mt-2 text-sm text-slate-300">{config.description}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
                    <span>{counts[categoryKey] ?? 0} 个组件</span>
                    <span className="inline-flex items-center text-amber-200">
                      查看组件
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
