'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';
import { useResourceInteractionTracking } from '@/features/interactive/hooks/useResourceInteractionTracking';
import type { InteractiveResource } from '@/features/interactive/learning-catalog';

const TOOL_ENTRIES = [
  {
    key: 'control-map',
    title: '控制理论地图',
    description: '按知识区域查看概念、关系与核心公式，搜索后可定位到对应概念。',
    href: '/interactive-learning/control-map',
    tag: '知识地图',
  },
  {
    key: 'pid-simulator',
    title: 'PID 控制仿真器',
    description: '选择对象并调整参数，立即查看阶跃响应、超调量和稳态误差。',
    href: '/interactive-learning/pid-simulator',
    tag: '参数调参',
  },
] as const;

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
      href: `/interactive-learning/resources/${resource.id}?source=cross-domain-exploration`,
      tag: '跨域组件',
    }));
  }, [resources]);

  return (
    <InteractiveLearningShell
      activeHref="/interactive-learning/cross-domain-exploration"
      title="跨域探索"
      subtitle="Cross-Domain Exploration"
    >
      <section
        className="w-full px-4 py-8 sm:px-6 lg:px-8"
        data-commercial-workspace="interactive-learning"
        data-commercial-student-entry-route="/interactive-learning/cross-domain-exploration"
        data-commercial-entry-intent="learn"
        data-interactive-atlas-workspace="cross-domain-exploration"
        data-learning-entry-map="cross-domain-exploration"
      >
        <header className="mb-8 border-b border-border/60 pb-6">
          <h1 className="text-3xl font-semibold">跨域探索</h1>
          <p className="mt-2 text-sm text-subtle">
            聚焦跨表征联动与跨域问题拆解。可直接打开控制理论地图和 PID 仿真器，其余趣味探索组件按资源目录展示。
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-cross-domain-tools="">
          {TOOL_ENTRIES.map((entry) => (
            <Link
              key={entry.key}
              href={entry.href}
              className="surface-card group rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full border border-border bg-muted px-3 py-1 text-subtle">{entry.tag}</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-foreground">{entry.title}</h2>
              <p className="mt-2 text-sm text-subtle">{entry.description}</p>
              <div className="mt-4 inline-flex items-center text-xs text-primary">
                打开工具
                <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </section>

        {isLoading ? (
          <div className="surface-card mt-4 rounded-2xl border-dashed px-6 py-12 text-center text-sm text-subtle">
            正在加载跨域探索组件...
          </div>
        ) : entries.length > 0 ? (
          <section className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                className="surface-card group rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-subtle">{entry.tag}</span>
                  {index === 0 ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      第一组件
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">{entry.title}</h2>
                <p className="mt-2 text-sm text-subtle">{entry.description}</p>
                <div className="mt-4 inline-flex items-center text-xs text-primary">
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
      </section>
    </InteractiveLearningShell>
  );
}
