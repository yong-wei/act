'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { TeachingResource } from '@prisma/client';
import { InteractiveLearningShell } from '@/features/interactive/interactive-learning-shell';
import { ResourceRenderer } from '@/features/lesson-engine/resource-renderer';

export default function InteractiveResourcePage() {
  const params = useParams() as { id?: string } | null;
  const searchParams = useSearchParams();
  const resourceId = params?.id;
  const source = searchParams.get('source');
  const categorySlug = searchParams.get('category');
  const [resource, setResource] = useState<TeachingResource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sourceContext = source === 'cross-domain-exploration'
    ? {
        label: '跨域探索',
        href: '/interactive-learning/cross-domain-exploration',
        family: 'interactive-learning-cross-domain',
      }
    : source === 'chapter-components' && categorySlug
      ? {
          label: '章节组件',
          href: `/interactive-learning/chapter-components/${categorySlug}`,
          family: 'interactive-learning-chapter-components',
        }
      : {
          label: '互动学习',
          href: '/interactive-learning',
          family: 'interactive-learning',
        };

  useEffect(() => {
    if (!resourceId) return;

    const fetchResource = async () => {
      try {
        const res = await fetch(`/api/resources/${resourceId}`);
        if (!res.ok) {
          setError('资源不存在或无法访问');
          return;
        }
        const data = (await res.json()) as TeachingResource;
        setResource(data);
      } catch (err) {
        console.error('Failed to load resource', err);
        setError('资源加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResource();
  }, [resourceId]);

  return (
    <InteractiveLearningShell
      activeHref={resourceId ? `/interactive-learning/resources/${resourceId}` : '/interactive-learning/resources/[id]'}
      title={resource?.title || '互动资源'}
      subtitle="Interactive resource workspace"
      breadcrumbs={[
        { label: '互动学习', href: '/interactive-learning' },
        { label: sourceContext.label, href: sourceContext.href },
        { label: resource?.title || '互动资源' },
      ]}
      actions={(
        <Link
          href={sourceContext.href}
          className="inline-flex items-center gap-2 rounded-md border border-platform-border bg-platform-surface px-3 py-2 text-sm text-platform-fg-secondary transition hover:border-platform-border-strong hover:text-platform-action-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          返回{sourceContext.label}
        </Link>
      )}
    >
      <section
        className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[1440px] flex-col px-4 py-6"
        data-commercial-workspace="interactive-learning"
        data-commercial-student-entry-route="/interactive-learning/resources/[id]"
        data-route-family={sourceContext.family}
        data-route-source={sourceContext.href}
      >
        <div className="h-[calc(100vh-12rem)] min-h-[calc(100vh-12rem)] overflow-hidden rounded-lg border border-platform-border bg-platform-surface">
        {isLoading ? (
          <div className="flex h-full min-h-[20rem] items-center justify-center text-platform-fg-secondary">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-3">正在加载资源...</span>
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[20rem] items-center justify-center text-platform-fg-secondary">
            {error}
          </div>
        ) : resource ? (
          <ResourceRenderer resource={resource} />
        ) : (
          <div className="flex h-full min-h-[20rem] items-center justify-center text-platform-fg-secondary">
            资源未加载
          </div>
        )}
        </div>
      </section>
    </InteractiveLearningShell>
  );
}
