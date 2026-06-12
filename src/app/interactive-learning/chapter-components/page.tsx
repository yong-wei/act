'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { AppShell } from '@/components/platform/app-shell';
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
    <AppShell
      viewerRole="student"
      title="各章节互动组件"
      subtitle="Chapter Components"
      activeHref="/interactive-learning/chapter-components"
      sidebarMode="collapsible"
      className="surface-page"
    >
      <section
        className="mx-auto max-w-[1280px] px-6 py-10"
        data-commercial-workspace="interactive-learning"
        data-commercial-student-entry-route="/interactive-learning/chapter-components"
        data-commercial-entry-intent="learn"
        data-learning-entry-map="chapter-component-library"
      >
        <header className="surface-card mb-8 p-6">
          <h1 className="text-3xl font-semibold">各章节互动组件</h1>
          <p className="mt-2 text-sm text-subtle">先选择章节分类，再进入对应组件列表页。</p>
        </header>

        {isLoading ? (
          <div className="surface-card rounded-2xl border-dashed px-6 py-12 text-center text-sm text-subtle">
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
                  className="surface-card group rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-amber-400/45"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-foreground">{config.label}</h2>
                  <p className="mt-2 text-sm text-subtle">{config.description}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-subtle">
                    <span>{counts[categoryKey] ?? 0} 个组件</span>
                    <span className="inline-flex items-center text-amber-700 dark:text-amber-200">
                      查看组件
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </section>
    </AppShell>
  );
}
