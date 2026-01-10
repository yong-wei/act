'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { TeachingResource } from '@prisma/client';
import { ResourceRenderer } from '@/features/lesson-engine/resource-renderer';

export default function InteractiveResourcePage() {
  const params = useParams() as { id?: string } | null;
  const resourceId = params?.id;
  const [resource, setResource] = useState<TeachingResource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="flex w-full items-center gap-4 px-4 py-4">
          <Link
            href="/interactive-learning"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回互动资源库
          </Link>
          <div className="h-4 w-px bg-slate-700" />
          <div className="text-sm text-slate-300">
            {resource?.title || '互动资源'}
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-64px)]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-3">正在加载资源...</span>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            {error}
          </div>
        ) : resource ? (
          <ResourceRenderer resource={resource} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">
            资源未加载
          </div>
        )}
      </main>
    </div>
  );
}
