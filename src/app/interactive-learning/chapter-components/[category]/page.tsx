'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Ship } from 'lucide-react';

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
        <div className="rounded-2xl border border-dashed border-rose-400/30 bg-rose-950/20 px-6 py-10 text-center text-sm text-rose-200">
          未找到对应章节入口，请返回“各章节互动组件”重新选择。
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 px-6 py-12 text-center text-sm text-slate-400">
          正在加载组件...
        </div>
      );
    }

    if (resources.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/30 px-6 py-12 text-center text-sm text-slate-400">
          当前章节暂无组件。
        </div>
      );
    }

    return (
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => (
          <Link
            key={resource.id}
            href={`/interactive-learning/resources/${resource.id}`}
            className="group rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/45"
          >
            <h2 className="text-lg font-semibold text-white">{resource.displayName || resource.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{resource.description || '暂无组件描述。'}</p>
            <div className="mt-4 inline-flex items-center text-xs text-cyan-200">
              打开资源
              <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </section>
    );
  }, [categoryConfig, isLoading, resources]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          <Link href="/interactive-learning/chapter-components" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">各章节互动组件</div>
              <div className="text-xs text-white/50">Chapter Detail</div>
            </div>
          </Link>
          <Link
            href="/interactive-learning/chapter-components"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            返回章节入口
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <header className="mb-8 rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-slate-300">{description}</p>
        </header>

        {content}
      </main>
    </div>
  );
}
