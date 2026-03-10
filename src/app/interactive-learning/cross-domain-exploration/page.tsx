'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Ship, Sparkles } from 'lucide-react';

import type { InteractiveResource } from '@/features/interactive/learning-catalog';

export default function CrossDomainExplorationPage() {
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
        setResources(
          data
            .filter((resource) => resource.category === 'FUN_EXPLORATION')
            .sort((a, b) => a.displayOrder - b.displayOrder)
        );
      } catch (error) {
        console.error('Failed to load cross-domain resources', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const entries = useMemo(() => {
    const dynamicEntries = resources.map((resource) => ({
      key: resource.id,
      title: resource.displayName || resource.title,
      description: resource.description || '跨域探索互动组件',
      href: `/interactive-learning/resources/${resource.id}`,
      tag: '跨域组件',
    }));

    return [
      {
        key: 'multi-representation-linkage',
        title: '多表征联动可视化引擎',
        description: '根轨迹、Bode、Nyquist 与时域响应联动，支持跨域参数探索。',
        href: '/interactive-learning/multi-representation-linkage',
        tag: '跨域联动（置顶）',
      },
      ...dynamicEntries,
    ];
  }, [resources]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <Link href="/interactive-learning" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">互动学习</div>
              <div className="text-xs text-white/50">Cross-Domain Exploration</div>
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
          <h1 className="text-3xl font-semibold">跨域探索</h1>
          <p className="mt-2 text-sm text-slate-300">聚焦跨表征联动与跨域问题拆解。首个入口固定为“多表征联动可视化引擎”。</p>
        </header>

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 px-6 py-12 text-center text-sm text-slate-400">
            正在加载跨域探索组件...
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry, index) => (
              <Link
                key={entry.key}
                href={entry.href}
                className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-0.5 hover:border-fuchsia-400/50"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-fuchsia-200">{entry.tag}</span>
                  {index === 0 ? (
                    <span className="inline-flex items-center gap-1 text-fuchsia-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      第一组件
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-4 text-lg font-semibold text-white">{entry.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{entry.description}</p>
                <div className="mt-4 inline-flex items-center text-xs text-fuchsia-200">
                  打开组件
                  <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
