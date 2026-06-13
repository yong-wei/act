'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Ship } from 'lucide-react';

import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';
import {
  CATEGORY_CONFIG,
  CHAPTER_COMPONENT_CATEGORIES,
  findCategoryKeyBySlug,
  type InteractiveResource,
} from '@/features/interactive/learning-catalog';

export default function ChapterCategoryPage() {
  const params = useParams<{ category: string }>();
  const slug = params?.category ?? '';

  const categoryKey = findCategoryKeyBySlug(slug);
  const categoryConfig = categoryKey ? CATEGORY_CONFIG[categoryKey] : null;

  const [resources, setResources] = useState<InteractiveResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!categoryKey || !CHAPTER_COMPONENT_CATEGORIES.includes(categoryKey as (typeof CHAPTER_COMPONENT_CATEGORIES)[number])) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/resources');
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as InteractiveResource[];
        setResources(
          data
            .filter((resource) => resource.category === categoryKey)
            .sort((a, b) => a.displayOrder - b.displayOrder)
        );
      } catch (error) {
        console.error('Failed to load chapter category resources', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [categoryKey]);

  const title = categoryConfig?.label ?? '未找到章节';
  const description = categoryConfig?.description ?? '该章节分类不存在。';

  const content = useMemo(() => {
    if (!categoryConfig) {
      return (
        <div className="surface-card rounded-2xl border-dashed px-6 py-10 text-center text-sm text-subtle">
          未找到对应章节入口，请返回“各章节互动组件”重新选择。
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="surface-card rounded-2xl border-dashed px-6 py-12 text-center text-sm text-subtle">
          正在加载组件...
        </div>
      );
    }

    if (resources.length === 0) {
      return (
        <div className="surface-card rounded-2xl border-dashed px-6 py-12 text-center text-sm text-subtle">
          当前章节暂无组件。
        </div>
      );
    }

    return (
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => (
          <Link
            key={resource.id}
            href={`/interactive-learning/resources/${resource.id}?source=chapter-components&category=${slug}`}
            className="surface-card group rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-primary/45"
          >
            <h2 className="text-lg font-semibold text-foreground">{resource.displayName || resource.title}</h2>
            <p className="mt-2 text-sm text-subtle">{resource.description || '暂无组件描述。'}</p>
            <div className="mt-4 inline-flex items-center text-xs text-primary">
              打开资源
              <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </section>
    );
  }, [categoryConfig, isLoading, resources, slug]);

  return (
    <InteractiveLearningShell
      activeHref={`/interactive-learning/chapter-components/${slug}`}
      title={title}
      subtitle="Chapter component detail"
      breadcrumbs={[
        { label: '互动学习', href: '/interactive-learning' },
        { label: '各章节互动组件', href: '/interactive-learning/chapter-components' },
        { label: title },
      ]}
      actions={(
        <Link
          href="/interactive-learning/chapter-components"
          className="inline-flex items-center gap-2 rounded-md border border-platform-border bg-platform-surface px-3 py-2 text-sm text-platform-fg-secondary transition hover:border-platform-border-strong hover:text-platform-action-primary"
        >
          <Ship className="h-4 w-4" />
          返回章节入口
        </Link>
      )}
    >
      <section
        className="mx-auto max-w-[1280px] px-6 py-10"
        data-commercial-workspace="interactive-learning"
        data-commercial-student-entry-route="/interactive-learning/chapter-components/[category]"
        data-route-family="interactive-learning-chapter-components"
        data-route-source="/interactive-learning/chapter-components"
      >
        <header className="surface-card mb-8 p-6">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-subtle">{description}</p>
        </header>

        {content}
      </section>
    </InteractiveLearningShell>
  );
}
