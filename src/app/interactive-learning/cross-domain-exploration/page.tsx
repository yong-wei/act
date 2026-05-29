'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

import { UnifiedTopBar } from '@/components/shared/unified-top-bar';
import { useResourceInteractionTracking } from '@/features/interactive/hooks/useResourceInteractionTracking';
import type { InteractiveResource } from '@/features/interactive/learning-catalog';

export default function CrossDomainExplorationPage() {
  const [resources, setResources] = useState<InteractiveResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tracker = useResourceInteractionTracking({
    resourceKey: 'cross-domain:catalog',
    surface: 'cross_domain',
    pageType: 'resource',
    targetType: 'cross_domain_catalog',
    targetId: 'cross-domain-catalog',
    targetLabel: '跨域探索',
    provider: 'cross-domain-exploration-page',
  });

  useEffect(() => {
    tracker.trackResourceView();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    return resources.map((resource) => ({
      key: resource.id,
      title: resource.displayName || resource.title,
      description: resource.description || '跨域探索互动组件',
      href: `/interactive-learning/resources/${resource.id}`,
      tag: '跨域组件',
    }));
  }, [resources]);

  return (
    <div className="surface-page min-h-screen text-foreground">
      <UnifiedTopBar title="跨域探索" backHref="/interactive-learning" backLabel="返回互动学习" subtitle="Cross-Domain Exploration" className="pb-2" />

      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <header className="surface-card mb-8 p-6">
          <h1 className="text-3xl font-semibold">跨域探索</h1>
          <p className="mt-2 text-sm text-subtle">聚焦跨表征联动与跨域问题拆解，按资源目录动态展示趣味探索组件。</p>
        </header>

        {isLoading ? (
          <div className="surface-card rounded-2xl border-dashed px-6 py-12 text-center text-sm text-subtle">
            正在加载跨域探索组件...
          </div>
        ) : entries.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry, index) => (
              <Link
                key={entry.key}
                href={entry.href}
                onClick={() => {
                  tracker.trackExternalModuleOpen({
                    resourceKey: `cross-domain:${entry.key}`,
                    targetType: 'external_module',
                    targetId: entry.key,
                    targetLabel: entry.title,
                    openMode: 'route',
                  });
                }}
                className="surface-card group rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-fuchsia-400/50"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-700 dark:text-fuchsia-200">{entry.tag}</span>
                  {index === 0 ? (
                    <span className="inline-flex items-center gap-1 text-fuchsia-600 dark:text-fuchsia-300">
                      <Sparkles className="h-3.5 w-3.5" />
                      第一组件
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">{entry.title}</h2>
                <p className="mt-2 text-sm text-subtle">{entry.description}</p>
                <div className="mt-4 inline-flex items-center text-xs text-fuchsia-700 dark:text-fuchsia-200">
                  打开组件
                  <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </section>
        ) : (
          <div className="surface-card rounded-2xl border-dashed px-6 py-12 text-center text-sm text-subtle">
            暂无可展示的跨域探索组件。
          </div>
        )}
      </main>
    </div>
  );
}
